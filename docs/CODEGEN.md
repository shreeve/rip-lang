# Code Generator Reference

**Version:** 1.0.0 - **Stable Release!** 🎉
**Last Updated:** 2025-10-31
**Test Coverage:** 843/843 rip tests (100%) ✅
**Status:** Stable & Production Ready - Self-Hosting Complete

Complete mapping of CoffeeScript grammar patterns → S-expressions → JavaScript code generation.

---

## Overview

The code generator (`src/codegen.js`) is a pattern matcher that transforms s-expressions into JavaScript. It's **simple by design** - just switch cases that match array patterns.

### The Process

```
CoffeeScript Grammar → Parser → S-Expression → Codegen → JavaScript
   (grammar.rip)                  (arrays)                  (string)
```

### Example Flow

```rip
# Input
x = 42

# Tokens (from lexer)
[["IDENTIFIER", "x"], ["=", "="], ["NUMBER", "42"]]

# S-Expression (from parser)
["program", ["=", "x", 42]]

# Generated Code (from codegen)
"x = 42;"
```

---

## Understanding Grammar vs Node Types

**Question:** The grammar has 91 types and 406 rules. Why are we implementing 110+ node types?

### The Numbers

- **91 Grammar Types** - BNF non-terminals (like `Expression`, `Statement`, `Value`)
- **406 Grammar Rules** - Production rules (the `o '...'` lines in grammar.rip)
- **110+ S-Expression Node Types** - Actual output strings (like `"yield"`, `"+"`, `"block"`)

### The Relationship

```
91 Grammar Types (BNF structure)
    ↓ via 406 Rules (transformations)
110+ Node Types (parser output that codegen handles)
```

**Key Insight:** Grammar types are NOT the same as node types!

### Why They're Different

**Grammar types are organizational:**
- Structure the BNF grammar for readability
- Enable proper precedence handling
- Allow rule reuse
- Enforce syntax constraints

**Node types are concrete output:**
- What the parser actually emits
- What codegen needs to handle
- The actual s-expression heads

### Mapping Patterns

#### Pattern 1: Pass-Through (No Node Output)
**~30 grammar types → 0 node types**

These types just route to other types:
```coffeescript
# Grammar Type: "Expression" (organizational)
Expression: [
  o 'Value'        # Passes through
  o 'Code'         # Passes through
  o 'Operation'    # Passes through
  o 'Assign'       # Passes through
]
```
**No `"expression"` node type in output!** Just organizational structure.

#### Pattern 2: One-to-One
**~40 grammar types → ~40 node types**

Direct mapping:
```coffeescript
Block: [
  o 'INDENT OUTDENT'     , '["block"]'
  o 'INDENT Body OUTDENT', '["block", ...2]'
]
```
**One grammar type → one node type:** `"block"`

#### Pattern 3: One-to-Many
**~10 grammar types → ~30 node types**

One type emits many nodes:
```coffeescript
Operation: [
  o 'Expression + Expression' , '["+", 1, 3]'    # → "+"
  o 'Expression - Expression' , '["-", 1, 3]'    # → "-"
  o 'Expression * Expression' , '["*", 1, 3]'    # → "*"
  o 'Expression ** Expression', '["**", 1, 3]'   # → "**"
  o 'Expression && Expression', '["&&", 1, 3]'   # → "&&"
  ... (50+ more rules!)
]
```
**One grammar type → 30+ node types!**

### Summary

- **91 grammar types** organize the grammar for readability and correctness
- **406 rules** define all the syntactic variations
- **110+ node types** are what actually gets emitted
- **You implement 110+ cases** in codegen.js (one per node type)

**The grammar is the MEANS (how to parse)**
**The node types are the END (what to generate)**

Many grammar types are just organizational scaffolding - they route to other types but never appear in the output themselves.

---

## Implementation Status

**🏆 110+ Node Types - ALL IMPLEMENTED! 🏆**

**Test Results:**
- ✅ **843/843 tests passing (100%)**
- ✅ **20 test files** (organized alphabetically)
- ✅ **110+ node types** (complete grammar coverage)
- ✅ **Zero failing tests**
- ✅ **Self-hosting** (Rip compiles itself)

