<p><img src="docs/rip.svg" alt="Rip Logo" width="100"></p>

# Changelog

All notable changes to Rip will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.8.10] - 2026-02-17

### Compiler — Bug Fix

- **Fixed `or throw` variable hoisting bug** — The `x = expr or throw` pattern inside function bodies was erroneously adding the target variable to the program-level `programVars` set. This "poisoned" the variable filter for subsequent sibling functions, causing them to omit local `let` declarations and produce `ReferenceError` at runtime. Most notably, this broke `@rip-lang/api`'s `store` variable when multiple exported functions used the pattern. Fixed by removing the incorrect `programVars.add()` call from `generateAssignment`.

### Schema — New Features

- **`Model.fromSchema()` bridge** — ORM models can now auto-configure their schema, table name, and primary key directly from a parsed `.schema` AST via `Model.fromSchema(schema, 'ModelName')`, eliminating manual field re-declaration.
- **Dependency-ordered SQL DDL** — `emit-sql.js` now topologically sorts tables so foreign key references are always defined before use.
- **`app-demo.rip` example** — Rewrote the schema demo in Rip (was JavaScript), showcasing TypeScript generation, SQL DDL, and runtime validation from a single `.schema` file.

## [3.8.9] - 2026-02-16

### Compiler — Grammar Desugaring & Cleanup

- **`until` desugared to `while`** — Grammar now emits `["while", ["!", cond], ...]` directly, eliminating `generateUntil` from the compiler. Also fixes the `until...when` guard bug where the guard expression was silently dropped.
- **`unless` desugared to `if`** — Grammar now emits `["if", ["!", cond], ...]` for all `unless` forms, removing ~20 `unless`-specific code paths from the compiler (dispatch table, postfix conditionals, assignment handlers, return/throw handlers, control flow analysis).
- **`toSearchable` renamed to `toMatchable`** — The regex helper name now matches the `.match()` API it wraps.
- **Added missing `%%=` handler** — The mathematical modulo assignment operator now works correctly instead of crashing during code generation.

## [3.8.8] - 2026-02-16

### Compiler — Refactoring & Cleanup

- **Comprehension generator deduplication** — Extracted shared `_forInHeader`, `_forOfHeader`, and `_forAsHeader` helpers, consolidating loop header construction across `generateComprehension`, `generateComprehensionWithTarget`, and `generateComprehensionAsLoop`.
- **Cleaner for-of loop output** — `for own k of obj` now generates flatter JavaScript using `continue` guard clauses instead of nested `if` blocks.
- **Component child deduplication** — Extracted `appendChildren` helper in `components.js`, consolidating duplicate child-processing logic from `generateTag` and `generateDynamicTag`. Also fixed a missing `componentMembers` check in `generateDynamicTag`.
- **Dead code removal** — Removed unused `break-if` and `continue-if` compiler handlers (the grammar handles these through the normal `if` path).

### REPL — Bug Fix

- **Comprehension crash fix** — The REPL now correctly handles multi-line expressions (comprehensions, IIFEs). Previously, the result capture logic produced broken JavaScript by prepending `__result =` to the closing `})();` line instead of the expression start.

### Documentation

- Fixed inaccurate content on the Rip UI demo About page (compiler/framework sizes, architecture description).

## [3.8.7] - 2026-02-14

Rip UI loading optimization (combined bundle, build-time compilation, FOUC prevention). See `packages/ui/CHANGELOG.md` v0.3.2.

## [3.8.6] - 2026-02-13

### Compiler — Render Block Fix

- **Render block fix** — Identifiers matching HTML tag names (e.g., `title`) are no longer misclassified as template elements when preceded by control flow keywords (`if`, `unless`, `while`, `until`, `when`).

Rip UI hash routing and static demo. See `packages/ui/CHANGELOG.md` v0.3.1.

## [3.8.5] - 2026-02-13

### Build — GitHub Pages Fixes

- **Copy ui.rip instead of symlink** — `bun run browser` now copies `packages/ui/ui.rip` to `docs/dist/ui.rip` on every build. Symlinks return 404 on GitHub Pages.
- Fixed Async example to use clean chained `!` syntax now that precedence is correct.

## [3.8.4] - 2026-02-13

### Compiler — Chained Dammit Operator Fix

- **Chained `!` parenthesization** — `fetch!(url).json!` now correctly compiles to `await (await fetch(url)).json()` instead of `await await fetch(url).json()` which had wrong JS precedence. The `await` from `!` metadata is now parenthesized when used as a property access base.
- Playground Async example restored to clean `fetch!(url).json!` syntax.
- 2 new tests (1,241 total).

## [3.8.3] - 2026-02-13

### Lexer — Heregex Forward Slash Escaping

- **Auto-escape `/` in heregex** — Forward slashes inside `///...///` are now automatically escaped to `\/` in the compiled regex literal. Previously required manual `\/` escaping, defeating the purpose of heregex.
- 1 new test (1,239 total).

## [3.8.2] - 2026-02-13

### Compiler — Class Constructor Fixes

- **`@param` defaults in constructors** — `constructor: (@count = 0) ->` now correctly compiles to `constructor(count = 0) { this.count = count; }` instead of producing invalid `(.,this,count)` syntax.
- **`super` with `@param` in subclass constructors** — `constructor: (@name) -> super @name, "woof"` now compiles to `constructor(_name) { super(_name, "woof"); this.name = _name; }` using a temporary parameter to avoid illegal `this` access before `super()`.
- **Single-expression constructor autoAssignments** — `@param` assignments are now emitted in single-expression constructor bodies (previously only worked in block bodies).
- 3 new tests (1,238 total).

## [3.8.1] - 2026-02-13

### Playground — Fix Class Examples

- **Constructor syntax fix** — All playground examples now use `constructor: (@name) ->` instead of the bare `(@name) ->` shorthand, which produced invalid JS output.

## [3.8.0] - 2026-02-12

### Playground — Example Snippets & Source Persistence

- **Example snippets dropdown** — 6 curated examples (Basics, Reactive State, Classes, Regex & Strings, Async & Dammit, Full Demo) plus a Custom option for user code.
- **Source persistence** — Editor content saved to localStorage with 2-second debounce, restored on page load.
- **Auto-switch to Custom** — Editing code after selecting an example automatically switches the dropdown to Custom.
- Applied to all three playground versions (playground-rip.html, playground-js.html, playground-rip-ui.html).

### Language — Raw Heredocs

