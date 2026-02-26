# Widget Implementation Notes

Internal notes, pending items, and implementation details. Not user-facing
documentation — see README.md for usage.

---

## Select

- Typeahead buffer clears after 500ms of inactivity. Could make this
  configurable but 500ms matches native `<select>` behavior across browsers.
- The listbox is positioned with manual `getBoundingClientRect` math.
  Handles basic flip (up when overflowing bottom) but not horizontal shift.
- Multi-select mode (checkmarks, keep-open-on-select) is not implemented.
  Would need `@multiple` prop, `Set`-based value tracking, and keeping the
  popup open on selection.
- The slot content approach (hidden div holding `<option>` definitions) is a
  workaround for reading children declaratively. Investigate whether Rip's
  `#content` slot can be queried directly without a hidden container.

## Combobox

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

## Dialog

- Focus trap is inlined — the trap needs to be set up in a `setTimeout`
  (after the dialog renders) and the cleanup function needs to be captured
  in component state for the `~>` effect cleanup.
- Scroll lock is inlined — same lifecycle coordination reason as focus trap.
- No animation prop. Enter/exit animations are handled purely via CSS on
  `[data-open]`. The backdrop gets `animation: fade-in`, the panel gets
  `animation: slide-in`. This is the right approach but consumers need to
  know to add these CSS rules themselves.
- No `closeOnOverlayClick` or `closeOnEscape` toggle props. Currently both
  are always enabled. Some dialogs (confirmation, destructive action) may
  want to disable click-outside dismiss.

## Toast

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

## Popover

- Positioning math is inlined — handles the common placements (bottom-start,
  top, etc.) with basic flip when off-screen.
- No arrow/caret element. Many popover designs want a small triangle pointing
  at the trigger. This requires knowing the placement direction and
  positioning a pseudo-element. Doable with CSS `[data-placement]` attribute.
- The trigger is the first child of `#content` and the popover body is the
  second child. This slot-based approach works but the two children need to
  be distinguished — currently both render into the same `#content` slot.
  This may need Rip UI named slots or a different structural approach.

## Tooltip

- The tooltip ID is randomly generated (`tip-${random}`). For SSR or
  snapshot testing this would be non-deterministic. Not a concern for
  browser-only Rip but worth noting.
- Show delay defaults to 300ms, no hide delay (instant + 150ms animation).
  Touch devices should probably skip the delay and show on long-press. Not
  implemented.
- No `interactive` mode (hovering the tooltip itself keeps it open). The
  tooltip hides on mouseleave from the trigger. For tooltips with clickable
  links inside, an interactive mode would be needed.

## Tabs

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

## Accordion

- The `openItems` Set is replaced with a new Set on every toggle to trigger
  Rip's reactivity (`openItems = new Set(openItems)`). This is necessary
  because Rip's `:=` detects reference changes, not deep mutations. The
  pattern works but creates a new Set allocation per toggle.
- The trigger/content structure uses `[data-trigger]` and `[data-content]`
  attributes. The component doesn't directly render the accordion items —
  it provides `toggle(id)` and `isOpen(id)` methods that consumers call
  from their render blocks. This is more flexible but less automatic than
  Select/Tabs where the widget manages rendering.
- No animated expand/collapse. The content is shown/hidden by the consumer
  via `if @isOpen('a')`. CSS transitions on `max-height` or the `<details>`
  element's built-in animation could be documented as patterns.

## Checkbox

- The simplest widget — 42 lines. Intentionally minimal. Handles the ARIA
  correctly (`role="checkbox"` vs `role="switch"`, `aria-checked` with mixed
  state support) but the visual rendering is entirely up to the consumer.
- No group/fieldset support. For a group of checkboxes with a "select all"
  parent, the consumer manages the array of checked values themselves.
- Indeterminate state must be set externally (`indeterminate: true`). The
  widget never sets it automatically — that's the consumer's responsibility
  (e.g., when some but not all children in a group are checked).

## Menu

- No submenu support. The spec mentions nested submenus but they're not
  implemented. Would need ArrowRight to open a child menu and ArrowLeft to
  close it, plus nested positioning.
- No divider/separator support. Consumers can add non-interactive elements
  between menu items but they'll be included in keyboard navigation unless
  they lack `[data-item]`.
- Disabled items (`data-disabled`) are skipped on click but not on keyboard
  navigation. The keyboard should skip disabled items when arrowing through
  the list.
