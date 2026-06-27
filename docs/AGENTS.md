# Browser Runtime — Agent Guide

These HTML files use Rip's browser runtime. The bundle is an IIFE loaded with `<script defer>`, not `type="module"`, so `file://` demos work without CORS issues.

## Shared-Scope Model

All `<script type="text/rip">` tags, inline or external, compile and run together in one shared async IIFE.

- `export` makes components visible across tags
- `skipExports` strips those exports to plain `const` declarations in the shared scope

## Runtime Script Attributes

**Value attributes** — the value is the payload:

| Attribute     | Values                          | Default | Purpose                          |
| ------------- | ------------------------------- | ------- | -------------------------------- |
| `data-src`    | URL list (`.rip`=file, else bundle) | empty   | explicit sources; non-empty skips `/app` |
| `data-mount`  | component name                  | —       | component to mount               |
| `data-target` | CSS selector                    | `body`  | mount target                     |
| `data-state`  | JSON                            | `{}`    | stash seed                       |

**Control attributes** — all parsed by one uniform rule (below):

| Attribute         | Values                                 | Default | Purpose                          |
| ----------------- | -------------------------------------- | ------- | -------------------------------- |
| `data-standalone` | `true` `false`                         | `false` | page is self-contained; skips the `/app` fetch |
| `data-router`     | `true` `false` `hash` `history` `auto` | `auto`  | routing; `auto` infers from bundle |
| `data-reload`     | `true` `false` `auto`                  | `auto`  | SSE reload; `auto` infers from bundle |
| `data-persist`    | `true` `false` `session` `local`       | `false` | stash persistence (`true`=`session`) |
| `data-debug`      | `true` `false`                         | `true`  | source maps / diagnostics        |

**Uniform rule** (`flag()` in `browser.js`): absent → default · bare/`true`/`on`/`yes`/`1` → true · `false`/`off`/`no`/`0` → false · a listed enum token → that token · else console error + default. Trimmed, case-insensitive.

## Component Mounting

Every component has a static `mount(target)` helper:

```coffee
App.mount '#app'
App.mount()
```

`data-mount` is declarative; `App.mount(...)` is the code-based alternative.

## Playground and Demos

- `index.html` — playground
- `demo.html` and `charts.html` — dashboard demos
- `sierpinski.html` — CDN demo
- `example/index.html` and `results/index.html` — app launchers / examples. `example/index.json` is generated from `docs/demo/` via `bun run bundle:demo` (the source-of-truth lives in `docs/demo/`, the JSON is the deployable artifact).
- `ui/index.html` — widget gallery. `ui/bundle.json` is generated from `packages/ui/browser/components/` via `bun run bundle:ui` (auto-runs as part of `bun run build`). The source-of-truth is the workspace package; the JSON is the deployable artifact. The gallery loads the bundle at boot via `data-src="bundle.json"` and reads view-source text synchronously from the in-memory components store (`window.__RIP__.components.read("_pkg/ui/<id>.rip")`) — no per-component fetches.

Static demos can be opened via `file://`. The playground and example app require `bun run serve`.
