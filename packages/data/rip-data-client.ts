export interface RipDataClientConfig {
  baseUrl: string
  timeout?: number
  retries?: number
}

export interface QueryResult {
  success: boolean
  data?: any[]
  error?: string
  executionTime?: number
}

export interface BatchQuery {
  sql: string
  params?: any[]
}

export class RipDataClient {
  private config: RipDataClientConfig
  private ws?: WebSocket
  private subscriptions = new Map<string, (data: any) => void>()

  constructor(config: RipDataClientConfig | string) {
    if (typeof config === 'string') {
      this.config = { baseUrl: config }
    } else {
      this.config = {
        timeout: 30000,
        retries: 3,
        ...config,
      }
    }
  }

  /**
   * Execute a SELECT query (read operation)
   */
  async query(sql: string, params?: any[]): Promise<QueryResult> {
    return this.makeRequest('/api/query', { sql, params })
  }

  /**
   * Execute an INSERT/UPDATE/DELETE query (write operation)
   */
  async execute(sql: string, params?: any[]): Promise<QueryResult> {
    return this.makeRequest('/api/execute', { sql, params })
  }

  /**
   * Execute multiple queries in a transaction
   */
  async batch(queries: BatchQuery[]): Promise<QueryResult> {
    return this.makeRequest('/api/batch', { queries })
  }

  /**
   * Get server statistics
   */
  async stats(): Promise<QueryResult> {
    const response = await fetch(`${this.config.baseUrl}/api/stats`)
    return response.json()
  }

  /**
   * Check server health
   */
  async health(): Promise<{
    status: string
    timestamp: string
    connections: number
  }> {
    const response = await fetch(`${this.config.baseUrl}/health`)
    return response.json()
  }

  /**
   * Query S3 data through DuckDB
   */
  async queryS3(
    bucket: string,
    key: string,
    customQuery?: string,
  ): Promise<QueryResult> {
    const params = new URLSearchParams({ bucket, key })
    if (customQuery) params.set('query', customQuery)

    const response = await fetch(`${this.config.baseUrl}/s3?${params}`)
    return response.json()
  }

