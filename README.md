<p align="center">
  <img src="docs/rip-1280w.png" alt="Rip Logo" width="400">
</p>

<h1 align="center">Rip</h1>

<p align="center">
  <strong>Elegant scripting language → Modern JavaScript (ES2022)</strong>
</p>

<p align="center">
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version"></a>
  <a href="#es2022-target"><img src="https://img.shields.io/badge/target-ES2022-blue.svg" alt="Target"></a>
  <a href="#current-status"><img src="https://img.shields.io/badge/tests-843%2F843-brightgreen.svg" alt="Tests"></a>
  <a href="#current-status"><img src="https://img.shields.io/badge/coverage-100%25-brightgreen.svg" alt="Coverage"></a>
  <a href="#zero-dependencies"><img src="https://img.shields.io/badge/dependencies-ZERO-brightgreen.svg" alt="Dependencies"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"></a>
</p>

---

## Why Rip?

**Write less. Do more. Zero dependencies.**

Rip brings CoffeeScript's elegance to modern JavaScript—but **25% smaller**, completely standalone, and self-hosting. No build tools, no external dependencies, not even a parser generator. Just clone and go.

```rip
# Write beautiful code
def fibonacci(n)
  if n <= 1
    n
  else
    fibonacci(n - 1) + fibonacci(n - 2)

fibonacci(10)  # 55
```

```javascript
// Compiles to clean JavaScript
function fibonacci(n) {
  if (n <= 1) {
    return n;
  } else {
    return fibonacci(n - 1) + fibonacci(n - 2);
  }
}
fibonacci(10);
```

**What makes Rip special?**

- 🎯 **Zero Dependencies** - Includes its own SLR(1) parser generator (solar.rip)
- 🚀 **Self-Hosting** - Rip compiles itself, including the parser generator
- ⚡ **Just Run It** - `bun your-script.rip` works instantly (automatic loader via bunfig.toml)
- 🎨 **Elegant** - Beautiful syntax, implicit returns, no semicolons
- 🧠 **Smart** - Context-aware comprehensions, range optimizations, auto-async
- 📦 **Complete** - Full compiler, triple REPL (terminal/browser/console), test framework
- 🔧 **Modern** - ES2022 output with classes, modules, optional chaining

---

## Runtime Compatibility

**Primary Targets:**
- 🎯 **Bun** - First-class support with automatic `.rip` loader (recommended)
- 🌐 **Browsers** - 43KB bundle, inline `<script type="text/rip">`, REPL

**Also Supported:**
- ✅ **Deno** - ES2022 output works natively
- ✅ **Node.js 12+** - Full compatibility with modern Node

### ES2022 Target

Rip compiles to **modern JavaScript (ES2022)** for clean, efficient output:

**Features Used:**
- ✅ **ES2015 (ES6):** classes, let/const, arrow functions, template literals, destructuring
- ✅ **ES2018:** async iteration (for await...of)
- ✅ **ES2020:** optional chaining (`?.`), nullish coalescing (`??`)
- ✅ **ES2022:** static class fields, top-level await

**Not Used:**
- ❌ Private fields (`#var`) - not commonly needed
- ❌ WeakRefs, FinalizationRegistry - specialized use cases

**Why ES2022?** Modern output means smaller code, native features, and excellent performance across all runtimes.

---

## Zero Dependencies

**Rip is completely standalone with ZERO runtime or build dependencies!**

```json
{
  "dependencies": {}    // ← Completely empty!
}
```

**What's included:**
- ✅ **Full compiler** - Lexer, parser, code generator (all built-in)
- ✅ **Parser generator** - Complete SLR(1) parser generator (solar.rip)
- ✅ **Self-hosting** - Rip compiles itself, including the parser generator
- ✅ **Triple REPL** - Terminal, browser, and console REPLs built-in
- ✅ **Browser bundle** - 43KB self-contained compiler
- ✅ **Test runner** - Full test framework included

**What you need:**
- JavaScript runtime (Bun, Node.js, or browser)
- **That's it!**

**Self-hosting verification:**
```bash
# ONE COMMAND rebuilds the parser from scratch
bun run parser

# What this does:
# - Runs solar.rip (parser generator, written in Rip)
# - Reads grammar.rip (grammar spec, written in Rip)
# - Outputs parser.js (complete parser)
# Complete bootstrap loop with ZERO external tools ✅
```

