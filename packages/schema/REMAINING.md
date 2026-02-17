# Remaining Work — @rip-lang/schema

What separates the current state from world-class, in priority order.

The API design, architecture, DSL, and code generators are solid. What's
missing is depth — the features that make the difference between a demo and
a tool people build real applications with.

---

## 1. Relation Loading

**Priority: Critical — the single biggest gap.**

The schema already declares `@belongs_to` and `@has_many`. Foreign keys are
generated in SQL. TypeScript types include relationship fields. But the ORM
can't load them.

```coffee
# Lazy loading — should work
user = User.first!()
posts = user.posts!()

# Eager loading — should work
users = User.where!(active: true).include!('posts').all!()
```

Without this, the ORM is single-table only. Every real application has
relationships. This is what separates "interesting prototype" from "I can
actually use this."

## 2. Parser Error Messages

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

## 3. Soft-Delete Awareness

**Priority: High — the metadata is already there.**

`@softDelete` generates the `deleted_at` column but doesn't affect queries.
`User.all!()` still returns soft-deleted records. The fix:

```coffee
users = User.all!()                # excludes soft-deleted automatically
users = User.withDeleted!().all!() # explicit opt-in
user.softDelete!()                 # sets deleted_at, doesn't DELETE
```

The schema already knows which models have `@softDelete`. The query builder
just needs to apply a default `WHERE deleted_at IS NULL` filter.

## 4. Derived Type Generation

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

## 5. Lifecycle Hooks

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

## 6. One More Code Generation Target

**Priority: Medium — proves the architecture.**

The "any new target is just one more AST walker" claim is theoretical until
there's a third walker. Candidates:

- **`emit-zod.js`** — For teams that need tRPC or react-hook-form integration
- **`emit-openapi.js`** — For teams that need API documentation
- **`emit-graphql.js`** — For teams using GraphQL

Each is a single file that walks the same S-expression AST. Writing one
proves the extensibility story isn't just talk.

## 7. Per-Schema Connection State

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
| VS Code highlighting | `packages/vscode` | Complete |
| CLI | `rip-schema generate app.schema` | Complete |
