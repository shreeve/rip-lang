# Rip schema gaps (from the cart example)

The cart is the first real full-stack use of rip schema — define models on the server, project them to the client, validate the wire, persist to a db — so it surfaced a batch of schema gaps. Fixed ones are listed first (1–6); the open ones follow (7–9), highest priority first. Several gaps have a matching `#gap-N` comment at their source site in the cart, pointing back here.

## The projection ideal (now how the cart works)

```coffee
# api/models.rip — define each entity ONCE, on the server
User = schema :model
  firstName! string
  lastName!  string
  email!#    email
  @timestamps

# the client's view is a PROJECTION of that one model…
UserView = User.pick "id", "firstName", "lastName", "email", "phone"
```

```coffee
# app/types.rip — …re-exported under a bare name, used as value + type
export { UserView as User } from '../api/models.rip'
```

One declaration on the server; the client gets a clean, bare-named, validated projection. No duplicated field lists, no drift.

**This is what the cart does now** (gaps 5 and 6, both fixed): every shape is defined once on the server and `app/types.rip` re-exports them in a single line — `UserView`/`OrderView` as `User`/`Order` (projections of the models), plus the plain `Product`/`OrderItem` shapes. The build folds the projections to self-contained descriptors and materializes every imported shape into the browser bundle, so nothing server-only ships and the client declares no schema of its own.

## Fixed

### 1. Schemas emitted `XValue`/`XInstance` instead of a bare `X` type — FIXED ✅

A schema named `User` used to emit a *suffixed* type alias — `UserValue` for `:input`, `UserInstance` for `:model` — so you had to write `u:: UserInstance`, not `u:: User`. Now the bare name IS the type (class-style: like a class names both its value and its instance type). Fixed in `src/schema/dts.js`: `:input`/`:enum`/`:mixin` emit `Schema<User, User>` (retired `UserValue`); `:model` emits `type UserData` (the columns) plus `Schema<User, UserData>` so the bare `User` is the instance type (retired `UserInstance`); relation accessors return the target's bare name too. `UserData` survives only as the field-only shape that algebra/`toJSON` project over.

### 2. `id`/`@timestamps`/`@belongs_to` FK weren't projectable — FIXED ✅

`pick`/`omit` operated only on declared fields, so `User.pick("id", …)` threw `unknown field 'id'` (runtime) and `"id" not assignable to keyof UserData` (type) — yet every client view needs `id`. Fixed by making algebra operate over the full projectable column set (declared fields + `id` + timestamps + `@belongs_to` FKs), in both the runtime (`__schemaProjectableFields`) and the emitted `Data` type.

### 3. Exported & cross-file schemas didn't type-check — FIXED ✅

An exported schema emitted `export const X: T` with no initializer (TS1155), and a schema referenced from another file was undeclared (TS2304) and/or collided with its own compiled runtime `const` — blocking the basic "export a schema, use it from another file" flow. Fixed in `src/schema/dts.js` (always emit `declare`) and `src/typecheck.js` (rewrite each schema `const` into a `__schema` overload keyed on the schema name, plus registry/error declarations).

### 4. Dates arrive as strings over the wire — FIXED ✅

`UserView.parse(wirePayload)` threw `createdAt must be datetime`: over JSON a date is a `string`, but the projection inherits the model's `datetime` (`Date`). Fixed by coercing ISO date strings to `Date` on `parse`/`safe` (`_coerceDates`). The more principled fix is retyping a projected `datetime` to its serialized `string` form, but coercion makes the round-trip work today.

### 5. Derived schemas had no bare type — FIXED ✅

`UserView = User.pick(...)` emitted `let UserView = User.pick(...)` with no `type UserView`, so the projection couldn't be annotated or re-exported under a clean name — the client couldn't write `u:: UserView`. Fixed in `src/schema/dts.js`: a derived assignment (`Name = Base.pick(...)`, including chains like `.pick(...).omit(...)`) now emits a bare `type Name = ReturnType<(typeof Name)['parse']>`. Reading the result back off the value's own `parse` reuses the `Schema<Out, In>` interface's algebra inference rather than re-deriving `Pick`/`Omit`/`Partial` in the emitter, so every operator and chain is covered for free; it expands to the exact projection (e.g. `Pick<UserData, "id" | "firstName" | "email">`). Gated on the base resolving to a locally-known schema, so an unrelated `foo = bar.partial()` is never mistaken for a projection.

### 6. Projections were runtime-coupled to their source and couldn't reach the client — FIXED ✅

