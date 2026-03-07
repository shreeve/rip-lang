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
bun run test                             # All tests
bun test/runner.js test/rip/FILE.rip     # Specific file

# Rebuild parser (after grammar changes)
bun run parser

# Build browser bundle
bun run build

# Serve an app (watches *.rip, HTTPS, mDNS)
rip server
```

### File Editing Rules

| File                      | Can Edit? | Notes                                                           |
| ------------------------- | --------- | --------------------------------------------------------------- |
| `src/compiler.js`         | Yes       | Code generator — main work here                                 |
| `src/lexer.js`            | Yes       | Lexer and rewriter                                              |
| `src/types.js`            | Yes       | Type system (lexer sidecar)                                     |
| `src/components.js`       | Yes       | Component system (compiler sidecar)                             |
| `src/grammar/grammar.rip` | Carefully | Run `bun run parser` after changes                              |
| `src/parser.js`           | Never     | Generated file                                                  |
| `src/sourcemaps.js`       | Yes       | Source map generator                                            |
| `src/browser.js`          | Yes       | Browser entry point (shared-scope loader)                       |
| `rip-loader.js`           | Yes       | Bun plugin — compiles .rip files + rewrites @rip-lang/* imports |
| `src/grammar/solar.rip`   | Never     | Parser generator (given)                                        |
| `test/rip/*.rip`          | Yes       | Test files                                                      |

---

## The Compilation Pipeline

```
Rip Source  ->  Lexer  ->  emitTypes  ->  Parser  ->  S-Expressions  ->  Codegen  ->  JavaScript
                           (types.js)                 (arrays + .loc)               + source map
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

Use `echo 'code' | ./bin/rip -s` to inspect the S-expression for any syntax. The complete catalog can be found by searching `GENERATORS` in `src/compiler.js`.

### 1a. Lexer Token Format

Token: `[tag, val]` array with properties:

| Property   | Type        | Purpose                                                         |
| ---------- | ----------- | --------------------------------------------------------------- |
| `.pre`     | number      | Whitespace count before this token                              |
| `.data`    | object/null | Metadata: `{await, predicate, quote, invert, parsedValue, ...}` |
| `.loc`     | `{r, c, n}` | Row, column, length                                             |
| `.spaced`  | boolean     | Sugar for `.pre > 0`                                            |
| `.newLine` | boolean     | Preceded by a newline                                           |

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
contents = """
    username=#{user}
    password=#{pass}
    """
# Result: "username=...\npassword=..."  (closing """ at same indent strips all)
```

### 4a. Raw Heredocs (`'''\` and `"""\`)

Appending `\` to a heredoc opener makes recognized escape sequences (`\n`, `\t`, `\u`, `\x`, `\\`, etc.) stay literal in the output. Useful for embedding code strings, shell scripts, or regex-heavy content.

```coffee
raw = '''\
  hello\nworld
  \'''
# Result: "hello\\nworld" (literal \n, two characters)
```

Note: `\s`, `\w`, `\d` and other non-JS-escape sequences pass through unchanged in both normal and raw heredocs. Raw mode only affects sequences that `'''`/`"""` would normally process.

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

| Operator | Name            | Mnemonic                 | Output                                                 |
| -------- | --------------- | ------------------------ | ------------------------------------------------------ |
| `=`      | Assign          | "gets value"             | `let x; x = value`                                     |
| `:=`     | State           | "gets state"             | `const x = __state(value)`                             |
| `~=`     | Computed        | "always equals"          | `const x = __computed(() => expr)`                     |
| `~>`     | Effect          | "always calls"           | `__effect(() => { ... })` or `const x = __effect(...)` |
| `=!`     | Readonly        | "equals, dammit!"        | `const x = value` (just const)                         |
| `offer`  | Context provide | "share with descendants" | `__state(value)` + `setContext('name', this.name)`     |
| `accept` | Context consume | "receive from ancestor"  | `this.name = getContext('name')`                       |

The reactive runtime is embedded in compiler.js and only included when needed.

### Context Sharing: `offer` / `accept`

Context-sensitive keywords (only active inside `component` bodies — plain identifiers elsewhere). Share reactive state between ancestor and descendant components without prop drilling.

```coffee
# Parent — creates state and shares it with all descendants
export Tabs = component
  offer active := 'overview'

# Child — receives the signal from nearest ancestor
export TabContent = component
  accept active
```

`offer` wraps any assignment operator (`:=`, `~=`, `=`, `=!`). The signal passes through directly — parent and child share the same reactive object. Mutations in either direction are instant.

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

Tag class patterns in render blocks:

```coffee
div.card                     # static class: <div class="card">
.card                        # implicit div: <div class="card">
div.card.active              # multiple: <div class="card active">
.("flex-1 p-4")             # dynamic: <div class="flex-1 p-4"> (via __clsx)
.card.("flex-1 p-4")        # combined: <div class="card flex-1 p-4">
.card.primary.("flex", x)   # multiple static + dynamic args
```

Key mechanisms: `startsWithTag` (backward scan to determine if line starts with a template tag), `pendingCallEnds` (indent-level stack for matching injected CALL_START/CALL_END pairs), `fromThen` skip (inline values from `if x then y else z`, never template nesting), data attribute sigil (`$open: true` -> `"data-open": true`).

### Component Codegen (CodeGenerator side)

Generates fine-grained DOM operations at compile time (no virtual DOM). Key entry points: `buildRender` (initializes render state), `generateNode` (dispatch for elements, text, conditionals, loops, components), `generateConditional` (block factories for if/else), `generateTemplateLoop` (`__reconcile` with LIS-based keyed diffing).

### Auto-Wired Event Handlers (`on*` convention)

Component methods named `onClick`, `onKeydown`, `onMouseenter`, etc. are automatically bound to the component's root DOM element. The rule: `on` + capitalized event name -> `addEventListener(lowercased, handler)` on the root element. No explicit `@click: @onClick` wiring needed.

- **Root only**: Only the first HTML tag in `buildRender` gets auto-wired. Non-tag roots (conditionals, loops, components) skip auto-wiring
- **Explicit override**: An `@event: handler` binding on the root element suppresses auto-wiring for that event
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

### Transitions (`~tilde` syntax)

CSS enter/leave transitions on conditional blocks. Use `div ~fade` syntax in render blocks. Built-in presets: `fade`, `slide`, `scale`, `blur`, `fly`. Custom transitions work with user-provided CSS using `{name}-enter-from`, `{name}-enter-active`, `{name}-leave-to` convention.

### Testing Components

Component tests live in `test/rip/components.rip`. Use `code` tests with `{ skipPreamble: true, skipRuntimes: true }` options to verify generated JavaScript output for render blocks. Use `test` tests for runtime behavior (state, computed, methods, LIS algorithm, error boundaries — no DOM needed).

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

### Shadow TypeScript (`--shadow`)

The `--shadow` flag dumps the virtual TypeScript file that `rip check` and the VS Code LSP feed to the TypeScript language service. This is the primary tool for debugging type issues. The output has two sections:

1. **DTS declarations** — type annotations (`::`) emitted as TypeScript `let x: Type` declarations, plus type aliases, interfaces, enums, and reactive helper types (`Signal<T>`, `Computed<T>`)
2. **Compiled body** — the full compiled JavaScript, with `@ts-expect-error` directives injected where `rip check` expects type errors

TypeScript sees both sections together as a single `.ts` file. This means declared types constrain the compiled assignments below them — that's how Rip achieves type checking without ever writing TypeScript.

```bash
# Typical debugging workflow
rip --shadow file.rip    # What does TS actually see? Start here.
rip -d file.rip          # Are the .d.ts declarations correct?
rip -c file.rip          # Is the compiled JS what you expect?
rip -s file.rip          # Is the parser producing the right tree?
```

---

## Source Maps

Rip generates Source Map V3 (ECMA-426) for debugging support. Source maps are embedded inline as base64 data URLs — one file, no separate `.map` file needed.

- Every S-expression node carries `.loc = {r, c}` from its original source position
- The code generator builds line-level mappings between output JS and source Rip
- `SourceMapGenerator` (in `src/sourcemaps.js`) produces VLQ-encoded mappings
- `toReverseMap()` provides O(1) source->generated position lookup (used by VS Code extension)

```bash
rip -m example.rip     # Compile with inline source map
rip -cm example.rip    # Show compiled JS with source map
```

---

## VS Code Extension

The Rip extension (`packages/vscode/`) provides syntax highlighting, auto `.d.ts` generation on save, and TypeScript-powered type intelligence (autocomplete, hover, go-to-definition). See `packages/vscode/README.md` for settings and publishing.

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

Test files are in `test/rip/` — use `ls test/rip/` to see the full list.

---

## Packages

The `packages/` directory contains optional packages that extend Rip for
full-stack development. All are written in Rip, have zero dependencies, and
run on Bun.

### @rip-lang/server — Web Framework + Production Server

Sinatra-style web framework with magic `@` context,
built-in validators, file serving (`@send`), middleware composition,
multi-worker process manager, hot reloading, automatic HTTPS, mDNS service
discovery, and request queueing.

Key concepts:

- `**@` magic** — Handlers use `@req`, `@json()`, `@send()`, `@session` (bound via `this`)
- `**read()`** — Validates params/body with 37 built-in validators
- `**@send(path, type?)**` — Serve files with auto-detected MIME types via `Bun.file()`
- `**use()**` — Koa-style middleware composition with `next()`

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
primitives directly.

Key concepts:

- **Shared scope** — Inline `<script type="text/rip">` tags are compiled and executed in one shared IIFE. Components use `export` to make themselves visible to other tags; exports are stripped to `const` declarations in the shared scope.
- **Bundle mode** — URLs in `data-src` that don't end in `.rip` are fetched as JSON bundles containing multiple files. The serve middleware provides bundles at `/{app}/bundle`.
- **Stash** — Created from `data-state` JSON. Bundle data is merged automatically.
- `**component` / `render**` — Two keywords added to Rip for defining components with reactive state (`:=`), computed (`~=`), effects (`~>`)
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

- **@rip-lang/db** — DuckDB server with official UI + ActiveRecord-style client
- **@rip-lang/schema** — ORM + validation with declarative syntax
- **@rip-lang/swarm** — Parallel job runner with worker threads. Workers get the rip-loader via path walking from swarm's own `import.meta.url` (not `require.resolve`, which fails from directories without `node_modules`).
- **@rip-lang/csv** — CSV parser + writer with indexOf ratchet engine
- **@rip-lang/http** — Zero-dependency HTTP client (ky-inspired convenience over native fetch)
- **@rip-lang/print** — Syntax-highlighted code printer using highlight.js (190+ languages). Serves once, caches via service worker for offline refresh.

### Rip UI (`packages/ui/`) — Headless UI Components

Accessible, headless interactive components written in Rip. Zero dependencies.
Every widget exposes `$` attributes (compiled to `data-`* in HTML) for styling and handles
keyboard interactions per WAI-ARIA Authoring Practices. Widgets are plain
`.rip` source files — no build step. The browser compiles them on the fly.

**Widget conventions:**

- All DOM refs use `ref: "_name"` -- never `div._name` (dot syntax sets CSS classes)
- Naming: `_trigger`/`_list`/`_content` for standard refs, `_slot` with `style: "display:none"` for reading child definitions
- Auto-wired events: `onKeydown`, `onScroll`, etc. (root element, no explicit binding)
- Child-element handlers: `_headerClick`, `_resizeStart` (underscore prefix, explicit binding)
- Use `=!` for constant values (IDs), `:=` only for reactive state that drives DOM
- Click-outside: document `mousedown` listener with effect cleanup (not backdrop divs)
- Dropdown positioning: `position:fixed;visibility:hidden` inline, then `_position()` via rAF
- Focus override: `preventScroll: true` globally at module scope (outside component body)
- Reactive arrays over helper functions: `toasts = [...toasts, { message: "Saved!" }]`
-- no `addToast()` helpers, no manager objects
- Shared-scope naming: prefix module-scope variables with widget name (`acCollator` not `collator`) to avoid collisions across `.rip` files sharing one scope
- **Don't shadow prop names with local variables** — Inside component methods, the compiler
rewrites ANY identifier matching a prop/state name to `this.name.value`.
A local `items` becomes `this.items.value` if `@items` is a prop, silently overwriting state.
Always use distinct names for locals: `opts` not `items`, `tick` not `step`.
Check compiled JS (`rip -c`) for unexpected `this.propName.value =` assignments.
- **Use explicit index names in nested render loops** — the compiler auto-generates `i` for
unnamed indices. Nested loops both get `i`, causing a syntax error. Fix: name both
(`for outer, oIdx in list` / `for inner, iIdx in sublist`). Single loops are fine.
- Don't use `value: @prop` on `<input>` elements: Rip's smart auto-binding writes the
input's string value back to the signal, corrupting numeric state. Use a `_ready`-guarded
`~>` effect to push values to the input, and `@blur`/`@input` handlers to parse back.
- Computed values (`~=`) are read-only: you cannot assign to them. To invalidate a computed
from an event handler or observer, bump a reactive counter that the computed reads:
`_tick := 0` then `_tick = _tick + 1` in the handler.
- Go imperative for continuous DOM tracking: for scroll position, drag offsets, resize
dimensions, and anything that updates at 60fps -- read the DOM, compute, and write directly
in a single method (`_updateThumb()`, `_renderRows()`). Rule of thumb: if the data source
is a DOM property (`scrollTop`, `clientHeight`), go imperative. If it's reactive state, use the reactive system.
- Put side effects in effect branches, not just methods: when `@open` is controlled via
`<=>`, the consumer can set it directly without calling `close()`. Use
`~> if @open ... else ...` so the effect handles all state transitions.
Methods like `close()` should just set state (`@open = false`) and emit events.
- `**x.y` in render blocks is tag syntax:** A bare `item.textContent` on its
own line in a render block is parsed as a tag named `item` with CSS class
`textContent`, not a property access. Use the `=` prefix to output
expressions as text: `= item.textContent`. This works for any case,
including HTML tag names like `= nav.dataset.trigger` or `= link.href`.

**Integration:** Add the widgets directory as a named bundle in your serve middleware:

```coffee
use serve
  dir: dir
  bundle:
    ui:  ['../../../packages/ui']
    app: ['routes', 'components']
```

Then load both bundles in HTML via `data-src="ui app"`. Each named bundle
gets its own endpoint (`{prefix}/ui`, `{prefix}/app`), cache, and ETag.
The legacy flat-array format (`bundle: ['components']`) still works and
creates a single bundle at `{prefix}/bundle`.

All widgets become available by name (`Select`, `Dialog`, `Grid`, etc.) in
the shared scope — no imports needed.

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
- `**->` inside components:** The compiler auto-converts all thin arrows
(`->`) to fat arrows (`=>`) inside component contexts. `this` binding is
always preserved. Use `->` everywhere -- it's cleaner and the compiler
handles it. **Caveat:** If you need `this` to refer to a DOM element (e.g.,
patching `HTMLElement.prototype.focus`), put the code OUTSIDE the component
body at module scope -- `->` stays as `->` there and `this` refers to the
caller.
- `**:=` vs `=` for internal storage:** Use `:=` (reactive state) only for
values that should trigger DOM updates. For internal bookkeeping (pools,
caches, timer IDs, saved DOM references), use `=` (plain assignment).
- `**_ready` flag pattern:** Effects run during `_init` (before `_create`),
so `ref:` DOM elements don't exist yet. Add `_ready := false` to state,
set `_ready = true` in `mounted`, and guard effects with
`return unless _ready`. The reactive `_ready` flag triggers the effect
to re-run after mount when DOM refs are available.
- `**ref:` is not reactive:** `ref: "_foo"` sets `this._foo` as a plain
property during `_create`, not a reactive signal. Effects cannot track
when refs are set. Use the `_ready` pattern above to bridge the gap.
- `**offer`/`accept` are context-sensitive:** They are only keywords inside
`component` bodies. Outside components, `offer` and `accept` are plain
identifiers (safe to use as variable names in server code, etc.).
- **Imperative DOM in effects:** For performance-critical paths (Grid's
60fps scroll), bypass the reactive render loop and do imperative DOM
manipulation inside `~>` effects.
- `**$` sigil for data attributes:** In render blocks, use `$open`, `$selected`,
etc. -- the compiler expands `$` to `data-` in the generated HTML. Consumers
style with CSS attribute selectors (`[data-open]`, `[data-selected]`). Widgets
never apply visual styles -- they only set semantic state.
- `**slot` in render blocks:** The bare `slot` tag in a component render
block projects `this.children` (the DOM content passed by the parent).
It does NOT create an HTML `<slot>` element -- Shadow DOM is not used.
- `**@event:` handlers on child components:** `@change: handler` on a
child component compiles to `addEventListener('change', handler)` on
the child's root DOM element. The child dispatches events via
`@emit 'eventName', detail` which creates a `CustomEvent` on `this._root`.
- `**emit()` method:** Every component has an `emit(name, detail)` method
that dispatches a `CustomEvent` with `{ detail, bubbles: true }` on the
component's root element.
- `**rip.min.js` must be rebuilt after `components.js` changes:** The
browser bundle includes the component runtime. After modifying
`src/components.js`, run `bun run build` to regenerate `rip.min.js`.
Then restart `rip server` to pick up the new bundle.

### Package Development

Packages use `workspace:`* linking in the root `package.json`. After modifying
a package locally, run `bun install` from the project root to ensure symlinks
are correct.

`**rip server` uses the global install:** The `rip server` command runs
`@rip-lang/server/server.rip` from the **globally installed** package
(`~/.bun/install/global/node_modules/@rip-lang/server/`), not the workspace.
Changes to `packages/server/` won't take effect until published. Workers
spawned by rip-server DO use the workspace's `node_modules` for imports in
the app entry file (`index.rip`).

---

## Browser Runtime

`src/browser.js` provides the browser entry point. The browser bundle (`docs/dist/rip.min.js`) is built as an IIFE. All `<script type="text/rip">` tags are compiled and executed together in one shared async IIFE. Components use `export` to become visible across tags; `skipExports` strips the keyword to plain `const` in the shared scope.

Key `<script>` tag attributes: `data-src` (URLs to load), `data-mount` (component to mount), `data-target` (mount selector), `data-state` (JSON stash seed), `data-router` (history/hash routing), `data-persist` (session/localStorage), `data-reload` (SSE hot reload).

Browser compiler options: `skipExports` (suppresses `export` keyword), `skipRuntimes` (skips reactive/component runtime blocks already on `globalThis`).

## Rip Loader (`rip-loader.js`)

Bun plugin that compiles `.rip` files on the fly and rewrites `@rip-lang/*` imports to absolute paths (needed because Bun worker threads don't respect `NODE_PATH`). Preloaded via `bunfig.toml` or `--preload`. See source and inline comments for details.

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

| Operator    | Name            | Example                                                                |
| ----------- | --------------- | ---------------------------------------------------------------------- |
| `!`         | Dammit          | `fetchData!` — calls AND awaits                                        |
| `!`         | Void            | `def process!` — suppresses return                                     |
| `=!`        | Readonly        | `MAX =! 100` — const ("equals, dammit!")                               |
| `!?`        | Otherwise       | `val !? 5` — default if undefined (infix)                              |
| `!?`        | Defined         | `val!?` — true if not undefined (postfix)                              |
| `?!`        | Presence        | `@checked?!` — true if truthy, else undefined (Houdini)                |
| `?`         | Existence       | `x?` — true if not null/undefined                                      |
| `//`        | Floor div       | `7 // 2` — 3                                                           |
| `%%`        | True mod        | `-1 %% 3` — 2                                                          |
| `:=`        | State           | `count := 0` — reactive state                                          |
| `~=`        | Computed        | `doubled ~= count * 2` — computed                                      |
| `<=>`       | Two-way bind    | `value <=> name` — bidirectional reactive binding (Rip original)       |
| `=~`        | Match           | `str =~ /pat/` — Ruby-style regex                                      |
| `.new()`    | Constructor     | `User.new()` — Ruby-style new                                          |
| `::`        | Prototype       | `String::trim` — `String.prototype.trim`                               |
| `if...else` | Postfix ternary | `"a" if cond else "b"` — Python-style                                  |
| `[-n]`      | Negative index  | `arr[-1]` — last element via `.at()`                                   |
| `*`         | String repeat   | `"-" * 40` — string repetition                                         |
| `<` `<=`    | Chained         | `1 < x < 10` — chained comparisons                                     |
| `|>`        | Pipe            | `x |> fn` or `x |> fn(y)` — first-arg pipe                             |
| `.=`        | Method assign   | `x .= trim()` — `x = x.trim()` (Rip original)                          |
| `?.` `=`    | Optional assign | `el?.style.display = "none"` — guarded assign (Rip original)           |
| `=`         | Render text     | `= item.textContent` — output expression as text node in render blocks |
| `*`         | Merge assign    | `*obj = {a: 1}` — `Object.assign(obj, ...)` (Rip original)             |
| `not in`    | Not in          | `x not in arr` — negated membership                                    |
| `loop n`    | Repeat N        | `loop 5 -> body` — repeat N times                                      |
| `it`        | Implicit param  | `-> it > 5` — auto-injected parameter                                  |
| `or return` | Guard           | `x = get() or return err` — early return                               |
| `?? throw`  | Nullish guard   | `x = get() ?? throw err` — throw if null                               |
| `%w`        | Word literal    | `%w[foo bar baz]` — `["foo", "bar", "baz"]` (Ruby-style)              |

### Standard Library

Rip injects 13 global helpers via `globalThis` into every compiled program. Defined in `getStdlibCode()` in `src/compiler.js`, also injected into the CLI REPL (`src/repl.js`) and browser REPL (`docs/index.html`).

| Function          | Description                          | Example                            |
| ----------------- | ------------------------------------ | ---------------------------------- |
| `abort(msg?)`     | Log to stderr, exit with code 1      | `abort "fatal error"`              |
| `assert(v, msg?)` | Throw if falsy                       | `assert x > 0, "must be positive"` |
| `exit(code?)`     | Exit process                         | `exit 1`                           |
| `kind(v)`         | Lowercase type name (fixes `typeof`) | `kind [] # "array"`                |
| `noop()`          | No-op function                       | `onClick ?= noop`                  |
| `p(...args)`      | `console.log` shorthand              | `p "hello"`                        |
| `pp(v)`           | Pretty-print JSON, returns value     | `pp user # logs and returns`       |
| `raise(a, b?)`    | Throw error                          | `raise TypeError, "bad"`           |
| `rand(a?, b?)`    | Random number                        | `rand 10 # 0-9`                    |
| `sleep(ms)`       | Promise-based delay                  | `sleep! 1000`                      |
| `todo(msg?)`      | Throw "Not implemented"              | `todo "finish later"`              |
| `warn(...args)`   | `console.warn` shorthand             | `warn "deprecated"`                |
| `zip(...arrays)`  | Zip arrays pairwise                  | `zip names, ages`                  |

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

`**bun run bump**` is the standard release workflow. It handles everything: increments the patch version, runs the test suite, rebuilds the browser bundle, commits, pushes, and publishes to npm. Use this instead of manually running build + commit + push separately.

---

**For AI Assistants:** The code is well-tested and the architecture is clear. Trust the tests, use the debug tools (`-s`, `-t`, `-c`), and follow existing patterns. Most compiler work happens in `src/compiler.js` — find the generator method for the node type you're working with and modify it. For package work, each package has its own README with detailed documentation — see `packages/README.md` for the overview.