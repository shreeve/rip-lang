import { AsyncLocalStorage } from 'node:async_hooks'
import type { Context } from 'hono'

export type RequestContext = {
  hono: Context
  data: Record<string, any>
}

export const requestContext = new AsyncLocalStorage<RequestContext>()
