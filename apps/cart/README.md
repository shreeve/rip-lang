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

## RFC: Auto-Scan Bundle

### Background

Today, every app must explicitly list which subdirectories of `app/` to include in the client bundle:

```coffee
use serve
  dir: "#{dir}/app"
  bundle:
    app: ['components', 'utils']
```

### The Problem

The `bundle` config only accepts **directory names** to scan. This creates two kinds of friction:

1. **Flat files can't be bundled.** A file at `app/utils.rip` has no way to get included — you're forced to create a `utils/` subdirectory, leading to awkward paths like `app/utils/utils.rip`.
2. **Forgetting a directory is a silent browser-only failure.** The server-side type checker sees the real filesystem, so `rip check` passes. But the browser can't resolve the import, and the error is a cryptic "module not found" from a blob URL.

### Proposal

**Auto-scan `app/` by default.** The server bundles all `.rip` files found anywhere under the app directory, excluding:

- `routes/` — already handled separately with `components/` prefix keys
- `index.rip` files — already skipped (server entry points, not client code)

No `bundle` config needed for the common case. A file at `app/utils.rip` or `app/helpers/format.rip` just works.

#### Store key structure

**Preserve the directory structure** in store keys. Currently, all configured dirs are flattened into `components/_lib/`, losing the directory name:

| File path                | Current key                   | Proposed key                         |
| ------------------------ | ----------------------------- | ------------------------------------ |
| `app/components/bar.rip` | `components/_lib/bar.rip`     | `components/_lib/components/bar.rip` |
| `app/utils/helpers.rip`  | `components/_lib/helpers.rip` | `components/_lib/utils/helpers.rip`  |
| `app/utils.rip`          | *(can't be bundled)*          | `components/_lib/utils.rip`          |

This eliminates the fragile basename-fallback path resolution in the browser. Import specifiers resolve exactly because the store key mirrors the filesystem layout.

#### Config changes

| Config                            | Behavior                                            |
| --------------------------------- | --------------------------------------------------- |
| *(no `bundle` key)*               | Auto-scan `app/`, single `app` bundle (new default) |
| `bundle: { app: ['components'] }` | Explicit dirs, current behavior (backward compat)   |

#### Watch

Auto-scan mode watches `appDir` itself (excluding `routes/`, which is already watched separately).

### Migration

| App         | Change                                                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| cart        | Remove `bundle:` key entirely                                                                                                     |
| streamline  | Remove `bundle:` key                                                                                                              |
| form        | Remove `bundle:` key (`routes` in dir list is redundant)                                                                          |
| analytics   | Remove `bundle:` key                                                                                                              |
| results     | Remove `bundle:` key                                                                                                              |
| trusthealth | Remove `bundle:` key                                                                                                              |
| medlabs     | Already uses `app: ['.']` — effectively auto-scan. Remove `bundle: app:` line. Keep `ui:` for external package (separate concern) |
| starter     | Keep `bundle:` for external `ui` dir (separate concern)                                                                           |

### Edge cases

- **`app/routes/` overlap**: excluded from auto-scan since routes get `components/{file}` keys, not `_lib/` keys. Double-including would create duplicates with different prefixes.
- **Non-`.rip` files**: glob is `**/*.rip`, so CSS/JS/images are naturally excluded.
- **Empty `app/`**: works fine — bundle has routes only, empty `_lib`.

---

## RFC: Auto-Infer `data-router` and `data-reload`

### Background

Currently, the HTML bootstrap requires four attributes beyond the `src`:

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

- **`data-src="app"`** — the main bundle is always called `app` by convention
- **`data-mount="App"`** — unused in routed apps (`launch()` handles mounting internally, never reads this attribute)
- **`data-router`** — required to enable file-based routing, but if the app has a `routes/` directory, file-based routing is the obvious intent
- **`data-reload`** — required for hot reload, but the server already sends `watch: true` in the bundle data

Forgetting `data-router` produces a blank page with no error. Forgetting `data-reload` means silently stale code during development. Both are hard to diagnose.

### Proposal

**Server-driven inference.** The server already knows the project structure — it should tell the browser what to do via the bundle JSON, not rely on the developer to mirror that knowledge in HTML attributes.

#### Routing

The presence of a `routes/` directory is the structural choice that enables file-based routing — same convention as Next.js (`pages/`), SvelteKit (`routes/`), and Nuxt (`pages/`). The server already checks whether `routesDir` exists. When route files are included in the bundle, the server sets `data.router = true` in the bundle JSON. The browser reads this flag and uses `launch()` accordingly.

This is deterministic from the file system, not a heuristic. The chain is:

1. `app/routes/` exists with `.rip` files → structural choice
2. Server sets `bundle.data.router = true`
3. Browser reads `data.router`, enables `launch()` path

#### Reload

The bundle JSON already carries `data.watch` from the server's `watch: true` config. The browser should use it directly.

#### Bundle URL

Default to `/app` when `data-src` is omitted.

#### `data-mount`

Not needed for routed apps — `launch()` handles mounting. Only relevant for the non-router eval path (inline scripts, demos).

#### Result

The minimal routed app HTML becomes:

```html
<script defer src="/rip/rip.min.js"></script>
```

With overrides still available:

- `data-src="ui app"` — load specific/multiple bundles
- `data-router="hash"` — hash-based routing
- `data-router="false"` — explicitly disable routing (opt out)
- `data-mount="App"` — mount a named component (non-router apps)

### Trade-offs

- **Default flip for routing**: Today apps opt *in* to file-based routing. After this change, having a `routes/` directory opts you in automatically. Any app that has route files but does its own routing (e.g., medlabs, which uses a custom `pushState` router in `shell.rip`) would need `data-router="false"` or should be migrated to file-based routing. Medlabs is likely non-idiomatic here.
- **Reload is low risk**: `watch: true` is only set in dev, and the reload mechanism is harmless when the `/watch` endpoint doesn't exist.
