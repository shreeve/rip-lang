// ==============================================================================
// emit-zod.js - Generate Zod schemas from Schema AST
//
// Walks the S-expression AST produced by the schema parser and emits Zod
// schemas with full constraint validation, enums, nested types, and
// Create/Update variants for each model.
//
// Usage:
//   import { generateZod } from '@rip-lang/schema'
//   const zod = generateZod(ast)
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: February 2026
// ==============================================================================

// Schema type → base Zod expression
const zodMap = {
  string:   'z.string()',
  text:     'z.string()',
  integer:  'z.number().int()',
  number:   'z.number()',
  boolean:  'z.boolean()',
  date:     'z.coerce.date()',
  datetime: 'z.coerce.date()',
  email:    'z.string().email()',
  url:      'z.string().url()',
  uuid:     'z.string().uuid()',
  phone:    'z.string()',
  json:     'z.unknown()',
  any:      'z.any()',
}

const numericTypes = new Set(['integer', 'number'])
const stringTypes  = new Set(['string', 'text', 'email', 'url', 'phone', 'uuid'])

// Convert camelCase to snake_case for foreign key naming
function toForeignKey(name) {
  return name[0].toLowerCase() + name.slice(1) + 'Id'
}

// =============================================================================
// Zod type resolution
// =============================================================================

function resolveZodType(type, enums, types) {
  if (Array.isArray(type) && type[0] === 'array') {
    return `z.array(${resolveZodType(type[1], enums, types)})`
  }
  if (zodMap[type]) return zodMap[type]
  if (enums.has(type)) return `${type}Schema`
  if (types.has(type)) return `${type}Schema`
  return 'z.unknown()'
}

// Apply min/max/default constraints to a Zod type string.
// Set skipDefault=true for Update schemas where defaults are meaningless.
function withConstraints(base, type, constraints, skipDefault = false) {
  if (!constraints || !Array.isArray(constraints)) return base

  const baseType = Array.isArray(type) ? type[1] : type
  const hasMinMax = numericTypes.has(baseType) || stringTypes.has(baseType)

  if (constraints.length === 1) {
    return skipDefault ? base : `${base}.default(${JSON.stringify(constraints[0])})`
  }

  if (constraints.length >= 2) {
    if (hasMinMax) {
      base = `${base}.min(${constraints[0]}).max(${constraints[1]})`
    }
    if (constraints.length >= 3 && !skipDefault) {
      base = `${base}.default(${JSON.stringify(constraints[2])})`
    }
  }

  return base
}

// =============================================================================
// Enum emission
// =============================================================================

function emitZodEnum(def) {
  const [, name, values] = def
  let members
  if (Array.isArray(values[0])) {
    members = values.map(([member]) => JSON.stringify(member))
  } else {
    members = values.map(v => JSON.stringify(v))
  }
  return `export const ${name}Schema = z.enum([${members.join(', ')}]);`
}

// =============================================================================
// Type emission (for @type — no id, no timestamps)
// =============================================================================

function emitZodType(def, enums, types) {
  const [, name, , body] = def
  const fields = []
  const indent = '  '

  if (Array.isArray(body)) {
    for (const member of body) {
      if (!Array.isArray(member) || member[0] !== 'field') continue
      const [, fieldName, modifiers, type, constraints] = member
      const optional = modifiers?.includes('?')
      let zod = resolveZodType(type, enums, types)
      zod = withConstraints(zod, type, constraints)
      if (optional) zod += '.optional()'
      fields.push(`${indent}${fieldName}: ${zod},`)
    }
  }

  return `export const ${name}Schema = z.object({\n${fields.join('\n')}\n});`
}

// =============================================================================
// Model emission — full schema + Create + Update variants
// =============================================================================

