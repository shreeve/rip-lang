<p align="center">
  <img src="docs/rip-1280w.png" alt="Rip Logo" width="400">
</p>

<h1 align="center">Rip</h1>

<p align="center">
  <strong>A modern language that compiles to JavaScript</strong>
</p>

<p align="center">
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-3.1.0-blue.svg" alt="Version"></a>
  <a href="#zero-dependencies"><img src="https://img.shields.io/badge/dependencies-ZERO-brightgreen.svg" alt="Dependencies"></a>
  <a href="#"><img src="https://img.shields.io/badge/tests-1073%2F1073-brightgreen.svg" alt="Tests"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"></a>
</p>

---

Rip is a modern language inspired by CoffeeScript. It compiles to **ES2022** (classes, `?.`, `??`, modules), adds about a **dozen new operators**, includes **built-in reactivity**, and sports a self-hosting compiler with **zero dependencies** — all in about 7,700 lines of code.

> **No imports. No hooks. No dependency arrays. Just write code.**

```coffee
data = fetchUsers!                  # Dammit operator (call + await)
user = User.new name: "Alice"       # Ruby-style constructor
squares = (x * x for x in [1..10])  # List comprehension

str =~ /Hello, (\w+)/               # Regex match
log "Found: #{_[1]}"                # Captures in _[1], _[2], etc.

get '/users/:id' ->                 # RESTful API endpoint, comma-less
  name = read 'name', 'string!'     # Required string
  age  = read 'age' , [0, 105]      # Simple numeric validation
```

---

**What makes Rip different:**
- **Modern output** — ES2022 with native classes, `?.`, `??`, modules
- **New operators** — `!`, `!?`, `//`, `%%`, `=~`, `.new()`, and more
- **Reactive operators** — `:=`, `~=`, `~>` as language syntax
- **Zero dependencies** — everything included, even the parser generator
- **Self-hosting** — `bun run parser` rebuilds the compiler from source

---

## Installation

```bash
bun add -g rip-lang            # Install globally
```

```bash
rip                            # Interactive REPL
rip file.rip                   # Run a file
rip -c file.rip                # Compile to JavaScript
```

---

## Language

### Functions & Classes

```coffee
def greet(name)                # Named function
  "Hello, #{name}!"

add = (a, b) -> a + b          # Arrow function
handler = (e) => @process e    # Fat arrow (preserves this)

class Dog extends Animal
  speak: -> log "#{@name} barks"

dog = Dog.new("Buddy")         # Ruby-style constructor
```

### String Interpolation

```coffee
"Hello, #{name}!"              # CoffeeScript-style
"Hello, ${name}!"              # JavaScript-style
"#{a} + #{b} = #{a + b}"      # Expressions work in both
```

Both `#{}` and `${}` compile to JavaScript template literals. Use whichever you prefer.

### Destructuring & Comprehensions

```coffee
{name, age} = person
[first, ...rest] = items

squares = (x * x for x in [1..10])   # Array comprehension
console.log x for x in items         # Loop (no array)
```

### Async & Chaining

```coffee
def loadUser(id)
  response = await fetch "/api/#{id}"
  await response.json()

user?.profile?.name            # Optional chaining
data = fetchData!              # Await shorthand
```

### Iteration

```coffee
for item in [1, 2, 3]         # Array iteration (for-in)
  console.log item

for key, value of object       # Object iteration (for-of)
  console.log "#{key}: #{value}"

for x as iterable              # ES6 for-of on any iterable
  console.log x

for x as! asyncIterable        # Async iteration shorthand
  console.log x                # Equivalent to: for await x as asyncIterable
```

### Reactivity

State, computed values, and effects as language operators:

| Operator | Mnemonic | Example | What it does |
|----------|----------|---------|--------------|
| `=` | "gets value" | `x = 5` | Regular assignment |
| `:=` | "has state" | `count := 0` | Reactive state container |
| `~=` | "always equals" | `twice ~= count * 2` | Auto-updates on changes |
| `~>` | "reacts to" | `~> log count` | Runs on dependency changes |
| `=!` | "equals, dammit!" | `MAX =! 100` | Readonly constant |

