<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.svg" style="width:50px" /> <br>

# Rip Schema - ActiveRecord-Inspired Database DSL

**Beautiful database schemas with Rails elegance and Bun performance**

## Quick Start

```coffeescript
import { schema as Schema } from '@rip-lang/schema'

export default Schema ->
  @table 'users', ->
    @string   'name!', 100        # ! means required
    @email    'email!#'           # Required + unique (auto-indexed)
    @string   'username#'         # Optional + unique (auto-indexed)
    @boolean  'active', true      # Default value
    @timestamps()                 # created_at, updated_at

    # Explicit index documentation (optional but recommended)
    @index    'email#'
    @index    'username#'
```

```bash
# Install
bun add @rip-lang/schema

# Create database from schema
rip-schema db:push
```

## Column Types

```coffeescript
# Text types
@string   'name!', 100        # Required, max length
@text     'bio'               # Unlimited text
@email    'email!'            # Email validation

# Numeric types
@integer  'age', [18]         # With default
@bigint   'user_id!'          # Large integers
@float    'rating'            # Single precision
@double   'latitude'          # Double precision
@decimal  'price', 10, 2      # Exact decimal(10,2)

# Date/Time
@date      'birth_date'
@time      'start_time'
@datetime  'published_at'
@timestamp 'last_seen'

# Other types
@boolean  'active', false     # With default
@json     'settings', {}      # JSON data
@binary   'avatar'            # Binary data
@uuid     'public_id'         # UUID v4
```

## Flexible Parameters

```coffeescript
# Type-based parameters (can be in any order)
@string   'name', 100         # Size as number
@integer  'age', [18]         # Default as array
@decimal  'price', 10, 2      # Precision and scale

# Named parameters (must come last)
@integer  'status', default: 0, unsigned: true
@binary   'data', size: 'long'
@string   'code', size: 10, default: 'ABC'
```

## 🎯 Range Validation (Perfect Design!)

**✅ Common Things Easy** - `[min, max]` (90% of use cases):
```coffeescript
# Numbers: value constraints - super clean!
@integer  'age', [18, 120]           # Between 18 and 120
@integer  'priority', [1, 10], [5]   # Range 1-10, default 5
@decimal  'price', [0.01, 9999.99]   # Price range
@integer  'rating', [1, 5]           # Star rating system

# Strings: length constraints - equally clean!
@string   'username', [3, 20]        # 3-20 characters
@string   'title', [1, 100]          # 1-100 characters
@text     'bio', [0, 500]            # Up to 500 characters
@string   'code', [6, 6]             # Exactly 6 characters
```

**🎯 Rare Things Possible** - `min:` / `max:` (10% of use cases):
```coffeescript
# Only minimum (when max doesn't matter)
@integer  'views', min: 0            # Non-negative numbers
@string   'comment', min: 10         # At least 10 characters

# Only maximum (when min doesn't matter)
@decimal  'discount', max: 1.0       # Up to 100% discount
@text     'bio_short', max: 200      # Reasonable bio limit

# Explicit both (rare but crystal clear)
@integer  'custom_rating', min: 1, max: 5  # Explicit 1-5 range
```

**🔥 Perfect Consistency with `read()` Function:**
```coffeescript
# IDENTICAL SYNTAX - Define once, validate everywhere!
# Schema definition:
@string   'username', [3, 20]
@integer  'age', [18, 120]
@integer  'views', min: 0

# Runtime validation (in your API):
username = read 'username', [3, 20]      # Same syntax!
age = read 'age', [18, 120]             # Same syntax!
views = read 'views', min: 0             # Same syntax!
```

## Special Features

```coffeescript
# Required fields and unique indexes
@string   'email!'            # ! suffix = required
@index    'email#'            # # suffix = unique

# Timestamps helper
@timestamps()                 # Adds created_at, updated_at

# Table options
@table 'posts', id: false, timestamps: false, ->
  @bigint 'custom_id!'

# Custom primary key
@table 'accounts', primary_key: 'account_num', ->
  @string 'account_num!', 20
```

## CLI Commands

```bash
# Push schema to database (default: ./db/schema.rip → ./db.db)
rip-schema db:push

# Generate Zod validation schemas
rip-schema zod:generate

# Save generated schemas to file
rip-schema zod:generate > types/schemas.ts

# Show complete schema including auto-generated indexes
rip-schema schema:dump

# Custom paths
rip-schema db:push -s myschema.rip -d mydb.db

# Drop all tables
rip-schema db:drop

# Verbose output
rip-schema db:push -v
```

