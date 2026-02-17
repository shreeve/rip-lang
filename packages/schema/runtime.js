// ==============================================================================
// Schema Runtime - Lightweight validation and model factory
//
// Design principles:
// - Plain objects (no Proxy overhead)
// - Compiled validators (fast execution)
// - Validate on demand (not on every set)
// - Zero dependencies
//
// Author: Steve Shreeve <steve.shreeve@gmail.com>
//   Date: January 2026
// ==============================================================================

import { readFileSync } from 'fs'
import { parse } from './parser.js'
import { generateSQL } from './emit-sql.js'
import { generateTypes } from './emit-types.js'
import { generateZod } from './emit-zod.js'

// =============================================================================
// Built-in Type Validators
// =============================================================================

const Types = {
  // Primitives
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && !Number.isNaN(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  date: (v) => v instanceof Date && !Number.isNaN(v.getTime()),
  datetime: (v) => v instanceof Date && !Number.isNaN(v.getTime()),

  // String formats
  email: (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  url: (v) => typeof v === 'string' && /^https?:\/\/.+/.test(v),
  uuid: (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  phone: (v) => typeof v === 'string' && /^[\d\s\-+()]+$/.test(v),

  // Special
  text: (v) => typeof v === 'string',
  json: (v) => v !== undefined,
  any: () => true,
}

// Constraint validators
const Constraints = {
  min: (v, min, type) => {
    if (type === 'string' || type === 'text') return v.length >= min
    if (type === 'number' || type === 'integer') return v >= min
    if (Array.isArray(v)) return v.length >= min
    return true
  },
  max: (v, max, type) => {
    if (type === 'string' || type === 'text') return v.length <= max
    if (type === 'number' || type === 'integer') return v <= max
    if (Array.isArray(v)) return v.length <= max
    return true
  },
  pattern: (v, pattern) => {
    if (typeof v !== 'string') return false
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    return regex.test(v)
  },
}

// =============================================================================
// Schema Registry
// =============================================================================

export class Schema {
  constructor(source) {
    this.types = new Map()      // @type definitions
    this.models = new Map()     // @model definitions
    this.enums = new Map()      // @enum definitions
    this.validators = new Map() // Compiled validators per model
    this._ast = null            // Raw AST (retained for code generation)

    if (source) this.register(parse(source))
  }

  // ---------------------------------------------------------------------------
  // Factory
  // ---------------------------------------------------------------------------

  static load(path, base) {
    if (base) path = new URL(path, base)
    return new Schema(readFileSync(path, 'utf-8'))
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Register schema definitions from parsed AST
   */
  register(ast) {
    if (!Array.isArray(ast) || ast[0] !== 'schema') {
      throw new Error('Invalid schema AST')
    }

    this._ast = ast

    for (let i = 1; i < ast.length; i++) {
      const def = ast[i]
      if (!Array.isArray(def)) continue

      switch (def[0]) {
        case 'enum':
          this._registerEnum(def)
          break
        case 'type':
          this._registerType(def)
          break
        case 'model':
          this._registerModel(def)
          break
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Code generation convenience methods
  // ---------------------------------------------------------------------------

  toSQL() {
    return generateSQL(this._ast)
  }

  toTypes() {
    return generateTypes(this._ast)
  }

  toZod() {
    return generateZod(this._ast)
  }

  _registerEnum(def) {
    // ["enum", name, values]
    // Simple: ["admin", "user", "guest"]
    // Valued: [["pending", 0], ["active", 1]]
    const [, name, values] = def
    const members = Array.isArray(values[0])
      ? values.map(v => v[0])   // Extract member names from valued enums
      : values
    this.enums.set(name, new Set(members))
  }

  _registerType(def) {
    // ["type", name, parent, body]
    const [, name, parent, body] = def
    const fields = this._parseFields(body)
    this.types.set(name, { name, parent, fields, directives: {} })

    // Pre-compile validator for this type
    this._compileValidator(name, 'type')
  }

  _registerModel(def) {
    // ["model", name, parent, body]
    const [, name, parent, body] = def
    const fields = this._parseFields(body)
    const directives = this._parseDirectives(body)
    this.models.set(name, { name, parent, fields, directives })

    // Pre-compile validator for this model
    this._compileValidator(name)
  }

  _parseFields(body) {
    const fields = new Map()
    if (!Array.isArray(body)) return fields

    for (const item of body) {
      if (!Array.isArray(item)) continue
      if (item[0] === 'field') {
        // ["field", name, modifiers, type, constraints, attrs]
        const [, name, modifiers, type, constraints, attrs] = item
        fields.set(name, {
          name,
          required: modifiers?.includes('!') ?? false,
          unique: modifiers?.includes('#') ?? false,
          optional: modifiers?.includes('?') ?? false,
          type: Array.isArray(type) && type[0] === 'array' ? { array: true, of: type[1] } : type,
          constraints: this._parseConstraints(constraints, type),
          attrs,
        })
      }
    }
    return fields
  }

  _parseConstraints(constraints, type) {
    if (!Array.isArray(constraints) || constraints.length === 0) {
      return null
    }

    // Constraints are: [min], [min, max], [default], [min, max, default]
    const result = {}

    if (constraints.length === 1) {
      // Single value = default
      result.default = constraints[0]
    } else if (constraints.length === 2) {
      // Two values = min, max
      result.min = constraints[0]
      result.max = constraints[1]
    } else if (constraints.length >= 3) {
      // Three values = min, max, default
      result.min = constraints[0]
      result.max = constraints[1]
      result.default = constraints[2]
    }

    return result
  }

  _parseDirectives(body) {
    const directives = {}
    if (!Array.isArray(body)) return directives

    for (const item of body) {
      if (!Array.isArray(item)) continue
      switch (item[0]) {
        case 'timestamps':
          directives.timestamps = true
          break
        case 'softDelete':
          directives.softDelete = true
          break
        case 'index':
          directives.indexes = directives.indexes || []
          directives.indexes.push({ fields: item[1], unique: item[2] })
          break
        case 'belongs_to':
          directives.belongsTo = directives.belongsTo || []
          directives.belongsTo.push({ model: item[1], options: item[2] })
          break
        case 'has_many':
          directives.hasMany = directives.hasMany || []
          directives.hasMany.push({ model: item[1], options: item[2] })
          break
        case 'has_one':
          directives.hasOne = directives.hasOne || []
          directives.hasOne.push({ model: item[1], options: item[2] })
          break
      }
    }
    return directives
  }

  // ---------------------------------------------------------------------------
  // Validator Compilation
  // ---------------------------------------------------------------------------

  _compileValidator(modelName, kind = 'model') {
    const model = kind === 'type' ? this.types.get(modelName) : this.models.get(modelName)
    if (!model) return

    const checks = []

    for (const [fieldName, field] of model.fields) {
      checks.push(this._compileFieldValidator(fieldName, field))
    }

    // Return a function that runs all checks and collects errors
    const validator = (obj) => {
      const errors = []
      for (const check of checks) {
        const error = check(obj)
        if (error) errors.push(error)
      }
      return errors.length > 0 ? errors : null
    }

    this.validators.set(modelName, validator)
  }

  _compileFieldValidator(fieldName, field) {
    const { required, type, constraints } = field
    const isArray = typeof type === 'object' && type.array
    const baseType = isArray ? type.of : type

    return (obj) => {
      const value = obj[fieldName]

      // Check required
      if (value === undefined || value === null) {
        if (required) {
          return { field: fieldName, error: 'required', message: `${fieldName} is required` }
        }
        return null // Optional and missing is OK
      }

      // Check array type
      if (isArray) {
        if (!Array.isArray(value)) {
          return { field: fieldName, error: 'type', message: `${fieldName} must be an array` }
        }
        // Validate each item
        for (let i = 0; i < value.length; i++) {
          const itemError = this._validateValue(value[i], baseType, fieldName, constraints)
          if (itemError) {
            return { ...itemError, index: i }
          }
        }
        return null
      }

      // Check single value
      return this._validateValue(value, baseType, fieldName, constraints)
    }
  }

  _validateValue(value, type, fieldName, constraints) {
    // Check built-in type
    const typeValidator = Types[type]
    if (typeValidator) {
      if (!typeValidator(value)) {
        return { field: fieldName, error: 'type', message: `${fieldName} must be a valid ${type}` }
      }
    } else if (this.enums.has(type)) {
      // Check enum
      const enumValues = this.enums.get(type)
      if (!enumValues.has(value)) {
        return { field: fieldName, error: 'enum', message: `${fieldName} must be one of: ${[...enumValues].join(', ')}` }
      }
    } else if (this.types.has(type)) {
      // Nested type - validate recursively
      const nestedErrors = this.validate(type, value)
      if (nestedErrors) {
        return { field: fieldName, error: 'nested', errors: nestedErrors }
      }
    }
    // Unknown type - allow (might be a forward reference or external type)

    // Check constraints
    if (constraints) {
      if (constraints.min !== undefined && !Constraints.min(value, constraints.min, type)) {
        return { field: fieldName, error: 'min', message: `${fieldName} must be at least ${constraints.min}` }
      }
      if (constraints.max !== undefined && !Constraints.max(value, constraints.max, type)) {
        return { field: fieldName, error: 'max', message: `${fieldName} must be at most ${constraints.max}` }
      }
      if (constraints.pattern !== undefined && !Constraints.pattern(value, constraints.pattern)) {
        return { field: fieldName, error: 'pattern', message: `${fieldName} has invalid format` }
      }
    }

    return null
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Create a new model instance with defaults applied
   */
  create(modelName, data = {}) {
    const model = this.models.get(modelName) || this.types.get(modelName)
    if (!model) {
      throw new Error(`Unknown model: ${modelName}`)
    }

    const instance = { ...data }

    // Apply defaults
    for (const [fieldName, field] of model.fields) {
      if (instance[fieldName] === undefined && field.constraints?.default !== undefined) {
        const def = field.constraints.default
        instance[fieldName] = (typeof def === 'object' && def !== null) ? structuredClone(def) : def
      }
    }

    // Add timestamps if configured
    if (model.directives?.timestamps) {
      const now = new Date()
      instance.createdAt = instance.createdAt || now
      instance.updatedAt = instance.updatedAt || now
    }

    // Attach metadata
    Object.defineProperty(instance, '$model', { value: modelName, enumerable: false })
    Object.defineProperty(instance, '$schema', { value: this, enumerable: false })
    Object.defineProperty(instance, '$validate', {
      value: () => this.validate(modelName, instance),
      enumerable: false,
    })

    return instance
  }

  /**
   * Validate an object against a model or type schema
   * Returns null if valid, array of errors if invalid
   */
  validate(modelName, obj) {
    // Check for pre-compiled validator
    let validator = this.validators.get(modelName)

    // If not found, try to compile on-demand
    if (!validator) {
      if (this.types.has(modelName)) {
        this._compileValidator(modelName, 'type')
      } else if (this.models.has(modelName)) {
        this._compileValidator(modelName, 'model')
      }
      validator = this.validators.get(modelName)
    }

    if (validator) {
      return validator(obj)
    }

    return null // Unknown model/type - no validation
  }

  /**
   * Check if a single value is valid for a field
   */
  isValid(modelName, fieldName, value) {
    const model = this.models.get(modelName) || this.types.get(modelName)
    if (!model) return true

    const field = model.fields.get(fieldName)
    if (!field) return true

    const tempObj = { [fieldName]: value }
    const errors = this.validate(modelName, tempObj)
    return !errors || !errors.some(e => e.field === fieldName)
  }

  /**
   * Get model definition
   */
  getModel(name) {
    return this.models.get(name)
  }

  /**
   * Get type definition
   */
  getType(name) {
    return this.types.get(name)
  }

  /**
   * Get enum values
   */
  getEnum(name) {
    return this.enums.get(name)
  }

  /**
   * List all registered models
   */
  listModels() {
    return [...this.models.keys()]
  }

  /**
   * List all registered types
   */
  listTypes() {
    return [...this.types.keys()]
  }

  /**
   * List all registered enums
   */
  listEnums() {
    return [...this.enums.keys()]
  }
}

export default Schema
