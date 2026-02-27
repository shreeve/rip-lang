# Widget Implementation Notes

Internal notes, pending items, and implementation details. Not user-facing
documentation — see README.md for usage.

---

## Rip Patterns for Widget Authors

Hard-won rules learned building these widgets. Follow them.

### Lifecycle Hooks

The recognized hooks are: `beforeMount`, `mounted`, `updated`, `beforeUnmount`,
`unmounted`, `onError`. That's it. `onMount` is not a hook — it compiles as a
regular method and never gets called. We hit this bug in both Tabs and Toast.

### `->` vs `=>` Inside Components

Not a concern. The compiler automatically converts all `->` (thin arrow) to
`=>` (fat arrow) inside component contexts. The `this` binding is always
preserved. Use `->` everywhere inside components — it's cleaner to read and
the compiler does the right thing.

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
  `slot` slot can be queried directly without a hidden container.

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
- Internal storage (`_prevFocus`, `_cleanupTrap`) uses plain `=` not `:=`.
  These don't need reactivity — they're bookkeeping for the effect cleanup.
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
- The trigger is the first child of `slot` and the popover body is the
  second child. This slot-based approach works but the two children need to
  be distinguished — currently both render into the same `slot` slot.
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

- **Structural `slot` issue.** The `slot` slot renders inside the
  trigger button, but the items computed queries `_menuEl` (a separate
  container that only exists when open). This means item discovery may not
  work correctly. Needs architectural review — probably needs the trigger
  and items to be separated, similar to how Select uses a hidden slot for
  option definitions.
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

## Grid

### Architecture

The grid is the most complex widget (858 lines) and uses a hybrid approach:
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

### Clipboard

Implemented: Ctrl+C (copy), Ctrl+V (paste), Ctrl+X (cut).

TSV format (tab-separated values) is the universal spreadsheet interchange.
`_selectionToTSV()` builds the string, quoting cells that contain tabs,
newlines, or double-quotes per RFC 4180. `_parseTSV()` handles quoted
fields with escaped quotes. Paste respects column types (checkbox columns
interpret `true`/`1`/`yes`) and format parsers.

Known limitation: `_parseTSV` splits on `\n` before processing quotes,
so multi-line quoted fields (a cell value containing a literal newline
inside quotes) are not supported. This is acceptable for typical grid
usage — spreadsheets rarely produce these in practice.

### What's Still Missing (from GRID.md spec)

**Frozen columns.** The CSS approach is documented (`position: sticky; left:
0; z-index: 1`) and the column definition supports `frozen: true`, but the
render pipeline doesn't apply sticky positioning. Implementation: in the
cell update loop, check `c.frozen` and set `td.style.position = 'sticky'`,
`td.style.left` to the cumulative width of preceding frozen columns, and
`td.style.zIndex = '1'`.

**CellCoords / CellRange model.** The spec defines proper `CellCoords` and
`CellRange` classes with `topLeft()`, `bottomRight()`, `includes()`,
`forEach()`. The current implementation uses raw integers (`activeRow`,
`activeCol`, `anchorRow`, `anchorCol`). This works for single ranges but
makes multi-range selection (Ctrl+click) impossible without refactoring.

**Variable row height.** The binary search approach is documented in the spec
(cumulative height cache + `rowTops[]` array) but only uniform height is
implemented. The viewport engine's O(1) arithmetic would become O(log n).

**Column reorder.** Drag header to rearrange columns.

**Undo/redo.** A stack of `{ row, col, oldValue, newValue }` entries with
Ctrl+Z / Ctrl+Shift+Z bindings.

### Selection Border

The blue rectangle around multi-cell selections uses `box-shadow` hacks
(inset shadows on individual border cells). This works but has visible
seaming at corners. The color `#3b82f6` is hardcoded — for a headless
widget this should use a CSS custom property like
`var(--grid-selection-color, #3b82f6)`. A cleaner approach overall: a
single absolutely-positioned `<div>` overlay sized to the selection bounds.

### Format Registry

The `formatMap` uses string keys like `"0,6"` (row 0 = all rows, column 6).
A cleaner approach: put `format` and `parse` directly on the column
definition object (which the spec already describes). The registry is still
useful for per-cell overrides but should be secondary to column-level
formatting.

### Performance Notes

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

## Bugs Found and Fixed (Code Review)

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

## Structural Issues (Need Design Decisions)

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
