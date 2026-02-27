# Widget Priorities

The 15 most important things to do next, in order. Each builds on the ones
before it. The theme: stop building new things and start proving what exists.

---

1. **Run the widgets.** Spin up the labs app with `rip server`, open the
   browser, and see what compiles and what doesn't. Every bug found here
   is a bug that won't surprise a user later. Nothing else matters until
   the code actually executes.

2. **Fix whatever breaks.** The code review caught 4 bugs without running
   anything. There will be more — syntax the compiler rejects, runtime
   errors in effects, timing issues with `mounted` and DOM queries. Fix
   them immediately while the context is fresh.

3. **Write tests for the Grid.** The Grid is the highest-value, highest-risk
   widget. Test the viewport engine (startRow/endRow calculation), DOM
   recycling (pool sizing, cell content updates), clipboard round-trip
   (copy TSV, parse TSV, verify values), and sort index correctness.
   Use `test` blocks for runtime assertions.

4. **Write tests for Dialog.** Focus trap is notoriously hard to get right.
   Test: focus moves to first focusable element on open, Tab wraps within
   the dialog, Escape closes, click outside closes, focus restores to the
   previously focused element on close, body scroll is locked while open.

5. **Write tests for Select.** Test: ArrowDown/Up navigate options, Enter
   selects, Escape closes, typeahead jumps to matching option, Home/End
   work, selected value updates the trigger label, `data-highlighted` and
   `data-selected` are set correctly.

6. **Fix the Menu structural issue.** The `slot` slot renders inside the
   trigger button, making menu items unreachable by `_menuEl`. Adopt the
   same hidden-slot pattern that Select uses for option discovery. This is
   a real bug, not a design preference.

7. **Fix the Accordion wiring.** Add ARIA attributes (`aria-expanded`,
   `aria-controls`, `role="region"`). Wire `@click` and `@keydown` to
   trigger elements in the render block. Set `data-open` on items. Right
   now it's a behavior mixin pretending to be a widget.

8. **Grid: frozen columns.** The CSS is documented, the column definition
   supports `frozen: true`, and the implementation is ~15 lines in the cell
   update loop. This is the most-requested grid feature after what already
   exists. Apply `position: sticky`, cumulative left offset, and z-index
   layering.

9. **Grid: replace hardcoded selection color.** Change `#3b82f6` in the
   selection overlay effect to `var(--grid-selection-color, #3b82f6)`. Read
   the computed style once and cache it, or use CSS custom properties
   directly in the box-shadow strings. Small change, big principle — a
   headless widget should never hardcode colors.

10. **Build a standalone Grid demo page.** A single HTML file (like the
    original `packages/grid/grid.html`) that loads `rip.min.js`, mounts
    the Grid widget with 100K rows, and lets people scroll, select, edit,
    sort, resize, copy, and paste. This is the proof point. If it runs at
    60fps, the Grid is real. If it doesn't, we find out now.

11. **Grid: CellRange model.** Replace the raw `activeRow`/`activeCol`/
    `anchorRow`/`anchorCol` integers with proper CellCoords and CellRange
    objects. This unlocks multi-range selection (Ctrl+click) and makes
    the clipboard, selection overlay, and keyboard navigation code cleaner
    and more correct.

12. **Grid: undo/redo.** A stack of `{ row, col, oldValue, newValue }`
    entries. Ctrl+Z pops, Ctrl+Shift+Z pushes back. The `commitEditor`
    method already has `oldVal` and `val` — push to the stack there.
    Cut and paste should also create undo entries. ~40 lines.

