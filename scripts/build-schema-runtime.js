#!/usr/bin/env bun
// Schema runtime build script.
//
// Reads the five fragment files under src/schema/runtime-*.js, strips
// their header comments, and writes src/schema/runtime.generated.js
// exporting one string constant per fragment plus the IIFE wrapper
// head and tail.
//
// `getSchemaRuntime({mode})` in src/schema.js composes the right
// fragments at call time. The generated file is committed to the
// repo so fresh clones work without a build step. CI runs --check to
// fail if the working tree's runtime.generated.js doesn't match what
// regeneration would produce.
//
// Edit the source fragments, run this script, commit. CI catches drift.

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = resolve(__dirname, '..');
const fragDir   = resolve(repoRoot, 'src/schema');
const generated = resolve(fragDir, 'runtime.generated.js');

const fragments = [
  'runtime-validate.js',
  'runtime-db-naming.js',
  'runtime-orm.js',
  'runtime-ddl.js',
  'runtime-browser-stubs.js',
];

// ABI version. Bump when the cross-bundle-visible runtime surface
// (descriptor shape, exports object, registry semantics) changes
// incompatibly. Two bundles that disagree on this number can't share
// one runtime, so a mismatch at load time throws rather than silently
// fragmenting. Tracks runtime contract — not the rip-lang product semver.
const SCHEMA_RUNTIME_ABI_VERSION = 1;

// Strip the leading header comment block (which ends with the
// /* eslint-disable */ line). The body of the fragment is everything
// after.
function stripHeader(src) {
  const marker = /^\/\* eslint-disable [^\n]*\*\/\n/m;
  const m = src.match(marker);
  if (!m) {
    throw new Error('fragment missing eslint-disable header marker');
  }
  return src.slice(m.index + m[0].length).replace(/^\n+/, '');
}

const bodies = {};
for (const file of fragments) {
  const src = readFileSync(resolve(fragDir, file), 'utf8');
  const key = file.replace('runtime-', '').replace('.js', '');
  bodies[key] = stripHeader(src);
}

// Wrapper template head + tail. The mode-matrix in src/schema.js
// composes them as: WRAPPER_HEAD + body + WRAPPER_TAIL.
const WRAPPER_HEAD = `
// ---- Rip Schema Runtime ----------------------------------------------------
// Four layers, lazy compilation:
//   1 (descriptor)   object passed to __schema({...}). Raw metadata.
//   2 (normalized)   fields/methods/computed/hooks/relations/constraints.
//                    Collision checks. Table name derivation. Built once.
//   3 (validator)    compiled validator plan. Built on first .parse.
//   4a (ORM plan)    built on first .find/.create/.save.
//   4b (DDL plan)    built on first .toSQL(). Independent of 4a.
//
// Instance-singleton model:
// The runtime installs itself on globalThis.__ripSchema the first time a
// compiled bundle executes. Subsequent bundles that inject the same runtime
// template detect the existing installation and bind to it instead of
// re-running the body — giving every bundle a single shared registry,
// adapter, and class identity. The IIFE wrapper below enforces that.

var { __schema, SchemaError, __SchemaRegistry, __schemaSetAdapter } = (function() {
  if (typeof globalThis !== 'undefined' && globalThis.__ripSchema) {
    if (globalThis.__ripSchema.__version !== ${SCHEMA_RUNTIME_ABI_VERSION}) {
      throw new Error(
        "rip-schema runtime version mismatch: loaded runtime is v" +
        globalThis.__ripSchema.__version +
        ", but this bundle expects v" + ${SCHEMA_RUNTIME_ABI_VERSION} +
        ". Two compiled Rip bundles with incompatible schema runtimes are loaded in the same process."
      );
    }
    return globalThis.__ripSchema;
  }

`;

