<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

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
bun run test                             # All tests (1242)
bun test/runner.js test/rip/FILE.rip     # Specific file

# Rebuild parser (after grammar changes)
bun run parser

# Build browser bundle
bun run browser
```

### Current Status

| Metric | Value |
|--------|-------|
| Version | 3.12.2 |
| Tests | 1,243 |
| Dependencies | Zero |
| Self-hosting | Yes (Rip compiles itself) |

---

## Project Structure

```
rip-lang/
├── src/
│   ├── lexer.js         # Lexer + Rewriter (1,761 LOC)
│   ├── compiler.js      # Compiler + Code Generator (3,303 LOC)
│   ├── types.js         # Type System — sidecar for lexer (1,099 LOC)
│   ├── components.js    # Component System — sidecar for compiler (1,877 LOC)
│   ├── sourcemaps.js    # Source Map V3 generator (189 LOC)
│   ├── tags.js          # HTML tag classification (62 LOC)
│   ├── parser.js        # Generated parser (357 LOC) — Don't edit!
│   ├── repl.js          # Terminal REPL (601 LOC)
│   ├── browser.js       # Browser integration (167 LOC)
│   └── grammar/
│       ├── grammar.rip  # Grammar specification (944 LOC)
│       ├── lunar.rip    # Recursive descent parser generator (2,412 LOC)
│       └── solar.rip    # SLR(1) parser generator (929 LOC) — Don't edit!
├── packages/            # Optional packages (see Packages section below)
│   ├── api/             # @rip-lang/api — Web framework
│   ├── grid/            # @rip-lang/grid — Reactive data grid
│   ├── server/          # @rip-lang/server — Production server
│   ├── db/              # @rip-lang/db — DuckDB server
│   ├── schema/          # @rip-lang/schema — ORM + validation
│   ├── swarm/           # @rip-lang/swarm — Parallel job runner
│   ├── csv/             # @rip-lang/csv — CSV parser + writer
│   └── vscode/          # VS Code/Cursor extension
├── docs/
│   ├── RIP-LANG.md      # Language reference (includes reactivity, future ideas)
│   ├── RIP-TYPES.md     # Type system specification
│   └── RIP-INTERNALS.md # Compiler architecture & design decisions
├── test/rip/            # 25 test files (1,243 tests)
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
               (1,761)     (types.js)     (359)       (arrays + .loc)     (3,293)      + source map
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

### 4a. Raw Heredocs (`'''\` and `"""\`)

Appending `\` to a heredoc opener makes recognized escape sequences (`\n`, `\t`, `\u`, `\x`, `\\`, etc.) stay literal in the output. Useful for embedding code strings, shell scripts, or regex-heavy content where backslashes must pass through unchanged.

```coffee
# Normal heredoc: \n becomes a newline
normal = '''
  hello\nworld
  '''
# Result: "hello" + newline + "world"

