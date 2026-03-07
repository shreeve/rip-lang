# AI Agent Guide for Rip

**Purpose:** This document helps AI assistants understand and work with the Rip language compiler and its ecosystem of packages.

**What is Rip:** An elegant reactive language that compiles to modern JavaScript (ES2022), featuring zero dependencies, self-hosting capability, and built-in reactivity primitives.

Detailed compiler, component, browser, widget, loader, and type-system notes now live in targeted `.cursor/rules/*.mdc` files so they only apply when relevant.

---

## Quick Start

### Essential Commands

```bash
# Debug any code
echo 'your code' | ./bin/rip -t  # Tokens (lexer)
echo 'your code' | ./bin/rip -s  # S-expressions (parser)
echo 'your code' | ./bin/rip -c  # JavaScript (codegen)

# Run tests
bun run test
bun test/runner.js test/rip/FILE.rip

# Rebuild parser (after grammar changes)
bun run parser

# Build browser bundle
bun run build

# Serve an app (watches *.rip, HTTPS, mDNS)
rip server

# Interactive REPL (toggle .tokens, .sexp, .js modes)
./bin/rip
```

## Project Structure

```text
rip-lang/
├── src/
│   ├── lexer.js
│   ├── compiler.js
│   ├── types.js
│   ├── components.js
│   ├── sourcemaps.js
│   ├── typecheck.js
│   ├── parser.js
│   ├── repl.js
│   ├── browser.js
│   └── grammar/
├── packages/
│   ├── ui/
│   ├── server/
│   ├── db/
│   ├── schema/
│   ├── swarm/
│   ├── csv/
│   ├── http/
│   ├── print/
│   └── vscode/
├── docs/
├── test/rip/
└── scripts/
```

### File Editing Rules

| File | Can Edit? | Notes |
| --- | --- | --- |
| `src/compiler.js` | Yes | Code generator; main compiler work |
| `src/lexer.js` | Yes | Lexer and rewriter |
| `src/types.js` | Yes | Type system sidecar |
| `src/components.js` | Yes | Component system sidecar |
| `src/grammar/grammar.rip` | Carefully | Run `bun run parser` after changes |
| `src/parser.js` | Never | Generated file |
| `src/sourcemaps.js` | Yes | Source map generator |
| `src/browser.js` | Yes | Browser entry point |
| `rip-loader.js` | Yes | Bun plugin for `.rip` compilation and import rewriting |
| `src/grammar/solar.rip` | Never | Given parser generator |
| `test/rip/*.rip` | Yes | Test files |

### Critical Rules

- **Never edit `src/parser.js`** — it is generated
- **Never edit `src/grammar/solar.rip`** — it is given
- **Never commit without running tests** — `bun run test` must pass
- **Never add dependencies** — zero dependencies is a core principle
- **Never read or execute scripts directly** — use `bun run <name>`
- Run `bun run parser` after grammar changes
- Run `bun run build` after codegen, `components.js`, or `browser.js` changes
- Run `bun run bump` for the standard release flow

## Compilation Pipeline

```text
Rip Source -> Lexer -> emitTypes -> Parser -> S-Expressions -> Codegen -> JavaScript
                       (types.js)           (arrays + .loc)             + source map
                          ↓
                       file.d.ts (when types: "emit")
```

**Key insight:** S-expressions are simple arrays like `["=", "x", 42]`, not large AST objects.

Detailed compiler and lexer internals are in `.cursor/rules/compiler-internals.mdc`.

---

## Common Tasks

### Fix a Bug in Codegen

```bash
echo 'failing code' | ./bin/rip -s
rg "GENERATORS" src/compiler.js
bun run test
```

### Add a Grammar Rule

```bash
# Edit src/grammar/grammar.rip
bun run parser
# Add codegen in src/compiler.js if needed
bun run test
```

## Testing

Test helpers:

```coffee
test "name", "x = 42; x", 42
code "name", "x + y", "(x + y)"
fail "name", "invalid syntax"
```

Test files live in `test/rip/`.

Detailed component testing notes live in `.cursor/rules/components.mdc`. Type-system and audit guidance lives in `.cursor/rules/vscode-ext.mdc` plus `test/types/AGENTS.md`.

---

## Packages

The `packages/` directory contains optional packages written in Rip, with zero dependencies, running on Bun.

### @rip-lang/server

Sinatra-style web framework with magic `@` context, validation helpers, file serving, middleware composition, multi-worker process management, hot reloading, automatic HTTPS, mDNS, and request queueing.

Key ideas:

- handlers use `@req`, `@json()`, `@send()`, `@session`
- `read()` validates params and body
- `@send(path, type?)` serves files
- `use()` composes middleware

```coffee
import { get, use, start, notFound } from '@rip-lang/server'

get '/', -> { message: 'Hello!' }
get '/css/*', -> @send "public/#{@req.path.slice(5)}"
notFound -> @send 'index.html', 'text/html; charset=UTF-8'
start port: 3000
```

### Rip UI

Zero-build reactive web framework built into Rip. The browser loads `rip.min.js`, compiles `<script type="text/rip">` sources into one shared scope, and renders with fine-grained DOM updates.

Key ideas:

- shared scope across all Rip script tags
- bundle mode via `data-src`
- stash seeded from `data-state`
- file-based routing
- hot reload through `/watch`

```coffee
import { get, use, start, notFound } from '@rip-lang/server'
import { serve } from '@rip-lang/server/middleware'

dir = import.meta.dir
use serve dir: dir, title: 'My App', watch: true
get '/css/*', -> @send "#{dir}/css/#{@req.path.slice(5)}"
notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'
start port: 3000
```

### Other Packages

