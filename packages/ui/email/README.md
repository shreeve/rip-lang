# @rip-lang/ui/email

Curated PascalCase email components for Rip.

```coffee
import { toHTML, Email, Head, Body, Container, Heading, Text, Button } from '@rip-lang/ui/email'
```

Exports:
- `toHTML`
- `toText`
- `renderEmail`
- `Email`, `Head`, `Body`, `Preview`, `Font`, `Container`, `Section`, `Row`, `Column`, `Heading`, `Text`, `Link`, `Image`, `Divider`, `Button`, `Markdown`, `CodeBlock`, `CodeInline`, `Tailwind`

Implementation notes:
- Components are authored as real Rip components using native lowercase HTML tags internally.
- `Tailwind` delegates to `@rip-lang/ui/tailwind` for CSS generation/injection.
- Exported props are typed with Rip's current component typing model and validated through the virtual TypeScript pipeline.

## Safety

- `Markdown` now escapes raw HTML from input before applying the supported markdown subset.
- Markdown links are restricted to safe href schemes (`http`, `https`, `mailto`, `tel`, `/`, `#`).
- `innerHTML` in this package should be treated as a curated rendering primitive, not a general-purpose raw HTML escape hatch.

## Render model

- `toHTML`, `toText`, and `renderEmail` are synchronous.
- Rendering works by swapping in a temporary global DOM shim while the email component tree is created and serialized.
- Keep this render path synchronous. Do not introduce awaits into component lifecycle code that runs during email rendering.

## Tailwind theming

Custom Tailwind config is supported in the synchronous email path, but the config must be prepared once ahead of rendering:

```coffee
import { prepareConfig } from '@rip-lang/ui/tailwind'

theme =
  theme:
    extend:
      colors:
        brand: '#0f172a'

await prepareConfig(theme)
```

Then pass the same config to the email `Tailwind` component:

```coffee
Tailwind config: theme
  # email content
```

Use one shared Tailwind config per rendered email tree.

## Runnable examples

From `packages/ui/email`:

```bash
../../../bin/rip example-1.rip > example-1.html
../../../bin/rip example-2.rip > example-2.html
```

- `example-1.rip` shows the plain curated-component workflow.
- `example-2.rip` shows a richer newsletter layout using the most email-safe current path: curated components plus inline styles.
- Both runnable examples load Inter from Google Fonts through the curated `Font` component.

For now, the curated component path is the best choice for emails you want to send broadly across clients. The Tailwind path is promising, but it is still better treated as an advanced or experimental workflow until more email-client hardening is done.
