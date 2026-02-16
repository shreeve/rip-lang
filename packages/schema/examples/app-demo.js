#!/usr/bin/env bun
// ==============================================================================
// app-demo.js — Full demo of @rip-lang/schema
//
// One schema file → TypeScript types + SQL DDL + runtime validation
//
// Run: bun examples/app-demo.js     (from packages/schema/)
// ==============================================================================

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { parse, schema, generateTypes, generateSQL } from '../index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaSource = fs.readFileSync(path.join(__dirname, 'app.schema'), 'utf-8')

function clean(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$') || typeof v === 'function') continue
    out[k] = v
  }
  return out
}

function show(label, obj) {
  console.log(`   ${label}:`, JSON.stringify(clean(obj), null, 2).replace(/\n/g, '\n   '))
}

function showErrors(errors) {
  if (!errors) { console.log('   ✓ valid'); return }
  for (const e of errors) {
    if (e.errors) {
      console.log(`   ✗ ${e.field}:`)
      for (const ne of e.errors) console.log(`     - ${ne.message}`)
    } else {
      console.log(`   ✗ ${e.message}`)
    }
  }
}

// =============================================================================
// 1. Parse
// =============================================================================

console.log()
console.log('1. PARSE')
console.log('─'.repeat(60))

const ast = parse(schemaSource)

const enums = ast.filter(n => n[0] === 'enum').length
const types = ast.filter(n => n[0] === 'type').length
const models = ast.filter(n => n[0] === 'model').length
console.log(`   Parsed app.schema: ${enums} enums, ${types} types, ${models} models`)

// =============================================================================
// 2. TypeScript types
// =============================================================================

console.log()
console.log('2. TYPESCRIPT TYPES  (replaces hand-written interfaces)')
console.log('─'.repeat(60))

const ts = generateTypes(ast)
console.log(ts)

// =============================================================================
// 3. SQL DDL
// =============================================================================

console.log('3. SQL DDL  (replaces Prisma migrations)')
console.log('─'.repeat(60))

const sql = generateSQL(ast)
console.log(sql)

// =============================================================================
// 4. Runtime validation  (replaces Zod)
// =============================================================================

console.log('4. RUNTIME VALIDATION  (replaces Zod schemas)')
console.log('─'.repeat(60))

schema.register(ast)

// --- Valid user ---
console.log()
console.log('   a) Valid user — defaults are applied automatically')
const alice = schema.create('User', {
  name: 'Alice Chen',
  email: 'alice@example.com',
})
show('result', alice)
showErrors(alice.$validate())

// --- Missing required field ---
console.log()
console.log('   b) Missing required field')
const bad1 = schema.create('User', { name: 'Bob' })
bad1.email = undefined
showErrors(bad1.$validate())

// --- Bad email ---
console.log()
console.log('   c) Invalid email format')
const bad2 = schema.create('User', { name: 'Charlie', email: 'not-an-email' })
showErrors(bad2.$validate())

// --- String too long ---
console.log()
console.log('   d) Name exceeds max length (100)')
const bad3 = schema.create('User', { name: 'X'.repeat(101), email: 'x@test.com' })
showErrors(bad3.$validate())

// --- Invalid enum ---
console.log()
console.log('   e) Invalid enum value')
const bad4 = schema.create('User', { name: 'Dana', email: 'd@test.com', role: 'superadmin' })
showErrors(bad4.$validate())

// --- Nested type validation ---
console.log()
console.log('   f) Nested type with multiple violations')
const bad5 = schema.create('User', {
  name: 'Eve',
  email: 'eve@test.com',
  address: { street: '', city: 'X', zip: '12' },
})
showErrors(bad5.$validate())

// --- Valid post ---
console.log()
console.log('   g) Valid post — enum + integer defaults')
const post = schema.create('Post', {
  title: 'Hello World',
  slug: 'hello-world',
  content: 'This is my first post.',
})
show('result', post)
showErrors(post.$validate())

// =============================================================================
// 5. Write generated files to disk
// =============================================================================

console.log()
console.log('5. FILE OUTPUT')
console.log('─'.repeat(60))

const outdir = path.join(__dirname, 'generated')
fs.mkdirSync(outdir, { recursive: true })
fs.writeFileSync(path.join(outdir, 'app.d.ts'), ts)
fs.writeFileSync(path.join(outdir, 'app.sql'), sql)

console.log(`   Written: examples/generated/app.d.ts  (${ts.length} bytes)`)
console.log(`   Written: examples/generated/app.sql   (${sql.length} bytes)`)

// =============================================================================
// Summary
// =============================================================================

console.log()
console.log('═'.repeat(60))
console.log()
console.log('  One schema file. Three outputs. Zero drift.')
console.log()
console.log('  app.schema  ──→  TypeScript interfaces  (emit-types.js)')
console.log('              ──→  SQL DDL tables          (emit-sql.js)')
console.log('              ──→  Runtime validation      (runtime.js)')
console.log()
console.log('═'.repeat(60))
console.log()
