# Styling Philosophy

Rip UI ships zero CSS. Widgets expose semantic state through `data-*`
attributes. You bring your own styles — with whatever tool you prefer.

This document explains our recommendation (native CSS + design tokens),
honestly compares it to Tailwind, and acknowledges where each approach
wins.

---

## The Common Ground

Before comparing approaches, it's worth noting how much overlap there is.
Both sides of this debate agree on the fundamentals:

- **Design tokens are essential.** Constrained spacing scales, curated
  color palettes, and consistent naming eliminate decision fatigue. Any
  professional Tailwind setup uses semantic design tokens — `primary`,
  `surface`, `muted` — not raw color values like `blue-500` scattered
  across templates. We use CSS custom properties for the same purpose.

- **Dark mode should be token-based.** The best Tailwind teams define
  light and dark variants of each color token and reference them
  throughout the app — no `dark:` prefix per class. That's the same
  strategy as CSS custom property swapping. Both work. Neither requires
  per-component dark mode code when done properly.

- **Components solve reuse.** Production apps don't scatter raw utility
  classes across dozens of templates. They build components. Whether
  those components use Tailwind classes or CSS rules internally, the
  reuse story is identical.

The real differences are narrower than most articles suggest.

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

**This works with Tailwind too.** If your team uses Tailwind, the `data-*`
contract integrates naturally via Tailwind's data attribute variants:

```html
<button class="data-[open]:border-blue-500 data-[disabled]:opacity-50">
```

The widget doesn't know or care how you style it. That's the point — the
`data-*` contract is the interface, and it's styling-tool-agnostic.

---

## Where Tailwind Wins

We should be upfront about Tailwind's genuine strengths.

### Colocation

Tailwind's biggest advantage is that styles live right next to structure.
You see a `div` and immediately know how it looks. No jumping between
files, no searching for a class name in a stylesheet. This reduces
context switching and makes components self-contained in a way that
separate CSS files don't match.

With native CSS, you're maintaining two files per component (or a
combined stylesheet), and the mapping from element to rule
requires you to keep that mental link. Nesting and clear naming help,
but they don't eliminate the indirection.

### No naming

This is underrated. With Tailwind, you never need to invent a class name
for a wrapper `div` that exists only for layout. No `.card-header-inner`,
no `.sidebar-nav-wrapper`, no agonizing over BEM naming for elements that
have no semantic identity. You just style them inline with utilities and
move on.

With CSS, every element you want to style needs a selector. That means
either class names — which means naming things — or structural selectors
like `& > div:first-child`, which are fragile. The naming problem is
real and Tailwind eliminates it entirely.

### Conciseness

For responsive layouts especially, Tailwind is remarkably terse:

```html
<div class="flex flex-col sm:flex-row md:grid md:grid-cols-2 lg:grid-cols-3
            gap-2 sm:gap-4 md:gap-6 p-2 sm:p-4 md:p-6">
```

The CSS equivalent is more verbose:

```css
.layout {
  display: flex;
  flex-direction: column;
  gap: var(--size-2);
  padding: var(--size-2);

  @media (width >= 40rem) { flex-direction: row; gap: var(--size-4); padding: var(--size-4); }
  @media (width >= 48rem) { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--size-6); padding: var(--size-6); }
  @media (width >= 64rem) { grid-template-columns: repeat(3, 1fr); }
}
```

More lines, a class name to invent, and a separate file to maintain. If
your priority is brevity, Tailwind wins this comparison.

### Community and AI

Tailwind's community is massive and growing — templates, component
libraries, tutorials, StackOverflow answers, and hiring pipelines all
favor it. This is a compounding advantage, not a temporary one.

AI tools (Copilot, Claude, ChatGPT) are also exceptionally good at
writing Tailwind. The class vocabulary is well-represented in training
data, completions are fast, and the results are usually correct. This
makes Tailwind even more productive for AI-assisted workflows.

### Velocity from syntax

