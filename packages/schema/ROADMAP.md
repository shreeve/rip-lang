# Roadmap — @rip-lang/schema

Where we are, where we're going, and how to verify it all works.

---

## Current State

What works today, end-to-end:

| Capability | Entry Point | Status |
|---|---|---|
| Schema DSL | `app.schema` | Complete |
| Lexer + Parser | `lexer.js`, `parser.js` | Complete |
| TypeScript generation | `schema.toTypes()` | Complete |
| SQL DDL generation | `schema.toSQL()` | Complete |
| Runtime validation | `schema.create()`, `schema.validate()` | Complete |
| Schema-centric ORM | `schema.model()` | Complete |
| Query builder | `where`, `orderBy`, `limit`, `count` | Complete |
| Dirty tracking | `$dirty`, `$changed`, `save()` | Complete |
| Computed properties | `schema.model('User', { computed: ... })` | Complete |
| Relation loading | `user.posts()`, `post.user()` | Complete |
| Soft-delete awareness | `softDelete()`, `withDeleted()`, auto-filter | Complete |
| VS Code highlighting | `packages/vscode` | Complete |
| CLI | `rip-schema generate app.schema` | Complete |

---

## Remaining Work

What separates the current state from world-class, in priority order.

The API design, architecture, DSL, and code generators are solid. What's
missing is depth — the features that make the difference between a demo and
a tool people build real applications with.

### ~~1. Relation Loading~~ — Complete

Lazy loading of `@belongs_to`, `@has_many`, and `@has_one` relations.
Models are auto-registered on the schema instance, so `user.posts()` and
`post.user()` resolve at query time. Eager loading (`include`) is next.

### 2. Parser Error Messages

**Priority: High — first impressions matter.**

When someone writes invalid `.schema` syntax, the error should be beautiful
and contextual, not a raw SLR parser dump:

```
Error in app.schema at line 12:

  @model User
    name!     string, [1, 100]
    email!#   emial
              ^^^^^
  Unknown type "emial". Did you mean "email"?
```

World-class tools (Elm, Rust, Prisma) are beloved for their error messages.
This is what makes people trust a tool on first contact.

### ~~3. Soft-Delete Awareness~~ — Complete

Models with `@softDelete` now auto-filter deleted records from all queries.
`softDelete()` sets `deleted_at`, `restore()` clears it, and `withDeleted()`
opts out of the filter. The query builder, static methods (`find`, `all`,
`first`), and count all respect the soft-delete flag automatically.

### 4. Derived Type Generation

**Priority: High — already promised, not yet built.**

`emit-types.js` should generate variant interfaces from a single `@model`:

```typescript
export interface User { ... }         // full record
export interface UserCreate { ... }   // required fields only, defaults omitted
export interface UserUpdate { ... }   // all fields optional
export interface UserPublic { ... }   // writeOnly fields excluded
```

The metadata is all there — required, optional, defaults, writeOnly. This
is one of the strongest claims in the INQUISITION and README. It should be
real.

### 5. Lifecycle Hooks

**Priority: Medium — needed for real business logic.**

```coffee
User = schema.model 'User',
  beforeSave: ->
    @updatedAt = new Date()
    @email = @email.toLowerCase()
  afterCreate: ->
    sendWelcomeEmail @email
```

Every serious ORM has `beforeSave`, `afterCreate`, `beforeDelete`. Without
hooks, people hack around the ORM instead of working with it.

### 6. One More Code Generation Target

**Priority: Medium — proves the architecture.**

The "any new target is just one more AST walker" claim is theoretical until
there's a third walker. Candidates:

- **`emit-zod.js`** — For teams that need tRPC or react-hook-form integration
- **`emit-openapi.js`** — For teams that need API documentation
- **`emit-graphql.js`** — For teams using GraphQL

Each is a single file that walks the same S-expression AST. Writing one
proves the extensibility story isn't just talk.

### 7. Per-Schema Connection State

**Priority: Medium — needed for testing and multi-database apps.**

`schema.connect('url')` currently sets a module-level `_dbUrl`. Two schemas
can't connect to different databases. Tests can't run in isolation.

Fix: the schema instance holds the connection URL, and models created by
`schema.model()` inherit it. The query function reads from the model's
schema, not from a global variable.

