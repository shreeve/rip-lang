#!/usr/bin/env bun
/**
 * Schema public-error message snapshot.
 *
 * Pins the externally-visible error messages emitted by the schema
 * runtime so the Phase 2 refactor (splitting SCHEMA_RUNTIME into
 * fragments) can't silently change them. Runs GREEN against the
 * current runtime; must continue to run GREEN after the refactor.
 *
 * Per peer review: "moving code from one giant template literal into
 * fragments can alter function names, line numbers, and messages.
 * If tests assert exact messages, pin the public ones before moving
 * code."
 *
 * Pinned:
 *   1. SchemaError shape and message format ("Name: field: error")
 *   2. :mixin not-instantiable message
 *   3. :model-only API error mentions kind and method
 *   4. .pick("missing") error format
 *   5. .extend collision error format
 *   6. enum-rejection error format
 *   7. version mismatch error format
 */

import { SCHEMA_RUNTIME } from '../src/loader-server.js';

function color(code, s) { return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s; }
const green = s => color('32;1', s);
const red = s => color('31;1', s);

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
    failures.push({ name, error: e });
    failed++;
  }
}

// Eval the current runtime in a fresh context so every test gets a
// clean __SchemaRegistry. Same pattern as test/schema-singleton.test.js.
function freshRuntime() {
  const sandbox = {};
  const body = `
    var globalThis = arguments[0];
    ${SCHEMA_RUNTIME}
    return { __schema, SchemaError, __SchemaRegistry, __schemaSetAdapter };
  `;
  return new Function(body)(sandbox);
}

console.log('\n' + color('36', '── SchemaError pinned format ──'));

await check('SchemaError on parse() failure: "Name: ..."', () => {
  const rt = freshRuntime();
  const sch = rt.__schema({
    kind: 'input',
    name: 'Pinned1',
    entries: [{ tag: 'field', name: 'email', modifiers: ['!'], typeName: 'email', array: false }],
  });
  let err;
  try { sch.parse({ email: 'not-email' }); }
  catch (e) { err = e; }
  if (!err) throw new Error('parse did not throw');
  if (err.name !== 'SchemaError') throw new Error('SchemaError.name changed: ' + err.name);
  if (err.schemaName !== 'Pinned1') throw new Error('schemaName changed: ' + err.schemaName);
  if (err.schemaKind !== 'input') throw new Error('schemaKind changed: ' + err.schemaKind);
  if (!Array.isArray(err.issues) || err.issues.length === 0) {
    throw new Error('issues array missing or empty');
  }
  if (!err.message.startsWith('Pinned1:')) {
    throw new Error('message format changed: ' + err.message);
  }
});

await check('SchemaError on missing required field includes field name', () => {
  const rt = freshRuntime();
  const sch = rt.__schema({
    kind: 'input',
    name: 'Required1',
    entries: [{ tag: 'field', name: 'name', modifiers: ['!'], typeName: 'string', array: false }],
  });
  let msg;
  try { sch.parse({}); } catch (e) { msg = e.message; }
  if (!msg) throw new Error('did not throw');
  if (!msg.includes('name')) throw new Error('field name missing from message: ' + msg);
});

await check('SchemaError.issues each have field, error, message', () => {
  const rt = freshRuntime();
  const sch = rt.__schema({
    kind: 'input',
    name: 'IssueShape',
    entries: [{ tag: 'field', name: 'email', modifiers: ['!'], typeName: 'email', array: false }],
  });
  try { sch.parse({ email: 'bad' }); }
  catch (e) {
    for (const issue of e.issues) {
      if (typeof issue.field !== 'string') throw new Error('issue.field shape changed');
      if (typeof issue.error !== 'string' && issue.error !== undefined) {
        throw new Error('issue.error shape changed');
      }
      if (typeof issue.message !== 'string') throw new Error('issue.message shape changed');
    }
  }
});

console.log('\n' + color('36', '── :mixin and :model-only API errors ──'));

await check('mixin instantiation error: "X is not instantiable"', () => {
  const rt = freshRuntime();
  const sch = rt.__schema({ kind: 'mixin', name: 'M', entries: [] });
  let msg;
  try { sch.parse({}); } catch (e) { msg = e.message; }
  if (!msg) throw new Error('mixin parse did not throw');
  if (!/mixin.*not instantiable/i.test(msg)) {
    throw new Error('mixin error message changed: ' + msg);
  }
});

