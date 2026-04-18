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
  name!   string, [1, 100]
  email!# email
  @timestamps
  @has_many Order
  identifier:       ~> "#{@name} <#{@email}>"
  beforeValidation: -> @email = @email.toLowerCase()
```

From that single line of source, the language gives you:

- a **runtime validator** — `User.parse(data)` / `.safe()` / `.ok()`
- a **generated class** with your methods and `~>` computed getters bound as prototype getters
- a **TypeScript type** — `ModelSchema<UserInstance, UserData>`, automatic, no codegen step
- an **async ORM** — `User.find! 1`, `User.where(active: true).all!`, `user.save!`
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
4. [The five kinds](#4-the-five-kinds)
5. [Body syntax](#5-body-syntax)
6. [The runtime API](#6-the-runtime-api)
7. [What `.parse()` returns by kind](#7-what-parse-returns-by-kind)
8. [`:model` — ORM, DDL, hooks, relations](#8-model--orm-ddl-hooks-relations)
9. [Mixins](#9-mixins)
10. [Schema algebra](#10-schema-algebra)
11. [Shadow TypeScript](#11-shadow-typescript)
12. [SchemaError and diagnostics](#12-schemaerror-and-diagnostics)
13. [Common mistakes](#13-common-mistakes)
14. [Recipes](#14-recipes)
15. [What's not here yet](#15-whats-not-here-yet)

## Part II — Reference
16. [Capability matrix](#16-capability-matrix)
17. [Field types](#17-field-types)
18. [Directives](#18-directives)
19. [Hook reference](#19-hook-reference)
20. [Constraints](#20-constraints)
21. [Relations](#21-relations)
22. [Design invariants](#22-design-invariants)

## Part III — Architecture
23. [Runtime architecture](#23-runtime-architecture)
24. [Compiler integration](#24-compiler-integration)
25. [FAQ](#25-faq)

---

# Part I — Using Rip Schema

## 1. What Rip Schema is

A *schema* in Rip is a runtime value that describes data. You create one with
the `schema` keyword and an optional `:kind` symbol:

```coffee
SignupInput = schema             # default :input
Role        = schema :enum
User        = schema :model
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
| Migrations / DDL            | Prisma migrate, Drizzle Kit, knex   | `Model.toSQL()`                      |
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
  password! string, [8, 100]
  age?      integer, [18, 120]

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
  street! string, [1, 200]
  city!   string
  state!  string, [2, 2]
  zip!    string, [/^\d{5}$/]

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
  name!    string, [1, 100]
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
AdminUser  = User.extend schema :shape
  permissions! string[]
```

Derived schemas are always `:shape`. Fields survive. Methods, computed
getters, hooks, and ORM methods are dropped — algebra is a structural
operation, not a behavioral one.

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

## 4. The five kinds

Every schema has one of five kinds, selected by a `:symbol` after the
`schema` keyword:

```coffee
input  = schema                # default — :input
shape  = schema :shape
enum   = schema :enum
mixin  = schema :mixin
model  = schema :model
```

The kind determines which body forms are legal, what `.parse()` returns,
and whether ORM / DDL surface is active.

### `:input`

A field validator. Body allows fields and `@mixin` only. `.parse(data)`
returns a plain validated object. No behavior, no persistence.

```coffee
SignupInput = schema
  email!    email
  password! string, [8, 100]
