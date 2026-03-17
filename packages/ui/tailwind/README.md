# @rip-lang/ui/tailwind

Real Tailwind integration for the unified UI package.

Exports:
- `compile(classes, config?)`
- `prepareConfig(config?)`
- `inlineEmailTree(rootNode, config?)`
- `generateBrowserCss(classes, config?)`

This is the only domain that talks directly to `tailwindcss` and `css-tree`.

## Prepared configs

The default config works out of the box. Custom configs need a one-time async preparation step before they can be used from the synchronous unified-ui render path:

```coffee
import { prepareConfig } from '@rip-lang/ui/tailwind'

await prepareConfig
  theme:
    extend:
      colors:
        brand: '#0f172a'
```

After preparation, pass the same config to `compile()`, `generateBrowserCss()`, or the email `Tailwind` component.
