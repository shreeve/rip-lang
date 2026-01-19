/**
 * rip-schema Builder - Flexible Parameter Support
 *
 * Supports both type-based and named parameters for maximum flexibility
 * Type-based params (numbers, arrays) can be in any order
 * Named params (key:value) must come last due to CoffeeScript/JS syntax
 */

import { sql } from 'drizzle-orm'
import {
  type AnySQLiteColumn,
  type SQLiteTableWithColumns,
  blob,
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

// Helper to parse parameters flexibly
type ColumnOptions = {
  size?: number
  precision?: number
  scale?: number
  min?: number
  max?: number
  default?: any
  unsigned?: boolean
  unique?: boolean
  references?: string
  onDelete?: 'cascade' | 'restrict' | 'set null'
  onUpdate?: 'cascade' | 'restrict' | 'set null'
}

// Index definition interface
interface IndexDefinition {
  name: string
  columns: string[]
  unique: boolean
  auto: boolean // true = auto-generated, false = manual
  options?: {
    partial?: string // For partial indexes like: substr(email, 1, 10)
    where?: string // For conditional indexes
  }
}

// Field definition for schema dumping
interface FieldDefinition {
  name: string
  type: string
  required: boolean
  unique: boolean
  options: any
  originalCall: string // The original method call like 'string', 'integer', etc.
}

// Column builder that wraps Drizzle columns
export class ColumnBuilder {
  private columns: Record<string, AnySQLiteColumn> = {}
  private uniqueFields: Set<string> = new Set() // Track fields marked as unique
  private fieldDefinitions: FieldDefinition[] = [] // Track all field definitions for schema dumping

  // Parse field notation: name! means required, name# means unique
  private parseField(name: string): {
    name: string
    required: boolean
    unique: boolean
  } {
    let fieldName = name
    let required = false
    let unique = false

    // Handle combined suffixes first
    if (fieldName.endsWith('!#')) {
      required = true
      unique = true
      fieldName = fieldName.slice(0, -2)
    } else if (fieldName.endsWith('#!')) {
      unique = true
      required = true
      fieldName = fieldName.slice(0, -2)
    } else {
      // Handle individual suffixes
      if (fieldName.endsWith('!')) {
        required = true
        fieldName = fieldName.slice(0, -1)
      }

      if (fieldName.endsWith('#')) {
        unique = true
        fieldName = fieldName.slice(0, -1)
      }
    }

    return {
      name: fieldName,
      required,
      unique,
    }
  }

  // Parse default value from array notation or direct value
  private parseDefault(value: any): any {
    // Handle array notation
    if (Array.isArray(value) && value.length > 0) {
      const val = value[0]
      if (typeof val === 'function') {
        const expr = val()
        // Use sql.raw for SQL expressions
        return sql.raw(expr)
      }
      return val
    }
    // Handle function directly (for named params)
    if (typeof value === 'function') {
      const expr = value()
      return sql.raw(expr)
    }
    return value
  }

  // Parse flexible parameters into options
  // Note: In CoffeeScript/JavaScript, named parameters (key:value) must come last
  private parseParams(...args: any[]): ColumnOptions {
    const options: ColumnOptions = {}

    for (const arg of args) {
      if (arg === null || arg === undefined) continue

      // Named parameters (object) - must be last in actual usage
      if (typeof arg === 'object' && !Array.isArray(arg)) {
        Object.assign(options, arg)
      }
      // Array handling - distinguish between ranges and defaults
      else if (Array.isArray(arg)) {
        // Range array: [min, max] - exactly 2 numbers
        if (
          arg.length === 2 &&
          typeof arg[0] === 'number' &&
          typeof arg[1] === 'number'
        ) {
          options.min = Math.min(arg[0], arg[1])
          options.max = Math.max(arg[0], arg[1])
        }
        // Default value array: [value] or multiple values
        else {
          options.default = this.parseDefault(arg)
        }
      }
      // Number = size/precision (context-dependent)
      else if (typeof arg === 'number') {
        if (!options.size && !options.precision) {
          options.size = arg // First number is size/precision
        } else if (!options.scale) {
          options.scale = arg // Second number is scale (for decimals)
        }
      }
      // Boolean flags
      else if (typeof arg === 'boolean') {
        // Could be used for specific flags in the future
      }
    }

    return options
  }

  // Track field definition for schema dumping
  private trackField(
    fieldName: string,
    type: string,
    isRequired: boolean,
    isUnique: boolean,
    options: any,
    originalCall: string,
  ) {
    this.fieldDefinitions.push({
      name: fieldName,
      type,
      required: isRequired,
      unique: isUnique,
      options,
      originalCall,
    })
  }

  string(fieldName: string, ...args: any[]) {
    const { name, required, unique } = this.parseField(fieldName)
    const options = this.parseParams(...args)

    let column = text(name)
    if (required) column = column.notNull()
    if (options.default !== undefined) {
      column = column.default(options.default)
    }

    // Check for unique from field name syntax OR options
    const isUnique = unique || options.unique
    if (isUnique) {
      column = column.unique()
      // Track unique field for auto-indexing
      this.uniqueFields.add(name)
    }

    // Track field definition for schema dumping
    this.trackField(
      name,
      'string',
      required,
      isUnique || false,
      options,
      'string',
    )

    this.columns[name] = column as any
    return this
  }

  text(fieldName: string, ...args: any[]) {
    const { name, required, unique } = this.parseField(fieldName)
    const options = this.parseParams(...args)

    let column = text(name)
    if (required) column = column.notNull()
    if (options.default !== undefined) {
      column = column.default(options.default)
    }

    // Check for unique from field name syntax OR options
    const isUnique = unique || options.unique
    if (isUnique) {
      column = column.unique()
      // Track unique field for auto-indexing
      this.uniqueFields.add(name)
    }

    this.columns[name] = column as any
    return this
  }

  integer(fieldName: string, ...args: any[]) {
    const { name, required, unique } = this.parseField(fieldName)
    const options = this.parseParams(...args)

    let column = integer(name)
    if (required) column = column.notNull()
    if (options.default !== undefined) {
      column = column.default(options.default)
    }

    // Check for unique from field name syntax OR options
    const isUnique = unique || options.unique
    if (isUnique) {
      column = column.unique()
      // Track unique field for auto-indexing
      this.uniqueFields.add(name)
    }

    // Track field definition for schema dumping
    this.trackField(
      name,
      'integer',
      required,
      isUnique || false,
      options,
      'integer',
    )

    this.columns[name] = column as any
    return this
  }

  bigint(fieldName: string, ...args: any[]) {
    const { name, required } = this.parseField(fieldName)
    const options = this.parseParams(...args)

    let column = integer(name)
    if (required) column = column.notNull()
    if (options.default !== undefined) {
      column = column.default(options.default)
    }

    this.columns[name] = column as any
    return this
  }

  boolean(fieldName: string, ...args: any[]) {
    const { name, required } = this.parseField(fieldName)

    // First check for direct boolean default
    let directDefault: boolean | undefined
    const otherArgs: any[] = []

    for (const arg of args) {
      if (typeof arg === 'boolean') {
        directDefault = arg
      } else {
        otherArgs.push(arg)
      }
    }

    const options = this.parseParams(...otherArgs)

    // SQLite uses integer for boolean
    let column = integer(name)
    if (required) column = column.notNull()

    // Use direct boolean if provided, otherwise check options
    const defaultValue =
      directDefault !== undefined ? directDefault : options.default
    if (defaultValue !== undefined) {
      // Convert boolean to integer
      const defaultVal =
        defaultValue === true ? 1 : defaultValue === false ? 0 : defaultValue
      column = column.default(defaultVal)
    }

    this.columns[name] = column as any
    return this
  }

  decimal(fieldName: string, ...args: any[]) {
    const { name, required } = this.parseField(fieldName)
    const options = this.parseParams(...args)

    // SQLite uses REAL for decimals
    let column = real(name)
    if (required) column = column.notNull()
    if (options.default !== undefined) {
      column = column.default(options.default)
    }

    this.columns[name] = column as any
    return this
  }

  float(fieldName: string, ...args: any[]) {
    // Float implies standard single-precision, no size parameter needed
    return this.decimal(fieldName, ...args)
  }

  double(fieldName: string, ...args: any[]) {
    // Double implies standard double-precision, no size parameter needed
    return this.decimal(fieldName, ...args)
  }

  datetime(fieldName: string, ...args: any[]) {
    const { name, required } = this.parseField(fieldName)
    const options = this.parseParams(...args)

    let column = text(name)
    if (required) column = column.notNull()
    if (options.default !== undefined) {
      column = column.default(options.default)
    }

    this.columns[name] = column as any
    return this
  }

  date(fieldName: string, ...args: any[]) {
    const { name, required } = this.parseField(fieldName)
    const options = this.parseParams(...args)

    let column = text(name)
    if (required) column = column.notNull()
    if (options.default !== undefined) {
      column = column.default(options.default)
    }

    this.columns[name] = column as any
    return this
  }

  time(fieldName: string, ...args: any[]) {
    const { name, required } = this.parseField(fieldName)
    const options = this.parseParams(...args)

    let column = text(name)
    if (required) column = column.notNull()
    if (options.default !== undefined) {
      column = column.default(options.default)
    }

    this.columns[name] = column as any
    return this
  }

  timestamp(fieldName: string, ...args: any[]) {
    const { name, required } = this.parseField(fieldName)
    const options = this.parseParams(...args)

    let column = text(name)
    if (required) column = column.notNull()
    if (options.default !== undefined) {
      column = column.default(options.default)
    }

    this.columns[name] = column as any
    return this
  }

  binary(fieldName: string, ...args: any[]) {
    const { name, required } = this.parseField(fieldName)
    const options = this.parseParams(...args)

    // In SQLite, we use blob for binary data
    let column = blob(name, { mode: 'buffer' })
    if (required) column = column.notNull()

    this.columns[name] = column as any
    return this
  }

  json(fieldName: string, ...args: any[]) {
    const { name, required } = this.parseField(fieldName)
    const options = this.parseParams(...args)

    // SQLite stores JSON as TEXT with JSON functions for validation
    let column = text(name)
    if (required) column = column.notNull()

    // Handle default values - need to stringify objects/arrays
    if (options.default !== undefined) {
      const defaultValue =
        typeof options.default === 'string'
          ? options.default
          : JSON.stringify(options.default)
      column = column.default(defaultValue)
    }

    this.columns[name] = column as any
    return this
  }

  email(fieldName: string, ...args: any[]) {
    return this.string(fieldName, 255, ...args)
  }

  uuid(fieldName: string) {
    const { name, required } = this.parseField(fieldName)

    let column = text(name).default(sql`(lower(hex(randomblob(16))))`)
    if (required) column = column.notNull()

    this.columns[name] = column as any
    return this
  }

  timestamps() {
    this.datetime('created_at!', [() => "datetime('now')"])
    this.datetime('updated_at!', [() => "datetime('now')"])
    return this
  }

  // Relationships (for now just create the foreign key column)
  belongs_to(name: string, options?: { foreign_key?: string }) {
    const foreignKey = options?.foreign_key || `${name}_id`
    this.bigint(`${foreignKey}!`)
    return this
  }

  // Get the columns
  getColumns() {
    return this.columns
  }

  // Get unique fields (for TableBuilder access)
  getUniqueFields(): Set<string> {
    return this.uniqueFields
  }

  // Get all field definitions for schema dumping
  getFieldDefinitions(): FieldDefinition[] {
    return this.fieldDefinitions
  }

  // Special method to add primary key with auto-increment
  addPrimaryKey(name: string, autoIncrement = true) {
    const column = integer(name).primaryKey({ autoIncrement })
    this.columns[name] = column as any
    return this
  }
}

// Table builder that uses the column builder
export class TableBuilder {
  private builder = new ColumnBuilder()
  public tableName: string
  private indexes: IndexDefinition[] = [] // Track all indexes for this table

  constructor(tableName: string, options?: any) {
    this.tableName = tableName

    // Handle primary key
    const pk = options?.primary_key || 'id'
    const idType = options?.id ?? 'integer'

    if (idType !== false) {
      if (idType === 'uuid') {
        this.builder.uuid(pk)
      } else {
        this.builder.addPrimaryKey(pk, true)
      }
    }

    // Auto-add timestamps if requested
    if (options?.timestamps !== false) {
      // We'll add these after user columns
    }
  }

  // Delegate all column methods to the builder
  string = this.builder.string.bind(this.builder)
  text = this.builder.text.bind(this.builder)
  integer = this.builder.integer.bind(this.builder)
  bigint = this.builder.bigint.bind(this.builder)
  boolean = this.builder.boolean.bind(this.builder)
  decimal = this.builder.decimal.bind(this.builder)
  float = this.builder.float.bind(this.builder)
  double = this.builder.double.bind(this.builder)
  datetime = this.builder.datetime.bind(this.builder)
  date = this.builder.date.bind(this.builder)
  time = this.builder.time.bind(this.builder)
  timestamp = this.builder.timestamp.bind(this.builder)
  binary = this.builder.binary.bind(this.builder)
  json = this.builder.json.bind(this.builder)
  email = this.builder.email.bind(this.builder)
  uuid = this.builder.uuid.bind(this.builder)
  timestamps = this.builder.timestamps.bind(this.builder)
  belongs_to = this.builder.belongs_to.bind(this.builder)

  // Index methods - enhanced to handle auto-indexing logic
  index(...args: any[]) {
    if (args.length === 0) return this

    // Parse index arguments
    const columns: string[] = []
    let options: any = {}
    let indexName: string | undefined

    for (const arg of args) {
      if (typeof arg === 'string') {
        columns.push(arg)
      } else if (Array.isArray(arg)) {
        columns.push(...arg)
      } else if (typeof arg === 'object') {
        options = { ...options, ...arg }
      }
    }

    if (columns.length === 0) return this

    // Generate index name if not provided
    if (!indexName) {
      const suffix = options.unique ? 'unique' : 'idx'
      indexName = `${this.tableName}_${columns.join('_')}_${suffix}`
    }

    // Check if this is a single-column unique index on a field that's already unique
    if (columns.length === 1 && options.unique) {
      const columnName = columns[0]
      const uniqueFields = this.builder.getUniqueFields()

      if (uniqueFields.has(columnName)) {
        // Field is already unique - this is explicit documentation (good practice!)
        if (!options.partial && !options.where) {
          // This is just explicit documentation of the auto-generated index
          // Allow it silently - explicit is better than implicit
          console.log(
            `✅ Explicit unique index on '${columnName}' (matches auto-generated)`,
          )
        }
      }
    }

    // Store the index definition
    const indexDef: IndexDefinition = {
      name: indexName,
      columns,
      unique: Boolean(options.unique),
      auto: false, // This is a manual index
      options: {
        partial: options.partial,
        where: options.where,
      },
    }

    this.indexes.push(indexDef)
    return this
  }

  soft_delete() {
    this.datetime('deleted_at')
    return this
  }

  // Generate auto-indexes for unique fields
  private generateAutoIndexes() {
    const uniqueFields = this.builder.getUniqueFields()

    for (const fieldName of uniqueFields) {
      // Check if there's already a manual index for this field (any type)
      const hasManualIndex = this.indexes.some(
        idx => idx.columns.length === 1 && idx.columns[0] === fieldName,
      )

      if (!hasManualIndex) {
        // Auto-generate unique index only if no manual index exists
        const indexDef: IndexDefinition = {
          name: `${this.tableName}_${fieldName}_unique`,
          columns: [fieldName],
          unique: true,
          auto: true, // This is an auto-generated index
        }

        this.indexes.push(indexDef)
      }
    }
  }

  // Get all indexes (manual + auto-generated)
  getIndexes(): IndexDefinition[] {
    this.generateAutoIndexes()
    return this.indexes
  }

  // Dump complete schema with beautiful schemazing.rb-style alignment
  dumpSchema(): string {
    this.generateAutoIndexes() // Ensure auto-indexes are generated

    const lines: string[] = []
    lines.push(`@table '${this.tableName}', ->`)

    // Get field definitions with canonical field#! ordering
    const fieldDefinitions = this.builder.getFieldDefinitions()

    if (fieldDefinitions.length > 0) {
      // Build field lines first
      const fieldLines: string[] = []

      for (const field of fieldDefinitions) {
        // Create canonical field name with #! ordering (unique first, then required)
        let canonicalName = field.name
        if (field.unique && field.required) {
          canonicalName = `${field.name}#!`
        } else if (field.unique) {
          canonicalName = `${field.name}#`
        } else if (field.required) {
          canonicalName = `${field.name}!`
        }

        // Build the method call part
        const methodCall = `  @${field.originalCall}`
        const fieldNamePart = `'${canonicalName}'`

        // Build options part
        const optionParts: string[] = []

        // Add size/precision options
        if (field.options.size && field.originalCall === 'string') {
          optionParts.push(field.options.size.toString())
        }
        if (field.options.precision && field.options.scale) {
          optionParts.push(
            `[${field.options.precision}, ${field.options.scale}]`,
          )
        }

        // Add default value
        if (field.options.default !== undefined) {
          if (typeof field.options.default === 'string') {
            optionParts.push(`["${field.options.default}"]`)
          } else if (
            typeof field.options.default === 'boolean' &&
            !field.required
          ) {
            // Only show boolean defaults if not required (required booleans default to false automatically)
            optionParts.push(`[${field.options.default}]`)
          } else if (typeof field.options.default === 'number') {
            optionParts.push(`[${field.options.default}]`)
          }
        }

        // Build complete field line
        let fieldLine = `${methodCall} ${fieldNamePart}`
        if (optionParts.length > 0) {
          fieldLine += `, ${optionParts.join(', ')}`
        }

        fieldLines.push(fieldLine)
      }

      // ✨ PHASE 1: Find column widths (simplified - no number alignment complexity)
      let methodCallMaxWidth = 0
      let fieldNameMaxWidth = 0

      // Parse all lines to find maximum widths
      const parsedLines = fieldLines.map(line => {
        const parts = line.split(', ')
        const beforeCommaPart = parts[0]
        const afterCommaParts = parts.slice(1)

        const methodCallMatch = beforeCommaPart.match(/^(\s*@\w+)\s+(.+)$/)
        if (methodCallMatch) {
          const methodCall = methodCallMatch[1]
          const fieldNamePart = methodCallMatch[2]

          methodCallMaxWidth = Math.max(methodCallMaxWidth, methodCall.length)
          fieldNameMaxWidth = Math.max(fieldNameMaxWidth, fieldNamePart.length)

          return {
            methodCall,
            fieldNamePart,
            afterCommaParts,
            original: line,
          }
        }

        return { original: line }
      })

      // ✨ PHASE 2: Apply perfect alignment
      const alignedFieldLines = parsedLines.map(parsed => {
        if (!parsed.methodCall) return parsed.original

        // Align method call with exactly 1 space after
        const alignedMethodCall = parsed.methodCall.padEnd(methodCallMaxWidth)

        if (parsed.afterCommaParts.length > 0) {
          // Perfect comma wall: field name padded to max width, comma right after, one space after comma
          const alignedFieldName =
            parsed.fieldNamePart.padEnd(fieldNameMaxWidth)
          const options = parsed.afterCommaParts
            .map(option => option.trim())
            .join(', ')

          return `${alignedMethodCall} ${alignedFieldName}, ${options}`
        }
        // No comma for fields without options - don't pad field name
        return `${alignedMethodCall} ${parsed.fieldNamePart}`
      })

      lines.push(...alignedFieldLines)
    }

    // Add spacer line before indexes (like schemazing.rb)
    if (this.indexes.length > 0) {
      lines.push('')

      // Build index lines
      const indexLines: string[] = []

      for (const index of this.indexes) {
        const autoComment = index.auto
          ? '  # Auto-generated from unique field'
          : ''
        const partialOption = index.options?.partial
          ? `, partial: '${index.options.partial}'`
          : ''
        const whereOption = index.options?.where
          ? `, where: '${index.options.where}'`
          : ''

        let indexLine: string
        if (index.columns.length === 1) {
          // Use # suffix for unique indexes (consistent with field syntax)
          const columnName = index.unique
            ? `${index.columns[0]}#`
            : index.columns[0]
          indexLine = `  @index '${columnName}'${partialOption}${whereOption}${autoComment}`
        } else {
          // For multi-column indexes, still use unique: true since # suffix doesn't make sense for arrays
          const uniqueFlag = index.unique ? ', unique: true' : ''
          indexLine = `  @index [${index.columns.map(c => `'${c}'`).join(', ')}]${uniqueFlag}${partialOption}${whereOption}${autoComment}`
        }

        indexLines.push(indexLine)
      }

      // Apply same perfect alignment to index lines
      let indexMethodMaxWidth = 0
      let indexFieldMaxWidth = 0

      // Parse index lines to find maximum widths
      const parsedIndexLines = indexLines.map(line => {
        const parts = line.split(', ')
        const beforeCommaPart = parts[0]
        const afterCommaParts = parts.slice(1)

        const methodCallMatch = beforeCommaPart.match(/^(\s*@\w+)\s+(.+)$/)
        if (methodCallMatch) {
          const methodCall = methodCallMatch[1]
          const fieldNamePart = methodCallMatch[2]

          indexMethodMaxWidth = Math.max(indexMethodMaxWidth, methodCall.length)
          indexFieldMaxWidth = Math.max(
            indexFieldMaxWidth,
            fieldNamePart.length,
          )

          return {
            methodCall,
            fieldNamePart,
            afterCommaParts,
            original: line,
          }
        }

        return { original: line }
      })

      const alignedIndexLines = parsedIndexLines.map(parsed => {
        if (!parsed.methodCall) return parsed.original

        // Align method call with exactly 1 space after
        const alignedMethodCall = parsed.methodCall.padEnd(indexMethodMaxWidth)

        // Align field name
        const alignedFieldName = parsed.fieldNamePart.padEnd(indexFieldMaxWidth)

        if (parsed.afterCommaParts.length > 0) {
          return `${alignedMethodCall} ${alignedFieldName},${parsed.afterCommaParts.join(', ')}`
        }
        return `${alignedMethodCall} ${alignedFieldName}`
      })

      lines.push(...alignedIndexLines)
    }

    return lines.join('\n')
  }

  // Build the actual Drizzle table
  build(): SQLiteTableWithColumns<any> {
    const columns = this.builder.getColumns()
    return sqliteTable(this.tableName, columns as any)
  }
}

// Main schema function
export function schema(callback: (this: any) => void) {
  const tables: Record<string, SQLiteTableWithColumns<any>> = {}

  const context = {
    table(name: string, ...args: any[]) {
      let options: any = {}
      let builderFn: Function | undefined

      // Parse arguments
      for (const arg of args) {
        if (typeof arg === 'function') {
          builderFn = arg
        } else if (typeof arg === 'object') {
          options = arg
        }
      }

      if (!builderFn) {
        throw new Error(`No builder function provided for table ${name}`)
      }

      const tableBuilder = new TableBuilder(name, options)
      builderFn.call(tableBuilder)

      // Add timestamps if not disabled
      if (
        options?.timestamps !== false &&
        tableBuilder.tableName !== 'migrations'
      ) {
        tableBuilder.timestamps()
      }

      const table = tableBuilder.build()
      tables[name] = table
    },
  }

  callback.call(context)
  return tables
}

// Re-export types (removed InferInsertModel, InferSelectModel as they're not in sqlite-core)
