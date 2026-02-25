# Rip Component System — Road to World Class

## ~~1. Component Test Coverage~~ — DONE (79 tests)

`test/rip/components.rip` covers every code path in `src/components.js`:
basic rendering, fragments, static/reactive/boolean attributes, reactive text,
conditional and loop block factories, nested variable threading, string content
in factories, event handlers (method ref + inline arrow), refs, two-way binding
(`<=>` — text, checkbox, number/valueAsNumber, smart auto-binding), dynamic
classes (`.()` / `__clsx`, static+dynamic merge), child component prop passing
(static, reactive signal pass-through, children/slots, props+children),
lifecycle hooks (`mounted`/`unmounted`/`beforeMount`/`updated`), context API
(`setContext`/`getContext`), SVG rendering (`createElementNS`, class via
`setAttribute`), hyphenated attributes (`data-*`/`aria-*`), DOM properties
(`innerHTML`/`textContent`), slot projection (`@children`, `@prop` rendering),
expression-as-text (reactive and static), bare component references, bare `.()`,
static `class:` attribute, computed/effect block bodies, and 15 runtime behavior
tests. All 1,348 tests pass.

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
