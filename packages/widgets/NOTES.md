# Widget Development Notes

Internal notes for contributors working on the widget codebase. For usage
documentation, see README.md.

---

## Architecture

### Philosophy

Good styling follows the same rules as good code: say what you mean, don't
repeat yourself, and don't import machinery you don't need. CSS is a real
language. Modern CSS — with nesting, custom properties, cascade layers, and
container queries — is expressive enough to build any interface without
preprocessors, runtimes, or utility class vocabularies.

For interactive behavior — keyboard navigation, focus management, ARIA,
dismissal, positioning — we build our own headless components in Rip. The
patterns come from the WAI-ARIA Authoring Practices spec and Base UI's
reference implementations. The code is pure Rip, using the language's own
reactive primitives. Zero framework dependencies.

### The Stack

| Layer | Tool | Role |
|-------|------|------|
| **Behavior** | Rip Widgets | Accessible headless components — keyboard nav, ARIA, focus management |
| **Design Tokens** | Open Props | Consistent scales for spacing, color, shadow, radius, easing, typography |
| **Scoping** | CSS (scoped) | Component-scoped styles via CSS Modules or Rip UI's built-in scoping |
| **Platform** | Native CSS | Nesting, `@layer`, `data-*` selectors, `prefers-color-scheme` |

### Why We Build Our Own

Base UI is the industry's best headless component library. But it requires
React — hooks, context, synthetic events, a virtual DOM reconciler. Shipping
React as a dependency contradicts Rip's zero-dependency philosophy, and
React's rendering model is fundamentally different from Rip UI's fine-grained
DOM updates.

Instead, we reimplement Base UI's proven behavioral patterns directly in Rip.
This is the same approach Rip took with CoffeeScript's syntax (reimplemented
better) and React's reactivity model (reimplemented as language-level
operators). The patterns are documented. The code is ours.

### Why Our Pattern Differs from Radix / Base UI

Radix and Base UI use a **compositional** pattern — `Tabs.Root`, `Tabs.List`,
`Tabs.Trigger`, `Tabs.Content` — as separate sub-components wired through
React Context. This is not a design choice. It's a constraint of React.
React components cannot inspect or control their children's rendering. The
only way for a parent to share state with descendants is through a Context
Provider wrapper, which forces every compound component into multiple
sub-components.

Rip has capabilities React lacks:

| Capability | React | Rip |
|-----------|-------|-----|
| Child projection | No equivalent | `slot` |
| DOM ownership | Virtual DOM abstraction | Direct DOM access + `ref:` |
| State sharing | Context Provider wrappers | `offer` / `accept` keywords |
| Two-way binding | `value` + `onChange` pair | `<=>` operator |
| Reactivity | `useState` + `useEffect` + dependency arrays | `:=` / `~=` / `~>` |

These capabilities let Rip choose the **right pattern for the right situation**:

- **Single-component** for data-driven widgets where children are pure metadata
  (Select, Combobox, Menu, Toast, Checkbox). The widget reads child data from
  a hidden slot and renders its own optimized DOM. Less boilerplate for users,
  full control over the render tree.

- **Compositional** (via `offer`/`accept`) when children contain complex
  renderable content the parent shouldn't own — form field groups, layout
  containers, or any compound component where descendants need shared state.

We follow Radix and Base UI's *principles* (headless, accessible, data-attribute
styling, WAI-ARIA compliance) while transcending their *constraints*. That's the
advantage of a purpose-built language.

### How Rip's Primitives Map to Component Behavior

| Need | React (Base UI) | Rip |
|------|----------------|-----|
| Mutable state | `useState` | `:=` (reactive state) |
| Derived values | `useMemo` | `~=` (computed) |
| Side effects + cleanup | `useEffect` | `~>` (effect with cleanup) |
| DOM references | `useRef` | Direct DOM access via `ref:` |
| Shared state (compound) | React Context + Provider | `offer` / `accept` |
| Batched updates | `unstable_batchedUpdates` | `__batch` |
| Two-way binding | `value` + `onChange` (8 lines) | `<=>` (1 operator) |
| Events | Synthetic event system | Native DOM events |

Rip's model is simpler. Fine-grained reactivity means no virtual DOM diffing,
no hook ordering rules, no dependency arrays. An effect that returns a function
automatically cleans up. State changes propagate to exactly the DOM nodes that
depend on them.

### Context Sharing: `offer` / `accept`

Rip provides language-level keywords for sharing reactive state between
ancestor and descendant components. These compile to the existing
`setContext`/`getContext` runtime with zero overhead.

**`offer`** — creates a reactive value and shares it with all descendants:

```coffee
export Parent = component
  offer active := 'overview'     # descendants can accept this signal
  offer count := 0               # multiple values can be offered
  offer doubled ~= count * 2     # computed values can be offered too
  render
    div
      slot
```

**`accept`** — receives a signal from the nearest ancestor that offers it:

```coffee
export Child = component
  accept active                  # shared signal — same object, not a copy
  render
    div hidden: active isnt @value
      slot
```

The signal passes through directly. Parent and child share the same reactive
object — mutations in either direction are instantly visible to both. No
Provider wrappers, no string keys, no import ceremony.

Comparison across frameworks:

```coffee
# React — 8 lines, two APIs, manual wiring
const ActiveCtx = createContext(null)
function Parent() {
  const [active, setActive] = useState('overview')
  return <ActiveCtx.Provider value={{ active, setActive }}>...
}
function Child() {
  const { active } = useContext(ActiveCtx)
}

# Svelte — 4 lines, string keys, function calls
setContext('active', writable('overview'))    // parent
const active = getContext('active')           // child

# Rip — 2 lines
offer active := 'overview'                   // parent
accept active                                // child
```

---

## Behavioral Primitives

The components are built from a small set of shared behavioral primitives:

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
      if document.activeElement is first
        e.preventDefault()
        last?.focus()
    else
      if document.activeElement is last
        e.preventDefault()
        first?.focus()
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

**Keyboard Navigation** — arrow key movement through a list of items:

```coffee
navigateList = (el, opts = {}) ->
  vertical = opts.vertical ? true
  wrap = opts.wrap ? true
  items = -> el.querySelectorAll('[role="option"]:not([aria-disabled="true"]), [role="menuitem"]:not([aria-disabled="true"])')

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

    if next?
      e.preventDefault()
      list[next].focus()

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

    # Flip if off screen
    if side is 'bottom' and y + fr.height > window.innerHeight
      y = ar.top - fr.height - offset
    if side is 'top' and y < 0
      y = ar.bottom + offset

    # Shift to stay in viewport
    x = Math.max(4, Math.min(x, window.innerWidth - fr.width - 4))

    floating.style.left = "#{x}px"
    floating.style.top = "#{y}px"

  update()
  -> null
```

---

## Component Examples

### Dialog

A complete headless dialog showing how the primitives compose:

```coffee
export Dialog = component
  @open := false

  _wireAria: ->
    panel = @_panel
    return unless panel
    heading = panel.querySelector('h1,h2,h3,h4,h5,h6')
    if heading
      heading.id ?= "#{_id}-title"
      panel.setAttribute 'aria-labelledby', heading.id
    desc = panel.querySelector('p')
    if desc
      desc.id ?= "#{_id}-desc"
      panel.setAttribute 'aria-describedby', desc.id

  ~>
    if @open
      prevFocus = document.activeElement
      # Lock scroll, trap focus, wire ARIA
      ...
      ->
        # Cleanup: unlock scroll, restore focus
        ...

  close: -> @open = false; @emit 'close'

  onKeydown: (e) ->
    @close() if e.key is 'Escape'

  onBackdropClick: (e) ->
    @close() if e.target is e.currentTarget

  render
    if @open
      div ref: "_backdrop", data-open: true,
        @click: @onBackdropClick, @keydown: @onKeydown
        div ref: "_panel", role: "dialog", aria-modal: "true", tabindex: "-1"
          slot
```

Focus trap, scroll lock, ARIA wiring, escape dismiss, click-outside dismiss —
in ~30 lines of Rip. The effect cleanup handles teardown automatically when
`@open` becomes false.

### Tabs

