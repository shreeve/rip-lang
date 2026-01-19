import type { Server } from 'bun'
import { type Connection, Database } from 'duckdb'
import { WebSocket, WebSocketServer } from 'ws'

export interface RipDataConfig {
  dbPath?: string
  protocols?: {
    http?: { port: number }
    websocket?: { port: number }
    postgres?: { port: number }
  }
  s3?: {
    bucket?: string
    region?: string
    endpoint?: string
  }
  maxConnections?: number
  writeQueueSize?: number
}

export interface QueryRequest {
  sql: string
  params?: any[]
  resolve: (response: Response) => void
  reject?: (error: Error) => void
}

export interface StreamSubscription {
  id: string
  query: string
  interval: number
  ws: WebSocket
  timer?: Timer
}

export class RipDataServer {
  private db: Database
  private writeQueue: QueryRequest[] = []
  private isProcessingWrites = false
  private httpServer?: Server
  private wsServer?: WebSocketServer
  private subscriptions = new Map<string, StreamSubscription>()
  private config: RipDataConfig

  constructor(config: RipDataConfig = {}) {
    this.config = {
      dbPath: './rip-data.duckdb',
      protocols: {
        http: { port: 8080 },
        websocket: { port: 8081 },
      },
      maxConnections: 100,
      writeQueueSize: 1000,
      ...config,
    }

    // Initialize DuckDB - single instance for the entire server
    this.db = new Database(this.config.dbPath)
    this.setupDatabase()
  }

  private setupDatabase() {
    const conn = this.db.connect()

    try {
      // Enable S3 extension if configured
      if (this.config.s3) {
        conn.exec(`
          INSTALL httpfs;
          LOAD httpfs;
          SET s3_region='${this.config.s3.region || 'us-east-1'}';
        `)

        if (this.config.s3.endpoint) {
          conn.exec(`SET s3_endpoint='${this.config.s3.endpoint}';`)
        }
      }

      // Create system tables for monitoring
      conn.exec(`
        CREATE TABLE IF NOT EXISTS _rip_data_stats (
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          query_type VARCHAR,
          execution_time_ms INTEGER,
          rows_affected INTEGER
        );
      `)

      console.log('🔥 RipData: Database initialized successfully')
    } catch (error) {
      console.error('❌ RipData: Database setup failed:', error)
      throw error
    } finally {
      conn.close()
    }
  }

  async start(): Promise<void> {
    console.log('🚀 Starting RipData Server...')

    // Start HTTP server
    if (this.config.protocols?.http) {
      await this.startHTTPServer()
    }

    // Start WebSocket server
    if (this.config.protocols?.websocket) {
      await this.startWebSocketServer()
    }

    console.log('✅ RipData Server started successfully!')
    console.log(
      `📊 HTTP API: http://localhost:${this.config.protocols?.http?.port}`,
    )
    console.log(
      `🔄 WebSocket: ws://localhost:${this.config.protocols?.websocket?.port}`,
    )
  }

  private async startHTTPServer(): Promise<void> {
    const port = this.config.protocols!.http!.port

    this.httpServer = Bun.serve({
      port,
      fetch: async req => {
        return this.handleHTTPRequest(req)
      },
    })

    console.log(`🌐 HTTP server listening on port ${port}`)
  }

