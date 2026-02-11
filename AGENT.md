<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# AI Agent Guide for Rip

**Purpose:** This document helps AI assistants understand and work with the Rip language compiler and its ecosystem of packages.

**What is Rip:** An elegant reactive language that compiles to modern JavaScript (ES2022), featuring zero dependencies, self-hosting capability, and built-in reactivity primitives.

---

## Quick Start

### Essential Commands

```bash
# Debug any code
echo 'your code' | ./bin/rip -t  # Tokens (lexer)
echo 'your code' | ./bin/rip -s  # S-expressions (parser)
echo 'your code' | ./bin/rip -c  # JavaScript (codegen)

# Run tests
bun run test                              # All tests (1140)
bun test/runner.js test/rip/FILE.rip     # Specific file

# Rebuild parser (after grammar changes)
bun run parser

# Build browser bundle
bun run browser
```

### Current Status

| Metric | Value |
|--------|-------|
| Version | 3.6.0 |
| Tests | 1,140/1,140 (100%) |
| Dependencies | Zero |
| Self-hosting | Yes (Rip compiles itself) |

---

## Project Structure

```
rip-lang/
├── src/
│   ├── lexer.js         # Lexer + Rewriter (1,867 LOC)
│   ├── compiler.js      # Compiler + Code Generator (3,292 LOC)
│   ├── types.js         # Type System — sidecar for lexer (719 LOC)
│   ├── components.js    # Component System — sidecar for compiler (1,240 LOC)
│   ├── sourcemaps.js    # Source Map V3 generator (122 LOC)
│   ├── tags.js          # HTML tag classification (63 LOC)
│   ├── parser.js        # Generated parser (357 LOC) — Don't edit!
│   ├── repl.js          # Terminal REPL (707 LOC)
│   ├── browser.js       # Browser integration (119 LOC)
│   └── grammar/
│       ├── grammar.rip  # Grammar specification (935 LOC)
│       └── solar.rip    # Parser generator (916 LOC) — Don't edit!
├── packages/            # Optional packages (see Packages section below)
│   ├── api/             # @rip-lang/api — Web framework
│   ├── ui/              # @rip-lang/ui — Reactive web UI framework
│   ├── server/          # @rip-lang/server — Production server
│   ├── db/              # @rip-lang/db — DuckDB server
│   ├── schema/          # @rip-lang/schema — ORM + validation
│   ├── swarm/           # @rip-lang/swarm — Parallel job runner
│   ├── csv/             # @rip-lang/csv — CSV parser + writer
│   └── vscode/          # VS Code/Cursor extension
├── docs/
│   ├── RIP-LANG.md      # Language reference
│   ├── RIP-TYPES.md     # Type system specification
│   ├── RIP-REACTIVITY.md # Reactivity deep dive
│   └── RIP-INTERNALS.md # Compiler architecture & design decisions
├── test/rip/            # 25 test files (1,140 tests)
└── scripts/             # Build utilities
```

### File Editing Rules

| File | Can Edit? | Notes |
|------|-----------|-------|
| `src/compiler.js` | Yes | Code generator — main work here |
| `src/lexer.js` | Yes | Lexer and rewriter |
| `src/types.js` | Yes | Type system (lexer sidecar) |
| `src/components.js` | Yes | Component system (compiler sidecar) |
| `src/grammar/grammar.rip` | Carefully | Run `bun run parser` after changes |
| `src/parser.js` | Never | Generated file |
| `src/sourcemaps.js` | Yes | Source map generator |
| `src/tags.js` | Yes | HTML tag classification |
| `src/grammar/solar.rip` | Never | Parser generator (given) |
| `test/rip/*.rip` | Yes | Test files |

---

## The Compilation Pipeline

```
Rip Source  ->  Lexer  ->  emitTypes  ->  Parser  ->  S-Expressions  ->  Codegen  ->  JavaScript
               (1,867)     (types.js)     (357)       (arrays + .loc)     (3,292)      + source map
                              ↓
                           file.d.ts (when types: "emit")
```

**Key insight:** S-expressions are simple arrays like `["=", "x", 42]`, not complex AST nodes. This makes the compiler dramatically smaller than CoffeeScript.

---

## Key Concepts

### 1. S-Expression Patterns

