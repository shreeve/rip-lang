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
| **Parse**                     | Schema DSL parses 2 enums, 1 type, 4 models               |
| **TypeScript generation**     | Produces `.d.ts` with interfaces, enums, JSDoc constraints |
| **SQL DDL generation**        | Produces CREATE TABLE / CREATE TYPE with constraints        |
| **Valid instance**            | `schema.create('User', {...})` applies defaults, passes    |
| **Missing required field**    | Catches missing `email`                                    |
| **Invalid email**             | Catches `not-an-email` format                              |
| **String max length**         | Catches name > 100 chars                                   |
| **Invalid enum**              | Catches `superadmin` not in `Role` enum                    |
| **Nested type validation**    | Catches multiple violations in `Address` sub-object        |
| **Enum + integer defaults**   | `Post` gets correct `status` and `views` defaults          |
| **File output**               | Writes `generated/app.d.ts` and `generated/app.sql`        |

### 2. ORM with Live Database (`examples/orm-example.rip`)

Connects to `rip-db`, creates a table, seeds data, and exercises the full
ActiveRecord-style ORM.

```bash
bun bin/rip packages/schema/examples/orm-example.rip
```

| What                          | Validates                                                 |
|-------------------------------|-----------------------------------------------------------|
| **Setup**                     | DROP/CREATE TABLE via `/sql` endpoint, seed 5 users        |
| **Find by ID (callable)**     | `User(1)` returns Alice with all fields                    |
| **Find by ID (method)**       | `User.find(2)` returns Bob                                 |
| **Computed properties**       | `identifier` and `isHighScorer` derive from fields         |
| **All users**                 | `User.all()` returns all 5 records                         |
| **Where (object style)**      | `User.where(name: 'Alice')` filters correctly              |
| **Where (SQL style)**         | `User.where('score > ?', 90)` with parameterized query     |
| **Chainable query**           | `.where().orderBy().limit()` chains produce correct SQL     |
| **Count**                     | `User.count()` returns 5                                   |
| **Instance methods**          | `createAccessCode()` and `greet()` work on model instances |
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
