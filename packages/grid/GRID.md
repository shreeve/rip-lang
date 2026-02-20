# Rip Grid — Specification

A high-performance, reactive, virtual-scrolling data grid written entirely in
Rip. Zero dependencies. Clean-room implementation targeting 2026 browsers.

---

## Goals

1. Render 100K+ rows at 60fps scroll
2. Fine-grained reactive updates — change one cell, update one DOM node
3. Zero framework dependencies — pure Rip, compiled to ES2022
4. Accessible by default — semantic HTML, keyboard-driven
5. Minimal CSS — themeable via custom properties, no preprocessors
6. Extensible via hooks — sorting, filtering, clipboard as opt-in behaviors

## Non-Goals (v1)

- Spreadsheet formulas / cell references (A1:B5)
- Charting or visualization
- Server-side rendering
- Tree/hierarchical rows
- Pivot tables
- RTL layout (deferred to v2)

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Grid Component                     │
│  The Rip component users instantiate. Owns all state │
│  and orchestrates the subsystems below.              │
├────────────┬────────────┬────────────┬───────────────┤
│  Column    │  Data      │  Viewport  │  Selection    │
│  Model     │  Model     │  Engine    │  Model        │
├────────────┴────────────┴─────┬──────┴───────────────┤
│                          Render Pipeline             │
│  Translates viewport + data into <table> DOM         │
├───────────────────────────────┬──────────────────────┤
│        Editor System          │     Event Bus        │
│  Overlay editors for cells    │  Hooks for extension │
└───────────────────────────────┴──────────────────────┘
```

### How Rip's Primitives Map to Grid Concerns

| Grid Concern | Rip Primitive | Why |
|---|---|---|
| Cell values, selection coords | `:=` (reactive state) | Mutations propagate to dependent DOM nodes |
| Visible row/col range | `~=` (computed) | Pure function of scroll position + dimensions |
| DOM updates, scroll listener | `~>` (effect) | Runs when dependencies change, auto-cleanup |
| Editor value binding | `<=>` (two-way bind) | Input ↔ cell value without manual wiring |
| Shared grid state | `setContext` / `getContext` | Sub-components access grid without prop drilling |

---

## DOM Strategy

### Why `<table>`

We use a real HTML `<table>` element — not CSS Grid, not positioned divs.

**Semantic accessibility.** Screen readers understand `<table>`, `<thead>`,
`<th>`, `<tr>`, `<td>` natively. No ARIA roles needed for the base case.
`role="grid"` is added for interactive grid semantics.

**Browser-optimized layout.** Table layout engines are decades old and
hyper-optimized. The browser calculates column widths across all visible rows
automatically — no JavaScript measurement pass needed for auto-sized columns.

**`position: sticky` works.** As of 2024+, all major browsers support
`position: sticky` on `<thead>` and individual `<th>`/`<td>` elements.
This replaces Walkontable's entire overlay system (5 cloned tables) with
a few CSS declarations.

**Why not CSS Grid?** CSS Grid requires `role="grid"`, `role="row"`,
`role="gridcell"` on every element. Column widths are independent per row
(no auto-sync). No browser table-layout optimization. More code for less.

**Why not positioned divs?** Same ARIA burden as CSS Grid, plus you lose
all browser layout assistance. Every width, height, and position must be
calculated in JavaScript.

### Virtual Scrolling Architecture

The grid renders only visible rows. For a dataset of 100K rows, only ~50 DOM
rows exist at any time.

```
┌─── .grid-container (overflow: auto; height: 400px) ─────────┐
│                                                             │
│  ┌─── .grid-spacer (height: totalRows × rowHeight) ──────┐  │
│  │                                                       │  │
│  │  (empty space above — scroll offset)                  │  │
│  │                                                       │  │
│  │  ┌─── <table> (transform: translateY(offsetY)) ────┐  │  │
│  │  │                                                 │  │  │
│  │  │  <thead>  ← position: sticky; top: 0            │  │  │
│  │  │    <tr><th>Name</th><th>Age</th>...</tr>        │  │  │
│  │  │  </thead>                                       │  │  │
│  │  │                                                 │  │  │
│  │  │  <tbody>  ← only visible rows                   │  │  │
│  │  │    <tr> row 47 </tr>                            │  │  │
│  │  │    <tr> row 48 </tr>                            │  │  │
│  │  │    <tr> row 49 </tr>                            │  │  │
│  │  │    ...                                          │  │  │
│  │  │    <tr> row 78 </tr>                            │  │  │
│  │  │  </tbody>                                       │  │  │
│  │  │                                                 │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  │  (empty space below)                                  │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Container**: Fixed-height div with `overflow: auto`. This is the scroll
parent. Apply `contain: strict` for layout containment.

