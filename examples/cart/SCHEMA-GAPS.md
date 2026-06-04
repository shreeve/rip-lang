# Rip schema gaps (from the cart example)

The cart is the first real full-stack use of rip schema — define models on the server, project them to the client, validate the wire, persist to a db — so it surfaced a batch of schema gaps. Fixed ones are listed first (1–4); the open ones follow (5–9), highest priority first. Each open gap has a matching `#gap-N` comment at its source site, pointing back here.

## The projection ideal (and the interim workaround)

```coffee
# api/models.rip — define each entity ONCE, on the server
User = schema :model
  firstName! string
  lastName!  string
  email!#    email
  @timestamps

# the client's view is a PROJECTION of that one model…
UserView = User.pick "id", "firstName", "lastName", "email"
```

```coffee
# app/routes/profile.rip — …imported under a bare name, used as value + type
import { User } from <the projection>
user := User.parse(res.json!())   # client validates the wire shape
```

One declaration on the server; the client gets a clean, bare-named, validated projection. No duplicated field lists, no drift.

**What the cart does instead (interim):** `app/types.rip` re-declares `Product`/`User`/`Order` as standalone client schemas — agreeing with the server models by convention, not derivation ("define twice"). It's the workaround gaps 5–6 force, not the end state.

## Fixed

### 1. Schemas emitted `XValue`/`XInstance` instead of a bare `X` type — FIXED ✅

A schema named `User` used to emit a *suffixed* type alias — `UserValue` for `:input`, `UserInstance` for `:model` — so you had to write `u:: UserInstance`, not `u:: User`. Now the bare name IS the type (class-style: like a class names both its value and its instance type). Fixed in `src/schema/dts.js`: `:input`/`:enum`/`:mixin` emit `Schema<User, User>` (retired `UserValue`); `:model` emits `type UserData` (the columns) plus `Schema<User, UserData>` so the bare `User` is the instance type (retired `UserInstance`); relation accessors return the target's bare name too. `UserData` survives only as the field-only shape that algebra/`toJSON` project over.

### 2. `id`/`@timestamps`/`@belongs_to` FK weren't projectable — FIXED ✅

`pick`/`omit` operated only on declared fields, so `User.pick("id", …)` threw `unknown field 'id'` (runtime) and `"id" not assignable to keyof UserData` (type) — yet every client view needs `id`. Fixed by making algebra operate over the full projectable column set (declared fields + `id` + timestamps + `@belongs_to` FKs), in both the runtime (`__schemaProjectableFields`) and the emitted `Data` type.

### 3. Exported & cross-file schemas didn't type-check — FIXED ✅

An exported schema emitted `export const X: T` with no initializer (TS1155), and a schema referenced from another file was undeclared (TS2304) and/or collided with its own compiled runtime `const` — blocking the basic "export a schema, use it from another file" flow. Fixed in `src/schema/dts.js` (always emit `declare`) and `src/typecheck.js` (rewrite each schema `const` into a `__schema` overload keyed on the schema name, plus registry/error declarations).

### 4. Dates arrive as strings over the wire — FIXED ✅

`UserView.parse(wirePayload)` threw `createdAt must be datetime`: over JSON a date is a `string`, but the projection inherits the model's `datetime` (`Date`). Fixed by coercing ISO date strings to `Date` on `parse`/`safe` (`_coerceDates`). The more principled fix is retyping a projected `datetime` to its serialized `string` form, but coercion makes the round-trip work today.

## Open (by priority)

### 5. Derived schemas have no bare type — `src/schema/dts.js` — OPEN ❌

`UserView = User.pick(...)` emits `let UserView = User.pick(...)` with no `type UserView`, so the projection can't be annotated or re-exported under a clean name — the client can't write `u:: UserView`.

### 6. Projections are runtime-coupled to their source and can't reach the client — `src/schema/runtime-validate.js` — OPEN ❌

