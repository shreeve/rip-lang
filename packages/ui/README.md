<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.svg" style="width:50px" /> <br>

# Rip UI - @rip-lang/ui

> **A zero-build reactive web framework — ship the compiler to the browser, compile on demand, render with fine-grained reactivity**

Rip UI inverts the traditional web development model. Instead of building,
bundling, and shipping static JavaScript artifacts to the browser, it ships the
35KB Rip compiler itself. Components are delivered as source files, stored in a
browser-local Virtual File System, compiled on demand, and rendered with
fine-grained DOM updates powered by Rip's built-in reactivity. No build step.
No bundler. No configuration files.

The component model adds exactly **two keywords** to the Rip language —
`component` and `render` — and reuses everything else (classes, reactivity,
functions, methods) that Rip already provides.

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
              (compiles + mounts)
                         │
                       DOM
```

| Module | Size | Role |
|--------|------|------|
| `ui.js` | ~150 lines | `createApp` entry point, re-exports everything |
| `stash.js` | ~400 lines | Deep reactive state tree with path-based navigation |
| `vfs.js` | ~200 lines | Browser-local Virtual File System with watchers |
| `router.js` | ~300 lines | File-based router (URL ↔ VFS paths, History API) |
| `renderer.js` | ~250 lines | Component lifecycle, layouts, transitions |

## The Idea

Modern web frameworks — React, Vue, Svelte, Solid — all share the same
fundamental assumption: code must be compiled and bundled on the developer's
machine, then shipped as static artifacts. This creates an entire ecosystem of
build tools (Vite, Webpack, Turbopack, esbuild), configuration files, dev
servers, hot module replacement protocols, and deployment pipelines. The
developer experience is powerful, but the machinery is enormous.

Rip UI asks: **what if the compiler ran in the browser?**

At 35KB, the Rip compiler is small enough to ship alongside your application.
Components arrive as `.rip` source files — plain text — and are compiled to
JavaScript on the client's machine. This eliminates the build step entirely.
There is no `dist/` folder, no source maps, no chunk splitting, no tree
shaking, no CI build minutes. You write a `.rip` file, the browser compiles it,
and it runs.

This is not a toy or a limitation. The compiler produces the same output it
would on a server. The reactive system is the same signal-based engine that
powers server-side Rip. The component model compiles to anonymous ES6 classes
with fine-grained DOM manipulation — no virtual DOM diffing.

### How It Differs from Existing Frameworks

| | React/Vue/Svelte | Rip UI |
|---|---|---|
| **Build step** | Required (Vite, Webpack, etc.) | None — compiler runs in browser |
| **Bundle size** | 40-100KB+ framework + app bundle | 35KB compiler + ~8KB framework + raw source |
| **HMR** | Dev server ↔ browser WebSocket | Not needed — recompile in-place |
| **Deployment** | Build artifacts (`dist/`) | Source files served as-is |
| **Component format** | JSX, SFC, templates | Rip source (`.rip` files) |
| **Reactivity** | Library-specific (hooks, refs, signals) | Language-native (`:=`, `~=`, `~>`) |
| **DOM updates** | Virtual DOM diff or compiled transforms | Fine-grained effects, direct DOM mutation |
| **Routing** | Framework plugin (react-router, etc.) | Built-in file-based router over VFS |
| **State management** | External library (Redux, Pinia, etc.) | Built-in reactive stash with deep tracking |

## Component Model

The component system adds two keywords to Rip: `component` and `render`. Everything
else — reactive state (`:=`), computed values (`~=`), effects (`~>`), methods,
lifecycle — uses standard Rip syntax. A component is an expression that evaluates
to an anonymous ES6 class.

### Defining a Component

```coffee
Counter = component
  @count := 0         # reactive state (signal) — parent can override via props
  @step = 1           # plain prop — parent can set, not reactive

  doubled ~= @count * 2   # computed (derived, read-only)

  increment: -> @count += @step
  decrement: -> @count -= @step

  mounted: ->
    console.log "Counter mounted"

  render
    div.counter
      h1 "Count: #{@count}"
      p "Doubled: #{doubled}"
      button @click: @increment, "+#{@step}"
      button @click: @decrement, "-#{@step}"