**Spacer**: A div whose height equals `totalRows × rowHeight` (uniform) or
the sum of all row heights (variable). Creates the correct scrollbar range.
The spacer is invisible — it exists only to set scroll dimensions.

**Table**: Positioned inside the spacer with `transform: translateY(offsetY)`
where `offsetY` is the pixel position of the first rendered row. The table
contains only the visible rows plus an overscan buffer.

**Overscan**: Render extra rows above and below the visible range (default: 5
each direction) to prevent blank flashes during fast scrolling.

### Frozen Regions

Frozen headers and columns use pure CSS — no JavaScript cloning.

```css
/* Frozen header */
thead th {
  position: sticky;
  top: 0;
  z-index: 2;
}

/* Frozen columns (first N columns) */
td.frozen, th.frozen {
  position: sticky;
  left: 0;           /* or computed offset for 2nd, 3rd frozen col */
  z-index: 1;
}

/* Corner cell (frozen row + frozen col) */
thead th.frozen {
  z-index: 3;
}
```

This works because `position: sticky` elements remain in the normal document
flow but "stick" to their nearest scroll ancestor when scrolled past.

### DOM Recycling

On each scroll frame, the render pipeline:

1. Calculates the new visible range (startRow..endRow)
2. Compares with the previous range
3. For rows that remain visible — no DOM changes
4. For rows that leave — detach `<tr>` elements, return to a pool
5. For rows that enter — pull `<tr>` from pool (or create new), update cell
   content, insert at correct position

Cell content updates use direct property assignment:

```
td.textContent = value         # for plain text
td.innerHTML = rendered        # for custom renderers (sanitized)
```

---

## Data Model

### Input Format

The grid accepts data as an array of objects or an array of arrays:

```coffee
# Array of objects (preferred)
data := [
  { name: 'Alice', age: 32, role: 'Engineer' }
  { name: 'Bob',   age: 28, role: 'Designer' }
]

# Array of arrays
data := [
  ['Alice', 32, 'Engineer']
  ['Bob',   28, 'Designer']
]
```

### Reactive Data

The data array is wrapped in a reactive state (`:=`). Mutations to the array
or individual cells trigger targeted DOM updates.

```coffee
data[0].age = 33              # updates one <td>
data.push { name: 'Carol' }   # appends one <tr>
data.splice(1, 1)             # removes one <tr>, shifts others
```

### Row Identity

Each row needs a stable identity for efficient reconciliation during sort,
filter, and mutation operations.

```coffee
Grid
  data: items
  rowKey: (row) -> row.id     # custom key function
```

Default: array index (sufficient when data is append-only or immutable).

### Mutation API

```coffee
grid.getCell(row, col)                  # read cell value
grid.setCell(row, col, value)           # write cell value
grid.getRow(row)                        # read row object/array
grid.setRow(row, data)                  # replace entire row
grid.insertRow(index, data)             # insert at position
grid.deleteRow(index)                   # remove row
grid.getData()                          # full data snapshot
grid.setData(newData)                   # replace all data
```

---

## Column Configuration

### Column Definition

```coffee
columns := [
  { key: 'name',   title: 'Name',   width: 200, frozen: true }
  { key: 'age',    title: 'Age',    width: 80,  type: 'number', align: 'right' }
  { key: 'role',   title: 'Role',   width: 150, type: 'select', source: roles }
  { key: 'active', title: 'Active', width: 60,  type: 'checkbox' }
  { key: 'notes',  title: 'Notes',  flex: 1,    type: 'text' }
]
```

