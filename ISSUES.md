# Known Issues

Concrete issues flagged during review but not fixed yet. Each entry includes
**Severity**, **What it is**, **Why it's deferred**, and **What a fix looks like**
so the next pass can decide where to invest. See `TODOS.md` for
exploratory/future-work items that aren't defects.

---

## 1. Server-side rendering mutates `globalThis.document` process-wide

**Severity:** high (correctness under concurrency)

**Affected files:**
- `packages/ui/html.rip` — `_renderComponent`
- `packages/ui/email/render.rip` — identical pattern (pre-existing)

**What it is.** Both renderers swap `globalThis.document`, `globalThis.Node`,
and `globalThis.SVGElement` for the duration of a render, then restore them in
`finally`. In any process where two renders overlap (parallel `await
Promise.all(...)`, concurrent request handlers, etc.) they observe each
other's state. Current symptoms range from wrong output to cross-request
contamination. The `html.rip` header already documents this as a requirement
that renders be serialized per process.

**Why deferred.** Inherited convention from the email package, which is in
production use. Fixing one without the other leaves an inconsistent model.
The fix touches a hot path and wants careful testing.

**What a fix looks like.**
- Thread `document`/`Node`/`SVGElement` through an explicit render context
  argument, removing the `globalThis` dance entirely. Components that read
  `document` from globals become the only remaining callers to handle.
- Alternatively, isolate each render in an `AsyncLocalStorage` scope and
  read `document` from the store. Lower-risk but leaks the abstraction into
  the component DSL's environment access.
- Apply the fix in both `html.rip` and `email/render.rip` together, then
  extract the shared `_renderComponent` core.

---

## 2. `_renderComponent` duplicated across `ui/html.rip` and `ui/email/render.rip`

**Severity:** medium (DRY)

**Affected files:**
- `packages/ui/html.rip` — `_renderComponent` (13 lines)
- `packages/ui/email/render.rip` — `_renderComponent` (~25 lines, includes
  Tailwind inlining and XHTML doctype)

**What it is.** The DOM-shim setup, component instantiation, and teardown
logic is essentially the same in both files. The email version adds two
opt-in concerns (XHTML doctype, Tailwind inlining). Today they drift
independently.

**Why deferred.** The two renderers are working; no urgent correctness issue.
Naturally paired with issue #1 — any fix to the concurrency hazard will want
to touch both files anyway.

**What a fix looks like.** Extract the shared core to a new `packages/ui/render.rip`
(or into `packages/ui/email/dom.rip`). `html.rip` and `email/render.rip`
become thin wrappers that add their respective concerns (doctype, Tailwind
inlining). Ideally paired with #1.

---

## 3. `apps/medlabs/app/index.rip` reads `index.css` once at module init

**Severity:** low (dev-workflow ergonomics)

**What it is.** The Document component calls `readFileSync(..., 'index.css')`
at module load time. In production this is correct and efficient. In dev,
editing `app/index.css` doesn't take effect until the server restarts, even
with the reload socket active for Rip sources.

**Why deferred.** The `use serve ... watch: true` middleware already reloads
Rip files; CSS changes just need a similar path. Not urgent while the app is
stable.

**What a fix looks like.**
- Option A: read `index.css` on every render in dev mode only (detect via
  `SOCKET_PREFIX`), cache in production.
- Option B: wire a small watcher that invalidates an in-memory CSS cache when
  the file changes.
- Option C: serve `/index.css` as an external `<link>` instead of inlining.
  Tailwind's browser CDN would have to be told to process it; currently the
  CDN scans for inline `<style type="text/tailwindcss">` blocks.

---

## 4. `streamline` and `trustlabs` still use sentinel `index.html`

**Severity:** low (asymmetry)

**Affected files:**
- `apps/streamline/app/index.html` (and `apps/streamline/index.rip`
  string-replace block, if present)
- `apps/trustlabs/app/index.html` (same)

**What it is.** Only `medlabs` has been migrated to the Rip `Document`
component + `renderDocument`. The other two apps still keep a raw `.html`
file with `__UPPERCASE__` sentinels and a chain of `.replace()` calls in
their server entry.

**Why deferred.** Each app's migration is short but needs end-to-end testing
of the specific site-bundle cascade, fonts, and any app-specific state. Not
urgent; the sentinel pattern works.

**What a fix looks like.** Mirror the medlabs migration in each app:
1. Create `app/index.rip` exporting a `Document` component.
2. Import `renderDocument` from `@rip-lang/ui/html` in the server entry.
3. Replace the `readFileSync` + `.replace()` chain with
   `renderDocument Document, bundle: bundle`.
4. Delete `app/index.html`.

---

## 5. Grammar docs don't mention hyphen / mixed compound keys

**Severity:** low (docs)

**Affected files:**
- `docs/RIP-LANG.md` — the section covering dotted keys (near line 409:
  "In component render blocks, `x.y` on its own line is parsed as a tag…")

**What it is.** Tests in `test/rip/basic.rip` document the behavior
(`hyphen key simple`, `mixed key dot-hyphen`, etc.), but the primary language
reference still only mentions dotted keys. A user reading the docs won't
discover that `data-src: "x"` works, nor the no-whitespace discipline.

**Why deferred.** Feature works and is tested; documentation lag is a
low-severity kind of debt.

**What a fix looks like.** Extend the existing dotted-keys paragraph with one
sentence explaining the hyphen and mixed forms, plus the "no whitespace and
no newline on either side of `-`" discipline. Two short examples
(`data-src: 1`, `beta-site.amazon.com: 1`) are enough.

---

## 6. Additional lexer contexts not explicitly tested for compound keys

**Severity:** low (defensive coverage)

**Affected files:**
- `test/rip/basic.rip` (coverage gap)
- `src/lexer.js` (paths that share the `:` handler)

**What it is.** Current tests cover top-level object literals, inline object
literals, and implicit multi-line objects. They do NOT exercise:

- Destructuring patterns (e.g. `{ data-src } = obj`) — compound-key support
  here is probably not meaningful, but a negative test would document that.
- Class-body key-like positions, if any path permits them.
- Comments interleaved between chain tokens (e.g. `foo-/*x*/bar:`).

`@data-x:` has been manually verified to work.

**Why deferred.** The three known hot sites (implicit-call guard, `:`
handler, `looksObjectish`) share helpers from module scope so drift is
unlikely. Existing 12 tests already cover the main regression surface.

**What a fix looks like.** One or two more tests per context, focused on
"does not misparse / does not silently become a compound key where it
shouldn't". Small additions to `test/rip/basic.rip`.

---

## 7. `renderDocument` name is slightly narrower than it sounds

**Severity:** low (naming)

**Affected files:**
- `packages/ui/html.rip`

**What it is.** `renderDocument(Component, props)` unconditionally prepends
`<!DOCTYPE html>`. That's correct when the component's root is `<html>`, but
misleading if someone tries to render a non-document component through it.

**Why deferred.** The name is plausible and the lower-level `toHTML`
(which does NOT prepend the doctype) is the right escape hatch. Renaming
churns imports across apps.

**What a fix looks like.** Either:
- Rename to `renderHtmlDocument` (or `renderPage`) and update callers
  (`apps/medlabs/index.rip` is currently the only caller).
- Leave the name; tighten the docstring to say "for `<html>`-rooted
  components; use `toHTML` for fragments".
