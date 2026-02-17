// ==============================================================================
// emit-types.js - Generate TypeScript declarations from Schema AST
//
// Walks the S-expression AST produced by the schema parser and emits clean
// TypeScript interfaces, enums, and type declarations.
//
// Usage:
//   import { generateTypes } from '@rip-lang/schema'
//   const ts = generateTypes(ast)
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: February 2026
// ==============================================================================

// Schema type → TypeScript type
const typeMap = {
  string:   'string',
  text:     'string',
  integer:  'number',
  number:   'number',
  boolean:  'boolean',
  date:     'Date',
  datetime: 'Date',
  email:    'string',
  url:      'string',
  uuid:     'string',
  phone:    'string',
  json:     'unknown',
  any:      'any',
}

const numericTypes = new Set(['integer', 'number'])

// Convert an S-expression value back to a readable form for JSDoc
function formatDefault(val) {
  if (Array.isArray(val)) {
    if (val[0] === 'object') return '{}'
    if (val[0] === 'array')  return '[]'
  }
  return JSON.stringify(val)
}

// Convert camelCase to snake_case for foreign key naming
function toForeignKey(name) {
  return name[0].toLowerCase() + name.slice(1) + 'Id'
}

// =============================================================================
// JSDoc generation for constraints and metadata
// =============================================================================

function buildJSDoc(field) {
  const tags = []
  const [, , modifiers, type, constraints] = field
  const baseType = Array.isArray(type) ? type[1] : type
  const isNumeric = numericTypes.has(baseType)

  if (modifiers?.includes('#')) {
    tags.push('@unique')
  }

  if (constraints && Array.isArray(constraints)) {
    if (constraints.length === 1) {
      // Single value = default
      tags.push(`@default ${formatDefault(constraints[0])}`)
    } else if (constraints.length >= 2) {
      // Two+ values = min, max [, default]
      if (isNumeric) {
        tags.push(`@minimum ${constraints[0]}`)
        tags.push(`@maximum ${constraints[1]}`)
      } else {
        tags.push(`@minLength ${constraints[0]}`)
        tags.push(`@maxLength ${constraints[1]}`)
      }
      if (constraints.length >= 3) {
        tags.push(`@default ${formatDefault(constraints[2])}`)
      }
    }
  }

  if (tags.length === 0) return null
  return `/** ${tags.join(' ')} */`
}

// =============================================================================
// Field emission
// =============================================================================

function emitField(field, indent, enums) {
  const [, name, modifiers, type, constraints] = field
  const optional = modifiers?.includes('?')
  const tsType = resolveType(type, enums)
  const jsdoc = buildJSDoc(field)
  const optMark = optional ? '?' : ''
  const line = `${indent}${name}${optMark}: ${tsType};`
  return jsdoc ? `${indent}${jsdoc}\n${line}` : line
}

function resolveType(type, enums) {
  if (Array.isArray(type) && type[0] === 'array') {
    return `${resolveType(type[1], enums)}[]`
  }
  if (typeMap[type]) return typeMap[type]
  // References to enums and other types pass through as-is
  return type
}

// =============================================================================
// Enum emission
// =============================================================================

function emitEnum(def) {
  const [, name, values] = def
  const lines = [`export enum ${name} {`]

  if (Array.isArray(values[0])) {
    // Valued enum: [["pending", 0], ["active", 1]]
    for (const [member, value] of values) {
      lines.push(`  ${member} = ${JSON.stringify(value)},`)
    }
  } else {
    // Simple enum: ["admin", "user", "guest"]
    for (const member of values) {
      lines.push(`  ${member} = ${JSON.stringify(member)},`)
    }
  }

  lines.push('}')
  return lines.join('\n')
}

// =============================================================================
// Interface emission (for @type and @model)
// =============================================================================

function emitInterface(def, enums, isModel) {
  const [, name, parent, body] = def
  const ext = parent ? ` extends ${parent}` : ''
  const lines = [`export interface ${name}${ext} {`]
  const indent = '  '

  // Models get an auto-generated id field
  if (isModel) {
    lines.push(`${indent}id: string;`)
  }

  if (Array.isArray(body)) {
    for (const member of body) {
      if (!Array.isArray(member)) continue
      const kind = member[0]

      if (kind === 'field') {
        lines.push(emitField(member, indent, enums))

      } else if (kind === 'timestamps') {
        lines.push(`${indent}createdAt: Date;`)
        lines.push(`${indent}updatedAt: Date;`)

      } else if (kind === 'softDelete') {
        lines.push(`${indent}deletedAt?: Date;`)

      } else if (kind === 'belongs_to') {
        const [, target, opts] = member
        const fk = toForeignKey(target)
        const isOptional = isRelationOptional(opts)
        lines.push(`${indent}${fk}${isOptional ? '?' : ''}: string;`)
        lines.push(`${indent}${target.toLowerCase()}?: ${target};`)

      } else if (kind === 'has_many') {
        const [, target] = member
        const plural = target.toLowerCase() + 's'
        lines.push(`${indent}${plural}?: ${target}[];`)

      } else if (kind === 'has_one') {
        const [, target] = member
        lines.push(`${indent}${target.toLowerCase()}?: ${target};`)
      }
    }
  }

  lines.push('}')
  return lines.join('\n')
}

// =============================================================================
// Derived type emission — Create and Update variants for @model
// =============================================================================