  /**
   * Connect to WebSocket for real-time queries
   */
  connectWebSocket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.config.baseUrl
        .replace('http', 'ws')
        .replace(':8080', ':8081')
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('🔄 Connected to RipData WebSocket')
        resolve(this.ws!)
      }

      this.ws.onerror = error => {
        console.error('❌ WebSocket connection failed:', error)
        reject(error)
      }

      this.ws.onmessage = event => {
        try {
          const message = JSON.parse(event.data)
          this.handleWebSocketMessage(message)
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onclose = () => {
        console.log('🔄 WebSocket connection closed')
        this.subscriptions.clear()
      }
    })
  }

  /**
   * Subscribe to live query updates
   */
  async subscribe(
    query: string,
    callback: (data: any) => void,
    interval = 5000,
  ): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connectWebSocket()
    }

    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.subscriptions.set(subscriptionId, callback)

    this.ws!.send(
      JSON.stringify({
        type: 'subscribe',
        query,
        interval,
      }),
    )

    return subscriptionId
  }

  /**
   * Unsubscribe from live query updates
   */
  unsubscribe(subscriptionId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'unsubscribe',
          id: subscriptionId,
        }),
      )
    }

    this.subscriptions.delete(subscriptionId)
  }

  /**
   * Execute a one-time query via WebSocket
   */
  async queryWebSocket(sql: string, params?: any[]): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connectWebSocket()
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket query timeout'))
      }, this.config.timeout || 30000)

      const messageHandler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'query_result') {
            clearTimeout(timeout)
            this.ws!.removeEventListener('message', messageHandler)
            resolve(message.data)
          } else if (message.type === 'error') {
            clearTimeout(timeout)
            this.ws!.removeEventListener('message', messageHandler)
            reject(new Error(message.error))
          }
        } catch (error) {
          clearTimeout(timeout)
          this.ws!.removeEventListener('message', messageHandler)
          reject(error)
        }
      }

      this.ws!.addEventListener('message', messageHandler)
      this.ws!.send(JSON.stringify({ type: 'query', sql, params }))
    })
  }

  /**
   * Close WebSocket connection
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = undefined
    }
    this.subscriptions.clear()
  }

  private async makeRequest(endpoint: string, body: any): Promise<QueryResult> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < (this.config.retries || 3); attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout || 30000,
        )

        const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.json()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          break
        }

        // Wait before retry (exponential backoff)
        if (attempt < (this.config.retries || 3) - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000),
          )
        }
      }
    }

    throw lastError || new Error('Request failed after retries')
  }

  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'data':
        const callback = this.subscriptions.get(message.id)
        if (callback) {
          callback(message.data)
        }
        break

      case 'error':
        console.error(`❌ Subscription error for ${message.id}:`, message.error)
        break

      case 'subscribed':
        console.log(`✅ Subscribed to live query: ${message.id}`)
        break

      default:
        console.log('📨 Unknown WebSocket message:', message)
    }
  }
}

// Convenience functions for common operations
export const createClient = (baseUrl: string) => new RipDataClient(baseUrl)

// Type-safe query builders
export class QueryBuilder {
  private client: RipDataClient

  constructor(client: RipDataClient) {
    this.client = client
  }

  select(table: string) {
    return new SelectBuilder(this.client, table)
  }

  insert(table: string) {
    return new InsertBuilder(this.client, table)
  }

  update(table: string) {
    return new UpdateBuilder(this.client, table)
  }

  delete(table: string) {
    return new DeleteBuilder(this.client, table)
  }
}

class SelectBuilder {
  private client: RipDataClient
  private table: string
  private columns: string[] = ['*']
  private whereClause = ''
  private params: any[] = []
  private limitValue?: number
  private orderByClause = ''

  constructor(client: RipDataClient, table: string) {
    this.client = client
    this.table = table
  }

  select(...columns: string[]) {
    this.columns = columns
    return this
  }

  where(condition: string, ...params: any[]) {
    this.whereClause = condition
    this.params.push(...params)
    return this
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC') {
    this.orderByClause = `ORDER BY ${column} ${direction}`
    return this
  }

  limit(count: number) {
    this.limitValue = count
    return this
  }

  async execute(): Promise<QueryResult> {
    let sql = `SELECT ${this.columns.join(', ')} FROM ${this.table}`

    if (this.whereClause) {
      sql += ` WHERE ${this.whereClause}`
    }

    if (this.orderByClause) {
      sql += ` ${this.orderByClause}`
    }

    if (this.limitValue) {
      sql += ` LIMIT ${this.limitValue}`
    }

    return this.client.query(sql, this.params)
  }
}

class InsertBuilder {
  private client: RipDataClient
  private table: string
  private data: Record<string, any> = {}

  constructor(client: RipDataClient, table: string) {
    this.client = client
    this.table = table
  }

  values(data: Record<string, any>) {
    this.data = data
    return this
  }

  async execute(): Promise<QueryResult> {
    const columns = Object.keys(this.data)
    const placeholders = columns.map(() => '?').join(', ')
    const values = Object.values(this.data)

    const sql = `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders})`

    return this.client.execute(sql, values)
  }
}

class UpdateBuilder {
  private client: RipDataClient
  private table: string
  private data: Record<string, any> = {}
  private whereClause = ''
  private whereParams: any[] = []

  constructor(client: RipDataClient, table: string) {
    this.client = client
    this.table = table
  }

  set(data: Record<string, any>) {
    this.data = data
    return this
  }

  where(condition: string, ...params: any[]) {
    this.whereClause = condition
    this.whereParams = params
    return this
  }

  async execute(): Promise<QueryResult> {
    const columns = Object.keys(this.data)
    const setClause = columns.map(col => `${col} = ?`).join(', ')
    const values = Object.values(this.data)

    let sql = `UPDATE ${this.table} SET ${setClause}`

    if (this.whereClause) {
      sql += ` WHERE ${this.whereClause}`
      values.push(...this.whereParams)
    }

    return this.client.execute(sql, values)
  }
}

class DeleteBuilder {
  private client: RipDataClient
  private table: string
  private whereClause = ''
  private params: any[] = []

  constructor(client: RipDataClient, table: string) {
    this.client = client
    this.table = table
  }

  where(condition: string, ...params: any[]) {
    this.whereClause = condition
    this.params = params
    return this
  }

  async execute(): Promise<QueryResult> {
    let sql = `DELETE FROM ${this.table}`

    if (this.whereClause) {
      sql += ` WHERE ${this.whereClause}`
    }

    return this.client.execute(sql, this.params)
  }
}
