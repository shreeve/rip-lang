// =============================================================================
// @rip-lang/schema/orm — ActiveRecord-style ORM
// =============================================================================
//
// Rich domain models with inheritance, behavior, schema, and computed fields.
//
// Usage:
//   import { Schema } from '@rip-lang/schema/orm'
//
//   schema = Schema.load './app.schema', import.meta.url
//   schema.connect 'http://localhost:4213'
//
//   User = schema.model 'User',
//     greet: -> "Hello, #{@name}!"
//     computed:
//       identifier: -> "#{@name} <#{@email}>"
//
// Query API:
//   user = await User.find(id)
//   users = await User.all()
//   users = await User.where({ active: true }).all()
//   users = await User.where('score > ?', 90).all()
//   await user.save()
//
// =============================================================================

import { Schema } from './runtime.js';
import { toSnakeCase, pluralize } from './emit-sql.js';
import { Fake } from './faker.js';
export { Schema, Fake };

let _dbUrl = process.env.DB_URL || 'http://localhost:4213';

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
  static _relations = {};
  static _schemaRef = null;
  static _softDelete = false;

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

    // Derive table name: UserProfile → user_profiles, Person → people
    if (!this.table) {
      this.table = pluralize(toSnakeCase(modelName));
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
        const fk = toSnakeCase(rel.model) + '_id';
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
      this._softDelete = true;
    }

    // Store relationship metadata for lazy loading
    const relations = {};
    if (model.directives?.belongsTo) {
      for (const rel of model.directives.belongsTo) {
        const name = rel.model[0].toLowerCase() + rel.model.slice(1);
        relations[name] = { type: 'belongsTo', model: rel.model, foreignKey: toSnakeCase(rel.model) + '_id' };
      }
    }
    if (model.directives?.hasMany) {
      for (const rel of model.directives.hasMany) {
        const name = pluralize(rel.model[0].toLowerCase() + rel.model.slice(1));
        relations[name] = { type: 'hasMany', model: rel.model, foreignKey: toSnakeCase(modelName) + '_id' };
      }
    }
    if (model.directives?.hasOne) {
      for (const rel of model.directives.hasOne) {
        const name = rel.model[0].toLowerCase() + rel.model.slice(1);
        relations[name] = { type: 'hasOne', model: rel.model, foreignKey: toSnakeCase(modelName) + '_id' };
      }
    }
    this._relations = relations;
    this._schemaRef = schemaInstance;

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

    // Define relation methods (lazy loading, with eager cache)
    this._eagerLoaded = null;
    const relations = this.constructor._relations;
    const schemaRef = this.constructor._schemaRef;
    for (const name in relations) {
      const rel = relations[name];
      if (this[name] !== undefined) continue; // don't shadow schema fields (e.g., organization_id)
      Object.defineProperty(this, name, {
        enumerable: false,
        value: async () => {
          // Return eager-loaded data if available (no query)
          if (this._eagerLoaded?.has(name)) return this._eagerLoaded.get(name);
          // Lazy load
          const RelModel = schemaRef._models?.get(rel.model);
          if (!RelModel) throw new Error(`Model '${rel.model}' not registered — define it with schema.model('${rel.model}', ...)`);
          const pk = this._data[this.constructor.primaryKey];
          if (rel.type === 'belongsTo') {
            const fk = this._data[rel.foreignKey];
            return fk != null ? await RelModel.find(fk) : null;
          } else if (rel.type === 'hasMany') {
            return await RelModel.where({ [rel.foreignKey]: pk }).all();
          } else if (rel.type === 'hasOne') {
            return await RelModel.where({ [rel.foreignKey]: pk }).first();
          }
        },
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

  async softDelete() {
    if (!this._persisted) return this;
    const Ctor = this.constructor;
    if (!Ctor._softDelete) throw new Error(`${Ctor.name || 'Model'} does not have @softDelete`);
    const pk = Ctor.primaryKey;
    const now = new Date().toISOString();
    await query(`UPDATE ${Ctor.tableName()} SET "deleted_at" = ? WHERE "${pk}" = ?`, [now, this._data[pk]]);
    this._data.deleted_at = now;
    return this;
  }

  async restore() {
    if (!this._persisted) return this;
    const Ctor = this.constructor;
    if (!Ctor._softDelete) throw new Error(`${Ctor.name || 'Model'} does not have @softDelete`);
    const pk = Ctor.primaryKey;
    await query(`UPDATE ${Ctor.tableName()} SET "deleted_at" = NULL WHERE "${pk}" = ?`, [this._data[pk]]);
    this._data.deleted_at = null;
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
    if (this._eagerLoaded) {
      for (const [name, val] of this._eagerLoaded) {
        obj[name] = Array.isArray(val) ? val.map(r => r.toJSON()) : val?.toJSON() ?? null;
      }
    }
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
    const soft = this._softDelete ? ' AND "deleted_at" IS NULL' : '';
    const sql = `SELECT * FROM ${this.tableName()} WHERE "${pk}" = ?${soft} LIMIT 1`;
    const result = await query(sql, [id]);
    if (result.rows === 0) return null;
    return this._materialize(result.meta, result.data[0]);
  }

  static async findMany(ids) {
    if (ids.length === 0) return [];
    const pk = this.primaryKey;
    const placeholders = ids.map(() => '?').join(', ');
    const soft = this._softDelete ? ' AND "deleted_at" IS NULL' : '';
    const sql = `SELECT * FROM ${this.tableName()} WHERE "${pk}" IN (${placeholders})${soft}`;
    const result = await query(sql, ids);
    return result.data.map(row => this._materialize(result.meta, row));
  }

  static async all(limit = null) {
    const q = new Query(this);
    if (limit != null) q.limit(limit);
    return q.all();
  }

  static async first() {
    return new Query(this).first();
  }

  static where(conditions, ...params) {
    return new Query(this).where(conditions, ...params);
  }

  static withDeleted() {
    return new Query(this, { includeDeleted: true });
  }

  static include(...names) {
    return new Query(this).include(...names);
  }

  static count(conditions = null) {
    const q = new Query(this);
    if (conditions != null) q.where(conditions);
    return q.count();
  }

  static build(data = {}) {
    return new this(data, false);
  }

  static async create(data = {}) {
    return await this.build(data).save();
  }

  // ---------------------------------------------------------------------------
  // Factory — schema-driven fake data generation
  // ---------------------------------------------------------------------------
  //   User.factory()       → create 1 (persisted, single)
  //   User.factory(0)      → build 1 (not persisted, single)
  //   User.factory(3)      → create 3 (persisted, array)
  //   User.factory(-3)     → build 3 (not persisted, array)
  //   User.factory(3, {})  → create 3 with overrides (array)
  // ---------------------------------------------------------------------------

  static _fake(overrides = {}) {
    const data = {};
    const schema = this._schema;
    const schemaRef = this._schemaRef;
    const s = this._factorySeq = (this._factorySeq || 0) + 1;

    for (const name in schema) {
      if (overrides[name] != null) { data[name] = overrides[name]; continue; }

      const field = schema[name];
      if (field.primary) continue;
      if (name === 'created_at' || name === 'updated_at' || name === 'deleted_at') continue;

      // Use schema default if available
      if (field.default != null) {
        data[name] = typeof field.default === 'function' ? field.default() : field.default;
        continue;
      }

      // Skip optional fields sometimes (30% chance of null)
      if (!field.required && Math.random() < 0.3) continue;

      // FK fields — leave for caller to set via overrides
      if (field.type === 'uuid') continue;

      // Skip nested/composite types (e.g. Address) — can't fake a struct
      if (schemaRef?.types?.has(field.type)) continue;

      // Resolve enum values if applicable
      const enumVals = schemaRef?.enums?.has(field.type) ? schemaRef.enums.get(field.type) : null;

      data[name] = Fake.value(name, field, s, enumVals);
    }
    return data;
  }

  static async factory(num, overrides = {}) {
    // Custom faker on the model takes priority
    const fake = (this._faker)
      ? (ov) => ({ ...this._faker(ov), ...ov })
      : (ov) => this._fake(ov);

    if (num == null) {
      return this.create(fake(overrides));
    } else if (num === 0) {
      return this.build(fake(overrides));
    } else if (num > 0) {
      return Promise.all(Array.from({ length: num }, () => this.create(fake(overrides))));
    } else {
      return Array.from({ length: -num }, () => this.build(fake(overrides)));
    }
  }

}

// =============================================================================
// Query — Chainable query builder
// =============================================================================

class Query {
  constructor(model, { includeDeleted = false } = {}) {
    this._model  = model;
    this._where  = [];
    this._params = [];
    this._order  = null;
    this._limit  = null;
    this._offset = null;
    this._includes = [];
    this._includeDeleted = includeDeleted;

    // Auto-filter soft-deleted records unless explicitly included
    if (model._softDelete && !includeDeleted) {
      this._where.push('"deleted_at" IS NULL');
    }
  }

  withDeleted() {
    // Remove the auto-added soft-delete filter
    this._where = this._where.filter(w => w !== '"deleted_at" IS NULL');
    this._includeDeleted = true;
    return this;
  }

  include(...names) {
    this._includes.push(...names.flat());
    return this;
  }

  // Batch-load included relations (2-query strategy, eliminates N+1)
  async _loadIncludes(records) {
    if (this._includes.length === 0 || records.length === 0) return records;

    const model = this._model;
    const relations = model._relations;
    const schemaRef = model._schemaRef;

    for (const relName of this._includes) {
      const rel = relations[relName];
      if (!rel) throw new Error(`Unknown relation '${relName}' on ${model.name || 'Model'}`);

      const RelModel = schemaRef._models?.get(rel.model);
      if (!RelModel) throw new Error(`Model '${rel.model}' not registered`);

      if (rel.type === 'belongsTo') {
        const fkValues = [...new Set(records.map(r => r._data[rel.foreignKey]).filter(v => v != null))];
        if (fkValues.length === 0) {
          for (const r of records) { (r._eagerLoaded ||= new Map()).set(relName, null); }
          continue;
        }
        const related = await RelModel.findMany(fkValues);
        const byPk = new Map(related.map(r => [r._data[RelModel.primaryKey], r]));
        for (const r of records) {
          (r._eagerLoaded ||= new Map()).set(relName, byPk.get(r._data[rel.foreignKey]) || null);
        }

      } else if (rel.type === 'hasMany' || rel.type === 'hasOne') {
        const pk = model.primaryKey;
        const pkValues = records.map(r => r._data[pk]);
        const placeholders = pkValues.map(() => '?').join(', ');
        const soft = RelModel._softDelete ? ' AND "deleted_at" IS NULL' : '';
        const sql = `SELECT * FROM ${RelModel.tableName()} WHERE "${rel.foreignKey}" IN (${placeholders})${soft}`;
        const result = await query(sql, pkValues);
        const allRelated = result.data.map(row => RelModel._materialize(result.meta, row));

        if (rel.type === 'hasMany') {
          const byFk = new Map();
          for (const r of allRelated) {
            const fk = r._data[rel.foreignKey];
            if (!byFk.has(fk)) byFk.set(fk, []);
            byFk.get(fk).push(r);
          }
          for (const r of records) {
            (r._eagerLoaded ||= new Map()).set(relName, byFk.get(r._data[pk]) || []);
          }
        } else {
          const byFk = new Map();
          for (const r of allRelated) {
            const fk = r._data[rel.foreignKey];
            if (!byFk.has(fk)) byFk.set(fk, r); // first match wins
          }
          for (const r of records) {
            (r._eagerLoaded ||= new Map()).set(relName, byFk.get(r._data[pk]) || null);
          }
        }
      }
    }
    return records;
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
    const records = result.data.map(row => this._model._materialize(result.meta, row));
    return this._loadIncludes(records);
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

// =============================================================================
// Extend Schema with ORM capabilities
// =============================================================================

Schema.prototype.connect = function(url) {
  _dbUrl = url;
};

Schema.prototype.model = function(modelName, options = {}) {
  if (!this._models) this._models = new Map();

  const { computed: computedDefs, faker: fakerFn, ...methods } = options;

  // Create a new class extending Model
  const ModelClass = class extends Model {};

  // Add instance methods to the prototype
  for (const [name, fn] of Object.entries(methods)) {
    ModelClass.prototype[name] = fn;
  }

  // Load schema (table, fields, types, constraints, timestamps, FKs, relations)
  ModelClass.fromSchema(this, modelName);

  // Add computed properties (getters, no parens needed)
  if (computedDefs) ModelClass.computed(computedDefs);

  // Set custom faker if provided
  if (fakerFn) ModelClass._faker = fakerFn;

  // Return callable and register in schema for relation lookups
  const callable = makeCallable(ModelClass);
  this._models.set(modelName, callable);
  return callable;
};
