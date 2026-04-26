// Schema runtime loader — browser variant.
//
// Why this file exists: this is the IMPORT BOUNDARY for the browser
// bundle. By only importing validate + browser-stubs fragments here,
// Bun's tree-shaker can omit db-naming / orm / ddl from the bundle.
// If the mode-switch lived in src/schema.js (reachable from every
// entry), the bundler couldn't statically prove the unused fragments
// were unreachable and would keep them. The loader split is the lever
// that makes the bundle savings real.
//
// See loader-server.js for the corresponding server / CLI variant
// that imports all five fragments.
//
// Side-effect import. Adds a runtime provider that supports validate
// and browser modes only. Eagerly installs the browser runtime on
// globalThis at module load.

import {
  SCHEMA_RUNTIME_WRAPPER_HEAD,
  SCHEMA_RUNTIME_WRAPPER_TAIL,
  SCHEMA_VALIDATE_RUNTIME,
  SCHEMA_BROWSER_STUBS_RUNTIME,
} from './runtime.generated.js';
import { setSchemaRuntimeProvider } from '../schema.js';

function provider({ mode = 'browser' } = {}) {
  let body;
  switch (mode) {
    case 'validate':
      body = SCHEMA_VALIDATE_RUNTIME;
      break;
    case 'browser':
      body = SCHEMA_VALIDATE_RUNTIME + '\n' + SCHEMA_BROWSER_STUBS_RUNTIME;
      break;
    case 'server':
    case 'migration':
      throw new Error(
        "schema runtime mode '" + mode + "' is not available in the browser. " +
        "ORM and DDL features require side-effect-importing loader-server.js."
      );
    default:
      throw new Error(`unknown schema runtime mode: ${mode}`);
  }
  return (SCHEMA_RUNTIME_WRAPPER_HEAD + body + SCHEMA_RUNTIME_WRAPPER_TAIL).trimStart();
}

setSchemaRuntimeProvider(provider);

// Eagerly install browser runtime so user code compiled with
// skipRuntimes: true (the typical case in browser bundles) finds
// {__schema, SchemaError} on globalThis.
export const SCHEMA_RUNTIME = provider({ mode: 'browser' });
if (typeof globalThis !== 'undefined' && !globalThis.__ripSchema) {
  try { (0, eval)(SCHEMA_RUNTIME); } catch {}
}