```javascript
["=", "x", 42]                 // Assignment
["+", left, right]             // Binary operator
["def", "name", params, body]  // Function definition
["->", params, body]           // Arrow function
["if", condition, then, else]  // Conditional
["state", name, expr]          // Reactive state (:=)
["computed", name, expr]       // Computed value (~=)
["enum", name, body]           // Enum declaration
```

### 2. Context-Aware Generation

```javascript
generate(sexpr, context = 'statement')
// context: 'statement' | 'value'
```

**Example - Comprehensions:**
- **Value context** (result used) -> IIFE with array building
- **Statement context** (result discarded) -> Plain loop

### 3. Dispatch Table Architecture

All ~55 node types are in a dispatch table for O(1) lookup:

```javascript
static GENERATORS = {
  'if': 'generateIf',
  'class': 'generateClass',
  '+': 'generateBinaryOp',
  'state': 'generateState',
  // ... all node types
};
```

To modify a feature:
1. Find the operator in `GENERATORS` table
2. Locate the generator method
3. Modify the method
4. Test!

### 4. Heredoc Whitespace Stripping

Heredocs (`'''` and `"""`) use a **closing-delimiter-as-left-margin** rule. The column position of the closing `'''` or `"""` defines the left margin — that amount of leading whitespace is stripped from every content line:

```coffee
# Closing delimiter at same indent as content — fully left-aligned output
contents = """
    username=#{user}
    password=#{pass}
    access_token=#{token}
    """
# Result: "username=...\npassword=...\naccess_token=..."

# Closing delimiter 2 columns left of content — 2 spaces retained
html = '''
    <div>
      <p>Hello</p>
    </div>
  '''
# Result: "  <div>\n    <p>Hello</p>\n  </div>"
```

### 5. Block Unwrapping

Parser wraps statements in `["block", ...]` everywhere:

```javascript
if (Array.isArray(body) && body[0] === 'block') {
  const statements = body.slice(1);  // Always unwrap!
}
```

---

## Reactive Features

Rip provides reactivity as **language-level operators**, not library imports:

| Operator | Name | Mnemonic | Output |
|----------|------|----------|--------|
| `=` | Assign | "gets value" | `let x; x = value` |
| `:=` | State | "has state" | `const x = __state(value)` |
| `~=` | Computed | "always equals" | `const x = __computed(() => expr)` |
| `~>` | Effect | "reacts to" | `__effect(() => { ... })` or `const x = __effect(...)` |
| `=!` | Readonly | "equals, dammit!" | `const x = value` (just const) |

The reactive runtime is embedded in compiler.js and only included when needed.

---

## Type System (Rip Types)

Rip's optional type system adds compile-time type annotations that emit `.d.ts` files for TypeScript interoperability. Types are **erased** from JavaScript output — they exist only for IDE intelligence and documentation.

### Syntax

```coffee
# Type annotations (::)
def greet(name:: string):: string
  "Hello, #{name}!"

# Type aliases (::=)
User ::= type
  id: number
  name: string
  email?: string

# Interfaces
interface Animal
  name: string
  speak: => void

# Enums (emit runtime JS + .d.ts)
enum Status
  Active
  Inactive
```

### Architecture

All type logic lives in `src/types.js` (lexer sidecar):
- `installTypeSupport(Lexer)` — adds `rewriteTypes()` to the lexer
- `emitTypes(tokens)` — generates `.d.ts` from annotated tokens
- `generateEnum()` — generates runtime JS for enums

Types are processed at the **token level** before parsing. The parser never sees type annotations — they're stripped during token rewriting with metadata stored on tokens for `.d.ts` emission.

### CLI

```bash
rip -d example.rip     # Generate example.d.ts
rip -cd example.rip    # Compile JS + generate .d.ts
```

---

## Source Maps

Rip generates Source Map V3 (ECMA-426) for debugging support. Source maps are embedded inline as base64 data URLs — one file, no separate `.map` file needed.

### How It Works

- Every S-expression node carries `.loc = {r, c}` from its original source position
- The code generator builds line-level mappings between output JS and source Rip
- `SourceMapGenerator` (in `src/sourcemaps.js`) produces VLQ-encoded mappings
- `toReverseMap()` provides O(1) source→generated position lookup (used by VS Code extension)

### CLI

```bash
rip -m example.rip     # Compile with inline source map
rip -cm example.rip    # Show compiled JS with source map
```

Debuggers (Node.js, Bun, Chrome DevTools) read inline source maps natively — breakpoints and stack traces point back to `.rip` source lines.

