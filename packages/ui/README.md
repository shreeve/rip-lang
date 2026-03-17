<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip UI - @rip-lang/ui

> **Unified UI system for Rip.**

`@rip-lang/ui` is the umbrella package for:
- `@rip-lang/ui/browser` — headless interactive browser widgets
- `@rip-lang/ui/email` — curated PascalCase email components
- `@rip-lang/ui/shared` — shared render/styling helpers
- `@rip-lang/ui/tailwind` — Tailwind compiler/inlining integration

## Import Paths

```coffee
import { Select, Dialog, Tabs } from '@rip-lang/ui/browser'
import { toHTML, Email, Head, Body, Text, Button } from '@rip-lang/ui/email'
import { compile, inlineEmailTree, generateBrowserCss } from '@rip-lang/ui/tailwind'
```

The root package is intentionally minimal and does not flatten browser + email names into one namespace.

## Domains

### Browser

Headless, accessible browser widgets authored in Rip. They remain source-first and expose state via `$` / `data-*` attributes for external styling.

### Email

Curated PascalCase email components with `toHTML`, `toText`, and `renderEmail` helpers, built on a server-side DOM shim and serializer.

### Shared

Cross-domain style and utility helpers such as `joinStyles()` and `withMargin()`.

### Tailwind

The one dependency-bearing domain. It invokes the real Tailwind compiler and provides CSS generation for browser use and CSS injection/inlining helpers for email.
