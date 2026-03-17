# Email Domain Guide

Curated PascalCase email components for `@rip-lang/ui/email`.

Internally, the components use native lowercase HTML tags in Rip render blocks and are rendered server-side through a DOM shim.

Key APIs:
- `toHTML`
- `toText`
- `renderEmail`

Type all exported component props explicitly with `@prop:: T := default`.

Tailwind note:
- the email domain must not import `tailwindcss` or `css-tree` directly
- `Tailwind` support goes through `@rip-lang/ui/tailwind`
