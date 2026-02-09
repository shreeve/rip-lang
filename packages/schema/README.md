<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip Schema - @rip-lang/schema

> **Define once, use everywhere.**

A unified schema language for types, validation, database models, rich domain objects, UI widgets, and reactive state — all from a single source of truth.

## Overview

Every serious application needs the same things: types, validation, database models, business logic, UI components, and state management. Today, that requires 5-6 different tools and syntaxes that must stay manually synchronized:

```
schema.prisma      → Database schema
types.ts           → TypeScript interfaces
schemas/user.ts    → Zod validation
models/user.rb     → ActiveRecord model
forms/UserForm.tsx → React form component
store/user.ts      → State management
```

**Rip Schema collapses all of this into one coherent system:**

```
User.rip           → Everything
```

One file. One syntax. Always in sync. With capabilities that exceed what any single tool provides today.

---

## What Makes This Different

### Beyond Validation — Truly Reactive Domain Models

Most schema tools stop at validation. Rip Schema goes further, providing **ActiveRecord-style domain models** with **native reactivity**:

- **Inheritance** — `class User extends Model`
- **Instance methods** — Business logic on records
- **Reactive state** — `:=` tracks all changes automatically
- **Computed properties** — `~=` auto-updates when dependencies change
- **Effects** — `~>` auto-runs side effects on change
- **Query API** — `User.find(25)`, `User.where(active: true)`
- **Automatic dirty tracking** — No manual `markDirty()` calls
- **Persistence** — `user.save()`, `user.delete()`

This isn't just a schema language — it's a **reactive ORM** that's cleaner than Rails and more powerful than anything in the JavaScript ecosystem.

### Feature Comparison

| Feature | Zod | Prisma | Rails | Rip Schema |
|---------|-----|--------|-------|------------|
| Type definitions | ✓ | ✓ | ✓ | ✓ |
| Runtime validation | ✓ | ✗ | ✓ | ✓ |
| Database schema | ✗ | ✓ | ✓ | ✓ |
| Relationships | ✗ | ✓ | ✓ | ✓ |
| Instance methods | ✗ | ✗ | ✓ | ✓ |
| Computed properties | ✗ | ✗ | ✓ | **✓ (truly reactive!)** |
| Reactive effects | ✗ | ✗ | ✗ | **✓ (`~>`)** |
| Query builder | ✗ | ✓ | ✓ | ✓ |
| Dirty tracking | ✗ | ✗ | ✓ | **✓ (automatic!)** |
| UI/Form definitions | ✗ | ✗ | ✗ | ✓ |
| Widget system | ✗ | ✗ | ✗ | ✓ |
| State management | ✗ | ✗ | ✗ | ✓ |
| Concise modifiers | ✗ | ✗ | ✗ | ✓ (`!#?`) |
| Centralized schema | ✗ | Partial | ✗ | ✓ |
| Native reactivity | ✗ | ✗ | ✗ | **✓ (`:=`, `~=`, `~>`)** |

---

## Quick Start

```coffee
import { Model, makeCallable, connect } from '@rip-lang/schema/orm'

connect 'http://localhost:4000'  # Connect to rip-db

# Define a rich domain model with native reactivity
class UserModel extends Model
  @table    = 'users'
  @database = 'labs'

  # Schema: types, constraints, defaults — all in one place
  @schema
    id:        { type: 'int', primary: true }
    name:      { type: 'string', required: true, min: 1, max: 100 }
    email:     { type: 'email', required: true, unique: true }
    hairColor: { type: 'string', enum: ['blonde','brown','black','red'], column: 'hair_color' }
    active:    { type: 'bool', default: true }

  # Reactive state (`:=` tracks changes)
  code := null
  codeExpiresAt := null

  # Computed properties (`~=` auto-updates when dependencies change!)
  identifier ~= "#{@name} (##{@id})"
  displayName ~= "#{@name} <#{@email}>"
  isAdmin ~= @role is 'admin'
  isExpired ~= @codeExpiresAt? and Date.now() > @codeExpiresAt

  # Effects (`~>` auto-runs when dependencies change)
  ~> console.log "User #{@id} updated" if @$changed

  # Instance methods — business logic on records
  createAccessCode: (secs = 3600) ->
    syms = 'ABCDEFGHJKMNPQRSTUVWXYZ'.split('')
    @code = [1..5].map(-> syms[Math.floor(Math.random() * syms.length)]).join('')
    @codeExpiresAt = Date.now() + secs * 1000
    @code

  greet: ->
    "Hello, #{@name}!"

# Make it callable: User(25) → User.find(25)
User = makeCallable UserModel

# Query API
user  = User(25)                          # Find by ID
user  = User.find(25)                     # Same thing
users = User([1, 2, 3])                   # Find multiple
users = User.all()                        # All records
users = User.where(active: true).all()   # Filtered
users = User.where('score > ?', 90).orderBy('name').limit(10).all()

# Rich record instances
user.name                                 # Property access
user.hairColor = 'red'                    # Setter (tracks dirty)
user.identifier                           # Computed property
user.createAccessCode(3600)               # Instance method
user.$dirty                               # ['hairColor']
user.$validate()                          # Validate against schema
user.save()                               # Persist changes
```

