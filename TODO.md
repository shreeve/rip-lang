# Rip Component System — Road to World Class

## 1. Component Test Coverage (in progress — 31/50+)

`test/rip/components.rip` exists with 31 tests covering: basic rendering,
fragment roots, static/reactive attributes, reactive text, conditional and loop
block factories, nested variable threading (if-in-for, for-in-for), string
content in factories, event handlers, refs, component state/computed/methods/
effects/props. Still needed: two-way binding (`<=>`), dynamic classes (`.()`,
`__clsx`), child component prop passing, lifecycle hooks, context API, SVG
rendering, hyphenated attributes, and more edge cases.

## 2. Efficient List Reconciliation

Replace naive insertBefore-every-item reconciliation with a proper keyed
diffing algorithm (longest increasing subsequence). Only move DOM nodes that
actually changed position. Critical for list-heavy UIs.

## 3. Error Boundaries

Wrap component `_create`/`_setup`/effects in try-catch. Propagate errors up
the component tree to the nearest boundary. Prevent one broken component from
taking down the entire app.

## 4. Transitions and Animations

Built-in enter/leave transition support for conditional and loop blocks.
Svelte has `transition:fade`, Vue has `<Transition>` — Rip needs a clean,
operator-level approach that fits the language's philosophy.
