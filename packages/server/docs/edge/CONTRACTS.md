# Edge Contracts (M0b)

This document freezes the core data contracts for the unified edge/app runtime in `@rip-lang/server`.

Status: Draft frozen for M0b review.

## Source of truth inputs

- Plan: `.cursor/plans/rip_unified_master_plan_v2_2892e891.plan.md`
- TLS findings: `packages/server/spikes/tls/FINDINGS.md`

## AppDescriptor

```ts
type AppDescriptor = {
  id: string
  entry: string
  hosts: string[]
  prefixes: string[]
  workers: number
  maxQueue: number
  maxInflight: number
  env: Record<string, string>
  restartPolicy: {
    maxRestarts: number
    backoffMs: number
    windowMs: number
  }
  healthCheck: {
    path: string
    intervalMs: number
    timeoutMs: number
    unhealthyThreshold: number
  }
}
```

Defaults:
- `workers`: `cpus().length`, min `2`
- `maxQueue`: `1000`
- `maxInflight`: `workers * 32`
- `env`: `{}`
- `restartPolicy`: `{ maxRestarts: 10, backoffMs: 1000, windowMs: 60000 }`
- `healthCheck`: `{ path: "/ready", intervalMs: 5000, timeoutMs: 2000, unhealthyThreshold: 3 }`

## WorkerEndpoint

```ts
type WorkerEndpoint = {
  appId: string
  workerId: number
  socketPath: string
  inflight: number
  version: number
  state: "starting" | "ready" | "draining" | "stopped"
  startedAt: number
  requestCount: number
}
```

Defaults:
- `inflight`: `0`
- `state`: `"starting"`
- `requestCount`: `0`

## RouteAction

```ts
type RouteAction =
  | { kind: "toApp"; appId: string }
  | { kind: "proxy"; upstream: string; host?: string }
  | { kind: "static"; dir: string; spaFallback?: string }
  | { kind: "redirect"; to: string; status: number }
  | { kind: "headers"; set?: Record<string, string>; remove?: string[] }
```

## RouteRule

```ts
type RouteRule = {
  id: string
  host: string | "*"
  pathPattern: string
  methods: string[] | "*"
  action: RouteAction
  priority: number
  timeouts?: Partial<TimeoutPolicy>
}
```

Defaults:
- `host`: `"*"`
- `methods`: `"*"`
- `priority`: declaration order
- `timeouts`: inherit site/app/global defaults

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
- `algorithm`: `"least-inflight"`
- `fallback`: `"queue"` while queue `< maxQueue`, else `"shed-503"`
- `queuePosition`: `null` when immediately assigned

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

Defaults:
- `source`: `"acme"` for auto-managed certificates
- `lastRenewAttempt`: `null`
- `lastRenewResult`: `null`

## Constraint from M0a

From `packages/server/spikes/tls/FINDINGS.md`:
- dynamic SNI selection and ALPN-driven cert selection were not observed
- in-process cert hot reload was not observed
- graceful restart reload works

Therefore v1 contract assumptions:
- TLS config is loaded at process start
- cert activation uses graceful restart path in v1
- ACME HTTP-01 is the reliable v1 baseline
