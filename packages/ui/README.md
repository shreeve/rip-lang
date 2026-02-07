# @rip-lang/ui

Zero-build reactive web framework for Rip. Ships the 35KB Rip compiler to the browser, compiles components on-demand, and renders them with fine-grained reactivity. No build step. No bundler. No configuration files.

## Architecture

```
Browser loads:  rip.browser.js (35KB) + @rip-lang/ui (~8KB)
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   Reactive Stash   Virtual FS       Router
   (app state)     (file storage)  (URL → VFS)
        │                │                │
        └────────────────┼────────────────┘
                         │
                    Renderer
              (mounts components)
                         │
                       DOM
```

## Quick Start

```html
<!DOCTYPE html>
<html>
<head><title>My App</title></head>
<body>
  <div id="app"></div>
  <script type="module">
    import { createApp } from './ui.js'
    import { compileToJS } from './rip.browser.js'

    createApp({
      target: '#app',
      compile: compileToJS,
      state: { theme: 'light', user: null },
      files: {
        'pages/index.rip': `
          component Home
            render
              h1 "Welcome to Rip"
              p "Zero-build reactive apps"
        `,
        'pages/about.rip': `
          component About
            render
              h1 "About"
              p "Built with Rip 3.0"
        `
      }
    }).start()
  </script>
</body>
</html>
```

## Core Systems

### Reactive Stash

Deep reactive state tree with path-based navigation. Every nested property is automatically tracked — changing any value triggers fine-grained updates.

```javascript
import { stash, effect } from '@rip-lang/ui/stash'

const app = stash({
  user: { name: 'Alice', prefs: { theme: 'dark' } },
  cart: { items: [], total: 0 }
})

// Direct property access (tracked)
app.user.name                        // 'Alice'
app.user.prefs.theme = 'light'       // triggers updates

// Path-based access
app.get('user.prefs.theme')          // 'light'
app.set('cart.items[0]', { id: 1 })  // deep set with auto-creation
app.has('user.name')                 // true
app.del('cart.items[0]')             // delete
app.inc('cart.total', 9.99)          // increment
app.merge({ user: { role: 'admin' }}) // shallow merge
app.keys('user')                     // ['name', 'prefs', 'role']

// Reactive effects
effect(() => {
  console.log(`Theme: ${app.user.prefs.theme}`)
  // Re-runs whenever theme changes
})
```

### Virtual File System

Browser-local file storage. Components are delivered as source files and stored in the VFS. No build step — the Rip compiler runs in the browser.

```javascript
import { vfs } from '@rip-lang/ui/vfs'

const fs = vfs()

// Write files
fs.write('pages/index.rip', 'component Home ...')
fs.write('pages/users/[id].rip', 'component UserProfile ...')

// Read and query
fs.read('pages/index.rip')        // source string
fs.exists('pages/index.rip')      // true
fs.list('pages/')                  // ['index.rip', 'users']
fs.listAll('pages/')               // all files recursively

// Watch for changes
fs.watch('pages/', ({ event, path }) => {
  console.log(`${event}: ${path}`)
})

// Fetch from server
await fs.fetch('pages/index.rip', '/api/pages/index.rip')
await fs.fetchManifest(['pages/index.rip', 'pages/about.rip'])
```

### File-Based Router

Maps URLs to VFS paths. Dynamic segments, catch-all routes, nested layouts.

```javascript
import { createRouter } from '@rip-lang/ui/router'

const router = createRouter(fs, { root: 'pages' })

// File path → URL pattern:
//   pages/index.rip           → /
//   pages/about.rip           → /about
//   pages/users/index.rip     → /users
//   pages/users/[id].rip      → /users/:id
//   pages/blog/[...slug].rip  → /blog/*slug
//   pages/_layout.rip         → wraps all pages
//   pages/users/_layout.rip   → wraps /users/* pages

// Navigate
router.push('/users/42')
router.replace('/login')
router.back()

// Reactive route state
effect(() => {
  console.log(router.path)     // '/users/42'
  console.log(router.params)   // { id: '42' }
})

// Intercepts <a> clicks automatically for SPA navigation
```

### Component Renderer

Mounts compiled Rip components, manages layouts, handles transitions.

```javascript
import { createRenderer } from '@rip-lang/ui/renderer'

const renderer = createRenderer({
  router,
  fs,
  stash: appState,
  compile: compileToJS,
  target: '#app',
  transition: { duration: 200 }
})

renderer.start()  // Watch for route changes and mount components
renderer.stop()   // Unmount everything and clean up
```

## File Structure

A typical Rip UI app served from the server:

```
my-app/
├── index.html               # HTML shell
├── rip.browser.js           # Rip compiler (35KB)
├── ui.js                    # This framework
├── pages/
│   ├── _layout.rip          # Root layout (nav, footer)
│   ├── index.rip            # Home page       → /
│   ├── about.rip            # About page      → /about
│   └── users/
│       ├── _layout.rip      # Users layout
│       ├── index.rip        # User list       → /users
│       └── [id].rip         # User profile    → /users/:id
└── css/
    └── styles.css
```

## State Tiers

Three levels of reactive state, each scoped appropriately:

| Tier | Scope | Lifetime | Access |
|------|-------|----------|--------|
| **App** | Global | Entire session | `app.user`, `app.theme` |
| **Route** | Per-route | Until navigation | `params`, `query` |
| **Component** | Per-instance | Until unmount | `:=` reactive vars |

## API Reference

### `createApp(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `target` | `string\|Element` | `'#app'` | DOM mount target |
| `state` | `object` | `{}` | Initial app state |
| `files` | `object` | `{}` | Initial VFS files `{ path: content }` |
| `root` | `string` | `'pages'` | Pages directory in VFS |
| `compile` | `function` | — | Rip compiler (`compileToJS`) |
| `transition` | `object` | — | Route transition `{ duration }` |
| `onError` | `function` | — | Error handler |
| `onNavigate` | `function` | — | Navigation callback |

Returns: `{ app, fs, router, renderer, start, stop, load, go, addPage, get, set }`

### `stash(data)`

Creates a deeply reactive proxy around `data`. Every property read is tracked, every write triggers effects.

### `effect(fn)`

Creates a side effect that re-runs whenever its tracked dependencies change.

### `computed(fn)`

Creates a lazy computed value that caches until dependencies change.

### `batch(fn)`

Groups multiple state updates — effects only fire once at the end.

## License

MIT
