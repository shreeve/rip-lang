# Styling Philosophy

Rip UI ships zero CSS. Widgets expose semantic state through `data-*`
attributes. You write the styles. This document explains why — and why it's
the most productive approach available in 2026.

---

## The Utility CSS Insight Is Correct

Tailwind proved something important: design-system-driven, constrained
styling is more productive than ad-hoc CSS. Consistent spacing scales,
curated color palettes, and predictable naming conventions eliminate
decision fatigue and keep UIs coherent. That insight is correct and we
embrace it fully.

But the insight and the implementation are different things. Tailwind
implements this insight by encoding CSS properties as class names applied
to HTML elements. In 2016, when CSS lacked nesting, custom properties were
poorly supported, and preprocessors were mandatory, that trade-off made
sense. In 2026, it doesn't.

---

## What CSS Can Do Now

The platform caught up. Every major browser ships these features with full
support:

| Feature | What It Replaces |
|---------|-----------------|
| **Native nesting** | Sass nesting, BEM naming |
| **Custom properties** | Sass variables, Tailwind's design tokens |
| **Cascade layers** (`@layer`) | Specificity hacks, `!important` wars |
| **Container queries** | JavaScript-based responsive logic |
| **`color-mix()`** | Sass `darken()`/`lighten()`, Tailwind opacity modifiers |
| **`oklch()`** | Perceptually uniform color manipulation |
| **`:has()`** | Parent selectors that were "impossible" for 20 years |
| **`@scope`** | CSS Modules, scoped styles |

These aren't experimental features behind flags. They're the baseline. The
reasons people reached for Sass, CSS-in-JS, and utility classes are largely
resolved by the platform itself.

---

## Our Approach: The `data-*` Contract

Rip UI widgets expose semantic state through `$` sigil attributes that
compile to `data-*` in HTML:

```coffee
# Widget source — state only, zero styling
button $open: open?!, $disabled: @disabled?!
div $highlighted: (idx is highlightedIndex)?!
div $selected: (@value is current)?!
```

```css
/* Your stylesheet — any methodology */
[data-open]        { border-color: var(--color-primary); }
[data-highlighted] { background: var(--surface-2); }
[data-selected]    { font-weight: 600; color: var(--color-primary); }
[data-disabled]    { opacity: 0.5; cursor: not-allowed; }
```

No JavaScript styling logic. No className toggling. No CSS-in-JS runtime.
Write `$open` in Rip, style `[data-open]` in CSS. The widget doesn't know
or care how you style it.

This is the separation of concerns that CSS was designed for. Behavior in
one file, styling in another, and a clean attribute interface between them.

---

## Why Not Tailwind

We respect Tailwind. It changed how people think about styling. But we
believe it's a transitional technology — a workaround for problems that
native CSS has now solved. Here's why we don't use it, and why we think
you shouldn't either in 2026.

### Class strings are write-only

This is a real Tailwind component from production code:

```html
<button class="flex items-center justify-between gap-2 px-3 py-2
  border border-gray-300 rounded-lg bg-white text-sm font-medium
  text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none
  focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
  dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200
  dark:hover:bg-gray-700 data-[open]:border-blue-500
  data-[open]:ring-2 data-[open]:ring-blue-500">
```

That is 18 utility classes encoding what amounts to:

```css
.trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--size-2);
  padding: var(--size-2) var(--size-3);
  border: 1px solid var(--gray-4);
  border-radius: var(--radius-2);
  background: var(--surface-1);
  font-size: var(--font-size-1);
  font-weight: var(--font-weight-5);
  color: var(--color-text);
  cursor: pointer;

  &:hover { background: var(--surface-2); }
  &:focus { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  &[data-disabled] { opacity: 0.5; cursor: not-allowed; }
  &[data-open] { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary); }
}
```

The CSS version is longer in bytes but dramatically easier to read, modify,
and debug. It uses real property names. It nests related states. It refers
to design tokens by semantic name. A new team member can understand it in
seconds. The Tailwind version requires decoding a proprietary vocabulary
where `px-3` means `padding-inline: 0.75rem` and `ring-offset-2` means
`--tw-ring-offset-width: 2px`.

When you need to change the hover state, the CSS version has one line to
find. The Tailwind version requires scanning a wall of classes to find
`hover:bg-gray-50` among 18 siblings.

### Dark mode doubles everything

Tailwind's dark mode requires prefixing every color-related class:

```html
<div class="bg-white text-gray-900 border-gray-200
            dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700">
```

Six classes for what should be three CSS custom property swaps:

```css
:root {
  --surface: var(--gray-0);
  --text: var(--gray-9);
  --border: var(--gray-3);
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface: var(--gray-11);
    --text: var(--gray-1);
    --border: var(--gray-8);
  }
}
```

Define your tokens once. Every component that uses `var(--surface)`
automatically adapts to dark mode. No `dark:` prefix on every class. No
doubling of your markup. No possibility of forgetting a `dark:` variant
and having one element stay light-themed.

### Responsive design compounds the problem

Add responsive breakpoints and the class strings explode:

