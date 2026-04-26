// Schema runtime loader — browser variant.
//
// Side-effect import. Adds a runtime provider that supports validate
// and browser modes only. Eagerly installs the browser runtime on
// globalThis at module load.
//
// The browser-only set of fragments is what gets tree-shaken into the
// browser bundle: validate (~31 KB) + browser-stubs (~1 KB). DB-naming,
// ORM, and DDL are not imported here, so Bun's tree-shaker leaves them
// out of `docs/dist/rip.min.js`.

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
