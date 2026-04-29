# Cart Demo

A minimal shopping cart built with Rip App to exercise reactive components, file-based routing, and stash-based shared state.

## Running

```bash
cd examples/cart
rip server
```

---

## RFC: Remove Default Route Caching

### Background

The Rip App renderer caches component instances across navigations. When you navigate away from a route, the component (with its DOM tree and reactive state) is stored in a `Map`. When you navigate back, the cached instance is re-inserted into the DOM instead of creating a fresh one.

This has been in `src/app.rip` since the first commit (March 2026). The only stated rationale is one line in a section comment: *"component caching for back/forward navigation."* There is no design doc, no measured performance bottleneck, and no changelog entry explaining why it was added.

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

It's important to distinguish the two caching layers in `app.rip`:

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

---

## RFC: Typed Stash

### Background

The stash (`@app.data`) is Rip's global reactive state. It's a Proxy backed by signals — similar in purpose to Zustand, Pinia, Svelte's `$state`, or Solid's `createStore`. It supports nested access (`@app.data.cart.items`), automatic dependency tracking with `~=` and `~>`, and persistence via `persistStash`.

Today, the stash is completely untyped. `@app.data.cart.itms` (typo) compiles without complaint, fails silently at runtime, and produces no editor warnings.

### Proposal

Add a `stash.rip` convention. If the app directory contains a `stash.rip` file with a default export type, the type checker uses it to type `@app.data` in all components under that directory. No config needed — same pattern as routes, layouts, and components.

#### 1. Declare the stash type

```coffee
# app/stash.rip

type CartItem =
  id:: string
  name:: string
  price:: number
  quantity:: number

export default type
  cart::
    items:: CartItem[]
```

The default export becomes the type of `@app.data`. Helper types like `CartItem` stay internal.

#### 2. Use it — nothing changes in components

```coffee
# app/routes/cart.rip
# @app.data.cart.items is now typed as CartItem[]
# @app.data.cart.itms is a compile error

for item in @app.data.cart.items
  .item
    .name = item.name
    .price = "$#{item.price.toFixed(2)}"
```

The server file can import the same type to validate its initial value:

```coffee
# index.rip
import type AppData from './app/stash.rip'

use serve
  dir: "#{dir}/app"
  state:: AppData
    cart: { items: [] }
```

### How It Works

The type flows through the existing compilation pipeline:

1. **Type checker** sees `stash.rip` in the app directory, loads the exported type
2. **Type emitter** adds a typed `app` property to `__Component` declarations — `app: { data: AppData, ... }` instead of today's untyped `any`
3. **Components** accessing `@app.data.*` get completions, typo detection, and refactor safety
4. **Runtime** is unchanged — the stash is still a dynamic Proxy, types erase completely

### Progressive Typing

This follows Rip's existing gradual typing model:

| Project state      | `@app.data` type | Behavior                         |
| ------------------ | ---------------- | -------------------------------- |
| No `stash.rip`     | `any`            | Today's behavior, fully dynamic  |
| `stash.rip` exists | `AppData`        | Full type safety on stash access |

Dynamic escape hatches still work — bracket access (`@app.data['key']`) could remain `any`, same as TypeScript index signatures.

### Persistence

Persistence is unaffected. `persistStash` does `JSON.stringify(raw(app.data))` on save and `app.data[k] = v for k, v of savedData` on restore. Types erase at runtime, so the serialize/deserialize path is identical. The only consideration is schema migration — changing the stash shape between deploys while users have old persisted data — but that's a runtime concern shared by every store with persistence and orthogonal to this proposal.

### Prior Art

Every major reactive state library types its store without sacrificing runtime flexibility:

- **Zustand** — `create<State>()(...)` types the store; runtime uses immutable updates via `set()`
- **Pinia** — `defineStore` infers state type from the `state()` return value; runtime is a reactive Proxy
- **Svelte** — module-level `$state` is typed via standard TypeScript inference; runtime is a Proxy
- **Solid** — `createStore<T>()` takes a type parameter; runtime is a reactive Proxy

None of these make the runtime less flexible. Types are a compile-time lens over a dynamic runtime.

---

## RFC: Auto-Infer `data-router` and `data-reload`

### Background

A typical routed app's bootstrap today is four attributes beyond the `src`:

```html
<script defer src="/rip/rip.min.js"
  data-src="app"
  data-mount="App"
  data-router
  data-reload>
</script>
```

### The Problem

Most of these are boilerplate or dead code:

