// ==============================================================================
// @rip-lang/schema — Unified schema language
//
// One definition → TypeScript types + SQL DDL + runtime validation + ORM models
//
// Code generation:
//   import { Schema } from '@rip-lang/schema'
//   const schema = Schema.load('app.schema')
//   const ts  = schema.toTypes()
//   const sql = schema.toSQL()
//
// ORM (with database):
//   import { Schema } from '@rip-lang/schema/orm'
//   const schema = Schema.load('app.schema')
//   schema.connect('http://localhost:4213')
//   const User = schema.model('User', { ... })
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: January 2026
// ==============================================================================

export { parse, parser, Parser } from './parser.js'
export { SchemaLexer } from './lexer.js'
export { Schema } from './runtime.js'
export { generateTypes } from './emit-types.js'
export { generateSQL } from './emit-sql.js'
export { generateZod } from './emit-zod.js'
