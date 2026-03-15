# M0b Review Notes

Status: Maintained

## Accepted decisions

- Single project architecture with two runtime roles:
  - EdgeControlPlane
  - AppDataPlane
- Direct request path remains `client -> ingress -> worker` (no relay hop).
- v1 scheduler: least-inflight with deterministic tie-break.
- Config apply lifecycle is atomic (`parse -> validate -> normalize -> stage -> activate/rollback`).
- Deterministic config evaluation (no async/network I/O).
- v1 TLS posture reflects M0a findings:
  - HTTP-01 prioritized for reliable v1 ACME
  - TLS-ALPN-01 treated as beta/deferred
  - graceful restart cert activation path

## Deferred / future decisions

- Dynamic SNI cert selection when Bun API supports it reliably
- In-process cert hot reload without restart
- DNS-01 provider integrations
- HTTP/2 and gRPC production posture

## Open items for next review pass

- Expand end-to-end websocket proxy coverage beyond the current package tests
- Decide whether staged rollout policy should gain additional operator tuning beyond `edge.verify`
- Confirm retention policy expectations for reload history and retired runtime visibility in deployment docs

## Refactor Guardrails

Group by theme, not by function. A file should cover a coherent area — not
necessarily one function or one class. Pragmatism over purity.

- Group related functions into one file by theme (e.g. all CLI logic in `cli.rip`).
- No generic `utils.rip` dumping ground — but themed helpers files are fine.
- If a module is under ~20 lines with only one importer, fold it into its neighbor.
- If a module grows past ~300 lines, consider splitting by sub-theme.
- Keep import fan-out low; if a module imports too many siblings, the boundary is wrong.
- `server.rip` should stay as orchestration/wiring, not business logic.
- Every extraction or consolidation must pass tests.
- Prefer vertical domains:
  - `edge/*` for request-path behavior (forwarding, scheduling, status, registry)
  - `control/*` for management (CLI, lifecycle, workers, watchers, mDNS)
  - `acme/*` only when ACME implementation begins

## Coding Conventions

### Bare `try` over `try ... catch then null`

In Rip, a bare `try` compiles to `try {} catch {}` in JavaScript — functionally
identical to `try ... catch then null`, which compiles to `try {} catch { null; }`.
The extra `null;` is a no-op statement with no behavioral difference.

**Preferred style:** use bare `try` for fire-and-forget error suppression.

```coffee
# Good — clean, concise
try unlinkSync(path)
try server.stop()

# Good — multiline bare try
try
  proc.kill()
  console.log "stopped #{host}"

# Avoid — unnecessary catch block
try unlinkSync(path) catch then null

# Avoid — verbose no-op catch
try
  proc.kill()
catch
  null
```

**When to use an explicit catch:**
- When the catch body does actual work (logging, fallback value, cleanup)
- When catching a specific error variable: `catch e`
- When fall-through after try needs a specific return value that differs from `undefined`

```coffee
# Good — catch does real work
try
  pkg = JSON.parse(readFileSync(path, 'utf8'))
catch
  console.log 'version unknown'

# Good — catch with error variable
catch e
  console.error "failed: #{e.message}"
```

## Evidence links

- TLS spikes and outputs:
  - `packages/server/spikes/tls/README.md`
  - `packages/server/spikes/tls/FINDINGS.md`
- Plan of record:
  - `packages/server/docs/edge/PURE_BUN_EDGE_PLAN.md`
