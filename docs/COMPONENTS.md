<p><img src="rip.svg" alt="Rip Logo" width="100"></p>

# Rip Components

> **The Language IS the Framework**

Rip provides component syntax as **language-level constructs**, not library patterns. Components are built into the grammar itself.

---

## Quick Reference

| Keyword | Purpose |
|---------|---------|
| `component` | Define a component (like `class` but for UI) |
| `render` | Template block that describes the UI |
| `style` | Scoped styles block for component CSS |
| `effect` | Side effect block (see [REACTIVITY.md](REACTIVITY.md)) |

| Concept | Syntax | Purpose | When It Activates |
|---------|--------|---------|-------------------|
| **Constants** | `=!` | Readonly values | Never changes |
| **Props** | `@name` | Input from parent | Parent changes |
| **State** | `=` | Local mutable data | Manual assignment |
| **Derived** | `∞=` / `~=` | Computed values | Dependencies change |
| **Methods** | `:` `->` | Private actions | Called explicitly |
| **Exposed** | `:` `∞>` / `~>` | Public actions | Called by parent |
| **Lifecycle** | `mounted:` etc. | Setup/teardown | Component lifecycle |
| **Effects** | `effect` | Side effects | Dependencies change |

---

## Basic Component

```coffee
component HelloWorld
  render
    div "Hello, World!"
```

That's it. No imports, no boilerplate, no `export default`.

---

## Component Structure

```coffee
component Name
  # ═══════════════════════════════════════════
  # Constants (readonly)
  # ═══════════════════════════════════════════
  MAX_ITEMS =! 100

  # ═══════════════════════════════════════════
  # Props (from parent)
  # ═══════════════════════════════════════════
  @title                    # Required prop
  @subtitle?                # Optional prop (undefined if not provided)
  @count = 0                # Optional prop with default
  @onSelect                 # Callback prop
  @children                 # Nested content (slot)
  @...rest                  # Rest props (capture remaining)

  # ═══════════════════════════════════════════
  # State (local, reactive)
  # ═══════════════════════════════════════════
  expanded = false
  items = []
  searchTerm = ""

  # ═══════════════════════════════════════════
  # Derived (always equals)
  # ═══════════════════════════════════════════
  filtered ∞= items.filter (i) -> i.active
  total ∞= items.reduce ((sum, i) -> sum + i.price), 0
  isEmpty ∞= items.length is 0

  # ═══════════════════════════════════════════
  # Methods (private)
  # ═══════════════════════════════════════════
  add: (item) ->
    items = [...items, item]

  remove: (item) ->
    items = items.filter (i) -> i isnt item

  # ═══════════════════════════════════════════
  # Exposed Methods (parent can call)
  # ═══════════════════════════════════════════
  clear: ∞>
    items = []

  focus: ∞>
    inputEl.focus()

  # ═══════════════════════════════════════════
  # Lifecycle
  # ═══════════════════════════════════════════
  mounted: ->
    # After first render, DOM available
    saved = localStorage.getItem "items"
    items = JSON.parse saved if saved

  unmounted: ->
    # Cleanup before removal

  updated: ->
    # After any reactive update

  # ═══════════════════════════════════════════
  # Effects (side effects)
  # ═══════════════════════════════════════════
  effect ->
    # Runs when dependencies change
    localStorage.setItem "items", JSON.stringify items

  effect ->
    # Return function for cleanup
    interval = setInterval (-> tick()), 1000
    -> clearInterval interval

  # ═══════════════════════════════════════════
  # Render
  # ═══════════════════════════════════════════
  render
    div.container
      h1 @title
      p @subtitle if @subtitle
      # ... template

  # ═══════════════════════════════════════════
  # Styles (scoped)
  # ═══════════════════════════════════════════
  style
    .container
      padding $space-4
      background $surface
```

---

## Props System

### Declaration

```coffee
component Button
  # Required (error if not provided)
  @label

  # Optional (undefined if not provided)
  @icon?

  # Optional with default
  @variant = "default"
  @size = "md"
  @disabled = false

  # Callback prop
  @onClick

  # Children (nested content)
  @children

  # Rest props (capture all others)
  @...rest
```

### Usage

```coffee
# Parent component
render
  Button
    label: "Save"
    variant: "primary"
    onClick: handleSave

  Button label: "Cancel", variant: "ghost", onClick: handleCancel

  Button label: "Delete", variant: "danger"
    icon: "trash"                    # Named prop
    span "Are you sure?"             # Becomes @children
```

### Accessing Props

```coffee
component Card
  @title
  @subtitle?
  @children

  # Props accessed with @ prefix
  fullTitle ∞= "#{@title}: #{@subtitle}" if @subtitle

  render
    div.card
      h2 @title
      p @subtitle if @subtitle
      div.body
        @children              # Render nested content
```