- No typeahead within the menu (type "D" to jump to "Delete"). Select has
  this but Menu doesn't. Worth adding for consistency.

## Grid

### Architecture

The grid is the most complex widget (725 lines) and uses a hybrid approach:
Rip's reactive rendering for the table structure (colgroup, thead) and
imperative DOM manipulation for the hot path (tbody rows). This is a
deliberate trade-off — the framework's reconciler is too expensive for
60fps scroll updates of 30-50 rows per frame.

### DOM Recycling

The `_trPool` array holds pre-created `<tr>` elements. On each scroll frame:

1. `_ensurePool()` grows the pool if the viewport needs more rows
2. Each pool entry's `<td>` cells are updated via `textContent` (text) or
   `firstChild.nodeValue` (reuse existing text node — avoids allocation)
3. Checkbox cells reuse their `<input>` element if already present
4. `tbody.replaceChildren(...rows)` swaps all children in one reflow
5. Pool entries not needed for the current frame are simply not included

The pool never shrinks. Surplus entries sit idle, ready for reuse if the
container is resized larger. This avoids repeated create/destroy cycles
when a user resizes their window.

### What's Missing (from GRID.md spec)

**Frozen columns.** The CSS approach is documented (`position: sticky; left:
0; z-index: 1`) and the column definition supports `frozen: true`, but the
render pipeline doesn't apply sticky positioning. Implementation: in the
cell update loop, check `c.frozen` and set `td.style.position = 'sticky'`,
`td.style.left` to the cumulative width of preceding frozen columns, and
`td.style.zIndex = '1'`.

**Clipboard (copy/paste).** A data grid without Ctrl+C / Ctrl+V is a hard
sell for power users. Implementation plan:
- Copy: on Ctrl+C, read the selection range, build a tab-delimited string,
  write to clipboard via `navigator.clipboard.writeText()`
- Paste: on Ctrl+V, read clipboard, parse tab-delimited, write to cells
  starting from the active cell, bump `dataVersion`

**CellCoords / CellRange model.** The spec defines proper `CellCoords` and
`CellRange` classes with `topLeft()`, `bottomRight()`, `includes()`,
`forEach()`. The current implementation uses raw integers (`activeRow`,
`activeCol`, `anchorRow`, `anchorCol`). This works for single ranges but
makes multi-range selection (Ctrl+click) impossible without refactoring.
Plan: introduce the CellRange model, store `ranges` as an array, render
selection overlay from the ranges array.

**DOM recycling of editors.** The editor overlay creates `<input>` or
`<select>` elements imperatively and positions them absolutely. These
could be pooled (one input, one select, reposition on use) to avoid
allocation on every edit.

**Variable row height.** The binary search approach is documented in the spec
(cumulative height cache + `rowTops[]` array) but only uniform height is
implemented. The viewport engine's O(1) arithmetic (`Math.floor(scrollTop /
rowHeight)`) would become O(log n) binary search.

**Column reorder.** Drag header to rearrange columns. Would need a drag
preview element and reordering the `columns` array on drop.

**Undo/redo.** A stack of `{ row, col, oldValue, newValue }` entries with
Ctrl+Z / Ctrl+Shift+Z bindings.

### Selection Border

The blue rectangle around multi-cell selections uses `box-shadow` hacks
(inset shadows on individual border cells). This works but has visible
seaming at corners and doesn't compose correctly when the selection scrolls
partially off-screen. A cleaner approach: a single absolutely-positioned
`<div>` overlay sized to the selection bounds, with a 2px blue border.

### Format Registry

The `formatMap` uses string keys like `"0,6"` (row 0 = all rows, column 6).
This originated from a spreadsheet-style addressing model. A cleaner
approach: put `format` and `parse` directly on the column definition object
(which the spec already describes). The registry is still useful for
per-cell overrides but should be secondary to column-level formatting.

### Performance Notes

- `requestAnimationFrame` throttle coalesces multiple scroll events per frame.
  The `_nextST` variable holds the latest scrollTop; the rAF callback reads
  it once.
- `contain: strict` on the grid container is recommended in the spec but not
  applied by the widget (it ships zero CSS). Document this as a recommended
  user style.
- `will-change: transform` on the table element (for smooth `translateY`
  animation) should also be documented as recommended.
- The sort index (`sortIndex`) is rebuilt on every data or sort change. For
  very large datasets (1M+), an incremental sort (insert into sorted
  position on single-row mutations) would be faster.

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
sizing).