## 🎯 Zod Generation - Single Source of Truth

**Generate type-safe Zod validation schemas directly from your database schema!**

### The Complete Workflow

```bash
# 1. Define your schema once
vim db/schema.rip

# 2. Push to database
rip-schema db:push

# 3. Generate validation schemas
rip-schema zod:generate > types/schemas.ts

# 4. Use in your API with full type safety!
```

### From Schema to Validation

**Input** (`db/schema.rip`):
```coffeescript
export default schema ->
  @table 'users', ->
    @integer  'id!', primary: true, autoIncrement: true
    @email    'email!', unique: true
    @string   'firstName!', 100
    @string   'lastName!', 100
    @string   'phone!', 20
    @boolean  'admin', false
    @json     'preferences'
    @timestamps()
```

**Generated Output** (`types/schemas.ts`):
```typescript
import { z } from 'zod'

export const UserSchema = z.object({
  id: z.number().int(),
  email: z.string().email(),
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  phone: z.string().max(20),
  admin: z.boolean().default(false),
  preferences: z.record(z.unknown()).optional()
})

export type User = z.infer<typeof UserSchema>
```

### Use in Your API

```coffeescript
# Import generated schemas
import { UserSchema } from './types/schemas'
import { zValidator } from '@hono/zod-validator'

# Type-safe API endpoints
app.post '/users', zValidator('json', UserSchema.pick({
  email: true
  firstName: true
  lastName: true
  phone: true
})), (c) ->
  data = c.req.valid 'json'  # Fully validated & typed!

  user = db.insert(users).values(data).returning().get!
  c.json { user }

# Partial updates
app.patch '/users/:id', zValidator('json', UserSchema.partial().pick({
  firstName: true
  lastName: true
  preferences: true
})), (c) ->
  data = c.req.valid 'json'  # Type-safe partial updates!
```

### Benefits

- ✅ **Single Source of Truth** - One schema for database + validation
- ✅ **Type Safety** - Generated TypeScript types with `z.infer`
- ✅ **Auto-Completion** - Full IDE support for all fields
- ✅ **Validation** - Request/response validation with Zod
- ✅ **Consistency** - Database structure matches API contracts

## Real Example

```coffeescript
import { schema as Schema } from '@rip-lang/schema'

export default Schema ->

  @table 'users', ->
    @string   'name!', 100
    @email    'email!'
    @string   'password_digest!'
    @boolean  'active', true
    @json     'preferences', {}
    @timestamps()

    @index    'email#'

  @table 'posts', ->
    @bigint   'user_id!'
    @string   'title!', 200
    @string   'slug!', 200
    @text     'content!'
    @boolean  'published', false
    @datetime 'published_at'
    @timestamps()

    @index    'slug#'
    @index    ['user_id', 'published']

  @table 'comments', ->
    @bigint   'post_id!'
    @bigint   'user_id!'
    @text     'content!'
    @boolean  'approved', false
    @timestamps()

    @index    'post_id'
```

## Documentation

- 📋 [**Development Status**](./docs/status.md) - Current status, roadmap, and timeline
- 📝 [**Changelog**](./CHANGELOG.md) - Version history and release notes
- 🚀 [**Examples**](../../examples/) - Real-world usage patterns

## ✅ Latest Features

**🎉 Zod Validation Generation** - Now available! Generate type-safe Zod schemas directly from your database schema with `rip-schema zod:generate`. Complete single-source-of-truth workflow from schema → database → API validation.

**🤖 Auto-Indexing for Unique Fields** - Unique fields automatically get unique indexes for optimal performance. Explicit index declarations are encouraged for documentation but not required.

**📋 Schema Dumping** - Use `rip-schema schema:dump` to see your complete schema including all auto-generated indexes for full transparency.

