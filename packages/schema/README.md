<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.svg" style="width:50px" /> <br>

# Rip Schema

A unified schema language for types, validation, database models, UI widgets, and reactive state.

## Vision

**Define once, use everywhere.**

Rip Schema provides a single source of truth that replaces:
- TypeScript interfaces
- Zod/Yup validation schemas
- ORM model definitions
- Database migrations
- Form configurations
- UI component props

Inspired by [SPOT/Sage](./SCHEMA.md), rip-schema, TypeScript, and Zod.

## Why Rip Schema?

### The Problem

Every serious app needs types + validation + database + UI. Today that requires 4-5 different tools:

```
schema.prisma      → Database
types.ts           → TypeScript types
schemas/user.ts    → Zod validation
forms/UserForm.tsx → React form component
store/user.ts      → State management
```

5 files, 5 syntaxes, must stay in sync manually.

### The Solution

```
user.schema        → Everything
```

1 file, 1 syntax, always in sync.

### Comparison with Alternatives

| Tool | What It Does | Limitation |
|------|--------------|------------|
| **Zod** | Runtime validation | JS API, validation only, no UI/DB |
| **Yup** | Form validation | JS API, forms only |
| **Prisma** | Database ORM | DB only, no validation/UI |
| **GraphQL** | API schema | API layer only |
| **JSON Schema** | Standard format | Verbose, no UI/state |

### Feature Matrix

| Feature | Zod | Prisma | GraphQL | Rip Schema |
|---------|-----|--------|---------|------------|
| Type definitions | ✓ | ✓ | ✓ | ✓ |
| Runtime validation | ✓ | ✗ | ✗ | ✓ |
| Database schema | ✗ | ✓ | ✗ | ✓ |
| Relationships | ✗ | ✓ | ✓ | ✓ |
| UI/Form definitions | ✗ | ✗ | ✗ | ✓ |
| Widget definitions | ✗ | ✗ | ✗ | ✓ |
| State management | ✗ | ✗ | ✗ | ✓ |
| Concise modifiers | ✗ | ✗ | ✗ | ✓ (`!#?`) |

### Syntax Comparison

**Zod** (programmatic, validation only):
```typescript
const UserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
})
```

**Prisma** (DB only, separate validation needed):
```prisma
model User {
  id     Int     @id @default(autoincrement())
  name   String
  email  String  @unique
  role   Role    @default(user)
}
```

**Rip Schema** (unified):
```coffeescript
@model User
  name!: string, [1, 100]
  email!#: email
  role: Role, [user]

  @timestamps
  @belongs_to Organization

@form UserForm: User
  name { x: 0, y: 0 }
  email { x: 0, y: 1 }
```

### What Makes This Unique

No existing JavaScript tool combines validation + DB + UI + state in a single declarative schema language.

The closest precedent is **Sage/SPOT** (Java-based), which proved this architecture works at enterprise scale. Rip Schema brings the same approach to modern JavaScript.

## What's Implemented

### Parser Pipeline (Complete)

```
.schema file → Lexer → Tokens → Parser → AST
```

| File | Purpose |
|------|---------|
| `grammar.rip` | Solar grammar definition (51 rules) |
| `lexer.js` | Indentation-aware tokenizer |
| `parser.js` | Generated SLR(1) parser (268 states) |
| `index.js` | Module entry point |

### Syntax Support (Complete)

```coffeescript
# Enums - inline or block
@enum Role: admin, user, guest
@enum Status
  pending: 0
  active: 1

# Types - reusable structures (no DB)
@type Address
  street!: string
  city!: string
  zip!: string, [5, 10]

# Models - database-backed entities
@model User
  name!: string, [1, 100]       # ! = required, [min, max]
  email!#: email                # # = unique
  role?: Role, [user]           # ? = optional, [default]
  settings: json, [{}]          # JSON with default
  tags: string[]                # Array type

  @timestamps                   # createdAt, updatedAt
  @softDelete                   # deletedAt
  @index email#                 # Unique index
  @index [role, active]         # Composite index

  @belongs_to Organization
  @has_many Post

  @computed
    displayName: -> "#{@name} <#{@email}>"
    isAdmin: -> @role == "admin"

  @validate
    password: -> @length >= 8 && @matches(/[A-Z]/)

# Mixins - reusable field groups
@mixin Auditable
  createdBy!: User
  updatedBy?: User

# Widgets - UI components
@widget DataGrid
  columns!: Column[]
  pageSize: integer, [25]
  @events onSelect, onSort

# Forms - model + layout
@form UserForm: User
  name { x: 0, y: 0, span: 2 }
  email { x: 0, y: 1, widget: "input" }
  @actions
    save { primary: true }

# State - reactive state management
@state App
  currentUser?: User
  theme: string, ["light"]
  @computed
    isLoggedIn: -> @currentUser?
  @actions
    login { async: true }
```

