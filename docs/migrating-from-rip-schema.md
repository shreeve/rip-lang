# Migrating from `@rip-lang/schema`

The `@rip-lang/schema` package has been removed. Schemas are now a
first-class language construct — the `schema` keyword declares them
inline anywhere an expression is valid. This guide translates the old
package API to the new one.

## What changed

- `.schema` files are gone. All schema declarations live in `.rip`
  source.
- `import { Schema } from '@rip-lang/schema'` and `Schema.load(path)`
  are gone. The package isn't published anymore.
- `schema.model('User')` dynamic lookup is gone. Each declared model
  is its own exported value.
- The old `$validate / $isNew / $dirty / $data` instance properties
  are gone. Use the new `.ok() / .errors() / .save() / ._persisted`
  instance API.

Everything else maps 1:1 — ORM method names (`find`, `where`, `create`,
`save`, `destroy`), directive names (`@belongs_to`, `@has_many`,
`@timestamps`, `@softDelete`, `@index`), and field modifiers (`!`, `#`,
`?`) all keep their meanings.

## Minimal migration template

### Before

```coffee
# api/db.rip
import { Schema } from '@rip-lang/schema/orm'
export schema = do ->
  s = Schema.load '../app.schema', import.meta.url
  s.connect DB_URL
  s
```

```coffee
# app.schema
@model User
  name!  string
  email!# email
  @timestamps
```

```coffee
# api/routes/users.rip
import { schema } from '../db.rip'
User = schema.model 'User'
user = User.find! id
```

### After

```coffee
# api/models.rip
export User = schema :model
  name!  string
  email!# email
  @timestamps
```

```coffee
# api/db.rip
export * from './models.rip'

globalThis.__ripSchema.__schemaSetAdapter
  query: (sql, params) -> ...   # fetch to rip-db, same as before
```

```coffee
# api/routes/users.rip
import { User } from '../db.rip'
user = User.find! id
```

## DDL migration

The old Rails-style `schema.toSQL()` walked every model at once. The
new `.toSQL()` is per-model. Compose them in dependency order yourself
for migration scripts:

```coffee
ddl = [User.toSQL(), Order.toSQL(), OrderItem.toSQL()].join('\n\n')
```

## Validation migration

- `Schema.validate(typeName, data)` → `Schema.safe(data)`. Returns
  `{ok, value, errors}` instead of a plain error array.
- `instance.$validate()` → `instance.errors()`. Returns the same
  error array (or an empty array when valid).
- `instance.$isNew` → `!instance._persisted`. `_persisted` is
  non-enumerable on hydrated instances.

## Migration affordances

Three backward-compat conveniences ease the transition and are safe to
keep using long-term:

- **Snake and camel both work on instance fields.** After hydration
  or `.create()`, `order.user_id` and `order.userId` are the same
  slot. Declared fields canonicalize to camelCase; DB columns
  canonicalize to snake_case.
- **`.create(data)` accepts either casing.** Pass `{user_id: 1}` or
  `{userId: 1}`; the runtime normalizes before inserting.
- **`orderBy(spec)` alias for `order(spec)`** on the query builder.

These aren't deprecated — they're the real recommended shape for
cross-language (JS↔SQL) ergonomics.

## New things worth adopting

The schema keyword adds capabilities the old package didn't have. You
don't have to use them during the migration, but they're why it
exists:

- **`:shape`** for validators that need methods or computed getters
  but aren't DB-backed.
- **`:enum`** with valued members and type-predicate `.ok()`.
- **Schema algebra** — `.pick/.omit/.partial/.required/.extend`
  returning derived `:shape` values.
- **Shadow TypeScript** — every named schema gets `Schema<T>` or
  `ModelSchema<Instance, Data>` declarations for autocomplete.
- **Rails-ordered hooks** — `beforeValidation`, `afterCreate`, etc.
  recognized by name on `:model`.

See `docs/RIP-LANG.md` for the full language reference.