### Column Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `key` | string | required | Property name in row objects (or column index for arrays) |
| `title` | string | `key` | Header text |
| `width` | number | `100` | Fixed width in pixels |
| `minWidth` | number | `40` | Minimum width during resize |
| `maxWidth` | number | `null` | Maximum width during resize |
| `flex` | number | `null` | Flex grow factor (distributes remaining space) |
| `type` | string | `'text'` | Cell type: `text`, `number`, `date`, `checkbox`, `select` |
| `align` | string | `'left'` | Text alignment: `left`, `center`, `right` |
| `frozen` | boolean | `false` | Freeze column (sticky left) |
| `sortable` | boolean | `true` | Allow sorting on this column |
| `editable` | boolean | `true` | Allow cell editing |
| `renderer` | function | `null` | Custom cell renderer: `(value, row, col) -> html` |
| `editor` | function | `null` | Custom editor component |
| `source` | array | `null` | Options for `select` type |
| `format` | function | `null` | Display formatter: `(value) -> string` |
| `parse` | function | `null` | Input parser: `(string) -> value` |

### Column Width Modes

1. **Fixed** (`width: 200`): Exact pixel width. Used as-is.
2. **Flex** (`flex: 1`): Distributes remaining space after fixed columns.
   Multiple flex columns share proportionally.
3. **Auto** (`width: 'auto'`): Measures content of visible rows, caches the
   max width. Re-measures on data change.

Width calculation runs once on mount and when columns change. It does not
re-run on every scroll frame.

---

## Viewport Engine

The viewport engine is the performance-critical core. It answers one question:
**given the current scroll position and container dimensions, which rows and
columns should be rendered?**

### Inputs

| Input | Source | Type |
|---|---|---|
| `scrollTop` | Scroll event on container | number (px) |
| `scrollLeft` | Scroll event on container | number (px) |
| `containerHeight` | Container element / ResizeObserver | number (px) |
| `containerWidth` | Container element / ResizeObserver | number (px) |
| `totalRows` | `data.length` | number |
| `totalCols` | `columns.length` | number |
| `rowHeight` | Uniform constant or per-row cache | number or fn(index) |
| `colWidths` | Column model (resolved widths) | number[] |
| `overscan` | Config (default 5) | number |

### Outputs (Computed)

```coffee
# These are all ~= computed values, recalculated when inputs change

startRow ~= Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
endRow   ~= Math.min(totalRows - 1, Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan)
offsetY  ~= startRow * rowHeight

startCol ~= # analogous for horizontal virtualization (optional)
endCol   ~= # only needed when columns exceed container width
offsetX  ~= # pixel offset for first rendered column
```

### Uniform Row Height (Fast Path)

When all rows have the same height (the common case), viewport calculation is
pure arithmetic — O(1), no iteration:

```coffee
rowHeight := 32

startRow ~= Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
endRow   ~= Math.min(totalRows - 1, Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan)
offsetY  ~= startRow * rowHeight
totalHeight ~= totalRows * rowHeight
```

### Variable Row Height

When rows have different heights, maintain a cumulative height cache:

```coffee
rowTops := []    # rowTops[i] = pixel position of row i's top edge

# Binary search for first visible row
startRow ~=
  lo = 0
  hi = totalRows - 1
  while lo < hi
    mid = (lo + hi) >>> 1
    if rowTops[mid + 1] <= scrollTop
      lo = mid + 1
    else
      hi = mid
  Math.max(0, lo - overscan)
```

Variable height is opt-in and requires either pre-known heights or a
measurement pass on first render.

### Scroll Handling

```coffee
~>
  el = containerRef
  handler = ->
    scrollTop := el.scrollTop
    scrollLeft := el.scrollLeft
  el.addEventListener 'scroll', handler, passive: true
  -> el.removeEventListener 'scroll', handler
```

The scroll handler only reads `scrollTop` and `scrollLeft` into reactive
state. All downstream calculation happens through computed values (`~=`),
and DOM updates happen through effects (`~>`). No imperative render calls.

### Container Resize

