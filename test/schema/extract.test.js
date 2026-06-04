#!/usr/bin/env bun
/**
 * Client projection extraction tests (browser bundle boundary)
 *
 * `extractClientProjections(source, names)` is what the browser-bundle
 * builder uses to lift a server-defined projection across the client
 * boundary: it compiles the source with projection folding ON, then for
 * each requested binding either emits a self-contained `__schema({...})`
 * re-export (shippable) or refuses with a reason.
 *
 * What this pins:
 *   1. A folded projection (`Model.pick(...)`) is shippable and the emitted
 *      synthetic source round-trips: it compiles in browser mode and the
 *      resulting schema validates exactly like the server projection would.
 *   2. A :model is REFUSED (would drag ORM/DDL to the browser).
 *   3. A schema with behavior (methods/computed) is REFUSED.
 *   4. A non-schema value (a function) is REFUSED.
 *   5. The synthetic source carries no model/ORM/DDL artifacts.
 */

import '../../src/schema/loader-server.js';   // full runtime (compile-time fold needs none, but parity check runs validate)
import { extractClientProjections, Compiler } from '../../src/compiler.js';

function color(code, s) { return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s; }
const green = s => color('32;1', s);
const red = s => color('31;1', s);

let passed = 0, failed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); console.log(`  ${green('✓')} ${name}`); passed++; }
  catch (e) { console.log(`  ${red('✗')} ${name}`); console.log(`    ${red(e.message)}`); failures.push({ name, error: e }); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const MODELS = `export User = schema :model
  firstName! string, 1..
  lastName!  string
  email!#    email
  phone?     string
  @timestamps

export Order = schema :model
  total! number, 0..
  @timestamps
  @belongs_to User

export UserView  = User.pick("id", "firstName", "lastName", "email", "phone")
export Greeter = schema :shape
  name! string
  hi: -> "hi"
export helper = () -> 42
`;

// Compile a synthetic browser module and pull a named export's schema value out.
function loadFromSynthetic(syntheticSource, name) {
  const js = new Compiler({ schemaMode: 'browser', skipPreamble: true, skipRuntimes: true })
    .compile(syntheticSource).code.replace(/export const /g, 'const ');
  const fn = new Function('__schema', `${js}\n;return ${name};`);
  return fn(globalThis.__schema);
}

check('folded projection is shippable and round-trips to the same validation', () => {
  const r = extractClientProjections(MODELS, ['UserView'], { filename: 'api/models.rip' });
  assert(r.ok, 'expected ok, got: ' + (r.error || ''));
  assert(/^export UserView = __schema\(/.test(r.source.trim()), 'unexpected synthetic source: ' + r.source);

  const View = loadFromSynthetic(r.source, 'UserView');
  assert(View.kind === 'shape', 'folded projection should be a shape, got ' + View.kind);

  // Parity with the runtime projection on a spread of inputs.
  const Runtime = new Compiler({ skipPreamble: true, skipRuntimes: true }).compile(MODELS + '\n');
  const rfn = new Function('__schema', Runtime.code.replace(/export const /g, 'const ') + '\n;return UserView;');
  const RuntimeView = rfn(globalThis.__schema);
  for (const sample of [
    { id: 1, firstName: 'Al', lastName: 'Bo', email: 'a@b.com', phone: 'x' },
    { firstName: '', email: 'bad' },
    {},
  ]) {
    assert(JSON.stringify(View.safe(sample)) === JSON.stringify(RuntimeView.safe(sample)),
      'folded vs runtime mismatch for ' + JSON.stringify(sample));
  }
});

check('a :model is refused (would drag ORM/DDL to the browser)', () => {
  const r = extractClientProjections(MODELS, ['User'], { filename: 'api/models.rip' });
  assert(!r.ok, 'expected refusal');
  assert(/:model/.test(r.error), 'error should mention :model, got: ' + r.error);
});

check('a schema with behavior is refused', () => {
  const r = extractClientProjections(MODELS, ['Greeter'], { filename: 'api/models.rip' });
  assert(!r.ok, 'expected refusal');
  assert(/behavior/.test(r.error), 'error should mention behavior, got: ' + r.error);
});

check('a field transform is refused (could close over server code)', () => {
  const src = `export Slug = schema :shape\n  name! string, -> it.name.toLowerCase()\n`;
  const r = extractClientProjections(src, ['Slug'], { filename: 'api/models.rip' });
  assert(!r.ok, 'a transform should be refused');
  assert(/behavior/.test(r.error), 'error should mention behavior, got: ' + r.error);
});

// Behavior detection is structural, not a `\bfunction\b` substring scan — a
// plain shape whose field has a literal VALUE of "function" must still ship.
check('a literal value of "function" does not trip behavior detection', () => {
  const src = `export Thing = schema :shape\n  kind! "function" | "class"\n  name! string\n`;
  const r = extractClientProjections(src, ['Thing'], { filename: 'api/models.rip' });
  assert(r.ok, 'a literal-union with "function" should ship, got: ' + (r.error || ''));
  assert(/literals/.test(r.source) && !/\btransform:/.test(r.source), 'should carry the literal union as data');
});

check('a non-schema value is refused', () => {
  const r = extractClientProjections(MODELS, ['helper'], { filename: 'api/models.rip' });
  assert(!r.ok, 'expected refusal');
  assert(/shippable schema/.test(r.error), 'error should explain, got: ' + r.error);
});

check('synthetic source carries no model/ORM/DDL artifacts', () => {
  const r = extractClientProjections(MODELS, ['UserView'], { filename: 'api/models.rip' });
  assert(r.ok, r.error);
  assert(!/kind:\s*"model"/.test(r.source), 'model kind leaked');
  assert(!/CREATE SEQUENCE|toSQL|nextval|has_many|belongs_to/.test(r.source), 'server artifact leaked');
});

console.log('');
const total = passed + failed;
if (failed === 0) {
  console.log(green(`${total} checks: ${passed} passing`));
  process.exit(0);
} else {
  console.log(red(`${total} checks: ${passed} passing, ${failed} failing`));
  process.exit(1);
}
