# Rip Widgets

Headless, accessible UI components written in Rip. Zero dependencies. Zero CSS.
Every widget exposes `data-*` attributes for styling and handles keyboard
interactions per WAI-ARIA Authoring Practices.

Widgets are plain `.rip` source files — no build step. The browser compiles
them on the fly via Rip UI's runtime. Include them in your app by adding the
widgets directory to your serve middleware:

```coffee
use serve
  dir: dir
  components: ['components', '../../../packages/widgets']
```

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
**Data attributes:** `[data-open]` on trigger, `[data-highlighted]` and
`[data-selected]` on options, `[data-disabled]` on trigger

### Combobox

Filterable input + dropdown for search-as-you-type scenarios. For patient
search, autocomplete, or any large list that needs filtering.

```coffee
Combobox query <=> searchText, @select: handleSelect, @filter: handleFilter
  for item in filteredItems
    div data-value: item.id
      span item.name
```

**Props:** `@query`, `@placeholder`, `@disabled`
**Events:** `@select` (detail: selected data-value), `@filter` (detail: query string)
**Keyboard:** ArrowDown/Up navigate, Enter select (or first if only one match),
Escape close/clear, Tab close
**Data attributes:** `[data-open]` on wrapper, `[data-highlighted]` on items

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
**Data attributes:** `[data-open]` on backdrop
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
**Data attributes:** `[data-type]`, `[data-leaving]` (during exit animation)

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
**Data attributes:** `[data-open]`, `[data-placement]` on floating element

### Tooltip

Hover/focus tooltip with configurable delay and positioning.

```coffee
Tooltip text: "Save your changes", placement: "top"
  button "Save"
```

**Props:** `@text`, `@placement`, `@delay` (ms), `@offset`
**Data attributes:** `[data-open]`, `[data-entering]`, `[data-exiting]`,
`[data-placement]`
**Behavior:** Shows on mouseenter/focusin after delay, hides on
mouseleave/focusout. Uses `aria-describedby` for accessibility.

### Tabs

Keyboard-navigable tab panel with roving tabindex.

```coffee
Tabs active <=> currentTab
  div data-tab: "one", "Tab One"
  div data-tab: "two", "Tab Two"
  div data-panel: "one"
    p "Content for tab one"
  div data-panel: "two"
    p "Content for tab two"
```

**Props:** `@active`
**Events:** `@change` (detail: tab id)
**Keyboard:** ArrowLeft/Right navigate tabs, Home/End jump
**Data attributes:** `[data-active]` on active tab and panel

### Accordion

Expand/collapse sections. Single or multiple mode.

```coffee
Accordion multiple: false
  div data-item: "a"
    button data-trigger: true, "Section A"
    div data-content: true
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
**Data attributes:** `[data-checked]`, `[data-indeterminate]`, `[data-disabled]`
**ARIA:** `role="checkbox"` or `role="switch"`, `aria-checked` (true/false/mixed)

### Menu

Dropdown menu with keyboard navigation. For action menus, context menus.

```coffee
Menu @select: handleAction
  button data-trigger: true, "Actions"
  div data-item: "edit", "Edit"
  div data-item: "delete", "Delete"
  div data-item: "archive", "Archive"
```

**Props:** `@disabled`
**Events:** `@select` (detail: item id)
**Keyboard:** ArrowDown/Up navigate, Enter/Space select, Escape close, Home/End
**Data attributes:** `[data-open]` on trigger, `[data-highlighted]` on items

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
**Data attributes:** `[data-active]` and `[data-selected]` on cells,
`[data-sorted]` on headers, `[data-editing]` and `[data-selecting]` on
container
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

All widgets ship zero CSS. Style them with semantic classes and `data-*`
attribute selectors in your own stylesheets:

```css
.select-trigger[data-open] { border-color: var(--color-primary); }
.option[data-highlighted] { background: var(--surface-2); }
.option[data-selected] { font-weight: 600; color: var(--color-primary); }
.dialog-backdrop[data-open] { animation: fade-in 150ms; }
.toast[data-type="success"] { border-left: 3px solid green; }
.toast[data-leaving] { animation: fade-out 200ms; }
```

See `demos/labs/app/styles/components.css` for a complete example of widget
styling using Open Props design tokens.

---

## File Summary

| File | Lines | Description |
|------|-------|-------------|
| `select.rip` | 169 | Dropdown select with typeahead |
| `combobox.rip` | 114 | Filterable input + listbox |
| `dialog.rip` | 86 | Modal with focus trap and scroll lock |
| `toast.rip` | 44 | Auto-dismiss notification |
| `popover.rip` | 95 | Anchored floating content |
| `tooltip.rip` | 89 | Hover/focus tooltip |
| `tabs.rip` | 70 | Tab panel with roving tabindex |
| `accordion.rip` | 71 | Expand/collapse sections |
| `checkbox.rip` | 42 | Checkbox and switch toggle |
| `menu.rip` | 120 | Dropdown action menu |
| `grid.rip` | 858 | Virtual-scrolling data grid with clipboard |
| **Total** | **1,758** | |
