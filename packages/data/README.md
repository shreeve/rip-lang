<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.svg" style="width:50px" /> <br>

# @rip-lang/data - Data Platform

> **Transform your web application with DuckDB as both transactional AND analytical store**

## 🔥 The Approach

`@rip-lang/data` offers a simpler approach to web application data architecture. Instead of the traditional pattern:

```
App → PostgreSQL (transactional) → ETL → Data Warehouse (analytical) → BI Tools
```

You get this elegant, unified architecture:

```
App → @rip-lang/data (BOTH transactional AND analytical) → Direct Analytics
```

## ✨ Key Features

- **🎯 Single Source of Truth** - No data silos, no ETL delays
- **⚡ Real-time Analytics** - Query fresh data instantly
- **🔒 ACID Transactions** - Full transactional guarantees
- **📊 Columnar Performance** - Blazing fast analytical queries
- **🌊 Live Streaming** - WebSocket subscriptions for real-time updates
- **☁️ S3 Integration** - Seamless data lake connectivity
- **🔌 Multi-Protocol** - HTTP, WebSocket, PostgreSQL wire protocol
- **🚀 Bun-Powered** - Maximum performance with minimal overhead

## 🚀 Quick Start

### Installation

```bash
bun add @rip-lang/data duckdb
```

### Start a Server

**Method 1: Direct Execution**
```bash
bun rip-data-server.ts
```

**Method 2: Custom Configuration**
```typescript
import { RipDataServer } from '@rip-lang/data'

const server = new RipDataServer({
  dbPath: './my-app.duckdb',
  protocols: {
    http: { port: 8080 },
    websocket: { port: 8081 }
  },
  s3: {
    bucket: 'my-data-lake',
    region: 'us-east-1'
  }
})

await server.start()
console.log('🔥 RipData server running!')
```

### Connect a Client

```typescript
import { RipDataClient } from '@rip-lang/data'

const db = new RipDataClient('http://localhost:8080')

// Transactional operations
await db.execute(`
  INSERT INTO users (name, email)
  VALUES (?, ?)
`, ['Alice', 'alice@example.com'])

// Analytical queries
const stats = await db.query(`
  SELECT
    date_trunc('hour', created_at) as hour,
    count(*) as signups,
    avg(session_duration) as avg_session
  FROM users u
  JOIN sessions s ON u.id = s.user_id
  WHERE created_at > now() - interval '24 hours'
  GROUP BY hour
  ORDER BY hour
`)

console.log('📊 Hourly signups:', stats.data)
```

## 🔌 Connection Methods

### Connection Matrix

| Method | Port | Use Case | Tools |
|--------|------|----------|-------|
| **HTTP API** | 8306 | Programmatic access | curl, HTTPie, Postman, @rip-lang/data client |
| **WebSocket** | 8307 | Real-time streaming | Browser, Node.js, @rip-lang/data client |
| **PostgreSQL Wire** | 5432 | Standard DB tools | psql, pgAdmin, DBeaver, ORMs |
| **Direct File** | - | Admin/debugging | DuckDB CLI, DB browsers |

### HTTP/REST API (Port 8306)

```bash
# Query data
curl -X POST http://localhost:8306/api/query \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM users LIMIT 5"}'

# Execute writes
curl -X POST http://localhost:8306/api/execute \
  -H "Content-Type: application/json" \
  -d '{"sql": "INSERT INTO users (email, name) VALUES (?, ?)", "params": ["test@example.com", "John"]}'

# Batch operations
curl -X POST http://localhost:8306/api/batch \
  -H "Content-Type: application/json" \
  -d '{"queries": [
    {"sql": "BEGIN"},
    {"sql": "INSERT INTO users (email, name) VALUES (?, ?)", "params": ["batch@example.com", "Batch"]},
    {"sql": "COMMIT"}
  ]}'

# Health check
curl http://localhost:8306/health

# Server stats
curl http://localhost:8306/stats
```

### WebSocket Streaming (Port 8307)

**JavaScript/Browser:**
```javascript
const ws = new WebSocket('ws://localhost:8307')

// Subscribe to live data
ws.send(JSON.stringify({
  type: 'subscribe',
  query: 'SELECT COUNT(*) as user_count FROM users',
  interval: 1000  // Update every second
}))

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log('Live user count:', message.data[0].user_count)
}
```

