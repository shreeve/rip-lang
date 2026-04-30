# Cart Demo

A minimal shopping cart built with Rip App to exercise reactive components, file-based routing, and stash-based shared state.

## Running

```bash
cd examples/cart
rip server
```

---

## Typed Stash

This demo uses Rip's [typed stash](../../docs/RIP-TYPES.md) to make `@app.data`
type-safe across every component, with zero runtime cost.

### How it works

The project's `index.rip` seeds the stash by passing a `state:` argument to
`serve(...)`. The type checker reads the type of that seed and exposes it as
the type of `@app.data` in every component. Typos become compile errors,
completions list real fields, refactors stay safe — no extra files, no magic
names.

```coffee
# index.rip — type the seed however you like
import { CartData } from './app/types.rip'

stash:: { cart: CartData } = cart: { items: [] }

use serve
  dir: "#{dir}/app"
  state: stash
```

```coffee
# app/routes/cart.rip — @app.data.cart is CartData
cart ~= @app.data.cart

for item in cart.items
  tr
    td "#{item.image} #{item.name}"
    td "$#{item.price.toFixed(2)}"

# A typo like @app.data.cart.itms produces:
#   TS2551: Property 'itms' does not exist on type 'CartData'.
#           Did you mean 'items'?
```

The annotation on `stash` is optional — drop it and TypeScript infers the
shape from the literal. Either way, every component sees `@app.data` typed
as the seed.

### Properties

| Project state                    | `@app.data` type | Behavior                        |
| -------------------------------- | ---------------- | ------------------------------- |
| No `state:` arg to `serve(...)`  | `any`            | Untyped — fully dynamic         |
| `state: ident` in the entry file | `typeof ident`   | Type-safe on every stash access |

- **Runtime is unchanged.** The stash stays a deep reactive Proxy; types erase
  completely. `JSON.stringify(raw(app.data))` and `persistStash` work
  identically.
- **No new syntax.** Annotate the seed (or don't); standard `::` works.
- **Cross-file resolution** rides the same path as any other `.rip` import:
  the language server compiles the entry lazily and resolves the seed type
  through the virtual TypeScript snapshot pipeline.

### Prior art

Every major reactive state library types its store without sacrificing runtime
flexibility:

- **Zustand** — `create<State>()(...)` types the store; runtime uses immutable updates via `set()`
- **Pinia** — `defineStore` infers state type from the `state()` return value; runtime is a reactive Proxy
- **Svelte** — module-level `$state` is typed via standard TypeScript inference; runtime is a Proxy
- **Solid** — `createStore<T>()` takes a type parameter; runtime is a reactive Proxy

Types are a compile-time lens over a dynamic runtime.
