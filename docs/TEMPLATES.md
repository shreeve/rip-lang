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
| `attr: val` | Attribute | `type: "text"`, `disabled: true` |
| `@event: fn` | Event handler | `@click: handleClick` |
| `@event.mod:` | Event modifier | `@click.prevent: submit` |
| `"text"` | Text content | `span "Hello"` |
| `#{expr}` | Interpolation | `"Count: #{count}"` |
| `ref: var` | Element reference | `ref: inputEl` |
| `key: val` | List item key | `key: item.id` |
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

### Dynamic Classes (Object Syntax)

```coffee
div class: { active: isActive, disabled: isDisabled }
li class: { completed: todo.done, editing: isEditing }
button class: { loading: isLoading, success: hasSucceeded }
```

### Mixed Static + Dynamic Classes

```coffee
div.card class: { highlighted: isNew }
button.btn class: { primary: isPrimary, large: isLarge }
```

### Spreading Props

```coffee
# Spread an object as attributes
input ...inputProps
div.wrapper ...@rest

# Common pattern: forward props
component FancyInput
  @label
  @...inputProps

  render
    div.field
      label @label
      input ...@inputProps
```

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
filtered ∞= items.filter (x) -> x.active

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
page ∞= switch route
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

  total ∞= @product.price * quantity

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

  style
    .card
      border-radius $radius-lg
      overflow hidden
      background $surface
      box-shadow $shadow-md
      transition transform 0.2s, box-shadow 0.2s

      &.hovered
        transform translateY(-4px)
        box-shadow $shadow-lg

      &.out-of-stock
        opacity 0.7

    .card-image
      position relative

      img
        width 100%
        aspect-ratio 4/3
        object-fit cover

    .badge
      position absolute
      top $space-2
      right $space-2
      background $color-danger
      color white
      padding $space-1 $space-2
      border-radius $radius-sm
      font-weight 600

    .price
      display flex
      gap $space-2
      align-items baseline

      .current
        font-size 1.5rem
        font-weight 700
        color $text-primary

      .original
        text-decoration line-through
        color $text-secondary

    .quantity
      display flex
      align-items center
      gap $space-2

      button
        width 2rem
        height 2rem
        border-radius $radius-full
        border none
        background $surface-hover
        cursor pointer

        &:disabled
          opacity 0.5
          cursor not-allowed

    .add-to-cart
      width 100%
      padding $space-3
      background $color-primary
      color white
      border none
      border-radius $radius-md
      font-weight 600
      cursor pointer
      display flex
      align-items center
      justify-content center
      gap $space-2

      &:hover
        background $color-primary-hover

      &:disabled
        background $text-secondary
        cursor not-allowed
```

---

## Implementation Status

> **Note:** The template syntax is specified but not yet implemented in the Rip compiler. This document serves as the specification for the upcoming implementation.

**Roadmap:**
- [ ] Add indented markup parsing to Rip grammar
- [ ] `tag.class#id attr: val` → DOM creation
- [ ] `@event:` handler → event binding
- [ ] Event modifiers (`.prevent`, `.stop`, etc.)
- [ ] `for`/`if` in template context
- [ ] `key:` and `ref:` special attributes
- [ ] SVG support
- [ ] Fragment syntax

See [COMPONENTS.md](COMPONENTS.md) for the component model.
See [REACTIVITY.md](REACTIVITY.md) for reactive state management.
