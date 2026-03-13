# M0a TLS Spike Findings

Date: 2026-03-13  
Branch: `edge`

## Summary

- SNI dynamic cert selection: **not observed**
- ALPN negotiation (`acme-tls/1`): **not observed in tested Bun TLS API path**
- ALPN-driven cert selection: **not observed**
- In-process cert hot reload: **not observed**
- Restart-based cert reload fallback: **works**

## Raw Results

### `sni-capability.mjs`

```json
{
  "spike": "sni-capability",
  "baselineWorks": true,
  "strategies": [
    {
      "name": "node-style-SNICallback",
      "serverStarted": true,
      "cnOne": "one.test",
      "cnTwo": "one.test",
      "error": null
    },
    {
      "name": "serverName-function",
      "serverStarted": false,
      "cnOne": null,
      "cnTwo": null,
      "error": "TLSOptions.serverName must be a string"
    }
  ],
  "dynamicSniSupported": false,
  "winner": null
}
```

### `alpn-capability.mjs`

```json
{
  "spike": "alpn-capability",
  "serverStartedWithAlpnProtocols": true,
  "negotiatedProtocol": null,
  "alpnCallbackAccepted": true,
  "alpnCallbackInvoked": false,
  "alpnDrivenCertSelection": false,
  "notes": [
    "ALPN did not negotiate expected protocol. got=none",
    "No evidence of ALPN-driven certificate selection in tested Bun.serve API surface."
  ]
}
```

### `hot-reload-capability.mjs`

```json
{
  "spike": "hot-reload-capability",
  "cnBeforeChange": "old.test",
  "cnAfterFileChangeWithoutRestart": "old.test",
  "cnAfterRestart": "new.test",
  "hotReloadWithoutRestartWorks": false,
  "gracefulRestartWorks": true
}
```

## Decision

- Selected v1 TLS strategy: **single TLS context at process start** with restart-based cert reload.
- Fallback strategy: **graceful edge restart** after cert renewal (drain then restart).
- Impact on ACME scope: **ship HTTP-01 first** for v1 reliability; treat TLS-ALPN-01 as beta/deferred until Bun API support is proven with additional investigation.

## Follow-up Work

- Validate ALPN behavior with an OpenSSL-based probe to rule out client probing artifact.
- Revisit dynamic SNI cert selection when Bun exposes/clarifies SNI callback support.
- Keep v1 plan conservative: no assumptions about in-process cert hot reload.
