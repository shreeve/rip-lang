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
bun packages/grid/dev.rip
```

Then open http://localhost:3003.

## Status

- **Phase 1** — Viewport (read-only grid) ✓
- **Phase 2** — Selection and Navigation (in progress)
- **Phase 3** — Editing
- **Phase 4** — Sorting, Filtering, Clipboard
- **Phase 5** — Column Resize, Reorder, Freeze
- **Phase 6** — Polish and Performance

See [GRID.md](GRID.md) for the full specification.
