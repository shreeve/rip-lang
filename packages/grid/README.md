<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip Grid - @rip-lang/grid

> **High-performance, reactive, virtual-scrolling data grid written entirely in Rip.**

- 100K+ rows at 60fps scroll
- Fine-grained reactive updates
- Zero dependencies — pure Rip, compiled to ES2022
- Semantic HTML `<table>` with sticky headers
- Themeable via CSS custom properties
- Dark mode support

## Development

From the repo root:

```bash
bun packages/grid/grid.rip
```

Then open http://localhost:3003.

## Status

- **Phase 1** — Viewport ✓
- **Phase 2** — Selection and Navigation ✓
- **Phase 3** — Editing ✓
- **Phase 4** — Features (in progress: sorting ✓, resize ✓, freeze, reorder, clipboard, undo/redo)
- **Phase 5** — Polish and Performance

See [GRID.md](GRID.md) for the full specification.
