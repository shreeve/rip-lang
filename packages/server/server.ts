/**
 * Rip Server: HTTP entry with per‑worker sockets and a control socket.
 */

import { INTERNAL_HEADERS, logAccessHuman, logAccessJson, nowMs, ParsedFlags, stripInternalHeaders, getControlSocketPath } from './utils'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { X509Certificate } from 'crypto'

type UpstreamState = { socket: string; inflight: number; version: number | null; workerId: number }

// Helper function to read dashboard HTML from disk
function getDashboardHTML(): string {
  try {
    // Read from the dashboard.html file in the same directory as this script
    return readFileSync(join(__dirname, 'dashboard.html'), 'utf8')
  } catch (error) {
    // Fallback minimal HTML if file doesn't exist
    console.warn('Dashboard HTML file not found, using fallback')
    return `<!DOCTYPE html>
<html><head><title>Rip Server Dashboard</title></head>
<body><h1>Rip Server Dashboard</h1><p>Dashboard file not found</p></body>
</html>`
  }
}

export class Server {
  private flags: ParsedFlags
  private server: any | null = null
  private httpsServer: any | null = null
  private control: any | null = null
  private sockets: UpstreamState[] = []
  private availableWorkers: UpstreamState[] = []
  private inflightTotal = 0
  private queue: { req: Request; resolve: (r: Response) => void; reject: (e: any) => void; enqueuedAt: number }[] = []
  private startedAt = nowMs()
  private newestVersion: number | null = null
  private httpsActive = false
  private hostRegistry: Set<string> = new Set()
  private mdnsProcesses: Map<string, any> = new Map() // host -> subprocess

  constructor(flags: ParsedFlags) {
    this.flags = flags
    // Seed localhost defaults for dev
    this.hostRegistry.add('localhost')
    this.hostRegistry.add('127.0.0.1')
    // Always add rip.local for dashboard access
    this.hostRegistry.add('rip.local')
    // Add all app aliases from @ syntax (or default app name)
    for (const alias of flags.appAliases) {
      // Auto-append .local if no dots
      const host = alias.includes('.') ? alias : `${alias}.local`
      this.hostRegistry.add(host)
    }
  }

  async start(): Promise<void> {
    // Listener selection
    const httpOnly = this.flags.httpsPort === null

    const startOnPort = (p: number, fetchFn: (req: Request) => Promise<Response>) => {
      let port = p
      while (true) {
        try {
          const s = Bun.serve({ port, idleTimeout: 8, fetch: fetchFn })
          return s
        } catch (e: any) {
          if (e && e.code === 'EADDRINUSE') { port++; continue }
          throw e
        }
      }
    }

    if (httpOnly) {
      if (this.flags.httpPort === 0) {
        // Try privileged/default HTTP port 80 first, then probe from 5700+
        try {
          this.server = Bun.serve({ port: 80, idleTimeout: 8, fetch: this.fetch.bind(this) })
        } catch (e: any) {
          if (e && (e.code === 'EADDRINUSE' || e.code === 'EACCES')) {
            this.server = startOnPort(5700, this.fetch.bind(this))
          } else {
            throw e
          }
        }
      } else {
        this.server = startOnPort(this.flags.httpPort!, this.fetch.bind(this))
      }
      this.flags.httpPort = this.server.port
    } else {
      const tls = await this.loadTlsMaterial()
      const startOnTlsPort = (p: number) => {
        let port = p
        while (true) {
          try {
            const s = Bun.serve({ port, idleTimeout: 8, tls, fetch: this.fetch.bind(this) })
            return s
          } catch (e: any) {
            if (e && e.code === 'EADDRINUSE') { port++; continue }
            throw e
          }
        }
      }
      // Default: try 443 first, then probe from 5700+
      if (!this.flags.httpsPort || this.flags.httpsPort === 0) {
        try {
          this.httpsServer = Bun.serve({ port: 443, idleTimeout: 8, tls, fetch: this.fetch.bind(this) })
        } catch (e: any) {
          if (e && (e.code === 'EADDRINUSE' || e.code === 'EACCES')) {
            this.httpsServer = startOnTlsPort(5700)
          } else {
            throw e
          }
        }
      } else {
        this.httpsServer = startOnTlsPort(this.flags.httpsPort)
      }
      const httpsPort = this.httpsServer.port
      this.flags.httpsPort = httpsPort
      this.httpsActive = true
      if (this.flags.redirectHttp) {
        try {
          this.server = Bun.serve({ port: 80, idleTimeout: 8, fetch: (req: Request) => {
            const url = new URL(req.url)
            const loc = `https://${url.hostname}:${httpsPort}${url.pathname}${url.search}`
            return new Response(null, { status: 301, headers: { Location: loc } })
          } })
        } catch {
          console.warn('Warn: could not bind port 80 for HTTP→HTTPS redirect')
        }
      }
      this.flags.httpPort = this.server ? this.server.port : 0
    }
    await this.startControl()
  }

