# Rip UI

Headless, accessible UI components written in Rip. Zero dependencies.
Every widget exposes `$` attributes (compiled to `data-*`) for styling and
handles keyboard interactions per WAI-ARIA Authoring Practices. Style with
Tailwind using `data-[attr]:` variants.

Components are plain `.rip` source files — no build step. The browser compiles
them on the fly.

---

## Quick Start

Add the components directory to your serve middleware:

```coffee
use serve
  dir: dir
  components: ['components', '../../../packages/ui']
```

All widgets become available by name (`Select`, `Dialog`, `Grid`, etc.) in the
shared scope — no imports needed.

```bash
cd packages/ui
rip server
```

Every widget:
- Handles all keyboard interactions per WAI-ARIA Authoring Practices
- Sets correct ARIA attributes automatically
- Exposes state via `$` sigil (`$open`, `$selected`) — style with Tailwind's `data-[attr]:` variants
- Ships no CSS — you bring Tailwind classes
- Uses Rip's reactive primitives for all state management

---

## Rip in 60 Seconds

If you're coming from React or another framework, here's the Rip you need
to know to use these widgets:

| Syntax | Name | What It Does |
|--------|------|-------------|
| `:=` | State | `count := 0` — reactive state (like `useState`) |
| `~=` | Computed | `doubled ~= count * 2` — derived value (like `useMemo`, but auto-tracked) |
| `~>` | Effect | `~> document.title = "#{count}"` — side effect (like `useEffect`, but auto-tracked) |
| `<=>` | Bind | `value <=> @name` — two-way binding between parent and child |
| `@prop` | Prop | `@checked`, `@disabled` — component props (reactive) |
| `$attr` | Data attr | `$open`, `$selected` — compiles to `data-open`, `data-selected` in HTML |
| `@emit` | Event | `@emit 'change', value` — dispatches a CustomEvent |
| `ref:` | DOM ref | `ref: "_panel"` — saves DOM element reference |
| `slot` | Children | Projects parent-provided content into the component |
| `offer` / `accept` | Context | Share reactive state between ancestor and descendant components |
| `::` | Type | `@variant:: string := "default"` — typed prop (enables IDE completions + diagnostics) |

Two-way binding example — React vs Rip:

```coffee
# React: 4 lines per binding
const [show, setShow] = useState(false)
<Dialog open={show} onOpenChange={setShow} />
const [name, setName] = useState('')
<input value={name} onChange={e => setName(e.target.value)} />

# Rip: 1 line per binding
Dialog open <=> show
input value <=> @name
```

---

## Why Rip UI

| | ShadCN / Radix | Rip UI |
|--|---------------|--------|
| Runtime dependency | React (~42KB gz) + ReactDOM | None |
| Component count | ~40 | 54 |
| Total source | ShadCN wrappers (~3K LOC) atop Radix (~20K+ LOC) | 5,191 SLOC — everything included |
| Build step | Required (Next.js, Vite, etc.) | None — browser compiles `.rip` source |
| Styling | Pre-wired Tailwind (ShadCN) or unstyled (Radix) | Headless — `data-*` contract, styled with Tailwind |
| Controlled components | `value` + `onChange` callback pair | `<=>` two-way binding |
| Shared state | React Context + Provider wrappers | `offer` / `accept` keywords |
| Reactivity | `useState` + `useEffect` + dependency arrays | `:=` / `~=` / `~>` — language-level |
| Virtual DOM | Yes (diffing on every render) | No — fine-grained updates to exact nodes |
| Data grid | Not included | 901 SLOC — 100K+ rows at 60fps |

### Architecture

**Fine-grained reactivity.** When `count` changes, only the text node
displaying `count` updates. No tree diffing, no wasted renders, no
memoization needed. Same model as SolidJS and Svelte 5's runes, but built
into the language.

**Components compile to JavaScript.** The `component` keyword, `render`
block, and reactive operators resolve at compile time into ES2022 classes
with direct DOM operations. Source maps point back to `.rip` source for
debugging.

**No build pipeline.** The browser loads the Rip compiler (~50KB) once and
compiles `.rip` files on the fly. For production, pre-compile. For
development, save and see — SSE-based hot reload.

**Source as distribution.** Components are served as `.rip` source files.
Read them, understand them, modify them.

### Component Primitives