**Code Size:**
- **4,738 LOC** in codegen.js
- **Complete implementation** of all CoffeeScript 2.7 features
- **Plus Rip innovations** (heregex, regex+, dammit, void functions, etc.)

---

## Node Type Catalog (110+ Types)

### Core Structures (6 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `program` | All | All files | Root wrapper |
| `block` | Many | control.rip | Statement blocks |
| `def` | 71 | functions.rip | Function definitions |
| `->` | 71 | functions.rip | Thin arrow (unbound this) |
| `=>` | 71 | functions.rip | Fat arrow (bound this) |
| `return` | 71 | functions.rip | Return statements |

### Literals (7 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| NUMBER | 30 | literals.rip | Numbers (int, float, hex, binary, octal) |
| STRING | 74 | strings.rip | String literals with quote preservation |
| `"undefined"` | 30 | literals.rip | undefined literal |
| `"null"` | 30 | literals.rip | null literal |
| BOOL | 30 | literals.rip | true, false |
| `"this"` | 30 | literals.rip | this, @ |
| REGEX | 44 | regex.rip | Regex literals + heregex |

### Assignment (17 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `=` | 43 | assignment.rip | Variable assignment |
| `+=, -=, *=, /=, %=, **=` | 43 | assignment.rip | Arithmetic compound |
| `&=, \|=, ^=, <<=, >>=, >>>=` | 43 | assignment.rip | Bitwise compound |
| `\|\|=, &&=, ??=, ?=` | 43 | assignment.rip | Logical compound |
| `//=` | 43 | assignment.rip | Floor division assignment |

### Operators (35+ types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `+, -, *, /, %, **` | 66 | operators.rip | Arithmetic (binary & unary) |
| `==, !=, <, >, <=, >=` | 66 | operators.rip | Comparison (→ strict ===, !==) |
| `===, !==` | 66 | operators.rip | Explicit strict |
| `&&, \|\|, ??` | 66 | operators.rip | Logical |
| `!, ~` | 66 | operators.rip | Unary |
| `&, \|, ^` | 66 | operators.rip | Bitwise |
| `<<, >>, >>>` | 66 | operators.rip | Bit shifts |
| `++, --` | 66 | operators.rip | Increment/decrement (prefix/postfix) |
| `//` | 66 | operators.rip | Floor division |
| `%%` | 66 | operators.rip | Modulo (true modulo, not remainder) |
| `instanceof` | 66 | operators.rip | Instance check |
| `in` | 66 | operators.rip | Membership (array/string/object aware) |
| `of` | 66 | operators.rip | Property check |
| `typeof, delete` | 66 | operators.rip | Reflection operators |
| `new` | 66 | operators.rip | Constructor call |
| `=~` | 44 | regex.rip | Regex match (Ruby-style) |

### Property Access (9 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `.` | 29 | properties.rip | Property access |
| `?.` | 54 | optional.rip | ES6 optional chaining |
| `::` | 29 | properties.rip | Prototype access |
| `?::` | 54 | optional.rip | Optional prototype |
| `[]` | 29 | properties.rip | Array indexing + slicing |
| `?[]` | 54 | optional.rip | Soak indexing (CoffeeScript) |
| `optindex` | 54 | optional.rip | ES6 optional index `?.[` |
| `optcall` | 54 | optional.rip | ES6 optional call `?.(` |
| `regex-index` | 44 | regex.rip | Regex indexing `x[/pattern/, n]` |

### Optional Operators (5 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `?` | 54 | optional.rip | Existence check (postfix) |
| `?call` | 54 | optional.rip | Soak call (CoffeeScript) |
| `?super` | 23 | classes.rip | Soak super call |
| Above + ES6 operators | 54 | optional.rip | `?.`, `?.[`, `?.(` |

### Control Flow (6 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `if` | 44 | control.rip | If/else (context-aware!) |
| `unless` | 44 | control.rip | Unless (negated if) |
| `?:` | 44 | control.rip | Ternary operator |
| `switch, when` | 44 | control.rip | Switch statements (IIFE in value context) |
| `do-iife` | 44 | control.rip | Do expressions |