```coffee
export Tabs = component
  @active      := null
  @orientation := 'horizontal'
  @activation  := 'automatic'
  _ready       := false

  _tabEls ~=
    return [] unless _ready
    Array.from(@_content?.querySelectorAll('[data-tab]') or [])

  _panelEls ~=
    return [] unless _ready
    Array.from(@_content?.querySelectorAll('[data-panel]') or [])

  mounted: ->
    _ready = true
    @active = _tabEls[0]?.dataset.tab unless @active

  # Hide tab-definition nodes; show only the active panel
  ~>
    return unless _ready
    _tabEls.forEach (el) -> el.hidden = true
    _panelEls.forEach (el) =>
      isActive = el.dataset.panel is @active
      el.setAttribute 'role', 'tabpanel'
      el.toggleAttribute 'hidden', not isActive
      el.toggleAttribute 'data-active', isActive

  select: (id) -> @active = id; @emit 'change', id

  onKeydown: (e) ->
    ids = _tabEls.map (t) -> t.dataset.tab
    idx = ids.indexOf @active
    return if idx is -1
    horiz = @orientation is 'horizontal'
    prevKey = if horiz then 'ArrowLeft' else 'ArrowUp'
    nextKey = if horiz then 'ArrowRight' else 'ArrowDown'
    next = switch e.key
      when nextKey then ids[(idx + 1) %% ids.length]
      when prevKey then ids[(idx - 1) %% ids.length]
      when 'Home'  then ids[0]
      when 'End'   then ids[ids.length - 1]
      else null
    if next
      e.preventDefault()
      tab = _tabEls.find (t) -> t.dataset.tab is next
      tab?.focus()
      @select(next) if @activation is 'automatic'

  render
    .
      div role: "tablist", aria-orientation: @orientation, @keydown: @onKeydown
        for tab in _tabEls
          button role: "tab"
            aria-selected: tab.dataset.tab is @active
            tabindex: tab.dataset.tab is @active ? '0' : '-1'
            data-active: (tab.dataset.tab is @active)?!
            @click: (=> @select(tab.dataset.tab))
            tab.textContent
      . ref: "_content"
        slot
```

### Reference Material

Component behavior patterns follow:
- **WAI-ARIA Authoring Practices** — https://www.w3.org/WAI/ARIA/apg/patterns/
- **Base UI source** (MIT) — https://github.com/mui/base-ui
- **MDN ARIA documentation** — https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA

---

## Rip Patterns for Widget Authors

Hard-won rules learned building these widgets. Follow them.

### Lifecycle Hooks

The recognized hooks are: `beforeMount`, `mounted`, `updated`, `beforeUnmount`,
`unmounted`, `onError`. That's it. `onMount` is not a hook — it compiles as a
regular method and never gets called. We hit this bug in both Tabs and Toast.

### `->` vs `=>` Inside Components

Not a concern for component methods. The compiler automatically converts all
`->` to `=>` inside component contexts. Use `->` everywhere inside components.

**Caveat**: If you need `this` to refer to something OTHER than the component
(e.g., patching `HTMLElement.prototype.focus` where `this` must be the DOM
element), put it OUTSIDE the component body — at module scope, `->` stays as
`->` and `this` refers to the caller. We hit this with the focus-scroll
override: inside a component `mounted`, `->` became `=>` and `this` bound to
the component, causing "Illegal invocation" when calling `focus()` on a DOM
element.

### `:=` vs `=` for Internal Storage

Use `:=` (reactive state) only for values that should trigger DOM updates when
they change. For internal bookkeeping — pools, caches, timer IDs, saved
references — use `=` (plain assignment). Reactive state has overhead: it
creates a signal, tracks dependents, and triggers effects on mutation. The
Dialog had `_prevFocus := null` and `_cleanupTrap := null` as reactive state
when they should have been plain variables.

### Imperative DOM in Effects

