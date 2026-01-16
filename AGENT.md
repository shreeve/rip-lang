# AI Agent Guide for Rip

**Purpose:** This document helps AI assistants understand and work with the Rip language compiler.

**What is Rip:** An elegant reactive language that compiles to modern JavaScript (ES2022), featuring zero dependencies, self-hosting capability, built-in reactivity, and components as language constructs.

---

## Quick Start

### Essential Commands

```bash
# Debug any code
echo 'your code' | ./bin/rip -t  # Tokens (lexer)
echo 'your code' | ./bin/rip -s  # S-expressions (parser)
echo 'your code' | ./bin/rip -c  # JavaScript (codegen)

# Run tests
bun run test                              # All tests (1046)
bun test/runner.js test/rip/FILE.rip     # Specific file

# Rebuild parser (after grammar changes)
bun run parser

# Build browser bundle
bun run browser
```

### Current Status

| Metric | Value |
|--------|-------|
| Version | 2.5.0 |
| Tests | 1046/1046 (100%) |
| Dependencies | Zero |
| Self-hosting | Yes (Rip compiles itself) |

---

## Project Structure

```
rip-lang/
├── src/
│   ├── compiler.js      # Main compiler + code generator (7,965 LOC)
│   ├── lexer.js         # CoffeeScript 2.7 lexer (3,537 LOC)
│   ├── parser.js        # Generated parser (363 LOC) ❌ Don't edit!
│   ├── repl.js          # Terminal REPL
│   ├── browser.js       # Browser integration
│   ├── tags.js          # HTML/SVG tag definitions
│   └── grammar/
│       ├── grammar.rip  # Grammar specification (872 LOC)
│       └── solar.rip    # Parser generator (997 LOC) ❌ Don't edit!
├── docs/
│   ├── GUIDE.md         # Complete language guide
│   ├── INTERNALS.md     # Compiler/parser technical details
│   ├── PHILOSOPHY.md    # Design rationale
│   ├── BROWSER.md       # Browser usage
│   ├── WHY-YES-RIP.md   # The case for Rip
│   └── WHY-NOT-COFFEESCRIPT.md  # Devil's advocate
├── test/rip/            # 25 test files
└── scripts/             # Build utilities
```

### File Editing Rules

| File | Can Edit? | Notes |
|------|-----------|-------|
| `src/compiler.js` | ✅ Yes | Main work happens here |
| `src/grammar/grammar.rip` | ⚠️ Expert only | Run `bun run parser` after |
| `src/parser.js` | ❌ Never | Generated file |
| `src/grammar/solar.rip` | ❌ Never | Parser generator (given) |
| `src/lexer.js` | ⚠️ Rewriter only | CoffeeScript lexer |
| `test/rip/*.rip` | ✅ Yes | Test files |

---

## The Compilation Pipeline

```
Rip Source → Lexer → Parser → S-Expressions → Codegen → JavaScript
            (3,537)  (363)    (simple arrays)  (7,965)   (ES2022)
```

**Key insight:** S-expressions are simple arrays like `["=", "x", 42]`, not complex AST nodes. This makes the compiler ~50% smaller than CoffeeScript.

---

## Key Concepts

### 1. S-Expression Patterns

```javascript
["=", "x", 42]                 // Assignment
["+", left, right]             // Binary operator
["def", "name", params, body]  // Function definition
["->", params, body]           // Arrow function
["if", condition, then, else]  // Conditional
["signal", name, expr]         // Reactive signal (:=)
["derived", name, expr]        // Derived value (~=)
["component", name, body]      // Component definition
```

### 2. Context-Aware Generation

```javascript
generate(sexpr, context = 'statement')
// context: 'statement' | 'value'
```

**Example - Comprehensions:**
- **Value context** (result used) → IIFE with array building
- **Statement context** (result discarded) → Plain loop

### 3. Dispatch Table Architecture

All 110+ node types are in a dispatch table for O(1) lookup:

```javascript
static GENERATORS = {
  'if': 'generateIf',
  'class': 'generateClass',
  '+': 'generateBinaryOp',
  'signal': 'generateSignal',
  // ... all node types
};
```

To modify a feature:
1. Find the operator in `GENERATORS` table
2. Locate the generator method
3. Modify the method
4. Test!

### 4. Block Unwrapping

Parser wraps statements in `["block", ...]` everywhere:

```javascript
if (Array.isArray(body) && body[0] === 'block') {
  const statements = body.slice(1);  // Always unwrap!
}
```

---

## Reactive Features

Rip provides reactivity as **language-level operators**, not library imports:

| Operator | Name | Output |
|----------|------|--------|
| `:=` | Signal | `const x = __signal(value)` |
| `~=` | Derived | `const x = __computed(() => expr)` |
| `=!` | Equal, dammit! | `const x = value` (just const) |
| `effect` | Effect | `__effect(() => { ... })` |

The reactive runtime is embedded in compiler.js and only included when needed.

---

## Components & Templates

```rip
component Counter
  @initial = 0           # Prop with default
  count := @initial      # Reactive state
  doubled ~= count * 2   # Derived value
  
  inc: -> count += 1     # Method
  
  render
    .counter
      button @click: @inc, "+"
      span.value count

Counter.new(initial: 5).mount "#app"
```

---

## Common Tasks

### Fix a Bug in Codegen

```bash
# 1. Debug the pattern
echo 'failing code' | ./bin/rip -s  # See s-expression

# 2. Find the generator
grep "generateXXX" src/compiler.js

# 3. Fix it
vim src/compiler.js

# 4. Test
bun run test
```

### Add a Grammar Rule

```bash
# 1. Edit grammar
vim src/grammar/grammar.rip

# 2. Regenerate parser
bun run parser

# 3. Add codegen if needed
vim src/compiler.js

# 4. Test
bun run test
```

---

## Testing

### Test Types

```rip
# Execute and compare result
test "name", "x = 42; x", 42

# Compare generated JavaScript
code "name", "x + y", "(x + y)"

# Expect compilation failure
fail "name", "invalid syntax"
```

### Test Files (25 files, 1046 tests)

```
test/rip/
├── assignment.rip    ├── loops.rip
├── async.rip         ├── modules.rip
├── basic.rip         ├── operators.rip
├── classes.rip       ├── optional.rip
├── compatibility.rip ├── parens.rip
├── components.rip    ├── properties.rip
├── comprehensions.rip├── regex.rip
├── control.rip       ├── semicolons.rip
├── data.rip          ├── stabilization.rip
├── errors.rip        ├── strings.rip
├── functions.rip     ├── templates.rip
├── guards.rip
└── literals.rip
```

---

## Documentation Map

| File | Purpose |
|------|---------|
| **README.md** | User guide, features, installation |
| **CONTRIBUTING.md** | GitHub workflow, development process |
| **docs/GUIDE.md** | Complete language guide (reactivity, templates, components, operators) |
| **docs/INTERNALS.md** | Compiler architecture, S-expressions, code generation |
| **docs/PHILOSOPHY.md** | Design rationale, comparison with CoffeeScript |
| **docs/BROWSER.md** | Browser usage, REPL, inline scripts |

---

## Critical Don'ts

- ❌ **Never edit `src/parser.js`** - It's generated
- ❌ **Never edit `src/grammar/solar.rip`** - It's given
- ❌ **Never commit without running tests** - `bun run test` must pass
- ❌ **Never add dependencies** - Zero dependencies is a core principle

## Always Do

- ✅ Run `bun run test` before committing
- ✅ Run `bun run browser` after codegen changes
- ✅ Include `Fixes #N` in commits to auto-close issues
- ✅ Follow existing code patterns

---

## Debugging Tips

```bash
# When tests fail
bun test/runner.js test/rip/FILE.rip  # Run specific test
echo 'code' | ./bin/rip -s            # Check s-expression
echo 'code' | ./bin/rip -c            # Check generated JS

# When Bun caches old code
bun --no-cache test/runner.js test/rip

# When code won't compile
./bin/rip -c file.rip  # Shows line/column in error
```

---

## Quick Reference

### Unique Operators

| Operator | Name | Example |
|----------|------|---------|
| `!` | Dammit | `fetchData!` → calls AND awaits |
| `!` | Void | `def process!` → suppresses return |
| `=!` | Equal, dammit! | `MAX =! 100` → const declaration |
| `!?` | Otherwise | `val !? 5` → default if undefined |
| `//` | Floor div | `7 // 2` → 3 |
| `%%` | True mod | `-1 %% 3` → 2 |
| `:=` | Signal | `count := 0` → reactive state |
| `~=` | Derived | `doubled ~= count * 2` → computed |
| `<=>` | Bind | `value <=> num` → two-way binding |
| `=~` | Match | `str =~ /pat/` → Ruby-style regex |
| `.new()` | Constructor | `Counter.new()` → Ruby-style new |

### Build Commands

```bash
bun run test      # Run all tests
bun run parser    # Rebuild parser from grammar
bun run browser   # Build browser bundle
bun run serve     # Start dev server (localhost:3000)
```

---

**For AI Assistants:** The code is well-tested and the architecture is clear. Trust the tests, use the debug tools (`-s`, `-t`, `-c`), and follow existing patterns. Most work happens in `src/compiler.js` - find the generator method for the node type you're working with and modify it.
