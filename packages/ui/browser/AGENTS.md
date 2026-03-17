# UI Widgets — Agent Guide

Accessible headless widgets written in Rip. They expose `$` attributes for styling and compile in the browser with no build step.

## Conventions

- use `ref: "_name"` for DOM refs; never `div._name`
- common ref names: `_trigger`, `_list`, `_content`
- use `_slot` with `style: "display:none"` to read child definitions
- auto-wired root handlers use `onKeydown`, `onScroll`, etc.
- child element handlers use underscore names like `_headerClick`
- public methods do not use `_`
- prefer `=!` for constants and `:=` only for state that should trigger updates
- click-outside should use document `mousedown` cleanup, not backdrop divs
- dropdowns use `position:fixed;visibility:hidden` first, then `_position()` via `requestAnimationFrame`
- keep `preventScroll: true` at module scope
- use reactive arrays directly: `toasts = [...toasts, { message: "Saved!" }]`
- prefix module-scope lowercase names to avoid shared-scope collisions

## Critical Gotchas

- do not shadow prop names with locals inside component methods; matching names rewrite to `this.name.value`
- always name indices in nested render loops
- avoid `value: @prop` on `<input>` when numeric parsing matters
- computed values are read-only; invalidate with a reactive counter
- use imperative DOM updates for 60fps tracking work like scroll, drag, and resize
- put side effects in `~>` branches, not only in methods like `close()`
- bare `x.y` in render blocks is tag syntax; use `= x.y` for text output
- bare variable names in template blocks are tag names, not text: `editName` creates `<editName>` element. Use `= editName` or `"#{editName}"` for text output

### Reactive Attribute Ownership

**The parent owns any attribute it sets on slot children.** If a parent template sets `hidden: true` on a slot child, the reconciler will re-apply `hidden = true` on every parent re-render. A component that imperatively sets `editor.hidden = false` in a `~>` effect will have that overwritten whenever the parent re-renders (e.g. when any reactive state in scope changes).

Rule: **a component that manages a DOM property imperatively must be the only one setting it.** Do not set `hidden`, `value`, `checked`, or any other imperatively-managed property on slot children in the parent template. The component's `~>` effect sets the initial state.

This is the same principle as React's "controlled vs. uncontrolled" — whoever sets a reactive binding on a render cycle owns it.

Practical example — correct:
```coffee
EditableValue
  span $display: true
    "#{editName}"
  div $editor: true    ← NO hidden: true here — EditableValue owns it
    input ...
```

### Components Emitting Their Own Root Element's Events

If a component's root element IS the event source (e.g. `<select>` firing 'change', `<input>` firing 'input'), calling `@emit 'change'` dispatches a `CustomEvent('change', { bubbles: true })` on that same element — which re-triggers the listener in an infinite loop.

Guard with `e.isTrusted or return` at the start of the handler. `e.isTrusted` is `false` for synthetic `CustomEvent` dispatches, `true` for real user interactions:
```coffee
onChange: (e) ->
  e.isTrusted or return   # prevent infinite loop when @emit re-triggers handler
  @value = e.target.value
  @emit 'change', @value
```

### onFocusout and relatedTarget

In some browsers, `e.relatedTarget` is `null` even when focus moves to a `tabindex="-1"` element (e.g., an option div being clicked). Checking `e.relatedTarget` directly will incorrectly close the popup before the click fires.

Use `setTimeout 0` and `document.activeElement` instead:
```coffee
onFocusout: ->
  setTimeout => @close() unless @_content?.contains(document.activeElement), 0
```

### Always Track Reactive Dependencies Before Early Returns

In a `~>` effect that has an early return guard, reactive signals read AFTER the guard are not tracked on runs that short-circuit. Always read all signals you need to track before any `return unless`:
```coffee
~>
  _editing = editing          # track BEFORE early return
  display = @_root?.querySelector('[data-display]')
  editor  = @_root?.querySelector('[data-editor]')
  return unless display and editor
  editor.hidden = not _editing
```

### Event Handler Parameter Syntax

Inline event handlers with explicit parameters are unreliable in template attribute contexts. Both `(e) =>` (causes parse error) and `(e) ->` (causes parse error in conditional blocks) can break compilation of the entire component, causing "WidgetGallery is not defined" or similar errors.

**The safe approach: use a named method reference.**

```coffee
# WRONG — (e => ...) parses as calling e as a function
@click: (e => e.stopPropagation())

# WRONG — (e) => causes parse error in template attribute contexts
@click: (e) => e.stopPropagation()

# WRONG — (e) -> also causes parse error in some template contexts
@click: (e) -> e.stopPropagation()

# CORRECT — define a named method, reference it in the template
_stopProp: (e) -> e.stopPropagation()
# then in render:
  .modal @click: @_stopProp
```

