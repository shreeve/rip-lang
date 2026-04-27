# @rip-lang/ui/shared

Cross-domain helpers shared by the HTML / browser and email rendering
domains. Internal infrastructure — not part of the package's public API.

Files:

- `render.rip` — SSR core that both `../html.rip` and `../email/render.rip`
  wrap. Owns the DOM-shim setup, lifecycle invocation, and the runtime
  serialization assertion. Synchronous only.
- `styles.rip` — small style-string helpers (`joinStyles`, etc.) used
  across both rendering paths.
