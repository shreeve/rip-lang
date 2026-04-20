#!/usr/bin/env bun
/**
 * Schema runtime singleton tests
 *
 * The SCHEMA_RUNTIME template is injected verbatim into every compiled
 * Rip bundle that uses `schema`. When multiple bundles load in the same
 * process, the runtime must detect an existing installation on
 * `globalThis.__ripSchema` and bind to it instead of re-running the body.
 * Otherwise each bundle gets its own registry / adapter / class identity
 * and earlier registrations silently orphan.
 *
 * These tests evaluate the runtime template in isolation (via `new
 * Function`) in both first-load and second-load configurations, and
 * verify the idempotence properties:
 *
 *   1. Second eval returns the first runtime's symbols (same identity).
 *   2. Schemas registered by the first eval remain resolvable after a
 *      second bundle's runtime install path runs.
 *   3. Adapter identity survives a second install.
 *   4. A version mismatch on `globalThis.__ripSchema.__version` throws.
 */

import { SCHEMA_RUNTIME } from '../src/schema.js';

function color(code, s) { return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s; }
const green = s => color('32;1', s);
const red = s => color('31;1', s);

let passed = 0;
let failed = 0;

function run(name, fn) {
  try {
    fn();
    console.log(`  ${green('✓')} ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ${red('✗')} ${name}`);
    console.log(`      ${e.message}`);
    failed++;
  }
}

// Evaluate the runtime template against a fresh context-object whose
// `globalThis` property points to a supplied sandbox. This simulates a
// compiled bundle's top-level execution without polluting the real
// process global.
function evalRuntime(sandbox) {
  const body = `
    var globalThis = arguments[0];
    ${SCHEMA_RUNTIME}
    return { __schema, SchemaError, __SchemaRegistry, __schemaSetAdapter };
  `;
  // eslint-disable-next-line no-new-func
  const fn = new Function(body);
  return fn(sandbox);
}

// ──────────────────────────────────────────────────────────────────────

console.log('schema runtime singleton');

run('first eval installs globalThis.__ripSchema with __version marker', () => {
  const sandbox = {};
  const first = evalRuntime(sandbox);
  if (!sandbox.__ripSchema) throw new Error('globalThis.__ripSchema not set after first eval');
  if (sandbox.__ripSchema.__version !== 1) {
    throw new Error(`__version expected 1, got ${sandbox.__ripSchema.__version}`);
  }
  if (first.__schema !== sandbox.__ripSchema.__schema) {
    throw new Error('first eval returned __schema identity differs from global');
  }
});

run('second eval binds to existing runtime (same identity)', () => {
  const sandbox = {};
  const first = evalRuntime(sandbox);
  const second = evalRuntime(sandbox);
  if (first.__schema !== second.__schema) {
    throw new Error('second eval returned a different __schema — not singleton');
  }
  if (first.__SchemaRegistry !== second.__SchemaRegistry) {
    throw new Error('second eval returned a different __SchemaRegistry');
  }
  if (first.SchemaError !== second.SchemaError) {
    throw new Error('second eval returned a different SchemaError class');
  }
});

run('registrations survive second install', () => {
  const sandbox = {};
  const { __schema: s1, __SchemaRegistry: r1 } = evalRuntime(sandbox);
  s1({ kind: 'shape', name: 'First', entries: [] });
  if (!r1.get('First')) throw new Error('First did not register in registry');

  const { __schema: s2, __SchemaRegistry: r2 } = evalRuntime(sandbox);
  // Registry must be the same instance — if it's replaced, First is orphaned.
  if (r1 !== r2) throw new Error('second eval replaced the registry');
  if (!r2.get('First')) throw new Error('First was lost from registry after second eval');

  s2({ kind: 'shape', name: 'Second', entries: [] });
  if (!r1.get('Second')) throw new Error('Second did not register into shared registry');
  if (!r2.get('First')) throw new Error('First disappeared after Second was registered');
});

run('adapter identity survives second install', () => {
  const sandbox = {};
  const { __schemaSetAdapter: set1 } = evalRuntime(sandbox);
  const customAdapter = { query: () => 'custom' };
  set1(customAdapter);

  // Evaluate second runtime and ensure the custom adapter is still active.
  // We probe by creating a :model def and inspecting that ORM calls would
  // route through the installed adapter. Since __schemaAdapter isn't
  // exported, we verify indirectly: running a :model .find through the
  // runtime's own path. But without an async harness here, we simply
  // check that set1's closure still points at the shared runtime — i.e.
  // calling set1 with a new adapter, then re-reading via the second
  // eval's setter, sees the same backing variable.
  const { __schemaSetAdapter: set2 } = evalRuntime(sandbox);
  // set2 should be the same function reference as set1 (singleton).
  if (set1 !== set2) throw new Error('__schemaSetAdapter identity changed');
});

run('version mismatch throws loudly', () => {
  const sandbox = { __ripSchema: { __version: 999, __schema: () => {}, SchemaError: class {}, __SchemaRegistry: {}, __schemaSetAdapter: () => {} } };
  let threw = null;
  try {
    evalRuntime(sandbox);
  } catch (e) {
    threw = e;
  }
  if (!threw) throw new Error('expected a throw on version mismatch, got none');
  if (!threw.message.includes('version mismatch')) {
    throw new Error(`throw message didn't mention version mismatch: ${threw.message}`);
  }
  if (!threw.message.includes('999')) {
    throw new Error(`throw message didn't include the mismatched version: ${threw.message}`);
  }
});

run('SchemaError instances from second eval pass instanceof check of first', () => {
  const sandbox = {};
  const { SchemaError: E1 } = evalRuntime(sandbox);
  const { SchemaError: E2 } = evalRuntime(sandbox);
  const err = new E2([], 'X', 'shape');
  if (!(err instanceof E1)) {
    throw new Error('SchemaError identity not shared — error from second bundle fails instanceof for first bundle class');
  }
});

console.log('');
console.log(`${passed + failed} checks: ${green(`${passed} passing`)}${failed ? `, ${red(`${failed} failing`)}` : ''}`);
console.log('');

process.exit(failed ? 1 : 0);
