#!/usr/bin/env bun
// ==============================================================================
// test-generators.js - Test TypeScript and SQL generation from Schema AST
//
// Runs the parser on test schema files, generates TypeScript and SQL output,
// and verifies the output contains expected content.
//
// Usage: bun test/test-generators.js
// ==============================================================================

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { parse } from '../index.js'
import { generateTypes } from '../emit-types.js'
import { generateSQL } from '../emit-sql.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
  } else {
    failed++
    console.error(`  FAIL: ${message}`)
  }
}

function assertContains(output, needle, label) {
  assert(output.includes(needle), `${label}: expected to find "${needle}"`)
}

function assertNotContains(output, needle, label) {
  assert(!output.includes(needle), `${label}: expected NOT to find "${needle}"`)
}

// =============================================================================
// Load and parse test schemas
// =============================================================================

const basicSource = fs.readFileSync(path.join(__dirname, 'basic.schema'), 'utf-8')
const basicAST = parse(basicSource)

const comprehensiveSource = fs.readFileSync(path.join(__dirname, 'comprehensive.schema'), 'utf-8')
const comprehensiveAST = parse(comprehensiveSource)

// =============================================================================
// Test: TypeScript Generation — basic.schema
// =============================================================================

console.log('\nTypeScript Generation (basic.schema)')
console.log('─'.repeat(50))

const basicTS = generateTypes(basicAST)

assertContains(basicTS, 'export enum Role {', 'enum declaration')
assertContains(basicTS, 'admin = "admin"', 'simple enum values')
assertContains(basicTS, 'export enum Status {', 'valued enum declaration')
assertContains(basicTS, 'pending = 0', 'numeric enum value')
assertContains(basicTS, 'export interface Address {', 'type → interface')
assertContains(basicTS, 'street: string;', 'required string field')
assertContains(basicTS, '@minLength 2 @maxLength 2', 'constraints in JSDoc')
assertContains(basicTS, 'export interface User {', 'model → interface')
assertContains(basicTS, 'id: string;', 'auto-generated id')
assertContains(basicTS, 'email: string;', 'email → string')
assertContains(basicTS, '@unique', 'unique modifier in JSDoc')
assertContains(basicTS, 'role: Role;', 'enum type reference')
assertContains(basicTS, '@default "user"', 'default in JSDoc')
assertContains(basicTS, 'active: boolean;', 'boolean field')
assertContains(basicTS, 'address?: Address;', 'optional nested type')
assertContains(basicTS, 'createdAt: Date;', 'timestamps')
assertContains(basicTS, 'updatedAt: Date;', 'timestamps')

// =============================================================================
// Test: TypeScript Generation — comprehensive.schema
// =============================================================================

console.log('\nTypeScript Generation (comprehensive.schema)')
console.log('─'.repeat(50))

const compTS = generateTypes(comprehensiveAST)

assertContains(compTS, 'export enum Priority {', 'string-valued enum')
assertContains(compTS, 'low = "low"', 'string enum value')
assertContains(compTS, 'export interface PersonName {', 'type with multiple fields')
assertContains(compTS, 'middle?: string;', 'optional field')
assertContains(compTS, 'password: string;', 'password field')
assertContains(compTS, 'bio?: string;', 'text → string (optional)')
assertContains(compTS, 'address?: Address;', 'nested type ref')
assertContains(compTS, 'settings: unknown;', 'json → unknown')
assertContains(compTS, 'tags: string[];', 'array type')
assertContains(compTS, 'deletedAt?: Date;', 'softDelete')
assertContains(compTS, 'organizationId?: string;', 'optional belongs_to FK')
assertContains(compTS, 'organization?: Organization;', 'optional belongs_to ref')
assertContains(compTS, 'posts?: Post[];', 'has_many')
assertContains(compTS, 'userId: string;', 'required belongs_to FK')
assertContains(compTS, 'user?: User;', 'belongs_to ref')
assertContains(compTS, 'comments?: Comment[];', 'has_many comments')

