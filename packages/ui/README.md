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

**`parts/index.rip`** — a component:

```coffee
export Home = component
  @count := 0
  render
    div
      h1 "Hello from Rip UI"
      button @click: (-> @count += 1), "Clicked #{@count} times"
```

Run `bun index.rip`, open `http://localhost:3000`.

## How It Works

The browser loads two things from the `/rip/` namespace:

- `/rip/browser.js` — the Rip compiler (~45KB gzip, cached forever)
- `/rip/ui.rip` — the UI framework (compiled in the browser in ~10-20ms)

Then `launch()` fetches the app bundle, hydrates the stash, and renders.

## The Stash

Everything lives in one reactive tree:

```
app
├── parts/          ← component source files
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
  "parts": {
    "parts/index.rip": "export Home = component...",
    "parts/counter.rip": "export Counter = component..."
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
| `parts` | `'parts'` | Parts subdirectory within `dir` |
| `watch` | `false` | Enable SSE hot-reload |
| `debounce` | `250` | Milliseconds to batch file change events |
| `state` | `null` | Initial app state |
| `title` | `null` | Document title |

Routes registered:

```
/rip/browser.js      — Rip compiler
/rip/ui.rip          — UI framework
/{app}/bundle        — app bundle (parts + data as JSON)
/{app}/watch         — SSE hot-reload stream (when watch: true)
/{app}/parts/*       — individual part files (for hot-reload refetch)
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
      div data-slot: "true"
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

Each app is a directory with `parts/`, `css/`, `index.html`, and `index.rip`.
The `/rip/` namespace is shared — all apps use the same compiler and framework.

## File Structure

```
my-app/
├── index.rip            # Server
├── index.html           # HTML page
├── parts/
│   ├── _layout.rip      # Root layout
│   ├── index.rip        # Home          → /
│   ├── about.rip        # About         → /about
│   └── users/
│       └── [id].rip     # User profile  → /users/:id
└── css/
    └── styles.css       # Styles
```

## License

MIT
