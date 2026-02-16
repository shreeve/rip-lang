#!/usr/bin/env bun
// Test Schema Runtime

import { parse, Schema } from '../index.js'

// =============================================================================
// Test Schema
// =============================================================================

const schemaSource = `
@enum Role: admin, user, guest
@enum Status: pending, active, inactive

@type Address
  street!  string, [1, 100]
  city!    string, [1, 50]
  zip!     string, [5, 10]
  country  string, ["USA"]

@model User
  name!    string, [1, 100]
  email!#  email
  role     Role, [user]
  status   Status, [active]
  age?     integer
  bio?     text, [0, 1000]
  address? Address
  tags     string[]
  active   boolean, [true]

  @timestamps
`

// =============================================================================
// Tests
// =============================================================================

console.log('Schema Runtime Tests')
console.log('='.repeat(50))

// Parse schema
const ast = parse(schemaSource)
console.log('\n1. Parse schema: OK')

// Create schema instance
const schema = new Schema()
schema.register(ast)
console.log('2. Register schema: OK')

// Check registered items
console.log(`   - Enums: ${schema.listEnums().join(', ')}`)
console.log(`   - Types: ${schema.listTypes().join(', ')}`)
console.log(`   - Models: ${schema.listModels().join(', ')}`)

// Create valid user
console.log('\n3. Create valid user:')
const user = schema.create('User', {
  name: 'John Doe',
  email: 'john@example.com',
})
console.log(`   name: ${user.name}`)
console.log(`   email: ${user.email}`)
console.log(`   role: ${user.role} (default)`)
console.log(`   active: ${user.active} (default)`)
console.log(`   createdAt: ${user.createdAt} (auto)`)

// Validate valid user
console.log('\n4. Validate valid user:')
const validErrors = user.$validate()
console.log(`   Errors: ${validErrors ? JSON.stringify(validErrors) : 'none'}`)

// Create invalid user (missing required fields)
console.log('\n5. Validate invalid user (missing email):')
const invalidUser = schema.create('User', { name: 'Jane' })
invalidUser.email = undefined // Remove email
const errors1 = invalidUser.$validate()
console.log(`   Errors: ${JSON.stringify(errors1, null, 2)}`)

// Validate type constraints
console.log('\n6. Validate type constraints:')
const user2 = schema.create('User', {
  name: 'A', // Too short? No, min is 1
  email: 'not-an-email',
})
const errors2 = user2.$validate()
console.log(`   Errors: ${JSON.stringify(errors2, null, 2)}`)

// Validate enum
console.log('\n7. Validate enum:')
const user3 = schema.create('User', {
  name: 'Test User',
  email: 'test@example.com',
  role: 'superadmin', // Invalid enum value
})
const errors3 = user3.$validate()
console.log(`   Errors: ${JSON.stringify(errors3, null, 2)}`)

// Test nested type
console.log('\n8. Test nested type (Address):')
const user4 = schema.create('User', {
  name: 'With Address',
  email: 'addr@example.com',
  address: {
    street: '123 Main St',
    city: 'Springfield',
    zip: '12345',
  },
})
const errors4 = user4.$validate()
console.log(`   Address: ${JSON.stringify(user4.address)}`)
console.log(`   Errors: ${errors4 ? JSON.stringify(errors4) : 'none'}`)

// Test invalid nested type
console.log('\n9. Test invalid nested type:')
const user5 = schema.create('User', {
  name: 'Bad Address',
  email: 'bad@example.com',
  address: {
    street: '', // Too short (min 1)
    city: 'X',
    zip: '123', // Too short (min 5)
  },
})
const errors5 = user5.$validate()
console.log(`   Errors: ${JSON.stringify(errors5, null, 2)}`)

// Performance test
console.log('\n10. Performance test:')
const iterations = 10000
const start = performance.now()
for (let i = 0; i < iterations; i++) {
  const u = schema.create('User', {
    name: `User ${i}`,
    email: `user${i}@example.com`,
  })
  u.$validate()
}
const elapsed = performance.now() - start
console.log(`    ${iterations} create+validate cycles: ${elapsed.toFixed(2)}ms`)
console.log(`    Per operation: ${(elapsed / iterations * 1000).toFixed(2)}µs`)

console.log('\n' + '='.repeat(50))
console.log('All tests completed!')
