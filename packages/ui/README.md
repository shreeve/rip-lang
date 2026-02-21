<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip UI - @rip-lang/ui

> **Zero-build reactive web framework for the Rip language.**

Load the Rip compiler in the browser. Write inline Rip. Launch your app.
No build step, no bundler, no configuration.

## Quick Start

**`index.rip`** — the server:

```coffee
import { get, use, start, notFound } from '@rip-lang/api'
import { ripUI } from '@rip-lang/ui/serve'

dir = import.meta.dir
use ripUI dir: dir, components: 'routes', includes: ['ui'], watch: true, title: 'My App'
get '/css/*', -> @send "#{dir}/css/#{@req.path.slice(5)}"
notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'
start port: 3000
```

**`index.html`** — the page:

```html
<script type="module" src="/rip/rip-ui.min.js"></script>
```

**`pages/index.rip`** — a page component:

```coffee
export Home = component
  @count := 0
  render
    .
      h1 "Hello from Rip UI"
      button @click: (-> @count += 1), "Clicked #{@count} times"
```

Run `bun index.rip`, open `http://localhost:3000`.

## The Two Keywords

Rip UI adds two keywords to the language: `component` and `render`. Each
serves a distinct role, and together they form a complete reactive UI model.

### `component` — the model

Raw Rip Lang has no concept of a self-contained, reusable UI unit. The
`component` keyword adds everything needed to manage interactive state:

- **Reactive state** (`:=`) — assignments create signals that trigger
  updates automatically. `count := 0` is not a plain variable; changing
  it updates the DOM.
- **Computed values** (`~=`) — derived values that recalculate when their
  dependencies change. `remaining ~= todos.filter((t) -> not t.done).length`
- **Effects** (`~>`) — side effects that run whenever reactive dependencies
  change. `~> @app.data.count = count`
- **Props** (`@` prefix, `=!` for readonly) — a public API for parent
  components to pass data in, with signal passthrough for shared reactivity.
- **Lifecycle hooks** — `beforeMount`, `mounted`, `updated`, `beforeUnmount`,
  `unmounted` for running code at specific points in a component's life.
- **Context API** — `setContext` and `getContext` for ancestor-to-descendant
  data sharing without prop drilling.
- **Mount/unmount mechanics** — attaching to the DOM, cascading teardown
  to children, and keep-alive caching across navigation.
- **Encapsulation** — each component is a class with its own scope, state,
  and methods. No global variable collisions, no leaking internals.

A component without a render block can still hold state, run effects, and
participate in the component tree — it just has no visual output.

### `render` — the view

The `render` keyword provides a declarative template DSL for describing DOM
structure. It has its own lexer pass and syntax rules distinct from regular
Rip code:

