# Contributing to Rip UI

Internal guide for contributors working on the widget codebase. For usage
documentation, see [README.md](README.md).

---

## E2E Overlay QA

Run the browser smoke suite for modern overlay primitives:

```bash
# from repo root
bun run test:ui:chromium

# full browser matrix
bun run test:ui
```

If Playwright browsers are not installed yet:

```bash
bunx playwright install chromium firefox webkit
```

See [TESTING.md](TESTING.md) for the quality bar and covered scenarios.

---

## Widget Authoring Guide

Rules learned building these widgets. Follow them.

### Lifecycle Hooks

The recognized hooks are: `beforeMount`, `mounted`, `updated`, `beforeUnmount`,
`unmounted`, `onError`. That's it. `onMount` is **not** a hook — it compiles as
a regular method and never gets called. We hit this bug in both Tabs and Toast.

### `->` vs `=>` Inside Components

The compiler auto-converts all `->` to `=>` inside component contexts. Use `->` everywhere — it's cleaner and the compiler handles `this` binding.

**Caveat:** If you need `this` to refer to a DOM element (e.g., patching
`HTMLElement.prototype.focus`), put the code OUTSIDE the component body at
module scope where `->` stays as `->`. Inside a component, `->` becomes `=>`
and `this` binds to the component, causing "Illegal invocation" on DOM methods.

### `:=` vs `=` for Internal Storage

Use `:=` (reactive state) only for values that trigger DOM updates. For internal
bookkeeping — pools, caches, timer IDs, saved references — use `=` (plain
assignment). Reactive state creates a signal, tracks dependents, and triggers
effects on mutation. The Dialog had `_prevFocus := null` and `_cleanupTrap := null`
as reactive state when they should have been plain variables.

### The `_ready` Flag Pattern

Effects run during `_init` (before `_create`), so `ref:` DOM elements don't exist
yet. Add `_ready := false`, set `_ready = true` in `mounted`, and guard effects
with `return unless _ready`. The reactive `_ready` flag triggers the effect to
re-run after mount when DOM refs are available. Used by Tabs, Accordion, and Grid.

### Don't Shadow Prop Names

The #1 most dangerous trap. Inside component methods, the compiler rewrites ANY
identifier matching a prop/state name to `this.name.value`. A local variable
named `items` will be treated as `this.items.value` if `@items` is a prop —
meaning `items = getItems()` silently **overwrites your reactive state**.

The symptom is usually far from the cause (e.g., a list vanishing on keyboard
navigation because a helper method corrupted the data source). Always use
distinct names for locals: `opts` not `items`, `tick` not `step`, `fn` not
`filter`. When debugging mysterious state corruption, check compiled JS output
(`rip -c file.rip`) and search for unexpected `this.propName.value =` assignments.

### Type Your Props

Adding `::` type annotations to props enables IDE IntelliSense — completions,
hover info, and diagnostics — for every component that uses yours:

```coffee
@variant:: 'primary' | 'outline' | 'subtle' := 'primary'
@disabled:: boolean := false
@label:: string := ''
```

Without `::`, the prop is untyped (`any`) and the IDE cannot validate values
or offer completions. `rip check` treats untyped props as errors.

### `$` Sigil and `data-*` Attributes

In render blocks, use the `$` sigil (`$open`, `$selected`) which compiles to
`data-*` attributes in the HTML output. Consumers style with Tailwind's
`data-[open]:` and `data-[selected]:` variants, or CSS `[data-open]`,
`[data-selected]` selectors. The widget never applies visual styles — it only
sets semantic state attributes. This keeps the headless contract clean.

### `x.y` in Render Blocks Is Tag Syntax

Inside render blocks, `item.textContent` on its own line is parsed as tag `item`
with CSS class `textContent` — not a property access. Use the `=` prefix to
output expressions as text: `= item.textContent`.

### Widget Conventions

- `ref: "_name"` for DOM references — never `div._name` (dot syntax sets CSS class)
- `_trigger` for trigger elements, `_list` for dropdown lists, `_content` for content areas
- `_slot` with `style: "display:none"` for hidden slot reading (Select, Menu)
- `=!` for constant values (IDs), `:=` only for reactive state that drives DOM
- Auto-wired events: methods named `onClick`, `onKeydown`, etc. bind to root automatically
- `@emit 'eventName', detail` dispatches a CustomEvent on the component's root element
- Shared-scope naming: prefix module-scope variables with widget name (`acCollator` not `collator`)

### Imperative DOM for Performance