**🔥 Hash (#) Syntax for Unique Fields** - New shortcut syntax inspired by CSS! Use `field#` for unique fields, just like `#id` in CSS. Combines perfectly with `!` for required fields.

## 🔥 Hash (#) Syntax for Unique Fields

**Inspired by CSS `#id` selectors - concise and familiar syntax for unique constraints!**

### The New Syntax

```coffeescript
@table 'users', ->
  # New hash syntax - inspired by CSS #id selectors
  @string   'username#'          # Optional + Unique
  @email    'email!#'            # Required + Unique
  @integer  'badge_id#'          # Integer Unique
  @string   'handle#!'           # Unique + Required (either order works)

  # Traditional syntax still works
  @string   'api_key', unique: true    # Traditional approach
```

### All Combinations

| Syntax | Database Constraint | Meaning |
|--------|-------------------|---------|
| `field#` | `UNIQUE` | Optional but unique |
| `field!` | `NOT NULL` | Required, duplicates OK |
| `field!#` | `NOT NULL + UNIQUE` | Required and unique |
| `field#!` | `NOT NULL + UNIQUE` | Same as above (order doesn't matter) |
| `field` | No constraints | Optional, duplicates OK |

### CSS Inspiration

Just like CSS uses `#id` for unique page elements:

```css
/* CSS: # means unique identifier */
#header { color: blue; }
#footer { color: gray; }
```

```coffeescript
# Rip Schema: # means unique field
@string 'username#'     # Unique username
@email  'email#'        # Unique email
```

### Benefits

- ✅ **Concise** - `field#` vs `field, unique: true`
- ✅ **Familiar** - CSS developers instantly understand
- ✅ **Flexible** - Works with any field type
- ✅ **Combinable** - Mix with `!` for required fields
- ✅ **Backward Compatible** - Traditional syntax still works
- ✅ **Auto-Indexed** - Unique fields automatically get indexes

### Real-World Examples

```coffeescript
@table 'users', ->
  @email    'email!#'            # Login email (required + unique)
  @string   'username#'          # Optional handle (unique if provided)
  @string   'firstName!'         # Required name (not unique)
  @string   'external_id#'       # Optional external system ID (unique)
  @integer  'badge_number#'      # Optional badge (unique if provided)
```

## 🤖 Auto-Indexing for Unique Fields

**Unique fields automatically get unique indexes - no more forgetting to index your constraints!**

### How It Works

```coffeescript
@table 'users', ->
  # Using new hash syntax
  @email    'email!#'      # ✅ Auto-indexed (required + unique)
  @string   'username#'    # ✅ Auto-indexed (optional + unique)
  @string   'firstName!'   # ❌ Not unique - no auto-index
  @string   'handle!#'     # ✅ Auto-indexed (required + unique)

  # Traditional syntax also auto-indexed
  @string   'api_key', unique: true  # ✅ Auto-indexed
```

**Behind the scenes**, rip-schema automatically creates unique indexes for:
- `email` (unique index from `email!#`)
- `username` (unique index from `username#`)
- `handle` (unique index from `handle!#`)
- `api_key` (unique index from traditional syntax)

### Best Practice: Explicit Documentation

While auto-indexing works silently, **explicit is better than implicit**:

```coffeescript
@table 'users', ->
  # New concise hash syntax
  @email    'email!#'         # Required + unique
  @string   'username#'       # Optional + unique
  @string   'firstName!'      # Required only
  @string   'phone!#'         # Required + unique

  # Explicit index documentation (recommended!)
  @index 'email#'                    # ✅ Self-documenting
  @index 'username#'                 # ✅ Clear intent
  @index 'phone#'                    # ✅ Visible to team
  @index 'firstName'                  # Manual non-unique index
```

### Schema Transparency

Use `rip-schema schema:dump` to see the complete picture:

```bash
$ rip-schema schema:dump
```

```coffeescript
@table 'users', ->
  # ... field definitions ...

  # Indexes:
  @index 'email#'                   # Auto-generated from unique field
  @index 'username#'                # Auto-generated from unique field
  @index 'phone#'                   # Auto-generated from unique field
  @index 'firstName'                # Manual non-unique index
```

### Benefits

- ✅ **Performance** - Unique fields are always properly indexed
- ✅ **Safety** - Can't forget to index unique constraints
- ✅ **Documentation** - Explicit indexes serve as clear intent
- ✅ **Transparency** - Schema dumping shows complete picture
- ✅ **No Duplicates** - Smart detection prevents redundant indexes

## 🤔 Unique vs Required: Understanding the Difference

**Important**: `unique` and `required` are completely separate concepts!

### The Four Combinations

```coffeescript
@table 'users', ->
  # 1. Required + Unique (most common for identifiers)
  @email    'email!', unique: true       # Must exist, must be unique

  # 2. Optional + Unique (common for optional identifiers)
  @string   'username', unique: true     # Can be null, but if present must be unique

  # 3. Required Only (common for data fields)
  @string   'firstName!', 100            # Must exist, duplicates allowed

  # 4. Optional Only (common for optional data)
  @string   'bio'                        # Can be null, duplicates allowed
```

### Real-World Examples from Our Labs Schema

```coffeescript
# Required + Unique: Login credentials
@email    'email!', unique: true         # ✅ john@example.com, ❌ NULL, ❌ duplicates

# Optional + Unique: Verification codes
@string   'code', unique: true           # ✅ 'ABC123', ✅ NULL (multiple), ❌ duplicates

# Required + Unique: Specimen tracking
@string   'barcode!', unique: true       # ✅ 'SP001', ❌ NULL, ❌ duplicates
```

### Key Database Behavior

**UNIQUE constraint allows multiple NULLs** because:
- `NULL ≠ NULL` in SQL (unknowns are not considered equal)
- Multiple rows can have `NULL` in a unique column
- Only non-NULL values must be unique

### Auto-Indexing Behavior

**All unique fields get indexed**, regardless of whether they're required:

```coffeescript
@string   'username', unique: true       # 🤖 Auto-indexed (optional unique)
@email    'email!', unique: true         # 🤖 Auto-indexed (required unique)
@string   'firstName!'                   # ❌ Not indexed (required only)
```

### When to Use Each Pattern

| Pattern | Use Case | Examples |
|---------|----------|----------|
| `field!, unique: true` | **Primary identifiers** | email, username, SSN, barcode |
| `field, unique: true` | **Optional identifiers** | external_id, verification_code, handle |
| `field!` | **Required data** | firstName, phone, address |
| `field` | **Optional data** | bio, notes, preferences |

## 🔮 Future Enhancements - Reusability & Composition

**Reusable field groups and composable schemas for even cleaner definitions:**

### Reusable Field Mixins
```coffeescript
# Define reusable field groups
@mixin 'AddressFields', ->
  @string 'street!'
  @string 'city!'
  @string 'state!', 2
  @string 'zip!', { regex: /^\d{5}$/ }

# Use in multiple tables
@table 'users', ->
  @string 'name!'
  @email  'email!'
  @include AddressFields  # Injects all address fields
  @timestamps()

@table 'companies', ->
  @string 'name!'
  @include AddressFields  # Same address fields
  @timestamps()
```

### Composable Schema Objects
```coffeescript
# Define reusable schema objects
@object 'Address', ->
  @string 'street!'
  @string 'city!'
  @string 'state!', 2
  @string 'zip!', { regex: /^\d{5}$/ }

@object 'ContactInfo', ->
  @email  'email!'
  @string 'phone!', 20

# Compose into tables
@table 'profiles', ->
  @string 'name!'
  @embed  Address      # Embeds as nested fields
  @embed  ContactInfo  # Reusable contact fields
  @timestamps()
```

### Macro Fields - Advanced Composition
```coffeescript
# Define reusable field macros
export SoftDeletes = =>
  @datetime 'deleted_at'

export Timestamps = =>
  @datetime 'created_at'
  @datetime 'updated_at'

# Use in tables
@table 'comments', ->
  @text 'content!'
  @include Timestamps
  @include SoftDeletes

# Or even better - as helper methods
@table 'comments', ->
  @text 'content!'
  @timestamps()    # still fine
  @softDeletes()
```

### Advanced: Nested Reuse
```coffeescript
# Compose macros from other macros
export Auditable = =>
  @include Timestamps
  @include SoftDeletes

# Use the composed macro
@table 'posts', ->
  @string 'title!'
  @text   'content!'
  @include Auditable    # Gets both timestamps and soft deletes
```

### Enum Support - Named Value Sets
```coffeescript
# Define enums with clean syntax
@enum 'order_status', 'pending', 'paid', 'shipped'
@enum 'user_role', 'admin', 'user', 'guest'
@enum 'priority', 'low', 'medium', 'high', 'critical'

# Use in tables
@table 'orders', ->
  @string 'number!'
  @enum   'status!', 'order_status'    # References the enum
  @timestamps()

@table 'users', ->
  @string 'name!'
  @enum   'role!', 'user_role', default: 'user'
  @timestamps()
```

### Generated Output
```typescript
// Generated enum types
export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  SHIPPED = 'shipped'
}

// Generated Zod schemas
export const OrderSchema = z.object({
  number: z.string(),
  status: z.nativeEnum(OrderStatus),
  created_at: z.date(),
  updated_at: z.date()
})
```

### Benefits
- ✅ **DRY Principle** - Define common patterns once
- ✅ **Consistency** - Same validation across tables
- ✅ **Maintainability** - Update address format in one place
- ✅ **Composability** - Mix and match field groups
- ✅ **Macro Power** - Domain-specific field patterns
- ✅ **Nested Composition** - Macros can include other macros
- ✅ **Enum Support** - Clean named value sets with TypeScript enums
- ✅ **Type Safety** - Generated Zod schemas include mixins

## 🎯 Real-World Terminal Examples

**See it in action! Here's actual terminal output from a working Rip project:**

### Basic Zod Generation
```bash
$ rip-schema zod:generate
import { z } from 'zod'

export const UserSchema = z.object({
  id: z.number().int(),
  email: z.string().email(),
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  phone: z.string().max(20),
  sex: z.string().max(10),
  dob: z.string().max(10),
  photo: z.string().optional(),
  cart: z.record(z.unknown()).optional(),
  shippingAddress: z.record(z.unknown()).optional(),
  meta: z.record(z.unknown()).optional(),
  admin: z.boolean().default(false)
})

export type User = z.infer<typeof UserSchema>

export const OrderSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  number: z.string().max(50),
  payment: z.string().max(100),
  subtotal: z.number().int(),
  total: z.number().int(),
  meta: z.record(z.unknown())
})

export type Order = z.infer<typeof OrderSchema>
```

### Save to File
```bash
$ mkdir -p types && rip-schema zod:generate > types/schemas.ts
$ ls -la types/
total 8.0K
drwxr-xr-x  4 shreeve staff  128 Aug  3 22:42 ./
drwxr-xr-x 12 shreeve staff  384 Aug  3 22:39 ../
-rw-r--r--  1 shreeve staff 1.5K Aug  3 22:42 complete-schemas.ts
-rw-r--r--  1 shreeve staff  645 Aug  3 22:39 schemas.ts
```

### Verbose Output
```bash
$ rip-schema zod:generate -v
🔍 Reading schema from: /Users/shreeve/Data/Code/rip/apps/labs/server/db/schema.rip
import { z } from 'zod'
export const UserSchema = z.object({
  id: z.number().int(),
  email: z.string().email(),
  firstName: z.string().max(100),
  lastName: z.string().max(100),
  phone: z.string().max(20),
  admin: z.boolean().default(false)
})
export type User = z.infer<typeof UserSchema>
✅ Zod schemas generated successfully!
```

### Available Commands
```bash
$ rip-schema --help
🚀 rip-schema CLI

Commands:
  db:push              Sync your schema to the database (no migrations)
  db:drop              Drop all tables (dangerous!)
  db:seed              Run seed files
  zod:generate         Generate Zod validation schemas from your schema

Options:
  -s, --schema PATH    Path to schema file (default: ./db/schema.rip)
  -d, --database PATH  Path to database file (default: ./db/api.db)
  -v, --verbose        Show detailed output
  -h, --help           Show this help message

Examples:
  rip-schema db:push
  rip-schema db:push -s ./schema.rip -d ./dev.db
  rip-schema db:drop
  rip-schema zod:generate > ./types/schema.ts
```

### 🎉 Key Features Demonstrated
- ✅ **Automatic type detection**: `email!` → `z.string().email()`
- ✅ **Size constraints**: `string 100` → `z.string().max(100)`
- ✅ **Optional fields**: Missing `!` → `.optional()`
- ✅ **Default values**: `boolean false` → `z.boolean().default(false)`
- ✅ **JSON support**: `json` → `z.record(z.unknown())`
- ✅ **TypeScript inference**: `z.infer<typeof UserSchema>`

## License

MIT

## Contributing

Rip Schema is part of the Rip ecosystem. Contributions welcome!

---

Built with ❤️ for the Bun community