```

This compiles to an anonymous ES6 class expression:

```javascript
Counter = class {
  constructor(props = {}) {
    this.count = isSignal(props.count) ? props.count : __state(props.count ?? 0);
    this.step = props.step ?? 1;
    this.doubled = __computed(() => this.count.value * 2);
  }
  increment() { return this.count.value += this.step; }
  decrement() { return this.count.value -= this.step; }
  mounted() { return console.log("Counter mounted"); }
  _create() { /* fine-grained DOM creation */ }
  _setup() { /* reactive effect bindings */ }
  mount(target) { /* ... */ }
  unmount() { /* ... */ }
}
```

### The Two Keywords

**`component`** — Declares an anonymous class with component semantics:

- `@` properties become instance variables that the parent can set via props
- `:=` assignments create reactive signals (`__state`)
- `~=` assignments create computed values (`__computed`)
- `~>` assignments create effects (`__effect`)
- Plain `=` assignments with function values become methods
- `mounted`, `unmounted`, `updated` are lifecycle hooks called by the runtime
- Everything else is standard Rip class behavior

**`render`** — Defines the component's template using a Pug/Jade-like DSL:

- Tags are bare identifiers: `div`, `h1`, `button`, `span`
- Classes use dot notation: `div.card.active`, `button.btn.btn-primary`
- Dynamic classes use dot-parens: `div.("active" if @selected)` (CLSX-like)
- Attributes use object syntax: `input type: "text", placeholder: "..."`
- Events use `@` prefix: `button @click: @handleClick`
- Text content is a string argument: `h1 "Hello"`
- Interpolation works: `p "Count: #{@count}"`
- Children are indented below their parent
- `if`/`else` and `for...in` work inside templates

That's it. No special attribute syntax, no directive system, no template
compiler — just Rip's existing syntax applied to DOM construction.

### Props

Every `@` property on a component is a prop that the parent can set. The child
owns the property; the parent can provide an initial value or pass a reactive
signal:

```coffee
# Parent passes plain value — child wraps it in a signal
Counter {count: 10}

# Parent passes its own signal — child uses it directly (shared state)
Counter {count: parentCount}
```

The `isSignal` check in the constructor handles this automatically:

```javascript
this.count = isSignal(props.count) ? props.count : __state(props.count ?? 0);
```

If you don't want the parent to override a prop, don't use `@`:

```coffee
MyComponent = component
  active := false      # internal state — not a prop, parent can't set it
  @count := 0          # prop — parent can set or share a signal
```

### Required and Optional Props

```coffee
UserCard = component
  @name               # required — no default, error if missing
  @avatar = "/default.png"   # optional — has a default
  @bio? := ""         # optional reactive — ? makes it explicitly optional
```

### Computed Values and Effects

```coffee
TodoList = component
  @todos := []
  remaining ~= @todos.filter((t) -> not t.done).length
  total ~= @todos.length

  ~> console.log "#{remaining} of #{total} remaining"

  render
    div
      h2 "Todos (#{remaining}/#{total})"
      # ...
```

### Lifecycle

`mounted`, `unmounted`, and `updated` are just methods. No special syntax. The
runtime calls them at the appropriate times:

```coffee
Timer = component
  @elapsed := 0
  @interval = null

  mounted: ->
    @interval = setInterval (=> @elapsed += 1), 1000

  unmounted: ->
    clearInterval @interval

  render
    p "#{@elapsed} seconds"
```

### Two-Way Binding

The `<=>` operator creates two-way bindings between form elements and reactive
state:

```coffee
SearchBox = component
  @query := ""

  render
    input type: "text", value <=> @query
    p "Searching for: #{@query}"
```

### Child Components

Components can nest. Props are passed as object arguments:

```coffee
App = component
  @user := { name: "Alice" }

  render
    div
      Header {title: "My App"}
      UserCard {name: @user.name, avatar: "/alice.png"}
      Footer
```

### Context

Components can share state down the tree without passing props at every level:

```coffee
# In a parent component's constructor:
setContext 'theme', @theme

# In any descendant component:
theme = getContext 'theme'
```

### Multiple Components Per File

Because `component` is an expression (not a declaration), multiple components
can live in one file:

```coffee
Button = component
  @label = "Click"
  @onClick = null
  render
    button.btn @click: @onClick, @label

Card = component
  @title = ""
  render
    div.card
      h3 @title
      div.card-body
        slot

Page = component
  render
    div
      Card {title: "Welcome"}
        Button {label: "Get Started", onClick: -> alert "Go!"}
```

## Virtual File System

The VFS is a browser-local file storage layer. Components are delivered as
source text and stored in memory. The compiler reads from the VFS, not from
disk.

```javascript
import { vfs } from '@rip-lang/ui/vfs'

const fs = vfs()

// Write source files
fs.write('pages/index.rip', 'component Home\n  render\n    h1 "Hello"')
fs.write('pages/users/[id].rip', '...')

// Read
fs.read('pages/index.rip')       // source string
fs.exists('pages/index.rip')     // true
fs.list('pages/')                // ['index.rip', 'users/']
fs.listAll('pages/')             // all files recursively

// Watch for changes (triggers recompilation)
fs.watch('pages/', ({ event, path }) => {
  console.log(`${event}: ${path}`)
})

