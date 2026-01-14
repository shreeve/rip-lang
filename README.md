<p align="center">
  <img src="docs/rip-1280w.png" alt="Rip Logo" width="400">
</p>

<h1 align="center">Rip</h1>

<p align="center">
  <strong>Elegant reactive language that compiles to modern JavaScript</strong>
</p>

<p align="center">
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-1.5.7-blue.svg" alt="Version"></a>
  <a href="#zero-dependencies"><img src="https://img.shields.io/badge/dependencies-ZERO-brightgreen.svg" alt="Dependencies"></a>
  <a href="#status"><img src="https://img.shields.io/badge/tests-968%2F968-brightgreen.svg" alt="Tests"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"></a>
</p>

---

## What is Rip?

A clean-room **CoffeeScript-inspired compiler** that produces modern JavaScript (ES2022). Built from scratch with an elegant S-expression architecture.

**Key differentiators:**
- 🎯 **Zero dependencies** - Completely standalone (includes its own parser generator)
- 🚀 **Self-hosting** - Rip compiles itself (`bun run parser` works!)
- ⚡ **~50% smaller** than CoffeeScript (9,839 LOC vs 17,760 LOC)
- 🎨 **Modern output** - ES2022 with classes, modules, optional chaining
- ✅ **Production-ready** - 968/968 tests passing (100%)

---

## Status

**Version 1.5.7** - **PRODUCTION READY** 🚀

**Quality metrics:**
- ✅ **968/968 tests passing** (100% coverage)
- ✅ **Self-hosting** - Rip compiles itself, including its own parser generator
- ✅ **Zero dependencies** - Completely standalone, no npm packages required
- ✅ **9,839 LOC** - Lean, maintainable codebase (~50% smaller than CoffeeScript)

**Complete feature set:**
- ✅ **110+ node types** - All language constructs fully implemented
- ✅ **Interactive REPL** - Terminal, browser, and console modes
- ✅ **Live playground** - Full-featured browser environment with code editor
- ✅ **43KB bundle** - Brotli-compressed, includes compiler + REPL

**Architecture strengths:**
- ✅ **Dispatch table** - O(1) lookup for all 110 operations
- ✅ **S-expression IR** - Simple, clean intermediate representation
- ✅ **Fast compilation** - ~200ms parser regeneration (self-hosting)
- ✅ **Modern output** - Clean ES2022 code generation

---

## Quick Example

```coffee
# Async with dammit operator! (call and await)
fetchUser = (id) => fetch! "/api/user/${id}"

# Ruby-style regex with =~ operator
def parseEmail(input)
  return unless input =~ /^(\w+)@([\w.]+)$/
  { user: _[1], domain: _[2] }  # _ captures match groups

# Otherwise operator (!?) - undefined-only coalescing
timeout = config.timeout !? 5000  # null/0/false are valid!

result = parseEmail "alice@example.com"
```

**Compiles to clean ES2022:**

```javascript
let _;

const fetchUser = async (id) => await fetch(`/api/user/${id}`);
function parseEmail(input) {
  if (!(_ = toSearchable(input).match(/^(\w+)@([\w.]+)$/))) return;
  return {user: _[1], domain: _[2]};
};
const timeout = (config.timeout !== undefined ? config.timeout : 5000);
const result = parseEmail("alice@example.com");
```

---

## Improvements Over CoffeeScript

Rip includes **all of CoffeeScript's beloved features** plus modern enhancements:

### Unique to Rip

