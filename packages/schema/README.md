<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip Schema - @rip-lang/schema

**One definition. Three outputs. Zero drift.**

A schema language that generates TypeScript types, runtime validators, and SQL
from a single source of truth.

---

## The Problem

Every real application needs three things:

1. **TypeScript types** — for compile-time safety and IDE support
2. **Runtime validators** — for rejecting bad inputs in production
3. **Database schema** — for tables, constraints, indexes, and migrations

Today, you write each one separately:

```
types/user.ts         →  interface User { name: string; email: string; ... }
schemas/user.ts       →  z.object({ name: z.string().min(1).max(100), ... })
prisma/schema.prisma  →  model User { name String @db.VarChar(100) ... }
```

Three files. Three syntaxes. Three things to keep in sync manually. They drift
apart — silently, inevitably — and you find out at the worst possible time.

This isn't a tooling failure. It's a structural one. Each tool solves a
different problem at a different layer:

| Tool | What it solves | Where it works | What it can't do |
|------|---------------|----------------|------------------|
| TypeScript | Compile-time safety | IDE, build step | Vanishes at runtime |
| Zod | Runtime validation | API boundaries | No database awareness |
| Prisma | Database persistence | Migrations, queries | No runtime validation |

You can't eliminate this by picking one tool. TypeScript types are erased before
your code runs. Zod doesn't know about indexes. Prisma can't enforce "must be a
valid email" at the API layer.

But you can eliminate it by writing a definition that's richer than any single
tool — and generating all three from it.

---

## The Answer

Write one schema:

```coffee
@enum Role: admin, user, guest

@model User
  name!     string, [1, 100]
  email!#   email
  role      Role, [user]
  bio?      text, [0, 1000]
  active    boolean, [true]

  @belongs_to Organization
  @has_many Post

  @timestamps
  @index [role, active]

  @computed
    displayName -> "#{@name} <#{@email}>"
    isAdmin     -> @role is 'admin'

  @validate
    password -> @matches(/[A-Z]/) and @matches(/[0-9]/)
```

Get three outputs.

**TypeScript types:**

```typescript
export type Role = 'admin' | 'user' | 'guest';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  bio?: string;
  active: boolean;
  organizationId: number;
  createdAt: Date;
  updatedAt: Date;
}
```

**Runtime validators (Zod):**

```typescript
import { z } from 'zod';

export const RoleSchema = z.enum(['admin', 'user', 'guest']);

export const UserSchema = z.object({
  id:             z.number().int(),
  name:           z.string().min(1).max(100),
  email:          z.string().email(),
  role:           RoleSchema.default('user'),
  bio:            z.string().max(1000).optional(),
  active:         z.boolean().default(true),
  organizationId: z.number().int(),
  createdAt:      z.date(),
  updatedAt:      z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const UserCreateSchema = UserSchema.omit({
  id: true, createdAt: true, updatedAt: true,
});
export const UserUpdateSchema = UserCreateSchema.partial();
```

**SQL DDL:**

```sql
CREATE TABLE users (
  id              INTEGER  PRIMARY KEY AUTOINCREMENT,
  name            TEXT     NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  email           TEXT     NOT NULL UNIQUE,
  role            TEXT     NOT NULL DEFAULT 'user'
                           CHECK(role IN ('admin', 'user', 'guest')),
  bio             TEXT,
  active          INTEGER  NOT NULL DEFAULT 1,
  organization_id INTEGER  NOT NULL REFERENCES organizations(id),
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role_active ON users(role, active);
```

One source of truth. Always in sync. Impossible to drift.

---

## Why Not Just TypeScript?

TypeScript types are the weakest candidate for a single source of truth:

1. **Erased at runtime.** `JSON.parse()` returns `any`. Network responses,
   database rows, and form submissions are all untyped at the moment you need
   protection most. TypeScript can't help because it no longer exists.

2. **Can't express constraints.** There is no way to say "string between 1 and
   100 characters" or "must be a valid email" in a TypeScript type. You need
   runtime code for that — which means you need a second system.

3. **Can't model persistence.** Indexes, unique constraints, foreign keys,
   cascade rules, column types, precision — none of these exist in TypeScript's
   type system. You need a third system.

You could bolt metadata onto TypeScript with decorators, JSDoc tags, or branded
types. But then TypeScript isn't the source of truth — your annotation layer
is. And you've built a schema language anyway, just a worse one bolted onto a
host that fights you.

Rip Schema skips the pretense. It's a schema language purpose-built to capture
everything all three layers need, and it generates each layer's native format
directly.

---

## Schema Syntax

### Fields

The basic unit is a field definition:

```
name[modifiers] type[, [constraints]][, { attributes }]
```

Examples:

```coffee
name!     string, [1, 100]          # Required string, 1-100 chars
email!#   email                     # Required + unique email
bio?      text, [0, 1000]           # Optional text, max 1000 chars
role      Role, [user]              # Enum with default value
score     integer, [0, 100, 50]     # Range + default
tags      string[]                  # Array of strings
data      json, [{}]                # JSON with default
zip!      string, [/^\d{5}$/]       # Regex pattern
phone!    string, [10, 15], { mask: "(###) ###-####" }  # With UI hints
```

### Modifiers

Modifiers appear between the field name and the type:

| Modifier | Meaning | TS | Zod | SQL |
|----------|---------|-----|-----|-----|
| `!` | Required | non-optional | no `.optional()` | `NOT NULL` |
| `#` | Unique | — | — | `UNIQUE` |
| `?` | Optional | `field?: T` | `.optional()` | nullable |

Modifiers can be combined: `email!# email` means required and unique.

### Constraints

Constraints appear in square brackets after the type:

| Syntax | Meaning | Example |
|--------|---------|---------|
| `[min, max]` | Range (string length or numeric value) | `[1, 100]` |
| `[default]` | Default value | `[true]` |
| `[min, max, default]` | Range + default | `[0, 100, 50]` |
| `[/regex/]` | Pattern match | `[/^\d{5}$/]` |
| `[{}]` | Default empty object | `[{}]` |
| `[->]` | Default from function | `[->]` |

### Primitive Types

| Type | TypeScript | Zod | SQL |
|------|-----------|-----|-----|
| `string` | `string` | `z.string()` | `TEXT` |
| `text` | `string` | `z.string()` | `TEXT` |
| `integer` | `number` | `z.number().int()` | `INTEGER` |
| `bigint` | `bigint` | `z.bigint()` | `BIGINT` |
| `float` | `number` | `z.number()` | `REAL` |
| `double` | `number` | `z.number()` | `DOUBLE` |
| `decimal` | `number` | `z.number()` | `DECIMAL` |
| `boolean` | `boolean` | `z.boolean()` | `INTEGER` |
| `date` | `Date` | `z.date()` | `DATE` |
| `time` | `string` | `z.string()` | `TIME` |
| `datetime` | `Date` | `z.date()` | `DATETIME` |
| `timestamp` | `number` | `z.number()` | `INTEGER` |
| `json` | `Record<string, unknown>` | `z.record(z.unknown())` | `TEXT` |
| `binary` | `Buffer` | `z.instanceof(Buffer)` | `BLOB` |
| `uuid` | `string` | `z.string().uuid()` | `TEXT` |

### Special Types

These carry built-in validation:

| Type | Validates | Zod |
|------|-----------|-----|
| `email` | RFC 5322 format | `z.string().email()` |
| `url` | Valid URL | `z.string().url()` |
| `phone` | E.164 or regional | `z.string()` + pattern |
| `color` | Hex, RGB, named | `z.string()` + pattern |

---

## Definitions

### Enums

```coffee
# Inline
@enum Role: admin, user, guest

# Block with explicit values
@enum Status
  pending:   0
  active:    1
  suspended: 2
  deleted:   3

# Block with string values
@enum Priority
  low:      "low"
  medium:   "medium"
  high:     "high"
  critical: "critical"
```

### Types

Types define reusable structures without database backing — useful for embedded
objects, API payloads, and shared shapes:

```coffee
@type Address
  street!   string, [1, 200]
  city!     string, [1, 100]
  state!    string, [2, 2]
  zip!      string, [/^\d{5}(-\d{4})?$/]

@type ContactInfo
  phone?    phone
  email?    email
  fax?      phone
```

Types generate TypeScript interfaces and Zod schemas but no SQL tables.

### Models

Models are database-backed entities with full schema, validation, relationships,
and lifecycle:

```coffee
@model User
  name!       string, [1, 100]
  email!#     email
  password!   string, [8, 100]
  role!       Role, [user]
  avatar?     url
  bio?        text, [0, 1000]
  settings    json, [{}]
  active      boolean, [true]

  address?    Address                 # Embedded type

  @timestamps                         # createdAt, updatedAt
  @softDelete                         # deletedAt

  @index email#                       # Unique index
  @index [role, active]               # Composite index
  @index name                         # Non-unique index

  @belongs_to Organization
  @has_many Post

  @computed
    displayName -> "#{@name} <#{@email}>"
    isAdmin     -> @role is 'admin'

  @validate
    password -> @matches(/[A-Z]/) and @matches(/[0-9]/)
    email    -> not @endsWith('@test.com') if @env is 'production'
```

Models generate TypeScript interfaces, Zod schemas, and SQL DDL.

### Relationships

```coffee
@belongs_to User                      # Creates user_id foreign key
@belongs_to Category, { optional: true }
@has_one Profile
@has_many Post
@has_many Comment
```

