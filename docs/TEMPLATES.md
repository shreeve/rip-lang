<p><img src="rip.svg" alt="Rip Logo" width="100"></p>

# Rip Template Syntax

> **The Language IS the Framework**

Rip's template syntax is not a separate language—it's native Rip syntax. The `render` block uses indentation-based markup that compiles directly to efficient DOM operations.

---

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

---

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

---

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

**Generated output:**
```javascript
h('div', { class: cx('card', isActive && 'active', size) })
h('div.card', { class: cx('highlighted', isNew && 'new') })
h('div', { class: cx({ active: isActive, disabled: isDisabled }) })
```

The `cx()` function filters falsy values and flattens arrays, exactly like `clsx()`.

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

**Generated output:**
```javascript
h('div', { ...props })
h('div.card', { ...props })
h('input', { ...inputProps, class: "extra", disabled: true })
h('div.wrapper', { ...containerProps }, h('span', 0, "Content"))
```

---

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

**Generated output:**
```javascript
h('input', { value: username, oninput: (e) => username = e.target.value })
h('input', { type: "checkbox", checked: isActive, onchange: (e) => isActive = e.target.checked })
h('select', { value: selectedId, onchange: (e) => selectedId = e.target.value })
h('textarea', { value: content, oninput: (e) => content = e.target.value })
```

**Smart event selection:**
- `value` on `input`/`textarea` → `oninput` event
- `value` on `select` → `onchange` event
- `checked` → `onchange` event

---

## Event Handlers

### Basic Events

```coffee
button @click: handleClick
button @click: -> count += 1
input @input: (e) -> value = e.target.value
form @submit: handleSubmit
```

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

### Multiple Event Handlers

```coffee
input
  @focus: -> focused = true
  @blur: -> focused = false
  @input: (e) -> value = e.target.value
  @keydown.enter: submit
  @keydown.escape: cancel
```

---

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

### Multiline Text

```coffee
p """
  This is a longer paragraph
  that spans multiple lines.
  Each line is preserved.
"""
```

---

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

---

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

### Conditional Rendering Components

```coffee
render
  div.page
    if authenticated
      Dashboard user: currentUser
    else
      LoginForm onLogin: handleLogin
```

---

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

### Filtered Lists

```coffee
ul
  for item in items.filter((x) -> x.active), key: item.id
    li item.name

# Or using derived value
filtered ~= items.filter (x) -> x.active

render
  ul
    for item in filtered, key: item.id
      li item.name
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

---

## Component Rendering

### Basic Usage

```coffee
UserCard user: currentUser
Button variant: "primary", onClick: handleClick
Icon name: "check", size: 24
```

### With Children

```coffee
Button variant: "primary", onClick: handleClick
  Icon name: "save"
  " Save Changes"

Card title: "User Info"
  p "Name: #{user.name}"
  p "Email: #{user.email}"
```

### Dynamic Components

```coffee
# Store component in variable
page ~= switch route
  when "/" then HomePage
  when "/settings" then SettingsPage
  when "/profile" then ProfilePage
  else NotFoundPage

render
  div.app
    Header
    main
      page                    # Renders the component stored in `page`
    Footer
```

### Conditional Components

```coffee
render
  div
    if isEditing
      EditForm item: item, onSave: save
    else
      DisplayView item: item, onEdit: startEdit
```

---

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

### Component Refs

Access exposed methods on child components:

```coffee
component Form
  fieldRef = null

  submit: ->
    if fieldRef.validate()
      save!()
    else
      fieldRef.focus()

  render
    form @submit.prevent: submit
      TextField ref: fieldRef, label: "Email"
      button "Submit"
```

---

## Slots / Named Content

> **Note:** Full slot support requires the component system (Phase 3). See [COMPONENTS.md](COMPONENTS.md).

### Default Slot

```coffee
component Card
  @title
  @children

  render
    div.card
      h2.title @title
      div.body
        @children

# Usage
Card title: "Welcome"
  p "This goes into @children"
  p "So does this"
```

### Named Slots

```coffee
component Layout
  @header?
  @sidebar?
  @footer?
  @children

  render
    div.layout
      header.header @header if @header
      aside.sidebar @sidebar if @sidebar
      main.content @children
      footer.footer @footer if @footer

# Usage
Layout
  header:
    h1 "My App"
    nav
      a href: "/", "Home"
      a href: "/about", "About"

  sidebar:
    SearchBox
    Navigation

  footer:
    p "© 2024"

  # Default content → @children
  h2 "Welcome"
  p "Main content here"
```

---

## Special Attributes

### `key` for List Items

Required for efficient list updates:

```coffee
for item in items, key: item.id
  ItemComponent item: item
