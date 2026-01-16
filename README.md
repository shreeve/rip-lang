<p align="center">
  <img src="docs/rip-1280w.png" alt="Rip Logo" width="400">
</p>

<h1 align="center">Rip</h1>

<p align="center">
  <strong>Elegant reactive code that compiles to modern JavaScript</strong>
</p>

<p align="center">
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-2.2.5-blue.svg" alt="Version"></a>
  <a href="#zero-dependencies"><img src="https://img.shields.io/badge/dependencies-ZERO-brightgreen.svg" alt="Dependencies"></a>
  <a href="#"><img src="https://img.shields.io/badge/tests-1046%2F1046-brightgreen.svg" alt="Tests"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"></a>
</p>

---

## What is Rip?

Rip is a modern reactive language that compiles to JavaScript. It takes the elegant, readable syntax that made CoffeeScript beloved and brings it into the modern era — with ES2022 output, built-in reactivity, and a clean component system for building UIs.

The compiler is completely standalone with zero dependencies, and it's self-hosting: Rip compiles itself. At ~10,000 lines of code, it's half the size of CoffeeScript while producing cleaner, more modern output.

**What makes Rip different:**
- **Reactive primitives** — signals, derived values, and effects built into the language
- **Modern output** — ES2022 with native classes, `?.`, `??`, modules
- **Zero dependencies** — everything included, even the parser generator
- **Self-hosting** — `bun run parser` rebuilds the compiler from source

---

## Installation

**Option 1: Install from npm**
```bash
curl -fsSL https://bun.sh/install | bash   # Install Bun (if needed)
bun add -g rip-lang
```

**Option 2: Clone from source**
```bash
git clone https://github.com/shreeve/rip-lang.git
cd rip-lang && bun link
```

**Then use it:**
```bash
rip                     # Interactive REPL
rip file.rip            # Run a file
rip -c file.rip         # Compile to JavaScript
bun file.rip            # Direct execution with Bun loader
```

---

## Language Features

### Functions & Classes
```coffee
# Three function styles
def greet(name)           # Named function (hoisted)
  "Hello, #{name}!"

add = (a, b) -> a + b     # Arrow function
handler = (e) => @process e   # Fat arrow (preserves this)

# Classes with clean syntax
class Animal
  constructor: (@name) ->
  speak: -> console.log "#{@name} makes a sound"

class Dog extends Animal
  speak: -> console.log "#{@name} barks"

# Ruby-style constructors (both styles work)
dog = Dog.new("Buddy")    # → new Dog("Buddy")
dog = new Dog("Buddy")    # Traditional JS style
```

### Destructuring & Comprehensions
```coffee
# Destructuring
{name, age} = person
[first, ...rest] = items

# Comprehensions (context-aware!)
squares = (x * x for x in [1..10])   # Returns array
console.log x for x in items         # Just loops (no array created)
```

### Async & Optional Chaining
```coffee
# Auto-async detection
def loadUser(id)
  response = await fetch "/api/users/#{id}"
  await response.json()

# Optional chaining (both styles work)
user?.profile?.name      # ES2020 native
arr?[0]                  # CoffeeScript soak
fn?(arg)                 # Safe call
```

---

## Unique Features

### New Operators & Syntax

