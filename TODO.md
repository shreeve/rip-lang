# Rip Component System — Road to World Class

## ~~1. Component Test Coverage~~ — DONE (94 tests)

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
static `class:` attribute, computed/effect block bodies, LIS algorithm
correctness, loop component reactivity, and error boundaries. All 1,363
tests pass.

## ~~2. Efficient List Reconciliation~~ — DONE

Runtime `__reconcile` function with best-in-class optimizations: prefix/suffix
trimming with p()-skip (zero work for no-change and append cases), LIS-based
minimal DOM moves, DocumentFragment creation batching (1 DOM op vs N on initial
render), compile-time static block detection (`_s` flag skips p() entirely),
and array-based block storage (no persistent Map). Generated loop code dropped
from ~25 inlined lines to a single `__reconcile` call.

## ~~3. Error Boundaries~~ — DONE

`onError` lifecycle hook catches errors from `_init` effects, `mount()`, and
child component `_setup`/`mounted`. Errors walk the `_parent` chain to the
nearest `onError` handler via `__handleComponentError`. Without a boundary,
errors throw normally. Constructor wraps `_init` in try-catch; child setup
is wrapped at codegen time. 94 component tests, 1,363 total passing.

## 4. Transitions and Animations

Built-in enter/leave transition support for conditional and loop blocks.
Svelte has `transition:fade`, Vue has `<Transition>` — Rip needs a clean,
operator-level approach that fits the language's philosophy.