function hasDefault(field) {
  const constraints = field[4]
  if (!constraints || !Array.isArray(constraints)) return false
  return constraints.length === 1 || constraints.length >= 3
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

function emitZodModel(def, enums, types) {
  const [, name, , body] = def
  const indent = '  '

  // Collect fields for all three variants
  const fullFields = []
  const createFields = []
  const updateFields = []

  // Models get an auto-generated id
  fullFields.push(`${indent}id: z.string().uuid(),`)

  if (Array.isArray(body)) {
    for (const member of body) {
      if (!Array.isArray(member)) continue
      const kind = member[0]

      if (kind === 'field') {
        const [, fieldName, modifiers, type, constraints] = member
        const optional = modifiers?.includes('?')
        const required = modifiers?.includes('!')
        const hasDef = hasDefault(member)
        const zodBase = resolveZodType(type, enums, types)
        const zodFull = withConstraints(zodBase, type, constraints)
        const zodBare = withConstraints(zodBase, type, constraints, true)

        // Full: include defaults, .optional() only for ? fields
        fullFields.push(`${indent}${fieldName}: ${optional ? zodFull + '.optional()' : zodFull},`)

        // Create: .default() handles input optionality; .optional() for the rest
        const needsOptional = optional || (!required && !hasDef)
        createFields.push(`${indent}${fieldName}: ${needsOptional ? zodFull + '.optional()' : zodFull},`)

        // Update: strip defaults, all optional
        updateFields.push(`${indent}${fieldName}: ${zodBare}.optional(),`)

      } else if (kind === 'timestamps') {
        fullFields.push(`${indent}createdAt: z.coerce.date(),`)
        fullFields.push(`${indent}updatedAt: z.coerce.date(),`)

      } else if (kind === 'softDelete') {
        fullFields.push(`${indent}deletedAt: z.coerce.date().optional(),`)

      } else if (kind === 'belongs_to') {
        const [, target, opts] = member
        const fk = toForeignKey(target)
        const isOptional = isRelationOptional(opts)
        const fkZod = isOptional ? 'z.string().uuid().optional()' : 'z.string().uuid()'

        fullFields.push(`${indent}${fk}: ${fkZod},`)
        createFields.push(`${indent}${fk}: ${fkZod},`)
        updateFields.push(`${indent}${fk}: z.string().uuid().optional(),`)
      }
      // has_many/has_one skipped — Zod schemas validate input, not query results
    }
  }

  const lines = []
  lines.push(`export const ${name}Schema = z.object({\n${fullFields.join('\n')}\n});`)
  lines.push(`export const ${name}CreateSchema = z.object({\n${createFields.join('\n')}\n});`)
  lines.push(`export const ${name}UpdateSchema = z.object({\n${updateFields.join('\n')}\n});`)
  return lines.join('\n\n')
}

// =============================================================================
// Type alias emission — z.infer<typeof Schema>
// =============================================================================

function emitTypeAlias(name) {
  return `export type ${name} = z.infer<typeof ${name}Schema>;`
}

// =============================================================================
// Main entry point
// =============================================================================

/**
 * Generate Zod schemas from a schema AST.
 *
 * @param {Array} ast - The S-expression AST from parse()
 * @param {Object} [options] - Generation options
 * @param {boolean} [options.models=true]   - Emit schemas for @model definitions
 * @param {boolean} [options.types=true]    - Emit schemas for @type definitions
 * @param {boolean} [options.enums=true]    - Emit Zod enums
 * @param {boolean} [options.derived=true]  - Emit Create/Update variants for models
 * @param {boolean} [options.infer=true]    - Emit inferred type aliases
 * @param {string}  [options.header]        - Custom header comment
 * @returns {string} Zod schema source
 */
export function generateZod(ast, options = {}) {
  if (!Array.isArray(ast) || ast[0] !== 'schema') {
    throw new Error('Invalid schema AST: expected ["schema", ...]')
  }

  const {
    models: emitModels = true,
    types: emitTypeDefs = true,
    enums: emitEnums = true,
    derived: emitDerived = true,
    infer: emitInfer = true,
    header = '// Generated by @rip-lang/schema — do not edit\n',
  } = options

  // Collect enum and type names for resolution
  const enumNames = new Set()
  const typeNames = new Set()
  for (let i = 1; i < ast.length; i++) {
    if (!Array.isArray(ast[i])) continue
    if (ast[i][0] === 'enum') enumNames.add(ast[i][1])
    if (ast[i][0] === 'type') typeNames.add(ast[i][1])
  }

  const blocks = []
  const typeAliases = []
  if (header) blocks.push(header)
  blocks.push("import { z } from 'zod';\n")

  for (let i = 1; i < ast.length; i++) {
    const def = ast[i]
    if (!Array.isArray(def)) continue

    switch (def[0]) {
      case 'enum':
        if (emitEnums) {
          blocks.push(emitZodEnum(def))
          if (emitInfer) typeAliases.push(emitTypeAlias(def[1]))
        }
        break
      case 'type':
        if (emitTypeDefs) {
          blocks.push(emitZodType(def, enumNames, typeNames))
          if (emitInfer) typeAliases.push(emitTypeAlias(def[1]))
        }
        break
      case 'model':
        if (emitModels) {
          blocks.push(emitZodModel(def, enumNames, typeNames))
          if (emitInfer) {
            typeAliases.push(emitTypeAlias(def[1]))
            if (emitDerived) {
              typeAliases.push(emitTypeAlias(`${def[1]}Create`))
              typeAliases.push(emitTypeAlias(`${def[1]}Update`))
            }
          }
        }
        break
    }
  }

  // Type aliases grouped at the end
  if (typeAliases.length > 0) {
    blocks.push(typeAliases.join('\n'))
  }

  return blocks.join('\n\n') + '\n'
}

export default generateZod