**No external compilers, no build tools, no transpilers** - just a JavaScript runtime and Rip itself!

---

## How It Works

**The secret: S-expressions as intermediate representation**

Traditional compilers use complex AST node classes. Rip uses simple arrays:

```
Source → Tokens → S-Expressions → JavaScript
                  ["=", "x", 42]
                  Simple arrays!
```

**Before (Traditional AST):**
```javascript
class BinaryOp {
  constructor(op, left, right) { ... }
  compile() { /* complex logic */ }
}
```

**After (S-Expressions):**
```javascript
case '+': {
  const [left, right] = rest;
  return `(${this.generate(left)} + ${this.generate(right)})`;
}
```

**Result: 25% smaller implementation**

| Component | CoffeeScript | Rip | Notes |
|-----------|--------------|-----|-------|
| Lexer | 1,473 LOC | 3,146 LOC | Enhanced with compatibility |
| AST Nodes | 6,138 LOC | **0 LOC** | S-expressions! |
| Code Generator | 336 LOC | 4,567 LOC | Complete & optimized |
| Parser Generator | External (Jison) | **1,048 LOC** | Built-in (solar.rip) |
| **Total** | **11,826 LOC** | **9,173 LOC** | **~25% smaller** |

**Plus:**
- ✅ **ZERO dependencies** - Everything included
- ✅ **Self-hosting** - Rip compiles itself
- ✅ **No external tools** - Just a JavaScript runtime

---

## Quick Start

### Installation & Setup

**Step 1: Clone the repository**
```bash
git clone https://github.com/shreeve/rip-lang.git
cd rip
```

**Step 2: Set up global Bun loader (recommended)**
```bash
# Link Rip globally so it's available everywhere
bun link

# Add to global Bun config
echo 'preload = ["rip-lang/loader"]' >> ~/.bunfig.toml
```

**That's it!** Now you can run `.rip` files from anywhere:
```bash
cd ~/any-project

# Create a test file
echo 'def greet(name)
  "Hello, ${name}!"

console.log greet("World")' > test.rip

# Run it!
bun test.rip  # → Hello, World! ✨
```

**Verify your setup:**
```bash
# Check that rip-lang is linked
bun pm ls --global | grep rip-lang

# Check your global config
cat ~/.bunfig.toml
# Should include: preload = ["rip-lang/loader"]
```

**No npm install needed** - Rip has zero dependencies!

**Requirements:**
- **Bun** (recommended) - For automatic `.rip` loader
- **Or** any ES2022-compatible runtime: Deno, Node.js 12+, modern browsers
  - Note: Deno/Node require compilation first (`./bin/rip -o output.js input.rip`)

### Usage

**The easiest way: Run .rip files directly with Bun**

```bash
# Just run it! The loader is automatic via bunfig.toml
bun your-script.rip

# Example
echo 'def greet(name)
  console.log "Hello, ${name}!"

greet "World"' > hello.rip

bun hello.rip
# → Hello, World!
```

**How it works:** The `bunfig.toml` preloads `rip-loader.ts`, which registers a Bun plugin that automatically compiles `.rip` files on-the-fly. No build step, no manual compilation—just run your code!

**You can also import .rip modules directly:**

```rip
# utils.rip
export def add(a, b)
  a + b

export multiply = (a, b) => a * b
```

```rip
# main.rip
import { add, multiply } from "./utils.rip"

console.log add(5, 3)      # 8
console.log multiply(4, 7) # 28
```

```bash
bun main.rip  # Works automatically!
```

**Other commands:**

```bash
# Interactive REPL
./bin/rip

# Compile to JavaScript
./bin/rip examples/fibonacci.rip

# See s-expressions (the IR)
./bin/rip -s examples/fibonacci.rip

# See tokens (from lexer)
./bin/rip -t examples/fibonacci.rip

# Save compiled output
./bin/rip -o output.js examples/fibonacci.rip
```

### Interactive REPL

Rip includes a full-featured REPL for interactive development:

```bash
$ ./bin/rip
Rip 1.0.0 - Interactive REPL
Type .help for commands, Ctrl+C to exit

rip> x = 42
→ 42

rip> pattern = ///
....>   \d+      # digits
....>   [a-z]+   # letters
....> ///
→ /\d+[a-z]+/

rip> pattern.test('123abc')
→ true

rip> .vars
Defined variables:
  x = 42
  pattern = /\d+[a-z]+/
```