### Loops (9 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `for-in` | 21 | loops.rip | Array iteration (optimized for ranges!) |
| `for-of` | 21 | loops.rip | Object iteration (correct var ordering) |
| `for-from` | 29 | async.rip | Async iteration (for-await) |
| `while` | 21 | loops.rip | While loops |
| `until` | 21 | loops.rip | Until loops |
| `loop` | 21 | loops.rip | Infinite loops |
| `break, break-if` | 21 | loops.rip | Break statements |
| `continue, continue-if` | 21 | loops.rip | Continue statements |

### Data Structures (8 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `array` | Multiple | Various | Array literals with elisions |
| `object` | Multiple | Various | Object literals with shorthand |
| `computed` | Multiple | Various | Computed properties `[expr]` |
| `..` | Multiple | Various | Inclusive range |
| `...` | Multiple | Various | Exclusive range + spread |
| `rest` | 71 | functions.rip | Rest parameters |
| `default` | 71 | functions.rip | Default parameters |
| `expansion` | 71 | functions.rip | Expansion marker `(a, ..., b)` |

### Comprehensions (2 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `comprehension` | 19 | comprehensions.rip | Array comprehensions (context-aware!) |
| `object-comprehension` | 19 | comprehensions.rip | Object comprehensions |

**See [COMPREHENSIONS.md](COMPREHENSIONS.md) for complete specification.**

### Classes (4 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `class` | 23 | classes.rip | ES6 classes with @ params, bound methods |
| `super` | 23 | classes.rip | Super calls/access (method-aware) |
| `?super` | 23 | classes.rip | Soak super call |
| `new.target` | 23 | classes.rip | Meta property |

### Async/Generators (4 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `await` | 29 | async.rip | Await expression |
| `yield` | 29 | async.rip | Yield expression |
| `yield-from` | 29 | async.rip | Generator delegation (`yield*`) |
| Dammit `!` | 29 | async.rip | Call-and-await (String.await metadata) |

### Modules (6 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `import` | 23 | modules.rip | Import statements + dynamic import() |
| `export` | 23 | modules.rip | Export statements |
| `export-default` | 23 | modules.rip | Export default |
| `export-all` | 23 | modules.rip | Export all (`export * from`) |
| `export-from` | 23 | modules.rip | Export from |
| `import.meta` | 23 | modules.rip | Import meta property |

### Error Handling (2 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `try` | 30 | errors.rip | Try/catch/finally (4 forms!) |
| `throw` | 30 | errors.rip | Throw statements (with conditional unwrapping) |

### Strings & Special (4 types) ✅

| Node | Tests | File | Notes |
|------|-------|------|-------|
| `str` | 74 | strings.rip | String interpolation (template literals) |
| `tagged-template` | 74 | strings.rip | Tagged template literals |
| `regex-index` | 44 | regex.rip | Regex indexing feature |
| `__DATA__` | Various | Multiple | Data marker (compiler.js) |

---

## Complete Node Type Summary

**🏆 ALL 110+ NODE TYPES IMPLEMENTED! 🏆**

**By Category:**
- ✅ Core Structures: 6 types
- ✅ Literals: 7 types
- ✅ Assignment: 17 types
- ✅ Operators: 35+ types
- ✅ Property Access: 9 types
- ✅ Optional Operators: 5 types
- ✅ Control Flow: 6 types
- ✅ Loops: 9 types
- ✅ Data Structures: 8 types
- ✅ Comprehensions: 2 types
- ✅ Classes: 4 types
- ✅ Async/Generators: 4 types
- ✅ Modules: 6 types
- ✅ Error Handling: 2 types
- ✅ Strings & Special: 4 types

**Total: 110+ node types (100% complete)**

---

## Current Test File Organization

**Flat structure (test/rip/):** 20 organized files

