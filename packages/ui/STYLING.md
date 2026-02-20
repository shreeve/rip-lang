# Styling Guide

This document defines the styling architecture for Rip projects. It is a
determination, not a survey of options. These choices reflect Rip's core
principles: elegance, minimalism, zero unnecessary dependencies, and letting
the platform do the work.

---

## Philosophy

Good styling follows the same rules as good code: say what you mean, don't
repeat yourself, and don't import machinery you don't need. CSS is a real
language. Modern CSS — with nesting, custom properties, cascade layers, and
container queries — is expressive enough to build any interface without
preprocessors, runtimes, or utility class vocabularies.

Our styling architecture has four layers. Each does one thing well.

---

## The Stack

| Layer | Tool | Role |
|-------|------|------|
| **Behavior** | Base UI | Accessible headless components — keyboard nav, ARIA, focus management |
| **Design Tokens** | Open Props | Consistent scales for spacing, color, shadow, radius, easing, typography |
| **Scoping** | CSS Modules | Automatic class name isolation per component |
| **Platform** | Native CSS | Nesting, `@layer`, `data-*` selectors, `prefers-color-scheme` |

### Base UI

Base UI provides unstyled, accessible interactive primitives: dialogs, menus,
selects, tooltips, tabs, checkboxes, sliders, and more. It handles the hard
problems — keyboard interaction, screen reader announcements, focus trapping,
dismissal behavior — and exposes styling hooks through:

- **`className`** — static class or a function receiving component state
- **`data-*` attributes** — `[data-open]`, `[data-checked]`, `[data-disabled]`, `[data-entering]`, `[data-exiting]`, etc.
- **CSS variables** — `--available-height`, `--anchor-width`, etc.
- **`render` prop** — full control over the rendered element

We style Base UI components entirely through CSS selectors targeting these
attributes. No JavaScript styling logic.

### Open Props

Open Props is a set of CSS custom properties — design tokens — covering spacing,
color, shadow, radius, easing, typography, and animation. It ships as pure CSS
(4KB), has no runtime, no build step, and no opinions about how you use it.

We use Open Props as our design token foundation. It provides the consistent
scales that prevent ad-hoc magic numbers from creeping into stylesheets.

Import what you need:

```css
@import "open-props/sizes";
@import "open-props/colors";
@import "open-props/shadows";
@import "open-props/radii";
@import "open-props/easings";
@import "open-props/fonts";
```

Or import everything at once:

```css
@import "open-props/style";
```

Override or extend any token by redefining the custom property:

```css
:root {
  --color-primary: oklch(55% 0.25 260);
  --radius-card: var(--radius-3);
}
```

### CSS Modules

CSS Modules provide automatic class name scoping. Each `.module.css` file
generates unique class names at build time, so styles never leak across
components. No runtime. No naming conventions to enforce. Just write CSS
and import it.

```css
/* Button.module.css */
.button {
  padding: var(--size-2) var(--size-4);
  border-radius: var(--radius-2);
  font-weight: var(--font-weight-6);
  cursor: pointer;
}
```

```jsx
import styles from './Button.module.css'

<button className={styles.button}>Click</button>
```

Vite, Bun, webpack, and every modern bundler support CSS Modules natively.

### Native CSS Features

Modern CSS eliminates the need for preprocessors. Use these features directly:

**Nesting** — group related rules under their parent:

```css
.card {
  padding: var(--size-4);

  & .title {
    font-size: var(--font-size-4);
    font-weight: var(--font-weight-7);
  }

  &:hover {
    box-shadow: var(--shadow-3);
  }
}
```

**Cascade Layers** — control specificity without fighting it:

```css
@layer base, components, overrides;

@layer base {
  button { font: inherit; }
}

@layer components {
  .dialog { border-radius: var(--radius-3); }
}
```

**Container Queries** — style based on the component's container, not the
viewport:

```css
.sidebar {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .sidebar .nav { flex-direction: row; }
}
```

**`color-mix()`** — derive colors without Sass functions:

```css
.muted {
  color: color-mix(in oklch, var(--color-text), transparent 40%);
}
```