```coffee
~>
  observer = new ResizeObserver (entries) ->
    for entry in entries
      containerHeight := entry.contentRect.height
      containerWidth := entry.contentRect.width
  observer.observe containerRef
  -> observer.disconnect()
```

---

## Selection Model

### CellCoords

The atomic unit — a single cell address.

```coffee
CellCoords = (row, col) ->
  @row = row
  @col = col

CellCoords::isEqual = (other) -> @row is other.row and @col is other.col
CellCoords::clone   = -> CellCoords(@row, @col)
CellCoords::isValid = (rows, cols) -> @row >= 0 and @row < rows and @col >= 0 and @col < cols
```

### CellRange

A rectangular selection defined by three coordinates.

```coffee
CellRange = (highlight, from, to) ->
  @highlight = highlight    # the active cell (where the cursor is)
  @from = from              # selection start
  @to = to                  # selection end

CellRange::topLeft     = -> CellCoords(Math.min(@from.row, @to.row), Math.min(@from.col, @to.col))
CellRange::bottomRight = -> CellCoords(Math.max(@from.row, @to.row), Math.max(@from.col, @to.col))
CellRange::width       = -> Math.abs(@to.col - @from.col) + 1
CellRange::height      = -> Math.abs(@to.row - @from.row) + 1
CellRange::isSingle    = -> @from.isEqual(@to)
CellRange::includes    = (coords) ->
  tl = @topLeft()
  br = @bottomRight()
  coords.row >= tl.row and coords.row <= br.row and coords.col >= tl.col and coords.col <= br.col
CellRange::forEach = (fn) ->
  tl = @topLeft()
  br = @bottomRight()
  for r in [tl.row..br.row]
    for c in [tl.col..br.col]
      fn CellCoords(r, c)
```

### Selection State

```coffee
active    := null           # CellCoords — the focused cell
selection := null           # CellRange — current selection (null = no selection)
ranges    := []             # CellRange[] — multi-range selections (Ctrl+click)
selecting := false          # true while mouse-dragging a range
```

### Selection Modes

**Single cell**: Click a cell. `active` and `selection.from` and `selection.to`
are all the same coords.

**Range**: Shift+click or Shift+arrow. `selection.from` stays at the anchor,
`selection.to` extends to the new position. `active` (highlight) follows the
extending end.

**Multi-range**: Ctrl/Cmd+click starts a new range without clearing existing
ones. Each range is pushed to `ranges[]`.

### Keyboard Navigation

| Key | Action |
|---|---|
| Arrow keys | Move active cell by one |
| Shift + Arrow | Extend selection range |
| Ctrl/Cmd + Arrow | Jump to edge of data (next empty/non-empty boundary) |
| Tab / Shift+Tab | Move right/left, wrap to next/prev row |
| Enter / Shift+Enter | Move down/up (or open editor, configurable) |
| Home / End | Move to first/last column in row |
| Ctrl+Home / Ctrl+End | Move to first/last cell in grid |
| Escape | Clear selection range (keep active cell) |
| Ctrl/Cmd + A | Select all |

### Scroll-Into-View

When keyboard navigation moves the active cell outside the visible viewport,
the grid scrolls to bring it into view:

```coffee
scrollToCell = (coords) ->
  rowTop = coords.row * rowHeight
  rowBottom = rowTop + rowHeight

  if rowTop < scrollTop
    containerRef.scrollTop = rowTop                            # scroll up
  else if rowBottom > scrollTop + containerHeight
    containerRef.scrollTop = rowBottom - containerHeight        # scroll down

  # analogous for horizontal scrolling
```

---

## Editing System

### Editor Lifecycle

```
 ┌─────────┐     trigger     ┌──────────┐    commit     ┌───────────┐
 │  IDLE   │ ──────────────> │ EDITING  │ ────────────> │ VALIDATE  │
 │         │                 │          │               │           │
 │         │ <────────────── │          │ <──────────── │           │
 └─────────┘     cancel      └──────────┘    reject     └───────────┘
                                                            │
                                                         accept
                                                            │
                                                            v
                                                     ┌───────────┐
                                                     │   SAVE    │
                                                     └───────────┘
```