- **`data-src="app"`** — already optional. The browser runtime defaults to `/app` when `data-src` is omitted ([src/browser.js:131-138](../../src/browser.js#L131-L138)). The Auto-Scan Bundle change (just merged) makes `app` the canonical bundle name, so the default is correct out of the box. Most HTML across the repo still spells it out.
- **`data-mount="App"`** — only read on the no-router path ([src/browser.js:311](../../src/browser.js#L311)). Routed apps go through `launch()`, which never reads `data-mount` — it mounts the matched route component itself.
- **`data-router`** — required to enable file-based routing. The browser branches on this attribute alone ([src/browser.js:175-179](../../src/browser.js#L175-L179)) — it has no other way to know an app wants routing. If you have a `routes/` directory, the intent is obvious.
- **`data-reload`** — required for hot reload. The browser starts the SSE watch loop only when this attribute is present ([src/browser.js:339](../../src/browser.js#L339)). But the server already knows whether watching is enabled and ships that flag in the bundle (`data.watch`, [packages/server/middleware.rip:810](../../packages/server/middleware.rip#L810)) — the browser just doesn't read it.

Forgetting `data-router` produces a blank page with no error. Forgetting `data-reload` means silently stale code during development. Both are hard to diagnose.

### Proposal

**Server-driven inference.** The server already knows the project structure — it should tell the browser what to do via the bundle JSON, not rely on the developer to mirror that knowledge in HTML attributes.

#### Routing

The presence of a `routes/` directory is the structural choice that enables file-based routing — same convention as Next.js (`pages/`), SvelteKit (`routes/`), and Nuxt (`pages/`). The server already special-cases `routesDir` in `buildNamedBundle` ([packages/server/middleware.rip:786-792](../../packages/server/middleware.rip#L786-L792)). One new line: when the routes branch fires, set `data.router = true` on the bundle. The browser reads that flag and uses the `launch()` path.

This is deterministic from the file system, not a heuristic:

1. `app/routes/` exists with `.rip` files → structural choice
2. Server sets `bundle.data.router = true` (NEW — server change)
3. Browser falls back to `bundle.data.router` when `data-router` attribute is absent (NEW — browser change)

#### Reload

`bundle.data.watch` already exists in every bundle the server emits. Today the browser ignores it and reads `data-reload` from HTML instead. The change is one branch: when `data-reload` is absent, fall back to `bundle.data.watch`.

#### Bundle URL

Already implemented — `data-src` defaults to `/app` ([src/browser.js:137-138](../../src/browser.js#L137-L138)). No change needed.

#### `data-mount`

Not needed for routed apps — `launch()` handles mounting. Only relevant for the non-router eval path (inline scripts, demos like [docs/charts.html](../../docs/charts.html), [docs/demo.html](../../docs/demo.html), [docs/results/index.html](../../docs/results/index.html)).

#### Result

The minimal routed app HTML becomes:

```html
<script defer src="/rip/rip.min.js"></script>
```

With overrides still available:

- `data-src="ui app"` — load specific/multiple bundles
- `data-router="hash"` — hash-based routing
- `data-router="false"` — explicitly disable routing (opt out)
- `data-reload="false"` — explicitly disable hot reload (opt out)
- `data-mount="App"` — mount a named component (non-router apps)

### Implementation Surface

Two small diffs:

1. **Server** — [packages/server/middleware.rip:805-811](../../packages/server/middleware.rip#L805-L811): inside the `if includeRoutes` block where `data.title` and `data.watch` are already populated, add `data.router = existsSync(routesDir)`.
2. **Browser** — [src/browser.js:175-179](../../src/browser.js#L175-L179) and [src/browser.js:339](../../src/browser.js#L339): each gains a fallback that consults the bundle's `data` object when the corresponding HTML attribute is absent.

### Migration Audit

Scanned every `data-src`/`data-router`/`data-reload`/`data-mount` consumer in the repo:

| File                                                                                  | Has `routes/`? | Current attrs                                         | Behavior change                                                                                                                                |
| ------------------------------------------------------------------------------------- | :------------: | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `examples/cart/app/index.html`                                                        |      Yes       | `data-src=app data-mount=App data-router data-reload` | None (already opted in)                                                                                                                        |
| `examples/analytics/app/index.html`                                                   |      Yes       | `data-src=app data-router data-reload`                | None (already opted in)                                                                                                                        |
| `examples/results/index.html`                                                         |      Yes       | `data-src=app data-router data-reload`                | None (already opted in)                                                                                                                        |
| `examples/form/app/index.html`                                                        |      Yes       | `data-src=app data-mount=App data-reload`             | None — `routes/index.rip` already exports `App`, so auto-routing mounts the same component the explicit `data-mount` did. Verified in browser. |
| `packages/ui/index.html` (gallery)                                                    |       No       | `data-src=app data-mount=WidgetGallery data-reload`   | None (no `routes/`, stays no-router)                                                                                                           |
| `apps/medlabs/app/index.rip` shell tag                                                |       No       | `data-src="ui app" data-mount=App data-reload`        | None — medlabs uses a custom `pushState` router in `app/shell.rip` and has **no** `app/routes/` directory, so auto-routing wouldn't activate.  |
| `docs/charts.html`, `docs/demo.html`, `docs/results/index.html`, `docs/ui/index.html` |       No       | `data-mount=…` only                                   | None (no `routes/`, no `data-router`)                                                                                                          |

Net migration cost: **zero**. Every existing app either already opts in or has no `routes/` directory; the form example happens to have a `routes/index.rip` that exports the same `App` component its `data-mount` referenced, so auto-routing produces identical output.

### Trade-offs

- **Default flip for routing**: Today apps opt *in* to file-based routing. After this change, having a `routes/` directory opts you in automatically. The migration audit above shows this is safe — no app in the repo breaks.
- **Reload is low risk**: `watch: true` is only set in dev (`opts.watch ?? process.env.SOCKET_PREFIX?` in `serve`), and the SSE loop is harmless if the `/watch` endpoint doesn't exist (it just retries with backoff).
- **Backward compatible**: explicit attributes still win. `data-router` / `data-reload` continue to work and override the bundle's inference. Apps that already spell everything out keep working unchanged.
