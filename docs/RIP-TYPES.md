# Optional Types in Rip

> **Type-Driven Development Without the Overhead**

This specification defines Rip's optional, lightweight type system — a thin, compile-time-only layer that enables TypeScript-level type-driven development while preserving Rip's core philosophy: minimal syntax, high readability, zero runtime overhead.

---

## Table of Contents

1. [Philosophy](#1-philosophy)
2. [Type Annotations](#2-type-annotations)
3. [Type Aliases](#3-type-aliases)
4. [Optionality Modifiers](#4-optionality-modifiers)
5. [Structural Types](#5-structural-types)
6. [Union Types](#6-union-types)
7. [Function Types](#7-function-types)
8. [Generic Types](#8-generic-types)
9. [Type Inference](#9-type-inference)
10. [Adoption Model](#10-adoption-model)
11. [Emission Strategy](#11-emission-strategy)
12. [Interfaces](#12-interfaces)
13. [Enums](#13-enums)
14. [Boundary Validation](#14-boundary-validation)
15. [Implementation Notes](#15-implementation-notes)
16. [Quick Reference](#16-quick-reference)

---

# 1. Philosophy

## Core Principles

1. **Types are additive, never required** — Rip code without types is valid Rip code
2. **All type syntax erases at runtime** — Zero performance cost
3. **Type syntax decorates existing constructs** — No new control flow or semantics
4. **No typechecker required in Rip** — Parse and preserve, don't enforce
5. **Emit TypeScript-compatible types** — Leverage existing tooling
6. **Prefer zero-runtime representations** — Unions over enums, types over classes

## The Rip Way

Types in Rip should feel like documentation that happens to be machine-readable:

```coffee
# Without types (valid)
def greet(name)
  "Hello, #{name}!"

# With types (also valid, same runtime behavior)
def greet(name:: string):: string
  "Hello, #{name}!"
```

Both compile to identical JavaScript. Types exist for developers and tools, not for the runtime.

## Static Typing as a Discipline, Not a Mandate

Rip's type system is designed for teams and projects that want:

- **IDE intelligence** — Autocompletion, hover info, refactoring support
- **Documentation** — Self-documenting function signatures
- **Boundary safety** — Confidence at API and module boundaries
- **Gradual adoption** — Add types where they matter, skip where they don't

---

# 2. Type Annotations

## Syntax: `::`

The double-colon `::` annotates types on variables, parameters, return values, and properties.

### Variables

```coffee
count:: number = 0
name:: string = "Rip"
active:: boolean = true
items:: string[] = []
```

**Emits to TypeScript:**

```ts
let count: number = 0;
let name: string = "Rip";
let active: boolean = true;
let items: string[] = [];
```

### Function Parameters

```coffee
def greet(name:: string)
  "Hello, #{name}!"

def add(a:: number, b:: number)
  a + b
```

**Emits:**

```ts
function greet(name: string) { ... }
function add(a: number, b: number) { ... }
```

### Return Types

```coffee
def getUser(id:: number):: User
  db.find!(id)

def fetchData():: Promise<Data>
  fetch!("/api/data")
```

**Emits:**

```ts
function getUser(id: number): User { ... }
async function fetchData(): Promise<Data> { ... }
```

### Combined

```coffee
def processUser(id:: number, options:: Options):: Result
  user = getUser!(id)
  transform(user, options)
```

### Constants

```coffee
MAX_RETRIES:: number =! 3
API_URL:: string =! "https://api.example.com"
```

**Emits:**

```ts
const MAX_RETRIES: number = 3;
const API_URL: string = "https://api.example.com";
```

### Reactive State

Types work with Rip's reactive operators:

```coffee
count:: number := 0           # Reactive state with type
doubled:: number ~= count * 2  # Computed with type
```

---

# 3. Type Aliases

## Syntax: `::=`

The `::=` operator declares a named type alias, mapping directly to TypeScript's `type X = ...`.

### Simple Aliases

```coffee
ID ::= number
Name ::= string
Timestamp ::= number
```

**Emits:**

```ts
type ID = number;
type Name = string;
type Timestamp = number;
```

### Complex Types

```coffee
UserID ::= number | string
Callback ::= (error:: Error?, data:: any) -> void
Handler ::= (req:: Request, res:: Response) -> Promise<void>
```

**Emits:**

```ts
type UserID = number | string;
type Callback = (error: Error | undefined, data: any) => void;
type Handler = (req: Request, res: Response) => Promise<void>;
```

---

# 4. Optionality Modifiers

Lightweight suffix operators that map directly to TypeScript unions.

## Optional: `T?`

Indicates a value may be undefined.

```coffee
email:: string?
callback:: Function?
```

**Emits:**

```ts
email: string | undefined
callback: Function | undefined
```

## Nullable Optional: `T??`

Indicates a value may be null or undefined.

```coffee
middle:: string??
cache:: Map<string, any>??
```

**Emits:**

```ts
middle: string | null | undefined
cache: Map<string, any> | null | undefined
```

## Non-Nullable: `T!`

Asserts a value is never null or undefined.

```coffee
id:: ID!
user:: User!
```

**Emits:**

```ts
id: NonNullable<ID>
user: NonNullable<User>
```

## In Function Signatures

```coffee
def findUser(id:: number):: User?
  db.find(id) or undefined

def getUser(id:: number):: User!
  db.find(id) ?? throw new Error "Not found"

def updateUser(id:: number, email:: string??):: boolean
  ...
```

## Optional Properties

In object types, `?` after the property name makes it optional:

```coffee
User ::= type
  id: number
  name: string
  email?: string      # Optional property
  phone?: string?     # Optional property that can also be undefined when present
```

---

# 5. Structural Types

## Object Types with `type` Block

Define structural types using the `type` keyword followed by a block:

```coffee
User ::= type
  id: number
  name: string
  email?: string
  createdAt: Date

Config ::= type
  host: string
  port: number
  ssl?: boolean
  timeout?: number
```

**Emits:**

```ts
type User = {
  id: number;
  name: string;
  email?: string;
  createdAt: Date;
};

type Config = {
  host: string;
  port: number;
  ssl?: boolean;
  timeout?: number;
};
```

## Nested Types

```coffee
Response ::= type
  data: type
    users: User[]
    total: number
  meta: type
    page: number
    limit: number
```

**Emits:**

```ts
type Response = {
  data: {
    users: User[];
    total: number;
  };
  meta: {
    page: number;
    limit: number;
  };
};
```

## Array Properties

```coffee
Collection ::= type
  items: Item[]
  tags: string[]
  matrix: number[][]
```

## Readonly Properties

```coffee
ImmutableConfig ::= type
  readonly host: string
  readonly port: number
```

## Index Signatures

```coffee
Dictionary ::= type
  [key: string]: any

StringMap ::= type
  [key: string]: string
```

---

# 6. Union Types

## Inline Unions

```coffee
Status ::= "pending" | "active" | "done"
Result ::= Success | Error
ID ::= number | string
```

## Block Unions (Preferred)

For readability and diff-friendliness, use the block form with leading `|`:

```coffee
Status ::=
  | "pending"
  | "active"
  | "done"

HttpMethod ::=
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"

Result ::=
  | { success: true, data: Data }
  | { success: false, error: Error }
```

**Emits:**

```ts
type Status = "pending" | "active" | "done";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type Result =
  | { success: true; data: Data }
  | { success: false; error: Error };
```

## Why Block Unions Over Enums

Block unions have **zero runtime cost** — they exist only at compile time. Traditional enums generate runtime code:

```coffee
# Preferred: Zero runtime cost
Size ::=
  | "xs"
  | "sm"
  | "md"
  | "lg"

# Avoid: Generates runtime object
enum Size
  xs
  sm
  md
  lg
```

Use enums only when you need:
- Reverse mapping (value → name)
- Runtime iteration over values
- Explicit numeric values

---

# 7. Function Types

## Arrow Function Types

```coffee
Comparator ::= (a:: any, b:: any) -> number
AsyncFetcher ::= (url:: string) -> Promise<Response>
Callback ::= (err:: Error?, data:: any?) -> void
```

**Emits:**

```ts
type Comparator = (a: any, b: any) => number;
type AsyncFetcher = (url: string) => Promise<Response>;
type Callback = (err: Error | undefined, data: any | undefined) => void;
```

## Function Overloads

Multiple signatures for a single implementation:

```coffee
# Overload signatures
def toHtml(content:: string):: string
def toHtml(nodes:: Element[]):: string
def toHtml(fragment:: DocumentFragment):: string

# Implementation (matches last signature or uses widest type)
def toHtml(input:: any):: string
  switch typeof input
    when "string" then escapeHtml(input)
    else renderNodes(input)
```

**Emits:**

```ts
function toHtml(content: string): string;
function toHtml(nodes: Element[]): string;
function toHtml(fragment: DocumentFragment): string;
function toHtml(input: any): string {
  // implementation
}
```

## Method Signatures in Classes

```coffee
class UserService
  find: (id:: number):: User? ->
    @db.find(id)

  create: (data:: CreateUserInput):: User ->
    @db.create(data)

  update: (id:: number, data:: UpdateUserInput):: User? ->
    @db.update(id, data)
```

---

# 8. Generic Types

## Generic Type Parameters

```coffee
# Simple generic
Container<T> ::= type
  value: T

# Multiple type parameters
Pair<K, V> ::= type
  key: K
  value: V

# With constraints
Comparable<T extends Ordered> ::= type
  value: T
  compareTo: (other:: T) -> number
```

**Emits:**

```ts
type Container<T> = {
  value: T;
};

type Pair<K, V> = {
  key: K;
  value: V;
};

type Comparable<T extends Ordered> = {
  value: T;
  compareTo: (other: T) => number;
};
```

## Generic Functions

```coffee
def identity<T>(value:: T):: T
  value

def map<T, U>(items:: T[], fn:: (item:: T) -> U):: U[]
  items.map(fn)

def first<T>(items:: T[]):: T?
  items[0]
```

## Generic Constraints

```coffee
def merge<T extends object, U extends object>(a:: T, b:: U):: T & U
  {...a, ...b}

def stringify<T extends { toString: () -> string }>(value:: T):: string
  value.toString()
```

---

# 9. Type Inference

## When to Annotate

Rip's type system uses **TypeScript-compatible inference**. Types should be explicit at boundaries, optional elsewhere:

### Explicit (Recommended)

```coffee
# Function signatures — always annotate
def processUser(id:: number, options:: ProcessOptions):: Result
  ...

# Exported values — always annotate
export config:: Config = loadConfig()

# Class properties — annotate for clarity
class UserService
  db:: Database
  cache:: Map<string, User>
```

### Inferred (Acceptable)

```coffee
# Local variables — let TypeScript infer
user = getUser!(id)        # Inferred from getUser's return type
items = users.map (u) -> u.name  # Inferred as string[]
count = 0                  # Inferred as number
```

## Inference Rules

1. **Function returns** — Inferred from body if not annotated
2. **Variables** — Inferred from initializer
3. **Parameters** — Should be explicitly annotated
4. **Generic type args** — Often inferred from usage

---

# 10. Adoption Model

Types are optional at three levels: project, file, and line.

## Project Level

Configure in `package.json` or `rip.config.json`:

```json
{
  "rip": {
    "types": "emit"
  }
}
```

| Mode | Behavior |
|------|----------|
| `"off"` | Ignore all type syntax (strip during parse) |
| `"emit"` | Parse types, emit `.d.ts` files |
| `"check"` | Parse types, emit `.d.ts`, run `tsc --noEmit` |

## File Level

Override project settings per-file with a directive comment:

```coffee
# @types off
# This file has no type checking

# @types emit
# Types parsed and emitted for this file

# @types check
# Types checked via TypeScript for this file
```

## Line Level

All type syntax is simply ignored if types are disabled. No special syntax needed — annotations silently disappear:

```coffee
# With types enabled:
count:: number = 0  # Type preserved

# With types disabled:
count:: number = 0  # Parses as: count = 0
```

## Gradual Adoption Path

1. **Start with `"off"`** — Write normal Rip code
2. **Enable `"emit"`** — Add types where helpful, get `.d.ts` for tooling
3. **Move to `"check"`** — Enforce type safety via TypeScript

---

# 11. Emission Strategy

## Compilation Outputs

| Input | Output | Purpose |
|-------|--------|---------|
| `file.rip` | `file.js` | Runtime code (always) |
| `file.rip` | `file.d.ts` | Type declarations (when `emit` or `check`) |

## Type Declaration Files

When `types: "emit"` or `types: "check"`, generate `.d.ts` files:

```coffee
# user.rip
export User ::= type
  id: number
  name: string

export def getUser(id:: number):: User?
  db.find(id)
```

**Generates `user.d.ts`:**

```ts
export type User = {
  id: number;
  name: string;
};

export function getUser(id: number): User | undefined;
```

**Generates `user.js`:**

```js
export function getUser(id) {
  return db.find(id);
}
```

## Type-Only Exports

Type aliases that have no runtime representation are only emitted to `.d.ts`:

```coffee
# These only appear in .d.ts, not .js
Status ::= "pending" | "active" | "done"
UserID ::= number
```

## Integration with TypeScript

When `types: "check"`:

1. Compile `.rip` → `.js` + `.d.ts`
2. Run `tsc --noEmit` to validate types
3. Report TypeScript errors

This leverages TypeScript's mature type checker without reimplementing it.

---

# 12. Interfaces

## Syntax: `interface`

For TypeScript compatibility, Rip also supports the `interface` keyword for object types:

```coffee
interface User
  id: number
  name: string
  email?: string
```

**Emits:**

```ts
interface User {
  id: number;
  name: string;
  email?: string;
}
```

## Type vs Interface

| Feature | `::= type` | `interface` |
|---------|------------|-------------|
| Declaration merging | No | Yes |
| Extends | Via `&` intersection | Via `extends` |
| Computed properties | Yes | No |
| Mapped types | Yes | No |

**Recommendation:** Use `::= type` by default. Use `interface` when you need declaration merging or prefer the interface aesthetic.

## Interface Extension

```coffee
interface Animal
  name: string

interface Dog extends Animal
  breed: string
  bark: () -> void
```

---

# 13. Enums

## Zero-Runtime Enums (Preferred)

Use string literal unions for zero runtime cost:

```coffee
Size ::=
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"

Direction ::=
  | "north"
  | "south"
  | "east"
  | "west"
```

**Emits only to `.d.ts`:**

```ts
type Size = "xs" | "sm" | "md" | "lg" | "xl";
type Direction = "north" | "south" | "east" | "west";
```

## Runtime Enums (When Needed)

When you need runtime access to enum values, use the `enum` keyword:

```coffee
enum Status
  pending
  active
  completed
  cancelled

enum HttpCode
  ok = 200
  created = 201
  badRequest = 400
  notFound = 404
  serverError = 500
```

**Emits to both `.js` and `.d.ts`:**

```ts
// .d.ts
enum Status {
  pending,
  active,
  completed,
  cancelled
}

// .js (runtime object generated)
const Status = {
  pending: 0,
  active: 1,
  completed: 2,
  cancelled: 3,
  0: "pending",
  1: "active",
  2: "completed",
  3: "cancelled"
};
```

## When to Use Runtime Enums

Use runtime enums only when you need:

- **Reverse mapping** — Get name from value: `Status[0]` → `"pending"`
- **Iteration** — Loop over all values at runtime
- **Explicit numeric values** — `HttpCode.ok === 200`

For all other cases, prefer zero-runtime union types.

---

# 14. Boundary Validation

## Philosophy

Types are compile-time contracts. For data entering your system (user input, API responses, file contents), **validate at boundaries**:

```coffee
# Type declares the shape
User ::= type
  id: number
  name: string
  email: string

# Validation enforces at runtime
def parseUser(input:: unknown):: User
  UserSchema.parse(input)  # Throws if invalid
```

## Recommended Pattern

Use a validation library (like Zod) at IO boundaries:

```coffee
import { z } from "zod"

# Define schema with runtime validation
UserSchema = z.object
  id: z.number()
  name: z.string()
  email: z.string().email()

# Derive type from schema (single source of truth)
User ::= z.infer<typeof UserSchema>

# Validate at API boundary
def createUser(req:: Request):: User
  data = req.json!
  UserSchema.parse(data)  # Validates and returns typed data
```

## Trust Internally

Once data passes boundary validation, trust the types internally:

```coffee
def processUser(user:: User):: void
  # No need to re-validate — type guarantees shape
  sendWelcomeEmail(user.email)
  createProfile(user.id, user.name)
```

---

# 15. Implementation Notes

## Parser Changes

The parser must recognize and preserve:

1. **`::` annotations** — After identifiers, parameters, before return
2. **`::=` declarations** — Type alias definitions
3. **Type modifiers** — `?`, `??`, `!` suffixes
4. **`type` blocks** — Structural type definitions
5. **Generic syntax** — `<T>`, `<T extends U>`, etc.
6. **Block unions** — Leading `|` for union members

## AST Representation

Type information should be stored as AST metadata:

```coffee
# Source
count:: number = 0
```

```javascript
// AST (conceptual)
["=", "count", 0, { type: "number" }]
```

## Code Generation

Type annotations should:

1. **Strip from runtime** — Never appear in `.js` output
2. **Preserve for `.d.ts`** — Emit valid TypeScript declarations
3. **Maintain source order** — Types in `.d.ts` match source file order

## Scope and Validation

Rip does **not** need to:

- Evaluate type expressions
- Prove type soundness
- Check type compatibility
- Resolve type references

Rip only needs to:

- **Parse** type syntax correctly
- **Preserve** type information in AST
- **Emit** valid TypeScript type syntax

All actual type checking is delegated to TypeScript when `types: "check"`.

---

## Summary

Rip's optional type system provides:

| Feature | Description |
|---------|-------------|
| **Type Annotations** | `::` for variables, parameters, returns |
| **Type Aliases** | `::=` for named types |
| **Optionality** | `T?` optional, `T??` nullable, `T!` non-null |
| **Structural Types** | `type` blocks for object shapes |
| **Union Types** | Inline or block form with `\|` |
| **Function Types** | Arrow syntax, overloads supported |
| **Generics** | Full generic support with constraints |
| **Adoption Levels** | Project, file, and line granularity |
| **Emission** | `.js` runtime + `.d.ts` declarations |

**The result:**

- Type-driven development with TypeScript ecosystem compatibility
- Optional adoption — add types where they help
- Zero runtime cost — types are compile-time only
- Minimal syntax — Rip stays Rip

> **Static typing as a discipline, not a mandate.**

---

# 16. Quick Reference

## Syntax Cheat Sheet

```coffee
# ═══════════════════════════════════════════════════════════
# TYPE ANNOTATIONS (::)
# ═══════════════════════════════════════════════════════════

# Variables
count:: number = 0
name:: string = "Rip"
items:: string[] = []

# Constants
MAX:: number =! 100

# Reactive state
count:: number := 0
doubled:: number ~= count * 2

# Function parameters and return
def greet(name:: string):: string
  "Hello, #{name}!"

# ═══════════════════════════════════════════════════════════
# TYPE ALIASES (::=)
# ═══════════════════════════════════════════════════════════

# Simple alias
ID ::= number

# Union (inline)
Status ::= "pending" | "active" | "done"

# Union (block - preferred)
HttpMethod ::=
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"

# Structural type
User ::= type
  id: number
  name: string
  email?: string

# Function type
Handler ::= (req:: Request) -> Response

# Generic type
Container<T> ::= type
  value: T

# ═══════════════════════════════════════════════════════════
# OPTIONALITY MODIFIERS
# ═══════════════════════════════════════════════════════════

email:: string?        # T | undefined
middle:: string??      # T | null | undefined
id:: ID!               # NonNullable<T>

# ═══════════════════════════════════════════════════════════
# GENERICS
# ═══════════════════════════════════════════════════════════

def identity<T>(x:: T):: T
  x

def map<T, U>(arr:: T[], fn:: (x:: T) -> U):: U[]
  arr.map(fn)

# With constraints
def merge<T extends object>(a:: T, b:: T):: T
  {...a, ...b}

# ═══════════════════════════════════════════════════════════
# INTERFACES
# ═══════════════════════════════════════════════════════════

interface Animal
  name: string

interface Dog extends Animal
  breed: string

# ═══════════════════════════════════════════════════════════
# ENUMS (use sparingly)
# ═══════════════════════════════════════════════════════════

enum Status
  pending
  active
  done

enum HttpCode
  ok = 200
  notFound = 404
```

## Comparison: Rip vs TypeScript vs CoffeeScript

| Feature | Rip | TypeScript | CoffeeScript |
|---------|-----|------------|--------------|
| Type annotations | `x:: T` | `x: T` | N/A |
| Type aliases | `T ::= ...` | `type T = ...` | N/A |
| Optional type | `T?` | `T \| undefined` | N/A |
| Nullable | `T??` | `T \| null \| undefined` | N/A |
| Non-nullable | `T!` | `NonNullable<T>` | N/A |
| Structural types | `type` block | `{ ... }` | N/A |
| Block unions | `\| "a" \| "b"` | Same | N/A |
| Types required | No | Configurable | N/A |
| Runtime cost | Zero | Zero | N/A |

## Project Configuration

```json
// package.json
{
  "rip": {
    "types": "emit"   // "off" | "emit" | "check"
  }
}
```

## File Directives

```coffee
# @types off    — Ignore types in this file
# @types emit   — Parse and emit .d.ts
# @types check  — Full TypeScript checking
```

---

**See Also:**
- [RIP-LANG.md](RIP-LANG.md) — Language reference
- [RIP-REACTIVITY.md](RIP-REACTIVITY.md) — Reactive system details
- [RIP-INTERNALS.md](RIP-INTERNALS.md) — Compiler internals