---

## VS Code Extension

The Rip extension (`packages/vscode/`) provides IDE support for VS Code and Cursor.

### Features

- **Syntax highlighting** — TextMate grammar for all Rip syntax
- **Auto .d.ts generation** — generates type declarations on save (Level 1)
- **Type intelligence** — autocomplete, hover, go-to-definition from third-party `.d.ts` files (Level 2)
- **Commands** — "Generate .d.ts for Current File" and "Generate .d.ts for All Files"

### How Type Intelligence Works

1. On each edit (300ms debounce), the extension compiles `.rip` to a shadow `.ts` file in `.rip-cache/`
2. VS Code's built-in TypeScript extension analyzes the shadow file and resolves `node_modules` types
3. Completion/hover/definition requests are proxied from `.rip` → shadow `.ts` using the reverse source map
4. TypeScript's results are returned to the `.rip` editor

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `rip.types.generateOnSave` | `true` | Auto-generate `.d.ts` on save |
| `rip.types.intellisense` | `true` | Enable autocomplete/hover/go-to-definition |
| `rip.compiler.path` | (auto) | Path to the `rip` compiler binary |

### Publishing

```bash
cd packages/vscode
npx @vscode/vsce login rip-lang    # Login with PAT (one-time)
npx @vscode/vsce publish           # Publish to Marketplace
```

---

## Common Tasks

### Fix a Bug in Codegen

```bash
# 1. Debug the pattern
echo 'failing code' | ./bin/rip -s  # See s-expression

# 2. Find the generator
grep "GENERATORS" src/compiler.js

# 3. Fix it, then test
bun run test
```

### Add a Grammar Rule

```bash
# 1. Edit grammar
# src/grammar/grammar.rip

# 2. Regenerate parser
bun run parser

# 3. Add codegen if needed
# src/compiler.js

# 4. Test
bun run test
```

---

## Testing

### Test Types

```coffee
# Execute and compare result
test "name", "x = 42; x", 42

# Compare generated JavaScript
code "name", "x + y", "(x + y)"

# Expect compilation failure
fail "name", "invalid syntax"
```

### Test Files (25 files, 1,140 tests)

```
test/rip/
├── arrows.rip        ├── loops.rip
├── assignment.rip    ├── modules.rip
├── async.rip         ├── operators.rip
├── basic.rip         ├── optional.rip
├── classes.rip       ├── parens.rip
├── commaless.rip     ├── precedence.rip
├── comprehensions.rip├── properties.rip
├── control.rip       ├── reactivity.rip
├── data.rip          ├── regex.rip
├── errors.rip        ├── semicolons.rip
├── functions.rip     ├── strings.rip
├── guards.rip        └── types.rip
└── literals.rip
```

---

## Documentation Map

| File | Purpose |
|------|---------|
| **README.md** | User guide, features, installation |
| **docs/RIP-GUIDE.md** | Practical guide for USING Rip in projects (for AI and users) |
| **docs/RIP-LANG.md** | Full language reference |
| **docs/RIP-TYPES.md** | Type system specification |
| **docs/RIP-REACTIVITY.md** | Reactivity deep dive |
| **docs/RIP-INTERNALS.md** | Compiler architecture, design decisions, S-expressions |

---

## Packages

The `packages/` directory contains optional packages that extend Rip for
full-stack development. All are written in Rip, have zero dependencies, and
run on Bun.

### @rip-lang/api (v1.1.4) — Web Framework

Hono-compatible web framework with Sinatra-style routing, magic `@` context,
37 built-in validators, file serving (`@send`), and middleware composition.

| File | Lines | Role |
|------|-------|------|
| `api.rip` | ~647 | Core framework: routing, validation, `read()`, `session`, `@send`, server |
| `middleware.rip` | ~463 | Built-in middleware: cors, logger, sessions, compression, security |

Key concepts:
- **`@` magic** — Handlers use `@req`, `@json()`, `@send()`, `@session` (bound via `this`)
- **`read()`** — Validates params/body with 37 built-in validators
- **`@send(path, type?)`** — Serve files with auto-detected MIME types via `Bun.file()`
- **`use()`** — Koa-style middleware composition with `next()`

```coffee
import { get, use, start, notFound } from '@rip-lang/api'

get '/', -> { message: 'Hello!' }
get '/css/*', -> @send "public/#{@req.path.slice(5)}"
notFound -> @send 'index.html', 'text/html; charset=UTF-8'
start port: 3000
```