**REPL Features:**
- ✅ Variable persistence across evaluations
- ✅ Multi-line input (automatic detection)
- ✅ Command history (arrow keys)
- ✅ Special commands (.help, .vars, .clear, .history, .exit)
- ✅ Debug modes (.tokens, .sexp, .js)
- ✅ Pretty-printed output with colors
- ✅ Last result in `_` variable

### Browser REPL & Bundle

**Run Rip in your browser!** Browsers are a primary target with full support:

**Try it online (GitHub Pages):**
```
https://shreeve.github.io/rip-lang/
# Live REPL, examples, and live compiler
```

**Or run locally:**
```bash
# Build browser bundles (one-time)
bun run browser

# Start development server
bun run serve

# Open in browser
http://localhost:3000/
# (auto-redirects to REPL)
```

**What you get:**
- **REPL Console** - Terminal-like with commands, history, multi-line
- **Live Compiler** - Split pane showing Rip → JavaScript in real-time
- **43KB bundle** - Brotli-compressed (560KB → 43KB, 92% reduction!)
- **Inline scripts** - `<script type="text/rip">` auto-executes
- **Syntax highlighting** - Colored JavaScript output
- **All features work** - Heregex, regex+, classes, async, dammit operator, everything!

**Use in production:**
```html
<script src="https://cdn.example.com/rip.browser.min.js"></script>
<script type="text/rip">
  def greet(name)
    console.log "Hello, ${name}!"
  greet "Browser"
</script>
```

See [docs/BROWSER.md](docs/BROWSER.md) for complete browser guide.

### Running Tests

```bash
# All tests (recommended)
bun run test

# Or run directly
bun test/runner.js test/rip

# Specific file
bun test/runner.js test/rip/functions.rip

# Use --no-cache during active development
bun --no-cache test/runner.js test/rip
```

### Quick Reference: NPM Scripts

```bash
bun run test      # Run all 843 tests
bun run parser    # Rebuild parser from grammar (self-hosting!)
bun run browser   # Build browser bundles (43KB compressed)
bun run serve     # Start dev server (REPL at localhost:3000)
```

---

## Language Features

### Core Syntax

```rip
# Variables (function-scoped, auto-hoisted)
x = 42
name = "Alice"

# Note: Variables hoist to top of their scope (program or function)
# Functions access outer variables via closure (CoffeeScript semantics)

# Functions (three styles - each has distinct behavior)
def add(a, b)         # Named, unbound this, hoisted
  a + b

multiply = (a, b) ->  # Anonymous, unbound this, not hoisted
  a * b

divide = (a, b) =>    # Anonymous, bound this, not hoisted
  a / b

# Important: Arrow functions ALWAYS require parentheses
# () => expr    (x) => expr    (x, y) => expr
# Consistency over saving 2 characters!

# Conditionals
if x > 0
  "positive"
else
  "negative"

# Loops
for item in [1, 2, 3]
  console.log item

# Objects
person =
  name: "Bob"
  age: 30

# Arrays
numbers = [1, 2, 3, 4, 5]

# String interpolation
greeting = "Hello, ${name}!"
```

### Modern Features