`UserView = User.pick(...)` compiled to a runtime method call, so it was evaluated at load time and needed `User` present — importing the projection dragged the whole model with it (`create`/`toSQL`, the `CREATE SEQUENCE … CREATE TABLE …` DDL, every server-managed column). And the browser only bundles `app/`, so a projection living in server-only `api/` couldn't be reached at all: re-exporting `{ UserView as User }` from `api/models.rip` made the browser fetch the server module and fail with `TypeError: Failed to resolve module specifier "../api/models.rip"`.

Fixed in two layers. **(A) Compile-time folding** (`src/schema/schema.js`, opt-in `foldProjections`): a foldable derived schema (same-file source, static-literal keys) is statically evaluated against the source descriptor and rewritten to a fresh `__schema({kind:"shape", …})` literal with no reference to the source — severing the load-time coupling. It mirrors the runtime's projectable-field set (declared fields + `id`/timestamps/FKs) so a folded shape validates identically to `Model.pick(...)`; it BAILS to the runtime call on anything it can't prove (unknown base, dynamic keys), which is always a correct fallback. **(B) Bundle-time materialization** (`packages/server/middleware.rip` + `extractClientProjections` in `src/compiler.js`): when a bundled client module imports from a server-only file, the builder folds the named bindings and inlines ONLY those into a synthetic `_shared/<path>` module the browser compiles, rewriting the import to that key. It refuses anything that would ship server code — a `:model`, a value carrying behavior (methods/computed/transforms), or a non-schema — so the model's ORM/DDL can never leak by construction. The browser loader needs no change: its existing exact-key store lookup resolves the `_shared/…` specifier.

Verified end-to-end in the cart: `app/types.rip` is a single `export { UserView as User, OrderView as Order, Product, OrderItem } from '../api/models.rip'` (define once on the server, import on the client). The shipped `/app` bundle carries a `_shared/api/models.rip` holding just those four shapes — no `kind:"model"`, no `CREATE SEQUENCE`, no `@has_many` — and the projection's type flows cross-file (`User` is `Pick<UserData, …>`), so the profile edit form types as `Omit<User, "id">`.

## Open (by priority)

### 7. `create` doesn't type-check required fields — `src/schema/dts.js` — OPEN ❌

`Model.create(data)` is typed `create(data: Partial<Data>)`, so every field is optional and the checker never flags a missing required field — `User.create!({})` (no `firstName`/`lastName`) type-checks clean. (Unknown fields are still caught: `TS2353`.) The runtime *does* enforce it (`create!` throws `User: firstName is required; lastName is required`), so no bad row is written — the gap is the missing compile-time signal. Cause: the generic `ModelSchema<Instance, Data>` interface sees only the flat `Data`, can't tell a required-no-default field from an auto-managed `id`/timestamp, and punts to `Partial<Data>`. Fix: emit a per-model create-input type — required = required-declared fields without a default + required (`NOT NULL`) FKs; optional = optional/defaulted fields and nullable FKs; `id` + timestamps omitted. The subtlety is defaults: a required field with a default is effectively optional at create, so the rule is "required AND no-default."

### 8. `find`/`findMany` accept any id type — `src/schema/dts.js` — OPEN ❌

`find(id: unknown)` / `findMany(ids: unknown[])`, so `User.find!("foo")` type-checks clean though the PK is `number`. Worse than 7: the runtime doesn't throw, it silently returns `null` (the `WHERE id = 'foo'` matches nothing), so a wrong-typed id reads as an innocent "not found." Same root as 7 — the generic interface doesn't carry the id's type, so it falls back to `unknown`. The implicit PK is always `number` (`INTEGER PRIMARY KEY`), so `find(id: number)` / `findMany(ids: number[])` is correct today; a future-proof version threads an `Id` param through `ModelSchema` (e.g. `ModelSchema<Instance, Data, Id = number>`) for non-numeric PKs.

> Gaps 7 and 8 share one root: the generic `ModelSchema<Instance, Data>` interface loses per-model detail (which fields are required, what the id type is) and falls back to `Partial<Data>` / `unknown`. Both are fixed by emitting model-specific method signatures at codegen time instead of reusing the generic interface.

### 9. `keyof` over a schema yields methods, not fields — `src/schema/dts.js` — OPEN ❌

A schema value's type is `Schema<In, Out>`, so `keyof typeof UserView` resolves to the interface methods (`parse`, `safe`, `pick`, …), not the data fields (`firstName`, …) — making it impossible to derive a field-key type from a schema. Typing a per-field errors map as `Partial<Record<keyof typeof UserView, string>>` (tried in the cart's PATCH handler) keys it by method names; the fallback today is a loose `Record<string, string>`. Fix: emit a field-name type the consumer can reach (e.g. `keyof UserData`, or a `Fields<typeof X>` helper).