// Fetch from server
await fs.fetch('pages/index.rip', '/api/pages/index.rip')
await fs.fetchManifest([
  'pages/index.rip',
  'pages/about.rip',
  'pages/counter.rip'
])
```

### Why a VFS?

Traditional frameworks read from the server's file system during the build step
and produce static bundles. Rip UI has no build step, so it needs somewhere to
store source files in the browser. The VFS provides:

- **Addressable storage** — components are referenced by path, just like files
- **File watching** — the renderer re-compiles when a file changes
- **Lazy loading** — pages can be fetched on demand as the user navigates
- **Hot update** — write a new version of a file and the component re-renders
- **Manifest loading** — bulk-fetch an app's files in one call

The VFS is not IndexedDB or localStorage — it's a plain in-memory Map. Fast,
simple, ephemeral. For persistence, the server delivers files on page load.

## File-Based Router

URLs map to VFS paths. The routing conventions match Next.js / SvelteKit:

```javascript
import { createRouter } from '@rip-lang/ui/router'

const router = createRouter(fs, { root: 'pages' })
```

| VFS Path | URL Pattern | Example |
|----------|-------------|---------|
| `pages/index.rip` | `/` | Home page |
| `pages/about.rip` | `/about` | Static page |
| `pages/users/index.rip` | `/users` | User list |
| `pages/users/[id].rip` | `/users/:id` | Dynamic segment |
| `pages/blog/[...slug].rip` | `/blog/*slug` | Catch-all |
| `pages/_layout.rip` | — | Root layout (wraps all pages) |
| `pages/users/_layout.rip` | — | Nested layout (wraps `/users/*`) |

```javascript
// Navigate
router.push('/users/42')
router.replace('/login')
router.back()

// Reactive route state
effect(() => {
  console.log(router.path)     // '/users/42'
  console.log(router.params)   // { id: '42' }
})
```

The router intercepts `<a>` clicks automatically for SPA navigation. External
links and modified clicks (ctrl+click, etc.) pass through normally.

## Reactive Stash

Deep reactive state tree with path-based navigation. Every nested property is
automatically tracked — changing any value triggers fine-grained updates.

```javascript
import { stash, effect } from '@rip-lang/ui/stash'

const app = stash({
  user: { name: 'Alice', prefs: { theme: 'dark' } },
  cart: { items: [], total: 0 }
})

// Direct property access (tracked)
app.user.name                       // 'Alice'
app.user.prefs.theme = 'light'      // triggers updates

// Path-based access
app.get('user.prefs.theme')         // 'light'
app.set('cart.items[0]', { id: 1 }) // deep set with auto-creation
app.has('user.name')                // true
app.del('cart.items[0]')            // delete
app.inc('cart.total', 9.99)         // increment
app.merge({ user: { role: 'admin' }}) // shallow merge
app.keys('user')                    // ['name', 'prefs', 'role']

// Reactive effects
effect(() => {
  console.log(`Theme: ${app.user.prefs.theme}`)
  // Re-runs whenever theme changes
})
```

### State Tiers

Three levels of reactive state, each scoped appropriately:

| Tier | Scope | Lifetime | Access |
|------|-------|----------|--------|
| **App** | Global | Entire session | `app.user`, `app.theme` |
| **Route** | Per-route | Until navigation | `router.params`, `router.query` |
| **Component** | Per-instance | Until unmount | `:=` reactive state |

App state lives in the stash. Route state lives in the router. Component state
lives in the component instance as signals. All three are reactive — changes at
any level trigger the appropriate DOM updates.

## Component Renderer

The renderer is the bridge between the router and the DOM. When the route
changes, the renderer:

1. Resolves the VFS path for the new route
2. Reads the `.rip` source from the VFS
3. Compiles it to JavaScript using the Rip compiler
4. Evaluates the compiled code to get a component class
5. Instantiates the component, passing route params as props
6. Wraps it in any applicable layout components
7. Mounts the result into the DOM target
8. Runs transition animations (if configured)
9. Unmounts the previous component

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

renderer.start()   // Watch for route changes, mount components
renderer.stop()    // Unmount everything, clean up
```

### Compilation Cache

Compiled components are cached by VFS path. A file is only recompiled when it
changes. The VFS watcher triggers cache invalidation, so updating a file in the
VFS automatically causes the next render to use the new version.

## Quick Start

### Minimal HTML Shell

```html
<!DOCTYPE html>
<html>
<head><title>My App</title></head>
<body>
  <div id="app"></div>
  <script type="module">
    import { compileToJS } from './rip.browser.js'
    import { createApp } from './ui.js'

    const app = createApp({
      target: '#app',
      compile: compileToJS,
      state: { theme: 'light' }
    })

    // Load pages into the VFS
    await app.load([
      'pages/_layout.rip',
      'pages/index.rip',
      'pages/about.rip'
    ])

    // Start routing and rendering
    app.start()
  </script>
</body>
</html>
```

### Inline Components (No Server)

```html
<script type="module">
  import { compileToJS } from './rip.browser.js'
  import { createApp } from './ui.js'

  createApp({
    target: '#app',
    compile: compileToJS,
    files: {
      'pages/index.rip': `
        Home = component
          render
            h1 "Hello, World"
            p "This was compiled in your browser."
      `
    }
  }).start()
</script>
```

### File Structure

```
my-app/
├── index.html               # HTML shell (the only "build" artifact)
├── rip.browser.js           # Rip compiler (35KB)
├── ui.js                    # Framework entry point
├── stash.js                 # Reactive state
├── vfs.js                   # Virtual File System
├── router.js                # File-based router
├── renderer.js              # Component renderer
├── pages/
│   ├── _layout.rip          # Root layout (nav, footer)
│   ├── index.rip            # Home page       → /
│   ├── about.rip            # About page      → /about
│   └── users/
│       ├── _layout.rip      # Users layout    → wraps /users/*
│       ├── index.rip        # User list       → /users
│       └── [id].rip         # User profile    → /users/:id
└── css/
    └── styles.css           # Tailwind or plain CSS
```

## Render Template Syntax

The `render` block uses a concise, indentation-based template syntax:

### Tags and Classes

```coffee
render
  div                           # <div></div>
  div.card                      # <div class="card"></div>
  div.card.active               # <div class="card active"></div>
  button.btn.btn-primary        # <button class="btn btn-primary"></button>
```

### Dynamic Classes (CLSX)

```coffee
render
  div.("active" if @selected)                    # conditional class
  div.("bg-red" if error, "bg-green" if ok)      # multiple conditions
  div.card.("highlighted" if @featured)           # static + dynamic
```

Dynamic class expressions are evaluated at runtime. Falsy values are filtered
out. This provides native CLSX-like behavior without a library.

### Attributes and Events

```coffee
render
  input type: "text", placeholder: "Search..."
  button @click: @handleClick, "Submit"
  a href: "/about", "About Us"
  img src: @imageUrl, alt: "Photo"
```

### Text and Interpolation

```coffee
render
  h1 "Static text"
  p "Hello, #{@name}"
  span "Count: #{@count}"
```

### Conditionals

```coffee
render
  if @loggedIn
    p "Welcome back, #{@name}"
  else
    p "Please log in"
```

### Loops

```coffee
render
  ul
    for item in @items
      li item.name
```

### Nesting

Indentation defines parent-child relationships:

```coffee
render
  div.app
    header.app-header
      h1 "My App"
      nav
        a href: "/", "Home"
        a href: "/about", "About"
    main.app-body
      p "Content goes here"
    footer
      p "Footer"
```

## API Reference

### `createApp(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `target` | `string\|Element` | `'#app'` | DOM mount target |
| `state` | `object` | `{}` | Initial app state (becomes reactive stash) |
| `files` | `object` | `{}` | Initial VFS files `{ path: content }` |
| `root` | `string` | `'pages'` | Pages directory in VFS |
| `compile` | `function` | — | Rip compiler (`compileToJS`) |
| `transition` | `object` | — | Route transition `{ duration }` |
| `onError` | `function` | — | Error handler |
| `onNavigate` | `function` | — | Navigation callback |

Returns: `{ app, fs, router, renderer, start, stop, load, go, addPage, get, set }`

### `stash(data)`

Creates a deeply reactive proxy around `data`. Every property read is tracked,
every write triggers effects.

### `effect(fn)`

Creates a side effect that re-runs whenever its tracked dependencies change.

### `computed(fn)`

Creates a lazy computed value that caches until dependencies change.

### `batch(fn)`

Groups multiple state updates — effects only fire once at the end.

## Design Principles

**No build step.** The compiler is small enough to ship. Source files are the
deployment artifact.

**Language-native reactivity.** `:=` for state, `~=` for computed, `~>` for
effects. These are Rip language features, not framework APIs.

**Fine-grained DOM updates.** No virtual DOM. Each reactive binding creates a
direct effect that updates exactly the DOM nodes it touches.

**Components are classes.** `component` produces an anonymous ES6 class.
Methods, lifecycle hooks, and state are ordinary class members. No hooks API, no
composition functions, no magic — just a class with a `render` method.

**Props are instance variables.** `@count := 0` defines a reactive prop. The
parent can set it, ignore it, or share a signal. The child owns it.

**File-based everything.** Components live in the VFS. Routes map to VFS paths.
Layouts are `_layout.rip` files in the directory tree. The file system is the
API.

## License

MIT

## Links

- [Rip Language](https://github.com/shreeve/rip-lang)
- [@rip-lang/api](../api/README.md)
- [@rip-lang/server](../server/README.md)
- [Report Issues](https://github.com/shreeve/rip-lang/issues)