```rip
# Destructuring
{name, age} = person
[first, second] = numbers

# Spread/rest (dual syntax - prefix or postfix)
combined = [...arr1, ...arr2]   # ES6 prefix (recommended)
combined = [arr1..., arr2...]   # CoffeeScript postfix (compatibility)
def fn(first, ...rest)           # ES6 prefix rest params
def fn(first, rest...)           # CoffeeScript postfix rest params
{name, ...props} = person        # ES6 prefix object rest
{name, props...} = person        # CoffeeScript postfix object rest

# Note: Both syntaxes compile to the same ES6 JavaScript.
# Postfix syntax (x...) is for CoffeeScript compatibility.
# New code should use prefix syntax (...x) for clarity.

# Optional operators (dual syntax)
user?.profile?.name    # ES6 optional chaining (native)
arr?[0]                # CoffeeScript soak (existence check)
fn?(arg)               # CoffeeScript soak call

# Nullish coalescing
port = config.port ?? 8080

# Legacy existential operator (CoffeeScript compatibility)
value = x ? y          # SPACE? syntax (auto-converts to ??)
value = x ?? y         # Preferred modern syntax

# Note: "x ? y" (with space before ?) automatically converts to "x ?? y"
# This provides backwards compatibility with CoffeeScript's existential operator.
# Ternary operators (x ? y : z) are unaffected.
# New code should use ?? explicitly for clarity.

# ============================================================================
# Sigil Operators - ! has dual meaning based on context
# ============================================================================

# 1. DAMMIT OPERATOR (!) - At Call-Site (Forces Await)
result = fetchData!      # → await fetchData() (calls AND awaits)
user = getUser!(id)      # → await getUser(id)
data = api.get!          # → await api.get()

# The ! at call-site does TWO things:
# 1. Calls the function (even without parens)
# 2. Prepends await to the call

# 2. VOID OPERATOR (!) - At Definition-Site (Suppresses Returns)
def processItems!        # Side-effect only (always returns undefined)
  for item in items
    item.update()
  # ← Executes all statements, then returns undefined

def validate!(x)
  return if x < 0        # → Just "return" (no value)
  console.log "valid"
  # ← Executes, then returns undefined

# Works with all function types:
c! = (x) ->              # Void thin arrow
  x * 2                  # Executes but doesn't return value

process! = (data) =>     # Void fat arrow
  data.toUpperCase()     # Executes but returns undefined

# The ! at definition means:
# - All statements execute (side effects preserved)
# - Final "return;" added automatically
# - Explicit "return expr" becomes just "return"
# - Always returns undefined

# 3. PUNT OPERATOR (&) - At Call-Site (Prevents Await) [FUTURE]
# &fetchData → fetchData() (no await)
# Used in future implicit await mode

# Heregex - Extended regular expressions
pattern = ///
  ^ \d+      # starts with digits
  \s*        # optional whitespace
  [a-z]+     # followed by letters
  $          # end of string
  ///i
# Compiles to: /^\d+\s*[a-z]+$/i
# Whitespace and comments automatically stripped!

# Ruby-style regex (Rip innovation!)
email =~ /(.+)@(.+)/     # Match with automatic _ capture
username = _[1]          # Extract captures easily
domain = _[2]

zip = "12345-6789"[/^(\d{5})/, 1]  # Inline extraction: "12345"

# __DATA__ marker (Ruby-inspired)
# Embed data directly in source files
config = parseConfig(DATA)

__DATA__
host=localhost
port=8080
debug=true

# Classes
class Animal
  constructor: (@name) ->

  speak: ->
    "${@name} says hello"

# Comprehensions (Context-Aware Optimization!)
# Rip intelligently chooses IIFE (array building) vs plain loop (side effects)

# IIFE when result is USED (value context):
result = (x * 2 for x in items)        # Assignment
console.log(x * 2 for x in items)      # Function argument
fn = -> (x * 2 for x in items)         # Last statement (implicit return)
(x * 2 for x in [1,2,3])               # Single statement (REPL mode)

# Plain loop when result is DISCARDED (statement context):
fn = ->
  processItem x for x in items         # NOT last statement
  doSomething()                        # Result unused, no IIFE!
# → for (const x of items) { processItem(x); }

# One-liner and multi-line are IDENTICAL when result unused:
processItem x for x in items           # Same as ↓
for x in items                         # Same as ↑
  processItem x
# Both → for (const x of items) { processItem(x); }

# Critical: Proper ordering with guards and value variables
for own k, v of obj when v > 5
  process k, v
# → for (const k in obj) {
#     if (obj.hasOwnProperty(k)) {
#       const v = obj[k];     // Assign BEFORE guard check!
#       if (v > 5) {          // Guard can reference v
#         process(k, v);
#       }
#     }
#   }
```

**Rip is smarter than CoffeeScript:** Comprehensions automatically optimize to plain loops when the result isn't used, avoiding unnecessary array building and IIFE overhead. CoffeeScript always generates IIFE for comprehension syntax, even when wasteful!

**See [docs/COMPREHENSIONS.md](docs/COMPREHENSIONS.md) for complete specification of context rules and edge cases.**

---

## Optional Operators - Dual Syntax

Rip provides **two distinct approaches** to safe property/method access:

### Single `?` - CoffeeScript Soak (Existence Checks)

