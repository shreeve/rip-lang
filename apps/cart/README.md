# Cart Demo

A minimal shopping cart built with Rip UI to exercise reactive components, file-based routing, and stash-based shared state.

## Running

```bash
cd apps/cart
rip server
```

---

## RFC: Remove Default Route Caching

### Background

The Rip UI renderer caches component instances across navigations. When you navigate away from a route, the component (with its DOM tree and reactive state) is stored in a `Map`. When you navigate back, the cached instance is re-inserted into the DOM instead of creating a fresh one.

This has been in `src/ui.rip` since the first commit (March 2026). The only stated rationale is one line in a section comment: *"component caching for back/forward navigation."* There is no design doc, no measured performance bottleneck, and no changelog entry explaining why it was added.

### The Problem

While building this cart demo, we hit a bug: after placing an order and navigating away, returning to `/cart` still showed "Order Placed!" instead of "Your cart is empty." The component's `status` signal was frozen at `'success'` because the cached instance was restored without calling any lifecycle hooks.

We fixed the immediate symptoms (call `mounted` on restore, update params/query, re-call `load`), but the deeper issue remains: **the cache creates a hidden contract that every stateful component must handle**.

### What Caching Costs

| Issue                                                                                                | Severity |
| ---------------------------------------------------------------------------------------------------- | -------- |
| `mounted` fires on a stale instance — same object, old state, no way to distinguish from first mount | High     |
| More framework code to maintain                                                                      | Medium   |
| 10 full component trees held in memory by default                                                    | Low      |

### What Caching Buys

| Benefit                                     | Assessment                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| Preserves DOM state (open dropdowns, focus) | Surprising, not helpful — users expect a fresh page                                   |
| Preserves scroll position                   | Solvable with simple `scrollTop` save/restore                                         |
| Avoids recompile cost                       | Already handled by the separate compilation cache (`getCompiled`/`setCompiled`)       |
| Avoids remount cost                         | DOM creation + reactive wiring is sub-millisecond for typical pages                   |
| Instant back/forward                        | Only perceived as "instant" if the page is heavy — and if it is, `load` reruns anyway |

### Prior Art

No major framework caches component instances by default:

- **TanStack Router** — always remounts; has built-in SWR cache for *data*, but never caches instances
- **Vue Router** — always remounts; explicit `<KeepAlive>` opt-in per component
- **SvelteKit** — no instance cache; uses `load` functions for data
- **Solid Router** — always remounts

TanStack Router is especially relevant: it's the most cache-aware router in the ecosystem, yet it only caches *loader data* — never component instances. Vue's `<KeepAlive>` exists for the rare cases where instance caching is genuinely useful (e.g., a multi-step wizard), but it's never the default.

### The Two Caches

It's important to distinguish the two caching layers in `ui.rip`:

1. **Compilation cache** (`getCompiled`/`setCompiled`) — caches the compiled JS module. This is cheap, correct, and should stay.
2. **Component instance cache** (`componentCache`) — caches the mounted component with its DOM and state. This is the source of the problems.

### Proposal

**Remove the component instance cache.** Every navigation creates a fresh component instance with clean state. The lifecycle becomes predictable:

- `mounted` fires exactly once
- `unmounted` fires exactly once
- No stale state, no hidden contracts
- Components don't need to be "cache-aware"

If profiling later shows a real performance bottleneck, add opt-in caching (like Vue's `<KeepAlive>`) rather than default-on caching.

### Migration

The `mounted` reset pattern we added to `cart.rip` would become unnecessary:

```diff
  mounted: ->
    document.title = 'Cart - Rip'
-   status = 'idle'
-   error = ''
```

Any component using `beforeUnmount` to clean up cache state could drop that too.