---

## How They Work Together

A Base UI component styled with Open Props tokens, scoped by CSS Modules,
using `data-*` attributes for state:

```css
/* Dialog.module.css */
.overlay {
  position: fixed;
  inset: 0;
  background: oklch(0% 0 0 / 40%);
  display: grid;
  place-items: center;

  &[data-entering] { animation: var(--animation-fade-in); }
  &[data-exiting]  { animation: var(--animation-fade-out); }
}

.panel {
  background: var(--surface-1);
  border-radius: var(--radius-3);
  padding: var(--size-6);
  box-shadow: var(--shadow-4);
  max-width: min(90vw, 32rem);
  width: 100%;

  &[data-entering] {
    animation: var(--animation-slide-in-up) 200ms var(--ease-spring-3);
  }

  &[data-exiting] {
    animation: var(--animation-fade-out) 100ms var(--ease-2);
  }
}

.title {
  font-size: var(--font-size-4);
  font-weight: var(--font-weight-7);
  margin-block-end: var(--size-2);
}
```

```jsx
import { Dialog } from '@base-ui-components/react/dialog'
import styles from './Dialog.module.css'

<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop className={styles.overlay} />
    <Dialog.Popup className={styles.panel}>
      <Dialog.Title className={styles.title}>Confirm</Dialog.Title>
      <Dialog.Description>Are you sure?</Dialog.Description>
      <Dialog.Close>Cancel</Dialog.Close>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

The pattern is always the same:

1. Base UI owns behavior and accessibility
2. `data-*` attributes expose component state to CSS
3. Open Props tokens provide the values
4. CSS Modules scope the class names
5. Native CSS nesting keeps selectors clean

---

## Design Tokens

Use these Open Props categories as the project's design vocabulary.

### Spacing

`--size-1` through `--size-15` — a fluid scale from `0.25rem` to `7.5rem`.
Use for padding, margin, and gap.

### Colors

Open Props provides full color palettes (`--blue-0` through `--blue-12`, etc.)
plus semantic surface tokens. Define project-level semantic aliases:

```css
:root {
  --color-primary: var(--indigo-7);
  --color-danger: var(--red-7);
  --color-success: var(--green-7);
  --color-text: var(--gray-9);
  --color-text-muted: var(--gray-6);
  --surface-1: var(--gray-0);
  --surface-2: var(--gray-1);
  --surface-3: var(--gray-2);
}
```

### Shadows

`--shadow-1` through `--shadow-6` — progressively stronger elevations.

### Radii

`--radius-1` through `--radius-6` plus `--radius-round` and `--radius-blob`.

### Easing

`--ease-1` through `--ease-5` for standard curves.
`--ease-spring-1` through `--ease-spring-5` for spring-like motion.

### Typography

`--font-size-0` through `--font-size-8` for a modular type scale.
`--font-weight-1` through `--font-weight-9`.
`--font-lineheight-0` through `--font-lineheight-5`.

---

## Dark Mode

Use `prefers-color-scheme` with CSS variable swapping. No JavaScript required
for the default behavior:

```css
:root {
  color-scheme: light dark;

  --surface-1: var(--gray-0);
  --surface-2: var(--gray-1);
  --color-text: var(--gray-9);
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface-1: var(--gray-11);
    --surface-2: var(--gray-10);
    --color-text: var(--gray-1);
  }
}
```

For a manual toggle, use a `[data-theme]` attribute on the root element:

```css
[data-theme="dark"] {
  --surface-1: var(--gray-11);
  --surface-2: var(--gray-10);
  --color-text: var(--gray-1);
}
```

```js
document.documentElement.dataset.theme = 'dark'
```

---

## Common Patterns

### Button

```css
.button {
  display: inline-flex;
  align-items: center;
  gap: var(--size-2);
  padding: var(--size-2) var(--size-4);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-2);
  background: var(--color-primary);
  color: white;
  font-weight: var(--font-weight-6);
  cursor: pointer;
  transition: background 150ms var(--ease-2);

  &:hover { background: color-mix(in oklch, var(--color-primary), black 15%); }
  &:active { scale: 0.98; }
  &[data-disabled] { opacity: 0.5; cursor: not-allowed; }
}