13. **Resolve the Popover dual-slot problem.** Document a recommended
    pattern (e.g., "wrap your trigger in a div with `data-trigger`, wrap
    your content in a div with `data-content`") or restructure the widget
    to query `[data-trigger]` and `[data-content]` children explicitly.
    The current "first child is trigger, second is content" is ambiguous
    because `slot` renders everything into one slot.

14. **Add dark mode tokens to the labs app CSS.** The patterns are documented
    in ARCHITECTURE.md. Add `@media (prefers-color-scheme: dark)` blocks to
    `tokens.css` that swap surface, text, and border variables. The Grid
    already has dark mode CSS from its original `grid.html` — port those
    custom property overrides.

15. **Publish the widget suite.** Once tests pass and the demo works, make
    `packages/widgets/` available. Since widgets are plain `.rip` source
    files with no build step, "publishing" means making them discoverable
    — documenting the `components:` serve middleware option, adding the
    widgets path to the Rip project template, and linking from the main
    README.

---

## Postmortem: Building the Widget Suite

Reflections after designing, implementing, reviewing, and documenting 11
headless widgets and a full-stack demo app in one session.

### What We Learned

The biggest thing was how Rip's model differs from everything else. When
building the widgets, the unconscious pull is toward React patterns — hooks,
virtual DOM diffing, component trees. Rip doesn't work that way. The reactive
primitives (`:=`, `~=`, `~>`) are genuinely lower-level and more direct. An
effect that returns a cleanup function just works. No dependency arrays, no
stale closure bugs, no rules-of-hooks violations. The Grid's DOM recycling
effect watches `startRow` and `endRow` and fires when they change — you don't
have to tell it what to watch. That's not a toy pattern. That's a better
abstraction.

The `->` auto-conversion inside components was a revelation. In React you
constantly think about binding context. In Rip, the compiler handles it
silently. The `onMount` vs `mounted` trap was the flip side — the compiler is
opinionated and you have to know its vocabulary. Both are now documented
because the next person will hit them.

The Grid taught us the most. Starting with the reactive render loop
(`for row in visibleRows` creating GridRow components), hitting the
performance wall, then replacing it with imperative DOM recycling — that
progression showed where Rip's reactive model excels (table structure,
header, selection overlay) and where you need to step outside it (60fps
scroll of 50 rows per frame). The fact that you can step outside it cleanly
— imperative DOM inside a `~>` effect — is a strength, not a weakness.
React makes that transition painful. Rip makes it natural.

### How Solid Is This?

**The language and runtime: very solid.** Fine-grained reactivity, compiled
components, zero runtime dependencies, no virtual DOM overhead. The
architecture is sound and the performance model is correct. Rip UI can do
things that React fundamentally cannot — like the Grid's hybrid approach
where the framework handles the structure and raw DOM handles the hot path,
all in one component.

**The widgets: honest assessment — first draft.** They follow the right
patterns, they have the right ARIA, they handle the right keyboard
interactions. But they haven't been compiled, run, or tested. The code
review caught 4 real bugs and 3 structural issues without executing anything.
There will be more bugs when they first run. The Accordion and Menu have
architectural problems that need design decisions, not just fixes. Popover's
dual-slot issue needs named slots that Rip UI doesn't have yet.

**The Grid specifically: genuinely promising.** 858 lines for virtual
scrolling, DOM recycling, cell selection, keyboard navigation, inline
editing, multi-column sorting, column resizing, and full clipboard — that's
remarkably compact. Handsontable needs 50,000+ lines for the same feature
set (plus walkontable, SheetClip, and dozens of plugins). AG Grid is even
larger. The Grid isn't feature-complete, but the foundation is
architecturally correct and the performance approach is what the mature
grids do.

### Toy or Real?

Not a toy.

**What Rip UI has that React/Vue/Svelte don't:**

- Language-level reactivity — no imports, no boilerplate
- Fine-grained DOM updates without a virtual DOM
- Components that compile to JavaScript with zero runtime overhead
- The ability to mix reactive rendering and imperative DOM in one component
- Zero dependencies, zero build step for the consumer

**What the widget suite has that shadcn/Radix/Base UI don't:**

- No framework dependency — works anywhere Rip runs
- Ships as source `.rip` files — the browser compiles them, no build step
- Truly headless — zero CSS, only `data-*` attributes
- One file per widget, not a tree of hooks and context providers

**What's missing to be taken seriously:**

- Tests. None of the widgets have tests. This is the single biggest gap.
- Battle-testing. The first real app that uses them will shake out bugs.
- The structural issues (Accordion, Menu, Popover) need resolution.
- The Grid needs frozen columns and the CellRange model to be competitive.
- Documentation examples that people can copy-paste and see working.

The system is on track. The architecture is right, the performance model is
right, the distribution model (serve `.rip` source, compile in browser) is
right. What's needed now is not more features — it's running the code,
hitting the bugs, and hardening what exists. The gap between "promising
architecture" and "production system" is closed by testing and usage, not
by writing more widgets.