| Capability | React | Rip |
|-----------|-------|-----|
| Child projection | No equivalent | `slot` |
| DOM ownership | Virtual DOM abstraction | Direct DOM + `ref:` |
| State sharing | Context + Provider wrappers | `offer` / `accept` |
| Two-way binding | `value` + `onChange` pair | `<=>` operator |
| Reactivity | Hooks + dependency arrays | `:=` / `~=` / `~>` |

---

## Styling with Tailwind

Widgets are headless — they ship no CSS. Each widget exposes semantic state
through `$` attributes that compile to `data-*` in HTML. Style them with
Tailwind's data attribute variants.

### Setup

```html
<script src="https://cdn.tailwindcss.com"></script>
```

### The `data-*` Contract

Widgets set `data-*` attributes to reflect their state. Tailwind targets
these with `data-[attr]:` variants:

```coffee
# Widget source — behavior only, zero styling
button $open: open?!, $disabled: @disabled?!
div $highlighted: (idx is highlightedIndex)?!
div $selected: (@value is current)?!
```

```html
<!-- Your markup — Tailwind classes -->
<button class="border border-gray-300 rounded-lg px-4 py-2
  data-[open]:border-blue-500 data-[open]:ring-2 data-[open]:ring-blue-200
  data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed">
```

### Common Patterns

**Button:**

```html
<button class="inline-flex items-center gap-2 px-4 py-2 rounded-lg
  bg-blue-600 text-white font-medium
  hover:bg-blue-700 active:scale-[0.98] transition
  data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed">
```

**Select trigger:**

```html
<button class="inline-flex items-center justify-between w-full px-3 py-2
  border border-gray-300 rounded-lg bg-white
  data-[open]:border-blue-500 data-[open]:ring-2 data-[open]:ring-blue-200">
```

**Select option:**

```html
<div class="px-3 py-2 rounded cursor-pointer
  data-[highlighted]:bg-gray-100
  data-[selected]:font-semibold data-[selected]:text-blue-600">
```

**Dialog overlay:**

```html
<div class="fixed inset-0 bg-black/50 flex items-center justify-center">
  <div class="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
```

### Dark Mode

Use Tailwind's `dark:` variant with a class-based toggle:

```html
<html class="dark">
  <!-- dark:bg-gray-900 dark:text-gray-100 etc. -->
```

Or define semantic color tokens in your Tailwind config and reference them
throughout — `bg-surface`, `text-primary`, `border-muted` — so dark mode
is a single token swap, not per-element `dark:` classes.

---

## Code Density

### Checkbox — 18 Lines

```coffee
export Checkbox = component
  @checked := false
  @disabled := false
  @indeterminate := false
  @switch := false

  onClick: ->
    return if @disabled
    @indeterminate = false
    @checked = not @checked
    @emit 'change', @checked

  render
    button role: @switch ? 'switch' : 'checkbox'
      aria-checked: @indeterminate ? 'mixed' : !!@checked
      aria-disabled: @disabled?!
      $checked: @checked?!
      $indeterminate: @indeterminate?!
      $disabled: @disabled?!
      slot
```

Full ARIA. Checkbox and switch modes. Indeterminate state. Data attributes
for styling. 18 lines, complete.

### Dialog — Effect-Based Lifecycle

Focus trap, scroll lock, escape dismiss, click-outside dismiss, focus
restore — all in one reactive effect with automatic cleanup:

```coffee
~>
  if @open
    _prevFocus = document.activeElement
    # lock scroll, trap focus, wire ARIA ...
    return ->
      # cleanup runs automatically when @open becomes false
```

No `useEffect`. No dependency array. No cleanup that captures stale state.

### Grid — 901 Lines

No equivalent in ShadCN, Radix, or Headless UI. Virtual scrolling, DOM
recycling, Sheets-style selection, full keyboard nav, inline editing,
multi-column sort, column resizing, clipboard (Ctrl+C/V/X as TSV — interop
with Excel, Google Sheets, Numbers). 901 lines vs 50,000+ for AG Grid.

---

## Component Overview

54 headless components across 10 categories — 5,191 lines total.

### Selection

| Widget | Description | Key Props | Events |
|--------|-------------|-----------|--------|
| **Select** | Dropdown with typeahead, ARIA listbox | `@value`, `@placeholder`, `@disabled` | `@change` |
| **Combobox** | Filterable input + listbox | `@query`, `@placeholder`, `@disabled` | `@select`, `@filter` |
| **MultiSelect** | Multi-select with chips and filtering | `@value`, `@query`, `@placeholder` | `@change` |
| **Autocomplete** | Type to filter, select to fill | `@value`, `@query`, `@placeholder` | `@change` |

