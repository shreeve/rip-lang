# Edgefile Contract (M0b)

This document freezes v1 config expectations for `Edgefile.rip`.

## Required top-level shape

```text
version: 1
edge: ...
app "...": ...
site "...": ...
```

## Determinism policy

- Config evaluation is synchronous.
- Async operations are disallowed.
- Network I/O is disallowed.
- Validation errors must include line, field path, and remediation hint.

## Route actions (v1)

- `toApp(appId)`
- `proxy(upstream)`
- `static(dir)` (optional; app-side static remains valid)
- `redirect(to, status)`
- `headers(set/remove)`

## Host/path precedence

1. exact host > wildcard host
2. more specific path > less specific path
3. lower explicit priority number first
4. declaration order tie-break

## Timeout inheritance

- Global (`edge`) defaults
- overridden by app/site policy
- overridden by route-level explicit timeout values

## Reload semantics

- Any trigger runs the atomic pipeline from `CONFIG_LIFECYCLE.md`.
- Invalid config never replaces active config.

## v1 TLS implications from M0a

Based on `packages/server/spikes/tls/FINDINGS.md`:
- v1 should not assume dynamic per-SNI cert switching
- v1 should not assume in-process cert hot reload
- v1 should use graceful restart for cert activation
- v1 ACME baseline should prioritize HTTP-01
