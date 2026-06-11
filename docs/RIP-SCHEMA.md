<p align="center">
  <img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip-schema-social.png" alt="Rip Schema" width="640">
</p>

# Rip Schema

> **One keyword. A validator, a class, an ORM, a migration tool, and a TypeScript type — from a single declaration.**

In a typical TypeScript application the shape of a `User` is described four
times. Once as a Zod schema for input validation. Once as a Prisma model for
the database. Once as a generated TypeScript type for the editor. Once as a
DTO class for API projections. Every change has to be propagated across all
four. Every divergence becomes a bug.

Rip Schema collapses all four into one declaration:

```coffee
User = schema :model
  name!   string, 1..100
  email!# email
  @timestamps
  @has_many Order
  identifier:       ~> "#{@name} <#{@email}>"
  beforeValidation: -> @email = @email.toLowerCase()
```

From that single line of source, the language gives you:

- a **runtime validator** — `User.parse(data)` / `.safe()` / `.ok()`
- a **generated class** with your methods and `~>` computed getters bound as prototype getters
- a **TypeScript type** — `ModelSchema<User, UserData>`, automatic, no codegen step
- an **async ORM** — `User.find! 1`, `User.where(active: true).all!`, `user.save!`
- **transactions** — `schema.transaction! ->` with ambient propagation and rollback
- **eager loading** — `User.includes(:orders).all!` batches relations, no N+1
- **migration-grade DDL** — `User.toSQL()` emits `CREATE TABLE`, indexes, foreign keys
- **schema algebra** — `User.omit("password")` produces a correctly-typed derived shape

Schemas are runtime values. You pass them around, export them, derive from
them, reference them anywhere an expression is valid. They're not a separate
language — they're a vocabulary inside Rip.

This guide is the canonical reference. Part I teaches the concepts and
syntax. Part II is reference tables you'll look up. Part III covers
architecture for contributors.

---

# Contents