```
test/rip/
├── assignment.rip       (43 tests) - All assignment operators
├── async.rip            (29 tests) - await, yield, dammit operator
├── basic.rip            (52 tests) - Arrays, objects, ranges
├── classes.rip          (23 tests) - ES6 classes, super, inheritance
├── compatibility.rip    (45 tests) - CoffeeScript dual syntax
├── comprehensions.rip   (19 tests) - Array/object comprehensions
├── control.rip          (44 tests) - if, unless, switch, blocks
├── data.rip             (20 tests) - __DATA__ marker
├── errors.rip           (30 tests) - try/catch/throw
├── functions.rip        (71 tests) - def, arrows, params, void functions
├── guards.rip           (27 tests) - when clauses, own keyword
├── literals.rip         (30 tests) - Numbers, strings, booleans
├── loops.rip            (21 tests) - for, while, until, loop
├── modules.rip          (23 tests) - ES6 imports/exports
├── operators.rip        (66 tests) - All operators
├── optional.rip         (54 tests) - Dual optional syntax (10 operators!)
├── properties.rip       (29 tests) - Property/index access
├── regex.rip            (44 tests) - Regex + heregex + Ruby-style
├── stabilization.rip    (67 tests) - Advanced patterns + bootstrap bugs
└── strings.rip          (74 tests) - Interpolation, heredocs, tagged

Total: 843 tests, 100% passing
```

**Key Files:**
- **compatibility.rip** - CoffeeScript postfix spread/rest + legacy existential
- **guards.rip** - when clauses + own keyword (critical for for-of ordering)
- **stabilization.rip** - Bootstrap bugs + advanced edge cases
- **functions.rip** - Includes 10 void function tests

---

## Key Implementation Features

### 1. Context-Aware Generation

**Some patterns generate different code based on usage context:**

```javascript
generate(sexpr, context = 'statement') {
  // context can be 'statement' or 'value'
}
```

**Example: Comprehensions**

```rip
# Statement context (result discarded) → Plain loop
console.log x for x in arr
# → for (const x of arr) { console.log(x); }

# Value context (result used) → IIFE with array building
result = (x * 2 for x in arr)
# → (() => { const result = []; for...; return result; })()
```

**Pass 'value' context in:**
- Assignments (right side)
- Return statements
- Function arguments
- Array/object elements
- Ternary branches
- Last statement in function (implicit return)

See [COMPREHENSIONS.md](COMPREHENSIONS.md) for complete context rules.

### 2. Variable Scoping System

**CoffeeScript semantics:** Function-level scoping with closure access

```javascript
// Program level
let a, b, fn;

// Function level - only NEW variables
fn = function() {
  let x, y;     // New variables
  a = 1;        // Uses outer 'a' (no redeclaration)
  x = 2;        // Uses local 'x'
};
```

**Implementation:**
- `collectProgramVariables()` - Walks top-level, stops at functions
- `collectFunctionVariables()` - Walks function body, stops at nested functions
- Filters out outer variables (accessed via closure)
- Emits `let` declarations at scope top

### 3. Auto-Detection

**Functions automatically become async or generators:**

```rip
# Contains await → becomes async function
getData = ->
  result = await fetch(url)
  result.json()
# → async function() { ... }

# Contains yield → becomes generator
counter = ->
  yield 1
  yield 2
# → function*() { ... }

# Contains dammit operator → becomes async
fetchAll = ->
  users = getUsers!
  posts = getPosts!
# → async function() { ... await getUsers() ... }
```

**Detection methods:**
- `containsAwait(sexpr)` - Checks for `await` nodes + dammit operators
- `containsYield(sexpr)` - Checks for `yield` nodes
- Stops at function boundaries (nested functions checked separately)

### 4. Dual Optional Syntax

**Rip supports BOTH CoffeeScript soak AND ES6 optional chaining:**

| Syntax | Type | Compiles To |
|--------|------|-------------|
| `arr?` | Soak | `(arr != null)` |
| `arr?[0]` | Soak | `(arr != null ? arr[0] : undefined)` |
| `fn?(x)` | Soak | `(typeof fn === 'function' ? fn(x) : undefined)` |
| `obj?.prop` | ES6 | `obj?.prop` |
| `arr?.[0]` | ES6 | `arr?.[0]` |
| `fn?.(x)` | ES6 | `fn?.(x)` |
| `x ?? y` | ES6 | `x ?? y` |
| `a ??= 10` | ES6 | `a ??= 10` |

**Mix and match:**
```rip
obj?.arr?[0]  # ES6 + CoffeeScript together!
```

### 5. Sigil Operators

**Dual meaning of `!` based on context:**

**At call-site (dammit):**
```rip
result = fetchData!  # → await fetchData()
```