Design system discipline is the foundation, but syntax matters too. The
reason Tailwind teams move fast isn't just the constrained tokens — it's
that `rounded-lg px-4 py-2 bg-primary text-white` is genuinely quick to
type, quick to read for someone who knows the vocabulary, and quick to
iterate on. The shorthand class names are a layer of convenience on top
of the design system, and that layer has real value.

---

## Where Native CSS Wins

### Structured readability

Tailwind classes don't have to be a flat string. With `clsx` or `cn`,
teams structure them by concern — base layout, variant-conditional
styles, size, and pass-through:

```jsx
className={clsx(
  'flex items-center justify-center gap-x-3 rounded-lg relative transition disabled:opacity-50',
  {
    'bg-brand text-white hover:bg-brand-hover active:bg-brand-active': variant === 'primary',
    'border border-primary text-secondary hover:border-secondary hover:bg-secondary active:bg-tertiary': variant === 'secondary',
    'shadow-xs': shadow,
    'pointer-events-none': loading,
  },
  compact ? 'h-11 px-4 text-sm-plus font-medium' : 'h-12 px-5 text-base font-semibold',
)}
```

That's structured and readable — base styles, variants as a conditional
object, size as a ternary. It's not the flat wall of classes that critics
often caricature.

Native CSS organizes the same button differently — as nested rules
with named variants:

```css
.button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--size-3);
  border-radius: var(--radius-3);
  position: relative;
  transition: all 150ms var(--ease-2);

  &:disabled { opacity: 0.5; }
  &.loading { pointer-events: none; }
  &.shadow { box-shadow: var(--shadow-1); }

  /* Size */
  &.compact { height: 2.75rem; padding: 0 var(--size-4); font-size: var(--font-size-1); font-weight: var(--font-weight-5); }
  &:not(.compact) { height: 3rem; padding: 0 var(--size-5); font-size: var(--font-size-2); font-weight: var(--font-weight-7); }

  /* Variants */
  &.primary {
    background: var(--color-brand);
    color: white;
    &:hover { background: var(--color-brand-hover); }
    &:active { background: var(--color-brand-active); }
  }

  &.secondary {
    border: 1px solid var(--color-primary);
    color: var(--color-secondary);
    &:hover { border-color: var(--color-secondary); background: var(--surface-2); }
    &:active { background: var(--surface-3); }
  }
}
```

Both approaches group styles logically. The difference is the medium:
`clsx` groups utility classes in JavaScript, CSS groups property
declarations in a stylesheet. CSS has the advantage of explicit property
names (`background` vs `bg-brand-hover`) and nesting for variants
(`&.primary { &:hover }` vs inline conditional objects). Tailwind has
the advantage of colocation — everything is visible in one place without
a file switch.

This is genuinely a matter of preference and team familiarity, not an
objective win for either side.

### CSS-only hot reload

When styles live in a `.css` file, the dev server can hot-swap the
stylesheet without touching the DOM. Component state is preserved — a
dialog stays open, a form stays filled. You see the new animation
instantly without re-triggering anything.

Tailwind with modern HMR (Vite, etc.) also preserves component state
when classes change in a template — so the "page reloads and you lose
everything" scenario is largely a thing of the past. But CSS-only
reload is still faster and more granular: no template recompilation,
no reconciliation, just a stylesheet swap.

### No build dependency

CSS files work in every browser without transformation. No PostCSS, no
JIT compilation, no purge configuration. The `@import` of an Open Props
file requires either a bundler or a CDN link — so "zero build step" is
slightly aspirational — but the styling layer itself has no framework
dependency. CSS custom properties, nesting, layers, and container queries
are all native browser features.

Tailwind v4 has significantly reduced its configuration overhead (CSS-first
`@theme`, no more `tailwind.config.js`), but it still requires a build
step. For projects that value minimal tooling — which Rip projects tend
to — this matters.

### Platform durability

CSS is the web's styling language. Custom properties, nesting, `@layer`,
container queries, `color-mix()`, `:has()` — these features will work in
browsers in 2030. Tailwind's class vocabulary is an abstraction layer that
tracks CSS but doesn't define it. If you know CSS deeply, you can use any
tool. The reverse isn't always true.

