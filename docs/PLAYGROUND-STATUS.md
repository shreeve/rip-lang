# Playground Rewrite — Status

## Getting Up to Speed

Read these files first (in this order):

1. **AGENT.md** — How to work on this repo, coding conventions, workflow
2. **docs/RIP-LANG.md** — Full language reference (operators, syntax, features)
3. **docs/RIP-REACTIVITY.md** — The reactive triad (`:=` "gets state", `~=` "always equals", `~>` "always calls"), effect cleanup, timing primitives, composition
4. **packages/ui/NOTES.md** — What's implemented vs what's missing in Rip UI
5. **packages/ui/INQUISITION.md** — How Rip UI compares to React/Solid/Svelte/Vue/Angular
6. **docs/index.html** — The current JS playground (reference implementation to match)
7. **docs/playground.html** — The Rip version (scaffold, build this to parity)

The project is on branch `rip-playground`. Run `bun run test` to verify (1,235 tests, all passing). Run `bun run serve` to test the playground at `http://localhost:3000/playground.html`.

## The Goal

Three versions of the Rip Playground, proving progressive improvement:

1. **index.html** — Current JavaScript version (1,600 lines, fully featured)
2. **playground.html** — Same features, written in Rip (`<script type="text/rip">`) — must reach feature parity with index.html
3. **playground-app.html** — Full Rip UI component app using `launch bundle:`, components, `ref:`, reactive state — the showcase

## Current State

- Branch: `rip-playground`
- `playground.html` exists as a 227-line scaffold with core compilation loop working
- 15 features missing vs index.html (see table below)

## What playground.html Has

- Monaco source editor + read-only output editor
- Auto-compile on change (debounced 200ms)
- Toggle buttons: JS, Tokens, S-Expr
- Run button (click)
- Resizable split panes (20-80%)
- Version/build display
- GitHub link
- Dark theme

## What playground.html Is Missing (must add for parity)

1. Preamble toggle button
2. Types toggle button
3. Clear button
4. Rip syntax highlighting (Monarch tokenizer — copy from index.html)
5. Theme dropdown (10 themes with CDN lazy-loading)
6. Light/dark mode toggle (with body.light class)
7. Keyboard shortcuts (F5, Cmd+Enter for Run)
8. localStorage persistence (theme, mode, all toggle states)
9. REPL tab (full iframe sandbox with context persistence)
10. Tab switching (compiler/repl with URL hash)
11. REPL commands (.help, .clear, .vars, .sexp, .tokens)
12. REPL history (up/down arrows)
13. REPL syntax highlighting for input/output
14. REPL multi-line input (Shift+Enter)
15. Light mode CSS

## Architecture Notes

- playground.html uses `<script type="text/rip">` — compiled by rip.browser.js at runtime
- Monaco loaded from CDN via AMD loader: `loadMonaco!` pattern
- Compiler loaded via dynamic import: `await import("./dist/rip.browser.min.js")`
- Everything is imperative DOM manipulation (NOT a Rip UI component app yet)
- The Monarch tokenizer for Rip syntax highlighting can be copied from index.html lines ~770-850

## After Parity: The Component App Version

Once playground.html matches index.html feature-for-feature, build playground-app.html:

- Uses `launch bundle:` with inline components
- Components: Header, Tabs, CompilerPane, ReplPane, Editor (wraps Monaco via `ref:`)
- Reactive state for toggles, theme, mode
- `ui.rip` must be available (copy to docs/ or inline)
- This is the "killer demo" — single HTML file, zero server, full app

## Key Files

- `docs/index.html` — Current JS playground (reference, don't modify)
- `docs/playground.html` — Rip version (build this to parity)
- `packages/ui/ui.rip` — Framework (has inline bundle support via `opts.bundle`)
- `src/components.js` — Component compiler (has `ref:` support)
- `src/lexer.js` — Lexer (has indented children syntax)

## Recent Session Accomplishments (for context)

- Effect cleanup in `__effect` (return cleanup function)
- Four timing primitives: `delay`, `debounce`, `throttle`, `hold`
- State persistence: `persist: true` with `_writeVersion` debounced auto-save
- Component composition: cross-file resolution, reactive props, children, unmounting
- Indented children syntax: `Card title: "Hello"\n  p "child"` (no `->` needed)
- Element refs: `div ref: "container"` → `@container` in component code
- Inline bundle: `launch bundle: { components: {...}, data: {...} }`
- Five compiler bug fixes (scope leak, object keys, effect index/wrapping, dot-chain)
- `@rip-lang/ui@0.3.0` published
