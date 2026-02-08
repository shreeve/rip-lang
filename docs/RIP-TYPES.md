# Rip Type-Led Design (TLD)

> **Types describe what you mean. Code does what you say.**

Rip supports **Type-Led Design**: a lightweight, expressive way to design
software by defining shapes, intent, and contracts up front — without enforcing
types at runtime or burdening the language with a full type system.

Types in Rip are:

- **Optional** — Rip code without types is valid Rip code
- **Erased at runtime** — Zero performance cost
- **TypeScript-compatible** — Emit `.d.ts` files, leverage existing tooling
- **Editor-driven** — Autocompletion, hover info, refactoring support

Rip treats types as *design scaffolding*, not safety rails.

```coffee
# Without types (valid)
def greet(name)
  "Hello, #{name}!"

# With types (also valid, same runtime behavior)
def greet(name:: string):: string
  "Hello, #{name}!"
```

Both compile to identical JavaScript.

---

## Table of Contents

1. [TLD Sigil Reference](#tld-sigil-reference)
2. [Type Annotations (`::`)](#type-annotations-)
3. [Type Aliases (`::=`)](#type-aliases-)
4. [Structural Types](#structural-types)
5. [Optionality Modifiers](#optionality-modifiers)
6. [Union Types](#union-types)
7. [Function Types](#function-types)
8. [Generic Types](#generic-types)
9. [Interfaces](#interfaces)
10. [Enums](#enums)
11. [Type Inference](#type-inference)
12. [Adoption Model](#adoption-model)
13. [Emission Strategy](#emission-strategy)
14. [Boundary Validation](#boundary-validation)
15. [Editor-First Workflow](#editor-first-workflow)
16. [What Rip Intentionally Does Not Do](#what-rip-intentionally-does-not-do)

---

## TLD Sigil Reference

| Sigil | Meaning | Example |
|-------|---------|---------|
| `::` | Type annotation | `count:: number = 0` |
| `::=` | Type alias | `ID ::= number` |
| `?` | Optional value (`T \| undefined`) | `email:: string?` |
| `??` | Nullable value (`T \| null \| undefined`) | `middle:: string??` |
| `!` | Non-nullable (`NonNullable<T>`) | `id:: ID!` |
| `?:` | Optional property | `email?: string` |
| `\|` | Union member | `"a" \| "b" \| "c"` |
| `->` | Function return type | `(a: number) -> string` |
| `<T>` | Generic parameter | `Container<T>` |

This is the complete Type-Led Design sigil vocabulary.

---

## Type Annotations (`::`)

The double-colon `::` annotates types on variables, parameters, return values,
and properties.

### Variables

```coffee
count:: number = 0
name:: string = "Rip"
items:: string[] = []
```

**Emits:**

```ts
let count: number; count = 0;
let name: string; name = "Rip";
let items: string[]; items = [];
```

### Constants

```coffee
MAX_RETRIES:: number =! 3
API_URL:: string =! "https://api.example.com"
```

**Emits:**

```ts
const MAX_RETRIES: number = 3;       // =! emits const
const API_URL: string = "https://api.example.com";
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

**Emits:**

```ts
function processUser(id: number, options: Options): Result { ... }
```

### Reactive State

Types work with Rip's reactive operators:

```coffee
count:: number := 0
doubled:: number ~= count * 2
```

**Emits:**

```ts
const count = __state<number>(0);       // := emits const
const doubled = __computed<number>(() => count * 2);  // ~= emits const
```

---

## Type Aliases (`::=`)

The `::=` operator declares a named type, mapping directly to TypeScript's
`type X = ...`.

```coffee
# Simple aliases
ID ::= number
Name ::= string

# Complex types
UserID ::= number | string
Callback ::= (error:: Error?, data:: any) -> void
Handler ::= (req:: Request, res:: Response) -> Promise<void>
```

**Emits:**

```ts
type ID = number;
type Name = string;

type UserID = number | string;
type Callback = (error: Error | undefined, data: any) => void;
type Handler = (req: Request, res: Response) => Promise<void>;
```

---

## Structural Types

Define object shapes using the `type` keyword followed by a block:

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
```

### Nesting, Readonly, and Index Signatures

```coffee
Response ::= type
  data: type
    users: User[]
    total: number
  meta: type
    page: number
    limit: number

ImmutableConfig ::= type
  readonly host: string
  readonly port: number

Dictionary ::= type
  [key: string]: any
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

type ImmutableConfig = {
  readonly host: string;
  readonly port: number;
};

type Dictionary = {
  [key: string]: any;
};
```

---

## Optionality Modifiers

Lightweight suffix operators that map directly to TypeScript unions.

### Optional: `T?`

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

### Nullable Optional: `T??`

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

### Non-Nullable: `T!`

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

### In Function Signatures

```coffee
def findUser(id:: number):: User?
  db.find(id) or undefined

def getUser(id:: number):: User!
  db.find(id) ?? throw new Error "Not found"

def updateUser(id:: number, email:: string??):: boolean
  ...
```

**Emits:**

```ts
function findUser(id: number): User | undefined { ... }
function getUser(id: number): NonNullable<User> { ... }
function updateUser(id: number, email: string | null | undefined): boolean { ... }
```

### Optional Properties

In structural types, `?` after the property name makes it optional (the
property itself may be absent), distinct from value optionality:

```coffee
User ::= type
  id: number
  name: string
  email?: string      # Optional property — may be absent
  phone?: string?     # Optional property that can also be undefined when present
```

**Emits:**

```ts
type User = {
  id: number;
  name: string;
  email?: string;
  phone?: string | undefined;
};
```

### Key Distinction

- `email?: string` — property may be absent
- `email:: string?` — value may be undefined
- `email?: string??` — property may be absent, value may be null or undefined

---

## Union Types

### Inline

```coffee
Status ::= "pending" | "active" | "done"
Result ::= Success | Error
```

### Block Form (Preferred)

Vertical form is diff-friendly and encourages domain-first modeling:

```coffee
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

### Why Unions Over Enums

Block unions have **zero runtime cost** — they exist only at compile time.
Use enums only when you need reverse mapping, runtime iteration, or explicit
numeric values.

---

## Function Types

```coffee
# Type aliases for function signatures
Comparator ::= (a:: any, b:: any) -> number
AsyncFetcher ::= (url:: string) -> Promise<Response>

# Overloads
def toHtml(content:: string):: string
def toHtml(nodes:: Element[]):: string
def toHtml(input:: any):: string
  switch typeof input
    when "string" then escapeHtml(input)
    else renderNodes(input)

# Method signatures in classes
class UserService
  find: (id:: number):: User? ->
    @db.find(id)

  create: (data:: CreateUserInput):: User ->
    @db.create(data)
```

**Emits:**

```ts
type Comparator = (a: any, b: any) => number;
type AsyncFetcher = (url: string) => Promise<Response>;

function toHtml(content: string): string;
function toHtml(nodes: Element[]): string;
function toHtml(input: any): string {
  // implementation
}

class UserService {
  find(id: number): User | undefined { ... }
  create(data: CreateUserInput): User { ... }
}
```

---

## Generic Types

```coffee
# Simple generic
Container<T> ::= type
  value: T

# Multiple parameters
Pair<K, V> ::= type
  key: K
  value: V

# With constraints
Comparable<T extends Ordered> ::= type
  value: T
  compareTo: (other:: T) -> number

# Generic functions
def identity<T>(value:: T):: T
  value

def map<T, U>(items:: T[], fn:: (item:: T) -> U):: U[]
  items.map(fn)

def merge<T extends object, U extends object>(a:: T, b:: U):: T & U
  {...a, ...b}
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

function identity<T>(value: T): T { ... }
function map<T, U>(items: T[], fn: (item: T) => U): U[] { ... }
function merge<T extends object, U extends object>(a: T, b: U): T & U { ... }
```

---

## Interfaces

For TypeScript compatibility, Rip supports the `interface` keyword:

```coffee
interface Animal
  name: string

interface Dog extends Animal
  breed: string
  bark: () -> void
```

**Emits:**

```ts
interface Animal {
  name: string;
}

interface Dog extends Animal {
  breed: string;
  bark: () => void;
}
```

Use `::= type` by default. Use `interface` when you need declaration merging.

---

## Enums

### Zero-Runtime (Preferred)

```coffee
Size ::=
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
```

**Emits to `.d.ts` only:**

```ts
type Size = "xs" | "sm" | "md" | "lg" | "xl";
```

### Runtime Enums (When Needed)

```coffee
enum HttpCode
  ok = 200
  created = 201
  notFound = 404
  serverError = 500
```

**Emits to both `.js` and `.d.ts`:**

```ts
// .d.ts
enum HttpCode {
  ok = 200,
  created = 201,
  notFound = 404,
  serverError = 500
}

// .js (runtime object with reverse mapping)
const HttpCode = {
  ok: 200, created: 201, notFound: 404, serverError: 500,
  200: "ok", 201: "created", 404: "notFound", 500: "serverError"
};
```

Runtime enums generate a reverse-mapping object. Use only when you need
`HttpCode[200]` → `"ok"` or runtime iteration.

---

## Type Inference

Types should be explicit at boundaries, optional elsewhere:

```coffee
# Explicit — function signatures, exports, class properties
def processUser(id:: number, options:: Options):: Result
  ...

export config:: Config = loadConfig()

class UserService
  db:: Database
  cache:: Map<string, User>

# Inferred — local variables
user = getUser!(id)           # Inferred from return type
items = users.map (u) -> u.name  # Inferred as string[]
count = 0                     # Inferred as number
```

### Inference Rules

1. **Function returns** — Inferred from body if not annotated
2. **Variables** — Inferred from initializer
3. **Parameters** — Should be explicitly annotated
4. **Generic type args** — Often inferred from usage

---

## Adoption Model

Types are optional at every level:

### Project Level

```json
{
  "rip": {
    "types": "emit"
  }
}
```

| Mode | Behavior |
|------|----------|
| `"off"` | Types are parsed but ignored — no `.d.ts` emitted |
| `"emit"` | `.d.ts` files generated — enables editor IntelliSense |
| `"check"` | `.d.ts` generated + `tsc --noEmit` validates types |

### File Level

Override per-file with a directive:

```coffee
# @types off    — Ignore types in this file
# @types emit   — Parse and emit .d.ts
# @types check  — Full TypeScript checking
```

### Gradual Path

1. **Start with `"off"`** — Write normal Rip code
2. **Enable `"emit"`** — Add types where helpful, get `.d.ts` for tooling
3. **Move to `"check"`** — Enforce type safety via TypeScript

---

## Emission Strategy

| Input | Output | Purpose |
|-------|--------|---------|
| `file.rip` | `file.js` | Runtime code (always) |
| `file.rip` | `file.d.ts` | Type declarations (when `emit` or `check`) |

Type aliases and annotations are stripped from `.js` output and preserved
in `.d.ts` output. Type-only declarations (`::=` aliases, unions) appear
only in `.d.ts`.

```coffee
# user.rip
export User ::= type
  id: number
  name: string

export def getUser(id:: number):: User?
  db.find(id)
```

**Generates `user.js`** — types erased:

```js
export function getUser(id) {
  return db.find(id);
}
```

**Generates `user.d.ts`** — types preserved:

```ts
export type User = { id: number; name: string; };
export function getUser(id: number): User | undefined;
```

---

## Boundary Validation

Types are compile-time contracts. For data entering your system, validate
at boundaries:

```coffee
import { z } from "zod"

# Define schema (runtime validation + type source of truth)
UserSchema = z.object
  id: z.number()
  name: z.string()
  email: z.string().email()

# Derive type from schema
User ::= z.infer<typeof UserSchema>

# Validate at API boundary
def createUser(req:: Request):: User
  data = req.json!
  UserSchema.parse(data)
```

Once data passes boundary validation, trust the types internally — no need
to re-validate.

---

## Editor-First Workflow

Type-Led Design is primarily **editor-driven**. The intended loop:

1. Define shapes and contracts
2. Annotate public boundaries
3. Let the editor guide implementation
4. Optionally validate via `types: "check"`

High-quality `.d.ts` output is a first-class goal.

---

## What Rip Intentionally Does Not Do

Rip does not:

- Narrow types based on control flow
- Perform exhaustiveness checks
- Reject programs based on type errors
- Introduce runtime type checks
- Evaluate type expressions or prove soundness

These responsibilities belong to editors, linters, and TypeScript tooling
(when enabled via `types: "check"`).

Rip only needs to:

- **Parse** type syntax correctly
- **Preserve** type information in the AST
- **Emit** valid TypeScript type declarations

---

## Summary

Type-Led Design in Rip provides:

- Expressive domain modeling with minimal syntax
- Gradual adoption — add types where they help
- Zero runtime overhead — types are compile-time only
- Excellent editor intelligence via `.d.ts` emission
- Clean interop with the TypeScript ecosystem

Rip remains a **JavaScript language**, with types as a **design language**
layered on top.

> **Static typing as a discipline, not a mandate.**

---

**See Also:**
- [RIP-LANG.md](RIP-LANG.md) — Language reference
- [RIP-REACTIVITY.md](RIP-REACTIVITY.md) — Reactive system details
- [RIP-INTERNALS.md](RIP-INTERNALS.md) — Compiler internals