Method references (`@methodName`) always compile correctly in template attributes and receive the event as their first argument.

## ARIA Keyboard and Popup Helpers

`ARIA.listNav`, `ARIA.rovingNav`, and `ARIA.popupDismiss` are built into `rip.min.js` (defined in `src/ui.rip`) and available globally in any component without imports.

### ARIA.listNav — popup list keyboard navigation

For Select, Menu, Combobox, Autocomplete, and similar popup lists:

```coffee
onListKeydown: (e) ->
  ARIA.listNav e,
    next:    => ...  # ArrowDown
    prev:    => ...  # ArrowUp
    first:   => ...  # Home, PageUp
    last:    => ...  # End, PageDown
    select:  => ...  # Enter, Space
    dismiss: => ...  # Escape
    tab:     => ...  # Tab (no preventDefault — focus moves naturally)
    char:    => ...  # printable key (typeahead)
```

### ARIA.rovingNav — inline composite keyboard navigation

For RadioGroup, Tabs, Toolbar, CheckboxGroup, ToggleGroup, Accordion:

```coffee
onKeydown: (e) ->
  ARIA.rovingNav e, {
    next:  => ...   # ArrowDown (vertical) / ArrowRight (horizontal) / both
    prev:  => ...
    first: => ...   # Home, PageUp
    last:  => ...   # End, PageDown
    select: => ...  # Enter, Space (optional)
  }, @orientation   # 'vertical' | 'horizontal' | 'both'
```

### ARIA.popupDismiss — close on outside click or page scroll

For any popup component. Pass lazy getters `(=> @_list)` — NOT the current value `@_list` — because the `~>` effect may run before the render creates the element:

```coffee
~> ARIA.popupDismiss open, (=> @_list), (=> @close()), [=> @_trigger]

# With scroll repositioning instead of closing (preferred for fixed dropdowns):
~> ARIA.popupDismiss open, (=> @_list), (=> @close()), [=> @_trigger], (=> @_position())
```

**Lazy getters are required**: if you pass `@_list` directly (not as `=> @_list`), the value is captured at the moment the `~>` effect fires — which may be before the render creates the listbox element, capturing `null`. Then `null?.contains(option)` returns `undefined` → `close()` fires on every mousedown, making options unclickable.

### Both nav handlers also:
- Guard against IME composition (`e.isComposing`) — safe for CJK input methods
- Call `e.preventDefault()` + `e.stopPropagation()` for handled keys
- Alias `PageUp/PageDown` to `first/last` (handles macOS `fn+Up/Down`)

## Lifecycle and Component Model

- recognized lifecycle hooks: `beforeMount`, `mounted`, `updated`, `beforeUnmount`, `unmounted`, `onError`
- `onMount` is not a lifecycle hook
- inside components, `->` is rewritten to `=>`
- `ref:` sets a plain property, not a reactive signal
- use the `_ready := false` pattern for effects that need refs after mount
- `offer` and `accept` only become keywords inside components
- use `$open`, `$selected`, etc. for data attributes
- bare `slot` projects `this.children`; it does not create Shadow DOM
- `@event:` on child components binds listeners to the child root element
- every component has `emit(name, detail)` which dispatches a bubbling `CustomEvent`
- `_root` must be set on child components for `emit()` to work

## Integration

Add widget bundles through the serve middleware:

```coffee
use serve
  dir: dir
  bundle:
    ui: ['../../../packages/ui/browser/components']
    app: ['routes', 'components']
```

Then load with `data-src="ui app"`. Widgets become available by name in the shared scope.

## Grid Highlights

- DOM recycling with pooled rows and `textContent` updates
- Sheets-style selection model
- full keyboard support
- TSV clipboard support
- multi-column sorting
- column resizing
- inline editing

## Widget Gallery Dev Server

The gallery uses `data-src` mode and a minimal `index.rip` dev server:

```coffee
import { get, use, start, notFound } from '@rip-lang/server'
import { serve } from '@rip-lang/server/middleware'

dir = import.meta.dir
use serve dir: dir, bundle: ['components'], watch: true
get '/*.rip', -> @send "#{dir}/#{@req.path.slice(1)}", 'text/plain; charset=UTF-8'
notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'
start port: 3005
```

Hot reload uses the built-in `/watch` SSE endpoint. Do not implement custom watcher or SSE logic in the worker. Use `notFound`, not `get '/*'`, for the catch-all route or you will intercept serve-middleware assets like `/rip/rip.min.js`.