---

## Operators

| Operator | Example | What it does |
|----------|---------|--------------|
| `!` (dammit) | `fetchData!` | Calls AND awaits |
| `!` (void) | `def process!` | Suppresses implicit return |
| `!?` (otherwise) | `val !? 5` | Default only if `undefined` |
| `?` (existence) | `x?` | True if `x != null` |
| `?:` (ternary) | `x > 0 ? 'yes' : 'no'` | JS-style ternary expression |
| `?.` `?.[]` `?.()` | `a?.b` `a?.[0]` `a?.()` | Optional chaining (ES6) |
| `?[]` `?()` | `a?[0]` `a?(x)` | Optional chaining shorthand |
| `??` | `a ?? b` | Nullish coalescing |
| `...` (spread) | `[...items, last]` | Prefix spread (ES6) |
| `//` | `7 // 2` | Floor division |
| `%%` | `-1 %% 3` | True modulo |
| `=~` | `str =~ /Hello, (\w+)/` | Match (captures in `_`) |
| `[//, n]` | `str[/Hello, (\w+)/, 1]` | Extract capture n |
| `.new()` | `Dog.new()` | Ruby-style constructor |
| `or return` | `x = get() or return err` | Guard clause (Ruby-style) |
| `?? throw` | `x = get() ?? throw err` | Nullish guard |

### Heredoc & Heregex

**Heredoc** — The closing `'''` or `"""` position defines the left margin. All content is dedented relative to the column where the closing delimiter sits:

```coffee
html = '''
    <div>
      <p>Hello</p>
    </div>
    '''
# Closing ''' at column 4 (same as content) — no leading whitespace
# Result: "<div>\n  <p>Hello</p>\n</div>"

html = '''
    <div>
      <p>Hello</p>
    </div>
  '''
# Closing ''' at column 2 — 2 spaces of leading whitespace preserved
# Result: "  <div>\n    <p>Hello</p>\n  </div>"
```

**Heregex** — Extended regex with comments and whitespace:

```coffee
pattern = ///
  ^(\d{3})    # area code
  -(\d{4})    # number
///
```

---

## vs React / Vue / Solid

| Concept | React | Vue | Solid | Rip |
|---------|-------|-----|-------|-----|
| State | `useState()` | `ref()` | `createSignal()` | `x := 0` |
| Computed | `useMemo()` | `computed()` | `createMemo()` | `x ~= y * 2` |
| Effect | `useEffect()` | `watch()` | `createEffect()` | `~> body` |

Rip's reactivity is framework-agnostic — use it with React, Vue, Svelte, or vanilla JS.

---

## Rip UI

Ship the 35KB Rip compiler to the browser. Components are `.rip` source files, compiled on demand, rendered with fine-grained reactivity. No build step. No bundler.

```coffee
Counter = component
  @count := 0

  render
    div.counter
      h1 "Count: #{@count}"
      button @click: (-> @count++), "+"
      button @click: (-> @count--), "-"
```

Two keywords — `component` and `render` — are all the language adds. Everything else (`:=` state, `~=` computed, methods, lifecycle) is standard Rip.

See [@rip-lang/ui](packages/ui/) for the full framework: Virtual File System, file-based router, reactive stash, and component renderer.

---

## vs CoffeeScript

| Feature | CoffeeScript | Rip |
|---------|--------------|-----|
| **Output** | ES5 (var, prototypes) | ES2022 (classes, `?.`, `??`) |
| **Reactivity** | None | Built-in |
| **Dependencies** | Multiple | Zero |
| **Self-hosting** | No | Yes |
| **Lexer** | 3,558 LOC | 1,542 LOC |
| **Compiler** | 10,346 LOC | 3,148 LOC |
| **Total** | 17,760 LOC | ~7,700 LOC |

Smaller codebase, modern output, built-in reactivity.

---

## Browser

