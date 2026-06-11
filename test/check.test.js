#!/usr/bin/env bun
/**
 * Checker regression pins — `rip check` end-to-end.
 *
 * One section per fixed bug, append-only. These are NOT feature-coverage
 * tests: the curated type audit (test/types/) documents designed behavior
 * and is considered complete; bug pins land here instead, where a case is
 * a few lines with no .ts parity companion.
 *
 * Each case writes a tiny project into a temp dir (strict mode, checkAll)
 * and runs `rip check` over it — the integration point where codegen, the
 * dts emitter, and typecheck.js's merge passes all meet, which is where
 * these bugs lived.
 */

import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const rip = resolve(root, 'bin', 'rip');
const tmpDir = resolve(__dirname, '_check_tmp');

function color(code, s) { return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s; }
const green = s => color('32;1', s), red = s => color('31;1', s);
let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); console.log(`  ${green('✓')} ${name}`); passed++; }
  catch (e) { console.log(`  ${red('✗')} ${name}`); console.log(`    ${red(e.message)}`); failed++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

// Wipe the temp project, write the given files, run `rip check .` over it.
// File names may contain subdirectories ('app/stash.rip').
function checkProject(files) {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(resolve(tmpDir, 'package.json'),
    '{"rip": {"strict": true, "checkAll": true}, "dependencies": {"@rip-lang/app": "workspace:*"}}\n');
  for (const [name, src] of Object.entries(files)) {
    const dest = resolve(tmpDir, name);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, src);
  }
  try {
    execSync(`'${rip}' check .`, { cwd: tmpDir, stdio: 'pipe' });
    return { ok: true, out: '' };
  } catch (e) {
    return { ok: false, out: (e.stdout?.toString() || '') + (e.stderr?.toString() || '') };
  }
}

// ── 1. Inline `schema :shape` as `.extend()` argument carries its type ──
//
// An anonymous expression-position schema used to resolve to the
// `__schema(d: any): any` fallback overload, so `extend<U>` inferred
// nothing and the derived type silently lost every extended field.
// Fixed: codegen stamps a shadow-only `__anon` key on the descriptor and
// the dts pass emits a keyed overload (SCHEMA-GAPS.md gap 14).

check('inline-extend fields survive into the derived type', () => {
  const r = checkProject({
    'ex.rip': `export User = schema :shape
  name!  string

export Admin = User.extend (schema :shape
  permissions! string[])

a = Admin.parse({})
ok = a.permissions.length + a.name.length
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);
});

check('a bogus property on the extended type still errors', () => {
  const r = checkProject({
    'ex.rip': `export Base = schema :shape
  title! string

export Extended = Base.extend (schema :shape
  count! integer)

b = Extended.parse({})
bad = b.bogus
`,
  });
  assert(!r.ok, 'expected a type error on b.bogus');
  assert(/bogus/.test(r.out), 'unexpected output:\n' + r.out);
});

// ── 2. A typed local must not leak its annotation onto same-named locals ──
//
// `items:: OrderItem[]` in one function used to stamp `: OrderItem[]` onto
// every same-named hoist in the file: dts emitted a header `let` line for
// the function-local, and typecheck.js's inline-let merge applies header
// types to body hoists by NAME. Fixed: function-locals no longer emit the
// header line (the in-body typed hoist already covers them, scope-correctly).

check('sibling functions with one typed local check independently', () => {
  const r = checkProject({
    'scope.rip': `f = ->
  items = [1, 2]
  items.length

g = ->
  items:: string[] = []
  items.push('x')
  items.length
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);
});

check("the untyped sibling keeps its own inferred type, not the annotation", () => {
  const r = checkProject({
    'scope.rip': `f = ->
  items = [1, 2]
  items.push('nope')
  items.length

g = ->
  items:: string[] = []
  items.length
`,
  });
  assert(!r.ok, "expected an error: f's items is number[], 'nope' is a string");
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

// ── 3. Render-block conditionals narrow nullable state ──
//
// The shadow used to emit a render `if` as a bare condition statement with
// both branches flattened as unguarded siblings, so `if order then
// order.total` failed strict checking against `T | null`. Fixed: walkRender
// emits real `if (...) { } else { }` blocks (mirroring its for-loop case).

check('reads in the guarded render branch narrow to non-null', () => {
  const r = checkProject({
    'dash.rip': `type Order = { id: number, total: number }

export Dash = component
  order:: Order | null := null

  render
    if order
      h1 "Order ##{order.id}"
      p "$#{order.total.toFixed(2)}"
    else
      p "loading"
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);
});

check('reads in the else branch still see the null', () => {
  const r = checkProject({
    'dash.rip': `type Order = { id: number, total: number }

export Dash = component
  order:: Order | null := null

  render
    if order
      p "ok"
    else
      p "#{order.id}"
`,
  });
  assert(!r.ok, 'expected TS2531 in the else branch');
  assert(/possibly 'null'/.test(r.out), 'unexpected output:\n' + r.out);
});

// ── 4. RFC 11 render-ready state: gates narrow, ungated reads stay honest ──
//
// `x <~ @app.data.x` stubs as `__computed(() => __ripGate(...))` — the
// generic non-null narrow, sound because the renderer loads the source
// before construction. Ungated reads keep the source's declared
// `T | null`, and the StashMethods intersection types reset()/source().

const RFC11_STASH = `import { source } from '@rip-lang/app'

export stash =
  cart: { items: [] }
  user: source { fetch: -> { firstName: 'Ada', lastName: 'Lovelace' } }
  order: source { fetch: (id:: string) -> { id: id, total: 42 } }
`;

check('gated binding is non-null at every read site', () => {
  const r = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': RFC11_STASH,
    'profile.rip': `export Profile = component
  user <~ @app.data.user
  form := { ...user }
  render
    h1 "#{user.firstName} #{user.lastName}"
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);
});

check('ungated source read stays T | null — unguarded access errors', () => {
  const r = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': RFC11_STASH,
    'nav.rip': `export Nav = component
  user ~= @app.data.user
  render
    h1 user.firstName
`,
  });
  assert(!r.ok, 'expected a nullability error on the ungated read');
  assert(/possibly 'null'/.test(r.out), 'unexpected output:\n' + r.out);
});

check('keyed gate narrows; ungated keyed read stays nullable', () => {
  const r = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': RFC11_STASH,
    'detail.rip': `export Detail = component
  order <~ @app.data.order(params.id)
  render
    p "total: #{order.total}"
`,
  });
  assert(r.ok, 'expected clean check on the keyed gate, got:\n' + r.out);

  const r2 = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': RFC11_STASH,
    'detail.rip': `export Detail = component
  o ~= @app.data.order('x')
  render
    p "#{o.total}"
`,
  });
  assert(!r2.ok, 'expected a nullability error on the ungated keyed read');
  assert(/possibly 'null'/.test(r2.out), 'unexpected output:\n' + r2.out);
});

check('stash methods are typed: reset() and the source() handle', () => {
  const r = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': RFC11_STASH,
    'tools.rip': `export Tools = component
  stats = @app.data.source('user')
  signout: -> @app.data.reset()
  render
    if stats.loading
      p "loading"
    else if stats.value
      p stats.value.firstName
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);
});

rmSync(tmpDir, { recursive: true, force: true });
console.log('');
const total = passed + failed;
if (failed === 0) { console.log(green(`${total} checks: ${passed} passing`)); process.exit(0); }
else { console.log(red(`${total} checks: ${passed} passing, ${failed} failing`)); process.exit(1); }
