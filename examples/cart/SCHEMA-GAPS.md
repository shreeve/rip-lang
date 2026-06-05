# Rip schema gaps (from the cart example)

The cart is the first real full-stack use of rip schema — define models on the server, project them to the client, validate the wire, persist to a db — so it surfaced a batch of schema gaps (1–9). Porting the runtime-validation type-audit (`test/types/10-validation.rip`) to real schema then surfaced four more (10–13), all one family: schema *behavior* — transforms, computed getters, eager-derived fields — didn't type-check (or didn't type *well*) under `rip check`. All thirteen are now fixed; each entry below records the symptom and the fix.

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

### 7. `create` didn't type-check required fields — FIXED ✅

`Model.create(data)` was typed `create(data: Partial<Data>)`, so every field was optional and the checker never flagged a missing required field — `User.create!({})` (no `firstName`/`lastName`) type-checked clean. The runtime *did* enforce it (`create!` throws `User: firstName is required; …`), so no bad row was written — the gap was the missing compile-time signal. Cause: the generic `ModelSchema<Instance, Data>` interface saw only the flat `Data`, couldn't tell a required-no-default field from an auto-managed `id`/timestamp, and punted to `Partial<Data>`. Fixed in `src/schema/dts.js`: each `:model` emits a `<Name>Create` input type, threaded through `ModelSchema<Instance, Data, Id, Create>` so `create(data: Create)` is checked. A field is required at create iff it's marked `!` AND has no default (a defaulted required field is optional at insert — the rule is "required AND no-default"); `@belongs_to` contributes its FK (required when non-null, optional `| null` when nullable); `id` and the auto-managed timestamp/softDelete columns are omitted. `User.create({})` now errors with the missing fields; the cart's `Order.create!({ userId, items, total })` is checked against `OrderCreate`.

### 8. `find`/`findMany` accepted any id type — FIXED ✅

`find(id: unknown)` / `findMany(ids: unknown[])` accepted anything, so `User.find!("foo")` type-checked clean though the PK is `number` — and worse than 7, the runtime didn't throw, it silently returned `null` (the `WHERE id = 'foo'` matched nothing), so a wrong-typed id read as an innocent "not found." Same root as 7: the generic interface didn't carry the id's type and fell back to `unknown`. Fixed by threading an `Id` param through `ModelSchema<Instance, Data, Id = number, …>` and typing `find(id: Id)` / `findMany(ids: Id[])`; codegen emits `Id = number` (the implicit `INTEGER PRIMARY KEY`), with the param in place for non-numeric PKs later. `User.find('1')` now errors.

> Gaps 7 and 8 shared one root: the generic `ModelSchema<Instance, Data>` interface lost per-model detail (which fields are required, the id type) and fell back to `Partial<Data>` / `unknown`. Both are fixed by parameterizing the interface — `ModelSchema<Instance, Data, Id = number, Create = Partial<Data>>` — and having codegen thread per-model `Id`/`Create` types in.

### 9. `keyof` over a schema yielded methods, not fields — FIXED ✅

A schema value's type is `Schema<Out, In>`, so `keyof typeof UserView` resolved to the interface methods (`parse`, `safe`, `pick`, …), not the data fields — making it impossible to derive a field-key type from a schema value; the cart's per-field errors map fell back to a loose `Record<string, string>`. No new machinery was needed — the field-key types the emitter already produces (gap 5 + the model `Data` type) are reachable: a projection's bare type IS its field shape, so `keyof UserView` names its field keys directly, and a `:model` exports a fields-only `<Name>Data` type, so `keyof UserData` names a model's columns without its instance methods. Both are exported, so they resolve cross-file from an importing route. The cart's PATCH handler now types its errors map as `Partial<Record<keyof UserView, string>>`, so a typo'd key won't compile. (`keyof typeof User`, over the schema *value*, still yields methods — reach for the field-shape type instead.)

