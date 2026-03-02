# Why Rip UI

You know ShadCN. You've built with Radix. You understand the headless
component model and you appreciate what it gives you — behavior separated
from styling, WAI-ARIA compliance, keyboard navigation out of the box.

This document explains why Rip UI takes that same philosophy further, and
why the result is worth your attention.

---

## The Short Version

ShadCN is the best component experience possible within React's constraints.
Rip UI removes those constraints entirely.

| | ShadCN / Radix | Rip UI |
|--|---------------|--------|
| Runtime dependency | React (~42KB gz) + ReactDOM | None |
| Component count | ~40 | 57 |
| Total source | ShadCN wrappers (~3K LOC) atop Radix Primitives (~20K+ LOC) | 5,254 LOC — everything included |
| Build step | Required (Next.js, Vite, etc.) | None — browser compiles `.rip` source directly |
| Styling approach | Pre-wired Tailwind (ShadCN) or unstyled (Radix) | Zero CSS — `data-*` attribute contract, any CSS methodology |
| Controlled components | `value` + `onChange` callback pair | `<=>` two-way binding operator |
| Shared state | React Context + Provider wrappers | `offer` / `accept` keywords |
| Reactivity | `useState` + `useEffect` + dependency arrays | `:=` / `~=` / `~>` — language-level operators |
| Virtual DOM | Yes (diffing overhead on every render) | No — fine-grained DOM updates to exactly the nodes that changed |
| Data grid | Not available | 901 lines — virtual scroll, 100K+ rows at 60fps, Sheets-grade UX |
| Other dependencies | class-variance-authority, clsx, tailwind-merge, lucide-react | Zero |

---

## What React Forces, and What Rip Doesn't

### The Sub-Component Tax

Radix components look like this:

```tsx
<Tabs.Root value={tab} onValueChange={setTab}>
  <Tabs.List>
    <Tabs.Trigger value="one">Tab One</Tabs.Trigger>
    <Tabs.Trigger value="two">Tab Two</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="one">Content for tab one</Tabs.Content>
  <Tabs.Content value="two">Content for tab two</Tabs.Content>
</Tabs.Root>
```

`Tabs.Root`, `Tabs.List`, `Tabs.Trigger`, `Tabs.Content` — four separate
sub-components. This isn't a design choice. It's a constraint of React.
React components cannot inspect or control their children's rendering. The
only way for a parent to share state with descendants is through a Context
Provider wrapper, which forces every compound component into multiple
sub-components wired together by context.

Rip doesn't have this limitation:

```coffee
Tabs active <=> currentTab
  div $tab: "one", "Tab One"
  div $tab: "two", "Tab Two"
  div $panel: "one"
    p "Content for tab one"
  div $panel: "two"
    p "Content for tab two"
```

Same ARIA roles. Same keyboard navigation. Same roving tabindex. The widget
discovers its children via `data-*` attributes, manages focus internally, and
exposes state through `$active` for styling. No wrappers, no context, no
ceremony.

This isn't a toy simplification — the Tabs widget is 124 lines of source
with full WAI-ARIA compliance, horizontal/vertical orientation, automatic
and manual activation modes, disabled tab support, and animated direction
tracking.

### The Controlled Component Tax

In React, every interactive component requires a value prop and an onChange
callback:

```tsx
const [show, setShow] = useState(false);
<Dialog open={show} onOpenChange={setShow} />

const [name, setName] = useState('');
<input value={name} onChange={e => setName(e.target.value)} />
```

Two declarations per binding. The state, the setter, the prop, the callback.
Multiply by every form field, every dialog, every select, every toggle in
your app.

Rip has a two-way binding operator:

```coffee
Dialog open <=> showDialog
input value <=> @name
Select value <=> selectedRole
```

One operator. The parent's signal is passed directly to the child — they
share the same reactive object. Mutations in either direction are instantly
visible to both. No callback props, no setter functions, no boilerplate.

This is what Vue has with `v-model` and Svelte has with `bind:`, but Rip's
`<=>` works uniformly across HTML elements and custom components with one
consistent operator. React cannot do this at all — it's architecturally
impossible without a fundamental change to the rendering model.

### The Hook Tax

React's reactivity is bolted on through hooks with manual dependency tracking:

```tsx
const [count, setCount] = useState(0);
const doubled = useMemo(() => count * 2, [count]);
useEffect(() => {
  document.title = `Count: ${count}`;
  return () => { /* cleanup */ };
}, [count]);
```