For 60fps paths (Grid scroll, ScrollArea thumb), bypass reactive rendering and do
imperative DOM inside `~>` effects. Read DOM, compute, write DOM in one pass.

Rule: if the data source is a DOM property (`scrollTop`, `clientHeight`,
`getBoundingClientRect`), go imperative. If it's reactive state (`:=`, `~=`),
use the reactive system. The Grid, ScrollArea, and any future drag/resize widget
should follow this pattern.

### Side Effects in Effect Branches

When a prop like `@open` is controlled via `<=>`, the consumer can set it
directly (`showDrawer = false`) without calling `close()`. If scroll lock, focus
restore, or cleanup only lives in `close()`, it won't run. Use
`~> if @open ... else ...` so the effect handles all state transitions regardless
of how the signal changed. Methods like `close()` should just set state and emit
events — the effect does the work.

### Explicit Index Names in Nested Loops

When a `for` loop in a render block has no explicit index, the compiler
auto-generates `i`. Nested loops both get `i`, producing duplicate parameters.
Fix: always name both indices explicitly (`for outer, oIdx in list` /
`for inner, iIdx in sublist`). Single loops are fine without an explicit index.

### Don't Use `value: @prop` on `<input>`

Rip's smart auto-binding writes the input's string value back to the signal,
corrupting numeric state. Use a `_ready`-guarded `~>` effect to push values to
the input, and `@blur`/`@input` handlers to parse back.

---

## Behavioral Primitives

The widgets are built from shared behavioral patterns:

**Focus Trap** — confines tab focus within a container (dialogs, modals):

```coffee
trapFocus = (el) ->
  focusable = el.querySelectorAll 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
  first = focusable[0]
  last = focusable[focusable.length - 1]
  first?.focus()
  handler = (e) ->
    return unless e.key is 'Tab'
    if e.shiftKey
      if document.activeElement is first then e.preventDefault(); last?.focus()
    else
      if document.activeElement is last then e.preventDefault(); first?.focus()
  el.addEventListener 'keydown', handler
  -> el.removeEventListener 'keydown', handler
```

**Scroll Lock** — prevents body scroll while a modal is open:

```coffee
lockScroll = ->
  scrollY = window.scrollY
  document.body.style.position = 'fixed'
  document.body.style.top = "-#{scrollY}px"
  document.body.style.width = '100%'
  ->
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.width = ''
    window.scrollTo 0, scrollY
```

**Dismiss** — close on Escape key or click outside:

```coffee
onDismiss = (el, close) ->
  onKey = (e) -> close() if e.key is 'Escape'
  onClick = (e) -> close() unless el.contains(e.target)
  document.addEventListener 'keydown', onKey
  document.addEventListener 'pointerdown', onClick
  ->
    document.removeEventListener 'keydown', onKey
    document.removeEventListener 'pointerdown', onClick
```

**Keyboard Navigation** — arrow key movement through a list:

```coffee
navigateList = (el, opts = {}) ->
  vertical = opts.vertical ? true
  wrap = opts.wrap ? true
  items = -> el.querySelectorAll('[role="option"]:not([aria-disabled="true"])')
  handler = (e) ->
    list = Array.from items()
    idx = list.indexOf document.activeElement
    return if idx is -1
    next = switch e.key
      when (if vertical then 'ArrowDown' else 'ArrowRight')
        if wrap then (idx + 1) %% list.length else Math.min(idx + 1, list.length - 1)
      when (if vertical then 'ArrowUp' else 'ArrowLeft')
        if wrap then (idx - 1) %% list.length else Math.max(idx - 1, 0)
      when 'Home' then 0
      when 'End' then list.length - 1
      else null
    if next? then e.preventDefault(); list[next].focus()
  el.addEventListener 'keydown', handler
  -> el.removeEventListener 'keydown', handler
```

**Anchor Positioning** — position a floating element relative to a trigger:

```coffee
anchorPosition = (anchor, floating, opts = {}) ->
  placement = opts.placement or 'bottom'
  offset = opts.offset or 4
  update = ->
    ar = anchor.getBoundingClientRect()
    fr = floating.getBoundingClientRect()
    [side, align] = placement.split('-')
    x = switch side
      when 'bottom', 'top'
        switch align
          when 'start' then ar.left
          when 'end' then ar.right - fr.width
          else ar.left + (ar.width - fr.width) / 2
      when 'right' then ar.right + offset
      when 'left' then ar.left - fr.width - offset
    y = switch side
      when 'bottom' then ar.bottom + offset
      when 'top' then ar.top - fr.height - offset
      when 'left', 'right'
        switch align
          when 'start' then ar.top
          when 'end' then ar.bottom - fr.height
          else ar.top + (ar.height - fr.height) / 2
    # Flip if off screen, shift to stay in viewport
    x = Math.max(4, Math.min(x, window.innerWidth - fr.width - 4))
    floating.style.left = "#{x}px"
    floating.style.top = "#{y}px"
  update()
```