> Gaps 10–13 share one root: schema *behavior* (transforms, computed getters, eager-derived fields) was never exercised under `rip check` — the cart uses none — so the shadow-TS codegen emitted bodies and fields that didn't type-check (10–12) or didn't infer their type (13). Porting `test/types/10-validation.rip` to real schema surfaced all four. That file exercises a transform (`QBCustomer` remaps `it.Id → id`) and `~>` getters (`Order.name`/`status`) end-to-end under `rip check`; the `!>` emission (gap 12) and the body-type inference (gap 13) are pinned by dedicated tests in `test/rip/schema.rip` and `test/schema/infer.test.js` (no field in the audit genuinely needs serializing, so none is contrived to use `!>`).

### 10. Field transforms didn't type-check (`it` untyped) — FIXED ✅

A field transform (`name! -> it.X`) compiled to `(function(it) { … })` with no type on `it`, so `rip check` flagged `noImplicitAny` (TS7006) — field transforms were unusable in any type-checked file. Fixed in `src/schema/schema.js` (`compileTransformFn`): the shadow-TS pass emits `it` as an explicit `any`-typed param. `any` is correct, not a shortcut — a transform sees the RAW, pre-validation input, which legitimately carries keys that aren't declared fields (`it.Id` remapped to `id`) and whose types differ from the declared output (a wire date is a `string`, not the declared `Date`), so no stricter type fits; `unknown` would just force a cast in every transform. The `any` is contained: the field's declared type (e.g. `id: string`) is emitted independently of the transform body, so it never leaks into the output type.

### 11. Behavior bodies referencing `@` didn't type-check (`this` untyped) — FIXED ✅

A computed getter (`~>`), method (`->`), hook, or eager-derived (`!>`) body that read `@field` compiled to `(function() { return this.field })` with an untyped `this`, so `rip check` flagged TS2683 — none of these could appear in a type-checked file. Fixed in `src/schema/schema.js` (`compileCallableFn`): in shadow-TS mode only, the body is emitted with a TypeScript `this` parameter typed to the schema's instance type (its bare name — what the body actually sees, including other behavior), so `@field` reads resolve. The `this` parameter is erased at runtime and is illegal as a real JS param, so it's added only in the check pass; normal codegen stays `function() { … }`.

### 12. Eager-derived (`!>`) fields weren't in the emitted type — FIXED ✅

An `!>` field materializes as an own enumerable property at parse, but `src/schema/dts.js` emitted only `method`/`computed` entries — so reading one (`order.name`) was TS2339, "Property does not exist." Fixed by emitting `derived` entries on the instance type as a writable `name: unknown` (an own property — unlike the `readonly` a `~>` getter gets). Because an `!>` field is serialized *output* but not *input*, it sits on the bare instance name (Out), never in the projectable `<Name>Data` (In); `:input` permits `!>`, so a derived field there splits `<Name>Data` from the bare name too.

### 13. Computed/derived fields typed as `unknown`, not their body's type — FIXED ✅

After gap 12 a `~>`/`!>` member existed on the type but was always `unknown` — `order.name` was `unknown` even though the body plainly returns a string, so `order.name.toUpperCase()` wouldn't compile. Zod infers it for free (`z.infer` reads the `.transform()`'s return type); rip's emitter punted to `unknown` ("body inference is out of scope"). The body *is* tsc-inferrable code, though — the disconnect was only that the declared member type was decoupled from it. Fixed by wiring tsc's own inference in: codegen stashes each compiled `function(this: <Name>) { … }` body on the generator (shadow-TS only), and the type emitter drops them into a sibling `const __<Name>__behavior = { name: …, status: … }` and types each member as `ReturnType<typeof __<Name>__behavior.field>`. So `name` infers as `string` and `status` as `"Completed" | "Shipped" | "Pending"`, matching Zod. Scoped to computed/derived (both paramless — methods keep `(...args) => unknown`, since their params aren't typed) and to the shadow only (a plain `.d.ts` has no runtime body to infer from, so it stays `unknown`). Pinned by `test/schema/infer.test.js`, which runs tsc over the shadow to prove the member is usable as its concrete type.
