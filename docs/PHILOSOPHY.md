# Rip Philosophy

**The Language IS the Framework**

---

## Vision

The modern web is drowning in complexity. Massive `node_modules`, Byzantine build configurations, and hook-laden component models have turned simple UI development into an exercise in tooling management.

**Rip is the antidote.**

Rip is a CoffeeScript-inspired language that compiles to modern JavaScript. But Rip goes further: **the language itself becomes the framework**. Reactivity isn't a library you import—it's syntax. Components aren't a pattern you follow—they're a language construct. Templates aren't strings or JSX—they're just Rip with indentation.

**The result:** A complete, reactive UI framework in **~50KB** that runs directly in the browser with **no build step**.

---

## The Rip Ecosystem

```
┌───────────────────────────────────────────────────────────────┐
│                         Rip Language                          │
│           "Elegant syntax → Modern JavaScript"                │
│        Reactivity, Components, Templates built-in             │
├───────────────────────────────────────────────────────────────┤
│  @rip/ui      │  @rip/api     │  @rip/server  │  @rip/schema  │
│  Components   │  API Toolkit  │  App Server   │  Database DSL │
└───────────────────────────────────────────────────────────────┘
```

| Package | Description | Status |
|---------|-------------|--------|
| **rip** | The language: reactivity, components, templates | ✅ Core |
| **@rip/ui** | Pre-built component library | 📐 Planned |
| **@rip/api** | API toolkit (Express-like) | 🔧 In Progress |
| **@rip/server** | Multi-process app server | 🔧 In Progress |
| **@rip/schema** | Database DSL (ActiveRecord-like) | 🔧 In Progress |
| **@rip/data** | DuckDB-based data platform | 🔧 In Progress |
| **@rip/parser** | SLR(1) parser generator | ✅ Working |

---

## Core Philosophy

### 1. The Language IS the Framework

Other frameworks bolt reactivity onto JavaScript:
- React: `useState`, `useMemo`, `useCallback`, `useEffect`
- Vue: `ref()`, `reactive()`, `computed()`, `watch()`
- Solid: `createSignal`, `createEffect`, `createMemo`

**Rip makes reactivity syntax:**
```coffee
count = 0              # State
doubled ∞= count * 2   # Reactive derived (always equals)
trigger: ->            # Side effect
  console.log count
```

### 2. No Build Step

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/rip/dist/rip.browser.min.js"></script>
</head>
<body>
  <script type="text/rip" src="/app.rip"></script>
  <app></app>
</body>
</html>
```

That's it. No webpack. No vite. No `npm install`. Just HTML and Rip.

### 3. Syntax Encodes Intent

Every operator communicates meaning:

| Operator | Reads As | Purpose |
|----------|----------|---------|
| `=` | equals | Mutable assignment |
| `=!` | equals, final | Readonly constant |
| `∞=` | always equals | Reactive derived value |
| `~=` | always equals (ASCII) | Reactive derived value |
| `->` | function | Private method |
| `∞>` | always visible | Exposed method (public) |
| `~>` | always visible (ASCII) | Exposed method (public) |
| `!` | dammit | Call + await |
| `!?` | otherwise | Undefined-only coalesce |
| `=~` | matches | Regex match |

### 4. ~50KB Complete Solution

| What You Get | Size |
|--------------|------|
| Rip compiler | ~43KB |
| UI runtime | ~4KB |
| **Total** | **~47KB** |

Compare to:
- React + ReactDOM: ~140KB
- Vue 3: ~34KB (but needs build for SFC)
- Svelte: ~2KB runtime (but **requires build**)

Rip: Full power, no build, one script tag.

---

## Operators Reference

### Assignment Operators

```coffee
# Standard assignment (mutable state)
count = 0
name = "World"
items = []

# Readonly constant (cannot reassign)
MAX_LENGTH =! 100
API_URL =! "/api/v1"

# Reactive derived (always equals)
doubled ∞= count * 2           # Primary syntax
doubled ~= count * 2           # ASCII equivalent

# Both ∞= and ~= are identical—use ∞= for elegance, ~= for ASCII environments
```

### Function Operators

```coffee
# Private method (internal to component)
validate: ->
  @value.length > 0

# Exposed method (parent can call via ref)
focus: ∞>                      # Primary syntax
  inputEl.focus()

focus: ~>                      # ASCII equivalent
  inputEl.focus()

# Thin arrow (unbound this)
handler = (e) -> console.log e

# Fat arrow (bound this)
handler = (e) => @process e
```

### Existing Rip Operators

```coffee
# Dammit operator (call + await)
data = fetchUser!              # → await fetchUser()
user = getUser!(id)            # → await getUser(id)

