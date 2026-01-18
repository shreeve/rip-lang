// ==============================================================================
// Schema - Rip Schema Language
//
// A unified schema language for types, validation, database models, and UI.
//
// Usage:
//   import { parse, Schema } from './schema'
//
//   const ast = parse(schemaSource)
//   const schema = new Schema()
//   schema.register(ast)
//
//   const user = schema.create('User', { name: 'John' })
//   const errors = user.$validate()
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: January 2026
// ==============================================================================

export { parse, parser, Parser } from './parser.js'
export { SchemaLexer } from './lexer.js'
export { Schema, schema } from './runtime.js'