const WRAPPER_TAIL = `
  // __schemaSetAdapter is server/migration-only. In validate or browser
  // modes it doesn't exist; export an undefined slot so destructure works.
  const __schemaSetAdapterExport = typeof __schemaSetAdapter !== 'undefined'
    ? __schemaSetAdapter
    : undefined;
  const exports = {
    __schema, SchemaError, __SchemaRegistry,
    __schemaSetAdapter: __schemaSetAdapterExport,
    __version: ${SCHEMA_RUNTIME_ABI_VERSION},
  };
  if (typeof globalThis !== 'undefined') globalThis.__ripSchema = exports;
  return exports;
})();

// === End Schema Runtime ===
`;

// Escape for embedding inside a backtick-template-literal string export.
function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

const generatedSrc = `// AUTOGEN-NOTICE: do not edit by hand. Regenerate with:
//   bun scripts/build-schema-runtime.js
//
// Source fragments:
//   src/schema/runtime-validate.js       (universal — browser + server)
//   src/schema/runtime-db-naming.js      (server + migration)
//   src/schema/runtime-orm.js            (server + migration)
//   src/schema/runtime-ddl.js            (migration only)
//   src/schema/runtime-browser-stubs.js  (browser only)
//
// CI: bun scripts/build-schema-runtime.js --check fails if this file
// would change after regeneration. Edit the fragments, run the build
// script, and commit.

export const SCHEMA_RUNTIME_ABI_VERSION = ${SCHEMA_RUNTIME_ABI_VERSION};

export const SCHEMA_RUNTIME_WRAPPER_HEAD = \`${esc(WRAPPER_HEAD)}\`;
export const SCHEMA_RUNTIME_WRAPPER_TAIL = \`${esc(WRAPPER_TAIL)}\`;

export const SCHEMA_VALIDATE_RUNTIME       = \`${esc(bodies.validate)}\`;
export const SCHEMA_DB_NAMING_RUNTIME      = \`${esc(bodies['db-naming'])}\`;
export const SCHEMA_ORM_RUNTIME            = \`${esc(bodies.orm)}\`;
export const SCHEMA_DDL_RUNTIME            = \`${esc(bodies.ddl)}\`;
export const SCHEMA_BROWSER_STUBS_RUNTIME  = \`${esc(bodies['browser-stubs'])}\`;
`;

// --check mode: compare current file against what we'd produce.
if (process.argv.includes('--check')) {
  let existing = '';
  try { existing = readFileSync(generated, 'utf8'); } catch {}
  if (existing === generatedSrc) {
    if (!process.argv.includes('--quiet')) {
      console.log('  ✓ schema runtime generated file is fresh');
    }
    process.exit(0);
  }
  console.error('schema runtime is stale. Run: bun scripts/build-schema-runtime.js');
  process.exit(1);
}

writeFileSync(generated, generatedSrc);

console.log('wrote src/schema/runtime.generated.js');
console.log('  total file:    ', Buffer.byteLength(generatedSrc).toString().padStart(7), 'bytes');
const sizes = {
  WRAPPER_HEAD: Buffer.byteLength(WRAPPER_HEAD),
  WRAPPER_TAIL: Buffer.byteLength(WRAPPER_TAIL),
  validate:     Buffer.byteLength(bodies.validate),
  'db-naming':  Buffer.byteLength(bodies['db-naming']),
  orm:          Buffer.byteLength(bodies.orm),
  ddl:          Buffer.byteLength(bodies.ddl),
  'browser-stubs': Buffer.byteLength(bodies['browser-stubs']),
};
for (const [k, v] of Object.entries(sizes)) {
  console.log(`  ${k.padEnd(15)} `, v.toString().padStart(6), 'bytes');
}
const browserModeBytes  = Buffer.byteLength(WRAPPER_HEAD + bodies.validate + '\n' + bodies['browser-stubs'] + WRAPPER_TAIL);
const serverModeBytes   = Buffer.byteLength(WRAPPER_HEAD + bodies.validate + '\n' + bodies['db-naming'] + '\n' + bodies.orm + WRAPPER_TAIL);
console.log('');
console.log('  composed-mode preview:');
console.log('    browser   ', browserModeBytes.toString().padStart(6), 'bytes');
console.log('    server    ', serverModeBytes.toString().padStart(6), 'bytes');