**At definition (void):**
```rip
def process!         # → function process() { ...; return; }
  doWork()
```

See [DAMMIT-OPERATOR.md](DAMMIT-OPERATOR.md) for complete guide.

### 6. Range Optimization

**Traditional for loops instead of wasteful IIFEs:**

```rip
# Optimized to traditional loop
for i in [1...100]
  process(i)
# → for (let i = 1; i < 100; i++) { process(i); }

# Not: (() => { return Array.from(...) })(1, 100).forEach(...)
# Savings: 73% smaller code!
```

**Reverse iteration support:**
```rip
for i in [10..1] by -1
  process(i)
# → for (let i = 10; i >= 1; i--) { process(i); }
```

### 7. Critical for-of Variable Ordering

**Guard clauses must come AFTER value assignment:**

```rip
for own k, v of obj when v > 5
  process(k, v)
```

**Generated (correct order):**
```javascript
for (const k in obj) {
  if (obj.hasOwnProperty(k)) {    // 1. Own check FIRST
    const v = obj[k];              // 2. Assign value SECOND
    if (v > 5) {                   // 3. Guard check THIRD (uses v!)
      process(k, v);
    }
  }
}
```

**Bug to avoid:** Checking guard before `v` is defined!

---

## Pattern Reference

### Program

**Parser Output:** `["program", ...statements]`

**Implementation:**
```javascript
case 'program': {
  return this.generateProgram(rest);
}
```

**Features:**
- Separates imports/exports (ES6 requires imports at top)
- Emits variable declarations after imports
- Emits helper functions (slice, modulo, toSearchable)
- Generates statements
- Emits exports last

**Example:**
```rip
x = 42
y = 10
```
→
```javascript
let x, y;

x = 42;
y = 10;
```

---

### Block

**Parser Output:** `["block", ...statements]`

**Implementation:**
```javascript
case 'block': {
  this.indentLevel++;
  const stmts = rest.map(stmt =>
    this.indent() + this.generate(stmt, 'statement') + ';'
  );
  this.indentLevel--;
  return `{\n${stmts.join('\n')}\n${this.indent()}}`;
}
```

**Critical Pattern:** Grammar wraps statements in blocks EVERYWHERE. Always check and unwrap:

```javascript
if (Array.isArray(body) && body[0] === 'block') {
  const statements = body.slice(1); // Unwrap!
  // Process statements...
}
```

---

### Binary Operators

**Parser Output:** `[operator, left, right]`

**Implementation:**
```javascript
case '+':
case '-':
case '*':
case '/':
case '%':
case '**':
case '==':  // → === (strict)
case '!=':  // → !== (strict)
case '<':
case '>':
case '<=':
case '>=':
case '&&':
case '||':
case '??': {
  const [left, right] = rest;
  // Map == → ===, != → !==
  let op = head === '==' ? '===' : head === '!=' ? '!==' : head;
  return `(${this.generate(left, 'value')} ${op} ${this.generate(right, 'value')})`;
}
```

**Note:** Always parenthesize to preserve precedence!

---

### Function Call

**Parser Output:** `[callee, ...args]` (array where head is NOT a string operator)

**Detection:**
```javascript
// In default case - if head is identifier/expression:
if (typeof head === 'string' && !head.startsWith('"')) {
  // Likely a function call
}
```

**Implementation:**
```javascript
// Preserve .await metadata before converting head to primitive
const needsAwait = headAwaitMetadata === true;
const callStr = `${calleeName}(${args})`;
return needsAwait ? `await ${callStr}` : callStr;
```

**Dammit operator support:**
```rip
fetchData!     # → await fetchData()
getUser!(id)   # → await getUser(id)
```

---

## Critical Patterns from CoffeeScript Grammar

### 1. Object Destructuring

```rip
{name, age} = obj
```

**Parser Output:**
```javascript
["=", ["object", ["name","name"], ["age","age"]], "obj"]
//                ^^^^^^^^^^^^^^^^^^^^ duplicated pairs!
```

**Why:** Same "object" node for literals AND destructuring

### 2. Static Methods in Classes

```rip
class Utils
  @square: (x) -> x * x
```