Three APIs. Dependency arrays you must maintain manually. Stale closure bugs
when you forget a dependency. Rules-of-hooks that forbid conditionals. Lint
rules to catch what the language can't enforce.

Rip's reactivity is in the language itself:

```coffee
count := 0
doubled ~= count * 2
~> document.title = "Count: #{count}"
```

Three operators. No dependency arrays — the runtime tracks what each
expression reads automatically. No stale closures — effects re-run with
current values. No rules to memorize. An effect that returns a function
automatically cleans up when its dependencies change.

| Need | React | Rip |
|------|-------|-----|
| Mutable state | `useState` hook | `:=` operator |
| Derived value | `useMemo` + dependency array | `~=` (auto-tracked) |
| Side effect | `useEffect` + dependency array + cleanup return | `~>` (auto-tracked, auto-cleanup) |
| DOM reference | `useRef` + `ref` prop | `ref:` attribute |
| Context sharing | `createContext` + Provider + `useContext` | `offer` / `accept` keywords |
| Two-way binding | Impossible — value + onChange pair | `<=>` operator |

---

## Truly Headless, Not Pre-Styled

ShadCN's value proposition is "beautifully designed components you can copy
and paste into your apps." The components come pre-wired with Tailwind
classes, and for prototyping or projects that match the default aesthetic,
that's genuinely fast. The friction appears when your design system
diverges — then you're reverse-engineering `cn()` merges, fighting
Tailwind specificity, and wondering which utility class is winning.

Rip UI takes a different position: **the widget ships zero CSS**. Literally
none. The contract between behavior and styling is explicit `data-*`
attributes exposed via the `$` sigil:

```coffee
# Widget source — semantic state only
button $open: open?!, $disabled: @disabled?!
div $highlighted: (idx is highlightedIndex)?!
div $selected: (@value is current)?!
```

```css
/* Your stylesheet — any methodology you want */
[data-open]        { border-color: var(--color-primary); }
[data-highlighted] { background: var(--surface-2); }
[data-selected]    { font-weight: 600; color: var(--color-primary); }
[data-disabled]    { opacity: 0.5; cursor: not-allowed; }
```

No JavaScript styling logic. No className toggling. No CSS-in-JS runtime.
No `cn()` utility. Write `$open` in Rip, style `[data-open]` in CSS. Any
CSS methodology works — vanilla CSS, Tailwind, Open Props, a custom design
system, or something that doesn't exist yet. The widgets don't care.

This is the separation of concerns that CSS was designed for. Behavior in
one file, styling in another, and a clean `data-*` attribute interface
between them.

---

## Code Density: What 5,254 Lines Buys You

### Checkbox — 33 Lines

```coffee
export Checkbox = component
  @checked := false
  @disabled := false
  @indeterminate := false
  @switch := false

  onClick: ->
    return if @disabled
    @indeterminate = false
    @checked = not @checked
    @emit 'change', @checked

  render
    button role: @switch ? 'switch' : 'checkbox'
      aria-checked: @indeterminate ? 'mixed' : !!@checked
      aria-disabled: @disabled?!
      $checked: @checked?!
      $indeterminate: @indeterminate?!
      $disabled: @disabled?!
      slot
```

Full ARIA. Checkbox and switch mode. Indeterminate state. Custom events.
Data attributes for styling. 33 lines, complete.

The ShadCN Checkbox wrapper is ~40 lines. Underneath it,
`@radix-ui/react-checkbox` adds hundreds more. The Rip version has the
same behavior — correct ARIA roles, keyboard handling, indeterminate
state — in a single file with no dependencies underneath.

### Dialog — 107 Lines

Focus trap. Scroll lock. Escape dismiss. Click-outside dismiss. Focus
restore. Stacked dialog support. Auto-wired `aria-labelledby` and
`aria-describedby`. Initial focus targeting.

All of it in one reactive effect with automatic cleanup:

```coffee
~>
  if @open
    _prevFocus = document.activeElement
    # ... lock scroll, trap focus, wire ARIA ...
    return ->
      # ... unlock scroll, restore focus (runs automatically when @open becomes false)
```

No `useEffect`. No dependency array. No cleanup function that might capture
stale state. The effect tracks `@open` automatically and the returned
function runs when the reactive context changes.

Radix Dialog is spread across `DialogRoot`, `DialogTrigger`, `DialogOverlay`,
`DialogContent`, `DialogTitle`, `DialogDescription`, `DialogClose` — seven
sub-components — plus internal hooks for focus scope, dismissal layers,
and portal management. Thousands of lines across multiple files.

