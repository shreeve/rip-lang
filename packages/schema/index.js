// ==============================================================================
// Schema - Rip Schema Language
//
// A unified schema language for types, validation, database models, and UI.
//
// Usage:
//   import { parse, schema, generateTypes, generateSQL } from '@rip-lang/schema'
//
//   const ast = parse(schemaSource)
//   schema.register(ast)
//
//   const ts  = generateTypes(ast)   // TypeScript declarations
//   const sql = generateSQL(ast)     // SQL DDL
//   const user = schema.create('User', { name: 'John' })
//   const errors = user.$validate()
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: January 2026
// ==============================================================================

export { parse, parser, Parser } from './parser.js'
export { SchemaLexer } from './lexer.js'
export { Schema, schema } from './runtime.js'
export { generateTypes } from './emit-types.js'
export { generateSQL } from './emit-sql.js'
