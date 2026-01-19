/**
 * rip-schema - ActiveRecord-inspired schema DSL for Bun
 *
 * A beautiful schema DSL that brings the elegance of Rails to the Bun ecosystem
 */

// Export the schema builder
export * from './builder'

// Re-export key functions for convenience
export { schema, TableBuilder } from './builder'

// Version
export const version = '0.2.0'
