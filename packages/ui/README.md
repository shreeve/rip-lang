<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.svg" style="width:50px" /> <br>

# @rip-lang/ui

**Pre-built Component Library for Rip**

## Overview

`@rip-lang/ui` is a collection of ready-to-use UI components for building web applications with Rip. It provides beautiful, accessible, and customizable components that work seamlessly with Rip's reactive system.

> **Note:** This package requires `rip-lang` (the core language) which provides reactivity, components, and template syntax. See the [Rip Language docs](https://github.com/shreeve/rip-lang) for the language features.

---

## Installation

```bash
bun add @rip-lang/ui
```

Or via CDN:

```html
<link rel="stylesheet" href="https://unpkg.com/@rip-lang/ui/dist/ui.css">
```

---

## Quick Start

```coffee
# Import components
import { Button, Card, Input, Modal } from "@rip-lang/ui"

component App
  name = ""
  showModal = false

  render
    div.app
      Card title: "Welcome"
        Input
          label: "Your name"
          value: name
          @input: (e) -> name = e.target.value

        Button variant: "primary", @click: -> showModal = true
          "Say Hello"

      Modal open: showModal, @close: -> showModal = false
        h2 "Hello, #{name}!"
        Button @click: -> showModal = false, "Close"
```

---

## Components

### Buttons

```coffee
# Variants
Button variant: "primary", "Save"
Button variant: "secondary", "Cancel"
Button variant: "ghost", "Learn More"
Button variant: "danger", "Delete"

# Sizes
Button size: "sm", "Small"
Button size: "md", "Medium"
Button size: "lg", "Large"

# States
Button disabled: true, "Disabled"
Button loading: true, "Loading..."

# With icons
Button variant: "primary"
  Icon name: "save"
  " Save Changes"
```

### Inputs

```coffee
# Text input
Input label: "Email", type: "email", placeholder: "you@example.com"

# With validation
Input
  label: "Password"
  type: "password"
  required: true
  error: errors.password

# Textarea
Textarea label: "Bio", rows: 4, value: bio

# Select
Select label: "Country", options: countries, value: country
```

### Cards

```coffee
Card
  title: "Product"
  subtitle: "Best seller"
  image: product.imageUrl

  p product.description
  span.price "$#{product.price}"

  footer:
    Button variant: "primary", "Add to Cart"
```

### Modals

```coffee
Modal
  open: isOpen
  title: "Confirm Delete"
  @close: -> isOpen = false

  p "Are you sure you want to delete this item?"

  footer:
    Button variant: "ghost", @click: -> isOpen = false, "Cancel"
    Button variant: "danger", @click: confirmDelete, "Delete"
```

### Navigation

```coffee
# Tabs
Tabs value: activeTab, @change: (t) -> activeTab = t
  Tab value: "overview", "Overview"
  Tab value: "details", "Details"
  Tab value: "reviews", "Reviews"

# Breadcrumbs
Breadcrumbs
  a href: "/", "Home"
  a href: "/products", "Products"
  span "Widget Pro"
```

### Layout

```coffee
# Stack (vertical)
Stack gap: 4
  Card ...
  Card ...
  Card ...

# Row (horizontal)
Row gap: 4, align: "center"
  Avatar src: user.avatar
  span user.name

# Grid
Grid cols: 3, gap: 4
  for product in products, key: product.id
    ProductCard product: product
```

### Feedback

```coffee
# Alerts
Alert variant: "success", "Changes saved!"
Alert variant: "error", "Something went wrong"
Alert variant: "warning", "This action cannot be undone"
Alert variant: "info", "New features available"

# Toast (programmatic)
toast.success "Item added to cart"
toast.error "Failed to save"

# Loading
Spinner size: 24
Skeleton lines: 3
ProgressBar value: progress, max: 100
```

### Icons

```coffee
# Basic
Icon name: "check"
Icon name: "x"
Icon name: "menu"

# Sized
Icon name: "star", size: 32

# Colored
Icon name: "heart", color: "red"
```

---

## Design Tokens

The component library uses CSS custom properties for theming:

```css
:root {
  /* Colors */
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-danger: #ef4444;
  --color-success: #22c55e;
  --color-warning: #f59e0b;

  /* Surfaces */
  --surface: #ffffff;
  --surface-hover: #f9fafb;
  --border: #e5e7eb;

  /* Text */
  --text-primary: #111827;
  --text-secondary: #6b7280;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  /* Radii */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

### Dark Mode

```css
[data-theme="dark"] {
  --surface: #1f2937;
  --surface-hover: #374151;
  --border: #374151;
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
}
```

### Custom Themes

Override tokens to create custom themes:

```css
:root {
  --color-primary: #8b5cf6;  /* Purple theme */
  --radius-md: 0;            /* Sharp corners */
}
```

---

## Accessibility

All components follow WAI-ARIA best practices:

- **Keyboard navigation** — Full keyboard support
- **Screen reader support** — Proper ARIA labels and roles
- **Focus management** — Visible focus indicators
- **Color contrast** — WCAG AA compliant

```coffee
# Accessible by default
Button variant: "primary", "Save"  # Focusable, announces as button

# Custom accessibility
Button aria-label: "Close dialog", @click: close
  Icon name: "x"
```

---

## Customization

### Component Variants

Extend built-in variants with your own:

```coffee
# In your styles
style global
  .btn.gradient
    background linear-gradient(135deg, $color-primary, $color-secondary)

# Usage
Button variant: "gradient", "Fancy Button"
```

### Composition

Build complex components from primitives:

```coffee
component UserCard
  @user
  @onFollow

  render
    Card
      Row gap: 3, align: "center"
        Avatar src: @user.avatar, size: 48
        Stack gap: 1
          span.name @user.name
          span.handle "@#{@user.handle}"
        Button variant: "primary", size: "sm", @click: @onFollow
          "Follow"
```

---

## API Reference

### Button

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"primary" \| "secondary" \| "ghost" \| "danger"` | `"secondary"` | Visual style |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Button size |
| `disabled` | `boolean` | `false` | Disable interactions |
| `loading` | `boolean` | `false` | Show loading spinner |
| `type` | `"button" \| "submit" \| "reset"` | `"button"` | HTML button type |

### Input

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Input label |
| `type` | `string` | `"text"` | HTML input type |
| `placeholder` | `string` | — | Placeholder text |
| `value` | `string` | — | Controlled value |
| `error` | `string` | — | Error message |
| `required` | `boolean` | `false` | Required field |
| `disabled` | `boolean` | `false` | Disable input |

### Modal

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | `false` | Show/hide modal |
| `title` | `string` | — | Modal title |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Modal width |
| `@close` | `function` | — | Called when modal should close |

### Card

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | — | Card title |
| `subtitle` | `string` | — | Card subtitle |
| `image` | `string` | — | Header image URL |
| `padding` | `boolean` | `true` | Add padding to body |

---

## Package Structure

```
@rip-lang/ui/
├── components/
│   ├── Button.rip
│   ├── Input.rip
│   ├── Card.rip
│   ├── Modal.rip
│   └── ...
├── styles/
│   ├── tokens.css
│   ├── reset.css
│   └── components.css
├── icons/
│   └── icons.rip
└── index.rip           # Main export
```

---

## Requirements

- `rip-lang` >= 1.6.0 (provides reactivity, components, templates)
- Modern browser (ES2022+)

---

## Related

- [rip-lang](https://github.com/shreeve/rip-lang) — The core language (reactivity, components, templates)
- [rip-lang/docs/COMPONENTS.md](https://github.com/shreeve/rip-lang/blob/main/docs/COMPONENTS.md) — Component model
- [rip-lang/docs/RIP-REACTIVITY.md](https://github.com/shreeve/rip-lang/blob/main/docs/RIP-REACTIVITY.md) — Reactive operators
- [rip-lang/docs/TEMPLATES.md](https://github.com/shreeve/rip-lang/blob/main/docs/TEMPLATES.md) — Template DSL

---

## License

MIT
