# Compiler Subsystem — Agent Guide

This covers `compiler.js`, `lexer.js`, `components.js`, `browser.js`, `types.js`, `types-emit.js`, `app.rip`, `typecheck.js`, the `schema/` subdirectory, and the `grammar/` directory. The schema feature lives in `src/schema/` (entry `src/schema/schema.js`, imported via relative paths like `./schema/schema.js` from sibling modules).

---

## Module Map — browser-side vs CLI-only

The browser bundle (`docs/dist/rip.min.js`) is built from `src/browser.js` plus the compiled `src/app.rip`. Every module statically reachable from either entry ends up in the bundle. `scripts/check-bundle-graph.js` walks both entries on every `bun run build` and fails if any reachable file matches a forbidden list.

| Module | Browser? | Purpose |
| --- | --- | --- |
| `src/browser.js` | yes (entry) | `<script type="text/rip">` discovery, `processRipScripts`, `importRip`, REPL |
| `src/app.rip` | yes (entry) | Rip App framework runtime: stash, resource, timing, components store, router, renderer, launch, ARIA helpers |
| `src/parser.js` | yes | generated LR table |
| `src/lexer.js` | yes | tokenizer + rewriter pipeline |
| `src/compiler.js` | yes | codegen + reactive runtime + component runtime + `compileToJS` + `setTypesEmitter` hook + `emitEnum` |
| `src/components.js` | yes | render rewriter + component runtime |
| `src/schema/schema.js` | yes (via `./schema/schema.js`) | lexer rewrite + body parser + emitSchema codegen + `setSchemaRuntimeProvider` hook (no fragment imports) |
| `src/schema/loader-browser.js` | yes (browser only, via `./schema/loader-browser.js`) | imports validate + browser-stubs fragments; eager-installs browser runtime; registers provider |
| `src/schema/loader-server.js` | **no** (CLI / server / tests, via `./schema/loader-server.js`) | imports all five fragments; eager-installs migration runtime; registers provider |
| `src/schema/runtime.generated.js` | yes (browser uses 2 of 5 exports) | autogen from `runtime-*.js` fragments; CI staleness check via `bun run test:schema-fresh` |
| `src/schema/runtime-validate.js` | source for the `validate` fragment (universal) |
| `src/schema/runtime-db-naming.js` | source for `db-naming` fragment (server + migration) |
| `src/schema/runtime-orm.js` | source for `orm` fragment (server + migration) |
| `src/schema/runtime-ddl.js` | source for `ddl` fragment (migration only) |
| `src/schema/runtime-browser-stubs.js` | source for `browser-stubs` fragment (browser only) |
| `src/types.js` | yes | only `installTypeSupport(Lexer)` — token-stream type stripper |
| `src/error.js` | yes | runtime error formatting |
| `src/sourcemaps.js` | yes | inline source-map generation |
| `src/generated/dom-tags.js` | yes | HTML/SVG tag set for render-block tag detection |
| `src/generated/dom-events.js` | yes | event-name set for `onClick`/`onKeydown` auto-wire |
| `src/types-emit.js` | **no** | `.d.ts` emitter + intrinsic decl tables — CLI / typecheck only |
| `src/schema/dts-emit.js` | **no** | schema `.d.ts` emitter — CLI / typecheck only |
| `src/typecheck.js` | **no** | TypeScript LSP integration — CLI only |
| `src/repl.js` | **no** | interactive CLI REPL |

The forbidden list in `scripts/check-bundle-graph.js` enforces this. If a code change would put a forbidden module on the browser graph, `bun run build` aborts before the bundler runs.

### Registration-hook pattern (`setTypesEmitter`, `setSchemaRuntimeProvider`)

The same pattern is used twice — once for `.d.ts` emission, once for the schema runtime body. Both make the bundler's tree-shaker keep CLI/server-only code out of the browser bundle.

`compiler.js` exports `setTypesEmitter(fn)`. The default emitter is `null`. The two `compile()` callsites that produce `.d.ts` output guard with `(typeTokens && _typesEmitter)` and silently skip if no emitter is registered.

`src/types-emit.js` calls `setTypesEmitter(emitTypes)` at module load. Any caller that wants `.d.ts` output side-effect-imports `types-emit.js`:

```javascript
// CLI entry — bin/rip
import '../src/types-emit.js';   // installs emitter

// LSP integration
import { ... } from './types-emit.js';

// Test runner that exercises type emission
import '../src/types-emit.js';
```

