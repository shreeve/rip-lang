# Rip UI — Notes & Known Issues

## Keep in Mind

- **Keep-alive doesn't pause effects.** Cached components continue running
  reactive effects while off-screen. A counter with `~>` logging will still
  fire. This is intentional (background data stays current), but differs from
  Vue's `<KeepAlive>` which deactivates effects. May want an `onDeactivate`/
  `onActivate` lifecycle pair in the future.

- **`getCompiled`/`setCompiled` cache modules, not JS strings.** The compiled
  module (ES module object) is cached. If the same source is written to two
  different paths, each gets its own cached module. This is correct but means
  no deduplication across paths.

- **Proxy `getOwnPropertyDescriptor` trap is missing.** The stash proxy has
  `get`, `set`, `deleteProperty`, and `ownKeys`, but no `getOwnPropertyDescriptor`.
  Some operations (`Object.keys`, `JSON.stringify`, spread) call both `ownKeys`
  and `getOwnPropertyDescriptor`. Works in practice but could cause issues in
  strict environments. Adding `getOwnPropertyDescriptor` that returns
  `{ configurable: true, enumerable: true, value: ... }` would be more robust.

- **Router regex objects are recreated on every `buildRoutes` call.** Each
  file-watcher event triggers `buildRoutes`, which recreates `RegExp` objects
  for all routes even when routes haven't changed. Not a performance problem
  with small route tables, but could be optimized with a route fingerprint
  comparison.

- **`router.current` creates a new object on every read.** Each access to
  `router.current` constructs a fresh `{path, params, route, layouts, query,
  hash}` object. The renderer's effect reads this on every reactive trigger.
  A cached current object that updates only inside the batch would reduce
  garbage.

- **REPL reactive state doesn't persist across calls.** In the browser console,
  `rip("count := 0")` followed by `rip("count = 5")` doesn't trigger reactivity
  because each `rip()` call is a separate compilation — the compiler doesn't
  know `count` was declared as `:=`. All reactive code must be in a single
  `rip()` call.

- **Bundle caching uses a separate fs.watch.** In `serve.rip`, the bundle
  cache invalidation watcher is separate from the SSE change watcher. Both
  watch the same directory. Could be unified into a single watcher.

- **`updated` lifecycle hook is recognized but not triggered.** The compiler
  accepts `updated` as a lifecycle hook, but the renderer doesn't call it.
  Triggering it properly requires the compiler to call `this.updated()` after
  each reactive effect flush — a compiler-level change, not a renderer change.

- **Context functions require `__ripComponent` on globalThis.** The
  `setContext`/`getContext`/`hasContext` exports from ui.rip depend on the
  compiler's component runtime being loaded. If ui.rip is loaded without a
  component being compiled first, these will be undefined. In practice this
  doesn't happen because launch() compiles components before context is used.

- **Error boundaries only catch mount errors.** If a component throws during
  a reactive update (e.g., a `~>` effect throws after the component is already
  mounted), the error boundary doesn't catch it. Comprehensive error handling
  would require the reactive runtime to route errors through `__handleError`
  and bubble them to the nearest boundary.

## Roadmap — What's Needed to Compete

These are the gaps between Rip UI and production-grade frameworks. Addressing
these moves Rip UI from "impressive demo" to "serious contender."

### Component Model
- **Component composition from Rip source.** Currently components are "pages"
  — you can't easily use `<Counter>` inside another `.rip` component. Need a
  way to import and nest components within render blocks.
- **Props validation.** No mechanism to declare expected props, default values,
  or required props. Vue has `defineProps`, React has PropTypes/TypeScript.
- **Scoped styles.** No CSS scoping per component. Vue has `<style scoped>`,
  Svelte scopes by default. Components share a global CSS namespace.
- **Slots / named slots.** Only `data-slot` exists for layouts. No general
  slot mechanism for passing content into reusable components.

### Data & State
- **createResource caching.** Cache keys, stale-while-revalidate, background
  refetching, query invalidation. The current createResource is a starting
  point; TanStack Query is the target.
- **Form handling.** Validation, form state management, dirty tracking,
  optimistic updates. A large feature area that deserves dedicated design.

### Type Safety
- **TypeScript definitions for framework exports.** The stash, router,
  createResource, and other exports have no `.d.ts` files. TypeScript users
  get no autocomplete or type checking when using the framework API.

### Developer Experience
- **State-preserving HMR.** Hot reload currently remounts with fresh state.
  Preserving reactive state across code changes (at least for template-only
  changes) would match Vite's developer experience.
- **Chrome DevTools extension.** A visual panel for inspecting the stash,
  component tree, route state, and keep-alive cache. `window.__RIP__` is
  the console-only foundation.
- **In-browser editor.** Edit `.rip` components directly in the browser with
  live preview. The compilation infrastructure already exists.

### Error Handling
- **Runtime error boundaries.** Catch errors from reactive effects and async
  operations, not just mount-time errors. Route them to the nearest ancestor
  with `onError`.

### Performance & Scale
- **Code splitting / lazy route loading.** Bundle all parts upfront vs
  fetch per route. Low priority for small apps (Rip source compresses well).
- **Compiled template optimization.** Ahead-of-time DOM operations instead
  of runtime compilation. Svelte and Solid do this at build time.

### Polish
- **Route transition animations.** Enter/exit animations during navigation.
  Vue's `<Transition>` and Framer Motion are references.
- **Scroll restoration.** Preserve scroll position on back/forward navigation.
- **`onActivate`/`onDeactivate` lifecycle hooks.** Let keep-alive components
  know when they're cached/restored.
- **`updated` lifecycle hook.** Fire after reactive effects flush (compiler change).

### Infrastructure
- **SSR / streaming.** Server-side rendering for SEO and initial load. The
  architecture supports two-phase loading (initial route inline, rest on
  demand). Low priority until SEO is a requirement.
- **Persistent VFS.** IndexedDB/OPFS for offline support and instant reloads.
  The current in-memory Map works but doesn't survive page reloads.
