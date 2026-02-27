# Styling & Components Guide

This document defines the styling architecture and component strategy for Rip
projects. These choices reflect Rip's core principles: elegance, minimalism,
zero dependencies, and letting the platform do the work.

---

## Philosophy

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

---

## The Stack

| Layer | Tool | Role |
|-------|------|------|
| **Behavior** | Rip Widgets | Accessible headless components — keyboard nav, ARIA, focus management |
| **Design Tokens** | Open Props | Consistent scales for spacing, color, shadow, radius, easing, typography |
| **Scoping** | CSS (scoped) | Component-scoped styles via CSS Modules or Rip UI's built-in scoping |
| **Platform** | Native CSS | Nesting, `@layer`, `data-*` selectors, `prefers-color-scheme` |

---

## Rip Widgets — Native Headless Components

Rip provides its own headless, accessible interactive components. These are
written in Rip using the language's reactive primitives (`:=`, `~=`, `~>`)
and compiled to JavaScript like everything else. No React. No framework
runtime. Just Rip.

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

### The Components

These 10 components cover ~90% of real application needs:

| Component | What It Handles |
|-----------|----------------|
| **Dialog** | Focus trap, scroll lock, escape/click-outside dismiss, ARIA roles |
| **Popover** | Anchor positioning, flip/shift, dismiss behavior, ARIA |
| **Tooltip** | Show/hide with delay, anchor positioning, ARIA describedby |
| **Select** | Keyboard navigation, typeahead, ARIA listbox, positioning |
| **Menu** | Nested submenus, keyboard navigation, ARIA menu roles |
| **Tabs** | Arrow key navigation, ARIA tablist/tab/tabpanel |
| **Accordion** | Expand/collapse, single or multiple, ARIA |
| **Checkbox/Switch** | Toggle state, indeterminate, ARIA checked |
| **Combobox** | Input filtering, keyboard nav, ARIA combobox, positioning |
| **Toast** | Auto-dismiss timer, stacking, ARIA live region |

Each component:
- Handles all keyboard interactions per WAI-ARIA Authoring Practices
- Sets correct ARIA attributes automatically
- Exposes `data-*` attributes for CSS styling (`[data-open]`, `[data-selected]`, etc.)
- Ships zero CSS — styling is entirely in the user's stylesheets
- Uses Rip's reactive primitives for all state management
- Uses `ref:` for DOM element references — **never** `div._name` (dot syntax sets a CSS class, not a ref)
- Uses `_trigger` consistently for trigger elements across all widgets
- Uses `=!` for constant values (IDs, timers) and `:=` only for values that drive DOM updates

### Behavioral Primitives

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

### Example: Dialog Component

A complete headless dialog in Rip, showing how the primitives compose:

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

### Example: Tabs Component

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

## Open Props — Design Tokens

Open Props is a set of CSS custom properties — design tokens — covering spacing,
color, shadow, radius, easing, typography, and animation. It ships as pure CSS
(4KB), has no runtime, no build step, and no opinions about how you use it.

We use Open Props as our design token foundation. It provides the consistent
scales that prevent ad-hoc magic numbers from creeping into stylesheets.

Import what you need:

```css
@import "open-props/sizes";
@import "open-props/colors";
@import "open-props/shadows";
@import "open-props/radii";
@import "open-props/easings";
@import "open-props/fonts";
```

Or import everything at once:

```css
@import "open-props/style";
```

Override or extend any token by redefining the custom property:

```css
:root {
  --color-primary: oklch(55% 0.25 260);
  --radius-card: var(--radius-3);
}
```

### Token Categories

**Spacing** — `--size-1` through `--size-15` (0.25rem to 7.5rem). Use for
padding, margin, and gap.

**Colors** — Full palettes (`--blue-0` through `--blue-12`, etc.) plus
semantic surface tokens. Define project-level aliases:

```css
:root {
  --color-primary: var(--indigo-7);
  --color-danger: var(--red-7);
  --color-success: var(--green-7);
  --color-text: var(--gray-9);
  --color-text-muted: var(--gray-6);
  --surface-1: var(--gray-0);
  --surface-2: var(--gray-1);
  --surface-3: var(--gray-2);
}
```

