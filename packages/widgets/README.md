# Rip Widgets

Headless, accessible UI components written in Rip. Zero dependencies. Zero CSS.
Every widget exposes `$` attributes (compiled to `data-*`) for styling and handles keyboard
interactions per WAI-ARIA Authoring Practices.

Widgets are plain `.rip` source files — no build step. The browser compiles
them on the fly via Rip UI's runtime. Include them in your app by adding the
widgets directory to your serve middleware:

```coffee
use serve
  dir: dir
  components: ['components', '../../../packages/widgets']
```

Every widget:
- Handles all keyboard interactions per WAI-ARIA Authoring Practices
- Sets correct ARIA attributes automatically
- Exposes state via `$` sigil (`$open`, `$selected`) — compiles to `data-*` attributes for CSS
- Ships zero CSS — styling is entirely in the user's stylesheets
- Uses Rip's reactive primitives for all state management

---

## Overview

| Component | What It Handles |
|-----------|----------------|
| **Select** | Keyboard navigation, typeahead, ARIA listbox, positioning |
| **Combobox** | Input filtering, keyboard nav, ARIA combobox, positioning |
| **Dialog** | Focus trap, scroll lock, escape/click-outside dismiss, ARIA roles |
| **Toast** | Auto-dismiss timer, stacking, ARIA live region |
| **Popover** | Anchor positioning, flip/shift, dismiss behavior, ARIA |
| **Tooltip** | Show/hide with delay, anchor positioning, ARIA describedby |
| **Tabs** | Arrow key navigation, ARIA tablist/tab/tabpanel |
| **Accordion** | Expand/collapse, single or multiple, ARIA |
| **Checkbox** | Toggle state, indeterminate, ARIA checked |
| **Menu** | Keyboard navigation, ARIA menu roles |
| **Grid** | Virtual scrolling, DOM recycling, cell selection, inline editing, sorting, resizing, clipboard |

---

## Widgets

### Select

Keyboard-navigable dropdown with typeahead. For provider selects, account
pickers, or any single-value choice from a list.

```coffee
Select value <=> selectedRole, @change: handleChange
  option value: "eng", "Engineer"
  option value: "des", "Designer"
  option value: "mgr", "Manager"
```

**Props:** `@value`, `@placeholder`, `@disabled`
**Events:** `@change` (detail: selected value)
**Keyboard:** ArrowDown/Up navigate, Enter/Space select, Escape close, Home/End
jump, type-ahead character matching
**Data attributes:** `$open` / `[data-open]` on trigger, `$highlighted` / `[data-highlighted]` and `$selected` / `[data-selected]` on options, `$disabled` / `[data-disabled]` on trigger

### Combobox

Filterable input + dropdown for search-as-you-type scenarios. For patient
search, autocomplete, or any large list that needs filtering.

```coffee
Combobox query <=> searchText, @select: handleSelect, @filter: handleFilter
  for item in filteredItems
    div $value: item.id
      span item.name
```

**Props:** `@query`, `@placeholder`, `@disabled`
**Events:** `@select` (detail: selected data-value), `@filter` (detail: query string)
**Keyboard:** ArrowDown/Up navigate, Enter select (or first if only one match),
Escape close/clear, Tab close
**Data attributes:** `$open` / `[data-open]` on wrapper, `$highlighted` / `[data-highlighted]` on items

### Dialog

Modal dialog with focus trap, scroll lock, and escape/click-outside dismiss.
Restores focus to the previously focused element on close.

```coffee
Dialog open <=> showDialog, @close: handleClose
  h2 "Confirm Action"
  p "Are you sure?"
  button @click: (=> showDialog = false), "Cancel"
  button @click: handleConfirm, "Confirm"
```

**Props:** `@open`
**Events:** `@close`
**Keyboard:** Escape to close, Tab trapped within dialog
**Data attributes:** `$open` / `[data-open]` on backdrop
**Behavior:** Focus trap confines Tab to dialog content. Body scroll is locked
while open. Previous focus is restored on close.

### Toast

Auto-dismissing notification with ARIA live region for screen reader
announcements.

```coffee
Toast message: "Order submitted!", duration: 4000, type: "success", @dismiss: handleDismiss
```