### Prop Rules

| Rule | Description |
|------|-------------|
| **Readonly** | Props cannot be reassigned inside component |
| **Required** | `@prop` without default throws if not provided |
| **Optional** | `@prop?` is undefined if not provided |
| **Default** | `@prop = value` uses value if not provided |
| **Callback** | Functions passed as props, call with `@onClick()` |
| **Children** | `@children` receives unnamed nested content |
| **Rest** | `@...rest` captures all non-declared props |
| **Spread** | `...@rest` spreads captured props to element |

### Forwarding Props

```coffee
component FancyInput
  @label
  @error?
  @...inputProps

  render
    div.field
      label @label
      input ...@inputProps       # Spread all other props to input
      span.error @error if @error
```

---

## State

Regular assignments create reactive state:

```coffee
component Counter
  count = 0                    # Reactive
  name = "Counter"             # Reactive
  items = []                   # Reactive

  render
    div
      span count               # Updates when count changes
      button @click: -> count += 1, "+"
```

---

## Derived Values

Values that always equal an expression (see [REACTIVITY.md](REACTIVITY.md)):

```coffee
component Cart
  items = []
  taxRate = 0.08

  # These auto-update when dependencies change
  subtotal ∞= items.reduce ((sum, i) -> sum + i.price), 0
  tax ∞= subtotal * taxRate
  total ∞= subtotal + tax
  isEmpty ∞= items.length is 0

  render
    div
      p "Subtotal: $#{subtotal.toFixed(2)}"
      p "Tax: $#{tax.toFixed(2)}"
      p "Total: $#{total.toFixed(2)}"
```

**Rules:**
- Dependencies tracked automatically
- Computed lazily, cached until dependencies change
- Chain naturally: `total` depends on `tax` depends on `subtotal`

---

## Methods

### Private Methods

Regular methods are internal to the component:

```coffee
component Form
  validate: ->
    @value.length > 0

  handleSubmit: ->
    return unless validate()
    submit!()
```

### Exposed Methods

Use `∞>` to expose methods that parents can call via refs:

```coffee
component TextField
  value = ""
  inputEl = null

  focus: ∞>
    inputEl.focus()

  clear: ∞>
    value = ""

  render
    input ref: inputEl, value: value, @input: (e) -> value = e.target.value
```

**Parent usage:**

```coffee
component Form
  textFieldRef = null

  handleSubmit: ->
    console.log textFieldRef.value
    textFieldRef.clear()
    textFieldRef.focus()

  render
    form @submit.prevent: handleSubmit
      TextField ref: textFieldRef
      button "Submit"
```

---

## Lifecycle Hooks

```coffee
component DataView
  @url
  data = null
  error = null
  loading = true

  mounted: ->
    # Runs once after first render
    # DOM is available
    try
      data = fetch! @url
    catch e
      error = e.message
    finally
      loading = false

  unmounted: ->
    # Runs before component is removed
    # Cleanup subscriptions, timers, etc.

  updated: ->
    # Runs after any reactive update
    console.log "Component updated"

  render
    div
      if loading
        Spinner()
      else if error
        ErrorMessage message: error
      else
        DataDisplay data: data
```

| Hook | When | Use For |
|------|------|---------|
| `mounted:` | After first render | Initial fetch, DOM access, setup |
| `unmounted:` | Before removal | Cleanup timers, subscriptions |
| `updated:` | After reactive updates | Logging, analytics |

---

## Children / Slots

### Basic Children

```coffee
component Card
  @title
  @children

  render
    div.card
      h2 @title
      div.card-body
        @children              # Render children here

# Usage:
Card title: "My Card"
  p "This is the card content."
  p "It can have multiple elements."
```

### Named Slots

```coffee
component Layout
  @header?
  @footer?
  @children

  render
    div.layout
      header @header if @header
      main @children
      footer @footer if @footer

# Usage:
Layout
  header:
    h1 "My App"
    nav ...
  footer:
    p "© 2024"

  # Default content → @children
  p "Main content here"
```

---

## The `render` Block

The `render` block uses a clean, indentation-based template syntax:

```coffee
render
  div.container
    h1 "Welcome"
    p.intro "This is Rip."

    ul
      li "Item 1"
      li "Item 2"
      li "Item 3"

    button @click: handleClick, "Click me"
```

### Syntax Rules