---

## Why This Is Better Than Rails

### 1. Centralized Schema

**Rails** scatters schema across multiple files:
- `db/migrate/*.rb` — Column types
- `app/models/user.rb` — Validations, callbacks
- Database constraints — Separate layer

**Rip Schema** centralizes everything:

```coffee
@schema
  id:        { type: 'int', primary: true }
  name:      { type: 'string', required: true, min: 1, max: 100 }
  email:     { type: 'email', required: true, unique: true }
  hairColor: { type: 'string', enum: ['blonde','brown','black','red'], column: 'hair_color' }
  active:    { type: 'bool', default: true }
```

Types, constraints, defaults, column mapping — **all in one place**.

### 2. True Reactive Computed Properties

**Rails:**
```ruby
def identifier
  "#{name} (##{id})"
end
```

This is just a method. If `name` changes, you have to remember to call `identifier` again.

**Rip Schema** — Using Rip's native reactivity:
```coffee
class User extends Model
  # Reactive state (`:=` tracks changes)
  name := ''
  score := 0

  # Computed (`~=` auto-updates when dependencies change!)
  identifier ~= "#{@name} (##{@id})"
  isHighScorer ~= @score > 90

  # Effects (`~>` auto-runs when dependencies change)
  ~> console.log "Score changed!" if @score
  ~> @$markDirty('score') if @score isnt @_original.score
```

This is **true reactivity** — computed values automatically track their dependencies and update. Effects run automatically when their dependencies change. No manual invalidation. No stale data bugs.

### 3. Explicit but Terse

Rails relies on "magic" — implicit behaviors that are hard to trace. Rip Schema is explicit but still concise:

| Rails (implicit) | Rip (explicit) |
|------------------|----------------|
| `belongs_to :org` (magic foreign key) | `@belongs_to Organization` |
| `validates :email, presence: true` | `{ required: true }` in schema |
| `before_save :normalize` (hidden callback) | Explicit method call |
| `user.email_changed?` (magic method) | `user.$dirty.includes('email')` |

### 4. Property-Style Access

Both Rails and Rip give you clean property access:

```coffee
user.hairColor              # Read
user.hairColor = 'brown'    # Write (with dirty tracking)
```

But Rip's is backed by explicit schema-defined getters, not metaprogramming magic.

---

## Rip's Native Reactivity

Rip has built-in reactivity primitives that make the ORM truly reactive:

| Operator | Name | Purpose |
|----------|------|---------|
| `:=` | State | Reactive variable that tracks changes |
| `~=` | Computed | Derived value that auto-updates when dependencies change |
| `~>` | Effect | Side effect that auto-runs when dependencies change |

### Reactive Records

```coffee
class User extends Model
  # Reactive state — changes are tracked automatically
  name := ''
  email := ''
  score := 0
  active := true

  # Computed — auto-updates when name or id change
  identifier ~= "#{@name} (##{@id})"
  displayName ~= "#{@name} <#{@email}>"
  isHighScorer ~= @score > 90
  greeting ~= if @active then "Hello, #{@name}!" else "Goodbye!"

  # Effects — auto-run when dependencies change
  ~> console.log "User updated: #{@identifier}"
  ~> @_dirty.add('score') if @score isnt @_original.score
  ~> api.sync!(@) if @$changed and @autoSync
```

### Why This Matters

