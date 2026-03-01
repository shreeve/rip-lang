# Widget Suite Audit

Living scorecard for all 38 headless widgets. Each component is evaluated
on compilation, ARIA correctness, keyboard navigation, gallery demo quality,
CSS styling, and memory cleanup.

**Scoring:** 1 = broken/missing, 2 = partial, 3 = adequate, 4 = good, 5 = excellent, N/A = not applicable

**Status:** PASS = fully verified, NEEDS WORK = issues found, UNTESTED = not yet verified

---

## Cross-Cutting Checks

These checks apply to EVERY component. The suite should feel like it was
written by one developer in one session — homogeneous, predictable, no
surprises.

### Consistency Standards

Every widget must follow these patterns. Deviations are bugs unless the
dynamics of the situation dictate otherwise (e.g., Grid is 901 lines and
has a different header format — that's acceptable).

- [x] **Header format:** `# Name — accessible headless description` on line 1
- [x] **"Ships zero CSS" line** in the header comment block
- [x] **Usage section** with `# Usage:` and a code example
- [x] **Props** use `@name :=` (reactive state), never bare assignment for props
- [x] **Internal state** uses `:=` (reactive) or `=` (plain) appropriately
- [x] **Constants** use `=!` (readonly) for IDs and fixed values
- [x] **Private methods** prefixed with `_` (e.g., `_position`, `_onKeydown`)
- [x] **Public methods** have no prefix (e.g., `close`, `toggle`, `selectIndex`)
- [x] **Auto-wired handlers** use `on*` naming only for root-element events
- [x] **Explicit bindings** use `_on*` naming to prevent double-fire from auto-wire
- [x] **Data attributes** use `$sigil` syntax (e.g., `$open`, `$disabled`, `$highlighted`)
- [x] **Events** emitted via `@emit 'name', detail`
- [x] **Hidden slot** pattern: `. ref: "_slot", style: "display:none"` + `slot` (for child-reading widgets)
- [x] **Conditional listbox** pattern: dropdown lists inside `if open` blocks (not always in DOM)
- [x] **Click-outside** uses `document.addEventListener 'mousedown'` in an effect with `return -> document.removeEventListener` cleanup
- [x] **No orphaned listeners** — every `document.addEventListener` has a matching `removeEventListener`
- [x] **Timer cleanup** — widgets with `setTimeout`/`setInterval` have `beforeUnmount` that clears them
- [x] **Observer cleanup** — widgets with `ResizeObserver`/`MutationObserver` disconnect in `beforeUnmount`

### Known Gotchas (verify each is NOT present)

- [x] **Prop-shadowing:** No local variable in a method shares a name with any
  `@prop` or `:=` state. Compiled JS checked for all 38 widgets — no unexpected
  `this.propName.value =` assignments found outside `_init`/constructor.
- [x] **Nested loop index collision:** Compiled output checked for all 38 widgets —
  no `function create_block_*(... , x, ... , x)` duplicate parameters found.
- [x] **`on*` double-fire:** Verified no widgets have both `on*` auto-wire and
  explicit `@event: @on*` binding on child elements. Explicit bindings use `_on*`.
- [x] **`value: @prop` on inputs:** No widgets use `value: @prop` on `<input>`
  elements. Two-way binding uses `<=>` or manual `@input` handlers.
- [x] **Lifecycle hook names:** All 38 widgets use correct lifecycle hooks
  (`mounted`, `beforeUnmount`). No `onMount` usage found.
- [x] **`ref:` is not reactive:** Widgets that need DOM refs after mount use the
  `_ready` pattern correctly.

### Gallery Consistency

- [x] Every widget has a `data-src` entry in `index.html`
- [x] Every widget has a demo section in the gallery with section title, line count badge, and description
- [x] Line count badges match actual file line counts (14 stale badges updated)
- [x] Demo sections show reactive status text where applicable (e.g., `"selected: #{value}"`)
- [x] CSS in `index.css` provides minimal styling — enough to validate the component works, not enough to impose a design

### Code Style

- [x] No commented-out code (grid.rip lines 19-20 are documentation examples, not dead code)
- [x] No `TODO` or `FIXME` left in widget source files
- [x] No `console.log` or `p` debug calls in widget source files
- [x] Consistent indentation (2 spaces throughout, no tabs)
- [x] Blank line between method definitions
- [x] Blank line between state declarations and first method

---

## Accordion (113 lines)

**Purpose:** Expand/collapse sections with keyboard navigation
**Props:** `@multiple`
**Events:** `change`
**Data attrs:** `$item`, `$trigger`, `$content`, `$open`, `$disabled`
**ARIA:** `role="region"`, `aria-expanded`, `aria-controls`, `aria-disabled`, `aria-labelledby`
**Keyboard:** Enter, Space, ArrowDown, ArrowUp, Home, End
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Autocomplete (141 lines)

**Purpose:** Suggestion input — type to filter, select to fill
**Props:** `@value`, `@items`, `@placeholder`, `@disabled`
**Events:** `select`
**Data attrs:** `$open`, `$disabled`, `$clear`
**ARIA:** `role="combobox"`, `aria-expanded`, `aria-haspopup`, `aria-autocomplete`, `aria-controls`, `aria-activedescendant`, `role="listbox"`, `role="option"`
**Keyboard:** ArrowDown, ArrowUp, Enter, Escape, Tab
**Click-outside:** Yes
**Cleanup:** Yes (effect return)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Click-outside | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## Avatar (37 lines)

**Purpose:** Image with fallback to initials or placeholder
**Props:** `@src`, `@alt`, `@fallback`
**Events:** None
**Data attrs:** `$status`, `$initials`, `$placeholder`
**ARIA:** `role="img"`, `aria-label`
**Keyboard:** None
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Button (23 lines)

**Purpose:** Accessible button with disabled-but-focusable pattern
**Props:** `@disabled`
**Events:** `press`
**Data attrs:** `$disabled`
**ARIA:** `aria-disabled`
**Keyboard:** None (native button)
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Checkbox (33 lines)

**Purpose:** Checkbox and switch toggle
**Props:** `@checked`, `@disabled`, `@indeterminate`, `@switch`
**Events:** `change`
**Data attrs:** `$checked`, `$indeterminate`, `$disabled`
**ARIA:** `role="checkbox"` or `role="switch"`, `aria-checked`, `aria-disabled`
**Keyboard:** None (auto-wired onClick handles Enter/Space via native button)
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## CheckboxGroup (65 lines)

**Purpose:** Multiple options checked independently
**Props:** `@value`, `@disabled`, `@orientation`, `@label`
**Events:** `change`
**Data attrs:** `$orientation`, `$disabled`, `$checked`, `$value`
**ARIA:** `role="group"`, `aria-label`, `aria-orientation`, `role="checkbox"`, `aria-checked`
**Keyboard:** ArrowDown, ArrowRight, ArrowUp, ArrowLeft
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Combobox (153 lines)

**Purpose:** Filterable input + listbox for search-as-you-type
**Props:** `@query`, `@items`, `@placeholder`, `@disabled`, `@autoHighlight`
**Events:** `filter`, `select`
**Data attrs:** `$open`, `$disabled`, `$clear`, `$value`, `$highlighted`, `$empty`
**ARIA:** `role="combobox"`, `aria-expanded`, `aria-haspopup`, `aria-autocomplete`, `aria-controls`, `aria-activedescendant`, `role="listbox"`, `role="option"`
**Keyboard:** ArrowDown, ArrowUp, Enter, Escape, Tab
**Click-outside:** Yes
**Cleanup:** Yes (effect return)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Click-outside | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## ContextMenu (98 lines)

**Purpose:** Right-click context menu with keyboard navigation
**Props:** `@disabled`
**Events:** `select`
**Data attrs:** `$open`, `$highlighted`, `$disabled`, `$value`
**ARIA:** `role="menu"`, `role="menuitem"`
**Keyboard:** ArrowDown, ArrowUp, Home, End, Enter, Space, Escape, Tab
**Click-outside:** Yes
**Cleanup:** Yes (effect return)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Click-outside | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## DatePicker (214 lines)

**Purpose:** Calendar dropdown for single date or range selection
**Props:** `@value`, `@placeholder`, `@disabled`, `@range`, `@firstDayOfWeek`
**Events:** `change`
**Data attrs:** `$open`, `$disabled`, `$range`, `$trigger`, `$calendar`, `$header`, `$prev`, `$next`, `$month-label`, `$weekdays`, `$weekday`, `$days`, `$outside`, `$today`, `$selected`, `$in-range`, `$range-start`
**ARIA:** `aria-haspopup`, `aria-expanded`, `role="dialog"`, `aria-label`, `role="grid"`, `role="gridcell"`
**Keyboard:** Escape, Enter, Space
**Click-outside:** Yes
**Cleanup:** Yes (effect return)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Click-outside | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## Dialog (107 lines)

**Purpose:** Modal dialog with focus trap and scroll lock
**Props:** `@open`, `@dismissable`, `@initialFocus`
**Events:** `close`
**Data attrs:** `$open`
**ARIA:** `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`
**Keyboard:** Escape, Tab (focus trap)
**Click-outside:** Yes (backdrop)
**Cleanup:** Yes (scroll lock restore, focus trap, effect return)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Click-outside | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## Drawer (79 lines)

**Purpose:** Slide-out panel with focus trap and scroll lock
**Props:** `@open`, `@side`, `@dismissable`
**Events:** `close`
**Data attrs:** `$open`, `$side`
**ARIA:** `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`
**Keyboard:** Escape, Tab (focus trap)
**Click-outside:** Yes (backdrop)
**Cleanup:** Yes (scroll lock restore, focus trap, effect return)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Click-outside | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## EditableValue (80 lines)

**Purpose:** Inline edit trigger with popover form
**Props:** `@disabled`
**Events:** `save`
**Data attrs:** `$editing`, `$disabled`, `$saving`, `$edit-trigger`
**ARIA:** `aria-label`
**Keyboard:** Escape (cancel), Enter (save)
**Click-outside:** Yes
**Cleanup:** Yes (effect return)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Click-outside | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## Field (53 lines)

**Purpose:** Form field wrapper with label, description, and error
**Props:** `@label`, `@description`, `@error`, `@disabled`, `@required`
**Events:** None
**Data attrs:** `$disabled`, `$invalid`, `$label`, `$required`, `$description`, `$error`
**ARIA:** `aria-labelledby`, `aria-describedby`, `aria-errormessage`, `aria-invalid`, `aria-required`, `role="alert"`
**Keyboard:** None
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Fieldset (22 lines)

**Purpose:** Grouped fields with legend and cascading disable
**Props:** `@legend`, `@disabled`
**Events:** None
**Data attrs:** `$disabled`, `$legend`
**ARIA:** Native `<fieldset>` and `<legend>`
**Keyboard:** None
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Form (39 lines)

**Purpose:** Form wrapper with submit handling and validation state
**Props:** `@disabled`
**Events:** `submit`
**Data attrs:** `$disabled`, `$submitting`, `$submitted`
**ARIA:** Native `<form>`
**Keyboard:** None
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Grid (901 lines)

**Purpose:** Google Sheets-grade data grid with virtual scrolling
**Props:** `@data`, `@columns`, `@rowHeight`, `@headerHeight`, `@overscan`, `@striped`, `@beforeEdit`, `@afterEdit`
**Events:** None (direct data mutation)
**Data attrs:** `$editing`, `$selecting`, `$sorted`
**ARIA:** `role="grid"`, `role="gridcell"`
**Keyboard:** Arrow keys, Home, End, Tab, Enter, F2, PageDown, PageUp, Escape, Space, Delete, Backspace, Ctrl+A/C/V/X, type-to-edit
**Click-outside:** No
**Cleanup:** Yes (ResizeObserver in beforeUnmount)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## Input (35 lines)

**Purpose:** Input wrapper tracking focus, validation, and disabled state
**Props:** `@value`, `@placeholder`, `@type`, `@disabled`, `@required`
**Events:** None
**Data attrs:** `$disabled`, `$focused`, `$touched`
**ARIA:** `aria-disabled`, `aria-required`
**Keyboard:** None (native input)
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Menu (162 lines)

**Purpose:** Dropdown menu with keyboard navigation and typeahead
**Props:** `@disabled`
**Events:** `select`
**Data attrs:** `$open`, `$disabled`, `$highlighted`, `$value`
**ARIA:** `aria-haspopup`, `aria-expanded`, `role="menu"`, `role="menuitem"`, `aria-checked`
**Keyboard:** ArrowDown, ArrowUp, Home, End, Enter, Space, Escape, Tab, typeahead
**Click-outside:** Yes
**Cleanup:** Yes (effect return)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Click-outside | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## Menubar (155 lines)

**Purpose:** Horizontal menu bar with dropdown menus
**Props:** `@disabled`
**Events:** `select`
**Data attrs:** `$disabled`, `$open`, `$highlighted`, `$value`
**ARIA:** `role="menubar"`, `aria-haspopup`, `aria-expanded`, `role="menu"`, `role="menuitem"`
**Keyboard:** ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Enter, Space, Escape, Tab
**Click-outside:** Yes
**Cleanup:** Yes (effect return)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Click-outside | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## Meter (36 lines)

**Purpose:** Gauge showing a value within a known range
**Props:** `@value`, `@min`, `@max`, `@low`, `@high`, `@optimum`, `@label`
**Events:** None
**Data attrs:** `$level`
**ARIA:** `role="meter"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
**Keyboard:** None
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## MultiSelect (158 lines)

**Purpose:** Multi-select with chips, filtering, and keyboard navigation
**Props:** `@value`, `@items`, `@placeholder`, `@disabled`
**Events:** `change`
**Data attrs:** `$open`, `$disabled`, `$chips`, `$chip`, `$remove`, `$clear`, `$value`, `$selected`, `$highlighted`
**ARIA:** `role="combobox"`, `aria-expanded`, `aria-haspopup`, `aria-controls`, `role="listbox"`, `aria-multiselectable`, `role="option"`, `aria-selected`
**Keyboard:** ArrowDown, ArrowUp, Enter, Escape, Backspace, Tab
**Click-outside:** Yes
**Cleanup:** Yes (effect return)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Click-outside | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## NavigationMenu (132 lines)

**Purpose:** Site navigation with hover/click dropdown panels
**Props:** `@orientation`, `@hoverDelay`, `@hoverCloseDelay`
**Events:** None
**Data attrs:** `$orientation`, `$open`, `data-nav-link`, `data-nav-trigger`, `data-nav-panel`
**ARIA:** `role="navigation"`, `aria-orientation`, `aria-expanded`
**Keyboard:** ArrowRight, ArrowLeft, ArrowDown, Escape
**Click-outside:** Yes
**Cleanup:** Yes (beforeUnmount clears timers, effect return)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Click-outside | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## NumberField (162 lines)

**Purpose:** Number input with stepper buttons and hold-to-repeat
**Props:** `@value`, `@min`, `@max`, `@step`, `@smallStep`, `@largeStep`, `@disabled`, `@readOnly`, `@name`
**Events:** `input`, `change`
**Data attrs:** `$disabled`, `$readonly`, `$decrement`, `$increment`
**ARIA:** `role="group"`, `aria-label`, `aria-controls`, `aria-roledescription`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-disabled`, `aria-readonly`
**Keyboard:** ArrowUp, ArrowDown, PageUp, PageDown, Home, End
**Click-outside:** No
**Cleanup:** Yes (beforeUnmount stops repeat timer)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## OTPField (89 lines)

**Purpose:** Multi-digit code input with auto-advance and paste support
**Props:** `@length`, `@value`, `@disabled`, `@mask`
**Events:** `input`, `complete`
**Data attrs:** `$disabled`, `$complete`, `$filled`
**ARIA:** `role="group"`, `aria-label`, `autocomplete="one-time-code"`
**Keyboard:** Backspace, ArrowLeft, ArrowRight, Home, End, paste
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Popover (143 lines)

**Purpose:** Floating popover with anchor positioning
**Props:** `@placement`, `@offset`, `@disabled`, `@openOnHover`, `@hoverDelay`, `@hoverCloseDelay`
**Events:** None
**Data attrs:** `$open`, `$placement`
**ARIA:** `aria-expanded`, `aria-haspopup`, `aria-labelledby`, `aria-describedby`
**Keyboard:** Escape, Enter, Space, ArrowDown
**Click-outside:** Yes
**Cleanup:** Yes (effect return)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Click-outside | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## PreviewCard (73 lines)

**Purpose:** Hover/focus preview card with delay
**Props:** `@delay`, `@closeDelay`
**Events:** None
**Data attrs:** `$open`
**ARIA:** None
**Keyboard:** None
**Click-outside:** No
**Cleanup:** Yes (beforeUnmount clears timers, effect return for floating listeners)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | N/A |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## Progress (25 lines)

**Purpose:** Progress bar with value and completion state
**Props:** `@value`, `@max`, `@label`
**Events:** None
**Data attrs:** `$complete`
**ARIA:** `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
**Keyboard:** None
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## RadioGroup (67 lines)

**Purpose:** Exactly one option selected with arrow key navigation
**Props:** `@value`, `@disabled`, `@orientation`, `@name`
**Events:** `change`
**Data attrs:** `$orientation`, `$disabled`, `$checked`, `$value`
**ARIA:** `role="radiogroup"`, `aria-orientation`, `role="radio"`, `aria-checked`
**Keyboard:** ArrowRight, ArrowDown, ArrowLeft, ArrowUp, Home, End
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## ScrollArea (145 lines)

**Purpose:** Custom scrollbar with drag and track click
**Props:** `@orientation`
**Events:** None
**Data attrs:** `$orientation`, `$hovering`, `$scrolling`, `$dragging`, `$viewport`, `$scrollbar`, `$thumb`
**ARIA:** None
**Keyboard:** None
**Click-outside:** No
**Cleanup:** Yes (ResizeObserver disconnect in beforeUnmount)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | N/A |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## Select (184 lines)

**Purpose:** Dropdown select with typeahead and keyboard navigation
**Props:** `@value`, `@placeholder`, `@disabled`
**Events:** `change`
**Data attrs:** `$open`, `$placeholder`, `$disabled`, `$value`, `$highlighted`, `$selected`
**ARIA:** `role="combobox"`, `aria-expanded`, `aria-haspopup`, `aria-controls`, `role="listbox"`, `role="option"`, `aria-selected`, `aria-disabled`
**Keyboard:** ArrowDown, ArrowUp, Enter, Space, Escape, Tab, Home, End, typeahead
**Click-outside:** Yes
**Cleanup:** Yes (effect return)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Click-outside | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## Separator (17 lines)

**Purpose:** Visual divider (decorative or semantic)
**Props:** `@orientation`, `@decorative`
**Events:** None
**Data attrs:** `$orientation`
**ARIA:** `role="none"` or `role="separator"`, `aria-orientation`
**Keyboard:** None
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Slider (165 lines)

**Purpose:** Range slider with single or multi-thumb
**Props:** `@value`, `@min`, `@max`, `@step`, `@largeStep`, `@orientation`, `@disabled`, `@name`, `@valueText`
**Events:** `input`, `change`
**Data attrs:** `$orientation`, `$disabled`, `$dragging`, `$track`, `$indicator`, `$thumb`, `$active`
**ARIA:** `role="group"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`, `aria-orientation`, `aria-disabled`
**Keyboard:** ArrowRight, ArrowUp, ArrowLeft, ArrowDown, PageUp, PageDown, Home, End
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Tabs (124 lines)

**Purpose:** Tabbed interface with roving tabindex
**Props:** `@active`, `@orientation`, `@activation`
**Events:** `change`
**Data attrs:** `$tab`, `$panel`, `$active`, `$disabled`
**ARIA:** `role="tablist"`, `aria-orientation`, `role="tab"`, `aria-selected`, `aria-controls`, `aria-disabled`, `role="tabpanel"`, `aria-labelledby`
**Keyboard:** ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Home, End, Enter, Space
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Toast (88 lines)

**Purpose:** Toast notification system with timer pause on hover
**Props:** `@toasts` (ToastViewport), `@toast` (Toast)
**Events:** `dismiss`
**Data attrs:** `$placement`, `$type`, `$leaving`
**ARIA:** `role="region"`, `aria-label`, `role="alert"` or `role="status"`, `aria-live`
**Keyboard:** None
**Click-outside:** No
**Cleanup:** Yes (beforeUnmount clears timer)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS

---

## Toggle (24 lines)

**Purpose:** Two-state toggle button
**Props:** `@pressed`, `@disabled`
**Events:** `change`
**Data attrs:** `$pressed`, `$disabled`
**ARIA:** `aria-pressed`, `aria-disabled`
**Keyboard:** None (native button handles Enter/Space)
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## ToggleGroup (78 lines)

**Purpose:** Single or multi-select toggle buttons
**Props:** `@value`, `@disabled`, `@multiple`, `@orientation`
**Events:** `change`
**Data attrs:** `$orientation`, `$disabled`, `$pressed`, `$value`
**ARIA:** `role="group"`, `aria-orientation`, `aria-pressed`
**Keyboard:** ArrowRight, ArrowDown, ArrowLeft, ArrowUp, Home, End
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Toolbar (46 lines)

**Purpose:** Groups controls with roving tabindex keyboard navigation
**Props:** `@orientation`, `@label`
**Events:** None
**Data attrs:** `$orientation`
**ARIA:** `role="toolbar"`, `aria-label`, `aria-orientation`
**Keyboard:** ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Home, End
**Click-outside:** No
**Cleanup:** No

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | 5/5 |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | N/A |

**Issues:** None
**Status:** PASS

---

## Tooltip (115 lines)

**Purpose:** Hover tooltip with delay, positioning, and delay groups
**Props:** `@text`, `@placement`, `@delay`, `@offset`, `@hoverable`
**Events:** None
**Data attrs:** `$open`, `$entering`, `$exiting`, `$placement`
**ARIA:** `aria-describedby`, `role="tooltip"`
**Keyboard:** None
**Click-outside:** No
**Cleanup:** Yes (beforeUnmount clears timers)

| Check | Score |
|-------|-------|
| Compiles | [x] |
| No prop-shadowing | [x] |
| ARIA correctness | 5/5 |
| Keyboard nav | N/A |
| Gallery demo | 5/5 |
| Gallery CSS | 5/5 |
| Memory cleanup | 5/5 |

**Issues:** None
**Status:** PASS
