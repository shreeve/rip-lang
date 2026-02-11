# Rip UI — Notes

## What's There

- **Reactive primitives** — `:=` (state), `~=` (computed), `~>` (effects) as
  language syntax. Fine-grained dependency tracking, batching, readonly.
- **`__Component` base class** — mount, unmount, context push/pop, constructor
  lifecycle all handled in the runtime. Components just override `_init`.
- **`__state` signal passthrough** — if a value is already a signal, `__state`
  returns it as-is. No separate `isSignal` check needed.
- **Fine-grained DOM** — `_create` builds real DOM nodes, `_setup` wires
  reactive effects that update individual text nodes and attributes.
- **Event handling** — `@click: method` binds to `this.method` correctly.
- **CSS classes** — `div.counter.active` compiles to static className.
  Dynamic classes via `__clsx(...)`.
- **Context** — `setContext`/`getContext`/`hasContext` for sharing data
  between ancestor and descendant components without prop drilling.
- **Lifecycle hooks** — `mounted`, `unmounted` work. `beforeMount`,
  `beforeUnmount` are recognized.
- **Reactive stash** — shared reactive store with proxy-based access.
- **File-based router** — URL-to-component mapping with params, guards,
  layouts, `_navigating` signal, keep-alive component cache.
- **Parts system** — in-memory `.rip` file storage with compilation cache
  and file watchers for hot reload via SSE.
- **Error boundaries** — catch mount-time errors.
- **Runtime deduplication** — both runtimes register on `globalThis.__rip`
  and `globalThis.__ripComponent`. Multiple compilations share one runtime.

## What's Not There Yet

### Component Model (highest priority)
- **Component composition** — can't nest `Counter` inside another component's
  render block. Components are pages, not reusable building blocks. This is
  the #1 gap.
- **Conditional rendering** — `if`/`else` in render blocks to show/hide
  elements reactively.
- **List rendering** — `for item in items` in render blocks with keyed
  reconciliation for efficient updates.
- **Props flow** — syntax for passing signals between parent and child
  in render blocks.
- **Slots / children** — passing content into reusable components. Only
  `data-slot` exists for layouts.
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
- **In-browser editor** — edit `.rip` components with live preview. The
  compilation infrastructure exists.

### Error Handling
- **Runtime error boundaries** — errors from reactive effects and async
  operations aren't caught. Only mount-time errors are handled.

### Performance & Scale
- **Code splitting** — bundle everything upfront vs. fetch per route.
- **Compiled template optimization** — ahead-of-time DOM operations instead
  of runtime compilation. Svelte/Solid do this.

### Polish
- **Route transition animations** — enter/exit during navigation.
- **Scroll restoration** — preserve scroll on back/forward.

### Infrastructure
- **SSR / streaming** — server-side rendering for SEO. Low priority until
  SEO is a requirement.
- **Persistent VFS** — IndexedDB/OPFS for offline support. Current in-memory
  Map doesn't survive page reloads.

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
- **Bundle caching uses a separate `fs.watch`.** Could unify with SSE watcher.