**Props:** `@message`, `@duration` (ms, 0 = no auto-dismiss), `@type` (info/success/error)
**Events:** `@dismiss`
**Data attributes:** `$type` / `[data-type]`, `$leaving` / `[data-leaving]` (during exit animation)

### Popover

Floating content anchored to a trigger element. Positions itself with
flip/shift to stay in viewport.

```coffee
Popover placement: "bottom-start"
  button "Options"
  div
    p "Popover content here"
```

**Props:** `@placement`, `@offset`, `@disabled`
**Keyboard:** Enter/Space/ArrowDown toggle, Escape close
**Data attributes:** `$open` / `[data-open]`, `$placement` / `[data-placement]` on floating element

### Tooltip

Hover/focus tooltip with configurable delay and positioning.

```coffee
Tooltip text: "Save your changes", placement: "top"
  button "Save"
```

**Props:** `@text`, `@placement`, `@delay` (ms), `@offset`
**Data attributes:** `$open` / `[data-open]`, `$entering` / `[data-entering]`, `$exiting` / `[data-exiting]`, `$placement` / `[data-placement]`
**Behavior:** Shows on mouseenter/focusin after delay, hides on
mouseleave/focusout. Uses `aria-describedby` for accessibility.

### Tabs

Keyboard-navigable tab panel with roving tabindex.

```coffee
Tabs active <=> currentTab
  div $tab: "one", "Tab One"
  div $tab: "two", "Tab Two"
  div $panel: "one"
    p "Content for tab one"
  div $panel: "two"
    p "Content for tab two"
```

**Props:** `@active`
**Events:** `@change` (detail: tab id)
**Keyboard:** ArrowLeft/Right navigate tabs, Home/End jump
**Data attributes:** `$active` / `[data-active]` on active tab and panel

### Accordion

Expand/collapse sections. Single or multiple mode.

```coffee
Accordion multiple: false
  div $item: "a"
    button $trigger: true, "Section A"
    div $content: true
      p "Content A"
```

**Props:** `@multiple`
**Events:** `@change` (detail: array of open item ids)
**Keyboard:** Enter/Space toggle, ArrowDown/Up move between triggers, Home/End
**Methods:** `toggle(id)`, `isOpen(id)`

### Checkbox

Toggle with checkbox or switch semantics. Supports indeterminate state.

```coffee
Checkbox checked <=> isActive, @change: handleChange
  span "Enable notifications"

Checkbox checked <=> isDark, switch: true
  span "Dark mode"
```

**Props:** `@checked`, `@disabled`, `@indeterminate`, `@switch`
**Events:** `@change` (detail: boolean)
**Keyboard:** Enter/Space toggle
**Data attributes:** `$checked` / `[data-checked]`, `$indeterminate` / `[data-indeterminate]`, `$disabled` / `[data-disabled]`
**ARIA:** `role="checkbox"` or `role="switch"`, `aria-checked` (true/false/mixed)

### Menu

Dropdown menu with keyboard navigation. For action menus, context menus.

```coffee
Menu @select: handleAction
  button $trigger: true, "Actions"
  div $item: "edit", "Edit"
  div $item: "delete", "Delete"
  div $item: "archive", "Archive"
```

**Props:** `@disabled`
**Events:** `@select` (detail: item id)
**Keyboard:** ArrowDown/Up navigate, Enter/Space select, Escape close, Home/End
**Data attributes:** `$open` / `[data-open]` on trigger, `$highlighted` / `[data-highlighted]` on items

### Grid

High-performance data grid with virtual scrolling, DOM recycling, cell
selection, inline editing, column sorting, and column resizing. Renders 100K+
rows at 60fps.

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
  overscan: 5
  striped: true
  @beforeEdit: validator
  @afterEdit: saveHandler
