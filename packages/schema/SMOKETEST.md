# Smoke Test — @rip-lang/schema

End-to-end validation that the full stack works: schema DSL, code
generation, runtime validation, ORM, and live database queries.

## Prerequisites

```bash
bun bin/rip packages/db/db.rip :memory:   # start rip-db (in-memory)
```

## Tests

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
| **Setup**                     | DROP/CREATE TABLE via `/sql` endpoint, seed 5 users        |
| **Model definition**          | `schema.model 'User', { ... }` wires fields + behavior    |
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
| **Validation**                | Missing `name` and invalid `email` caught by `$validate()` |

### 3. Compiler Regression Test (`test/rip/control.rip`)

Ensures the `or throw` variable hoisting bug stays fixed.

```bash
bun test/runner.js test/rip/control.rip
```

| What                                        | Validates                                        |
|---------------------------------------------|--------------------------------------------------|
| **Sibling export variable independence**     | `store` is declared locally in each function     |

This test catches the bug where `x = expr or throw` inside one exported
function would leak `x` into the program-level variable set, suppressing
its local declaration in sibling functions. This was the root cause of
`rip-db`'s `store is not defined` runtime error.

## Full Test Suite

```bash
bun test/runner.js test/rip     # 1243 tests, 100% passing
```

## What the Fix Unblocked

A single line removed from `src/compiler.js` — the erroneous
`this.programVars.add(target)` in the control-flow short-circuit handler —
fixed the entire chain:

```
src/compiler.js  (compiler bug)
  → packages/api/api.rip  (read() function broken)
    → packages/db/db.rip  (all /sql requests fail)
      → packages/schema/orm.js  (ORM can't query)
        → packages/schema/examples/orm-example.rip  (example can't run)
```