// Types should NOT contain widgets, forms, or state
assertNotContains(compTS, 'interface Table', 'widgets not emitted')
assertNotContains(compTS, 'interface UserForm', 'forms not emitted')
assertNotContains(compTS, 'interface AppState', 'state not emitted')

// =============================================================================
// Test: SQL Generation — basic.schema
// =============================================================================

console.log('\nSQL Generation (basic.schema)')
console.log('─'.repeat(50))

const basicSQL = generateSQL(basicAST)

assertContains(basicSQL, "CREATE TYPE role AS ENUM ('admin', 'user', 'guest');", 'enum type')
assertContains(basicSQL, "CREATE TYPE status AS ENUM ('pending', 'active', 'suspended');", 'valued enum')
assertContains(basicSQL, 'CREATE TABLE users (', 'table from model')
assertContains(basicSQL, 'id UUID PRIMARY KEY DEFAULT gen_random_uuid()', 'auto PK')
assertContains(basicSQL, 'name VARCHAR(100) NOT NULL', 'required string with max')
assertContains(basicSQL, 'email VARCHAR NOT NULL UNIQUE', 'required unique')
assertContains(basicSQL, "role role DEFAULT 'user'", 'enum with default')
assertContains(basicSQL, 'active BOOLEAN DEFAULT true', 'boolean with default')
assertContains(basicSQL, 'address JSON', 'nested type as JSON')
assertContains(basicSQL, 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'timestamps')
assertContains(basicSQL, 'CREATE INDEX idx_users_role_active ON users (role, active)', 'composite index')

// @type Address should NOT produce a table
assertNotContains(basicSQL, 'CREATE TABLE address', 'types are not tables')

// =============================================================================
// Test: SQL Generation — comprehensive.schema
// =============================================================================

console.log('\nSQL Generation (comprehensive.schema)')
console.log('─'.repeat(50))

const compSQL = generateSQL(comprehensiveAST)

assertContains(compSQL, 'CREATE TABLE users (', 'users table')
assertContains(compSQL, 'CREATE TABLE posts (', 'posts table')
assertContains(compSQL, 'CREATE TABLE comments (', 'comments table')
assertContains(compSQL, 'password VARCHAR(100) NOT NULL', 'password field')
assertContains(compSQL, 'slug VARCHAR(200) NOT NULL UNIQUE', 'unique slug')
assertContains(compSQL, 'deleted_at TIMESTAMP', 'soft delete column')
assertContains(compSQL, 'organization_id UUID REFERENCES organizations(id)', 'optional FK (no NOT NULL)')
assertContains(compSQL, 'user_id UUID NOT NULL REFERENCES users(id)', 'required FK')
assertContains(compSQL, 'post_id UUID NOT NULL REFERENCES posts(id)', 'post FK')
assertContains(compSQL, 'CREATE UNIQUE INDEX idx_users_email ON users (email)', 'unique index')
assertContains(compSQL, 'CREATE INDEX idx_users_role_status ON users (role, status)', 'composite index')
assertContains(compSQL, 'CREATE UNIQUE INDEX idx_posts_slug ON posts (slug)', 'unique slug index')

// =============================================================================
// Test: SQL with --drop option
// =============================================================================

console.log('\nSQL Generation (with dropFirst)')
console.log('─'.repeat(50))

const dropSQL = generateSQL(basicAST, { dropFirst: true })

assertContains(dropSQL, 'DROP TABLE IF EXISTS users CASCADE;', 'drop table')

// =============================================================================
// Test: Generation options
// =============================================================================

console.log('\nGeneration options')
console.log('─'.repeat(50))

const enumsOnly = generateTypes(basicAST, { models: false, types: false })
assertContains(enumsOnly, 'export enum Role', 'enums-only mode')
assertNotContains(enumsOnly, 'export interface', 'no interfaces in enums-only')

const noHeader = generateTypes(basicAST, { header: '' })
assert(!noHeader.startsWith('//'), 'custom empty header')

// =============================================================================
// Summary
// =============================================================================

console.log('\n' + '═'.repeat(50))
console.log(`Results: ${passed} passed, ${failed} failed`)
console.log('═'.repeat(50))

if (failed > 0) process.exit(1)
