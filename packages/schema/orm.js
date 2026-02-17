// =============================================================================
// @rip-lang/schema/orm — ActiveRecord-style ORM
// =============================================================================
//
// Rich domain models with inheritance, behavior, schema, and computed fields.
//
// Usage (from Rip — schema-driven):
//   import { Schema } from '@rip-lang/schema'
//   import { Model, connect } from '@rip-lang/schema/orm'
//
//   schema = Schema.load './app.schema', import.meta.url
//   connect 'http://localhost:4213'
//
//   class User extends Model
//     greet: -> "Hello, #{@name}!"
//
//   User.fromSchema schema, 'User'   # loads table, fields, types, constraints
//
// Usage (from Rip — manual):
//   import { Model, connect } from '@rip-lang/schema/orm'
//
//   connect 'http://localhost:4213'
//
//   class User extends Model
//     greet: -> "Hello, #{@name}!"
//
//   User.table = 'users'
//   User.schema { id: { type: 'int', primary: true }, name: { type: 'string', required: true } }
//
// Query API:
//   user = await User.find(25)
//   users = await User.all()
//   users = await User.where({ active: true }).all()
//   users = await User.where('score > ?', 90).all()
//   await user.save()
//
// =============================================================================

let _dbUrl = process.env.DB_URL || 'http://localhost:4213';

export function connect(url) {
  _dbUrl = url;
}

// =============================================================================
// Query helper
// =============================================================================

