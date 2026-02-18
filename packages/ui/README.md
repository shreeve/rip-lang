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
use ripUI dir: dir, components: 'pages', includes: ['ui'], watch: true, title: 'My App'
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

## How It Works

The browser loads one file — `rip-ui.min.js` (~52KB Brotli) — which bundles the
Rip compiler and the pre-compiled UI framework. No runtime compilation of the
framework, no extra network requests.

Then `launch()` fetches the app bundle, hydrates the stash, and renders.

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

## Server Middleware

The `ripUI` middleware registers routes for the framework files, the app
bundle, and optional SSE hot-reload:

```coffee
use ripUI dir: dir, components: 'pages', includes: ['ui'], watch: true, title: 'My App'
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

## Static Deployment — `launch bundle:`

Inline all components in a single HTML file for zero-server deployment.
Use `rip-ui.min.js` (~52KB Brotli) — a combined bundle with the compiler
and pre-compiled UI framework. No extra network requests, no runtime
compilation of the framework:

```html
<script type="module" src="dist/rip-ui.min.js"></script>
<script type="text/rip">
  { launch } = importRip! 'dist/ui.rip'

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

## License

MIT
