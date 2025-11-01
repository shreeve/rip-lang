# Solar Parser & S-Expression Mode

**Solar** is a complete SLR(1) parser generator **included with Rip** - written in Rip, compiled by Rip, zero external dependencies!

**Location:** `src/grammar/solar.rip` (1,047 lines)
**Dependencies:** ZERO - Self-hosting, standalone
**Type:** SLR(1) parser generator (similar to Yacc/Bison/Jison)

---

## Overview

### What is Solar?

Solar is an SLR(1) parser generator (similar to Yacc/Bison) that generates parsers from grammar specifications. Rip uses Solar's **s-expression mode** to generate parsers that output simple array-based s-expressions instead of traditional AST nodes.

**Key Innovation:** S-expressions as intermediate representation reduces compiler complexity by 50% (9,450 LOC vs CoffeeScript's 17,760 LOC).

**Unique Advantage:** Unlike most languages that depend on external parser generators (Yacc, Bison, Jison), **Rip includes its own parser generator** written in Rip itself! This makes Rip completely self-hosting with zero dependencies.

### The Pipeline

```
Source Code → CoffeeScript Lexer → Solar Parser → S-Expressions → Codegen → JavaScript
             (3,146 LOC)         (340 LOC)       (arrays!)      (4,824 LOC)
             15 years tested     Generated!      Clean IR!       Complete!
```

---

## S-Expression Mode

### Enabling S-Expression Mode

In `src/grammar/grammar.rip`:

```coffeescript
mode = 'sexp'  # Enable s-expression output mode
```

This tells Solar to generate a parser that builds s-expressions (nested arrays) instead of AST objects.

### S-Expression Structure

S-expressions are plain JavaScript arrays:
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

---

## Grammar Syntax

### Helper Function

```coffeescript
o = (pattern, action, options) ->
  pattern = pattern.trim().replace /\s{2,}/g, ' '
  [pattern, action ? 1, options]
```

**Usage:**
```coffeescript
grammar =
  RuleName: [
    o 'TOKEN1 TOKEN2', action
    o 'OTHER PATTERN', action, prec: 'OPERATOR'
  ]
```

### Action Syntax - Three Styles

Solar's sexp mode auto-detects action style based on content:

#### Style 1: Default (Pass-Through)

**When:** Omit action parameter (defaults to `1`)

**Behavior:** Returns first token

```coffeescript
Expression: [
  o 'Value'      # Returns Value (position 1)
  o 'Operation'  # Returns Operation (position 1)
]
```

**Generated code:**
```javascript
case 46: return $$[$0];  // Position 1
```

---

#### Style 2: Simple S-Expression (Bare Numbers)

**When:** Action string contains **no `$` references**

**Behavior:** All bare numbers become `$$[$n]` token references

**Example:**
```coffeescript
For: [
  o 'FOR ForVariables FOROF Expression Block', '["for-of", 2, 4, null, 5]'
]
```

**Token positions:**
- `FOR` (1), `ForVariables` (2), `FOROF` (3), `Expression` (4), `Block` (5)

**Generated:**
```javascript
case 327: return ["for-of", $$[$0-3], $$[$0-1], null, $$[$0]];
```

**Replacement:**
- `2` → `$$[$0-3]` (ForVariables)
- `4` → `$$[$0-1]` (Expression)
- `5` → `$$[$0]` (Block)
- `null` stays as `null`

**Use for:** Most grammar rules - clean and simple!

---

#### Style 3: Advanced (Dollar References)

**When:** Action string contains `$n` patterns

**Behavior:** Only `$n` replaced; bare numbers preserved as literals

**Example:**
```coffeescript
Parenthetical: [
  o '( Body )', '$2.length === 1 ? $2[0] : $2'
]
```

**Generated:**
```javascript
case 303: return $$[$0-1].length === 1 ? $$[$0-1][0] : $$[$0-1];
```

**Key:** The `1` in `.length === 1` and `0` in `[0]` are **NOT** replaced!

**Use for:** Conditional logic, array access, transformations

---

### Spread Operator in Actions

Spread arrays into parent array:

```coffeescript
Body: [
  o 'Line', '[1]'                        # Wrap: [Line]
  o 'Body TERMINATOR Line', '[...1, 3]'  # Spread: [...Body, Line]
]
```

**Generated:**
```javascript
case 3: return [$$[$0]];
case 4: return [...$$[$0-2], $$[$0]];
```

---

## When to Use Each Style

### Style 1 (Default) - Pass-Through

**Use when:** Rule just forwards a single alternative

```coffeescript
Expression: [
  o 'Value'      # Just return Value
  o 'Code'       # Just return Code
  o 'Operation'  # Just return Operation
]
```

### Style 2 (Bare Numbers) - S-Expression Building

**Use when:** Building simple s-expressions with token references

```coffeescript
If: [
  o 'IF Expression Block', '["if", 2, 3]'
  o 'IF Expression Block ELSE Block', '["if", 2, 3, 5]'
]

Assignment: [
  o 'Assignable = Expression', '["=", 1, 3]'
]
```

**Best practice:** Use this for 90% of rules!

### Style 3 ($n) - Advanced Transformations

**Use when you need:**
- Conditional logic
- Array/object manipulation
- Literal numbers in output
- Complex transformations

```coffeescript
Parenthetical: [
  o '( Body )', '$2.length === 1 ? $2[0] : $2'
]

While: [
  o 'WhileSource Block', '$1.length === 2 ? [$1[0], $1[1], $2] : [$1[0], $1[1], $1[2], $2]'
]
```

---

## S-Expression Reference

### Complete Node Type List

This is what Solar outputs and what Rip's codegen expects:

#### Top Level
```javascript
['program', ...statements]
```

#### Variables & Assignment
```javascript
['=', target, value]
['+=', target, value]  // And all compound assigns: -=, *=, /=, %=, **=
['&&=', target, value]
['||=', target, value]
['?=', target, value]   // Maps to ??=
['??=', target, value]
```

#### Functions
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

#### Calls & Property Access
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

#### Data Structures
```javascript
['array', ...elements]         // Array literal
['object', ...pairs]           // Object literal (pairs: [key, value])
['...', expr]                  // Spread (unary)
```

#### Operators
```javascript
// Arithmetic
['+', left, right]
['-', left, right]
['*', left, right]
['/', left, right]
['%', left, right]
['**', left, right]

// Comparison
['==', left, right]   // Compiles to ===
['!=', left, right]   // Compiles to !==
['<', left, right]
['<=', left, right]
['>', left, right]
['>=', left, right]

// Logical
['&&', left, right]
['||', left, right]
['??', left, right]

// Bitwise
['&', left, right]
['|', left, right]
['^', left, right]
['<<', left, right]
['>>', left, right]
['>>>', left, right]

// Unary
['!', expr]
['~', expr]
['-', expr]           // Unary minus
['+', expr]           // Unary plus
['++', expr, isPostfix]  // Increment
['--', expr, isPostfix]  // Decrement
['typeof', expr]
['delete', expr]
['not', expr]         // Alias for !

// Special
['instanceof', expr, type]
['?', expr]           // Existence check
```

#### Control Flow
```javascript
['if', condition, thenBlock, elseBlock?]
['unless', condition, body]
['?:', condition, thenExpr, elseExpr]  // Ternary
['switch', discriminant, cases, defaultCase?]
```

#### Loops
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

**vars arrays:**
- `['item']` or `['item', 'index']` for for-in
- `['key']` or `['key', 'value']` for for-of

#### Comprehensions
```javascript
['comprehension', expr, iterators, guards]
['object-comprehension', keyExpr, valueExpr, iterators, guards]
```

**iterators format:**
```javascript
[
  ['for-in', ['item'], iterable, null],
  ['for-of', ['key', 'value'], object]
]
```

**guards format:**
```javascript
[condition1, condition2, ...]
```

#### Exceptions
```javascript
['try', tryBlock, [catchParam, catchBlock]?, finallyBlock?]
['throw', expr]

// Catch param can be:
// - String (identifier)
// - ['object', ...] (destructuring)
// - ['array', ...] (destructuring)
// - null (no param)
```

#### Classes
```javascript
['class', name, parent?, ...members]
```

**Members:**
```javascript
['constructor', ['->', params, body]]
[methodName, ['->', params, body]]     // Instance method
['static', methodName, ['->', params, body]]
```

#### Ranges & Slicing
```javascript
['..', from, to]      // Inclusive range
['...', from, to]     // Exclusive range

// Used in:
['for-in', ['i'], ['..', 1, 10], null, null, body]  // Loop
['[]', arr, ['..', 1, 3]]  // Slice: arr[1..3]
```

#### Blocks
```javascript
['block', ...statements]  // Multiple statements
['do-iife', expr]         // Do expression (IIFE)
```

#### Modules
```javascript
['import', specifiers, source]
['export', statement]
['export-default', expr]
['export-all', source]
['export-from', specifiers, source]
```

#### Other
```javascript
['return', expr?]
'this'
'@'                    // this shorthand
['str', ...parts]      // Template literal
```

---

## Working with the Grammar

### Grammar File Location

`src/grammar/grammar.rip` (831 lines)

### Regenerate Parser

After modifying the grammar:

```bash
bun run build:parser
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

### Precedence & Associativity

Define at bottom of grammar:

```coffeescript
operators = """
  right       = : COMPOUND_ASSIGN RETURN THROW EXTENDS
  left        + -
  left        * / % // %%
  right       **
  left        << >> >>>
  left        < > <= >=
  left        == != === !==
  left        &
  left        ^
  left        |
  left        &&
  left        ||
  left        ??
  nonassoc    ++ --
  right       UNARY DO
  left        .
"""
```

---

## Debugging Grammar Rules

### Check Generated Parser

```bash
# See the generated action code
grep -A 2 "case NNN:" src/parser.js
```

### Test S-Expression Output

```bash
# See what parser emits
echo 'x = 42' | ./bin/rip -s

# See tokens
echo 'x = 42' | ./bin/rip -t

# See generated JavaScript
echo 'x = 42' | ./bin/rip -c
```

### Common Issues

**Issue:** Action using wrong token position

**Solution:** Count tokens in pattern carefully:
```coffeescript
# Pattern: IF Expression Block ELSE Block
#          1   2          3     4    5
o 'IF Expression Block ELSE Block', '["if", 2, 3, 5]'
#                                             ↑  ↑  ↑
#                                          Expr Then Else
```

**Issue:** Numbers being replaced incorrectly

**Solution:** Use Style 3 with `$n` for complex logic:
```coffeescript
# WRONG (Style 2): '1' would become token reference
o 'Body', '$1[0]'

# RIGHT (Style 3): Use $ prefix
o 'Body', '$1.length === 1 ? $1[0] : $1'
```

---

## S-Expression Specification

### Design Principles

1. **Simplicity:** Plain arrays, no metadata
2. **Uniformity:** Consistent structure across all nodes
3. **Inspectable:** Easy to debug with `console.log`
4. **Transformable:** Tree transformations are trivial

### Type Conventions

- **Identifiers:** Plain strings (`"x"`, `"myVar"`)
- **String literals:** Quoted strings (`"\"hello\""`, `"'world'"`)
- **Numbers:** Primitives (`42`, `3.14`) or String objects with metadata
- **Arrays:** `['array', ...]` for array literals
- **Objects:** `['object', ...]` for object literals
- **Null:** JavaScript `null` for optional/missing values

### Disambiguation Rules

**Spread vs Range:**
- `['...', expr]` - Unary spread (one operand)
- `['...', from, to]` - Exclusive range (two operands)
- `['..', from, to]` - Inclusive range (two operands)

**Context determines:** Codegen checks operand count.

**Call vs Property Access:**
- `[callee, ...args]` - If head is expression, it's a call
- `['.', obj, 'prop']` - Explicit property access node

---

## Advanced Features

### String Object Metadata

The CoffeeScript lexer attaches rich metadata to String objects:

**For STRING tokens:**
- `.quote` - Original quote type (`'` or `"`)
- `.double` - Is double-quoted
- `.indent` - Heredoc indentation
- `.initialChunk` - First chunk of heredoc
- `.finalChunk` - Last chunk of heredoc

**For NUMBER tokens:**
- `.parsedValue` - Pre-parsed number (handles hex, octal, binary, BigInt)

**For OPERATOR tokens:**
- `.original` - Original text (e.g., `is` for `===`)

**For ALL tokens:**
- Location data (line, column, range) for sourcemaps

**Rip usage:**
- Quote preservation using `.quote`
- Range optimization using `.parsedValue`
- Future: Sourcemaps using location data

### Context-Aware Generation

The codegen uses **context parameter** for optimal output:

```javascript
generate(sexpr, context = 'statement')
```

**Contexts:**
- `'statement'` - Top-level, in blocks
- `'value'` - In expressions, assignments, returns

**Example:**
```rip
# Statement context - plain loop
console.log(x) for x in arr
# → for (const x of arr) { console.log(x); }

# Value context - array comprehension
result = (x * 2 for x in arr)
# → result = (() => { const result = []; ... })()
```

---

## Grammar Tips

### 1. Use Style 2 for Most Rules

```coffeescript
# Clean and simple
o 'FOR ForVariables IN Expression Block', '["for-in", 2, 4, null, null, 5]'
```

### 2. Use Style 3 Sparingly

Only when you need conditional logic:

```coffeescript
# Unwrap single-element bodies
o '( Body )', '$2.length === 1 ? $2[0] : $2'
```

### 3. Test Incrementally

```bash
# After each grammar change:
bun run build:parser
echo 'test code' | ./bin/rip -s
```

### 4. Check Generated Code

```bash
# Verify Solar generated correct action
grep -A 2 "case NNN:" src/parser.js
```

### 5. Document Token Positions

```coffeescript
# Makes rules self-documenting
o 'IF Expression Block ELSE Block', '["if", 2, 3, 5]'
#  1   2          3     4    5            cond then else
```

---

## Integration Checklist

For Solar to generate Rip-compatible s-expressions:

- ✅ Use `mode = 'sexp'` in grammar
- ✅ Emit plain arrays (no metadata)
- ✅ Use string heads (`"if"`, `"def"`, etc.)
- ✅ Use `['...', expr]` for spread (unary)
- ✅ Use `['..', from, to]` for inclusive ranges
- ✅ Use `['...', from, to]` for exclusive ranges
- ✅ Use `['block', ...stmts]` for multi-statement blocks
- ✅ Use `null` for optional/missing values
- ✅ Handle destructuring patterns correctly
- ✅ Preserve String object metadata from lexer

---

## Why S-Expressions Work

### Traditional AST Approach

```javascript
// CoffeeScript-style AST node
class BinaryOp {
  constructor(operator, left, right) {
    this.operator = operator;
    this.left = left;
    this.right = right;
  }

  compile(options) {
    // 50+ lines of compilation logic
    // Track context, handle precedence, etc.
  }
}
```

**Problems:**
- Hundreds of node classes
- Complex inheritance hierarchies
- Tight coupling between structure and behavior
- Hard to extend

### S-Expression Approach

```javascript
// Just arrays!
['+', left, right]

// In codegen:
case '+': {
  const [left, right] = rest;
  return `(${this.generate(left)} + ${this.generate(right)})`;
}
```

**Benefits:**
- ✅ Simple pattern matching
- ✅ Easy to extend (add a case)
- ✅ Easy to inspect/debug
- ✅ Easy to transform
- ✅ **64% less code**

---

## Solar Generator Details

### File: `src/grammar/solar.rip`

**Size:** 1,047 LOC
**Purpose:** Generates SLR(1) parsers from grammar specs
**Features:**
- Lexer-less (works with any token stream)
- S-expression mode
- Precedence handling
- Conflict resolution

### Generated Parser: `src/parser.js`

**Size:** 340 LOC (auto-generated)
**Contains:**
- Parse table
- Action functions
- State machine

**DO NOT EDIT DIRECTLY** - Regenerate from grammar instead!

---

## Quick Reference

### Common Patterns

**Assignment:**
```coffeescript
o 'Assignable = Expression', '["=", 1, 3]'
```

**Binary operator:**
```coffeescript
o 'Expression + Expression', '["+", 1, 3]'
```

**Unary operator:**
```coffeescript
o '! Expression', '["!", 2]'
```

**Function:**
```coffeescript
o 'DEF Identifier ParamList Block', '["def", 2, 3, 4]'
```

**If/else:**
```coffeescript
o 'IF Expression Block', '["if", 2, 3]'
o 'IF Expression Block ELSE Block', '["if", 2, 3, 5]'
```

**For loop:**
```coffeescript
o 'FOR ForVariables IN Expression Block', '["for-in", 2, 4, null, null, 5]'
```

### Files Reference

| File | Purpose | Size | Modify? |
|------|---------|------|---------|
| `src/grammar/grammar.rip` | Grammar spec | 795 LOC | ✅ Yes |
| `src/grammar/solar.rip` | Parser generator | 1,047 LOC | ❌ No |
| `src/parser.js` | Generated parser | 340 LOC | ❌ No (auto-gen) |
| `src/lexer.js` | Lexer + Rewriter | 3,145 LOC | ⚠️ Rewriter only |
| `src/codegen.js` | Code generator | 4,738 LOC | ✅ Yes |

---

## Performance

### Parser Generation Speed

**Solar generates Rip's parser in ~80ms!**

**Real-world benchmark (Rip grammar):**
- **Grammar size:** 91 types, 406 production rules
- **Generated parser:** 250 states, SLR(1) parse table
- **Solar:** ~80ms total
- **Jison:** ~12,500ms (12.5 seconds)
- **Speedup:** **156× faster!**

**Breakdown of Solar's 80ms:**
```
~3ms   processGrammar     (4%)   - Parse grammar spec
~51ms  buildLRAutomaton   (64%)  - Build state machine
~10ms  processLookaheads  (12%)  - Compute FIRST/FOLLOW
~10ms  buildParseTable    (12%)  - Generate parse table
~6ms   Code generation    (8%)   - Output parser.js
────────
~80ms  Total
```

### Why Solar is So Fast

**1. Optimized Algorithms:**
- Single-pass item grouping (no redundant scanning)
- Efficient kernel signature computation
- Direct state map lookups
- Minimal object allocations

**2. Clean Implementation:**
- No intermediate representations
- Direct Map/Set usage (V8 optimized)
- Void operators prevent unnecessary returns
- Simple data structures (arrays, not classes)

**3. Comparison with Jison:**

| Metric | Jison | Solar | Winner |
|--------|-------|-------|--------|
| **Parse time** | 12,500ms | 80ms | **Solar 156×** |
| **Dependencies** | Many | Zero | **Solar** |
| **Self-hosting** | No | Yes | **Solar** |
| **Code size** | 2,285 LOC | 1,047 LOC | **Solar 54%** |
| **Output** | AST classes | S-expressions | **Solar (simpler)** |

### Iteration Speed Matters

**Why 80ms vs 12.5s matters in practice:**

With Jison (12.5s):
- Edit grammar → wait → coffee break → check result
- ~5-10 iterations per hour
- Slow feedback loop discourages experimentation

With Solar (80ms):
- Edit grammar → instant feedback → iterate
- ~100+ iterations per hour
- Rapid experimentation enabled Rip's development

**Solar's speed made Rip possible.** The ability to modify the grammar and see results instantly (80ms feels instant) enabled the rapid iteration needed to develop and refine Rip's syntax.

### Generated Parser Performance

**Runtime performance:** Identical to Jison (both generate SLR(1) state machines)
**Overhead:** Minimal - simple array construction for s-expressions
**Output quality:** Clean, efficient parse tables

The speedup is in **generation time**, not runtime. Both produce equally fast parsers.

---

## Summary

Solar's s-expression mode is the **secret sauce** that makes Rip practical:

1. **Simple IR:** Arrays instead of AST classes
2. **Grammar-driven:** Modify spec, regenerate parser
3. **Battle-tested:** Built on CoffeeScript's proven lexer
4. **Maintainable:** 50% less code than CoffeeScript
5. **Extensible:** Add features by adding switch cases

**Result:** A production-ready compiler in 9,450 LOC instead of CoffeeScript's 17,760 LOC!

---

**For more details:**
- Grammar file: `src/grammar/grammar.rip`
- Code generator: `src/codegen.js`
- Test examples: `test/rip/`
