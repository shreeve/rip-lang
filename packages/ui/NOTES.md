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

- **HMR doesn't preserve component state.** Hot reload destroys and recreates
  the current component with fresh state. This matches React/Vue/Solid behavior
  for JS changes (they only preserve state for CSS/template-only changes).
  True state-preserving HMR would require diffing old and new component
  instances and transferring reactive state.

- **Context functions require `__ripComponent` on globalThis.** The
  `setContext`/`getContext`/`hasContext` exports from ui.rip depend on the
  compiler's component runtime being loaded. If ui.rip is loaded without a
  component being compiled first, these will be undefined. In practice this
  doesn't happen because launch() compiles components before context is used.

- **`__RIP__` dev tools are console-only.** The `window.__RIP__` object
  provides programmatic access to framework internals but has no visual panel.
  A Chrome DevTools extension with a component tree, stash inspector, and
  route viewer would be a significant developer experience improvement.

## Future Ideas

- Code splitting / lazy route loading — currently the bundle sends all parts
  in one JSON request. For small apps this is fine (Rip source compresses well
  with Brotli). For large apps, could lazy-load per route. Low priority until
  apps grow large enough for bundle size to matter.
- `onActivate`/`onDeactivate` lifecycle hooks for keep-alive components
- `updated` hook triggered after reactive effect flushes (compiler change)
- State-preserving HMR for component code changes (state transfer)
- Chrome DevTools extension with visual component tree and stash inspector
- Route-level `loader` functions (data prefetching before component mounts)
- `createResource` caching with stale-while-revalidate (TanStack Query-style)
- Persistent VFS (IndexedDB/OPFS) for offline support and instant reloads
- Compiled template optimization (ahead-of-time DOM operations)
- Route transition animations
- Scroll restoration on back/forward navigation
- Form handling utilities