  stop(): void {
    try { this.server?.stop() } catch {}
    try { this.httpsServer?.stop() } catch {}
    try { this.control?.stop() } catch {}

    // Clean up all mDNS advertisements
    for (const [host, proc] of this.mdnsProcesses) {
      try {
        proc.kill()
        console.log(`rip-server: stopped advertising ${host} via mDNS`)
      } catch {}
    }
    this.mdnsProcesses.clear()
  }

  private async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)

    // Dashboard for rip.local or root path
    const host = url.hostname.toLowerCase()
    if (host === 'rip.local' && (url.pathname === '/' || url.pathname === '')) {
      const headers = new Headers({
        'content-type': 'text/html; charset=utf-8',
      })
      this.maybeAddSecurityHeaders(headers)
      return new Response(getDashboardHTML(), { headers })
    }

    if (url.pathname === '/status') return this.status()
    if (url.pathname === '/server') {
      const headers = new Headers({ 'content-type': 'text/plain' })
      this.maybeAddSecurityHeaders(headers)
      return new Response('ok', { headers })
    }

    // Host-based routing guard (v1: single-app with allowlist)
    if (this.hostRegistry.size > 0 && !this.hostRegistry.has(host)) {
      return new Response('Host not found', { status: 404 })
    }

    // Fast path: try to get available worker directly
    if (this.inflightTotal < Math.max(1, this.sockets.length)) {
      const sock = this.getNextAvailableSocket()
      if (sock) {
        this.inflightTotal++
        try {
          return await this.forwardToWorker(req, sock)
        } finally {
          this.inflightTotal--
          setImmediate(() => this.drainQueue())
        }
      }
    }
    if (this.queue.length >= this.flags.maxQueue) return new Response('Server busy', { status: 503, headers: { 'Retry-After': '1' } })
    return await new Promise<Response>((resolve, reject) => this.queue.push({ req, resolve, reject, enqueuedAt: nowMs() }))
  }

  private status(): Response {
    const uptime = Math.floor((nowMs() - this.startedAt) / 1000)
    const healthy = this.sockets.length > 0
    const body = JSON.stringify({ status: healthy ? 'healthy' : 'degraded', app: this.flags.appName, workers: this.sockets.length, ports: { http: this.flags.httpPort ?? undefined, https: this.flags.httpsPort ?? undefined }, uptime, hosts: Array.from(this.hostRegistry.values()) })
    const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-cache' })
    this.maybeAddSecurityHeaders(headers)
    return new Response(body, { headers })
  }

  private getNextAvailableSocket(): UpstreamState | null {
    while (this.availableWorkers.length > 0) {
      const worker = this.availableWorkers.pop()!
      if (worker.inflight === 0 && this.isCurrentVersion(worker)) return worker
    }
    return null
  }

  private isCurrentVersion(worker: UpstreamState): boolean {
    return this.newestVersion === null || worker.version === null || worker.version >= this.newestVersion
  }

  private releaseWorker(worker: UpstreamState): void {
    worker.inflight = 0
    if (this.isCurrentVersion(worker)) this.availableWorkers.push(worker)
  }

  private async forwardToWorker(req: Request, socket: UpstreamState): Promise<Response> {
    const start = performance.now()
    let res: Response | null = null
    let workerSeconds = 0
    let released = false
    try {
      socket.inflight = 1
      const t0 = performance.now()
      res = await this.forwardOnce(req, socket.socket)
      workerSeconds = (performance.now() - t0) / 1000
      if (res.status === 503 && res.headers.get('Rip-Worker-Busy') === '1') {
        const retry = this.getNextAvailableSocket()
        if (retry && retry !== socket) {
          this.releaseWorker(socket)
          released = true
          retry.inflight = 1
          const t1 = performance.now()
          res = await this.forwardOnce(req, retry.socket)
          workerSeconds = (performance.now() - t1) / 1000
          const headers = stripInternalHeaders(res.headers)
          headers.delete('date')
          if (this.flags.jsonLogging) logAccessJson(this.flags.appName, req, res, (performance.now() - start) / 1000, workerSeconds)
          else if (this.flags.accessLog) logAccessHuman(this.flags.appName, req, res, (performance.now() - start) / 1000, workerSeconds)
          this.releaseWorker(retry)
          return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
        }
      }
    } catch {
      this.sockets = this.sockets.filter(x => x.socket !== socket.socket)
      this.availableWorkers = this.availableWorkers.filter(x => x.socket !== socket.socket)
      released = true
      return new Response('Service unavailable', { status: 503, headers: { 'Retry-After': '1' } })
    } finally {
      if (!released) this.releaseWorker(socket)
    }
    if (!res) return new Response('Service unavailable', { status: 503, headers: { 'Retry-After': '1' } })
    const headers = stripInternalHeaders(res.headers)
    headers.delete('date')
    this.maybeAddSecurityHeaders(headers)
    if (this.flags.jsonLogging) logAccessJson(this.flags.appName, req, res, (performance.now() - start) / 1000, workerSeconds)
    else if (this.flags.accessLog) logAccessHuman(this.flags.appName, req, res, (performance.now() - start) / 1000, workerSeconds)
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  }

  private async forwardOnce(req: Request, socketPath: string): Promise<Response> {
    const inUrl = new URL(req.url)
    const forwardUrl = `http://localhost${inUrl.pathname}${inUrl.search}`
    const { signal, cancel } = this.abortAfter(this.flags.connectTimeoutMs)
    try {
      const upstream = await fetch(forwardUrl, { method: req.method, headers: req.headers, body: req.body, unix: socketPath, signal })
      cancel()
      const readGuard = new Promise<Response>((_, rej) => setTimeout(() => rej(new Response('Upstream timeout', { status: 504 })), this.flags.readTimeoutMs))
      return (await Promise.race([Promise.resolve(upstream), readGuard])) as Response
    } finally {
      cancel()
    }
  }

  private abortAfter(ms: number): { signal: AbortSignal; cancel: () => void } {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ms)
    return { signal: controller.signal, cancel: () => clearTimeout(timer) }
  }

  private drainQueue(): void {
    while (this.inflightTotal < Math.max(1, this.sockets.length) && this.availableWorkers.length > 0) {
      const job = this.queue.shift()
      if (!job) break
      if (nowMs() - job.enqueuedAt > this.flags.queueTimeoutMs) {
        job.resolve(new Response('Queue timeout', { status: 504 }))
        continue
      }
      this.inflightTotal++
      const worker = this.getNextAvailableSocket()
      if (!worker) { this.inflightTotal--; break }
      this.forwardToWorker(job.req, worker)
        .then(r => job.resolve(r))
        .catch(e => job.resolve(e instanceof Response ? e : new Response('Internal error', { status: 500 })))
        .finally(() => {
          this.inflightTotal--
          setImmediate(() => this.drainQueue())
        })
    }
  }

  private async startControl(): Promise<void> {
    const ctlPath = getControlSocketPath(this.flags.socketPrefix)
    try { require('fs').unlinkSync(ctlPath) } catch {}
    this.control = Bun.serve({ unix: ctlPath, fetch: this.controlFetch.bind(this) })

    // Auto-advertise rip.local dashboard
    await this.startMdnsAdvertisement('rip.local')

    // Auto-advertise all aliases via mDNS
    for (const alias of this.flags.appAliases) {
      const host = alias.includes('.') ? alias : `${alias}.local`
      await this.startMdnsAdvertisement(host)
    }
  }

  private async controlFetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    if (req.method === 'POST' && url.pathname === '/worker') {
      try {
        const j = await req.json()
        if (j && j.op === 'join' && typeof j.socket === 'string' && typeof j.workerId === 'number') {
          const version = typeof j.version === 'number' ? j.version : null
          const exists = this.sockets.find(x => x.socket === j.socket)
          if (!exists) {
            const worker = { socket: j.socket, inflight: 0, version, workerId: j.workerId }
            this.sockets.push(worker)
            this.availableWorkers.push(worker)
          }
          if (version !== null) this.newestVersion = this.newestVersion === null ? version : Math.max(this.newestVersion, version)
          return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
        }
        if (j && j.op === 'quit' && typeof j.workerId === 'number') {
          this.sockets = this.sockets.filter(x => x.workerId !== j.workerId)
          this.availableWorkers = this.availableWorkers.filter(x => x.workerId !== j.workerId)
          return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
        }
      } catch {}
      return new Response(JSON.stringify({ ok: false }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    if (url.pathname === '/registry' && req.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, hosts: Array.from(this.hostRegistry.values()) }), { headers: { 'content-type': 'application/json' } })
    }
    return new Response('not-found', { status: 404 })
  }

  private maybeAddSecurityHeaders(headers: Headers): void {
    if (this.httpsActive && this.flags.hsts) {
      if (!headers.has('strict-transport-security')) headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains')
    }
  }

  private async loadTlsMaterial(): Promise<{ cert: string; key: string }> {
    // Explicit cert/key paths
    if (this.flags.certPath && this.flags.keyPath) {
      try {
        const cert = readFileSync(this.flags.certPath, 'utf8')
        const key = readFileSync(this.flags.keyPath, 'utf8')
        this.printCertSummary(cert)
        return { cert, key }
      } catch (e) {
        console.error('Failed to read TLS cert/key from provided paths. Use http or fix paths.')
        process.exit(2)
      }
    }

    // mkcert path under ~/.rip/certs
    if (this.flags.autoTls) {
      const dir = join(homedir(), '.rip', 'certs')
      try { mkdirSync(dir, { recursive: true }) } catch {}
      const certPath = join(dir, 'localhost.pem')
      const keyPath = join(dir, 'localhost-key.pem')
      if (!existsSync(certPath) || !existsSync(keyPath)) {
        try {
          const gen = Bun.spawn(['mkcert', '-install'])
          try { await gen.exited } catch {}
          const p = Bun.spawn(['mkcert', '-key-file', keyPath, '-cert-file', certPath, 'localhost', '127.0.0.1', '::1'])
          await p.exited
        } catch {
          // fall through to self-signed
        }
      }
      if (existsSync(certPath) && existsSync(keyPath)) {
        const cert = readFileSync(certPath, 'utf8')
        const key = readFileSync(keyPath, 'utf8')
        this.printCertSummary(cert)
        return { cert, key }
      }
    }

    // Self-signed via openssl
    {
      const dir = join(homedir(), '.rip', 'certs')
      try { mkdirSync(dir, { recursive: true }) } catch {}
      const certPath = join(dir, 'selfsigned-localhost.pem')
      const keyPath = join(dir, 'selfsigned-localhost-key.pem')
      if (!existsSync(certPath) || !existsSync(keyPath)) {
        try {
          const p = Bun.spawn(['openssl', 'req', '-x509', '-nodes', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath, '-subj', '/CN=localhost', '-days', '1'])
          await p.exited
        } catch {
          console.error('TLS required but could not provision a certificate (mkcert/openssl missing). Use http or provide --cert/--key.')
          process.exit(2)
        }
      }
      try {
        const cert = readFileSync(certPath, 'utf8')
        const key = readFileSync(keyPath, 'utf8')
        this.printCertSummary(cert)
        return { cert, key }
      } catch {
        console.error('Failed to read generated self-signed cert/key from ~/.rip/certs')
        process.exit(2)
      }
    }
  }

  private printCertSummary(certPem: string): void {
    try {
      const x = new X509Certificate(certPem)
      const subject = x.subject.split(/,/)[0]?.trim() || x.subject
      const issuer = x.issuer.split(/,/)[0]?.trim() || x.issuer
      const exp = new Date(x.validTo)
      console.log(`rip-server: tls cert ${subject} issued by ${issuer} expires ${exp.toISOString()}`)
    } catch {}
  }

  private getLanIP(): string | null {
    try {
      const output = Bun.spawnSync(['ifconfig'], { stdout: 'pipe' }).stdout.toString()
      const matches = output.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/g)
      if (matches) {
        for (const match of matches) {
          const ip = match.split(/\s+/)[1]
          if (ip && ip !== '127.0.0.1' && !ip.startsWith('169.254.')) {
            return ip
          }
        }
      }
    } catch {}
    return null
  }

  private async startMdnsAdvertisement(host: string): Promise<void> {
    // Only advertise .local hosts
    if (!host.endsWith('.local')) return

    // Don't re-advertise if already running
    if (this.mdnsProcesses.has(host)) return

    const lanIP = this.getLanIP()
    if (!lanIP) {
      console.log(`rip-server: unable to detect LAN IP for mDNS advertisement of ${host}`)
      return
    }

    const port = this.flags.httpsPort ?? this.flags.httpPort ?? 80
    const protocol = this.flags.httpsPort ? 'https' : 'http'
    const serviceName = host.replace('.local', '')

    try {
      // Spawn dns-sd in background to advertise this hostname
      const proc = Bun.spawn([
        'dns-sd', '-P',
        serviceName,           // Service name
        '_http._tcp',          // Service type
        'local',               // Domain
        String(port),          // Port
        host,                  // Hostname
        lanIP                  // IP address
      ], {
        stdout: 'ignore',
        stderr: 'ignore'
      })

      this.mdnsProcesses.set(host, proc)
      // Show clickable URL for easy access
      console.log(`rip-server: ${protocol}://${host}:${port}`)
    } catch (e: any) {
      console.error(`rip-server: failed to advertise ${host} via mDNS:`, e.message)
    }
  }

  private async stopMdnsAdvertisement(host: string): Promise<void> {
    const proc = this.mdnsProcesses.get(host)
    if (proc) {
      try {
        proc.kill()
        this.mdnsProcesses.delete(host)
        console.log(`rip-server: stopped advertising ${host} via mDNS`)
      } catch {}
    }
  }
}