**Compiles to explicit null/undefined checks:**

```rip
# Existence check
arr?
# → (arr != null)

# Soak indexing
arr?[0]
# → (arr != null ? arr[0] : undefined)

# Soak call
fn?(arg)
# → (typeof fn === 'function' ? fn(arg) : undefined)

# Soak prototype
obj?::toString
# → (obj != null ? obj.prototype.toString : undefined)

# Existential assignment
a ?= 10
# → a ??= 10
```

**Benefits:**
- Works in all browsers (transpiles to standard checks)
- Clear, explicit null/undefined handling
- CoffeeScript compatible
- Type-aware function checks

### Dot-based `?.` - ES6 Optional Chaining (Native)

**Passes through to native JavaScript:**

```rip
# Optional property
user?.profile?.name
# → user?.profile?.name

# Optional index
arr?.[0]
# → arr?.[0]

# Optional call
fn?.(arg)
# → fn?.(arg)

# Nullish coalescing
x ?? defaultValue
# → x ?? defaultValue

# Nullish assignment
a ??= 10
# → a ??= 10
```

**Benefits:**
- Modern, concise syntax
- Native browser optimization
- Short-circuit evaluation
- Standard JavaScript (ES2020+)

### Mix and Match

**You can combine both styles in the same expression:**

```rip
# ES6 optional property + CoffeeScript soak index
obj?.arr?[0]
# → (obj?.arr != null ? obj?.arr[0] : undefined)

# CoffeeScript soak + ES6 optional
users?[0]?.name
# → (users != null ? users[0] : undefined)?.name
```

### When to Use Which