### Build Tooling (Complete)

```bash
# Regenerate parser from grammar
bun scripts/build-schema-parser.js

# Test parser
bun test/schema/test-parser.js basic.schema
bun test/schema/test-parser.js comprehensive.schema --tokens
```

## What's Next

### Phase 1: Core Runtime (Complete)

- [x] **Type Registry** - Built-in validators (string, email, integer, url, etc.)
- [x] **Schema Registry** - Store parsed schemas, resolve type references
- [x] **Model Factory** - Create instances from `@model` definitions
- [x] **Validation Engine** - Enforce constraints, collect errors
- [x] **Default Values** - Apply `[default]` on instantiation
- [x] **Nested Types** - Validate embedded `@type` within `@model`
- [x] **Enum Validation** - Validate against `@enum` values
- [ ] **Custom Validators** - Run `@validate` blocks (TODO)

### Phase 2: Enhanced Features (Medium)

- [ ] **Computed Fields** - Reactive getters from `@computed`
- [x] **Nested Types** - Embed `@type` within `@model` (done in Phase 1)
- [x] **Array Validation** - Validate `string[]`, `User[]`, etc. (done in Phase 1)
- [ ] **Custom Validators** - User-defined validation functions
- [ ] **Type Coercion** - Auto-convert compatible types

### Phase 3: Persistence (Hard)

- [ ] **Database Adapters** - SQLite, PostgreSQL, etc.
- [ ] **Relationships** - `@belongs_to`, `@has_many` with lazy loading
- [ ] **Migrations** - Generate DDL from schema changes
- [ ] **Query Builder** - Type-safe queries

### Phase 4: Reactivity & UI (Hard)

- [ ] **State Management** - Reactive `@state` with subscriptions
- [ ] **Form Binding** - Connect `@form` to UI components
- [ ] **Widget System** - Render `@widget` definitions
- [ ] **Hydration** - Serialize/restore state

## Usage

```javascript
import { parse, Schema } from '@rip-lang/schema'

// Parse schema source
const ast = parse(`
  @enum Role: admin, user, guest

  @model User
    name!: string, [1, 100]
    email!#: email
    role: Role, [user]
    active: boolean, [true]
`)

// Create runtime schema
const schema = new Schema()
schema.register(ast)

// Create validated instances
const user = schema.create('User', {
  name: 'John Doe',
  email: 'john@example.com',
})

console.log(user.role)    // 'user' (default)
console.log(user.active)  // true (default)

// Validate
const errors = user.$validate()
console.log(errors)  // null (valid)

// Invalid data
const bad = schema.create('User', { name: 'X' })
bad.email = 'not-an-email'
console.log(bad.$validate())
// [{ field: 'email', error: 'type', message: 'email must be a valid email' }]
```

### Performance

```
10,000 create+validate cycles: ~10ms
Per operation: ~1µs
```

## Architecture

```
packages/schema/
├── grammar.rip    # Solar grammar (source of truth)
├── lexer.js       # Hand-written tokenizer
├── parser.js      # Generated (DO NOT EDIT)
├── runtime.js     # Schema registry, validation, model factory
├── index.js       # Public API
├── SCHEMA.md      # Full specification
└── README.md      # This file

test/schema/
├── basic.schema
├── comprehensive.schema
├── test-parser.js
└── test-runtime.js
```

## See Also

- [GUIDE.md](./GUIDE.md) - Practical examples and use cases
- [SCHEMA.md](./SCHEMA.md) - Full specification and syntax
- [PHILOSOPHY.md](../../docs/PHILOSOPHY.md) - Rip language philosophy