- **Element creation** — tag names become DOM nodes: `div`, `h1`, `button`
- **CSS-selector shortcuts** — `div.card.active`, `#main`, `.card` (implicit `div`)
- **Dynamic classes** — `div.('card', active && 'active')` with CLSX semantics
- **Event handlers** — `@click: handler` compiles to `addEventListener`
- **Two-way binding** — `value <=> username` wires reactive read and write
  (see [Two-Way Binding](#two-way-binding--the--operator) below)
- **Conditionals and loops** — `if`/`else` and `for item in items` with
  anchor-based DOM insertion and keyed reconciliation
- **Children/slots** — `@children` receives child nodes, `#content` marks
  layout insertion points
- **Component instantiation** — PascalCase names like `Card title: "Hello"`
  resolve to components automatically, no imports needed

Render compiles to two methods: `_create()` builds the DOM tree once, and
`_setup()` wires reactive effects for fine-grained updates. There is no
virtual DOM — each reactive binding creates a direct DOM effect that updates
the specific text node or attribute that depends on it.

A render block can only exist inside a component. It needs the component's
signals, computed values, and lifecycle to have something to render and
react to.

### Together

`component` provides the **model** — state, reactivity, lifecycle, identity.
`render` provides the **view** — a concise way to describe what the DOM
should look like and how it stays in sync with that state. One defines
behavior, the other defines structure. Neither is useful without the other
in practice, but they are separate concerns with separate syntax.

## Component Composition

Page components in `pages/` map to routes via file-based routing. Shared
components in `ui/` (or any `includes` directory) are available by PascalCase
name. No imports needed:

```coffee
# ui/card.rip
export Card = component
  title =! ""
  render
    .card
      if title
        h3 "#{title}"
      @children

# pages/about.rip
export About = component
  render
    .
      h1 "About"
      Card title: "The Idea"
        p "Components compose naturally."
      Card title: "Architecture"
        p "PascalCase resolution, signal passthrough, children blocks."
```

Reactive props via `:=` signal passthrough. Readonly props via `=!`.
Children blocks passed as DOM nodes via `@children`.

## Props — The `@` Contract

The `@` prefix on a member declaration marks it as a **public prop** — settable
by a parent component. Members without `@` are **private state** and ignore
any value a parent tries to pass in.

```coffee
export Drawer = component
  @open := false        # public — parent can pass `open: true`
  @breakpoint := 480    # public — parent can pass `breakpoint: 768`
  isRight := false      # private — always starts as false
  closing := false      # private — always starts as false

  render
    if open
      div "Drawer is open"
```

The compiler enforces the boundary:

```javascript
// @open := false  →  accepts parent value
this.open = __state(props.open ?? false);

// isRight := false  →  ignores parent, always uses default
this.isRight = __state(false);
```

This works for all member types:

| Declaration | Visibility | Meaning |
|-------------|-----------|---------|
| `@title := 'Hello'` | Public | Reactive state, settable by parent |
| `@label =! 'Default'` | Public | Readonly prop, settable by parent |
| `count := 0` | Private | Reactive state, internal only |
| `cache =! null` | Private | Readonly, internal only |
| `total ~= items.length` | — | Computed (always derived, never a prop) |

A parent passes props as key-value pairs when using a component:

```coffee
Drawer open: showDrawer, breakpoint: 768
  div "Content here"
```

The `@` declarations at the top of a component are its public API. Everything
else is an implementation detail. No separate type files, no prop validation
boilerplate — one character that says "this is settable from outside."

## Render Block Syntax

Inside a `render` block, elements are declared by tag name. Classes, attributes,
and children can be expressed inline or across multiple indented lines.

### Classes with `.(...)`

The `.()` helper applies classes using CLSX semantics — strings are included
directly, and object keys are conditionally included based on their values:

```coffee
button.('px-4 py-2 rounded-full') "Click"
button.('px-4 py-2', active: isActive) "Click"
```

Arguments can span multiple lines, just like a normal function call:

```coffee
input.(
  'block w-full rounded-lg border border-primary',
  'text-sm-plus text-tertiary shadow-xs'
)
```

### Indented Attributes

Attributes can be placed on separate indented lines after the element:

```coffee
input.('rounded-lg border px-3.5 py-2.5')
  type: "email"
  value: user.email
  disabled: true
```

This is equivalent to the inline form:

```coffee
input.('rounded-lg border px-3.5 py-2.5') type: "email", value: user.email, disabled: true
```

### The `class:` Attribute

The `class:` attribute works like `.()` and merges cumulatively with any
existing `.()` classes on the same element:

```coffee
input.('block w-full rounded-lg')
  class: 'text-sm text-tertiary'
  type: "email"
```

This produces a single combined class expression: `block w-full rounded-lg text-sm text-tertiary`.

The `class:` value also supports `.()` syntax for conditional classes:

```coffee
div.('mt-4 p-4')
  class: .('ring-1', highlighted: isHighlighted)
  span "Content"
```

### Attributes and Children Together

Attributes and children can coexist at the same indentation level. Attributes
(key-value pairs) are listed first, followed by child elements:

```coffee
button.('flex items-center rounded-lg')
  type: "submit"
  disabled: saving

  span.('font-bold') "Submit"
  span.('text-sm text-secondary') "or press Enter"
```

Blank lines between attributes and children are fine — they don't break the
structure.

## Two-Way Binding — The `<=>` Operator

The `<=>` operator is one of Rip UI's most powerful features. It creates a
bidirectional reactive binding between a parent's state and a child element
or component — changes flow in both directions automatically.

### The Problem It Solves

In React, wiring state to interactive elements requires explicit value props
and callback handlers for every bindable property:

```jsx
// React: verbose, repetitive ceremony
const [name, setName] = useState('');
const [role, setRole] = useState('viewer');
const [notify, setNotify] = useState(true);
const [showConfirm, setShowConfirm] = useState(false);

<input value={name} onChange={e => setName(e.target.value)} />
<Select value={role} onValueChange={setRole} />
<Switch checked={notify} onCheckedChange={setNotify} />
<Dialog open={showConfirm} onOpenChange={setShowConfirm} />
```

Every bindable property needs a state declaration AND a setter callback.
This is the single most tedious pattern in React development.

### The Rip Way

In Rip, `<=>` replaces all of that with a single operator:

```coffee
export UserForm = component
  @name := ''
  @role := 'viewer'
  @notify := true
  @showConfirm := false

  render
    input value <=> @name
    Select value <=> @role
      Option value: "viewer", "Viewer"
      Option value: "editor", "Editor"
      Option value: "admin",  "Admin"
    Switch checked <=> @notify
    Dialog open <=> @showConfirm
      p "Save changes?"
```

No `onChange`. No `onValueChange`. No `onOpenChange`. No `setName`, `setRole`,
`setNotify`, `setShowConfirm`. The reactive system handles everything — state
flows down, user interactions flow back up.

### How It Works

`value <=> username` compiles to two things:

1. **State → DOM** (reactive effect): `__effect(() => { el.value = username; })`
2. **DOM → State** (event listener): `el.addEventListener('input', (e) => { username = e.target.value; })`

The compiler is smart about types:
- `value <=>` on text inputs uses the `input` event and `e.target.value`
- `value <=>` on number/range inputs uses `e.target.valueAsNumber`
- `checked <=>` uses the `change` event and `e.target.checked`

For custom components, `<=>` passes the reactive signal itself, enabling the
child to both read and write the parent's state directly — no callback
indirection.

### Auto-Detection

Even without `<=>`, the compiler auto-detects when `value:` or `checked:` is
bound to a reactive expression and generates two-way binding automatically:

```coffee
# These are equivalent:
input value <=> @name           # explicit two-way binding
input value: @name              # auto-detected (name is reactive)
```

### Why This Matters

Two-way binding is what Vue has with `v-model`, what Svelte has with `bind:`,
and what Angular has with `[(ngModel)]`. React is the only major framework
that deliberately omits it, forcing the verbose controlled component pattern
instead.

Rip's `<=>` goes further than Vue or Svelte — it works uniformly across HTML
elements and custom components with the same syntax. A `Dialog open <=> show`
and an `input value <=> name` use the same operator, the same mental model,
and the same compilation strategy. This makes headless interactive components
dramatically cleaner to use than their React equivalents.

## How It Works

The browser loads one file — `rip-ui.min.js` (~53KB Brotli) — which bundles the
Rip compiler and the pre-compiled UI framework. No runtime compilation of the
framework, no extra network requests.

The runtime auto-detects `<script type="text/rip" data-name="...">` components
on the page and calls `launch()` automatically with hash routing enabled by
default. For server-rendered apps, `launch()` fetches the app bundle from the
server. Either way, it hydrates the stash and renders.

### Browser Execution Contexts

Rip provides full async/await support across every browser context — no other
compile-to-JS language has this:

| Context | How async works | Returns value? |
|---------|-----------------|----------------|
| `<script type="text/rip">` | Async IIFE wrapper | No (fire-and-forget) |
| Playground "Run" button | Async IIFE wrapper | No (use console.log) |
| `rip()` console REPL | Rip `do ->` block | Yes (sync direct, async via Promise) |
| `.rip` files via `importRip()` | ES module import | Yes (module exports) |

The `!` postfix compiles to `await`. Inline scripts are wrapped in an async IIFE
automatically. The `rip()` console function wraps user code in a `do ->` block
so the Rip compiler handles implicit return and auto-async natively.

### globalThis Exports

When `rip-ui.min.js` loads, it registers these on `globalThis`:

| Function | Purpose |
|----------|---------|
| `rip(code)` | Console REPL — compile and execute Rip code |
| `importRip(url)` | Fetch, compile, and import a `.rip` file as an ES module |
| `compileToJS(code)` | Compile Rip source to JavaScript |
| `__rip` | Reactive runtime — `__state`, `__computed`, `__effect`, `__batch` |
| `__ripComponent` | Component runtime — `__Component`, `__clsx`, `__fragment` |
| `__ripExports` | All compiler exports — `compile`, `formatSExpr`, `VERSION`, etc. |

## The Stash

App state lives in one reactive tree:

```
app
├── routes    ← navigation state (path, params, query, hash)
└── data      ← reactive app state (title, theme, user, etc.)
```

Writing to `app.data.theme` updates any component reading it. The stash
uses Rip's built-in reactive primitives — the same signals that power
`:=` and `~=` in components.

## The App Bundle

The bundle is JSON served at `/{app}/bundle`:

```json
{
  "components": {
    "components/index.rip": "export Home = component...",
    "components/counter.rip": "export Counter = component...",
    "components/_lib/card.rip": "export Card = component..."
  },
  "data": {
    "title": "My App",
    "theme": "light"
  }
}
```

On disk you organize your app into `pages/` and `ui/`. The middleware
maps them into a flat `components/` namespace in the bundle — pages go
under `components/`, shared components under `components/_lib/`. The `_`
prefix tells the router to skip `_lib/` entries when generating routes.

## Component Loading Modes

`launch()` supports three ways to load component sources, checked in priority
order. All three produce the same internal bundle format — everything downstream
(compilation, routing, rendering) works identically regardless of source.

### 1. Static File URLs — `launch components: [...]`

Fetch individual `.rip` files as plain text from any static server:

```coffee
launch components: [
  'components/index.rip'
  'components/dashboard.rip'
  'components/line-chart.rip'
]
```

No server middleware needed. Serve `.rip` files as static text from any HTTP
server, CDN, or `file://` path. Each URL is fetched individually and compiled
in the browser.

### 2. Inline DOM — `<script type="text/rip" data-name="...">`

Embed component source directly in the HTML page:

```html
<script type="module" src="rip-ui.min.js"></script>

<script type="text/rip" data-name="index">
  export Home = component
    render
      h1 "Hello from inline"
</script>

<script type="text/rip" data-name="counter">
  export Counter = component
    @count := 0
    render
      button @click: (-> count += 1), "#{count}"
</script>
```

The runtime auto-detects `data-name` scripts and launches automatically — no
bootstrap script needed. The `data-name` attribute maps to the component
filename (`.rip` extension is added automatically if omitted). Scripts with
`data-name` are collected as component sources and are not executed as
top-level code.

### 3. Server Bundle (default)

When neither `components` nor inline `data-name` scripts are present, `launch()`
fetches the app bundle from the server at `/{app}/bundle`. This is the default
mode when using the `ripUI` server middleware.

```coffee
launch()  # fetches /bundle automatically
```

## Server Middleware

The `ripUI` middleware registers routes for the framework files, the app
bundle, and optional SSE hot-reload:

```coffee
use ripUI dir: dir, components: 'routes', includes: ['ui'], watch: true, title: 'My App'
```

| Option | Default | Description |
|--------|---------|-------------|
| `app` | `''` | URL mount point |
| `dir` | `'.'` | App directory on disk |
| `components` | `'components'` | Directory for page components (file-based routing) |
| `includes` | `[]` | Directories for shared components (no routes) |
| `watch` | `false` | Enable SSE hot-reload |
| `debounce` | `250` | Milliseconds to batch file change events |
| `state` | `null` | Initial app state |
| `title` | `null` | Document title |

Routes registered:

```
/rip/rip-ui.min.js   — Rip compiler + pre-compiled UI framework
/{app}/bundle        — app bundle (components + data as JSON)
/{app}/watch         — SSE hot-reload stream (when watch: true)
/{app}/components/*  — individual component files (for hot-reload refetch)
```

## State Preservation (Keep-Alive)

Components are cached when navigating away instead of destroyed. Navigate
to `/counter`, increment the count, go to `/about`, come back — the count
is preserved. Configurable via `cacheSize` (default 10).

## Data Loading

`createResource` manages async data with reactive `loading`, `error`, and
`data` properties:

```coffee
export UserPage = component
  user := createResource -> fetch!("/api/users/#{@params.id}").json!

  render
    if user.loading
      p "Loading..."
    else if user.error
      p "Error: #{user.error.message}"
    else
      h1 user.data.name
```

## Error Boundaries

Layouts with an `onError` method catch errors from child components:

```coffee
export Layout = component
  errorMsg := null

  onError: (err) -> errorMsg = err.message

  render
    .app-layout
      if errorMsg
        .error-banner "#{errorMsg}"
      #content
```

## Navigation Indicator

`router.navigating` is a reactive signal — true while a route transition
is in progress:

```coffee
if @router.navigating
  span "Loading..."
```

## Multi-App Hosting

Mount multiple apps under one server:

```coffee
import { get, start, notFound } from '@rip-lang/api'
import { mount as demo } from './demo/index.rip'
import { mount as labs } from './labs/index.rip'

demo '/demo'
labs '/labs'
get '/', -> Response.redirect('/demo/', 302)
start port: 3002
```

The `/rip/` namespace is shared — all apps use the same compiler and framework.

## File Structure

```
my-app/
├── index.rip            # Server
├── index.html           # HTML page
├── pages/               # Page components (file-based routing)
│   ├── _layout.rip      # Root layout
│   ├── index.rip        # Home          → /
│   ├── about.rip        # About         → /about
│   └── users/
│       └── [id].rip     # User profile  → /users/:id
├── ui/                  # Shared components (no routes)
│   └── card.rip         # Card          → available as Card
└── css/
    └── styles.css       # Styles
```

Files starting with `_` don't generate routes (`_layout.rip` is a layout,
not a page). Directories starting with `_` are also excluded, which is how
shared components from `includes` stay out of the router.

## Hash Routing

Hash routing is **enabled by default** for auto-launched apps — ideal for
static hosting (GitHub Pages, S3, etc.) where the server can't handle SPA
fallback routing. URLs use `page.html#/about` instead of `/about`.
Back/forward navigation, direct URL loading, and `href="#/path"` links all
work correctly.

To disable hash routing (e.g., for server-rendered apps with proper fallback):

```html
<script type="module" src="rip-ui.min.js" data-hash="false"></script>
```

Or when calling `launch()` manually:

```coffee
launch hash: false
```

## Static Deployment

For zero-server deployment, use inline `data-name` scripts or a `components`
URL list. Both work with `rip-ui.min.js` (~53KB Brotli) from a CDN — no
server middleware needed, no bootstrap script needed.

**Inline mode** — everything in one HTML file:

```html
<script type="module" src="rip-ui.min.js"></script>

<script type="text/rip" data-name="index">
  export Home = component
    render
      h1 "Hello"
</script>

<script type="text/rip" data-name="about">
  export About = component
    render
      h1 "About"
</script>
```

The runtime auto-detects the `data-name` components and launches with hash
routing. That's it — no bootstrap, no config.

**Remote bundle** — fetch components from a URL:

```html
<script type="module" src="rip-ui.min.js" data-url="https://example.com/app/"></script>
```

The `data-url` attribute tells the runtime to fetch the app bundle from the
given URL (appending `/bundle` to the path).

**Manual launch** — for full control, use a bare `<script type="text/rip">`:

```html
<script type="module" src="rip-ui.min.js"></script>
<script type="text/rip">
  { launch } = importRip! 'ui.rip'
  launch components: ['components/index.rip', 'components/about.rip']
</script>
```

**Inline Rip** — run arbitrary Rip code alongside auto-launched apps:

```html
<script type="text/rip">
  alert "Free cheese rollups for the girls!"
</script>
```

See `docs/results/index.html` for a complete example — a full Lab Results
brochure app with 7 components, SVG gauges, and inline CSS in one HTML file.

## Tailwind CSS Autocompletion

To get Tailwind class autocompletion inside `.()` CLSX helpers in render
templates, install the
[Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)
extension and add these to your VS Code / Cursor settings:

```json
{
  "tailwindCSS.includeLanguages": { "rip": "html" },
  "tailwindCSS.experimental.classRegex": [
    ["\\.\\(([\\s\\S]*?)\\)", "'([^']*)'"]
  ]
}
```

This gives you autocompletion, hover previews, and linting for Tailwind
classes in expressions like:

```coffee
h1.('text-3xl font-semibold') "Hello"
button.('flex items-center px-4 py-2 rounded-full') "Click"
```

## License

MIT
