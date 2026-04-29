# Cart Demo

A minimal shopping cart built with Rip App to exercise reactive components, file-based routing, and stash-based shared state.

## Running

```bash
cd examples/cart
rip server
```

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
