# TLS Capability Spikes (M0a)

This folder contains fast, focused Bun TLS capability probes for the edge plan.

## Scripts

- `sni-capability.mjs` — checks whether dynamic cert selection by SNI can be achieved.
- `alpn-capability.mjs` — checks ALPN negotiation and probes ALPN callback/cert-selection support.
- `hot-reload-capability.mjs` — checks whether cert material hot-reloads without restart and validates restart fallback.

## Run

```bash
bun "packages/server/spikes/tls/sni-capability.mjs"
bun "packages/server/spikes/tls/alpn-capability.mjs"
bun "packages/server/spikes/tls/hot-reload-capability.mjs"
```

## Notes

- Requires OpenSSL in PATH (`openssl` CLI).
- Scripts return exit code `0` on expected outcome for the spike objective.
- JSON output is intended to be pasted into the M0a findings memo.