### @rip-lang/ui (v0.2.0) — Reactive Web Framework

Zero-build reactive web framework. The browser loads the Rip compiler,
compiles the UI framework (`ui.rip`), fetches an app bundle, and renders
with fine-grained DOM updates. Uses Rip's built-in reactive primitives
directly — one signal graph shared between framework and components.

| File | Lines | Role |
|------|-------|------|
| `ui.rip` | ~640 | Unified framework: stash, parts, router, renderer, launch |
| `serve.rip` | ~130 | Server middleware: framework files, bundle, SSE hot-reload |

Key concepts:
- **`ripUI` middleware** — `use ripUI app: '/demo', dir: dir` registers routes for framework files (`/rip/browser.js`, `/rip/ui.rip`), app bundle (`/{app}/bundle`), and SSE hot-reload (`/{app}/watch`)
- **`launch(appBase)`** — Client-side: fetches the app bundle, hydrates the stash, starts the router and renderer
- **`component` / `render`** — Two keywords added to Rip for defining components with reactive state (`:=`), computed (`~=`), effects (`~>`)
- **File-based routing** — `parts/users/[id].rip` → `/users/:id` (Next.js-style)
- **Unified stash** — Deep reactive proxy with path navigation, uses `__state` from Rip's built-in reactive runtime
- **Hot reload** — Server sends notify-only SSE events, browser invalidates + refetches + remounts

```coffee
# Server (index.rip)
import { get, use, start, notFound } from '@rip-lang/api'
import { ripUI } from '@rip-lang/ui/serve'

dir = import.meta.dir
use ripUI dir: dir, watch: true, title: 'My App'
get '/css/*', -> @send "#{dir}/css/#{@req.path.slice(5)}"
notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'
start port: 3000
```

### @rip-lang/server (v1.1.3) — Production Server

Multi-worker process manager with hot reloading, automatic HTTPS, mDNS service
discovery, and request queueing. Serves any `@rip-lang/api` app (including
Rip UI apps with SSE hot-reload).

| File | Lines | Role |
|------|-------|------|
| `server.rip` | ~1,211 | CLI, workers, load balancing, TLS, mDNS |
| `server.html` | ~420 | Built-in dashboard UI |

```bash
rip-server -w    # Start with file watching + hot-reload
```

### Other Packages

- **@rip-lang/db** — HTTP server for DuckDB queries (~225 lines)
- **@rip-lang/schema** — ORM + validation with declarative syntax (~420 lines)
- **@rip-lang/swarm** — Parallel job runner with worker threads (~330 lines)
- **@rip-lang/csv** — CSV parser + writer with indexOf ratchet engine (~300 lines)

### Package Development

Packages use `workspace:*` linking in the root `package.json`. After modifying
a package locally, run `bun install` from the project root to ensure symlinks
are correct. Key patterns:

- Packages written in Rip (`.rip` files) need the Rip loader — run from the
  project root where `bunfig.toml` is located, or use `rip-server`
- `import.meta.dir` resolves to the package's actual filesystem path (important
  for serving files)
- `@rip-lang/api` handlers bind `this` to the context object — use `@send`,
  `@json`, `@req`, etc.

---

## Browser Runtime

`src/browser.js` (~120 LOC) provides the browser entry point. When loaded,
it registers key functions on `globalThis` and processes inline Rip scripts.

### Key Features

- **`<script type="text/rip">`** — Inline Rip code compiled and executed on
  `DOMContentLoaded`. Uses an async IIFE wrapper so `!` (await) works.
- **`rip()` console REPL** — Wraps code in a Rip `do ->` block before
  compiling, so the compiler handles implicit return and auto-async natively.
  Sync code returns values directly; async code returns a Promise.
- **`importRip(url)`** — Fetches a `.rip` file, compiles it, imports as an
  ES module via blob URL.
- **`globalThis.__rip`** — Reactive runtime registered eagerly on load.

### globalThis Registrations

| Function | Purpose |
|----------|---------|
| `rip(code)` | Console REPL — compile and execute Rip code |
| `importRip(url)` | Fetch, compile, and import a `.rip` file |
| `compileToJS(code)` | Compile Rip source to JavaScript |
| `__rip` | Reactive primitives (`__state`, `__computed`, `__effect`, `__batch`) |