- **Raw heredocs (`'''\` and `"""\`)** — Appending `\` to a heredoc opener keeps JS escape sequences (`\n`, `\t`, `\u`, `\x`, `\\`) literal in the output.
- **`.class` shorthand fix** — `div.foo` or `.foo` with indented children in render blocks now produces correct JS.

### Parser — Recursive Descent Generator

- **Lunar grammar** (`src/grammar/lunar.rip`) — New recursive descent parser generator producing `src/parser-rd.js`.
- **98.3% test parity** — 1,162 of 1,182 tests passing with the generated parser.

## [3.7.4] - 2026-02-12

### Compiler — Reactive Scoping & Component Fixes

- **Effect cleanup** — `__effect` now captures return values as cleanup functions, run before re-execution and on disposal. Backward-compatible.
- **Component scope leak** — `collectProgramVariables` no longer recurses into component bodies. Inner `:=` variables don't pollute the outer scope.
- **Object key reactive transform** — Object literal keys are no longer transformed to `key.value` when the key name matches a reactive variable.
- **Component effect index** — Fixed `effect[1]` → `effect[2]` for the body of `~>` in components.
- **Component effect wrapping** — Effects now wrapped in `() => { expr; }` for proper reactivity.
- **Dot-chain property names** — `app.data.count` no longer transforms `count` as a reactive member when it's a property name in a dot chain.
- **Reactive prop passthrough** — `buildComponentProps` passes `:=` members as signals (not values) to child components. Child's `__state` returns the signal as-is.
- **Child unmounting** — `generateChildComponent` tracks child instances in `_children`. `__Component.unmount()` cascades depth-first.

### Compiler — Nested Function Scope Chain

- **Scope stack for variable hoisting** — Nested functions no longer re-declare variables from enclosing function scopes. Previously, the compiler only checked program-level variables; now it tracks a full scope chain. Fixes incorrect `let` shadowing in deeply nested function patterns (e.g., `mountRoute` inside `createRenderer` in `ui.rip`).

### Rip UI — Demo App Working

- **Router `navigating` getter/setter** — The `_navigating` signal is now accessible through `router.navigating` (read/write), fixing a cross-scope reference where `createRenderer` accessed a variable local to `createRouter`.
- **Component props passthrough** — `__Component` base class now assigns all props to `this` via `Object.assign(this, props)` before `_init`, so components can access `@router`, `@app`, `@params` etc.

### Language — `*@` Merge-This

- **`*@ = props`** — New merge-assign variant for `this`. Compiles to `Object.assign(this, props)`. Natural extension of `*obj = expr` — no `??=` guard needed since `this` is never null.

## [3.7.3] - 2026-02-11

### Fixes & Polish

- **Interface `::` fix** — `::` type annotations in interface bodies no longer produce double colons in `.d.ts` output.
- **`.=` dot chain support** — `obj.name .= toUpperCase()` now works (walks back full property chain).
- **`*` merge auto-init** — `*foo = {...}` auto-creates `foo` if undefined via `??= {}`.
- **`loop n` uses `it`** — Loop counter is accessible as `it` inside the body.
- **Syntax highlighting** — `|>` pipe operator added to VS Code, Vim, Playground, and rip-print.

## [3.7.0] - 2026-02-11

### Pipe Operator (`|>`)

- **First-arg insertion pipe** — `x |> fn` compiles to `fn(x)`, and `x |> fn(y)` compiles to `fn(x, y)`. Combines the simplicity of F#-style pipes with multi-arg support like Elixir — no placeholder syntax needed. Left-associative, chains naturally: `5 |> double |> add(1)`.
- Works with dotted references (`x |> Math.sqrt`, `x |> console.log`) and dotted calls (`x |> obj.method(y)` → `obj.method(x, y)`).
- Implicit calls close at pipe boundaries — `x |> fn 1 |> bar 2` works correctly without parens.

### Method Assignment (`.=`) — A Rip Original

- **Compound method assignment** — `x .= trim()` compiles to `x = x.trim()`. The method-call equivalent of `+=`. No other language has this. Combined with implicit `it`, enables concise transformation pipelines: `items .= filter -> it.active` then `items .= map -> it.name`.

### Prototype Operator (`::`)

- **CoffeeScript-style prototype access restored** — `String::trim` compiles to `String.prototype.trim`. Disambiguated from type annotations by spacing: `::` with no space is prototype, `::` with a space is a type annotation. Both coexist cleanly.

### `loop n` — Repeat N Times

- **Counted loop** — `loop 5 -> body` compiles to `for (let _i = 0; _i < 5; _i++) { body }`. Works with literals, variables, and expressions.

### Implicit `it` Parameter

- **Auto-injected parameter** — Arrow functions with no explicit params that reference `it` in the body automatically inject `it` as the parameter. `arr.filter -> it > 5` compiles to `arr.filter(function(it) { return (it > 5); })`. Works with both `->` and `=>`. Stops at nested function boundaries.

### Negative Indexing

- **Python-style negative indexing** — `arr[-1]` compiles to `arr.at(-1)`, `arr[-2]` to `arr.at(-2)`, etc. Works on arrays and strings. Optional variant: `arr?[-1]` → `arr?.at(-1)`. Only literal negative numbers trigger the transform; variable indexes pass through unchanged.

### Browser Runtime — Full Async/Await Support

- **`rip()` console REPL** — Wraps user code in a Rip `do ->` block, so the compiler handles implicit return and auto-async natively. Sync code returns values directly; async code returns a Promise (use `await rip("...")` in the console). Variables persist on `globalThis` across calls.
- **`importRip(url)`** — Fetch, compile, and import `.rip` files as ES modules via blob URL. Registered on `globalThis` for use in `<script type="text/rip">` blocks.
- **Async `<script type="text/rip">`** — `processRipScripts` wraps compiled code in an async IIFE, enabling `await` (Rip's `!` operator) in inline scripts.
- **Playground** — Run button uses async IIFE for `await` support. Cmd+Enter shortcut registered on Monaco editor.
- **Eager reactive runtime** — `globalThis.__rip` is registered when `rip.browser.js` loads, making reactive primitives available to framework code.
- **`compileToJS` on globalThis** — The compiler function is globally accessible for framework auto-detection.

## [3.4.3] - 2026-02-09

### Source Maps & IDE Intelligence

- **Source Map V3 support** — New `src/sourcemaps.js` implements ECMA-426 source maps with zero dependencies. VLQ encoder + SourceMapGenerator class in ~120 lines.
- **Inline source maps** — `-m` flag embeds source maps as base64 data URLs in compiled output. One file for everything — debuggers read them natively.
- **Reverse source maps** — `toReverseMap()` provides O(1) source→generated position lookup for IDE type intelligence.
- **S-expression locations** — Parser now attaches `.loc = {r, c}` on every S-expression node. Locations flow from lexer through parser to code generator using consistent `{r, c}` naming.
- **Parser cleanup** — Removed legacy Jison location format (`first_line`/`first_column`), dead `ranges` variable, and `locFirst`/`locLast` extraction. Parser uses `{r, c}` natively.
- **VS Code Extension v0.3.1** — Level 2 type intelligence: autocomplete, hover, and go-to-definition from third-party `.d.ts` files inside `.rip` files. Shadow `.ts` compilation with 300ms debounce. Configurable via `rip.types.intellisense` setting.

## [3.3.1] - 2026-02-09

### Playground & Extension

- **Playground cleanup** — Eliminated dead CSS rules, extracted shared Monaco config, DRYed up toggle handlers, fixed flicker by restoring button states before page reveal, added smooth fade-in transition, defaulted light/dark mode to system `prefers-color-scheme`.
- **VS Code Extension v0.2.0** — Auto-generate `.d.ts` files on save, commands for single-file and workspace-wide type generation, auto-detect compiler binary, configurable settings.
- **Extension published** to VS Code Marketplace as `rip-lang.rip`.

## [3.2.1] - 2026-02-08

### Test Suite & Solar Cleanup

- **Test suite overhaul** — Redistributed tests from `stabilization.rip` and `compatibility.rip` into proper files, removed duplicates, added `reactivity.rip` and `types.rip` test files, added `for-as` guard tests. Now 1,140 tests.
- **Solar parser generator cleanup** — Removed ~79 lines of dead Jison compatibility code, optimized runtime parser with `.call` instead of `.apply`, modernized variable naming from `yy` prefixes.

## [3.2.0] - 2026-02-08

### Rip Types — Optional Type System

- **Type annotations** (`::`) on variables, parameters, and return types — compile-time only, stripped from JS output.
- **Type aliases** (`::=`) for named types, structural types, union types.
- **Interfaces** with `extends` support.
- **Enums** with runtime JS generation and `.d.ts` emission.
- **Generics** (`<T>`) for reusable type definitions.
- **`.d.ts` emission** — `emitTypes()` generates TypeScript declaration files directly from annotated token stream.
- **CLI flag** — `-d`/`--dts` generates `.d.ts` files alongside compiled JS.
- **Architecture** — All type logic consolidated in `src/types.js` (lexer sidecar), minimal changes to lexer and compiler. Added `::` and `::=` operators to lexer.

## [3.1.0] - 2026-02-08

### Rip UI — Zero-Build Reactive Web Framework

Rip UI inverts the traditional web development model. Instead of building and
bundling on the server, the 40KB Rip compiler ships to the browser. Components
are delivered as `.rip` source files, stored in a browser-local Virtual File
System, compiled on demand, and rendered with fine-grained DOM updates.

**Component model** — Two keywords added to the language:

- `component` — Declares an anonymous ES6 class with reactive props, computed
  values, effects, methods, and lifecycle hooks. `@` properties become props
  the parent can set. `:=` creates signals, `~=` creates computed values.
- `render` — Defines a Pug/Jade-like template DSL inside a component. Tags are
  bare identifiers, classes use dot notation (`div.card.active`), dynamic
  classes use dot-parens (`div.("active" if @selected)`), and events use
  `@click: handler`. No virtual DOM — each reactive binding creates a direct
  effect that updates exactly the DOM nodes it touches.

**Framework modules** (all in `packages/ui/`):

| Module | Role |
|--------|------|
| `stash.js` | Deep reactive state tree with path-based navigation |
| `vfs.js` | Browser-local Virtual File System with file watchers |
| `router.js` | File-based router (URL ↔ VFS paths, History API) |
| `renderer.js` | Component lifecycle, layout nesting, route transitions |
| `ui.js` | `createApp` entry point, re-exports everything |

**Compiler changes** (`src/components.js`, 1,193 lines):

- 22 methods installed on `CodeGenerator.prototype` via `installComponentSupport()`
- Categorizes component body into state, computed, readonly, methods, effects, render
- Emits fine-grained DOM creation (`_create()`) and reactive setup (`_setup()`)
- Block factories for conditionals and loops with disposable effects
- Keyed reconciliation for list rendering
- Component runtime emitted only when `component` keyword is used

**No build step. No bundler. No configuration files.**

---

## [3.0.0] - 2026-02-07

### Complete Rewrite

Rip 3.0 is a ground-up rewrite of the entire compiler pipeline. Every component is new:

- **Lexer + Rewriter** (`src/lexer.js`) — 1,542 LOC, down from 3,260
- **Compiler + Codegen** (`src/compiler.js`) — 3,148 LOC, down from 6,016
- **Grammar** (`src/grammar/grammar.rip`) — 887 LOC, updated for new syntax
- **Parser** (`src/parser.js`) — 352 LOC, regenerated from new grammar
- **REPL** (`src/repl.js`) — 654 LOC, rewritten for the new pipeline
- **Browser** (`src/browser.js`) — 79 LOC, rewritten for the new pipeline
- **CLI** (`bin/rip`) — 267 LOC, updated to use the new pipeline
- **Total**: ~7,700 LOC (down from ~10,100)

### Language Changes

#### Removed
- Postfix spread/rest (`x...`) — use prefix `...x` (ES6)
- Prototype access (`x::y`, `x?::y`) — use `.prototype` or class syntax
- `is not` contraction — use `isnt`

#### Added
- JS-style ternary operator: `x ? a : b`
- `for...as` iteration: `for x as iterable` (replaces `for x from iterable`)
- `as!` async shorthand: `for x as! iterable` (shorthand for `for await x as iterable`)

#### Kept
- Existence check: `x?` compiles to `(x != null)` — works after any expression
- All reactive operators: `:=`, `~=`, `~>`, `=!`
- Dammit operator: `x!` compiles to `await x()`
- Optional chaining: `?.`, `?.[]`, `?.()` (ES6 dot-form)
- Optional chaining shorthand: `?[]`, `?()` (compiles to `?.[]`, `?.()`)
- Nullish coalescing: `??`
- All other CoffeeScript-compatible syntax

### Tests
- 1,073 tests passing (100%)
- 25 test files across all language features

---

## [2.9.0] - 2026-02-05

### Compiler Fix

- **Interpolated string object keys**: `{"#{k}": v}` now correctly compiles to `{[\`${k}\`]: v}` instead of invalid `{\`${k}\`: v}`. Template literals in object key position are wrapped in computed property syntax.

### @rip-lang/db — DuckDB Server with Official UI

Major milestone: complete DuckDB HTTP server with the official DuckDB UI.

- **Pure Bun FFI driver** — Direct calls to DuckDB's C API, no npm packages, no Zig
- **Modern chunk-based API** — Uses `duckdb_fetch_chunk` + `duckdb_vector_get_data` for direct columnar memory reads. No deprecated `duckdb_value_*` functions.
- **DuckDB UI loads instantly** — Full binary serialization protocol, proper COOP/COEP headers, SSE keepalive, version handshake
- **Complete type support** — DECIMAL (exact precision), ENUM (dictionary lookup), UUID (native hugeint), LIST/STRUCT/MAP (child vector traversal), all timestamp variants
- **Timestamp policy** — All timestamps normalized to UTC Date objects; TIMESTAMPTZ recommended
- **Binary protocol** — Native 16-byte UUID serialization, uint64-aligned validity bitmaps, proper TypeInfo encoding

### @rip-lang/api — v1.0.0

- Published as stable 1.0.0
- Polished README with feature table and cross-references

### @rip-lang/server — v1.0.0

- Published as stable 1.0.0
- Added proper dependencies (rip-lang + @rip-lang/api)
- Polished README with feature table and cross-references

### Housekeeping

- Removed all Zig code and npm DuckDB dependency from @rip-lang/db
- Consolidated documentation (DEBUGGING.md + INTERNALS.md → README.md)
- Dynamic platform detection for DuckDB UI headers
- Support both `--port=N` and `--port N` argument formats
- Updated all package dependencies to ^2.9.0
- Removed bun.lock from git tracking

---

## [2.7.2] - 2026-02-03

### Clean ES Module REPL

**Proper `vm.SourceTextModule` Implementation**: The REPL now uses Node's standard ES module API instead of temp files:

```coffee
rip> { Cash } = await import("./utils.rip")
rip> config = Cash((await import("./config.rip")).default)
rip> config.app.name
→ 'Rip Labs API'
```

**Key improvements:**
- Uses `vm.SourceTextModule` for in-memory module evaluation (no temp files)
- `.rip` files compiled on-the-fly via module linker
- Cross-runtime compatible (Node.js, Bun, potentially Deno)
- Dynamic `await import()` transformed to static imports automatically
- Clean variable persistence through VM context

This is the standard way to handle ES modules in sandboxed contexts - no hacks required.

---

## [2.7.1] - 2026-02-03

### Bun-Native REPL with Dynamic Import Support

**Full `import()` Support in REPL**: The REPL now uses Bun's native evaluation instead of Node's `vm` module, enabling dynamic imports:

```coffee
rip> { Cash } = await import("./utils.js")
rip> config = Cash((await import("./config.js")).default)
rip> config.app.name
→ 'My App'
```

**Key changes:**
- Replaced `vm.runInContext` with file-based async evaluation
- Variables persist across REPL lines via `globalThis.__ripRepl`
- Temp files cleaned up automatically on exit
- Reactive runtime injected into global scope for cross-line sharing

This enables using the REPL for real development workflows with module imports.

---

## [2.5.1] - 2026-01-16

### Template Enhancement

**Hyphenated Attributes Work Directly**:
```coffee
render
  # Before: needed quoted keys or spread syntax
  i {"data-lucide": "search"}

  # Now: just works!
  i data-lucide: "search", aria-hidden: "true"
  div data-testid: "container", aria-label: "Menu"
  span data-foo-bar-baz: "multiple-hyphens-work"
```

The lexer now automatically converts hyphenated attribute names (like `data-*`, `aria-*`) into quoted strings, making HTML-style data attributes intuitive and clean.

---

## [2.5.0] - 2026-01-16

### Major Release - Parser Optimization + Complete Framework

This release consolidates all improvements since 2.2.1 into a polished, well-documented package. Rip is now a complete language AND reactive framework in just 51KB (Brotli compressed).

---

### 🚀 Parser Optimization

**Interleaved Delta-Encoded Parse Table** - Major size reduction for the generated parser:
- New format in `solar.rip`: `[count, Δkey₁, Δkey₂..., val₁, val₂...]` per state
- **31% smaller Brotli** for parser alone (19.2KB → 13.2KB)
- **17% faster module load** time
- Identical runtime performance (same data structure after decode)
- Solar parser generator now **250× faster** than Jison

---

### ✨ New Language Features

**Ruby-Style Constructor Syntax**:
```coffee
# Both are equivalent
counter = new Counter()
counter = Counter.new()     # Ruby-style - elegant!

# Works with arguments
user = User.new("Alice", 30)

# Chainable
Counter.new().mount("#app")
```

**"Equal, Dammit!" Operator (`=!`)**:
```coffee
# Regular assignment → let (can reassign)
host = "localhost"
host = "example.com"    # OK

# Equal, dammit! → const (can't reassign)
API_URL =! "https://api.example.com"
API_URL = "other"       # Error! const cannot be reassigned
```
Note: `=!` compiles to plain `const` - does NOT pull in the reactive runtime.

**Smart Two-Way Binding**:
```coffee
# Automatically uses valueAsNumber for number/range inputs
input type: "number", value <=> count    # No .valueAsNumber needed!
input type: "range", value <=> volume    # Just works!
```

---

### 🎨 Template & Component Improvements

**Pug-Style Shorthand**:
```coffee
# Implicit div for class-only selectors
.card             # → <div class="card">
.btn.primary      # → <div class="btn primary">

# Nested shorthand works correctly
.container
  .row
    .col "Content"
```

**Dynamic Class Syntax**:
```coffee
div.("bg-white rounded-lg shadow-md")     # Static Tailwind classes
button.(active && "bg-blue-500")          # Conditional classes
```

**Component Mount with Selectors**:
```coffee
# Both work
Counter.new().mount(document.body)
Counter.new().mount("#app")               # Selector string support
```

---

### 🖥️ Browser REPL Enhancements

**Live Demo Tab** (now default):
- Interactive component demos
- Temperature converter, counter examples
- Real-time reactive updates

**UI Improvements**:
- Tab state persists in URL hash
- No flash of wrong tab on page load
- Consistent pane header heights
- GitHub icon link in header

**Demo Improvements**:
- Shows `@prop` syntax for component props
- Uses Ruby-style `.new()` syntax
- Fat arrows for proper `this` binding

---

### 📚 Documentation Overhaul

**Consolidated Documentation** - 13 files merged into 4 main docs:
- `docs/RIP-LANG.md` - Language reference
- `docs/RIP-INTERNALS.md` - Compiler architecture, S-expressions, Solar
- `docs/PHILOSOPHY.md` - Design principles, CoffeeScript comparison
- `docs/BROWSER.md` - Browser usage, REPL, deployment

**Kept Separate** (referenced from PHILOSOPHY.md):
- `docs/WHY-NOT-COFFEESCRIPT.md` - The case against CoffeeScript
- `docs/WHY-YES-RIP.md` - The case for Rip

**Updated Statistics**:
- ~14,000 LOC total (smaller than CoffeeScript's 17,760, yet includes full reactive framework)
- 51KB browser bundle (compiler + reactive runtime + templates + components)
- 1046 tests passing
- Solar: ~1,000 LOC, 250× faster than Jison

---

### 🔧 Internal Improvements

**Compiler Consolidation**:
- Merged `codegen.js` into `compiler.js` (single file for all code generation)
- Renamed `docs/CODEGEN.md` to `docs/COMPILER.md`

**Project Cleanup**:
- Deleted unused `src/runtime.js` (runtime now embedded in compiler output)
- Deleted redundant `docs/demo.html`
- Overhauled `AGENT.md` for accuracy
- Added `notes.txt` to `.gitignore`

**Bug Fixes**:
- Fixed `<=>` two-way binding in components
- Fixed reactive variable shadowing in function bodies
- Fixed nested Pug-style shorthand in render blocks
- Fixed `generateParam` bug
- Consistent name handling in `generateReadonly`

---

### 📊 Updated Scores

| Category | Score | Notes |
|----------|-------|-------|
| **Reactivity** | A+ | Fine-grained, state, effects |
| **Templates** | A | S-expressions, Pug shorthand |
| **Components** | A | Props, lifecycle, context API |
| **Performance** | A | 250× faster parser gen, 51KB bundle |

---

### Summary

**What's in 51KB?**
- Complete compiler (lexer, parser, code generator)
- Reactive runtime (state, computed values, effects)
- Template engine (S-expression syntax, dynamic classes)
- Component system (props, lifecycle, fine-grained updates)
- Zero dependencies

**Comparison**:
- React (min+gzip): ~42KB (just the library, no compiler)
- Vue (min+gzip): ~34KB (just the library, no compiler)
- **Rip: 51KB (complete language + framework, runs anywhere!)**

---

## [2.2.1] - 2026-01-15

### Added - Context API & Error Primitives

**Context API** - Pass data through component trees without prop drilling:
- `setContext(key, value)` - Set context in current component
- `getContext(key)` - Get context from nearest ancestor
- `hasContext(key)` - Check if context exists

**Error Primitives** - Low-level building blocks for error handling:
- `__catchErrors(fn)` - Wrap function to route errors to handler
- `__handleError(error)` - Route error to handler or rethrow
- `__setErrorHandler(fn)` - Set current error handler

**Dynamic Class Syntax** - Cleaner Tailwind support:
```coffee
div.("bg-white rounded-lg shadow-md")  # Static classes
button.(active && "bg-blue-500")       # Conditional classes
```

**Other Improvements**:
- Components now track parent via `_parent` pointer
- Batching optimization with `__batch()` for grouped updates
- Improved reactive runtime documentation (~330 lines total)

**Updated Scores**:
- Components: B+ → A- (Context API implemented)
- Tests: 1017 → 1033

---

## [2.2.0] - 2026-01-15

### Added - Keyed Reconciliation & Per-Item Effects

**The Final Boss: True Svelte-Class Performance**

Lists now have O(1) performance for ALL operations:
- **Add item**: Create 1 node (not rebuild all)
- **Remove item**: Remove 1 node (not rebuild all)
- **Reorder**: Move existing nodes (not recreate)
- **Selection change**: Per-item effects update independently

**Key Features**:
- Keyed reconciliation via `key:` attribute
- Per-item effects with proper cleanup
- Conditional effect cleanup (no memory leaks)
- Effect disposal on item removal

**Example**:
```coffee
for item, i in items
  li key: item.id, class: (i == selected && "selected"), item.name
```

Each item gets its own effect. Changing `selected` updates ONLY the affected classes, not the whole list.

---

## [2.1.0] - 2026-01-15

### Added - Fine-Grained Reactivity

**MAJOR PERFORMANCE IMPROVEMENT**: Components now update only specific DOM nodes that changed, not the entire tree. This brings Rip to Svelte-class performance.

**Architecture Change**:
- Before: `render()` recreates all DOM on every state change
- After: `_create()` builds DOM once, `_setup()` wires minimal effects

**Performance**:
- Text binding: O(1) instead of O(n)
- Attribute binding: O(1) instead of O(n)
- **30-40x faster** for typical reactive updates

**New Features**:
- Fine-grained text bindings: `span count` → effect updates just that text node
- Fine-grained attribute bindings: `div class: active` → effect updates just that attribute
- Fine-grained conditionals: `if show` → anchor-based content swapping
- Fine-grained loops: `for item in items` → tracked node list
- Named slots: Props can be DOM nodes (`@header`, `@footer`, etc.)

**Updated Scores**:
- Reactivity: A → A+
- Templates: A- → A
- Components: A- → A

---

## [2.0.0] - 2026-01-14

### Added - Reactive UI Framework

**Phase 1: Reactivity** (previously released)
- State-based reactivity: `count := 0` creates reactive state
- Computed values: `doubled ~= count * 2` auto-tracks dependencies
- Effects: `~> console.log count` runs on changes
- Runtime: `__state()`, `__computed()`, `__effect()`, `__batch()`, `__readonly()`

**Phase 2: Templates**
- Indentation-based template syntax in `render` blocks
- CSS-style selectors: `div#main.card.active`
- Event handlers: `@click: handler`
- Event modifiers: `@click.prevent.stop: handler`
- Two-way binding: `input value <=> username`
- Spread attributes: `div ...props`
- Dynamic classes: `div.('btn', isActive && 'active')` (clsx-style)
- Control flow: `if`/`else`, `for` loops in templates
- Special attributes: `key:`, `ref:`
- Multiple roots via `DocumentFragment`
- Runtime helpers: `h()`, `frag()`, `txt()`, `cx()`

**Phase 3: Components**
- `component` keyword for defining UI components
- Props system:
  - Required: `@label`
  - Optional: `@label?`
  - Default: `@label = "default"`
  - Rest: `@...rest`
- Reactive state within components (auto-state)
- Computed values within components (auto-computed)
- Component composition: `Button label: "Click"` inside render
- Children/slots: `@children` prop for nested content
- Lifecycle hooks: `mounted:`, `unmounted:`
- Reactive re-rendering via effect-based mount

### Changed
- Grammar extended with `component`, `render`, `style` keywords
- Lexer handles template contexts (ID selectors, arrow injection)
- Codegen generates ES6 classes for components

### Technical Details
- Components compile to ES6 classes with constructor, render, mount, unmount
- Props validated at construction (required props throw if missing)
- State variables become `__state()` calls
- Computed values become `__computed()` calls
- `mount()` wraps render in `__effect()` for reactive updates
- PascalCase names in templates trigger component instantiation

All 1033 tests passing (100%) ✅

---

## [1.5.7] - 2025-11-16

### Changed
- **Documentation updates** - Updated all version references to 1.5.7
  - Updated README.md version badge and status section
  - Updated AGENT.md current status section
  - Regenerated parser and browser bundles with correct version
  - All compiled artifacts current and properly versioned

All 968 tests passing (100%) ✅

## [1.5.6] - 2025-11-16

### Fixed
- **Package completeness** - Ensure all compiled files included in npm package
  - Regenerated parser with optimized encoding
  - Rebuilt browser bundles (44.55 KB compressed)
  - All compiled artifacts present and current

All 968 tests passing (100%) ✅

## [1.5.5] - 2025-11-16

### Changed
- **Parser optimization: Sign-based parseTable encoding** - 28.7% faster parsing!
  - Transformed parseTable from `[type, value]` arrays to semantic integers
  - Positive N = GOTO/SHIFT to state N (forward movement)
  - Negative -N = REDUCE by rule N (contraction)
  - 0 = ACCEPT (parsing complete)
  - undefined = ERROR (syntax error)
  - **Performance improvements:**
    - Parse speed: 28.7% faster (3.27ms → 2.33ms average)
    - Full compile: 16.3% faster (15.24ms → 12.75ms)
    - File size: 24.5% smaller (291.9KB → 220.4KB, -71.5KB)
  - **Why it's fast:** Direct integer comparison (`action > 0`, `action < 0`) instead of array unpacking, better cache locality, fewer allocations
  - The sign bit elegantly encodes operation semantics
  - Updated src/grammar/solar.rip with optimized encoding
  - Regenerated src/parser.js with new format
  - Documented in AGENT.md architecture section

All 968 tests passing (100%) ✅

## [1.5.3] - 2025-11-09

### Added
- **Keyboard shortcuts for Run button in browser REPL** (repl.html)
  - **F5** - Execute code (all platforms)
  - **Cmd+Enter** - Execute code (Mac)
  - **Ctrl+Enter** - Execute code (Windows/Linux)
  - Refactored Run button handler into reusable `runCode()` function
  - Added global keyboard event listener with preventDefault to avoid conflicts
  - Updated Run button tooltip to show available shortcuts
  - Improves workflow for quick code execution without mouse clicks

All 962 tests passing (100%) ✅

## [1.5.2] - 2025-11-09

### Fixed
- **Fixed 'in' operator to check array VALUES instead of INDICES** (#60)
  - JavaScript's `in` operator checks indices: `'apple' in ['apple', 'banana']` returns `false`
  - Previous fix (v1.4.2) only handled string literal in variable case
  - Now handles ALL cases: variable in variable, literal in literal, variable in literal
  - Uses runtime dispatch: arrays/strings → `.includes()`, objects → `in` operator
  - Added 15 comprehensive tests (12 execution + 3 code generation)
  - Critical fix: prevents silent bugs where membership checks return wrong results
  - Example: `val = 'apple'; val in ['apple', 'banana']` now correctly returns `true`

All 962 tests passing (100%) ✅

## [1.5.1] - 2025-11-09

### Fixed
- **Refined heredoc closing delimiter logic** for edge cases
  - Only uses closing position when it's at or left of content minimum
  - Falls back to minimum indent when closing is right of content (old behavior)
  - Removes trailing whitespace-only line when using minimum indent fallback
  - Prevents incorrect dedenting when closing delimiter is indented beyond content

### Changed
- **Refactored heredoc logic into helper methods** for maintainability
  - Extracted `getHeredocClosingColumn()` - Detects closing delimiter position
  - Extracted `extractHeredocContent()` - Gets content from tokens
  - Extracted `findMinimumIndent()` - Calculates minimum indentation
  - Extracted `selectHeredocIndent()` - Chooses baseline intelligently
  - Extracted `removeTrailingWhitespaceLine()` - Cleans up edge case
  - Main heredoc logic now 15 lines (was 70), crystal clear
  - Zero performance impact, much more maintainable

- **Added inline SVG favicon to HTML files**
  - index.html now has embedded favicon
  - No HTTP request needed for favicon
  - Works in all contexts (local, GitHub Pages, offline)

- **Enhanced dev server** (scripts/serve.js)
  - Now strips `/rip-lang/` prefix for GitHub Pages URL compatibility
  - Works with both local and GitHub Pages paths

All 947 tests passing (100%) ✅

## [1.5.0] - 2025-11-09

### Added
- **Heredoc closing delimiter position determines dedenting baseline** (#58)
  - When closing `'''` or `"""` has only whitespace before it, use its column as baseline
  - Strip that exact amount from all content lines
  - Preserve additional indentation beyond baseline
  - Falls back to minimum-indent behavior when non-whitespace precedes closing delimiter
  - Visual control: Move closing delimiter left/right to control stripping
  - Perfect for code generation use cases
  - Works with both single (`'''`) and double (`"""`) quote heredocs
  - Added 10 comprehensive tests covering all edge cases

### Removed
- **Soak super syntax** (`super?()`) - Removed for clarity and simplicity
  - Semantically questionable (parent methods always exist in practice)
  - Zero real-world usage (one test only)
  - Makes `super?()` a parse error (clearer than silently handling)
  - Removed `generateOptionalSuper` method from codegen
  - Removed `?super` from dispatch table
  - Removed test from test/rip/classes.rip

### Changed
- Test count: 938 → 947 (+10 heredoc tests, -1 soak super test)

All 947 tests passing (100%) ✅

## [1.4.6] - 2025-11-08

### Changed
- **Documentation updates for consistency**
  - Updated AGENT.md to reflect current version (1.4.6)
  - Standardized all test count references to 938/938 (100%)
  - Updated README.md version references

All 938 tests passing (100%) ✅

## [1.4.5] - 2025-11-08

### Changed
- **Renamed rip-loader.ts → rip-loader.js** - Pure JavaScript, no TypeScript
  - Removed fake TypeScript annotation (`err: any` → `err`)
  - Updated `bunfig.toml` to reference `.js` file
  - Updated `package.json` exports and files array
  - Honest about what the file is - simplicity and clarity

- **Completed CODEGEN-FINAL-ANALYSIS recommendations**
  - Extracted `isNegativeOneLiteral()` helper method (DRY principle)
  - Removed duplicate negative-one literal checks
  - Deleted analysis document (all work complete)

All 938 tests passing (100%) ✅

## [1.4.4] - 2025-11-08

### Changed
- **S-expression formatter - Clean room rebuild**
  - Complete rewrite of `formatSExpr()` with clear, simple rules
  - Fixed indentation hierarchy: children ALWAYS indented more than parents
  - Fixed method chaining indentation (`.` operator in call heads)
  - Multi-line heads now properly re-indented to maintain hierarchy
  - Block nodes always expand children on separate lines
  - Removed all column-based continuation complexity
  - +89 lines added, -52 lines removed (net +37 for clarity)

- **INLINE_FORMS cleanup**
  - Removed legacy MUMPS cruft (tag, entryref, lock-*, newline, etc.)
  - Organized by category with aligned comments
  - Added `new` to inline forms for compact constructor calls
  - Clear documentation of what belongs and why

### Improved
- S-expression output is now beautifully formatted with perfect hierarchy
- Method chaining like `s.replace().trim()` displays correctly
- Simple constructors stay compact: `(new (Date))`
- Complex constructors expand naturally: `(new (Set (...)))`

All 938 tests passing (100%) ✅

## [1.4.3] - 2025-11-07

### Refactored
- **Convert generateNot to s-expression approach** - Following Rip philosophy!
  - Check operand TYPE at s-expression level (not regex on generated code)
  - Handles primitives: `!1`, `!x`, `!true` (clean output without extra parens)
  - Handles property access: `!obj.prop`, `!arr[0]` (clean output)
  - Conservative for complex expressions: `!(a + b)` (keeps parens)
  - Simple, maintainable logic (~26 lines)
  - Follows philosophy from Issues #46 (flattenBinaryChain) and #49 (unwrapComprehensionIIFE)
  - **Work at IR level, not string level!**

All 938 tests passing (100%) ✅

## [1.4.2] - 2025-11-07

### Fixed
- **Critical: Fix 'in' operator with string literals** - Restores self-hosting!
  - JavaScript's `in` operator checks numeric indices on strings, NOT characters
  - `'\n' in "text"` incorrectly returns `false` (should check if newline exists)
  - Fixed `generateIn()` to detect string literal checks and use `.includes()`
  - Pattern: `'x' in variable` → runtime type check with `.includes()` for strings/arrays
  - **This broke parser regeneration since Phase 1!** (`bun run parser` now works ✅)
  - Added 7 tests for string literal `in` operator behavior
  - Critical for bootstrap: solar.rip uses `'\n' in action` pattern

### Changed
- **Massive code cleanup** - Removed 2,042 lines of dead/duplicate code (28%)!
  - Removed ALL 37 Phase 2 duplicate switch cases (1,614 lines) - never cleaned after extraction
  - Removed old* cases (47 lines), error-throwing cases (26 lines), forwarding cases (185 lines)
  - Removed duplicate property cases (149 lines), function cases (185 lines)
  - Eliminated pointless switch wrapper with only default case (4 lines)
  - Extracted duplicate `findPostfixConditional` helper (DRY principle)
  - Added missing assignment operators to dispatch table
  - Centralized number literal regex patterns
  - Result: 7,263 → 5,239 LOC (27.9% reduction!)

### Documentation
- Consolidated AI agent docs into single AGENT.md (removed duplicate rip-agent-onboarding.md)
- Updated all LOC references (5,239 LOC, ~45% smaller than CoffeeScript)
- Cleaned up 8 obsolete planning docs
- Created simple .cursor/rules/rip-quick-start.md pointer

All 938 tests passing (100%) ✅

## [1.4.1] - 2025-11-07

### Changed
- **Dispatch table Phase 2 complete** (#54) - Extracted all remaining 39 cases (100% complete!)
  - Exception handling: `try`, `throw` (2 cases)
  - Switch statements: `switch`, `when` (2 cases)
  - Comprehensions: `comprehension`, `object-comprehension` (2 cases)
  - Classes: `class`, `super`, `?call`, `?super` (4 cases)
  - Modules: `import`, `export`, `export-default`, `export-all`, `export-from` (5 cases)
  - Special forms: `do-iife`, `regex`, `tagged-template`, `str` (4 cases)
  - **All 110 node types now in dispatch table** - Perfect O(1) lookup ✅
  - Codegen organization complete - Easy to navigate and maintain
  - File size: 6,203 → 7,263 LOC (+1,060 lines from extraction)
  - All 931 tests passing (100%) ✅

## [1.4.0] - 2025-11-07

### Changed
- **Major refactoring: Dispatch table architecture** (#52 Phase 1) - Extracted 71/110 cases (65%)
  - Added O(1) dispatch table (was O(n) switch with 110 cases)
  - Extracted 71 generator methods organized by category
  - Shared methods for similar operations (DRY principle)
  - Binary operators: 20+ cases → 1 shared method
  - Assignment operators: 17 cases → 1 shared method
  - All operators, property access, functions, loops, exception handling extracted
  - ~1,500 lines reorganized into categorized methods
  - Clear organization: operators, property access, functions, control flow, etc.
  - Remaining 39 cases documented for Phase 2
- Test count: 926 → 931 (+5 tests from Issue #49)

## [1.3.14] - 2025-11-07

### Changed
- **S-expression comprehension generation** (#49) - Removed string manipulation anti-pattern
  - Replaced `unwrapComprehensionIIFE()` with s-expression-based approach
  - Added `generateComprehensionWithTarget()` for direct array building
  - No more generating IIFE then unwrapping with regex ✅
  - Follows same philosophy as Issue #46 improvements
  - **42 lines removed** (string manipulation eliminated)
  - Safer, faster, cleaner code generation
- Test count: 926 → 931 (+5 tests)
- Added CODEGEN-ANALYSIS.md with optimization roadmap

## [1.3.13] - 2025-11-07

### Fixed
- **Clean logical chains** (#46) - Flatten nested logical operators at s-expression level
  - Transforms deeply nested chains: `if (((!a && !b) && !c) && d)` → `if (!a && !b && !c && d)`
  - Works by flattening s-expression tree BEFORE code generation (Rip philosophy!)
  - Added `flattenBinaryChain()` to recursively flatten same-operator chains
  - Pure chains unwrap completely, mixed precedence stays safe ✅
  - Example: `arr[len - (x || 1)]` preserves inner parens
  - Much cleaner than regex string manipulation (50 lines vs 100+)
- Test count: 922 → 926 (+4 tests)

## [1.3.12] - 2025-11-07

### Changed
- **Cleaner output in delimited contexts** (#44) - Removed redundant outer parens
  - Function args: `fn((expr))` → `fn(expr)`
  - Assignments: `x = (value)` → `x = value`
  - Array indices: `arr[(index)]` → `arr[index]`
  - Applied unwrap() in contexts that already provide delimiters
  - Safety preserved: `arr[len - (x || 1)]` keeps inner parens ✅
  - Object literals still protected
- Test count: 913 → 922 (+9 tests)

## [1.3.11] - 2025-11-07

### Fixed
- **Critical: Safe operator wrapping** - Reverted to conservative wrapping approach
  - Always wrap `&&`, `||`, `??` operators by default (safe precedence)
  - Unwrap only in guaranteed-safe contexts (if/while conditions)
  - Prevents broken JavaScript: `arr[len - (x || 1)]` now preserves parens ✅
  - Mixed precedence now safe: `a - (b || c)` preserves parens ✅

### Changed
- **Improved unwrapLogical()** - Better aggressive unwrapping for conditions
  - `if (!isEmpty && isValid)` still clean in conditions ✅
  - But never breaks precedence in mixed contexts ✅
  - Best of both worlds: safety + readability

## [1.3.10] - 2025-11-06

### Changed
- **Eliminated exponential parentheses** (#42) - Removed paren hell in logical operator chains
  - Stopped wrapping `&&`, `||`, `??` operators (left-associative, safe to chain)
  - `(((!a && !b) && !c) && d)` → `!a && !b && !c && d` (4 layers → 0!)
  - Created `unwrapLogical()` for aggressive unwrapping in conditions
  - Matches CoffeeScript clean output

### Fixed
- **Unary NOT precedence bug** - `!(a && b)` now generates correctly
  - Was: `!a && b` (wrong precedence) ❌
  - Now: `(!(a && b))` (correct precedence) ✅

### Changed
- Test count: 907 → 913 (+6 tests)

## [1.3.9] - 2025-11-06

### Fixed
- **Indentation in for-in loops with index and guard** - Fixed broken indentation
  - For-loops with both index variable and guard clause now indent correctly
  - Root cause: Mixed array building with formatStatements causing double-indent
  - Solution: Direct code building with explicit indent levels (Option 2)
  - Example: `for symbol, i in arr when guard` now has perfect indentation
  - Every statement at correct level (no 0-space or 12-space chaos)

## [1.3.8] - 2025-11-06

### Changed
- **Cleaner conditions** (#40) - Removed excessive double parentheses
  - `if ((x > y))` → `if (x > y)` (single parens)
  - Applied to all conditionals: if, unless, while, until, guards
  - Used existing `unwrap()` helper for consistency
  - Smart negation handling (keeps parens when needed for precedence)
  - More readable, professional output
- Test count: 901 → 907 (+6 tests)

## [1.3.7] - 2025-11-06

### Changed
- **Cleaner arrow function syntax** (#38) - Remove parens around single parameters
  - `(x) => x * 2` → `x => x * 2` (single simple param)
  - Keeps parens for multiple params, destructuring, defaults, rest
  - Matches ESLint/Prettier standards
  - More idiomatic modern JavaScript
- Test count: 893 → 901 (+8 tests)

## [1.3.6] - 2025-11-06

### Changed
- **Simplified Object.hasOwn() generation** - Removed unnecessary _pregenerated pattern
  - Direct inline generation instead of wrapper objects
  - Cleaner code flow (~30 lines removed)
  - No need for special handling since Object.hasOwn() is built-in ES2022

## [1.3.5] - 2025-11-06

### Changed
- **Modernized to Object.hasOwn()** (#36) - Replaced hasOwnProperty with ES2022 standard
  - All `obj.hasOwnProperty(key)` → `Object.hasOwn(obj, key)`
  - Cannot be shadowed by instance properties
  - Works with null-prototype objects
  - More readable and safer
  - Uses clean `continue` pattern like CoffeeScript
- Test count: 891 → 893 (+2 tests)

## [1.3.4] - 2025-11-06

### Fixed
- **Semicolons in all contexts** - Extended clean semicolon removal to nested blocks
  - Function bodies now have clean blocks (no semicolons after `}`)
  - Method bodies now have clean blocks
  - Loop bodies and nested contexts all clean
  - Added helper methods: `needsSemicolon()` and `addSemicolon()`
  - Applied smart semicolon logic to all statement generation

### Changed
- Cleaner JavaScript output throughout entire codebase, not just top-level

## [1.3.3] - 2025-11-06

### Changed
- **Cleaner JavaScript output** (#34) - Removed unnecessary semicolons after block statements
  - Function and class declarations no longer have trailing semicolons
  - Control flow blocks (if/for/while/switch/try) no longer have trailing semicolons
  - Produces more idiomatic, professional-looking JavaScript
  - Matches standard formatters (Prettier, ESLint)
- Test count: 878 → 891 (+13 tests)

## [1.3.2] - 2025-11-05

### Changed
- Minor code cleanup and refinements
- Updated solar.rip indentation handling for better code generation

## [1.3.1] - 2025-11-05

### Added
- **Otherwise operator (`!?`)** (#32) - Undefined-only coalescing
  - Returns first value that is NOT `undefined`
  - Unlike `??` (nullish), treats `null`, `false`, `0`, `""` as valid values
  - Perfect for optional parameters with meaningful falsy values
  - Syntax: `value1 !? value2 !? 'default'`
  - Example: `timeout = config.timeout !? 5000` (null/0 are valid!)
- Test count: 868 → 878 (+10 tests)

## [1.3.0] - 2025-11-05

### Added
- **Script execution with proper argument passing** - `rip script.rip -h` now passes `-h` to script
  - Arguments before script name → rip options
  - Arguments after script name → script arguments
  - Fixes issue where rip would consume script's flags
- **Solar.rip synchronization** - Updated to match solar-parser 1.2.0
  - New CLI options: `--version`, `--info`, `--sexpr`
  - Removed `commonCode` architecture for simpler code generation
  - Fixed file writing bug (was using `unless` incorrectly)

### Changed
- Improved CLI argument parsing for better script execution

## [1.2.2] - 2025-11-04

### Added
- **Browser REPL UI improvements** - Cleaner, more intuitive interface
  - Made "Live Compiler" the default tab
  - Added Clear and Run buttons to Rip Source panel
  - Converted checkboxes to toggle buttons (gray/blue states)
  - Consistent header layout across both panes
  - Helpful tooltips on all buttons

### Fixed
- **For-loop destructuring with defaults** (#30) - Full CoffeeScript compatibility
  - `for [a, b = 99, c = 88] in arr` now works correctly
  - Generates proper ES6 destructuring with defaults
  - Previously generated invalid s-expressions in patterns

### Changed
- Test count: 867 → 868 (+1 test)

## [1.2.1] - 2025-11-04

### Fixed
- **Slice syntax with nested indices** (#28) - Property access after nested brackets now works
  - `line[_[0].length..]` now compiles correctly
  - Fixed lexer rewriter to use bracket depth counting
  - Previously failed with parse error
  - Example: `arr[obj.data[0].length..]` → `arr.slice(obj.data[0].length)`
- Test count: 865 → 867 (+2 tests)

## [1.2.0] - 2025-11-04

### Fixed
- **Switch without discriminant context bug** (#26) - Statement context no longer adds returns
  - Switch in loops now generates correct code (no invalid returns)
  - Made `generateSwitchAsIfChain()` context-aware
  - Value context: adds returns (switch as expression)
  - Statement context: plain statements (side effects only)
- **__DATA__ section generation** - Natural code emission without string surgery
  - `var DATA;` now positioned logically before `_setDataSection()` call
  - Removed ~50 lines of complex regex/string manipulation
  - Clean, obvious code generation in `generateProgram()`
- **S-expression pretty printer** - Restored missing features
  - Fixed heregex handling (multi-line regex collapsing)
  - Fixed program node formatting with proper indentation
  - Faster with Set lookup for INLINE_FORMS
  - Modern JS with optional chaining and nullish coalescing

### Changed
- Test count: 864 → 865 (+1 test)
- Improved code generation architecture

## [1.1.5] - 2025-11-03

### Fixed
- **npm package files** - Added `scripts/serve.js` for `rip -w` command
  - Browser REPL now works for npm users
  - Fixed missing dependency for web server functionality

### Changed
- S-expression printer improvements backported to docs/examples/sexpr.rip

## [1.1.4] - 2025-11-03

### Fixed
- **S-expression printer** - Improved performance and correctness
  - Faster Set-based INLINE_FORMS lookup
  - Modern JavaScript features (optional chaining, nullish coalescing)
  - Proper heregex and program node formatting
  - All functionality restored and working

## [1.1.3] - 2025-11-03

### Fixed
- **Package files** - Included `scripts/serve.js` in npm package
  - Required for `rip -w` browser REPL command

## [1.1.2] - 2025-11-02

### Added
- **npm publishing safeguards** (#24) - Professional package configuration
  - `files` whitelist (only 51 essential files published)
  - `prepublishOnly` script (runs tests + rebuilds browser bundle)
  - `pack` script for previewing package contents
- **Comprehension optimization** (#22) - Eliminated wasteful IIFEs
  - Function-final comprehension assignments ~24% smaller
  - Smarter context detection for when to use IIFE vs plain loop

### Changed
- Package size optimized: excludes test/, scripts/, dev files
- Test count: 864 tests (all passing)

## [1.1.1] - 2025-11-01

### Fixed
- **Browser REPL launcher (`rip -w`)** - Port fallback now works correctly
  - Fixed `ReferenceError: assignedPort is not defined`
  - Server tries port 3000, falls back to OS-assigned port if busy
  - Browser opens with correct port automatically
  - Works when installed globally via `npm install -g rip-lang` or `bun install -g rip-lang`

### Changed
- Refactored serve.js to eliminate code duplication
- Improved port detection by parsing server output

## [1.1.0] - 2025-11-01

### Added
- **Beautiful s-expression formatter** - Canonical format with proper indentation
  - Deployed in CLI (`-s` flag), browser REPL, and as standalone utility
  - 80% more compact than JSON, fully parenthesized
  - Heregex patterns collapsed to single line
  - Meta-circular: Rip code formatting Rip's data structures!
- **Script execution** - `rip script.rip` now executes directly (no explicit `bun` needed)
  - Auto-detects .rip files and uses Bun loader
  - Passes arguments correctly
  - Shebang support: `#!/usr/bin/env rip`
- **Browser REPL launcher** - `rip -w` starts local server and opens browser
  - One-command workflow
  - Works offline with local changes
  - Cross-platform (macOS, Windows, Linux)
- **Resizable REPL panes** - Drag slider between Rip source and JavaScript output
- **Local time display** - Build timestamp shown in user's timezone
- **Friendly error messages** - Clear "File not found" instead of stack traces

### Fixed
- **Postfix `by` step in comprehensions** - `for i in [0..10] by 2` now works
- **Nested IIFE elimination** - Major code generation optimization (37% smaller)
- **Throw in expressions** - Properly wrapped in IIFE
- **Rest parameters in middle position** - Both functions and array destructuring
  - `def fn(first, ...middle, last)` works
  - `[first, ...middle, last] = arr` works
- **Parser error messages** - Now show line and column numbers
- **Range loops without variable** - `for [1..10]` optimization
- **Comprehension context detection** - Smart IIFE vs plain loop decisions
- **Step handling refactoring** - Unified logic, 37% code reduction
- **Global installation** - `rip -w` works correctly when installed via npm/bun

### Changed
- Version bumped to 1.1.0
- Test count: 843 → 864 (+21 tests, all passing)
- Documentation updated throughout
- Package.json prepared for NPM publishing

### Documentation
- Complete GitHub workflow system (issues, PRs, templates)
- AI agent onboarding guide
- CONTRIBUTING.md with real examples
- Updated README, AGENT.md, COFFEESCRIPT-COMPARISON.md
- All stats current (864 tests)

### Infrastructure
- 10 complete GitHub workflows (issue → branch → test → fix → PR → merge)
- Comprehensive test coverage (100% passing)
- Ready for NPM publish

## [1.0.0] - 2025-10-31

### Initial Release
- Complete Rip language compiler
- CoffeeScript-inspired syntax with modern ES2022 output
- Zero dependencies (includes SLR(1) parser generator)
- Self-hosting capability
- 843/843 tests passing
- Terminal REPL
- Browser bundle (43KB brotli-compressed)
- Complete documentation
