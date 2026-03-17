# @rip-lang/ui/browser

Headless, accessible browser widgets for Rip.

The components are source-first `.rip` files intended to be bundled and compiled in the browser. They expose semantic state through `$` / `data-*` attributes and ship no visual CSS.

```coffee
use serve
  dir: dir
  bundle: ['browser/components']
```
