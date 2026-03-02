# Styling Philosophy

Rip UI ships zero CSS. Widgets expose semantic state through `data-*`
attributes. You write the styles. This document explains why — and why
we believe it's the most productive approach available in 2026.

---

## The Utility CSS Insight Is Correct

Tailwind proved something important: design-system-driven, constrained
styling is more productive than ad-hoc CSS. Consistent spacing scales,
curated color palettes, and predictable naming conventions eliminate
decision fatigue and keep UIs coherent. That insight is correct and we
embrace it fully.

But the insight and the implementation are different things. Tailwind
implements this insight by encoding CSS properties as class names applied
to HTML elements. In 2016, when CSS lacked nesting, custom properties
were poorly supported, and preprocessors were mandatory, that trade-off
made sense.

CSS has changed dramatically since then. The question is whether the
trade-off still holds.

---

## What CSS Can Do Now

Every major browser ships these features with full support:

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

These aren't experimental features behind flags. They're the baseline.
The reasons people originally reached for Sass, CSS-in-JS, and utility
classes are largely resolved by the platform itself.

Tailwind v4 acknowledged this shift — it moved toward CSS-native
configuration with `@theme`, dropped `tailwind.config.js` in favor of
CSS-first setup, and leans more heavily on CSS custom properties. That's
the right direction. Our position is simply: if the destination is
CSS-native tooling, why not go all the way?

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

**This works with Tailwind too.** If your team uses Tailwind, the `data-*`
contract integrates naturally via Tailwind's data attribute variants:

```html
<button class="data-[open]:border-blue-500 data-[disabled]:opacity-50">
```

We don't force you away from Tailwind. We just think that once you see the
alternative, you may not want it.

---

## The Case for Native CSS

### Class strings vs. structured CSS

A real Tailwind component from production code:

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

The CSS equivalent:

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

The CSS version is longer in bytes but each property is named, states are
nested and grouped, and design tokens are referenced by semantic name. When
you need to change the hover state, there's one line to find. In the Tailwind
version, you scan 18 classes to locate `hover:bg-gray-50`.

Tailwind's IDE extension (IntelliSense) makes authoring fast — we acknowledge
that. But reading and modifying class strings months later, especially by
someone who didn't write them, is where the friction appears.

### Dark mode

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

Define tokens once. Every component that uses `var(--surface)` automatically
adapts. No `dark:` prefix per class. No doubling of markup. No risk of
forgetting a `dark:` variant on one element.

### Responsive design

Add responsive breakpoints and class strings compound:

```html
<div class="flex flex-col sm:flex-row md:grid md:grid-cols-2 lg:grid-cols-3
            gap-2 sm:gap-4 md:gap-6 p-2 sm:p-4 md:p-6">
```

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

Each breakpoint is a self-contained block. And with container queries — where
CSS has a structural advantage — the gap widens further:

```css
.sidebar { container-type: inline-size; }

@container (width >= 400px) {
  .sidebar .nav { flex-direction: row; }
}
```

### Escape hatches

When Tailwind's vocabulary doesn't cover a need, you use arbitrary values:

```html
<div class="grid grid-cols-[1fr_2fr_1fr] gap-[clamp(1rem,3vw,2rem)]
            max-w-[calc(100vw-var(--sidebar-width))]">
```

At this point you're writing CSS — but inside square brackets, in a class
attribute, without nesting or custom properties. The design system constraint
that justified utility classes is gone.

### Template coupling

Tailwind merges styling decisions into markup. Changing a button's visual
design requires editing every template that renders a button. CSS separates
these — change the `.button` rule once, every button updates.

The `cn()` utility and `cva()` (class-variance-authority) exist specifically
to work around this — extracting Tailwind classes into JavaScript functions.
That's writing CSS in JavaScript with extra steps.

---

## The Social Argument

We want to address this directly: Tailwind's greatest strength isn't
technical. It's social. Tailwind has massive adoption, a huge community,
abundant templates and examples, and it's a common hiring requirement. If
you're building a team, "knows Tailwind" filters candidates efficiently.
These are real, practical advantages.

Our counterargument:

