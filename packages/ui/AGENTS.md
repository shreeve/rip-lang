# Unified UI Package Guide

`@rip-lang/ui` is the umbrella package for browser widgets, email components, shared helpers, and Tailwind integration.

## Domain boundaries

- `browser/` owns interactive headless widgets and browser-only DOM behavior
- `email/` owns curated email rendering, serializers, and email-client compatibility
- `shared/` owns only truly cross-domain utilities
- `tailwind/` is the only place where `tailwindcss` and `css-tree` may be imported

## Typing

All exported browser and email components should use explicit Rip types on their public props. Use the existing virtual TypeScript pipeline (`rip check`, LSP, generated virtual TS) during development; do not emit scattered `.d.ts` files during active work.

## Gallery

The root `index.html` / `index.css` / `index.rip` form a showcase layer only. Components stay headless and unstyled. The gallery itself is intentionally polished.

## First Read For Agents

When working in `packages/ui`, do not rely only on automatic context pickup from nested `AGENTS.md` files. For strong results, proactively read these files at the start of the task:

1. `packages/ui/AGENTS.md` — package boundaries, architecture, reuse policy
2. `packages/ui/browser/AGENTS.md` — widget conventions, gotchas, popup/focus patterns
3. `packages/ui/DEBUG.md` — current local-debug workflow, live gallery URL, known-good browser signals

Then, if the task involves a hard popup/input widget, inspect the current reference component before making changes:

- `packages/ui/browser/components/multi-select.rip`

Use `multi-select.rip` as the reference example for:

- layered popup mechanics vs widget-local semantics
- nested interactive affordance isolation
- reopen suppression after pointer-driven closes
- composite input styling with an embedded input inside a larger shell

This startup sequence gets an agent much closer to “current project reality” than `AGENTS.md` inheritance alone.

## Browser Widget Direction

For complex browser widgets, prefer a layered design:

- keep generic popup, focus, keyboard, and timing logic in the shared `ARIA` helper layer in `src/app.rip`
- keep component-specific semantics local to the widget (`chips`, token removal, selection rules, etc.)
- do not solve browser event-ordering bugs independently in every component if the underlying problem is generic

The current model is:

- `ARIA` / `__aria` owns shared primitives such as popup dismissal, popover binding, dialog binding, positioning, roving/list navigation, and short reopen-suppression after pointer-driven closes
- individual components own only the semantics that make that widget unique

## Reference Component

`browser/components/multi-select.rip` is the reference example for a "hard" composite widget in this package.

Use it as the model for components that combine:

- popup lifecycle
- embedded inputs
- nested interactive affordances
- keyboard navigation
- multiple coordinated state transitions

What it should demonstrate:

- clear separation between shared popup mechanics and local widget semantics
- consistent naming (`on...` for auto-wired root handlers, `_on...` for child handlers, `_...` for private helpers/refs/state)
- explicit isolation of nested controls when `mousedown` / focus ordering would otherwise leak into parent behavior
- behavior that matches high-quality headless UI expectations before adding styling

## Reuse Policy

When building or refactoring browser widgets:

- extract the smallest stable shared primitive into `src/app.rip`
- do not create a giant generic base component prematurely
- reuse `ARIA.popupGuard()` for pointer-driven close/reopen timing problems in popup-style controls
- keep styling fixes in the gallery CSS unless the component itself is shipping opinionated visuals

Good candidates for shared primitives:

- reopen suppression after outside-click dismissal
- popup dismissal wiring
- keyboard navigation helpers
- focus restoration / modal stack handling

Bad candidates for premature abstraction:

- token rendering rules
- chip-specific behaviors
- widget-specific content semantics

## Component render gotchas

Two sharp edges that an AI assistant will hit the first time it writes a
non-trivial render template. Both produce error messages that do not
mention the actual cause.

### Don't shadow HTML tag names inside render scopes

Lowercase identifiers in render templates are DOM elements emitted by
the Pug-like DSL. If you declare a local variable (or `for` loop
variable) with the same name as a tag, the codegen mis-routes the
reference and you get confusing runtime errors such as
`ReferenceError: code is not defined` inside an unrelated component.

```coffee
# WRONG — `code` is an HTML element name (<code>)
for ex in ep.examples
  code = if ex.curl? then buildCurl(ep, ex.curl) else ex.code
  CodeBlock label: ex.label, code: code

# CORRECT — rename the local
for ex in ep.examples
  src = if ex.curl? then buildCurl(ep, ex.curl) else ex.code
  CodeBlock label: ex.label, code: src

# BETTER — push the conditional into a helper, no local at all
exampleCode = (ep, ex) ->
  if ex.curl? then buildCurl(ep, ex.curl) else ex.code

CodeBlock label: ex.label, code: exampleCode(ep, ex)
```

Names to avoid as render-scope locals: `p`, `code`, `a`, `span`, `div`,
`li`, `time`, `table`, `nav`, `form`, `pre`, `h1`–`h6`, `br`, `button`,
`input`, `label`, `main`, `section`, `aside`, `img`, `ul`, `ol`, `th`,
`td`, `tr`, `style`, `script`.

### Don't use `i` as an explicit loop index inside nested render loops

Rip collects every enclosing loop variable — outer and inner — into the
reactive patch function's parameter list. An outer `for item in items`
silently allocates an `i` counter there, so an inner loop using `i` as
an explicit index produces a strict-mode "Duplicate parameter name"
compile error at runtime.

```coffee
# WRONG — outer emits implicit `i`, inner also uses `i` → dup param
for item in items
  for v, i in item.enum
    code = v

# CORRECT — rename the inner index
for item in items
  for v, idx in item.enum
    code = v
```

Use `idx`, `n`, or `j` for nested-loop indexes.

### Debugging "Duplicate parameter name" and friends quickly

These errors surface at module load with no line number pointing at
your source. Fastest reproduction path:

```bash
# extract the inline <script type="text/rip"> block and compile it
awk '/<script type="text\/rip">/,/<\/script>/' file.html |
  sed '1d; $d' > /tmp/inline.rip
rip -c -q /tmp/inline.rip > /tmp/inline.js

# feed the compiled JS to Node's Function parser — it points right at
# the bad function signature (e.g. `p(ctx, v, i, item, i) { ... }`)
node -e 'try { new Function(require("fs").readFileSync("/tmp/inline.js","utf8")) }
         catch(e) { console.log(e.message) }'
```

The emitted patch function is named `p` and takes every closure
variable as a positional parameter — duplicates there are always the
clue you're looking for.
