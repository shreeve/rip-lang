# Rip App Demo

The canonical "everything in one file" demo of the Rip App framework. Six components covering layout, routing, reactive state, list rendering, and reusable component composition.

## Layout

```
apps/demo/
├── components/
│   ├── _layout.rip   — root layout with nav + error boundary
│   ├── index.rip     — Home page (file-based routing: / → index.rip)
│   ├── counter.rip   — reactive state, := / ~> persistence to stash
│   ├── todos.rip     — list rendering, computed values, event handlers
│   ├── about.rip     — uses the Card component for content sections
│   └── card.rip      — reusable component with @children
└── css/
    └── styles.css    — design tokens + component styles, no Tailwind
```

## Bundle to one JSON file

```bash
bun run bundle:demo
# wraps:
# bun scripts/bundle-app.js apps/demo -o docs/example/index.json -t "Rip App Demo"
```

Output: `docs/example/index.json` — a single ~17 KB file containing every component's raw `.rip` source plus all CSS, ready to ship to any static host. The launcher at `docs/example/index.html` fetches it once and runs the whole app from memory: no bundler, no build step, no per-component network requests.

## Architecture

This is the "burn a CD" deployment model for a Rip app. The browser loads:

1. `docs/dist/rip.min.js` (~80 KB Brotli) — the compiler + framework + reactive runtime
2. `docs/example/index.json` (~17 KB) — the entire app's source

Then `<script type="text/rip">launch bundle: bundle</script>` mounts everything. Routing, reactivity, fine-grained DOM updates, all driven by code that compiles in the browser at mount time.

## Iterating

Edit any `.rip` file under `components/`, then re-run `bun run bundle:demo` to refresh the bundled JSON. The launcher HTML at `docs/example/` will pick up the new bundle on next load.

CSS is concatenated alphabetically by filename. Add `.css` files under `css/` to extend the design.