**CSS knowledge is more transferable than Tailwind knowledge.** Tailwind is
one tool. CSS is the platform. A developer fluent in modern CSS can use
Tailwind, but also vanilla CSS, Open Props, CSS Modules, or whatever comes
next. A developer who only knows Tailwind's vocabulary has to learn CSS
anyway when they hit a case Tailwind doesn't cover — and those cases are
more common than Tailwind's marketing suggests.

**The community advantage is temporary; the technical advantage is
permanent.** Tailwind's community grew because it solved real problems in
2017-2022 CSS. As native CSS closes those gaps, the pressure to adopt
Tailwind specifically decreases. The skills you build with modern CSS —
custom properties, nesting, layers, container queries — will still be
relevant in 2030. Tailwind's class vocabulary may not be.

**Team velocity comes from the design system, not the syntax.** The reason
Tailwind teams move fast isn't the class names — it's the constrained design
tokens (spacing scale, color palette, radius options). Open Props provides
the same constraints as pure CSS custom properties. The velocity comes from
the system, not from encoding it into class attributes.

We aren't saying Tailwind is wrong. We're saying it solved yesterday's
problems well, and there's a cleaner path forward now that the platform has
caught up.

---

## Why Not CSS-in-JS

Libraries like Emotion and styled-components parse CSS strings at runtime,
hash them into generated class names, inject `<style>` tags into the
document, and manage a style cache — all in JavaScript.

This adds a runtime dependency (Emotion is ~11KB), makes styles inseparable
from the component's JS bundle, and locks consumers into the library's API.
You can't restyle a component without modifying its source or fighting
specificity.

Our approach is the opposite: behavior lives in Rip, styling lives in CSS,
and the `data-*` attribute contract is the interface. Faster (no CSS parsing
in JS), smaller (no styling runtime), more flexible (swap your design system
without touching widget code).

---

## Why Not Sass / Less

Native CSS nesting, `color-mix()`, custom properties, and `@layer` eliminate
every feature that justified preprocessors:

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
typography — as pure CSS custom properties. 4KB of static CSS, no runtime,
no build step.

Open Props is a convenience, not a requirement. You can define your own
custom property scales and skip it entirely. We recommend it because it's
well-designed and saves the work of building a token system from scratch.

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
- **Colors** — Full palettes (`--blue-0` through `--blue-12`, etc.)
- **Shadows** — `--shadow-1` through `--shadow-6`, progressively stronger
- **Radii** — `--radius-1` through `--radius-6` plus `--radius-round`
- **Easing** — `--ease-1` through `--ease-5`, plus spring variants
- **Typography** — `--font-size-0` through `--font-size-8`, weights, line-heights

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

Same design-system discipline as Tailwind — consistent scales, constrained
choices, curated defaults — without encoding any of it into class names.

### Native CSS Architecture

**Nesting** — group related rules without BEM conventions:

```css
.card {
  padding: var(--size-4);

  & .title {
    font-size: var(--font-size-4);
    font-weight: var(--font-weight-7);
  }

  &:hover { box-shadow: var(--shadow-3); }
}
```

**Cascade Layers** — control specificity without hacks:

```css
@layer base, components, overrides;

@layer base { button { font: inherit; } }
@layer components { .dialog { border-radius: var(--radius-3); } }
```

**Container Queries** — style based on container, not viewport:

```css
.sidebar { container-type: inline-size; }

@container (min-width: 400px) {
  .sidebar .nav { flex-direction: row; }
}
```

**`color-mix()`** — derive colors without a preprocessor:

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

For a manual toggle:

```css
[data-theme="dark"] {
  --surface-1: var(--gray-11);
  --surface-2: var(--gray-10);
  --color-text: var(--gray-1);
}
```

Every component using `var(--surface-1)` adapts automatically. Zero
per-component dark mode code.

---

## Common Patterns

How Open Props + native CSS + `data-*` selectors work in practice:

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
```

**Form Input:**

```css
.input {
  padding: var(--size-2) var(--size-3);
  border: 1px solid var(--gray-4);
  border-radius: var(--radius-2);
  background: var(--surface-1);
  color: var(--color-text);
  transition: border-color 150ms var(--ease-2);

  &:focus { outline: 2px solid var(--color-primary); outline-offset: 1px; }
  &[data-invalid] { border-color: var(--color-danger); }
  &[data-disabled] { opacity: 0.5; }
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
}
```

**Select:**

```css
.trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--size-2) var(--size-3);
  border: 1px solid var(--gray-4);
  border-radius: var(--radius-2);
  background: var(--surface-1);
  cursor: pointer;

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