async function query(sql, params = []) {
  const body = params.length > 0 ? { sql, params } : { sql };
  const res = await fetch(`${_dbUrl}/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// =============================================================================
// Model — Base class for all domain models
// =============================================================================

export class Model {

  // Class-level configuration (set by subclasses)
  static table      = null;
  static database   = null;
  static primaryKey = 'id';
  static _schema    = {};
  static _computed  = {};
  static _columns   = null;

  // ---------------------------------------------------------------------------
  // Schema definition (called by subclass)
  // ---------------------------------------------------------------------------

  static schema(fields) {
    this._schema = fields;
    this._columns = {};
    for (const name in fields) {
      this._columns[name] = fields[name].column || name;
    }
  }

  // ---------------------------------------------------------------------------
  // Computed fields definition (called by subclass)
  // ---------------------------------------------------------------------------

  static computed(fields) {
    this._computed = fields;
  }

  // ---------------------------------------------------------------------------
  // Load schema from a parsed .schema AST (bridges runtime → ORM)
  // ---------------------------------------------------------------------------

  static fromSchema(schemaInstance, modelName) {
    const model = schemaInstance.getModel(modelName);
    if (!model) throw new Error(`Model '${modelName}' not found in schema`);

    // Derive table name: UserProfile → user_profiles
    if (!this.table) {
      const snake = modelName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      this.table = snake.replace(/(?:([^s])$|s$)/, (m, p1) => p1 ? p1 + 's' : 's');
    }

    // Models always have an implicit id primary key (added by emit-sql.js)
    const fields = { id: { type: 'uuid', primary: true } };

    // Convert runtime field definitions → ORM schema format
    for (const [name, field] of model.fields) {
      const def = {};
      const type = typeof field.type === 'object' && field.type?.array ? 'array' : field.type;
      if (type) def.type = type;
      if (field.required) def.required = true;
      if (field.unique) def.unique = true;
      if (field.constraints) {
        if (field.constraints.min != null) def.min = field.constraints.min;
        if (field.constraints.max != null) def.max = field.constraints.max;
        if (field.constraints.default != null) def.default = field.constraints.default;
      }
      if (field.attrs?.primary) { def.primary = true; }
      fields[name] = def;
    }

    // Add relationship foreign keys
    if (model.directives?.belongsTo) {
      for (const rel of model.directives.belongsTo) {
        const fk = rel.model.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase() + '_id';
        if (!fields[fk]) fields[fk] = { type: 'uuid' };
      }
    }

    // Add timestamp fields
    if (model.directives?.timestamps) {
      fields.created_at = { type: 'datetime' };
      fields.updated_at = { type: 'datetime' };
    }

    // Add soft delete field
    if (model.directives?.softDelete) {
      fields.deleted_at = { type: 'datetime' };
    }

    // Detect primary key from fields
    for (const [name, def] of Object.entries(fields)) {
      if (def.primary) { this.primaryKey = name; break; }
    }

    this.schema(fields);
    return this;
  }

  // ---------------------------------------------------------------------------
  // Table name helper
  // ---------------------------------------------------------------------------

  static tableName() {
    return this.database ? `"${this.database}"."${this.table}"` : `"${this.table}"`;
  }

  // ---------------------------------------------------------------------------
  // Constructor — creates a record instance
  // ---------------------------------------------------------------------------

  constructor(data = {}, persisted = false) {
    this._data = {};
    this._dirty = {};
    this._persisted = persisted;

    const schema  = this.constructor._schema;
    const columns = this.constructor._columns || {};

    // Apply schema defaults and initial data
    for (const name in schema) {
      const field = schema[name];
      const col = columns[name] || name;
      if (data[col] != null) {
        this._data[col] = data[col];
      } else if (data[name] != null) {
        this._data[col] = data[name];
      } else if (field.default != null) {
        this._data[col] = typeof field.default === 'function' ? field.default() : field.default;
      }
    }

    // Define property accessors for schema fields
    for (const name in schema) {
      const col = columns[name] || name;
      Object.defineProperty(this, name, {
        enumerable: true,
        get() { return this._data[col]; },
        set(value) { this._data[col] = value; this._dirty[name] = true; },
      });
    }

    // Define computed property accessors (reactive getters)
    const computed = this.constructor._computed;
    for (const name in computed) {
      const fn = computed[name];
      Object.defineProperty(this, name, {
        enumerable: true,
        get() { return fn.call(this); },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Instance state
  // ---------------------------------------------------------------------------

  get $isNew()    { return !this._persisted; }
  get $dirty()    { return Object.keys(this._dirty); }
  get $changed()  { return Object.keys(this._dirty).length > 0; }
  get $data()     { return { ...this._data }; }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  $validate() {
    const errors  = [];
    const schema  = this.constructor._schema;
    const columns = this.constructor._columns || {};

    for (const name in schema) {
      const field = schema[name];
      const col   = columns[name] || name;
      const value = this._data[col];

      // Required check
      if (field.required && value == null) {
        errors.push({ field: name, error: 'required', message: `${name} is required` });
        continue;
      }

      if (value == null) continue; // Skip optional empty fields

      // Type checks
      switch (field.type) {
        case 'string': case 'text':
          if (typeof value !== 'string') {
            errors.push({ field: name, error: 'type', message: `${name} must be a string` });
          } else {
            if (field.min != null && value.length < field.min)
              errors.push({ field: name, error: 'min', message: `${name} must be at least ${field.min} characters` });
            if (field.max != null && value.length > field.max)
              errors.push({ field: name, error: 'max', message: `${name} must be at most ${field.max} characters` });
            if (field.regex && !field.regex.test(value))
              errors.push({ field: name, error: 'pattern', message: `${name} is invalid` });
          }
          break;
        case 'int': case 'integer':
          if (!Number.isInteger(value)) {
            errors.push({ field: name, error: 'type', message: `${name} must be an integer` });
          } else {
            if (field.min != null && value < field.min)
              errors.push({ field: name, error: 'min', message: `${name} must be >= ${field.min}` });
            if (field.max != null && value > field.max)
              errors.push({ field: name, error: 'max', message: `${name} must be <= ${field.max}` });
          }
          break;
        case 'bool': case 'boolean':
          if (typeof value !== 'boolean')
            errors.push({ field: name, error: 'type', message: `${name} must be a boolean` });
          break;
        case 'email':
          if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
            errors.push({ field: name, error: 'type', message: `${name} must be a valid email` });
          break;
      }

      // Enum check
      if (field.enum && !field.enum.includes(value))
        errors.push({ field: name, error: 'enum', message: `${name} must be one of: ${field.enum.join(', ')}` });
    }

    return errors.length > 0 ? errors : null;
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  async save() {
    const errors = this.$validate();
    if (errors) throw new Error(`Validation failed: ${JSON.stringify(errors)}`);

    const Ctor      = this.constructor;
    const tableName = Ctor.tableName();
    const pk        = Ctor.primaryKey;
    const schema    = Ctor._schema;
    const columns   = Ctor._columns || {};

    if (this._persisted) {
      // UPDATE — only dirty fields
      const sets = [], values = [];
      for (const name of this.$dirty) {
        const col = columns[name] || name;
        sets.push(`"${col}" = ?`);
        values.push(this._data[col]);
      }
      if (sets.length === 0) return this;

      const sql = `UPDATE ${tableName} SET ${sets.join(', ')} WHERE "${pk}" = ?`;
      values.push(this._data[pk]);
      await query(sql, values);
    } else {
      // INSERT
      const cols = [], placeholders = [], values = [];
      for (const name in schema) {
        const field = schema[name];
        const col = columns[name] || name;
        if (field.primary && this._data[col] == null) continue; // Skip auto PK
        if (this._data[col] != null) {
          cols.push(`"${col}"`);
          placeholders.push('?');
          values.push(this._data[col]);
        }
      }

      const sql = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;
      await query(sql, values);
      this._persisted = true;
    }

    this._dirty = {};
    return this;
  }

  async delete() {
    if (!this._persisted) return this;
    const Ctor = this.constructor;
    const pk = Ctor.primaryKey;
    await query(`DELETE FROM ${Ctor.tableName()} WHERE "${pk}" = ?`, [this._data[pk]]);
    this._persisted = false;
    return this;
  }

  async reload() {
    if (!this._persisted) return this;
    const Ctor = this.constructor;
    const pk = Ctor.primaryKey;
    const record = await Ctor.find(this._data[pk]);
    if (record) {
      this._data = record._data;
      this._dirty = {};
    }
    return this;
  }

  toJSON() {
    const obj = {};
    for (const name in this.constructor._schema) obj[name] = this[name];
    for (const name in this.constructor._computed) obj[name] = this[name];
    return obj;
  }

  // ---------------------------------------------------------------------------
  // Class methods — Query API
  // ---------------------------------------------------------------------------

  static _materialize(meta, row) {
    const data = {};
    for (let i = 0; i < meta.length; i++) data[meta[i].name] = row[i];
    return new this(data, true);
  }

  static async find(id) {
    const pk = this.primaryKey;
    const sql = `SELECT * FROM ${this.tableName()} WHERE "${pk}" = ? LIMIT 1`;
    const result = await query(sql, [id]);
    if (result.rows === 0) return null;
    return this._materialize(result.meta, result.data[0]);
  }

  static async findMany(ids) {
    if (ids.length === 0) return [];
    const pk = this.primaryKey;
    const placeholders = ids.map(() => '?').join(', ');
    const sql = `SELECT * FROM ${this.tableName()} WHERE "${pk}" IN (${placeholders})`;
    const result = await query(sql, ids);
    return result.data.map(row => this._materialize(result.meta, row));
  }

  static async all(limit = null) {
    let sql = `SELECT * FROM ${this.tableName()}`;
    if (limit != null) sql += ` LIMIT ${limit}`;
    const result = await query(sql);
    return result.data.map(row => this._materialize(result.meta, row));
  }

  static async first() {
    const sql = `SELECT * FROM ${this.tableName()} LIMIT 1`;
    const result = await query(sql);
    if (result.rows === 0) return null;
    return this._materialize(result.meta, result.data[0]);
  }

  static where(conditions, ...params) {
    return new Query(this).where(conditions, ...params);
  }

  static count(conditions = null) {
    const q = new Query(this);
    if (conditions != null) q.where(conditions);
    return q.count();
  }

  static async create(data = {}) {
    const record = new this(data, false);
    return await record.save();
  }
}

// =============================================================================
// Query — Chainable query builder
// =============================================================================

class Query {
  constructor(model) {
    this._model  = model;
    this._where  = [];
    this._params = [];
    this._order  = null;
    this._limit  = null;
    this._offset = null;
  }

  where(conditions, ...params) {
    if (typeof conditions === 'string') {
      this._where.push(conditions);
      this._params.push(...params);
    } else if (typeof conditions === 'object') {
      const columns = this._model._columns || {};
      for (const key in conditions) {
        const col = columns[key] || key;
        this._where.push(`"${col}" = ?`);
        this._params.push(conditions[key]);
      }
    }
    return this;
  }

  orderBy(column, direction = 'ASC') {
    const columns = this._model._columns || {};
    const col = columns[column] || column;
    this._order = `"${col}" ${direction.toUpperCase()}`;
    return this;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  offset(n) {
    this._offset = n;
    return this;
  }

  toSQL() {
    let sql = `SELECT * FROM ${this._model.tableName()}`;
    if (this._where.length > 0)  sql += ` WHERE ${this._where.join(' AND ')}`;
    if (this._order)             sql += ` ORDER BY ${this._order}`;
    if (this._limit != null)     sql += ` LIMIT ${this._limit}`;
    if (this._offset != null)    sql += ` OFFSET ${this._offset}`;
    return { sql, params: this._params };
  }

  async all() {
    const { sql, params } = this.toSQL();
    const result = await query(sql, params);
    return result.data.map(row => this._model._materialize(result.meta, row));
  }

  async first() {
    const rows = await this.limit(1).all();
    return rows[0] || null;
  }

  async count() {
    let sql = `SELECT COUNT(*) FROM ${this._model.tableName()}`;
    if (this._where.length > 0) sql += ` WHERE ${this._where.join(' AND ')}`;
    const result = await query(sql, this._params);
    return result.data[0][0];
  }
}

// =============================================================================
// makeCallable — User(25) → User.find(25)
// =============================================================================

export function makeCallable(ModelClass) {
  const callable = function(idOrIds) {
    if (Array.isArray(idOrIds)) {
      return idOrIds.length === 0 ? ModelClass.all() : ModelClass.findMany(idOrIds);
    }
    return idOrIds != null ? ModelClass.find(idOrIds) : ModelClass.all();
  };

  // Copy static methods and properties (walk prototype chain to include inherited)
  const seen = new Set(['prototype', 'length', 'name']);
  let cls = ModelClass;
  while (cls && cls !== Function.prototype) {
    for (const key of Object.getOwnPropertyNames(cls)) {
      if (seen.has(key)) continue;
      seen.add(key);
      const desc = Object.getOwnPropertyDescriptor(cls, key);
      if (typeof desc.value === 'function') {
        callable[key] = desc.value.bind(ModelClass);
      } else if (desc) {
        Object.defineProperty(callable, key, desc);
      }
    }
    cls = Object.getPrototypeOf(cls);
  }

  return callable;
}
