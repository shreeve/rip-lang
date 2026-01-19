/**
 * Rip Worker: single-inflight Unix socket worker (per-worker socket).
 *
 * Features:
 * - Single-inflight request isolation
 * - Rate-limited mtime-based hot module reloading (100ms intervals) with handler caching
 * - Graceful cycling after maxReloads to prevent memory bloat
 * - Automatic exit after maxRequests for clean lifecycle management
 * - High-performance: no blocking filesystem calls on request hot path
 */

import { getControlSocketPath } from './utils'

const workerId = Number.parseInt(process.argv[2] ?? '0')
const maxRequests = Number.parseInt(process.argv[3] ?? '10000')
const maxReloads = Number.parseInt(process.argv[4] ?? '10')
const maxSeconds = Number.parseInt(process.argv[5] ?? '0')
const appEntry = process.argv[6]

const socketPath = process.env.SOCKET_PATH as string  // Per-worker Unix socket path
const hotReloadMode = (process.env.RIP_RELOAD as 'none' | 'process' | 'module') || 'none'
const socketPrefix = process.env.SOCKET_PREFIX as string
const version = Number.parseInt(process.env.RIP_VERSION || '1')

let appReady = false
let inflight = false
let handled = 0
const startedAtMs = Date.now()
let reloader: any = null
let lastMtime = 0
let cachedHandler: any = null
let hotReloadCount = 0
let lastCheckTime = 0
const CHECK_INTERVAL_MS = 100  // Only check for changes every 100ms

async function checkForChanges(): Promise<boolean> {
  if (hotReloadMode !== 'module') return false

  // Rate limit: only check filesystem every 100ms to avoid performance impact
  const now = Date.now()
  if (now - lastCheckTime < CHECK_INTERVAL_MS) {
    return false
  }
  lastCheckTime = now

  try {
    const fs = require('fs')
    const stats = fs.statSync(appEntry)
    const currentMtime = stats.mtime.getTime()
    if (lastMtime === 0) {
      lastMtime = currentMtime
      return false
    }
    if (currentMtime > lastMtime) {
      lastMtime = currentMtime
      return true
    }
    return false
  } catch {
    return false
  }
}

async function getHandler(): Promise<(req: Request) => Promise<Response> | Response> {
  // Simple mtime-based reload for module mode
  const hasChanged = await checkForChanges()
  if (hasChanged) {
    hotReloadCount++
    console.log(`[worker ${workerId}] File changed, reloading... (${hotReloadCount}/${maxReloads})`)
    // Keep serving with the last known-good handler while we rebuild
    reloader = null

    // Graceful exit after maxReloads to prevent module cache bloat
    if (hotReloadCount >= maxReloads) {
      console.log(`[worker ${workerId}] Reached maxReloads (${maxReloads}), graceful exit`)
      setTimeout(() => process.exit(0), 100) // Let current request finish
      return async () => new Response('Worker cycling', { status: 503 })
    }
  }

  // Return cached handler if available and no changes
  if (cachedHandler && !hasChanged) {
    return cachedHandler
  }

  if (!reloader) {
    // @ts-ignore dynamic import of package without types
    const api = await import('@rip-lang/api').catch(() => null)
    if (!api?.createReloader) {
      // Direct import with cache busting for module reload
      const bustQuery = hotReloadMode === 'module' ? `?bust=${Date.now()}` : ''
      const mod = await import(appEntry + bustQuery)
      const fresh = (mod as any).default || (mod as any)
      const h = typeof fresh === 'function' ? fresh : (fresh && typeof fresh.fetch === 'function' ? fresh.fetch.bind(fresh) : null)
      cachedHandler = h || (async () => new Response('Invalid app', { status: 500 }))
      return cachedHandler
    }
    reloader = api.createReloader({ entryPath: appEntry })
  }
  try {
    const h = await reloader.getHandler()
    if (typeof h !== 'function') {
      if (process.env.RIP_DEBUG) console.error(`[worker ${workerId}] reloader.getHandler() returned`, typeof h)
    }
    cachedHandler = h || cachedHandler
    return cachedHandler || h
  } catch (e) {
    if (process.env.RIP_DEBUG) console.error(`[worker ${workerId}] reloader.getHandler() threw:`, e)

    // Fallback: direct import of app entry
    try {
      const bustQuery = hotReloadMode === 'module' ? `?bust=${Date.now()}` : ''
      const mod = await import(appEntry + bustQuery)
      const fresh = (mod as any).default || (mod as any)
      const h = typeof fresh === 'function' ? fresh : (fresh && typeof fresh.fetch === 'function' ? fresh.fetch.bind(fresh) : null)
      cachedHandler = h || cachedHandler
      return cachedHandler || (async () => new Response('not ready', { status: 503 }))
    } catch (e2) {
      if (process.env.RIP_DEBUG) console.error(`[worker ${workerId}] fallback import failed:`, e2)
      return cachedHandler || (async () => new Response('not ready', { status: 503 }))
    }
  }
}

async function selfJoin(): Promise<void> {
  try {
    const payload = { op: 'join', workerId, pid: process.pid, socket: socketPath, version }
    const body = JSON.stringify(payload)
    const ctl = getControlSocketPath(socketPrefix)
    await fetch('http://localhost/worker', { method: 'POST', body, headers: { 'content-type': 'application/json' }, unix: ctl })
  } catch {}
}

async function selfQuit(): Promise<void> {
  try {
    const payload = { op: 'quit', workerId }
    const body = JSON.stringify(payload)
    const ctl = getControlSocketPath(socketPrefix)
    await fetch('http://localhost/worker', { method: 'POST', body, headers: { 'content-type': 'application/json' }, unix: ctl })
  } catch {}
}

async function start(): Promise<void> {
  // Preload handler once to ensure first requests are handled cleanly
  try {
    const initial = await getHandler()
    appReady = typeof initial === 'function'
  } catch {}

  const server = Bun.serve({
    unix: socketPath,
    maxRequestBodySize: 100 * 1024 * 1024,
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url)
      if (url.pathname === '/ready') return new Response(appReady ? 'ok' : 'not-ready')
      if (inflight) return new Response('busy', { status: 503, headers: { 'Rip-Worker-Busy': '1', 'Retry-After': '0', 'Rip-Worker-Id': String(workerId) } })
      const handlerFn = await getHandler()
      appReady = typeof handlerFn === 'function'
      inflight = true
      try {
        if (typeof handlerFn !== 'function') return new Response('not ready', { status: 503 })
        let res: any = await handlerFn(req)
        // Some loaders may return a callable handler on first call; invoke once more if so
        if (typeof res === 'function') res = await res(req)
        return res instanceof Response ? res : new Response(String(res))
      } catch {
        return new Response('error', { status: 500 })
      } finally {
        inflight = false
        handled++
        const exceededReqs = handled >= maxRequests
        const exceededTime = maxSeconds > 0 && (Date.now() - startedAtMs) / 1000 >= maxSeconds
        if (exceededReqs || exceededTime) setTimeout(() => process.exit(0), 10)
      }
    },
  })

  await selfJoin()

  const shutdown = async () => {
    while (inflight) await new Promise(r => setTimeout(r, 10))
    try { server.stop() } catch {}
    await selfQuit()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

start().catch(err => {
  console.error('worker start failed', err)
  process.exit(1)
})