**Trigger conditions:**
- Double-click on a cell
- Press Enter or F2 on the active cell
- Start typing while a cell is active (the keystroke becomes initial input)

**Commit:**
- Enter: save value, close editor, move active cell down
- Tab: save value, close editor, move active cell right
- Shift+Enter: save, move up. Shift+Tab: save, move left

**Cancel:**
- Escape: discard changes, close editor, restore original value

### Editor Types

| Type | Element | Behavior |
|---|---|---|
| `text` | `<input type="text">` | Plain text editing |
| `number` | `<input type="number">` | Numeric input with step |
| `date` | `<input type="date">` | Native date picker |
| `checkbox` | `<input type="checkbox">` | Toggle on click/space/enter |
| `select` | `<select>` or custom dropdown | Choose from `source` array |
| `textarea` | `<textarea>` | Multi-line text (Ctrl+Enter to commit) |

### Editor Positioning

The editor is an absolutely-positioned element overlaid on the active cell:

```coffee
~>
  return unless editing
  td = getCellElement(active)
  return unless td
  rect = td.getBoundingClientRect()
  gridRect = containerRef.getBoundingClientRect()
  editorEl.style.top = "#{rect.top - gridRect.top + containerRef.scrollTop}px"
  editorEl.style.left = "#{rect.left - gridRect.left + containerRef.scrollLeft}px"
  editorEl.style.width = "#{rect.width}px"
  editorEl.style.height = "#{rect.height}px"
```

### Validation

Column definitions can include a `validate` function:

```coffee
{ key: 'age', type: 'number', validate: (v) -> v >= 0 and v <= 150 }
```

If validation fails, the cell shows an error state (`data-invalid` attribute)
and the edit can be rejected or accepted with a warning, depending on
configuration.

---

## Event System

### Hook Points

Hooks allow external code to observe and intercept grid behavior. Each hook
can have multiple listeners. "Before" hooks can return `false` to cancel.

```coffee
grid.on 'beforeEdit', (row, col, oldValue, newValue) ->
  return false if col is 'id'    # prevent editing ID column

grid.on 'afterEdit', (row, col, oldValue, newValue) ->
  console.log "Cell [#{row},#{col}] changed: #{oldValue} -> #{newValue}"

grid.on 'selectionChange', (ranges) ->
  statusBar.text = "#{ranges[0].height()} × #{ranges[0].width()} selected"
```

### Available Hooks

| Hook | Arguments | Cancellable | When |
|---|---|---|---|
| `beforeRender` | `(startRow, endRow)` | no | Before DOM update |
| `afterRender` | `(startRow, endRow)` | no | After DOM update |
| `beforeEdit` | `(row, col, oldValue, newValue)` | yes | Before cell commit |
| `afterEdit` | `(row, col, oldValue, newValue)` | no | After cell commit |
| `beforeSort` | `(column, direction)` | yes | Before sort applied |
| `afterSort` | `(column, direction)` | no | After sort applied |
| `cellClick` | `(row, col, event)` | no | Cell clicked |
| `cellDblClick` | `(row, col, event)` | no | Cell double-clicked |
| `cellContext` | `(row, col, event)` | no | Cell right-clicked |
| `selectionChange` | `(ranges)` | no | Selection updated |
| `dataChange` | `(changes)` | no | Data mutated |

### Event Delegation

All mouse/keyboard events use a single listener on the grid container, not
per-cell listeners. Cell coordinates are resolved from the event target:

```coffee
containerRef.addEventListener 'click', (e) ->
  td = e.target.closest('td')
  return unless td
  row = parseInt(td.dataset.row, 10)
  col = parseInt(td.dataset.col, 10)
  emit 'cellClick', row, col, e
```

---

## Styling

### CSS Custom Properties

The grid ships minimal default styles. All visual aspects are controlled via
CSS custom properties, allowing theming without specificity battles.