```

### `ref` for Element Access

```coffee
input ref: inputEl
canvas ref: canvasEl
MyComponent ref: componentRef
```

### `class` Object Syntax

```coffee
div class: { active: isActive, hidden: !visible, error: hasError }
```

### `style` Object Syntax

```coffee
div style: { color: textColor, fontSize: "#{size}px" }
div style: { transform: "translateX(#{offset}px)" }
```

---

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

---

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

Or simply use the component's root as a list:

```coffee
# Multiple elements at component root
render
  Header
  main @children
  Footer
```

---

## Comments in Templates

```coffee
render
  div.app
    # This is a comment
    Header

    # Navigation section
    nav.main-nav
      # ...links

    main
      # Main content area
      @children
```

---

## Complete Example

```coffee
component ProductCard
  @product
  @onAddToCart

  quantity = 1
  isHovered = false

  total ~= @product.price * quantity

  increment: ->
    quantity = Math.min quantity + 1, @product.stock

  decrement: ->
    quantity = Math.max quantity - 1, 1

  render
    article.card
      @mouseenter: -> isHovered = true
      @mouseleave: -> isHovered = false
      class: { hovered: isHovered, "out-of-stock": @product.stock is 0 }

      # Image
      div.card-image
        img src: @product.image, alt: @product.name

        # Badge overlay
        span.badge.sale "-#{@product.discount}%" if @product.discount

      # Content
      div.card-content
        h3.title @product.name
        p.description @product.description

        # Price
        div.price
          span.current "$#{@product.price.toFixed(2)}"
          span.original "$#{@product.originalPrice.toFixed(2)}" if @product.originalPrice

        # Quantity selector
        div.quantity if @product.stock > 0
          button @click: decrement, disabled: quantity <= 1, "-"
          span.count quantity
          button @click: increment, disabled: quantity >= @product.stock, "+"

        # Stock status
        p.stock
          if @product.stock is 0
            span.out "Out of Stock"
          else if @product.stock < 5
            span.low "Only #{@product.stock} left!"
          else
            span.available "In Stock"

      # Footer
      footer.card-footer
        span.total "Total: $#{total.toFixed(2)}"
        button.add-to-cart
          @click: -> @onAddToCart @product, quantity
          disabled: @product.stock is 0
          Icon name: "cart"
          " Add to Cart"
```

---

## Runtime API

Templates compile to calls to runtime helpers in `src/runtime.js`:

| Function | Purpose |
|----------|---------|
| `h(tag, props, children)` | Create element |
| `txt(value)` | Create text node |
| `frag(...nodes)` | Create DocumentFragment |
| `cx(...args)` | Build class string (clsx-compatible) |

### The `h()` Helper

```javascript
// h(tag, props, children)
h('div.card#main', { onclick: fn }, [child1, child2])

// Parses tag string: "div#id.class1.class2"
// Applies props (0 = no props)
// Handles children (single, array, or none)
```

### The `cx()` Helper

```javascript
// clsx-compatible dynamic class builder
cx('foo', isActive && 'active', { bar: true, baz: false })
// → "foo active bar"

cx(['a', 'b'], { c: true })
// → "a b c"
```

---

## Implementation Status

> **Phase 2: COMPLETE** ✅

The template syntax is fully implemented in the Rip compiler.

**Implemented:**
- [x] `render` block → DOM creation
- [x] `tag` → `document.createElement('tag')`
- [x] `tag.class1.class2` → Element with CSS classes
- [x] `tag#id` → Element with ID
- [x] `tag#id.class1.class2` → Combined selectors
- [x] `.()` → Dynamic classes via `cx()` (clsx-compatible)
- [x] `attr: value` → `setAttribute()`
- [x] `@event: handler` → `addEventListener()`
- [x] `@event.modifier:` → Event modifiers (prevent, stop, key modifiers, etc.)
- [x] `"text"` → Text nodes
- [x] Implicit indentation-based nesting
- [x] Explicit arrow syntax (`->`) for inline nesting
- [x] Multiple root elements → DocumentFragment
- [x] `...props` → Spread attributes
- [x] `prop <=> var` → Two-way binding (spaceship operator)
- [x] `ref:` and `key:` special attributes
- [x] SVG namespace handling

**Next Phase (Components):**
- [ ] `component` keyword
- [ ] Props system (`@prop`)
- [ ] Lifecycle hooks
- [ ] Slots for composition

See [COMPONENTS.md](COMPONENTS.md) for the component model.
See [REACTIVITY.md](REACTIVITY.md) for reactive state management.