### Indexes and Directives

```coffee
@index email#                         # Unique index on one field
@index [role, active]                 # Composite index on multiple fields
@index name                           # Non-unique index

@timestamps                           # Adds createdAt, updatedAt
@softDelete                           # Adds deletedAt
@include Auditable                    # Include mixin fields
```

### Computed Fields

Read-only fields derived from other fields:

```coffee
@computed
  displayName -> "#{@name} <#{@email}>"
  isAdmin     -> @role is 'admin'
  age         -> yearsFrom(@dob)
```

Computed fields appear in TypeScript types as readonly properties and in
`toJSON()` output but have no SQL column.

### Validation

Custom validation rules beyond what type constraints can express:

```coffee
@validate
  password -> @matches(/[A-Z]/) and @matches(/[0-9]/)
  email    -> not @endsWith('@test.com') if @env is 'production'
```

Validation rules generate Zod `.refine()` calls and run in the ORM's
`$validate()` method. They have no SQL equivalent — they protect the API
boundary, not the database boundary.

### Mixins

Reusable field groups:

```coffee
@mixin Timestamps
  createdAt!   datetime
  updatedAt!   datetime

@mixin SoftDelete
  deletedAt?   datetime

@mixin Auditable
  @include Timestamps
  @include SoftDelete
  createdBy?   integer
  updatedBy?   integer

@model Post
  title!    string, [1, 200]
  content!  text
  @include Auditable
```

---

## Beyond Data: Widgets, Forms, and State

Rip Schema extends beyond the data layer to cover UI and application state. This
is the same "define once, generate everything" principle applied to
presentation:

### Widgets

```coffee
@widget DataGrid
  columns!       Column[]
  pageSize       integer, [25]
  selectionMode  SelectionMode, [single]
  sortable       boolean, [true]

  @events onSelect, onSort, onAction
```

### Forms

```coffee
@form UserForm: User
  name  { x: 0, y: 0, span: 2, label: "Full Name" }
  email { x: 0, y: 1 }
  role  { x: 0, y: 2, widget: dropdown }
  bio   { x: 0, y: 3, widget: textarea, rows: 3 }

  @actions
    save   { primary: true }
    cancel {}
```

### State

```coffee
@state App
  currentUser?   User
  theme          string, ['light']
  sidebarOpen    boolean, [true]

  @computed
    isLoggedIn -> @currentUser?
    isAdmin    -> @currentUser?.role is 'admin'

  @actions
    login  { async: true }
    logout {}
```

---

## How It Works

Schemas are parsed by a Solar-generated SLR(1) parser into S-expressions — a
lightweight tree structure that any code generator can walk:

```
schema.rip  →  lexer  →  parser  →  S-expressions  →  ┬── emit-ts   →  types.ts
                                                       ├── emit-zod  →  validators.ts
                                                       └── emit-sql  →  schema.sql
```

The S-expression for a model looks like:

```javascript
["model", "User", null, [
  ["field", "name",  ["!"],      "string", [[1, 100]], null],
  ["field", "email", ["!", "#"], "email",  null,       null],
  ["field", "role",  [],         "Role",   [["user"]], null],
  ["timestamps"],
  ["index", ["role", "active"], false]
]]
```

Each output target is a simple tree-walker over this structure. Adding a new
target — OpenAPI, JSON Schema, Prisma, GraphQL — means writing one more walker.
The schema definition never changes.

This architecture means the schema language is not coupled to any specific
output format. It's a **representation of your domain** that happens to be
renderable into whatever format each layer of your stack needs.

---

## Runtime ORM

Beyond code generation, Rip Schema includes an ActiveRecord-style ORM for
runtime persistence and domain modeling:

```coffee
import { Model, makeCallable, connect } from '@rip-lang/schema/orm'

connect 'http://localhost:4000'

class UserModel extends Model
  @table    = 'users'
  @database = 'labs'

  @schema
    id:    { type: 'int', primary: true }
    name:  { type: 'string', required: true, min: 1, max: 100 }
    email: { type: 'email', required: true, unique: true }
    score: { type: 'float' }
    active: { type: 'bool', default: true }

  @computed
    identifier:   -> "#{@name} (##{@id})"
    isHighScorer: -> @score? and @score > 90

  createAccessCode: (secs = 3600) ->
    syms = 'ABCDEFGHJKMNPQRSTUVWXYZ'.split('')
    @code = [1..5].map(-> syms[Math.floor(Math.random() * syms.length)]).join('')
    @codeExpiresAt = Date.now() + secs * 1000
    @code

User = makeCallable UserModel
```

### Queries

