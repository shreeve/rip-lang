# AI Agent Guide for Rip

**Purpose:** This document helps AI assistants understand and work with the Rip language compiler and its ecosystem of packages.

**What is Rip:** An elegant reactive language that compiles to modern JavaScript (ES2022), featuring zero dependencies, self-hosting capability, and built-in reactivity primitives.

Detailed subsystem notes live in nested `AGENTS.md` files in the relevant directories (`src/`, `docs/`, `packages/ui/`, `packages/vscode/`, `packages/stamp/`, `test/types/`).

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

### File Editing Rules

| File                      | Can Edit? | Notes                                                  |
| ------------------------- | --------- | ------------------------------------------------------ |
| `src/compiler.js`         | Yes       | Code emitter (`CodeEmitter`); main compiler work       |
| `src/lexer.js`            | Yes       | Lexer and rewriter                                     |
| `src/types.js`            | Yes       | Type system sidecar                                    |
| `src/components.js`       | Yes       | Component system sidecar                               |
| `src/schema.js`           | Yes       | Schema system sidecar (`schema` keyword)               |
| `src/grammar/grammar.rip` | Carefully | Run `bun run parser` after changes                     |
| `src/parser.js`           | Never     | Generated file                                         |
| `src/sourcemaps.js`       | Yes       | Source map generator                                   |
| `src/browser.js`          | Yes       | Browser entry point                                    |
| `rip-loader.js`           | Yes       | Bun plugin for `.rip` compilation and import rewriting |
| `src/grammar/solar.rip`   | Never     | Given parser generator                                 |
| `test/rip/*.rip`          | Yes       | Test files                                             |

### Critical Rules