This isn't a prediction that Tailwind will disappear — its community
momentum suggests otherwise. It's an observation that CSS knowledge is
strictly more general.

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

## What We Use

### Open Props — Design Tokens as CSS Custom Properties

[Open Props](https://open-props.style/) provides curated scales for
spacing, color, shadow, radius, easing, and typography as pure CSS custom
properties. ~4KB compressed (Brotli), no runtime.

Open Props uses a **numerical scale** (`--size-1` through `--size-15`,
`--radius-1` through `--radius-6`), while Tailwind uses a mixed vocabulary
of numerical (`p-4`, `gap-2`) and t-shirt sizes (`rounded-lg`, `text-sm`,
`shadow-md`). The two approaches are roughly equivalent in expressiveness.
Tailwind's t-shirt naming is arguably more intuitive for sizes where
absolute values don't matter (`sm`/`md`/`lg` reads more naturally than
`--radius-2`/`--radius-3`). Open Props' numerical scale is more
systematic when you need precise control or interpolation.

Open Props is a convenience, not a requirement. You can define your own
custom property scales and skip it entirely.

```bash
bun add open-props
```

Import what you need:

```css
@import "open-props/sizes";
@import "open-props/colors";
@import "open-props/shadows";
@import "open-props/borders";
@import "open-props/easings";
@import "open-props/fonts";
```

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

### Native CSS Architecture

**Nesting** — group related rules without BEM:

```css
.card {
  padding: var(--size-4);
  & .title { font-size: var(--font-size-4); font-weight: var(--font-weight-7); }
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

Tailwind also supports container queries (`@container` variants), so this
isn't a CSS-exclusive feature — but the native syntax is more natural for
complex container query logic with multiple conditions.

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

This is the same approach that well-configured Tailwind projects use —
define semantic tokens with light/dark variants and reference them
everywhere. The mechanism is identical. The difference is whether you
reference those tokens via `bg-surface-1` (Tailwind) or
`background: var(--surface-1)` (CSS).

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

## The Honest Trade-off

This isn't a clear-cut win for either side. Here's our best summary of
when each approach serves you better:

**Choose Tailwind when:**

- You want maximum authoring speed and your team knows the vocabulary
- Colocation of styles + markup is a high priority
- You're building with AI assistance (Tailwind is in every model's
  training data)
- You don't want to name intermediate layout elements
- You value the ecosystem of Tailwind UI, Headless UI, templates, etc.
- Your team is already productive with it

**Choose native CSS + tokens when:**

- You want styles to be independent of your component framework
- You prefer structured, grouped, nested rules over utility class strings
- You value minimal tooling and build dependencies
- You want to work closer to the web platform
- You're building a component library that should be styling-agnostic

For Rip UI specifically, we chose native CSS because headless components
should not prefer any styling tool. The `data-*` contract works equally
well with Tailwind classes, CSS rules, or any future approach. Shipping
zero CSS and zero opinions about how you style is the most honest thing
a headless library can do.

---

## Summary

Our stack:

| Layer | Tool | Role |
|-------|------|------|
| **Behavior** | Rip Widgets | Accessible headless components |
| **Contract** | `$` sigil | `$open`, `$selected` → `[data-open]`, `[data-selected]` — style however you want |
| **Design Tokens** | Open Props (or your own) | Consistent scales for spacing, color, shadow, radius, easing, typography |
| **Scoping** | Native CSS | Nesting, `@layer`, `@scope`, `data-*` selectors |
| **Dark Mode** | Custom properties | Token swapping — same strategy as well-configured Tailwind |
| **Platform** | Modern CSS | `color-mix()`, container queries, `:has()`, `oklch()` |

The `data-*` contract is the load-bearing idea. Everything else —
Open Props, native CSS, our specific token naming — is a recommendation,
not a requirement. Use Tailwind with these widgets if that's what your
team knows. We don't think you'll need it, but we designed the system so
that choice is yours.