# Otherwise operator (undefined-only coalesce)
timeout = config.timeout !? 5000   # Only defaults if undefined
# null, false, 0 are valid values—not replaced

# Regex match
email =~ /(.+)@(.+)/          # Match with capture
username = _[1]               # Extract first group
domain = _[2]                 # Extract second group
```

---

## Component Model

### Basic Structure

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
  # Triggers (side effects)
  # ═══════════════════════════════════════════
  trigger: ->
    # Runs when dependencies change
    localStorage.setItem "items", JSON.stringify items

  trigger: ->
    # Multiple triggers allowed
    console.log "Item count: #{items.length}"

  trigger: ->
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

### Concept Summary

| Concept | Syntax | Purpose | Activates |
|---------|--------|---------|-----------|
| **Constants** | `=!` | Readonly values | Never changes |
| **Props** | `@name` | Input from parent | Parent changes |
| **State** | `=` | Local mutable data | Manual assignment |
| **Derived** | `∞=` / `~=` | Computed values | Dependencies change |
| **Methods** | `:` `->` | Private actions | Called explicitly |
| **Exposed** | `:` `∞>` / `~>` | Public actions | Called by parent |
| **Lifecycle** | `mounted:` etc. | Setup/teardown | Component lifecycle |
| **Triggers** | `trigger:` | Side effects | Dependencies change |

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

---

## Template Syntax

### Tags

```coffee
# Basic tags
div
span
button
input
MyComponent

# With classes (CSS selector syntax)
div.card
div.card.active
button.btn.btn-primary

# With ID
div#main
div#app.container

# Combined
section#hero.full-width.dark
```

### Attributes

```coffee
# Inline
input type: "text", placeholder: "Enter name", required: true

# Indented (for many attributes)
input
  type: "email"
  placeholder: "you@example.com"
  required: true
  autocomplete: "email"

# Dynamic
input value: searchTerm, disabled: isLoading
img src: user.avatar, alt: user.name
a href: "/users/#{user.id}"

# Boolean (true = present, false = absent)
button disabled: isLoading
input required: true, readonly: isLocked

# Dynamic classes (object syntax)
div class: { active: isActive, disabled: isDisabled }
li class: { completed: todo.done, editing: isEditing }
```

### Event Handlers

```coffee
# @ prefix for events
button @click: handleClick
button @click: -> count += 1
input @input: (e) -> value = e.target.value

# Event modifiers
form @submit.prevent: handleSubmit      # preventDefault()
a @click.prevent.stop: navigate         # prevent + stopPropagation
button @click.once: initialize          # Auto-removes after first call
input @keydown.enter: submit            # Key filter
input @keydown.escape: cancel
input @keydown.ctrl.s: save             # Modifier keys
```

### Conditionals

```coffee
# If/else blocks
div.status
  if loading
    span.spinner
    "Loading..."
  else if error
    span.error error.message
  else
    span.success "Loaded!"

# Inline conditional
span.badge "Admin" if user.isAdmin
span.warning "Unsaved" unless saved
```

### Loops

```coffee
# Array iteration with key
ul.todo-list
  for todo in todos, key: todo.id
    li class: { completed: todo.done }
      span todo.text
      button @click: -> remove(todo), "×"

# With index
ol
  for item, i in items, key: item.id
    li "#{i + 1}. #{item.name}"

# Object iteration
dl
  for key, value of user
    dt key
    dd value
```

---

## Scoped Styles

### Basic Syntax

```coffee
component Button
  @variant = "default"
  @children

  render
    button.btn class: [@variant]
      @children

  style
    .btn
      padding 0.5rem 1rem
      border none
      border-radius 4px
      cursor pointer
      font-weight 500
```

### Stylus-Like Syntax

Colons and semicolons are optional:

```coffee
style
  .card
    background white
    border-radius 8px
    padding $space-4

    &:hover
      box-shadow 0 4px 12px rgba(0,0,0,0.1)
```

### Variable Shorthand

`$name` compiles to `var(--name)`:

```coffee
style
  .btn
    background $color-primary       # → var(--color-primary)
    padding $space-2 $space-4       # → var(--space-2) var(--space-4)
    border-radius $radius-md        # → var(--radius-md)

    &:hover
      background $color-primary-hover
```

### Nesting

```coffee
style
  .card
    background $surface

    &:hover
      box-shadow $shadow-lg

    &.active
      border-color $color-primary

    .header
      padding $space-4
      font-weight 600

    .body
      padding $space-4
```

---

## Complete Example

```coffee
# app.rip — A complete Todo application