```css
.rip-grid {
  /* Sizing */
  --grid-row-height: 32px;
  --grid-header-height: 36px;
  --grid-cell-padding: 0 8px;

  /* Colors */
  --grid-border-color: #e2e8f0;
  --grid-header-bg: #f8fafc;
  --grid-header-color: #475569;
  --grid-cell-bg: #ffffff;
  --grid-cell-color: #1e293b;
  --grid-stripe-bg: #f8fafc;

  /* Selection */
  --grid-selection-bg: rgba(59, 130, 246, 0.08);
  --grid-selection-border: #3b82f6;
  --grid-active-bg: rgba(59, 130, 246, 0.15);

  /* Focus */
  --grid-focus-ring: 2px solid #3b82f6;

  /* Typography */
  --grid-font-family: system-ui, -apple-system, sans-serif;
  --grid-font-size: 13px;
}
```

### Dark Mode

```css
@media (prefers-color-scheme: dark) {
  .rip-grid {
    --grid-border-color: #334155;
    --grid-header-bg: #1e293b;
    --grid-header-color: #cbd5e1;
    --grid-cell-bg: #0f172a;
    --grid-cell-color: #e2e8f0;
    --grid-stripe-bg: #1e293b;
  }
}
```

### Size Variants

```css
.rip-grid[data-density="compact"]     { --grid-row-height: 24px; --grid-font-size: 12px; }
.rip-grid[data-density="comfortable"] { --grid-row-height: 40px; --grid-font-size: 14px; }
```

### State Attributes

Interactive states are exposed via `data-*` attributes on cells:

```css
td[data-selected]  { background: var(--grid-selection-bg); }
td[data-active]    { outline: var(--grid-focus-ring); outline-offset: -2px; }
td[data-editing]   { padding: 0; }
td[data-invalid]   { background: rgba(239, 68, 68, 0.1); }
th[data-sorted="asc"]::after  { content: ' ▲'; }
th[data-sorted="desc"]::after { content: ' ▼'; }
```

---

## Performance

### Targets

| Metric | Target | How |
|---|---|---|
| Scroll FPS | 60fps (16ms/frame) | Virtual scrolling, DOM recycling, `contain: strict` |
| DOM nodes | O(visible rows) | Never render off-screen rows |
| Cell update | O(1) | Fine-grained reactivity — one signal per cell |
| Initial render | < 50ms for 100K dataset | No DOM for non-visible rows; viewport calc is O(1) |
| Memory | O(data) + O(visible DOM) | Data lives in plain arrays; DOM is a small window |

### Techniques

**`contain: strict`** on the scroll container. Tells the browser this element's
internals don't affect external layout — enables rendering optimizations.

**`content-visibility: auto`** on overscan rows. The browser can skip painting
rows that are in the DOM (for smooth scroll-back) but not yet visible.

**`will-change: transform`** on the table element. Promotes to its own
compositing layer for smooth `translateY` animations during scroll.

**Passive scroll listener.** `{ passive: true }` tells the browser the handler
won't call `preventDefault()`, enabling scroll optimizations.

**requestAnimationFrame throttle.** Coalesce multiple scroll events per frame
into a single viewport recalculation.

**DOM recycling.** Reuse detached `<tr>`/`<td>` elements instead of creating
new ones. Pool size equals the maximum visible rows + overscan.

---

## API Surface

### Component Usage

