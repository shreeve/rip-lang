# Compiler Subsystem — Agent Guide

This covers `compiler.js`, `lexer.js`, `components.js`, `browser.js`, `types.js`, `typecheck.js`, and the `grammar/` directory.

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

Type emission logic lives in `types.js`. Type-checking integration and diagnostic filtering live in `typecheck.js`.

- `installTypeSupport(Lexer)` adds `rewriteTypes()`
- `emitTypes(tokens)` emits `.d.ts`
- `emitEnum()` emits runtime JS for enums
- `typecheck.js` drives `rip check` and mediates TypeScript diagnostics

Types are processed at the token layer before parsing.

### Shadow TypeScript

`rip --shadow file.rip` dumps the virtual TypeScript file that `rip check` and the VS Code extension feed into the TypeScript language service.

Typical debugging sequence:

```bash
rip --shadow file.rip
rip -d file.rip
rip -cd file.rip
rip -c file.rip
rip -s file.rip
```
