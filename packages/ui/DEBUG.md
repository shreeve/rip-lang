# UI Debug Setup

This is the working local-debug loop for `packages/ui`.

## Server

Start the gallery server from `packages/ui`:

```bash
../server/bin/rip-server
```

Do not assume `localhost:3005` is the active browser target when running this server mode.

The useful local URLs are:

- `https://ui.ripdev.io`
- `https://rip.local`
- `https://ui.local`

In practice, the most reliable browser-debug target is:

```text
https://ui.ripdev.io
```

Why:

- the local TLS cert matches `ui.ripdev.io`
- `ui.local` can fail with `ERR_CERT_COMMON_NAME_INVALID`
- the app bundle, CSS, and watch endpoint all resolve correctly on `ui.ripdev.io`

## Fresh Assets

For UI iteration, use a cache-busting query string:

```text
https://ui.ripdev.io/?t=TIMESTAMP#select
```

The local `serve ... watch: true` path is intentionally configured to avoid `304` noise for the gallery bundle endpoints:

- `index.css` should be `200`
- `/rip/rip.min.js` should be `200`
- `/bundle` should be `200`

If you still see old behavior, confirm the browser is pointed at ``, not the public site and not the older `localhost:3005` flow.

## Chrome MCP

The reliable browser debugging loop is:

1. Edit local files.
2. Ensure the UI server is running on `https://ui.ripdev.io`.
3. Open a fresh Chrome MCP tab to:

   ```text
   https://ui.ripdev.io/?t=TIMESTAMP#select
   ```

4. Verify network requests:
   - document `200`
   - `index.css` `200`
   - `/rip/rip.min.js` `200`
   - `/bundle` `200`
5. Use `evaluate_script` to inspect widget state.

Useful checks:

```js
() => {
  const row = document.querySelector('#select .demo-row');
  const trigger = row?.querySelector('[role="combobox"]');
  const listbox = row?.querySelector('[role="listbox"]');
  return {
    triggerText: trigger?.textContent?.trim() || null,
    ariaExpanded: trigger?.getAttribute('aria-expanded') || null,
    popoverAttr: listbox?.getAttribute('popover') || null,
    popoverOpen: !!listbox?.matches?.(':popover-open'),
    dataOpen: listbox?.getAttribute('data-open') || null,
    status: row?.querySelector('.status')?.textContent?.trim() || null,
  };
}
```

This is also a quick way to confirm that the served bundle includes the latest widget code.

## Common Pitfalls

- `localhost:3005` may still be referenced by Playwright config, but that is not the same as the fresh `rip-server` host-based local app on ``.
- A restarted server can still be missed if the browser is pointed at the public site `https://ui.ripdev.io/` instead of the local site `https://ui.ripdev.io`.
- If Chrome MCP reports cert errors on `ui.local`, switch to `ui.ripdev.io`.
- If Chrome MCP gets wedged, restart the MCP server and reconnect before debugging interaction bugs.

## Current Known-Good Signal

When the fresh local app is loaded correctly, a real Chrome click on the first `Select` trigger should show:

- `aria-expanded: "true"`
- `popover="manual"`
- `:popover-open === true`
- focus moved into the listbox options

If those are not true, the browser is likely not on the fresh local app instance.

## The Ask

You’re asking me to do a full **behavioral audit and repair pass** on the new unified UI gallery at [https://ui.ripdev.io](https://ui.ripdev.io), using either browser automation through the Chrome MCP or Playwright.

More specifically, you want me to:

- open the live gallery page served from `packages/ui`
- inspect **every component demo** shown on that page
- compare each component’s actual behavior against the expected behavior of high-quality headless UI systems like:
  - Radix UI
  - shadcn/ui
  - Base UI
  - WAI-ARIA patterns
- decide what the **Principle of Least Surprise** says the component should do when those references differ
- fix the components so they behave correctly and consistently

You also want me to treat these files as the implementation surface:

- `packages/ui/index.html`
- `packages/ui/index.css`
- `packages/ui/index.rip`
- `packages/ui/browser/components/*`

And the output you want from me is not just code changes, but also:

- a component-by-component review of what I found
- what was broken, inconsistent, or surprising
- what I changed
- where behaviors differ from Radix / shadcn / Base UI / ARIA
- why I chose the behavior I chose when there was ambiguity

So in short:

**You want a full live QA + standards comparison + implementation correction pass across the entire Rip UI component gallery, with browser-driven verification and explicit reasoning about behavior choices.**

That is a substantial but very clear task.
