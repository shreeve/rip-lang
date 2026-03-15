# Edge Config Lifecycle

This document describes the implemented v1 lifecycle for `Edgefile.rip` changes.

## Goal

Config updates must be:

- atomic
- reversible
- observable
- safe for in-flight HTTP and websocket proxy traffic

## Apply pipeline

1. **Parse**
   - Load `Edgefile.rip`.
   - Evaluate it synchronously in config context.
   - Reject on syntax or runtime errors.

2. **Validate**
   - Require `version: 1`.
   - Validate only supported top-level keys:
     - `version`
     - `edge`
     - `upstreams`
     - `apps`
     - `routes`
     - `sites`
   - Validate route references, wildcard hosts, websocket route requirements,
     timeout shapes, and verification policy.

3. **Normalize**
   - Expand defaults from `CONTRACTS.md`.
   - Normalize upstreams, managed apps, route rules, site groups, timeouts, and
     verification policy.
   - Compile the deterministic route table.

4. **Stage**
   - Build a new edge runtime generation:
     - upstream pool
     - route table
     - config metadata
     - verification policy
   - Prepare managed app registry changes for the new config.
   - Do not affect active traffic yet.

5. **Activate**
   - Swap the active edge runtime pointer atomically.
   - Begin routing new requests through the new generation immediately.
   - Keep the previous generation as a retired runtime for rollback or drain.

6. **Post-activate verify**
   - Run route-aware verification according to `edge.verify`.
   - Check referenced upstreams, healthy target counts, and managed app worker readiness.
   - Emit structured activation events.

7. **Rollback (if needed)**
   - Restore the previous app registry snapshot.
   - Restore the previous active edge runtime.
   - Mark the failed generation retired and let it drain if needed.
   - Record structured rollback metadata including reason code and details.

## Trigger modes

- file watch (`Edgefile.rip`)
- `SIGHUP`
- control API: `POST /reload` on the control Unix socket

All triggers use the same runtime reload path and the same safeguards.

## Determinism rules

- No async work while evaluating config.
- No network I/O while evaluating config.
- Validation must be repeatable for identical input.

## Failure behavior

- Parse/validate failure: keep serving with the existing config.
- Stage failure: keep serving with the existing config.
- Post-activate verification failure: rollback to the previous runtime automatically.

## Draining behavior

- Retired runtimes remain alive while:
  - HTTP requests that started on them are still in flight
  - websocket proxy connections that started on them are still open
- Health checks are stopped only after a retired runtime finishes draining.

## Observability

Every reload attempt records:

- attempt ID
- source trigger (`startup`, `sighup`, `control_api`)
- old version
- new version
- result (`loaded`, `applied`, `rejected`, `rolled_back`)
- reason
- reason code
- reason details
- timestamp

`/diagnostics` exposes:

- active config metadata
- active runtime inflight and websocket counts
- retired runtimes still draining
- last reload attempt
- bounded reload history