.ghost {
  background: transparent;
  color: var(--color-primary);

  &:hover { background: color-mix(in oklch, var(--color-primary), transparent 90%); }
}
```

### Form Input

```css
.input {
  padding: var(--size-2) var(--size-3);
  border: 1px solid var(--gray-4);
  border-radius: var(--radius-2);
  font-size: var(--font-size-1);
  background: var(--surface-1);
  color: var(--color-text);
  transition: border-color 150ms var(--ease-2);

  &:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
    border-color: var(--color-primary);
  }

  &[data-invalid] { border-color: var(--color-danger); }
  &[data-disabled] { opacity: 0.5; }

  &::placeholder { color: var(--color-text-muted); }
}
```

### Card

```css
.card {
  background: var(--surface-1);
  border-radius: var(--radius-3);
  padding: var(--size-5);
  box-shadow: var(--shadow-2);
  transition: box-shadow 200ms var(--ease-2);

  &:hover { box-shadow: var(--shadow-3); }

  & .title {
    font-size: var(--font-size-3);
    font-weight: var(--font-weight-7);
    margin-block-end: var(--size-2);
  }

  & .body {
    color: var(--color-text-muted);
    line-height: var(--font-lineheight-3);
  }
}
```

### Select (Base UI)

```css
.trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--size-2);
  padding: var(--size-2) var(--size-3);
  border: 1px solid var(--gray-4);
  border-radius: var(--radius-2);
  background: var(--surface-1);
  cursor: pointer;
  min-width: 10rem;

  &[data-popup-open] { border-color: var(--color-primary); }
}

.popup {
  background: var(--surface-1);
  border: 1px solid var(--gray-3);
  border-radius: var(--radius-2);
  box-shadow: var(--shadow-3);
  padding: var(--size-1);
  max-height: var(--available-height);
  overflow-y: auto;
}

.option {
  padding: var(--size-2) var(--size-3);
  border-radius: var(--radius-1);
  cursor: pointer;

  &[data-highlighted] { background: var(--surface-2); }
  &[data-selected] { font-weight: var(--font-weight-6); color: var(--color-primary); }
}
```

### Tooltip (Base UI)

```css
.tooltip {
  background: var(--gray-10);
  color: var(--gray-0);
  font-size: var(--font-size-0);
  padding: var(--size-1) var(--size-2);
  border-radius: var(--radius-2);
  max-width: 20rem;

  &[data-entering] { animation: var(--animation-fade-in) 100ms; }
  &[data-exiting]  { animation: var(--animation-fade-out) 75ms; }
}

.arrow {
  fill: var(--gray-10);
}
```

---

## What We Don't Use

**Tailwind CSS** — utility classes in markup are write-only and semantically
empty. We write real CSS with real selectors.

**CSS-in-JS runtimes** (styled-components, Emotion) — runtime style injection
adds bundle size and creates hydration complexity. We use CSS Modules for
scoping, which compiles away completely.

**Sass / Less** — native CSS nesting, `color-mix()`, and custom properties
eliminate the need for preprocessors.

**Inline styles for layout** — the `style` prop is for truly dynamic values
(e.g., positioning from a calculation). Layout, spacing, color, and typography
go in CSS.

**Component library themes** (Material UI themes, Chakra tokens) — we own our
design tokens via Open Props and CSS custom properties. No framework-specific
theming APIs.

---

## Installation

```bash
npm install @base-ui-components/react open-props
```

No additional configuration. CSS Modules work out of the box with Vite and Bun.

---

## Summary

Write semantic CSS. Use Open Props for consistent values. Use CSS Modules for
scoping. Use Base UI for accessible interactive components. Use `data-*`
attributes for styling component states. Use native CSS features — nesting,
layers, container queries, `color-mix()` — for everything else.

The result: zero-runtime styling, accessible components, consistent design
tokens, scoped styles, and clean readable code. No class soup. No vendor
lock-in. Just CSS.
