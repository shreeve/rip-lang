# Browser Runtime — Agent Guide

These HTML files use Rip's browser runtime. The bundle is an IIFE loaded with `<script defer>`, not `type="module"`, so `file://` demos work without CORS issues.

## Shared-Scope Model

All `<script type="text/rip">` tags, inline or external, compile and run together in one shared async IIFE.

- `export` makes components visible across tags
- `skipExports` strips those exports to plain `const` declarations in the shared scope

## Runtime Script Attributes

| Attribute      | Purpose                                                   |
| -------------- | --------------------------------------------------------- |
| `data-src`     | whitespace-separated source URLs or bundle URLs           |
| `data-mount`   | component to mount after compilation                      |
| `data-target`  | CSS selector for mount target                             |
| `data-state`   | JSON stash seed                                           |
| `data-router`  | enables history mode or `"hash"` routing                  |
| `data-persist` | persists stash in session storage or `"local"` storage    |
| `data-reload`  | connects to `/watch`; CSS changes can refresh styles only |

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
- `ui/index.html` — widget gallery. `ui/bundle.json` is generated from `packages/ui/browser/components/` via `bun run bundle:ui` (auto-runs as part of `bun run build`). The source-of-truth is the workspace package; the JSON is the deployable artifact. The gallery loads the bundle at boot via `data-src="bundle.json"` and reads view-source text synchronously from the in-memory components store (`window.__RIP__.components.read("components/<id>.rip")`) — no per-component fetches.

Static demos can be opened via `file://`. The playground and example app require `bun run serve`.