## Part I — Using Rip Schema
1. [What Rip Schema is](#1-what-rip-schema-is)
2. [A quick tour](#2-a-quick-tour)
3. [Schemas vs types](#3-schemas-vs-types)
4. [The six kinds](#4-the-six-kinds)
5. [Body syntax](#5-body-syntax)
6. [The runtime API](#6-the-runtime-api)
7. [What `.parse()` returns by kind](#7-what-parse-returns-by-kind)
8. [`:model` — the ORM](#8-model--the-orm)
9. [Transactions & data integrity](#9-transactions--data-integrity)
10. [Query economics](#10-query-economics)
11. [Adapters](#11-adapters)
12. [DDL & schema evolution](#12-ddl--schema-evolution)
13. [Wire contracts — JSON Schema & OpenAPI](#13-wire-contracts--json-schema--openapi)
14. [Mixins](#14-mixins)
15. [Schema algebra](#15-schema-algebra)
16. [Shadow TypeScript](#16-shadow-typescript)
17. [SchemaError and diagnostics](#17-schemaerror-and-diagnostics)
18. [Common mistakes](#18-common-mistakes)
19. [Recipes](#19-recipes)
20. [What's not here yet](#20-whats-not-here-yet)

## Part II — Reference
21. [Capability matrix](#21-capability-matrix)
22. [Field types](#22-field-types)
23. [Directives](#23-directives)
24. [Hook reference](#24-hook-reference)
25. [Constraints](#25-constraints)
26. [Relations](#26-relations)
27. [Design invariants](#27-design-invariants)

## Part III — Architecture
28. [Runtime architecture](#28-runtime-architecture)
29. [Compiler integration](#29-compiler-integration)
30. [FAQ](#30-faq)

---

# Part I — Using Rip Schema
1. [What Rip Schema is](#1-what-rip-schema-is)
2. [A quick tour](#2-a-quick-tour)
3. [Schemas vs types](#3-schemas-vs-types)
4. [The six kinds](#4-the-six-kinds)
5. [Body syntax](#5-body-syntax)
6. [The runtime API](#6-the-runtime-api)
7. [What `.parse()` returns by kind](#7-what-parse-returns-by-kind)
8. [`:model` — ORM, DDL, hooks, relations](#8-model--the-orm)
9. [Mixins](#14-mixins)
10. [Schema algebra](#15-schema-algebra)
11. [Shadow TypeScript](#16-shadow-typescript)
12. [SchemaError and diagnostics](#17-schemaerror-and-diagnostics)
13. [Common mistakes](#18-common-mistakes)
14. [Recipes](#19-recipes)
15. [What's not here yet](#20-whats-not-here-yet)

## Part II — Reference
16. [Capability matrix](#21-capability-matrix)
17. [Field types](#22-field-types)
18. [Directives](#23-directives)
19. [Hook reference](#24-hook-reference)
20. [Constraints](#25-constraints)
21. [Relations](#26-relations)
22. [Design invariants](#27-design-invariants)

## Part III — Architecture
23. [Runtime architecture](#28-runtime-architecture)
24. [Compiler integration](#29-compiler-integration)
25. [FAQ](#30-faq)

---

# Part I — Using Rip Schema

## 1. What Rip Schema is

A *schema* in Rip is a runtime value that describes data. You create one with
the `schema` keyword and an optional `:kind` symbol:

```coffee
SignupInput = schema; email!     # default :input
Role        = schema :enum; :admin; :user
User        = schema :model; name!
```

Every schema is a real JavaScript object at runtime. It has methods
(`.parse`, `.safe`, `.ok`, plus ORM methods on `:model` and algebra methods
on derived shapes). It carries its own metadata (fields, constraints,
relations, hooks) and lazily builds the validator plan, ORM plan, and DDL
plan on first use.

Because schemas are values, you pass them around, export them, derive from
them, and reference them anywhere an expression is valid. They're not a
separate language — they're a vocabulary inside Rip.

**Why schemas exist as a distinct thing:** most applications need one
coherent description of each data shape for three audiences:

1. **Runtime** — validate external input, produce clean typed values
2. **Database** — issue migrations, run queries, hydrate rows
3. **Editor / compile time** — autocomplete, typecheck, hover docs

Rip Schema gives all three from a single declaration. Write the shape once
and the language handles the rest.

### What this replaces

In the JavaScript and TypeScript ecosystem, covering the same surface area
requires stitching together several independent libraries — each with its own
schema dialect, its own types, its own runtime, its own failure modes:

| Concern                     | Typical TypeScript stack            | Rip Schema                           |
| --------------------------- | ----------------------------------- | ------------------------------------ |
| Input validation            | Zod, Yup, Joi, io-ts, Valibot       | `schema :input` + `.parse/.safe`     |
| Domain objects with logic   | hand-written classes + `zod.infer`  | `schema :shape`                      |
| Database models             | Prisma, Drizzle, TypeORM, Sequelize | `schema :model`                      |
| Migrations / DDL            | Prisma migrate, Drizzle Kit, knex   | `Model.toSQL()` + `rip schema make/migrate` |
| API projections / DTOs      | `.pick` / `.omit` on Zod + class    | `Model.pick/.omit/.partial/.extend`  |
| Static types for the editor | Inferred from every library above   | Automatic shadow TS — no codegen     |
| Fixed value sets            | TS `enum` or string unions          | `schema :enum` (runtime + static)    |
| Shared field groups         | Intersection types + manual merge   | `schema :mixin` + `@mixin Name`      |

The equivalent TypeScript stack for a single model is roughly:

```ts
// validator.ts
export const UserInput = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
})

// schema.prisma
model User {
  id    Int    @id @default(autoincrement())
  name  String
  email String @unique
  orders Order[]
}

// user.ts
export class User {
  constructor(public data: Prisma.User) {}
  get identifier() { return `${this.data.name} <${this.data.email}>` }
}

// dto.ts
export const UserPublic = UserInput.omit({ email: true })
export type UserPublic = z.infer<typeof UserPublic>
```

Four files. Three dialects (Zod, Prisma DSL, TS). Two codegen steps. Drift
between them is a category of bug that only exists because the description
lives in more than one place.

The Rip Schema equivalent is the five-line `:model` declaration in the
opening of this document. The validator, the database model, the class with
its derived property, and the `UserPublic` DTO all fall out of that one
declaration — as runtime values, with full editor support, without codegen.

This is not incremental. One keyword replaces an entire category of tooling.

---

## 2. A quick tour

### Input validation

```coffee
SignupInput = schema
  email!    email
  password! string, 8..100
  age?      integer, 18..120

# Throws SchemaError on failure, returns a cleaned value on success
input = SignupInput.parse rawJson

# Structured result, no throwing
result = SignupInput.safe rawJson
# → {ok: true, value, errors: null} or {ok: false, value: null, errors: [...]}

# Fast boolean check
valid = SignupInput.ok rawJson
```

### A shape with behavior

```coffee
Address = schema :shape
  street! string, 1..200
  city!   string
  state!  string, 2..2
  zip!    string, /^\d{5}$/

  # Computed getters (~>) read instance fields and return derived values
  full: ~> "#{@street}, #{@city}, #{@state} #{@zip}"

  # Methods (->) run with `this` bound to the instance
  normalize: ->
    @city = @city.trim()
    @

a = Address.parse street: "123 Main", city: " Palo Alto ", state: "CA", zip: "94301"
a.full             # "123 Main, Palo Alto, CA 94301" — using the raw city
a.normalize()
a.city             # "Palo Alto" — trimmed
```

### An enum

```coffee
Status = schema
  :pending 0
  :active  1
  :done    2

Status.parse "pending"   # 0 — name resolves to value
Status.parse 0           # 0 — value resolves to value
Status.ok "unknown"      # false
```

### A DB-backed model

```coffee
User = schema :model
  name!    string, 1..100
  email!#  email
  @timestamps
  @has_many Order

  identifier: ~> "#{@name} <#{@email}>"
  beforeSave: -> @email = @email.toLowerCase()

Order = schema :model
  total! integer
  @belongs_to User
  @timestamps

# DDL for migration (works with or without the ORM adapter configured)
sql = User.toSQL()

# ORM operations (async, use `!` or `await`)
user   = User.create! name: "Alice", email: "ALICE@EXAMPLE.COM"
found  = User.find! user.id
orders = user.orders!                       # has_many relation → Order[]
owner  = orders[0]?.user!                   # belongs_to relation → User
```

### Schema algebra — derive new shapes

```coffee
UserPublic = User.omit "email"              # →  Schema<Omit<UserData, 'email'>>
UserCreate = User.pick "name", "email"      # →  Schema<Pick<UserData, 'name' | 'email'>>
UserUpdate = User.partial()                 # →  Schema<Partial<UserData>>
AdminUser  = User.extend (schema :shape
  permissions! string[])
```

Derived schemas are always `:shape`. **Field semantics survive** —
type, constraints, inline transforms all carry through. **Instance
behavior is dropped** — methods, computed getters (`~>`), eager
derived fields (`!>`), hooks, and ORM methods don't carry through.
Algebra is a structural operation on fields, not a behavioral one.

### Idiomatic shorthands

Most production code uses a few syntactic sugars. All are optional;
the Quick Tour above works as written.

```coffee
# Open-ended ranges. With `!` (required), `..N` implies `min=1`.
User = schema
  firstName!  ..50              # required, 1..50 chars
  bio?        text              # `text` is unbounded by design
  phone?      1..20

# File-level default cap for uncapped VARCHAR-like fields.
schema.defaultMaxString = 500

Profile = schema :model
  name!                         # → {min: 1, max: 500}
  email!#     email             # → {max: 500}
  bio?        text              # → uncapped (text opts out)

# One-line small shapes, plus a registered schema used as a field type.
Address = schema :shape; street? ..200; city? ..100; zip? ..10

Order = schema :shape
  address!    Address           # validation recurses; errors like "address.street"
```

See §5 for body-syntax details, §22 for nested type references, and
§25 for constraint and pragma rules.

---

## 3. Schemas vs types

Rip has two ways to describe data: the `type` / `interface` / `enum`
compile-time system and the `schema` runtime system. They don't compete —
they handle different concerns.

| Feature                        | `type` / `interface` / `enum` | `schema`                  |
| ------------------------------ | ----------------------------- | ------------------------- |
| Exists at runtime              | No                            | Yes                       |
| Validates data                 | No                            | Yes                       |
| Produces values / instances    | No                            | Yes                       |
| Generates SQL / ORM            | No                            | `:model` only             |
| Used by shadow TS              | Yes                           | Yes                       |
| Supports `.parse()`            | No                            | Yes                       |
| Erased from JS output          | Yes                           | No                        |

**Rules of thumb:**

- Use `type` / `interface` for shapes you want the editor and `rip check` to
  understand, but where the data is already trusted at runtime — internal
  function signatures, intermediate values, return types.
- Use `schema :input` when data enters your program from outside (HTTP body,
  `JSON.parse`, stdin, query params) and you need runtime guarantees.
- Use `schema :shape` when you want the same runtime guarantees plus
  behavior (methods, computed getters) — for example a `Point` or `Address`
  value that carries derived computations.
- Use `schema :model` for DB-backed entities. You get the validator, the
  ORM, the migration DDL, the relation methods, and the shadow TS all from
  one declaration.
- Use `schema :enum` when the set of values is fixed and runtime membership
  matters. The compile-time `enum` keyword still exists for cases where you
  only need the type and don't need runtime validation.
- Use `schema :mixin` when two or more schemas share a field group.

A schema is never the wrong tool for runtime data. A `type` is never the
wrong tool for purely compile-time descriptions. When both apply, use the
schema — it includes everything the type would give you (via shadow TS)
plus the runtime dimension.

---

## 4. The six kinds

Every schema has one of six kinds, selected by a `:symbol` after the
`schema` keyword:

<!-- doctest: skip -->
```coffee
input  = schema                # default — :input
shape  = schema :shape
enum   = schema :enum
mixin  = schema :mixin
model  = schema :model
union  = schema :union
```

The kind determines which body forms are legal, what `.parse()` returns,
and whether ORM / DDL surface is active.

### `:input`

A field validator. Body allows fields and `@mixin` only. `.parse(data)`
returns a plain validated object. No behavior, no persistence.

```coffee
SignupInput = schema
  email!    email
  password! string, 8..100
```

### `:shape`

A validator with behavior. Body accepts every field form — including
inline transforms (`name! type, -> body`) and the three colon-anchored
forms: methods (`name: -> body`), computed getters (`name: ~> body`),
and eager-derived fields (`name: !> body`). `@mixin` is the one
directive allowed. `.parse(data)` returns a class instance — declared
fields and eager-derived are own enumerable properties, methods live
on the prototype, computed getters are non-enumerable prototype
getters.

```coffee
Address = schema :shape
  street! string
  city!   string
  full: ~> "#{@street}, #{@city}"
```

`:shape` cannot carry lifecycle hooks (there's no lifecycle) or ORM-bound
directives (`@timestamps`, `@belongs_to`, `@has_many`, `@has_one`,
`@softDelete`, `@index`). Known hook names like `beforeSave` used on
`:shape` are just methods — no lifecycle binding.

### `:enum`

A fixed set of values. Members are `:symbol` literals; valued members add
a space-separated literal.

```coffee
Role = schema          # :enum kind inferred from :symbol body
  :admin
  :user
  :guest

Status = schema
  :pending 0
  :active  1
  :done    2
```

`.parse()` accepts either the member name or its value and returns the
value. For bare enums (no values), members map to their own name strings.

### `:mixin`

A reusable field group. Non-instantiable — you can't `.parse()` or `.ok()`
a mixin. Other schemas pull the fields in with `@mixin Name`.

```coffee
Timestamps = schema :mixin
  createdAt! datetime
  updatedAt! datetime

User = schema :model
  name! string
  @mixin Timestamps    # contributes createdAt + updatedAt
```

Mixins are fields-only. Methods, computed, hooks, and non-`@mixin`
directives inside a mixin body are compile errors.

### `:union`

A discriminated union over registered schemas. The body names the
discriminator field (`@on :field`, required — untagged unions are a
non-goal: they make dispatch O(n) and error messages incoherent) and
two or more constituent schemas, one per line:

```coffee
ClickEvent = schema :shape
  kind! "click"               # single-literal constant — the tag
  x!    integer
  y!    integer

ScrollEvent = schema :shape
  kind!  "scroll"
  delta! integer

Event = schema :union
  @on :kind
  ClickEvent
  ScrollEvent

Event.parse(kind: "click", x: 1, y: 2)    # → ClickEvent instance
Event.safe(kind: "hover")                 # → {field: "kind", error: "union",
                                          #    message: "expected one of click | scroll"}
```

- Each constituent must declare the discriminator as a string-literal
  type, all values distinct across the union — checked at first parse
  (lazy, consistent with registry resolution), with the colliding
  constituents named in the error.
- `.parse(data)` reads the discriminator and dispatches O(1) to the
  matching constituent's validator; the result is that constituent's
  instance (shapes keep their behavior).
- Usable as a field type like any registered schema: `events! Event[]`.
- If any constituent is async-validating (`@ensure!`), the union is too
  — use `parseAsync!` / `safeAsync!` / `okAsync!`.
- Schema algebra on a union throws — distribute-vs-intersect has no
  obviously-right answer, so v1 defers; derive from a constituent.
- Shadow TS: `type Event = ClickEvent | ScrollEvent;` — narrowing via
  the discriminator works natively.

### `:model`

A DB-backed entity. Everything `:shape` offers (all field forms,
methods, computed, eager-derived, inline transforms), plus: relations,
lifecycle hooks, the full ORM surface (`find`, `where`, `create`,
`save`, `destroy`, `toSQL`), and a process-global registry entry.
Eager-derived fields re-run on DB hydrate so they appear on instances
returned from `.find()` / `.where()` exactly as they do on parsed
instances.

```coffee
User = schema :model
  name!    string
  email!#  email
  @timestamps
  @has_many Order

  greet:            -> "Hello, #{@name}!"
  beforeValidation: -> @email = @email.toLowerCase()
```

---

## 5. Body syntax

Schema bodies are intentionally not general Rip code — they're declarative.
Only these line forms are allowed; anything else is a compile error with
a schema-specific diagnostic.

### Field

<!-- doctest: skip -->
```coffee
name[!|?|#]*  [type]  [range]  [default]  [regex]  [attrs]  [, -> transform]
```

Modifiers:

| Modifier | Meaning  |
| -------- | -------- |
| `!`      | required |
| `#`      | unique (emits `UNIQUE` in DDL; also creates a unique index) |
| `?`      | optional |

Any combination works (`email!#` means required + unique). Order among
modifiers doesn't matter. No modifier means "present but not required" —
equivalent to `?` for validation purposes.

**Type is optional** — when omitted, the field defaults to `string`. Type
expressions accept:

- a type identifier (`string`, `email`, `integer`, …)
- an array suffix (`string[]`)
- a string-literal union (`"M" | "F" | "U"`) — value must be one of the
  listed members; no mixing with base types. A single literal
  (`kind! "click"`) is a constant field — the building block of
  [discriminated unions](#union)
- a `~`-prefixed coercible type (`~integer`, `~number`, `~boolean`,
  `~date`) — "coerce, then validate" (see below)

```coffee
Example = schema
  name!                                   # required string (default type)
  tags!      string[]                     # required array of strings
  email!#    email                        # required, unique, email-format-validated
  bio?       text, 0..1000                # optional text, 0-1000 chars
  role?      string, ["user"]             # optional, default "user"
  status     string, [:draft]             # default :draft — same as ["draft"]
  zip!       string, /^\d{5}$/            # regex-validated
  sex?       "M" | "F" | "U"              # literal union
  priority   "low" | "med" | "high", [:med]  # literal union + default
```

### Coercion types (`~type`)

Wire data arrives as strings; a `~` prefix on a coercible built-in
means the value converts through a strict table before validation:

```coffee
SearchParams = schema
  page?     ~integer        # "42" → 42; "abc" → {error: 'coerce'}
  minPrice? ~number         # "19.95" → 19.95
  active?   ~boolean        # "true"/"1"/1 → true; "false"/"0"/0 → false
  since?    ~date           # ISO-8601 string or epoch ms → Date
```

- Coercion tables are strict and documented: `~integer` accepts
  integral strings and integral numbers, rejects `NaN` and `"12.5"`;
  `~boolean` accepts exactly the six tokens above; `~date` accepts
  ISO-8601 strings and finite epoch numbers. Failed coercion is
  `{error: 'coerce'}` — distinct from `{error: 'type'}`, because "looked
  like wire data but didn't convert" is a different mistake than "wrong
  shape entirely".
- Constraints apply **after** coercion — `age? ~integer, 18..120` range-
  checks the coerced number.
- Coercion is field semantics, so it **survives algebra** (`.pick`,
  `.omit`, …) like transforms do, and is **skipped on DB hydrate**
  (rows arrive canonical).
- `~` doesn't combine with a `->` transform (the transform IS manual
  control of the same step), doesn't apply to arrays, and only covers
  the four wire-friendly built-ins — everything else wants a named
  coercer or an explicit transform.

### Named coercers (`~:name`)

A `~:symbol` in the type slot coerces through the **named-coercer
registry** — and `@rip-lang/server` registers its entire `read()`
validator vocabulary there at load, so every battle-tested wire
normalizer (`id`, `money`, `ssn`, `phone`, `name`, `date`, `state`,
`zipplus4`, `slug`, `ids`, …) works in a schema field:

```coffee
Patient = schema :model
  chart!  ~:id, 1..99999     # "42" → 42 (integer; constraint after coercion)
  ssn?    ~:ssn              # "123-45-6789" → "123456789"
  phone?  ~:phone            # "8016542000" → "(801) 654-2000"
  state?  ~:state            # "ut" → "UT"
  dob?    ~:date             # normalized "YYYY-MM-DD" string
  amount? ~:money            # "$1,234.50" → 1234.5
  kids?   ~:ids              # "3, 1, 2, 2" → [1, 2, 3]
```

- The normalizer behind `read 'dob', 'date'` is the *same function*
  behind `dob? ~:date` — one vocabulary, two call sites.
  `registerValidator` on the server side registers both; schema-only
  code uses `schema.registerCoercer name, fn` directly.
- A coercer returning `null`/`undefined`/`false` fails the field with
  `{error: 'coerce', message: "<field> is not a valid <name>"}`. A
  coercer that isn't registered at parse time is a **config error**
  (fail loud), not a validation failure.
- Output types: the shipped names carry static output types for shadow
  TS and DDL (`~:id` → `number`/INTEGER, `~:money` → `number`,
  `~:ids` → `number[]`, `~:ssn` → `string`, …). Custom-registered
  names type as `any` — use an explicit transform when you need a
  precise static type.
- Note the namespaces differ: `~date` (built-in) coerces to a `Date`
  instance; `~:date` (named) normalizes to a `"YYYY-MM-DD"` string —
  exactly what `read 'x', 'date'` returns.

### Inline field transform

A `-> body` at the end of a field line derives the field's value from the
raw input. `it` inside the body refers to the **whole raw input object**
(not just the field's wire value), so transforms can pick from a
differently-named key, compose across multiple inputs, or coerce types:

```coffee
Imported = schema
  id!          -> it.Id                                    # remap PascalCase input
  displayName! -> it.DisplayName
  shippedAt?   date, -> new Date(it.shippedAt)             # wire string → Date
  slug!        -> "#{it.FirstName}-#{it.LastName}".toLowerCase()
  email!#      email, -> it.email.toLowerCase().trim()     # normalize + validate
```

Rules:

- **Declared type is the OUTPUT type** — the validator checks the
  transform's *return value*. The input shape is implicit.
- **Transform is terminal** on the field line — nothing follows `->`.
- **Comma before `->` is required** whenever anything precedes it on
  the line (type, range, regex, default, attrs). The comma is a
  structural boundary between the field declaration and the
  transform, not an argument separator — without it, lines like
  `email!# email -> fn` misleadingly suggest `email` is an input to
  the arrow. The bare form `name! -> fn` (nothing before the arrow
  except the name and modifiers) parses comma-less because there's
  nothing to elide. This is unlike Rip's general `get '/path' ->`
  rule: in a function call the arrow is the last argument; in a
  schema field it's a distinct semantic slot.
- **Runs once at `.parse()`**, never on DB hydrate (rows arrive
  canonical).
- **Survives algebra** (`.pick`, `.omit`, etc.) — field semantics, not
  instance behavior. A picked schema may still read raw-input keys not
  in its output shape.
- **Errors** in the transform wrap as `{error: 'transform'}` issues.

### Directive

```coffee
@name  [args]
```

Directives attach behavior that isn't a field. The set depends on the
kind (see [§23](#23-directives)). Examples:

```coffee
@timestamps                       # adds createdAt/updatedAt columns (:model only)
@softDelete                       # adds deletedAt, soft-deletes on .destroy() (:model only)
@index [role, active]             # composite index (:model only)
@idStart 10001                    # seed for the auto-id sequence (:model only, .toSQL())
@belongs_to Organization?         # nullable FK (:model only)
@has_many Order                   # has-many relation (:model only)
@mixin Timestamps                 # pull in a mixin's fields (any fielded kind)
```

### Method

```coffee
name: -> body
name: (params) -> body
```

Thin-arrow method bound on the generated class prototype. `this` is the
instance. Parameters are optional and may carry Rip type annotations,
which flow into shadow TS — a fully-annotated method gets its complete
signature (typed params, `this`, and the inferred return) instead of
`(...args: any[]) => unknown`:

```coffee
greet: -> "Hello, #{@name}!"

add: (other:: Money) ->
  Money.parse amount: @amount + other.amount, currency: @currency
  # shadow TS: add(this: Money, other: Money): Money

beforeSave: ->
  @email = @email.toLowerCase()
  @slug  = @name.toLowerCase().replace(/\s+/g, '-')
```

Parameters are method-only — lifecycle hooks, computed getters (`~>`),
and eager-derived fields (`!>`) are accessor-shaped and reject them.
For `:model`, method names matching known [hook
names](#24-hook-reference) bind to the lifecycle; on other kinds those
names are just methods.

### Computed getter (lazy)

```coffee
name: ~> body
```

Reactive-style arrow, emitted as a non-enumerable prototype getter via
`Object.defineProperty(proto, name, {get: fn})`. **Re-evaluates on every
access** — reflects the current instance state. Excluded from DDL and
persistence.

```coffee
full:       ~> "#{@street}, #{@city}"
identifier: ~> "#{@name} <#{@email}>"
isAdmin:    ~> @role is 'admin'
```

### Eager-derived field

<!-- doctest: skip -->
```coffee
name: !> body
```

Materialized-once derivation. Runs during `.parse()` (and on DB hydrate)
after all declared fields are populated. Stored as an **own enumerable
property**, so it appears in `Object.keys(inst)` and `JSON.stringify(inst)`.
Excluded from DDL and persistence — re-computed on hydrate from the
declared fields.

```coffee
Person = schema :shape
  firstName! string
  lastName!  string
  fullName:    !> "#{@firstName} #{@lastName}".trim()
  slug:        !> @fullName.toLowerCase().replace(/\s+/g, '-')
```

Declaration order matters — an `!>` can read earlier declared fields
and earlier `!>` values, but not later ones.

### `!>` vs `~>` — pick the right one

They look similar and come from the same grammar family, but they
behave very differently after mutation. This is the single most
important distinction in the schema body:

| | `name: !> body` (eager) | `name: ~> body` (lazy) |
|---|---|---|
| Fires | once at parse / hydrate | every access |
| Stored as | own enumerable property | non-enumerable prototype getter |
| `Object.keys(inst)` | includes it | does not |
| `JSON.stringify(inst)` | includes it | does not |
| After `inst.field = x` | **stale** — does not recompute | **live** — reflects the new value |
| Use for | serialized/materialized derivations, labels that ship over the wire | computed properties that should always reflect current state |

> **Important**: an `!>` field will appear *stale* if you mutate a
> dependency afterwards. That's by design — it's a snapshot, not a
> reactive binding. When in doubt, pick `~>` for live values and save
> `!>` for cases where the materialization is itself the goal
> (JSON payload shape, computed labels at construction time).

### Refinement (`@ensure`)

Schema-level cross-field invariants. Where field constraints check one
value against its own type and range, `@ensure` checks the whole object
against a predicate — "these fields together must satisfy this rule."

Two forms, same semantics:

```coffee
# Inline — a single invariant
@ensure "name and email must differ", (u) -> u.name isnt u.email

# Array — multiple invariants in one block
@ensure [
  "end after start",    (u) -> u.start < u.end
  "complex rule", (u) ->
    normalized = u.name.toLowerCase()
    not RESERVED_NAMES.includes(normalized)
]
```

An optional `:field` symbol between the message and the predicate
**attributes the failure to a specific field**, so form libraries can
attach the error to the right input (without it, the issue stays
schema-wide with `field: ''`):

```coffee
@ensure "passwords must match", :password2, (u) -> u.password is u.password2
# fails as {field: "password2", error: "ensure", message: "passwords must match"}
```

**Async refinements** use the dammit operator — `@ensure!` — for
predicates that await a database or network check:

```coffee
Signup = schema
  email! email
  @ensure! "email already registered", :email, (u) ->
    not await User.where(email: u.email).first()
```

A schema with ≥1 `@ensure!` is **async-validating**: sync `.parse` /
`.safe` / `.ok` throw immediately ("use parseAsync!/safeAsync!/okAsync!")
— no silent promise-leak, no sometimes-sync API. Sync refinements run
first (cheap before expensive); async refinements then run
**concurrently** (`Promise.all`) with all results collected in
declaration order, preserving the no-short-circuit rule. A rejected
async predicate counts as failed with the declared message. Async
refinements are skipped on hydrate and dropped by algebra, same as
sync ones.

Both forms compile to the same internal representation; use whichever
reads cleanest for the case at hand. The inline form is nicer for
one-offs; the array form keeps related invariants visually grouped.

Rules:

- **Message is required** and must be a string literal. It comes first
  (before the fn) and is the only thing reported when the predicate
  fails — write it from the user's perspective, not the developer's.
- **Predicate takes an explicit parameter.** Refinements declare the
  object parameter by name (`(u) -> ...`) rather than using implicit
  `this`. Makes the contract of "what the predicate sees" visible.
- **Truthy passes, falsy fails.** The predicate's return is coerced to
  boolean — any truthy value (object, array, non-zero number, non-empty
  string, `true`) passes; any falsy value (`false`, `null`, `undefined`,
  `0`, `''`, `NaN`) fails with the declared message.
- **Thrown exceptions fail.** If the predicate throws, the refinement
  counts as failed with the declared message — the exception doesn't
  propagate. Write safe predicates; this is a guard, not error
  recovery.
- **All refinements run.** No short-circuit between refinements —
  every predicate runs even if earlier ones failed. Issues collect in
  declaration order.
- **Refinements run after field validation.** Predicates can assume
  declared fields are typed and defaulted. If any per-field error fires,
  refinements don't run at all — their input would be malformed.
- **Refinements run before eager-derived fields.** An `!>` body can
  assume the instance satisfies its invariants.
- **Refinements are skipped on DB hydrate.** `.find()`, `.where()`,
  `.all()` deliver trusted rows; re-validating predicates on hydrate
  would be wasted work.
- **Refinements drop on algebra.** Any derivation (`.pick`, `.omit`,
  `.partial`, `.required`, `.extend`) returns a `:shape` without any
  refinements from the source. See [§15](#15-schema-algebra).

**Scope**: `:input`, `:shape`, and `:model` accept `@ensure`. `:enum`
and `:mixin` reject it at compile time with a diagnostic pointing at
where to put the invariant instead.

**Issue shape** when a refinement fails:

```js
{ field: '', error: 'ensure', message: 'your declared message' }
```

`field: ''` matches the convention for other schema-level errors
(`enum`, `mixin`, `derived`) — the issue isn't attached to any single
declared field.

### Rules to remember

- Fields use `name type` — **no colon**. `name: type` is a compile error.
- Methods and computed both use `name:` — the colon before the arrow is how
  you distinguish them from fields.
- `~>` produces a getter. `->` produces a method.
- A body cannot contain arbitrary statements — only the four forms above
  (plus enum members in `:enum`).
- The grammar is whitespace-sensitive: indentation opens the body, dedent
  closes it, trailing comma + indent continues a field line onto the next.

### Inline one-liner body

For small sub-shapes — the ones where indented-block ceremony outweighs
the declaration itself — the body can be written inline, with `;` as
the entry separator:

```coffee
Address = schema :shape; street?; line2?; city? ..100; state? ..2; zip? ..10
Billing = schema :shape; type? "client" | "insurance" | "patient"
Money   = schema :shape; amount! integer, 0..; currency! 3..3
```

Same grammar as the indented form — every field / directive / enum
form works inline. The emitted `__schema({...})` descriptor is
byte-for-byte identical to the equivalent indented block, so runtime
behavior (parse, safe, ok, algebra) is unchanged.

**What's not allowed inline:**

Method bodies can themselves contain `;`, which would be ambiguous
with the entry separator. So anything with an arrow — `->` (method /
hook / transform), `~>` (computed getter), `!>` (eager-derived) — is
rejected on the inline form with a message pointing to the indented
form:

<!-- doctest: fail -->
```coffee
# compile error — point at the indented form:
X = schema :shape; name!; greet: -> @name   # ✗ '->' not allowed inline
X = schema :shape; name!; full:  ~> @name   # ✗ '~>' not allowed inline
X = schema :shape; name!; tag:   !> @x      # ✗ '!>' not allowed inline
X = schema :shape; id! -> it.Id             # ✗ inline transform not allowed
```

An **empty inline body** (`X = schema :shape;` with nothing after
the leading `;`) is also rejected — almost always a typo.

### When to use which form

- **Inline** for small sub-shapes that exist to be referenced from
  another schema (`Address`, `Money`, `Coord`, short wire fragments
  for external APIs). The whole declaration fits in one visual
  row and reads more like a type alias than a class.
- **Indented block** for anything with methods, hooks, computed
  getters, `@ensure` refinements, or more than ~5 fields. Column
  alignment makes large field lists scannable in a way one-liners
  can't.

Rip doesn't enforce a choice; it just makes both cheap.

---

## 6. The runtime API

Every instantiable kind (`:input`, `:shape`, `:enum`, `:model`) exposes
the same three entry points. Different signatures, same contract.

### `.parse(data)`

Validates `data`. Returns a cleaned value. Throws `SchemaError` on
failure.

```coffee
user = SignupInput.parse raw
# on failure:
#   throw new SchemaError([...issues], schemaName, schemaKind)
```

### `.safe(data)`

Validates `data`. Returns a structured result — never throws.

```coffee
result = SignupInput.safe raw
# Success:
#   {ok: true, value: <parsed>, errors: null}
# Failure:
#   {ok: false, value: null, errors: [{field, error, message}, ...]}
```

`value` on success has the same shape as `.parse()` would return. `errors`
on failure is always a non-empty array.

### `.ok(data)`

Validates `data`. Returns a boolean. Allocates no error arrays — this is
the fast path for filter-style checks.

```coffee
process raw if User.ok raw
```

### `.parseAsync(data)` / `.safeAsync(data)` / `.okAsync(data)`

Async validation entry points. They exist on **every** schema (sync-only
schemas just resolve immediately) and are **required** when the schema
has `@ensure!` async refinements — the sync trio throws on those schemas
rather than sometimes-returning a promise. The dammit operator gives the
idiomatic call:

```coffee
user = Signup.parseAsync! raw
r    = Signup.safeAsync! raw
ok   = Signup.okAsync! raw
```

### The dammit operator and the ORM

For `:model`, the ORM methods are all genuinely async and `!` is the
canonical form:

```coffee
user = User.find! 1
user.save!
users = User.where(active: true).all!
```

---

## 7. What `.parse()` returns by kind

| Kind       | `.parse(data)` returns | `.safe(data).value` is |
| ---------- | ---------------------- | ---------------------- |
| `:input`   | Plain object — validated, defaults applied | same |
| `:shape`   | Instance of a generated class — fields as enumerable own properties, methods and getters on the prototype | same |
| `:enum`    | The member value (or the name string, for bare enums) | same |
| `:model`   | **Unpersisted** instance — same structure as `:shape`, but the class also has `save()`, `destroy()`, relation methods, and `_persisted` state | same |
| `:union`   | The matching constituent's `.parse()` result — dispatched O(1) on the discriminator | same |
| `:mixin`   | **Not instantiable** — `.parse()` throws | N/A |

For `:shape` and `:model`:

- Declared fields are enumerable own properties. `Object.keys(instance)`
  lists them.
- Methods are non-enumerable on the prototype (so they don't pollute JSON
  serialization or `for…in` iteration).
- Computed getters (`~>`) are non-enumerable prototype getters. They
  evaluate on read, never persist.
- For `:model`, internal state (`_dirty`, `_persisted`) is non-enumerable.

---

## 8. `:model` — the ORM

`:model` is where everything comes together. A model declaration gives
you:

- field validation (from `:shape`)
- class instances with methods and computed getters (from `:shape`)
- lifecycle hooks bound by name
- an async ORM — `find`, `where`, `create`, `save`, `destroy`
- `.toSQL()` for DDL (works without ever touching the ORM)
- relation accessors driven by `@belongs_to` / `@has_many` / `@has_one`
- automatic registration in a process-global registry for cross-module
  relation resolution

### Static ORM methods

```coffee
User.find! id                            # → User | null
User.findMany! [1, 2, 3]                 # → User[] (one IN query)
User.where(active: true).all!            # → User[]
User.where(active: true).first!          # → User | null
User.where(active: true).count!          # → number
User.includes(:orders).all!              # → eager-loaded (see below)
User.all!                                # → User[]
User.first!                              # → User | null
User.count!                              # → number
User.create! name: "Alice", email: "a@b.c"
User.upsert! {email: "a@b.c", name: "Al"}, on: :email   # INSERT … ON CONFLICT
User.insertMany! rows                    # validate all, one multi-VALUES INSERT
User.toSQL()                             # → DDL string (no DB call)
```

### Query builder

```coffee
User
  .where(active: true)                   # object → AND equalities
  .where(id: [1, 2, 3])                  # array value → IN (…)
  .where("created_at > ?", since)        # raw SQL + params
  .includes(:orders)                     # eager-load relations (see below)
  .order("last_name, first_name")        # or .orderBy — same thing
  .limit(10)
  .offset(20)
  .all!
```

- `.where`, `.includes`, `.limit`, `.offset`, `.order` / `.orderBy`,
  `.withDeleted`, `.onlyDeleted` return the query builder (sync).
- `.all`, `.first`, `.count`, `.updateAll`, `.deleteAll` terminate with
  a promise.

### Instance methods

Every `:model` instance carries:

```coffee
user.save!              # validate, run hooks, INSERT or UPDATE
user.destroy!           # run hooks, DELETE (or UPDATE deleted_at for @softDelete)
user.destroy! hard: true  # force a real DELETE on a @softDelete model
user.restore!           # @softDelete only — UPDATE deleted_at = NULL
user.ok()               # boolean — current fields validate
user.errors()           # SchemaIssue[] — current fields' errors
user.toJSON()           # plain object of own enumerable properties
                        #   (id, declared fields, @timestamps columns, @softDelete
                        #    deletedAt, @belongs_to FKs, !> eager-derived — but NOT
                        #    methods, ~> computed getters, or internal state)
user.savedChanges       # Map<fieldName, [oldValue, newValue]> from the most
                        #   recent save() — empty Map when nothing was written
user.markDirty 'name'   # force a column into the next UPDATE; escape hatch
                        #   for in-place mutations of object-valued fields
                        #   that === can't see (json, Date, etc.)
```

Plus any methods, computed getters, and relation accessors you declared
on the schema. Naming tip: methods that produce a fresh projection
(e.g. `user.toPublic()`, `order.toCard()`) follow Rip's
`to` / `as` / `from` / `parse` conversion convention — see
[RIP-LANG.md §15 "Conversion Method Naming"](./RIP-LANG.md#conversion-method-naming).

### What `save()` actually writes

The runtime tracks a snapshot of declared-field and `@belongs_to` FK
column values at hydrate / INSERT / UPDATE time. On `.save()` it
compares current values against the snapshot and emits a column-
targeted UPDATE that touches **only the columns whose values changed**.
If nothing changed, no SQL is issued at all.

Two practical consequences:

1. **No-op saves are free.** Calling `.save()` on an unchanged row is
   a no-op — no DB round-trip, no row touched. Mirrors Active Record
   with `partial_writes`.
2. **`@timestamps` `updated_at` is bumped only on real writes.**
   Calling `.save()` with no actual changes does NOT bump
   `updated_at` (which would defeat the no-op-save optimization
   entirely). Bumped on every UPDATE that does write something.

A third practical consequence on DuckDB specifically: column-targeted
UPDATEs sidestep DuckDB's foreign-key restriction on indexed-column
updates of referenced parent rows. See
[`docs/RIP-DUCKDB.md`](./RIP-DUCKDB.md) for the full rule, what works,
what doesn't, and how to design around it.

The diff is observable as `inst.savedChanges` after the save returns
(or inside `afterCreate` / `afterUpdate` / `afterSave` hooks). Same
shape as Active Record's `saved_changes`:

```coffee
order = Order.find! 1                # snapshot captured
order.notes  = "expedited"
order.userId = 9                     # @belongs_to User FK
order.save!

order.savedChanges                   # Map(2) {"notes" => [null, "expedited"], "userId" => [7, 9]}
order.savedChanges.size              # 2
order.savedChanges.has 'notes'       # true
```

INSERT records `[null, newValue]` for every field/FK that was written;
UPDATE records `[oldValue, newValue]` for every field/FK whose value
actually changed. `@timestamps` columns appear with the new ISO
timestamp on real INSERTs and UPDATEs.

Hook firing matches Active Record exactly: `before*` and `after*` hooks
fire on every successful `.save()`, regardless of whether SQL was
emitted. Hooks differentiate real writes from no-ops by checking
`@savedChanges.size` or specific keys.

### In-place mutation of object-valued fields

The dirty check uses value identity (`===` with NaN handling). Setter
assignments are detected:

```coffee
user.settings = {theme: "light", notifications: true}    # new reference; detected
user.save!
```

In-place mutations are **not**:

```coffee
user.settings.theme = "light"                            # same reference; invisible
user.save!                                               # nothing written
```

This matches Active Record's behavior with serialized attributes —
"Active Record by default does not detect changes inside mutable
serialized attributes." The escape hatch is `markDirty`:

```coffee
user.settings.theme = "light"
user.markDirty 'settings'                                # AR's `settings_will_change!`
user.save!                                               # writes settings = '{"theme":"light",...}'
```

`markDirty` accepts both camelCase and snake_case names, validates
against declared fields and `@belongs_to` FK column names, and throws
on unknown names or non-persisted instances (INSERT writes every set
field, so `markDirty` there would be a silent no-op).

Same caveat applies to `Date` fields:

```coffee
order.collectedAt.setHours 5                             # in-place; invisible
order.markDirty 'collectedAt'
order.save!
```

If you find yourself reaching for `markDirty` often, prefer immutable
updates instead — they're cleaner and the dirty check sees them
automatically:

```coffee
user.settings = { ...user.settings, theme: "light" }
order.collectedAt = new Date order.collectedAt.getTime() + 3600000
```

### Re-entry guard

`.save()` cannot be re-entered on the same instance while a save is
already in flight. Calling `@save!` from inside this instance's
`beforeSave` / `beforeUpdate` / `afterSave` hook throws — that's
almost always a recursion bug, and silent infinite-loop debugging is
worse than a clear error. The guard is per-instance: independent
instances saving in parallel are unaffected, and sequential saves on
the same instance work fine.

### Lifecycle hooks

Hooks are methods whose name matches one of the [twelve recognized hook
names](#24-hook-reference). On `:model` they bind into the lifecycle; on
other kinds they're just regular methods.

**Save flow:**

```text
beforeValidation
    ↓
  validate
    ↓
afterValidation
    ↓
 beforeSave
    ↓
beforeCreate   (for inserts)    beforeUpdate   (for updates)
    ↓                                ↓
INSERT                            UPDATE
    ↓                                ↓
afterCreate                       afterUpdate
    ↓
  afterSave
```

**Destroy flow:**

```text
beforeDestroy
    ↓
DELETE  (or UPDATE deleted_at if @softDelete)
    ↓
afterDestroy
```

Throwing from any hook aborts the operation and propagates the error.
Validation happens **after** `beforeValidation` (so that hook is the
right place to normalize input) and **before** `beforeSave` (so `beforeSave`
only runs on already-valid data).

`afterCommit` and `afterRollback` sit outside both flows: when a
`schema.transaction!` is open they queue on it and fire after the
outermost COMMIT / ROLLBACK; with no transaction open, `afterCommit`
fires immediately after a successful save/destroy and `afterRollback`
never fires. See the Transactions section above.

### Relations

```coffee
User = schema :model
  name! string
  @has_many Order
  @has_one  Profile

Order = schema :model
  total! integer
  @belongs_to User
  @belongs_to Organization?     # ? = nullable FK
```

Relation accessors are **async methods** on the instance prototype:

```coffee
user = User.find! 1
orders  = user.orders!            # → Order[]
profile = user.profile!           # → Profile | null

order  = Order.find! 42
owner  = order.user!              # → User | null
```

Accessor names:

- `@belongs_to User` → `user()` (target's name, lower-first-letter)
- `@has_one Profile` → `profile()`
- `@has_many Order` → `orders()` (pluralized)

Targets resolve lazily through a process-global registry keyed by name.
Circular and cross-module references work — import the file that defines
the target, and relation calls succeed.

See [§26 Relations](#26-relations) for the full table of directive →
accessor → return type.

### Snake / camel dual access on instances

Database columns are typically snake_case (`user_id`, `created_at`) while
field names are camelCase (`userId`, `createdAt`). A hydrated `:model`
instance exposes both — `order.user_id` and `order.userId` read the same
slot. The camelCase form is the canonical own property; the snake_case
form is a non-enumerable accessor that forwards.

```coffee
order = Order.find! 42
order.userId       # 7     (camelCase: canonical)
order.user_id      # 7     (snake_case: alias)
order.createdAt    # Date  (camelCase: canonical)
order.created_at   # Date  (snake_case: alias)
```

`.create(data)` also accepts either style:

```coffee
Order.create! user_id: 7, total: 100
Order.create! userId:  7, total: 100    # same result
```

Use whichever reads better alongside nearby raw SQL or JSON payloads.

### Field-name conventions

The snake_case ↔ camelCase bijection only works for identifiers
that round-trip cleanly. The schema runtime enforces canonical
camelCase at definition time:

```coffee
User = schema :model
  mdmId? string                        # OK — canonical
  mdmID? string                        # error — acronym style;
                                       #   round-trips to mdm_i_d / mdmID
                                       #   ambiguously
```

Rules:

- Lowercase-first
- Alphanumeric body
- No two consecutive uppercase letters anywhere

Same convention as Java Beans, Swift's "Acronyms in API names"
guidance, and what most JS/TS codebases follow in practice.

The runtime also reserves the names of its instance API
(`save`, `destroy`, `ok`, `errors`, `toJSON`, `savedChanges`,
`markDirty`, `_dirty` / `_persisted` / `_snapshot` / `_saving`)
and the implicit timestamp / soft-delete columns
(`createdAt`, `updatedAt`, `deletedAt`). Declaring any of those
as a user field on a `:model` raises a `'reserved ORM name'`
collision error at definition time. (Mixins are exempt — they
can declare `createdAt` / `updatedAt` for explicit control,
which is the alternative to the `@timestamps` directive.)

### Relation target names

`@belongs_to TargetName` derives the FK column from the target's
PascalCase name via `__schemaSnake(target) + '_id'`. The same
camelCase / snake_case bijection rule applies in reverse: target
names should be canonical PascalCase (`User`, `UserOrg`, not
`MDMUser`) so the derived FK column round-trips cleanly. Acronym-
style target names aren't currently rejected at definition time,
but writing `@belongs_to MDMUser` produces FK column `m_d_m_user_id`
— almost certainly not what you want. Stick to PascalCase.

### SQL reserved words

The runtime always quotes column names in generated SQL — every
INSERT, UPDATE, and SELECT it emits surrounds column identifiers
with `"..."`. So a field named `order` works fine through the
ORM:

```coffee
Trade = schema :model
  order! integer                       # works through the ORM
```

The compiled SQL is `UPDATE "trades" SET "order" = ? WHERE "id" = ?`.

The catch is **raw SQL** that you write yourself via the adapter's
`query()` method or via `query!`. There the reserved-word collision
becomes your problem:

```coffee
result = query! "SELECT order FROM trades"          # syntax error
result = query! "SELECT \"order\" FROM trades"      # works
```

This matches Active Record's behavior — the ORM-generated SQL is
always quoted, and raw SQL is always the user's responsibility.

---

## 9. Transactions & data integrity

Atomic multi-statement writes, transaction-aware lifecycle hooks, and
DB constraint violations that fail the same structured way validation
does.

### Transactions (`schema.transaction!`)

Atomic multi-statement writes. The block's value becomes the
transaction's value; a throw rolls everything back and propagates:

```coffee
result = schema.transaction! ->
  user = User.create! name: "Alice", email: "a@b.c"
  Order.create! userId: user.id, total: 100
  user                                   # block value = transaction!'s value
```

- **Propagation is ambient** (AsyncLocalStorage): every ORM call inside
  the block — `create!`, `save!`, `destroy!`, relation accessors,
  queries — automatically routes through the transaction's pinned
  connection. Model code is unchanged inside the block.
- Block throws → `ROLLBACK`, the exception propagates. Block returns →
  `COMMIT`, the value is returned.
- **Nested `transaction!` joins the outer transaction** (Active
  Record's default). DuckDB has no `SAVEPOINT`, so independent nested
  units aren't expressible on the primary backend; joining is the
  honest semantics.
- Don't parallelize ORM calls *inside* one transaction — they share one
  pinned DB connection, exactly like one connection in any ORM.
  Parallel `transaction!` blocks are fine; each gets its own connection
  and its own ambient context.
- Two transaction-aware hooks: `afterCommit` fires after the outermost
  transaction commits (or immediately after save/destroy when no
  transaction is open) — this is where emails, webhooks, and cache
  invalidation belong. `afterRollback` fires after a rollback for each
  instance saved/destroyed inside the rolled-back transaction. A row
  saved twice in one transaction gets one callback. Exceptions in
  `afterCommit` propagate but cannot roll back — the COMMIT already
  happened.
- Against rip-db / duckdb-harbor, the transaction rides harbor's
  session protocol (`POST /sql/sessions/new` pins a connection; the
  session is destroyed after COMMIT/ROLLBACK; harbor's idle TTL
  auto-rolls-back abandoned transactions server-side). Note: harbor
  gates session creation behind the `__HARBOR_ADMIN__:sessions:create`
  authz policy — transactions need an authz rule allowing it (or
  `harbor_allow_admin_without_authz = true` on trusted deployments),
  and an authenticated principal (harbor's unauthenticated `token :=
  NULL` mode cannot create owned sessions).
- Adapters without `begin()` throw a clear "does not support
  transactions" error — never a silent non-transactional fallback.

### Constraint violations are SchemaErrors

The ORM wraps every adapter call. DB errors recognized as constraint
violations are translated into `SchemaError` so a `save!` that trips a
UNIQUE index fails the same way a `save!` that trips a validator does:

| DB condition | Issue emitted |
| --- | --- |
| UNIQUE violation | `{field: "email", error: "unique", message: "email already taken"}` |
| NOT NULL violation | `{field, error: "required", …}` |
| FK violation | `{field, error: "reference", …}` |
| CHECK violation | `{field: "", error: "check", …}` |

The original adapter error is preserved as `err.cause`. Unrecognized
errors propagate untouched. Uniqueness pre-checks
(`validates_uniqueness_of`-style) are deliberately **not** offered —
they race; the DB constraint is the check, translation makes it
ergonomic.

## 10. Query economics

The features that keep list views at a constant query count and bulk
operations at one statement: eager loading, composable scopes, batch
writes, and soft deletes.

### Eager loading (`.includes`)

Relations are lazy by default — `user.orders!` issues a query on demand,
which makes N+1 the default behavior of every list view. `.includes`
fixes the economics with **batched second queries** (`WHERE fk IN (…)`),
never JOINs — no row duplication, uniform across `belongs_to` /
`has_one` / `has_many`:

```coffee
users = User.includes(:orders).where(active: true).all!
posts = Post.includes(:author, comments: :author).limit(20).all!
```

- Accepts `:symbols`, strings, and nested `{relation: nested}` maps to
  any depth. One query per relation per nesting level, regardless of
  row count.
- Preloaded relations fill the accessor's **memo**: `user.orders!`
  resolves from cache with no query. The accessor API is unchanged
  (uniform async) — preloading is purely a performance fact, invisible
  to call sites.
- `.includes` never changes the root result set — same rows with or
  without it.

Relation accessors memoize independently of `.includes`: the second
`user.orders!` call on the same instance is free. Pass
`user.orders! reload: true` to bust the memo and re-query.

### Query scopes (`@scope`, `@defaultScope`)

Named, composable query fragments declared on the model:

```coffee
User = schema :model
  name!    string
  active?  boolean
  role?    string
  @scope :active, -> @where(active: true)
  @scope :since,  (d) -> @where("created_at > ?", d)
  @defaultScope -> @where(banned: false)

User.active().since(monday).order("name").all!
User.where(role: "admin").active().all!       # chains in any order
User.unscoped().all!                          # skip the @defaultScope
```

- `this` inside a scope body is the query builder; scopes return the
  builder, so they compose with each other and with `.where` /
  `.order` / `.limit` in any order. Parameterized scopes declare their
  args: `(d) -> @where("created_at > ?", d)`.
- Scopes live in the **static** namespace (model + builder), so a field
  `active` and a scope `:active` coexist. Scope names may not collide
  with the query API (`where`, `find`, `order`, …) or with each other —
  checked at first use with a `collision` SchemaError.
- `@defaultScope` (at most one per model) applies to every read and
  bulk write — `where`/`all`/`first`/`count`/`find`/`findMany`/
  `updateAll`/`deleteAll` — unless `.unscoped()` appears anywhere in
  the chain. It composes with `@softDelete`'s implicit filter; both
  apply. (Use sparingly — Active Record's caveats about default
  scopes apply verbatim.)
- Scopes appear in shadow TS: typed statics on the model const plus a
  per-model `UserQuery` alias so scope-first chains typecheck.

### Batch writes

```coffee
User.upsert! {email: "a@b.c", name: "Alice"}, on: :email
  # INSERT … ON CONFLICT (email) DO UPDATE SET …; validates;
  # beforeSave/afterSave fire; beforeCreate/beforeUpdate do NOT
  # (the runtime can't know which branch the DB took).
  # DuckDB caveat: ON CONFLICT updates on rows referenced by another
  # table's FK trip DuckDB's indexed-column restriction — see
  # docs/RIP-DUCKDB.md.

User.insertMany! rows
  # validates every row first (ALL failures collected into one
  # SchemaError with `[i].field` issue paths, before any SQL), then one
  # multi-VALUES INSERT … RETURNING *. Per-instance hooks deliberately
  # skipped — this is the bulk path; use create! in a loop for hooks.

User.where(active: false).deleteAll!     # one statement (soft-delete aware)
User.where(plan: "trial").updateAll! expired: true
  # one UPDATE; bypasses validation and hooks — the name says "all",
  # the docs say "raw". Bumps updated_at on @timestamps models.
```

### Soft deletes

`@softDelete` adds a `deleted_at` column and turns `.destroy()` into an
UPDATE. Every read (`find`, `where`, `all`, `first`, `count`) and bulk
write implicitly filters `deleted_at IS NULL`. The escape hatches:

```coffee
User.withDeleted().all!          # no filter — live and deleted rows
User.onlyDeleted().all!          # inverted filter — deleted rows only
user.restore!                    # UPDATE … SET deleted_at = NULL
user.destroy! hard: true         # real DELETE; hooks still fire
```

Relation accessors on other models respect the target's soft-delete
filter — an `order.user!` of a soft-deleted user resolves `null`,
consistent with `find`.

## 11. Adapters

### The adapter seam (Contract v2)

All ORM methods route through a single adapter funnel.
`query(sql, params)` is the only **required** method; v2 adds optional
capabilities the runtime feature-detects:

```coffee
globalThis.__ripSchema.__schemaSetAdapter
  # required — returns {columns: [{name, type}, …], data: [[…]], rowCount: N}
  query: (sql, params) ->
    db.run sql, params

  # optional — transactions (schema.transaction!). Returns a TxHandle.
  begin: (options) ->
    conn = db.pin()
    conn.run 'BEGIN'
    {
      query:    (sql, params) -> conn.run sql, params
      commit:   -> conn.run 'COMMIT'   and conn.release()
      rollback: -> conn.run 'ROLLBACK' and conn.release()
    }

  capabilities: { tx: true }    # truthful self-report
```

Calling a feature whose method is absent throws a clear error
(`schema.transaction()` on an adapter without `begin()` says so by
name) — never a silent fallback.

The default adapter talks to a duckdb-harbor instance: `RIP_DB_URL`
(default `http://127.0.0.1:9494`; legacy `DB_URL` honored) and
`RIP_DB_TOKEN` for bearer auth. Its `begin()` rides harbor's session
protocol — `POST /sql/sessions/new` pins a connection, statements carry
the `sessionId`, and the session is destroyed after COMMIT/ROLLBACK.
`@rip-lang/db`'s `connect(url)` installs the same contract (query +
begin) with its richer error handling and timeouts.

### Per-schema adapters (`on:`)

Multi-database setups pin individual models to their own adapter:

```coffee
analytics = schema.connect url: env.ANALYTICS_URL, token: env.ANALYTICS_TOKEN

Event = schema :model, on: analytics
  name! string
  @timestamps
```

- `schema.connect {url, token?}` builds a NEW harbor adapter value
  without installing it globally; any Contract-v2 adapter object works
  in the `on:` slot. The default remains the global adapter.
- Every ORM call resolves the model's adapter; `schema.transaction!`
  takes `on: analytics` to pin the ambient transaction to one adapter.
  ORM calls against a *different* adapter inside that block run
  **outside** the transaction — each adapter has its own ambient slot,
  and cross-adapter atomicity is impossible, so the runtime never
  pretends otherwise.
- `@belongs_to` / `@has_many` across adapters: the accessor works (it's
  just a second query), but FK DDL emission is suppressed with a note —
  the constraint can't exist cross-database.

## 12. DDL & schema evolution

Greenfield CREATE comes from `toSQL()`; everything after the first
deploy comes from the migration system — diffing the declared models
against the live database.

### DDL (`.toSQL()`)

`.toSQL()` returns `CREATE SEQUENCE` + `CREATE TABLE` + index `CREATE`
statements for a model. It does not touch the database — you run the
output through whatever migration plumbing you prefer.

```coffee
User.toSQL()
# CREATE SEQUENCE users_seq START 1;
#
# CREATE TABLE users (
#   id INTEGER PRIMARY KEY DEFAULT nextval('users_seq'),
#   name VARCHAR(100) NOT NULL,
#   email VARCHAR NOT NULL UNIQUE,
#   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
#   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
# );
#
# CREATE UNIQUE INDEX idx_users_email ON users ("email");
```

`.toSQL()` works independently of the ORM. A migration script that never
calls `.find()` or `.create()` can still emit full DDL.

#### Sequence start value

The auto-id sequence seeds at `1` by default. Override per-model with the
`@idStart N` directive, or per-call with the `idStart` option (the option
wins):

```coffee
User = schema :model
  name! string
  @idStart 10001            # customer-facing IDs start at 10001

User.toSQL()                # → CREATE SEQUENCE users_seq START 10001;
User.toSQL(idStart: 50000)  # → CREATE SEQUENCE users_seq START 50000;
```

Required because DuckDB (as of 1.5.2) does not implement
`ALTER SEQUENCE … RESTART WITH N` — so the seed has to be baked into the
initial `CREATE SEQUENCE` rather than bumped in a follow-up migration.

To emit a whole application's schema, call `.toSQL()` per model and join.
Order by FK dependency (models referenced via `@belongs_to` come first):

```coffee
ddl = [
  User.toSQL()
  Category.toSQL()
  Order.toSQL()       # references User
  OrderItem.toSQL()   # references Order
].join('\n\n')
```

### Schema evolution (`rip schema status / make / migrate`)

`.toSQL()` covers greenfield CREATE. Evolution — diffing the declared
models against the deployed database and emitting ALTER migrations —
is built in:

```text
rip schema status  [models.rip]        # applied / pending / drift + the current plan
rip schema plan    [models.rip]        # just the classified diff
rip schema make <name> [models.rip]    # write migrations/NNNN_<name>.sql from the diff
rip schema migrate [models.rip]        # apply pending migration files in order
```

The same verbs are callable from code: `schema.plan!`, `schema.status!`,
`schema.make! "name", opts`, `schema.migrate! opts`, and
`schema.introspect!` (the deployed schema as canonical table specs).

**How it works.** The DDL emitter's internal model is exposed as a
canonical table spec (`Model._tableSpec()`); introspection builds the
same structure from the live database (`information_schema` +
`duckdb_*()` catalogs, or the adapter's own `introspect()` capability).
The differ operates on two values of the same type and emits classified
steps:

| Class | Examples | Gate |
| --- | --- | --- |
| `safe` | ADD COLUMN (nullable / defaulted), CREATE TABLE, CREATE INDEX, RENAME | none |
| `lossy` | type change, SET NOT NULL, new UNIQUE on existing data | `--allow-lossy` |
| `destructive` | DROP COLUMN, DROP TABLE | `--allow-destructive` |
| `blocked` | any ALTER DuckDB refuses on an FK-referenced table | no flag — manual rebuild |

**Migration files are plain SQL** — numbered, hand-editable, checked
into git (default `./migrations`). `make` writes them; humans may amend
them; `migrate` applies pending files in order (each inside a
transaction when the adapter supports one) and records
`(version, name, checksum, applied_at)` in `_rip_migrations`. A
checksum mismatch on an applied file aborts — someone edited history —
unless `--repair` re-records.

**Renames are resolved in the declaration**, since a diff cannot
distinguish rename from drop + add:

```coffee
User = schema :model
  givenName! ..50, {was: "first_name"}    # column rename
  @tableWas legacy_users                   # table rename
```

The differ consumes the annotation and emits `RENAME` instead of
`DROP + ADD`; once the migration lands, the annotation is dead weight
and can be removed.

**DuckDB caveats the differ understands:**

- `ADD COLUMN` cannot carry `NOT NULL` / `UNIQUE` / `REFERENCES` —
  required adds become add → (backfill TODO when no default) →
  `SET NOT NULL`; unique adds get a separate `CREATE UNIQUE INDEX`;
  FK constraints cannot be added to an existing table at all (a note is
  emitted).
- A table referenced by another table's FOREIGN KEY is frozen for
  everything except `ADD COLUMN` and index DDL ("Dependency Error") —
  such steps classify `blocked`. The plan orders ALTERs before
  CREATEs so a new child table never freezes its parent mid-migration.
- `VARCHAR(n)` length hints are not persisted by DuckDB, so they never
  produce drift; sequence start values cannot be altered after
  creation, so `@idStart` drift is reported as a note, not a step.

## 13. Wire contracts — JSON Schema & OpenAPI

### JSON Schema & OpenAPI (`toJSONSchema`)

Every schema exports a JSON Schema (draft 2020-12):

```coffee
SignupInput.toJSONSchema()
# { $schema: "…/2020-12/schema", title: "SignupInput", type: "object",
#   properties: { email: {type: "string", format: "email"}, … },
#   required: ["email", "password"] }
```

- Field types map per [§22](#22-field-types); ranges become
  `minLength`/`maxLength`/`minimum`/`maximum`/`minItems`/`maxItems`,
  regexes become `pattern`, defaults become `default`, literal unions
  become `enum` (single literal → `const`).
- Nested registry schemas become `$ref`s collected under `$defs`
  (cycle-safe — recursive shapes work); `:enum` maps to `enum`,
  `:union` to `oneOf` + a `discriminator`.
- `:model` shapes include the DB-managed columns `toJSON()` carries
  (`id`, FKs, `@timestamps`, `@softDelete`).
- Transforms and refinements have no executable JSON Schema equivalent
  — they export as `description` annotations rather than being
  silently dropped or approximated.

**The payoff is rip-server integration.** A route that validates with
a schema contributes to a generated `GET /openapi.json` automatically:

```coffee
import { post, openapi } from '@rip-lang/server'

post '/signup', input: SignupInput, ->
  # @input is the parsed (defaulted, coerced) value;
  # 400 with structured {field, error, message} issues is automatic
  createUser @input

openapi title: 'Trust Health API', version: '1.4.0'   # optional info block
```

The `input:` option validates through `safeAsync` (so `@ensure!`
schemas work), never re-reads the body stream, and registers
`/openapi.json` on first use — declaration → DB → server contract →
client codegen (any OpenAPI generator), with zero additional
authoring.

## 14. Mixins

`:mixin` schemas exist to share field groups across multiple models or
shapes. They're non-instantiable — you declare them, then other schemas
pull them in with `@mixin Name`.

```coffee
Timestamps = schema :mixin
  createdAt! datetime
  updatedAt! datetime

Auditable = schema :mixin
  createdBy? string
  @mixin Timestamps              # mixins can chain into mixins

User = schema :model
  name! string
  @mixin Auditable               # transitively pulls in Timestamps

Order = schema :model
  total! integer
  @mixin Auditable
  @belongs_to User
```

### Behavior

- Fields are expanded at Layer 2 normalization, once per host schema, and
  cached.
- Expansion is depth-first. A mixin that `@mixin`s another mixin
  transitively contributes its base's fields.
- Diamond inclusion dedupes: if two mixins both include a common base,
  the base's fields appear once per host.
- Cycles produce a compile error with the full path (`A -> B -> A`).
- Duplicate fields across mixins (or between a mixin and the host) are a
  compile error — no silent overwrite.
- Mixins are fields-only. Methods, computed, hooks, and non-`@mixin`
  directives inside a mixin body are compile errors.

### `@mixin` is allowed on any fielded kind

```coffee
Base = schema :mixin
  id! uuid

X = schema :input
  @mixin Base
  name! string

Y = schema :shape
  @mixin Base
  full: ~> @name

Z = schema :model
  @mixin Base
  @timestamps
```

The reason: mixins add *fields*, not *behavior*. Field sharing is
orthogonal to the capability axis that distinguishes the kinds.

---

## 15. Schema algebra

Algebra operators derive new schemas from existing ones:

| Operator                | Result                                                         |
| ----------------------- | -------------------------------------------------------------- |
| `.pick(...keys)`        | new shape with only the listed fields                          |
| `.omit(...keys)`        | new shape without the listed fields                            |
| `.partial()`            | every field becomes optional                                   |
| `.required(...keys)`    | the listed fields become required (others unchanged)           |
| `.extend(other)`        | merge another schema's fields; collisions throw                |

### Three invariants to remember

> **Algebra always returns `:shape`**, never `:model` or `:input`. On a
> model, the ORM surface is stripped — `UserPublic.find()` throws.

> **Field semantics survive; instance behavior does not.** What carries
> through to the derived shape: type (including literal unions),
> modifiers, constraints (range, regex, default, attrs), and **inline
> transforms** (`name, -> fn(it)`). What gets dropped: methods (`->`),
> computed getters (`~>`), eager-derived fields (`!>`), hooks, ORM
> methods, and `@ensure` refinements. The transform is "how this
> field's value is obtained from raw input" — a property of the field,
> not of the instance — so it travels with the field through algebra.
> Refinements, by contrast, are schema-level invariants that reference
> field names — there's no static guarantee those names survive a
> `.pick` or `.omit`, so refinements drop unconditionally.

> **Transforms-survive has a subtle consequence**: a derived schema may
> still read raw-input keys that don't appear in its declared output
> shape. `User.pick 'slug'` where `slug` is declared as
> `slug! -> "#{it.FirstName}-#{it.LastName}".toLowerCase()` continues
> to read `FirstName` and `LastName` from the input even though neither
> is in the output. This is deliberate and documented; it makes
> PascalCase-remap transforms composable with `.pick`.

```coffee
User = schema :model
  name!    string
  email!#  email, -> it.email.toLowerCase()
  password! string
  full: ~> "#{@name} <#{@email}>"
  tagline: !> "#{@name} (active)"

UserPublic = User.omit "password"

UserPublic.kind                     # 'shape'
typeof UserPublic.find              # 'function' — but throws when called
UserPublic.find(1)                  # throws: :model-only

u = UserPublic.parse {name: "A", email: "X@B.C"}
u.email                             # 'x@b.c' — transform survived
typeof u.full                       # 'undefined' — ~> dropped
typeof u.tagline                    # 'undefined' — !> dropped
```

`.extend(other)` is the exception to "algebra only drops" — it adds
fields from another schema. Collisions still throw.

```coffee
AdminUser = User.extend (schema :shape
  permissions! string[])
```

`.sourceModel` is preserved through chained algebra, so tooling can trace
derived shapes back to their origin:

```coffee
A = User.pick "name"
B = A.partial()
B._sourceModel is User              # true
```

### The `_sourceModel` metadata

Algebra operations preserve a non-enumerable `_sourceModel` pointer on
the derived schema. Downstream tooling (migration analyzers, form
generators, query projectors) can walk this back to the originating
`:model` without stringly-typed guesses.

---

## 16. Shadow TypeScript

Every named schema emits virtual TypeScript declarations that the
language service picks up. The VS Code extension and `rip check` both
consume these — autocomplete, hover, and type checking all work out of
the box.

### What gets emitted

The schema's **bare name** is the type you reference everywhere — the parsed
value (for `:input`/`:shape`) or the hydrated instance (for `:model`) — exactly
the way a class names both its value and its instance type. A separate
`<Name>Data` (fields-only) type is emitted only when it differs from the bare
name: behavior-bearing `:shape`s and every `:model`.

For `:input` (no behavior — the bare name is the whole shape):

```ts
type SignupInput = { email: string; password: string };
declare const SignupInput: Schema<SignupInput, SignupInput>;
```

For `:shape` (with behavior — `<Name>Data` = fields, bare `<Name>` = instance):

```ts
type AddressData = { street: string; city: string };
type Address = AddressData & {
  readonly full: unknown;
  normalize: (...args: any[]) => unknown;
};
declare const Address: Schema<Address, AddressData>;
```

For `:model`:

```ts
type UserData = { name: string; email: string };
type UserCreate = { name: string; email: string };   // create()'s input — required-no-default fields
type User = UserData & {
  readonly identifier: unknown;
  greet: (...args: any[]) => unknown;
  save(): Promise<User>;
  destroy(): Promise<User>;
  ok(): boolean;
  errors(): SchemaIssue[];
  toJSON(): UserData;
  organization(): Promise<Organization | null>;
  orders(): Promise<Order[]>;
};
declare const User: ModelSchema<User, UserData, number, UserCreate>;
```

> **Computed/derived inference.** The `unknown` on a `~>`/`!>` member above is
> the *published* `.d.ts` form. In the editor and `rip check`, the type emitter
> infers each computed/derived member from its body — `full` above resolves to
> `string`, and a `status: ~> if @done then 'Completed' else 'Pending'` resolves
> to `"Completed" | "Pending"` — so they're usable as their real types (e.g.
> `order.name.toUpperCase()`). A plain `.d.ts` has no runtime body to infer
> from, so it keeps `unknown`. Methods stay `(...args: any[]) => unknown` either
> way (their params aren't typed).

For `:enum`:

```ts
type Role = "admin" | "user" | "guest";
declare const Role: {
  parse(data: unknown): Role;
  safe(data: unknown): SchemaSafeResult<Role>;
  ok(data: unknown): data is Role;     // sound type predicate!
};
```

For `:mixin`: type-only alias, no runtime declaration (mixins aren't
user-facing runtime values).

```ts
type Timestamps = { createdAt: Date; updatedAt: Date };
```

### Algebra types follow runtime semantics

Because algebra operates on `Data` (the plain field shape, not the
`Instance`), derived types correctly omit behavior:

```ts
// User.omit("email") has type:
Schema<Omit<UserData, "email">, Omit<UserData, "email">>

// User.partial() has type:
Schema<Partial<UserData>, Partial<UserData>>
```

A **named** derived schema additionally gets a bare type of its own, so a
projection can be annotated or re-exported under a clean name:

```coffee
UserPublic = User.pick("id", "name")   # also emits a bare `type UserPublic`
```

It's emitted as `type UserPublic = ReturnType<(typeof UserPublic)['parse']>`,
which resolves to the exact projection (`Pick<UserData, "id" | "name">`) —
covering every operator and chain for free.

### Same-file targets type relation accessors

Relation accessors get precise return types when the target is declared
in the same file:

```coffee
User = schema :model
  name! string
Order = schema :model
  @belongs_to User                   # → order.user(): Promise<User | null>
```

Cross-file relation targets degrade to `unknown` rather than emit
unresolved names. This keeps the TypeScript diagnostics clean without
requiring virtual-module imports.

### Intrinsic declarations

Five base interfaces get injected into every schema-using file's type
view:

```ts
interface SchemaIssue { field: string; error: string; message: string; }
type SchemaSafeResult<T> =
  | { ok: true;  value: T;    errors: null }
  | { ok: false; value: null; errors: SchemaIssue[] };

interface Schema<Out, In = unknown> {
  parse(data: unknown): Out;
  safe(data: unknown): SchemaSafeResult<Out>;
  ok(data: unknown): boolean;
  pick<K extends keyof In>(...keys: K[]): Schema<Pick<In, K>, Pick<In, K>>;
  omit<K extends keyof In>(...keys: K[]): Schema<Omit<In, K>, Omit<In, K>>;
  partial(): Schema<Partial<In>, Partial<In>>;
  required<K extends keyof In>(...keys: K[]): Schema<
    Omit<In, K> & Required<Pick<In, K>>,
    Omit<In, K> & Required<Pick<In, K>>
  >;
  extend<U>(other: Schema<U>): Schema<In & U, In & U>;
}

interface SchemaQuery<T> {
  all(): Promise<T[]>;
  first(): Promise<T | null>;
  count(): Promise<number>;
  limit(n: number): SchemaQuery<T>;
  offset(n: number): SchemaQuery<T>;
  order(spec: string): SchemaQuery<T>;
}

interface ModelSchema<Instance, Data = unknown, Id = number, Create = Partial<Data>> extends Schema<Instance, Data> {
  find(id: Id): Promise<Instance | null>;
  findMany(ids: Id[]): Promise<Instance[]>;
  where(cond: Record<string, unknown> | string, ...params: unknown[]): SchemaQuery<Instance>;
  includes(...specs: unknown[]): SchemaQuery<Instance>;
  withDeleted(): SchemaQuery<Instance>;
  onlyDeleted(): SchemaQuery<Instance>;
  unscoped(): SchemaQuery<Instance>;
  all(limit?: number): Promise<Instance[]>;
  first(): Promise<Instance | null>;
  count(cond?: Record<string, unknown>): Promise<number>;
  create(data: Create): Promise<Instance>;
  upsert(data: Create, opts: { on: unknown }): Promise<Instance>;
  insertMany(rows: Create[]): Promise<Instance[]>;
  toSQL(options?: { dropFirst?: boolean; header?: string; idStart?: number }): string;
}

declare const schema: {
  transaction<T>(fn: () => T | Promise<T>): Promise<T>;
  transaction<T>(opts: Record<string, unknown>, fn: () => T | Promise<T>): Promise<T>;
};
```

You don't import these — they're injected automatically when the file
contains any schema declaration.

---

## 17. SchemaError and diagnostics

### `SchemaError`

Thrown by `.parse()` and `.save()` on validation failure. Carries
structured diagnostic information:

```coffee
try
  User.parse badInput
catch err
  err.name         # 'SchemaError'
  err.schemaName   # 'User'
  err.schemaKind   # 'model'
  err.issues       # [{field, error, message}, ...]
  err.message      # 'User: name is required; email must be email'
```

Each issue has three fields:

```ts
{
  field:   string    // field name, or '' for schema-wide issues
  error:   string    // 'required' | 'type' | 'min' | 'max' | 'pattern' | 'enum' | 'collision' | 'mixin-cycle' | 'mixin-collision' | 'mixin-missing' | ...
  message: string    // human-readable explanation
}
```

### Schema-mode-aware compile diagnostics

The schema sub-parser reports errors with context that makes mistakes
mechanical to fix:

```
Schema fields use 'name type' (space, no colon). For methods or computed
use 'name: -> body' or 'name: ~> body'.

Enum member must be a :symbol. Use ':admin' for a bare member or
':admin value' for a valued one.

:mixin schemas are fields-only. 'greet' is a method; move it to a :shape
or :model.

:shape schemas only accept '@mixin Name'. '@timestamps' is :model-only.

mixin cycle: A -> B -> A

Inline schema body does not support '->' (method/hook/transform).
Use the indented form.

Inline schema body is empty. Either add '; field; …' entries after
'schema :shape;' or switch to the indented form.

Schema pragma 'schema.defaultMaxString' must be declared at file top
level. It was found inside a nested block (function / class / if /
loop body), where it would leak into later top-level schemas.

Field 'n' would have impossible constraints min=1 > max=0 after sugar
is applied (implicit min=1 from `!` vs range max 0). Write an explicit
range or drop the conflicting pragma.
```

---

## 18. Common mistakes

These forms look right but don't work — the parser catches all of them
with specific diagnostics.

### `name: type` instead of `name type`

<!-- doctest: fail -->
```coffee
# wrong — fields use a space, not a colon, between name and type
X = schema
  name: string

# right
X = schema
  name! string
```

### Bare identifier enum members

<!-- doctest: fail -->
```coffee
# wrong — enum members are :symbol
R = schema :enum
  admin
  user

# right
R = schema
  :admin
  :user
```

### `name: value` as an enum member

<!-- doctest: fail -->
```coffee
# wrong — use :name value
R = schema :enum
  pending: 0

# right
R = schema
  :pending 0
```

### Methods in `:input` or `:mixin`

<!-- doctest: fail -->
```coffee
# wrong — :input is fields-only
X = schema :input
  name! string
  greet: -> "hi"

# right — use :shape (or :model) for behavior
X = schema :shape
  name! string
  greet: -> "hi"
```

### ORM directives on `:shape`

<!-- doctest: fail -->
```coffee
# wrong — @timestamps is :model-only
A = schema :shape
  street! string
  @timestamps

# right
A = schema :model
  street! string
  @timestamps
```

### Calling ORM methods on a derived shape

```coffee
UserPublic = User.pick "id", "name", "email"

# wrong — algebra returns :shape; :shape has no .find()
user = UserPublic.find! 1

# right — query the source model and project
user = User.find! 1
view = UserPublic.parse user.toJSON()
```

### Treating `.ok()` as a type predicate for shapes/models

```coffee
# wrong — .ok() doesn't produce a parsed value
if User.ok raw
  raw.name      # raw is still untyped — .ok is boolean only

# right
result = User.safe raw
if result.ok
  result.value.name    # typed

# or
user = User.parse raw  # throws on failure, returns typed value
```

Only `:enum` exposes `.ok(data): data is EnumType` as a sound type
predicate.

---

## 19. Recipes

### Validating HTTP input

```coffee
import { post, read } from '@rip-lang/server'

SignupInput = schema
  email!    email
  password! string, 8..100
  age?      integer, 18..120

post '/signup' ->
  raw = @json()                       # whatever shape the client sent
  result = SignupInput.safe raw
  unless result.ok
    return error! 400, errors: result.errors
  # result.value is the cleaned, typed payload
  db.users.insert result.value
  { ok: true }
```

### A DB-backed model with relations

```coffee
User = schema :model
  name!    string, 1..100
  email!#  email
  @timestamps
  @has_many Order

  beforeValidation: -> @email = @email.toLowerCase()

Order = schema :model
  total!  integer
  status  string, [:pending]
  @belongs_to User
  @timestamps

# Use:
user = User.create! name: "Alice", email: "ALICE@EXAMPLE.COM"
Order.create! user_id: user.id, total: 100
orders = user.orders!                    # [{total: 100, ...}]
owner  = orders[0].user!                 # the same user
```

### A shape with computed values

```coffee
Money = schema :shape
  amount!   integer
  currency! string, 3..3

  formatted: ~>
    symbol = {USD: "$", EUR: "€", JPY: "¥"}[@currency] ?? @currency
    "#{symbol}#{(@amount / 100).toFixed(2)}"

  add: (other) ->
    throw new Error "currency mismatch" unless @currency is other.currency
    Money.parse amount: @amount + other.amount, currency: @currency

a = Money.parse amount: 12345, currency: "USD"
a.formatted          # "$123.45"
b = a.add Money.parse amount: 99, currency: "USD"
b.formatted          # "$124.44"
```

### Sharing fields with a mixin

```coffee
Timestamps = schema :mixin
  createdAt! datetime
  updatedAt! datetime

User = schema :model
  name!  string
  email! email
  @mixin Timestamps

Post = schema :model
  title!   string
  body!    text
  @mixin Timestamps
  @belongs_to User
```

### Projecting a model to a wire view

```coffee
User = schema :model
  name!     string
  email!#   email
  password! string
  role?     string, [:user]
  @timestamps

# Wire projection — the shape clients receive, derived from the one model.
# Use `pick` (an allowlist): a field added to the model later can't leak to
# clients by default — `password` is simply never selected. Prefer this over
# `omit` for anything crossing a trust boundary; `omit` fails open.
UserPublic = User.pick "id", "name", "email", "role"

get '/users/:id' ->
  id = read 'id', 'id!'
  user = User.find! id
  return error! 404 unless user
  { user: UserPublic.parse user.toJSON() }
```

### Writing a migration script

```coffee
# scripts/migrate.rip
import { User, Order, OrderItem } from '../api/models.rip'
import { sql, setup } from '../api/db.rip'

setup!                                   # start DB if needed

# Emit DDL in dependency order
ddl = [
  User.toSQL()
  Order.toSQL()       # references User
  OrderItem.toSQL()   # references Order
].join('\n\n')

for stmt in ddl.split ';'
  stmt = stmt.trim()
  sql! stmt + ';' if stmt

p "[migrate] schema created"
```

Because `.toSQL()` doesn't call the adapter, migration scripts work
before the database exists or before the ORM is wired.

### Composing nested shapes

Small sub-shapes referenced by name compose into a larger contract.
Validation recurses into each referenced schema; errors carry
path-prefixed `field` entries so callers can pinpoint the failing
sub-field:

```coffee
Address = schema :shape
  street!   ..200
  city!     ..100
  state?    ..2
  zip?      ..10

Customer = schema :shape
  id?       integer
  name!     ..100
  address!  Address

OrderRequest = schema :shape
  customer! Customer
  notes?    ..500

r = OrderRequest.safe body
if r.ok
  process r.value
else
  for e in r.errors
    # e.g.  field: "customer.address.street"  error: "required"
    console.log e.field, e.error, e.message
```

Registered `:shape` / `:input` / `:model` names can all be referenced
as field types — see §22 for resolution rules.

---

## 20. What's not here yet

Rip Schema covers a large surface area with one keyword, but it deliberately
does not yet cover every feature you might find across the union of Zod,
Prisma, Drizzle, and the rest. These are intentional omissions — each one
has an open design question that hasn't been resolved in a way that fits the
language.

### Validator features not yet in

- **Union algebra** — `.pick`/`.omit`/etc. on a `:union` throws; the
  semantics (distribute? intersect?) have no obviously-right answer.
  Derive from a constituent instead.
- **Untagged unions** — deliberate non-goal: O(n) dispatch and
  incoherent error messages. Use `@on :field`.

### ORM features not yet in

- **FK-cluster rebuilds** — DuckDB freezes FK-referenced tables for most
  ALTERs; the differ classifies those steps `blocked` and leaves the
  rebuild (recreate referencing tables around the change) to the human.
  Generating the rebuild automatically is the next migration item.
- **Polymorphic associations** — `@belongs_to :commentable, polymorphic: true`.
- **Non-SQL adapters** — Mongo, Redis, Elasticsearch. The adapter contract
  is `query(sql, params)`, which assumes SQL.
- **Savepoint-backed nested transactions** — nested `transaction!`
  joins the outer transaction. DuckDB has no `SAVEPOINT`, so
  independent nested units aren't expressible on the primary backend.

### Type features not yet in

- **Generic schemas** — `Paginated<T> = schema :shape ...` parameterized
  by another schema. Today you define a concrete `PaginatedUser` per type.
- **Branded / nominal types** — `UserId = schema :input` whose parsed
  value is nominally distinct from `number`.

None of these are architectural impossibilities. Each is a conscious pause
while the core shape of the feature settles. If one of these is blocking
you, file a proposal — the sidecar design makes most of them additive.

---

# Part II — Reference

## 21. Capability matrix

What each kind's body can contain:

| Feature                                 | `:input` | `:shape` | `:enum`  | `:mixin` | `:model` |
| --------------------------------------- | -------- | -------- | -------- | -------- | -------- |
| Fields (`name` with optional type)      | ✓        | ✓        | —        | ✓        | ✓        |
| Literal-union type (`"a" \| "b"`)       | ✓        | ✓        | —        | ✓        | ✓        |
| Range / regex / default / attrs         | ✓        | ✓        | —        | ✓        | ✓        |
| Inline transforms (`name, -> fn(it)`)   | ✓        | ✓        | —        | —        | ✓        |
| `@mixin` directive                      | ✓        | ✓        | —        | ✓        | ✓        |
| `@ensure` refinement                    | ✓        | ✓        | —        | —        | ✓        |
| Other directives                        | —        | —        | —        | —        | ✓        |
| Methods (`name: -> body`)               | —        | ✓        | —        | —        | ✓        |
| Computed getter (`name: ~> body`)       | —        | ✓        | —        | —        | ✓        |
| Eager-derived field (`name: !> body`)   | —        | ✓        | —        | —        | ✓        |
| Hooks (by known name)                   | —        | methods  | —        | —        | ✓        |
| Enum members (`:symbol`)                | —        | —        | ✓        | —        | —        |
| Algebra (`.pick` etc.)                  | ✓ → shape | ✓ → shape | —       | —        | ✓ → shape |
| ORM (`.find`, `.create`)                | —        | —        | —        | —        | ✓        |
| `.parse` / `.safe` / `.ok`              | ✓        | ✓        | ✓        | —        | ✓        |
| `.toSQL()`                              | —        | —        | —        | —        | ✓        |

"methods" in the `:shape` / Hooks row means: hook-named functions are
accepted, but they're just methods with no lifecycle binding.

`:union` is body-incompatible with everything above — its body is
exactly one `@on :field` plus 2+ bare constituent names. It exposes
`.parse` / `.safe` / `.ok` (and the async trio) by delegating to the
matched constituent; algebra and ORM surface throw.

---

## 22. Field types

Built-in type names and their runtime / SQL / TypeScript mappings:

| Rip type   | Validator                            | SQL         | TypeScript |
| ---------- | ------------------------------------ | ----------- | ---------- |
| `string`   | `typeof v === 'string'`              | `VARCHAR`   | `string`   |
| `text`     | `typeof v === 'string'`              | `TEXT`      | `string`   |
| `email`    | string + `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | `VARCHAR` | `string` |
| `url`      | string + `/^https?:\/\/.+/`          | `VARCHAR`   | `string`   |
| `uuid`     | string + UUID regex                  | `UUID`      | `string`   |
| `phone`    | string + `/^[\d\s\-+()]+$/`          | `VARCHAR`   | `string`   |
| `zip`      | string + `/^\d{5}(-\d{4})?$/` (US)   | `VARCHAR`   | `string`   |
| `number`   | `typeof v === 'number'` and not NaN  | `DOUBLE`    | `number`   |
| `integer`  | `Number.isInteger(v)`                | `INTEGER`   | `number`   |
| `boolean`  | `typeof v === 'boolean'`             | `BOOLEAN`   | `boolean`  |
| `date`     | `Date` instance                      | `DATE`      | `Date`     |
| `datetime` | `Date` instance                      | `TIMESTAMP` | `Date`     |
| `json`     | not undefined                        | `JSON`      | `unknown`  |
| `any`      | always true                          | `JSON`      | `any`      |

Arrays: `type[]`. SQL stores as `JSON` (DuckDB native), TS is `T[]`.

**Nested-schema identifiers.** A field's type name may be another
schema declared with `:shape`, `:input`, or `:model`. When the name
resolves to one of those in the process-global `__SchemaRegistry`,
the validator recurses into the referenced schema:

```coffee
Address = schema :shape
  street?  ..200
  city?    ..100

User = schema :shape
  name!      ..50
  address!   Address          # per-field validation recurses into Address
  mailing?   Address          # optional; skipped if missing, validated if present

Order = schema :shape
  items!     OrderItem[]      # arrays of schema-typed values validate each element
```

Errors from the nested validator surface with path-prefixed `field`
entries on the parent's issue list (`address.street`,
`items[0].name`, `items[3].price`, etc.). Validation recurses as
deep as the registry resolution allows — three-level nesting is
tested, deeper nesting is bounded only by the data itself.

The resolver is lazy — it runs at `.parse()` time, not at
declaration, so forward references between modules resolve as long
as both are loaded before the first validation call.

**Unknown identifiers.** If a type name isn't a built-in *and* isn't
in the registry at validation time, the field is accepted without a
runtime check (SQL defaults to `JSON`, TS uses the identifier
as-is). This keeps forward references from hard-failing and lets
user-defined enums or shapes compose incrementally.

---

## 23. Directives

### For any fielded kind

| Directive       | Effect                                                            |
| --------------- | ----------------------------------------------------------------- |
| `@mixin Name`   | Pull in the fields of mixin `Name` at Layer 2 normalization       |
| `@ensure "msg"[, :field], (x) -> pred` | Cross-field refinement, optionally attributed to a field — see [§5](#refinement-ensure). Allowed on `:input` / `:shape` / `:model`; rejected on `:enum` / `:mixin`. |
| `@ensure! "msg"[, :field], (x) -> pred` | ASYNC refinement — the schema becomes async-validating (`parseAsync!` / `safeAsync!` / `okAsync!`) |

### `:union`-only

| Directive   | Effect                                                          |
| ----------- | --------------------------------------------------------------- |
| `@on :field` | Names the discriminator field (required, exactly once). Constituents follow as bare schema names, one per line |

### `:model`-only

| Directive                     | Effect                                                              |
| ----------------------------- | ------------------------------------------------------------------- |
| `@timestamps`                 | Adds `created_at` + `updated_at` columns with `CURRENT_TIMESTAMP` defaults |
| `@softDelete`                 | Adds `deleted_at` column; `.destroy()` sets `deleted_at = now()` instead of DELETE. Queries (`find`, `where`, `all`, `first`, `count`) implicitly filter `deleted_at IS NULL`; escape hatches: `.withDeleted()`, `.onlyDeleted()`, `inst.restore!`, `inst.destroy! hard: true` |
| `@index [a, b, c]`            | Composite index on the listed columns                               |
| `@index column`               | Single-column index (same as `@index [column]`)                     |
| `@index [...] #`              | Unique index                                                        |
| `@idStart N`                  | Seed value for the auto-id sequence in `.toSQL()` output (default `1`). Overridden per-call by `toSQL(idStart: N)`. |
| `@scope :name, -> body`       | Named composable query scope — `this` is the builder; also `@scope :name, (args) -> body`. Installed on the model and the builder |
| `@defaultScope -> body`       | Applied to every query unless `.unscoped()` is called. At most one per model |
| `@tableWas old_name`          | Table-rename annotation for the schema differ — `rip schema make` emits `RENAME TO` instead of `DROP + CREATE`. Removable once the migration lands |
| `@belongs_to Target`          | FK column `target_id` referencing `targets.id`, NOT NULL            |
| `@belongs_to Target?`         | Same, nullable                                                      |
| `@has_one Target`             | Accessor `target()` returning one                                   |
| `@has_many Target`            | Accessor `targets()` returning array                                |

---

## 24. Hook reference

Twelve recognized hook names. On `:model` they bind into the lifecycle;
on other kinds they're plain methods.

| Hook name          | When it runs                                             |
| ------------------ | -------------------------------------------------------- |
| `beforeValidation` | Before field validation                                  |
| `afterValidation`  | After successful validation                              |
| `beforeSave`       | Before INSERT or UPDATE (only on valid data)             |
| `beforeCreate`     | Before INSERT only                                       |
| `afterCreate`      | After successful INSERT                                  |
| `beforeUpdate`     | Before UPDATE only                                       |
| `afterUpdate`      | After successful UPDATE                                  |
| `afterSave`        | After INSERT or UPDATE                                   |
| `beforeDestroy`    | Before DELETE (or soft-delete UPDATE)                    |
| `afterDestroy`     | After DELETE                                             |
| `afterCommit`      | After the outermost transaction commits — or immediately after save/destroy when no transaction is open |
| `afterRollback`    | After rollback, for each instance saved/destroyed inside the rolled-back transaction |

Throwing from any hook aborts the operation and the exception propagates
to the caller.

---

## 25. Constraints

Each constraint on a field line is self-identifying by its token
shape. Multiple constraints combine on one field, separated by commas:

<!-- doctest: skip -->
```coffee
name[!|?|#]  [type]  [constraint]  [constraint]  …
```

### The forms

The **type** slot accepts an identifier (`string`, `email`, etc.) or
a string-literal union; the **constraint** forms live after the type:

| Form                 | Slot       | Meaning                                                |
| -------------------- | ---------- | ------------------------------------------------------ |
| `"a" \| "b" \| …`    | type       | String-literal union (value must be one of the listed members) |
| `min..max`           | constraint | Size (string/array length) or value range (numeric)    |
| `[value]`            | constraint | Default value (single literal in brackets)             |
| `/regex/`            | constraint | Pattern constraint (bare regex literal)                |
| `{key: value}`       | constraint | Attrs. Known keys: `{was: "old_name"}` — column-rename annotation for the schema differ |

```coffee
Example = schema
  password!  string, 8..100                     # length range
  age?       integer, 0..120                    # value range
  role?      string, ["guest"]                  # default
  zip!       string, /^\d{5}$/                  # regex pattern
  status?    string, 3..20, ["pending"]         # range AND default
  sex?       "M" | "F" | "U"                    # literal union
  phase?     "draft" | "active" | "done", [:draft]  # union + default
```

### Range semantics by field type

| Field type                 | `min..max` means  |
| -------------------------- | ----------------- |
| `string` / `text` / formatted-string types | string length   |
| `integer` / `number`       | numeric value     |
| `array` (`T[]`)            | array length      |
| `date` / `datetime` / `boolean` | compile error — ranges don't apply |
| literal union (`"a" \| "b"`) | compile error — membership is the bound |

### Exactly-N

Use `n..n` for "exactly N":

```coffee
Fixed = schema
  sex?    1..1                     # single-character sex code
  npi!    10..10                   # NPI is exactly 10 digits
  code!   6..6                     # fixed-length code
```

Reads as "between N and N" which collapses to "exactly N."

### Open-ended ranges

Either endpoint may be omitted. The implicit meaning depends on the
modifier:

| Form       | Modifier | Meaning                                                |
| ---------- | -------- | ------------------------------------------------------ |
| `..N`      | `?`      | at most N, no minimum (empty string / negative OK)     |
| `..N`      | `!`      | at most N, **implicit `min=1`** — required AND non-empty |
| `N..`      | any      | at least N, no maximum (the file-level `schema.defaultMaxString` pragma fills it if set) |
| `..`       | —        | rejected — at least one endpoint must be present       |

The `!` + `..N` rule exists because required fields with `..N`
almost universally want `1..N` in practice (100% of required ranges
in production code today). Writing `..N` instead of `1..N` drops the
redundant `1` that the `!` modifier already implies:

```coffee
# These pairs mean the same thing:
Explicit = schema
  firstName!  1..50
  name!       1..100
  email!      1..320
Sugar = schema
  firstName!  ..50
  name!       ..100
  email!      ..320

# But an explicit min always wins:
Zeroes = schema
  admin!      0..50            # explicit min=0 stays (rare: required but empty allowed)
  age!        0..120           # explicit min=0 stays (newborns are zero)
  score!      0..100           # explicit min=0 stays (test score can be zero)
```

If the sugar would produce an impossible constraint (`! ..0` →
`{min:1, max:0}`), the compiler rejects it at parse time with an
error naming the conflicting sources.

Optional (`?`) fields with `..N` are a mirror-image rule: `..20`
means "no minimum" rather than implicit-zero, so the `?` case stays
open for integers (allows negatives) and strings (allows empty).
When an optional field must also be non-empty when present, write
the min explicitly: `phone? 1..20`.

### Literal values in the default bracket

The bracket `[…]` now holds a single value — the default. Values are
evaluated at compile time and must be literals:

- Numbers (including negative: `-10`)
- Strings (`"text"`)
- Booleans (`true`, `false`)
- `null`, `undefined`
- `:symbol` (compiles to the symbol's name as a string — useful for
  enum defaults: `[:draft]` ≡ `["draft"]`)

Arbitrary expressions, identifier references, and function calls are
rejected at parse time with a clear error.

### Multi-line constraint lists

Trailing comma + indent continues the line:

```coffee
Account = schema
  password! string,
    8..100,
    /[A-Z]/
```

This is the same rule Rip applies to any trailing-comma continuation.

### Migration from v1

Three bracket forms are retired in v2 in favor of shape-identifying
constraint forms. The compiler emits a migration diagnostic pointing
at the exact replacement:

```
name! string, [8, 100]          → name! string, 8..100
name! string, [8, 100, 42]      → name! string, 8..100, [42]
zip!  string, [/^\d{5}$/]       → zip!  string, /^\d{5}$/
```

The single-value form `[a]` (default) is unchanged.

### File-level pragma: `schema.defaultMaxString`

A defensive ceiling on every VARCHAR-like field in the file. Fills
in `max` for fields that the user otherwise left unbounded:

```coffee
schema.defaultMaxString = 500

User = schema :model
  name!                         # → {min: 1, max: 500}  (sugar + pragma)
  email!#    email              # → {max: 500}
  code?                         # → {max: 500}
  password!  8..200             # → {min: 8, max: 200}  (explicit wins)
  bio?       text               # → no constraint       (text opts out)
  zip!       /^\d{5}$/          # → {regex: /^\d{5}$/}  (regex opts out)
  status?    "on" | "off"       # → literal union       (union opts out)
```

**Scope and semantics:**

- **Top-level only.** Declaring the pragma inside a function / class
  / `if` / loop body is a compile error — the rule has to be
  syntactically anchored to the file so it can't leak between
  scopes.
- **Per-declaration snapshot.** Each schema captures the pragma
  value in effect at *its* declaration. Later pragma writes don't
  retroactively alter earlier schemas.
- **Applies only to VARCHAR-like primitives** — `string`, `email`,
  `url`, `phone`, `zip` (and bare fields, which default to
  `string`). `text` stays uncapped by design (it's the opt-out for
  long-form content). `integer`, `number`, `boolean`, `date`,
  `datetime`, `uuid`, `json`, `any` are all untouched.
- **User's explicit constraints always win.** An explicit range,
  regex, or literal-union on the field suppresses the pragma's
  max. Open-ended `N..` fields are the one composition case — the
  user's min is preserved and the pragma fills the open max.
- **`0` resets the pragma.** Useful for turning it off again mid-file.

**Valid values:** non-negative integer literals. Decimals, strings,
negatives, and unknown keys are all hard-fail compile errors with
specific diagnostics.

The pragma is the first of a family — the scanner accepts `schema.<key>`
generally and errors on unknown keys, so future ceilings (a
`defaultMaxInt`, an `defaultStringType`, etc.) can land additively
without changing the scanner shape.

---

## 26. Relations

### Directive → accessor → return type

| Directive                   | Accessor name         | Returns                                  |
| --------------------------- | --------------------- | ---------------------------------------- |
| `@belongs_to User`          | `user()`              | `Promise<User \| null>`          |
| `@belongs_to User?`         | `user()`              | `Promise<User \| null>` + nullable FK |
| `@has_one Profile`          | `profile()`           | `Promise<Profile \| null>`       |
| `@has_many Order`           | `orders()`            | `Promise<Order[]>`               |

Accessor names:

- `belongs_to` / `has_one` use the target's name with a lowercase first
  letter (`User` → `user`, `UserProfile` → `userProfile`).
- `has_many` pluralizes the lowercase-first-letter form (`Order` →
  `orders`, `Category` → `categories`).

### FK columns

- `@belongs_to User` emits `user_id INTEGER NOT NULL REFERENCES users(id)`
- `@belongs_to User?` emits `user_id INTEGER REFERENCES users(id)` (nullable)

### Resolution

Targets resolve lazily through `__SchemaRegistry`. A target is looked up
by bare name when the accessor is first called — imports into the module
that declares the target (or the model file itself) are enough to make
resolution succeed. Unresolved targets throw a runtime error with the
name and the caller's schema name included.

### Memoization

Accessor results memoize per instance: the second `user.orders!` call
resolves from cache with no query. Eager loading (`.includes`) fills
the same memo, which is why preloaded relations are free. Pass
`{reload: true}` to bust the memo and re-query.

---

## 27. Design invariants

Twelve rules that define how Rip Schema behaves. Worth keeping in mind
when debugging or extending:

1. **Default kind is `:input`.** `schema` with no marker and a
   field-shaped body gets the most common validation case with no
   ceremony.
2. **Fields use `name type`, not `name: type`.** The colon is reserved
   for methods, computed, and eager-derived. Using the colon form
   produces a compile error pointing at the right syntax.
3. **`:shape` has no lifecycle.** Hook names on `:shape` are methods —
   no binding. Lifecycle is a `:model` concern because it's coupled to
   persistence.
4. **Algebra on `:model` returns `:shape`.** ORM methods are stripped.
   Invariant 1 of the algebra section.
5. **Algebra drops instance behavior but preserves field semantics.**
   Methods, computed getters (`~>`), eager-derived fields (`!>`),
   hooks, and `@ensure` refinements are dropped by
   `.pick/.omit/.partial/.required/.extend`. Fields and their metadata
   — including **inline transforms** — carry through. The transform
   describes how a field's value is obtained from raw input; it's a
   property of the field, not the instance.
6. **`:mixin` is non-instantiable.** Mixins declare fields for reuse —
   they don't have a runtime identity of their own.
7. **Schema names are global, and collisions fail loudly.** Relations
   and `@mixin` references resolve by bare name through a
   process-global registry. Registering a name that already exists
   with a *different* definition throws at registration time;
   structurally identical re-registration (the same module arriving
   twice) rebinds silently. `__SchemaRegistry.replace = true` restores
   last-loaded-wins for dev/HMR reload; `__SchemaRegistry.scope(fn)`
   runs `fn` against a fresh registry and restores the parent (test
   isolation).
8. **Default field type is `string`.** Omitting the type slot is
   legal; `name!` means "required string". Explicit types
   (`integer`, `email`, `"M" | "F"`, etc.) are needed only when
   string isn't what you want.
9. **Transforms are terminal on the field line.** `-> body` must be
   the last element; nothing follows it. The comma before `->` is
   required whenever anything precedes it (type, range, regex,
   default, attrs) — only the bare form `name! -> body` is
   comma-less, because there's nothing to elide.
10. **Transforms run on `.parse()` only, never on hydrate.** DB rows
    arrive canonical; re-running a transform on hydrate would
    double-coerce. Eager-derived (`!>`) is the opposite — it runs on
    parse AND hydrate so instances loaded from the DB have the same
    shape as parsed ones.
11. **Eager-derived fields are materialized once, not reactive.** `!>`
    fires at construction time (parse or hydrate) and stores the
    result as an own enumerable property. Mutating a dependency
    afterward does **not** update the derived value — it stays stale
    by design. Use `~>` for always-current derivations.
12. **Refinements are schema-level, not field-level.** `@ensure`
    predicates run after per-field validation succeeds, once per
    parse, against the whole defaulted and typed object. They fail
    with a declared message that ships verbatim to the caller;
    thrown exceptions inside a predicate count as failure, not
    error. Refinements are skipped on DB hydrate (trusted data)
    and dropped by every algebra op (structural derivation never
    carries non-structural invariants).

---

# Part III — Architecture

## 28. Runtime architecture

Each schema goes through four layers. Each layer is built lazily on first
need, and the caches are independent.

### The canonical field parse pipeline

`.parse()` applies each declared field's value through a fixed sequence.
Knowing the order makes the difference between transform-before-default
(correct) and transform-after-default (surprising) predictable:

```text
For each declared field, in order:
  1. Obtain raw candidate
     — transform(raw) if declared, else raw[fieldName]
  2. Apply default if the candidate is missing/undefined
  3. Required / optional / nullability check
  4. Validate per declared type
     — literal-union membership, primitive type, array
  5. Apply range / regex / attrs constraints
  6. Assign as own enumerable property on the instance

After all declared fields:
  7. Run `@ensure` refinements in declaration order
     — reads the fully-typed, defaulted working object; every
       refinement runs (no short-circuit); failures collect as
       {field: '', error: 'ensure', message} issues; if any
       fail, .parse() throws SchemaError, .safe() returns
       {ok: false, errors}, and .ok() returns false
       (steps 8+ do not run)
  8. Run `!>` eager-derived entries in declaration order
     — reads the now-populated instance; results land as own
       enumerable properties; earlier `!>` values are readable
       by later ones, forward references are not
```

The `_hydrate` path (used by `.find`, `.where`, etc.) **skips step 1's
transform, step 2's default, steps 3–5, and step 7's refinements** —
DB rows are trusted. It still runs step 8 so eager-derived fields
appear on hydrated instances just as they do on parsed ones.

### Value mutation after parse

Mutating a field after parse **does not re-run `!>` entries** — they
were materialized at parse time. Lazy computed (`~>`) values do reflect
the current state on every access. This distinction is the key
difference between the two arrows; see §5 for the side-by-side
comparison.


### Layer 1 — Descriptor

The object passed to `__schema({...})` at module load. Pure metadata plus
real inlined functions for methods, computed, and hooks. Cheap to build
— no validation, no registry lookups, no class generation.

```js
__schema({
  kind: "model",
  name: "User",
  entries: [
    { tag: "field", name: "email", modifiers: ["!", "#"], typeName: "email", array: false },
    { tag: "directive", name: "timestamps" },
    { tag: "computed", name: "identifier", fn: function() { return `${this.name} <${this.email}>`; } },
    { tag: "hook", name: "beforeSave", fn: function() { this.email = this.email.toLowerCase(); } },
  ],
});
```

### Layer 2 — Normalized metadata

Built once per schema on first downstream need. Produces:

- a `fields` Map (field name → {required, unique, typeName, array, constraints})
- a `methods` Map, `computed` Map, `hooks` Map
- expanded mixin fields (depth-first, diamond-deduped)
- resolved relations with accessor names and FK column names
- table name (for `:model`)
- namespace-collision enforcement across fields, methods, computed,
  hooks, relation accessors, and reserved ORM names

This is the shared pre-stage for the three downstream plans.

### Layer 3 — Validator plan

Built on first `.parse/.safe/.ok` call. Compiled validator tree plus (for
`:shape` / `:model`) the generated class constructor. Type-check
functions, constraint-check functions, required-field checks, array-item
walks, and enum-membership checks are all bound into tight closures at
this layer.

### Layer 4a — ORM plan

Built on first `.find/.create/.save/.destroy/.where` call on a `:model`.
Wires:

- the query builder
- save / destroy flows (including hook lifecycle)
- relation accessors on the generated class
- instance methods (`save`, `destroy`, `ok`, `errors`, `toJSON`)

Requires a configured adapter before first use.

### Layer 4b — DDL plan

Built on first `.toSQL()` call. Emits the `CREATE SEQUENCE` /
`CREATE TABLE` / indexes + foreign keys for one model. Independent of
Layer 4a — a migration script that never touches the ORM builds this
layer only.

### Lazy is the point

Module load does Layer 1 only. An `:input` schema used just for
`.parse()` never builds Layer 4. A migration script that only calls
`.toSQL()` never builds Layer 3 or 4a. A `:model` used only from the
API layer never builds Layer 4b. The four caches never share work they
don't have to.

### The registry

`__SchemaRegistry` holds every named `:model` and `:mixin` by bare name.
Registration happens in the `__SchemaDef` constructor — *importing a
file that declares named schemas activates them*. Tests can call
`__SchemaRegistry.reset()` between runs to avoid cross-test leakage.

### The adapter

One function: `adapter.query(sql, params) → {columns, data, rows}`. The
default adapter talks to rip-db via `fetch`. Custom adapters (for
tests, in-memory mocks, alternate SQL backends) install with
`globalThis.__ripSchema.__schemaSetAdapter`. Every ORM method funnels
through this interface.

---

## 29. Compiler integration

The schema keyword is implemented as a compiler sidecar in
`src/schema/schema.js`, alongside the existing type and component sidecars.
This isolates the feature from the rest of the compiler: the main Rip
grammar has two productions for the schema keyword (not hundreds), and
the schema-specific body syntax never reaches the main parser.

### Lexer path

`installSchemaSupport(Lexer, CodeEmitter)` adds `rewriteSchema()` to the
lexer prototype. It runs between `rewriteRender()` and `rewriteTypes()`
in the rewriter pipeline.

`rewriteSchema()` recognizes a contextual `schema` identifier at
expression-start positions followed by either a `:kind` SYMBOL or a
direct INDENT. The matching `INDENT ... OUTDENT` range is parsed by a
schema-specific sub-parser and collapsed into a single `SCHEMA_BODY`
token whose `.data` carries a structured descriptor (kind, entries,
per-entry `.loc`).

### Grammar

The main grammar has one production for the feature:

```
Schema: SCHEMA SCHEMA_BODY
```

…under `Expression`. Schema body syntax (`name! type`, `@directive`,
`name: ~> body`, `name: -> body`) never reaches the main parser. The
state table stays lean.

### Body-token reparse

Bodies of methods, computed getters, and hooks are captured as token
slices by the sub-parser. At codegen time those slices:

1. run through the tail rewriter passes (implicit braces, tagged
   templates, implicit call commas, etc.)
2. feed into the main `parser.parse()` via a temporary lex adapter
3. emerge as a normal Rip AST
4. wrap in a thin-arrow AST (`['->', [], body]`)
5. emit via the existing `emitThinArrow` path

Rip `->` already emits `function() {...}` (not JS arrow), so `this`
binds to the instance correctly without special codegen.

### Where things live

| File                 | Role                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `src/schema/schema.js`      | Sub-parser, `emitSchema`, Layer 1-4 runtime, shadow TS walker, `installSchemaSupport` |
| `src/lexer.js`       | Hook point — calls `rewriteSchema()`; comment-token fix for `#` modifier |
| `src/grammar/grammar.rip` | The one `Schema` production                                  |
| `src/compiler.js`    | Dispatch for the `schema` s-expression head; preamble injection    |
| `src/types.js`       | Calls `emitSchemaTypes()` during `.d.ts` emission                  |
| `src/typecheck.js`   | `hasSchemas()` probe so schema-only files aren't `@ts-nocheck`d     |
| `test/rip/schema.rip` | The test suite                                                    |

The total wiring in the core compiler (outside `src/schema/schema.js`) is under
100 lines. That's the sidecar pattern working — the feature is big, but
its footprint in the main compiler is small.

---

## 30. FAQ

**Why not just use Zod?**
Zod gives you the validator. It doesn't give you the ORM, the DDL, the
class, the computed getters, or the derived DTOs. Rip Schema is all of
that from one declaration. If you only need the validator, `schema :input`
is the equivalent surface — and the derived shadow TS is indistinguishable
from `z.infer<>`.

**Is this a full ORM replacement for Prisma / Drizzle?**
For the common production shape — yes. `find`, `where`, `create`,
`save`, `destroy`, relations, DDL, hooks, lifecycle callbacks,
validations, transactions (`schema.transaction!`), eager loading
(`.includes`), query scopes (`@scope` / `@defaultScope`), soft deletes,
upsert/batch writes, and structured constraint-violation errors are all
present. For migration diffing — not yet; see §20.

**Does the runtime belong to `schema.js` or is it loaded separately?**
It's inlined. When a file uses `schema`, the compiler injects a small
preamble (under `SCHEMA_RUNTIME` in `src/schema/schema.js`) that defines
`SchemaError`, `__SchemaDef`, `__SchemaRegistry`, `Query`, and the
helpers. No import statement, no package dependency, no bootstrap call.

**How big is the runtime?**
It includes the validator plan, registry, hydration logic, ORM
support, and DDL emission. In multi-bundle processes, Rip binds
`schema` to a shared `globalThis.__ripSchema` singleton, so bundles
share one registry and one adapter per process.

**Is `.parse()` strict or permissive with extra keys?**
Permissive with stripping. Unknown keys are silently dropped — they
don't appear on the returned value or instance, and they don't cause a
validation error. This matches the invariant that `.parse()` returns
clean data shaped only by the declared fields. If you need hard
rejection of unexpected keys, check `Object.keys(input)` against
`Object.keys(Schema.parse(input))` yourself.

**Can I use a schema from TypeScript?**
Not yet directly — Rip emits shadow `.d.ts` for editor support, but a
separate `.ts` consumer doesn't see those. Exporting from `.rip` and
importing the result into `.ts` works: you get the runtime object; you
lose the algebra-level generic inference. This is on the roadmap.

**What happens when the adapter isn't configured?**
ORM methods throw a `SchemaError` with a clear "no adapter configured"
message. Validation (`.parse`, `.safe`, `.ok`) and DDL (`.toSQL`) work
without an adapter.

**Does `:model` require a database?**
No. `:model` works as a standalone class-with-validation. If you never
call an ORM method, no adapter is invoked. DDL emission is a pure
function of the schema definition.

**What's the relationship between `enum` and `schema :enum`?**
The keyword `enum` is a compile-time-only declaration — it exists in the
type system and disappears from JS. `schema :enum` exists at runtime —
you can call `.parse()` on it, iterate its members, and use it as a
field type. Use `enum` when you only need the static type; use
`schema :enum` when runtime membership matters.

**Can algebra operations (`.pick` / `.omit`) be chained?**
Yes. They compose: `User.omit("password").pick("name", "email").partial()`
produces a `:shape` with the intersection of the three operations.

**How do I express cross-field rules — "passwords must match", "end after start"?**
Use `@ensure`. See [§5](#refinement-ensure) and the summary in [§27](#27-design-invariants)
invariant 12. Messages are required, predicates are plain Rip fns,
thrown exceptions count as failure, and all refinements run every time
(no short-circuit between refinements).

**Can I put `@ensure` on a `:mixin` so it travels with the mixin's fields?**
No. `:mixin` is fields-only, by design. Refinements attach to the host
schema because they describe invariants on the whole parsed object,
and a mixin doesn't have a "whole object" of its own — it's a pile of
fields that get merged into the host. Put the refinement on the host
where the invariant has meaning.

**What does `:shape` have that a plain JS class doesn't?**
Runtime validation on construction. Computed getters automatically
typed in shadow TS. Fields are enumerable own properties (so `JSON.stringify`
works cleanly). Methods and computed getters live on the prototype (so
they don't pollute iteration). Algebra methods (`.pick`, `.omit`, etc.)
that derive new schemas. And the whole thing is one declaration.

**If I find a bug, what's authoritative — the docs or the compiler?**
The compiler. This document describes current behavior; when they
diverge, the compiler wins and the docs get fixed. File a diagnostic.

---

Schemas live at the core of almost every program. In Rip, one keyword
handles that core. Write the shape once, and the language does the rest.