The browser bundle never imports `types-emit.js`, so the emitter stays null and the `.d.ts` path is dead code that the bundler prunes.

**Failure mode to remember:** If you write code that calls `compile(source, { types: 'emit' })` and inspects `result.dts`, you **must** import `src/types-emit.js` (directly or indirectly) somewhere in that code path. Without it, `result.dts` is `null` regardless of source content. Symptom: types emission "silently does nothing" — no error, no warning, just empty output. The fix is one line: `import '../src/types-emit.js';`.

The schema runtime uses an analogous hook: `src/schema/schema.js` exports `setSchemaRuntimeProvider(fn)`, default null. `src/schema/loader-server.js` and `src/schema/loader-browser.js` are the two providers. CLI / tests / server side-effect-import `./schema/loader-server.js` (full migration runtime, all four modes). The browser bundle (`src/browser.js`) side-effect-imports `./schema/loader-browser.js` (validate + browser-stubs only). Same failure mode applies — call `getSchemaRuntime()` without registering a provider and you get a clear error pointing at which loader to import.

The mode matrix exposed by `getSchemaRuntime({ mode })`:

| mode | composition | typical caller |
| --- | --- | --- |
| `validate` | VALIDATE | isomorphic validate-only contexts |
| `browser` | VALIDATE + BROWSER_STUBS | the `<script type="text/rip">` runtime |
| `server` | VALIDATE + DB_NAMING + ORM | `@rip-lang/server` and friends |
| `migration` | VALIDATE + DB_NAMING + ORM + DDL | CLI / migration tool / tests (default) |

Edits to `src/schema/runtime-*.js` require running `bun run build:schema-runtime` to regenerate `runtime.generated.js`. CI fails (`bun run test:schema-fresh`) if the generated file is stale.

---

## Architecture Overview

The code emitter is `CodeEmitter` in `compiler.js`. It takes s-expression ASTs
from the parser and produces JavaScript strings. The class was previously called
`CodeGenerator`; all codegen methods now use `emit*` naming (e.g. `emitIf`,
`emitSwitch`, `emitClass`). Utility methods that analyze or transform the AST
without producing output keep descriptive verbs: `collect*`, `extract*`,
`unwrap*`, `contains*`, `has*`, `find*`, `build*`, `format*`.

Key helpers:
- `asyncIIFE(hasAwait, body)` / `asyncIIFEOpen(hasAwait)` — centralized async
  IIFE wrapping. All 6 expression-context IIFE sites route through these.
- `_tryPostfixCall(head, rest, context)` — shared postfix-if optimization for
  both simple and complex callee call paths.
- `_emitArgs(rest)` — shared argument-list emission.
- `_emitClassMembers(members, parentClass)` — shared class member emission for
  object-style class bodies (handles bound methods, `@param`, `atParamMap`).

### Cleanup Status

The compiler has been through a hardening pass. Current state:

| Area | Status | Notes |
| ---- | ------ | ----- |
| Async IIFE emission | Done | All 6 sites centralized via `asyncIIFE`/`asyncIIFEOpen` |
| `containsAwait` scope | Done | All enclosed nodes checked (disc, conditions, finally, etc.) |
| `emitClass` | Done | Deduplicated member loops, fixed 3 latent bugs |
| `emit()` dispatch | Done | Deduplicated postfix-if and args generation |
| `emitBodyWithReturns` | Reviewed, not refactored | 143 lines, 12 responsibilities — complex but working, no known bugs |
| `emitAssignment` | Reviewed, not refactored | 138 lines, 8 patterns — complex but working, no known bugs |
| `emitForIn` | Reviewed, not refactored | 107 lines — inherent complexity from loop variants |
| `emitProgram` | Reviewed, not refactored | 136 lines — sequential setup, each section unique |
| Test runner | Done | Async tests tracked via `pendingTests` + `Promise.all` |
| Test coverage | Done | 1631 tests, async IIFE + class + nested construct coverage |

---

## S-Expression Patterns

Common patterns:

```javascript
["=", "x", 42]
["+", left, right]
["def", "name", params, body]
["->", params, body]
["if", condition, then, else]
["state", name, expr]
["computed", name, expr]
["enum", name, body]
```

Complete node reference:

```javascript
// Top Level
['program', ...statements]

// Variables & Assignment
['=', target, value]    // x = expr
['+=', target, value]   // Also: -=, *=, /=, %=, **=
['&&=', target, value]  ['||=', target, value]
['?=', target, value]   ['??=', target, value]

// Functions
['def', name, params, body]
['->', params, body]            // Thin arrow
['=>', params, body]            // Fat arrow
// Params: 'name', ['rest', 'name'], ['default', 'name', expr],
//         ['expansion'], ['object', ...], ['array', ...]

// Calls & Property Access
[callee, ...args]               // Function call
['await', expr]
['.', obj, 'prop']
['?.', obj, 'prop']
['[]', arr, index]
['optindex', arr, index]        // arr?.[index]
['optcall', fn, ...args]        // fn?.(args)
['new', constructorExpr]
['super', ...args]
['tagged-template', tag, str]

// Data Structures
['array', ...elements]
['object', ...pairs]            // pairs: [key, value]
['map-literal', ...pairs]       // *{ } → new Map([[key, value], ...])
['...', expr]                   // Spread (prefix only)

// Pick operator — obj.{ } / obj?.{ }
// Heads use syntax-shape strings (not `pick`/`optpick`) so they can't
// collide with a user function of the same name: `pick(false)` as an
// ordinary call would otherwise be misrouted through the emitter table.
['.{}',  source, ...items]      // items: [srcKey, dstKey, defaultExpr|null]
['?.{}', source, ...items]      // optional-chain pick — undefined if source null

// Operators
['+', left, right]   ['-', left, right]   ['*', left, right]
['/', left, right]   ['%', left, right]   ['**', left, right]
['==', left, right]  ['!=', left, right]  // == compiles to ===
['<', left, right]   ['<=', left, right]
['>', left, right]   ['>=', left, right]
['&&', left, right]  ['||', left, right]  ['??', left, right]
['!', expr]          ['~', expr]          ['typeof', expr]
['delete', expr]     ['instanceof', expr, type]
['?', expr]          // Existence check (x?)
['presence', expr]   // Presence check (x?!) — Houdini operator
['++', expr, isPostfix]  ['--', expr, isPostfix]

// Control Flow
['if', condition, thenBlock, elseBlock?]
['unless', condition, body]
['?:', condition, thenExpr, elseExpr]
['switch', discriminant, cases, defaultCase?]

// Loops
['for-in', vars, iterable, step?, guard?, body]
['for-of', vars, object, guard?, body]
['for-as', vars, iterable, async?, guard?, body]  // for await
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
['component', null, body]
['render', body]
```

## Lexer Token Format

Tokens are `[tag, val]` arrays with extra properties:

- `.pre` — whitespace count before token
- `.data` — metadata like `{ await, predicate, quote, invert, parsedValue }`
- `.loc` — `{ r, c, n }`
- `.spaced` — sugar for `.pre > 0`
- `.newLine` — whether preceded by newline

Identifier suffixes:

- `!` sets `.data.await = true`
- `?` sets `.data.predicate = true`
- `as!` in loops emits `FORASAWAIT` for `for await`

Tagged template bridge:

- `tag $"string"` → the rewriter (`rewriteTaggedTemplates`) removes the `$`
  identifier and clears spacing, so the string attaches to the tag. The parser
  sees `Value String` → `["tagged-template", tag, str]`. Compiles to `` tag`string` ``
  in JavaScript. Works with all string forms (`$"`, `$'`, `$"""`, `$'''`).

## Context-Aware Generation

```javascript
emit(sexpr, context = 'statement')
```

- Value context: emit an expression result
- Statement context: emit statements without preserving a result

Comprehensions are the canonical example — value context becomes an IIFE with array building, statement context becomes a plain loop.

### Expression-Context Construct Audit

When a construct appears in value context and cannot be a simple JS expression, the
compiler wraps it in an IIFE. If the enclosed code contains `await`, the IIFE must
be `async` and the call must be `await`ed. All async IIFE sites use the centralized
`asyncIIFE()` / `asyncIIFEOpen()` helpers.