### Toggle

| Widget | Description | Key Props | Events |
|--------|-------------|-----------|--------|
| **Checkbox** | Toggle with checkbox/switch semantics | `@checked`, `@disabled`, `@switch` | `@change` |
| **Toggle** | Two-state toggle button | `@pressed`, `@disabled` | `@change` |
| **ToggleGroup** | Single or multi-select toggles | `@value`, `@multiple` | `@change` |
| **RadioGroup** | Exactly one selected, arrow nav | `@value`, `@disabled` | `@change` |
| **CheckboxGroup** | Multiple checked independently | `@value`, `@disabled` | `@change` |

### Input

| Widget | Description | Key Props | Events |
|--------|-------------|-----------|--------|
| **Input** | Focus, touch, and validation tracking | `@value`, `@type`, `@placeholder` | `@change` |
| **Textarea** | Auto-resizing text area | `@value`, `@autoResize`, `@rows` | `@change` |
| **NumberField** | Stepper buttons, hold-to-repeat | `@value`, `@min`, `@max`, `@step` | `@change` |
| **Slider** | Drag with pointer capture + keyboard | `@value`, `@min`, `@max`, `@step` | `@change` |
| **OTPField** | Multi-digit code, auto-advance + paste | `@value`, `@length` | `@complete` |
| **DatePicker** | Calendar dropdown, single or range | `@value`, `@min`, `@max`, `@range` | `@change` |
| **EditableValue** | Click-to-edit inline value | `@value`, `@placeholder` | `@change` |
| **NativeSelect** | Styled native `<select>` wrapper | `@value`, `@disabled` | `@change` |
| **InputGroup** | Input with prefix/suffix addons | `@disabled` | — |

### Navigation

| Widget | Description | Key Props | Events |
|--------|-------------|-----------|--------|
| **Tabs** | Arrow key nav, roving tabindex | `@active`, `@orientation` | `@change` |
| **Menu** | Dropdown action menu | `@disabled` | `@select` |
| **ContextMenu** | Right-click context menu | `@disabled` | `@select` |
| **Menubar** | Horizontal menu bar with dropdowns | — | `@select` |
| **NavMenu** | Site nav with hover/click panels | — | — |
| **Toolbar** | Grouped controls, roving tabindex | `@orientation`, `@label` | — |
| **Breadcrumb** | Navigation trail with separator | `@separator`, `@label` | — |

### Overlay

| Widget | Description | Key Props | Events |
|--------|-------------|-----------|--------|
| **Dialog** | Focus trap, scroll lock, ARIA modal | `@open` | `@close` |
| **AlertDialog** | Non-dismissable modal | `@open`, `@initialFocus` | `@close` |
| **Drawer** | Slide-out panel with focus trap | `@open`, `@side` | `@close` |
| **Popover** | Anchored floating with flip/shift | `@placement`, `@offset` | — |
| **Tooltip** | Hover/focus with delay | `@text`, `@placement`, `@delay` | — |
| **PreviewCard** | Hover/focus preview card | `@delay`, `@placement` | — |
| **Toast** | Auto-dismiss, ARIA live region | `@toast` (object) | `@dismiss` |

### Display

| Widget | Description | Key Props |
|--------|-------------|-----------|
| **Button** | Disabled-but-focusable pattern | `@disabled` |
| **Badge** | Inline label (solid/outline/subtle) | `@variant` |
| **Card** | Container with header/content/footer | `@interactive` |
| **Separator** | Decorative or semantic divider | `@orientation`, `@decorative` |
| **Progress** | Progress bar via CSS custom prop | `@value`, `@max` |
| **Meter** | Gauge with thresholds | `@value`, `@min`, `@max`, `@low`, `@high` |
| **Spinner** | Loading indicator | `@label`, `@size` |
| **Skeleton** | Loading placeholder with shimmer | `@width`, `@height`, `@circle` |
| **Avatar** | Image with fallback to initials | `@src`, `@alt`, `@fallback` |
| **Label** | Accessible form label | `@for`, `@required` |
| **ScrollArea** | Custom scrollbar, draggable thumb | `@orientation` |

### Form

| Widget | Description | Key Props |
|--------|-------------|-----------|
| **Field** | Label + description + error wrapper | `@label`, `@error`, `@required` |
| **Fieldset** | Grouped fields with cascading disable | `@legend`, `@disabled` |
| **Form** | Submit handling + validation state | `@onSubmit` |
| **ButtonGroup** | Grouped buttons, ARIA semantics | `@orientation`, `@disabled` |

