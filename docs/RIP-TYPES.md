# Rip Types

> **Types describe what you mean. Code does what you say.**

Rip supports an optional, lightweight, expressive way to design software by
defining shapes, intent, and contracts up front — without enforcing types at
runtime or burdening the language with a full type system.

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

1. [Type Sigil Reference](#type-sigil-reference)
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
17. [Implementation Plan](#implementation-plan)

---

## Type Sigil Reference

| Sigil | Meaning | Example |
|-------|---------|---------|
| `::` | Type annotation | `count:: number = 0` |
| `::=` | Type alias | `ID ::= number` |
| `?` | Optional value (`T \| undefined`) | `email:: string?` |
| `??` | Nullable value (`T \| null \| undefined`) | `middle:: string??` |
| `!` | Non-nullable (`NonNullable<T>`) | `id:: ID!` |
| `?:` | Optional property | `email?: string` |
| `\|` | Union member | `"a" \| "b" \| "c"` |
| `=>` | Function type arrow | `(a: number) => string` |
| `<T>` | Generic parameter | `Container<T>` |

This is the complete Rip Types sigil vocabulary.

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
Callback ::= (error:: Error?, data:: any) => void
Handler ::= (req:: Request, res:: Response) => Promise<void>
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

type Config = {
  host: string;
  port: number;
  ssl?: boolean;
  timeout?: number;
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
Comparator ::= (a:: any, b:: any) => number
AsyncFetcher ::= (url:: string) => Promise<Response>

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
  compareTo: (other:: T) => number

# Generic functions
def identity<T>(value:: T):: T
  value

def map<T, U>(items:: T[], fn:: (item:: T) => U):: U[]
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
  bark: () => void
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

Rip Types is primarily **editor-driven**. The intended loop:

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

Rip Types provides:

- Expressive domain modeling with minimal syntax
- Gradual adoption — add types where they help
- Zero runtime overhead — types are compile-time only
- Excellent editor intelligence via `.d.ts` emission
- Clean interop with the TypeScript ecosystem

Rip remains a **JavaScript language**, with types as a **design language**
layered on top.

> **Static typing as a discipline, not a mandate.**

---

## Implementation Plan

This section describes how to implement Rip Types in the compiler. It is
designed to be self-contained — an implementor should be able to read this
section and the referenced source files and complete the work in one pass.

> **Interoperability Principle.** Rip Types emits standard TypeScript `.d.ts`
> declaration files — the same format any TypeScript project produces. The
> goal is full ecosystem interoperability. A Rip library's types are
> indistinguishable from hand-written TypeScript to any consumer. Rip
> developers get IDE autocompletion and type checking for third-party
> packages (React, Express, etc.) through the TypeScript Language Server,
> which reads standard `.d.ts` files from `node_modules`. Rip is a
> participant in the TypeScript ecosystem, not a replacement for it.

### File Architecture

Rip Types follows the same sidecar pattern as the component system.
Components added `src/components.js` alongside the compiler — types add
`src/types.js` alongside the lexer:

| File | Role | Scope |
|------|------|-------|
| `src/lexer.js` | Detect `::` and `::=` tokens, import `installTypeSupport` from `types.js` | Small inline changes |
| `src/types.js` | Lexer sidecar: `installTypeSupport(Lexer)`, `emitTypes(tokens)`, `generateEnum()` | New file, bulk of logic |
| `src/compiler.js` | Call `emitTypes()` before parsing, wire `generateEnum()` | ~8 lines |
| `src/grammar/grammar.rip` | Add `Enum` rule to `Expression` | 1 rule + 1 export |

The boundary is the token stream. Types are fully resolved before parsing —
`rewriteTypes()` strips annotations, `emitTypes()` produces `.d.ts` from
annotated tokens, and type-only constructs are removed before the parser
runs. Only `enum` crosses into the parser/compiler because it generates
runtime JavaScript.

**The `components.js` pattern to follow:**

```js
// src/components.js — existing sidecar for the compiler
export function installComponentSupport(CodeGenerator) {
  const proto = CodeGenerator.prototype;
  proto.generateComponent = function(head, rest, context) { ... };
  proto.generateRender = function(head, rest, context, sexpr) { ... };
  proto.buildRender = function(body) { ... };
  // ...
}

// src/compiler.js — existing wiring
import { installComponentSupport } from './components.js';
installComponentSupport(CodeGenerator);  // at module level, after class definition
```

**The parallel for types:**

```js
// src/types.js — new sidecar for the lexer
export function installTypeSupport(Lexer) {
  Lexer.prototype.rewriteTypes = function() { ... };  // Uses this.scanTokens()
}
export function emitTypes(tokens) { ... }           // Annotated tokens -> .d.ts string
export function generateEnum(head, rest, ctx) { ... } // Enum -> runtime JS object

// src/lexer.js — wiring (mirrors compiler.js wiring for components)
import { installTypeSupport } from './types.js';
installTypeSupport(Lexer);

// src/compiler.js — wiring
import { emitTypes, generateEnum } from './types.js';
CodeGenerator.prototype.generateEnum = generateEnum;
CodeGenerator.GENERATORS['enum'] = 'generateEnum';
// In compile(): let dts = emitTypes(tokens);
```

### Phase 1: Type Annotations (Metadata on Existing Tokens)

Type annotations on variables, parameters, return types, and reactive state
ride as **metadata** on existing tokens. The grammar never sees them. This
means all existing grammar rules, s-expression shapes, and codegen work
unchanged — types are invisible to everything except `rewriteTypes()` and
`emitTypes()`.

#### 1.1 Lexer: Token Detection

**Add `::=` and `::` to `OPERATOR_RE`** (in `src/lexer.js`, near line 215).

The current regex:

```js
let OPERATOR_RE = /^(?:<=>|[-=]>|~>|~=|:=|=!|===|!==|...)/;
```

Add `::=` and `::` with longest-match-first ordering (`::=` before `::`).
Also note that `IDENTIFIER_RE` already avoids matching `:` when followed by
`=` or `:` (the `(?![=:])` lookahead), so `::` after an identifier will fall
through to `literalToken()` where `OPERATOR_RE` picks it up.

**Tag the operators** (in the operator tagging section of `literalToken()`,
near lines 1095-1100, alongside the reactive operators):

```js
else if (val === '::=') tag = 'TYPE_ALIAS';
else if (val === '::')  tag = 'TYPE_ANNOTATION';
```

These must be checked **before** the `([-+:])\1` pattern in the regex, which
currently matches `::` as a repeated `:`. The `::=` three-character match must
come first.

#### 1.2 Rewriter: `rewriteTypes()`

**Add the pass to the rewrite pipeline** (in the `rewrite()` method, after
`rewriteRender()`):

```js
rewrite(tokens) {
  this.tokens = tokens;
  this.removeLeadingNewlines();
  this.closeOpenCalls();
  this.closeOpenIndexes();
  this.normalizeLines();
  this.rewriteRender();
  this.rewriteTypes();          // <-- NEW PASS
  this.tagPostfixConditionals();
  this.addImplicitBracesAndParens();
  this.addImplicitCallCommas();
  return this.tokens;
}
```

**The `rewriteTypes()` method** scans the token stream using `scanTokens()`.
When it encounters a `TYPE_ANNOTATION` (`::`) token, it:

1. Collects all following tokens that are part of the type expression
2. Joins them into a type string
3. Finds the token that survives into the s-expression (see §1.4)
4. Stores the type string on that token (`.data.type` or `.data.returnType`)
5. Removes the `::` and collected type tokens from the stream

```js
rewriteTypes() {
  this.scanTokens((token, i, tokens) => {
    let tag = token[0];

    // --- Handle :: (type annotations) ---
    if (tag === 'TYPE_ANNOTATION') {
      let prevToken = tokens[i - 1];
      if (!prevToken) return 1;

      // Collect the type expression
      let typeTokens = [];
      let j = i + 1;
      let depth = 0;

      while (j < tokens.length) {
        let t = tokens[j];
        let tTag = t[0];

        // Bracket balancing
        // NOTE: The lexer tags < and > as 'COMPARE', not '<' or '>'
        let isOpen = tTag === '(' || tTag === '[' ||
            tTag === 'CALL_START' || tTag === 'PARAM_START' || tTag === 'INDEX_START' ||
            (tTag === 'COMPARE' && t[1] === '<');
        let isClose = tTag === ')' || tTag === ']' ||
            tTag === 'CALL_END' || tTag === 'PARAM_END' || tTag === 'INDEX_END' ||
            (tTag === 'COMPARE' && t[1] === '>');

        if (isOpen) {
          depth++;
          typeTokens.push(t);
          j++;
          continue;
        }
        if (isClose) {
          if (depth > 0) {
            depth--;
            typeTokens.push(t);
            j++;
            continue;
          }
          break;  // Unbalanced close at depth 0 — end of type
        }

        // Delimiters that end the type at depth 0
        if (depth === 0) {
          if (tTag === '=' || tTag === 'REACTIVE_ASSIGN' ||
              tTag === 'COMPUTED_ASSIGN' || tTag === 'READONLY_ASSIGN' ||
              tTag === 'REACT_ASSIGN' || tTag === 'TERMINATOR' ||
              tTag === 'INDENT' || tTag === 'OUTDENT' ||
              tTag === '->') {                        // code arrow ends type
            break;
          }
          if (tTag === ',') break;
        }

        // => at depth 0: function type arrow, type continues
        // -> at depth 0: code arrow, already handled as delimiter above
        typeTokens.push(t);
        j++;
      }

      // Build type string from collected tokens
      let typeStr = typeTokens.map(t => t[1]).join(' ').replace(/\s+/g, ' ').trim();
      // Clean up spacing around brackets
      typeStr = typeStr
        .replace(/\s*<\s*/g, '<').replace(/\s*>\s*/g, '>')
        .replace(/\s*\[\s*/g, '[').replace(/\s*\]\s*/g, ']')
        .replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')')
        .replace(/\s*,\s*/g, ', ');

      // Attach type to the right target token
      //
      // IMPORTANT: For return types, the preceding token is CALL_END or
      // PARAM_END, but the grammar discards these tokens (they don't appear
      // in s-expressions). Instead, find the token that DOES survive:
      //   CALL_END → scan backward to function name IDENTIFIER
      //   PARAM_END → scan forward to the -> token
      //
      let target = prevToken;
      let propName = 'type';

      if (prevToken[0] === 'CALL_END' || prevToken[0] === ')') {
        // Return type on DEF with parameters.
        // Scan backward past balanced parens to find function name.
        let d = 1, k = i - 2;
        while (k >= 0 && d > 0) {
          let kTag = tokens[k][0];
          if (kTag === 'CALL_END' || kTag === ')') d++;
          if (kTag === 'CALL_START' || kTag === '(') d--;
          k--;
        }
        // k is now at the token before CALL_START — the function name
        if (k >= 0) target = tokens[k];
        propName = 'returnType';
      } else if (prevToken[0] === 'PARAM_END') {
        // Return type on arrow function: (x:: number):: string -> ...
        // Scan forward past the type tokens to find the -> token.
        let arrowIdx = i + 1 + typeTokens.length;
        let arrowToken = tokens[arrowIdx];
        if (arrowToken && (arrowToken[0] === '->' || arrowToken[0] === '=>')) {
          target = arrowToken;
        }
        propName = 'returnType';
      } else if (prevToken[0] === 'IDENTIFIER' && i >= 2 &&
                 tokens[i - 2]?.[0] === 'DEF') {
        // Return type on parameterless function: def foo:: string
        propName = 'returnType';
      }

      if (!target.data) target.data = {};
      target.data[propName] = typeStr;

      // Remove :: and type tokens from stream
      let removeCount = 1 + typeTokens.length;  // :: + type tokens
      tokens.splice(i, removeCount);
      return 0;  // Re-examine current position
    }

    // --- Handle ::= (type aliases) ---
    // Described in Phase 2 below

    return 1;
  });
}
```

#### 1.3 Type Expression Boundary Detection

The hardest part of type rewriting is determining where a type expression ends.
The rewriter must **balance brackets** while scanning.

**Delimiters that end a type expression (at bracket depth 0):**

| Token | Why it ends the type |
|-------|---------------------|
| `=` `:=` `~=` `=!` `~>` | Assignment operator follows |
| `->` | Code arrow — function body follows (not part of type) |
| `TERMINATOR` | End of line |
| `INDENT` / `OUTDENT` | Block boundary |
| `)` `CALL_END` `PARAM_END` | End of parameter list |
| `,` | Next parameter or next item |

**`=>` is NOT a delimiter** — it is the function type arrow. When `=>`
appears at depth 0 inside a type expression, the type continues (to
collect the return type). This is why types use `=>` exclusively: it
disambiguates the function type arrow from the code arrow `->`, which
always ends a type expression.

**Tokens that adjust bracket depth:**

| Open | Close | Context | Token tag |
|------|-------|---------|-----------|
| `<` | `>` | Generic type parameters | `COMPARE` (check `t[1]`) |
| `(` | `)` | Function type parentheses | `(` / `)` or `CALL_START` / `CALL_END` |
| `[` | `]` | Array type / index signatures | `[` / `]` or `INDEX_START` / `INDEX_END` |

**Worked examples:**

```
INPUT:  count:: number = 0
SCAN:   :: → start collecting
        number → depth=0, type token
        = → depth=0, assignment delimiter, STOP
RESULT: type = "number"

INPUT:  items:: Map<string, number> = x
SCAN:   :: → start collecting
        Map → depth=0, type token
        < → depth=1, type token
        string → depth=1, type token
        , → depth=1 (inside <>), type token
        number → depth=1, type token
        > → depth=0, type token
        = → depth=0, assignment delimiter, STOP
RESULT: type = "Map<string, number>"

INPUT:  def f(a:: number, b:: string)
SCAN:   :: (after a) → start collecting
        number → depth=0, type token
        , → depth=0, parameter delimiter, STOP
RESULT: type on a = "number"
SCAN:   :: (after b) → start collecting
        string → depth=0, type token
        ) → depth=0, close paren, STOP
RESULT: type on b = "string"

INPUT:  fn:: (a: number, b: string) => void = ...
SCAN:   :: → start collecting
        ( → depth=1, type token
        a → depth=1, type token
        : → depth=1, type token
        number → depth=1, type token
        , → depth=1 (inside parens), type token
        b → depth=1, type token
        : → depth=1, type token
        string → depth=1, type token
        ) → depth=0, type token
        => → depth=0, function type arrow, type token (CONTINUES)
        void → depth=0, type token
        = → depth=0, assignment delimiter, STOP
RESULT: type = "(a: number, b: string) => void"

INPUT:  (name:: string):: string -> "Hello!"
SCAN:   :: (after PARAM_END) → start collecting return type
        string → depth=0, type token
        -> → depth=0, code arrow delimiter, STOP
RESULT: returnType = "string"
        -> stays in stream as the function body arrow
```

**Arrow disambiguation:** Types use `=>` exclusively, code uses `->`.
This means the rewriter never has to guess what an arrow means during type
collection — the token itself is the answer:

| Arrow | In type collection | Meaning |
|-------|-------------------|---------|
| `=>` | Continue collecting | Function type arrow (part of the type) |
| `->` | Stop collecting | Code arrow (function body follows) |

**Other special cases:**

- **`?` / `??` / `!` suffixes**: These modify the type. When they appear
  unspaced after an identifier at depth 0, they are part of the type:
  `string?` → `"string?"`, `ID!` → `"ID!"`.
- **Generic `<>` vs comparison**: Inside a type context (after `::`), always
  treat `<` as opening a generic bracket. The type context is unambiguous
  because we are already inside a `::` collection.

#### 1.4 Return Type Annotations

Return types appear after the parameter list close:

```coffee
def greet(name:: string):: string
```

After `rewriteTypes()` processes the `::` after `)`, the return type must be
stored on the **function name IDENTIFIER**, not on `CALL_END`. This is because
the grammar rule `["def", 2, 4, 6]` discards `CALL_END` (position 5) — any
data stored there is lost when the parser builds the s-expression.

The `rewriteTypes()` code above handles this uniformly — in each case,
find the token that **survives into the s-expression** and store there:

1. **`def` with params** — preceding token is `CALL_END`/`)`: scan **backward**
   past the balanced parentheses to find the function name IDENTIFIER, store
   `.data.returnType` there.
2. **Arrow functions** — preceding token is `PARAM_END`: scan **forward** past
   the collected type tokens to find the `->` token, store `.data.returnType`
   there (`->` is the s-expression head: `["->", params, body]`).
3. **Parameterless `def`** — preceding token is an IDENTIFIER preceded by DEF:
   store `.data.returnType` directly on the name IDENTIFIER.

**Property convention:**
- `.data.type` — variable type, parameter type, property type
- `.data.returnType` — function/method return type
- `.data.typeParams` — generic type parameters (`<T, U>`)

#### 1.5 Token Flow Examples

Each example shows: Rip source → tokens after rewrite → s-expression → outputs.

**Typed variable:**

```coffee
count:: number = 0
```

Tokens after `rewriteTypes()`:
```
IDENTIFIER("count", {type: "number"}), =, NUMBER(0)
```

S-expression (unchanged from untyped):
```
["=", count, 0]         # count carries .data.type = "number"
```

.js output (type erased):
```js
count = 0
```

.d.ts output:
```ts
let count: number;
```

**Typed constant:**

```coffee
MAX:: number =! 100
```

Tokens: `IDENTIFIER("MAX", {type: "number"}), READONLY_ASSIGN, NUMBER(100)`

S-expression: `["readonly", MAX, 100]` — MAX carries `.data.type = "number"`

.js: `const MAX = 100`

.d.ts: `declare const MAX: number;`

**Typed reactive state:**

```coffee
count:: number := 0
doubled:: number ~= count * 2
```

S-expressions:
```
["state", count, 0]        # count carries .data.type = "number"
["computed", doubled, ...]  # doubled carries .data.type = "number"
```

.d.ts:
```ts
declare const count: Signal<number>;
declare const doubled: Computed<number>;
```

**Typed function:**

```coffee
def getUser(id:: number):: User
  db.find!(id)
```

Tokens after rewrite:
```
DEF, IDENTIFIER("getUser", {returnType: "User"}), CALL_START,
  IDENTIFIER("id", {type: "number"}),
CALL_END, INDENT, ..., OUTDENT
```

S-expression: `["def", getUser, [id], body]`
- `id` carries `.data.type = "number"`
- `getUser` carries `.data.returnType = "User"`

.js: `async function getUser(id) { return db.find(id); }`

.d.ts: `declare function getUser(id: number): User;`

**Typed arrow function:**

```coffee
greet = (name:: string):: string -> "Hello, #{name}!"
```

Tokens after rewrite:
```
IDENTIFIER("greet"), =, PARAM_START,
  IDENTIFIER("name", {type: "string"}),
PARAM_END, ->({returnType: "string"}), ...
```

**Class properties:**

```coffee
class UserService
  db:: Database
  cache:: Map<string, User>
```

Tokens: identifiers carry `.data.type`, grammar sees normal class body.

.d.ts:
```ts
declare class UserService {
  db: Database;
  cache: Map<string, User>;
}
```

#### 1.6 Token-Level Type Emission

After `rewriteTypes()` strips type annotations and stores metadata on
tokens, the `emitTypes()` function scans the annotated token stream in a
single forward pass and emits `.d.ts` declarations. This happens in
`Compiler.compile()`, between tokenization and parsing — before the
parser ever sees the tokens.

`emitTypes()` is a standalone function (not a class). It maintains a
simple state machine:

- **Indent depth** — tracks INDENT/OUTDENT to know nesting level
- **Current class** — when inside a CLASS body, emit class members
- **Export flag** — when EXPORT precedes a declaration, prepend `export`

**Pattern matching** — the function scans forward and recognizes:

| Token pattern | Emission |
|---------------|----------|
| `DEF IDENTIFIER(+returnType) CALL_START params CALL_END` | `function name(params): ReturnType;` |
| `DEF IDENTIFIER(+returnType)` (no params) | `function name(): ReturnType;` |
| `IDENTIFIER(+type) = ...` | `let name: Type;` |
| `IDENTIFIER(+type) READONLY_ASSIGN ...` | `const name: Type;` |
| `STATE IDENTIFIER(+type) ...` | `const name: Signal<Type>;` |
| `COMPUTED IDENTIFIER(+type) ...` | `const name: Computed<Type>;` |
| `CLASS IDENTIFIER INDENT ... OUTDENT` | `class Name { ... }` |
| `EXPORT <declaration>` | Prepend `export` to the declaration |
| `TYPE_DECL` marker | `type Name = TypeText;` or `interface Name { ... }` |

**Rip-to-TypeScript conversions** — `emitTypes()` converts Rip type
syntax into standard TypeScript:

| Rip syntax | TypeScript equivalent |
|-----------|---------------------|
| `::` | `:` (annotation sigil to type separator) |
| `T?` | `T \| undefined` |
| `T??` | `T \| null \| undefined` |
| `T!` | `NonNullable<T>` |

Function type expressions use `=>` directly (same as TypeScript), so no
arrow conversion is needed.

The function returns a `.d.ts` string. Declarations without type
annotations are skipped — only annotated code appears in the output.

### Phase 2: Type-Only Declarations

These constructs exist only in the type system — they have no runtime
representation (except `enum`). The rewriter handles type aliases and
interfaces entirely (they never enter the grammar). Only `enum` needs a
grammar rule because it emits runtime JavaScript.

#### 2.1 Keyword Migration

**Move `enum` and `interface` from `RESERVED` to `RIP_KEYWORDS`** in
`src/lexer.js`. Currently (line 83):

```js
let RESERVED = new Set([
  'case', 'function', 'var', 'void', 'with', 'const', 'let',
  'enum', 'native', 'implements', 'interface', 'package',
  'private', 'protected', 'public', 'static',
]);
```

Remove `enum` and `interface` from `RESERVED`. Add them to `RIP_KEYWORDS`:

```js
let RIP_KEYWORDS = new Set([
  'undefined', 'Infinity', 'NaN',
  'then', 'unless', 'until', 'loop', 'of', 'by', 'when', 'def',
  'component', 'render',
  'enum', 'interface',          // <-- ADD
]);
```

No changes to `classifyKeyword()` are needed — the existing fallback
`if (RIP_KEYWORDS.has(id)) return upper` (line 618) automatically tags
`enum` as `ENUM` and `interface` as `INTERFACE`.

#### 2.2 Type Aliases (`::=`) — Unified typeText

The `::=` operator declares a named type. The `rewriteTypes()` pass handles
it by collecting the right-hand side, converting it to a TypeScript-compatible
type string, and packaging it into a single `TYPE_DECL` marker token. All
three forms (simple alias, structural type, block union) produce the same
metadata shape: `{ name, typeText }`. The `emitTypes()` function simply
emits `type ${name} = ${typeText};` for all of them.

**Simple alias:**

```coffee
ID ::= number
UserID ::= number | string
```

When `rewriteTypes()` encounters `TYPE_ALIAS` (`::=`):

1. Record the preceding `IDENTIFIER` token as the type name
2. Collect all following tokens as the type body (same boundary rules as `::`)
3. Replace the entire sequence (`IDENTIFIER`, `TYPE_ALIAS`, type tokens) with
   a single `TYPE_DECL` marker token

```js
// Inside rewriteTypes(), handling TYPE_ALIAS:
if (tag === 'TYPE_ALIAS') {
  let nameToken = tokens[i - 1];
  let name = nameToken[1];

  // Collect type body tokens (same boundary logic as ::)
  let typeTokens = [];
  let j = i + 1;
  let depth = 0;
  // ... same collection loop as for TYPE_ANNOTATION ...

  let typeStr = /* join collected tokens */;

  // Replace name + ::= + type tokens with TYPE_DECL marker
  let declToken = gen('TYPE_DECL', name, nameToken);
  declToken.data = { name, typeText: typeStr };
  tokens.splice(i - 1, 2 + typeTokens.length, declToken);
  return 0;
}
```

The `TYPE_DECL` marker is read by `emitTypes()` and then **removed from
the token stream** before parsing. No grammar rule is needed.

.d.ts: `type ID = number;`

.js: *(nothing — type-only, erased)*

**Structural type:**

```coffee
User ::= type
  id: number
  name: string
  email?: string
```

When `rewriteTypes()` sees `TYPE_ALIAS` followed by `IDENTIFIER("type")` and
then `INDENT`, it collects the block body and converts it to a TypeScript
object type string:

1. Consume the `INDENT`
2. Collect property declarations line by line until `OUTDENT`
3. Convert to TypeScript object syntax: `"{ id: number; name: string; email?: string; }"`
4. Store as a single typeText string — no structured property metadata needed:
   ```js
   declToken.data = {
     name: "User",
     typeText: "{ id: number; name: string; email?: string; }"
   };
   ```
5. Replace entire sequence with single `TYPE_DECL` marker

The rewriter does the Rip-to-TypeScript formatting (indented properties to
`{ prop: type; ... }`). The emitter just writes `type ${name} = ${typeText};`
without needing to understand the internal structure.

.d.ts:
```ts
type User = {
  id: number;
  name: string;
  email?: string;
};
```

**Block union:**

```coffee
HttpMethod ::=
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
```

When `rewriteTypes()` sees `TYPE_ALIAS` followed by `TERMINATOR` or `INDENT`
with leading `|` tokens, it collects union members and joins them:

```js
declToken.data = {
  name: "HttpMethod",
  typeText: '"GET" | "POST" | "PUT" | "DELETE"'
};
```

.d.ts: `type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";`

#### 2.3 Interfaces — Rewriter-Based

```coffee
interface Animal
  name: string

interface Dog extends Animal
  breed: string
  bark: () => void
```

Interfaces are type-only (no .js output), so they are handled entirely by
the rewriter — no grammar rule needed. When `rewriteTypes()` encounters an
`INTERFACE` token:

1. Record the interface name
2. If followed by `EXTENDS`, record the parent name
3. Collect the body block (between `INDENT` and `OUTDENT`)
4. Convert to TypeScript interface body string
5. Replace the entire sequence with a `TYPE_DECL` marker:
   ```js
   declToken.data = {
     name: "Dog",
     kind: "interface",
     extends: "Animal",
     typeText: "{ breed: string; bark: () => void; }"
   };
   ```

The `emitTypes()` function recognizes kind `"interface"` and emits:

```ts
interface Dog extends Animal {
  breed: string;
  bark: () => void;
}
```

The `TYPE_DECL` marker is removed before parsing. The parser and compiler
never see interfaces.

.js: *(nothing — erased)*

#### 2.4 Enums

```coffee
enum HttpCode
  ok = 200
  created = 201
  notFound = 404
  serverError = 500
```

Enums are the **one** type construct that emits both .js and .d.ts. They
are the only construct that needs a grammar rule and a compiler generator.

**Grammar rule:**

```
Enum: [
  o 'ENUM Identifier Block', '["enum", 2, 3]'
]
```

Add `Enum` to the `Expression` list.

S-expression: `["enum", "HttpCode", body]`

.js (runtime reverse-mapping object, via `generateEnum()`):
```js
const HttpCode = {
  ok: 200, created: 201, notFound: 404, serverError: 500,
  200: "ok", 201: "created", 404: "notFound", 500: "serverError"
};
```

.d.ts (emitted by `emitTypes()` from the token stream):
```ts
enum HttpCode {
  ok = 200,
  created = 201,
  notFound = 404,
  serverError = 500
}
```

Note: `emitTypes()` reads enum info from the token stream before parsing.
The enum tokens remain in the stream for the parser (unlike type aliases
and interfaces, which are removed).

#### 2.5 Grammar Changes Summary

In `src/grammar/grammar.rip`, add `Enum` to the `Expression` list:

```
Expression: [
  o 'Value'
  o 'Code'
  o 'Operation'
  o 'Assign'
  o 'ReactiveAssign'
  o 'ComputedAssign'
  o 'ReadonlyAssign'
  o 'ReactAssign'
  o 'Enum'                 # <-- ADD (only type construct needing grammar)
  o 'If'
  ...
]
```

And add the single new rule:

```
Enum: [
  o 'ENUM Identifier Block', '["enum", 2, 3]'
]
```

Also add to `Export`:

```
o 'EXPORT Enum'        , '["export", 2]'
```

No `TypeDecl` or `Interface` grammar rules — those are handled entirely by
the rewriter and removed before parsing.

#### 2.6 Generic Type Parameters

```coffee
def identity<T>(value:: T):: T
  value

def map<T, U>(items:: T[], fn:: (item:: T) => U):: U[]
  items.map(fn)
```

Generic parameters on functions require special handling because `<` is
normally a comparison operator.

**Detection via `.spaced` property:**

The lexer tracks whitespace before every token via the `.spaced` property.
In `def identity<T>`, the `<` token is unspaced from the identifier — this
is the key signal. In a comparison `x < y`, the `<` is spaced.

When `rewriteTypes()` sees `DEF IDENTIFIER` followed by an unspaced `<`:

1. Treat it as a generic parameter list
2. Collect balanced `<...>` tokens as a string (e.g., `"<T>"`, `"<T, U>"`,
   `"<T extends Ordered>"`)
3. Store on the function name token as `.data.typeParams`
4. Remove the `<...>` tokens from the stream

```js
// Generic detection using .spaced:
if (tag === 'IDENTIFIER' && i >= 1 && tokens[i - 1]?.[0] === 'DEF') {
  let next = tokens[i + 1];
  if (next && next[0] === 'COMPARE' && next[1] === '<' && !next.spaced) {
    let genTokens = collectBalancedAngleBrackets(tokens, i + 1);
    if (genTokens) {
      if (!token.data) token.data = {};
      token.data.typeParams = joinTokens(genTokens);
      tokens.splice(i + 1, genTokens.length);
    }
  }
}
```

Generic parameters on type aliases work the same way:

```coffee
Container<T> ::= type
  value: T
```

The `rewriteTypes()` pass detects `IDENTIFIER` + unspaced `<...>` +
`TYPE_ALIAS` and collects the generic params before processing the `::=`.

.d.ts:
```ts
function identity<T>(value: T): T;
function map<T, U>(items: T[], fn: (item: T) => U): U[];
type Container<T> = { value: T; };
```

### Phase 3: Dual Emission (.js and .d.ts)

All type-related logic lives in `src/types.js`. The `.d.ts` is emitted from
the annotated token stream (before parsing). The `.js` is generated by the
existing CodeGenerator (after parsing), with only `generateEnum()` added.

#### 3.1 `generateEnum()` — The One Compiler Addition

Enums are the only type construct that produces runtime JavaScript. The
`generateEnum()` function is exported from `types.js` and wired onto the
CodeGenerator prototype:

```js
// In src/types.js
export function generateEnum(head, rest, context) {
  let [name, body] = rest;
  // Parse body into key-value pairs
  let pairs = this.parseEnumBody(body);
  let forward = pairs.map(([k, v]) => `${k}: ${v}`).join(', ');
  let reverse = pairs.map(([k, v]) => `${v}: "${k}"`).join(', ');
  return `const ${name} = {${forward}, ${reverse}}`;
}
```

**Wiring in `src/compiler.js`:**

```js
import { emitTypes, generateEnum } from './types.js';
CodeGenerator.prototype.generateEnum = generateEnum;
CodeGenerator.GENERATORS['enum'] = 'generateEnum';
```

No `generateTypeAlias()` or `generateInterface()` methods are needed —
type aliases and interfaces are removed from the token stream by the
rewriter before the parser ever sees them.

#### 3.2 `emitTypes()` — Token-Level .d.ts Emission

The `emitTypes()` function replaces the `DtsGenerator` class. Instead of
walking the s-expression tree, it scans the annotated token stream in a
single forward pass. This is simpler because:

- It doesn't duplicate the CodeGenerator's dispatch logic
- It only handles declarations (not all AST node types)
- It reads metadata that `rewriteTypes()` already placed on tokens

See §1.6 for the pattern-matching table and state machine description.

#### 3.3 Compiler Wiring

In `src/compiler.js`, the compilation pipeline becomes:

```js
compile(source) {
  // Step 1: Tokenize (includes rewriteTypes() via installTypeSupport)
  let lexer = new Lexer();
  let tokens = lexer.tokenize(source);

  // Step 2: Emit .d.ts from annotated tokens (before parsing)
  let dts = null;
  if (this.options.types === 'emit' || this.options.types === 'check') {
    dts = emitTypes(tokens);
    // Remove TYPE_DECL markers so the parser doesn't see them
    tokens = tokens.filter(t => t[0] !== 'TYPE_DECL');
  }

  // Step 3: Parse (grammar only sees Enum as a new construct)
  // ... existing parser setup ...
  let sexpr = parser.parse(source);

  // Step 4: Generate .js (CodeGenerator only needs generateEnum)
  let generator = new CodeGenerator({ ... });
  let code = generator.compile(sexpr);

  return { tokens, sexpr, code, dts, data: dataSection, reactiveVars: generator.reactiveVars };
}
```

The key insight: `.d.ts` emission happens **between tokenization and
parsing**. After `emitTypes()` reads the annotated tokens, `TYPE_DECL`
markers are filtered out. The parser receives a clean, type-free token
stream — identical to what it would see from untyped Rip code, plus
`ENUM` tokens.

#### 3.4 `const` Emission Rule

Type annotations never affect `let` vs `const` in `.js` output:

| Rip operator | .js keyword | .d.ts keyword |
|-------------|-------------|---------------|
| `=` | `let` (hoisted by `programVars`) | `let` |
| `=!` | `const` | `const` |
| `:=` | `const` (reactive signal) | `const` (Signal) |
| `~=` | `const` (computed signal) | `const` (Computed) |
| `~>` | `const` (effect) | `const` |

### Edge Cases

#### Optionality Suffixes in Types

The `?`, `??`, and `!` suffixes appear unspaced after the type name:

```coffee
email:: string?       # → type = "string?"
middle:: string??     # → type = "string??"
id:: ID!              # → type = "ID!"
```

In `rewriteTypes()`, when collecting type tokens, if the next token is `?`,
`??`, or `!` and is **not spaced** from the previous token, include it as
part of the type string.

The `emitTypes()` function converts Rip type syntax into standard TypeScript:

| Rip syntax | TypeScript equivalent |
|-----------|---------------------|
| `::` | `:` (annotation sigil to type separator) |
| `T?` | `T \| undefined` |
| `T??` | `T \| null \| undefined` |
| `T!` | `NonNullable<T>` |

#### File-Level Type Directives

```coffee
# @types off     — ignore types in this file
# @types emit    — emit .d.ts
# @types check   — emit .d.ts + enable tsc validation
```

These are comments. The lexer's `commentToken()` method can detect this
pattern and set a flag. Alternatively, the `Compiler` can scan for the
directive before tokenizing.

#### Export of Type-Only Declarations

```coffee
export User ::= type
  id: number
  name: string

export def getUser(id:: number):: User?
  db.find(id)
```

The rewriter detects `EXPORT` before `::=` sequences and marks the
`TYPE_DECL` marker accordingly. The `emitTypes()` function prepends
`export` to the declaration. No grammar rule is involved for type-only
exports — the `TYPE_DECL` marker is removed before parsing.

For exported functions, the existing `Export` grammar rules handle
`EXPORT Expression` as before.

.js (type alias erased, function exported):
```js
export function getUser(id) {
  return db.find(id);
}
```

.d.ts (both exported):
```ts
export type User = { id: number; name: string; };
export function getUser(id: number): User | undefined;
```

### Test Matrix

Each row is a test case. Verify both .js and .d.ts output.

| # | Rip Input | .js Output | .d.ts Output |
|---|-----------|-----------|-------------|
| 1 | `count:: number = 0` | `count = 0` | `let count: number;` |
| 2 | `MAX:: number =! 100` | `const MAX = 100` | `declare const MAX: number;` |
| 3 | `count:: number := 0` | `const count = __state(0)` | `declare const count: Signal<number>;` |
| 4 | `doubled:: number ~= x * 2` | `const doubled = __computed(...)` | `declare const doubled: Computed<number>;` |
| 5 | `def f(a:: number):: string` | `function f(a) { ... }` | `declare function f(a: number): string;` |
| 6 | `(x:: number):: number -> x + 1` | `(x) => x + 1` | `(x: number) => number` |
| 7 | `ID ::= number` | *(empty)* | `type ID = number;` |
| 8 | `User ::= type` (+ block) | *(empty)* | `type User = { id: number; ... };` |
| 9 | `Status ::= \| "a" \| "b"` | *(empty)* | `type Status = "a" \| "b";` |
| 10 | `interface Foo` (+ block) | *(empty)* | `interface Foo { ... }` |
| 11 | `enum Code` (+ block) | `const Code = { ... }` | `enum Code { ... }` |
| 12 | `items:: Map<string, number> = x` | `items = x` | `let items: Map<string, number>;` |
| 13 | `email:: string?` | — | `let email: string \| undefined;` |
| 14 | `id:: ID!` | — | `let id: NonNullable<ID>;` |
| 15 | `def identity<T>(v:: T):: T` | `function identity(v) { ... }` | `declare function identity<T>(v: T): T;` |
| 16 | `export User ::= type` (+ block) | *(empty)* | `export type User = { ... };` |
| 17 | `export def f(x:: number):: number` | `export function f(x) { ... }` | `export function f(x: number): number;` |

---

**See Also:**
- [RIP-LANG.md](RIP-LANG.md) — Language reference
- [RIP-REACTIVITY.md](RIP-REACTIVITY.md) — Reactive system details
- [RIP-INTERNALS.md](RIP-INTERNALS.md) — Compiler internals