- **Element:** Just the tag name (`div`, `span`, `button`)
- **Classes:** Dot notation (`div.container.active`)
- **IDs:** Hash notation (`div#main`)
- **Combined:** `section#hero.full-width.dark`
- **Text content:** String as child (`span "Hello"`)
- **Event handlers:** `@event: handler` (`button @click: onClick`)
- **Attributes:** `name: value` (`input type: "text", value: name`)
- **Interpolation:** `#{}` in strings (`span "Hello, #{name}"`)

See [TEMPLATES.md](TEMPLATES.md) for the complete template reference.

---

## The `style` Block

The `style` block defines scoped CSS for the component:

```coffee
component Card
  render
    div.card
      h2.title "Card Title"
      p.body "Card content goes here."

  style
    .card
      padding 1rem
      border-radius 8px
      box-shadow 0 2px 4px rgba(0, 0, 0, 0.1)

    .title
      font-size 1.25rem
      margin-bottom 0.5rem

    .body
      color #666
```

### Style Features

- **Scoped by default** — Styles only apply to this component
- **Clean syntax** — Colons and semicolons optional, indentation-based
- **CSS variables** — Use `$variable` for design tokens (`$primary` → `var(--primary)`)
- **Nesting** — Use `&` for parent reference

```coffee
style
  .btn
    background $color-primary
    padding $space-2 $space-4
    border-radius $radius-md

    &:hover
      background $color-primary-hover

    &.disabled
      opacity 0.5
```

### Global Styles

```coffee
# Scoped (default)
style
  .local
    color red

# Global (escapes scoping)
style global
  body
    margin 0
    font-family $font-sans
```

---

## Complete Example

```coffee
component TodoApp
  # Constants
  STORAGE_KEY =! "todos"

  # State
  todos = []
  newTodo = ""
  filter = "all"

  # Derived
  filtered ∞= switch filter
    when "active" then todos.filter (t) -> not t.done
    when "completed" then todos.filter (t) -> t.done
    else todos

  remaining ∞= todos.filter((t) -> not t.done).length
  allDone ∞= todos.length > 0 and remaining is 0

  # Methods
  add: ->
    return unless newTodo.trim()
    todos = [...todos, { id: Date.now(), text: newTodo.trim(), done: false }]
    newTodo = ""

  toggle: (todo) ->
    todo.done = not todo.done
    todos = [...todos]   # Trigger reactivity

  # Lifecycle
  mounted: ->
    saved = localStorage.getItem STORAGE_KEY
    todos = JSON.parse saved if saved

  # Effects
  effect ->
    localStorage.setItem STORAGE_KEY, JSON.stringify todos

  # Render
  render
    section.todoapp
      header.header
        h1 "todos"
        input.new-todo
          placeholder: "What needs to be done?"
          value: newTodo
          @input: (e) -> newTodo = e.target.value
          @keydown.enter: add

      section.main if todos.length
        ul.todo-list
          for todo in filtered, key: todo.id
            li class: { completed: todo.done }
              input.toggle type: "checkbox", checked: todo.done, @change: -> toggle todo
              label todo.text

      footer.footer if todos.length
        span.todo-count
          strong remaining
          " items left"

  # Styles
  style
    .todoapp
      max-width 550px
      margin 0 auto
      background $surface
      box-shadow $shadow-lg

    .new-todo
      width 100%
      padding $space-4
      font-size 1.5rem
      border none
      border-bottom 1px solid $border

    .todo-list
      list-style none
      padding 0

    li.completed label
      text-decoration line-through
      opacity 0.5
```

---

## Design Philosophy

1. **Components are language constructs** — Not classes you extend, not functions you call
2. **Templates are code** — The `render` block is Rip syntax, not a separate template language
3. **Styles are colocated** — CSS lives with the component, scoped automatically
4. **No ceremony** — No imports, exports, or registration needed
5. **Everything is reactive** — State, derived values, and effects just work

---

## Implementation Status

> **Implemented in Rip 2.0** — The component system is fully functional.

**Completed ✅:**
- [x] `component` keyword in grammar
- [x] `render` block parsing and codegen
- [x] Props system: `@prop`, `@prop?`, `@prop = default`, `@...rest`
- [x] Lifecycle hooks: `mounted:`, `unmounted:`
- [x] Reactive state: `count = 0` → `__signal(0)`
- [x] Derived values: `doubled ~= count * 2` → `__computed()`
- [x] Component composition: `Button label: "Click"` in render
- [x] Children/slots: `@children` prop with nested content
- [x] Reactive re-rendering via `__effect` in `mount()`

**Pending:**
- [ ] `style` block parsing with scoping
- [ ] Named slots (`@header`, `@footer`)
- [ ] Fine-grained DOM updates
- [ ] Error boundaries

See [REACTIVITY.md](REACTIVITY.md) for the reactive operators used within components.
See [TEMPLATES.md](TEMPLATES.md) for the template DSL reference.