### Variable Persistence in `rip()`

`let` declarations are stripped (bare assignments create globals in sloppy
mode eval). `const` is hoisted to `globalThis.` explicitly. This allows
variables to persist across `rip()` calls in the browser console.

---

## Language Features

### Removed (from CoffeeScript / Rip 2.x)

| Feature | Replacement |
|---------|-------------|
| Postfix spread/rest (`x...`) | Prefix only: `...x` (ES6) |
| Prototype access (`x::y`, `x?::y`) | `.prototype` or class syntax |
| Binary existential (`x ? y`) | `x ?? y` (nullish coalescing) |
| `is not` contraction | `isnt` |
| `for x from iterable` | `for x as iterable` |

### Added

| Feature | Syntax | Purpose |
|---------|--------|---------|
| Ternary operator | `x ? a : b` | JS-style ternary expressions |
| Postfix ternary | `a if x else b` | Python-style ternary expressions |
| `for...as` iteration | `for x as iter` | ES6 `for...of` on iterables |
| `as!` async shorthand | `for x as! iter` | Shorthand for `for await x as iter` |

### Kept

| Feature | Syntax | Compiles to |
|---------|--------|-------------|
| Existence check | `x?` | `(x != null)` |
| Optional chaining | `a?.b`, `a?.[0]`, `a?.()` | ES6 optional chaining |
| Optional chaining shorthand | `a?[0]`, `a?(x)` | `a?.[0]`, `a?.(x)` |
| Nullish coalescing | `a ?? b` | `a ?? b` |
| Dammit operator | `fetchData!` | `await fetchData()` |

---

## Critical Rules

- **Never edit `src/parser.js`** — It's generated
- **Never edit `src/grammar/solar.rip`** — It's given
- **Never commit without running tests** — `bun run test` must pass
- **Never add dependencies** — Zero dependencies is a core principle
- Run `bun run test` before committing
- Run `bun run parser` after grammar changes
- Run `bun run browser` after codegen changes

---

## Debugging Tips

```bash
# When tests fail
bun test/runner.js test/rip/FILE.rip  # Run specific test
echo 'code' | ./bin/rip -s            # Check s-expression
echo 'code' | ./bin/rip -c            # Check generated JS

# Interactive REPL with debug modes
./bin/rip
rip> .tokens  # Toggle token display
rip> .sexp    # Toggle s-expression display
rip> .js      # Toggle JS display
```

---

## Quick Reference

### Unique Operators

| Operator | Name | Example |
|----------|------|---------|
| `!` | Dammit | `fetchData!` — calls AND awaits |
| `!` | Void | `def process!` — suppresses return |
| `=!` | Readonly | `MAX =! 100` — const ("equals, dammit!") |
| `!?` | Otherwise | `val !? 5` — default if undefined |
| `?` | Existence | `x?` — true if not null/undefined |
| `//` | Floor div | `7 // 2` — 3 |
| `%%` | True mod | `-1 %% 3` — 2 |
| `:=` | State | `count := 0` — reactive state |
| `~=` | Computed | `doubled ~= count * 2` — computed |
| `=~` | Match | `str =~ /pat/` — Ruby-style regex |
| `.new()` | Constructor | `User.new()` — Ruby-style new |
| `if...else` | Postfix ternary | `"a" if cond else "b"` — Python-style |
| `[-n]` | Negative index | `arr[-1]` — last element via `.at()` |
| `*` | String repeat | `"-" * 40` — string repetition |
| `<` `<=` | Chained | `1 < x < 10` — chained comparisons |
| `\|>` | Pipe | `x \|> fn` or `x \|> fn(y)` — first-arg pipe |
| `not in` | Not in | `x not in arr` — negated membership |
| `or return` | Guard | `x = get() or return err` — early return |
| `?? throw` | Nullish guard | `x = get() ?? throw err` — throw if null |

### Build Commands

```bash
bun run test      # Run all tests
bun run parser    # Rebuild parser from grammar
bun run browser   # Build browser bundle
bun run serve     # Start dev server (localhost:3000)
```

---

**For AI Assistants:** The code is well-tested and the architecture is clear. Trust the tests, use the debug tools (`-s`, `-t`, `-c`), and follow existing patterns. Most compiler work happens in `src/compiler.js` — find the generator method for the node type you're working with and modify it. For package work, each package has its own README with detailed documentation — see `packages/README.md` for the overview.
