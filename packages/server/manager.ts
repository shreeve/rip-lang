/**
 * Rip Manager: spawns and supervises worker processes (per-worker sockets).
 *
 * Features:
 * - Per-worker sockets with Server dispatch
 * - Exponential backoff restart logic with attempt limits
 * - Rolling restart support for graceful deployments
 * - Passes maxReloads parameter to workers for memory management
 * - Clean socket management and process supervision
 */

import { join } from 'path'
import { getWorkerSocketPath, nowMs, ParsedFlags } from './utils'

interface TrackedWorker {
  id: number
  process: Bun.Subprocess
  socketPath: string
  restartCount: number
  backoffMs: number
  startedAt: number
}

export class Manager {
  private flags: ParsedFlags
  private workers: TrackedWorker[] = []
  private shuttingDown = false
  private lastCheck = 0
  private currentMtime = 0
  private isRolling = false
  private lastRollAt = 0
  // Monotonic id for all workers; incremented on every spawn
  private nextWorkerId = -1
  // Worker ids being intentionally retired (avoid monitor() respawn race)
  private retiringIds: Set<number> = new Set()
  // Version epoch for zero-overlap routing; incremented on rolling restart
  private currentVersion = 1

  constructor(flags: ParsedFlags) {
    this.flags = flags
    process.on('SIGTERM', () => this.shutdown())
    process.on('SIGINT', () => this.shutdown())
  }

  async start(): Promise<void> {
    await this.stop()
    this.workers = []
    for (let i = 0; i < this.flags.workers; i++) {
      const w = await this.spawnWorker(this.currentVersion)
      this.workers.push(w)
    }
    if (this.flags.reload === 'process') {
      // lightweight mtime poller for entry file
      this.currentMtime = this.getEntryMtime()
      const interval = setInterval(() => {
        if (this.shuttingDown) { clearInterval(interval); return }
        const now = Date.now()
        if (now - this.lastCheck < 100) return
        this.lastCheck = now
        const mt = this.getEntryMtime()
        if (mt > this.currentMtime) {
          // Prevent overlapping rollings; simple cooldown to avoid thrash
          if (this.isRolling || (now - this.lastRollAt) < 200) return
          this.currentMtime = mt
          this.isRolling = true
          this.lastRollAt = now
          void this.rollingRestart().finally(() => { this.isRolling = false })
        }
      }, 50)
    }
  }

  async stop(): Promise<void> {
    for (const w of this.workers) {
      try { w.process.kill() } catch {}
      try { await w.process.exited } catch {}
      try { await Bun.spawn(['rm', '-f', w.socketPath]).exited } catch {}
    }
    this.workers = []
  }

  private async spawnWorker(version?: number): Promise<TrackedWorker> {
    const workerId = ++this.nextWorkerId
    const socketPath = getWorkerSocketPath(this.flags.socketPrefix, workerId)
    try { await Bun.spawn(['rm', '-f', socketPath]).exited } catch {}

    const proc = Bun.spawn([
      'bun',
      '--preload',
      './packages/bun/rip-bun.ts',
      join(__dirname, 'worker.ts'),
      workerId.toString(),
      this.flags.maxRequestsPerWorker.toString(),
      this.flags.maxReloadsPerWorker.toString(),
      this.flags.maxSecondsPerWorker.toString(),
      this.flags.appEntry,
    ], {
      stdout: 'inherit',
      stderr: 'inherit',
      stdin: 'ignore',
      cwd: process.cwd(),
      env: {
        ...process.env,
        WORKER_ID: String(workerId),
        SOCKET_PATH: socketPath,
        SOCKET_PREFIX: this.flags.socketPrefix,
        RIP_LOG_JSON: this.flags.jsonLogging ? '1' : '0',
        RIP_RELOAD: this.flags.reload,
        RIP_VERSION: String(version ?? this.currentVersion),
      },
    })

    const tracked: TrackedWorker = { id: workerId, process: proc, socketPath, restartCount: 0, backoffMs: 1000, startedAt: nowMs() }
    void this.monitor(tracked)
    return tracked
  }

  private async monitor(w: TrackedWorker): Promise<void> {
    await w.process.exited
    if (this.shuttingDown) return
    if (this.retiringIds.has(w.id)) return
    w.restartCount++
    w.backoffMs = Math.min(w.backoffMs * 2, 30000)
    if (w.restartCount > 10) return
    await new Promise(r => setTimeout(r, w.backoffMs))
    const idx = this.workers.findIndex(x => x.id === w.id)
    if (idx >= 0) this.workers[idx] = await this.spawnWorker()
  }

  // Wait for a worker's unix socket to respond ready
  private async waitWorkerReady(socketPath: string, timeoutMs = 5000): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch('http://localhost/ready', { unix: socketPath, method: 'GET' })
        if (res.ok) {
          const txt = await res.text()
          if (txt === 'ok') return true
        }
      } catch {}
      await new Promise(r => setTimeout(r, 30))
    }
    return false
  }

  async rollingRestart(): Promise<void> {
    // Spawn all replacements first, then await readiness in parallel, then retire olds
    const olds = [...this.workers]
    const pairs: { old: TrackedWorker; replacement: TrackedWorker }[] = []

    // Bump version epoch for this rollout
    this.currentVersion++

    for (const oldWorker of olds) {
      const replacement = await this.spawnWorker(this.currentVersion)
      // Track replacement in our list immediately
      this.workers.push(replacement)
      pairs.push({ old: oldWorker, replacement })
    }

    // Wait for readiness in parallel (best-effort)
    await Promise.all(pairs.map(p => this.waitWorkerReady(p.replacement.socketPath, 3000)))

    // Now retire the old workers: mark retiring and send SIGTERM (single pass), wait exits in parallel, then prune
    for (const { old } of pairs) {
      this.retiringIds.add(old.id)
      try { old.process.kill() } catch {}
    }
    await Promise.all(pairs.map(({ old }) => old.process.exited.catch(() => {})))
    const retiring = new Set(pairs.map(p => p.old.id))
    this.workers = this.workers.filter(w => !retiring.has(w.id))
    for (const id of retiring) this.retiringIds.delete(id)
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return
    this.shuttingDown = true
    await this.stop()
    process.exit(0)
  }

  private getEntryMtime(): number {
    try { return require('fs').statSync(this.flags.appEntry).mtimeMs } catch { return 0 }
  }
}