```html
<div class="flex flex-col sm:flex-row md:grid md:grid-cols-2 lg:grid-cols-3
            gap-2 sm:gap-4 md:gap-6 p-2 sm:p-4 md:p-6">
```

The CSS equivalent:

```css
.layout {
  display: flex;
  flex-direction: column;
  gap: var(--size-2);
  padding: var(--size-2);

  @media (width >= 640px) { flex-direction: row; gap: var(--size-4); padding: var(--size-4); }
  @media (width >= 768px) { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--size-6); padding: var(--size-6); }
  @media (width >= 1024px) { grid-template-columns: repeat(3, 1fr); }
}
```

Structured. Readable. Each breakpoint is a self-contained block you can
understand in isolation. The Tailwind version scatters responsive decisions
across a flat list of prefixed classes.

And with container queries — which Tailwind has limited support for — the
CSS approach pulls even further ahead:

```css
.sidebar {
  container-type: inline-size;
}

@container (width >= 400px) {
  .sidebar .nav { flex-direction: row; }
}
```

### Escape hatches defeat the purpose

When Tailwind's utility vocabulary doesn't cover your need, you use
arbitrary value syntax:

```html
<div class="grid grid-cols-[1fr_2fr_1fr] gap-[clamp(1rem,3vw,2rem)]
            max-w-[calc(100vw-var(--sidebar-width))]">
```

At this point you're writing CSS — but with worse syntax, inside square
brackets, in a class attribute, without nesting or custom properties. The
design system constraint — the whole point of utility classes — is gone.
You're back to ad-hoc values, just with more friction.

### Template coupling

Tailwind merges styling decisions into markup structure. Changing the
visual design of a button requires editing every template that renders a
button. CSS separates these concerns — change the `.button` rule once and
every button updates. This isn't theoretical; it's the difference between
updating one file and updating fifty.

The `cn()` utility and `cva()` (class-variance-authority) exist specifically
to work around this problem — they extract Tailwind classes into JavaScript
functions, which is just writing CSS in JavaScript with extra steps.

---

## Why Not CSS-in-JS

Libraries like Emotion and styled-components parse CSS strings at runtime,
hash them into generated class names, inject `<style>` tags into the
document, and manage a style cache — all in JavaScript.

This adds a runtime dependency (Emotion is ~11KB), makes styles inseparable
from the component's JS bundle, and locks consumers into the library's API
and theme system. You can't restyle a component without modifying its source
code or fighting specificity wars.

Our approach is the opposite: behavior lives in Rip, styling lives in CSS,
and the `data-*` attribute contract is the interface between them. The
result is faster (no CSS parsing in JS), smaller (no styling runtime), and
more flexible (swap your entire design system without touching widget code).

---

## Why Not Sass / Less

Native CSS nesting, `color-mix()`, custom properties, and `@layer`
eliminate every feature that justified preprocessors:

| Sass Feature | Native CSS Equivalent |
|-------------|----------------------|
| `$variables` | `var(--custom-property)` — plus they cascade and respond to media queries |
| Nesting | Native nesting with `&` |
| `darken()` / `lighten()` | `color-mix(in oklch, var(--color), black 15%)` |
| `@import` partials | `@layer` for cascade control, `@import` for modules |
| Mixins | CSS nesting + custom properties cover most cases |

Preprocessors add a compilation step, a dependency, and a non-standard
syntax. In 2026, they're unnecessary overhead.

---

## What We Use Instead

### Open Props — Design Tokens as CSS Custom Properties

[Open Props](https://open-props.style/) provides the same curated scales
that make Tailwind productive — spacing, color, shadow, radius, easing,
typography — as pure CSS custom properties. 4KB, no runtime, no build step.

```bash
bun add open-props
```

Import what you need:

```css
@import "open-props/sizes";
@import "open-props/colors";
@import "open-props/shadows";
@import "open-props/radii";
@import "open-props/easings";
@import "open-props/fonts";
```

**Token categories:**

- **Spacing** — `--size-1` through `--size-15` (0.25rem to 7.5rem)
- **Colors** — Full palettes (`--blue-0` through `--blue-12`, etc.) plus semantic surface tokens
- **Shadows** — `--shadow-1` through `--shadow-6`, progressively stronger
- **Radii** — `--radius-1` through `--radius-6` plus `--radius-round`
- **Easing** — `--ease-1` through `--ease-5` (standard) and `--ease-spring-1` through `--ease-spring-5`
- **Typography** — `--font-size-0` through `--font-size-8`, `--font-weight-1` through `--font-weight-9`, `--font-lineheight-0` through `--font-lineheight-5`

Define project-level semantic aliases:

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

This gives you the same design-system discipline as Tailwind — consistent
scales, constrained choices, curated defaults — without encoding any of it
into class names. Your styles reference `var(--size-4)` instead of `p-4`.
Same constraint, real CSS syntax, full cascade and media query support.

### Native CSS Architecture

**Nesting** — group related rules without BEM naming conventions:

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

**Cascade Layers** — control specificity without hacks:

```css
@layer base, components, overrides;

@layer base {
  button { font: inherit; }
}

@layer components {
  .dialog { border-radius: var(--radius-3); }
}
```

**Container Queries** — style based on container size, not viewport:

```css
.sidebar { container-type: inline-size; }

@container (min-width: 400px) {
  .sidebar .nav { flex-direction: row; }
}
```

**`color-mix()`** — derive colors without any preprocessor:

```css
.muted { color: color-mix(in oklch, var(--color-text), transparent 40%); }
.hover { background: color-mix(in oklch, var(--color-primary), black 15%); }
```

### Dark Mode

CSS custom property swapping — define once, applies everywhere:

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

For a manual toggle, use a `data-theme` attribute:

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

Every component that uses `var(--surface-1)` or `var(--color-text)`
automatically adapts. Zero per-component dark mode code.

---

## Common Patterns

These patterns demonstrate how Open Props + native CSS + `data-*` selectors
produce clean, maintainable component styles.

**Button:**

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

**Form Input:**

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

**Card:**

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

**Dialog:**

```css
.backdrop {
  position: fixed;
  inset: 0;
  background: oklch(0% 0 0 / 40%);
  display: grid;
  place-items: center;

  &[data-open] { animation: fade-in 150ms var(--ease-2); }
}

.panel {
  background: var(--surface-1);
  border-radius: var(--radius-3);
  padding: var(--size-6);
  box-shadow: var(--shadow-4);
  max-width: min(90vw, 32rem);
  width: 100%;
  animation: slide-in-up 200ms var(--ease-spring-3);
}
```

**Select:**

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

  &[data-open] { border-color: var(--color-primary); }
}

