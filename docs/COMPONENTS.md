# Rip Components

> **The Language IS the Framework**

Rip provides component syntax as **language-level constructs**, not library patterns. Components are built into the grammar itself.

---

## Component Keywords

| Keyword | Purpose |
|---------|---------|
| `component` | Define a component (like `class` but for UI) |
| `render` | Template block that describes the UI |
| `style` | Scoped styles block for component CSS |
| `trigger` | Side effect block (see [REACTIVITY.md](REACTIVITY.md)) |

---

## Basic Component

```coffee
component HelloWorld
  render
    div "Hello, World!"
```

That's it. No imports, no boilerplate, no `export default`.

---

## Component with State

```coffee
component Counter
  count = 0                    # Reactive state

  increment: ->                # Method
    count += 1

  render
    div
      span "Count: #{count}"
      button @click: increment, "+"
```

State is just assignment. Methods are just functions. The `render` block describes the UI.

---

## Component with Derived Values

```coffee
component Counter
  count = 0
  doubled ∞= count * 2         # Reactive derived value

  increment: ->
    count += 1

  render
    div
      span "Count: #{count}"
      span "Doubled: #{doubled}"
      button @click: increment, "+"
```

When `count` changes, `doubled` automatically updates, and the UI re-renders.

---

## The `render` Block

The `render` block uses a clean, indentation-based template syntax:

```coffee
render
  div .container
    h1 "Welcome"
    p .intro, "This is Rip."

    ul
      li "Item 1"
      li "Item 2"
      li "Item 3"

    button @click: handleClick, "Click me"
```

### Syntax Rules

- **Element:** Just the tag name (`div`, `span`, `button`)
- **Classes:** Prefix with `.` (`div .container .active`)
- **IDs:** Prefix with `#` (`div #main`)
- **Text content:** String as child (`span "Hello"`)
- **Event handlers:** `@event: handler` (`button @click: onClick`)
- **Attributes:** `name: value` (`input type: "text", value: name`)
- **Interpolation:** `#{}` in strings (`span "Hello, #{name}"`)

---

## The `style` Block

The `style` block defines scoped CSS for the component:

```coffee
component Card
  render
    div .card
      h2 .title, "Card Title"
      p .body, "Card content goes here."

  style
    .card
      padding: 1rem
      border-radius: 8px
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)

    .title
      font-size: 1.25rem
      margin-bottom: 0.5rem

    .body
      color: #666
```

### Style Features

- **Scoped by default** — Styles only apply to this component
- **Clean syntax** — No curly braces, indentation-based
- **CSS variables** — Use `$variable` for design tokens

```coffee
style
  .button
    background: $primary
    padding: $space-2 $space-4
    border-radius: $radius-md
```

---

## Props

Components receive props as constructor arguments:

```coffee
component Greeting(name, emoji = "👋")
  render
    div "#{emoji} Hello, #{name}!"

# Usage:
Greeting name: "World"
Greeting name: "Rip", emoji: "🚀"
```

---

## Exposed Methods

Use `∞>` to expose methods that parents can call:

```coffee
component TextField
  value = ""
  inputRef = null

  focus ∞>: ->
    inputRef?.focus()

  clear ∞>: ->
    value = ""

  render
    input ref: inputRef, value: value, @input: (e) -> value = e.target.value

# Parent usage:
component Form
  textFieldRef = null

  handleSubmit: ->
    console.log textFieldRef.value
    textFieldRef.clear()
    textFieldRef.focus()

  render
    form @submit: handleSubmit
      TextField ref: textFieldRef
      button "Submit"
```

---

## Children / Slots

Components can accept children:

```coffee
component Card(title)
  render
    div .card
      h2 title
      div .card-body
        @children              # Render children here

# Usage:
Card title: "My Card"
  p "This is the card content."
  p "It can have multiple elements."
```

---

## Complete Example

```coffee
component TodoApp
  todos = []
  newTodo = ""
  remaining ∞= todos.filter((t) -> !t.done).length

  addTodo: ->
    return if newTodo.trim() is ""
    todos = [...todos, {id: Date.now(), text: newTodo, done: false}]
    newTodo = ""

  toggleTodo: (id) ->
    todos = todos.map (t) ->
      if t.id is id then {...t, done: !t.done} else t

  render
    div .todo-app
      h1 "Todo List"

      form @submit: addTodo
        input value: newTodo, @input: (e) -> newTodo = e.target.value
        button "Add"

      ul
        for todo in todos
          li @click: -> toggleTodo(todo.id)
            span .done: todo.done, todo.text

      p "#{remaining} items remaining"

  style
    .todo-app
      max-width: 400px
      margin: 0 auto

    .done
      text-decoration: line-through
      opacity: 0.5
```

---

## Design Philosophy

1. **Components are language constructs** — Not classes you extend, not functions you call
2. **Templates are code** — The `render` block is Rip syntax, not a separate template language
3. **Styles are colocated** — CSS lives with the component, scoped automatically
4. **No ceremony** — No imports, exports, or registration needed
