# Rip App — Agent Guide

Rip's batteries-included application framework. Lives in `index.rip`,
compiled into `docs/dist/rip.min.js` so a single `<script
src="rip.min.js">` is enough to build a complete app.

## What's in here

The framework is one file (`index.rip`, ~2000 lines), structured in
named sections:

| Section          | Public API                                              |
|------------------|---------------------------------------------------------|
| Stash            | `createStash`, `unwrapStash`, `persistStash`            |
| Resource         | `createResource`                                        |
| Timing           | `delay`, `debounce`, `throttle`, `hold`                 |
| Components store | `createComponents`                                      |
| Router           | `createRouter`                                          |
| Renderer         | `createRenderer`                                        |
| Launch           | `launch` (returns `{ app, components, router, renderer, destroy }`) |
| ARIA helpers     | `globalThis.__aria` / `globalThis.ARIA` (registered on load) |

All exports are pure user-land Rip code — `index.rip` does not extend
the compiler. It uses the language's primitives (`:=`, `~=`, `~>`,
`component`, `render`) the same way any user's app would.

**Bundle layout.** The browser bundle stores every `.rip`
module under one of four origin-prefixed keys:

| Prefix       | Origin                                                             |
| ------------ | ------------------------------------------------------------------ |
| `_route/`    | Route pages from `<appDir>/routes/` (consumed by `createRouter`)   |
| `_app/`      | Auto-scanned `.rip` files from `<appDir>` itself                   |
| `_lib/<dir>/`| Author-declared extra bundle directories                           |
| `_pkg/<pkg>/`| Auto-discovered `@rip-lang/*` packages with `rip.browser: true`    |

The `serve()` middleware in
[packages/server/middleware.rip](../server/middleware.rip) decides where
each on-disk file lands. `resolveStorePath` in `index.rip` searches the
prefixes in `_pkg → _lib → _app → _route` order so package code shadows
local code on collisions.

## Where it sits in the stack

```
Layer 0  Language core         src/compiler.js, src/lexer.js, ...
Layer 1  Component runtime     src/components.js
Layer 2  Rip App framework     packages/app/index.rip   ← YOU ARE HERE
Layer 3  Headless widgets      packages/ui/browser/
```

Layer 2 depends on Layers 0 + 1 (via `globalThis.__rip` and
`globalThis.__ripComponent`) but doesn't extend them. A program that
uses Rip the language but skips the framework can omit `index.rip`
from its bundle entirely; the compiler doesn't care whether it's
present.

## The ambient `ARIA` type contract (`aria.d.ts`)

The `ARIA` helpers are exposed as a runtime global (`globalThis.ARIA`), so
consumers reach them with no import. Their type contract is single-sourced:

- **Impl side:** `AriaApi` (+ `_aria`) in `index.rip` — the actual shapes.
- **Consumer side:** `aria.d.ts` next to it — a hand-written ambient
  `declare const ARIA: { ... }` shipped in the package's `files`.

The two are written in different syntaxes (Rip type alias vs TS `declare`) and
use differently-prefixed helper-type names, but every method's signature must
match. `test/check.test.js` guards the pair both ways: a behavioral pin (real
`rip check` over ARIA usage) **and** a textual drift guard that normalizes both
and compares method-by-method. Edit one side → edit the other, or the guard bites.

**How a consumer turns on ARIA typing — and the trade-off.** A project opts in
by adding the shipped `.d.ts` to its `package.json#rip.types` (the general
ambient-include mechanism — see `docs/RIP-TYPES.md`):

```json
{ "rip": { "types": ["node_modules/@rip-lang/app/aria.d.ts"] } }
```

`rip check` then loads it as an explicit program root so `ARIA.` is typed in
every `.rip` file. **Discoverability trade-off:** this used to be auto-injected
into any file that merely referenced `ARIA.`, so it Just Worked with zero config.
It's now **opt-in** — a consumer that uses `ARIA.` without the `rip.types` line
gets *no* typing (`ARIA` is simply undeclared / `Cannot find name 'ARIA'`). The
win is that the contract lives in one shipped file co-located with its impl
instead of a regex-injected table buried in the compiler (`src/dts.js`); the cost
is the one config line. `@rip-lang/ui` carries that line (and declares the
`@rip-lang/app` peerDependency that the runtime `ARIA` global implies).

## How it gets into rip.min.js

`scripts/build.js` reads `packages/app/index.rip`, compiles it, and
splices it into the browser bundle alongside `src/browser.js`. The
resulting `docs/dist/rip.min.js` is what apps load via the
`<script src="rip.min.js">` tag.

`scripts/check-bundle-graph.js` walks the dependency graph from both
entries (`src/browser.js` and `packages/app/index.rip`) on every
`bun run build` and fails if any reachable file matches a forbidden
list — that's how we ensure the bundle stays self-contained.

## Why it's a peer of @rip-lang/server, @rip-lang/ui, @rip-lang/db

`@rip-lang/server` is the Sinatra-style HTTP framework. `@rip-lang/app`
is the browser-side application framework. They're sibling first-party
frameworks that ship with rip-lang. `packages/` is the natural home
for both.

## Editing

The whole framework is one file because the layering inside it is
simple (Stash → Resource → Timing → Components store → Router →
Renderer → Launch). If a section grows large enough to warrant
splitting, extract it as a sibling file (e.g. `packages/app/aria.rip`)
and update `scripts/build.js` to include it.

Running tests: `bun run test` (the root suite covers compiler +
component + framework runtime behavior).

Running the bundle build: `bun run build` (regenerates
`docs/dist/rip.min.js`).

## See also

- Root `AGENTS.md` for the project-wide rules.
- `src/AGENTS.md` for compiler internals.
- `packages/ui/AGENTS.md` for headless widget conventions.