**Node.js:**
```javascript
import WebSocket from 'ws'

const ws = new WebSocket('ws://localhost:8307')

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    query: `
      SELECT
        COUNT(*) as total_orders,
        SUM(total) as revenue_today
      FROM orders
      WHERE DATE(createdAt) = CURRENT_DATE
    `,
    interval: 5000
  }))
})

ws.on('message', (data) => {
  const { data: results } = JSON.parse(data.toString())
  console.log('📊 Live Dashboard:', results[0])
})
```

### PostgreSQL Wire Protocol (Port 5432)

Once implemented, use ANY PostgreSQL tool:

```bash
# psql (PostgreSQL CLI)
psql -h localhost -p 5432 -U admin -d ripdata

# pgAdmin, DBeaver, DataGrip - all work!
# Any ORM: Prisma, Drizzle, TypeORM, Sequelize, etc.
```

### DuckDB Native REPL (Direct File Access)

```bash
# Install DuckDB CLI
brew install duckdb  # macOS

# Connect directly to the database file
duckdb ./path/to/your.duckdb

# Full DuckDB REPL
D SELECT * FROM users LIMIT 5;
D .tables
D .schema users
```

## 🎯 Core Concepts

### Single-Process Multi-Client Architecture

`@rip-lang/data` solves DuckDB's single-writer limitation by creating a **Bun-powered server** that:

- Opens the DuckDB file **once** in a single process
- Handles **multiple concurrent clients** via HTTP/WebSocket
- Serializes **write operations** through a queue
- Allows **concurrent read operations** with multiple connections
- Provides **real-time streaming** via WebSocket subscriptions

### Write Queue with Batching

All write operations go through a high-performance queue:

```typescript
// These all get batched automatically
await Promise.all([
  db.execute('INSERT INTO users ...'),
  db.execute('UPDATE stats ...'),
  db.execute('INSERT INTO events ...')
])
```

### Real-Time Subscriptions

Subscribe to live query results:

```typescript
const unsubscribe = await db.subscribe(
  'SELECT COUNT(*) as active_users FROM sessions WHERE last_seen > now() - interval \'5 minutes\'',
  (data) => {
    console.log('Active users:', data[0].active_users)
  },
  1000 // Update every second
)
```

## 🌊 Advanced Features

### S3 Data Lake Integration

Query data directly from S3:

```typescript
// Query S3 data through DuckDB
const insights = await db.queryS3(
  'analytics-bucket',
  'events/*.parquet',
  `SELECT event_type, COUNT(*)
   FROM 's3://analytics-bucket/events/*.parquet'
   WHERE date >= '2024-01-01'
   GROUP BY event_type`
)

// Hybrid queries: local + S3
const combined = await db.query(`
  SELECT
    local.user_id,
    local.name,
    s3_events.event_count
  FROM users local
  JOIN (
    SELECT user_id, COUNT(*) as event_count
    FROM 's3://analytics/events/*.parquet'
    WHERE date >= '2024-01-01'
    GROUP BY user_id
  ) s3_events ON local.id = s3_events.user_id
`)
```

### Type-Safe Query Builder

```typescript
import { QueryBuilder } from '@rip-lang/data'

const qb = new QueryBuilder(db)

const users = await qb
  .select('users')
  .select('id', 'name', 'email')
  .where('active = ? AND created_at > ?', true, '2024-01-01')
  .orderBy('created_at', 'DESC')
  .limit(100)
  .execute()
```

### Batch Transactions

```typescript
await db.batch([
  { sql: 'BEGIN TRANSACTION' },
  { sql: 'INSERT INTO users (name) VALUES (?)', params: ['Alice'] },
  { sql: 'INSERT INTO events (user_id, type) VALUES (?, ?)', params: [1, 'signup'] },
  { sql: 'UPDATE stats SET user_count = user_count + 1' },
  { sql: 'COMMIT' }
])
```

## 📊 Monitoring & Administration

```typescript
const health = await db.health()
console.log('Server status:', health.status)
console.log('Active connections:', health.connections)

const stats = await db.stats()
console.log('Query performance:', stats.stats)
```

**Stats Response:**
```json
{
  "activeConnections": 3,
  "writeQueueSize": 0,
  "totalQueries": 1247,
  "avgQueryTime": "12.3ms",
  "uptime": "2h 15m 30s",
  "dbSize": "2.4MB"
}
```

## 🏗️ Architecture Examples

### Micro-Service with Analytics