function hasDefault(field) {
  const constraints = field[4]
  if (!constraints || !Array.isArray(constraints)) return false
  // Single value = default; three values = min, max, default
  return constraints.length === 1 || constraints.length >= 3
}

function emitCreateInterface(def, enums) {
  const [, name, , body] = def
  const lines = [`export interface ${name}Create {`]
  const indent = '  '

  if (!Array.isArray(body)) { lines.push('}'); return lines.join('\n') }

  for (const member of body) {
    if (!Array.isArray(member)) continue
    const kind = member[0]

    if (kind === 'field') {
      const [, fieldName, modifiers, type, constraints] = member
      const tsType = resolveType(type, enums)
      const required = modifiers?.includes('!')
      const optional = !required || hasDefault(member)
      const jsdoc = buildJSDoc(member)
      const optMark = optional ? '?' : ''
      const line = `${indent}${fieldName}${optMark}: ${tsType};`
      lines.push(jsdoc ? `${indent}${jsdoc}\n${line}` : line)

    } else if (kind === 'belongs_to') {
      const [, target, opts] = member
      const fk = toForeignKey(target)
      const isOptional = isRelationOptional(opts)
      lines.push(`${indent}${fk}${isOptional ? '?' : ''}: string;`)
    }
    // Skip: id, timestamps, softDelete, has_many, has_one
  }

  lines.push('}')
  return lines.join('\n')
}

function emitUpdateInterface(def, enums) {
  const [, name, , body] = def
  const lines = [`export interface ${name}Update {`]
  const indent = '  '

  if (!Array.isArray(body)) { lines.push('}'); return lines.join('\n') }

  for (const member of body) {
    if (!Array.isArray(member)) continue
    const kind = member[0]

    if (kind === 'field') {
      const [, fieldName, , type] = member
      const tsType = resolveType(type, enums)
      lines.push(`${indent}${fieldName}?: ${tsType};`)

    } else if (kind === 'belongs_to') {
      const [, target] = member
      const fk = toForeignKey(target)
      lines.push(`${indent}${fk}?: string;`)
    }
    // Skip: id, timestamps, softDelete, has_many, has_one
  }

  lines.push('}')
  return lines.join('\n')
}

function isRelationOptional(opts) {
  if (!Array.isArray(opts) || opts[0] !== 'object') return false
  for (let i = 1; i < opts.length; i++) {
    if (Array.isArray(opts[i]) && opts[i][0] === 'optional' && opts[i][1] === true) {
      return true
    }
  }
  return false
}

// =============================================================================
// Main entry point
// =============================================================================

/**
 * Generate TypeScript declarations from a schema AST.
 *
 * @param {Array} ast - The S-expression AST from parse()
 * @param {Object} [options] - Generation options
 * @param {boolean} [options.models=true]   - Emit interfaces for @model definitions
 * @param {boolean} [options.types=true]    - Emit interfaces for @type definitions
 * @param {boolean} [options.enums=true]    - Emit TypeScript enums
 * @param {boolean} [options.derived=true]  - Emit Create/Update variants for models
 * @param {string}  [options.header]        - Custom header comment
 * @returns {string} TypeScript declaration source
 */
export function generateTypes(ast, options = {}) {
  if (!Array.isArray(ast) || ast[0] !== 'schema') {
    throw new Error('Invalid schema AST: expected ["schema", ...]')
  }

  const {
    models: emitModels = true,
    types: emitTypeDefs = true,
    enums: emitEnums = true,
    derived: emitDerived = true,
    header = '// Generated by @rip-lang/schema — do not edit\n',
  } = options

  // Collect enum names for type resolution
  const enumNames = new Set()
  for (let i = 1; i < ast.length; i++) {
    if (Array.isArray(ast[i]) && ast[i][0] === 'enum') {
      enumNames.add(ast[i][1])
    }
  }

  const blocks = []
  if (header) blocks.push(header)

  for (let i = 1; i < ast.length; i++) {
    const def = ast[i]
    if (!Array.isArray(def)) continue

    switch (def[0]) {
      case 'enum':
        if (emitEnums) blocks.push(emitEnum(def))
        break
      case 'type':
        if (emitTypeDefs) blocks.push(emitInterface(def, enumNames, false))
        break
      case 'model':
        if (emitModels) blocks.push(emitInterface(def, enumNames, true))
        if (emitModels && emitDerived) {
          blocks.push(emitCreateInterface(def, enumNames))
          blocks.push(emitUpdateInterface(def, enumNames))
        }
        break
    }
  }

  // Auto-generate Link interface if any model uses @link
  if (hasLinks(ast)) {
    blocks.push(emitLinkInterface())
  }

  return blocks.join('\n\n') + '\n'
}

function hasLinks(ast) {
  for (let i = 1; i < ast.length; i++) {
    const def = ast[i]
    if (!Array.isArray(def) || def[0] !== 'model') continue
    const body = def[3]
    if (!Array.isArray(body)) continue
    for (const member of body) {
      if (Array.isArray(member) && member[0] === 'link') return true
    }
  }
  return false
}

function emitLinkInterface() {
  return [
    'export interface Link {',
    '  id: string;',
    '  sourceType: string;',
    '  sourceId: string;',
    '  targetType: string;',
    '  targetId: string;',
    '  role: string;',
    '  whenFrom?: Date;',
    '  whenTill?: Date;',
    '  createdAt: Date;',
    '}',
  ].join('\n')
}

export default generateTypes
