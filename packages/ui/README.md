<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

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
<script type="text/rip">
  { launch } = importRip! 'ui.rip'
  launch()
</script>
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

## How It Works

The browser loads one file — `rip-ui.min.js` (~52KB Brotli) — which bundles the
Rip compiler and the pre-compiled UI framework. No runtime compilation of the
framework, no extra network requests.

Then `launch()` loads component sources (from a server bundle, static files, or
inline DOM), hydrates the stash, and renders.

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

<script type="text/rip">
  { launch } = importRip! '/rip/ui.rip'
  launch()
</script>
```

The `data-name` attribute maps to the component filename (`.rip` extension is
added automatically if omitted). Scripts with `data-name` are collected as
component sources and are not executed as top-level code.

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

For static hosting (GitHub Pages, S3, etc.) where the server can't handle
SPA fallback routing, use hash-based URLs:

```coffee
launch '/app', hash: true
```

This switches from `/about` to `page.html#/about`. Back/forward navigation,
direct URL loading, and `href="#/path"` links all work correctly.

## Static Deployment

For zero-server deployment, use inline `data-name` scripts or a `components`
URL list. Both work with `rip-ui.min.js` (~52KB Brotli) from a CDN — no
server middleware needed.

**Inline mode** — everything in one HTML file:

```html
<script type="module" src="dist/rip-ui.min.js"></script>

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

<script type="text/rip">
  { launch } = importRip! 'ui.rip'
  launch hash: true
</script>
```

**Static files mode** — `.rip` files served from any HTTP server or CDN:

```html
<script type="module" src="dist/rip-ui.min.js"></script>
<script type="text/rip">
  { launch } = importRip! 'ui.rip'
  launch components: ['components/index.rip', 'components/about.rip'], hash: true
</script>
```

**Explicit bundle** — pass a bundle object directly:

```html
<script type="module" src="dist/rip-ui.min.js"></script>
<script type="text/rip">
  { launch } = importRip! 'ui.rip'

  launch bundle:
    '/':        '''
                  export Home = component
                    render
                      h1 "Hello"
                '''
    '/about':   '''
                  export About = component
                    render
                      h1 "About"
                '''
  , hash: true
</script>
```

See `docs/demo.html` for a complete example — the full Rip UI Demo app
(6 components, router, reactive state, persistence) in 337 lines of
static HTML.

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