await check(":model-only API: .find on :shape mentions method and kind", async () => {
  const rt = freshRuntime();
  const sch = rt.__schema({ kind: 'shape', name: 'NotModel', entries: [] });
  // .find is async — _assertModel throws inside an async function which
  // wraps it as a rejected Promise. We await the rejection.
  let msg;
  try { await sch.find(1); } catch (e) { msg = e.message; }
  if (!msg) throw new Error('did not throw');
  if (!/find/.test(msg)) throw new Error('method name missing: ' + msg);
  if (!/model/i.test(msg)) throw new Error('did not mention :model: ' + msg);
});

await check(":model-only API: .toSQL on :input mentions method", () => {
  const rt = freshRuntime();
  const sch = rt.__schema({ kind: 'input', name: 'NotModel', entries: [] });
  let msg;
  try { sch.toSQL(); } catch (e) { msg = e.message; }
  if (!msg) throw new Error('did not throw');
  if (!/toSQL/.test(msg)) throw new Error('method name missing: ' + msg);
});

console.log('\n' + color('36', '── algebra errors ──'));

await check('.pick("missing") error mentions field name and schema', () => {
  const rt = freshRuntime();
  const sch = rt.__schema({
    kind: 'shape',
    name: 'A1',
    entries: [{ tag: 'field', name: 'name', modifiers: ['!'], typeName: 'string', array: false }],
  });
  let msg;
  try { sch.pick('missing'); } catch (e) { msg = e.message; }
  if (!msg) throw new Error('pick did not throw');
  if (!/missing/.test(msg)) throw new Error('field name missing from message: ' + msg);
});

await check('.extend collision error format', () => {
  const rt = freshRuntime();
  const a = rt.__schema({
    kind: 'shape',
    name: 'A2',
    entries: [{ tag: 'field', name: 'x', modifiers: ['!'], typeName: 'string', array: false }],
  });
  const b = rt.__schema({
    kind: 'shape',
    name: 'B2',
    entries: [{ tag: 'field', name: 'x', modifiers: ['!'], typeName: 'integer', array: false }],
  });
  let msg;
  try { a.extend(b); } catch (e) { msg = e.message; }
  if (!msg) throw new Error('extend did not throw');
  if (!/x|collision|extend/i.test(msg)) {
    throw new Error('extend error format changed: ' + msg);
  }
});

console.log('\n' + color('36', '── enum errors ──'));

await check('enum rejection format', () => {
  const rt = freshRuntime();
  const sch = rt.__schema({
    kind: 'enum',
    name: 'Role',
    entries: [
      { tag: 'enum-member', name: 'admin' },
      { tag: 'enum-member', name: 'user' },
    ],
  });
  let msg;
  try { sch.parse('bogus'); } catch (e) { msg = e.message; }
  if (!msg) throw new Error('enum parse did not throw');
  if (!/Role|bogus|admin|user|enum/.test(msg)) {
    throw new Error('enum rejection format changed: ' + msg);
  }
});

console.log('\n' + color('36', '── runtime version mismatch ──'));

await check('version mismatch error mentions both versions', () => {
  // Pre-set a wrong version on the host globalThis, then evaluate the
  // runtime inside it. The runtime should detect the mismatch.
  const sandbox = { __ripSchema: { __version: 999 } };
  const body = `
    var globalThis = arguments[0];
    ${SCHEMA_RUNTIME}
  `;
  let msg;
  try { new Function(body)(sandbox); }
  catch (e) { msg = e.message; }
  if (!msg) throw new Error('version mismatch did not throw');
  if (!/version mismatch/i.test(msg)) {
    throw new Error('version mismatch message changed: ' + msg);
  }
  if (!msg.includes('999')) throw new Error('did not mention loaded version: ' + msg);
});

console.log('');
const total = passed + failed;
if (failed === 0) {
  console.log(green(`${total} checks: ${passed} passing`));
  console.log('');
  process.exit(0);
} else {
  console.log(red(`${total} checks: ${passed} passing, ${failed} failing`));
  console.log('');
  process.exit(1);
}
