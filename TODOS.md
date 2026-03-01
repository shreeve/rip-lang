# TODOs

Items to explore in future sessions.

---

## Browser Debugger with Source Maps

Implement `debugger` statement support in browser-compiled Rip code with source maps, so the browser DevTools takes you directly to the Rip source line.

Rip already generates Source Map V3 via `rip -m` (inline, line-level mappings). The missing piece: get source maps into browser-compiled code (`rip.min.js` compiles `.rip` files on the fly via `processRipScripts()`). The compiled JS needs an inline `//# sourceMappingURL=data:...` comment that maps back to the original `.rip` source.

This would enable:
- `debugger` in Rip source → browser pauses at the Rip line
- Stack traces pointing to `.rip` files and line numbers
- Step debugging through Rip source in DevTools
- Breakpoints set directly in `.rip` files via DevTools Sources panel

The `SourceMapGenerator` in `src/sourcemaps.js` (189 LOC) already produces the VLQ-encoded mappings. The browser entry point `src/browser.js` compiles each `<script type="text/rip">` source — it just needs to pass `{ sourceMap: true }` and append the map to the compiled output.
