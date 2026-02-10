# Rip UI — Design Notes

## Why `@click` is not a conflict

The `@` sigil in Rip always means `this.` — it accesses a member of the
current component. In render blocks, `@click` compiles to `this.click`
regardless of context. What changes is how the compiler *uses* that
reference, based on what element it's attached to.

**On an HTML element** (button, div, input, etc.):

```coffee
button @click: @increment, "Click me"
```

This becomes `addEventListener('click', ...)`. HTML elements don't have
props — they have attributes and event listeners. When the compiler sees
`@click` on something it knows is an HTML tag, it treats it as an event
binding.

**On a component** (MyWidget, Counter, etc.):

```coffee
MyWidget @click: @handler
```

This becomes `new MyWidget({ click: this.handler })`. Components receive
values through their constructor's `props` argument. When the compiler
sees `@click` on something it knows is a component (capitalized name),
it treats it as a prop.

**Why there's no conflict:** You never pass props to HTML elements, and
you never call `addEventListener` on components. The compiler already
distinguishes HTML elements from components (HTML tags are lowercase and
come from a known set; components are capitalized). The same `@click`
syntax gets the right behavior in both contexts automatically — event
listener on HTML elements, prop on components. No special-casing of
event names, no reserved prop names, no ambiguity.