---

## The Productivity Argument

Tailwind feels fast because you never leave the template. For quick
prototypes, utility classes reduce context switching. We don't dispute that.

But productivity at scale is about maintenance, not initial velocity. Here
are concrete scenarios where our approach wins:

**Rebranding.** Your product changes its primary color from blue to purple.
With CSS custom properties: change `--color-primary: var(--indigo-7)` to
`--color-primary: var(--violet-7)` in one line. Every button, link, focus
ring, and selection highlight across your entire app updates. With Tailwind:
find and replace `text-blue-600` with `text-violet-600`, `bg-blue-500` with
`bg-violet-500`, `ring-blue-500` with `ring-violet-500`, `border-blue-300`
with `border-violet-300` — across every template. Miss one and the UI is
visually inconsistent. In a 50-component app, that's hundreds of class
string edits vs. one CSS line.

**Dark mode.** Your app needs dark mode. With CSS variables: add one
`@media (prefers-color-scheme: dark)` block that swaps 8-10 surface and
text tokens. Done — every component adapts. With Tailwind: audit every
template for color classes and add `dark:` variants. A Select trigger
needs `dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200`. A
Dialog backdrop needs `dark:bg-black/50`. Every component, every color.
Miss one and that element stays light-themed on dark backgrounds.

**Debugging.** A button's padding looks wrong. Open DevTools, inspect the
element. With CSS: you see `padding: var(--size-2) var(--size-4)` — the
property, the values, the cascade. Click to toggle, edit, understand. With
Tailwind: you see a class list including `px-3 py-2`. You identify the
padding classes, but you can't tell if they're being overridden by another
utility, a responsive variant, or an arbitrary value somewhere in the
string. The Computed panel helps, but the connection from the computed
value back to which class is responsible is indirect.

**CSS iteration.** You're tweaking a dialog's entrance animation. With CSS:
edit the `.panel` animation rule, save the `.css` file. The dev server sends
an SSE event, the browser re-fetches the stylesheet, and the animation
updates — the dialog stays open, the form stays filled, component state is
preserved. With Tailwind: the animation is in a class string in the template.
Change it, the template recompiles, the page reloads, the dialog closes, the
form empties. Re-open the dialog, re-fill the form, check the animation.
Repeat.

**Onboarding.** A new developer joins the team. CSS property names are the
web platform — `border-radius`, `padding`, `color`, `display`. They already
know them. Tailwind's vocabulary — `rounded-lg`, `px-3`, `text-gray-700`,
`flex` — maps to those properties but requires learning the mapping first.
`ring-offset-2` means `--tw-ring-offset-width: 2px`. `tracking-tight` means
`letter-spacing: -0.025em`. The learning curve is real, even if IDE
extensions help.

**No build step.** CSS files work in every browser, every tool, every
workflow without transformation. No PostCSS. No JIT compilation. No purge
configuration. No `tailwind.config.js`. One fewer thing to break, debug,
and maintain.

---

## Summary

The web platform is converging on a clear model:

1. **Design tokens** as CSS custom properties (Open Props, or your own)
2. **Scoped styles** via cascade layers, native nesting, and `@scope`
3. **Semantic selectors** targeting `data-*` attributes for state
4. **Platform features** like `color-mix()`, container queries, and `:has()`

This is the utility CSS ethos — constrained, systematic, design-system-driven —
implemented with the tools CSS was designed to provide.

Our stack:

| Layer | Tool | Role |
|-------|------|------|
| **Behavior** | Rip Widgets | Accessible headless components |
| **Design Tokens** | Open Props | Consistent scales for spacing, color, shadow, radius, easing, typography |
| **Scoping** | Native CSS | Nesting, `@layer`, `@scope`, `data-*` selectors |
| **State Styling** | `$` sigil | `$open`, `$selected` → `[data-open]`, `[data-selected]` in CSS |
| **Dark Mode** | `prefers-color-scheme` | CSS variable swapping, zero per-component code |
| **Platform** | Modern CSS | `color-mix()`, container queries, `:has()`, `oklch()` |

No runtime. No build step. No framework lock-in.

And if you still want Tailwind — the `data-*` contract works with it. We
just think you won't need it.
