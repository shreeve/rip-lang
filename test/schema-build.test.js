#!/usr/bin/env bun
/**
 * Schema runtime build determinism + fragment isolation + double-load.
 *
 * Three classes of checks that the per-mode test files don't cover:
 *
 *  1. Build determinism — running build-schema-runtime.js twice on the
 *     same source must produce a byte-identical runtime.generated.js.
 *     Catches Map iteration order, timestamp drift, ad-hoc randomness.
 *
 *  2. Fragment isolation — each src/schema/runtime-*.js file must parse
 *     as standalone JavaScript (via Bun's syntax check). They're not
 *     individually executable (they reference cross-fragment symbols),
 *     but stray braces / unclosed strings should fail fast — not as
 *     a downstream symptom in some other test.
 *
 *  3. Double-load resilience — when both loader-server.js and
 *     loader-browser.js evaluate in the same process (SSR + hydration,
 *     test harness reusing a global, etc.), the singleton check must
 *     prevent re-installation. Whichever ran first wins; the second
 *     binds to it and getSchemaRuntime keeps working.
 */

import { readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function color(code, s) { return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s; }
const green = s => color('32;1', s);
const red = s => color('31;1', s);

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ${green('✓')} ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ${red('✗')} ${name}`);
    console.log(`    ${red(e.message)}`);
    failed++;
  }
}

// ============================================================================
// 1. Build determinism
// ============================================================================

console.log('\n' + color('36', '── build determinism ──'));

check('build-schema-runtime produces byte-identical output across runs', () => {
  const before = readFileSync(resolve(repoRoot, 'src/schema/runtime.generated.js'), 'utf8');
  const r = spawnSync('bun', ['scripts/build-schema-runtime.js'], { cwd: repoRoot, stdio: 'pipe' });
  if (r.status !== 0) throw new Error('build-schema-runtime exited non-zero: ' + r.stderr.toString());
  const after = readFileSync(resolve(repoRoot, 'src/schema/runtime.generated.js'), 'utf8');
  if (before !== after) {
    throw new Error('regeneration produced different bytes — non-deterministic build');
  }
});

// ============================================================================
// 2. Fragment isolation — each fragment must parse as standalone JS
// ============================================================================

console.log('\n' + color('36', '── fragment isolation (parse-only) ──'));

const fragments = [
  'runtime-validate.js',
  'runtime-db-naming.js',
  'runtime-orm.js',
  'runtime-ddl.js',
  'runtime-browser-stubs.js',
];

for (const f of fragments) {
  check(`${f} parses as standalone JavaScript`, () => {
    const path = resolve(repoRoot, 'src/schema', f);
    const src = readFileSync(path, 'utf8');
    // Just parse. Cross-fragment identifier references resolve at runtime
    // (this fragment isn't actually run standalone — only concatenated with
    // others in a shared IIFE). What we're catching: stray braces, broken
    // strings, missing semicolons, unclosed regex literals, etc.
    try { new Function(src); }
    catch (e) {
      if (e instanceof SyntaxError) throw new Error('SyntaxError: ' + e.message);
      throw e;
    }
  });
}

// ============================================================================
// 3. Browser-stub error-message pinning
// ============================================================================

console.log('\n' + color('36', '── browser-stub message text (DX surface) ──'));

check('browser stub message includes "@rip-lang/db on the server"', async () => {
  // Re-import schema with browser provider and trigger a stub.
  // (loader-browser is already side-effect-imported by other tests in
  // this run; we just verify the message text directly via a fresh eval.)
  const { SCHEMA_RUNTIME_WRAPPER_HEAD, SCHEMA_RUNTIME_WRAPPER_TAIL,
          SCHEMA_VALIDATE_RUNTIME, SCHEMA_BROWSER_STUBS_RUNTIME } =
    await import('../src/schema/runtime.generated.js');
  const body = SCHEMA_VALIDATE_RUNTIME + '\n' + SCHEMA_BROWSER_STUBS_RUNTIME;
  const runtimeSrc = SCHEMA_RUNTIME_WRAPPER_HEAD + body + SCHEMA_RUNTIME_WRAPPER_TAIL;
  const sandbox = {};
  const fn = new Function('var globalThis = arguments[0]; ' + runtimeSrc +
    '; return { __schema, SchemaError };');
  const rt = fn(sandbox);
  const sch = rt.__schema({ kind: 'model', name: 'X', entries: [
    { tag: 'field', name: 'id', modifiers: ['!'], typeName: 'integer', array: false },
  ]});
  let msg;
  try { sch.toSQL(); } catch (e) { msg = e.message; }
  if (!msg) throw new Error('toSQL stub did not throw');
  if (!msg.includes('@rip-lang/db on the server')) {
    throw new Error('stub message changed (DX-breaking): ' + msg);
  }
  if (!msg.includes('toSQL')) {
    throw new Error('stub message no longer includes API name: ' + msg);
  }
});

// ============================================================================
// 4. Double-load — both loaders register in same process
// ============================================================================

console.log('\n' + color('36', '── double-load (singleton holds across loaders) ──'));

check('loader-server then loader-browser in same process keep singleton intact', async () => {
  // We can't actually re-import loader-server.js (the module cache will
  // dedup), so we simulate: install server runtime via fresh sandbox A,
  // then install browser runtime in sandbox A. The version check in the
  // wrapper should detect the existing __ripSchema and return it
  // unchanged — the second runtime body should NOT execute.
  const { SCHEMA_RUNTIME_WRAPPER_HEAD, SCHEMA_RUNTIME_WRAPPER_TAIL,
          SCHEMA_VALIDATE_RUNTIME, SCHEMA_DB_NAMING_RUNTIME,
          SCHEMA_ORM_RUNTIME, SCHEMA_BROWSER_STUBS_RUNTIME } =
    await import('../src/schema/runtime.generated.js');

  const serverSrc = SCHEMA_RUNTIME_WRAPPER_HEAD +
    SCHEMA_VALIDATE_RUNTIME + '\n' + SCHEMA_DB_NAMING_RUNTIME + '\n' + SCHEMA_ORM_RUNTIME +
    SCHEMA_RUNTIME_WRAPPER_TAIL;
  const browserSrc = SCHEMA_RUNTIME_WRAPPER_HEAD +
    SCHEMA_VALIDATE_RUNTIME + '\n' + SCHEMA_BROWSER_STUBS_RUNTIME +
    SCHEMA_RUNTIME_WRAPPER_TAIL;

  const sandbox = {};

  const evalIn = (src) => {
    const fn = new Function('var globalThis = arguments[0]; ' + src + '; return __schema;');
    return fn(sandbox);
  };

  const firstSchema = evalIn(serverSrc);
  // Second eval should detect existing __ripSchema and return its __schema.
  const secondSchema = evalIn(browserSrc);
  if (firstSchema !== secondSchema) {
    throw new Error('double-load: __schema identity drifted — singleton broken');
  }
  // The first install's behavior (server, with .toSQL on server fragment) — but
  // we used 'server' mode which doesn't include DDL, so .toSQL shouldn't exist.
  // What matters is that the SECOND eval did NOT replace the first runtime.
  // Smoke-test by creating a schema and confirming basic validation works.
  const sch = firstSchema({ kind: 'input', name: 'D', entries: [
    { tag: 'field', name: 'a', modifiers: ['!'], typeName: 'string', array: false },
  ]});
  const ok = sch.parse({ a: 'hello' });
  if (ok.a !== 'hello') throw new Error('post-double-load validation broken');
});

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
  process.exit(1);
}
