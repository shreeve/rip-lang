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
use ripUI dir: dir, watch: true, title: 'My App'
get '/css/*', -> @send "#{dir}/css/#{@req.path.slice(5)}"
notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'
start port: 3000
```

**`index.html`** — the page:

```html
<script type="module" src="/rip/browser.js"></script>
<script type="text/rip">
  { launch } = importRip! '/rip/ui.rip'
  launch()
</script>
```

**`components/index.rip`** — a component:

```coffee
export Home = component
  @count := 0
  render
    div
      h1 "Hello from Rip UI"
      button @click: (-> @count += 1), "Clicked #{@count} times"
```

Run `bun index.rip`, open `http://localhost:3000`.

## Component Composition

Components in `components/` are automatically available by PascalCase name.
No imports needed:

```coffee
# components/card.rip
export Card = component
  title =! ""
  render
    div.card
      if title
        h3 "#{title}"
      @children

# components/about.rip
export About = component
  render
    div
      h1 "About"
      Card title: "The Idea"
        p "Components compose naturally."
      Card title: "Architecture"
        p "PascalCase resolution, signal passthrough, children blocks."
```

Reactive props via `:=` signal passthrough. Readonly props via `=!`.
Children blocks passed as DOM nodes via `@children`.

## How It Works

The browser loads two things from the `/rip/` namespace:

- `/rip/browser.js` — the Rip compiler (~47KB Brotli, cached forever)
- `/rip/ui.rip` — the UI framework (~948 lines, compiled in the browser in ~10-20ms)

Then `launch()` fetches the app bundle, hydrates the stash, and renders.

## The Stash

Everything lives in one reactive tree:

```
app
├── components/          ← component source files
│   ├── index.rip
│   ├── counter.rip
│   └── _layout.rip
├── routes          ← navigation state (path, params, query, hash)
└── data            ← reactive app state (title, theme, user, etc.)
```

Writing to `app.data.theme` updates any component reading it. The stash
uses Rip's built-in reactive primitives — the same signals that power
`:=` and `~=` in components.

## The App Bundle

The bundle is JSON served at `/{app}/bundle`. It populates the stash:

```json
{
  "components": {
    "components/index.rip": "export Home = component...",
    "components/counter.rip": "export Counter = component..."
  },
  "data": {
    "title": "My App",
    "theme": "light"
  }
}
```

## Server Middleware

The `ripUI` middleware registers routes for the framework files, the app
bundle, and optional SSE hot-reload:

```coffee
use ripUI app: '/demo', dir: dir, title: 'My App'
```

| Option | Default | Description |
|--------|---------|-------------|
| `app` | `''` | URL mount point |
| `dir` | `'.'` | App directory on disk |
| `components` | `'components'` | Components subdirectory within `dir` |
| `watch` | `false` | Enable SSE hot-reload |
| `debounce` | `250` | Milliseconds to batch file change events |
| `state` | `null` | Initial app state |
| `title` | `null` | Document title |

Routes registered:

```
/rip/browser.js      — Rip compiler
/rip/ui.rip          — UI framework
/{app}/bundle        — app bundle (components + data as JSON)
/{app}/watch         — SSE hot-reload stream (when watch: true)
/{app}/components/*       — individual component files (for hot-reload refetch)
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

Each app is a directory with `components/`, `css/`, `index.html`, and `index.rip`.
The `/rip/` namespace is shared — all apps use the same compiler and framework.

## File Structure

```
my-app/
├── index.rip            # Server
├── index.html           # HTML page
├── components/
│   ├── _layout.rip      # Root layout
│   ├── index.rip        # Home          → /
│   ├── about.rip        # About         → /about
│   └── users/
│       └── [id].rip     # User profile  → /users/:id
└── css/
    └── styles.css       # Styles
```

## Hash Routing

For static hosting (GitHub Pages, S3, etc.) where the server can't handle
SPA fallback routing, use hash-based URLs:

```coffee
launch '/app', hash: true
```

This switches from `/about` to `page.html#/about`. Back/forward navigation,
direct URL loading, and `href="#/path"` links all work correctly.

## Static Deployment — `launch bundle:`

Inline all components in a single HTML file for zero-server deployment:

```html
<script type="text/rip">
  { launch } = importRip! '/rip/ui.rip'

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