Run Rip directly in the browser:

```html
<script src="https://shreeve.github.io/rip-lang/docs/dist/rip.browser.min.js"></script>
<script type="text/rip">
  def greet(name)
    console.log "Hello, #{name}!"
  greet "World"
</script>
```

**Try it live:** [shreeve.github.io/rip-lang](https://shreeve.github.io/rip-lang/)

---

## Architecture

```
Source  ->  Lexer  ->  Parser  ->  S-Expressions  ->  Codegen  ->  JavaScript
           (1,542)    (352)       ["=", "x", 42]     (3,148)
```

Simple arrays instead of AST node classes. The compiler is self-hosting — `bun run parser` rebuilds from source.

| Component | File | Lines |
|-----------|------|-------|
| Lexer + Rewriter | `src/lexer.js` | 1,542 |
| Compiler + Codegen | `src/compiler.js` | 3,148 |
| Parser (generated) | `src/parser.js` | 352 |
| Grammar | `src/grammar/grammar.rip` | 887 |
| Parser Generator | `src/grammar/solar.rip` | 1,001 |
| REPL | `src/repl.js` | 654 |
| Browser Entry | `src/browser.js` | 79 |
| **Total** | | **7,663** |

---

## The Rip Stack

Rip includes optional packages for full-stack development:

| Package | Purpose | Lines |
|---------|---------|-------|
| [@rip-lang/ui](packages/ui/) | Zero-build reactive web framework (VFS, router, components) | ~1,300 |
| [@rip-lang/api](packages/api/) | HTTP framework (Sinatra-style routing, 37 validators) | ~1,050 |
| [@rip-lang/server](packages/server/) | Multi-worker app server (hot reload, HTTPS, mDNS) | ~1,210 |
| [@rip-lang/db](packages/db/) | DuckDB server with official UI (pure Bun FFI) | ~1,740 |

```bash
bun add -g @rip-lang/db    # Installs everything (rip-lang + api + db)
```

---

## Implicit Commas

Rip rescues what would be invalid syntax and gives it elegant meaning. When a literal value is followed directly by an arrow function, Rip inserts the comma for you:

```coffee
# Clean route handlers (no comma needed!)
get '/users' -> User.all!
get '/users/:id' -> User.find params.id
post '/users' -> User.create body

# Works with all literal types
handle 404 -> { error: 'Not found' }
match /^\/api/ -> { version: 'v1' }
check true -> enable()
```

This works because `'/users' ->` was previously a syntax error — there's no valid interpretation. Rip detects this pattern and transforms it into `'/users', ->`, giving dead syntax a beautiful new life.

**Supported literals:** strings, numbers, regex, booleans, null, undefined, arrays, objects

---

## Quick Reference

```bash
rip                    # REPL
rip file.rip           # Run
rip -c file.rip        # Compile
rip -t file.rip        # Tokens
rip -s file.rip        # S-expressions
bun run test           # 1073 tests
bun run parser         # Rebuild parser
bun run browser        # Build browser bundle
```

---

## Documentation

| Guide | Description |
|-------|-------------|
| [docs/RIP-LANG.md](docs/RIP-LANG.md) | Language reference |
| [docs/RIP-REACTIVITY.md](docs/RIP-REACTIVITY.md) | Reactivity deep dive |
| [docs/RIP-INTERNALS.md](docs/RIP-INTERNALS.md) | Compiler internals |
| [packages/](packages/README.md) | Full-stack packages |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |

---

## Zero Dependencies

```json
{ "dependencies": {} }
```

Everything included: compiler, parser generator, REPL, browser bundle, test framework.

---

## Philosophy

> *Simplicity scales.*

Simple IR (S-expressions), clear pipeline (lex -> parse -> generate), minimal code, comprehensive tests.

---

**Inspired by:** CoffeeScript, Lisp, Ruby | **Powered by:** [Bun](https://bun.sh)

MIT License

<p align="center"><strong>Start simple. Build incrementally. Ship elegantly.</strong></p>
