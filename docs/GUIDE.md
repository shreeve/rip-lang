<p><img src="rip.svg" alt="Rip Logo" width="100"></p>

# Rip Language Guide

> **The Language IS the Framework**

This comprehensive guide covers Rip's reactive primitives, template syntax, component model, and special operators. Rip provides these features as **language-level constructs**, not library imports—reactivity and UI are built into the syntax itself.

---

## Table of Contents

1. [Reactivity](#1-reactivity)
2. [Templates](#2-templates)
3. [Components](#3-components)
4. [Special Operators](#4-special-operators)
5. [Regex+ Features](#5-regex-features)

---

# 1. Reactivity

Rip provides reactive primitives as **language-level operators**, not library imports.

## Reactive Operators

| Operator | Name | Purpose |
|----------|------|---------|
| `:=` | Signal | Reactive state variable |
| `~=` | Derived | Computed value (auto-updates when dependencies change) |
| `effect` | Effect | Side effect that runs when dependencies change |
| `=!` | Equal, dammit! | Constant (`const`) - not reactive, just immutable |

## Reactive State (`:=`)

The signal operator creates reactive state:

```coffee
count := 0              # Reactive signal
name := "world"         # Another reactive signal
```

State changes automatically trigger updates in any derived values or effects that depend on them.

## Derived Values (`~=`)

The "always equals" operator creates a value that automatically recomputes when its dependencies change:

```coffee
count := 0
doubled ~= count * 2    # Always equals count * 2

count = 5               # doubled automatically becomes 10
count = 10              # doubled automatically becomes 20
```

## Constant Values (`=!`) - "Equal, Dammit!"

In Rip, regular assignment (`=`) compiles to `let` for maximum flexibility. When you want an immutable constant, use the "equal, dammit!" operator (`=!`), which compiles to `const`:

```coffee
# Regular assignment → let (can reassign)
host = "localhost"
host = "example.com"    # OK - variables are flexible by default

# Equal, dammit! → const (can't reassign)
API_URL =! "https://api.example.com"
MAX_RETRIES =! 3

API_URL = "other"       # Error! const cannot be reassigned
```

This gives you opt-in immutability when you need it, while keeping the default flexible for scripting.

## Side Effects (`effect`)

The `effect` keyword defines a side effect block that runs when its dependencies change:

```coffee
count := 0

effect -> console.log "Count changed to:", count

count = 5    # Logs: "Count changed to: 5"
count = 10   # Logs: "Count changed to: 10"
```

Effects are useful for:
- Logging and debugging
- Syncing with external systems
- Analytics tracking
- Local storage persistence

## Auto-Unwrapping

Reactive variables automatically unwrap in most contexts:

```coffee
count := 10

# All of these work automatically:
doubled ~= count * 2     # Arithmetic
message = "Count: #{count}"  # String interpolation
console.log count        # Function arguments

# Explicit access when needed:
count.read()             # Get value without tracking dependencies
+count                   # Unary plus (same as count.value)
```

## Reactive Variable Methods

| Method | Purpose |
|--------|---------|
| `x.read()` | Get value without tracking (for effects that shouldn't re-run) |
| `x.value` | Direct access to the underlying value |
| `+x` | Shorthand for `x.value` (triggers tracking in effects) |
| `x.lock()` | Make value readonly (can read but can't change) |
| `x.free()` | Unsubscribe from all dependencies (signal still works) |
| `x.kill()` | Clean up everything and return final value |

## Dependency Tracking

Understanding when dependencies are tracked is key to effective reactive programming.

### What Tracks Dependencies?

| Expression | Tracks? | Why |
|------------|---------|-----|
| `count * 2` | ✅ Yes | Arithmetic triggers `.valueOf()` |
| `"Count: #{count}"` | ✅ Yes | Interpolation triggers `.toString()` |
| `console.log count` | ✅ Yes | Coercion triggers `.valueOf()` |
| `+count` | ✅ Yes | Unary plus triggers `.valueOf()` |
| `count.value` | ✅ Yes | Direct `.value` access |
| `count.read()` | ❌ No | Explicit non-tracking read |
| `y = count` | ❌ No | Assigns signal object, not value |

### Example: Tracking vs Non-Tracking

```coffee
count := 10

# Effect A: Subscribes to count (will re-run when count changes)
effect -> console.log "A: #{count}"

# Effect B: Does NOT subscribe (won't re-run)
effect -> console.log "B: #{count.read()}"

count = 20
# Output:
#   A: 20    ← Effect A re-ran
#            ← Effect B did NOT re-run
```

### When to Use `.read()`

Use `.read()` when you need the current value but don't want to create a dependency:

```coffee
count := 0
lastSaved := 0

effect ->
  # We want to log count changes, but compare against lastSaved
  # without re-running when lastSaved changes
  if count != lastSaved.read()
    console.log "Unsaved changes: #{count}"
```

## Lifecycle & Cleanup

### Locking a Signal

Make a signal readonly (subscriptions stay active):

```coffee
config := { theme: "dark" }
config.lock()

config = { theme: "light" }  # Silently ignored
config.theme                  # Still "dark"
```

### Freeing Subscriptions

Unsubscribe a computed/effect from its dependencies:

```coffee
count := 0
doubled ~= count * 2

doubled.free()  # No longer updates when count changes
count = 10      # doubled stays at its last value
```

### Killing a Signal

Clean up completely and get the final value:

```coffee
count := 10
finalValue = count.kill()  # Returns 10, signal is now dead

count = 20  # Error or no-op (signal is dead)
```

### Effect Cleanup

Effects can return a cleanup function:

```coffee
effect ->
  interval = setInterval (-> tick()), 1000
  -> clearInterval interval  # Cleanup when effect re-runs or disposes
```

## Real-World Example

A complete reactive counter with persistence:

```coffee
# Reactive state
count := parseInt(localStorage.getItem("count")) or 0

# Derived values
doubled ~= count * 2
isEven ~= count % 2 == 0
message ~= "Count is #{count} (#{isEven ? 'even' : 'odd'})"

# Side effect: persist to localStorage
effect ->
  localStorage.setItem "count", count

# Side effect: log changes
effect ->
  console.log message

# Usage
count = 5
# Console: "Count is 5 (odd)"
# localStorage: "5"

count = 10
# Console: "Count is 10 (even)"
# localStorage: "10"
```

## How It Works

The Rip compiler transforms reactive operators into efficient JavaScript:

```coffee
# Rip source
count := 0
doubled ~= count * 2
effect -> console.log doubled
```

```javascript
// Compiled output (conceptual)
const count = __signal(0);
const doubled = __computed(() => count.value * 2);
__effect(() => console.log(doubled.value));
```

The runtime is **automatically inlined** - no external dependencies required.

## Zero Overhead for Non-Reactive Code

If your code doesn't use reactive features, no runtime is injected:

```coffee
# Non-reactive code
x = 10
y = x * 2
console.log y
```

```javascript
// Clean output - no reactive runtime
let x, y;
x = 10;
y = x * 2;
console.log(y);
```

## Comparison with Other Frameworks

| Concept | React | Vue | Solid | Rip |
|---------|-------|-----|-------|-----|
| State | `useState()` | `ref()` | `createSignal()` | `x := 0` |
| Derived | `useMemo()` | `computed()` | `createMemo()` | `x ~= y * 2` |
| Effect | `useEffect()` | `watch()` | `createEffect()` | `effect ->` |
| Constant | `const` | `const` | `const` | `x =! 0` |

Rip's approach: **No imports, no hooks, no special functions. Just operators.**

---

# 2. Templates

Rip's template syntax is not a separate language—it's native Rip syntax. The `render` block uses indentation-based markup that compiles directly to efficient DOM operations.

## Quick Reference

| Syntax | Purpose | Example |
|--------|---------|---------|
| `tag` | Element | `div`, `span`, `button` |
| `.class` | CSS class | `div.card`, `button.btn.primary` |
| `#id` | Element ID | `div#main`, `section#hero` |
| `.()` | Dynamic classes | `div.('active', isOn && 'on')` |
| `attr: val` | Attribute | `type: "text"`, `disabled: true` |
| `@event: fn` | Event handler | `@click: handleClick` |
| `@event.mod:` | Event modifier | `@click.prevent: submit` |
| `"text"` | Text content | `span "Hello"` |
| `#{expr}` | Interpolation | `"Count: #{count}"` |
| `ref: var` | Element reference | `ref: inputEl` |
| `key: val` | List item key | `key: item.id` |
| `...props` | Spread attributes | `div ...props` |
| `X <=> var` | Two-way binding | `value <=> name` |
| `if`/`else` | Conditional | `div if visible` |
| `for...in` | Iteration | `for item in items` |

## Tags

### Basic Tags

```coffee
render
  div
  span
  button
  input
  MyComponent
```

### With Classes (CSS Selector Syntax)

```coffee
div.card
div.card.active
button.btn.btn-primary
span.badge.badge-success
```

### With IDs

```coffee
div#main
section#hero
input#search-field
```

### Combined

```coffee
section#hero.full-width.dark
div#sidebar.panel.collapsed
article#post-123.blog-post.featured
```

## Attributes

### Inline

```coffee
input type: "text", placeholder: "Enter name", required: true
a href: "/home", target: "_blank", "Go Home"
img src: user.avatar, alt: user.name
```

### Indented (for many attributes)

```coffee
input
  type: "email"
  placeholder: "you@example.com"
  required: true
  autocomplete: "email"
  @input: handleInput
```

### Dynamic Values

```coffee
input value: searchTerm, disabled: isLoading
img src: user.avatar, alt: user.name
a href: "/users/#{user.id}", "View Profile"
div title: tooltip, data-id: item.id
```

### Boolean Attributes

Boolean attributes are present when `true`, absent when `false`:

```coffee
button disabled: isLoading          # <button disabled> or <button>
input required: true, readonly: isLocked
option selected: isDefault
details open: expanded
```

### Dynamic Classes with `cx()` (clsx-compatible)

Rip includes a `clsx`-compatible `cx()` helper for dynamic class composition. Use the `.()` syntax on elements:

```coffee
# Basic: conditions in parens
div.('card', isActive && 'active', size)

# With static classes too
div.card.('highlighted', isNew && 'new')

# Object syntax (like clsx)
div.({ active: isActive, disabled: isDisabled })

# Mixed - strings, conditions, objects
div.base.('extra', { selected: isSelected })
```

### Spreading Props

Spread an object as attributes:

```coffee
render
  # Basic spread
  div ...props

  # With static classes
  div.card ...props

  # With explicit attrs (override spreads)
  input ...inputProps, class: "extra", disabled: true

  # With children
  div.wrapper ...containerProps
    span "Content"
```

## Two-Way Binding

Two-way binding automatically syncs an element's value with a variable using the `<=>` operator:

```coffee
render
  # Text input - value syncs with username
  input value <=> username

  # Checkbox - checked syncs with isActive
  input type: "checkbox", checked <=> isActive

  # Select dropdown
  select value <=> selectedId

  # Textarea
  textarea value <=> content
```

The `<=>` operator reads as "syncs with" — it's a visual representation of bidirectional data flow.

**Smart event selection:**
- `value` on `input`/`textarea` → `oninput` event
- `value` on `select` → `onchange` event
- `checked` → `onchange` event

**Smart value access:**
- `type="number"` inputs → `e.target.valueAsNumber`
- `type="range"` inputs → `e.target.valueAsNumber`
- All other inputs → `e.target.value`

## Event Handlers

### Basic Events

```coffee
button @click: handleClick
button @click: -> count += 1
input @input: (e) -> value = e.target.value
form @submit: handleSubmit
```

### Event Handler Patterns

There are two common patterns for event handlers:

```coffee
# Normal: define methods, reference with @
inc: -> count += 1
button @click: @inc, "+"

# Compact: inline with fat arrow (parens required)
button (@click: => @count++), "+"
```

The fat arrow (`=>`) binds `this` correctly for inline handlers.

### Event Modifiers

```coffee
# Prevent default
form @submit.prevent: handleSubmit
a @click.prevent: navigate

# Stop propagation
button @click.stop: handleClick

# Combined
a @click.prevent.stop: handleNavigation

# Once (auto-removes after first call)
button @click.once: initialize

# Self (only if target is the element itself)
div @click.self: handleDivClick
```

### Key Modifiers

```coffee
input @keydown.enter: submit
input @keydown.escape: cancel
input @keydown.tab: handleTab
input @keydown.space: togglePlay
input @keydown.up: previousItem
input @keydown.down: nextItem
```

### Modifier Key Combinations

```coffee
input @keydown.ctrl.s: save
input @keydown.cmd.s: save           # Mac Command key
input @keydown.shift.enter: newLine
input @keydown.ctrl.shift.z: redo
button @click.ctrl: openInNewTab
```

## Text Content

### As Final Argument

```coffee
button "Click me"
span "Hello, #{name}!"
h1 "Welcome"
p "This is a paragraph of text."
```

### Variables as Text

```coffee
span count
span user.name
span formatCurrency(total)
td item.quantity
```

### Mixed Content

```coffee
p
  "Hello, "
  strong name
  "! Welcome back."

span
  "Total: "
  strong formatCurrency(total)
```

## Children & Nesting

Rip uses implicit nesting based on indentation:

```coffee
div.card
  header.card-header
    h2.title "Product"
    span.badge "New"

  div.card-body
    p description

    ul.features
      li "Feature one"
      li "Feature two"
      li "Feature three"

  footer.card-footer
    button.secondary "Cancel"
    button.primary "Buy Now"
```

You can also use explicit arrow syntax for inline nesting:

```coffee
div.card -> h1 "Title"
```

## Conditionals

### If/Else Blocks

```coffee
div.status
  if loading
    span.spinner
    "Loading..."
  else if error
    span.error error.message
  else
    span.success "Loaded!"
```

### Inline Conditionals

```coffee
span.badge "Admin" if user.isAdmin
span.warning "Unsaved" unless saved
div.alert error if error
```

### Ternary Expressions

```coffee
span class: { active: isActive }
  isActive ? "On" : "Off"

button class: { primary: isPrimary }
  isPrimary ? "Save" : "Continue"
```

## Loops

### Array Iteration with Key

**Always provide a `key` for list items** to enable efficient updates:

```coffee
ul.todo-list
  for todo in todos, key: todo.id
    li class: { completed: todo.done }
      span todo.text
      button @click: -> remove(todo), "×"
```

### With Index

```coffee
ol
  for item, i in items, key: item.id
    li "#{i + 1}. #{item.name}"

table
  for row, rowIndex in rows, key: row.id
    tr class: { even: rowIndex % 2 is 0 }
      for cell, colIndex in row.cells, key: colIndex
        td cell
```

### Object Iteration

```coffee
dl
  for key, value of user
    dt key
    dd value

div.metadata
  for prop, val of item.meta
    span.tag "#{prop}: #{val}"
```

### Ranges

```coffee
# Numeric range
ul
  for i in [1..5]
    li "Item #{i}"

# Dynamic range
ul
  for page in [1..totalPages], key: page
    button @click: -> goToPage(page), page
```

## Refs

Element references for direct DOM access:

```coffee
component SearchBox
  inputEl = null

  mounted: ->
    inputEl.focus()

  clear: ->
    inputEl.value = ""
    inputEl.focus()

  render
    div.search
      input ref: inputEl, type: "text", @input: handleInput
      button @click: clear, "Clear"
```

## SVG Support

```coffee
svg viewBox: "0 0 24 24", width: 24, height: 24
  path d: "M12 2L2 7l10 5 10-5-10-5z"
  path d: "M2 17l10 5 10-5"

# With dynamic values
svg.icon class: { active: isActive }
  circle cx: 12, cy: 12, r: radius
  line x1: 0, y1: 0, x2: 24, y2: 24, stroke: color
```

## Fragment (Multiple Root Elements)

When you need multiple root elements without a wrapper:

```coffee
render
  <>
    Header
    main
      @children
    Footer
```

---

# 3. Components

Rip provides component syntax as **language-level constructs**, not library patterns.

## Basic Component

```coffee
component HelloWorld
  render
    div "Hello, World!"
```

That's it. No imports, no boilerplate, no `export default`.

### Creating & Mounting

```coffee
# Ruby-style constructor (Rip enhancement)
app = HelloWorld.new()
app.mount "#app"

# Or chain it
HelloWorld.new().mount "#app"

# Traditional JS style also works
app = new HelloWorld()
app.mount "#app"

# With props
Counter.new(label: "Score", initial: 10).mount "#counter"
```

The `mount` method accepts either an element or a CSS selector string.

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
  filtered ~= items.filter (i) -> i.active
  total ~= items.reduce ((sum, i) -> sum + i.price), 0
  isEmpty ~= items.length is 0

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
```

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

## Context API

Pass data down through component trees without prop drilling.

```coffee
component App
  # Set context in constructor (runs during component init)
  mounted: ->
    setContext "theme", { dark: true, primary: "#3b82f6" }

  render
    div
      Header()
      Content()
      Footer()

component Header
  # Get context from any ancestor
  theme = getContext "theme"

  render
    header.("bg-blue-500" if theme?.dark)
      h1 "My App"

component DeepNestedChild
  # Works at any depth!
  theme = getContext "theme"

  render
    div style: "color: #{theme?.primary}"
      "Themed content"
```

**API:**

| Function | Description |
|----------|-------------|
| `setContext(key, value)` | Set a context value in current component |
| `getContext(key)` | Get context from nearest ancestor (or undefined) |
| `hasContext(key)` | Check if context exists in any ancestor |

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
  filtered ~= switch filter
    when "active" then todos.filter (t) -> not t.done
    when "completed" then todos.filter (t) -> t.done
    else todos

  remaining ~= todos.filter((t) -> not t.done).length
  allDone ~= todos.length > 0 and remaining is 0

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
```

---

# 4. Special Operators

## Dammit Operator (`!`)

The **dammit operator (`!`)** is a trailing suffix that does TWO things:
1. **Calls the function** (even without parentheses)
2. **Awaits the result** (prepends `await`)

### Quick Examples

```coffee
# Simple call and await
result = fetchData!      # → await fetchData()

# With arguments
user = getUser!(id)      # → await getUser(id)

# Method calls
data = api.get!          # → await api.get()

# In expressions
total = 5 + getValue!    # → 5 + await getValue()
```

### Basic Usage

```coffee
# WITHOUT dammit - reference only
fn = loadConfig
typeof fn  # → 'function'

# WITH dammit - calls immediately
config = loadConfig!  # → await loadConfig()
```

### Comparison: Before & After

**Before (Explicit Await):**
```coffee
user = await db.findUser(id)
posts = await db.getPosts(user.id)
comments = await db.getComments(posts[0].id)
result = await buildResponse(comments)
```

**After (Dammit Operator):**
```coffee
user = db.findUser!(id)
posts = db.getPosts!(user.id)
comments = db.getComments!(posts[0].id)
result = buildResponse!(comments)
```

**Benefit:** ~50% shorter, same clarity, **zero performance traps**

### Usage Guidelines

**✅ When to Use `!`:**

```coffee
# Sequential async code (most common case)
user = findUser!(id)
posts = getPosts!(user.id)
render!(user, posts)

# Simple async chains
config = loadConfig!
db = connectDB!(config)
server = startServer!(db)
```

**❌ When NOT to Use `!`:**

```coffee
# DON'T (serialized - slow):
a = fetch1!
b = fetch2!
c = fetch3!

# DO (parallel - fast):
[a, b, c] = await Promise.all([fetch1(), fetch2(), fetch3()])
```

## Void Functions (`!` at Definition)

The `!` at definition suppresses implicit returns (side-effect only functions):

```coffee
def processItems!
  for item in items
    item.update()
  # ← Returns undefined, not last expression

# With explicit return (value stripped)
def validate!(x)
  return if x < 0     # → Just "return" (no value)
  console.log "valid"
  # ← Returns undefined
```

**Works with all function types:**
```coffee
c! = (x) ->              # Void thin arrow
  x * 2                  # Executes but doesn't return value

process! = (data) =>     # Void fat arrow
  data.toUpperCase()     # Executes but returns undefined
```

## Floor Division (`//`)

True floor division (not just integer division):

```coffee
7 // 3    # → 2
-7 // 3   # → -3 (floors toward negative infinity)
```

## True Modulo (`%%`)

True mathematical modulo (not remainder like `%`):

```coffee
-7 %% 3   # → 2 (always positive)
-7 % 3    # → -1 (remainder, can be negative)
```

## Ternary Operator (`?:`)

Rip supports both JavaScript-style ternary AND CoffeeScript-style:

```coffee
# JavaScript style
status = active ? 'on' : 'off'

# CoffeeScript style
status = if active then 'on' else 'off'

# Nested
level = score > 90 ? 'A' : score > 80 ? 'B' : score > 70 ? 'C' : 'F'
```

**Why possible:** By using `??` for nullish, `?` became available for ternary.

## Otherwise Operator (`!?`)

The otherwise operator handles both null/undefined AND thrown errors:

```coffee
result = riskyOperation() !? "default"
# If riskyOperation() throws or returns null/undefined, result = "default"
```

---

# 5. Regex+ Features

**Ruby-Inspired Regex Matching with Automatic Capture**

Rip extends CoffeeScript with two powerful regex features inspired by Ruby: the **`=~` match operator** and **regex indexing**. Both features automatically manage match results in a global `_` variable.

## `=~` Match Operator

### Syntax

```rip
text =~ /pattern/
```

### Behavior

- Executes: `(_ = toSearchable(text).match(/pattern/))`
- Stores match result in `_` variable (accessible immediately)
- Returns: the match result (truthy) or `null`

### Examples

**Basic matching:**
```rip
text = "hello world"
if text =~ /world/
  console.log("Found:", _[0])  # "world"
```

**Capture groups:**
```rip
email = "user@example.com"
if email =~ /(.+)@(.+)/
  username = _[1]  # "user"
  domain = _[2]    # "example.com"
```

**Phone number parsing:**
```rip
phone = "2125551234"
if phone =~ /^([2-9]\d\d)([2-9]\d\d)(\d{4})$/
  formatted = "(#{_[1]}) #{_[2]}-#{_[3]}"
  # Result: "(212) 555-1234"
```

## Regex Indexing

### Syntax

```rip
value[/pattern/]      # Returns full match (capture 0)
value[/pattern/, n]   # Returns capture group n
```

### Examples

**Simple match:**
```rip
"steve"[/eve/]           # Returns "eve"
```

**Capture group:**
```rip
"steve"[/e(v)e/, 1]      # Returns "v"
```

**Email domain:**
```rip
domain = "user@example.com"[/@(.+)$/, 1]
# Returns: "example.com"
```

## Combined Usage

The real power comes from using both features together:

```rip
# Parse, validate, and format in clean steps
email = "Admin@Company.COM"
if email =~ /^([^@]+)@([^@]+)$/i
  username = _[1].toLowerCase()   # "admin"
  domain = _[2].toLowerCase()     # "company.com"
  "#{username}@#{domain}"         # Normalized email
```

## Elegant Validator Pattern

One of the most powerful use cases is building validators:

```rip
validators =
  # Extract and validate in one expression
  id:       (v) -> v[/^([1-9]\d{0,19})$/] and parseInt(_[1])
  email:    (v) -> v[/^([^@]+)@([^@]+\.[a-z]{2,})$/i] and _[0]
  zip:      (v) -> v[/^(\d{5})/] and _[1]
  phone:    (v) -> v[/^(\d{10})$/] and formatPhone(_[1])

  # Normalize formats
  ssn:      (v) -> v[/^(\d{3})-?(\d{2})-?(\d{4})$/] and "#{_[1]}#{_[2]}#{_[3]}"
  zipplus4: (v) -> v[/^(\d{5})-?(\d{4})$/] and "#{_[1]}-#{_[2]}"

  # Boolean validators with =~
  truthy:   (v) -> (v =~ /^(true|t|1|yes|y|on)$/i) and true
  falsy:    (v) -> (v =~ /^(false|f|0|no|n|off)$/i) and true
```

**Each validator:**
- Validates format
- Extracts/transforms data
- Returns normalized value or falsy
- **All in one line!**

## Heregex (Extended Regular Expressions)

Rip supports heregexes - extended regular expressions that allow whitespace and comments for readability:

```rip
pattern = ///
  ^ \d+      # starts with digits
  \s*        # optional whitespace
  [a-z]+     # followed by letters
  $          # end of string
  ///i

# Compiles to: /^\d+\s*[a-z]+$/i
# Comments and whitespace automatically stripped!
```

## Security Features

### Injection Protection

By default, **rejects strings with newlines**:

```rip
# Safe - rejects malicious input
userInput = "test\nmalicious"
userInput =~ /^test$/   # Returns null! (newline detected)

# Explicit multiline when needed
text = "line1\nline2"
text =~ /line2/m        # Works! (/m flag allows newlines)
```

---

## Design Philosophy

1. **Syntax over API** — Reactive primitives are operators, not function calls
2. **Implicit tracking** — Dependencies are detected automatically
3. **Minimal boilerplate** — No `useState`, no `.value` in most cases
4. **Familiar feel** — Looks like regular assignment, behaves reactively
5. **Zero dependencies** — Runtime is inlined, no external packages needed
6. **Components are language constructs** — Not classes you extend, not functions you call
7. **Templates are code** — The `render` block is Rip syntax, not a separate template language
8. **Everything is reactive** — State, derived values, and effects just work

---

**See Also:**
- [INTERNALS.md](INTERNALS.md) - Compiler and parser details
- [PHILOSOPHY.md](PHILOSOPHY.md) - Why Rip exists
- [BROWSER.md](BROWSER.md) - Browser usage and REPL guide
