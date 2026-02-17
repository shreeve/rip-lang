// ==============================================================================
// emit-sql.js - Generate SQL DDL from Schema AST
//
// Walks the S-expression AST produced by the schema parser and emits clean
// SQL DDL targeting DuckDB (CREATE TABLE, CREATE INDEX, CREATE TYPE).
//
// Usage:
//   import { generateSQL } from '@rip-lang/schema'
//   const sql = generateSQL(ast)
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: February 2026
// ==============================================================================

// Schema type → SQL type mapping
const sqlTypeMap = {
  string:   'VARCHAR',
  text:     'TEXT',
  integer:  'INTEGER',
  number:   'DOUBLE',
  boolean:  'BOOLEAN',
  date:     'DATE',
  datetime: 'TIMESTAMP',
  email:    'VARCHAR',
  url:      'VARCHAR',
  uuid:     'UUID',
  phone:    'VARCHAR',
  json:     'JSON',
  any:      'JSON',
}

// =============================================================================
// Naming helpers
// =============================================================================

// Convert CamelCase to snake_case
function toSnakeCase(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

// ---------------------------------------------------------------------------
// Pluralization — ported from Rails ActiveSupport::Inflector
// ---------------------------------------------------------------------------

const UNCOUNTABLES = new Set([
  'equipment', 'information', 'rice', 'money', 'species',
  'series', 'fish', 'sheep', 'jeans', 'police', 'data',
  'feedback', 'metadata', 'media', 'aircraft', 'deer',
  'moose', 'offspring', 'shrimp', 'swine', 'trout',
])

const IRREGULARS = new Map([
  ['person',  'people'],
  ['man',     'men'],
  ['woman',   'women'],
  ['child',   'children'],
  ['sex',     'sexes'],
  ['move',    'moves'],
  ['zombie',  'zombies'],
  ['goose',   'geese'],
  ['tooth',   'teeth'],
  ['foot',    'feet'],
  ['mouse',   'mice'],
  ['louse',   'lice'],
  ['ox',      'oxen'],
])

// Plural rules applied in reverse order (last match wins)
const PLURAL_RULES = [
  [/$/, 's'],
  [/s$/i, 's'],
  [/^(ax|test)is$/i, '$1es'],
  [/(octop|vir)us$/i, '$1i'],
  [/(octop|vir)i$/i, '$1i'],
  [/(alias|status)$/i, '$1es'],
  [/(bu)s$/i, '$1ses'],
  [/(buffal|tomat)o$/i, '$1oes'],
  [/([ti])um$/i, '$1a'],
  [/([ti])a$/i, '$1a'],
  [/sis$/i, 'ses'],
  [/(?:([^f])fe|([lr])f)$/i, '$1$2ves'],
  [/(hive)$/i, '$1s'],
  [/([^aeiouy]|qu)y$/i, '$1ies'],
  [/(x|ch|ss|sh)$/i, '$1es'],
  [/(matr|vert|ind)(?:ix|ex)$/i, '$1ices'],
  [/(quiz)$/i, '$1zes'],
]

function pluralize(word) {
  const lower = word.toLowerCase()

  if (UNCOUNTABLES.has(lower)) return lower
  if (IRREGULARS.has(lower)) return IRREGULARS.get(lower)

  // Apply rules in reverse order (last rule wins)
  for (let i = PLURAL_RULES.length - 1; i >= 0; i--) {
    const [regex, replacement] = PLURAL_RULES[i]
    if (regex.test(lower)) {
      return lower.replace(regex, replacement)
    }
  }

  return lower + 's'
}

// ---------------------------------------------------------------------------
// Table and column naming
// ---------------------------------------------------------------------------

// Model name → table name: "User" → "users", "Person" → "people"
// Accepts optional overrides map: { Person: "people", Datum: "data" }
let _tableOverrides = {}

function toTableName(modelName) {
  if (_tableOverrides[modelName]) return _tableOverrides[modelName]
  return pluralize(toSnakeCase(modelName))
}

// Foreign key: "User" → "user_id"
function toForeignKeyCol(name) {
  return toSnakeCase(name) + '_id'
}

// Index name: tableName + fields → "idx_users_role_status"
function toIndexName(tableName, fields) {
  return 'idx_' + tableName + '_' + fields.map(f => toSnakeCase(f)).join('_')
}

// =============================================================================
// Dependency ordering
// =============================================================================

// Topological sort: models that are referenced via belongs_to come first
function topologicalSort(models) {
  const byName = new Map()
  for (const def of models) byName.set(def[1], def)

  const deps = new Map()
  for (const def of models) {
    const name = def[1]
    const body = def[3]
    const refs = []
    if (Array.isArray(body)) {
      for (const member of body) {
        if (Array.isArray(member) && member[0] === 'belongs_to' && byName.has(member[1])) {
          refs.push(member[1])
        }
      }
    }
    deps.set(name, refs)
  }

  const sorted = []
  const visited = new Set()
  const visiting = new Set()

  function visit(name) {
    if (visited.has(name)) return
    if (visiting.has(name)) return // circular ref — break cycle
    visiting.add(name)
    for (const dep of deps.get(name) || []) visit(dep)
    visiting.delete(name)
    visited.add(name)
    sorted.push(byName.get(name))
  }

  for (const def of models) visit(def[1])
  return sorted
}

// =============================================================================
// SQL value formatting
// =============================================================================

function formatSQLDefault(val) {
  if (val === true)  return 'true'
  if (val === false) return 'false'
  if (val === null)  return 'NULL'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
  if (Array.isArray(val)) {
    if (val[0] === 'object') return "'{}'"
    if (val[0] === 'array')  return "'[]'"
  }
  return `'${String(val).replace(/'/g, "''")}'`
}

// =============================================================================
// Column type resolution
// =============================================================================

function resolveSQLType(type, constraints, enums) {
  // Array types → JSON (DuckDB supports JSON arrays natively)
  if (Array.isArray(type) && type[0] === 'array') {
    return 'JSON'
  }

  const base = sqlTypeMap[type]
  if (base) {
    // VARCHAR with max length from constraints
    if ((base === 'VARCHAR') && constraints && constraints.length >= 2) {
      return `VARCHAR(${constraints[1]})`
    }
    return base
  }

  // Enum reference
  if (enums.has(type)) {
    return toSnakeCase(type)
  }

  // Nested type reference → store as JSON
  return 'JSON'
}

// =============================================================================
// Enum emission
// =============================================================================

function emitEnumSQL(def) {
  const [, name, values] = def
  const typeName = toSnakeCase(name)
  let members

  if (Array.isArray(values[0])) {
    // Valued enum: use the member names as SQL enum values
    members = values.map(([member]) => `'${member}'`)
  } else {
    // Simple enum
    members = values.map(v => `'${v}'`)
  }

  return `CREATE TYPE ${typeName} AS ENUM (${members.join(', ')});`
}

// =============================================================================
// Table emission
// =============================================================================

function emitTableSQL(def, enums) {
  const [, name, parent, body] = def
  const tableName = toTableName(name)
  const columns = []
  const indexes = []

  // Auto-generated primary key
  columns.push('  id UUID PRIMARY KEY DEFAULT gen_random_uuid()')

  if (Array.isArray(body)) {
    for (const member of body) {
      if (!Array.isArray(member)) continue
      const kind = member[0]

      if (kind === 'field') {
        const col = emitColumnSQL(member, enums)
        if (col) columns.push(col)

      } else if (kind === 'timestamps') {
        columns.push('  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
        columns.push('  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP')

      } else if (kind === 'softDelete') {
        columns.push('  deleted_at TIMESTAMP')

      } else if (kind === 'belongs_to') {
        const [, target, opts] = member
        const fkCol = toForeignKeyCol(target)
        const refTable = toTableName(target)
        const notNull = isRelationOptional(opts) ? '' : ' NOT NULL'
        columns.push(`  ${fkCol} UUID${notNull} REFERENCES ${refTable}(id)`)

      } else if (kind === 'index') {
        const [, fields, unique] = member
        const sqlFields = fields.map(f => toSnakeCase(f))
        const idxName = toIndexName(tableName, fields)
        const uniqueStr = unique ? 'UNIQUE ' : ''
        indexes.push(`CREATE ${uniqueStr}INDEX ${idxName} ON ${tableName} (${sqlFields.join(', ')});`)
      }
    }
  }

  const lines = [`CREATE TABLE ${tableName} (`]
  lines.push(columns.join(',\n'))
  lines.push(');')

  const result = [lines.join('\n')]
  if (indexes.length > 0) {
    result.push(indexes.join('\n'))
  }

  return result.join('\n\n')
}

function emitColumnSQL(field, enums) {
  const [, name, modifiers, type, fieldConstraints] = field
  const colName = toSnakeCase(name)
  const sqlType = resolveSQLType(type, fieldConstraints, enums)
  const parts = [`  ${colName} ${sqlType}`]

  // NOT NULL for required fields
  if (modifiers?.includes('!')) {
    parts.push('NOT NULL')
  }

  // UNIQUE for # modifier
  if (modifiers?.includes('#')) {
    parts.push('UNIQUE')
  }

  // DEFAULT value
  if (fieldConstraints && fieldConstraints.length === 1) {
    parts.push(`DEFAULT ${formatSQLDefault(fieldConstraints[0])}`)
  } else if (fieldConstraints && fieldConstraints.length >= 3) {
    parts.push(`DEFAULT ${formatSQLDefault(fieldConstraints[2])}`)
  }

  return parts.join(' ')
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
// Links table (universal temporal associations)
// =============================================================================

function hasLinks(models) {
  for (const def of models) {
    const body = def[3]
    if (!Array.isArray(body)) continue
    for (const member of body) {
      if (Array.isArray(member) && member[0] === 'link') return true
    }
  }
  return false
}

function emitLinksTableSQL() {
  const lines = [
    'CREATE TABLE links (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  source_type VARCHAR NOT NULL,',
    '  source_id UUID NOT NULL,',
    '  target_type VARCHAR NOT NULL,',
    '  target_id UUID NOT NULL,',
    '  role VARCHAR NOT NULL,',
    '  when_from TIMESTAMP,',
    '  when_till TIMESTAMP,',
    '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    ');',
    '',
    'CREATE INDEX idx_links_source ON links (source_type, source_id);',
    'CREATE INDEX idx_links_target ON links (target_type, target_id);',
    'CREATE INDEX idx_links_role ON links (role);',
  ]
  return lines.join('\n')
}

// =============================================================================
// Main entry point
// =============================================================================

/**
 * Generate SQL DDL from a schema AST.
 *
 * @param {Array} ast - The S-expression AST from parse()
 * @param {Object} [options] - Generation options
 * @param {boolean} [options.enums=true]       - Emit CREATE TYPE for enums
 * @param {boolean} [options.tables=true]      - Emit CREATE TABLE for models
 * @param {boolean} [options.dropFirst=false]  - Prepend DROP TABLE IF EXISTS
 * @param {Object}  [options.tableNames]       - Override table names: { Person: "people" }
 * @param {string}  [options.header]           - Custom header comment
 * @returns {string} SQL DDL source
 */
export function generateSQL(ast, options = {}) {
  if (!Array.isArray(ast) || ast[0] !== 'schema') {
    throw new Error('Invalid schema AST: expected ["schema", ...]')
  }

  const {
    enums: emitEnums = true,
    tables: emitTables = true,
    dropFirst = false,
    tableNames = {},
    header = '-- Generated by @rip-lang/schema — do not edit\n',
  } = options

  // Set table name overrides for this generation run
  _tableOverrides = tableNames

  // Collect enum names for type resolution
  const enumNames = new Set()
  for (let i = 1; i < ast.length; i++) {
    if (Array.isArray(ast[i]) && ast[i][0] === 'enum') {
      enumNames.add(ast[i][1])
    }
  }

  const blocks = []
  if (header) blocks.push(header)

  // Enums first (tables reference them)
  if (emitEnums) {
    for (let i = 1; i < ast.length; i++) {
      const def = ast[i]
      if (Array.isArray(def) && def[0] === 'enum') {
        blocks.push(emitEnumSQL(def))
      }
    }
  }

  // Tables
  if (emitTables) {
    // Optionally drop existing tables
    if (dropFirst) {
      const drops = []
      for (let i = 1; i < ast.length; i++) {
        const def = ast[i]
        if (Array.isArray(def) && def[0] === 'model') {
          drops.push(`DROP TABLE IF EXISTS ${toTableName(def[1])} CASCADE;`)
        }
      }
      if (drops.length > 0) {
        blocks.push(drops.join('\n'))
      }
    }

    // Collect models and sort by dependency order (referenced tables first)
    const models = []
    for (let i = 1; i < ast.length; i++) {
      const def = ast[i]
      if (Array.isArray(def) && def[0] === 'model') models.push(def)
    }

    const sorted = topologicalSort(models)
    for (const def of sorted) {
      blocks.push(emitTableSQL(def, enumNames))
    }

    // Auto-generate links table if any model uses @link
    if (hasLinks(models)) {
      if (dropFirst) {
        blocks.push('DROP TABLE IF EXISTS links CASCADE;')
      }
      blocks.push(emitLinksTableSQL())
    }
  }

  return blocks.join('\n\n') + '\n'
}

export { toSnakeCase, toTableName, pluralize }
export default generateSQL
