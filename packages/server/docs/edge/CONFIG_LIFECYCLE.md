# Edge Config Lifecycle (M0b)

This document freezes config apply behavior for v1.

## Goal

Config updates must be atomic, reversible, and observable.

## Apply pipeline

1. **Parse**
   - Load `Edgefile.rip`.
   - Compile/evaluate in restricted config context.
   - Reject if syntax/runtime errors occur.

2. **Validate**
   - Validate schema version (`version: 1` required).
   - Validate required keys (`edge`, `app`, `site` domains).
   - Validate host/path conflicts and ambiguous route precedence.
   - Validate policy constraints (timeouts, queue caps, worker counts).

3. **Normalize**
   - Expand defaults from `CONTRACTS.md`.
   - Compile route rules into deterministic route table.
   - Resolve app entry paths and socket namespaces.

4. **Stage**
   - Build a staged config object with new version ID.
   - Dry-run app pool preparation (spawn readiness checks if needed).
   - Do not affect active traffic yet.

5. **Activate**
   - Swap active route/config pointer atomically.
   - Begin routing new traffic using new route table.
   - Keep previous config pointer for rollback.

6. **Post-activate verify**
   - Ensure app pools healthy under new config.
   - Emit structured "config-activated" event.

7. **Rollback (if needed)**
   - Revert active pointer to previous known-good config.
   - Emit structured "config-rollback" event with reason.

## Trigger modes

- file watch (`Edgefile.rip`)
- `SIGHUP`
- control API (`POST /control/reload`)

All triggers use the same pipeline and safeguards.

## Determinism rules

- No async and no network I/O while evaluating config.
- Any disallowed operation fails validation.
- Config evaluation must be repeatable with same input.

## Failure behavior

- Parse/validate failure: keep serving with existing config.
- Stage failure: keep serving with existing config.
- Post-activate health failure: rollback to previous config.

## Observability

Every config attempt emits:
- attempt ID
- source trigger (watch/signal/api)
- old version
- new version (if any)
- result: applied / rejected / rolled_back
- reason code
