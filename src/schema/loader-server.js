// Schema runtime loader — server / CLI / migration variant.
//
// Why this file exists (peer-review: "are loaders just picking which
// fragments to concatenate, or doing real work?"):
//
//   The loader is the IMPORT BOUNDARY. By having loader-server.js
//   import all five fragments and loader-browser.js import only
//   validate + browser-stubs, Bun's tree-shaker can statically
//   determine which fragment string constants reach which entry
//   point. If the mode-switch logic lived in src/schema.js (which is
//   reachable from BOTH browser and server entries), every fragment
//   constant would be statically reachable from every entry, and
//   tree-shaking couldn't remove anything. The two-loader split is
//   what makes the bundle savings real.
//
// Side-effect import. Adds a runtime provider that supports all four
// modes (validate / browser / server / migration) and eagerly installs
// the migration runtime on globalThis at module load.
//
// Used by every Node-side caller of the compiler:
//   - bin/rip                         (CLI)
//   - test/runner.js, test/types/...  (test runner)
//   - src/typecheck.js                (LSP / rip check)
//   - any server-side code that imports src/compiler.js

import {
  SCHEMA_RUNTIME_WRAPPER_HEAD,
  SCHEMA_RUNTIME_WRAPPER_TAIL,
  SCHEMA_VALIDATE_RUNTIME,
  SCHEMA_DB_NAMING_RUNTIME,
  SCHEMA_ORM_RUNTIME,
  SCHEMA_DDL_RUNTIME,
  SCHEMA_BROWSER_STUBS_RUNTIME,
} from './runtime.generated.js';
import { setSchemaRuntimeProvider } from '../schema.js';

function provider({ mode = 'migration' } = {}) {
  let body;
  switch (mode) {
    case 'validate':
      body = SCHEMA_VALIDATE_RUNTIME;
      break;
    case 'browser':
      body = SCHEMA_VALIDATE_RUNTIME + '\n' + SCHEMA_BROWSER_STUBS_RUNTIME;
      break;
    case 'server':
      body = SCHEMA_VALIDATE_RUNTIME + '\n' + SCHEMA_DB_NAMING_RUNTIME + '\n' + SCHEMA_ORM_RUNTIME;
      break;
    case 'migration':
      body = SCHEMA_VALIDATE_RUNTIME + '\n' + SCHEMA_DB_NAMING_RUNTIME + '\n' + SCHEMA_ORM_RUNTIME + '\n' + SCHEMA_DDL_RUNTIME;
      break;
    default:
      throw new Error(`unknown schema runtime mode: ${mode}`);
  }
  return (SCHEMA_RUNTIME_WRAPPER_HEAD + body + SCHEMA_RUNTIME_WRAPPER_TAIL).trimStart();
}

setSchemaRuntimeProvider(provider);

// Eagerly install migration runtime so test harnesses that emit with
// skipRuntimes: true find {__schema, SchemaError} on globalThis.
export const SCHEMA_RUNTIME = provider({ mode: 'migration' });
if (typeof globalThis !== 'undefined' && !globalThis.__ripSchema) {
  try { (0, eval)(SCHEMA_RUNTIME); } catch {}
}
