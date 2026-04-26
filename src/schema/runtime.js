// AUTOGEN-NOTICE: extracted verbatim from the SCHEMA_RUNTIME template
// literal originally embedded in src/schema.js. This file is the new
// source of truth for the schema runtime body. Phase 2 will split this
// into fragments under src/schema/runtime-{validate,db-naming,orm,ddl,
// browser-stubs}.js. For now it remains the unified body.
//
// Edits made here will appear in compiled bundles on the next module load.
// Tests pin the public surface via test/schema-errors.test.js and
// test/schema-modes.test.js.

export const SCHEMA_RUNTIME = `
// ---- Rip Schema Runtime ----------------------------------------------------
// Four layers, lazy compilation:
//   1 (descriptor)   object passed to __schema({...}). Raw metadata.
//   2 (normalized)   fields/methods/computed/hooks/relations/constraints.
//                    Collision checks. Table name derivation. Built once.
//   3 (validator)    compiled validator plan. Built on first .parse.
//   4a (ORM plan)    built on first .find/.create/.save.
//   4b (DDL plan)    built on first .toSQL(). Independent of 4a.
//
// Instance-singleton model:
// The runtime installs itself on globalThis.__ripSchema the first time a
// compiled bundle executes. Subsequent bundles that inject the same runtime
// template detect the existing installation and bind to it instead of
// re-running the body — giving every bundle a single shared registry,
// adapter, and class identity. The IIFE wrapper below enforces that.

var { __schema, SchemaError, __SchemaRegistry, __schemaSetAdapter } = (function() {
  if (typeof globalThis !== 'undefined' && globalThis.__ripSchema) {
    if (globalThis.__ripSchema.__version !== 1) {
      throw new Error(
        "rip-schema runtime version mismatch: loaded runtime is v" +
        globalThis.__ripSchema.__version +
        ", but this bundle expects v" + 1 +
        ". Two compiled Rip bundles with incompatible schema runtimes are loaded in the same process."
      );
    }
    return globalThis.__ripSchema;
  }

class SchemaError extends Error {
  constructor(issues, schemaName, schemaKind) {
    super(__schemaFormatIssues(issues, schemaName));
    this.name = 'SchemaError';
    this.issues = issues;
    this.schemaName = schemaName || null;
    this.schemaKind = schemaKind || null;
  }
}

function __schemaFormatIssues(issues, name) {
  if (!issues || !issues.length) return 'SchemaError';
  const head = name ? name + ': ' : '';
  return head + issues.map(i => i.message || i.error || 'invalid').join('; ');
}

// Reserved names are hoisted to module scope — they're pure data and
// rebuilding them per _normalize() call wastes allocations. Static: names
// that become class-level methods on :model (parse, find, toSQL, …).
// Instance: names that become instance methods (save, destroy, toJSON, …).
// A declared field, method, computed, or derived that collides with
// either set on a :model raises a collision error during normalize.
const __SCHEMA_RESERVED_STATIC = new Set([
  'parse','safe','ok','find','findMany','where','all','first','count','create','toSQL',
]);
const __SCHEMA_RESERVED_INSTANCE = new Set([
  'save','destroy','reload','ok','errors','toJSON',
]);
const __SCHEMA_RESERVED = new Set([...__SCHEMA_RESERVED_STATIC, ...__SCHEMA_RESERVED_INSTANCE]);

const __schemaTypes = {
  string:   v => typeof v === 'string',
  number:   v => typeof v === 'number' && !Number.isNaN(v),
  integer:  v => Number.isInteger(v),
  boolean:  v => typeof v === 'boolean',
  date:     v => v instanceof Date && !Number.isNaN(v.getTime()),
  datetime: v => v instanceof Date && !Number.isNaN(v.getTime()),
  email:    v => typeof v === 'string' && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v),
  url:      v => typeof v === 'string' && /^https?:\\/\\/.+/.test(v),
  uuid:     v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  phone:    v => typeof v === 'string' && /^[\\d\\s\\-+()]+$/.test(v),
  zip:      v => typeof v === 'string' && /^\\d{5}(-\\d{4})?$/.test(v),
  text:     v => typeof v === 'string',
  json:     v => v !== undefined,
  any:      ()  => true,
};

function __schemaCheckValue(v, typeName) {
  const check = __schemaTypes[typeName];
  return check ? check(v) : true;
}

// Validate a single value against a typeName, returning either null (ok)
// or an array of issues relative to the value's own root. Primitive
// typenames dispatch through the __schemaTypes map; typenames that
// resolve to a registered :shape / :input / :model validate the value
// as a nested object; typenames that resolve to a :enum enforce
// membership. Unknown typenames stay permissive so forward-references
// and cross-module names do not hard-fail — matches pre-registry behavior.
function __schemaValidateValue(v, typeName) {
  const prim = __schemaTypes[typeName];
  if (prim) {
    return prim(v) ? null : [{field: '', error: 'type', message: 'must be ' + typeName}];
  }
  const subDef = __SchemaRegistry.get(typeName);
  if (!subDef) return null;
  if (subDef.kind === 'enum') {
    const errs = subDef._validateEnum(v, true);
    return errs.length ? [{field: '', error: 'enum', message: errs[0].message}] : null;
  }
  if (subDef.kind === 'mixin') {
    return [{field: '', error: 'type', message: ':mixin ' + typeName + ' is not usable as a field type'}];
  }
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    return [{field: '', error: 'type', message: 'must be a ' + typeName + ' object'}];
  }
  const subErrs = subDef._validateFields(v, true);
  return subErrs.length ? subErrs : null;
}

// Merge a child path segment into an existing field path. Produces
// 'addr.street' for object descent, 'items[0].name' for array descent.
function __schemaJoinField(head, child) {
  if (!child) return head;
  return head + (child.startsWith('[') ? child : '.' + child);
}

// Rewrite a child issue's message so the leading "<childField> " token
// (present on most leaf messages: "name is required", "id must be
// integer") is replaced by the joined parent path — avoiding the
// duplicated "items[1].id id must be integer" reading.
function __schemaRewriteMessage(joinedField, childField, childMessage) {
  if (!childField) return joinedField + ' ' + childMessage;
  if (childMessage.startsWith(childField)) {
    return joinedField + childMessage.slice(childField.length);
  }
  return joinedField + ': ' + childMessage;
}

// Naming utilities (snake_case column/table names, irregular plurals).
function __schemaSnake(s) { return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(); }
const __SCHEMA_UNCOUNTABLE = new Set(['equipment','information','rice','money','species','series','fish','sheep','data']);
const __SCHEMA_IRREGULAR = new Map([['person','people'],['man','men'],['woman','women'],['child','children'],['tooth','teeth'],['foot','feet'],['mouse','mice']]);
function __schemaPluralize(w) {
  const lw = w.toLowerCase();
  if (__SCHEMA_UNCOUNTABLE.has(lw)) return w;
  if (__SCHEMA_IRREGULAR.has(lw)) return __SCHEMA_IRREGULAR.get(lw);
  // Preserve case of the input — pluralizer operates on the trailing form
  // but keeps the rest unchanged, so orderItem becomes orderItems
  // and User becomes Users.
  if (/[^aeiouy]y$/i.test(w)) return w.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/i.test(w)) return w + 'es';
  return w + 's';
}
function __schemaTableName(model) { return __schemaPluralize(__schemaSnake(model)); }
function __schemaFkName(model) { return __schemaSnake(model) + '_id'; }

// ---- Registry ---------------------------------------------------------------
// Process-global, resettable, with placeholder state for forward/circular
// references. Duplicate registration of the same model name is a hard error.

const __SchemaRegistry = {
  _entries: new Map(),
  register(def) {
    // Named schemas of any kind land here. Relations look up :model,
    // @mixin Name looks up :mixin. Algebra (.extend etc.) accepts :shape
    // and derived shapes. Kind is checked at lookup time.
    if (!def.name) return;
    // Most recent registration wins. Recompilation produces a fresh
    // __SchemaDef with the same name; the registry rebinds. Cross-
    // module name collisions should be avoided — schema names are
    // app-global identifiers for relation resolution.
    this._entries.set(def.name, { def, kind: def.kind });
  },
  get(name) {
    const entry = this._entries.get(name);
    return entry ? entry.def : null;
  },
  getKind(name, kind) {
    const entry = this._entries.get(name);
    return entry && entry.kind === kind ? entry.def : null;
  },
  has(name) { return this._entries.has(name); },
  reset() { this._entries.clear(); },
};

// ---- DB adapter seam --------------------------------------------------------
// Default adapter uses fetch to rip-db /sql. Tests can swap with
// __schemaSetAdapter(...) before running queries.

function __schemaDefaultAdapter() {
  const url = (typeof process !== 'undefined' && process.env?.DB_URL) || 'http://localhost:4213';
  return {
    async query(sql, params) {
      const body = params && params.length ? { sql, params } : { sql };
      const res = await fetch(url + '/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    }
  };
}

let __schemaAdapter = __schemaDefaultAdapter();
function __schemaSetAdapter(a) { __schemaAdapter = a; }

// ---- Query builder ----------------------------------------------------------

class __SchemaQuery {
  constructor(def, opts = {}) {
    this._def = def;
    this._clauses = [];
    this._params = [];
    this._limit = null;
    this._offset = null;
    this._order = null;
    this._includeDeleted = opts.includeDeleted === true;
  }
  where(cond, ...params) {
    if (typeof cond === 'string') {
      this._clauses.push(cond);
      this._params.push(...params);
    } else if (cond && typeof cond === 'object') {
      for (const [k, v] of Object.entries(cond)) {
        const col = __schemaSnake(k);
        if (v === null || v === undefined) {
          this._clauses.push('"' + col + '" IS NULL');
        } else {
          this._clauses.push('"' + col + '" = ?');
          this._params.push(v);
        }
      }
    }
    return this;
  }
  limit(n) { this._limit = n; return this; }
  offset(n) { this._offset = n; return this; }
  order(spec) { this._order = spec; return this; }
  orderBy(spec) { return this.order(spec); }
  _buildSQL() {
    const n = this._def._normalize();
    const table = n.tableName;
    const parts = ['SELECT * FROM "' + table + '"'];
    const where = [...this._clauses];
    if (!this._includeDeleted && n.softDelete) where.push('"deleted_at" IS NULL');
    if (where.length) parts.push('WHERE ' + where.join(' AND '));
    if (this._order) parts.push('ORDER BY ' + this._order);
    if (this._limit != null) parts.push('LIMIT ' + this._limit);
    if (this._offset != null) parts.push('OFFSET ' + this._offset);
    return parts.join(' ');
  }
  async all() {
    const sql = this._buildSQL();
    const res = await __schemaAdapter.query(sql, this._params);
    return (res.data || []).map(row => this._def._hydrate(res.columns, row));
  }
  async first() {
    this._limit = 1;
    const arr = await this.all();
    return arr[0] || null;
  }
  async count() {
    const n = this._def._normalize();
    const parts = ['SELECT COUNT(*) FROM "' + n.tableName + '"'];
    const where = [...this._clauses];
    if (!this._includeDeleted && n.softDelete) where.push('"deleted_at" IS NULL');
    if (where.length) parts.push('WHERE ' + where.join(' AND '));
    const res = await __schemaAdapter.query(parts.join(' '), this._params);
    return res.data?.[0]?.[0] || 0;
  }
}

// ---- __SchemaDef ------------------------------------------------------------

class __SchemaDef {
  constructor(desc) {
    this._desc = desc;
    this.kind = desc.kind;
    this.name = desc.name || null;
    this._norm = null;
    this._klass = null;
    this._sourceModel = null;
  }

  _normalize() {
    if (this._norm) return this._norm;

    const fields = new Map();
    const methods = new Map();
    const computed = new Map();
    const derived = new Map();
    const hooks = new Map();
    const directives = [];
    const enumMembers = new Map();
    const relations = new Map();
    const ensures = [];
    let timestamps = false;
    let softDelete = false;

    const collision = (n, where) => {
      throw new SchemaError(
        [{field: n, error: 'collision', message: n + ' collides with ' + where}],
        this.name, this.kind);
    };
    const noteCollision = (n) => {
      if (fields.has(n)) collision(n, 'field');
      if (methods.has(n)) collision(n, 'method');
      if (computed.has(n)) collision(n, 'computed');
      if (hooks.has(n)) collision(n, 'hook');
      if (relations.has(n)) collision(n, 'relation');
      if (this.kind === 'model' && __SCHEMA_RESERVED.has(n)) collision(n, 'reserved ORM name');
    };

    for (const e of this._desc.entries) {
      switch (e.tag) {
        case 'field':
          noteCollision(e.name);
          fields.set(e.name, {
            name: e.name,
            required: e.modifiers.includes('!'),
            unique: e.modifiers.includes('#'),
            optional: e.modifiers.includes('?'),
            typeName: e.typeName,
            literals: e.literals || null,
            array: e.array === true,
            constraints: e.constraints || null,
            transform: e.transform || null,
          });
          break;
        case 'method':
          noteCollision(e.name);
          methods.set(e.name, e.fn);
          break;
        case 'computed':
          noteCollision(e.name);
          computed.set(e.name, e.fn);
          break;
        case 'derived':
          noteCollision(e.name);
          derived.set(e.name, e.fn);
          break;
        case 'hook':
          if (hooks.has(e.name)) collision(e.name, 'duplicate hook');
          hooks.set(e.name, e.fn);
          break;
        case 'directive': {
          directives.push({ name: e.name, args: e.args || [] });
          // @mixin is recorded but further handling is deferred to the
          // post-pass so we can dedupe diamond includes and detect
          // cycles with a full expansion stack. All other directives
          // get their relation / timestamps / softDelete processing now.
          if (e.name === 'mixin') break;
          if (e.name === 'timestamps') timestamps = true;
          if (e.name === 'softDelete') softDelete = true;
          const rel = __schemaNormalizeDirectiveRelation(e, this.name);
          if (rel) {
            noteCollision(rel.accessor);
            relations.set(rel.accessor, rel);
          }
          break;
        }
        case 'enum-member':
          enumMembers.set(e.name, e.value !== undefined ? e.value : e.name);
          break;
        case 'ensure':
          // @ensure entries are schema-level invariants (cross-field
          // predicates). Declaration order is preserved so diagnostics
          // come out in the order authored.
          ensures.push({ message: e.message, fn: e.fn });
          break;
      }
    }

    // @mixin expansion (Phase 5). Depth-first, dedupes diamond includes
    // in the same host expansion, detects cycles with full chain.
    if (this.kind === 'model' || this.kind === 'shape' || this.kind === 'input' ||
        this.kind === 'mixin') {
      __schemaExpandMixins(this, fields, directives, {
        stack: [this.name || '<anon>'],
        seen: new Set([this.name || '<anon>']),
        onCollision: (name, src) => collision(name, 'mixin-included field from ' + src),
      });
    }

    // Add implicit primary key for :model unless a field already marked primary.
    const primaryKey = 'id';
    const tableName = this.kind === 'model' ? __schemaTableName(this.name) : null;

    this._norm = {
      fields, methods, computed, derived, hooks, directives, enumMembers, relations,
      ensures,
      timestamps, softDelete, primaryKey, tableName,
    };
    return this._norm;
  }

  // Run eager-derived entries (!>) — one pass, in declaration order.
  //
  // Invariants worth keeping in mind here:
  //   - Fires at parse/safe time AND at DB hydrate time (declared fields
  //     are populated by then in both paths).
  //   - NOT re-run on field mutation — the value is materialized once at
  //     instance creation and stays. Use ~> for live recomputation.
  //   - Stored as own enumerable properties, so they round-trip through
  //     Object.keys and JSON.stringify. Excluded from DB persistence by
  //     _getSaveableData (writes declared fields only).
  //   - Thrown errors propagate. parse() wraps them into SchemaError
  //     before surfacing; safe() captures into {error: 'derived'}
  //     issues; hydrate lets them crash fast as data-integrity signals.
  _applyEagerDerived(inst) {
    const norm = this._normalize();
    if (!norm.derived.size) return;
    for (const [n, fn] of norm.derived) {
      const v = fn.call(inst);
      Object.defineProperty(inst, n, {
        value: v, enumerable: true, writable: true, configurable: true,
      });
    }
  }

  // Run '@ensure' predicates — schema-level cross-field invariants —
  // against a fully-typed, fully-defaulted data object. Returns [] if
  // all pass, or an array of {field: '', error: 'ensure', message}
  // issues for every failing predicate.
  //
  // Naming: '_applyEnsures' mirrors '_applyTransforms' and
  // '_applyEagerDerived' — runtime method name matches the directive
  // it services. The industry term for this pattern is 'refinement'
  // (Zod's '.refine', design-by-contract postconditions); in Rip the
  // user-visible name is '@ensure' and the code tracks that.
  //
  // Semantics:
  //   - Truthy return → pass; falsy → fail with the declared message.
  //   - Thrown exception → fail with the declared message (the thrown
  //     error's own message is used only if the @ensure declared no
  //     message, which can't happen via the parser since message is
  //     required — but downstream code-built defs might omit it).
  //   - All @ensures run; declaration order preserved in output.
  //   - Caller short-circuits: per-field validation errors skip this
  //     step entirely (predicates assume field types are correct).
  //   - Skipped on _hydrate — trusted DB data bypasses @ensures.
  _applyEnsures(data) {
    const norm = this._normalize();
    if (!norm.ensures.length) return [];
    const errs = [];
    for (const r of norm.ensures) {
      let ok = false;
      try {
        ok = !!r.fn(data);
      } catch (e) {
        errs.push({
          field: '', error: 'ensure',
          message: r.message || e?.message || 'ensure failed',
        });
        continue;
      }
      if (!ok) {
        errs.push({
          field: '', error: 'ensure',
          message: r.message || 'ensure failed',
        });
      }
    }
    return errs;
  }

  _getClass() {
    if (this._klass) return this._klass;
    const norm = this._normalize();
    const name = this.name || 'Schema';
    const def = this;

    const fieldNames = [...norm.fields.keys()];
    const klass = ({[name]: class {
      constructor(data, persisted = false) {
        // Internal state is non-enumerable so Object.keys(inst) lists
        // only declared fields that received a value.
        Object.defineProperty(this, '_dirty', { value: new Set(), enumerable: false, writable: false, configurable: true });
        Object.defineProperty(this, '_persisted', { value: persisted === true, enumerable: false, writable: true, configurable: true });
        Object.defineProperty(this, '_snapshot', { value: null, enumerable: false, writable: true, configurable: true });
        if (data && typeof data === 'object') {
          for (const k of fieldNames) {
            if (k in data && data[k] !== undefined) this[k] = data[k];
          }
        }
      }
    }})[name];

    for (const [n, fn] of norm.methods) {
      Object.defineProperty(klass.prototype, n, {
        value: fn, writable: true, enumerable: false, configurable: true,
      });
    }
    for (const [n, fn] of norm.computed) {
      Object.defineProperty(klass.prototype, n, {
        get: fn, enumerable: false, configurable: true,
      });
    }

    // Relation methods: user.organization(). Accepts no args; returns
    // a promise to a target-model instance (or array for has_many).
    for (const [acc, rel] of norm.relations) {
      Object.defineProperty(klass.prototype, acc, {
        enumerable: false, configurable: true,
        value: async function() { return __schemaResolveRelation(def, this, rel); },
      });
    }

    // Instance ORM methods — only for :model kind.
    if (this.kind === 'model') {
      Object.defineProperty(klass.prototype, 'save', {
        enumerable: false, configurable: true, writable: true,
        value: async function() { return __schemaSave(def, this); },
      });
      Object.defineProperty(klass.prototype, 'destroy', {
        enumerable: false, configurable: true, writable: true,
        value: async function() { return __schemaDestroy(def, this); },
      });
      Object.defineProperty(klass.prototype, 'ok', {
        enumerable: false, configurable: true, writable: true,
        value: function() { return def._validateFields(this, false); },
      });
      Object.defineProperty(klass.prototype, 'errors', {
        enumerable: false, configurable: true, writable: true,
        value: function() { return def._validateFields(this, true); },
      });
      // toJSON mirrors the instance's own enumerable properties, which by
      // construction are: the primary key, declared fields, @timestamps
      // columns, @softDelete timestamp, @belongs_to FK columns, and any
      // !> eager-derived fields. Internal state (_dirty, _persisted,
      // _snapshot) is defined non-enumerable; methods and ~> computed
      // getters live on the prototype. So iterating own keys picks up
      // exactly the user-facing wire shape without special-casing each
      // category — and stays correct when new implicit columns get added
      // to the runtime.
      Object.defineProperty(klass.prototype, 'toJSON', {
        enumerable: false, configurable: true, writable: true,
        value: function() {
          const out = {};
          for (const k of Object.keys(this)) out[k] = this[k];
          return out;
        },
      });
    }

    this._klass = klass;
    return klass;
  }

  _hydrate(columns, row) {
    // DB rows are trusted: hydrate into a class instance without
    // revalidating. Column names arrive snake_case; declared fields live
    // under their camelCase names, and implicit columns (id, created_at,
    // updated_at, relation FKs) surface under their camelCase equivalents.
    // Each snake_case column name also aliases the camelCase property via
    // a non-enumerable accessor so order.user_id and order.userId read
    // the same slot — useful when DB column names leak into user code
    // via raw SQL helpers.
    const data = {};
    for (let i = 0; i < columns.length; i++) {
      data[__schemaCamel(columns[i].name)] = row[i];
    }
    const k = this._getClass();
    const inst = new k(data, true);
    for (const key of Object.keys(data)) {
      if (!(key in inst)) {
        Object.defineProperty(inst, key, {
          value: data[key], enumerable: true, writable: true, configurable: true,
        });
      }
    }
    for (let i = 0; i < columns.length; i++) {
      const snake = columns[i].name;
      const camel = __schemaCamel(snake);
      if (snake !== camel && !(snake in inst)) {
        Object.defineProperty(inst, snake, {
          enumerable: false, configurable: true,
          get() { return this[camel]; },
          set(v) { this[camel] = v; },
        });
      }
    }
    // Eager-derived fields re-run on hydrate — they're not persisted
    // and must be re-computed from the declared fields now present.
    this._applyEagerDerived(inst);
    return inst;
  }

  _validateFields(data, collect) {
    const norm = this._normalize();
    const errors = collect ? [] : null;
    for (const [n, f] of norm.fields) {
      const v = data == null ? undefined : data[n];
      if (v === undefined || v === null) {
        if (f.required) {
          if (!collect) return false;
          errors.push({field: n, error: 'required', message: n + ' is required'});
        }
        continue;
      }
      if (f.array) {
        if (!Array.isArray(v)) {
          if (!collect) return false;
          errors.push({field: n, error: 'type', message: n + ' must be an array'});
          continue;
        }
        let bad = false;
        for (let i = 0; i < v.length; i++) {
          const issues = __schemaValidateValue(v[i], f.typeName);
          if (issues) {
            if (!collect) return false;
            const head = n + '[' + i + ']';
            for (const e of issues) {
              const joined = __schemaJoinField(head, e.field);
              errors.push({
                field: joined,
                error: e.error,
                message: __schemaRewriteMessage(joined, e.field, e.message),
              });
            }
            bad = true;
          }
        }
        if (bad) continue;
      } else if (f.typeName === 'literal-union') {
        if (!f.literals.includes(v)) {
          if (!collect) return false;
          errors.push({field: n, error: 'enum', message: n + ' must be one of ' + f.literals.map(l => JSON.stringify(l)).join(', ')});
          continue;
        }
      } else {
        const issues = __schemaValidateValue(v, f.typeName);
        if (issues) {
          if (!collect) return false;
          for (const e of issues) {
            const joined = __schemaJoinField(n, e.field);
            errors.push({
              field: joined,
              error: e.error,
              message: __schemaRewriteMessage(joined, e.field, e.message),
            });
          }
          continue;
        }
      }
      // Apply constraint checks.
      const c = f.constraints;
      if (c) {
        if (typeof v === 'string') {
          if (c.min != null && v.length < c.min) { if (!collect) return false; errors.push({field: n, error: 'min', message: n + ' must be at least ' + c.min + ' chars'}); }
          if (c.max != null && v.length > c.max) { if (!collect) return false; errors.push({field: n, error: 'max', message: n + ' must be at most ' + c.max + ' chars'}); }
          if (c.regex && !c.regex.test(v)) { if (!collect) return false; errors.push({field: n, error: 'pattern', message: n + ' is invalid'}); }
        } else if (typeof v === 'number') {
          if (c.min != null && v < c.min) { if (!collect) return false; errors.push({field: n, error: 'min', message: n + ' must be >= ' + c.min}); }
          if (c.max != null && v > c.max) { if (!collect) return false; errors.push({field: n, error: 'max', message: n + ' must be <= ' + c.max}); }
        }
      }
    }
    return collect ? errors : true;
  }

  _applyDefaults(data) {
    const norm = this._normalize();
    for (const [n, f] of norm.fields) {
      if ((data[n] === undefined || data[n] === null) && f.constraints?.default !== undefined) {
        const d = f.constraints.default;
        data[n] = (typeof d === 'object' && d !== null && !(d instanceof RegExp))
          ? structuredClone(d) : d;
      }
    }
    return data;
  }

  // Inline field transforms run once during parse (and safe/ok), never
  // during DB hydrate. Each transform receives the whole raw input
  // object as 'it'; its return value becomes the field's candidate
  // value before default + validation. Transform errors surface as
  // {error: 'transform'} issues on the final result.
  _applyTransforms(raw, working) {
    const norm = this._normalize();
    const errors = [];
    for (const [n, f] of norm.fields) {
      if (!f.transform) continue;
      try {
        working[n] = f.transform(raw);
      } catch (e) {
        errors.push({field: n, error: 'transform', message: e?.message || String(e)});
      }
    }
    return errors;
  }

  _validateEnum(data, collect) {
    const norm = this._normalize();
    for (const [n, v] of norm.enumMembers) {
      if (data === n || data === v) return collect ? [] : true;
    }
    if (!collect) return false;
    const members = [...norm.enumMembers.keys()].join(', ');
    return [{field: '', error: 'enum', message: (this.name || 'enum') + ' expected one of: ' + members}];
  }

  _materializeEnum(data) {
    const norm = this._normalize();
    for (const [n, v] of norm.enumMembers) {
      if (data === n || data === v) return v;
    }
    return data;
  }

  // Canonical field parse pipeline — run per-field in declaration order,
  // then an after-fields pass for eager-derived. This is the SINGLE
  // source of truth for parse-time field semantics; _hydrate bypasses
  // steps 1-5 entirely (DB rows arrive canonical) and picks up at step 7.
  //
  //   1. Obtain raw candidate   — transform(raw) if declared, else raw[name]
  //   2. Apply default          — if candidate missing/undefined
  //   3. Required check         — optional/required/nullability
  //   4. Type validation        — primitive / literal-union / array
  //   5. Constraint checks      — range, regex, attrs
  //   6. Assign to instance     — own enumerable property
  //   7. Eager-derived pass     — run !> entries in declaration order
  //
  // Transforms (step 1) run on parse/safe/ok only. Hydrate skips them
  // because DB columns already hold the canonical values. Eager-derived
  // (step 7) fires on BOTH paths so hydrated instances have the same
  // shape as parsed ones.
  parse(data) {
    if (this.kind === 'mixin') {
      throw new Error(":mixin schema '" + (this.name || 'anon') + "' is not instantiable");
    }
    if (this.kind === 'enum') {
      const errs = this._validateEnum(data, true);
      if (errs.length) throw new SchemaError(errs, this.name, this.kind);
      return this._materializeEnum(data);
    }
    const raw = data || {};
    const working = { ...raw };
    const transformErrors = this._applyTransforms(raw, working);
    this._applyDefaults(working);
    const errs = transformErrors.concat(this._validateFields(working, true));
    if (errs.length) throw new SchemaError(errs, this.name, this.kind);
    // @ensure runs AFTER per-field validation so predicates can
    // assume declared fields are typed and defaulted. A field-level
    // failure short-circuits: we never reach this line with errs.
    const ensureErrs = this._applyEnsures(working);
    if (ensureErrs.length) throw new SchemaError(ensureErrs, this.name, this.kind);
    const klass = this._getClass();
    const inst = new klass(working, false);
    this._applyEagerDerived(inst);
    return inst;
  }

  safe(data) {
    if (this.kind === 'mixin') {
      return {ok: false, value: null, errors: [{field: '', error: 'mixin', message: 'not instantiable'}]};
    }
    if (this.kind === 'enum') {
      const errs = this._validateEnum(data, true);
      if (errs.length) return {ok: false, value: null, errors: errs};
      return {ok: true, value: this._materializeEnum(data), errors: null};
    }
    const raw = data || {};
    const working = { ...raw };
    const transformErrors = this._applyTransforms(raw, working);
    this._applyDefaults(working);
    const errs = transformErrors.concat(this._validateFields(working, true));
    if (errs.length) return {ok: false, value: null, errors: errs};
    const ensureErrs = this._applyEnsures(working);
    if (ensureErrs.length) return {ok: false, value: null, errors: ensureErrs};
    const klass = this._getClass();
    const inst = new klass(working, false);
    try { this._applyEagerDerived(inst); }
    catch (e) {
      return {ok: false, value: null, errors: [{field: '', error: 'derived', message: e?.message || String(e)}]};
    }
    return {ok: true, value: inst, errors: null};
  }

  ok(data) {
    if (this.kind === 'mixin') return false;
    if (this.kind === 'enum') return this._validateEnum(data, false);
    const raw = data || {};
    const working = { ...raw };
    const transformErrors = this._applyTransforms(raw, working);
    if (transformErrors.length) return false;
    this._applyDefaults(working);
    if (!this._validateFields(working, false)) return false;
    // Per-field validation passed — @ensure predicates are the final gate.
    return this._applyEnsures(working).length === 0;
  }

  // ---- :model static ORM methods --------------------------------------------

  async find(id) {
    this._assertModel('find');
    const norm = this._normalize();
    const soft = norm.softDelete ? ' AND "deleted_at" IS NULL' : '';
    const sql = 'SELECT * FROM "' + norm.tableName + '" WHERE "' + norm.primaryKey + '" = ?' + soft + ' LIMIT 1';
    const res = await __schemaAdapter.query(sql, [id]);
    if (!res.rows) return null;
    return this._hydrate(res.columns, res.data[0]);
  }

  where(cond, ...params) {
    this._assertModel('where');
    return new __SchemaQuery(this).where(cond, ...params);
  }

  all() {
    this._assertModel('all');
    return new __SchemaQuery(this).all();
  }

  first() {
    this._assertModel('first');
    return new __SchemaQuery(this).first();
  }

  count() {
    this._assertModel('count');
    return new __SchemaQuery(this).count();
  }

  async create(data) {
    this._assertModel('create');
    // Input keys may be snake_case or camelCase; the runtime
    // canonicalizes to camelCase so instance properties line up with
    // declared field names.
    const klass = this._getClass();
    const canonical = {};
    if (data && typeof data === 'object') {
      for (const k of Object.keys(data)) canonical[__schemaCamel(k)] = data[k];
    }
    const inst = new klass(this._applyDefaults(canonical), false);
    // FK columns like user_id canonicalize to userId and need to
    // round-trip through the INSERT path, so attach them as own
    // properties even though they aren't declared fields.
    for (const [k, v] of Object.entries(canonical)) {
      if (!(k in inst)) {
        Object.defineProperty(inst, k, { value: v, enumerable: true, writable: true, configurable: true });
      }
    }
    await __schemaSave(this, inst);
    return inst;
  }

  toSQL(options) {
    this._assertModel('toSQL');
    return __schemaToSQL(this, options);
  }

  _assertModel(api) {
    if (this.kind !== 'model') {
      throw new Error('schema: .' + api + '() is :model-only (got :' + this.kind + ')');
    }
  }

  // ---- Schema algebra (Phase 6) --------------------------------------------
  // Invariant: every algebra operation returns a :shape. Model algebra
  // strips ORM; :shape algebra drops behavior. Derived shapes preserve
  // field metadata (constraints, defaults, modifiers) from the source
  // normalized descriptor.

  pick(...keys) {
    return __schemaDerive(this, (src) => {
      const names = __schemaFlatten(keys);
      const out = new Map();
      for (const k of names) {
        if (!src.has(k)) throw new Error("pick: unknown field '" + k + "' on " + (this.name || 'schema'));
        out.set(k, src.get(k));
      }
      return out;
    });
  }

  omit(...keys) {
    return __schemaDerive(this, (src) => {
      const drop = new Set(__schemaFlatten(keys));
      const out = new Map();
      for (const [k, v] of src) if (!drop.has(k)) out.set(k, v);
      return out;
    });
  }

  partial() {
    return __schemaDerive(this, (src) => {
      const out = new Map();
      for (const [k, v] of src) out.set(k, { ...v, required: false });
      return out;
    });
  }

  required(...keys) {
    return __schemaDerive(this, (src) => {
      const req = new Set(__schemaFlatten(keys));
      const out = new Map();
      for (const [k, v] of src) out.set(k, { ...v, required: req.has(k) ? true : v.required });
      return out;
    });
  }

  extend(other) {
    if (!(other instanceof __SchemaDef)) {
      throw new Error('extend(): argument must be a schema value');
    }
    return __schemaDerive(this, (src) => {
      const merged = new Map(src);
      const otherFields = other._normalize().fields;
      for (const [k, v] of otherFields) {
        if (merged.has(k)) {
          throw new Error("extend(): field '" + k + "' collides between " + (this.name || 'schema') + " and " + (other.name || 'other'));
        }
        merged.set(k, v);
      }
      return merged;
    });
  }
}

function __schemaFlatten(keys) {
  const out = [];
  for (const k of keys) {
    if (typeof k === 'symbol') out.push(Symbol.keyFor(k) || k.description);
    else if (Array.isArray(k)) for (const kk of k) out.push(typeof kk === 'symbol' ? (Symbol.keyFor(kk) || kk.description) : kk);
    else out.push(k);
  }
  return out;
}

// Schema algebra — .pick / .omit / .partial / .required / .extend all
// land here. The v2 invariants encoded in this function:
//
//   - Derived schemas are always kind: 'shape', regardless of source kind.
//     ORM surface on :model is dropped.
//   - Field semantics SURVIVE algebra: type, literals, constraints,
//     inline transforms. Transforms-survive means a derived schema can
//     still read raw-input keys that aren't in its declared output shape.
//   - Instance behavior DOES NOT survive: methods, computed (~>), eager
//     derived (!>), and hooks all get dropped because the rebuilt
//     descriptor has no callable entries.
//   - _sourceModel propagates through chained algebra so tooling can
//     trace derived shapes back to the origin :model.
function __schemaDerive(source, transform) {
  const src = source._normalize().fields;
  const derivedFields = transform(src);
  const entries = [];
  for (const [, f] of derivedFields) {
    const mods = [];
    if (f.required) mods.push('!');
    if (f.unique) mods.push('#');
    if (f.optional && !f.required) mods.push('?');
    entries.push({
      tag: 'field', name: f.name, modifiers: mods,
      typeName: f.typeName, array: f.array,
      literals: f.literals || null,
      constraints: f.constraints,
      transform: f.transform || null,
    });
  }
  const name = (source.name || 'Schema') + 'Derived';
  const derived = new __SchemaDef({ kind: 'shape', name, entries });
  // sourceModel propagates through chained algebra. Tooling can follow
  // the chain back to the original :model for projection hints.
  derived._sourceModel = source._sourceModel || (source.kind === 'model' ? source : null);
  return derived;
}

function __schemaCamel(col) { return String(col).replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }

function __schemaNormalizeDirectiveRelation(directive, ownerModel) {
  const args = directive.args;
  if (!args || !args.length) return null;
  const a = args[0];
  const name = directive.name;
  if (name === 'belongs_to') {
    const targetLc = a.target[0].toLowerCase() + a.target.slice(1);
    return { kind: 'belongsTo', target: a.target, accessor: targetLc, foreignKey: __schemaFkName(a.target), optional: !!a.optional };
  }
  if (name === 'has_one' || name === 'one') {
    const targetLc = a.target[0].toLowerCase() + a.target.slice(1);
    return { kind: 'hasOne', target: a.target, accessor: targetLc, foreignKey: __schemaFkName(ownerModel), optional: !!a.optional };
  }
  if (name === 'has_many' || name === 'many') {
    const targetLc = a.target[0].toLowerCase() + a.target.slice(1);
    return { kind: 'hasMany', target: a.target, accessor: __schemaPluralize(targetLc), foreignKey: __schemaFkName(ownerModel), optional: !!a.optional };
  }
  return null;
}

function __schemaExpandMixins(host, fields, directives, ctx) {
  for (const d of directives) {
    if (d.name !== 'mixin' || !d.args || !d.args[0]) continue;
    const target = d.args[0].target;
    if (!target) continue;
    if (ctx.stack.includes(target)) {
      throw new SchemaError(
        [{field: '', error: 'mixin-cycle', message: 'mixin cycle: ' + ctx.stack.concat(target).join(' -> ')}],
        host.name, host.kind);
    }
    if (ctx.seen.has(target)) continue;
    const mx = __SchemaRegistry.getKind(target, 'mixin');
    if (!mx) {
      throw new SchemaError(
        [{field: '', error: 'mixin-missing', message: 'unknown mixin: ' + target}],
        host.name, host.kind);
    }
    ctx.seen.add(target);
    ctx.stack.push(target);
    // Recurse into nested mixins first (depth-first).
    const childDirectives = mx._desc.entries.filter(e => e.tag === 'directive' && e.name === 'mixin')
      .map(e => ({ name: e.name, args: e.args || [] }));
    __schemaExpandMixins(host, fields, childDirectives, ctx);
    // Then contribute the mixin's own fields.
    for (const e of mx._desc.entries) {
      if (e.tag !== 'field') continue;
      if (fields.has(e.name)) {
        throw new SchemaError(
          [{field: e.name, error: 'mixin-collision', message: e.name + ' from mixin ' + target + ' collides with existing field'}],
          host.name, host.kind);
      }
      fields.set(e.name, {
        name: e.name,
        required: e.modifiers.includes('!'),
        unique: e.modifiers.includes('#'),
        optional: e.modifiers.includes('?'),
        typeName: e.typeName,
        literals: e.literals || null,
        array: e.array === true,
        constraints: e.constraints || null,
        transform: e.transform || null,
      });
    }
    ctx.stack.pop();
  }
}

async function __schemaResolveRelation(def, inst, rel) {
  const target = __SchemaRegistry.get(rel.target);
  if (!target) throw new Error('schema: unknown relation target "' + rel.target + '" from ' + (def.name || 'anon'));
  const pk = def._normalize().primaryKey;
  if (rel.kind === 'belongsTo') {
    const fk = inst[__schemaCamel(rel.foreignKey)];
    return fk != null ? await target.find(fk) : null;
  }
  if (rel.kind === 'hasOne') {
    return await target.where({ [rel.foreignKey]: inst[pk] }).first();
  }
  if (rel.kind === 'hasMany') {
    return await target.where({ [rel.foreignKey]: inst[pk] }).all();
  }
  return null;
}

// ---- Save / Destroy --------------------------------------------------------
// Rails-style lifecycle (D18):
//   beforeValidation -> validate -> afterValidation ->
//   beforeSave -> (beforeCreate|beforeUpdate) -> INSERT/UPDATE ->
//   (afterCreate|afterUpdate) -> afterSave
// Destroy:
//   beforeDestroy -> DELETE -> afterDestroy

async function __schemaRunHook(def, inst, name) {
  const fn = def._normalize().hooks.get(name);
  if (fn) await fn.call(inst);
}

async function __schemaSave(def, inst) {
  const norm = def._normalize();
  const isNew = !inst._persisted;

  await __schemaRunHook(def, inst, 'beforeValidation');
  const errs = def._validateFields(inst, true);
  if (errs.length) throw new SchemaError(errs, def.name, def.kind);
  await __schemaRunHook(def, inst, 'afterValidation');

  await __schemaRunHook(def, inst, 'beforeSave');
  if (isNew) await __schemaRunHook(def, inst, 'beforeCreate');
  else       await __schemaRunHook(def, inst, 'beforeUpdate');

  if (isNew) {
    const cols = [], placeholders = [], values = [];
    for (const [n, f] of norm.fields) {
      const v = inst[n];
      if (v == null) continue;
      cols.push('"' + __schemaSnake(n) + '"');
      placeholders.push('?');
      values.push(__schemaSerialize(v, f));
    }
    // Include relation FKs. belongsTo FKs are camelCase properties on
    // the instance (e.g. organizationId for organization_id).
    for (const [, rel] of norm.relations) {
      if (rel.kind !== 'belongsTo') continue;
      const fkCamel = __schemaCamel(rel.foreignKey);
      const v = inst[fkCamel];
      if (v != null) {
        cols.push('"' + rel.foreignKey + '"');
        placeholders.push('?');
        values.push(v);
      }
    }
    const sql = 'INSERT INTO "' + norm.tableName + '" (' + cols.join(', ') + ') VALUES (' + placeholders.join(', ') + ') RETURNING *';
    const res = await __schemaAdapter.query(sql, values);
    if (res.data?.[0] && res.columns) {
      for (let i = 0; i < res.columns.length; i++) {
        const snake = res.columns[i].name;
        const key = __schemaCamel(snake);
        if (!(key in inst)) {
          Object.defineProperty(inst, key, { value: res.data[0][i], enumerable: true, writable: true, configurable: true });
        } else {
          inst[key] = res.data[0][i];
        }
        if (snake !== key && !(snake in inst)) {
          Object.defineProperty(inst, snake, {
            enumerable: false, configurable: true,
            get() { return this[key]; },
            set(v) { this[key] = v; },
          });
        }
      }
    }
    // Now that the RETURNING columns (id, @timestamps, FKs) are on the
    // instance, !> eager-derived fields can see them. Mirrors the hydrate
    // path, which runs _applyEagerDerived once all declared fields are
    // populated. Per-docs semantics ("materialize once, not reactive")
    // still hold — we're firing once, at end of construction, not on
    // subsequent mutations.
    def._applyEagerDerived(inst);
    inst._persisted = true;
  } else {
    const sets = [], values = [];
    for (const [n, f] of norm.fields) {
      sets.push('"' + __schemaSnake(n) + '" = ?');
      values.push(__schemaSerialize(inst[n], f));
    }
    if (sets.length) {
      const pk = norm.primaryKey;
      values.push(inst[pk]);
      const sql = 'UPDATE "' + norm.tableName + '" SET ' + sets.join(', ') + ' WHERE "' + pk + '" = ?';
      await __schemaAdapter.query(sql, values);
    }
  }
  inst._dirty.clear();

  if (isNew) await __schemaRunHook(def, inst, 'afterCreate');
  else       await __schemaRunHook(def, inst, 'afterUpdate');
  await __schemaRunHook(def, inst, 'afterSave');
  return inst;
}

async function __schemaDestroy(def, inst) {
  if (!inst._persisted) return inst;
  const norm = def._normalize();
  await __schemaRunHook(def, inst, 'beforeDestroy');
  if (norm.softDelete) {
    const now = new Date().toISOString();
    await __schemaAdapter.query('UPDATE "' + norm.tableName + '" SET "deleted_at" = ? WHERE "' + norm.primaryKey + '" = ?', [now, inst[norm.primaryKey]]);
    inst.deletedAt = now;
  } else {
    await __schemaAdapter.query('DELETE FROM "' + norm.tableName + '" WHERE "' + norm.primaryKey + '" = ?', [inst[norm.primaryKey]]);
    inst._persisted = false;
  }
  await __schemaRunHook(def, inst, 'afterDestroy');
  return inst;
}

function __schemaSerialize(v, field) {
  if (field && field.typeName === 'json' && v != null && typeof v === 'object') {
    return JSON.stringify(v);
  }
  return v;
}

// ---- DDL emission (.toSQL) --------------------------------------------------
// Layer 4b: runs on first .toSQL() call. Independent of ORM — scripts
// that build schema from DDL never touch .find/.create.

const __SCHEMA_SQL_TYPES = {
  string: 'VARCHAR', text: 'TEXT', integer: 'INTEGER', number: 'DOUBLE',
  boolean: 'BOOLEAN', date: 'DATE', datetime: 'TIMESTAMP', email: 'VARCHAR',
  url: 'VARCHAR', uuid: 'UUID', phone: 'VARCHAR', zip: 'VARCHAR', json: 'JSON', any: 'JSON',
};

function __schemaToSQL(def, options) {
  const opts = options || {};
  const { dropFirst = false, header } = opts;
  const norm = def._normalize();
  const blocks = [];
  if (header) blocks.push(header);

  const table = norm.tableName;
  const seq = table + '_seq';
  if (dropFirst) {
    blocks.push('DROP TABLE IF EXISTS ' + table + ' CASCADE;\\nDROP SEQUENCE IF EXISTS ' + seq + ';');
  }

  // Sequence seed: explicit option wins over @idStart directive wins over 1.
  // DuckDB 1.5.2 does not implement ALTER SEQUENCE ... RESTART WITH N, so the
  // baseline has to be set at creation — hence the knob lives here, not in a
  // post-create migration.
  let idStart = 1;
  for (const d of norm.directives) {
    if (d.name === 'idStart' && d.args?.[0] && Number.isInteger(d.args[0].value)) {
      idStart = d.args[0].value;
    }
  }
  if (opts.idStart !== undefined) {
    if (!Number.isInteger(opts.idStart)) {
      throw new Error('schema.toSQL(): idStart must be an integer; got ' + String(opts.idStart));
    }
    idStart = opts.idStart;
  }

  const columns = [];
  const indexes = [];
  columns.push('  ' + norm.primaryKey + " INTEGER PRIMARY KEY DEFAULT nextval('" + seq + "')");

  for (const [n, f] of norm.fields) {
    columns.push(__schemaColumnDDL(n, f));
    if (f.unique) {
      indexes.push('CREATE UNIQUE INDEX idx_' + table + '_' + __schemaSnake(n) + ' ON ' + table + ' ("' + __schemaSnake(n) + '");');
    }
  }

  for (const [, rel] of norm.relations) {
    if (rel.kind !== 'belongsTo') continue;
    const refTable = __schemaTableName(rel.target);
    const notNull = rel.optional ? '' : ' NOT NULL';
    columns.push('  ' + rel.foreignKey + ' INTEGER' + notNull + ' REFERENCES ' + refTable + '(id)');
  }

  if (norm.timestamps) {
    columns.push('  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    columns.push('  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  }
  if (norm.softDelete) {
    columns.push('  deleted_at TIMESTAMP');
  }

  // @index directives
  for (const d of norm.directives) {
    if (d.name !== 'index') continue;
    const ixArgs = d.args?.[0] || {};
    const fields = (ixArgs.fields || []).map(__schemaSnake);
    if (!fields.length) continue;
    const u = ixArgs.unique ? 'UNIQUE ' : '';
    indexes.push('CREATE ' + u + 'INDEX idx_' + table + '_' + fields.join('_') + ' ON ' + table + ' (' + fields.map(f => '"' + f + '"').join(', ') + ');');
  }

  blocks.push('CREATE SEQUENCE ' + seq + ' START ' + idStart + ';');
  blocks.push('CREATE TABLE ' + table + ' (\\n' + columns.join(',\\n') + '\\n);');
  if (indexes.length) blocks.push(indexes.join('\\n'));

  return blocks.join('\\n\\n') + '\\n';
}

function __schemaColumnDDL(name, field) {
  let base = __SCHEMA_SQL_TYPES[field.typeName] || 'VARCHAR';
  if (field.array) base = 'JSON';
  if (base === 'VARCHAR' && field.constraints?.max != null) {
    base = 'VARCHAR(' + field.constraints.max + ')';
  }
  const parts = ['  ' + __schemaSnake(name) + ' ' + base];
  if (field.required) parts.push('NOT NULL');
  if (field.unique) parts.push('UNIQUE');
  if (field.constraints?.default !== undefined) {
    parts.push('DEFAULT ' + __schemaSQLDefault(field.constraints.default));
  }
  return parts.join(' ');
}

function __schemaSQLDefault(v) {
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (v === null) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return "'" + v.replace(/'/g, "''") + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function __schema(descriptor) {
  const def = new __SchemaDef(descriptor);
  // Every user-declared named schema lands in the registry so
  // nested-typed fields (address! Address, items! OrderItem[],
  // role! Role) can resolve their type reference at validate time.
  // Algebra-derived schemas (.pick/.omit/.partial/…) bypass this
  // factory so their synthetic names don't shadow the source.
  if (def.name) __SchemaRegistry.register(def);
  return def;
}

  const exports = {
    __schema, SchemaError, __SchemaRegistry, __schemaSetAdapter,
    __version: 1,
  };
  if (typeof globalThis !== 'undefined') globalThis.__ripSchema = exports;
  return exports;
})();

// === End Schema Runtime ===
`;