**Shadows** — `--shadow-1` through `--shadow-6`, progressively stronger.

**Radii** — `--radius-1` through `--radius-6` plus `--radius-round`.

**Easing** — `--ease-1` through `--ease-5` (standard) and `--ease-spring-1`
through `--ease-spring-5` (spring).

**Typography** — `--font-size-0` through `--font-size-8`,
`--font-weight-1` through `--font-weight-9`,
`--font-lineheight-0` through `--font-lineheight-5`.

---

## CSS Architecture

### Native CSS Features

Modern CSS eliminates the need for preprocessors. Use these features directly:

**Nesting** — group related rules:

```css
.card {
  padding: var(--size-4);

  & .title {
    font-size: var(--font-size-4);
    font-weight: var(--font-weight-7);
  }

  &:hover {
    box-shadow: var(--shadow-3);
  }
}
```

**Cascade Layers** — control specificity:

```css
@layer base, components, overrides;

@layer base {
  button { font: inherit; }
}

@layer components {
  .dialog { border-radius: var(--radius-3); }
}
```

**Container Queries** — style based on the container, not the viewport:

```css
.sidebar {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .sidebar .nav { flex-direction: row; }
}
```

**`color-mix()`** — derive colors without Sass:

```css
.muted {
  color: color-mix(in oklch, var(--color-text), transparent 40%);
}
```

### Styling Widget State

Rip widgets expose `data-*` attributes for all interactive states. Style them
with pure CSS attribute selectors:

```css
.dialog-backdrop[data-open] { ... }
.tab[data-active] { ... }
.option[data-highlighted] { ... }
.option[data-selected] { ... }
.switch[data-checked] { ... }
.input[data-invalid] { ... }
.button[data-disabled] { ... }
.tooltip[data-entering] { ... }
.tooltip[data-exiting] { ... }
```

No JavaScript styling logic. No className toggling. The component sets the
attribute; CSS handles the rest.

---

## Dark Mode

Use `prefers-color-scheme` with CSS variable swapping:

```css
:root {
  color-scheme: light dark;

  --surface-1: var(--gray-0);
  --surface-2: var(--gray-1);
  --color-text: var(--gray-9);
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface-1: var(--gray-11);
    --surface-2: var(--gray-10);
    --color-text: var(--gray-1);
  }
}
```

For a manual toggle, use a `[data-theme]` attribute on the root element:

```css
[data-theme="dark"] {
  --surface-1: var(--gray-11);
  --surface-2: var(--gray-10);
  --color-text: var(--gray-1);
}
```

```js
document.documentElement.dataset.theme = 'dark'
```

---

## Common CSS Patterns

### Button

```css
.button {
  display: inline-flex;
  align-items: center;
  gap: var(--size-2);
  padding: var(--size-2) var(--size-4);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-2);
  background: var(--color-primary);
  color: white;
  font-weight: var(--font-weight-6);
  cursor: pointer;
  transition: background 150ms var(--ease-2);

  &:hover { background: color-mix(in oklch, var(--color-primary), black 15%); }
  &:active { scale: 0.98; }
  &[data-disabled] { opacity: 0.5; cursor: not-allowed; }
}

.ghost {
  background: transparent;
  color: var(--color-primary);

  &:hover { background: color-mix(in oklch, var(--color-primary), transparent 90%); }
}
```

### Form Input

```css
.input {
  padding: var(--size-2) var(--size-3);
  border: 1px solid var(--gray-4);
  border-radius: var(--radius-2);
  font-size: var(--font-size-1);
  background: var(--surface-1);
  color: var(--color-text);
  transition: border-color 150ms var(--ease-2);

  &:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
    border-color: var(--color-primary);
  }

  &[data-invalid] { border-color: var(--color-danger); }
  &[data-disabled] { opacity: 0.5; }
  &::placeholder { color: var(--color-text-muted); }
}
```

### Card

