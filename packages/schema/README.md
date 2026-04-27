# @rip-lang/schema

Schema language feature for Rip — declarative data shapes, validation, ORM, DDL, and `.d.ts` emission. Plugged into Rip's lexer and compiler via `installSchemaSupport`.

## Layout

```
packages/schema/
├── src/
│   ├── schema.js                 — language integration entry (lexer + compiler hooks)
│   ├── dts-emit.js               — .d.ts emitter (CLI / typecheck only)
│   ├── loader-browser.js         — registers validate + browser-stubs runtime
│   ├── loader-server.js          — registers full runtime (validate + naming + ORM + DDL)
│   ├── runtime-validate.js       — validation runtime fragment (universal)
│   ├── runtime-db-naming.js      — DB inflector fragment (server)
│   ├── runtime-orm.js            — ORM runtime fragment (server)
│   ├── runtime-ddl.js            — DDL runtime fragment (server, migration mode)
│   ├── runtime-browser-stubs.js  — throwing stubs for ORM/DDL methods (browser)
│   └── runtime.generated.js      — auto-generated string concatenation of runtime-*.js
├── scripts/
│   └── build-runtime.js          — regenerates runtime.generated.js from fragment files
└── test/
    ├── singleton.test.js         — runtime singleton across multiple loader installs
    ├── errors.test.js            — public error message format pinning
    ├── modes.test.js             — mode matrix (validate / browser / server / migration)
    └── build.test.js             — build determinism + fragment isolation + double-load
```

## Public API

```js
import { installSchemaSupport, hasSchemas } from '@rip-lang/schema';
import { SCHEMA_INTRINSIC_DECLS, emitSchemaTypes } from '@rip-lang/schema/dts-emit';
import '@rip-lang/schema/loader-browser';   // browser side-effect: install validate + stubs
import '@rip-lang/schema/loader-server';    // server side-effect: install full runtime
```

## Scripts

```bash
bun run build:runtime         # regenerate runtime.generated.js from fragments
bun run test:runtime-fresh    # CI: fail if generated is stale
bun run test                  # run all schema unit tests (singleton, errors, modes, build)
```

## Runtime fragments

Source-of-truth files: `runtime-validate.js`, `runtime-db-naming.js`, `runtime-orm.js`, `runtime-ddl.js`, `runtime-browser-stubs.js`. These are **raw JS** that gets string-concatenated by `scripts/build-runtime.js` into `runtime.generated.js` and executed inside a shared IIFE wrapper at runtime. They reference each other's symbols across fragment boundaries; editor tooling won't always recognize cross-fragment references — that's expected. Behavior is pinned by `test/`.

`dts-emit.js` is **orthogonal** — runs at compile time, never reaches runtime, despite living next to runtime fragments in this directory.