**Traditional ORMs** require manual change tracking:
```javascript
user.name = 'Alice'
user.markDirty('name')     // Manual!
user.recomputeIdentifier() // Manual!
user.triggerCallbacks()    // Manual!
```

**Rip's reactive ORM** handles it automatically:
```coffee
user.name = 'Alice'
# → identifier auto-updates (it depends on name)
# → dirty tracking auto-updates (effect sees the change)
# → callbacks auto-fire (effects run on change)
```

### Computed vs Methods

Use **computed** (`~=`) when the value is derived from state:
```coffee
# Good — fullName depends on firstName and lastName
fullName ~= "#{@firstName} #{@lastName}"

# Good — isValid depends on multiple fields
isValid ~= @name?.length > 0 and @email =~ /@/
```

Use **methods** when there's logic or side effects:
```coffee
# Good — has side effects (generates random code)
createAccessCode: (secs = 3600) ->
  code = generateRandomCode()
  @code = code
  @codeExpiresAt = Date.now() + secs * 1000
  code

# Good — takes parameters
greetWith: (greeting) -> "#{greeting}, #{@name}!"
```

### Effects for Side Effects

Effects run automatically when their dependencies change:

```coffee
class User extends Model
  # Log changes
  ~> console.log "Name is now: #{@name}"

  # Auto-validate on change
  ~> @_errors = @$validate() if @$changed

  # Auto-save (debounced)
  ~> debounce(1000, => @save!()) if @$changed

  # Sync to server
  ~> api.patch!("/users/#{@id}", @$dirtyData) if @$dirty.length > 0
```

### Controllable Effects

Named effects can be paused/resumed:

```coffee
class User extends Model
  # Named effect — can control it
  autoSaver ~> @save!() if @$changed

  # Pause during bulk updates
  bulkUpdate: (data) ->
    @autoSaver.pause()
    for key, value of data
      @[key] = value
    @autoSaver.resume()
```

---

## Schema Syntax

Rip Schema supports a declarative syntax for defining types, models, widgets, forms, and state:

### Enums

```coffee
# Inline
@enum Role: admin, user, guest

# Block with values
@enum Status
  pending: 0
  active: 1
  suspended: 2
```

### Types (Reusable Structures)

```coffee
@type Address
  street!: string
  city!: string
  state!: string, [2, 2]
  zip!: string, [5, 10]
```

### Models (Database-Backed Entities)

```coffee
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
    isAdmin: -> @role == 'admin'

  @validate
    password: -> @length >= 8 && @matches(/[A-Z]/)
```

### Modifiers

| Modifier | Meaning | Example |
|----------|---------|---------|
| `!` | Required (NOT NULL) | `name!: string` |
| `#` | Unique | `email!#: email` |
| `?` | Optional | `bio?: text` |
| `[min, max]` | Range constraint | `name: string, [1, 100]` |
| `[default]` | Default value | `active: bool, [true]` |

### Widgets (UI Components)

```coffee
@widget DataGrid
  columns!: Column[]
  pageSize: integer, [25]
  selectionMode: SelectionMode, [single]

  @events onSelect, onSort, onAction
```

### Forms (Model + Layout)

```coffee
@form UserForm: User
  name { x: 0, y: 0, span: 2 }
  email { x: 0, y: 1, widget: 'input' }
  role { x: 0, y: 2, widget: 'dropdown' }

  @actions
    save { primary: true }
    cancel {}
```

### State (Reactive State Management)

```coffee
@state App
  currentUser?: User
  theme: string, ['light']
  sidebarOpen: boolean, [true]

  @computed
    isLoggedIn: -> @currentUser?
    isAdmin: -> @currentUser?.role is 'admin'

  @actions
    login { async: true }
    logout {}
```

---

## ORM API Reference

### Model Class Methods

```coffee
User.find(id)                    # Find one by primary key
User.findMany([id1, id2, id3])   # Find multiple by primary keys
User.all()                       # All records
User.first()                     # First record
User.count()                     # Count records
User.where(conditions)           # Start a query
User.create(data)                # Create and save
```

### Callable Syntax

With `makeCallable`, models become callable:

```coffee
User = makeCallable UserModel

User(25)          # → User.find(25)
User([1, 2, 3])   # → User.findMany([1, 2, 3])
User()            # → User.all()
```

