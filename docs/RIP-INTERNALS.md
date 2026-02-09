# Rip Internals

> Architecture, design decisions, and technical reference for the Rip compiler.

---

## Table of Contents

1. [Why Rip](#1-why-rip)
2. [Architecture](#2-architecture)
3. [S-Expressions](#3-s-expressions)
4. [Lexer & Rewriter](#4-lexer--rewriter)
5. [Code Generation](#5-code-generation)
6. [Compiler](#6-compiler)
7. [Solar Parser Generator](#7-solar-parser-generator)
8. [Debug Tools](#8-debug-tools)
9. [Future Work](#9-future-work)

---

# 1. Why Rip

## The Short Version

1. **Simplicity scales** — S-expressions make compilers 50% smaller and 10x easier to maintain
2. **Zero dependencies** — True autonomy from the npm ecosystem
3. **Modern output** — ES2022 everywhere, no legacy baggage
4. **Reactivity as operators** — `:=`, `~=`, `~>` are language syntax, not library imports
5. **Self-hosting** — Rip compiles itself, including its own parser generator

## Why S-Expressions

Most compilers use complex AST node classes. Rip uses **simple arrays**:

```javascript
// Traditional AST (CoffeeScript, TypeScript, Babel)
class BinaryOp {
  constructor(op, left, right) { ... }
  compile() { /* 50+ lines */ }
}

// Rip's S-Expression
["+", left, right]  // That's it!
```

**Result:** CoffeeScript's compiler is 17,760 LOC. Rip's is ~10,300 LOC — smaller, yet includes a complete reactive runtime, type system, component system, and source maps.

> **Transform the IR (s-expressions), not the output (strings).**

This single principle eliminates entire categories of bugs. When your IR is simple data (arrays), transformations are trivial and debuggable:

```javascript
// Debugging: inspect the data directly
console.log(sexpr);
// ["comprehension", ["*", "x", 2], [["for-in", ["x"], ["array", 1, 2, 3]]], []]

// vs. string manipulation
console.log(code);
// "(() => {\n  const result = [];\n  for (const x of arr) {\n..."
```

## Rip vs CoffeeScript

| Feature | CoffeeScript | Rip |
|---------|-------------|------|
| Optional chaining | 4 soak operators | ES6 `?.` / `?.[]` / `?.()` + shorthand `?[]` / `?()` |
| Ternary | No | `x ? a : b` |
| Regex features | Basic | Ruby-style (`=~`, indexing, captures in `_`) |
| Async shorthand | No | Dammit operator (`!`) |
| Void functions | No | `def fn!` |
| Reactivity | None | `:=`, `~=`, `~>` |
| Comprehensions | Always IIFE | Context-aware |
| Modules | CommonJS | ES6 |
| Classes | ES5 | ES6 |
| Dependencies | Multiple | **Zero** |
| Parser generator | External (Jison) | **Built-in (Solar)** |
| Self-hosting | No | **Yes** |
| Total LOC | 17,760 | ~10,300 |

## Design Principles

- **Simplicity scales** — Simple IR, clear pipeline, minimal code, comprehensive tests
- **Zero dependencies is a feature** — No supply chain attacks, no version conflicts, no `node_modules` bloat
- **Self-hosting proves quality** — Rip compiles its own parser generator; if it can compile itself, it works

---

# 2. Architecture

## The Pipeline

```
Source Code  →  Lexer  →  emitTypes  →  Parser  →  S-Expressions  →  Codegen  →  JavaScript
                (1,867)    (types.js)    (357)       (arrays + .loc)     (3,292)      + source map
                              ↓
                           file.d.ts (when types: "emit")
```

## Key Files

| File | Purpose | Lines | Modify? |
|------|---------|-------|---------|
| `src/lexer.js` | Lexer + Rewriter | 1,867 | Yes |
| `src/compiler.js` | Compiler + Code Generator | 3,292 | Yes |
| `src/types.js` | Type System (lexer sidecar) | 719 | Yes |
| `src/components.js` | Component System (compiler sidecar) | 1,240 | Yes |
| `src/sourcemaps.js` | Source Map V3 Generator | 122 | Yes |
| `src/tags.js` | HTML Tag Classification | 63 | Yes |
| `src/parser.js` | Generated parser | 357 | No (auto-gen) |
| `src/grammar/grammar.rip` | Grammar specification | 935 | Yes (carefully) |
| `src/grammar/solar.rip` | Parser generator | 916 | No |

## Example Flow

```coffee
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

# 3. S-Expressions

S-expressions are simple arrays that serve as Rip's intermediate representation (IR). Each has a **head** (string identifying node type) and **rest** (arguments/children).

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
['def', name, params, body]     // Named function
['->', params, body]            // Thin arrow (unbound this)
['=>', params, body]            // Fat arrow (bound this)

// Parameters can be:
'name'                          // Simple param
['rest', 'name']                // Rest: ...name
['default', 'name', expr]      // Default: name = expr
['expansion']                   // Expansion marker: (a, ..., b)
['object', ...]                 // Object destructuring
['array', ...]                  // Array destructuring
```

### Calls & Property Access
```javascript
[callee, ...args]               // Function call
['await', expr]                 // Await
['.', obj, 'prop']              // Property: obj.prop
['?.', obj, 'prop']             // Optional: obj?.prop
['[]', arr, index]              // Index: arr[index]
['optindex', arr, index]        // Optional: arr?.[index]
['optcall', fn, ...args]        // Optional: fn?.(args)
['new', constructorExpr]        // Constructor
['super', ...args]              // Super call
['tagged-template', tag, str]   // Tagged template
```

### Data Structures
```javascript
['array', ...elements]          // Array literal
['object', ...pairs]            // Object literal (pairs: [key, value])
['...', expr]                   // Spread (prefix only)
```

### Operators
```javascript
// Arithmetic
['+', left, right]   ['-', left, right]   ['*', left, right]
['/', left, right]   ['%', left, right]   ['**', left, right]

// Comparison (== compiles to ===)
['==', left, right]  ['!=', left, right]
['<', left, right]   ['<=', left, right]
['>', left, right]   ['>=', left, right]

// Logical
['&&', left, right]  ['||', left, right]  ['??', left, right]

// Unary
['!', expr]          ['~', expr]          ['-', expr]
['+', expr]          ['typeof', expr]     ['delete', expr]
['++', expr, isPostfix]                   ['--', expr, isPostfix]

// Special
['instanceof', expr, type]
['?', expr]                     // Existence check
```

### Control Flow
```javascript
['if', condition, thenBlock, elseBlock?]
['unless', condition, body]
['?:', condition, thenExpr, elseExpr]   // Ternary
['switch', discriminant, cases, defaultCase?]
```

### Loops
```javascript
['for-in', vars, iterable, step?, guard?, body]
['for-of', vars, object, guard?, body]
['for-as', vars, iterable, async?, guard?, body]  // ES6 for-of on iterables
['while', condition, body]
['until', condition, body]
['loop', body]
['break']          ['continue']
['break-if', condition]          ['continue-if', condition]
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

### Types
```javascript
['enum', name, body]              // Enum declaration (runtime JS)
// Type aliases, interfaces → handled by rewriter, never reach parser
```

### Ranges & Slicing
```javascript
['..', from, to]      // Inclusive range
['...', from, to]     // Exclusive range
```

### Blocks & Modules
```javascript
['block', ...statements]        // Multiple statements
['do-iife', expr]               // Do expression (IIFE)
['import', specifiers, source]
['export', statement]
['export-default', expr]
['export-all', source]
['export-from', specifiers, source]
```

---

# 4. Lexer & Rewriter

The lexer (`src/lexer.js`) is a clean reimplementation that replaces the old lexer (3,260 lines) with ~1,870 lines producing the same token vocabulary the parser expects.

## Architecture

- **9 tokenizers** in priority order: identifier, comment, whitespace, line, string, number, regex, js, literal
- **7 rewriter passes**: removeLeadingNewlines, closeOpenCalls, closeOpenIndexes, normalizeLines, tagPostfixConditionals, addImplicitBracesAndParens, addImplicitCallCommas
- **Token format**: `[tag, val]` array with `.pre`, `.data`, `.loc`, `.spaced`, `.newLine` properties

## Token Properties

| Property | Type | Purpose |
|----------|------|---------|
| `.pre` | number | Whitespace count before this token |
| `.data` | object/null | Metadata: `{await, predicate, quote, invert, parsedValue, ...}` |
| `.loc` | `{r, c, n}` | Row, column, length |
| `.spaced` | boolean | Sugar for `.pre > 0` |
| `.newLine` | boolean | Preceded by a newline |

## Identifier Suffixes

| Suffix | Data flag | Meaning | JS output |
|--------|-----------|---------|-----------|
| `!` | `.data.await = true` | Dammit operator | `await` + base name |
| `?` | `.data.predicate = true` | Existence check | `(expr != null)` |

The `?` suffix is captured only when NOT followed by `.`, `?`, `[`, or `(` — so `?.` (optional chaining), `??` (nullish coalescing), `?.()`, and `?.[i]` remain unambiguous.

The `!` suffix on `as` in for-loops (`as!`) emits `FORASAWAIT` instead of `FORAS`, enabling `for x as! iterable` as shorthand for `for await x as iterable`.

## Language Changes (3.0 Rewrite)

### Removed

| Feature | Old syntax | Replacement |
|---------|-----------|-------------|
| Postfix spread/rest | `x...` | `...x` (ES6 prefix only) |
| Prototype access | `x::y`, `x?::y` | Direct `.prototype` or class syntax; `::` reserved for type annotations |
| `is not` contraction | `x is not y` | `x isnt y` |

### Added

| Feature | Syntax | Purpose |
|---------|--------|---------|
| `for...as` iteration | `for x as iter` | ES6 `for...of` on iterables (replaces `for x from iter`) |
| `as!` async shorthand | `for x as! iter` | Shorthand for `for await x as iter` |

### Changed

| Item | Old | New |
|------|-----|-----|
| Location data | `locationData` (object) | `.loc = {r, c, n}` |
| `for...from` keyword | `FORFROM` | `FORAS` |
| Token metadata | `new String(val)` with props | `.data` object on token |
| Category arrays | `Array` + `indexOf` | `Set` + `.has()` |
| Variable style | `const`/`let` mix | All `let` |
| Rewriter passes | 13 | 7 |

### Preserved

All 9 tokenizer methods, full token vocabulary, implicit call/object/brace detection, string interpolation with recursive sub-lexing, heredoc indent processing, arrow function parameter tagging, `do` IIFE support, `for own x of obj`, all reactive operators (`:=`, `~=`, `~>`, `=!`), all Rip aliases (`and`, `or`, `is`, `isnt`, `not`, `yes`, `no`, `on`, `off`).

---

# 5. Code Generation

The compiler (`src/compiler.js`) transforms s-expressions into JavaScript. The `CodeGenerator` class is a dispatch table — s-expression heads map to generator methods.

## Context-Aware Generation

Some patterns generate different code based on usage context:

```javascript
generate(sexpr, context = 'statement') {
  // context can be 'statement' or 'value'
}
```

**Comprehensions** are the primary example:

```coffee
# Statement context (result discarded) → Plain loop
console.log x for x in arr

# Value context (result used) → IIFE with array building
result = (x * 2 for x in arr)
```

| Parent Node | Child | Context | Reason |
|-------------|-------|---------|--------|
| Assignment | RHS | `'value'` | Value assigned to variable |
| Call | Arguments | `'value'` | Values passed to function |
| Return | Expression | `'value'` | Value returned from function |
| Function | Last statement | `'value'` | Implicit return |
| Function | Non-last statements | `'statement'` | Result discarded |
| Loop | Body | `'statement'` | Loops don't return values |
| If/Unless | Branches | Inherit parent | Pass through context |
| Array | Elements | `'value'` | Values stored in array |

## Variable Scoping

CoffeeScript semantics: function-level scoping with closure access.

- `collectProgramVariables()` — Walks top-level, stops at functions
- `collectFunctionVariables()` — Walks function body, stops at nested functions
- Filters out outer variables (accessed via closure)
- Emits `let` declarations at scope top

## Auto-Detection

Functions automatically become async or generators:

```coffee
# Contains await or dammit → becomes async
def loadData(id)
  user = getUser!(id)
  user.posts

# Contains yield → becomes generator
counter = ->
  yield 1
  yield 2
```

## Existence Check

| Syntax | Compiles To |
|--------|-------------|
| `x?` | `(x != null)` |
| `obj.prop?` | `(obj.prop != null)` |
| `x ?? y` | `x ?? y` |
| `x ??= 10` | `x ??= 10` |

Optional chaining uses ES6 syntax (both forms supported):

| Syntax | Compiles To |
|--------|-------------|
| `obj?.prop` | `obj?.prop` |
| `arr?.[0]` | `arr?.[0]` |
| `fn?.(x)` | `fn?.(x)` |
| `arr?[0]` | `arr?.[0]` |
| `fn?(x)` | `fn?.(x)` |

## Range Optimization

```coffee
for i in [1...100]
  process(i)
# → for (let i = 1; i < 100; i++) { process(i); }
```

## String & Regex Processing

String tokens carry metadata in `.data`:
- `quote`: The quote delimiter (`"`, `'`, `"""`, `'''`, `///`)
- `quote.length === 3`: Indicates a heredoc

Heredocs use the closing delimiter's column position as the baseline for indentation stripping.

REGEX tokens store `delimiter` and optional `heregex` flags in `token.data`.

---

# 6. Compiler

The compiler (`src/compiler.js`) is a clean reimplementation replacing the old compiler (6,016 lines) with ~3,290 lines producing identical JavaScript output.

## Structure

```
CodeGenerator class
  - GENERATORS dispatch table (~55 generators)
  - Variable collection (program + function scope)
  - Main generate() dispatch
  - ~55 generate* methods
  - Body/formatting/utility helpers
  - Reactive runtime (inline string, ~270 lines)
Compiler class (with shim adapter for new lexer)
Convenience exports
```

## Metadata Bridge

Two one-line helpers isolate all `new String()` awareness:

```javascript
let meta = (node, key) => node instanceof String ? node[key] : undefined;
let str  = (node) => node instanceof String ? node.valueOf() : node;
```

The `Compiler` class's lexer adapter reconstructs `new String()` wrapping from the new lexer's `token.data` property, so grammar actions pass metadata through s-expressions unchanged.

## Removed Generators

| Generator | S-expr | Reason |
|-----------|--------|--------|
| `generatePrototype` | `::` | Feature removed from lexer |
| `generateOptionalPrototype` | `?::` | Feature removed from lexer |

## Renamed: `for-from` → `for-as`

- `GENERATORS['for-as']` replaces `GENERATORS['for-from']`
- Grammar adds `FORASAWAIT` token: `for x as! iter` → `for await x as iter`
- Both forms produce the same s-expression: `["for-as", vars, iterable, true, guard, body]`

## Consolidation

| Area | Old lines | New lines | Reduction |
|------|-----------|-----------|-----------|
| Total file | 6,016 | ~3,290 | **45%** |
| Body generation | ~500 | ~200 | 60% |
| Variable collection | ~230 | ~100 | 57% |
| Helper methods | ~600 | ~250 | 58% |

---

# 7. Solar Parser Generator

**Solar** is a complete SLR(1) parser generator included with Rip — written in Rip, compiled by Rip, zero external dependencies.

**Location:** `src/grammar/solar.rip` (916 lines)

## Grammar Syntax

```coffeescript
o = (pattern, action, options) ->
  pattern = pattern.trim().replace /\s{2,}/g, ' '
  [pattern, action ? 1, options]
```

**Style 1: Pass-Through** — Omit action, returns first token:
```coffeescript
Expression: [
  o 'Value'
  o 'Operation'
]
```

**Style 2: S-Expression** — Bare numbers become token references:
```coffeescript
For: [
  o 'FOR ForVariables FOROF Expression Block', '["for-of", 2, 4, null, 5]'
]
```

**Style 3: Advanced** — `$n` patterns for conditional logic:
```coffeescript
Parenthetical: [
  o '( Body )', '$2.length === 1 ? $2[0] : $2'
]
```

## Performance

| Metric | Jison | Solar |
|--------|-------|-------|
| Parse time | 12,500ms | ~50ms |
| Dependencies | Many | Zero |
| Self-hosting | No | Yes |
| Code size | 2,285 LOC | 916 LOC |

After modifying `src/grammar/grammar.rip`:

```bash
bun run parser    # Regenerates src/parser.js
```

---

# 8. Debug Tools

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

# 9. Future Work

- Parser update to read `.data` directly instead of `new String()` properties
- Once parser supports `.data`, the `meta()`/`str()` helpers become trivial to update

---

**See Also:**
- [RIP-GUIDE.md](RIP-GUIDE.md) — Practical guide for using Rip
- [RIP-LANG.md](RIP-LANG.md) — Language reference
- [RIP-TYPES.md](RIP-TYPES.md) — Type system specification
- [RIP-REACTIVITY.md](RIP-REACTIVITY.md) — Reactivity deep dive

---

*Rip 3.4 — 1,140 tests passing — Zero dependencies — Self-hosting — ~10,300 LOC*