For performance-critical paths (Grid's 60fps scroll), bypass Rip's reactive
render loop and do imperative DOM manipulation inside `~>` effects. The effect
still triggers reactively (when `startRow`, `endRow`, etc. change), but the
DOM updates use `textContent`, `nodeValue`, and `replaceChildren` directly.
This is the correct pattern when the framework's reconciler is too expensive.

### CSS Specificity: Check Computed Styles First

When CSS looks right in the source but renders wrong in the browser, **copy
the computed styles from DevTools**. The browser never lies. We spent hours
trying to fix a 1px text shift in the Grid editor — `appearance: none`,
`contenteditable`, `getComputedStyle` copying, `font: inherit`, longhand vs
shorthand — when the actual bug was a gallery-level `.gallery input[type="text"]`
rule silently overriding `.rip-grid-editor` with 14px font, 12px padding, and
rounded corners. The fix was one `:not(.rip-grid-editor)` selector. Comparing
the computed styles of the cell vs the editor made the mismatch immediately
obvious. Always check what the browser actually computed before debugging
what you *think* it should be.

### `data-*` Attributes vs Class Toggling

All interactive state should be exposed via `data-*` attributes, not CSS
classes. The consumer styles `[data-open]`, `[data-selected]`, etc. in their
own stylesheets. The widget never applies visual styles — it only sets
semantic state attributes. This keeps the headless contract clean.

### Widget Conventions

- Uses `ref:` for DOM element references — **never** `div._name` (dot syntax sets a CSS class, not a ref)
- Uses `_trigger` consistently for trigger elements across all widgets
- Uses `=!` for constant values (IDs, timers) and `:=` only for values that drive DOM updates

---

## Per-Widget Notes

### Select

- Typeahead buffer clears after 500ms of inactivity. Could make this
  configurable but 500ms matches native `<select>` behavior across browsers.
- The listbox is positioned with manual `getBoundingClientRect` math.
  Handles basic flip (up when overflowing bottom) but not horizontal shift.
- Multi-select mode (checkmarks, keep-open-on-select) is not implemented.
  Would need `@multiple` prop, `Set`-based value tracking, and keeping the
  popup open on selection.
- The slot content approach (hidden div holding `<option>` definitions) is a
  workaround for reading children declaratively. Investigate whether Rip's
  `slot` slot can be queried directly without a hidden container.

### Combobox

- No debounce on the `@filter` event — the consumer is responsible for
  debouncing their filter/fetch logic. This is intentional (the widget
  shouldn't impose timing policy) but should be documented more clearly.
- Items are discovered by querying `[data-value]` inside the listbox. This
  means the consumer's `for` loop must render elements with `data-value`
  attributes. Consider whether a more structured item definition (like
  Select's `<option>` approach) would be cleaner.
- Highlighted index resets to -1 on each input change. Some combobox
  implementations keep the highlight on the first match. Worth A/B testing.
- No "create new" option built in. The labs app's patient combobox needs
  "Create New Patient" at the bottom of the dropdown — this is app-level
  code layered on top, not a widget feature.

### Dialog

- Focus trap is inlined — the trap needs to be set up in a `setTimeout`
  (after the dialog renders) and the cleanup function needs to be captured
  in component state for the `~>` effect cleanup.
- Scroll lock is inlined — same lifecycle coordination reason as focus trap.
- Internal storage (`_prevFocus`, `_cleanupTrap`) uses plain `=` not `:=`.
  These don't need reactivity — they're bookkeeping for the effect cleanup.
- No animation prop. Enter/exit animations are handled purely via CSS on
  `[data-open]`. The backdrop gets `animation: fade-in`, the panel gets
  `animation: slide-in`. This is the right approach but consumers need to
  know to add these CSS rules themselves.
- No `closeOnOverlayClick` or `closeOnEscape` toggle props. Currently both
  are always enabled. Some dialogs (confirmation, destructive action) may
  want to disable click-outside dismiss.

### Toast

- No stacking/queue system. Each Toast is an independent component. For a
  toast stack (multiple notifications stacked vertically with auto-dismiss),
  the consumer needs a container component that manages an array of toasts
  and renders one Toast per entry. Consider building a `ToastContainer`
  companion component.
- The 200ms leave animation duration is hardcoded. It should match whatever
  CSS transition the consumer defines. Could expose a `@leaveDuration` prop.
- No position prop (top-right, bottom-center, etc.). Position is determined
  entirely by the consumer's CSS. This is correct for a headless widget but
  a positioned container helper would be useful.

### Popover

- Positioning math is inlined — handles the common placements (bottom-start,
  top, etc.) with basic flip when off-screen.
- No arrow/caret element. Many popover designs want a small triangle pointing
  at the trigger. This requires knowing the placement direction and
  positioning a pseudo-element. Doable with CSS `[data-placement]` attribute.
- The trigger is the first child of `slot` and the popover body is the
  second child. This slot-based approach works but the two children need to
  be distinguished — currently both render into the same `slot` slot.
  This may need Rip UI named slots or a different structural approach.

### Tooltip

- The tooltip ID is randomly generated (`tip-${random}`). For SSR or
  snapshot testing this would be non-deterministic. Not a concern for
  browser-only Rip but worth noting.
- Show delay defaults to 300ms, no hide delay (instant + 150ms animation).
  Touch devices should probably skip the delay and show on long-press. Not
  implemented.
- No `interactive` mode (hovering the tooltip itself keeps it open). The
  tooltip hides on mouseleave from the trigger. For tooltips with clickable
  links inside, an interactive mode would be needed.

### Tabs

- Tab content is discovered by querying `[data-tab]` and `[data-panel]`
  inside the component. This means the render block needs to output these
  as direct children. Deeply nested tabs won't be found.
- The component manages focus via `tab?.focus()` after selection, which is
  correct for roving tabindex. However, if the tab trigger is a link (`<a>`)
  this would also navigate. Tabs should use `<button>` elements.
- No lazy loading of panel content. All panels are in the DOM (hidden
  attribute). For expensive panels, a `@lazy` prop that only renders the
  panel content when first activated would be useful.
- Vertical tabs (ArrowUp/Down instead of ArrowLeft/Right) are not supported.
  Would need an `@orientation` prop that switches the key bindings.

### Accordion

- **Missing ARIA.** No `aria-expanded` on triggers, no `aria-controls`, no
  `role="region"` on content panels. Every other interactive widget has
  proper ARIA. This needs to be added.
- **Incomplete render wiring.** The render block is just `div._el` →
  `slot`. The component defines methods (`toggle`, `isOpen`,
  `onTriggerKeydown`) but doesn't wire them to any DOM elements. Consumers
  must wire events manually. Consider whether the widget should manage
  rendering like Select/Tabs do.
- The `openItems` Set is replaced with a new Set on every toggle to trigger
  Rip's reactivity (`openItems = new Set(openItems)`). This is necessary
  because Rip's `:=` detects reference changes, not deep mutations. The
  pattern works but creates a new Set allocation per toggle.
- No animated expand/collapse. The content is shown/hidden by the consumer
  via `if @isOpen('a')`. CSS transitions on `max-height` or the `<details>`
  element's built-in animation could be documented as patterns.

### Checkbox

- The simplest widget — 33 lines. Intentionally minimal. Handles the ARIA
  correctly (`role="checkbox"` vs `role="switch"`, `aria-checked` with mixed
  state support) but the visual rendering is entirely up to the consumer.
- No group/fieldset support. For a group of checkboxes with a "select all"
  parent, the consumer manages the array of checked values themselves.
- Indeterminate state must be set externally (`indeterminate: true`). The
  widget never sets it automatically — that's the consumer's responsibility
  (e.g., when some but not all children in a group are checked).

### Menu

- **Structural `slot` issue.** The `slot` slot renders inside the
  trigger button, but the items computed queries `_menuEl` (a separate
  container that only exists when open). This means item discovery may not
  work correctly. Needs architectural review — probably needs the same
  hidden-slot pattern that Select uses, or a different structural approach.
- No submenu support. Would need ArrowRight to open a child menu and
  ArrowLeft to close it, plus nested positioning.
- No divider/separator support. Consumers can add non-interactive elements
  between menu items but they'll be included in keyboard navigation unless
  they lack `[data-item]`.
- Disabled items (`data-disabled`) are skipped on click but not on keyboard
  navigation. The keyboard should skip disabled items when arrowing through
  the list.
- No typeahead within the menu (type "D" to jump to "Delete"). Select has
  this but Menu doesn't. Worth adding for consistency.

### Grid

**Architecture.** The grid is the most complex widget (901 lines) and uses a
hybrid approach: Rip's reactive rendering for the table structure (colgroup,
thead) and imperative DOM manipulation for the hot path (tbody rows). This is
a deliberate trade-off — the framework's reconciler is too expensive for
60fps scroll updates of 30-50 rows per frame.

**DOM Recycling.** The `_trPool` array holds pre-created `<tr>` elements. On
each scroll frame:

1. `_ensurePool()` grows the pool if the viewport needs more rows
2. Each pool entry's `<td>` cells are updated via `textContent` (text) or
   `firstChild.nodeValue` (reuse existing text node — avoids allocation)
3. Checkbox cells reuse their `<input>` element if already present
4. `tbody.replaceChildren(...rows)` swaps all children in one reflow
5. Pool entries not needed for the current frame are simply not included

The pool never shrinks. Surplus entries sit idle, ready for reuse if the
container is resized larger. This avoids repeated create/destroy cycles
when a user resizes their window.

**Clipboard.** Ctrl+C (copy), Ctrl+V (paste), Ctrl+X (cut). TSV format
(tab-separated values) is the universal spreadsheet interchange.
`_selectionToTSV()` builds the string, quoting cells that contain tabs,
newlines, or double-quotes per RFC 4180. `_parseTSV()` handles quoted
fields with escaped quotes. Paste respects column types (checkbox columns
interpret `true`/`1`/`yes`) and format parsers.

Known limitation: `_parseTSV` splits on `\n` before processing quotes,
so multi-line quoted fields (a cell value containing a literal newline
inside quotes) are not supported. This is acceptable for typical grid
usage — spreadsheets rarely produce these in practice.

**What's still missing:**

- **Frozen columns.** The CSS approach is documented (`position: sticky;
  left: 0; z-index: 1`) and the column definition supports `frozen: true`,
  but the render pipeline doesn't apply sticky positioning. Implementation:
  in the cell update loop, check `c.frozen` and set `td.style.position =
  'sticky'`, `td.style.left` to the cumulative width of preceding frozen
  columns, and `td.style.zIndex = '1'`.
- **CellCoords / CellRange model.** The spec defines proper `CellCoords`
  and `CellRange` classes with `topLeft()`, `bottomRight()`, `includes()`,
  `forEach()`. The current implementation uses raw integers (`activeRow`,
  `activeCol`, `anchorRow`, `anchorCol`). This works for single ranges but
  makes multi-range selection (Ctrl+click) impossible without refactoring.
- **Variable row height.** The binary search approach is documented in the
  spec (cumulative height cache + `rowTops[]` array) but only uniform height
  is implemented. The viewport engine's O(1) arithmetic would become O(log n).
- **Column reorder.** Drag header to rearrange columns.
- **Undo/redo.** A stack of `{ row, col, oldValue, newValue }` entries with
  Ctrl+Z / Ctrl+Shift+Z bindings.

**Selection border.** The blue rectangle around multi-cell selections uses
`box-shadow` hacks (inset shadows on individual border cells). This works
but has visible seaming at corners. The color `#3b82f6` is hardcoded — for
a headless widget this should use a CSS custom property like
`var(--grid-selection-color, #3b82f6)`. A cleaner approach overall: a
single absolutely-positioned `<div>` overlay sized to the selection bounds.

**Format registry.** The `formatMap` uses string keys like `"0,6"` (row 0 =
all rows, column 6). A cleaner approach: put `format` and `parse` directly
on the column definition object (which the spec already describes). The
registry is still useful for per-cell overrides but should be secondary to
column-level formatting.

**Performance notes:**

- `requestAnimationFrame` throttle coalesces multiple scroll events per
  frame. The `_nextST` variable holds the latest scrollTop; the rAF callback
  reads it once.
- `contain: strict` on the grid container is recommended in the spec but not
  applied by the widget (it ships zero CSS). Document this as a recommended
  user style.
- `will-change: transform` on the table element (for smooth `translateY`
  animation) should also be documented as recommended.
- The sort index (`sortIndex`) is rebuilt on every data or sort change. For
  very large datasets (1M+), an incremental sort (insert into sorted
  position on single-row mutations) would be faster.

---

## Bugs Found and Fixed

These were caught during a comprehensive code review and fixed. Documented
here so future contributors understand the failure modes.

| Widget | Bug | Fix |
|--------|-----|-----|
| tabs.rip | `panel.dataset.tab` instead of `panel.dataset.panel` — all panels permanently hidden | Changed to `panel.dataset.panel` |
| tabs.rip | `onMount:` lifecycle hook — not recognized, auto-select never fired | Changed to `mounted:` |
| toast.rip | `onMount:` lifecycle hook — timer never started, toasts never auto-dismissed | Changed to `mounted:` |
| grid.rip | `handleMousemove` updated `anchorRow/Col` instead of `activeRow/Col` — broke Shift+key after drag | Fixed to update `activeRow/Col` |
| grid.rip | `_parseTSV` used `lines.indexOf(line)` to detect last line — found first empty string instead | Changed to loop index `li` |
| dialog.rip | `_unlockScroll := null` defined but never used | Removed |
| dialog.rip | `_prevFocus` and `_cleanupTrap` used `:=` (reactive) unnecessarily | Changed to `=` (plain) |
| grid.rip | `_prevStart` and `_prevEnd` defined but never read | Removed |
| toast.rip | Comment documented `Toast.show()` static method that didn't exist | Removed comment |
| popover.rip | No `aria-expanded` or `aria-haspopup` on trigger | Added both |

---

## Structural Issues

These are known architectural problems that require more thought than a
quick fix. They're documented here so they aren't forgotten.

**Accordion — incomplete wiring.** The render block passes `slot`
through without wiring events or setting `data-open` attributes. The
component provides methods but doesn't use them in its own render. This
makes it the least "widget-like" widget — more of a behavior mixin.

**Menu — `slot` in wrong container.** Slot children (trigger + items)
all render inside the trigger button. The items computed queries `_menuEl`
which is a separate element. Items aren't reachable. Needs the same
hidden-slot pattern that Select uses, or a different structural approach.

**Popover — dual `slot`.** Both the trigger div and the floating panel
contain `slot`. There's no mechanism to split children between the two
slots. Rip UI would need named slots for this to work correctly.

**Grid — hardcoded selection color.** `#3b82f6` appears in the selection
overlay effect. Should be read from a CSS custom property for theming.

---

## Cross-Widget Notes

### Positioning Strategy

Select, Combobox, Menu, and Popover all need to position floating elements.
Currently each does its own `getBoundingClientRect` math. If this becomes a
maintenance issue, extract a shared positioning function. For now, the
inlined code is simple enough that duplication is preferable to indirection.

### Slot Discovery

Tabs, Accordion, Select, and Combobox all discover their children by
querying `data-*` attributes inside the component's DOM. This works but
creates a coupling between the widget and the consumer's HTML structure.
If Rip UI ever gets a structured slot/children API (like Svelte's
`$$slots` or React's `children`), these widgets should adopt it.

### Testing

No widget has tests yet. Each should have:
1. **Code tests** (`code` in test files) verifying compiled output
2. **Runtime tests** (`test` in test files) verifying state transitions,
   keyboard navigation, and ARIA attribute correctness
3. **Browser tests** for visual regression (screenshot comparison)

Priority for testing: Dialog (focus trap correctness), Select (keyboard +
typeahead), Grid (virtual scroll range calculation, DOM recycling pool
sizing, clipboard TSV round-trip).

---

## Roadmap

The most important things to do next, in order. Each builds on the ones
before it. The theme: stop building new things and start proving what exists.

1. **Run the widgets.** Spin up the gallery with `rip server`, open the
   browser, and see what compiles and what doesn't. Every bug found here
   is a bug that won't surprise a user later. Nothing else matters until
   the code actually executes.

2. **Fix whatever breaks.** The code review caught 4 bugs without running
   anything. There will be more — syntax the compiler rejects, runtime
   errors in effects, timing issues with `mounted` and DOM queries. Fix
   them immediately while the context is fresh.

3. **Write tests for the Grid.** The Grid is the highest-value, highest-risk
   widget. Test the viewport engine (startRow/endRow calculation), DOM
   recycling (pool sizing, cell content updates), clipboard round-trip
   (copy TSV, parse TSV, verify values), and sort index correctness.
   Use `test` blocks for runtime assertions.

4. **Write tests for Dialog.** Focus trap is notoriously hard to get right.
   Test: focus moves to first focusable element on open, Tab wraps within
   the dialog, Escape closes, click outside closes, focus restores to the
   previously focused element on close, body scroll is locked while open.

5. **Write tests for Select.** Test: ArrowDown/Up navigate options, Enter
   selects, Escape closes, typeahead jumps to matching option, Home/End
   work, selected value updates the trigger label, `data-highlighted` and
   `data-selected` are set correctly.

6. **Fix the Menu structural issue.** The `slot` slot renders inside the
   trigger button, making menu items unreachable by `_menuEl`. Adopt the
   same hidden-slot pattern that Select uses for option discovery. This is
   a real bug, not a design preference.

7. **Fix the Accordion wiring.** Add ARIA attributes (`aria-expanded`,
   `aria-controls`, `role="region"`). Wire `@click` and `@keydown` to
   trigger elements in the render block. Set `data-open` on items. Right
   now it's a behavior mixin pretending to be a widget.

8. **Grid: frozen columns.** The CSS is documented, the column definition
   supports `frozen: true`, and the implementation is ~15 lines in the cell
   update loop. This is the most-requested grid feature after what already
   exists. Apply `position: sticky`, cumulative left offset, and z-index
   layering.

9. **Grid: replace hardcoded selection color.** Change `#3b82f6` in the
   selection overlay effect to `var(--grid-selection-color, #3b82f6)`. Read
   the computed style once and cache it, or use CSS custom properties
   directly in the box-shadow strings. Small change, big principle — a
   headless widget should never hardcode colors.

10. **Build a standalone Grid demo page.** A single HTML file that loads
    `rip.min.js`, mounts the Grid widget with 100K rows, and lets people
    scroll, select, edit, sort, resize, copy, and paste. This is the proof
    point. If it runs at 60fps, the Grid is real. If it doesn't, we find
    out now.

11. **Grid: CellRange model.** Replace the raw `activeRow`/`activeCol`/
    `anchorRow`/`anchorCol` integers with proper CellCoords and CellRange
    objects. This unlocks multi-range selection (Ctrl+click) and makes
    the clipboard, selection overlay, and keyboard navigation code cleaner
    and more correct.

12. **Grid: undo/redo.** A stack of `{ row, col, oldValue, newValue }`
    entries. Ctrl+Z pops, Ctrl+Shift+Z pushes back. The `commitEditor`
    method already has `oldVal` and `val` — push to the stack there.
    Cut and paste should also create undo entries. ~40 lines.

13. **Resolve the Popover dual-slot problem.** Document a recommended
    pattern (e.g., "wrap your trigger in a div with `data-trigger`, wrap
    your content in a div with `data-content`") or restructure the widget
    to query `[data-trigger]` and `[data-content]` children explicitly.
    The current "first child is trigger, second is content" is ambiguous
    because `slot` renders everything into one slot.

14. **Add dark mode tokens to the gallery CSS.** The patterns are documented
    in README.md. Add `@media (prefers-color-scheme: dark)` blocks to the
    gallery stylesheet that swap surface, text, and border variables. The
    Grid already has dark mode CSS from its original `grid.html` — port
    those custom property overrides.

15. **Publish the widget suite.** Once tests pass and the demo works, make
    `packages/widgets/` available. Since widgets are plain `.rip` source
    files with no build step, "publishing" means making them discoverable
    — documenting the `components:` serve middleware option, adding the
    widgets path to the Rip project template, and linking from the main
    README.

---

## Postmortem: Building the Widget Suite

Reflections after designing, implementing, reviewing, and documenting 11
headless widgets and a full-stack demo app in one session.

### What We Learned

The biggest thing was how Rip's model differs from everything else. When
building the widgets, the unconscious pull is toward React patterns — hooks,
virtual DOM diffing, component trees. Rip doesn't work that way. The reactive
primitives (`:=`, `~=`, `~>`) are genuinely lower-level and more direct. An
effect that returns a cleanup function just works. No dependency arrays, no
stale closure bugs, no rules-of-hooks violations. The Grid's DOM recycling
effect watches `startRow` and `endRow` and fires when they change — you don't
have to tell it what to watch. That's not a toy pattern. That's a better
abstraction.

The `->` auto-conversion inside components was a revelation. In React you
constantly think about binding context. In Rip, the compiler handles it
silently. The `onMount` vs `mounted` trap was the flip side — the compiler is
opinionated and you have to know its vocabulary. Both are now documented
because the next person will hit them.

The Grid taught us the most. Starting with the reactive render loop
(`for row in visibleRows` creating GridRow components), hitting the
performance wall, then replacing it with imperative DOM recycling — that
progression showed where Rip's reactive model excels (table structure,
header, selection overlay) and where you need to step outside it (60fps
scroll of 50 rows per frame). The fact that you can step outside it cleanly
— imperative DOM inside a `~>` effect — is a strength, not a weakness.
React makes that transition painful. Rip makes it natural.

### How Solid Is This?

**The language and runtime: very solid.** Fine-grained reactivity, compiled
components, zero runtime dependencies, no virtual DOM overhead. The
architecture is sound and the performance model is correct. Rip UI can do
things that React fundamentally cannot — like the Grid's hybrid approach
where the framework handles the structure and raw DOM handles the hot path,
all in one component.

**The widgets: honest assessment — first draft.** They follow the right
patterns, they have the right ARIA, they handle the right keyboard
interactions. But they haven't been compiled, run, or tested. The code
review caught 4 real bugs and 3 structural issues without executing anything.
There will be more bugs when they first run. The Accordion and Menu have
architectural problems that need design decisions, not just fixes. Popover's
dual-slot issue needs named slots that Rip UI doesn't have yet.

**The Grid specifically: genuinely promising.** 901 lines for virtual
scrolling, DOM recycling, cell selection, keyboard navigation, inline
editing, multi-column sorting, column resizing, and full clipboard — that's
remarkably compact. Handsontable needs 50,000+ lines for the same feature
set (plus walkontable, SheetClip, and dozens of plugins). AG Grid is even
larger. The Grid isn't feature-complete, but the foundation is
architecturally correct and the performance approach is what the mature
grids do.

### Toy or Real?

Not a toy.

**What Rip UI has that React/Vue/Svelte don't:**

- Language-level reactivity — no imports, no boilerplate
- Fine-grained DOM updates without a virtual DOM
- Components that compile to JavaScript with zero runtime overhead
- The ability to mix reactive rendering and imperative DOM in one component
- Zero dependencies, zero build step for the consumer

**What the widget suite has that shadcn/Radix/Base UI don't:**

- No framework dependency — works anywhere Rip runs
- Ships as source `.rip` files — the browser compiles them, no build step
- Truly headless — zero CSS, only `data-*` attributes
- One file per widget, not a tree of hooks and context providers

**What's missing to be taken seriously:**

- Tests. None of the widgets have tests. This is the single biggest gap.
- Battle-testing. The first real app that uses them will shake out bugs.
- The structural issues (Accordion, Menu, Popover) need resolution.
- The Grid needs frozen columns and the CellRange model to be competitive.
- Documentation examples that people can copy-paste and see working.

The system is on track. The architecture is right, the performance model is
right, the distribution model (serve `.rip` source, compile in browser) is
right. What's needed now is not more features — it's running the code,
hitting the bugs, and hardening what exists. The gap between "promising
architecture" and "production system" is closed by testing and usage, not
by writing more widgets.