| Feature | Example | What it does |
|---------|---------|--------------|
| **Ruby `.new()`** | `Counter.new()` | Ruby-style constructor → `new Counter()` |
| **Dammit `!`** | `fetchData!` | Calls the function AND awaits it |
| **Void `!`** | `def process!` | Suppresses implicit return (always returns undefined) |
| **Otherwise `!?`** | `val !? 5` | Defaults only if `undefined` (null/0/false are kept!) |
| **Floor div `//`** | `7 // 2` | Floor division → `Math.floor(7 / 2)` = 3 |
| **True mod `%%`** | `-1 %% 3` | True modulo (not remainder) → 2, not -1 |
| **Readonly `=!`** | `MAX =! 100` | Immutable constant (can't reassign) |
| **Ternary `?:`** | `x > 0 ? 'yes' : 'no'` | JS-style ternary (plus CoffeeScript's if/then/else) |
| **Dual optional** | `a?.b` and `a?[0]` | Both ES6 native and CoffeeScript soak styles |

### Regex Enhancements

| Feature | Example | What it does |
|---------|---------|--------------|
| **Match `=~`** | `str =~ /(\w+)/` | Ruby-style regex, captures in `_[1]` |
| **Regex index** | `str[/pat/, 1]` | Extract capture group directly |
| **Heregex** | `///pat # comment///` | Extended regex with comments and whitespace |

### Strings & Data

| Feature | Example | What it does |
|---------|---------|--------------|
| **Heredoc** | `'''` closing column | Smart indentation — closing position sets left margin |
| **`__DATA__`** | `__DATA__\nconfig...` | Ruby-style inline data section, accessible as `DATA` |

### Reactivity (Built-in)

| Feature | Example | What it does |
|---------|---------|--------------|
| **Signal `:=`** | `count := 0` | Creates reactive state container |
| **Derived `~=`** | `doubled ~= count * 2` | Auto-updates when dependencies change |
| **Effect** | `effect -> log x` | Runs whenever referenced signals change |

### Components & Templates

| Feature | Example | What it does |
|---------|---------|--------------|
| **Component** | `component Counter` | Define reactive UI component |
| **Render** | `render` block | Indentation-based HTML templates |
| **Props** | `@prop`, `@prop?`, `@prop = default` | Component input from parent |
| **Rest props** | `@...rest` | Capture remaining props |
| **Two-way bind** | `input value <=> name` | Bidirectional data binding |
| **Event handlers** | `@click: handler` | DOM event binding |
| **Lifecycle** | `mounted:`, `unmounted:` | Component lifecycle hooks |
| **Context API** | `setContext`, `getContext` | Pass data down component tree |
| **Fine-grained** | No virtual DOM | Surgical DOM updates via signals |

**→ 26 major enhancements over CoffeeScript!**

---

## Reactivity

Built into the language, not a library:

```coffee
# Signals hold reactive state
count := 0
name := "world"

# Derived values auto-update
doubled ~= count * 2
greeting ~= "Hello, #{name}!"

# Effects run when dependencies change
effect -> console.log greeting

name = "Rip"   # Effect runs → "Hello, Rip!"
count = 5      # Nothing (greeting doesn't depend on count)
```

[Full reactivity guide →](docs/REACTIVITY.md)

---

## Components

Build reactive UIs with fine-grained DOM updates:

```coffee
component Counter
  @label = "Count"
  count := 0
  inc: -> count += 1
  dec: -> count -= 1

  render
    div.counter
      h2 @label
      span.value count
      button @click: @inc, "+"
      button @click: @dec, "−"
```

**Event handlers** — two patterns:
```coffee
# Normal: define methods, reference with @
inc: -> count += 1
button @click: @inc, "+"

# Compact: inline with fat arrow (parens required)
button (@click: => @count++), "+"
```

**Features:**
- Props: `@prop`, `@prop?` (optional), `@prop = default`
- Lifecycle: `mounted:`, `unmounted:`
- Context API: `setContext`, `getContext`
- Fine-grained updates: only changed nodes update, no virtual DOM

[Component guide →](docs/COMPONENTS.md)

---

## Templates

Indentation-based HTML with CSS-style selectors:

```coffee
render
  div#app.container
    h1.title "Hello, #{name}!"
    input value: username, @input: updateName
    button.("btn", active && "primary") @click: submit
      "Submit"
    ul.items
      for item in items
        li key: item.id, item.name
```

- `div#id.class1.class2` — IDs and classes
- `@click: @handler` — Event handlers (method reference)
- `(@click: => @count++)` — Inline handlers (fat arrow, parens required)
- `.("class1", cond && "class2")` — Dynamic classes (Tailwind-friendly)
- `value <=> var` — Two-way binding

[Template guide →](docs/TEMPLATES.md)

---

## Browser Support

Run Rip directly in the browser (56KB compressed).

**Try it live:** [https://shreeve.github.io/rip-lang/](https://shreeve.github.io/rip-lang/)

```html
<script src="https://shreeve.github.io/rip-lang/docs/dist/rip.browser.min.js"></script>
<script type="text/rip">
  def greet(name)
    console.log "Hello, #{name}!"
  greet "World"
</script>
```

```bash
bun run browser    # Build the bundle
bun run serve      # Start dev server at localhost:3000
```

---

## Modernizing What CoffeeScript Started

CoffeeScript showed us beautiful syntax. Rip takes that vision further:

| | Rip | CoffeeScript |
|---|---|---|
| **Output** | ES2022 (classes, `?.`, `??`) | ES5 (var, prototypes) |
| **Reactivity** | Built-in | None |
| **Dependencies** | Zero | Multiple |
| **Self-hosting** | Yes (compiles itself) | No |
| **Codebase** | 9,839 LOC | 17,760 LOC |

---

## Why S-Expressions?

Traditional compilers use complex AST node classes. Rip uses simple arrays:

```
Source → Lexer → Parser → S-Expressions → Codegen → JavaScript
                          ["=", "x", 42]
```

**Traditional AST:**
```javascript
class BinaryOp {
  constructor(op, left, right) { ... }
  compile() { /* 50 lines */ }
}
```

**Rip's approach:**
```javascript
case '+': return `(${gen(left)} + ${gen(right)})`;
```

| Component | CoffeeScript | Rip |
|-----------|--------------|-----|
| Lexer | 3,558 LOC | 3,145 LOC |
| Parser Generator | 2,285 LOC (Jison) | 928 LOC (Solar) |
| Compiler | 10,346 LOC | 5,246 LOC |
| **Total** | **17,760 LOC** | **9,839 LOC** |

Result: **45% smaller**, easier to maintain, faster to extend.

---

## Runtime Compatibility

**Runs everywhere:** Bun (first-class), Node.js 12+, Deno, modern browsers.

Output uses ES2022: classes, `let`/`const`, `?.`, `??`, `for await`, top-level await.

---

## Quick Reference

```bash
rip                    # Interactive REPL
rip file.rip           # Run a file
rip -c file.rip        # Compile to JavaScript
rip -s file.rip        # Show S-expressions (debug parser)
rip -t file.rip        # Show tokens (debug lexer)
bun run test           # Run all 1033 tests
bun run parser         # Rebuild parser (self-hosting!)
bun run browser        # Build browser bundle
```

---

## Documentation

| Guide | Description |
|-------|-------------|
| [AGENT.md](AGENT.md) | Complete developer/AI guide |
| [docs/REACTIVITY.md](docs/REACTIVITY.md) | Signals, effects, derived values |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | Component system |
| [docs/TEMPLATES.md](docs/TEMPLATES.md) | Template DSL |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## Zero Dependencies

```json
{ "dependencies": {} }
```

Everything included: compiler, parser generator (solar.rip), REPL, browser bundle, test framework. Rip compiles itself — `bun run parser` rebuilds from source.

---

## Philosophy

> *Simplicity scales.*

Keep the IR simple (S-expressions), keep the pipeline clear (lex → parse → generate), keep the code minimal. Test everything.

---

## Credits

**Inspired by:** CoffeeScript (syntax), Lisp/Scheme (S-expressions), Ruby (regex operators, `__DATA__`), Solar (parser generator).

**Powered by:** [Bun](https://bun.sh) — the fast all-in-one JavaScript runtime.

---

## License

MIT

---

<p align="center">
  <strong>Start simple. Build incrementally. Ship elegantly.</strong> ✨
</p>