**Reference Material:**
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/)
- [Base UI source (MIT)](https://github.com/mui/base-ui)
- [MDN ARIA documentation](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)

---

## Per-Widget Implementation Notes

### Select
- Typeahead buffer clears after 500ms (matches native `<select>` behavior)
- Hidden slot pattern for declarative option reading
- Positioning: manual `getBoundingClientRect` with basic flip (up when overflowing)

### Combobox
- Consumer controls filtering via `@filter` callback (no internal filtering, no debounce)
- Highlighted index resets to -1 on each input change

### Dialog
- Focus trap set up in `setTimeout` (after dialog renders)
- Internal storage (`_prevFocus`, `_cleanupTrap`) uses plain `=` not `:=`
- Enter/exit animations handled via CSS on `[data-open]`

### Toast
- Each Toast is independent (no stacking/queue system)
- 200ms leave animation duration is hardcoded

### Popover
- Uses `[data-trigger]` and `[data-content]` children for structure

### Tooltip
- Show delay 300ms, instant hide + 150ms animation

### Tabs
- Content discovered by querying `[data-tab]`/`[data-panel]` inside component
- Deeply nested tabs must be direct-ish children

### Grid
- Hybrid: reactive rendering for structure, imperative DOM for scroll hot path
- DOM recycling pool (`_trPool`) never shrinks — avoids create/destroy cycles on resize
- Clipboard: TSV format per RFC 4180
- `requestAnimationFrame` throttle coalesces scroll events
- `contain: strict` and `will-change: transform` recommended as user styles

### Accordion
- ARIA attributes: `aria-expanded`, `aria-controls`, `role="region"`
- `openItems` Set replaced with new Set on each toggle to trigger reactivity

### Menu
- Hidden-slot pattern (same as Select) for item discovery
- Disabled items skipped on click but not keyboard navigation

---

## Known Structural Issues

**Grid — hardcoded selection color.** `#3b82f6` in the selection overlay should
be `var(--grid-selection-color, #3b82f6)`.

---

## Cross-Widget Notes

### Positioning
Select, Combobox, Menu, and Popover each do their own `getBoundingClientRect`
math. If this becomes a maintenance issue, extract a shared function. For now,
inlined code is simple enough that duplication is preferable to indirection.

### Slot Discovery
Tabs, Accordion, Select, and Combobox discover children by querying `data-*`
attributes.

### CSS Hot Reload
Save a `.css` file and the browser picks up changes without losing component
state (SSE `data: styles` event refreshes stylesheets only). `.rip` changes
trigger a full page reload.

### Testing
No widget has tests yet. Priority:
1. Dialog — focus trap correctness
2. Select — keyboard + typeahead
3. Grid — virtual scroll, DOM recycling, clipboard TSV round-trip

---

## Roadmap

1. **Write Grid tests** — viewport engine, DOM recycling, clipboard, sort
2. **Write Dialog tests** — focus trap, scroll lock, escape, click-outside, focus restore
3. **Write Select tests** — keyboard nav, typeahead, Home/End, ARIA correctness
4. **Grid: frozen columns** — `position: sticky` with cumulative left offset
5. **Grid: selection color** — `var(--grid-selection-color, #3b82f6)`
6. **Standalone Grid demo** — 100K rows, prove 60fps
7. **Grid: CellRange model** — unlocks multi-range selection (Ctrl+click)
8. **Grid: undo/redo** — ~40 lines on top of existing `commitEditor`
9. **Publish** — document integration, link from main README

---

## Dev Server

The widget gallery uses `data-src` mode for testing. The dev server is minimal:

```coffee
import { get, use, start, notFound } from '@rip-lang/server'
import { serve } from '@rip-lang/server/middleware'

dir = import.meta.dir
use serve dir: dir, bundle: ['.'], watch: true
get '/*.rip', -> @send "#{dir}/#{@req.path.slice(1)}", 'text/plain; charset=UTF-8'
notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'
start port: 3005
```

`rip server` from `packages/ui/` gives auto-HTTPS + mDNS. Do NOT implement
custom file watchers or SSE endpoints — the process manager handles that.
Use `notFound` (not `get '/*'`) for the catch-all route.
