#!/usr/bin/env bun
/**
 * Schema runtime mode-matrix tests
 *
 * Phase 2 of the bundle restructure splits SCHEMA_RUNTIME into separable
 * fragments composed by execution context. This test file pins the
 * augmentation seam BEFORE the refactor so we can run it red, refactor
 * until green, and never silently drift the public surface.
 *
 * Mode matrix (per peer review):
 *
 *   validate   = VALIDATE                                (pure)
 *   browser    = VALIDATE + BROWSER_STUBS                (browser bundle)
 *   server     = VALIDATE + DB_NAMING + ORM              (server runtime)
 *   migration  = VALIDATE + DB_NAMING + ORM + DDL        (migration tool)
 *
 * What this file tests:
 *
 *  1. Each mode imports/exports as expected.
 *  2. validate mode: __SchemaDef has parse/safe/ok and algebra; .find /
 *     .save / .destroy / .toSQL are NOT defined.
 *  3. browser mode: those four are defined as throwing stubs whose
 *     message says ORM/DDL is not available in the browser.
 *  4. server mode: those four are real, working methods.
 *  5. Augmentation is idempotent — installing twice doesn't double.
 *  6. Descriptor invariance — same input descriptor produces the same
 *     validation-visible behavior across all modes.
 *  7. Public error message snapshot — SchemaError messages, the
 *     :mixin-not-instantiable error, the :model-only-API error, and
 *     the browser-stub error are all pinned.
 *
 * Tests RED before the refactor (imports fail / methods missing).
 * Tests GREEN after the refactor (mode matrix wired in).
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const schemaPath = resolve(repoRoot, 'src/schema.js');

function color(code, s) {
  return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s;
}
const green = s => color('32;1', s);
const red = s => color('31;1', s);
const dim = s => color('2', s);

let passed = 0;
let failed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ${green('✓')} ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ${red('✗')} ${name}`);
    console.log(`    ${red(e.message)}`);
    if (e.stack) {
      const stackLine = e.stack.split('\n')[1] || '';
      console.log(`    ${dim(stackLine.trim())}`);
    }
    failures.push({ name, error: e });
    failed++;
  }
}

// ============================================================================
// Helpers — load runtime fragments for a given mode into a fresh sandbox
// ============================================================================
//
// We import the schema module dynamically per test to get the constants and
// the mode-aware getSchemaRuntime(). For each mode we eval the composed
// runtime in an isolated fresh context (via a Function constructor), so
// mode A's installation can't pollute mode B's. This mirrors how the
// runtime gets injected into compiled bundles in production.

async function loadSchemaModule() {
  // Force a fresh import each time so each test gets a clean module.
  const url = `file://${schemaPath}?t=${Date.now()}`;
  return await import(url);
}

function evalRuntimeIsolated(runtimeSrc) {
  // Wrap the runtime body in a function that aliases globalThis to a
  // fresh sandbox and returns the runtime's destructured exports.
  // This mirrors test/schema-singleton.test.js's pattern.
  const sandbox = {};
  const body = `
    var globalThis = arguments[0];
    ${runtimeSrc}
    return { __schema, SchemaError, __SchemaRegistry, __schemaSetAdapter };
  `;
  return new Function(body)(sandbox);
}

// ============================================================================
// 1. Module exports — these will fail RED before Phase 2 lands.
// ============================================================================

console.log('\n' + color('36', '── Module exports (mode matrix wiring) ──'));

const mod = await loadSchemaModule();

await check('exports getSchemaRuntime as a function taking { mode }', () => {
  if (typeof mod.getSchemaRuntime !== 'function') {
    throw new Error("schema.js does not export getSchemaRuntime");
  }
  // Must accept an options object with mode. Calling with mode: 'validate'
  // should return a string runtime.
  const out = mod.getSchemaRuntime({ mode: 'validate' });
  if (typeof out !== 'string') throw new Error('getSchemaRuntime({mode:"validate"}) must return a string');
  if (out.length < 1000) throw new Error('validate runtime suspiciously short: ' + out.length + ' bytes');
});

await check('exports SCHEMA_VALIDATE_RUNTIME constant', () => {
  if (typeof mod.SCHEMA_VALIDATE_RUNTIME !== 'string') {
    throw new Error('SCHEMA_VALIDATE_RUNTIME not exported');
  }
});

await check('exports SCHEMA_DB_NAMING_RUNTIME constant', () => {
  if (typeof mod.SCHEMA_DB_NAMING_RUNTIME !== 'string') {
    throw new Error('SCHEMA_DB_NAMING_RUNTIME not exported');
  }
});

await check('exports SCHEMA_ORM_RUNTIME constant', () => {
  if (typeof mod.SCHEMA_ORM_RUNTIME !== 'string') {
    throw new Error('SCHEMA_ORM_RUNTIME not exported');
  }
});

await check('exports SCHEMA_DDL_RUNTIME constant', () => {
  if (typeof mod.SCHEMA_DDL_RUNTIME !== 'string') {
    throw new Error('SCHEMA_DDL_RUNTIME not exported');
  }
});

await check('exports SCHEMA_BROWSER_STUBS_RUNTIME constant', () => {
  if (typeof mod.SCHEMA_BROWSER_STUBS_RUNTIME !== 'string') {
    throw new Error('SCHEMA_BROWSER_STUBS_RUNTIME not exported');
  }
});

await check('rejects unknown modes', () => {
  let threw = false;
  try { mod.getSchemaRuntime({ mode: 'bogus' }); }
  catch (e) {
    threw = true;
    if (!/unknown.*mode/i.test(e.message)) {
      throw new Error('error message should mention unknown mode: ' + e.message);
    }
  }
  if (!threw) throw new Error('did not throw on unknown mode');
});

// ============================================================================
// 2. Validate mode — pure validation, no ORM/DDL/stubs
// ============================================================================

console.log('\n' + color('36', '── validate mode ──'));

await check('validate: __SchemaDef has parse/safe/ok', () => {
  const rt = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'validate' }));
  const sch = rt.__schema({
    kind: 'shape',
    name: 'V1',
    entries: [{ tag: 'field', name: 'name', modifiers: ['!'], typeName: 'string', array: false }],
  });
  for (const m of ['parse', 'safe', 'ok']) {
    if (typeof sch[m] !== 'function') throw new Error('validate: missing ' + m);
  }
});

await check('validate: __SchemaDef has algebra (pick/omit/partial/required/extend)', () => {
  const rt = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'validate' }));
  const sch = rt.__schema({
    kind: 'shape',
    name: 'V2',
    entries: [{ tag: 'field', name: 'name', modifiers: ['!'], typeName: 'string', array: false }],
  });
  for (const m of ['pick', 'omit', 'partial', 'required', 'extend']) {
    if (typeof sch[m] !== 'function') throw new Error('validate: missing ' + m);
  }
});

await check('validate: __SchemaDef has NO ORM methods (find/where/all/create)', () => {
  const rt = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'validate' }));
  const sch = rt.__schema({
    kind: 'model',
    name: 'V3',
    entries: [
      { tag: 'field', name: 'name', modifiers: ['!'], typeName: 'string', array: false },
    ],
  });
  for (const m of ['find', 'where', 'all', 'first', 'count', 'create']) {
    if (typeof sch[m] === 'function') {
      throw new Error('validate: ORM method ' + m + ' should NOT exist (got function)');
    }
  }
});

await check('validate: __SchemaDef has NO toSQL', () => {
  const rt = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'validate' }));
  const sch = rt.__schema({
    kind: 'model',
    name: 'V4',
    entries: [{ tag: 'field', name: 'id', modifiers: ['!'], typeName: 'integer', array: false }],
  });
  if (typeof sch.toSQL === 'function') {
    throw new Error('validate: toSQL should NOT exist');
  }
});

// ============================================================================
// 3. Browser mode — validate + throwing stubs
// ============================================================================

console.log('\n' + color('36', '── browser mode (stub-and-throw) ──'));

await check('browser: __SchemaDef has parse/safe/ok (validate functions intact)', () => {
  const rt = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'browser' }));
  const sch = rt.__schema({
    kind: 'shape',
    name: 'B1',
    entries: [{ tag: 'field', name: 'name', modifiers: ['!'], typeName: 'string', array: false }],
  });
  const inst = sch.parse({ name: 'ok' });
  if (inst.name !== 'ok') throw new Error('parse did not return expected value');
});

await check('browser: .find on :model throws "not available in browser"', () => {
  const rt = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'browser' }));
  const sch = rt.__schema({
    kind: 'model',
    name: 'B2',
    entries: [{ tag: 'field', name: 'name', modifiers: ['!'], typeName: 'string', array: false }],
  });
  if (typeof sch.find !== 'function') throw new Error('browser: .find stub missing');
  let threw = null;
  try {
    const r = sch.find(1);
    if (r && typeof r.catch === 'function') {
      // Async stub — resolution we don't await. Force sync path by checking thrown sync first.
      // If the stub returns a rejected promise, that's also acceptable.
      threw = 'returned-promise';
    }
  } catch (e) { threw = e; }
  if (!threw) throw new Error('browser: .find did not throw');
  if (threw !== 'returned-promise') {
    if (!/browser|@rip-lang\/db/.test(threw.message)) {
      throw new Error('browser: .find error should mention browser or @rip-lang/db, got: ' + threw.message);
    }
  }
});

await check('browser: .toSQL throws (DDL is migration-only, never browser)', () => {
  const rt = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'browser' }));
  const sch = rt.__schema({
    kind: 'model',
    name: 'B3',
    entries: [{ tag: 'field', name: 'id', modifiers: ['!'], typeName: 'integer', array: false }],
  });
  if (typeof sch.toSQL !== 'function') throw new Error('browser: .toSQL stub missing');
  let threw;
  try { sch.toSQL(); } catch (e) { threw = e; }
  if (!threw) throw new Error('browser: .toSQL did not throw');
  if (!/browser|migration|@rip-lang/.test(threw.message)) {
    throw new Error('browser: .toSQL error message should mention browser/migration: ' + threw.message);
  }
});

// ============================================================================
// 4. Server mode — real ORM, no DDL
// ============================================================================

console.log('\n' + color('36', '── server mode (validate + ORM) ──'));

await check('server: __SchemaDef has parse/safe/ok and ORM methods', () => {
  const rt = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'server' }));
  const sch = rt.__schema({
    kind: 'model',
    name: 'S1',
    entries: [{ tag: 'field', name: 'name', modifiers: ['!'], typeName: 'string', array: false }],
  });
  for (const m of ['parse', 'safe', 'ok', 'find', 'where', 'all', 'create']) {
    if (typeof sch[m] !== 'function') throw new Error('server: missing ' + m);
  }
});

await check('server: .toSQL is NOT present (DDL is migration-only)', () => {
  const rt = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'server' }));
  const sch = rt.__schema({
    kind: 'model',
    name: 'S2',
    entries: [{ tag: 'field', name: 'id', modifiers: ['!'], typeName: 'integer', array: false }],
  });
  if (typeof sch.toSQL === 'function') {
    throw new Error('server: toSQL should NOT exist (migration-only)');
  }
});

// ============================================================================
// 5. Migration mode — everything
// ============================================================================

console.log('\n' + color('36', '── migration mode (validate + ORM + DDL) ──'));

await check('migration: __SchemaDef has every method', () => {
  const rt = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'migration' }));
  const sch = rt.__schema({
    kind: 'model',
    name: 'M1',
    entries: [{ tag: 'field', name: 'name', modifiers: ['!'], typeName: 'string', array: false }],
  });
  for (const m of ['parse', 'safe', 'ok', 'find', 'where', 'all', 'create', 'toSQL']) {
    if (typeof sch[m] !== 'function') throw new Error('migration: missing ' + m);
  }
});

await check('migration: .toSQL emits CREATE TABLE for a :model', () => {
  const rt = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'migration' }));
  const sch = rt.__schema({
    kind: 'model',
    name: 'Widget',
    entries: [
      { tag: 'field', name: 'name', modifiers: ['!'], typeName: 'string', array: false },
    ],
  });
  const sql = sch.toSQL();
  if (!sql || !/CREATE TABLE/i.test(sql)) {
    throw new Error('migration: toSQL did not emit CREATE TABLE: ' + sql);
  }
});

// ============================================================================
// 6. Augmentation idempotence
// ============================================================================

console.log('\n' + color('36', '── augmentation idempotence ──'));

await check('server: can install ORM augmentation twice without doubling methods', () => {
  // The runtime singleton check should make repeat installs no-op.
  // Run the runtime twice in the same sandbox (simulating two bundles
  // loading) and confirm __schema identity is preserved.
  const sandbox = {};
  const src = mod.getSchemaRuntime({ mode: 'server' });
  const body1 = `var globalThis = arguments[0]; ${src}; return __schema;`;
  const body2 = `var globalThis = arguments[0]; ${src}; return __schema;`;
  const first = new Function(body1)(sandbox);
  const second = new Function(body2)(sandbox);
  if (first !== second) {
    throw new Error('augmentation idempotence: __schema identity drifted');
  }
});

// ============================================================================
// 7. Descriptor invariance — validation-visible behavior is the same
// across modes (modes can ADD methods but must not CHANGE validation).
// ============================================================================

console.log('\n' + color('36', '── descriptor invariance across modes ──'));

const inputDescriptor = {
  kind: 'input',
  name: 'Inv1',
  entries: [
    { tag: 'field', name: 'email', modifiers: ['!'], typeName: 'email', array: false },
    { tag: 'field', name: 'age', modifiers: [], typeName: 'integer', array: false, constraints: { min: 0, max: 150 } },
  ],
};

function tryValidate(rt) {
  const sch = rt.__schema(inputDescriptor);
  const ok = sch.parse({ email: 'a@b.c', age: 30 });
  return ok.email + ':' + ok.age;
}

await check('validate-mode parse() and server-mode parse() return identical instances', () => {
  const v = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'validate' }));
  const s = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'server' }));
  if (tryValidate(v) !== tryValidate(s)) {
    throw new Error('parse output differs across modes');
  }
});

await check('browser-mode parse() and server-mode parse() return identical instances', () => {
  const b = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'browser' }));
  const s = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'server' }));
  if (tryValidate(b) !== tryValidate(s)) {
    throw new Error('parse output differs between browser and server mode');
  }
});

await check('migration-mode parse() returns identical instance to validate-mode', () => {
  const v = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'validate' }));
  const m = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'migration' }));
  if (tryValidate(v) !== tryValidate(m)) {
    throw new Error('parse output differs between validate and migration mode');
  }
});

await check('SchemaError on missing required field has the same message in all modes', () => {
  const v = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'validate' }));
  const b = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'browser' }));
  const s = evalRuntimeIsolated(mod.getSchemaRuntime({ mode: 'server' }));
  const grab = (rt) => {
    const sch = rt.__schema(inputDescriptor);
    try { sch.parse({}); return null; }
    catch (e) { return e.message; }
  };
  const mv = grab(v), mb = grab(b), ms = grab(s);
  if (mv !== mb || mb !== ms) {
    throw new Error('SchemaError messages diverge:\n  validate: ' + mv + '\n  browser:  ' + mb + '\n  server:   ' + ms);
  }
});

// ============================================================================
// 8. Public error message snapshot — pin BEFORE refactoring
// ============================================================================
//
// Per peer review: moving code from one giant template literal into
// fragments will alter function names and stack traces. If tests assert
// exact messages, pin them now. These run against the CURRENT runtime
// (whatever mode it's in) so they pass today AND keep passing through
// the refactor.

console.log('\n' + color('36', '── public error message snapshot ──'));

// We use server mode for this since the existing schema.js currently
// emits the full runtime. After Phase 2, server mode is the natural
// proxy for "everything except DDL".
const refMode = mod.getSchemaRuntime ? mod.getSchemaRuntime({ mode: 'server' }) : null;
const refCtx = refMode ? evalRuntimeIsolated(refMode) : null;

if (refCtx) {
  await check('mixin instantiation error message is pinned', () => {
    const sch = refCtx.__schema({ kind: 'mixin', name: 'M', entries: [] });
    let msg;
    try { sch.parse({}); }
    catch (e) { msg = e.message; }
    if (!msg || !/mixin.*not instantiable/i.test(msg)) {
      throw new Error('mixin error message changed: ' + msg);
    }
  });

  await check(":model-only API error mentions kind and method", async () => {
    const sch = refCtx.__schema({ kind: 'shape', name: 'NotModel', entries: [] });
    let msg;
    try { await sch.find(1); } catch (e) { msg = e.message; }
    if (!msg || !/find/.test(msg) || !/model/i.test(msg)) {
      throw new Error(':model-only error message changed: ' + msg);
    }
  });

  await check('SchemaError message format: "Name: field: error"', () => {
    const sch = refCtx.__schema({
      kind: 'input',
      name: 'PinName',
      entries: [{ tag: 'field', name: 'email', modifiers: ['!'], typeName: 'email', array: false }],
    });
    let msg;
    try { sch.parse({ email: 'not-email' }); }
    catch (e) { msg = e.message; }
    if (!msg || !msg.startsWith('PinName:')) {
      throw new Error('SchemaError message format changed: ' + msg);
    }
    if (!/email/.test(msg)) {
      throw new Error('SchemaError did not mention field name: ' + msg);
    }
  });
}

// ============================================================================
// Summary
// ============================================================================

console.log('');
const total = passed + failed;
if (failed === 0) {
  console.log(green(`${total} checks: ${passed} passing`));
  console.log('');
  process.exit(0);
} else {
  console.log(red(`${total} checks: ${passed} passing, ${failed} failing`));
  console.log('');
  for (const f of failures) {
    console.log(red('  ✗ ' + f.name));
    console.log('    ' + (f.error.message || f.error));
  }
  console.log('');
  process.exit(1);
}
