# Changelog — @rip-lang/ui

All notable changes to `@rip-lang/ui` will be documented in this file.

## [0.3.2] - 2026-02-14

### Loading Optimization

- **Combined bundle** — `rip-ui.min.js` (~52KB Brotli) packages the Rip compiler and pre-compiled UI framework in a single file. Eliminates the separate `ui.rip` fetch and its ~948-line runtime compilation.
- **Build-time compilation** — `ui.rip` is compiled to `ui.js` → `ui.min.js` → `ui.min.js.br` during `bun run browser`. The combined bundle intercepts `importRip('ui.rip')` and returns pre-compiled exports instantly.
- **Parallel loading** — Monaco Editor preloaded via `<link rel="preload">` hint. Compiler exports available instantly via `globalThis.__ripExports` (no redundant module re-import). All synchronous setup runs in parallel with the Monaco CDN fetch.
- **FOUC prevention** — all playground pages hide the body with `opacity: 0` until fully initialized, then fade in via `body.ready` CSS transition.

## [0.3.1] - 2026-02-13

### Hash Routing

- **`hash: true` option** — `launch '/app', hash: true` switches from path-based to hash-based routing (`page.html#/about` instead of `/about`). Uses `readUrl()` / `writeUrl()` helpers to encapsulate the mode difference. Supports both `href="#/path"` and `href="/path"` link styles. Back/forward and direct URL loading work correctly.
- **Self-contained demo** — `docs/demo.html` runs the full Rip UI Demo as a single static HTML file (337 lines) with all components inlined via `launch bundle:` and `hash: true`.

## [0.3.0] - 2026-02-12

### Component Composition

- **Cross-file component resolution** — Page components in `pages/` and shared components in `ui/` (via `includes`) are automatically available by PascalCase name (`card.rip` → `Card`). App-scoped, lazy-compiled, cached after first use. No imports needed.
- **Reactive props via signal passthrough** — Parent passes `:=` signals directly to children. Child's `__state` passthrough returns the signal as-is. Two-way binding for free.
- **Children blocks** — `Card title: "Hello" -> p "content"` passes children as a DOM node via the `@children` slot.
- **Child unmounting cascade** — Parent tracks child instances in `_children`. `unmount()` cascades depth-first.
- **Resolver architecture** — Single `{ map, classes, key }` object carries all resolution state per-app. No module-scoped mutable state, no cross-app leakage.

### Reactive Timing Primitives

- **Effect cleanup** — `__effect` now captures return values as cleanup functions, run before re-execution and on disposal. Backward-compatible.
- **`delay(ms, source)`** — Truthy delayed, falsy immediate. For loading indicators.
- **`debounce(ms, source)`** — Waits until value stops changing. For search inputs.
- **`throttle(ms, source)`** — At most one update per interval. For scroll/resize.
- **`hold(ms, source)`** — Once truthy, stays true for at least ms. For success messages.
- **Writable proxy pattern** — `delay 100, __state(false)` returns a signal-compatible proxy: reads are delayed, writes go to source. Drop-in replacement for `__state`.

### State Persistence

- **`persist: true`** — `launch '/app', persist: true` enables debounced auto-save of `app.data` to sessionStorage. Restores on reload.
- **`_writeVersion` signal** — Global stash write counter triggers reactive auto-save. No polling, no JSON diffing.
- **`beforeunload` safety net** — Also saves on tab close/reload for edge cases.

### Polish

- **Smooth app launch** — Container starts at `opacity: 0`, fades in after first mount + font load. No FOUC.
- **Navigation anti-flicker** — `_navigating` uses `delay 100` to suppress brief loading indicators.
- **Demo persistence** — Counter and todos sync to `app.data` and survive reload.
- **Card component** — Reusable `Card` with title prop and `@children` slot, used in about page.

### Documentation

- **RIP-REACTIVITY.md** — Complete rewrite. Reactive triad naming ("gets state", "always equals", "always calls"), effect cleanup, timing composition, writable signals, framework comparison.
- **INQUISITION.md** — Critical assessment of Rip UI vs React, Solid, Svelte, Vue, Angular. Honest wins and gaps.

## [0.2.0] - 2026-02-11

Initial release. Reactive stash, file-based router, renderer, SSE hot reload, demo app.