```coffee
user  = User(25)                          # Find by ID
user  = User.find(25)                     # Same thing
users = User([1, 2, 3])                   # Find multiple
users = User.all()                        # All records
users = User.where(active: true).all()    # Filtered
count = User.count()                      # Count

# Chainable
users = User
  .where('score > ?', 90)
  .orderBy('name')
  .limit(10)
  .all()
```

### Records

```coffee
# Properties
user.name                    # Read
user.name = 'Alice'          # Write (automatic dirty tracking)

# Computed
user.identifier              # Derived from schema fields

# Business logic
user.createAccessCode(3600)  # Instance methods

# State
user.$isNew                  # Not yet persisted?
user.$dirty                  # Changed field names
user.$changed                # Has any changes?
user.$data                   # Raw data snapshot

# Lifecycle
user.$validate()             # → null or [{ field, error, message }]
user.save()                  # INSERT or UPDATE (dirty fields only)
user.delete()                # DELETE
user.reload()                # Refresh from database
user.toJSON()                # Serialize (includes computed fields)
```

### Validation

```coffee
errors = user.$validate()

# null if valid, otherwise:
# [
#   { field: 'name',  error: 'required', message: 'name is required' },
#   { field: 'email', error: 'type',     message: 'email must be a valid email' },
#   { field: 'role',  error: 'enum',     message: 'role must be one of: admin, user, guest' },
# ]
```

Error types: `required`, `type`, `enum`, `min`, `max`, `pattern`, `nested`.

---

## Architecture

```
packages/schema/
├── grammar.rip     # Solar grammar definition (schema → S-expressions)
├── lexer.js        # Indentation-aware tokenizer
├── parser.js       # Generated SLR(1) parser
├── runtime.js      # Schema registry, validation, model factory
├── orm.rip         # ActiveRecord-style ORM
├── SCHEMA.md       # Full specification and design details
└── README.md       # This file

packages/db/
├── db.rip          # DuckDB HTTP server
└── lib/duckdb.mjs  # Native bindings
```

The schema package and database package are independent:

- **@rip-lang/schema** — Parse schemas, validate data, generate code, build
  domain models
- **@rip-lang/db** — Database server (DuckDB with native FFI bindings, served
  over HTTP)

The ORM connects to the database over HTTP, keeping the layers cleanly
separated. You can use schema parsing and code generation without the ORM, and
you can use the ORM without the code generators.

---

## Status

| Component | Status |
|-----------|--------|
| Schema grammar (Solar) | Complete |
| Schema parser (S-expressions) | Complete |
| Runtime validation engine | Complete |
| ORM (Model, Query, persistence) | Complete |
| DuckDB adapter | Complete |
| TypeScript type generation | Planned |
| Zod validator generation | Planned |
| SQL DDL generation | Planned |
| Relationship loading | Planned |
| Migration diffing | Planned |

The grammar, parser, validation engine, and ORM are working. Code generation —
the pipeline that produces TypeScript types, Zod validators, and SQL DDL from
schema S-expressions — is the current focus.

---

## Roadmap

### Phase 1: Foundation — Complete

- Schema grammar and S-expression parser
- Type registry and validation engine
- Runtime model factory with defaults
- Nested types and enum validation

### Phase 2: ORM — Complete

- Model base class with schema-driven property accessors
- Query builder (where, orderBy, limit, offset)
- Dirty tracking and persistence (INSERT, UPDATE, DELETE)
- Computed properties
- DuckDB integration via HTTP

### Phase 3: Code Generation — In Progress

- TypeScript type emission from S-expressions
- Zod validator emission from S-expressions
- SQL DDL emission from S-expressions
- CLI tool for schema compilation

### Phase 4: Relationships and Migrations

- `@belongs_to`, `@has_many`, `@has_one` in ORM
- Lazy loading and eager loading
- Schema diffing for migration generation
- Transaction support

### Phase 5: UI Integration

- Widget definitions and component generation
- Form binding with layout engine
- Reactive state management
- Hydration and serialization

---

## Background

Rip Schema is part of the [Rip](https://github.com/shreeve/rip-lang) language
ecosystem. It draws on ideas from:

- **SPOT/Sage** — Enterprise schema framework that proved unified definitions
  work at scale (complex medical systems with 2000+ line schemas)
- **ActiveRecord** — Ruby's ORM pattern: models as rich domain objects
- **Zod** — Runtime validation with composable schemas
- **Prisma** — Database schema as code with generated client types
- **TypeScript** — Type inference and structural typing
- **ASN.1** — Formal notation for describing data structures

The key insight is that types, validation, and persistence are three views of
the same underlying reality — the shape of your data. Writing them separately
creates drift. Writing them once and generating the rest eliminates it.

---

## See Also

- [SCHEMA.md](./SCHEMA.md) — Full specification, syntax details, and design
  rationale
- [examples/](./examples/) — Working code examples
- [grammar.rip](./grammar.rip) — The Solar grammar that parses schema files