**Parser Output:**
```javascript
["object", [['.', 'this', 'square'], ['->', ['x'], ['*', 'x', 'x']]]]
//           ^^^^^^^^^^^^^^^^^^^^ key is property access!
```

**Detect:** If key is `['.', 'this', methodName]` → static method

### 3. Rest Parameters

```rip
def fn(first, ...rest)
```

**Parser Output:**
```javascript
["def", "fn", ["first", ["...", "rest"]], ...]
//                      ^^^^^^^^^^^^^^^^ rest parameter
```

### 4. Bound Methods in Classes

**Rip automatically tracks fat arrow methods and injects `.bind(this)`:**

```rip
class Component
  onClick: (e) =>  # Fat arrow = bound
    @handleClick(e)
```

**Generated:**
```javascript
class Component {
  constructor() {
    this.onClick = this.onClick.bind(this);  // Auto-injected!
  }
  onClick(e) {
    return this.handleClick(e);
  }
}
```

---

## Testing Patterns

### Test Types

**1. Execution Tests:**
```rip
test "addition", "1 + 2", 3
test "string interpolation", 'x = 5; "Value: ${x}"', "Value: 5"
```

**2. Code Generation Tests:**
```rip
code "addition", "a + b", "(a + b)"
code "assignment", "x = 42", "x = 42"
```

**3. Failure Tests:**
```rip
fail "invalid syntax", "let x ="
```

### Running Tests

```bash
# All tests
bun test/runner.js test/rip

# Specific file
bun test/runner.js test/rip/functions.rip

# Multiple files
bun test/runner.js test/rip/{functions,async,classes}.rip

# With no-cache (during active development)
bun --no-cache test/runner.js test/rip
```

---

## Common Gotchas

### 1. Block Unwrapping
**Problem:** Forgetting to unwrap `["block", ...]`
**Fix:** Always check: `if (body[0] === 'block') body = body.slice(1)`

### 2. Function Call Detection
**Problem:** Treating function calls as unknown patterns
**Fix:** Handle arrays without string heads as calls in default case

### 3. String Objects vs Primitives
**Problem:** Not checking for String object metadata
**Fix:** Always check `sexpr instanceof String` BEFORE converting to primitive

### 4. Context Awareness
**Problem:** Generating wrong code for same pattern
**Fix:** Pass correct context ('statement' vs 'value') to children

### 5. Variable Ordering in for-of
**Problem:** Checking guard before value variable is assigned
**Fix:** Always assign value var BEFORE guard check

---

## Helper Functions

### Variable Collection

**Three main methods:**
- `collectProgramVariables(sexpr)` - Top-level variables
- `collectFunctionVariables(body)` - Function-level variables
- `collectVarsFromArray(arr, set)` - Array destructuring
- `collectVarsFromObject(obj, set)` - Object destructuring

### Body Generation

**Four main methods:**
- `generateFunctionBody(body, params, sideEffectOnly)` - Function bodies with implicit returns
- `generateMethodBody(body, autoAssignments, isConstructor, params)` - Class methods
- `generateBlockWithReturns(block)` - IIFE blocks with returns
- `generateIfElseWithEarlyReturns(ifStmt)` - Early return optimization

### Loop Generation

- `generateLoopBody(body)` - Unwraps blocks, no implicit returns
- `generateLoopBodyWithGuard(body, guard)` - Wraps in if statement
- `generateComprehensionAsLoop(expr, iterators, guards)` - Plain loop optimization

### String Processing

- `extractStringContent(strObj)` - Heredoc handling (indent, chunks)
- `processHeregex(content)` - Strip whitespace/comments from extended regex

### Utilities

- `containsAwait(sexpr)` - Async function detection
- `containsYield(sexpr)` - Generator detection
- `shouldAwaitCall(identifier)` - Dammit operator detection
- `addJsExtensionAndAssertions(source)` - ES6 module path fixing
- `unwrap(code)` - Remove excessive parentheses

---

## Key Innovations in Rip Codegen

### 1. Smart Comprehension Optimization

**Rip is smarter than CoffeeScript:**

```rip
fn = ->
  process x for x in arr    # ← Rip: plain loop (fast!)
  doMore()                  # ← Last statement
```

**CoffeeScript:** Always IIFE (wasteful)
**Rip:** Context-aware - plain loop when result unused!