.option {
  padding: var(--size-2) var(--size-3);
  border-radius: var(--radius-1);
  cursor: pointer;

  &[data-highlighted] { background: var(--surface-2); }
  &[data-selected] { font-weight: var(--font-weight-6); color: var(--color-primary); }
}
```

**Tooltip:**

```css
.tooltip {
  background: var(--gray-10);
  color: var(--gray-0);
  font-size: var(--font-size-0);
  padding: var(--size-1) var(--size-2);
  border-radius: var(--radius-2);
  max-width: 20rem;

  &[data-entering] { animation: fade-in 100ms var(--ease-2); }
  &[data-exiting]  { animation: fade-out 75ms var(--ease-2); }
}
```

---

## The Productivity Argument

Tailwind feels fast because you never leave the template. We don't dispute
that. For quick prototypes and one-off pages, utility classes reduce context
switching.

But productivity at scale is about maintenance, not initial velocity. Here's
where our approach wins:

**Readability.** CSS property names are self-documenting. `padding: var(--size-3)`
is immediately clear. `px-3` requires knowing Tailwind's vocabulary. New
team members read CSS on day one; they learn Tailwind over weeks.

**Debuggability.** DevTools shows computed styles as CSS properties. When
something looks wrong, you inspect the element and see real CSS. With
Tailwind, you see a list of atomic class names and have to mentally decode
which one is responsible.

**Refactorability.** Change a design token once, every usage updates. Change
a component's class list once, every instance updates. Tailwind scatters
styling decisions across every template, making visual refactors proportional
to template count rather than component count.

**Hot reload.** CSS file changes hot-reload without losing component state.
The dev server sends an SSE event, the browser re-fetches stylesheets, and
the UI updates instantly — no page reload, no state loss. Tailwind classes
in markup require a full template recompile.

**Grep-ability.** Search for `border-radius` and find every place it's set.
Search for `rounded-lg` and you find Tailwind usage but miss `rounded-md`,
`rounded-xl`, and `rounded-[12px]`. CSS property names are the universal
vocabulary; utility classes are a proprietary dialect.

**No build step.** No PostCSS. No JIT compilation. No purge configuration.
No `tailwind.config.js`. CSS files work in every browser, every tool, and
every workflow without transformation.

---

## The Direction for 2026

The web platform is converging on a clear model:

1. **Design tokens** as CSS custom properties (Open Props, or your own)
2. **Scoped styles** via cascade layers, native nesting, and `@scope`
3. **Semantic selectors** targeting `data-*` attributes for state
4. **Platform features** like `color-mix()`, container queries, and `:has()`

This is the utility CSS ethos — constrained, systematic, design-system-driven —
implemented with the tools CSS was designed to provide. No class name encoding.
No build step. No proprietary vocabulary. No framework dependency.

Tailwind was the right answer when the platform couldn't do this. The
platform can do this now. The right move is to use it directly.

Our stack:

| Layer | Tool | Role |
|-------|------|------|
| **Behavior** | Rip Widgets | Accessible headless components |
| **Design Tokens** | Open Props | Consistent scales for spacing, color, shadow, radius, easing, typography |
| **Scoping** | Native CSS | Nesting, `@layer`, `@scope`, `data-*` selectors |
| **State Styling** | `$` sigil | `$open`, `$selected` → `[data-open]`, `[data-selected]` in CSS |
| **Dark Mode** | `prefers-color-scheme` | CSS variable swapping, zero per-component code |
| **Platform** | Modern CSS | `color-mix()`, container queries, `:has()`, `oklch()` |

No runtime. No build step. No framework lock-in. CSS as CSS was meant to be.