### Data

| Widget | Description | Key Props |
|--------|-------------|-----------|
| **Grid** | Virtual scroll, 100K+ rows at 60fps | `@data`, `@columns`, `@rowHeight` |
| **Accordion** | Expand/collapse, single or multiple | `@multiple` |
| **Table** | Semantic table wrapper | `@caption`, `@striped` |

### Interactive

| Widget | Description | Key Props | Events |
|--------|-------------|-----------|--------|
| **Collapsible** | Animated expand/collapse | `@open`, `@disabled` | `@change` |
| **Pagination** | Page nav with ellipsis gaps | `@page`, `@total`, `@perPage` | `@change` |
| **Carousel** | Slide with autoplay + loop | `@loop`, `@autoplay`, `@interval` | `@change` |
| **Resizable** | Draggable resize handles | `@orientation`, `@minSize` | `@resize` |

---

## Widget Reference

### Select

```coffee
Select value <=> selectedRole, @change: handleChange
  option value: "eng", "Engineer"
  option value: "des", "Designer"
  option value: "mgr", "Manager"
```

**Keyboard:** ArrowDown/Up navigate, Enter/Space select, Escape close, Home/End, type-ahead
**Data attributes:** `$open`, `$highlighted`, `$selected`, `$disabled`

### Combobox

```coffee
Combobox query <=> searchText, @select: handleSelect, @filter: handleFilter
  for item in filteredItems
    div $value: item.id
      span item.name
```

**Keyboard:** ArrowDown/Up navigate, Enter select, Escape close/clear, Tab close
**Data attributes:** `$open`, `$highlighted`

### Dialog

```coffee
Dialog open <=> showDialog, @close: handleClose
  h2 "Confirm Action"
  p "Are you sure?"
  button @click: (=> showDialog = false), "Cancel"
  button @click: handleConfirm, "Confirm"
```

**Keyboard:** Escape to close, Tab trapped within dialog
**Data attributes:** `$open`
**Behavior:** Focus trap, body scroll lock, focus restore on close

### AlertDialog

```coffee
AlertDialog open <=> showConfirm
  h2 "Delete account?"
  p "This action cannot be undone."
  button @click: (=> showConfirm = false), "Cancel"
  button @click: handleDelete, "Delete"
```

Like Dialog but cannot be closed by Escape or click outside.
**ARIA:** `role="alertdialog"`, auto-wired `aria-labelledby`/`aria-describedby`

### Toast

```coffee
toasts := []
toasts = [...toasts, { message: "Saved!", type: "success" }]
toasts = toasts.filter (t) -> t isnt target
ToastViewport toasts <=> toasts
```

**Props:** `@toasts`, `@placement` (bottom-right, top-right, etc.)
**Per-toast:** `message`, `type`, `duration` (default 4000ms), `title`, `action`
**Data attributes:** `$type`, `$leaving`
**Behavior:** Timer pauses on hover, resumes on leave

### Tabs

```coffee
Tabs active <=> currentTab
  div $tab: "one", "Tab One"
  div $tab: "two", "Tab Two"
  div $panel: "one"
    p "Content for tab one"
  div $panel: "two"
    p "Content for tab two"
```

**Keyboard:** ArrowLeft/Right navigate, Home/End jump
**Data attributes:** `$active`

### Accordion

```coffee
Accordion multiple: false
  div $item: "a"
    button $trigger: true, "Section A"
    div $content: true
      p "Content A"
```

**Keyboard:** Enter/Space toggle, ArrowDown/Up between triggers, Home/End
**Methods:** `toggle(id)`, `isOpen(id)`

### Checkbox

```coffee
Checkbox checked <=> isActive, @change: handleChange
  span "Enable notifications"

Checkbox checked <=> isDark, switch: true
  span "Dark mode"
```

**ARIA:** `role="checkbox"` or `role="switch"`, `aria-checked` (true/false/mixed)
**Data attributes:** `$checked`, `$indeterminate`, `$disabled`

### Menu

```coffee
Menu @select: handleAction
  button $trigger: true, "Actions"
  div $item: "edit", "Edit"
  div $item: "delete", "Delete"
```

**Keyboard:** ArrowDown/Up navigate, Enter/Space select, Escape close
**Data attributes:** `$open`, `$highlighted`

### Popover

