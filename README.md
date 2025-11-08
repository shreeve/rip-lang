<p align="center">
  <img src="docs/rip-1280w.png" alt="Rip Logo" width="400">
</p>

<h1 align="center">Rip</h1>

<p align="center">
  <strong>Elegant CoffeeScript-inspired language → Modern JavaScript (ES2022)</strong>
</p>

<p align="center">
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-1.4.3-blue.svg" alt="Version"></a>
  <a href="#zero-dependencies"><img src="https://img.shields.io/badge/dependencies-ZERO-brightgreen.svg" alt="Dependencies"></a>
  <a href="#status"><img src="https://img.shields.io/badge/tests-938%2F938-brightgreen.svg" alt="Tests"></a>
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
- ✅ **Production-ready** - 938/938 tests passing (100%)

---

## Quick Example

```coffee
# Async with dammit operator! (call and await)
fetchUser = (id) => fetch! "/api/user/${id}"

# Ruby-style regex with =~ operator
def parseEmail(input)
  return unless input =~ /^(\w+)@([\w.]+)$/
  { user: _[1], domain: _[2] }  # _ captures match groups

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
const result = parseEmail("alice@example.com");
```

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
# Interactive REPL
./bin/rip

# Execute a file
./bin/rip examples/fibonacci.rip

# Compile to JavaScript
./bin/rip -c examples/fibonacci.rip

# Save to file
./bin/rip -o output.js examples/fibonacci.rip

# Debug flags (mix and match!)
./bin/rip -s examples/fibonacci.rip        # Show s-expressions
./bin/rip -t examples/fibonacci.rip        # Show tokens
./bin/rip -s -c examples/fibonacci.rip     # Show both
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

# Void functions - No implicit returns
def process!                # Always returns undefined
  doWork()
  # No return value

# Ruby-style regex
email =~ /(.+)@(.+)/        # Match with _ capture
username = _[1]             # Extract first group
domain = email[/@(.+)/, 1]  # Inline extraction

# Heregex - Extended regex with comments
pattern = ///
  ^ \d+      # starts with digits
  \s*        # optional whitespace
  [a-z]+     # followed by letters
  $
///i

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
Source → Tokens → S-Expressions → JavaScript
                  ["=", "x", 42]
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

| Component | CoffeeScript | Rip |
|-----------|--------------|-----|
| Lexer+Rewriter | 3,558 LOC | **3,145 LOC** |
| Parser Generator | 2,285 LOC (Jison) | **928 LOC** (Solar, built-in) |
| Compiler | 10,346 LOC (AST) | **5,246 LOC** (S-expr) |
| **Total** | **17,760 LOC** | **9,839 LOC** |

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

## Status

**Version:** 1.4.3 - **PRODUCTION READY** 🎉

**Test results:**
- ✅ 938/938 tests passing (100%)
- ✅ Self-hosting operational
- ✅ All 110 node types implemented
- ✅ Browser bundle working

**Recent accomplishments (Nov 2025):**
- ✅ Dispatch table refactoring - All 110 operations use O(1) lookup
- ✅ Code cleanup - Removed 2,017 lines of dead code (28% reduction)
- ✅ Self-hosting restored - Fixed 'in' operator edge case
- ✅ S-expression approach - IR-level transforms, not string manipulation

**Roadmap:**
- ✅ v1.0.0 - Initial release
- ✅ v1.4.3 - **CURRENT** - Production-ready, self-hosting
- 🔜 Continuous refinement based on community feedback

See [CHANGELOG.md](CHANGELOG.md) for detailed history.

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
├── test/rip/            # 23 test files, 938 tests
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

## Why Rip?

**For users:**
- ✅ Elegant syntax without verbosity
- ✅ Modern JavaScript output
- ✅ Zero build tool complexity
- ✅ Browser support included

**For developers:**
- ✅ Simple architecture (S-expressions)
- ✅ Easy to extend (add a case!)
- ✅ Well-tested (938 tests)
- ✅ Well-documented (see AGENT.md)

**Philosophy:**
> Simplicity scales. Keep the IR simple (s-expressions), keep the pipeline clear (lex → parse → generate), keep the code minimal (pattern matching).

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