- **Never guess what code does — verify it.** Before claiming something is unnecessary, redundant, or works a certain way, read the source. This applies to Rip internals, packages, and external dependencies alike. If you can't verify, say so.
- **Never edit `src/parser.js`** — it is generated
- **Never edit `src/grammar/solar.rip`** — it is given
- **Never commit without running tests** — `bun run test` must pass
- **Never add dependencies** — zero dependencies is a core principle
- **Never read or execute scripts directly** — use `bun run <name>`
- **Never write `x ? y` in Rip** — binary existential was removed; use `x ?? y` or full ternary `x ? y : z`
- **Never write `await fn(args)` in `.rip` source when `fn!` will do** — the dammit operator is the idiomatic form. `fetch! url` compiles to `await fetch(url)`; `User.find! 1` to `await User.find(1)`; `user.save!` to `await user.save()`. Reserve raw `await` for JS interop in `.js` files, tests that document the await→!  equivalence, and the rare cases where `fn!` is ambiguous with a dammit-returning expression.
- Run `bun run parser` after grammar changes
- Run `bun run build` after codegen, `components.js`, `browser.js`, or `app.rip` changes
- Run `bun run build:schema-runtime` after editing any `src/schema/runtime-*.js` fragment (CI's `test:schema-fresh` fails on staleness)
- Run `bun run bump` for the standard release flow

### Known Issues

- **Parser: postfix `for` on an implicit method call binds the comprehension as the call's argument and absorbs the next sibling statement.** `obj.method arg for arg as iter` parses as `obj.method(arg for arg as iter)` (one call, array-as-argument) instead of `(obj.method arg) for arg as iter` (a comprehension that calls the method per iteration). When a sibling `if` block follows on the next line, it gets pulled in as a *second argument* to the call instead of remaining a separate statement. Two sites in `src/grammar/solar.rip` (lines 158 and 482) work around this with explicit `for` blocks (search "workaround: postfix-for on call"). Pinned by tests at `test/rip/comprehensions.rip` `forward for-of comprehension` and adjacent. **Real fix needed in the lexer rewriter / grammar:** terminate the implicit-call argument list before the postfix `for`, so the comprehension wraps the call rather than becoming an argument. Until that's fixed, user code hitting this pattern needs the explicit-for-loop workaround.

## Compilation Pipeline

```text
Rip Source -> Lexer -> emitTypes -> Parser -> S-Expressions -> CodeEmitter -> JavaScript
                       (types.js)           (arrays + .loc)                  + source map
                          ↓
                       file.d.ts (when types: "emit")
```

**Key insight:** S-expressions are simple arrays like `["=", "x", 42]`, not large AST objects.

Detailed compiler, lexer, and component internals are in `src/AGENTS.md`.

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

Component testing notes are in `src/AGENTS.md`. Type-system and audit guidance is in `packages/vscode/AGENTS.md` and `test/types/AGENTS.md`.

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

### Rip App

Application framework built into Rip — stash, resource, timing, components store, file-based router, renderer, launch, and shared ARIA helpers. Lives in `src/app.rip`, compiled into `rip.min.js` so a single `<script src="rip.min.js">` is enough to build a complete app. `<script type="text/rip">` sources compile into one shared scope, and the framework renders with fine-grained DOM updates.

(Rip UI is the separate widget package at `packages/ui/` — `Dropdown`, `MultiSelect`, `Combobox`, etc. — distributed as `@rip-lang/ui`. The two terms do not overlap.)

Key ideas:

- shared scope across all Rip script tags
- bundle mode via `data-src`
- stash seeded from `data-state`
- file-based routing
- hot reload through `/watch`

Component naming in render templates:

- **PascalCase** names are child components — must start with uppercase, contain at least one lowercase letter, and have no underscores (`App`, `AuthScreen`, `HomeSection`)
- **ALL_CAPS** names are regular variables/constants, not components (`DEFAULT_SCREEN`, `SECTIONS`, `MAX_RETRIES`)
- **Lowercase** names are DOM elements (`div`, `span`, `button`)

Stash reactivity in components:

- Inside a component's `render`, only expressions rooted at `this` (`@app.data...`, component members) are tracked as reactive by the compiler
- Shared-scope variables are treated as static — they render once and never update
- To use stash data reactively, declare a component-local binding: `theme = @app.data.theme`

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
- `@rip-lang/swarm` — worker-thread job runner
- `@rip-lang/csv` — CSV parser and writer
- `@rip-lang/http` — zero-dependency HTTP client
- `@rip-lang/print` — syntax-highlighted code printer
- `@rip-lang/time` — tiny immutable date/time library with IANA timezones + Duration (US-English, zero runtime deps; dayjs is devDependency for parity tests)
- `packages/ui/` — headless UI widgets written in Rip
- `packages/vscode/` — VS Code / Cursor extension

### Package Development

- packages use `workspace:*` linking
- after modifying a package locally, run `bun install` from the project root
- packages written in Rip need the loader, so run from the root or use `rip server`
- `import.meta.dir` resolves to the package's actual filesystem path
- `@rip-lang/server` binds `this` to the request context

### Dev machine setup — run from source, not from npm

The dev workflow in this repo is to **run everything out of the checkout**, not from installed npm packages. Three scripts enforce that:

| Script | When it runs | What it does |
| --- | --- | --- |
| `bun run link-global` | once per machine, manual | Symlinks CLIs (`rip`, `rip-db`, `rip-print`, `rip-server`) into `~/.bun/bin/`, symlinks `rip-lang` and every `@rip-lang/<pkg>` into `~/node_modules/` and `~/.bun/install/global/node_modules/`, and strips any npm-installed `rip-lang` from bun's global manifest so `bun i -g anything` can't silently shadow the workspace |
| `bun run link-local` | auto, every `bun install` (postinstall) | Replaces every `node_modules/.bun/rip-lang@*/node_modules/rip-lang/` cache inside this repo with a symlink to the repo root, plus re-links top-level `node_modules/rip-lang` |
| `bun run link-check` | auto, every `bun install` (postinstall) | Guardrail: verifies `require.resolve('rip-lang/package.json')` lands inside the repo. If a stale tarball is shadowing the workspace it fails fast with a `rm -rf node_modules bun.lock && bun install` remediation |

After `bun run link-global`, every `rip server` invocation — from any cwd — executes `packages/server/server.rip` in this workspace via `packages/server/bin/rip-server` and its `import.meta.url` lookup. Edits to `packages/server/*` are picked up on the next run. **No publish, no `bun add -g`, no copy of `@rip-lang/server` anywhere — only symlinks pointing back at this repo.**

The `bin/rip` subcommand dispatch (`bin/rip-<name>` → `bin/<name>` → `packages/*/bin/rip-<name>` → local `node_modules/.bin` → PATH) converges on the workspace at either step 3 (when cwd is inside the repo) or step 5 (when `rip-server` on the global PATH is the link-global symlink). Either path runs workspace code.

Use `bun run bump` for full rip-lang releases; publishing `@rip-lang/server` and friends to npm is for downstream consumers outside this repo, not for using them locally.

Widget conventions and gotchas are in `packages/ui/AGENTS.md`. Browser runtime details are in `docs/AGENTS.md`.

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

> **CRITICAL — `?` operator rules (AI agents read this carefully):**
>
> - `x ? y : z` — VALID (ternary, requires both `: z` branch)
> - `x ? y` — **INVALID, DO NOT USE** (binary existential was removed)
> - `x ?? y` — VALID (nullish coalescing, replaces the old `x ? y`)
> - `x?` — VALID (existence check, compiles to `x != null`)
>
> The most common AI mistake is writing `x ? y` to mean "if x exists, use y".
> That syntax does not exist in Rip. Always use `x ?? y` for nullish coalescing
> or `x ? y : z` for a full ternary. There is no two-operand `?` form.

> **CRITICAL — no comma before a trailing `->` arrow:**
>
> - `sketch "xy" ->` — CORRECT
> - `sketch "xy", ->` — WRONG (unnecessary comma)
> - `get '/path' ->` — CORRECT
> - `get '/path', ->` — WRONG
>
> When a `->` function is the last argument to a call, do **not** put a comma
> before it. The arrow implicitly closes the argument list. This applies to
> all calls: `get`, `post`, `sketch`, `test`, `setTimeout`, etc.

> **CRITICAL — use the dammit operator, not raw `await`, in `.rip` source:**
>
> - `fetch! url` — CORRECT (compiles to `await fetch(url)`)
> - `await fetch(url)` — WRONG in `.rip` source (JS idiom leaking in)
> - `User.find! 1` — CORRECT
> - `user.save!` — CORRECT (no parens needed)
> - `User.where(active: true).all!` — CORRECT (dammit only on the
>   terminating call in a chain; `.where/.order/.limit` are sync)
> - `await User.find(1)` — WRONG (write `User.find! 1`)
>
> `!` is Rip's native async marker. It handles the `await`, inserts the
> call parens if absent, and reads more cleanly in a chain. Reserve raw
> `await` for JS/TS interop files, test fixtures that document the
> equivalence, or the rare case where `fn!` is ambiguous with a
> dammit-returning expression (basically never).

> **CRITICAL — don't shadow Rip's injected globals:**
>
> Rip auto-injects these helpers into `globalThis` at the top of every
> compiled file (see the Standard Library table below): `p`, `pp`,
> `warn`, `kind`, `assert`, `abort`, `exit`, `noop`, `rand`, `sleep`,
> `todo`, `raise`, `zip`. If you declare a local variable with the same
> name, the compiler emits code that silently mis-references them, with
> failure modes that don't mention shadowing at all — common ones
> include strict-mode "Duplicate parameter name" errors and
> "`x` is not defined" at runtime:
>
> - `p = navigator.clipboard.writeText(...)` — WRONG (shadows `globalThis.p` = `console.log`)
> - `prom = navigator.clipboard.writeText(...)` — CORRECT
> - `warn = condition ? 'yellow' : 'red'` — WRONG (shadows `globalThis.warn` = `console.warn`)
> - `lvl = condition ? 'yellow' : 'red'` — CORRECT
>
> If you catch yourself using a short name that matches any Standard
> Library helper, rename. One-letter names like `p` are particularly
> risky.

### Removed (from CoffeeScript / Rip 2.x)

| Feature                            | Replacement                                           |
| ---------------------------------- | ----------------------------------------------------- |
| postfix spread/rest (`x...`)       | prefix only: `...x`                                   |
| prototype access (`x::y`, `x?::y`) | `.prototype` or class syntax                          |
| **binary existential (`x ? y`)**   | **`x ?? y` (NEVER use `x ? y`, it is not valid Rip)** |
| `is not` contraction               | `isnt`                                                |
| `for x from iterable`              | `for x as iterable`                                   |

### Added

| Feature               | Syntax           | Purpose                                    |
| --------------------- | ---------------- | ------------------------------------------ |
| ternary operator      | `x ? a : b`      | JS-style ternary (must have both branches) |
| postfix ternary       | `a if x else b`  | Python-style ternary                       |
| `for...as` iteration  | `for x as iter`  | iterable loop                              |
| `as!` async shorthand | `for x as! iter` | shorthand for `for await`                  |
| presence check        | `x?!`            | truthy-or-undefined Houdini operator       |
| optional chain assign | `x?.prop = val`  | guarded assignment                         |
| tagged template `$`   | `sh $"cmd #{x}"` | injection-safe tagged template             |
| dotted keys           | `{a.b: 1}`       | flat string key in object literals         |
| map literal           | `*{a: 1}`        | real `Map` with any key type               |
| symbol literal        | `:redo`          | interned symbol via `Symbol.for('redo')`   |

### Kept

| Feature               | Syntax                    | Compiles to          |
| --------------------- | ------------------------- | -------------------- |
| existence check       | `x?`                      | `(x != null)`        |
| optional chaining     | `a?.b`, `a?.[0]`, `a?.()` | JS optional chaining |
| optional shorthand    | `a?[0]`, `a?(x)`          | `a?.[0]`, `a?.(x)`   |
| nullish coalescing    | `a ?? b`                  | `a ?? b`             |
| dammit operator       | `fetchData!`              | `await fetchData()`  |

---

## Quick Reference

### Unique Operators

| Operator    | Name             | Example                      |
| ----------- | ---------------- | ---------------------------- |
| `!`         | Dammit           | `fetchData!`                 |
| `!`         | Void             | `def process!`               |
| `=!`        | Readonly         | `MAX =! 100`                 |
| `?!`        | Presence         | `@checked?!`                 |
| `?`         | Existence        | `x?`                         |
| `//`        | Floor div        | `7 // 2`                     |
| `%%`        | True mod         | `-1 %% 3`                    |
| `:=`        | State            | `count := 0`                 |
| `~=`        | Computed         | `doubled ~= count * 2`       |
| `<=>`       | Two-way bind     | `value <=> name`             |
| `=~`        | Match            | `str =~ /pat/`               |
| `.new()`    | Constructor      | `User.new()`                 |
| `::`        | Prototype        | `String::trim`               |
| `if...else` | Postfix ternary  | `"a" if cond else "b"`       |
| `[-n]`      | Negative index   | `arr[-1]`                    |
| `*`         | String repeat    | `"-" * 40`                   |
| `<` `<=`    | Chained          | `1 < x < 10`                 |
| `\|>`       | Pipe             | `x \|> fn`                   |
| `.=`        | Method assign    | `x .= trim()`                |
| `?.=`       | Optional assign  | `el?.style.display = "none"` |
| `=`         | Render text      | `= item.textContent`         |
| `*>`        | Merge assign     | `*>obj = {a: 1}`             |
| `not in`    | Not in           | `x not in arr`               |
| `loop n`    | Repeat N         | `loop 5 -> body`             |
| `it`        | Implicit param   | `-> it > 5`                  |
| `or return` | Guard            | `x = get() or return err`    |
| `?? throw`  | Nullish guard    | `x = get() ?? throw err`     |
| `%w`        | Word literal     | `%w[foo bar baz]`            |
| `$"..."`    | Tagged template  | `sh $"cmd #{val}"`           |
| `a.b:`      | Dotted key       | `{host.name: "x"}`          |
| `*{ }`      | Map literal      | `*{/pat/: val, a: 1}`       |
| `:name`     | Symbol literal   | `:redo`, `:skip`, `:active`  |
| `.{ }`      | Pick             | `user.{firstName, lastName}` |
| `?.{ }`     | Optional pick    | `maybeUser?.{a, b}`          |

### Standard Library

Rip injects helpers via `globalThis` in compiled output, the CLI REPL, and the browser REPL.

| Function          | Description                      |
| ----------------- | -------------------------------- |
| `abort(msg?)`     | log to stderr, exit with code 1  |
| `assert(v, msg?)` | throw if falsy                   |
| `exit(code?)`     | exit process                     |
| `kind(v)`         | lowercase type name              |
| `noop()`          | no-op                            |
| `p(...args)`      | `console.log` shorthand          |
| `pp(v)`           | pretty-print JSON, returns value |
| `raise(a, b?)`    | throw error                      |
| `rand(a?, b?)`    | random number                    |
| `sleep(ms)`       | promise-based delay              |
| `todo(msg?)`      | throw not implemented            |
| `warn(...args)`   | `console.warn` shorthand         |
| `zip(...arrays)`  | zip arrays pairwise              |

All helpers use `??=` so they can be overridden.

### Tagged Templates (`$"..."`)

The `$` prefix turns a string into a tagged template literal, preventing injection
attacks across shell commands, SQL queries, HTML output, and any other context
where interpolated values must not become code.

```coffee
sh  $"incus init #{image} #{name}"          # shell — safe argv
sql $"SELECT * FROM users WHERE id = #{id}" # SQL — parameterized query
html $"<p>Hello, #{name}</p>"               # HTML — escaped output
```

The `$` works with all string forms:

| Syntax       | Interpolation | Tagged template      |
| ------------ | ------------- | -------------------- |
| `$"..."`     | yes           | yes                  |
| `$'...'`     | no            | yes                  |
| `$"""..."""` | yes           | yes — tagged heredoc |
| `$'''...'''` | no            | yes — tagged heredoc |

How it works: the `$` is a visual bridge between an identifier and a string.
The lexer rewriter strips the `$` and attaches the string directly to the
preceding identifier, triggering the existing `Value String` → `tagged-template`
grammar rule. The compiler emits a JavaScript tagged template literal.

The receiving function detects mode via `kind(args[0])`:
- `'array'` with `.raw` → tagged template (strings + values separated)
- `'array'` without `.raw` → plain argv array (direct exec)
- `'string'` → regular string (shell interpretation)

### Symbol Literals (`:name`)

Ruby-style symbol literals. `:name` compiles to `Symbol.for('name')` — globally
interned, so `:redo === :redo` is true everywhere without imports.

```coffee
status = :active
x = :redo

# Symbols are real JavaScript symbols
typeof :redo            # "symbol"
:redo is :redo          # true (interned)
:redo isnt :skip        # true

# Use anywhere a value is expected
arr = [:a, :b, :c]
obj = {status: :active}
fn :redo, :skip         # implicit call with symbol args

# Switch on symbols
switch state
  when :ready then start()
  when :done then finish()

# Interned — matches Symbol.for
:test is Symbol.for("test")  # true
```

The colon must be immediately followed by an identifier character (no space).
This is unambiguous with all other colon uses in Rip:

| Syntax | Meaning |
| --- | --- |
| `:redo` | Symbol literal |
| `:=` | Reactive assign |
| `::` | Prototype access / type annotation |
| `name:` | Property key |
| `? a : b` | Ternary branch (space after `:`) |

### Error Suppression (`try` without `catch`)

In Rip, a bare `try` compiles to `try {} catch {}` in JavaScript. This is
functionally identical to `try ... catch then null`, which adds a useless
`null;` statement inside the catch. **Prefer bare `try`** for fire-and-forget
error suppression — it's cleaner and the intent is obvious.

```coffee
# Preferred — bare try
try unlinkSync(path)
try server.stop()

# Avoid — redundant catch
try unlinkSync(path) catch then null
try
  proc.kill()
catch
  null
```

Use an explicit `catch` only when the catch body does actual work:

```coffee
# Good — catch does real work
try
  pkg = JSON.parse(readFileSync(path, 'utf8'))
catch
  console.log 'version unknown'

# Good — catch with error variable
try
  something()
catch e
  console.error "failed: #{e.message}"
```

### Reactivity

Rip reactivity is built into the language, not imported from a library.

| Operator | Name            | Output                             |
| -------- | --------------- | ---------------------------------- |
| `=`      | assign          | `let x; x = value`                 |
| `:=`     | state           | `const x = __state(value)`         |
| `~=`     | computed        | `const x = __computed(() => expr)` |
| `~>`     | effect          | `__effect(() => { ... })`          |
| `=!`     | readonly        | `const x = value`                  |
| `offer`  | context provide | state + `setContext(...)`          |
| `accept` | context consume | `getContext(...)`                  |

Three-tier state model:

| Tier           | Scope               | Mechanism                           | Example                   |
| -------------- | ------------------- | ----------------------------------- | ------------------------- |
| Props          | parent to child     | `value <=> x`, `placeholder: "..."` | configuring a widget      |
| Offer / Accept | ancestor to subtree | keywords                            | tabs sharing active state |
| Stash          | app-wide            | shared reactive proxy               | auth state, theme         |

Two-way binding (`<=>`) compiles to an effect that pushes signal state into the DOM plus an event listener that writes DOM changes back. On components, the parent passes the signal via `__bind_propName__` so parent and child share the same signal object.

Implementation details are in `src/AGENTS.md`.

### Schemas

Rip schemas are a first-class language keyword that covers runtime
validation, domain shapes, enums, reusable field bundles, and DB-backed
models — one `schema` block declares the whole thing and shadow
TypeScript types fall out automatically.

| Kind      | Use for                                                    |
| --------- | ---------------------------------------------------------- |
| `:input`  | request-body / form validator (the default)                |
| `:shape`  | validator + instance methods + computed getters            |
| `:enum`   | closed set of `:symbol` members                            |
| `:mixin`  | reusable field group, composed via `@mixin Name`           |
| `:model`  | DB-backed: ORM (`find`/`where`/`create`/`save`/`destroy`), DDL (`.toSQL()`), hooks, relations |

Body forms (six declarative line shapes):

| Form                     | Example                                         |
| ------------------------ | ----------------------------------------------- |
| Field                    | `name! 1..50` (type slot optional, defaults to `string`) |
| Inline field transform   | `email!, -> it.email.toLowerCase()`            |
| Directive                | `@timestamps`, `@mixin Name`, `@belongs_to User?` |
| Method                   | `name: -> body`                                 |
| Computed getter (lazy)   | `name: ~> body`                                 |
| Eager-derived field      | `name: !> body` (materialized once, stored as own property) |

Cross-field invariants use `@ensure`:

```coffee
Signup = schema :input
  password!  8..100
  password2! 8..100
  @ensure "passwords must match", (u) -> u.password is u.password2
```

Full reference: [`docs/RIP-SCHEMA.md`](./docs/RIP-SCHEMA.md). Compiler
internals and parser invariants: [`src/AGENTS.md`](./src/AGENTS.md).

---

## Loader and CLI

The loader (`rip-loader.js`) is a Bun plugin preloaded by `bin/rip` or `bunfig.toml`.

Responsibilities:

1. compile `.rip` files on the fly via `compileToJS()`
2. rewrite `@rip-lang/*` imports to absolute paths after compilation

The import rewrite is necessary because Bun worker threads do not respect `NODE_PATH`, and `onResolve` does not fire for imports introduced by `onLoad`-compiled source.

`bin/rip` sets `NODE_PATH` to include its parent `node_modules` directory and passes `env: process.env` into child process spawns. This works around Bun not inheriting `process.env` changes unless `env` is passed explicitly.

Known Bun bugs:

| Bug                                                                      | Workaround                                    |
| ------------------------------------------------------------------------ | --------------------------------------------- |
| `process.env` changes not inherited by `spawn` / `spawnSync`             | pass `env: process.env` explicitly            |
| `NODE_PATH` ignored by worker threads                                    | rewrite imports to absolute paths in `onLoad` |
| plugin `onResolve` does not fire for imports in `onLoad`-compiled source | rewrite imports inside `onLoad`               |
| `require.resolve({ paths })` ignores `paths` in plugin handlers          | use `import.meta.resolve`                     |

---

## API Route Handler Pattern

API route handlers in `**/api/routes/*.rip` follow five phases: **auth, read, meta, work, send**.

1. **auth** — Who is the caller? Use a scope helper (`userScope!`, `adminScope!`) or mark as `# public`. Exits 401/403 on failure.
2. **read** — What did they send? `read 'name', 'validator'` for all inputs. No logic, no queries.
3. **meta** — Derived values and preconditions. Construct variables from auth + read, load related records, check error conditions. Bail before any mutations.
4. **work** — Do the thing. Create records, update state, call services. Everything needed should already be in named variables.
5. **send** — The final expression. Usually an object literal for JSON, but could be HTML, a file via `@send`, a redirect, etc.

Guidelines:

- Omit phases that don't apply — no empty comments.
- Use phase comments (`# auth`, `# read`, etc.) when the handler is long enough to benefit from visual separation.
- Public endpoints use `# public` instead of a scope call.
- Early exits belong to their phase — auth failures in auth, preconditions in meta.
- Use `error!` for HTTP errors, `notice!` for user-facing messages, `bail!` to destroy session and force-logout.

```coffee
post '/create' ->
  # auth
  user = userScope!

  # read
  week     = read 'week', 'int!'
  slot     = read 'slot', 'text!'
  children = read 'children', 'json'

  # meta
  needed = children?.length or 1
  spots = sql! '...', [week, slot, 'available', needed]
  error! 'Not enough spots', 409 unless spots.data?.length >= needed

  # work
  booking = Booking.create!({ user_id: user.id, week, slot, children: children or [] })
  for row in spots.data
    sql! '...', ['booked', booking.id, row[0]]

  # send
  { bookingId: booking.id }
```

---

## Reflect Before Finalizing

Before finalizing your work, take a moment to step back.

Review what you've built. Read through the changes as if seeing them for the first time.

Ensure everything is clean, clear, consistent, correct, concise, and efficient.

Question your approach. Now that you've implemented this, is there anything you'd do differently? Are the data structures right? Is information flowing through the system in the most natural way? If you were starting over with what you know now, would you make the same choices?

Look for improvements. If something feels off, fix it now rather than noting it for later. Small refactors compound — clean code invites more clean code.

Gather more context if you're uncertain. Pull up related code. Trace through the system. Sometimes the right answer becomes obvious once you see more of the picture.

Do the work, not the meta-work. Improve the code itself. Don't write reflection documents.

---

**For AI assistants:** Trust the tests, use the debug tools, follow existing patterns, and consult the nested `AGENTS.md` files for deeper subsystem details.