`UserView = User.pick(...)` is evaluated at load time and needs `User` present, so importing the projection drags the full model with it — the loaded `User` still has `create`/`toSQL` (and `toSQL()` emits the whole `CREATE SEQUENCE … CREATE TABLE …`) plus every server-managed column (`id`, timestamps, FKs).

Verified in the cart: re-exporting `{ UserView as User }` from `api/models.rip` compiles to `export { … } from '../api/models.rip'`, so the browser fetches the server-only module and fails at runtime:

```
TypeError: Failed to resolve module specifier "../api/models.rip".
Invalid relative url or base scheme isn't hierarchical.
```

The fix is **compile-time folding**: statically evaluate the algebra and emit a fresh, source-free descriptor (which also gives the result a bare type — gap 5 — and a known serialized `datetime` form).

But folding alone isn't enough, and this is the part the boundary forces. Only `app/` is bundled to the browser, so a folded descriptor still living in `api/` can't be reached (that's the error above), and no client-side config changes that: `api/` is server-only by design (db-backed models, ORM, DDL). So folding must also **materialize the descriptor at the client import site** — inline it into the app bundle and drop the `from '../api/...'` import entirely — so nothing server-only ships and the client author still just writes `import { User } from <…>`. The `include`-the-whole-`api/`-dir escape hatch in the serve middleware is the non-answer: it resolves the import but ships the entire model (ORM, DDL, all fields) to the browser.

### 7. `create` doesn't type-check required fields — `src/schema/dts.js` — OPEN ❌

`Model.create(data)` is typed `create(data: Partial<Data>)`, so every field is optional and the checker never flags a missing required field — `User.create!({})` (no `firstName`/`lastName`) type-checks clean. (Unknown fields are still caught: `TS2353`.) The runtime *does* enforce it (`create!` throws `User: firstName is required; lastName is required`), so no bad row is written — the gap is the missing compile-time signal. Cause: the generic `ModelSchema<Instance, Data>` interface sees only the flat `Data`, can't tell a required-no-default field from an auto-managed `id`/timestamp, and punts to `Partial<Data>`. Fix: emit a per-model create-input type — required = required-declared fields without a default + required (`NOT NULL`) FKs; optional = optional/defaulted fields and nullable FKs; `id` + timestamps omitted. The subtlety is defaults: a required field with a default is effectively optional at create, so the rule is "required AND no-default."

### 8. `find`/`findMany` accept any id type — `src/schema/dts.js` — OPEN ❌

`find(id: unknown)` / `findMany(ids: unknown[])`, so `User.find!("foo")` type-checks clean though the PK is `number`. Worse than 7: the runtime doesn't throw, it silently returns `null` (the `WHERE id = 'foo'` matches nothing), so a wrong-typed id reads as an innocent "not found." Same root as 7 — the generic interface doesn't carry the id's type, so it falls back to `unknown`. The implicit PK is always `number` (`INTEGER PRIMARY KEY`), so `find(id: number)` / `findMany(ids: number[])` is correct today; a future-proof version threads an `Id` param through `ModelSchema` (e.g. `ModelSchema<Instance, Data, Id = number>`) for non-numeric PKs.

> Gaps 7 and 8 share one root: the generic `ModelSchema<Instance, Data>` interface loses per-model detail (which fields are required, what the id type is) and falls back to `Partial<Data>` / `unknown`. Both are fixed by emitting model-specific method signatures at codegen time instead of reusing the generic interface.

### 9. `keyof` over a schema yields methods, not fields — `src/schema/dts.js` — OPEN ❌

A schema value's type is `Schema<In, Out>`, so `keyof typeof UserView` resolves to the interface methods (`parse`, `safe`, `pick`, …), not the data fields (`firstName`, …) — making it impossible to derive a field-key type from a schema. Typing a per-field errors map as `Partial<Record<keyof typeof UserView, string>>` (tried in the cart's PATCH handler) keys it by method names; the fallback today is a loose `Record<string, string>`. Fix: emit a field-name type the consumer can reach (e.g. `keyof UserData`, or a `Fields<typeof X>` helper).