  private async handleHTTPRequest(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname

    // CORS headers for web clients
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders })
    }

    try {
      switch (path) {
        case '/api/query':
          return await this.handleQuery(req, corsHeaders)

        case '/api/execute':
          return await this.handleExecute(req, corsHeaders)

        case '/api/batch':
          return await this.handleBatch(req, corsHeaders)

        case '/api/stats':
          return await this.handleStats(req, corsHeaders)

        case '/health':
          return new Response(
            JSON.stringify({
              status: 'healthy',
              timestamp: new Date().toISOString(),
              connections: this.subscriptions.size,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )

        // S3 API compatibility layer
        case '/s3':
          return await this.handleS3Request(req, corsHeaders)

        default:
          return new Response('Not Found', {
            status: 404,
            headers: corsHeaders,
          })
      }
    } catch (error) {
      console.error('❌ HTTP request error:', error)
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }
  }

  private async handleQuery(
    req: Request,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    const { sql, params } = await req.json()
    const startTime = Date.now()

    // Create new connection for this read operation
    const conn = this.db.connect()

    try {
      const result = await this.executeQuery(conn, sql, params)
      const executionTime = Date.now() - startTime

      // Log stats
      this.logQueryStats('SELECT', executionTime, result.length)

      return new Response(
        JSON.stringify({
          success: true,
          data: result,
          executionTime,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    } finally {
      conn.close()
    }
  }

  private async handleExecute(
    req: Request,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    const { sql, params } = await req.json()

    return new Promise(resolve => {
      if (this.writeQueue.length >= (this.config.writeQueueSize || 1000)) {
        resolve(
          new Response(
            JSON.stringify({
              success: false,
              error: 'Write queue full',
            }),
            {
              status: 503,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          ),
        )
        return
      }

      this.writeQueue.push({
        sql,
        params,
        resolve: response => {
          // Add CORS headers to the queued response
          const newResponse = new Response(response.body, {
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
          resolve(newResponse)
        },
      })

      this.processWriteQueue()
    })
  }

  private async handleBatch(
    req: Request,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    const { queries } = await req.json()
    const results = []

    // Execute batch as a transaction
    const conn = this.db.connect()

    try {
      await this.executeQuery(conn, 'BEGIN TRANSACTION', [])

      for (const { sql, params } of queries) {
        const result = await this.executeQuery(conn, sql, params)
        results.push({ success: true, data: result })
      }

      await this.executeQuery(conn, 'COMMIT', [])

      return new Response(
        JSON.stringify({
          success: true,
          results,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    } catch (error) {
      await this.executeQuery(conn, 'ROLLBACK', [])
      throw error
    } finally {
      conn.close()
    }
  }

  private async handleStats(
    req: Request,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    const conn = this.db.connect()

    try {
      const stats = await this.executeQuery(
        conn,
        `
        SELECT
          query_type,
          COUNT(*) as total_queries,
          AVG(execution_time_ms) as avg_execution_time,
          SUM(rows_affected) as total_rows_affected
        FROM _rip_data_stats
        WHERE timestamp > NOW() - INTERVAL '1 hour'
        GROUP BY query_type
      `,
        [],
      )

      return new Response(
        JSON.stringify({
          success: true,
          stats,
          activeConnections: this.subscriptions.size,
          writeQueueSize: this.writeQueue.length,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    } finally {
      conn.close()
    }
  }

  private async handleS3Request(
    req: Request,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    const url = new URL(req.url)
    const bucket = url.searchParams.get('bucket')
    const key = url.searchParams.get('key')
    const query = url.searchParams.get('query')

    if (!bucket || !key) {
      return new Response(
        JSON.stringify({
          error: 'Missing bucket or key parameter',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const conn = this.db.connect()

    try {
      const s3Path = `s3://${bucket}/${key}`
      const sql = query || `SELECT * FROM '${s3Path}' LIMIT 1000`

      const result = await this.executeQuery(conn, sql, [])

      return new Response(
        JSON.stringify({
          success: true,
          data: result,
          source: s3Path,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    } finally {
      conn.close()
    }
  }

  private async processWriteQueue(): Promise<void> {
    if (this.isProcessingWrites || this.writeQueue.length === 0) return

    this.isProcessingWrites = true
    const conn = this.db.connect()

    try {
      // Process writes in batches for better performance
      const batchSize = Math.min(50, this.writeQueue.length)
      const batch = this.writeQueue.splice(0, batchSize)

      await this.executeQuery(conn, 'BEGIN TRANSACTION', [])

      for (const { sql, params, resolve } of batch) {
        try {
          const startTime = Date.now()
          const result = await this.executeQuery(conn, sql, params)
          const executionTime = Date.now() - startTime

          this.logQueryStats(
            'WRITE',
            executionTime,
            Array.isArray(result) ? result.length : 1,
          )

          resolve(
            new Response(
              JSON.stringify({
                success: true,
                result,
                executionTime,
              }),
            ),
          )
        } catch (error) {
          resolve(
            new Response(
              JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              }),
              { status: 500 },
            ),
          )
        }
      }

      await this.executeQuery(conn, 'COMMIT', [])
    } catch (error) {
      await this.executeQuery(conn, 'ROLLBACK', [])
      console.error('❌ Write batch failed:', error)
    } finally {
      conn.close()
      this.isProcessingWrites = false

      // Process next batch if there are more writes queued
      if (this.writeQueue.length > 0) {
        setImmediate(() => this.processWriteQueue())
      }
    }
  }

  private async startWebSocketServer(): Promise<void> {
    const port = this.config.protocols!.websocket!.port

    this.wsServer = new WebSocketServer({ port })

    this.wsServer.on('connection', ws => {
      console.log('🔄 New WebSocket connection')

      ws.on('message', data => {
        try {
          const message = JSON.parse(data.toString())
          this.handleWebSocketMessage(ws, message)
        } catch (error) {
          ws.send(
            JSON.stringify({
              error: 'Invalid JSON message',
            }),
          )
        }
      })

      ws.on('close', () => {
        // Clean up subscriptions for this connection
        for (const [id, sub] of this.subscriptions) {
          if (sub.ws === ws) {
            if (sub.timer) clearInterval(sub.timer)
            this.subscriptions.delete(id)
          }
        }
      })
    })

    console.log(`🔄 WebSocket server listening on port ${port}`)
  }

  private handleWebSocketMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(ws, message)
        break

      case 'unsubscribe':
        this.handleUnsubscribe(message.id)
        break

      case 'query':
        this.handleWebSocketQuery(ws, message)
        break

      default:
        ws.send(
          JSON.stringify({
            error: 'Unknown message type',
          }),
        )
    }
  }

  private handleSubscribe(ws: WebSocket, message: any): void {
    const { query, interval = 5000 } = message
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const subscription: StreamSubscription = {
      id,
      query,
      interval,
      ws,
    }

    // Execute query immediately
    this.executeSubscriptionQuery(subscription)

    // Set up interval for live updates
    subscription.timer = setInterval(() => {
      this.executeSubscriptionQuery(subscription)
    }, interval)

    this.subscriptions.set(id, subscription)

    ws.send(
      JSON.stringify({
        type: 'subscribed',
        id,
        query,
        interval,
      }),
    )
  }

  private handleUnsubscribe(id: string): void {
    const subscription = this.subscriptions.get(id)
    if (subscription) {
      if (subscription.timer) clearInterval(subscription.timer)
      this.subscriptions.delete(id)
    }
  }

  private async handleWebSocketQuery(
    ws: WebSocket,
    message: any,
  ): Promise<void> {
    const { sql, params } = message
    const conn = this.db.connect()

    try {
      const result = await this.executeQuery(conn, sql, params)
      ws.send(
        JSON.stringify({
          type: 'query_result',
          data: result,
        }),
      )
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
    } finally {
      conn.close()
    }
  }

  private async executeSubscriptionQuery(
    subscription: StreamSubscription,
  ): Promise<void> {
    const conn = this.db.connect()

    try {
      const result = await this.executeQuery(conn, subscription.query, [])

      if (subscription.ws.readyState === WebSocket.OPEN) {
        subscription.ws.send(
          JSON.stringify({
            type: 'data',
            id: subscription.id,
            data: result,
            timestamp: new Date().toISOString(),
          }),
        )
      }
    } catch (error) {
      if (subscription.ws.readyState === WebSocket.OPEN) {
        subscription.ws.send(
          JSON.stringify({
            type: 'error',
            id: subscription.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        )
      }
    } finally {
      conn.close()
    }
  }

  private async executeQuery(
    conn: Connection,
    sql: string,
    params: any[] = [],
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (params.length > 0) {
        conn.all(sql, params, (err, rows) => {
          if (err) reject(err)
          else resolve(rows || [])
        })
      } else {
        conn.all(sql, (err, rows) => {
          if (err) reject(err)
          else resolve(rows || [])
        })
      }
    })
  }

  private logQueryStats(
    queryType: string,
    executionTime: number,
    rowsAffected: number,
  ): void {
    // Log to internal stats table (fire and forget)
    const conn = this.db.connect()
    conn.run(
      `
      INSERT INTO _rip_data_stats (query_type, execution_time_ms, rows_affected)
      VALUES (?, ?, ?)
    `,
      [queryType, executionTime, rowsAffected],
      () => {
        conn.close()
      },
    )
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping RipData Server...')

    // Close all subscriptions
    for (const [id, sub] of this.subscriptions) {
      if (sub.timer) clearInterval(sub.timer)
      if (sub.ws.readyState === WebSocket.OPEN) {
        sub.ws.close()
      }
    }
    this.subscriptions.clear()

    // Close servers
    if (this.wsServer) {
      this.wsServer.close()
    }

    if (this.httpServer) {
      this.httpServer.stop()
    }

    // Close database
    this.db.close()

    console.log('✅ RipData Server stopped')
  }
}