| Construct | Method | IIFE type | Enclosed nodes |
| --------- | --------- | --------- | -------------- |
| `if` (multi-stmt) | `emitIfAsExpression` | async IIFE | condition, thenBranch, elseBranches |
| `switch` | `emitSwitch` | async IIFE | disc, case labels, case bodies, defaultCase |
| `switch` (no disc) | `emitSwitchAsIfChain` | async IIFE | when-conditions, when-bodies, defaultCase |
| `try` | `emitTry` | async IIFE | try body, catch clause, finally block |
| comprehension | `emitComprehension` | async IIFE | expr, iterators, guards |
| object comp. | `emitObjectComprehension` | async IIFE | keyExpr, valueExpr, iterators, guards |
| `or return` etc. | `emitControl` | sync IIFE | expr, ctrl value (return/throw semantics) |
| `x = e or return` | `emitAssignment` | sync IIFE | expr, target, ctrl value |
| `throw` | `emitThrow` | sync IIFE | throw expression |
| `do ->` | `emitDoIIFE` | user fn | user's function (handles own async) |
| ternary `?:` | `emitTernary` | none | direct JS ternary |
| block (comma) | `emitBlock` | none | comma expression |
| calls + postfix if | `emit` | none | conditional rewrite |
| `->` in value | `emitThinArrow` | none | parenthesized function |

**Invariant:** every node listed in the "Enclosed nodes" column must appear in
that site's `containsAwait` check. The sync IIFE sites use `return`/`throw`
inside the IIFE, which cannot propagate to the enclosing function, so async
handling is intentionally omitted.

## Dispatch Table

All node types dispatch through `GENERATORS` for O(1) lookup. To change a feature:

1. Inspect the s-expression with `echo 'code' | ./bin/rip -s`
2. Search `GENERATORS` in `src/compiler.js`
3. Edit the matching `emit*` method
4. Run `bun run test`

For grammar work:

1. edit `src/grammar/grammar.rip`
2. run `bun run parser`
3. verify the new parse shape with `./bin/rip -s`
4. update codegen or lexer handling if the new node shape requires it

## Heredocs

Heredocs (`'''` and `"""`) use a **closing-delimiter-as-left-margin** rule. The column position of the closing delimiter defines how much leading whitespace to strip from each content line:

```coffee
# Closing delimiter at same indent as content — fully left-aligned output
contents = """
    username=#{user}
    password=#{pass}
    """
# Result: "username=...\npassword=..."

# Closing delimiter 2 columns left of content — 2 spaces retained
html = '''
    <div>
      <p>Hello</p>
    </div>
  '''
# Result: "  <div>\n    <p>Hello</p>\n  </div>"
```