**Implementation:** Parent passes context parameter down tree.

### 2. Range Loop Optimization

```rip
for i in [1...1000]
  process(i)
# → for (let i = 1; i < 1000; i++) { process(i); }
```

**Savings:** 73% smaller code than IIFE with Array.from!

### 3. Void Functions

```rip
def process!()  # Side-effect only
  doWork()
  # No implicit return
# → function process() { doWork(); return; }
```

**Benefit:** Clear intent, no defensive null returns needed

### 4. Postfix Conditional Unwrapping

```rip
# Input
x = 5 unless done

# Generated (correct!)
if (!done) x = 5;

# NOT: x = (!done ? 5 : undefined)  # ← Would always assign!
```

**Detection:** Special handling in assignment case for postfix if/unless

### 5. for-of Guard Ordering

**Critical fix:** Value variable must be assigned BEFORE guard check

```javascript
// Correct ordering when valueVar + guard present:
for (const k in obj) {
  if (obj.hasOwnProperty(k)) {    // 1. Own check
    const v = obj[k];              // 2. Value assignment
    if (v > 5) {                   // 3. Guard (can reference v!)
      // body
    }
  }
}
```

**Bug avoided:** Never check guard before value is defined!

---

## Reference Implementation

When stuck, consult `src/codegen-ORIG.js`:

```bash
# Find how a pattern was handled
grep -A 20 "case 'pattern-name':" src/codegen-ORIG.js

# See full implementation
less src/codegen-ORIG.js
```

**But:** Don't cargo-cult! Understand WHY, then implement cleanly.

---

## Debug Tools

```bash
# See tokens from lexer
echo 'x = 42' | ./bin/rip -t

# See s-expressions from parser
echo 'x = 42' | ./bin/rip -s

# See generated JavaScript
echo 'x = 42' | ./bin/rip -c

# Check if lexer recognizes operator
echo '2 ** 3' | ./bin/rip -t

# Interactive REPL with debug modes
./bin/rip
rip> .tokens  # Toggle token display
rip> .sexp    # Toggle s-expression display
rip> .js      # Toggle JS display
```

---

## Implementation Workflow

### For AI Agents / Developers

**1. Identify Pattern**
```bash
echo 'your code' | ./bin/rip -s
# See what parser emits
```

**2. Check Existing Implementation**
```bash
grep -A 30 "case 'pattern':" src/codegen.js
```

**3. Run Tests**
```bash
bun test/runner.js test/rip/RELEVANT_FILE.rip
```

**4. Fix or Enhance**
- Update switch case in src/codegen.js
- Run tests immediately
- Commit with test count

**5. Document**
- Update this file if adding new pattern
- Note any gotchas discovered

---

## Production Status

**Version:** 1.0.0
**Status:** ✅ Production Ready
**Tests:** 843/843 (100%)
**Features:** 110+ node types (complete)
**Self-Hosting:** ✅ Rip compiles itself (solar.rip → parser.js)

**Recent Achievements:**
- ✅ Self-hosting complete (bootstrap successful)
- ✅ Range loop optimization (73% code reduction)
- ✅ Reverse iteration support (by -1)
- ✅ Void functions (! at definition)
- ✅ Smart comprehension optimization
- ✅ Dual syntax support (ES6 + CoffeeScript)
- ✅ for-of variable ordering fixes
- ✅ Perfect test score (843/843)

---

## See Also

**Core Documentation:**
- [COMPREHENSIONS.md](COMPREHENSIONS.md) - Context-aware generation spec
- [STRING.md](STRING.md) - String object metadata reference
- [SOLAR.md](SOLAR.md) - Parser generator guide
- [REGEX-PLUS.md](REGEX-PLUS.md) - Ruby-style regex features
- [DAMMIT-OPERATOR.md](DAMMIT-OPERATOR.md) - Async shorthand operator
- [BROWSER.md](BROWSER.md) - Browser usage & REPL guide

**Project Files:**
- [AGENT-ORIG.md](../AGENT-ORIG.md) - AI agent handbook
- [README-ORIG.md](../README-ORIG.md) - User guide

---

**Keep this document updated! Future you (and future AI agents) will thank you.** ✨
