# @rip-lang/ui — Agent Guide

## Purpose

This package provides **pre-built UI components** for Rip applications. It is NOT a framework—all reactive primitives, component syntax, and template DSL are provided by the core `rip-lang` package.

---

## Key Distinction

| Package | Provides |
|---------|----------|
| **rip-lang** | Language, compiler, reactivity (`∞=`), component syntax, template DSL |
| **@rip-lang/ui** | Pre-built components (Button, Card, Modal), design tokens, icons |

When implementing language features (reactivity, components, templates), work in **rip-lang**.

When implementing UI components, design tokens, or icons, work in **@rip-lang/ui**.

---

## What's Here

```
packages/ui/
├── components/     # Pre-built components (Button, Input, etc.)
├── styles/         # CSS tokens and component styles
├── icons/          # Icon library
└── index.rip       # Package exports
```

---

## Component Guidelines

1. **Use core Rip features** — Components use `component`, `render`, `style`, `∞=`, etc.
2. **Accept standard props** — `variant`, `size`, `disabled`, etc.
3. **Emit standard events** — `@click`, `@change`, `@input`
4. **Be accessible** — ARIA labels, keyboard support, focus management
5. **Use design tokens** — `$color-primary`, `$space-4`, not hardcoded values

---

## Adding a Component

```coffee
# components/Tooltip.rip

component Tooltip
  @content                    # Required: tooltip text
  @position = "top"           # Optional with default
  @children                   # Element to wrap

  visible = false

  show: -> visible = true
  hide: -> visible = false

  render
    div.tooltip-wrapper
      @mouseenter: show
      @mouseleave: hide

      @children

      div.tooltip class: [@position, { visible }]
        @content

  style
    .tooltip-wrapper
      position relative
      display inline-block

    .tooltip
      position absolute
      padding $space-2 $space-3
      background $surface-inverse
      color $text-inverse
      border-radius $radius-sm
      font-size 0.875rem
      opacity 0
      pointer-events none
      transition opacity 0.15s

      &.visible
        opacity 1

      &.top
        bottom 100%
        left 50%
        transform translateX(-50%)
        margin-bottom $space-2
```

---

## Documentation

- Core language: [rip-lang/docs/](https://github.com/shreeve/rip-lang/tree/main/docs)
  - RIP-REACTIVITY.md — Reactive operators (`∞=`, `trigger:`, etc.)
  - COMPONENTS.md — Component model (`component`, props, lifecycle)
  - TEMPLATES.md — Template DSL (tags, events, loops)

- This package: README.md — Component usage and API

---

## Testing

Components are tested in the browser via `test.html`:

```bash
bun run dev
# Open http://localhost:3000/test.html
```

Test each component variant, state, and interaction.