### Select — 184 Lines

Keyboard navigation. Typeahead (type "eng" to jump to "Engineer"). ARIA
listbox roles. Anchor positioning with flip. Click-outside dismiss.
Disabled option support. Hidden slot pattern for declarative option reading.

The entire widget, soup to nuts, in one file.

Radix Select uses `SelectRoot`, `SelectTrigger`, `SelectValue`,
`SelectContent`, `SelectViewport`, `SelectItem`, `SelectItemText`,
`SelectItemIndicator`, `SelectGroup`, `SelectLabel`, `SelectSeparator`,
`SelectScrollUpButton`, `SelectScrollDownButton` — thirteen sub-components.
ShadCN wraps this into a simpler API, but the Radix primitives still run
underneath.

### Grid — 901 Lines

This is the one that has no equivalent in ShadCN, Radix, Base UI, or
Headless UI.

901 lines for:
- Virtual scrolling — renders only visible rows, handles 100K+ rows at 60fps
- DOM recycling — pooled `<tr>` elements, zero allocation per scroll frame
- Google Sheets-style cell selection with anchor/active model
- Full keyboard navigation — arrows, Tab, Enter/F2 edit, Ctrl+Arrow data-boundary jump, PageUp/Down, Home/End
- Inline editing — double-click, Enter, F2, or type-to-edit
- Multi-column sorting — click header, Shift+click for secondary sort
- Column resizing — drag header borders
- Full clipboard — Ctrl+C/V/X with TSV format (interop with Excel, Google Sheets, Numbers)
- Smart Enter — commit-stay on first press, move-down-and-edit on second

The equivalent in the React world is AG Grid (enterprise license, massive
bundle) or Handsontable (50,000+ lines plus plugins). The Grid demonstrates
something React fundamentally cannot do cleanly: mixing reactive rendering
(table structure, headers, selection overlay) with imperative DOM manipulation
(60fps scroll of 50 rows per frame) in one component. In Rip, you write
imperative DOM inside a `~>` effect — the effect triggers reactively, but the
DOM updates use `textContent` and `replaceChildren` directly. It's natural.
In React, breaking out of the virtual DOM requires `useRef` gymnastics,
`useLayoutEffect` timing hacks, and fighting the reconciler.

---

## 57 Components, 10 Categories

| Category | Components |
|----------|-----------|
| **Selection** | Select, Combobox, MultiSelect, Autocomplete |
| **Toggle** | Checkbox, Toggle, ToggleGroup, RadioGroup, CheckboxGroup |
| **Input** | Input, Textarea, NumberField, Slider, OTPField, DatePicker, EditableValue, NativeSelect, InputGroup |
| **Navigation** | Tabs, Menu, ContextMenu, Menubar, NavMenu, Toolbar, Breadcrumb |
| **Overlay** | Dialog, AlertDialog, Drawer, Sheet, Popover, Tooltip, PreviewCard, Toast |
| **Display** | Button, Badge, Card, Separator, Progress, Meter, Spinner, Skeleton, Avatar, AspectRatio, Kbd, Label, ScrollArea |
| **Form** | Field, Fieldset, Form, ButtonGroup |
| **Data** | Grid, Accordion, Table |
| **Interactive** | Collapsible, Pagination, Carousel, Resizable |

Every widget:
- Handles all keyboard interactions per WAI-ARIA Authoring Practices
- Sets ARIA attributes automatically
- Exposes state via `data-*` attributes for CSS styling
- Ships zero CSS
- Has no dependencies

---

## The Architecture Advantage

### Fine-Grained Reactivity, Not Virtual DOM Diffing

React re-renders entire component subtrees when state changes, then diffs
the virtual DOM against the real DOM to figure out what actually needs to
change. This is why React needs `useMemo`, `useCallback`, `React.memo`,
and extensive memoization strategies — the default behavior is wasteful,
and performance requires you to opt in to efficiency.

Rip's reactive system tracks which DOM nodes depend on which state values.
When `count` changes, only the text node displaying `count` updates. No
tree diffing. No wasted renders. No memoization needed. This is the same
model as SolidJS and Svelte 5's runes, but built into the language rather
than bolted on as a library or compiler transform.

### Components Compile to Standard JavaScript

Rip components compile to plain ES2022 JavaScript classes. There's no
framework runtime interpreting component definitions at execution time.
The `component` keyword, `render` block, and reactive operators are all
resolved at compile time into efficient DOM operations. The output is
readable, debuggable JavaScript — you can inspect it in DevTools, set
breakpoints on generated code, and trace through the logic. Source maps
point back to the original `.rip` source for debugging. The result is fast
and small — there's nothing to tree-shake because there's nothing unused
to ship.