# Raw heredoc: \n stays as \n (two characters)
raw = '''\
  hello\nworld
  \'''
# Result: "hello\\nworld" (literal \n)
```

Note: `\s`, `\w`, `\d` and other non-JS-escape sequences are NOT affected — they pass through unchanged in both normal and raw heredocs. Raw mode only affects the sequences that `'''`/`"""` would normally process (`\n`, `\t`, `\r`, `\b`, `\f`, `\v`, `\0`, `\uXXXX`, `\xXX`, `\\`).

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
| `:=` | State | "gets state" | `const x = __state(value)` |
| `~=` | Computed | "always equals" | `const x = __computed(() => expr)` |
| `~>` | Effect | "always calls" | `__effect(() => { ... })` or `const x = __effect(...)` |
| `=!` | Readonly | "equals, dammit!" | `const x = value` (just const) |

The reactive runtime is embedded in compiler.js and only included when needed.

### Two-Way Binding (`<=>`)

In Rip UI render blocks, the `<=>` operator creates bidirectional reactive bindings between parent state and child elements or components. This is a Rip original — it eliminates React's verbose controlled component pattern entirely.

```coffee
# HTML elements
input value <=> @name               # text input
input type: "number", value <=> @age # number input (uses valueAsNumber)
input type: "checkbox", checked <=> @active # checkbox

# Custom components — same operator, same mental model
Dialog open <=> @showConfirm
Select value <=> @role
Switch checked <=> @darkMode
Combobox query <=> @search, value <=> @selected
```

`value <=> username` compiles to two things:
1. **State → DOM**: `__effect(() => { el.value = username; })`
2. **DOM → State**: `el.addEventListener('input', (e) => { username = e.target.value; })`

The compiler auto-detects types — `checked` uses the `change` event, number inputs use `valueAsNumber`. Smart auto-binding also works: `value: @name` where `@name` is reactive generates two-way binding automatically without needing `<=>`.

This is what Vue has with `v-model` and Svelte has with `bind:`, but Rip's version works uniformly across HTML elements and custom components with one operator. React cannot do this — every bindable property requires an explicit `value` prop + `onChange` callback pair. The `<=>` operator makes interactive component usage dramatically cleaner:

```coffee
# React: 8 lines of ceremony
# const [name, setName] = useState('');
# const [show, setShow] = useState(false);
# <input value={name} onChange={e => setName(e.target.value)} />
# <Dialog open={show} onOpenChange={setShow} />

# Rip: 2 lines, done
input value <=> @name
Dialog open <=> @show
```

Implementation: lexer tokenizes `<=>` as `BIND`, the render rewriter transforms `value <=> x` to `__bind_value__: x`, and the component code generator emits the effect + event listener pair. See `src/components.js`.

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

### Test Files (25 files, 1,243 tests)

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
| **docs/RIP-LANG.md** | Full language reference (syntax, operators, reactivity, packages, future ideas) |
| **docs/RIP-TYPES.md** | Type system specification |
| **docs/RIP-INTERNALS.md** | Compiler architecture, design decisions, S-expressions |

---

## Packages

The `packages/` directory contains optional packages that extend Rip for
full-stack development. All are written in Rip, have zero dependencies, and
run on Bun.

### @rip-lang/api (v1.1.10) — Web Framework

Sinatra-style web framework with magic `@` context,
built-in validators, file serving (`@send`), and middleware composition.

| File | Lines | Role |
|------|-------|------|
| `api.rip` | ~662 | Core framework: routing, validation, `read()`, `session`, `@send`, server |
| `middleware.rip` | ~464 | Built-in middleware: cors, logger, sessions, compression, security |

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

### Rip UI (built into rip-lang) — Reactive Web Framework

Zero-build reactive web framework. The browser loads `rip.min.js`
(compiler + pre-compiled UI framework), auto-detects inline components,
and renders with fine-grained DOM updates. Uses Rip's built-in reactive
primitives directly — one signal graph shared between framework and components.

| File | Lines | Role |
|------|-------|------|
| `ui.rip` | ~965 | Unified framework: stash, router (path + hash), renderer, launch |
| `serve.rip` | ~93 | Server middleware: framework bundle, app bundle, SSE hot-reload |

Key concepts:
- **Auto-launch** — `rip-ui.min.js` auto-detects `<script type="text/rip" data-name="...">` components and calls `launch()` automatically. Hash routing is on by default. Configure via `data-url` and `data-hash` attributes on the script tag. No bootstrap script needed.
- **`serve` middleware** — `use serve dir: dir, components: 'routes', includes: ['ui']` registers routes for the framework bundle (`/rip/rip.min.js`), app bundle (`/{app}/bundle`), and SSE hot-reload (`/{app}/watch`)
- **`launch(appBase)`** — Client-side: fetches the app bundle, hydrates the stash, starts the router and renderer
- **`component` / `render`** — Two keywords added to Rip for defining components with reactive state (`:=`), computed (`~=`), effects (`~>`)
- **File-based routing** — `pages/users/[id].rip` → `/users/:id` (Next.js-style). Shared components go in `ui/` via `includes`.
- **Unified stash** — Deep reactive proxy with path navigation, uses `__state` from Rip's built-in reactive runtime
- **Hot reload** — Server sends notify-only SSE events, browser invalidates + refetches + remounts

```coffee
# Server (index.rip)
import { get, use, start, notFound } from '@rip-lang/api'
import { serve } from '@rip-lang/api/serve'

dir = import.meta.dir
use serve dir: dir, components: 'routes', includes: ['ui'], watch: true, title: 'My App'
get '/css/*', -> @send "#{dir}/css/#{@req.path.slice(5)}"
notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'
start port: 3000
```

### @rip-lang/server (v1.1.19) — Production Server

Multi-worker process manager with hot reloading, automatic HTTPS, mDNS service
discovery, and request queueing. Serves any `@rip-lang/api` app (including
Rip UI apps with SSE hot-reload).

| File | Lines | Role |
|------|-------|------|
| `server.rip` | ~1,323 | CLI, workers, load balancing, TLS, mDNS |
| `server.html` | ~420 | Built-in dashboard UI |

```bash
rip-server -w    # Start with file watching + hot-reload
```

### Other Packages

- **@rip-lang/db** — DuckDB server with official UI + ActiveRecord-style client (`db.rip` ~388 lines, `client.rip` ~290 lines)
- **@rip-lang/schema** — ORM + validation with declarative syntax (~505 lines)
- **@rip-lang/swarm** — Parallel job runner with worker threads (~379 lines)
- **@rip-lang/csv** — CSV parser + writer with indexOf ratchet engine (~432 lines)

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

`src/browser.js` (~167 LOC) provides the browser entry point. When loaded,
it registers key functions on `globalThis` and processes inline Rip scripts.

### Key Features

- **Auto-launch** — When bundled as `rip-ui.min.js`, auto-detects
  `<script type="text/rip" data-name="...">` component scripts and calls
  `launch()` automatically with hash routing enabled by default. Configure
  via `data-url` and `data-hash` attributes on the script tag. A
  `__ripLaunched` flag prevents double-launch if `launch()` is called manually.
- **`<script type="text/rip">`** — Inline Rip code compiled and executed on
  `DOMContentLoaded`. Uses an async IIFE wrapper so `!` (await) works.
  Scripts with `data-name` are reserved as component sources (not executed).
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

## Playground

Three playground versions and a demo app in `docs/`, all single HTML files with zero dependencies:

| File | Approach | Lines |
|------|----------|-------|
| `playground-js.html` | Pure JavaScript (reference) | ~1,800 |
| `playground-rip.html` | Rip via `<script type="text/rip">` | ~1,623 |
| `playground-rip-ui.html` | Rip UI component via `launch bundle:` | ~1,595 |
| `demo.html` | Full Rip UI app via `launch bundle:` with hash routing | ~337 |

All three playgrounds share: same CSS, same Monarch tokenizer, same default code sample, same 16 features (live compiler, REPL, example snippets, theme select, dark/light mode, 5 output toggles, resizable panes, source persistence, URL hash routing, keyboard shortcuts).

`demo.html` is a self-contained Rip UI Demo app — all 6 components and CSS inlined, hash-based routing for static hosting. No server required.

Run with `bun run serve` → `http://localhost:3000/playground-rip.html`

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
| `<=>` | Two-way bind | `value <=> name` — bidirectional reactive binding (Rip original) |
| `=~` | Match | `str =~ /pat/` — Ruby-style regex |
| `.new()` | Constructor | `User.new()` — Ruby-style new |
| `::` | Prototype | `String::trim` — `String.prototype.trim` |
| `if...else` | Postfix ternary | `"a" if cond else "b"` — Python-style |
| `[-n]` | Negative index | `arr[-1]` — last element via `.at()` |
| `*` | String repeat | `"-" * 40` — string repetition |
| `<` `<=` | Chained | `1 < x < 10` — chained comparisons |
| `\|>` | Pipe | `x \|> fn` or `x \|> fn(y)` — first-arg pipe |
| `.=` | Method assign | `x .= trim()` — `x = x.trim()` (Rip original) |
| `*` | Merge assign | `*obj = {a: 1}` — `Object.assign(obj, ...)` (Rip original) |
| `not in` | Not in | `x not in arr` — negated membership |
| `loop n` | Repeat N | `loop 5 -> body` — repeat N times |
| `it` | Implicit param | `-> it > 5` — auto-injected parameter |
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