component TodoApp
  # ═══════════════════════════════════════════
  # Constants
  # ═══════════════════════════════════════════
  STORAGE_KEY =! "todos"

  # ═══════════════════════════════════════════
  # State
  # ═══════════════════════════════════════════
  todos = []
  newTodo = ""
  filter = "all"

  # ═══════════════════════════════════════════
  # Derived
  # ═══════════════════════════════════════════
  filtered ∞= switch filter
    when "active" then todos.filter (t) -> not t.done
    when "completed" then todos.filter (t) -> t.done
    else todos

  remaining ∞= todos.filter((t) -> not t.done).length
  allDone ∞= todos.length > 0 and remaining is 0
  hasCompleted ∞= todos.some (t) -> t.done

  # ═══════════════════════════════════════════
  # Methods
  # ═══════════════════════════════════════════
  add: ->
    return unless newTodo.trim()
    todos = [...todos, {
      id: Date.now()
      text: newTodo.trim()
      done: false
    }]
    newTodo = ""

  remove: (todo) ->
    todos = todos.filter (t) -> t isnt todo

  toggle: (todo) ->
    todo.done = not todo.done
    todos = [...todos]   # Trigger reactivity

  toggleAll: ->
    done = not allDone
    todos = todos.map (t) -> { ...t, done }

  clearCompleted: ->
    todos = todos.filter (t) -> not t.done

  # ═══════════════════════════════════════════
  # Lifecycle
  # ═══════════════════════════════════════════
  mounted: ->
    saved = localStorage.getItem STORAGE_KEY
    todos = JSON.parse saved if saved

  # ═══════════════════════════════════════════
  # Triggers
  # ═══════════════════════════════════════════
  trigger: ->
    localStorage.setItem STORAGE_KEY, JSON.stringify todos

  # ═══════════════════════════════════════════
  # Render
  # ═══════════════════════════════════════════
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
        input#toggle-all
          type: "checkbox"
          checked: allDone
          @change: toggleAll
        label for: "toggle-all", "Mark all as complete"

        ul.todo-list
          for todo in filtered, key: todo.id
            TodoItem
              todo: todo
              onToggle: -> toggle todo
              onRemove: -> remove todo

      footer.footer if todos.length
        span.todo-count
          strong remaining
          " #{remaining is 1 ? 'item' : 'items'} left"

        ul.filters
          for f in ["all", "active", "completed"], key: f
            li
              a
                href: "#/#{f}"
                class: { selected: filter is f }
                @click.prevent: -> filter = f
                f[0].toUpperCase() + f[1..]

        button.clear-completed @click: clearCompleted if hasCompleted
          "Clear completed"

  # ═══════════════════════════════════════════
  # Styles
  # ═══════════════════════════════════════════
  style
    .todoapp
      max-width 550px
      margin 0 auto
      background $surface
      box-shadow $shadow-lg
      border-radius $radius-lg

    .header h1
      font-size 4rem
      font-weight 100
      text-align center
      color $color-primary
      opacity 0.3

    .new-todo
      width 100%
      padding $space-4
      font-size 1.5rem
      border none
      border-bottom 1px solid $border

      &:focus
        outline none
        box-shadow inset 0 -2px 0 $color-primary

    .todo-list
      list-style none
      padding 0
      margin 0

    .filters
      display flex
      gap $space-2
      list-style none
      padding 0

      a
        padding $space-1 $space-2
        border-radius $radius-sm
        text-decoration none
        color $text-secondary

        &:hover
          color $text-primary

        &.selected
          border 1px solid $border
          color $text-primary


component TodoItem
  @todo
  @onToggle
  @onRemove

  editing = false
  editText = ""
  inputEl = null

  startEdit: ->
    editing = true
    editText = @todo.text

  saveEdit: ->
    text = editText.trim()
    if text
      @todo.text = text
    editing = false

  cancelEdit: ->
    editing = false

  # Focus input when editing starts
  trigger: ->
    inputEl.focus() if editing and inputEl

  render
    li class: { completed: @todo.done, editing }
      div.view if not editing
        input.toggle
          type: "checkbox"
          checked: @todo.done
          @change: @onToggle
        label @dblclick: startEdit
          @todo.text
        button.destroy @click: @onRemove

      input.edit if editing
        ref: inputEl
        value: editText
        @input: (e) -> editText = e.target.value
        @keydown.enter: saveEdit
        @keydown.escape: cancelEdit
        @blur: saveEdit

  style
    li
      position relative
      padding $space-4
      border-bottom 1px solid $border-light
      display flex
      align-items center
      gap $space-3

      &.completed label
        text-decoration line-through
        opacity 0.5

      &:hover .destroy
        opacity 1

    .toggle
      width 1.5rem
      height 1.5rem

    label
      flex 1
      cursor pointer

    .destroy
      opacity 0
      color $color-danger
      background none
      border none
      cursor pointer
      font-size 1.5rem
      transition opacity 0.2s

    .edit
      width 100%
      padding $space-2
      font-size inherit
      border 1px solid $color-primary
      border-radius $radius-sm