- `@rip-lang/db` — DuckDB server with official UI and ActiveRecord-style client
- `@rip-lang/schema` — ORM and validation
- `@rip-lang/swarm` — worker-thread job runner
- `@rip-lang/csv` — CSV parser and writer
- `@rip-lang/http` — zero-dependency HTTP client
- `@rip-lang/print` — syntax-highlighted code printer
- `packages/ui/` — headless UI widgets written in Rip
- `packages/vscode/` — VS Code / Cursor extension

### Package Development

- packages use `workspace:*` linking
- after modifying a package locally, run `bun install` from the project root
- packages written in Rip need the loader, so run from the root or use `rip server`
- `import.meta.dir` resolves to the package's actual filesystem path
- `@rip-lang/server` binds `this` to the request context

`rip server` uses the globally installed `@rip-lang/server/server.rip`, not the workspace copy. Changes to `packages/server/` do not affect `rip server` until that package is published or otherwise updated in the global install.

For server-only changes, publish just that package instead of doing a full release. Use `bun run bump` for full rip-lang releases.

Detailed widget notes live in `.cursor/rules/ui-widgets.mdc`. Browser runtime details live in `.cursor/rules/browser.mdc`.

---

## Source Maps

Rip emits inline Source Map V3 data URLs.

- every s-expression node carries source location info
- the code generator builds output-to-source mappings
- `SourceMapGenerator` in `src/sourcemaps.js` emits VLQ mappings
- `toReverseMap()` provides generated-to-source lookup used by the VS Code extension

```bash
rip -m example.rip
rip -cm example.rip
```

---

## Language Features

### Removed (from CoffeeScript / Rip 2.x)

| Feature | Replacement |
| --- | --- |
| postfix spread/rest (`x...`) | prefix only: `...x` |
| prototype access (`x::y`, `x?::y`) | `.prototype` or class syntax |
| binary existential (`x ? y`) | `x ?? y` |
| `is not` contraction | `isnt` |
| `for x from iterable` | `for x as iterable` |

### Added

| Feature | Syntax | Purpose |
| --- | --- | --- |
| ternary operator | `x ? a : b` | JS-style ternary |
| postfix ternary | `a if x else b` | Python-style ternary |
| `for...as` iteration | `for x as iter` | iterable loop |
| `as!` async shorthand | `for x as! iter` | shorthand for `for await` |
| defined check | `x!?` | true if not undefined |
| presence check | `x?!` | truthy-or-undefined Houdini operator |
| optional chain assign | `x?.prop = val` | guarded assignment |

### Kept

| Feature | Syntax | Compiles to |
| --- | --- | --- |
| existence check | `x?` | `(x != null)` |
| optional chaining | `a?.b`, `a?.[0]`, `a?.()` | JS optional chaining |
| optional shorthand | `a?[0]`, `a?(x)` | `a?.[0]`, `a?.(x)` |
| optional chain assign | `x?.prop = val` | guarded assignment |
| nullish coalescing | `a ?? b` | `a ?? b` |
| dammit operator | `fetchData!` | `await fetchData()` |

---

## Quick Reference

### Unique Operators

| Operator | Name | Example |
| --- | --- | --- |
| `!` | Dammit | `fetchData!` |
| `!` | Void | `def process!` |
| `=!` | Readonly | `MAX =! 100` |
| `!?` | Otherwise | `val !? 5` |
| `!?` | Defined | `val!?` |
| `?!` | Presence | `@checked?!` |
| `?` | Existence | `x?` |
| `//` | Floor div | `7 // 2` |
| `%%` | True mod | `-1 %% 3` |
| `:=` | State | `count := 0` |
| `~=` | Computed | `doubled ~= count * 2` |
| `<=>` | Two-way bind | `value <=> name` |
| `=~` | Match | `str =~ /pat/` |
| `.new()` | Constructor | `User.new()` |
| `::` | Prototype | `String::trim` |
| `if...else` | Postfix ternary | `"a" if cond else "b"` |
| `[-n]` | Negative index | `arr[-1]` |
| `*` | String repeat | `"-" * 40` |
| `<` `<=` | Chained | `1 < x < 10` |
| `|>` | Pipe | `x |> fn` |
| `.=` | Method assign | `x .= trim()` |
| `?.=` | Optional assign | `el?.style.display = "none"` |
| `=` | Render text | `= item.textContent` |
| `*` | Merge assign | `*obj = {a: 1}` |
| `not in` | Not in | `x not in arr` |
| `loop n` | Repeat N | `loop 5 -> body` |
| `it` | Implicit param | `-> it > 5` |
| `or return` | Guard | `x = get() or return err` |
| `?? throw` | Nullish guard | `x = get() ?? throw err` |
| `%w` | Word literal | `%w[foo bar baz]` |

### Standard Library

Rip injects helpers via `globalThis` in compiled output, the CLI REPL, and the browser REPL.

| Function | Description |
| --- | --- |
| `abort(msg?)` | log to stderr, exit with code 1 |
| `assert(v, msg?)` | throw if falsy |
| `exit(code?)` | exit process |
| `kind(v)` | lowercase type name |
| `noop()` | no-op |
| `p(...args)` | `console.log` shorthand |
| `pp(v)` | pretty-print JSON, returns value |
| `raise(a, b?)` | throw error |
| `rand(a?, b?)` | random number |
| `sleep(ms)` | promise-based delay |
| `todo(msg?)` | throw not implemented |
| `warn(...args)` | `console.warn` shorthand |
| `zip(...arrays)` | zip arrays pairwise |

All helpers use `??=` so they can be overridden.

---

**For AI assistants:** Trust the tests, use the debug tools, follow existing patterns, and let the targeted `.cursor/rules/*.mdc` files provide the deeper subsystem details only when they are relevant.