| Feature | Syntax | Benefit |
|---------|--------|---------|
| **Dammit operator** | `fetchData!` → `await fetchData()` | Call and await in one |
| **Otherwise operator** | `val !? default` | Undefined-only coalescing (null/false/0 are valid) |
| **Void functions** | `def process!` | Suppress implicit returns |
| **Traditional ternary** | `x > 0 ? 'pos' : 'neg'` | JavaScript-style (plus CoffeeScript's if/then/else) |
| **Ruby-style regex** | `str =~ /pattern/`, `_[1]` | Match with capture, inline extraction |
| **Heregex** | `///pattern # comment///` | Extended regex (CoffeeScript deprecated it) |
| **Smart heredoc margins** | Closing `'''` column = left margin | Visual alignment - position delimiter to set baseline! |
| **10 optional operators** | `obj?.prop` + `arr?[0]` | Both ES6 and CoffeeScript styles work! |
| **__DATA__ marker** | `__DATA__\nconfig...` | Ruby-style inline data sections |

### Modern JavaScript Output

| Feature | CoffeeScript | Rip |
|---------|-------------|-----|
| **Classes** | ES5 prototypes | ES6 native classes |
| **Modules** | CommonJS | ES6 import/export |
| **Nullish operators** | `x ? y` | `x ?? y` and `??=` (ES2020) |
| **Optional chaining** | Transpiled soak | Native `?.` (ES2020) |
| **Spread syntax** | Postfix `args...` | Prefix `...args` (ES6) |

### Smarter Compilation

| Feature | CoffeeScript | Rip |
|---------|-------------|-----|
| **Comprehensions** | Always IIFE | Context-aware (plain loop when result unused) |
| **Async/generators** | Manual syntax | Auto-detected |
| **Switch statements** | `switch (false)` pattern | Clean if/else chains |

### Compatibility Features

**Both syntaxes work!** Rip auto-converts CoffeeScript style:
- `args...` → `...args` (prefix/postfix spread)
- `x ? y` → `x ?? y` (legacy existential, unless ternary)
- Seamless migration from CoffeeScript! 🎉

---

## Why Choose Rip?

### For Users
- ✅ **Elegant syntax** - CoffeeScript's readability without the quirks
- ✅ **Modern output** - ES2022 with native classes, modules, optional chaining
- ✅ **Zero complexity** - No build tools, no dependency hell
- ✅ **Unique features** - Dammit operator, otherwise operator, Ruby regex
- ✅ **Browser ready** - 43KB bundle with REPL included

### For Developers
- ✅ **Simple architecture** - S-expressions beat complex AST classes
- ✅ **Easy to extend** - Add a case, run tests, done!
- ✅ **Well-tested** - 968/968 tests (100% coverage)
- ✅ **Well-documented** - Complete guides (AGENT.md is gold!)
- ✅ **Self-hosting** - Rip compiles itself (including parser generator)

### Philosophy

> **Simplicity scales.**
>
> Keep the IR simple (s-expressions), keep the pipeline clear (lex → parse → generate), keep the code minimal (pattern matching). Test everything.

### vs Other Frameworks

The modern web is drowning in complexity. Rip offers a different path: **the language IS the framework**.

| Feature | Rip | React | Svelte | Vue |
|---------|-----|-------|--------|-----|
| **Bundle size** | ~47KB | ~140KB | ~2KB* | ~34KB* |
| **Build required** | No | Yes | Yes | Usually |
| **Reactivity** | Language-level | Library hooks | Compiler magic | Library refs |
| **Learning curve** | Rip syntax | Hooks rules | Svelte syntax | Options vs Composition |

*Svelte/Vue sizes are runtime only—they require build tools.

**Why Rip wins:**
- **vs React** — No hook rules, no build step, cleaner syntax
- **vs Svelte** — No build step required, runs directly in browser
- **vs Vue** — Language-level reactivity, not library-level

---

## Installation

### Option 1: Install Globally (Recommended)

```bash
# Install Bun if needed
curl -fsSL https://bun.sh/install | bash

# Install Rip
bun add -g rip-lang

# Start using it!
rip                    # Interactive REPL
rip yourfile.rip       # Compile a file
bun yourfile.rip       # Execute directly
```

### Option 2: Clone from Source

```bash
git clone https://github.com/shreeve/rip-lang.git
cd rip-lang

# Link globally
bun link

# Add to global Bun config
echo 'preload = ["rip-lang/loader"]' >> ~/.bunfig.toml

# Run .rip files from anywhere
bun your-script.rip
```

---

## Quick Start

```bash
# Run code
./bin/rip                                  # Interactive REPL
./bin/rip examples/fibonacci.rip           # Execute file
bun examples/fibonacci.rip                 # Direct execution (with loader)

# Compile
./bin/rip -c examples/fibonacci.rip        # Output JavaScript
./bin/rip -o output.js input.rip           # Save to file

# Debug / Inspect
./bin/rip -s input.rip                     # Show s-expressions (parser output)
./bin/rip -t input.rip                     # Show tokens (lexer output)
./bin/rip -s -c input.rip                  # Show both
echo 'x = 42' | ./bin/rip -s               # Pipe from stdin

# Build
bun run parser                             # Rebuild parser (self-hosting!)
bun run browser                            # Build browser bundle
bun run test                               # Run all 968 tests
```

---

## Key Features

### Elegant Syntax

```coffee
# Functions (three styles)
def greet(name)              # Named, hoisted
  "Hello, ${name}!"

calculate = (a, b) ->        # Thin arrow (unbound this)
  a + b

handler = (event) =>         # Fat arrow (bound this)
  @process event

# Comprehensions (context-aware!)
squares = (x * x for x in [1..10])     # IIFE (result used)

processItem x for x in items           # Plain loop (result unused)
```

### Modern JavaScript Features

```coffee
# Destructuring
{name, age} = person
[first, ...rest] = array

# Optional chaining (dual syntax)
user?.profile?.name          # ES6 native
arr?[0]                      # CoffeeScript soak
fn?(arg)                     # Soak call

# Nullish coalescing
port = config.port ?? 8080

# Async/await auto-detection
def fetchData
  data = await fetch "/api/data"
  data.json()
# → async function fetchData() { ... }
```

### Unique Features

```coffee
# Dammit operator! - Call and await
result = fetchData!         # → await fetchData()
user = getUser!(id)         # → await getUser(id)

# Otherwise operator (!?) - Undefined-only coalescing
timeout = config.timeout !? 5000   # null/0/false are valid!
name = user.name !? 'Guest'        # Only defaults on undefined

# Void functions - No implicit returns
def process!                # Always returns undefined
  doWork()
  # No return value

# Ruby-style regex
email =~ /(.+)@(.+)/              # Match with _ capture
username = _[1]                   # Extract first group
domain = email[/@(.+)/, 1]        # Inline extraction (group 1)
suffix = name[/,\s*([js]r|i{1,3})\b/, 1]  # Complex pattern extraction

# Heregex - Extended regex with comments
pattern = ///
  ^ \d+      # starts with digits
  \s*        # optional whitespace
  [a-z]+     # followed by letters
  $
///i

# Heredocs - Smart visual indentation control
# When closing ''' or """ is preceded only by whitespace,
# its column position becomes the "left margin" for all content.
# This makes it easy to visually align content!

code = '''
  if (x) {
    return y;
  }
  '''                        # Closing at column 2 → strips 2 spaces from all lines
# Output: "if (x) {\n  return y;\n}"

code = '''
  if (x) {
    return y;
  }
'''                          # Closing at column 0 → preserves all indentation
# Output: "  if (x) {\n    return y;\n  }"

# Perfect for code generation - align the closing delimiter where you want!
template = """
    function ${name}() {
      console.log("${message}");
    }
    """                      # Closing at column 4 → baseline is column 4
# Output: "function ${name}() {\n  console.log(\"${message}\");\n}"

# Traditional ternary (plus CoffeeScript's if/then/else)
result = x > 0 ? 'positive' : 'negative'

# __DATA__ marker (Ruby-inspired)
config = parseConfig(DATA)

__DATA__
host=localhost
port=8080
```

---

## Why S-Expressions?

Traditional compilers use complex AST classes. Rip uses **simple arrays**:

```
Rip Source → Lexer → Parser → S-Expressions → Codegen → JavaScript
            (3,145)  (340)    ["=", "x", 42]  (5,246)    (ES2022)
```

**Traditional AST approach:**
```javascript
class BinaryOp {
  constructor(op, left, right) { ... }
  compile() { /* 50+ lines */ }
}
```

**Rip's S-expression approach:**
```javascript
case '+': {
  const [left, right] = rest;
  return `(${this.generate(left)} + ${this.generate(right)})`;
}
```

**Result: ~50% smaller compiler**

| Component | CoffeeScript | Rip | Savings |
|-----------|--------------|-----|---------|
| Lexer+Rewriter | 3,558 LOC | **3,145 LOC** | -11% |
| Parser Generator | 2,285 LOC (Jison) | **928 LOC** (Solar, built-in) | -59% |
| Compiler | 10,346 LOC (AST) | **5,246 LOC** (S-expr) | -49% |
| **Total** | **17,760 LOC** | **9,839 LOC** | **-45%** |

---

## Zero Dependencies

**Rip is completely standalone** - no runtime or build dependencies:

```json
{
  "dependencies": {}    // ← Empty!
}
```

**What's included:**
- ✅ Full compiler (lexer, parser, codegen)
- ✅ Parser generator (solar.rip - SLR(1))
- ✅ Triple REPL (terminal, browser, console)
- ✅ Browser bundle (43KB compressed)
- ✅ Test framework

**Self-hosting verification:**
```bash
bun run parser    # Rebuilds parser from scratch (solar.rip + grammar.rip)
# Complete bootstrap loop - ZERO external tools! ✅
```

---

## Browser Support

**Run Rip in the browser!** Try it live: **[https://shreeve.github.io/rip-lang/](https://shreeve.github.io/rip-lang/)**

```bash
# Build browser bundle
bun run browser

# Start dev server
bun run serve       # → http://localhost:3000
```

**Features:**
- 43KB bundle (brotli-compressed)
- Interactive REPL console
- Live compiler with syntax highlighting
- Inline `<script type="text/rip">` support

```html
<script src="https://cdn.example.com/rip.browser.min.js"></script>
<script type="text/rip">
  def greet(name)
    console.log "Hello, ${name}!"
  greet "World"
</script>
```

See [docs/BROWSER.md](docs/BROWSER.md) for details.

---

## Runtime Compatibility

**Primary targets:**
- 🎯 **Bun** - First-class support with automatic `.rip` loader
- 🌐 **Browsers** - 43KB bundle with REPL

**Also supported:**
- ✅ **Deno** - ES2022 output works natively
- ✅ **Node.js 12+** - Full compatibility

**ES2022 features used:**
- ES2015: classes, let/const, arrow functions, template literals, destructuring
- ES2018: async iteration (for await...of)
- ES2020: optional chaining (`?.`), nullish coalescing (`??`)
- ES2022: static class fields, top-level await

---

## Documentation

**For users:**
- [README.md](README.md) - This file (overview and quick start)
- [docs/examples/](docs/examples/) - Example programs
- [CHANGELOG.md](CHANGELOG.md) - Version history

**Technical references:**
- [AGENT.md](AGENT.md) - **Complete developer/AI agent guide** (start here!)
- [docs/CODEGEN.md](docs/CODEGEN.md) - All 110+ node types
- [docs/COMPREHENSIONS.md](docs/COMPREHENSIONS.md) - Context-aware comprehension rules
- [docs/SOLAR.md](docs/SOLAR.md) - Parser generator guide
- [docs/STRING.md](docs/STRING.md) - String metadata reference
- [docs/REGEX-PLUS.md](docs/REGEX-PLUS.md) - Ruby-style regex features
- [docs/BROWSER.md](docs/BROWSER.md) - Browser usage & REPLs

**For contributors:**
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development workflow
- [docs/WORKFLOW.md](docs/WORKFLOW.md) - Command reference


---

## Development

### Running Tests

```bash
# All tests
bun run test

# Specific file
bun test/runner.js test/rip/functions.rip

# Clear cache
bun --no-cache test/runner.js test/rip
```

### Build Commands

```bash
bun run parser    # Rebuild parser from grammar (self-hosting!)
bun run browser   # Build 43KB browser bundle
bun run serve     # Start dev server (REPL at localhost:3000)
```

### Project Structure

```
rip/
├── src/
│   ├── lexer.js         # CoffeeScript lexer (adapted)
│   ├── parser.js        # Solar parser (generated)
│   ├── codegen.js       # Code generator (S-expression dispatch)
│   ├── compiler.js      # Pipeline orchestration
│   └── grammar/
│       ├── grammar.rip  # Grammar specification
│       └── solar.rip    # Parser generator
├── docs/                # Complete documentation
├── test/rip/            # 23 test files, 968 tests
├── AGENT.md             # Complete developer guide
└── README.md            # This file
```

### Contributing

1. Read [AGENT.md](AGENT.md) - Complete guide for developers and AI agents
2. Check [CONTRIBUTING.md](CONTRIBUTING.md) - Workflow with examples
3. Write tests first (test-driven development)
4. Run `bun run test` before committing
5. Follow existing patterns in [docs/CODEGEN.md](docs/CODEGEN.md)

**Quick workflow:**
```bash
# 1. Check what parser emits
echo 'your code' | ./bin/rip -s

# 2. Implement in src/codegen.js (check dispatch table)
# 3. Write tests in test/rip/

# 4. Run tests
bun test/runner.js test/rip/your-test.rip

# 5. Verify all tests pass
bun run test
```

---

## Comparison to CoffeeScript

| Feature | CoffeeScript | Rip |
|---------|-------------|------|
| **Implementation** | 17,760 LOC | **9,839 LOC (~50% smaller)** |
| **Dependencies** | Multiple | **ZERO** |
| **Parser Generator** | External (Jison) | **Built-in (solar.rip)** |
| **Self-Hosting** | No | **Yes** |
| **Output** | ES5 (var, prototypes) | **ES2022 (let, classes)** |
| **Modules** | CommonJS | **ES6** |
| **Maintenance** | Complex AST | **Simple S-expressions** |

**Real-world output comparison:**

Compiling a 400-line CoffeeScript file with classes, nested switches, and loops:

| Metric | CoffeeScript | Rip |
|--------|--------------|-----|
| Lines of code | 608 lines | **304 lines (50% smaller)** |
| Syntax | ES5 (var, prototypes) | **ES2022 (let, classes)** |
| Readability | Verbose with intermediate vars | **Clean and direct** |

**Both are functionally equivalent** - Rip just generates cleaner code!


---

## License

MIT

---

## Credits

**Inspired by:**
- **CoffeeScript** - Syntax and lexer foundation
- **Lisp/Scheme** - S-expression approach
- **Solar** - Lightning-fast parser generator (80ms vs Jison's 12.5s!)
- **Ruby** - Regex operators, __DATA__ marker

**Built by:** Developers who believe simplicity scales

**Powered by:** [Bun](https://bun.sh) - The fast all-in-one JavaScript runtime

---

**Start simple. Build incrementally. Ship elegantly.** ✨