```css
.card {
  background: var(--surface-1);
  border-radius: var(--radius-3);
  padding: var(--size-5);
  box-shadow: var(--shadow-2);
  transition: box-shadow 200ms var(--ease-2);

  &:hover { box-shadow: var(--shadow-3); }

  & .title {
    font-size: var(--font-size-3);
    font-weight: var(--font-weight-7);
    margin-block-end: var(--size-2);
  }

  & .body {
    color: var(--color-text-muted);
    line-height: var(--font-lineheight-3);
  }
}
```

### Dialog

```css
.backdrop {
  position: fixed;
  inset: 0;
  background: oklch(0% 0 0 / 40%);
  display: grid;
  place-items: center;

  &[data-open] { animation: fade-in 150ms var(--ease-2); }
}

.panel {
  background: var(--surface-1);
  border-radius: var(--radius-3);
  padding: var(--size-6);
  box-shadow: var(--shadow-4);
  max-width: min(90vw, 32rem);
  width: 100%;
  animation: slide-in-up 200ms var(--ease-spring-3);
}

.panel .title {
  font-size: var(--font-size-4);
  font-weight: var(--font-weight-7);
  margin-block-end: var(--size-2);
}
```

### Select

```css
.trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--size-2);
  padding: var(--size-2) var(--size-3);
  border: 1px solid var(--gray-4);
  border-radius: var(--radius-2);
  background: var(--surface-1);
  cursor: pointer;
  min-width: 10rem;

  &[data-open] { border-color: var(--color-primary); }
}

.popup {
  background: var(--surface-1);
  border: 1px solid var(--gray-3);
  border-radius: var(--radius-2);
  box-shadow: var(--shadow-3);
  padding: var(--size-1);
}

.option {
  padding: var(--size-2) var(--size-3);
  border-radius: var(--radius-1);
  cursor: pointer;

  &[data-highlighted] { background: var(--surface-2); }
  &[data-selected] { font-weight: var(--font-weight-6); color: var(--color-primary); }
}
```

### Tooltip

```css
.tooltip {
  background: var(--gray-10);
  color: var(--gray-0);
  font-size: var(--font-size-0);
  padding: var(--size-1) var(--size-2);
  border-radius: var(--radius-2);
  max-width: 20rem;

  &[data-entering] { animation: fade-in 100ms var(--ease-2); }
  &[data-exiting]  { animation: fade-out 75ms var(--ease-2); }
}
```

---

## What We Don't Use

**React or any framework runtime** — Rip widgets are written in Rip, compiled
to JavaScript, with zero runtime dependencies.

**Tailwind CSS** — utility classes in markup are write-only and semantically
empty. We write real CSS with real selectors.

**CSS-in-JS runtimes** (styled-components, Emotion) — runtime style injection
adds bundle size and creates hydration complexity.

**Sass / Less** — native CSS nesting, `color-mix()`, and custom properties
eliminate the need for preprocessors.

**Inline styles for layout** — the `style` prop is for truly dynamic values
(e.g., positioning from a calculation). Layout, spacing, color, and typography
go in CSS.

**Third-party headless libraries** (Base UI, Radix, Headless UI, Zag.js) —
we implement the same WAI-ARIA patterns natively in Rip. The patterns are
standard; the implementation is ours.

---

## Installation

Open Props is the only external styling dependency:

```bash
bun add open-props
```

Rip widgets ship as part of `rip-lang`. No additional installation needed.

---

## Summary

Write semantic CSS. Use Open Props for consistent design tokens. Use `data-*`
attributes for styling interactive states. Use native CSS features — nesting,
layers, container queries, `color-mix()` — for everything else.

Build accessible interactive components in Rip, following WAI-ARIA patterns
and Base UI's behavioral specifications. Rip's reactive primitives (`:=`,
`~=`, `~>`) handle all state, effects, and cleanup. Share state between
compound components with `offer` / `accept`. Bind bidirectionally with `<=>`.
Zero framework dependencies. Zero runtime overhead.

The result: accessible components, consistent design tokens, scoped styles,
and clean readable code in both Rip and CSS. No class soup. No framework
lock-in. Just the platform.
