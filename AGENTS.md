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
bun run test                             # All tests (1407)
bun test/runner.js test/rip/FILE.rip     # Specific file

# Rebuild parser (after grammar changes)
bun run parser

# Build browser bundle
bun run build

# Serve an app (watches *.rip, HTTPS, mDNS)
rip server
```

### Current Status

| Metric | Value |
|--------|-------|
| Version | 3.13.34 |
| Tests | 1,407 |
| Dependencies | Zero |
| Self-hosting | Yes (Rip compiles itself) |

---

## Project Structure

```
rip-lang/
├── src/
│   ├── lexer.js         # Lexer + Rewriter (1,778 LOC)
│   ├── compiler.js      # Compiler + Code Generator (3,334 LOC)
│   ├── types.js         # Type System — sidecar for lexer (1,091 LOC)
│   ├── components.js    # Component System — sidecar for compiler (2,026 LOC)
│   ├── sourcemaps.js    # Source Map V3 generator (189 LOC)
│   ├── typecheck.js     # Shared type-checking infrastructure (442 LOC)
│   ├── parser.js        # Generated parser (359 LOC) — Don't edit!
│   ├── repl.js          # Terminal REPL (600 LOC)
│   ├── browser.js       # Browser integration (194 LOC)
│   └── grammar/
│       ├── grammar.rip  # Grammar specification (948 LOC)
│       ├── lunar.rip    # Recursive descent parser generator (2,412 LOC)
│       └── solar.rip    # SLR(1) parser generator (929 LOC) — Don't edit!
├── packages/            # Optional packages (see Packages section below)
│   ├── widgets/         # Headless UI widgets — Select, Dialog, Grid, etc. (see below)
│   ├── server/          # @rip-lang/server — Web framework + production server
│   ├── db/              # @rip-lang/db — DuckDB server
│   ├── schema/          # @rip-lang/schema — ORM + validation
│   ├── swarm/           # @rip-lang/swarm — Parallel job runner
│   ├── csv/             # @rip-lang/csv — CSV parser + writer
│   ├── http/            # @rip-lang/http — HTTP client (ky-inspired)
│   ├── print/           # @rip-lang/print — Syntax-highlighted code printer
│   └── vscode/          # VS Code/Cursor extension
├── docs/
│   ├── RIP-LANG.md      # Language reference (includes reactivity, future ideas)
│   └── RIP-TYPES.md     # Type system specification
├── test/rip/            # 26 test files (1,369 tests)
└── scripts/             # Build utilities (all .js — run via `bun run <name>`)
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
| `src/browser.js` | Yes | Browser entry point (shared-scope loader) |
| `rip-loader.js` | Yes | Bun plugin — compiles .rip files + rewrites @rip-lang/* imports |
| `src/grammar/solar.rip` | Never | Parser generator (given) |
| `test/rip/*.rip` | Yes | Test files |

---

## The Compilation Pipeline

```
Rip Source  ->  Lexer  ->  emitTypes  ->  Parser  ->  S-Expressions  ->  Codegen  ->  JavaScript
               (1,778)     (types.js)     (357)       (arrays + .loc)     (3,334)      + source map
                              ↓
                           file.d.ts (when types: "emit")
```

**Key insight:** S-expressions are simple arrays like `["=", "x", 42]`, not complex AST nodes. This makes the compiler dramatically smaller than CoffeeScript.

---

## Key Concepts

### 1. S-Expression Patterns

Common patterns:

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

Complete node type reference:

```javascript
// Top Level
['program', ...statements]

// Variables & Assignment
['=', target, value]
['+=', target, value]  // And all compound assigns: -=, *=, /=, %=, **=
['&&=', target, value]  ['||=', target, value]
['?=', target, value]   ['??=', target, value]

// Functions
['def', name, params, body]     // Named function
['->', params, body]            // Thin arrow (unbound this)
['=>', params, body]            // Fat arrow (bound this)
// Params: 'name', ['rest', 'name'], ['default', 'name', expr],
//         ['expansion'], ['object', ...], ['array', ...]

// Calls & Property Access
[callee, ...args]               // Function call
['await', expr]                 // Await
['.', obj, 'prop']              // Property: obj.prop
['?.', obj, 'prop']             // Optional: obj?.prop
['[]', arr, index]              // Index: arr[index]
['optindex', arr, index]        // Optional: arr?.[index]
['optcall', fn, ...args]        // Optional: fn?.(args)
['new', constructorExpr]        // Constructor
['super', ...args]              // Super call
['tagged-template', tag, str]   // Tagged template

// Data Structures
['array', ...elements]          // Array literal
['object', ...pairs]            // Object literal (pairs: [key, value])
['...', expr]                   // Spread (prefix only)

// Operators
['+', left, right]   ['-', left, right]   ['*', left, right]
['/', left, right]   ['%', left, right]   ['**', left, right]
['==', left, right]  ['!=', left, right]  // == compiles to ===
['<', left, right]   ['<=', left, right]
['>', left, right]   ['>=', left, right]
['&&', left, right]  ['||', left, right]  ['??', left, right]
['!', expr]          ['~', expr]          ['typeof', expr]
['delete', expr]     ['instanceof', expr, type]
['?', expr]          // Existence check
['defined', expr]    // Defined check (!?)
['presence', expr]   // Presence check (?!) — Houdini operator
['++', expr, isPostfix]  ['--', expr, isPostfix]

// Control Flow
['if', condition, thenBlock, elseBlock?]
['unless', condition, body]
['?:', condition, thenExpr, elseExpr]   // Ternary
['switch', discriminant, cases, defaultCase?]

// Loops
['for-in', vars, iterable, step?, guard?, body]
['for-of', vars, object, guard?, body]
['for-as', vars, iterable, async?, guard?, body]
['while', condition, body]  ['until', condition, body]  ['loop', body]
['break']  ['continue']  ['break-if', condition]  ['continue-if', condition]

// Comprehensions
['comprehension', expr, iterators, guards]
['object-comprehension', keyExpr, valueExpr, iterators, guards]

// Exceptions
['try', tryBlock, [catchParam, catchBlock]?, finallyBlock?]
['throw', expr]

// Classes & Types
['class', name, parent?, ...members]
['enum', name, body]

// Ranges
['..', from, to]      // Inclusive
['...', from, to]     // Exclusive

// Blocks & Modules
['block', ...statements]
['do-iife', expr]
['import', specifiers, source]
['export', statement]  ['export-default', expr]
['export-all', source]  ['export-from', specifiers, source]

// Reactivity
['state', name, expr]           // :=
['computed', name, expr]        // ~=
['effect', name, expr]          // ~>
['readonly', name, expr]        // =!

// Components
['component', null, body]       // component keyword
['render', body]                // render block
```

### 1a. Lexer Token Format

Token: `[tag, val]` array with properties:

| Property | Type | Purpose |
|----------|------|---------|
| `.pre` | number | Whitespace count before this token |
| `.data` | object/null | Metadata: `{await, predicate, quote, invert, parsedValue, ...}` |
| `.loc` | `{r, c, n}` | Row, column, length |
| `.spaced` | boolean | Sugar for `.pre > 0` |
| `.newLine` | boolean | Preceded by a newline |

Identifier suffixes: `!` sets `.data.await = true` (dammit operator), `?` sets `.data.predicate = true` (existence check). `as!` in for-loops emits `FORASAWAIT` for `for await`.

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

**How `<=>` works on components (signal sharing):** For HTML elements, `<=>` compiles to an effect + event listener pair. For **components**, it works differently — the parent's signal is passed directly via `__bind_propName__` prop. The child's `_init` checks for this prop first: `this.checked = __state(props.__bind_checked__ ?? props.checked ?? false)`. Since `__state()` has signal passthrough (returns existing signals as-is), parent and child share the exact same signal object. Mutations in either direction are instantly visible to both — no events or sync needed. This is why `<=>` on components is more efficient than on HTML elements.

---

## Component System Architecture (`src/components.js`)

The component system is a compiler sidecar — `installComponentSupport(CodeGenerator, Lexer)` adds methods to both prototypes. It has two major subsystems:

### Render Rewriter (Lexer side)

`rewriteRender()` runs on the token stream (after `normalizeLines`, before `tagPostfixConditionals`). Inside `render` blocks, it transforms template syntax into function-call syntax by injecting `, ->` or `CALL_START -> ... CALL_END` tokens:

```coffee
# Rip source:            # After rewriting:
div                       div(->
  span "hello"              span("hello"))
```

Key mechanisms:
- **`startsWithTag`** — backward scan to determine if current line starts with a template tag
- **`pendingCallEnds`** — indent-level stack for matching injected CALL_START/CALL_END pairs
- **`fromThen` skip** — `normalizeLines` creates `fromThen` INDENTs for `if x then y else z`; these are always inline values, never template nesting

### Component Codegen (CodeGenerator side)

Generates fine-grained DOM operations at compile time (no virtual DOM):
- **`buildRender`** — entry point, initializes counters, create/setup line arrays, and tracking state
- **`generateNode`** — main dispatch for all render-tree nodes (elements, text, conditionals, loops, components)
- **`generateConditional`** — produces block factories for if/else with transition-aware enter/leave
- **`generateTemplateLoop`** — emits a `__reconcile` call with LIS-based keyed diffing
- **`emitBlockFactory`** — shared factory emitter (c/m/p/d + `_first` + `_s` + `_t`) used by both conditionals and loops

### Factory Mode (`_factoryMode`)

Block factories need local variables and `ctx` references instead of `this._elN` and `this.member`. Rather than generating with `this.` and regex-replacing after, the codegen uses a **factory mode** flag:

- **`_factoryMode`** (bool) — when true, generation emits `_el0` (local) and `ctx.member` instead of `this._el0` and `this.member`
- **`_self`** (getter) — returns `'this'` or `'ctx'` based on mode
- **`_factoryVars`** (Set) — tracks variables created during factory generation (for `let` declarations)
- **`_fragChildren`** (Map) — tracks fragment-to-children mappings (for proper removal after insertBefore)
- **`_pushEffect(body)`** — emits `__effect(...)` normally or `disposers.push(__effect(...))` in factory mode
- **`_loopVarStack`** — accumulates loop variables for threading through nested factories

Factory mode is entered in `generateConditionBranch` and `generateTemplateLoop` via save/restore of `[_createLines, _setupLines, _factoryMode, _factoryVars]`.

### Auto-Wired Event Handlers (`on*` convention)

Component methods named `onClick`, `onKeydown`, `onMouseenter`, etc. are automatically bound to the component's root DOM element. The rule: `on` + capitalized event name → `addEventListener(lowercased, handler)` on the root element. No explicit `@click: @onClick` wiring needed.

- **Detection**: `generateComponent` builds `_autoEventHandlers` (Map of event name → method name) from methods matching `/^on[A-Z]/` that aren't in `LIFECYCLE_HOOKS`
- **Root only**: `_claimAutoWire` claims the first HTML tag generated in `buildRender`. Non-tag roots (conditionals, loops, components) clear `_pendingAutoWire` to prevent inner elements from claiming
- **Explicit override**: An `@event: handler` binding on the root element suppresses auto-wiring for that event (tracked via `_autoWireExplicit` in `generateAttributes`). Explicit bindings on child elements don't affect auto-wiring — standard DOM propagation handles interaction
- **Lifecycle exclusion**: `onError` (in `LIFECYCLE_HOOKS`) is not auto-wired

```coffee
# onClick and onKeydown auto-wire to the root button — no @click/@keydown needed
export Checkbox = component
  @checked := false
  onClick: -> @checked = not @checked
  onKeydown: (e) ->
    @onClick() if e.key in ['Enter', ' ']
  render
    button role: 'checkbox', aria-checked: !!@checked
      slot
```

### List Reconciliation (`__reconcile`)

Loop rendering uses a runtime `__reconcile` function instead of inlined reconciliation code. The algorithm:

1. **Phase 0 — Creation batch**: First render accumulates all blocks into a DocumentFragment, single DOM insert (1 op vs N)
2. **Phase 1 — Prefix scan**: Matching items at the start skip `p()` entirely (effects already live)
3. **Phase 2 — Suffix scan**: Matching items at the end call `p()` (index may differ)
4. **Phase 3 — Fast paths**: Pure insertion (DocumentFragment batch) or pure deletion
5. **Phase 4 — LIS**: Longest Increasing Subsequence for minimal DOM moves on genuine reorders

Compile-time optimizations:
- **Static blocks** (`_s: true`) — when `p()` has no effects, skip patch calls entirely
- **Array-based storage** — `state.blocks[]` for O(1) index lookup (no persistent Map)
- **Direct items-as-keys** — `state.keys = items.slice()` for default case (no keyFn allocation)

### Error Boundaries

`onError` lifecycle hook catches errors and walks the `_parent` chain:
- **Constructor**: wraps `_init` in try-catch, calls `__handleComponentError(e, this)`
- **Mount**: wraps `_create`/`_setup`/`mounted` in try-catch
- **Child components**: codegen wraps child `_setup`/`mounted` calls in try-catch at compile time
- **`__handleComponentError(error, component)`**: walks `_parent` to find nearest `onError` handler; rethrows if none found

### Transitions (`~tilde` syntax)

CSS enter/leave transitions on conditional blocks:
- **Syntax**: `div ~fade` — tilde modifier on elements in render blocks
- **Rewriter**: converts `UNARY_MATH ~ + IDENTIFIER fade` to `PROPERTY __transition__: STRING "fade"`
- **Codegen**: `generateAttributes` intercepts `__transition__` → emits `this._t = "fade"` on the block
- **Conditional**: checks `currentBlock._t` for async leave (callback-based) and enter (fire-and-forget)
- **Runtime**: `__transition(el, name, dir, done)` manages CSS class dance (double-rAF + transitionend)
- **Built-in presets**: `fade`, `slide`, `scale`, `blur`, `fly` — CSS injected lazily by `__transitionCSS()`
- **Custom transitions**: `div ~anything` works with user-provided CSS using `{name}-enter-from`, `{name}-enter-active`, `{name}-leave-to` convention

### Testing Components

Component tests live in `test/rip/components.rip` (107 tests). Use `code` tests with `{ skipPreamble: true, skipRuntimes: true }` options to verify generated JavaScript output for render blocks. Use `test` tests for runtime behavior (state, computed, methods, LIS algorithm, error boundaries — no DOM needed).

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

### Test Files (26 files, 1,407 tests)

```
test/rip/
├── arrows.rip        ├── literals.rip
├── assignment.rip    ├── loops.rip
├── async.rip         ├── modules.rip
├── basic.rip         ├── operators.rip
├── classes.rip       ├── optional.rip
├── commaless.rip     ├── parens.rip
├── components.rip    ├── precedence.rip
├── comprehensions.rip├── properties.rip
├── control.rip       ├── reactivity.rip
├── data.rip          ├── regex.rip
├── errors.rip        ├── semicolons.rip
├── functions.rip     ├── strings.rip
└── guards.rip        └── types.rip
```

---

## Documentation Map

| File | Purpose |
|------|---------|
| **README.md** | User guide, features, installation |
| **docs/RIP-LANG.md** | Full language reference (syntax, operators, reactivity, packages, future ideas) |
| **docs/RIP-TYPES.md** | Type system specification |

---

## Packages

The `packages/` directory contains optional packages that extend Rip for
full-stack development. All are written in Rip, have zero dependencies, and
run on Bun.

### @rip-lang/server (v1.2.11) — Web Framework + Production Server

Sinatra-style web framework with magic `@` context,
built-in validators, file serving (`@send`), middleware composition,
multi-worker process manager, hot reloading, automatic HTTPS, mDNS service
discovery, and request queueing.

| File | Lines | Role |
|------|-------|------|
| `api.rip` | ~662 | Core framework: routing, validation, `read()`, `session`, `@send`, server |
| `middleware.rip` | ~559 | Built-in middleware: cors, logger, sessions, compression, security |
| `server.rip` | ~1,323 | CLI, workers, load balancing, TLS, mDNS |
| `server.html` | ~420 | Built-in dashboard UI |

Key concepts:
- **`@` magic** — Handlers use `@req`, `@json()`, `@send()`, `@session` (bound via `this`)
- **`read()`** — Validates params/body with 37 built-in validators
- **`@send(path, type?)`** — Serve files with auto-detected MIME types via `Bun.file()`
- **`use()`** — Koa-style middleware composition with `next()`

```coffee
import { get, use, start, notFound } from '@rip-lang/server'

get '/', -> { message: 'Hello!' }
get '/css/*', -> @send "public/#{@req.path.slice(5)}"
notFound -> @send 'index.html', 'text/html; charset=UTF-8'
start port: 3000
```

```bash
rip server        # Start server (watches *.rip by default)
```

### Rip UI (built into rip-lang) — Reactive Web Framework

Zero-build reactive web framework. The browser loads `rip.min.js`
(compiler + pre-compiled UI framework), auto-detects inline components,
and renders with fine-grained DOM updates. Uses Rip's built-in reactive
primitives directly — one signal graph shared between framework and components.

| File | Lines | Role |
|------|-------|------|
| `app.rip` | ~965 | Unified framework: stash, router (path + hash), renderer, launch |
| `serve.rip` | ~93 | Server middleware: framework bundle, app bundle, SSE hot-reload |

Key concepts:
- **Shared scope** — Inline `<script type="text/rip">` tags are compiled and executed in one shared IIFE. Components use `export` to make themselves visible to other tags; exports are stripped to `const` declarations in the shared scope.
- **Server mode** — When `data-launch` is present on a script tag, the `serve` middleware provides the bundle. `use serve dir: dir` registers routes for the framework bundle (`/rip/rip.min.js`), app bundle (`/{app}/bundle`), and SSE hot-reload (`/{app}/watch`).
- **`launch(appBase)`** — Client-side: fetches the app bundle, hydrates the stash, starts the router and renderer
- **`component` / `render`** — Two keywords added to Rip for defining components with reactive state (`:=`), computed (`~=`), effects (`~>`)
- **File-based routing** — `pages/users/[id].rip` → `/users/:id` (Next.js-style). Shared components go in `components/`.
- **Unified stash** — Deep reactive proxy with path navigation, uses `__state` from Rip's built-in reactive runtime
- **Hot reload** — Server sends notify-only SSE events, browser invalidates + refetches + remounts

```coffee
# Server (index.rip)
import { get, use, start, notFound } from '@rip-lang/server'
import { serve } from '@rip-lang/server/middleware'

dir = import.meta.dir
use serve dir: dir, title: 'My App', watch: true
get '/css/*', -> @send "#{dir}/css/#{@req.path.slice(5)}"
notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'
start port: 3000
```

### Other Packages

- **@rip-lang/db** — DuckDB server with official UI + ActiveRecord-style client (`db.rip` ~388 lines, `client.rip` ~290 lines)
- **@rip-lang/schema** — ORM + validation with declarative syntax (~505 lines)
- **@rip-lang/swarm** — Parallel job runner with worker threads (~384 lines). Workers get the rip-loader via path walking from swarm's own `import.meta.url` (not `require.resolve`, which fails from directories without `node_modules`).
- **@rip-lang/csv** — CSV parser + writer with indexOf ratchet engine (~432 lines)
- **@rip-lang/http** — Zero-dependency HTTP client (ky-inspired convenience over native fetch)
- **@rip-lang/print** — Syntax-highlighted code printer using highlight.js (190+ languages). Serves once, caches via service worker for offline refresh.

### Rip Widgets (`packages/widgets/`) — Headless UI Components

Accessible, headless interactive components written in Rip. Zero dependencies,
zero CSS. Every widget exposes `data-*` attributes for styling and handles
keyboard interactions per WAI-ARIA Authoring Practices. Widgets are plain
`.rip` source files — no build step. The browser compiles them on the fly.

| File | Lines | What It Does |
|------|-------|-------------|
| `select.rip` | 169 | Dropdown with typeahead, ARIA listbox |
| `combobox.rip` | 114 | Filterable input + listbox |
| `dialog.rip` | 86 | Modal: focus trap, scroll lock, escape/click-outside dismiss |
| `toast.rip` | 44 | Auto-dismiss notification, ARIA live region |
| `popover.rip` | 95 | Anchored floating content with flip/shift |
| `tooltip.rip` | 89 | Hover/focus tooltip with delay |
| `tabs.rip` | 70 | Tab panel with roving tabindex |
| `accordion.rip` | 71 | Expand/collapse, single or multiple |
| `checkbox.rip` | 42 | Checkbox and switch toggle |
| `menu.rip` | 120 | Dropdown action menu |
| `grid.rip` | 858 | Virtual-scrolling data grid (100K+ rows at 60fps) |

**Integration:** Add the widgets directory to your serve middleware:

```coffee
use serve
  dir: dir
  components: ['components', '../../../packages/widgets']
```

All widgets become available by name (`Select`, `Dialog`, `Grid`, etc.) in
the shared scope — no imports needed.

**Grid highlights:**
- DOM recycling: pooled `<tr>` elements, `textContent` updates, zero allocation per scroll frame
- Full keyboard: arrows, Tab, Enter/F2 edit, Ctrl+arrows, PageUp/Down, Ctrl+A, type-to-edit
- Clipboard: Ctrl+C/V/X with TSV format (interop with Excel/Sheets/Numbers)
- Multi-column sorting: click header, Shift+click for secondary sort
- Column resizing: drag header borders
- Inline editing: text, checkbox toggle, select dropdown

**Widget Gallery dev server (`packages/widgets/`):**

The widget gallery uses `data-src` mode (not `data-launch`) for testing individual
widgets. The dev server is `index.rip` (14 lines) and the gallery is `index.html`.

```coffee
# index.rip — minimal dev server
import { get, use, start, notFound } from '@rip-lang/server'
import { serve } from '@rip-lang/server/middleware'

dir = import.meta.dir
use serve dir: dir, components: ['.'], watch: true
get '/*.rip', -> @send "#{dir}/#{@req.path.slice(1)}", 'text/plain; charset=UTF-8'
notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'
start port: 3005
```

Hot reload: `rip server` from `packages/widgets/` gives auto-HTTPS + mDNS
(`https://widgets.local`). The browser connects to the server's built-in
`/watch` SSE endpoint. Two reload mechanisms work together:
- **`.rip` file changes**: Manager detects the change, does a rolling restart.
  The SSE connection drops and EventSource auto-reconnects. The browser
  script detects the reconnection and calls `location.reload()`.
- **`.html`/`.css` changes**: The serve middleware's `watchDirs` (registered
  via `components: ['.']` and `watch: true`) detects the change and broadcasts
  a `reload` SSE event directly — no rolling restart needed.

The browser reload script is 4 lines in `index.html`:
```html
<script>
  let ready = false;
  const es = new EventSource('/watch');
  es.addEventListener('connected', () => ready ? location.reload() : (ready = true));
  es.addEventListener('reload', () => location.reload());
</script>
```

**Important architecture note for AI assistants:** Do NOT implement custom file
watchers or SSE endpoints in the worker `index.rip`. The `rip server` process
manager (rip-server) already handles file watching and SSE at the server level.
The `/watch` SSE endpoint is intercepted by rip-server's proxy before reaching
workers. Use `notFound` (not `get '/*'`) for the catch-all route — `get '/*'`
will intercept requests meant for the serve middleware (like `/rip/rip.min.js`).

**Rip-specific gotchas learned building widgets:**
- **Lifecycle hooks:** The recognized hooks are `beforeMount`, `mounted`,
  `updated`, `beforeUnmount`, `unmounted`, `onError`. Nothing else.
  `onMount` compiles as a regular method and never fires. This is the #1
  trap for widget authors.
- **`->` inside components:** The compiler auto-converts all thin arrows
  (`->`) to fat arrows (`=>`) inside component contexts. `this` binding is
  always preserved. Use `->` everywhere — it's cleaner and the compiler
  handles it.
- **Auto-wired event handlers:** Methods named `onClick`, `onKeydown`,
  etc. are automatically bound to the root element — no `@click: @onClick`
  boilerplate needed. Use an explicit binding only when the handler differs
  from the `on*` method. Child element bindings coexist via normal DOM
  propagation; use `e.stopPropagation()` to suppress the root handler.
- **`:=` vs `=` for internal storage:** Use `:=` (reactive state) only for
  values that should trigger DOM updates. For internal bookkeeping (pools,
  caches, timer IDs, saved DOM references), use `=` (plain assignment).
  Reactive state has overhead and can cause unwanted effect re-runs.
- **Imperative DOM in effects:** For performance-critical paths (Grid's
  60fps scroll), bypass the reactive render loop and do imperative DOM
  manipulation inside `~>` effects. The effect still triggers reactively
  but the DOM updates use `textContent`/`nodeValue`/`replaceChildren`.
- **`data-*` attributes, not classes:** All widget state is exposed via
  `data-*` attributes (`[data-open]`, `[data-selected]`, etc.). Consumers
  style these with CSS attribute selectors. Widgets never apply visual
  styles — they only set semantic state.
- **`slot` in render blocks:** The bare `slot` tag in a component render
  block projects `this.children` (the DOM content passed by the parent).
  It does NOT create an HTML `<slot>` element — Shadow DOM is not used.
- **`@event:` handlers on child components:** `@change: handler` on a
  child component compiles to `addEventListener('change', handler)` on
  the child's root DOM element. The child dispatches events via
  `@emit 'eventName', detail` which creates a `CustomEvent` on `this._root`.
- **`emit()` method:** Every component has an `emit(name, detail)` method
  that dispatches a `CustomEvent` with `{ detail, bubbles: true }` on the
  component's root element. Use it for non-binding event communication.
- **`_root` on child components:** When a parent instantiates a child
  component, `_root` is set during `_create()` (via
  `el = inst._root = inst._create()`). This is necessary for `emit()` to
  work — without `_root`, `emit` silently does nothing.
- **`rip.min.js` must be rebuilt after `components.js` changes:** The
  browser bundle includes the component runtime. After modifying
  `src/components.js`, run `bun run build` to regenerate `rip.min.js`.
  Then restart `rip server` to pick up the new bundle.

**Documentation in `packages/widgets/`:**
- `README.md` — Usage examples and API for every widget
- `NOTES.md` — Implementation details, known issues, Rip patterns
- `ARCHITECTURE.md` — Philosophy and CSS strategy (Open Props, `@layer`, etc.)
- `PRIORITIES.md` — Top 15 priorities and postmortem review

### Package Development

Packages use `workspace:*` linking in the root `package.json`. After modifying
a package locally, run `bun install` from the project root to ensure symlinks
are correct. Key patterns:

- Packages written in Rip (`.rip` files) need the Rip loader — run from the
  project root where `bunfig.toml` is located, or use `rip server`
- `import.meta.dir` resolves to the package's actual filesystem path (important
  for serving files)
- `@rip-lang/server` handlers bind `this` to the context object — use `@send`,
  `@json`, `@req`, etc.

**`rip server` uses the global install:** The `rip server` command runs
`@rip-lang/server/server.rip` from the **globally installed** package
(`~/.bun/install/global/node_modules/@rip-lang/server/`), not the workspace.
Changes to `packages/server/` won't take effect until published. For
server-only changes, publish just that package: `cd packages/server && bun publish`,
then `bun update` to pull into global. Use `bun run bump` only for full releases
(it bumps ALL packages). Workers spawned by rip-server DO use the workspace's
`node_modules` for imports in the app entry file (`index.rip`).

---

## Browser Runtime

`src/browser.js` (~150 LOC) provides the browser entry point. The browser
bundle (`docs/dist/rip.min.js`) is built as an IIFE and loaded with
`<script defer>` (not `type="module"` — this allows `file://` loading
without CORS issues).

### Shared-Scope Model

All `<script type="text/rip">` tags (inline or `src`) are compiled and
executed together in ONE shared async IIFE. Components defined with `export`
in one script tag are visible to all subsequent tags (exports are stripped
via the `skipExports` compiler option, becoming plain `const` declarations
in the shared scope).

### Loading Flow

`processRipScripts()` runs on `DOMContentLoaded` and handles all loading:

1. Collect `data-src` URLs from the runtime `<script>` tag (whitespace-separated)
2. Collect all `<script type="text/rip">` tags (inline `textContent` or external `src`)
3. Fetch all external URLs in parallel via `Promise.all`
4. Compile each source with `{ skipRuntimes: true, skipExports: true }`
5. If `data-mount` is present, append `Component.mount(target)` to the compiled code
6. Execute everything as one shared async IIFE
7. If `data-launch` is present, call `launch()` with the bundle URL (server mode)

### HTML Attributes

| Attribute | On | Purpose |
|-----------|-----|---------|
| `data-src` | runtime script | Whitespace-separated URLs of `.rip` files to fetch and compile |
| `data-mount` | runtime script | Component name to instantiate and mount after compilation |
| `data-target` | runtime script | Mount target selector (default: `'body'`), pairs with `data-mount` |
| `data-launch` | runtime script | Bundle URL for server mode — triggers `launch()` with full app lifecycle |
| `data-hash` | runtime script | Enable hash-based routing (for `data-launch` apps) |
| `data-persist` | runtime script | Enable stash persistence — `data-persist` for sessionStorage, `data-persist="local"` for localStorage |

### Component Mounting

Every component class has a static `mount(target)` method:

```coffee
App.mount '#app'     # shorthand for App.new().mount('#app')
App.mount()          # defaults to 'body'
```

This can be used from a `<script type="text/rip">` tag as an alternative to
`data-mount`. `data-mount` is declarative (no extra script tag); `App.mount`
is code-based (more flexible — conditional mounting, multiple mounts, etc.).

### Key Features

- **`rip()` console REPL** — Wraps code in a Rip `do ->` block before
  compiling, so the compiler handles implicit return and auto-async natively.
  Sync code returns values directly; async code returns a Promise.
- **`importRip(url)`** — Fetches a `.rip` file, compiles it, imports as an
  ES module via blob URL.
- **Eager runtime registration** — Both reactive (`__rip`) and component
  (`__ripComponent`) runtimes are registered on `globalThis` at load time.

### globalThis Registrations

| Function | Purpose |
|----------|---------|
| `rip(code)` | Console REPL — compile and execute Rip code |
| `importRip(url)` | Fetch, compile, and import a `.rip` file |
| `compileToJS(code)` | Compile Rip source to JavaScript |
| `__rip` | Reactive primitives (`__state`, `__computed`, `__effect`, `__batch`) |
| `__ripComponent` | Component runtime (`__component`, `__render`, etc.) |

### Compiler Options for Browser

| Option | Purpose |
|--------|---------|
| `skipExports` | Suppresses `export` keywords in codegen — `export const X` becomes `const X` |
| `skipRuntimes` | Skips reactive/component runtime blocks (already on `globalThis`), uses `var` for helpers to allow safe re-emission across concatenated files |

### Variable Persistence in `rip()`

`let` declarations are stripped (bare assignments create globals in sloppy
mode eval). `const` is hoisted to `globalThis.` explicitly. This allows
variables to persist across `rip()` calls in the browser console.

---

## Rip Loader (`rip-loader.js`)

The rip-loader is a Bun plugin that compiles `.rip` files on the fly. It's
preloaded via `--preload rip-loader.js` (by `bin/rip`) or via `bunfig.toml`
(in the dev workspace). It does two things:

1. **Compiles `.rip` files** — Registers a Bun plugin with `onLoad` for
   `/\.rip$/` that reads the source, compiles to JS via `compileToJS()`,
   and returns the compiled code.

2. **Rewrites `@rip-lang/*` imports to absolute paths** — After compilation,
   a regex replaces `@rip-lang/*` import specifiers with absolute filesystem
   paths resolved via `import.meta.resolve()`. This is necessary because
   Bun's worker threads don't respect `NODE_PATH`, and `onResolve` doesn't
   fire for imports in compiled source. Since the rip-loader lives inside
   the global `node_modules` tree, `import.meta.resolve` finds sibling
   `@rip-lang/*` packages naturally.

### `bin/rip` Environment Setup

The `rip` binary sets `NODE_PATH` to include its parent `node_modules`
directory and passes `env: process.env` explicitly to all `spawn`/`spawnSync`
calls. This is needed because Bun has a bug where `process.env` modifications
are not inherited by child processes unless `env` is passed explicitly.

### Known Bun Bugs/Limitations (as of Bun v1.3.9)

| Bug | Workaround |
|-----|-----------|
| `process.env` changes not inherited by `spawn`/`spawnSync` | Pass `env: process.env` explicitly |
| `NODE_PATH` ignored by worker threads | Rewrite imports to absolute paths in `onLoad` |
| Plugin `onResolve` doesn't fire for imports in `onLoad`-compiled source | Do import rewriting inside `onLoad` instead |
| `require.resolve({ paths })` ignores `paths` inside plugin handlers | Use `import.meta.resolve` instead |

---

## Playground & Demos

HTML files in `docs/`, all using the shared-scope model with `<script defer>`:

| File | Purpose |
|------|---------|
| `index.html` | Interactive playground — compiler, REPL, examples, theme select, resizable panes |
| `demo.html` | ACME Corp Dashboard — full ECharts app using `data-mount="Dashboard"` |
| `charts.html` | Same dashboard, standalone copy |
| `sierpinski.html` | Sierpinski triangle demo (loads `rip.min.js` from CDN) |
| `example/index.html` | Generic app launcher — fetches JSON bundle (requires server) |
| `results/index.html` | Lab Results app — 7 components in shared scope with `data-mount="Home"` |

Static files (`demo.html`, `charts.html`, `sierpinski.html`) work from `file://` — just double-click to open. The playground and example app require `bun run serve` → `http://localhost:3000/`.

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
| Defined check | `x!?` | Postfix `!?` — true if not undefined |
| Presence check | `x?!` | Postfix `?!` — true if truthy, else undefined (Houdini operator) |

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
- **Never read or execute scripts directly** — Use `bun run <name>` (e.g. `bun run bump`, not `scripts/bump.js`)
- Run `bun run test` before committing
- Run `bun run parser` after grammar changes
- Run `bun run build` after codegen or browser.js changes
- Run `bun run bump` to release — it handles version, test, build, commit, push, and publish

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
| `!?` | Otherwise | `val !? 5` — default if undefined (infix) |
| `!?` | Defined | `val!?` — true if not undefined (postfix) |
| `?!` | Presence | `@checked?!` — true if truthy, else undefined (Houdini) |
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

### Standard Library

Rip injects 13 global helpers via `globalThis` into every compiled program. Defined in `getStdlibCode()` in `src/compiler.js`, also injected into the CLI REPL (`src/repl.js`) and browser REPL (`docs/index.html`).

| Function | Description | Example |
|----------|-------------|---------|
| `abort(msg?)` | Log to stderr, exit with code 1 | `abort "fatal error"` |
| `assert(v, msg?)` | Throw if falsy | `assert x > 0, "must be positive"` |
| `exit(code?)` | Exit process | `exit 1` |
| `kind(v)` | Lowercase type name (fixes `typeof`) | `kind [] # "array"` |
| `noop()` | No-op function | `onClick ?= noop` |
| `p(...args)` | `console.log` shorthand | `p "hello"` |
| `pp(v)` | Pretty-print JSON, returns value | `pp user # logs and returns` |
| `raise(a, b?)` | Throw error | `raise TypeError, "bad"` |
| `rand(a?, b?)` | Random number | `rand 10 # 0-9` |
| `sleep(ms)` | Promise-based delay | `sleep! 1000` |
| `todo(msg?)` | Throw "Not implemented" | `todo "finish later"` |
| `warn(...args)` | `console.warn` shorthand | `warn "deprecated"` |
| `zip(...arrays)` | Zip arrays pairwise | `zip names, ages` |

All use `??=` (overridable by redeclaring). The REPL uses `skipPreamble: true` and injects separately via `getStdlibCode()`.

### Build Commands

All scripts live in `scripts/` as `.js` files. Always use `bun run <name>` — never try to read or execute scripts directly.

```bash
bun run test      # Run all tests
bun run parser    # Rebuild parser from grammar
bun run build     # Build browser bundle (docs/dist/rip.min.js)
bun run bump      # All-in-one release: bump version, test, build, commit, push, publish
bun run serve     # Start dev server (localhost:3000)
bun publish       # Publish to npm (use bun, not npm)
```

**`bun run bump`** is the standard release workflow. It handles everything: increments the patch version, runs the test suite, rebuilds the browser bundle, commits, pushes, and publishes to npm. Use this instead of manually running build + commit + push separately.

---

**For AI Assistants:** The code is well-tested and the architecture is clear. Trust the tests, use the debug tools (`-s`, `-t`, `-c`), and follow existing patterns. Most compiler work happens in `src/compiler.js` — find the generator method for the node type you're working with and modify it. For package work, each package has its own README with detailed documentation — see `packages/README.md` for the overview.