### No Build Pipeline

Rip UI components are plain `.rip` source files. The browser loads the Rip
compiler (~50KB) once and compiles components on the fly. No webpack, no
Vite, no Next.js, no `npm run build`, no `node_modules` tree with 500
transitive dependencies.

For production, the components can be pre-compiled. For development, the
browser-compile model means instant iteration — save the file, see the
change. The dev server provides SSE-based hot reload: `.rip` changes trigger
a page reload, `.css` changes refresh stylesheets without losing component
state.

### Source as Distribution

ShadCN popularized the "copy the source into your project" model. Rip UI
takes this further: the source *is* the distribution. Components are served
as `.rip` files and compiled in the browser. You can read every widget's
implementation, understand it completely, and modify it if needed. There's
no compiled layer hiding behavior behind minified bundles.

```coffee
use serve
  dir: dir
  components: ['components', '../packages/ui']
```

That's the entire integration. Components become available by name in your
application's shared scope. No imports, no registration, no boilerplate.

---

## Honest Assessment

### What's Strong

- **The reactive model works.** Language-level `:=`, `~=`, `~>`, and `<=>`
  are genuinely better primitives than hooks. No dependency arrays, no stale
  closures, no rules-of-hooks violations.

- **The code density is real.** 57 components in 5,254 lines is not a
  toy — it's the result of the language having the right primitives. A
  Checkbox is 33 lines because that's how many lines a checkbox needs, not
  because corners were cut.

- **The headless contract is clean.** Behavior in Rip, styling in CSS,
  `data-*` attributes as the interface. No framework lock-in on the styling
  side.

- **The Grid proves the performance model.** Mixing reactive rendering with
  imperative DOM in one component — for real, at 60fps — validates the
  architecture for serious applications, not just demos.

- **The ARIA coverage is thorough.** Every interactive widget follows
  WAI-ARIA Authoring Practices: correct roles, keyboard patterns, focus
  management, screen reader announcements.

### What's Developing

- **Testing is early.** The widgets compile and run, but a comprehensive
  test suite is still being built. The compiler itself has 1,436 tests;
  the widget suite needs the same rigor.

- **No server-side rendering.** Rip UI runs in the browser. If your
  application requires SSR or React Server Components, this is a real
  constraint. For SPAs, dashboards, admin panels, internal tools, and any
  application where the client renders the UI, it's not a factor.

- **Rip is a new language.** The ecosystem is young. You won't find Stack
  Overflow answers or npm packages for every edge case. The trade-off is a
  cleaner foundation — no legacy patterns, no backward compatibility baggage.

- **Community is growing.** ShadCN has a massive community. Rip UI has the
  advantage of starting clean, but the disadvantage of starting small.

We're transparent about this because the architecture speaks for itself.
The gaps close with usage and testing, not with more abstractions.

---

## The Paradigm Shift

ShadCN proved that "headless behavior + styling convention" is the right
model for component libraries. It won that argument decisively.

The next question is: **does the behavior layer need React?**

Radix needs React because it uses hooks for state, Context for composition,
synthetic events for interaction, and a virtual DOM for rendering. Remove
any of those and the components break.

Rip UI doesn't need any of them. Reactive state is a language operator.
Composition uses `slot` and `offer`/`accept`. Events are native DOM events.
Rendering is direct DOM manipulation. The WAI-ARIA patterns are the same
because they come from the same spec. The keyboard interactions are the same
because they follow the same authoring practices. The only thing that changed
is the implementation substrate — and the result is dramatically less code,
zero dependencies, no build step, and fine-grained performance by default.

This isn't about React vs. Rip. It's about whether the web platform is
powerful enough to build component libraries without a virtual DOM runtime.

It is.

---

## Try It

```bash
cd packages/ui
rip server
# Open https://localhost:3005
```

Every widget has a live demo. Read the source — one file per component, no
dependencies to trace, no hooks to unwind, no context providers to follow.
The entire suite is 5,254 lines of `.rip` source that you can read in an
afternoon.

If you've built with ShadCN and Radix, you already understand the patterns.
The only new thing is the language — and it takes about 30 minutes to read
Rip code fluently. The reactive operators (`:=`, `~=`, `~>`, `<=>`) are the
entire learning curve.

The architecture is sound. The performance model is correct. The code is
honest. The rest is building on it.
