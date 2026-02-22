# Grid Package — Agent Notes

## Rip Syntax Rules

These are hard-won rules learned while building this grid. Follow them.

### Render Blocks

- **One element or component per line.** This is by design. Never double up
  elements on a single line (e.g., `h1 "Title" span "info"` is wrong).

- **Direct expressions work in elements.** Prefer `td value` over
  `td "#{value}"`. Both compile, but the former is cleaner.

- **Dynamic class names** use dot-parentheses syntax:
  `tr.(row.idx % 2 is 0 and 'even')`

### Operators

- **`??` for null coalescing.** A standalone `?` with whitespace around it is
  illegal — the parser can't distinguish it from a ternary. Use `??` instead:
  `val = x ?? ''`

- **`?.` optional chaining does not exist.** Use an `if` guard:
  ```coffee
  if @_resizeObs
    @_resizeObs.disconnect()
  ```

### Reactive Primitives

- `:=` — reactive state (triggers updates on mutation)
- `~=` — computed value (pure function of reactive dependencies)
- `~>` — effect (runs when dependencies change, auto-cleanup)
- `<=>` — two-way binding

### Component Patterns

- Use child components to work around nested loop scoping. If a render block
  has nested `for` loops, the inner loop cannot access the outer loop variable.
  Extract the inner loop into a child component and pass data as props.

- Pre-compute cell values in `visibleRows` rather than accessing raw data in
  deeply nested render loops.

### Dev Server

- Run `bun grid.rip` from the **repo root** (not `packages/grid/`) so that
  `bunfig.toml` is picked up and `rip-loader.js` preloads the compiler.

- The dev server runs on port 3003 and serves `grid.html` plus `rip-ui.min.js`.

## Architecture

See `GRID.md` for the full specification. The grid is built as:

- `grid.html` — single-file development with inline `<script type="text/rip">` blocks
- `grid.rip` — minimal Bun server using `@rip-lang/api` and `@rip-lang/api/serve`
- Components: `Grid` (main grid) and `GridRow` (row renderer)