---

## What We Don't Need Yet

- **Migrations** — DDL-as-target-state is honest. Use dbmate or Flyway.
- **MySQL/SQLite** — DuckDB/PostgreSQL is the right starting point.
- **VS Code language server** — Syntax highlighting is enough for now.
- **`@computed` / `@validate` in the DSL** — These work well enough in
  model code via `schema.model` options and instance methods.
- **More example schemas** — `app.schema` (blog platform) is the right
  complexity level.

---

## Smoke Tests

End-to-end validation that the full stack works.

### Prerequisites

```bash
bun bin/rip packages/db/db.rip :memory:   # start rip-db (in-memory)
```

### 1. Schema Code Generation (`examples/app-demo.rip`)

Parses `app.schema` (a blog platform with enums, types, and models) and
validates all three output targets from a single source file.

```bash
rip packages/schema/examples/app-demo.rip
```

| What                          | Validates                                                 |
|-------------------------------|-----------------------------------------------------------|
| **Parse**                     | `Schema.load` parses 2 enums, 1 type, 4 models            |
| **TypeScript generation**     | `schema.toTypes()` produces interfaces, enums, JSDoc       |
| **SQL DDL generation**        | `schema.toSQL()` produces CREATE TABLE / CREATE TYPE        |
| **Valid instance**            | `schema.create('User', {...})` applies defaults, passes    |
| **Missing required field**    | Catches missing `email`                                    |
| **Invalid email**             | Catches `not-an-email` format                              |
| **String max length**         | Catches name > 100 chars                                   |
| **Invalid enum**              | Catches `superadmin` not in `Role` enum                    |
| **Nested type validation**    | Catches multiple violations in `Address` sub-object        |
| **Enum + integer defaults**   | `Post` gets correct `status` and `viewCount` defaults      |
| **File output**               | Writes `generated/app.d.ts` and `generated/app.sql`        |

### 2. ORM with Live Database (`examples/orm-example.rip`)

Connects to `rip-db`, creates tables from schema-generated DDL, seeds
data, and exercises the full Schema-centric ORM.

```bash
rip packages/schema/examples/orm-example.rip
```

| What                          | Validates                                                 |
|-------------------------------|-----------------------------------------------------------|
| **Schema load**               | `Schema.load './app.schema'` parses and registers models   |
| **DDL generation**            | `schema.toSQL()` produces dependency-ordered DDL           |
| **Setup**                     | DROP/CREATE TABLE via `/sql` endpoint, seed users + posts  |
| **Model definition**          | `schema.model 'User'` + `schema.model 'Post'` wire fields |
| **Find first**                | `User.first()` returns a user with all schema fields       |
| **Find by email**             | `User.where(email: ...)` filters correctly                 |
| **Computed properties**       | `user.identifier` and `user.isAdmin` derive from fields    |
| **All users**                 | `User.all()` returns all 5 records                         |
| **Where (object style)**      | `User.where(role: 'editor')` filters correctly             |
| **Where (SQL style)**         | `User.where('active = ?', true)` with parameterized query  |
| **Chainable query**           | `.where().orderBy().limit()` chains produce correct SQL     |
| **Count**                     | `User.count()` returns 5                                   |
| **Instance methods**          | `user.greet()` and `user.displayRole()` work               |
| **Dirty tracking**            | Mutation of `name` sets `$dirty` and `$changed`            |
| **Relation: hasMany**         | `user.posts()` returns related posts                       |
| **Relation: belongsTo**       | `post.user()` returns the author                           |
| **Soft delete**               | `softDelete()` hides, `withDeleted()` includes, `restore()` recovers |
| **Validation**                | Missing `name` and invalid `email` caught by `$validate()` |

### 3. Compiler Regression Test (`test/rip/control.rip`)

Ensures the `or throw` variable hoisting bug stays fixed.

```bash
bun test/runner.js test/rip/control.rip
```

| What                                        | Validates                                        |
|---------------------------------------------|--------------------------------------------------|
| **Sibling export variable independence**     | `store` is declared locally in each function     |

### Full Test Suite

```bash
bun test/runner.js test/rip     # 1243 tests, 100% passing
```
