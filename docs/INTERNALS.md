<p><img src="rip.svg" alt="Rip Logo" width="100"></p>

# Rip Compiler Internals

> Technical reference for the Rip compiler architecture, code generation, and parsing.

**Version:** 2.3.0
**Test Coverage:** 1046/1046 rip tests (100%) ✅
**Status:** Stable & Production Ready - Self-Hosting Complete

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [S-Expressions](#2-s-expressions)
3. [Code Generation](#3-code-generation)
4. [Comprehensions](#4-comprehensions)
5. [String Token Processing](#5-string-token-processing)
6. [Solar Parser Generator](#6-solar-parser-generator)

---

# 1. Architecture Overview

## The Pipeline

```
Source Code → CoffeeScript Lexer → Solar Parser → S-Expressions → Codegen → JavaScript
             (3,537 LOC)         (340 LOC)       (arrays!)      (7,964 LOC)
             15 years tested     Generated!      Clean IR!       Complete!
```

## Key Files

| File | Purpose | Size | Modify? |
|------|---------|------|---------|
| `src/grammar/grammar.rip` | Grammar spec | 795 LOC | ✅ Yes |
| `src/grammar/solar.rip` | Parser generator | 928 LOC | ❌ No |
| `src/parser.js` | Generated parser | 340 LOC | ❌ No (auto-gen) |
| `src/lexer.js` | Lexer + Rewriter | 3,537 LOC | ⚠️ Rewriter only |
| `src/compiler.js` | Code generator | 7,964 LOC | ✅ Yes |

## Example Flow

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

# 2. S-Expressions

## What are S-Expressions?

S-expressions are simple arrays that serve as Rip's intermediate representation (IR):

```javascript
// Traditional AST (CoffeeScript, TypeScript, Babel)
class BinaryOp {
  constructor(op, left, right) { ... }
  compile() { /* 50+ lines */ }
}

// Rip's S-Expression
["+", left, right]  // That's it!
```

**Result:** CoffeeScript's compiler is 17,760 LOC. Rip's is ~12,000 LOC. **~35% smaller.**

## S-Expression Structure

- **Head:** String identifying node type (`"if"`, `"def"`, `"+"`, etc.)
- **Rest:** Arguments/children for that node

**Examples:**
```javascript
// Assignment
['=', 'x', 42]

// Function call
['add', 5, 10]

// Binary operator
['+', 'a', 'b']

// Nested
['=', 'result', ['+', ['*', 2, 3], 4]]
```

## Why S-Expressions?

**Transform the IR (s-expressions), not the output (strings)**

This single principle makes the code:
- **50% smaller** (despite more explicit logic)
- **Type-safe** (no silent failures)
- **Fast** (no parsing overhead)
- **Clear** (readable data structures)
- **Maintainable** (obvious intent)

### Debugging Comparison

**String Manipulation:**
```javascript
console.log(iifeCode);
// "(() => {\n  const result = [];\n  for..."
// What you see: A blob of text
// Time to debug: 20-30 minutes
```

**S-Expression:**
```javascript
console.log(sexpr);
// ["comprehension", ["*", "x", 2], [["for-in", ["x"], ["array", 1, 2, 3], null]], []]
// What you see: Clear structure
// Time to debug: 2-3 minutes
```

## Complete Node Type Reference

### Top Level
```javascript
['program', ...statements]
```

### Variables & Assignment
```javascript
['=', target, value]
['+=', target, value]  // And all compound assigns: -=, *=, /=, %=, **=
['&&=', target, value]
['||=', target, value]
['?=', target, value]   // Maps to ??=
['??=', target, value]
```

### Functions
```javascript
// Named function
['def', name, params, body]

// Thin arrow (unbound this)
['->', params, body]

// Fat arrow (bound this)
['=>', params, body]

// Parameters can be:
'name'                    // Simple param
['rest', 'name']          // Rest: ...name
['default', 'name', expr] // Default: name = expr
['expansion']             // Expansion marker: (a, ..., b)
['object', ...]           // Object destructuring
['array', ...]            // Array destructuring
```

### Calls & Property Access
```javascript
[callee, ...args]              // Function call
['await', expr]                // Await
['.', obj, 'prop']             // Property: obj.prop
['?.', obj, 'prop']            // Optional: obj?.prop
['::', obj, 'prop']            // Prototype: obj.prototype.prop
['?::', obj, 'prop']           // Soak prototype
['[]', arr, index]             // Index: arr[index]
['?[]', arr, index]            // Soak index
['optindex', arr, index]       // ES6 optional: arr?.[index]
['optcall', fn, ...args]       // ES6 optional: fn?.(args)
['?call', fn, ...args]         // Soak call: fn?(args)
['new', constructorExpr]       // Constructor
['super', ...args]             // Super call
['tagged-template', tag, str]  // Tagged template
```

### Data Structures
```javascript
['array', ...elements]         // Array literal
['object', ...pairs]           // Object literal (pairs: [key, value])
['...', expr]                  // Spread (unary)
```

### Operators
```javascript
// Arithmetic
['+', left, right]
['-', left, right]
['*', left, right]
['/', left, right]
['%', left, right]
['**', left, right]

// Comparison (== compiles to ===)
['==', left, right]
['!=', left, right]
['<', left, right]
['<=', left, right]
['>', left, right]
['>=', left, right]

// Logical
['&&', left, right]
['||', left, right]
['??', left, right]

// Unary
['!', expr]
['~', expr]
['-', expr]           // Unary minus
['+', expr]           // Unary plus
['++', expr, isPostfix]
['--', expr, isPostfix]
['typeof', expr]
['delete', expr]

// Special
['instanceof', expr, type]
['?', expr]           // Existence check
```

### Control Flow
```javascript
['if', condition, thenBlock, elseBlock?]
['unless', condition, body]
['?:', condition, thenExpr, elseExpr]  // Ternary
['switch', discriminant, cases, defaultCase?]
```

### Loops
```javascript
['for-in', vars, iterable, step?, guard?, body]
['for-of', vars, object, guard?, body]
['while', condition, body]
['until', condition, body]
['loop', body]
['break']
['continue']
['break-if', condition]
['continue-if', condition]
```

### Comprehensions
```javascript
['comprehension', expr, iterators, guards]
['object-comprehension', keyExpr, valueExpr, iterators, guards]
```

### Exceptions
```javascript
['try', tryBlock, [catchParam, catchBlock]?, finallyBlock?]
['throw', expr]
```

### Classes
```javascript
['class', name, parent?, ...members]
```

### Ranges & Slicing
```javascript
['..', from, to]      // Inclusive range
['...', from, to]     // Exclusive range
```

### Blocks
```javascript
['block', ...statements]  // Multiple statements
['do-iife', expr]         // Do expression (IIFE)
```

### Modules
```javascript
['import', specifiers, source]
['export', statement]
['export-default', expr]
['export-all', source]
['export-from', specifiers, source]
```

---

# 3. Code Generation

## Overview

The compiler (`src/compiler.js`) transforms Rip source code into JavaScript. The CodeGenerator class is a pattern matcher that transforms s-expressions into JavaScript—just switch cases that match array patterns.

## Understanding Grammar vs Node Types

**The Numbers:**
- **91 Grammar Types** - BNF non-terminals (like `Expression`, `Statement`, `Value`)
- **406 Grammar Rules** - Production rules (the `o '...'` lines in grammar.rip)
- **110+ S-Expression Node Types** - Actual output strings (like `"yield"`, `"+"`, `"block"`)

**Key Insight:** Grammar types are NOT the same as node types!

- Grammar types are **organizational** (structure the BNF grammar)
- Node types are **concrete output** (what codegen handles)

## Key Implementation Features

### 1. Context-Aware Generation

Some patterns generate different code based on usage context:

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

### 5. Range Optimization

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

## Debug Tools

```bash
# See tokens from lexer
echo 'x = 42' | ./bin/rip -t

# See s-expressions from parser
echo 'x = 42' | ./bin/rip -s

# See generated JavaScript
echo 'x = 42' | ./bin/rip -c

# Interactive REPL with debug modes
./bin/rip
rip> .tokens  # Toggle token display
rip> .sexp    # Toggle s-expression display
rip> .js      # Toggle JS display
```

---

# 4. Comprehensions

## Purpose

Comprehensions can act as **data builders** or **control loops**. Rip distinguishes these automatically based on surrounding context, improving on CoffeeScript's behavior with smarter optimizations.

**Key insight:** At parse time, all comprehensions produce identical s-expressions. Context resolution happens only during code generation.

## Rip vs CoffeeScript Design Philosophy

**CoffeeScript (syntax-based):**
- `for x in xs then f(x)` → plain loop (statement-style)
- `for x in xs` (multi-line) → IIFE (expression-style, always returns array)
- **Problem:** Multi-line form builds wasteful arrays even when result unused

**Rip (context-based):**
- Same syntax, different output based on **how value is used**
- `for x in xs` → IIFE if assigned/returned, plain loop if result discarded
- **Benefit:** Automatic optimization - no wasteful array building!

**Example of improvement:**
```rip
fn = ->
  process x for x in arr    # ← Rip: plain loop! CS: IIFE (wasteful)
  doMore()
```

## The Core Rule

Comprehensions have **dual semantics** based on how their value is used:

| Context | Generates | Example |
|---------|-----------|---------|
| **Value Context** | IIFE (builds array) | `x = (n*2 for n in arr)` |
| **Statement Context** | Plain loop (side effects) | `process(n) for n in arr; other()` |

**Critical principle:** Context is **downward-propagating**. Parent nodes decide if children need values.

## Context Propagation Patterns

| Parent Node | Child | Context | Reason |
|-------------|-------|---------|---------|
| `Assignment` | RHS | `'value'` | Value assigned to variable |
| `Call` | Arguments | `'value'` | Values passed to function |
| `Return` | Expression | `'value'` | Value returned from function |
| `Function` | Last statement | `'value'` | Implicit return |
| `Function` | Non-last statements | `'statement'` | Result discarded |
| `Loop` | Body (all statements) | `'statement'` | Loops don't return values |
| `If/Unless` | Branches | **Inherit parent** | Pass through context |
| `Array` | Elements | `'value'` | Values stored in array |
| `Object` | Values | `'value'` | Values stored in object |
| `Ternary` | Both branches | `'value'` | Both branches produce values |

## Value Context (Builds Array)

When parent demands a value, comprehension generates an IIFE:

```javascript
(() => {
  const result = [];
  for (const x of arr) { result.push(x * 2); }
  return result;
})()
```

**IIFE form guarantees:**
- ✅ No variable leakage (lexically scoped)
- ✅ Always returns array (even `[]` for empty input)
- ✅ Single evaluation of iterator source

## Statement Context (Plain Loop)

When value is discarded, generate an efficient plain loop:

```javascript
for (const x of arr) {
  process(x);  // Side effects only
}
```

**Plain loop form guarantees:**
- ✅ No array allocation (efficient)
- ✅ Supports `break`/`continue`
- ✅ Loop variables scoped with `const`/`let`

## Edge Cases

### Own + Guard + Value Variable (Critical!)

```rip
for own k, v of obj when v > 5
  process(k, v)
```

**Must generate:**
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

**Bug to avoid:** Never check guard before value is defined!

### Async Comprehensions

**Sequential (await in body):**
```rip
# IIFE is async, awaits happen serially inside loop
results = (await fetchData(url) for url in urls)
```

**Parallel (recommended for I/O):**
```rip
# Build array of promises, then await all in parallel
results = await Promise.all (fetchData(url) for url in urls)
```

---

# 5. String Token Processing

## Overview

In CoffeeScript's lexer and parser, the STRING token carries several metadata properties that are essential for correctly transforming source strings into JavaScript output.

## The STRING Token Structure

A STRING token is not just a simple string value. It's an object with these properties:
- The string content itself
- `quote`: The quote delimiter used
- `initialChunk`: Boolean flag for first chunk in interpolated string
- `finalChunk`: Boolean flag for last chunk in interpolated string
- `indent`: The common indentation to strip from heredocs
- `double`: Whether backslashes should be doubled in output
- `heregex`: Object with regex flags for extended regex literals

## Property Descriptions

### 1. `quote` - Quote Delimiter Type

**Purpose:** Records which quote characters were used to delimit the string in source code.

**Possible Values:**
- `"` - double quote
- `'` - single quote
- `"""` - triple double quote (heredoc)
- `'''` - triple single quote (heredoc)
- `"///"` - heregex (extended regex literal)

**How It's Used:**
- Detects heredocs: `heredoc = @quote.length is 3`
- Adjusts location data for source maps

### 2. `initialChunk` / `finalChunk` - Interpolated String Chunks

**Purpose:** Marks whether this STRING token is the first/last chunk in an interpolated string.

**How It's Used:**
- If `initialChunk` is true, `LEADING_BLANK_LINE` regex strips the leading blank line in heredocs
- If `finalChunk` is true, `TRAILING_BLANK_LINE` regex strips the trailing blank line

### 3. `indent` - Common Indentation to Strip

**Purpose:** Records the common leading whitespace found across all lines of a heredoc that should be stripped during compilation.

**Example:**
```coffeescript
x = """
    Line 1
    Line 2
      Indented more
    """
# indent would be "    " (4 spaces)
# After processing:
# "Line 1\nLine 2\n  Indented more"
```

### 4. `double` - Backslash Doubling Flag

**Purpose:** Indicates whether backslash characters in the string should be doubled when generating JavaScript output.

### 5. `heregex` - Extended Regex Metadata

**Purpose:** Contains metadata about extended regular expression (heregex) literals, including flags.

**Example:**
```coffeescript
pattern = ///
  ^ \d+      # starts with digits
  \s*        # optional whitespace
  [a-z]+     # followed by letters
  $          # end of string
///i         # case-insensitive flag

# heregex: { flags: 'i' }
# The whitespace and comments are stripped
```

## REGEX Tokens

While STRING tokens have properties directly on the String object, **REGEX tokens store metadata in `token.data`**:

```javascript
// REGEX token structure:
token = ['REGEX', String("/pattern/flags"), location]
token.data = {
  delimiter: '///',      // '/' for normal regex, '///' for heregex
  heregex: {flags: 'gi'} // Only for heregex
}
```

---

# 6. Solar Parser Generator

**Solar** is a complete SLR(1) parser generator **included with Rip** - written in Rip, compiled by Rip, zero external dependencies!

**Location:** `src/grammar/solar.rip` (928 lines)
**Dependencies:** ZERO - Self-hosting, standalone
**Type:** SLR(1) parser generator (similar to Yacc/Bison/Jison)

## What is Solar?

Solar is an SLR(1) parser generator that generates parsers from grammar specifications. Rip uses Solar's **s-expression mode** to generate parsers that output simple array-based s-expressions instead of traditional AST nodes.

**Key Innovation:** S-expressions as intermediate representation reduces compiler complexity by ~35%.

**Unique Advantage:** Unlike most languages that depend on external parser generators (Yacc, Bison, Jison), **Rip includes its own parser generator** written in Rip itself! This makes Rip completely self-hosting with zero dependencies.

## Enabling S-Expression Mode

In `src/grammar/grammar.rip`:

```coffeescript
mode = 'sexp'  # Enable s-expression output mode
```

This tells Solar to generate a parser that builds s-expressions (nested arrays) instead of AST objects.

## Grammar Syntax

### Helper Function

```coffeescript
o = (pattern, action, options) ->
  pattern = pattern.trim().replace /\s{2,}/g, ' '
  [pattern, action ? 1, options]
```

### Action Syntax - Three Styles

#### Style 1: Default (Pass-Through)

**When:** Omit action parameter (defaults to `1`)
**Behavior:** Returns first token

```coffeescript
Expression: [
  o 'Value'      # Returns Value (position 1)
  o 'Operation'  # Returns Operation (position 1)
]
```

#### Style 2: Simple S-Expression (Bare Numbers)

**When:** Action string contains **no `$` references**
**Behavior:** All bare numbers become `$$[$n]` token references

```coffeescript
For: [
  o 'FOR ForVariables FOROF Expression Block', '["for-of", 2, 4, null, 5]'
]
```

**Token positions:**
- `FOR` (1), `ForVariables` (2), `FOROF` (3), `Expression` (4), `Block` (5)

**Use for:** Most grammar rules - clean and simple!

#### Style 3: Advanced (Dollar References)

**When:** Action string contains `$n` patterns
**Behavior:** Only `$n` replaced; bare numbers preserved as literals

```coffeescript
Parenthetical: [
  o '( Body )', '$2.length === 1 ? $2[0] : $2'
]
```

**Use for:** Conditional logic, array access, transformations

### Spread Operator in Actions

Spread arrays into parent array:

```coffeescript
Body: [
  o 'Line', '[1]'                        # Wrap: [Line]
  o 'Body TERMINATOR Line', '[...1, 3]'  # Spread: [...Body, Line]
]
```

## Performance

### Parser Generation Speed

**Solar generates Rip's parser in ~80ms!**

**Real-world benchmark (Rip grammar):**
- **Grammar size:** 91 types, 406 production rules
- **Generated parser:** 250 states, SLR(1) parse table
- **Solar:** ~80ms total
- **Jison:** ~12,500ms (12.5 seconds)
- **Speedup:** **156× faster!**

### Why Solar is So Fast

1. **Optimized Algorithms:**
   - Single-pass item grouping (no redundant scanning)
   - Efficient kernel signature computation
   - Direct state map lookups
   - Minimal object allocations

2. **Clean Implementation:**
   - No intermediate representations
   - Direct Map/Set usage (V8 optimized)
   - Simple data structures (arrays, not classes)

### Comparison with Jison

| Metric | Jison | Solar | Winner |
|--------|-------|-------|--------|
| **Parse time** | 12,500ms | 80ms | **Solar 156×** |
| **Dependencies** | Many | Zero | **Solar** |
| **Self-hosting** | No | Yes | **Solar** |
| **Code size** | 2,285 LOC | 928 LOC | **Solar 59% smaller** |

## Working with the Grammar

### Regenerate Parser

After modifying the grammar:

```bash
bun run parser
```

This regenerates `src/parser.js` (338 LOC, auto-generated).

### Example Rule

```coffeescript
Assignment: [
  o 'Assignable = Expression', '["=", 1, 3]'
  o 'Assignable = TERMINATOR Expression', '["=", 1, 4]'
  o 'Assignable = INDENT Expression OUTDENT', '["=", 1, 4]'
]
```

**Breakdown:**
- Pattern: `Assignable = Expression`
- Tokens: Position 1 (Assignable), 2 (=), 3 (Expression)
- Action: `'["=", 1, 3]'` becomes `["=", $$[$0-2], $$[$0]]`
- Output: `["=", assignable, expression]`

### Debugging Grammar Rules

```bash
# See what parser emits
echo 'x = 42' | ./bin/rip -s

# See tokens
echo 'x = 42' | ./bin/rip -t

# See generated JavaScript
echo 'x = 42' | ./bin/rip -c
```

---

## Summary

Solar's s-expression mode is the **secret sauce** that makes Rip practical:

1. **Simple IR:** Arrays instead of AST classes
2. **Grammar-driven:** Modify spec, regenerate parser
3. **Battle-tested:** Built on CoffeeScript's proven lexer
4. **Maintainable:** ~35% less code than CoffeeScript
5. **Extensible:** Add features by adding switch cases

**Result:** A production-ready compiler in ~12,000 LOC instead of CoffeeScript's 17,760 LOC!

---

**See Also:**
- [GUIDE.md](GUIDE.md) - Language features and syntax
- [PHILOSOPHY.md](PHILOSOPHY.md) - Design decisions and rationale
- [BROWSER.md](BROWSER.md) - Browser usage and REPL guide