```

**Props:** `@data`, `@columns`, `@rowHeight`, `@headerHeight`, `@overscan`,
`@striped`, `@beforeEdit`, `@afterEdit`
**Column properties:** `key`, `title`, `width`, `align`, `type` (text/number/
checkbox/select), `source` (for select type)
**Methods:** `getCell(row, col)`, `setCell(row, col, value)`, `getData()`,
`setData(data)`, `sort(col, direction)`, `scrollToRow(index)`,
`copySelection()`, `cutSelection()`, `pasteAtActive()`
**Keyboard:** Arrows navigate, Tab/Shift+Tab move cells, Enter/F2 edit,
Escape cancel, Home/End, Ctrl+arrows jump to edge, PageUp/Down, Ctrl+A
select all, Ctrl+C copy, Ctrl+V paste, Ctrl+X cut, Delete/Backspace clear,
Space toggle checkboxes, type-to-edit
**Data attributes:** `$active` / `[data-active]` and `$selected` / `[data-selected]` on cells, `$sorted` / `[data-sorted]` on headers, `$editing` / `[data-editing]` and `$selecting` / `[data-selecting]` on container
**Sorting:** Click header to sort (asc/desc/none cycle), Shift+click for
multi-column sort
**Editing:** Double-click, Enter, F2, or start typing to edit. Enter/Tab
commit, Escape cancel. Checkbox cells toggle on click/Space.
**Clipboard:** Ctrl+C copies the selection as TSV (tab-separated values) —
the universal spreadsheet interchange format. Ctrl+V pastes TSV from
clipboard starting at the active cell, respecting column types and format
parsers. Ctrl+X copies then clears the selection. Full interop with Excel,
Google Sheets, and Numbers.
**CSS theming:** Uses `--grid-*` custom properties (see `GRID.md` in
`packages/grid/` for the full property list and dark mode example)

---

## Styling

All widgets ship zero CSS. Write `$name` in Rip (compiles to `data-name` in HTML), then style with `[data-name]` selectors in CSS:

```css
.select-trigger[data-open] { border-color: var(--color-primary); }
.option[data-highlighted] { background: var(--surface-2); }
.option[data-selected] { font-weight: 600; color: var(--color-primary); }
.dialog-backdrop[data-open] { animation: fade-in 150ms; }
.toast[data-type="success"] { border-left: 3px solid green; }
.toast[data-leaving] { animation: fade-out 200ms; }
```

No JavaScript styling logic. No className toggling. Write `$open` in Rip, style `[data-open]` in CSS.

### Open Props — Design Tokens

[Open Props](https://open-props.style/) provides consistent scales for spacing,
color, shadow, radius, easing, and typography as CSS custom properties. Pure CSS
(4KB), no runtime, no build step.

```bash
bun add open-props
```

Import what you need:

```css
@import "open-props/sizes";
@import "open-props/colors";
@import "open-props/shadows";
@import "open-props/radii";
@import "open-props/easings";
@import "open-props/fonts";
```

Or import everything:

```css
@import "open-props/style";
```

Override or extend any token:

```css
:root {
  --color-primary: oklch(55% 0.25 260);
  --radius-card: var(--radius-3);
}
```

**Token categories:**

- **Spacing** — `--size-1` through `--size-15` (0.25rem to 7.5rem)
- **Colors** — Full palettes (`--blue-0` through `--blue-12`, etc.) plus semantic surface tokens
- **Shadows** — `--shadow-1` through `--shadow-6`, progressively stronger
- **Radii** — `--radius-1` through `--radius-6` plus `--radius-round`
- **Easing** — `--ease-1` through `--ease-5` (standard) and `--ease-spring-1` through `--ease-spring-5`
- **Typography** — `--font-size-0` through `--font-size-8`, `--font-weight-1` through `--font-weight-9`, `--font-lineheight-0` through `--font-lineheight-5`

Define project-level aliases:

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

### CSS Architecture

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

### Dark Mode

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

### Common Patterns

**Button:**

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

**Form Input:**

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

**Card:**

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

**Dialog:**

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

**Select:**

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

**Tooltip:**

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

### What We Don't Use

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

## File Summary

| File | Lines | Description |
|------|-------|-------------|
| `select.rip` | 182 | Dropdown select with typeahead |
| `combobox.rip` | 152 | Filterable input + listbox |
| `dialog.rip` | 93 | Modal with focus trap and scroll lock |
| `toast.rip` | 44 | Auto-dismiss notification |
| `popover.rip` | 116 | Anchored floating content |
| `tooltip.rip` | 99 | Hover/focus tooltip |
| `tabs.rip` | 92 | Tab panel with roving tabindex |
| `accordion.rip` | 92 | Expand/collapse sections |
| `checkbox.rip` | 33 | Checkbox and switch toggle |
| `menu.rip` | 132 | Dropdown action menu |
| `grid.rip` | 901 | Virtual-scrolling data grid with clipboard |
| **Total** | **1,936** | |
