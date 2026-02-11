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

- **Context support exists but is unused.** The compiler runtime has
  `setContext`, `getContext`, and `hasContext` with parent-chain walking. The
  UI framework doesn't wire these up or document them. Ready to use when
  needed.

- **REPL reactive state doesn't persist across calls.** In the browser console,
  `rip("count := 0")` followed by `rip("count = 5")` doesn't trigger reactivity
  because each `rip()` call is a separate compilation — the compiler doesn't
  know `count` was declared as `:=`. All reactive code must be in a single
  `rip()` call.

- **Bundle caching uses a separate fs.watch.** In `serve.rip`, the bundle
  cache invalidation watcher is separate from the SSE change watcher. Both
  watch the same directory. Could be unified into a single watcher.

## Future Ideas

- `onActivate`/`onDeactivate` lifecycle hooks for keep-alive components
- Route-level `loader` functions (data prefetching before component mounts)
- Persistent VFS (IndexedDB/OPFS) for offline support and instant reloads
- Compiled template optimization (ahead-of-time DOM operations)
- Route transition animations
- Scroll restoration on back/forward navigation
