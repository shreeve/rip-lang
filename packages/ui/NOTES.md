# Rip UI — Notes

## What's There

### Core Reactive System
- **Reactive primitives** — `:=` (state), `~=` (computed), `~>` (effects) as
  language syntax. Fine-grained dependency tracking, batching, readonly (`=!`).
- **`__Component` base class** — mount, unmount, context push/pop, constructor
  lifecycle all handled in the runtime. Components just override `_init`.
- **`__state` signal passthrough** — if a value is already a signal, `__state`
  returns it as-is. No separate `isSignal` check needed.
- **Fine-grained DOM** — `_create` builds real DOM nodes, `_setup` wires
  reactive effects that update individual text nodes and attributes.
- **Timing primitives** — `delay`, `debounce`, `throttle`, `hold` as small
  user-space functions composing `:=` + `~>` + cleanup. No framework API.

### Component Model
- **Component composition** — PascalCase identifiers in render blocks
  instantiate child components. `card.rip` → `Card`. App-scoped, lazy-compiled,
  cached after first use. No imports needed.
- **Reactive props** — parent passes `:=` signals directly to children.
  Child's `__state` passthrough returns the signal as-is. Two-way binding.
- **Readonly props** — `=!` for props that children can read but not write.
- **Children blocks** — `Card title: "Hello" -> p "content"` passes children
  as a DOM node via the `@children` slot. `#content` for layout slots.
- **Unmount cascade** — parent tracks child instances in `_children`.
  `unmount()` cascades depth-first.
- **Conditional rendering** — `if`/`else` in render blocks with anchor-based
  conditional DOM.
- **List rendering** — `for item in items` with keyed reconciliation.
- **Event handling** — `@click: method` binds to `this.method` correctly.
- **CSS classes** — `div.counter.active` compiles to static className.
  Dynamic classes via `__clsx(...)`.
- **Context** — `setContext`/`getContext`/`hasContext` for sharing data
  between ancestor and descendant components without prop drilling.
- **Lifecycle hooks** — `mounted`, `unmounted` work. `beforeMount`,
  `beforeUnmount` are recognized.

### State & Routing
- **Reactive stash** — shared reactive store with proxy-based access.
- **File-based router** — URL-to-component mapping with params, guards,
  layouts, `_navigating` signal, keep-alive component cache.
- **Hash routing** — `launch '/app', hash: true` for static single-file
  deployment. Uses `readUrl()`/`writeUrl()` helpers. Back/forward and
  direct URL loading work correctly.
- **State persistence** — `persist: true` enables debounced auto-save of
  `app.data` to sessionStorage. `_writeVersion` signal + `beforeunload` safety.
- **Error boundaries** — catch mount-time errors.

### Infrastructure
- **Component store** — in-memory `.rip` file storage with compilation cache
  and file watchers for hot reload via SSE.
- **`launch bundle:`** — inline all components as heredoc strings in a single
  HTML file. Zero-server deployment. `docs/demo.html` is a 337-line example.
- **Runtime deduplication** — both runtimes register on `globalThis.__rip`
  and `globalThis.__ripComponent`. Multiple compilations share one runtime.
- **Smooth app launch** — container fades in after first mount + font load.
- **Navigation anti-flicker** — `_navigating` uses `delay 100` to suppress
  brief loading indicators.

## What's Not There Yet

### Component Model (remaining gaps)
- **Named slots** — only `@children` (single slot) and `#content` (layout)
  exist. No named slots (header/body/footer) for complex reusable components.
- **Scoped slots** — no way to pass data back to the parent from a slot.
- **Teleport** — no mechanism to render at document root (for modals, tooltips).
- **Props validation** — no mechanism for expected props, defaults, or
  required props.
- **Scoped styles** — no CSS scoping per component. Global namespace only.

### Lifecycle
- **`updated` hook** — recognized but not triggered. Needs the compiler to
  call `this.updated()` after reactive effect flushes.
- **`onActivate`/`onDeactivate`** — for keep-alive components to know when
  they're cached or restored.
- **Keep-alive doesn't pause effects** — cached components continue running
  effects off-screen. Intentional (data stays current) but differs from Vue.

### Data & State
- **Resource caching** — `createResource` exists but no cache keys,
  stale-while-revalidate, background refetching, or query invalidation.
  TanStack Query is the target.
- **Form handling** — validation, form state, dirty tracking, optimistic
  updates. Needs dedicated design.

### Type Safety
- **Framework `.d.ts` files** — stash, router, createResource, and other
  exports have no TypeScript definitions. No autocomplete for framework API.

### Developer Experience
- **State-preserving HMR** — hot reload remounts with fresh state. Template-
  only changes should preserve reactive state.
- **Chrome DevTools extension** — `window.__RIP__` is console-only. A visual
  panel for component tree, stash, route state would help.

### Error Handling
- **Runtime error boundaries** — errors from reactive effects and async
  operations aren't caught. Only mount-time errors are handled.

### Performance & Scale
- **Code splitting** — bundle everything upfront vs. fetch per route.
- **AOT compilation** — ahead-of-time DOM operations instead of runtime
  compilation. Svelte/Solid do this. Architecture supports it — the compiler
  runs in both Bun/Node and the browser.
- **Optimized list reconciliation** — current `for` loop does full re-render
  on collection change. Large datasets (1000+ rows) need keyed diffing.

### Polish
- **Route transition animations** — enter/exit during navigation.
- **Scroll restoration** — preserve scroll on back/forward.

### Infrastructure
- **SSR / streaming** — server-side rendering for SEO. Low priority until
  SEO is a requirement.

## Known Caveats

- **`getCompiled`/`setCompiled` cache modules, not JS strings.** Same source
  at two paths = two cached modules. No deduplication across paths.
- **Stash proxy missing `getOwnPropertyDescriptor` trap.** Works in practice
  but could cause issues with `Object.keys`/spread in strict environments.
- **Router regex recreated on every `buildRoutes` call.** Not a problem with
  small route tables. Could optimize with fingerprint comparison.
- **`router.current` creates a new object on every read.** A cached object
  that updates inside batch would reduce garbage.
- **REPL reactive state doesn't persist across `rip()` calls.** Each call is
  a separate compilation. All reactive code must be in a single call.
- **Hash routing and path routing are mutually exclusive.** Set once at
  `launch` time. No runtime switching between modes.