```coffee
Popover placement: "bottom-start"
  button "Options"
  div
    p "Popover content here"
```

**Keyboard:** Enter/Space/ArrowDown toggle, Escape close
**Data attributes:** `$open`, `$placement`

### Tooltip

```coffee
Tooltip text: "Save your changes", placement: "top"
  button "Save"
```

**Data attributes:** `$open`, `$entering`, `$exiting`, `$placement`
**Behavior:** Shows after delay on hover/focus, uses `aria-describedby`

### Grid

```coffee
Grid
  data: employees
  columns: [
    { key: 'name',   title: 'Name',   width: 200 }
    { key: 'age',    title: 'Age',    width: 80,  align: 'right' }
    { key: 'role',   title: 'Role',   width: 150, type: 'select', source: roles }
    { key: 'active', title: 'Active', width: 60,  type: 'checkbox' }
  ]
  rowHeight: 32
  striped: true
```

**Column types:** `text`, `number`, `checkbox`, `select`
**Methods:** `getCell`, `setCell`, `getData`, `setData`, `sort`, `scrollToRow`, `copySelection`, `cutSelection`, `pasteAtActive`
**Keyboard:** Arrows, Tab, Enter/F2 edit, Escape cancel, Ctrl+arrows jump, PageUp/Down, Ctrl+A, Ctrl+C/V/X, Delete, Space (checkboxes), type-to-edit
**Sorting:** Click header (asc/desc/none), Shift+click for multi-column
**Clipboard:** TSV format — interop with Excel, Sheets, Numbers
**Data attributes:** `$active`, `$selected`, `$sorted`, `$editing`, `$selecting`

### Collapsible

```coffee
Collapsible open <=> isOpen
  button $trigger: true, "Show details"
  div $content: true
    p "Hidden content here"
```

**Methods:** `toggle()`
**Data attributes:** `$open`, `$disabled`
**CSS custom properties:** `--collapsible-height`, `--collapsible-width`

### Pagination

```coffee
Pagination page <=> currentPage, total: 100, perPage: 10
```

**Keyboard:** ArrowLeft/Right, Home/End
**Data attributes:** `$active`, `$disabled`, `$ellipsis`

### Carousel

```coffee
Carousel loop: true
  div $slide: true, "Slide 1"
  div $slide: true, "Slide 2"
  div $slide: true, "Slide 3"
```

**Methods:** `goto(index)`, `next()`, `prev()`
**Behavior:** Autoplay pauses on hover

### Drawer

```coffee
Drawer open <=> showDrawer, side: "left"
  nav "Sidebar content"
```

**Props:** `@open`, `@side` (top/right/bottom/left), `@dismissable`
**Behavior:** Focus trap, scroll lock, Escape to close

### Breadcrumb

```coffee
Breadcrumb
  a $item: true, href: "/", "Home"
  a $item: true, href: "/products", "Products"
  span $item: true, "Widget Pro"
```

**ARIA:** `aria-current="page"` on last item

### Resizable

```coffee
Resizable
  div $panel: true, "Left"
  div $panel: true, "Right"
```

**ARIA:** `role="separator"` on handles
**CSS custom properties:** `--panel-size` on each panel

### Context Sharing: `offer` / `accept`

For compound components where descendants need shared state:

```coffee
# Parent offers reactive state to all descendants
export Tabs = component
  offer active := 'overview'

# Child accepts the shared signal
export TabContent = component
  accept active
  render
    div hidden: active isnt @value
      slot
```

Parent and child share the same reactive object — mutations in either
direction are instantly visible. No Provider wrappers, no string keys.

---

## File Summary

| Category | Files | Lines |
|----------|-------|-------|
| Selection | 4 | 638 |
| Toggle | 5 | 267 |
| Input | 9 | 854 |
| Navigation | 7 | 767 |
| Overlay | 7 | 700 |
| Display | 11 | 378 |
| Form | 4 | 140 |
| Data | 3 | 1,041 |
| Interactive | 4 | 406 |
| **Total** | **54** | **5,191** |

---

## Status

The reactive model, headless contract, and performance architecture are
proven. The compiler has 1,436 tests. The widget suite is comprehensive
but still maturing — tests are being added, and a few widgets have known
structural issues being resolved (see [CONTRIBUTING.md](CONTRIBUTING.md)
for details).

For widget authoring patterns, implementation notes, known issues, and the
development roadmap, see **[CONTRIBUTING.md](CONTRIBUTING.md)**.
