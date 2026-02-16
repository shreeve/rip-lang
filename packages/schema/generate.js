#!/usr/bin/env bun
// ==============================================================================
// generate.js - CLI for Rip Schema code generation
//
// Reads .schema files and generates TypeScript types and SQL DDL.
//
// Usage:
//   bun packages/schema/generate.js app.schema
//   bun packages/schema/generate.js app.schema --types
//   bun packages/schema/generate.js app.schema --sql
//   bun packages/schema/generate.js app.schema --outdir ./generated
//   bun packages/schema/generate.js app.schema --drop  (prepend DROP TABLE)
//   bun packages/schema/generate.js app.schema --stdout (print to stdout)
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: February 2026
// ==============================================================================

import * as fs from 'fs'
import * as path from 'path'
import { parse } from './index.js'
import { generateTypes } from './emit-types.js'
import { generateSQL } from './emit-sql.js'

// =============================================================================
// Parse CLI arguments
// =============================================================================

const rawArgs = process.argv.slice(2)
const flags = new Set()
const files = []
let outdir = null

for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i]
  if (a === '--outdir' && i + 1 < rawArgs.length) {
    outdir = rawArgs[++i]
  } else if (a.startsWith('--')) {
    flags.add(a.slice(2))
  } else {
    files.push(a)
  }
}

if (files.length === 0 || flags.has('help')) {
  console.log(`
Rip Schema Generator

Usage: rip-schema <schema-file> [options]

Options:
  --types     Generate TypeScript declarations only
  --sql       Generate SQL DDL only
  --stdout    Print to stdout instead of writing files
  --outdir    Output directory (default: same as input file)
  --drop      Prepend DROP TABLE IF EXISTS (SQL only)
  --help      Show this help message

Examples:
  rip-schema app.schema                  Generate .d.ts and .sql files
  rip-schema app.schema --types          Generate .d.ts only
  rip-schema app.schema --sql --drop     Generate .sql with DROP statements
  rip-schema app.schema --stdout         Print all output to stdout
`.trim())
  process.exit(flags.has('help') ? 0 : 1)
}

// =============================================================================
// Determine what to generate
// =============================================================================

const wantTypes = flags.has('types') || (!flags.has('types') && !flags.has('sql'))
const wantSQL   = flags.has('sql')   || (!flags.has('types') && !flags.has('sql'))
const toStdout  = flags.has('stdout')
const dropFirst = flags.has('drop')

// =============================================================================
// Process each schema file
// =============================================================================

for (const file of files) {
  const schemaPath = path.resolve(file)
  if (!fs.existsSync(schemaPath)) {
    console.error(`Error: File not found: ${file}`)
    process.exit(1)
  }

  const source = fs.readFileSync(schemaPath, 'utf-8')
  const basename = path.basename(file)
  const dir = outdir ? path.resolve(outdir) : path.dirname(schemaPath)

  let ast
  try {
    ast = parse(source)
  } catch (err) {
    console.error(`Error parsing ${file}: ${err.message}`)
    if (err.hash) {
      console.error(`  Line: ${err.hash.line + 1}`)
      console.error(`  Token: ${err.hash.token}`)
      console.error(`  Expected: ${err.hash.expected?.join(', ')}`)
    }
    process.exit(1)
  }

  // Generate TypeScript
  if (wantTypes) {
    const ts = generateTypes(ast)
    if (toStdout) {
      console.log(ts)
    } else {
      const outPath = path.join(dir, basename.replace(/\.schema$/, '.d.ts'))
      if (outdir) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(outPath, ts)
      console.log(`  types → ${path.relative(process.cwd(), outPath)}`)
    }
  }

  // Generate SQL
  if (wantSQL) {
    const sql = generateSQL(ast, { dropFirst })
    if (toStdout) {
      console.log(sql)
    } else {
      const outPath = path.join(dir, basename.replace(/\.schema$/, '.sql'))
      if (outdir) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(outPath, sql)
      console.log(`  sql   → ${path.relative(process.cwd(), outPath)}`)
    }
  }
}
