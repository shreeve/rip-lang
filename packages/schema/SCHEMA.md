# Rip Unified Schema System

**A Single Source of Truth for Types, Validation, Database, UI, and State**

## Vision

Create a unified schema mechanism that combines the best ideas from:

- **SPOT/Sparse Notation** — Formal type system, proven with 100+ Sage widgets
- **rip-schema** — Concise Rails-like DSL, modern tooling
- **TypeScript** — Type inference, generics, discriminated unions
- **Zod** — Runtime validation, composable schemas
- **Sage** — Declarative UI, layout system, event model
- **Vue State** — Path-based state management, hydration

The goal: **Define once, generate everything.**

---

## Table of Contents

1. [Design Principles](#design-principles)
   - [Schema-First Architecture](#5-schema-first-architecture)
2. [Syntax Comparison](#syntax-comparison)
3. [Unified Syntax Specification](#unified-syntax-specification)
4. [Generation Targets](#generation-targets)
5. [Core Types](#core-types)
6. [Enums](#enums)
7. [Models (Database + Validation)](#models)
8. [Widgets (UI Components)](#widgets)
9. [Forms (Model + Layout)](#forms)
10. [State Management](#state-management)
11. [Composition and Reuse](#composition-and-reuse)
12. [Implementation Roadmap](#implementation-roadmap)

---

## Design Principles

### 1. Common Things Easy, Rare Things Possible

```coffeescript
# Easy (90% of cases)
@string 'username!', [3, 20]        # Required, 3-20 chars

# Possible (10% of cases)
@string 'code', min: 3, max: 20, pattern: /^[A-Z]+$/, transform: upper
```

### 2. Concise but Complete

```coffeescript
# Concise syntax with full power
@model User
  email!#   email                   # Required + Unique (one line)
  role!     Role, [user]            # Enum with default
  settings? json, [{}]              # Optional with default
```

### 3. Single Source of Truth (SPOT)

One schema definition generates:
- TypeScript types
- Zod validators
- SQL DDL / migrations
- UI component props
- Form layouts
- API contracts

### 4. Familiar Conventions

| Convention | Meaning | Origin |
|------------|---------|--------|
| `!` suffix | Required | rip-schema |
| `#` suffix | Unique | rip-schema (CSS `#id`) |
| `?` suffix | Optional | TypeScript |
| `[min, max]` | Range | rip-schema |
| `[default]` | Default value | rip-schema |
| `$Parent` | Inheritance | Sage |
| `@name` | Named definition | Sage |

### 5. Schema-First Architecture

When you think schema-first, state becomes the single source of truth, and the UI becomes a pure renderer of valid state:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Schema ──────► State ──────► UI                           │
│     │              │            │                           │
│   defines       always        just                          │
│   structure     valid         renders                       │
│                                                             │
│   User Action ──► Validate ──► Update State ──► Re-render   │
│                     │                                       │
│                  reject if                                  │
│                  invalid                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**The guarantees:**

| Layer | Guarantee |
|-------|-----------|
| **State** | Always matches schema |
| **UI** | Always receives valid data |
| **Actions** | Can't corrupt state |
| **Persistence** | Only valid data saved |

**UI becomes dumb (in a good way):**

```javascript
// BEFORE: Defensive coding everywhere
function PatientCard({ patient }) {
  if (!patient) return null
  if (!patient.name || typeof patient.name !== 'string') return <Error />
  if (patient.name.length > 100) patient.name = patient.name.slice(0, 100)
  // ... 50 more checks
}

// AFTER: Trust the state - it's always valid
function PatientCard({ patient }) {
  return (
    <div>
      <h2>{patient.name}</h2>        {/* Guaranteed string, 1-100 chars */}
      <p>{patient.email}</p>         {/* Guaranteed valid email */}
      <Badge>{patient.role}</Badge>  {/* Guaranteed valid enum */}
    </div>
  )
}
```

**Mutations go through schema validation:**

```javascript
// State update = validate + commit
app.set('/currentPatient/name', 'John Doe')
// → Schema validates 'John Doe' is string [1,100]
// → If valid: state updates, UI re-renders
// → If invalid: rejected, state unchanged

// Batch updates are atomic
app.update('/currentPatient', { name: 'John', email: 'john@example.com' })
// → Schema validates entire Patient object
// → All or nothing
```

**The UI is just a function of valid state:**

```
UI = render(validState)
```

No more validity checks in components. No more defensive coding. No more "what if the data is wrong?" — the data CAN'T be wrong because it passed schema validation.

This is exactly how Sage worked: the UI was "dumb" — it just rendered whatever state the engine gave it. All the smarts were in the schema + engine layer. This architecture enabled teams to build complex medical UIs (like CPRS) faster than traditional approaches.

---

## Syntax Comparison

### Field Definitions

| Concept | SPOT | rip-schema | Unified |
|---------|------|------------|---------|
| Required string | `name PrintableString Range(0..100)` | `@string 'name!', 100` | `name! string, [1, 100]` |
| Optional string | `name PrintableString Range(0..100) Optional` | `@string 'name', 100` | `name? string, [0, 100]` |
| Required + Unique | (manual index) | `@email 'email!#'` | `email!# email` |
| Integer with range | `age Integer Range(0..120)` | `@integer 'age', [0, 120]` | `age integer, [0, 120]` |
| Integer with default | `count Integer Default 0` | `@integer 'count', [0]` | `count integer, [0]` |
| Boolean with default | `active Boolean Default true` | `@boolean 'active', true` | `active boolean, [true]` |
| Enum field | `role Enumerated { admin(0), user(1) }` | (planned) | `role Role, [user]` |

### Type Definitions

| Concept | SPOT | Unified |
|---------|------|---------|
| Enum | `Enumerated { a(0), b(1), c(2) }` | `@enum Name: a, b, c` |
| Object/Sequence | `Name ::= Sequence { ... }` | `@type Name` or `@model Name` |
| Inheritance | `Child ::= Extends Parent { ... }` | `@widget Child: $Parent` |
| Reference | `field Type Reference` | `field Type` or `belongs_to` |
| Collection | `Set { item Type }` | `field Type[]` |
| Polymorphic | `Any DefinedBy Widget` | `field Widget` (union) |

### Attributes and Events

| Concept | SPOT/Sage | Unified |
|---------|-----------|---------|
| Attributes | `[ color, size="16" ]` | `{ color, size: "16" }` |
| Events | `[ onAction, onChange ]` | `@events onAction, onChange` |
| Event handler | `[ onAction="doSomething()" ]` | `onAction "doSomething()"` |

---

## Unified Syntax Specification

### Basic Structure

```coffeescript
# Import other schemas
@import "./common.schema"

# Enum definitions
@enum EnumName: value1, value2, value3

# Type definitions (reusable structures)
@type TypeName
  field1! type, [constraints], { attributes }
  field2? type, [default]

# Model definitions (database-backed)
@model ModelName
  field1! type
  @timestamps
  @index field1#

# Widget definitions (UI components)
@widget WidgetName: $ParentWidget
  prop1 type, [default]
  @events event1, event2

# Form definitions (model + layout)
@form FormName: $ModelName
  layout type
  field1 { x: 0, y: 0 }
  @actions
    submit { ... }
```

### Field Syntax

```
fieldName[!][#][?] type[, [min, max]][, [default]][, { attributes }]
```

**Modifiers:**
- `!` — Required (NOT NULL)
- `#` — Unique (creates unique index)
- `?` — Explicitly optional

**Constraints:**
- `[min, max]` — Range (length for strings, value for numbers)
- `[value]` — Default value
- `{ key: value }` — Named attributes

### Examples

```coffeescript
# Required string, 1-100 chars
name! string, [1, 100]

# Required email, unique
email!# email

# Optional string, max 500 chars
bio? string, [0, 500]

# Integer, range 1-5, default 3
rating integer, [1, 5], [3]

# Enum with default
status Status, [pending]

# JSON with default empty object
settings json, [{}]

# Reference to another type
address? Address

# Array of items
tags string[]

# With attributes (UI hints, etc.)
phone! string, [10, 15], { label: "Phone Number", mask: "(###) ###-####" }
```

---

## Generation Targets

From a single schema definition, generate:

### 1. TypeScript Types

```typescript
// From: @model User with email!# email, role! Role
type User = {
  id: number
  email: string
  role: Role
  createdAt: Date
  updatedAt: Date
}

type Role = 'admin' | 'user' | 'guest'
```

### 2. Zod Validators

```typescript
// From: @model User
const UserSchema = z.object({
  id: z.number().int(),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
  createdAt: z.date(),
  updatedAt: z.date()
})

type User = z.infer<typeof UserSchema>
```

### 3. SQL DDL

```sql
-- From: @model User
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX users_email_unique ON users(email);
```

### 4. Sage SDF (for Java runtime)

```
User ::= Sequence {
  id Integer,
  email PrintableString Range(0..255),
  role Enumerated { admin(0), user(1), guest(2) } Default user,
  createdAt PrintableString,
  updatedAt PrintableString
}
```

### 5. UI Component Props

```typescript
// From: @widget Table
interface TableProps {
  selectionMode?: 'none' | 'single' | 'multiple'
  columns: Column[]
  data: Row[]
  onAction?: (event: ActionEvent) => void
  onChange?: (event: ChangeEvent) => void
}
```

### 6. Form Components

```typescript
// From: @form UserForm
<UserForm
  data={user}
  onSubmit={handleSave}
  layout="grid"
/>
```

---

## Core Types

### Primitive Types

| Type | Description | SQL | TypeScript | Zod |
|------|-------------|-----|------------|-----|
| `string` | Text | TEXT/VARCHAR | `string` | `z.string()` |
| `text` | Long text | TEXT | `string` | `z.string()` |
| `integer` | Whole number | INTEGER | `number` | `z.number().int()` |
| `bigint` | Large integer | BIGINT | `bigint` | `z.bigint()` |
| `float` | Single precision | REAL | `number` | `z.number()` |
| `double` | Double precision | REAL | `number` | `z.number()` |
| `decimal` | Exact decimal | DECIMAL | `number` | `z.number()` |
| `boolean` | True/false | INTEGER | `boolean` | `z.boolean()` |
| `date` | Date only | TEXT | `Date` | `z.date()` |
| `time` | Time only | TEXT | `string` | `z.string()` |
| `datetime` | Date and time | TEXT | `Date` | `z.date()` |
| `timestamp` | Unix timestamp | INTEGER | `number` | `z.number()` |
| `json` | JSON data | TEXT | `Record<string, unknown>` | `z.record()` |
| `binary` | Binary data | BLOB | `Buffer` | `z.instanceof(Buffer)` |
| `uuid` | UUID v4 | TEXT | `string` | `z.string().uuid()` |

### Special Types

| Type | Description | Validation |
|------|-------------|------------|
| `email` | Email address | RFC 5322 format |
| `url` | URL | Valid URL format |
| `phone` | Phone number | E.164 or regional |
| `color` | Color value | Hex, RGB, named |
| `dimension` | Size with unit | `"100px"`, `"1ln"`, `"50%"` |

---

## Enums

### Definition

```coffeescript
# Simple enum (values are the names)
@enum Role: admin, user, guest

# Enum with explicit values
@enum Status
  pending:   0
  active:    1
  suspended: 2
  deleted:   3

# Enum with string values
@enum Priority
  low:      "low"
  medium:   "medium"
  high:     "high"
  critical: "critical"
```

### Usage

```coffeescript
@model User
  role! Role, [user]               # Default to 'user'
  status! Status, [active]         # Default to 'active'
```

### Generation

```typescript
// TypeScript
enum Role { Admin = 'admin', User = 'user', Guest = 'guest' }
type Role = 'admin' | 'user' | 'guest'

// Zod
const RoleSchema = z.enum(['admin', 'user', 'guest'])
const RoleSchema = z.nativeEnum(Role)

// SQL
role TEXT CHECK(role IN ('admin', 'user', 'guest'))
```

---

## Models

Models represent database-backed entities with validation.

### Definition

```coffeescript
@model User
  # Fields with types and constraints
  name!       string, [1, 100]
  email!#     email
  password!   string, [8, 100], { writeOnly: true }
  role!       Role, [user]
  avatar?     url
  bio?        text, [0, 1000]
  preferences json, [{}]
  active      boolean, [true]

  # Embedded type
  address?    Address

  # Automatic timestamps
  @timestamps

  # Soft delete support
  @softDelete

  # Indexes
  @index email#                    # Unique (from field)
  @index [role, active]            # Composite
  @index name                      # Non-unique

  # Computed fields (read-only)
  @computed
    displayName -> "#{@name} <#{@email}>"
    isAdmin     -> @role is 'admin'

  # Validations beyond type constraints
  @validate
    password -> @matches /[A-Z]/ and @matches /[0-9]/
    email    -> not @endsWith '@test.com' if @env is 'production'
```

### Relationships

```coffeescript
@model Post
  title!    string, [1, 200]
  content!  text
  published boolean, [false]

  # Foreign key relationships
  @belongs_to User                 # Creates user_id
  @belongs_to Category, optional: true

  @timestamps
  @index [user_id, published]

@model Comment
  content! text
  approved boolean, [false]

  @belongs_to Post
  @belongs_to User

  @timestamps
  @softDelete
```

---

## Widgets

Widgets define UI components with props, events, and behavior.

### Definition

```coffeescript
@widget Table: $Viewer
  # Behavior properties
  selectionMode     SelectionMode, [single]
  columnSorting     boolean, [true]
  columnResizing    boolean, [true]
  columnReordering  boolean, [false]
  singleClickAction boolean, [false]

  # Appearance properties
  gridLineType      GridLineType, [both]
  gridLineColor?    color
  gridLineStyle     LineStyle, [solid]
  rowHeight         dimension, ["1ln"]
  headerHeight      dimension, ["-1"]
  boldColumnHeaders boolean, [false]

  alternatingHighlight AlternatingType, [none]
  alternatingColor?    color

  # Structure
  columns    ItemDescription[]
  scrollPane ScrollPane?
  popupMenu  MenuItem[]?

  # Events
  @events onAction, onChange, onItemChanged
```

### Enum Dependencies

```coffeescript
@enum SelectionMode: none, single, multiple, block, invisible
@enum GridLineType:  none, horizontal, vertical, both
@enum LineStyle:     solid, dashed, dotted
@enum AlternatingType: none, row, column
```

### Inheritance

```coffeescript
@widget TreeTable: $Table
  expandableColumn integer, [0]
  expandAll        boolean, [false]
  showRootHandles  boolean, [true]
  showTreeLines    boolean, [false]
  treeLineColor?   color
  indentBy         integer, [16]

  @events onExpand, onCollapse

@widget PropertyTable: $TreeTable
  usePane          boolean, [true]
  propertiesOrder  PropertiesOrder, [categorized]
  categorySortOrder SortOrder, [ascending]

@enum PropertiesOrder: unsorted, sorted, categorized
@enum SortOrder: descending, unsorted, ascending
```

---

## Forms

Forms combine model structure with UI layout.

### Definition

```coffeescript
@form UserForm: $User
  # Layout configuration
  layout forms
  columns "d,4dlu,100px,4dlu,d,4dlu,d"
  rows "d,2dlu,d,2dlu,d,4dlu,d"

  # Field placement and customization
  name     { x: 0, y: 0, span: 7, label: "Full Name" }
  email    { x: 0, y: 2, span: 3 }
  role     { x: 4, y: 2, widget: dropdown }
  active   { x: 6, y: 2 }
  bio      { x: 0, y: 4, span: 7, widget: textarea, rows: 3 }

  # Nested form section
  address  { x: 0, y: 6, span: 7, collapsible: true, title: "Address" }

  # Actions
  @actions
    submit { value: "Save",   icon: save,   primary: true }
    cancel { value: "Cancel", icon: cancel }

  # Form-level events
  @events onSubmit, onReset, onValidate
```

### Layout Types

```coffeescript
# Table layout (grid)
layout table
rows 3
columns 2

# Forms layout (JGoodies-style)
layout forms
columns "d,4dlu,100px:grow"
rows "d,2dlu,d,2dlu,d"

# Absolute layout
layout absolute

# Flow layout
layout flow
direction horizontal  # or vertical
```

### Widget Overrides

```coffeescript
@form UserForm: $User
  # Override widget type
  role     { widget: dropdown }
  bio      { widget: textarea, rows: 5 }
  password { widget: password }
  avatar   { widget: imageUpload }

  # Override validation message
  email    { errorMessage: "Please enter a valid email" }

  # Conditional visibility
  adminNotes { visible: -> @currentUser.isAdmin }
```

---

## State Management

### Global State Definition

```coffeescript
@state App
  # Current user (nullable)
  currentUser? User

  # Collections
  users User[], [->]
  posts Post[], [->]

  # UI state
  sidebarOpen boolean, [true]
  theme Theme, [light]
  locale string, ["en"]

  # Computed state
  @computed
    isLoggedIn    -> @currentUser?
    isAdmin       -> @currentUser?.role is 'admin'
    userCount     -> @users.length
    publishedPosts -> @posts.filter (p) -> p.published

  # Actions (mutations)
  @actions
    login: (credentials) ->
      user = await api.login(credentials)
      @currentUser = user

    logout: ->
      @currentUser = null

    addPost: (post) ->
      @posts.push(post)

@enum Theme: light, dark, system
```

### Path-Based Access

```coffeescript
# Global state (starts with /)
app.get '/currentUser/name'
app.set '/theme', 'dark'
app.inc '/stats/pageViews'

# Component local state (starts with .)
@get '.selectedIndex'
@set '.items[0]/checked', true

# Negative array indices
app.get '/posts[-1]'              # Last post
app.set '/users[-1]/active', false
```

### Hydration

Components can hydrate their local state from global state:

```coffeescript
@component UserList
  # Local state, hydrated from global
  @state
    users      -> app.get '/users'            # Reactive binding
    filter     string, [""]                    # Local only
    sortBy     string, ["name"]                # Local only

  # Computed from local state
  @computed
    filteredUsers ->
      @users
        .filter (u) => u.name.includes @filter
        .sortBy @sortBy
```

### Serialization

Global state can be serialized for persistence:

```coffeescript
# Save state
localStorage.setItem 'appState', JSON.stringify app.get '/'

# Restore state
saved = JSON.parse localStorage.getItem 'appState'
app.set '/', saved
```

---

## Composition and Reuse

### Mixins

```coffeescript
# Define reusable field groups
@mixin Timestamps
  createdAt! datetime
  updatedAt! datetime

@mixin SoftDelete
  deletedAt? datetime

@mixin Auditable
  @include Timestamps
  @include SoftDelete
  createdBy? integer
  updatedBy? integer

# Use in models
@model Post
  title! string, [1, 200]
  content! text

  @include Auditable
```

### Type Composition

```coffeescript
# Base type
@type PersonName
  first!  string, [1, 50]
  middle? string, [0, 50]
  last!   string, [1, 50]

  @computed
    full -> [@first, @middle, @last].filter(Boolean).join(' ')

# Extended type
@type ContactInfo
  email!  email
  phone?  phone

# Composed type
@type Person
  name!    PersonName
  contact! ContactInfo

@model Employee: $Person
  employeeId!# string, [5, 10]
  department!  Department
  hireDate!    date

  @timestamps
```

### Template Definitions (Sage-style)

```coffeescript
# Define a named template
@template prototypeTable: Table
  alternatingHighlight row
  alternatingColor "rowHilite"
  borders shadow, { thickness: 7 }
  gridLineType both
  selectionMode single
  boldColumnHeaders true

# Use the template
@widget VitalsTable: $prototypeTable
  columns
    { title: "Type",   width: "6ch" }
    { title: "Result", width: "6ch" }
    { title: "Date",   valueType: datetime }
```

---

## Implementation Roadmap

### Phase 1: Core Parser — Complete

- [x] Schema file parser (`.schema` extension)
- [x] AST representation (S-expressions)
- [x] Basic type checking
- [x] Error reporting with line numbers

### Phase 2: TypeScript Generation — Complete

- [x] Type definitions
- [x] Enum definitions
- [x] Interface generation (with JSDoc constraints)
- [x] Export structure

### Phase 3: Runtime Validation — Complete

Native validation engine (replaces Zod for structural validation):

- [x] Primitive type mapping
- [x] Constraint checking (min, max, required, unique)
- [x] Enum validation
- [x] Nested type validation
- [x] Default value application
- [ ] Cross-field `@validate` blocks (planned)

### Phase 4: SQL Generation — Complete

- [x] CREATE TABLE statements
- [x] Column types and constraints
- [x] Index generation (unique + composite)
- [x] Foreign key relationships
- [x] Enum type generation
- [x] Zod schema generation (`emit-zod.js` — third AST walker)
- [ ] Migration diffing (use external tools for now)

### Phase 5: ORM — Complete

- [x] Schema-centric API (`Schema.load` → `schema.model` → queries)
- [x] Query builder (where, orderBy, limit, offset, count)
- [x] Dirty tracking and persistence (INSERT, UPDATE, DELETE)
- [x] Computed properties (getters, no parens)
- [x] Relation loading (`user.posts()`, `post.user()`)
- [x] Soft-delete awareness (`softDelete()`, `restore()`, `withDeleted()`)
- [x] Factory (`User.factory!(5)` — schema-driven fake data)
- [x] Eager loading (`User.include('posts').all()` — batch loading)
- [x] Lifecycle hooks (`beforeSave`, `afterCreate`, `beforeDelete`, etc.)
- [x] Transactions (`schema.transaction!` — atomic BEGIN/COMMIT/ROLLBACK)

### Phase 6: Widget System

- [ ] Widget definition parser
- [ ] Prop type generation
- [ ] Event handler types
- [ ] Inheritance resolution
- [ ] Component generation (Vue/React)

### Phase 7: Form System

- [ ] Form definition parser
- [ ] Layout engine
- [ ] Field placement
- [ ] Widget overrides
- [ ] Validation integration

### Phase 8: State Management

- [ ] State definition parser
- [ ] Path-based access implementation
- [ ] Computed properties
- [ ] Actions/mutations
- [ ] Hydration system
- [ ] Serialization

### Phase 9: Sage Compatibility

- [ ] SDF output generation
- [ ] SPOT format export
- [ ] Widget library mapping

---

## Appendix: Full Example

```coffeescript
# ============================================
# Medical Application Schema
# ============================================

@import "./common.schema"

# Enums
@enum Gender: male, female, other, unknown
@enum VitalType: temp, pulse, resp, bp, height, weight, pain
@enum AllergyStatus: active, inactive, resolved

# Types
@type Address
  street!  string, [1, 200]
  city!    string, [1, 100]
  state!   string, [2, 2]
  zip!     string, /^\d{5}(-\d{4})?$/

@type ContactInfo
  phone?  phone
  email?  email
  fax?    phone

# Models
@model Patient
  name!        string, [1, 100]
  mrn!#        string, [1, 20]            # Medical Record Number
  ssn?#        string, [9, 11]            # SSN (encrypted)
  dob!         date
  gender!      Gender
  photo?       url
  address?     Address
  contact?     ContactInfo
  preferences  json, [{}]
  active       boolean, [true]

  @timestamps
  @softDelete

  @computed
    age -> yearsFrom @dob
    displayName -> "#{@name} (#{@mrn})"

@model Vital
  type!     VitalType
  value!    string, [1, 50]
  unit?     string, [1, 20]
  takenAt!  datetime
  notes?    text

  @belongs_to Patient
  @timestamps

@model Allergy
  allergen!   string, [1, 200]
  reaction?   string, [0, 500]
  severity?   integer, [1, 5]
  status!     AllergyStatus, [active]
  onsetDate?  date

  @belongs_to Patient
  @timestamps
  @softDelete

# Widgets
@widget VitalsTable: $prototypeTable
  title "Vitals"
  columns
    { name: "type",    title: "Type",      width: "6ch",  fgColor: "#1C0B5A" }
    { name: "value",   title: "Result",    width: "8ch" }
    { name: "takenAt", title: "Date/Time", valueType: datetime, format: "MMM dd, yyyy HH:mm" }

  @events onAction

@widget AllergiesList: $ListBox
  title "Allergies"
  fgColor "#800000"
  selectionMode none
  itemDescription
    icon "warning"

# Forms
@form PatientForm: $Patient
  layout forms
  columns "d,4dlu,100px,4dlu,d,4dlu,d,4dlu,100px"
  rows "d,2dlu,d,2dlu,d,4dlu,d,2dlu,d"

  name    { x: 0, y: 0, span: 5 }
  mrn     { x: 6, y: 0, span: 3 }
  dob     { x: 0, y: 2, widget: datePicker }
  gender  { x: 2, y: 2, widget: dropdown }
  ssn     { x: 4, y: 2, widget: masked, mask: "###-##-####" }
  photo   { x: 8, y: 0, rowSpan: 3, widget: imageUpload }

  address { x: 0, y: 4, span: 9, collapsible: true }
  contact { x: 0, y: 6, span: 9, collapsible: true }

  @actions
    save   { value: "Save Patient", primary: true }
    cancel { value: "Cancel" }

# State
@state MedicalApp
  currentPatient?  Patient
  patients         Patient[], [->]

  # UI state
  infobarCollapsed boolean, [false]
  activeTab        string, ["summary"]

  @computed
    patientName     -> @currentPatient?.displayName
    patientAge      -> @currentPatient?.age
    hasPatient      -> @currentPatient?

  @actions
    selectPatient: (patient) ->
      @currentPatient = patient

    clearPatient: ->
      @currentPatient = null
```

---

## Appendix: Syntax Exploration

Exploring syntax options for Rip Schema, ranging from the original SPOT/ASN.1 style to compact sigil-based alternatives. SPOT (part of the Sage framework) uses an ASN.1-inspired syntax that proved itself at enterprise scale for complex applications like hospital systems.

### Original SPOT Syntax

From `sage.spot` — the proven baseline:

```
Application ::= Sequence {
  name PrintableString Range(0..32) Optional,
  lookAndFeel PrintableString Range(0..255) Optional [ style ],
  deferredLoadingMode Enumerated {
    auto   (0),
    always (1),
    never  (2)
  } Default auto,
  mainWindow MainWindow
} [ onAuthFailure, onChange ]
```

**Strengths:** Self-documenting, no ambiguity, proven at scale (2000+ line schemas), language-neutral.
**Weaknesses:** Verbose keywords, lots of punctuation.

### Option C: Sigil Modifiers (chosen direction)

Replace keywords with sigils: `?` optional, `!` required, `#` unique, `= x` default.

```
Application ::= Sequence [onAuthFailure, onChange]
  name?             string(32)
  deferredLoadingMode  = auto : auto(0) | always(1) | never(2)
  mainWindow        MainWindow
```

### Option E: Rip-Native (@model style)

Schemas as Rip code, using `@model`, `@enum` directives — this is the current implementation:

```coffee
@model Application
  @events onAuthFailure, onChange
  name?                      string, [0, 32]
  deferredLoadingMode        DeferredLoadingMode = auto
  mainWindow                 MainWindow

@enum DeferredLoadingMode
  auto   (0)
  always (1)
  never  (2)
```

### The Fundamental Tradeoff

**Standalone Format** — Language-neutral, schema is data not code, clear separation, proven at scale.

**Computable Rip Code** — Schemas are first-class values, can extend/compose/compute at runtime, reactive schemas possible, tighter IDE integration. But: tied to Rip.

**Path Forward: Both?** — `.schema` files with clean SPOT-like syntax, Rip parser produces S-expressions, S-expressions can be interpreted by runtime, imported into Rip, or used to generate code for other languages.

---

## References

- [Sage Documentation](../demos/sage-docs/) — Original SPOT/Sparse Notation
- [rip-schema](https://github.com/rip-lang/rip-packages/tree/main/packages/schema) — Current schema DSL
- [Zod](https://zod.dev) — TypeScript-first schema validation
- [Vue State](../demos/vue-state/) — Path-based state management
- [ASN.1](https://en.wikipedia.org/wiki/ASN.1) — Abstract Syntax Notation (SPOT's ancestor)