```

### `:shape`

A validator with behavior. Body allows fields, methods (`-> body`),
computed getters (`~> body`), and `@mixin`. `.parse(data)` returns a class
instance — declared fields are enumerable own properties, methods live on
the prototype, computed getters are non-enumerable prototype getters.

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

### `:model`

A DB-backed entity. Everything `:shape` offers, plus: relations,
lifecycle hooks, the full ORM surface (`find`, `where`, `create`, `save`,
`destroy`, `toSQL`), and a process-global registry entry.

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

```coffee
name[!|?|#]*  type  [, constraints]  [, attrs]
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

Types are a single identifier (optionally followed by `[]` for arrays):

```coffee
name!      string                 # required string
tags!      string[]               # required array of strings
email!#    email                  # required, unique, email-format-validated
bio?       text, [0, 1000]        # optional text, 0-1000 chars
role?      string, ["user"]       # optional, default "user"
status     string, [:draft]       # default :draft — same as ["draft"]
zip!       string, [/^\d{5}$/]    # regex-validated
```

### Directive

```coffee
@name  [args]
```

Directives attach behavior that isn't a field. The set depends on the
kind (see [§18](#18-directives)). Examples:

```coffee
@timestamps                       # adds createdAt/updatedAt columns (:model only)
@softDelete                       # adds deletedAt, soft-deletes on .destroy() (:model only)
@index [role, active]             # composite index (:model only)
@belongs_to Organization?         # nullable FK (:model only)
@has_many Order                   # has-many relation (:model only)
@mixin Timestamps                 # pull in a mixin's fields (any fielded kind)
```

### Method

```coffee
name: -> body
```

Thin-arrow method bound on the generated class prototype. `this` is the
instance. For `:model`, method names matching known [hook
names](#19-hook-reference) bind to the lifecycle; on other kinds those
names are just methods.

```coffee
greet: -> "Hello, #{@name}!"

beforeSave: ->
  @email = @email.toLowerCase()
  @slug  = @name.toLowerCase().replace(/\s+/g, '-')
```

### Computed getter

```coffee
name: ~> body
```

Reactive-style arrow, emitted as a prototype getter via
`Object.defineProperty(proto, name, {get: fn})`. Called on read, not
stored. Excluded from DDL and persistence.

```coffee
full:       ~> "#{@street}, #{@city}"
identifier: ~> "#{@name} <#{@email}>"
isAdmin:    ~> @role is 'admin'
```

### Rules to remember

- Fields use `name type` — **no colon**. `name: type` is a compile error.
- Methods and computed both use `name:` — the colon before the arrow is how
  you distinguish them from fields.
- `~>` produces a getter. `->` produces a method.
- A body cannot contain arbitrary statements — only the four forms above
  (plus enum members in `:enum`).
- The grammar is whitespace-sensitive: indentation opens the body, dedent
  closes it, trailing comma + indent continues a field line onto the next.

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
if User.ok raw
  # ...
```

### Async variants (`parse!`, `safe!`, `ok!`)

Every method has a dammit-operator variant that awaits the result. For
`:input`/`:shape`/`:enum` these are sync, so `!` is a no-op (harmless).
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

## 8. `:model` — ORM, DDL, hooks, relations

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
User.find! id                            # → UserInstance | null
User.findMany! [1, 2, 3]                 # → UserInstance[]
User.where(active: true).all!            # → UserInstance[]
User.where(active: true).first!          # → UserInstance | null
User.where(active: true).count!          # → number
User.all!                                # → UserInstance[]
User.first!                              # → UserInstance | null
User.count!                              # → number
User.create! name: "Alice", email: "a@b.c"
User.toSQL()                             # → DDL string (no DB call)
```

### Query builder

```coffee
User
  .where(active: true)                   # object → AND equalities
  .where("created_at > ?", since)        # raw SQL + params
  .order("last_name, first_name")        # or .orderBy — same thing
  .limit(10)
  .offset(20)
  .all!
```

- `.where`, `.limit`, `.offset`, `.order` / `.orderBy` return the query
  builder (sync).
- `.all`, `.first`, `.count` terminate with a promise.

### Instance methods

Every `:model` instance carries:

```coffee
user.save!         # validate, run hooks, INSERT or UPDATE
user.destroy!      # run hooks, DELETE (or UPDATE deleted_at for @softDelete)
user.ok()          # boolean — current fields validate
user.errors()      # SchemaIssue[] — current fields' errors
user.toJSON()      # plain object of declared fields (no methods/getters)
```

Plus any methods, computed getters, and relation accessors you declared
on the schema.

### Lifecycle hooks

Hooks are methods whose name matches one of the [ten recognized hook
names](#19-hook-reference). On `:model` they bind into the lifecycle; on
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
orders  = user.orders!            # → OrderInstance[]
profile = user.profile!           # → ProfileInstance | null

order  = Order.find! 42
owner  = order.user!              # → UserInstance | null
```

Accessor names:

- `@belongs_to User` → `user()` (target's name, lower-first-letter)
- `@has_one Profile` → `profile()`
- `@has_many Order` → `orders()` (pluralized)

Targets resolve lazily through a process-global registry keyed by name.
Circular and cross-module references work — import the file that defines
the target, and relation calls succeed.

See [§21 Relations](#21-relations) for the full table of directive →
accessor → return type.

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

### The adapter seam

All ORM methods route through a single adapter interface: `adapter.query(sql, params)`.
The default adapter uses `fetch` against a rip-db instance at `$DB_URL`.
Install a custom adapter (for tests, or for a different backend) with
`__schemaSetAdapter`:

```coffee
globalThis.__ripSchema.__schemaSetAdapter
  query: (sql, params) ->
    # return {columns: [{name, type}, ...], data: [[row values], ...], rows: N}
    ...
```

The adapter contract is minimal — one method, one result shape. Any DB
client that can execute parameterized SQL and return row data fits.

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

---

## 9. Mixins

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

## 10. Schema algebra

Algebra operators derive new schemas from existing ones:

| Operator                | Result                                                         |
| ----------------------- | -------------------------------------------------------------- |
| `.pick(...keys)`        | new shape with only the listed fields                          |
| `.omit(...keys)`        | new shape without the listed fields                            |
| `.partial()`            | every field becomes optional                                   |
| `.required(...keys)`    | the listed fields become required (others unchanged)           |
| `.extend(other)`        | merge another schema's fields; collisions throw                |

### Two invariants to remember

> **Algebra always returns `:shape`**, never `:model` or `:input`. On a
> model, the ORM surface is stripped — `UserPublic.find()` throws.

> **Algebra drops behavior.** Methods, computed getters, and hooks from
> the source don't carry through to the derived shape. Fields and their
> metadata (modifiers, constraints) survive.

```coffee
User = schema :model
  name!    string
  email!#  email
  password! string
  full: ~> "#{@name} <#{@email}>"

UserPublic = User.omit "password"

UserPublic.kind                     # 'shape'
typeof UserPublic.find              # 'function' — but throws when called
UserPublic.find(1)                  # throws: :model-only

u = UserPublic.parse {name: "A", email: "a@b.c"}
typeof u.full                       # 'undefined' — behavior dropped
```

`.extend(other)` is the exception to "algebra only drops" — it adds
fields from another schema. Collisions still throw.

```coffee
AdminUser = User.extend schema :shape
  permissions! string[]
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

## 11. Shadow TypeScript

Every named schema emits virtual TypeScript declarations that the
language service picks up. The VS Code extension and `rip check` both
consume these — autocomplete, hover, and type checking all work out of
the box.

### What gets emitted

For `:input`:

```ts
type SignupInputValue = { email: string; password: string };
declare const SignupInput: Schema<SignupInputValue, SignupInputValue>;
```

For `:shape` (with behavior):

```ts
type AddressData = { street: string; city: string };
type AddressInstance = AddressData & {
  readonly full: unknown;
  normalize: (...args: any[]) => unknown;
};
declare const Address: Schema<AddressInstance, AddressData>;
```

For `:model`:

```ts
type UserData = { name: string; email: string };
type UserInstance = UserData & {
  readonly identifier: unknown;
  greet: (...args: any[]) => unknown;
  save(): Promise<UserInstance>;
  destroy(): Promise<UserInstance>;
  ok(): boolean;
  errors(): SchemaIssue[];
  toJSON(): UserData;
  organization(): Promise<OrganizationInstance | null>;
  orders(): Promise<OrderInstance[]>;
};
declare const User: ModelSchema<UserInstance, UserData>;
```

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

### Same-file targets type relation accessors

Relation accessors get precise return types when the target is declared
in the same file:

```coffee
User = schema :model
  name! string
Order = schema :model
  @belongs_to User                   # → order.user(): Promise<UserInstance | null>
```

Cross-file relation targets degrade to `unknown` rather than emit
unresolved names. This keeps the TypeScript diagnostics clean without
requiring virtual-module imports.

### Intrinsic declarations

Three base interfaces get injected into every schema-using file's type
view:

```ts
interface SchemaIssue { field: string; error: string; message: string; }
type SchemaSafeResult<T> =
  | { ok: true;  value: T;    errors: null }
  | { ok: false; value: null; errors: SchemaIssue[] };

interface Schema<Out, In = unknown> {
  parse(data: In): Out;
  safe(data: In): SchemaSafeResult<Out>;
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

interface ModelSchema<Instance, Data = unknown> extends Schema<Instance, Data> {
  find(id: unknown): Promise<Instance | null>;
  findMany(ids: unknown[]): Promise<Instance[]>;
  where(cond: Record<string, unknown> | string, ...params: unknown[]): SchemaQuery<Instance>;
  all(limit?: number): Promise<Instance[]>;
  first(): Promise<Instance | null>;
  count(cond?: Record<string, unknown>): Promise<number>;
  create(data: Partial<Data>): Promise<Instance>;
  toSQL(options?: { dropFirst?: boolean; header?: string }): string;
}
```

You don't import these — they're injected automatically when the file
contains any schema declaration.

---

## 12. SchemaError and diagnostics

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
```

---

## 13. Common mistakes

These forms look right but don't work — the parser catches all of them
with specific diagnostics.

### `name: type` instead of `name type`

```coffee
# wrong — fields use a space, not a colon, between name and type
X = schema
  name: string

# right
X = schema
  name! string
```

### Bare identifier enum members

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

```coffee
# wrong — use :name value
R = schema :enum
  pending: 0

# right
R = schema
  :pending 0
```

### Methods in `:input` or `:mixin`

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
UserPublic = User.omit "password"

# wrong — algebra returns :shape; :shape has no .find()
user = UserPublic.find! 1

# right — query the source model and project
user = User.find! 1
publicView = UserPublic.parse user.toJSON()
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

## 14. Recipes

### Validating HTTP input

```coffee
import { post, read } from '@rip-lang/server'

SignupInput = schema
  email!    email
  password! string, [8, 100]
  age?      integer, [18, 120]

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
  name!    string, [1, 100]
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
  currency! string, [3, 3]

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

### Building a public DTO from a model

```coffee
User = schema :model
  name!     string
  email!#   email
  password! string
  role?     string, [:user]
  @timestamps

# Public projection — no password, no ORM methods.
UserPublic = User.omit "password"

publicJson = (user) -> UserPublic.parse user.toJSON()

get '/users/:id' ->
  id = read 'id', 'id!'
  user = User.find! id
  return error! 404 unless user
  { user: publicJson user }
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

---

## 15. What's not here yet

Rip Schema covers a large surface area with one keyword, but it deliberately
does not yet cover every feature you might find across the union of Zod,
Prisma, Drizzle, and the rest. These are intentional omissions — each one
has an open design question that hasn't been resolved in a way that fits the
language.

### Validator features not yet in

- **Union and discriminated-union schemas** — `schema.union(A, B)` with a
  `:discriminator` key. Today you express alternation by running multiple
  `.safe()` calls manually.
- **Custom refinements** — `.refine(fn, message)` and `.superRefine(fn)`.
  Today arbitrary checks live in a `beforeValidation` hook on `:model`, or
  as a post-`.parse` check in your code.
- **Transforms** — `.transform(input -> output)` that changes the parsed
  value's shape. Fields can be normalized inside `beforeValidation`, but
  the output type is currently identical to the input type.
- **Coercion** — `coerce.number`, `coerce.date`, etc. Today numeric strings
  are not auto-cast to numbers during `.parse()`.
- **Async refinements** — validators that await a database or network
  call. Today the validator is purely synchronous.

### ORM features not yet in

- **Transactions** — `schema.transaction -> ...` with rollback semantics.
  Today each ORM call is its own statement.
- **Eager loading** — `User.where(...).includes(:orders)`. Today relations
  are lazy (`user.orders!` on demand).
- **Query scopes** — named, composable `Model.scope(name, ...)` reusable
  across `.where` chains.
- **Soft deletes** — a built-in `@soft_delete` directive with automatic
  query-filter application. Today you add a `deleted_at` field yourself.
- **Polymorphic associations** — `@belongs_to :commentable, polymorphic: true`.
- **Non-SQL adapters** — Mongo, Redis, Elasticsearch. The adapter contract
  is `query(sql, params)`, which assumes SQL.

### Type features not yet in

- **Recursive schemas** — `Tree = schema :shape` that references itself
  in a nested field. Compiler allows it; shadow TS currently emits
  `unknown` for the recursive branch.
- **Generic schemas** — `Paginated<T> = schema :shape ...` parameterized
  by another schema. Today you define a concrete `PaginatedUser` per type.
- **Branded / nominal types** — `UserId = schema :input` whose parsed
  value is nominally distinct from `number`.

### Deferred by design

- **Per-schema adapters** — every schema currently uses the one global
  adapter. Multi-database setups require swapping before the call.
- **JSON Schema / OpenAPI export** — `User.toJSONSchema()`. The
  four-layer runtime makes this feasible; no canonical emitter exists yet.

None of these are architectural impossibilities. Each is a conscious pause
while the core shape of the feature settles. If one of these is blocking
you, file a proposal — the sidecar design makes most of them additive.

---

# Part II — Reference

## 16. Capability matrix

What each kind's body can contain:

| Feature                     | `:input` | `:shape` | `:enum`  | `:mixin` | `:model` |
| --------------------------- | -------- | -------- | -------- | -------- | -------- |
| Fields (`name! type`)       | ✓        | ✓        | —        | ✓        | ✓        |
| `@mixin` directive          | ✓        | ✓        | —        | ✓        | ✓        |
| Other directives            | —        | —        | —        | —        | ✓        |
| Methods (`name: -> body`)   | —        | ✓        | —        | —        | ✓        |
| Computed (`name: ~> body`)  | —        | ✓        | —        | —        | ✓        |
| Hooks (by known name)       | —        | methods  | —        | —        | ✓        |
| Enum members (`:symbol`)    | —        | —        | ✓        | —        | —        |
| Algebra (`.pick` etc.)      | ✓ → shape | ✓ → shape | —       | —        | ✓ → shape |
| ORM (`.find`, `.create`)    | —        | —        | —        | —        | ✓        |
| `.parse` / `.safe` / `.ok`  | ✓        | ✓        | ✓        | —        | ✓        |
| `.toSQL()`                  | —        | —        | —        | —        | ✓        |

"methods" in the `:shape` / Hooks row means: hook-named functions are
accepted, but they're just methods with no lifecycle binding.

---

## 17. Field types

Built-in type names and their runtime / SQL / TypeScript mappings:

| Rip type   | Validator                            | SQL         | TypeScript |
| ---------- | ------------------------------------ | ----------- | ---------- |
| `string`   | `typeof v === 'string'`              | `VARCHAR`   | `string`   |
| `text`     | `typeof v === 'string'`              | `TEXT`      | `string`   |
| `email`    | string + `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | `VARCHAR` | `string` |
| `url`      | string + `/^https?:\/\/.+/`          | `VARCHAR`   | `string`   |
| `uuid`     | string + UUID regex                  | `UUID`      | `string`   |
| `phone`    | string + `/^[\d\s\-+()]+$/`          | `VARCHAR`   | `string`   |
| `number`   | `typeof v === 'number'` and not NaN  | `DOUBLE`    | `number`   |
| `integer`  | `Number.isInteger(v)`                | `INTEGER`   | `number`   |
| `boolean`  | `typeof v === 'boolean'`             | `BOOLEAN`   | `boolean`  |
| `date`     | `Date` instance                      | `DATE`      | `Date`     |
| `datetime` | `Date` instance                      | `TIMESTAMP` | `Date`     |
| `json`     | not undefined                        | `JSON`      | `unknown`  |
| `any`      | always true                          | `JSON`      | `any`      |

Arrays: `type[]`. SQL stores as `JSON` (DuckDB native), TS is `T[]`.

Custom identifiers: unknown type names are accepted (validator skipped,
SQL defaults to `JSON`, TS uses the identifier as-is). This is how
user-defined shapes and enums compose.

---

## 18. Directives

### For any fielded kind

| Directive       | Effect                                                            |
| --------------- | ----------------------------------------------------------------- |
| `@mixin Name`   | Pull in the fields of mixin `Name` at Layer 2 normalization       |

### `:model`-only

| Directive                     | Effect                                                              |
| ----------------------------- | ------------------------------------------------------------------- |
| `@timestamps`                 | Adds `created_at` + `updated_at` columns with `CURRENT_TIMESTAMP` defaults |
| `@softDelete`                 | Adds `deleted_at` column; `.destroy()` sets `deleted_at = now()` instead of DELETE |
| `@index [a, b, c]`            | Composite index on the listed columns                               |
| `@index column`               | Single-column index (same as `@index [column]`)                     |
| `@index [...] #`              | Unique index                                                        |
| `@belongs_to Target`          | FK column `target_id` referencing `targets.id`, NOT NULL            |
| `@belongs_to Target?`         | Same, nullable                                                      |
| `@has_one Target`             | Accessor `target()` returning one                                   |
| `@has_many Target`            | Accessor `targets()` returning array                                |

---

## 19. Hook reference

Ten recognized hook names. On `:model` they bind into the lifecycle; on
other kinds they're plain methods.

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

Throwing from any hook aborts the operation and the exception propagates
to the caller.

---

## 20. Constraints

Constraint brackets follow a field type:

```coffee
name type, [constraint1, constraint2, ...]
```

### Shapes by arity

| Form                | Meaning                                     |
| ------------------- | ------------------------------------------- |
| `[a]`               | `default = a`                               |
| `[a, b]`            | `min = a`, `max = b`                        |
| `[a, b, c]`         | `min = a`, `max = b`, `default = c`         |
| `[/regex/]`         | `regex = /regex/`                           |

### Constraint semantics by field type

| Field type | `min` / `max` mean      | `regex` applies? |
| ---------- | ----------------------- | ---------------- |
| `string` / `text` / `email` / `url` / `phone` | string length | yes |
| `integer` / `number` | numeric range | no |
| `date` / `datetime`  | not used      | no |

`default` applies to any field type. Defaults are applied before
validation when the field is missing or `null`.

### Literal-only values

Constraint values are evaluated at compile time and must be literals:

- Numbers (including negative: `-10`)
- Strings (`"text"`)
- Booleans (`true`, `false`)
- `null`, `undefined`
- Regex literals (`/^\d+$/`)
- `:symbol` (compiles to the symbol's name as a string — useful for enum
  defaults: `[:draft]` ≡ `["draft"]`)

Arbitrary expressions, identifier references, and function calls are
rejected at parse time with a clear error.

### Multi-line constraint lists

Trailing comma + indent continues the line:

```coffee
password! string,
  [8, 100]
```

This is the same rule Rip applies to any trailing-comma continuation.

---

## 21. Relations

### Directive → accessor → return type

| Directive                   | Accessor name         | Returns                                  |
| --------------------------- | --------------------- | ---------------------------------------- |
| `@belongs_to User`          | `user()`              | `Promise<UserInstance \| null>`          |
| `@belongs_to User?`         | `user()`              | `Promise<UserInstance \| null>` + nullable FK |
| `@has_one Profile`          | `profile()`           | `Promise<ProfileInstance \| null>`       |
| `@has_many Order`           | `orders()`            | `Promise<OrderInstance[]>`               |

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

---

## 22. Design invariants

Seven rules that define how Rip Schema behaves. Worth keeping in mind
when debugging or extending:

1. **Default kind is `:input`.** `schema` with no marker and a
   field-shaped body gets the most common validation case with no
   ceremony.
2. **Fields use `name type`, not `name: type`.** The colon is reserved
   for methods and computed. Using the colon form produces a compile
   error pointing at the right syntax.
3. **`:shape` has no lifecycle.** Hook names on `:shape` are methods —
   no binding. Lifecycle is a `:model` concern because it's coupled to
   persistence.
4. **Algebra on `:model` returns `:shape`.** ORM methods are stripped.
   Invariant 1 of the algebra section.
5. **Algebra drops behavior.** Methods, computed getters, and hooks
   aren't carried through `.pick/.omit/.partial/.required/.extend`.
   Fields and field metadata survive.
6. **`:mixin` is non-instantiable.** Mixins declare fields for reuse —
   they don't have a runtime identity of their own.
7. **Schema names are global.** Relations and `@mixin` references
   resolve by bare name through a process-global registry. Two models
   with the same name in different modules produce the "last loaded
   wins" behavior — avoid it.

---

# Part III — Architecture

## 23. Runtime architecture

Each schema goes through four layers. Each layer is built lazily on first
need, and the caches are independent.

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

## 24. Compiler integration

The schema keyword is implemented as a compiler sidecar in
`src/schema.js`, alongside the existing type and component sidecars.
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
| `src/schema.js`      | Sub-parser, `emitSchema`, Layer 1-4 runtime, shadow TS walker, `installSchemaSupport` |
| `src/lexer.js`       | Hook point — calls `rewriteSchema()`; comment-token fix for `#` modifier |
| `src/grammar/grammar.rip` | The one `Schema` production                                  |
| `src/compiler.js`    | Dispatch for the `schema` s-expression head; preamble injection    |
| `src/types.js`       | Calls `emitSchemaTypes()` during `.d.ts` emission                  |
| `src/typecheck.js`   | `hasSchemas()` probe so schema-only files aren't `@ts-nocheck`d     |
| `test/rip/schema.rip` | The test suite                                                    |

The total wiring in the core compiler (outside `src/schema.js`) is under
100 lines. That's the sidecar pattern working — the feature is big, but
its footprint in the main compiler is small.

---

## 25. FAQ

**Why not just use Zod?**
Zod gives you the validator. It doesn't give you the ORM, the DDL, the
class, the computed getters, or the derived DTOs. Rip Schema is all of
that from one declaration. If you only need the validator, `schema :input`
is the equivalent surface — and the derived shadow TS is indistinguishable
from `z.infer<>`.

**Is this a full ORM replacement for Prisma / Drizzle?**
For the common CRUD shape — yes. `find`, `where`, `create`, `save`,
`destroy`, relations, migrations, hooks, lifecycle callbacks, and
validations are all present and running in production apps. For
transactions, eager loading, scopes, and soft deletes — not yet; see
§15.

**Does the runtime belong to `schema.js` or is it loaded separately?**
It's inlined. When a file uses `schema`, the compiler injects a small
preamble (under `SCHEMA_RUNTIME` in `src/schema.js`) that defines
`SchemaError`, `__SchemaDef`, `__SchemaRegistry`, `Query`, and the
helpers. No import statement, no package dependency, no bootstrap call.

**How big is the runtime?**
About 2,250 lines total across runtime + compile-time emission, including
the ORM, the DDL emitter, the registry, the validator plan, and the
hydration logic. The preamble injected into your compiled output is a
fraction of that (the ORM and DDL paths are tree-shaken if unused).

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
