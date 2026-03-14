# UI Quality Bar

This package now has an end-to-end browser harness for modern overlay primitives
(`popover`, `<dialog>`, anchor positioning behavior) and keyboard/accessibility
smoke checks.

## Goals

- Catch regressions in overlay open/close semantics early.
- Keep behavior consistent across Chromium, Firefox, and WebKit.
- Verify baseline ARIA/role wiring for critical widgets.

## Run

From repo root:

```bash
bun run test:ui:chromium
bun run test:ui
bun run test:ui:axe
```

From `packages/ui`:

```bash
bun run test:e2e:chromium
bun run test:e2e
bun run test:e2e:headed
bun run test:e2e:axe
```

## Browser Setup

Playwright binaries are not pinned as repo dependencies. Install browsers on
your machine as needed:

```bash
bunx playwright install chromium firefox webkit
```

## Current Coverage

`tests/e2e/overlay-primitives.spec.js` covers:

- Popover: open/escape/outside-dismiss
- Dialog: open + escape close
- AlertDialog: escape blocked until explicit action
- Menu: role/open-state semantics
- Select: keyboard open/selection close
- Tooltip: hover + role visibility
- Nested overlay: popover interaction while dialog is open
- Race smoke: repeated popover open/escape cycles
- Optional axe scan (`UI_AXE=1`): blocks on critical issues; reports serious issues

## Next Tightening Steps

- Add focus-return assertions for all modal/popup components.
- Add stress tests for rapid toggle/open-close races.
- Expand axe coverage to include menubar/nav-menu and context-menu sections.
