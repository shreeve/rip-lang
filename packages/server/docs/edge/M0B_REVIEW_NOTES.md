# M0b Review Notes

Status: Active

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

- Confirm `Edgefile.rip` syntax shape against current Rip parser
- Validate route precedence edge cases in conformance tests
- Confirm ops defaults for retention policy in deployment docs

## Evidence links

- TLS spikes and outputs:
  - `packages/server/spikes/tls/README.md`
  - `packages/server/spikes/tls/FINDINGS.md`
- Plan of record:
  - `.cursor/plans/rip_unified_master_plan_v2_2892e891.plan.md`