```

---

## HTML Integration

### Basic Setup

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Rip App</title>

  <!-- Design tokens (optional) -->
  <link rel="stylesheet" href="/css/tokens.css">

  <!-- Rip compiler + runtime -->
  <script src="https://unpkg.com/rip/dist/rip.browser.min.js"></script>
</head>
<body>
  <!-- App entry point -->
  <script type="text/rip" src="/app.rip"></script>

  <!-- Mount point -->
  <todo-app></todo-app>
</body>
</html>
```

### Design Tokens CSS

```css
/* /css/tokens.css */
:root {
  /* Colors */
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-danger: #ef4444;

  /* Surfaces */
  --surface: #ffffff;
  --surface-hover: #f9fafb;
  --border: #e5e7eb;
  --border-light: #f3f4f6;

  /* Text */
  --text-primary: #111827;
  --text-secondary: #6b7280;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;

  /* Radii */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

---

## Comparison to Other Frameworks

| Feature | Rip | React | Svelte | Solid | Vue |
|---------|-----|-------|--------|-------|-----|
| **Bundle size** | ~47KB | ~140KB | ~2KB* | ~7KB* | ~34KB* |
| **Build required** | No | Yes | Yes | Yes | Usually |
| **Reactivity** | Language-level | Library hooks | Compiler | Library signals | Library refs |
| **Syntax** | CoffeeScript-like | JSX | HTML + JS | JSX | Template + JS |
| **Templates** | Native (indented) | JSX | HTML | JSX | HTML strings |
| **Learning curve** | Rip syntax | Hooks | Svelte syntax | Signals | Options/Composition |

*Svelte, Solid, Vue sizes are runtime only—they require build tools.

### Why Rip?

**vs React:**
- No hook rules to memorize
- No build step
- Cleaner syntax (no JSX ceremony)
- Smaller bundle

**vs Svelte:**
- No build step (Svelte requires compilation)
- One language (not HTML + JS + CSS)
- Semantic operators (`∞=` vs `$:`)

**vs Solid:**
- No build step
- Cleaner syntax (no `createSignal` boilerplate)
- CoffeeScript elegance

**vs Vue:**
- No build step for full features
- Language-level reactivity (not library-level)
- More cohesive (not Options vs Composition debate)

---

## Implementation Roadmap

### Phase 1: Template Syntax
- [ ] Add indented markup parsing to Rip grammar
- [ ] `div.class#id attr: val` → DOM creation
- [ ] `@event:` handler → event binding
- [ ] `for`/`if` in template context

### Phase 2: Component System
- [ ] `component Name` keyword
- [ ] State detection (assignments → signals)
- [ ] Prop system (`@propName`)
- [ ] `@children` for nested content

### Phase 3: Reactivity
- [ ] `∞=` / `~=` destiny operator (derived values)
- [ ] Dependency tracking at compile time
- [ ] `trigger:` blocks for side effects
- [ ] Surgical DOM updates

### Phase 4: Advanced Features
- [ ] `∞>` / `~>` exposed methods
- [ ] `=!` readonly constants
- [ ] Scoped styles with `$variables`
- [ ] Lifecycle hooks

### Phase 5: Polish
- [ ] Error messages and debugging
- [ ] DevTools integration
- [ ] Documentation site
- [ ] Starter templates

---

## Grammar Additions

### New Keywords
- `component` — Component definition
- `render` — Template block
- `style` — Scoped styles block
- `trigger` — Side effect block

### New Operators
- `∞=` — Reactive derived assignment
- `~=` — Reactive derived assignment (ASCII)
- `∞>` — Exposed method arrow
- `~>` — Exposed method arrow (ASCII)
- `=!` — Readonly assignment

### Template Context
- Tags as identifiers: `div`, `span`, `MyComponent`
- Dot notation for classes: `div.card.active`
- Hash notation for IDs: `div#main`
- `@event:` prefix for handlers
- `ref:` for element references
- `key:` for list item keys

---

## Summary

**Rip** is not a framework you add to JavaScript—it's a language where reactivity, components, and templates are native constructs.

**One syntax. One file. One script tag.**

```coffee
component Hello
  name = "World"

  render
    div
      h1 "Hello, #{name}!"
      input
        value: name
        @input: (e) -> name = e.target.value

  style
    h1
      color $color-primary
```

```html
<script src="rip.browser.min.js"></script>
<script type="text/rip" src="app.rip"></script>
<hello></hello>
```

**That's it.**

---

*Rip: The language is the framework.*
