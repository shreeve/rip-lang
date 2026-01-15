<p align="center">
  <img src="docs/rip-1280w.png" alt="Rip Logo" width="400">
</p>

<h1 align="center">Rip</h1>

<p align="center">
  <strong>Elegant reactive code that compiles to modern JavaScript</strong>
</p>

<p align="center">
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-2.2.1-blue.svg" alt="Version"></a>
  <a href="#zero-dependencies"><img src="https://img.shields.io/badge/dependencies-ZERO-brightgreen.svg" alt="Dependencies"></a>
  <a href="#"><img src="https://img.shields.io/badge/tests-1033%2F1033-brightgreen.svg" alt="Tests"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"></a>
</p>

---

## What is Rip?

A **CoffeeScript-inspired language** with built-in reactivity that compiles to clean ES2022. Zero dependencies. Self-hosting. 50% smaller than CoffeeScript.

```coffee
# Reactive state
count := 0
doubled ∞= count * 2
effect -> console.log "Count: #{count}, Doubled: #{doubled}"

count = 5   # Logs: "Count: 5, Doubled: 10"

# Async made easy
user = fetchUser!(id)      # ! = call AND await

# Smart defaults
timeout = config.timeout !? 5000   # !? = only if undefined (null/0/false are valid!)
```

**Try it now:** [https://shreeve.github.io/rip-lang/](https://shreeve.github.io/rip-lang/)

---

## Installation

```bash
# Install Bun (if needed)
curl -fsSL https://bun.sh/install | bash

# Install Rip globally
bun add -g rip-lang

# Use it!
rip                     # Interactive REPL
rip file.rip            # Run a file
rip -c file.rip         # Compile to JavaScript
```

---

## Why Rip?

| | Rip | CoffeeScript |
|---|---|---|
| **Output** | ES2022 (classes, modules, `?.`, `??`) | ES5 (var, prototypes) |
| **Reactivity** | Built-in (`count := 0`) | None |
| **Dependencies** | Zero | Multiple |
| **Self-hosting** | Yes | No |
| **Size** | 9,839 LOC | 17,760 LOC |

### Unique Features

| Feature | Example | What it does |
|---------|---------|--------------|
| **Dammit `!`** | `fetchData!` | Call AND await in one |
| **Otherwise `!?`** | `val !? default` | Default only if undefined |
| **Signals** | `count := 0` | Reactive state |
| **Derived** | `doubled ∞= count * 2` | Auto-updating values |
| **Effects** | `effect -> log count` | Run on changes |
| **Ruby regex** | `str =~ /pat/` | Match with `_[1]` capture |

---

## Components

Build reactive UIs with fine-grained updates:

```coffee
component Counter
  @initial = 0
  count = @initial

  render
    div.counter
      span count
      button @click: (-> count += 1), "+"
```

Each binding updates independently — no virtual DOM diffing. [Learn more →](docs/COMPONENTS.md)

---

## Quick Reference

```bash
rip                    # REPL
rip file.rip           # Run
rip -c file.rip        # Compile
rip -s file.rip        # Show S-expressions (debug)
bun run test           # Run 1033 tests
bun run browser        # Build 56KB browser bundle
```

---

## Documentation

| Guide | Description |
|-------|-------------|
| [AGENT.md](AGENT.md) | Complete developer guide |
| [docs/REACTIVITY.md](docs/REACTIVITY.md) | Signals, effects, derived values |
| [docs/COMPONENTS.md](docs/COMPONENTS.md) | Component system |
| [docs/TEMPLATES.md](docs/TEMPLATES.md) | Template DSL |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## Zero Dependencies

```json
{ "dependencies": {} }
```

Everything is included: compiler, parser generator, REPL, browser bundle, test framework. Rip compiles itself — run `bun run parser` to rebuild from source.

---

## License

MIT

---

<p align="center">
  <strong>Start simple. Build incrementally. Ship elegantly.</strong> ✨
</p>
