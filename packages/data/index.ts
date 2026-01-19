export { RipDataServer } from './rip-data-server'
export { RipDataClient, createClient, QueryBuilder } from './rip-data-client'
export type {
  RipDataConfig,
  QueryRequest,
  StreamSubscription,
} from './rip-data-server'
export type {
  RipDataClientConfig,
  QueryResult,
  BatchQuery,
} from './rip-data-client'

// Convenience function to start a server quickly
export async function startRipDataServer(
  config?: Partial<import('./rip-data-server').RipDataConfig>,
) {
  const server = new (await import('./rip-data-server')).RipDataServer(config)
  await server.start()
  return server
}

// Default export for easy importing
export default {
  RipDataServer: (await import('./rip-data-server')).RipDataServer,
  RipDataClient: (await import('./rip-data-client')).RipDataClient,
  createClient: (await import('./rip-data-client')).createClient,
  startServer: startRipDataServer,
}