```coffee
Grid
  data: employees
  columns: [
    { key: 'name',   title: 'Name',   width: 200, frozen: true }
    { key: 'age',    title: 'Age',    width: 80,  type: 'number' }
    { key: 'role',   title: 'Role',   width: 150 }
    { key: 'active', title: 'Active', width: 60,  type: 'checkbox' }
  ]
  rowKey: (row) -> row.id
  rowHeight: 32
  overscan: 5
  @selectionChange: (ranges) -> updateStatus(ranges)
  @cellDblClick: (row, col, e) -> openDetail(row)
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `data` | array | `[]` | Row data (objects or arrays) |
| `columns` | array | required | Column definitions |
| `rowKey` | function | `null` | Row identity function |
| `rowHeight` | number | `32` | Row height in pixels (uniform mode) |
| `headerHeight` | number | `36` | Header row height |
| `overscan` | number | `5` | Extra rows rendered above/below viewport |
| `frozenCols` | number | `0` | Number of frozen left columns |
| `editable` | boolean | `true` | Global edit toggle |
| `sortable` | boolean | `true` | Global sort toggle |
| `multiSelect` | boolean | `true` | Allow multi-range selection |
| `density` | string | `'default'` | Size variant: `compact`, `default`, `comfortable` |
| `striped` | boolean | `false` | Alternating row backgrounds |

### Methods

```coffee
grid.scrollToRow(index)               # scroll to bring row into view
grid.scrollToCell(row, col)           # scroll to bring cell into view
grid.getSelection()                   # current CellRange[]
grid.setSelection(range)              # programmatic selection
grid.startEditing(row, col)           # open editor on cell
grid.stopEditing(save: true)          # close editor (save or cancel)
grid.getCell(row, col)                # read cell value
grid.setCell(row, col, value)         # write cell value
grid.sort(col, direction)             # sort by column ('asc', 'desc', null)
grid.getData()                        # full data snapshot
grid.setData(data)                    # replace all data
grid.on(hook, callback)               # register hook listener
grid.off(hook, callback)              # unregister hook listener
```

---

## Implementation Phases

### Phase 1 — Viewport (read-only grid)

The minimum viable grid: virtual scrolling with a sticky header.

- [ ] Grid component with container, spacer, and table elements
- [ ] Column model: parse column definitions, calculate widths
- [ ] Viewport engine: compute visible row range from scroll position
- [ ] Render pipeline: create/recycle `<tr>`/`<td>`, populate with data
- [ ] Sticky `<thead>` for frozen header
- [ ] Scroll handler with `requestAnimationFrame` throttle
- [ ] ResizeObserver for container dimensions
- [ ] Basic CSS: borders, padding, header styling, alternating rows
- [ ] CSS custom properties for theming

**Deliverable**: A grid that renders 100K rows and scrolls at 60fps.

### Phase 2 — Selection and Navigation

- [ ] CellCoords and CellRange primitives
- [ ] Click to select cell
- [ ] Shift+click for range selection
- [ ] Ctrl/Cmd+click for multi-range
- [ ] Arrow key navigation
- [ ] Tab/Enter navigation
- [ ] Ctrl+Arrow jump-to-edge
- [ ] Home/End/Ctrl+Home/Ctrl+End
- [ ] Selection visual: `data-selected`, `data-active` attributes
- [ ] Selection border overlay (the blue rectangle)
- [ ] Scroll-into-view on keyboard navigation

**Deliverable**: Full keyboard-driven grid navigation.

### Phase 3 — Editing

- [ ] Editor overlay positioning system
- [ ] Text editor (default)
- [ ] Number editor
- [ ] Checkbox editor (toggle on click)
- [ ] Select/dropdown editor
- [ ] Double-click / Enter / F2 to open
- [ ] Enter/Tab to commit, Escape to cancel
- [ ] Type-to-edit (keystroke opens editor with initial character)
- [ ] Validation with `data-invalid` feedback
- [ ] beforeEdit/afterEdit hooks

**Deliverable**: Inline cell editing with validation.

### Phase 4 — Features

- [ ] Column sorting (click header, cycle asc/desc/none)
- [ ] Column resize (drag header border)
- [ ] Frozen columns via `position: sticky`
- [ ] Copy/paste: read selection to clipboard, paste from clipboard
- [ ] Column reorder (drag header)
- [ ] Row selection column (checkbox column)
- [ ] Context menu hook point
- [ ] Undo/redo stack

**Deliverable**: Feature-complete interactive grid.

### Phase 5 — Polish

- [ ] Accessibility audit: ARIA attributes, focus management, screen reader testing
- [ ] Performance profiling: Chrome DevTools, 100K/500K/1M row benchmarks
- [ ] Dark mode theme
- [ ] Compact/comfortable density variants
- [ ] API documentation
- [ ] Demo page (like the lab results brochure — single-file Rip UI app)
- [ ] npm publish as `@rip-lang/grid`

**Deliverable**: Production-ready `@rip-lang/grid` v1.0.