### Query Builder

```coffee
User.where(active: true)              # Object conditions
    .where('score > ?', 90)           # SQL conditions
    .orderBy('name', 'ASC')           # Sorting
    .limit(10)                        # Limit
    .offset(20)                       # Offset
    .all()                            # Execute → records
    .first()                          # Execute → single record
    .count()                          # Execute → number
```

### Record Instance

```coffee
# Properties (from schema)
user.name                    # Get
user.name = 'Alice'          # Set (tracks dirty)

# Computed properties
user.identifier              # Reactive getter

# Instance methods
user.createAccessCode(3600)  # Custom business logic

# State inspection
user.$isNew                  # Not yet persisted?
user.$dirty                  # Changed field names
user.$changed                # Any changes?
user.$data                   # Raw data object

# Validation
user.$validate()             # → null or [errors]

# Persistence
user.save()                  # INSERT or UPDATE
user.delete()                # DELETE
user.reload()                # Refresh from DB

# Serialization
user.toJSON()                # Plain object (includes computed)
```

---

## Architecture

```
packages/schema/
├── grammar.rip    # Solar grammar (source of truth)
├── lexer.js       # Indentation-aware tokenizer
├── parser.js      # Generated SLR(1) parser
├── runtime.js     # Schema registry, validation, model factory
├── orm.rip        # ActiveRecord-style ORM
├── index.js       # Public API
├── SCHEMA.md      # Full specification
├── RIP-LANG.md    # Language reference
└── README.md      # This file

packages/db/
├── db.rip         # DuckDB HTTP server
└── lib/duckdb.mjs # Native Zig bindings
```

The architecture separates concerns:

- **@rip-lang/schema** — Schema definitions, validation, ORM, domain models
- **@rip-lang/db** — Database server (DuckDB + HTTP API)

The ORM in `@rip-lang/schema` calls `@rip-lang/db` over HTTP for persistence, keeping the layers cleanly separated.

---

## Roadmap

### Phase 1: Core Runtime ✓
- [x] Type registry (string, email, integer, etc.)
- [x] Schema registry
- [x] Model factory
- [x] Validation engine
- [x] Default values
- [x] Nested types
- [x] Enum validation

### Phase 2: ORM ✓
- [x] Model base class with inheritance
- [x] Schema definition on models
- [x] Property accessors from schema
- [x] Computed properties (reactive)
- [x] Instance methods
- [x] Query builder (where, orderBy, limit)
- [x] Dirty tracking
- [x] Save/delete/reload
- [x] Callable models (`User(25)`)

### Phase 3: Persistence (In Progress)
- [x] DuckDB adapter via HTTP
- [ ] Relationships (`@belongs_to`, `@has_many`)
- [ ] Lazy loading
- [ ] Migrations from schema diff
- [ ] Transaction support

### Phase 4: Reactivity & UI (Planned)
- [ ] Reactive state management
- [ ] Form binding
- [ ] Widget system
- [ ] Hydration/serialization

---

## Background

Rip Schema is inspired by:

- **SPOT/Sage** — Enterprise Java framework that proved unified schemas work at scale (complex medical applications like CPRS)
- **ActiveRecord** — Ruby's elegant ORM pattern
- **Zod** — Runtime validation with great DX
- **TypeScript** — Type inference and safety
- **CoffeeScript** — Concise, expressive syntax
- **Vue/Solid** — Fine-grained reactivity

The key differentiator is **Rip's native reactivity**:

| Operator | Name | What It Does |
|----------|------|--------------|
| `:=` | State | Reactive variable that tracks changes |
| `~=` | Computed | Derived value that auto-updates |
| `~>` | Effect | Side effect that auto-runs on change |

These primitives are built into the Rip language itself, making the ORM truly reactive without any framework overhead. Computed properties automatically track their dependencies. Effects run when dependencies change. Dirty tracking happens automatically.

This brings Vue/Solid-style reactivity to the ORM layer — something no other JavaScript ORM provides.

---

## See Also

- [RIP-LANG.md](./RIP-LANG.md) — Language reference
- [SCHEMA.md](./SCHEMA.md) — Full specification and syntax
- [IDEAS.md](./IDEAS.md) — Syntax exploration and design decisions
- [examples/](./examples/) — Working code examples
