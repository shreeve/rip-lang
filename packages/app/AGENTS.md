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

**Router note — `routes/` vs. `components/`.** `createRouter` reads page
components from the bundle key `components/...`, but on disk these files
live in `<appDir>/routes/`. The `serve()` middleware in
[packages/server/middleware.rip](../server/middleware.rip) mounts disk
`routes/*.rip` under the `components/` prefix at bundle time. Both
names are correct at their layer (disk vs. bundle).

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