Raw heredocs (`'''\` and `"""\`) keep recognized escape sequences literal (`\n`, `\t`, `\u`, `\x`, `\\`). Non-JS escapes like `\s`, `\w`, and `\d` already pass through unchanged in both modes.

## Block Unwrapping

Parser bodies are commonly wrapped in `['block', ...]`. Always unwrap before operating on statements:

```javascript
if (Array.isArray(body) && body[0] === 'block') {
  const statements = body.slice(1)
}
```

---

## Component Internals

The component system is a compiler sidecar. `installComponentSupport(CodeEmitter, Lexer)` adds methods to both prototypes.

### Render Rewriter

`rewriteRender()` runs after `normalizeLines` and before `tagPostfixConditionals`.

Inside `render` blocks it rewrites template syntax into function-call syntax:

```coffee
div
  span "hello"
```

becomes roughly:

```coffee
div(->
  span("hello"))
```

Tag class patterns:

```coffee
div.card
.card
div.card.active
.("flex-1 p-4")
.card.("flex-1 p-4")
.card.primary.("flex", x)
```

Tag and component name resolution:

- **Lowercase names** that match the template tag set are **DOM elements** (`div`, `span`, `button`)
- **PascalCase names** are **child components** — must start with uppercase, contain at least one lowercase letter, and have no underscores (`App`, `AuthScreen`, `HomeSection`)
- **ALL_CAPS names** are treated as regular variables, not components (`DEFAULT_SCREEN`, `SECTIONS`, `A`, `IO`)

Key mechanisms:

- `startsWithTag` — backward scan to decide whether a line starts a template tag
- `pendingCallEnds` — indent stack for injected `CALL_START` / `CALL_END`
- `fromThen` skip — inline postfix `if ... then ... else ...` expressions are never template nesting
- `$open: true` becomes `"data-open": true`

### Component Codegen

Key entry points:

- `buildRender` — initializes counters and create/setup line arrays
- `emitNode` — dispatch for elements, text, conditionals, loops, components
- `emitConditional` — emits conditional block factories
- `emitTemplateLoop` — emits `__reconcile(...)`
- `emitBlockFactory` — shared factory emitter used by conditionals and loops

### Factory Mode

Block factories need locals and `ctx.member` references instead of `this._elN` and `this.member`.

- `_factoryMode` — emit locals like `_el0` and `ctx.member`
- `_self` — returns `'this'` or `'ctx'`
- `_factoryVars` — variables that need local `let` declarations
- `_fragChildren` — fragment-to-children tracking for removals
- `_pushEffect(body)` — emits `__effect(...)` or `disposers.push(__effect(...))`
- `_loopVarStack` — threads loop variables through nested factories

Factory mode is entered in `emitConditionBranch` and `emitTemplateLoop` via save/restore of `[_createLines, _setupLines, _factoryMode, _factoryVars]`.

### Auto-Wired Event Handlers

Methods named `onClick`, `onKeydown`, `onMouseenter`, etc. automatically bind to the root DOM element.

- detection: methods matching `/^on[A-Z]/` that are not lifecycle hooks
- event names come from the generated `src/generated/dom-events.js` list, sourced from TypeScript's `HTMLElementEventMap`
- root only: the first generated HTML tag can claim auto-wiring
- explicit override: `@click: handler` on the root suppresses auto-wire for that event
- lifecycle exclusion: `onError` is not auto-wired
- after bumping `typescript`, refresh the generated DOM metadata with `bun run gen:dom`

### Generated DOM Tag Sets

- `src/generated/dom-tags.js` is generated from TypeScript's `HTMLElementTagNameMap` and `SVGElementTagNameMap`
- `SVG_TAGS` uses only SVG namespace-specific tag names; overlapping names like `a`, `script`, and `style` stay HTML by default unless `_svgDepth > 0`
- a tiny compatibility list remains in the generator for tags Rip already recognized but TypeScript does not currently expose the same way
- after bumping `typescript`, refresh with `bun run gen:dom`

```coffee
export Checkbox = component
  @checked := false
  onClick: -> @checked = not @checked
  onKeydown: (e) ->
    @onClick() if e.key in ['Enter', ' ']
  render
    button role: 'checkbox', aria-checked: !!@checked
      slot
```

### List Reconciliation

Loop rendering uses runtime `__reconcile` instead of inlined diff logic.

Phases:

1. creation batch via `DocumentFragment`
2. prefix scan
3. suffix scan
4. fast paths for pure insert/delete
5. LIS for minimal moves on true reorders

Compile-time optimizations:

- static blocks: `_s: true` skips patch calls when possible
- array-based `state.blocks[]`
- `state.keys = items.slice()` for default item-as-key behavior

### Nested Loop Variable Collision (known gotcha)

The emitted patch function for a reactive block is named `p` and takes
every enclosing loop variable as a positional parameter:

```javascript
// For a render with `for item in items` containing `for v, i in item.enum`
p(ctx, v, i, item, i) { ... }   // duplicate `i` — invalid in strict mode
```

The outer `for item in items` allocates an implicit `i` counter even
when the user wrote no explicit index. If the inner loop uses `i` as an
explicit index, both end up in `p`'s signature and V8 throws
`Duplicate parameter name not allowed in this context` at parse time.

Current workaround (author-facing, documented in
`packages/ui/AGENTS.md`): use a different inner index name (`idx`, `n`,
`j`).

Long-term fix: the emitter should generate unique internal names for
auto-allocated loop counters (e.g. `__i0`, `__i1`) rather than reusing
`i`, so no user-chosen name can ever collide. The fix lives in whichever
`emitFor*` path closes over the block into a patch function — search
for sites that build the `p(ctx, ...args)` signature in `compiler.js`.

### Error Boundaries

`onError` walks the `_parent` chain.

- constructor wraps `_init`
- mount wraps `_create`, `_setup`, and `mounted`
- child setup and mount calls are wrapped at codegen time
- `__handleComponentError(error, component)` finds the nearest handler or rethrows

### Transitions

Syntax:

```coffee
div ~fade
```

Pipeline:

- rewriter converts the tilde form into `__transition__`
- `emitAttributes` emits `this._t = "fade"`
- conditionals check `_t` for async leave / enter
- runtime `__transition(el, name, dir, done)` performs the CSS class dance

Built-in presets: `fade`, `slide`, `scale`, `blur`, `fly`

Custom transitions follow the `{name}-enter-from`, `{name}-enter-active`, `{name}-leave-to` convention.

### Component Testing

Component tests live in `test/rip/components.rip`.

- use `code` tests with `{ skipPreamble: true, skipRuntimes: true }` for codegen assertions
- use `test` tests for runtime behavior like state, methods, reconciliation, and error boundaries

---

## Browser Runtime (`browser.js`)

The browser bundle is an IIFE loaded with `<script defer>`, not `type="module"`, so `file://` demos still work without CORS issues.

### Loading Flow

`processRipScripts()` runs on `DOMContentLoaded` and:

1. collects `data-src` URLs from the runtime script
2. collects all `<script type="text/rip">` tags
3. fetches `.rip` sources and JSON bundles
4. expands bundles and merges bundle data into `data-state`
5. compiles each source with `{ skipRuntimes: true, skipExports: true }`
6. appends `Component.mount(target)` when `data-mount` is present
7. executes everything as one shared async IIFE

### Compiler Options

- `skipExports` — suppresses `export` in codegen; `export` makes components visible across tags as plain `const` declarations in the shared scope
- `skipRuntimes` — skips re-emitting reactive/component runtimes and uses `var` helpers for safe concatenation

### Browser Helpers

- `rip(code)` — browser REPL for Rip snippets
- `importRip(url)` — fetch, compile, and import a `.rip` file
- `compileToJS(code)` — compile Rip source to JS
- `__rip` — reactive runtime
- `__ripComponent` — component runtime

### Variable Persistence in `rip()`

`let` declarations are stripped so values can persist in sloppy-mode eval, while `const` is hoisted to `globalThis`.

### `window.__RIP__` — same surface on both compile paths (don't break this)

`processRipScripts()` has two compile paths: with `data-router` it calls `app.launch()`; without `data-router` it inlines the bundles into one async-IIFE eval. Both paths expose the **same** debug surface on `window.__RIP__`, and consumers (e.g. the docs UI gallery's view-source feature) read from it indiscriminately:

- `window.__RIP__.components.read("components/<id>.rip")` — returns the bundled `.rip` source text.

`launch()` already wires this up (see `app.rip` ~1190). The no-router path used to silently skip it, so `window.__RIP__` was undefined for any deploy that used `data-src="bundle.json"` alone — view-source UIs would silently fail. The fix mirrors `launch()`'s setup: build a `createComponents()` store from the bundles and expose it on `window.__RIP__.components` (see `browser.js` ~226–239).

**Invariant:** any future refactor of either compile path must keep `window.__RIP__.components.read(path)` working after boot. The regression test that locks this in lives in `test/bundle.test.js` (boot-simulation driver — fakes a `<script src="rip.min.js" data-src="bundle.json">` runtime tag and a synthetic bundle, awaits `globalThis.__ripScriptsReady`, asserts `read()` returns the source). If you delete or move that block in `browser.js`, that test will fail with `window.__RIP__ missing — no-router path did not wire components store`.

---

## Reactivity Implementation

The reactive runtime is embedded in `compiler.js` and only emitted when needed.

### `offer` / `accept`

Context-sensitive keywords that only activate inside component bodies. Elsewhere they remain plain identifiers.

```coffee
export Tabs = component
  offer active := 'overview'

export TabContent = component
  accept active
```

`offer` can wrap `:=`, `~=`, `=`, or `=!`. The same reactive object flows through parent and child.

Implementation details:

- tokenized as `OFFER` / `ACCEPT` only inside component bodies
- handled via `classifyKeyword` override in `components.js`
- grammar lives in `ComponentLine`
- runtime uses existing `setContext`, `getContext`, and `_parent` chain

### Component Signal Sharing

`<=>` on components is different from `<=>` on HTML elements.

The parent passes the signal via `__bind_propName__`. The child checks that prop first:

```javascript
this.checked = __state(props.__bind_checked__ ?? props.checked ?? false)
```

Because `__state()` passes through existing signals, parent and child share the same signal object. No event-based synchronization is needed.

---

## Type System

Rip types are erased from JavaScript and exist for `.d.ts` emission, IDE tooling, and documentation.

### Syntax

```coffee
def greet(name:: string):: string
  "Hello, #{name}!"

type User =
  id: number
  name: string
  email?: string

interface Animal
  name: string
  speak: => void

enum Status
  Active
  Inactive
```

### Architecture

Type emission is split across two files by execution context:

- `types.js` (browser-side, ~21 KB) — `installTypeSupport(Lexer)` adds `rewriteTypes()` to strip type annotations from the token stream so user-typed Rip parses. This is the only thing the browser needs from type machinery.
- `types-emit.js` (CLI/LSP only, ~38 KB) — `emitTypes(tokens, sexpr, source)` generates `.d.ts`, plus `expandSuffixes`, `emitComponentTypes`, and the intrinsic declaration tables (`INTRINSIC_TYPE_DECLS`, `SIGNAL_*`, `COMPUTED_*`, `EFFECT_*`, etc.). Registers itself with the compiler at module load via `setTypesEmitter()`.

`emitEnum` (runtime JS for `enum` blocks) lives in `compiler.js` next to the rest of the codegen dispatch — it's not type machinery, it's real runtime emission.

`typecheck.js` (CLI only) drives `rip check`, mediates TypeScript diagnostics, and side-effect-imports `types-emit.js` for the intrinsic decl tables.

Types are processed at the token layer before parsing.

### Shadow TypeScript

`rip --shadow file.rip` dumps the virtual TypeScript file that `rip check` and the VS Code extension feed into the TypeScript language service.

---

## Schema System

Inline schemas are a compiler sidecar that parallels `types.js` and
`components.js` — a feature of the rip-lang compiler, just organized
into its own subdirectory `src/schema/` because of its size. Schema
mutates the host parser's lexer to re-parse `@ensure` predicate
bodies, so it isn't a clean separable package; the subdirectory is
purely for source organization. The implementation is split across
several files by execution context:

- `src/schema/schema.js` (browser + server) — lexer rewrite,
  body parsers, `emitSchema` codegen, and `setSchemaRuntimeProvider`
  hook. The runtime body itself is **not** here; this file imports zero
  fragments so the bundler can decide per-entry which fragments to include.
- `src/schema/runtime-{validate,db-naming,orm,ddl,browser-stubs}.js`
  (sources) and `src/schema/runtime.generated.js` (autogen) —
  five runtime fragments composed at call time by `getSchemaRuntime({ mode })`.
  Edit a source fragment, run `bun run build:schema-runtime` to refresh
  the generated file, commit. CI's `test:schema-fresh` fails on staleness.
- `src/schema/loader-server.js` and `src/schema/loader-browser.js`
  — the import boundary that decides which fragments end up in which
  bundle. Server loader pulls all five; browser loader pulls only
  validate + browser-stubs. Bun's tree-shaker uses these import sets to
  omit server-only fragments from `docs/dist/rip.min.js`.
- `src/schema/dts-emit.js` (CLI/LSP only) — `emitSchemaTypes` walks
  parsed schema s-expressions and emits `declare const Foo: Schema<...>`
  lines for the TypeScript language service. Imported only by
  `types-emit.js` and `typecheck.js`. The `dts-emit` name signals
  that this is a compile-time `.d.ts` emitter, not a `runtime-*` fragment.

### Lexer path

- `installSchemaSupport(Lexer, CodeEmitter)` adds `rewriteSchema()` to the
  Lexer prototype. It runs between `rewriteRender()` and `rewriteTypes()` in
  the rewriter pipeline.
- `rewriteSchema()` detects a contextual `schema` identifier at expression-
  start positions followed by either a `:kind` SYMBOL or a direct INDENT.
  The matching INDENT...OUTDENT range is parsed by a schema-specific
  sub-parser and collapsed into a single `SCHEMA_BODY` token whose `.data`
  carries a structured descriptor (kind, entries, per-entry `.loc`).
- The main grammar has one tiny production, `Schema: SCHEMA SCHEMA_BODY`,
  under `Expression`. Schema body syntax — field declarations (with
  optional type, `min..max` range, `[default]`, `/regex/`, `{attrs}`,
  terminal `-> transform` with whole-raw-input `it`), directives
  (`@name`), methods (`name: -> body`), computed getters
  (`name: ~> body`), eager-derived fields (`name: !> body`), and
  `@ensure "msg", (x) -> predicate` refinements — never reaches the
  main parser, so the state table stays lean.
- Bodies of methods, computed getters, and hooks are captured as token
  slices. At codegen time those slices run through the tail rewriter
  passes (implicit braces, tagged templates, etc.) and feed into
  `parser.parse()` via a temporary lex adapter. The parsed body is wrapped
  as a thin-arrow `['->', [], body]` AST and emitted through the existing
  codegen path — Rip `->` is already a `function()` (not a JS arrow), so
  `this` binds to the instance.

### Layered runtime

The descriptor passed to `__schema({...})` is Layer 1. Layer 2 normalization
(fields, methods, computed, hooks, relations, expanded mixins, collision
checks) runs once per schema on first downstream use. Layer 3 (validator
plan) builds on the first `.parse/.safe/.ok`; Layer 4a (ORM) on the first
`.find/.create/.save`; Layer 4b (DDL) on the first `.toSQL()`. The four
caches are independent — a DDL-emitting script that only calls `.toSQL()`
never builds the ORM plan.

### Registry

`__SchemaRegistry` (process-global) holds every named `:model` and `:mixin`.
Relations look up `:model` targets by name; `@mixin Name` looks up `:mixin`
targets. Registration happens in the `__SchemaDef` constructor so just
importing a file that defines named schemas activates them. Tests can call
`__SchemaRegistry.reset()` between runs.

### Algebra invariant

`.pick/.omit/.partial/.required/.extend` always return `kind: 'shape'`.
**Field semantics survive** — type (including literal unions), modifiers,
constraints, and **inline transforms** — because they describe how a
field's value is obtained from raw input, not what the instance does.
**Instance behavior drops** — methods, computed getters (`~>`),
eager-derived fields (`!>`), hooks, ORM methods, and `@ensure`
refinements. Calling `.find()` or `.toSQL()` on a derived shape throws
a dedicated error pointing the user at query projection on the source
model. Refinements drop because they're schema-level invariants that
reference field names by identifier — the algebra operation has no
static way to know which names survive the derivation, so the safe
rule is "never carry them through." Runtime tests and the shadow TS
signatures both enforce this.

### Parser invariants (don't break these)

- **Field-line classification**: `IDENTIFIER` start → field; `PROPERTY`
  start (trailing `:` absorbed into the identifier's tag) → callable.
  Don't merge the two paths.
- **Type slot is optional** and defaults to `string` — the parser only
  consumes a type when `typeFirst[0] === 'IDENTIFIER'` or `'STRING'`
  (the literal-union case). Anything else triggers the default.
- **Transform is terminal**: once `->` appears as a field-line part,
  no further comma-separated parts are allowed. Reject with a diagnostic
  that says "move everything else before the arrow".
- **Comma before `->` is required** whenever anything precedes it
  (type, range, regex, default, attrs). Only the bare form `name! -> fn`
  parses comma-less. There are two enforcement points: after type
  consumption (if `rest[0]` is `->`), and inside the parts loop (via
  `findTopLevelArrowIdx` scanning depth-zero arrows within a part).
- **Transforms run on `.parse()` only, never `_hydrate`.** Hydrate
  bypasses the whole parse pipeline (`_applyTransforms` → defaults →
  validation → assign) and goes directly from column row to instance.
- **Eager-derived (`!>`) runs on both parse AND hydrate** — in
  declaration order, on the partially-constructed instance. It is
  NOT re-run on field mutation (materialized once, stored as own
  enumerable property).
- **`@ensure` is a special directive** — parsed into its own
  `tag: 'ensure'` entry (distinct from generic `tag: 'directive'`)
  because it carries a compiled fn + message, not just args. Both
  inline (`@ensure "msg", (x) -> body`) and array
  (`@ensure [ "msg", fn, "msg", fn ]`) forms compile to one entry
  per refinement; downstream runtime can't tell them apart. The
  array-form splitter treats both `,` and TERMINATOR as element
  separators at depth 0 to match Rip's array-literal convention.
- **@ensure runs AFTER field validation and BEFORE eager-derived.**
  `.parse/.safe/.ok` short-circuit `@ensure` when per-field errors
  fire (predicates assume field types are correct). `_hydrate` skips
  `@ensure` entirely (trusted data). Runtime method name
  `_applyEnsures` mirrors the directive (parallel to
  `_applyTransforms` for `-> transform` and `_applyEagerDerived` for
  `!> derived`). See `src/schema/schema.js`.

### Shadow TS

`emitSchemaTypes(sexpr, lines)` walks the parsed s-expression for named
schema declarations, emits mixins first so intersections resolve, then
emits type aliases and `declare const` per kind:

- `:input` → `Schema<ValueType, ValueType>`
- `:shape` → `Schema<ShapeInstance, ShapeData>` (or `Schema<Data, Data>` when
  fields-only)
- `:model` → `ModelSchema<Instance, Data>` with ORM methods and relation
  accessors (same-file targets typed, cross-file degrades to `unknown`)
- `:mixin` → field-only `type Foo = { ... }` alias, no runtime value
- `:enum` → discriminated-union alias + const with `ok(data): data is
  Role` type predicate

`hasSchemas(source)` is the cheap probe that gates intrinsic preamble
injection and file-level type checking (parallels `hasTypeAnnotations`).

Typical debugging sequence:

```bash
rip --shadow file.rip
rip -d file.rip
rip -cd file.rip
rip -c file.rip
rip -s file.rip
```
