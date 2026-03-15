# Edge Contracts

This document describes the implemented core contracts for the unified
edge/app runtime in `@rip-lang/server`.

## Source of truth inputs

- Runtime implementation: `packages/server/server.rip`
- Edge config normalization: `packages/server/edge/config.rip`
- Edge runtime lifecycle: `packages/server/edge/runtime.rip`
- Verification policy: `packages/server/edge/verify.rip`
- TLS findings: `packages/server/spikes/tls/FINDINGS.md`

## AppDescriptor

```ts
type AppDescriptor = {
  id: string
  entry: string | null
  appBaseDir: string | null
  hosts: string[]
  workers: number | null
  maxQueue: number
  queueTimeoutMs: number
  readTimeoutMs: number
  env: Record<string, string>
}
```

## WorkerEndpoint

```ts
type WorkerEndpoint = {
  appId: string
  workerId: number
  socketPath: string
  inflight: number
  version: number | null
  startedAt: number
}
```

## RouteRule

```ts
type RouteRule = {
  id: string
  host: string | "*" | "*.example.com"
  path: string
  methods: string[] | "*"
  priority: number
  upstream?: string | null
  app?: string | null
  static?: string | null
  redirect?: { to: string, status: number } | null
  headers?: { set?: Record<string, string>, remove?: string[] } | null
  websocket?: boolean
  timeouts?: Partial<TimeoutPolicy>
}
```

## VerifyPolicy

```ts
type VerifyPolicy = {
  requireHealthyUpstreams: boolean
  requireReadyApps: boolean
  includeUnroutedManagedApps: boolean
  minHealthyTargetsPerUpstream: number
}
```

Defaults:

- `requireHealthyUpstreams: true`
- `requireReadyApps: true`
- `includeUnroutedManagedApps: true`
- `minHealthyTargetsPerUpstream: 1`

## EdgeRuntime

```ts
type EdgeRuntime = {
  id: string
  upstreamPool: UpstreamPool
  routeTable: RouteTable
  configInfo: ConfigInfo
  verifyPolicy: VerifyPolicy | null
  inflight: number
  wsConnections: number
  retiredAt: string | null
}
```

## SchedulerDecision

```ts
type SchedulerDecision = {
  appId: string
  selectedWorker: WorkerEndpoint
  algorithm: "least-inflight"
  fallback: "queue" | "shed-503"
  queuePosition: number | null
}
```

Defaults:

- `algorithm: "least-inflight"`
- `fallback: "queue"` while queue `< maxQueue`, else `"shed-503"`
- `queuePosition: null` when immediately assigned

## TlsCertRecord

```ts
type TlsCertRecord = {
  id: string
  domains: string[]
  notBefore: number
  notAfter: number
  fingerprint: string
  certPath: string
  keyPath: string
  source: "acme" | "manual" | "shipped"
  lastRenewAttempt: number | null
  lastRenewResult: "success" | "failed" | null
}
```

## TLS constraints

From `packages/server/spikes/tls/FINDINGS.md`:

- dynamic SNI selection was not observed
- in-process cert hot reload was not observed
- graceful restart cert activation works
- ACME HTTP-01 is the reliable v1 baseline