```typescript
import { Hono } from 'hono'
import { RipDataClient } from '@rip-lang/data'

const app = new Hono()
const db = new RipDataClient('http://localhost:8080')

// Transactional endpoint
app.post('/api/users', async (c) => {
  const { name, email } = await c.req.json()

  const result = await db.execute(
    'INSERT INTO users (name, email) VALUES (?, ?) RETURNING id',
    [name, email]
  )

  return c.json({ id: result.data[0].id })
})

// Analytics endpoint
app.get('/api/analytics/users', async (c) => {
  const stats = await db.query(`
    SELECT
      date_trunc('day', created_at) as date,
      count(*) as signups,
      count(DISTINCT email) as unique_emails
    FROM users
    WHERE created_at > now() - interval '30 days'
    GROUP BY date
    ORDER BY date
  `)

  return c.json(stats.data)
})
```

### Real-Time Dashboard

```typescript
import { RipDataClient } from '@rip-lang/data'

const db = new RipDataClient('http://localhost:8080')
await db.connectWebSocket()

// Live metrics
const metrics = [
  'SELECT COUNT(*) as total_users FROM users',
  'SELECT COUNT(*) as active_sessions FROM sessions WHERE last_seen > now() - interval \'5 minutes\'',
  'SELECT SUM(amount) as revenue_today FROM orders WHERE created_at::date = current_date'
]

metrics.forEach((query, index) => {
  db.subscribe(query, (data) => {
    updateDashboard(`metric-${index}`, data[0])
  }, 2000)
})
```

## 🔧 Configuration

### Server Options

```typescript
const server = new RipDataServer({
  // Database file path
  dbPath: './my-app.duckdb',

  // Protocol configuration
  protocols: {
    http: { port: 8080 },
    websocket: { port: 8081 },
    postgres: { port: 5432 } // Coming soon
  },

  // S3 integration
  s3: {
    bucket: 'my-data-lake',
    region: 'us-east-1',
    endpoint: 'https://s3.amazonaws.com' // Optional
  },

  // Performance tuning
  maxConnections: 100,
  writeQueueSize: 1000
})
```

### Client Options

```typescript
const db = new RipDataClient({
  baseUrl: 'http://localhost:8080',
  timeout: 30000,
  retries: 3
})
```

## 🎯 Use Cases

### Perfect For:

- **📊 Real-time Analytics** - Live dashboards, monitoring
- **🔄 Event Sourcing** - Immutable event logs with analytics
- **📈 Business Intelligence** - Direct querying without ETL
- **🧪 Data Science** - Exploratory analysis on live data
- **📱 Modern Web Apps** - Rich analytics features
- **🏢 Internal Tools** - Admin dashboards, reporting

## 🚀 Performance

### Benchmarks

- **🔥 Query Performance** - 10-100x faster than traditional OLTP databases for analytics
- **⚡ Write Throughput** - Batched writes achieve high throughput
- **📊 Compression** - Columnar storage reduces size by 10-100x
- **🌊 Streaming** - Real-time updates with minimal latency

### Optimization Tips

1. **Batch Writes** - Group related operations
2. **Use Indexes** - Create indexes on frequently queried columns
3. **Partition Data** - Use time-based partitioning for large datasets
4. **Leverage S3** - Move cold data to S3 for cost optimization
5. **Monitor Stats** - Use built-in monitoring to identify bottlenecks

## 🛣️ Roadmap

- **✅ HTTP API** - Complete REST interface
- **✅ WebSocket Streaming** - Real-time subscriptions
- **✅ S3 Integration** - Data lake connectivity
- **🚧 PostgreSQL Wire Protocol** - Tool compatibility
- **🚧 Authentication** - JWT, API keys, role-based access
- **🚧 Clustering** - Multi-node deployments

## 🌟 Why @rip-lang/data?

Traditional web applications are **data-poor** because analytics are **hard**:

- Set up separate analytical databases
- Build complex ETL pipelines
- Deal with data consistency issues
- Manage multiple systems

**@rip-lang/data changes everything:**

- **One database** for everything
- **Real-time analytics** out of the box
- **ACID consistency** for all operations
- **Massive cost savings** vs traditional stacks

**Traditional Setup:**
- MySQL: Port 3306 (OLTP only)
- Redis: Port 6379 (caching)
- PostgreSQL: Port 5432 (analytics)
- Elasticsearch: Port 9200 (search)
- **= 4 different systems, 4 different protocols**

**Rip Setup:**
- **RipData Server: One system, multiple protocols, unified data**

---

**Ready to simplify your data architecture?**

```bash
bun add @rip-lang/data
```

**The future of web applications is data-driven. The future is now.** 🔥
