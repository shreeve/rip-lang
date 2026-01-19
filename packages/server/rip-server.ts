/**
 * Rip Server CLI: parse flags, start Server + Manager.
 */

import { parseFlags, getControlSocketPath, resolveAppEntry } from './utils'
import { Manager } from './manager'
import { Server } from './server'

async function main(): Promise<void> {
  // Subcommand: `bun server stop` (position‑independent)
  if (process.argv.includes('stop')) {
    try {
      // Best-effort: find and kill matching processes by script path
      const script = __filename
      await Bun.spawn(['pkill', '-f', script]).exited
      // Also clean up any orphaned dns-sd processes from rip-server
      await Bun.spawn(['pkill', '-f', 'dns-sd -P.*_http._tcp']).exited
    } catch {}
    console.log('rip-server: stop requested')
    return
  }
    // List subcommand: `bun server list` (position‑independent)
  if (process.argv.includes('list')) {
    const getKV = (prefix: string): string | undefined => {
      for (const tok of process.argv) if (tok.startsWith(prefix)) return tok.slice(prefix.length)
      return undefined
    }
    const findAppPathToken = (): string | undefined => {
      for (let i = 2; i < process.argv.length; i++) {
        const tok = process.argv[i]
        // Check for @ syntax and extract just the path part
        const pathPart = tok.includes('@') ? tok.split('@')[0] : tok
        const looksLikePath = pathPart.includes('/') || pathPart.startsWith('.') || pathPart.endsWith('.rip') || pathPart.endsWith('.ts')
        try {
          if (looksLikePath && require('fs').existsSync(require('path').isAbsolute(pathPart) ? pathPart : require('path').resolve(process.cwd(), pathPart))) return pathPart
        } catch {}
      }
      return undefined
    }
    const computeSocketPrefix = (): string => {
      const override = getKV('--socket-prefix=')
      if (override) return override
      const appTok = findAppPathToken()
      if (appTok) {
        try { const { appName } = resolveAppEntry(appTok); return `rip_${appName}` } catch {}
      }
      return 'rip_server'
    }
    const controlUnix = getControlSocketPath(computeSocketPrefix())
    const registryPath = 'http://localhost/registry'
    try {
      const res = await fetch(registryPath, { unix: controlUnix, method: 'GET' })
      if (!res.ok) throw new Error(`list failed: ${res.status}`)
      const j = await res.json()
      const hosts: string[] = Array.isArray(j?.hosts) ? j.hosts : []
      console.log(hosts.length ? hosts.join('\n') : '(no hosts)')
    } catch (e: any) {
      console.error(`list command failed: ${e?.message || e}`)
      process.exit(1)
    }
    return
  }
  const flags = parseFlags(process.argv)
  const svr = new Server(flags)
  const mgr = new Manager(flags)

  // Cleanup handler for crashes and signals
  const cleanup = async () => {
    console.log('rip-server: shutting down...')
    svr.stop()
    await mgr.stop()
    process.exit(0)
  }

  // Handle various termination scenarios
  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)
  process.on('uncaughtException', (err) => {
    console.error('rip-server: uncaught exception:', err)
    cleanup()
  })
  process.on('unhandledRejection', (err) => {
    console.error('rip-server: unhandled rejection:', err)
    cleanup()
  })

  await svr.start()
  await mgr.start()
  const httpOnly = flags.httpsPort === null
  const url = httpOnly
    ? `http://localhost:${flags.httpPort}/server`
    : `https://localhost:${flags.httpsPort}/server`
  console.log(`rip-server: app=${flags.appName} workers=${flags.workers} url=${url}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
