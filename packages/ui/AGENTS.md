# Unified UI Package Guide

`@rip-lang/ui` is the umbrella package for browser widgets, email components, shared helpers, and Tailwind integration.

## Domain boundaries

- `browser/` owns interactive headless widgets and browser-only DOM behavior
- `email/` owns curated email rendering, serializers, and email-client compatibility
- `shared/` owns only truly cross-domain utilities
- `tailwind/` is the only place where `tailwindcss` and `css-tree` may be imported

## Typing

All exported browser and email components should use explicit Rip types on their public props. Use the existing virtual TypeScript pipeline (`rip check`, LSP, generated virtual TS) during development; do not emit scattered `.d.ts` files during active work.

## Gallery

The root `index.html` / `index.css` / `index.rip` form a showcase layer only. Components stay headless and unstyled. The gallery itself is intentionally polished.

## First Read For Agents

When working in `packages/ui`, do not rely only on automatic context pickup from nested `AGENTS.md` files. For strong results, proactively read these files at the start of the task:

1. `packages/ui/AGENTS.md` — package boundaries, architecture, reuse policy
2. `packages/ui/browser/AGENTS.md` — widget conventions, gotchas, popup/focus patterns
3. `packages/ui/DEBUG.md` — current local-debug workflow, live gallery URL, known-good browser signals

Then, if the task involves a hard popup/input widget, inspect the current reference component before making changes:

- `packages/ui/browser/components/multi-select.rip`

Use `multi-select.rip` as the reference example for:

- layered popup mechanics vs widget-local semantics
- nested interactive affordance isolation
- reopen suppression after pointer-driven closes
- composite input styling with an embedded input inside a larger shell

This startup sequence gets an agent much closer to “current project reality” than `AGENTS.md` inheritance alone.

## Browser Widget Direction

For complex browser widgets, prefer a layered design:

- keep generic popup, focus, keyboard, and timing logic in the shared `ARIA` helper layer in `src/ui.rip`
- keep component-specific semantics local to the widget (`chips`, token removal, selection rules, etc.)
- do not solve browser event-ordering bugs independently in every component if the underlying problem is generic

The current model is:

- `ARIA` / `__aria` owns shared primitives such as popup dismissal, popover binding, dialog binding, positioning, roving/list navigation, and short reopen-suppression after pointer-driven closes
- individual components own only the semantics that make that widget unique

## Reference Component

`browser/components/multi-select.rip` is the reference example for a "hard" composite widget in this package.

Use it as the model for components that combine:

- popup lifecycle
- embedded inputs
- nested interactive affordances
- keyboard navigation
- multiple coordinated state transitions

What it should demonstrate:

- clear separation between shared popup mechanics and local widget semantics
- consistent naming (`on...` for auto-wired root handlers, `_on...` for child handlers, `_...` for private helpers/refs/state)
- explicit isolation of nested controls when `mousedown` / focus ordering would otherwise leak into parent behavior
- behavior that matches high-quality headless UI expectations before adding styling

## Reuse Policy

When building or refactoring browser widgets:

- extract the smallest stable shared primitive into `src/ui.rip`
- do not create a giant generic base component prematurely
- reuse `ARIA.popupGuard()` for pointer-driven close/reopen timing problems in popup-style controls
- keep styling fixes in the gallery CSS unless the component itself is shipping opinionated visuals

Good candidates for shared primitives:

- reopen suppression after outside-click dismissal
- popup dismissal wiring
- keyboard navigation helpers
- focus restoration / modal stack handling

Bad candidates for premature abstraction:

- token rendering rules
- chip-specific behaviors
- widget-specific content semantics