**Use `?` (CoffeeScript soak) when:**
- Need older browser support (transpiles to checks)
- Want function type checking (`fn?()` validates it's callable)
- Following CoffeeScript patterns
- Debugging (explicit checks are clearer)

**Use `?.` (ES6 optional) when:**
- Targeting modern browsers (ES2020+)
- Want clean, concise native output
- Using standard JavaScript patterns
- Performance matters (native is faster)

**Use `?=` vs `??=`:**
- Both compile to ES6 `??=` (nullish coalescing assignment)
- `?=` is CoffeeScript-style syntax
- `??=` is ES6-style syntax
- Choose based on your team's preferences

Both syntaxes handle `null` and `undefined` - pick the style that fits your project!

---

## Architecture

### The Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Source    │────>│   Lexer     │────>│   Parser    │────>│   Codegen   │
│   Code      │     │  (Coffee)   │     │   (Solar)   │     │   (Rip)     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                         3,146 LOC           340 LOC           4,567 LOC
                       15 yrs tested        Generated!        Optimized!
```

### Components

**1. Lexer** (`src/lexer.js`)
- CoffeeScript 2.7 production lexer
- Handles all tokenization
- 15 years of edge cases handled
- Enhanced with compatibility features

**2. Parser** (`src/parser.js`)
- Solar-generated SLR(1) parser
- Built from grammar specification
- Generates s-expressions directly
- Regenerate with `bun run build:parser`

**3. Code Generator** (`src/codegen.js`)
- Pattern matches on s-expressions
- Generates JavaScript code
- 110+ node types implemented
- Clean-room implementation

### Why This Works

**S-expressions simplify everything:**

```javascript
// Traditional AST approach
class BinaryOp {
  constructor(op, left, right) { ... }
  compile() { /* complex logic */ }
}

// S-expression approach
case '+': {
  const [left, right] = rest;
  return `(${this.generate(left)} + ${this.generate(right)})`;
}
```

Simple pattern matching beats complex OOP hierarchies!

---

## Bun Integration

Rip works seamlessly with Bun through automatic loader support!

### Quick Setup (3 Options)

#### Option 1: Use Globally (Recommended)

Set up Rip loader to work in **all** your projects:

```bash
# Install Rip globally
cd /path/to/rip-lang
bun link

# Create global Bun config (or add to existing ~/.bunfig.toml)
echo 'preload = ["rip-lang/loader"]' >> ~/.bunfig.toml

# Now run .rip files from anywhere!
cd ~/my-project
bun script.rip  # Works! ✨
```

#### Option 2: Per-Project (From NPM - Coming Soon)

```bash
# In your project directory
bun add -d rip-lang

# Create bunfig.toml
echo 'preload = ["rip-lang/loader"]' > bunfig.toml

# Run
bun your-script.rip
```

#### Option 3: Per-Project (Local Development)

```bash
# Copy files to your project
cp /path/to/rip-lang/bunfig.toml .
cp /path/to/rip-lang/rip-loader.ts .
cp -r /path/to/rip-lang/src .

# Run
bun your-script.rip
```

### How It Works

Two files enable automatic `.rip` file execution:

**1. `bunfig.toml`** - Tells Bun to preload the loader:
```toml
preload = ["rip-lang/loader"]  # From package
# or
preload = ["./rip-loader.ts"]  # Local file
```

**2. `rip-loader.ts`** - Bun plugin that compiles `.rip` files on-the-fly:
```typescript
import { plugin } from "bun";
import { compileToJS } from "./src/compiler.js";

await plugin({
  name: "rip-loader",
  async setup(build) {
    build.onLoad({ filter: /\.rip$/ }, async (args) => {
      const source = readFileSync(args.path, "utf-8");
      const js = compileToJS(source);
      return { contents: js, loader: "js" };
    });
  },
});
```

### What You Get

- ✅ **Direct execution** - `bun script.rip` just works
- ✅ **Module imports** - `import { fn } from "./utils.rip"`
- ✅ **Hot reloading** - Changes compile automatically
- ✅ **Full ES6 modules** - Named exports, default exports, re-exports
- ✅ **Error messages** - Compilation errors show source file and line
- ✅ **Zero config** - Once set up globally, works everywhere

### Using with Deno

Deno works great with Rip's ES2022 output:

```bash
# Compile first
./bin/rip -o script.js your-script.rip

# Run with Deno
deno run script.js

# Or use ES6 modules
./bin/rip -o utils.js utils.rip
deno run --allow-read main.js  # imports from utils.js
```

### Using with Node.js

Node.js 12+ supports all ES2022 features Rip uses:

```bash
# Compile first
./bin/rip -o script.js your-script.rip

# Run with Node
node script.js

# Or add to package.json scripts
{
  "scripts": {
    "build": "./bin/rip -o dist/app.js src/app.rip",
    "start": "node dist/app.js"
  }
}
```

**Note:** Bun's automatic loader is the recommended approach. For Deno/Node, compile `.rip` → `.js` first, then run the compiled output.

### Troubleshooting

**Problem: `bun script.rip` doesn't work**

```bash
# 1. Check if rip-lang is linked globally
bun pm ls --global
# Should show "rip-lang"

# 2. Check if global config exists
cat ~/.bunfig.toml
# Should include: preload = ["rip-lang/loader"]

# 3. Re-link if needed
cd /path/to/rip-lang
bun link

# 4. Test from the rip-lang directory first
cd /path/to/rip-lang
bun www/examples/fibonacci.rip
# This should always work (uses local bunfig.toml)
```

**Problem: Imports not working**

```bash
# Make sure you're using .rip extension in imports
import { fn } from "./utils.rip"  # ✅ Good
import { fn } from "./utils"      # ❌ Won't work
```

**Problem: "Cannot find package rip-lang"**

```bash
# The package needs to be linked first
cd /path/to/rip-lang
bun link

# Verify it worked
bun pm ls --global | grep rip-lang
```

---

## Development

### Project Structure

```
rip/
├── src/
│   ├── lexer.js         # CoffeeScript lexer (given)
│   ├── parser.js        # Solar parser (generated)
│   ├── codegen.js       # Code generator (our work!)
│   ├── compiler.js      # Main pipeline
│   ├── browser.js       # Browser entry point
│   ├── repl.js          # Terminal REPL
│   └── grammar/
│       ├── grammar.rip  # Grammar specification
│       └── solar.rip    # Parser generator
├── docs/                # Documentation
│   ├── CODEGEN.md       # Pattern reference
│   ├── COMPREHENSIONS.md # Comprehension spec
│   ├── SOLAR.md         # Parser generator guide
│   ├── STRING.md        # String metadata reference
│   ├── REGEX-PLUS.md    # Ruby-style regex features
│   ├── DAMMIT-OPERATOR.md # Async shorthand
│   ├── BROWSER.md       # Browser usage & REPLs
│   └── COFFEESCRIPT-COMPARISON.md # Feature comparison
├── test/
│   ├── rip/             # Feature tests (20 files, 843 tests)
│   └── runner.js        # Test runner
├── www/                 # Browser bundles and demos
├── examples/            # Example programs
├── AGENT.md             # AI agent handbook
└── README.md            # This file
```

### Adding Features

1. **Check parser output:**
   ```bash
   echo 'your code' | ./bin/rip -s
   ```

2. **Add to codegen:**
   ```javascript
   case 'your-pattern': {
     // Generate code
   }
   ```

3. **Write tests:**
   ```rip
   test "feature name", "code", expectedResult
   ```

4. **Run tests:**
   ```bash
   bun test/runner.js test/rip/your-test.rip
   ```

5. **Document in docs/CODEGEN.md**

### Philosophy

> **Simplicity scales.**
> Keep the IR simple (s-expressions)
> Keep the pipeline clear (lex → parse → generate)
> Keep the code minimal (pattern matching)

### Design Decisions

**Arrow Functions: Parentheses Always Required**

Rip requires parentheses for ALL arrow function parameters:

```rip
# ✅ Always use parentheses
() => expr           # Zero params
(x) => expr          # One param
(x, y) => expr       # Multiple params

# ❌ Never omit (even though ES6 allows it)
x => expr            # Not supported
```

**Why?**
- **Consistency:** One simple rule - no special cases
- **Clarity:** Parameter lists are always obvious
- **Simplicity:** Less cognitive overhead for developers
- **Maintainability:** Simpler compiler implementation

We considered allowing `x => expr` (ES6 style) but decided consistency and simplicity were more valuable than saving 2 characters.

---

## Comparison

### vs CoffeeScript

| Feature | CoffeeScript | Rip |
|---------|-------------|------|
| Syntax | ✅ Elegant | ✅ Elegant (inspired by CS) |
| Implementation | 11,826 LOC | **9,173 LOC (~25% smaller)** |
| Dependencies | ❌ Multiple | ✅ **ZERO** |
| Parser Generator | ❌ External (Jison) | ✅ **Built-in (solar.rip)** |
| Self-Hosting | ❌ No | ✅ **Yes** |
| Modules | CommonJS | ✅ ES6 native |
| Classes | ES5 functions | ✅ ES6 classes |
| Maintenance | Complex AST | ✅ Simple sexps |
| Extensibility | Hard | ✅ Easy (add a case) |

### vs TypeScript

**TypeScript:** Type safety, large ecosystem
**Rip:** Simplicity, elegance, easy to extend

**Use TypeScript when:** You need types, big team, enterprise
**Use Rip when:** You value elegance, simple tooling, small projects

---

## Current Status

**Version:** 1.0.0 - **STABLE RELEASE!** 🎉

**⚡ NEW: DUAL SYNTAX SUPPORT - CoffeeScript Compatibility!**

Now supports both ES6 and CoffeeScript syntax:
- ✅ **Postfix spread/rest:** `args...` or `...args` (both work!)
- ✅ **Legacy existential:** `x ? y` or `x ?? y` (both work!)
- ✅ **Dual optional:** `x?.y` and `x?[y]` (both work!)

**Implemented:**
- ✅ Core architecture (lexer + parser + codegen pipeline)
- ✅ Test infrastructure (test/code/fail helpers, async support)
- ✅ **Code generator - 100% COMPLETE!** (110+ node types, all features working)
- ✅ **843/843 tests passing (100%)** - PERFECT SCORE!
- ✅ **Dual syntax support** - ES6 + CoffeeScript compatibility
- ✅ **Dammit operator (`!`)** - `fetchData!` → `await fetchData()`
- ✅ Comprehensive documentation (production ready)
- ✅ **Self-hosting** - Rip compiles itself!

**Test Results:**
- **Rip tests: 843/843 (100%)** ✅ **PERFECT SCORE!**
- **Compatibility: 45 tests** (postfix spread/rest + legacy existential)
- **Guards: 27 tests** (when clauses + own keyword)
- **Stabilization: 67 tests** (advanced patterns + 13 bootstrap bug tests)
- **Functions: 71 tests** (including 10 void function tests)
- **Total: 843 tests passing** (100% - every test passes!)
- All test files organized (20 files, alphabetically sorted)
- Zero redundant tests
- **All node types implemented with test coverage** (100% of grammar!)
- **New:** Dammit operator (call and await at call-site)
- **New:** Void functions (side-effect only with ! at definition)
- **New:** Smart comprehension optimization (context-aware)
- **New:** Range loop optimization (73% smaller code)
- **New:** Reverse iteration support (by -1)
- **New:** Self-hosting complete (Rip compiles itself!)

**Key Features:**
- ✅ **ZERO Dependencies** - Completely standalone, self-hosting compiler
- ✅ **Parser Generator Included** - Full SLR(1) parser generator (solar.rip) built-in
- ✅ **Triple REPL Support** - Terminal (`./bin/rip`), Browser (repl.html), Console (`rip()`)
- ✅ **Browser Bundle** - 43KB brotli-compressed (560KB → 43KB, 92% reduction!)
- ✅ **Dammit Operator (`!`)** - Call and await shorthand: `fetchData!` → `await fetchData()`
- ✅ **Void Functions (`!`)** - Side-effect only: `def process!` → no implicit returns
- ✅ **Heregex** - Extended regex with comments/whitespace (`///...///`)
- ✅ **Ruby-style Regex** - `=~` operator and `x[/pattern/, n]` indexing
- ✅ **__DATA__ Marker** - Ruby-inspired inline data sections
- ✅ **toSearchable()** - Universal type coercion utility with security
- ✅ Dual optional syntax (CoffeeScript soak + ES6 optional chaining) - 10 operators!
- ✅ Complete ES6 modules with smart defaults
- ✅ Async/await auto-detection (including for-await)
- ✅ Generator auto-detection
- ✅ Tagged template literals
- ✅ Catch destructuring
- ✅ Expansion markers
- ✅ Heredoc strings (triple-quoted with dedenting)
- ✅ Quote preservation
- ✅ Per-function variable scoping
- ✅ And 75+ more features!

**Roadmap:**
- ✅ v0.1.0: **COMPLETE** - All 63 node types, 82% tests
- ✅ v0.2.0: **COMPLETE** - 100% Rip coverage, 79% CS2
- ✅ v0.3.0: **COMPLETE** - 90%+ CS2 compatibility, ES2022 target!
- ✅ v0.3.3: **COMPLETE** - CS2 migration complete, 666 comprehensive tests, perfect organization!
- ✅ v0.3.4: **COMPLETE** - Dammit operator (`!`), call-and-await shorthand!
- ✅ v0.5.0: **COMPLETE** - Dual syntax support! Postfix spread/rest (`x...`) + legacy existential (`x ? y`)!
- ✅ v0.5.1: **COMPLETE** - Smart comprehensions! Context-aware optimization, self-hosting, 843/843 tests!
- ✅ v0.9.0: **COMPLETE** - Production release! Zero dependencies, complete documentation, 43KB browser bundle!
- ✅ v1.0.0: **CURRENT** - Initial release! Ready and 25% smaller than CoffeeScript! 🎉

See [CHANGELOG.md](CHANGELOG.md) for detailed progress.

---

## Contributing

We're building this clean-room style! Check out:
- [AGENT.md](AGENT.md) - For AI agents/developers
- [docs/CODEGEN.md](docs/CODEGEN.md) - Pattern reference
- [docs/COMPREHENSIONS.md](docs/COMPREHENSIONS.md) - Comprehension context specification
- [docs/](docs/) - Complete documentation library

### Development Workflow

1. Pick a pattern to implement
2. Check parser output with `-s` flag
3. Implement in `src/codegen.js`
4. Write tests in `test/rip/`
5. Document in `docs/CODEGEN.md`
6. Commit!

---

## License

MIT

---

## Note 🤖

*Some of the promotional language in this README was generated with AI assistance and may be... "enthusiastic". The code, tests, and technical claims are real and verifiable. If anything sounds too good to be true, please check the actual implementation—it's all there in the source. This is a practical tool, not a crusade. :)*

---

## Credits

**Inspired by:**
- CoffeeScript (syntax and lexer)
- Lisp/Scheme (s-expressions)
- Solar (parser generator)
- Ruby (regex operators, __DATA__ marker)

**Built by:** Developers who believe simplicity scales

**Powered by:** [Bun](https://bun.sh) - The fast all-in-one JavaScript runtime

---

**Start simple. Build incrementally. Ship elegantly.** ✨
