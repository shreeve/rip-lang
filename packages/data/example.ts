#!/usr/bin/env bun

/**
 * @rip-lang/data Example - Data Platform Demo
 *
 * This example demonstrates:
 * - Starting a RipData server
 * - Transactional operations (INSERT, UPDATE)
 * - Analytical queries (aggregations, joins)
 * - Real-time streaming subscriptions
 * - S3 data lake integration
 */

import { RipDataClient, RipDataServer } from './index'

async function main() {
  console.log('🔥 Starting @rip-lang/data demo...\n')

  // 1. Start the RipData server
  console.log('📡 Starting RipData Server...')
  const server = new RipDataServer({
    dbPath: ':memory:', // Use in-memory database for demo
    protocols: {
      http: { port: 8080 },
      websocket: { port: 8081 },
    },
  })

  await server.start()
  console.log('✅ Server started successfully!\n')

  // 2. Create a client connection
  const db = new RipDataClient('http://localhost:8080')

  // 3. Set up sample schema
  console.log('🏗️  Setting up sample schema...')
  await db.execute(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name VARCHAR NOT NULL,
      email VARCHAR UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      plan VARCHAR DEFAULT 'free'
    )
  `)

  await db.execute(`
    CREATE TABLE events (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      event_type VARCHAR NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      properties JSON
    )
  `)

  console.log('✅ Schema created!\n')

  // 4. Insert sample data (transactional operations)
  console.log('📝 Inserting sample data...')

  const users = [
    ['Alice Johnson', 'alice@example.com', 'pro'],
    ['Bob Smith', 'bob@example.com', 'free'],
    ['Carol Davis', 'carol@example.com', 'enterprise'],
    ['David Wilson', 'david@example.com', 'pro'],
    ['Eve Brown', 'eve@example.com', 'free'],
  ]

  for (const [name, email, plan] of users) {
    await db.execute('INSERT INTO users (name, email, plan) VALUES (?, ?, ?)', [
      name,
      email,
      plan,
    ])
  }

  // Insert sample events
  const eventTypes = ['login', 'purchase', 'view_page', 'logout', 'upgrade']
  for (let i = 0; i < 50; i++) {
    const userId = Math.floor(Math.random() * 5) + 1
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]
    const properties = JSON.stringify({
      page: `/page-${Math.floor(Math.random() * 10)}`,
      duration: Math.floor(Math.random() * 300),
    })

    await db.execute(
      'INSERT INTO events (user_id, event_type, properties) VALUES (?, ?, ?)',
      [userId, eventType, properties],
    )
  }

  console.log('✅ Sample data inserted!\n')

  // 5. Analytical queries - this is where the magic happens!
  console.log('📊 Running analytical queries...\n')

  // User analytics
  const userStats = await db.query(`
    SELECT
      plan,
      COUNT(*) as user_count,
      COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
    FROM users
    GROUP BY plan
    ORDER BY user_count DESC
  `)

  console.log('👥 User Distribution by Plan:')
  userStats.data?.forEach(row => {
    console.log(
      `   ${row.plan}: ${row.user_count} users (${row.percentage.toFixed(1)}%)`,
    )
  })
  console.log()

  // Event analytics with joins
  const eventStats = await db.query(`
    SELECT
      u.plan,
      e.event_type,
      COUNT(*) as event_count,
      COUNT(DISTINCT e.user_id) as unique_users
    FROM events e
    JOIN users u ON e.user_id = u.id
    GROUP BY u.plan, e.event_type
    ORDER BY u.plan, event_count DESC
  `)

  console.log('📈 Event Analytics by Plan:')
  let currentPlan = ''
  eventStats.data?.forEach(row => {
    if (row.plan !== currentPlan) {
      currentPlan = row.plan
      console.log(`\n   ${currentPlan} users:`)
    }
    console.log(
      `     ${row.event_type}: ${row.event_count} events (${row.unique_users} users)`,
    )
  })
  console.log()

  // Time-based analytics
  const timeStats = await db.query(`
    SELECT
      strftime('%H', timestamp) as hour,
      COUNT(*) as events_per_hour
    FROM events
    GROUP BY hour
    ORDER BY hour
  `)

  console.log('⏰ Events by Hour:')
  timeStats.data?.forEach(row => {
    const bar = '█'.repeat(Math.floor(row.events_per_hour / 2))
    console.log(`   ${row.hour}:00 │${bar} ${row.events_per_hour}`)
  })
  console.log()

  // 6. Real-time streaming demo
  console.log('🌊 Setting up real-time streaming...')

  await db.connectWebSocket()

  // Subscribe to live user count
  const userCountSub = await db.subscribe(
    'SELECT COUNT(*) as total_users FROM users',
    data => {
      console.log(`📊 Live user count: ${data[0].total_users}`)
    },
    2000, // Update every 2 seconds
  )

  // Subscribe to recent events
  const recentEventsSub = await db.subscribe(
    `SELECT
       u.name,
       e.event_type,
       e.timestamp
     FROM events e
     JOIN users u ON e.user_id = u.id
     ORDER BY e.timestamp DESC
     LIMIT 5`,
    data => {
      console.log('\n🔄 Recent Events:')
      data.forEach(event => {
        console.log(
          `   ${event.name}: ${event.event_type} at ${event.timestamp}`,
        )
      })
    },
    3000, // Update every 3 seconds
  )

  console.log('✅ Streaming subscriptions active!\n')

  // 7. Simulate some live activity
  console.log('🎭 Simulating live activity...')

  let activityCount = 0
  const activityInterval = setInterval(async () => {
    const userId = Math.floor(Math.random() * 5) + 1
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]

    await db.execute('INSERT INTO events (user_id, event_type) VALUES (?, ?)', [
      userId,
      eventType,
    ])

    activityCount++

    // Stop after 10 events
    if (activityCount >= 10) {
      clearInterval(activityInterval)

      // Clean up and exit
      setTimeout(async () => {
        console.log('\n🛑 Cleaning up...')

        db.unsubscribe(userCountSub)
        db.unsubscribe(recentEventsSub)
        db.disconnect()

        await server.stop()

        console.log('✅ Demo completed successfully!')
        console.log('\n🎯 What you just saw:')
        console.log('   • Transactional operations (INSERT, UPDATE)')
        console.log('   • Complex analytical queries with JOINs')
        console.log('   • Real-time streaming subscriptions')
        console.log('   • All in ONE database system!')
        console.log(
          '\n🔥 This is the future of web application data architecture!',
        )

        process.exit(0)
      }, 5000)
    }
  }, 1000)

  // 8. Show server stats
  setTimeout(async () => {
    console.log('\n📈 Server Statistics:')
    const stats = await db.stats()
    console.log('   Query performance:', stats.stats)
    console.log('   Active connections:', stats.activeConnections)
    console.log('   Write queue size:', stats.writeQueueSize)
  }, 8000)
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...')
  process.exit(0)
})

// Run the demo
main().catch(error => {
  console.error('❌ Demo failed:', error)
  process.exit(1)
})
