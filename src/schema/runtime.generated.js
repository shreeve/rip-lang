// AUTOGEN-NOTICE: do not edit by hand. Regenerate with:
//   bun scripts/build-schema-runtime.js
//   (or: bun run build:schema-runtime)
//
// Source fragments:
//   src/schema/runtime-validate.js       (universal — browser + server)
//   src/schema/runtime-db-naming.js      (server + migration)
//   src/schema/runtime-orm.js            (server + migration)
//   src/schema/runtime-ddl.js            (migration only)
//   src/schema/runtime-migrate.js        (migration only)
//   src/schema/runtime-browser-stubs.js  (browser only)
//
// CI: bun scripts/build-schema-runtime.js --check fails if this file
// would change after regeneration. Edit the fragments, run the build
// script, and commit.

export const SCHEMA_RUNTIME_ABI_VERSION = 1;

export const SCHEMA_RUNTIME_WRAPPER_HEAD = `
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

`;
export const SCHEMA_RUNTIME_WRAPPER_TAIL = `
  // __schemaSetAdapter / __schemaTransaction are server/migration-only.
  // In validate mode they don't exist (browser mode stubs transaction);
  // export undefined / throwing slots so destructure works everywhere.
  const __schemaSetAdapterExport = typeof __schemaSetAdapter !== 'undefined'
    ? __schemaSetAdapter
    : undefined;
  const __schemaTransactionExport = typeof __schemaTransaction !== 'undefined'
    ? __schemaTransaction
    : function() {
        throw new Error('schema.transaction() requires the server schema runtime (validate-only runtime loaded).');
      };
  // Migration surface is migration-mode-only; export throwing slots in
  // other modes so the namespace shape is stable everywhere.
  const __schemaMigrationStub = (api) => function() {
    throw new Error('schema.' + api + '() requires the migration schema runtime (CLI / rip schema); it is not part of the ' +
      'validate/browser/server runtime modes.');
  };
  // User-facing namespace: schema.transaction! -> ... in Rip source
  // resolves through this object (installed as a global alongside the
  // other Rip stdlib globals; ??= keeps user overrides intact).
  const __schemaConnectExport = typeof __schemaConnect !== 'undefined'
    ? __schemaConnect
    : function() {
        throw new Error('schema.connect() requires the server schema runtime (validate/browser-only runtime loaded).');
      };
  const schemaNamespace = {
    transaction: __schemaTransactionExport,
    connect:    __schemaConnectExport,
    registerCoercer: __schemaRegisterCoercer,
    plan:       typeof __schemaPlan       !== 'undefined' ? __schemaPlan       : __schemaMigrationStub('plan'),
    status:     typeof __schemaStatus     !== 'undefined' ? __schemaStatus     : __schemaMigrationStub('status'),
    make:       typeof __schemaMake       !== 'undefined' ? __schemaMake       : __schemaMigrationStub('make'),
    migrate:    typeof __schemaMigrate    !== 'undefined' ? __schemaMigrate    : __schemaMigrationStub('migrate'),
    introspect: typeof __schemaIntrospect !== 'undefined' ? __schemaIntrospect : __schemaMigrationStub('introspect'),
  };
  const exports = {
    __schema, SchemaError, __SchemaRegistry,
    __schemaSetAdapter: __schemaSetAdapterExport,
    __schemaTransaction: __schemaTransactionExport,
    __schemaRegisterCoercer,
    schema: schemaNamespace,
    __version: 1,
  };
  if (typeof globalThis !== 'undefined') {
    globalThis.__ripSchema = exports;
    globalThis.schema ??= schemaNamespace;
  }
  return exports;
})();

// === End Schema Runtime ===
`;

export const SCHEMA_VALIDATE_RUNTIME       = `class SchemaError extends Error {
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

const __SCHEMA_RESERVED_STATIC = new Set([
  'parse','array','safe','ok','parseAsync','safeAsync','okAsync','toJSONSchema',
  'find','findMany','where','all','first','count','create','toSQL',
  'includes','upsert','insertMany','updateAll','deleteAll','withDeleted','onlyDeleted',
  'unscoped',
]);
// Names a @scope may not take: the model statics above plus the
// builder-only chain methods — scopes install on both surfaces.
const __SCHEMA_SCOPE_RESERVED = new Set([
  ...__SCHEMA_RESERVED_STATIC,
  'limit','offset','order','orderBy',
]);
const __SCHEMA_RESERVED_INSTANCE = new Set([
  'save','destroy','restore','reload','ok','errors','toJSON','savedChanges','markDirty',
  '_saving','_relMemo',
]);
// Implicit columns owned by directive-driven runtime behavior. Declaring
// them as user fields would either shadow the runtime API (savedChanges /
// markDirty in INSTANCE) or produce duplicate SET writes in the same
// UPDATE statement when @timestamps / @softDelete bump them.
const __SCHEMA_RESERVED_IMPLICIT = new Set([
  'createdAt','updatedAt','deletedAt',
]);
const __SCHEMA_RESERVED = new Set([
  ...__SCHEMA_RESERVED_STATIC,
  ...__SCHEMA_RESERVED_INSTANCE,
  ...__SCHEMA_RESERVED_IMPLICIT,
]);

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

// Strict coercion tables for the \`~type\` marker — "coerce, then
// validate". Deliberately narrow: \`~integer\` rejects "12.5" and NaN,
// \`~boolean\` accepts exactly six tokens, \`~date\` accepts ISO-8601
// strings and finite epoch numbers. A failed coercion is
// {error: 'coerce'}, distinct from {error: 'type'} — the value LOOKED
// like wire data but didn't convert, which is a different user mistake
// than sending the wrong shape entirely.
const __SCHEMA_COERCERS = {
  integer(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? { ok: true, value: v } : { ok: false };
    if (typeof v === 'string' && /^[+-]?\\d+$/.test(v.trim())) return { ok: true, value: parseInt(v.trim(), 10) };
    return { ok: false };
  },
  number(v) {
    if (typeof v === 'number') return Number.isNaN(v) ? { ok: false } : { ok: true, value: v };
    if (typeof v === 'string' && /^[+-]?(\\d+\\.?\\d*|\\.\\d+)([eE][+-]?\\d+)?$/.test(v.trim())) {
      return { ok: true, value: Number(v.trim()) };
    }
    return { ok: false };
  },
  boolean(v) {
    if (typeof v === 'boolean') return { ok: true, value: v };
    if (v === 'true' || v === '1' || v === 1) return { ok: true, value: true };
    if (v === 'false' || v === '0' || v === 0) return { ok: true, value: false };
    return { ok: false };
  },
  date(v) {
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? { ok: false } : { ok: true, value: v };
    if (typeof v === 'number' && Number.isFinite(v)) return { ok: true, value: new Date(v) };
    if (typeof v === 'string' && /^\\d{4}-\\d{2}-\\d{2}/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return { ok: true, value: d };
    }
    return { ok: false };
  },
};
__SCHEMA_COERCERS.datetime = __SCHEMA_COERCERS.date;

// Named-coercer registry for the \`~:name\` field syntax. A coercer is a
// function (wireValue) → coercedValue, where null/undefined/false means
// "didn't convert" → {error: 'coerce'}. @rip-lang/server registers its
// entire read() validator vocabulary (id, money, ssn, phone, name,
// date, …) here at module load, so every wire normalizer that works in
// \`read 'x', 'ssn'\` also works as \`x? ~:ssn\` in a schema. Apps register
// their own via schema.registerCoercer.
//
//   opts.raw — pass the value through un-stringified (validators that
//   operate on arrays/objects, e.g. the server's array/hash/json).
const __schemaNamedCoercers = new Map();

function __schemaRegisterCoercer(name, fn, opts) {
  if (typeof name !== 'string' || typeof fn !== 'function') {
    throw new Error('schema.registerCoercer(name, fn, opts?): name string and fn required');
  }
  __schemaNamedCoercers.set(name, { fn, raw: opts?.raw === true });
  return fn;
}

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
  if (subDef.kind === 'union') {
    const r = subDef._unionResolve(v);
    if (r.issue) return [r.issue];
    const memberErrs = r.def._validateFields(v, true);
    return memberErrs.length ? memberErrs : null;
  }
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    return [{field: '', error: 'type', message: 'must be a ' + typeName + ' object'}];
  }
  const subErrs = subDef._validateFields(v, true);
  return subErrs.length ? subErrs : null;
}

function __schemaJoinField(head, child) {
  if (!child) return head;
  return head + (child.startsWith('[') ? child : '.' + child);
}

function __schemaRewriteMessage(joinedField, childField, childMessage) {
  if (!childField) return joinedField + ' ' + childMessage;
  if (childMessage.startsWith(childField)) {
    return joinedField + childMessage.slice(childField.length);
  }
  return joinedField + ': ' + childMessage;
}

function __schemaSnake(s) { return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(); }

function __schemaCamel(col) { return String(col).replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }

// Reject acronym-style camelCase like \`mdmID\`, \`userOrgID\`, or
// \`XMLHttpRequest\`. Two consecutive uppercase letters break the
// snake_case <-> camelCase bijection: \`mdmID\` would round-trip via
// __schemaSnake to \`mdm_i_d\` and back via __schemaCamel to \`mdmID\`,
// while a more natural snake_case spelling \`mdm_id\` round-trips to
// \`mdmId\` (different identifier). Forcing canonical camelCase at
// schema-definition time eliminates the entire class of edge case
// in field-name resolution (markDirty, savedChanges keys, snake
// aliases on hydrate). Same convention as Active Record / Java
// Beans / Swift's "Acronyms in API names" guidance.
//
// Accepts: lowercase-first, alphanumeric body, no two consecutive
// uppercase letters anywhere.
//   ok:    name, mrn, firstName, mdmId, userOrgId, line2, a1b2
//   bad:   ID, mdmID, userID, XMLHttpRequest, _foo, 1foo, foo_bar
function __schemaValidateCanonicalName(name) {
  if (typeof name !== 'string' || !/^[a-z][a-zA-Z0-9]*$/.test(name)) return false;
  if (/[A-Z]{2,}/.test(name)) return false;
  return true;
}

// Snapshot the current values of every persisted column on an instance:
// the primary key, declared fields (from \`norm.fields\`), and \`belongsTo\`
// FK columns (from \`norm.relations\`). Used by \`_hydrate\` and the INSERT
// / UPDATE branches of \`__schemaSave\` (defined in the orm fragment,
// which loads after this one) so that a later .save() can compare and
// emit a SET only for columns the caller actually mutated. Lives in the
// validate fragment because \`_hydrate\` owns it; the orm fragment is
// the consumer.
//
// FK columns are keyed by their camelCase property name on the instance
// (e.g. \`userId\`) — same convention the dirty Set, savedChanges Map,
// and markDirty() resolver use.
//
// The primary key is captured so __schemaSave's UPDATE WHERE clause can
// target the originally-loaded row even if \`inst[pk]\` is reassigned in
// memory. PK never appears in the UPDATE SET; it's identity, not data.
function __schemaSnapshot(norm, inst) {
  const snap = Object.create(null);
  snap[norm.primaryKey] = inst[norm.primaryKey];
  for (const [n] of norm.fields) snap[n] = inst[n];
  for (const [, rel] of norm.relations) {
    if (rel.kind !== 'belongsTo') continue;
    const fkCamel = __schemaCamel(rel.foreignKey);
    snap[fkCamel] = inst[fkCamel];
  }
  return snap;
}

// Relation memo — caches resolved relation values per instance under
// the accessor name. Lazily created and non-enumerable so it never
// shows up in Object.keys / JSON.stringify. Written by the relation
// accessors (on first resolve) and by the eager-loading preloader
// (.includes), read by the accessors.
function __schemaRelMemoSet(inst, acc, v) {
  if (!inst._relMemo) {
    Object.defineProperty(inst, '_relMemo', {
      value: new Map(), enumerable: false, writable: false, configurable: true,
    });
  }
  inst._relMemo.set(acc, v);
  return v;
}

// SameValue-Zero: like ===, except NaN equals NaN. Used by the dirty
// check so a persisted NaN doesn't trigger a wasted UPDATE on every
// save. Distinguishes from Object.is by treating +0/-0 as equal, which
// is the right semantics for SQL: the DB doesn't distinguish them.
function __schemaSameValue(a, b) {
  return a === b || (a !== a && b !== b);
}

// Structural signature of a declaration — name-shape only, function
// bodies excluded. Two registrations with the same signature are the
// same declaration arriving twice (double import via symlinked paths,
// re-eval of an unchanged module) and rebind silently. Different
// signatures under the same name are a real collision and throw,
// unless \`__SchemaRegistry.replace\` is set (dev/HMR semantics).
function __schemaSignature(def) {
  // Constraints may hold RegExp values; JSON.stringify would erase them
  // to {} and miss a real difference, so stringify them explicitly.
  const safe = (v) => JSON.stringify(v ?? null, (k, x) =>
    x instanceof RegExp ? String(x) : (typeof x === 'function' ? '<fn>' : x));
  const parts = [def.kind];
  for (const e of def._desc.entries || []) {
    switch (e.tag) {
      case 'field':
        parts.push('f:' + e.name + ':' + (e.typeName || '') +
          (e.array ? '[]' : '') + ':' + (e.modifiers || []).join('') +
          (e.literals ? ':' + e.literals.join(',') : '') +
          ':' + safe(e.constraints) + ':' + safe(e.attrs) + (e.coerce ? ':~' + (e.coercer || '') : '') +
          (e.transform ? ':t' : ''));
        break;
      case 'enum-member':
        parts.push('e:' + e.name + '=' + String(e.value));
        break;
      case 'directive':
        parts.push('d:' + e.name + ':' + safe(e.args));
        break;
      case 'ensure':
        parts.push('n:' + (e.message || ''));
        break;
      default:
        // method / computed / derived / hook — name identity only.
        parts.push(e.tag + ':' + (e.name || ''));
    }
  }
  return parts.join('|');
}

const __SchemaRegistry = {
  _entries: new Map(),
  // Dev/HMR escape hatch: when true, re-registering a name rebinds
  // unconditionally (pre-hardening "last loaded wins" semantics). Dev
  // servers and test harnesses set it; production code should not.
  replace: false,
  register(def) {
    // Named schemas of any kind land here. Relations look up :model,
    // @mixin Name looks up :mixin. Algebra (.extend etc.) accepts :shape
    // and derived shapes. Kind is checked at lookup time.
    if (!def.name) return;
    const existing = this._entries.get(def.name);
    if (existing && existing.def !== def && !this.replace) {
      // Identical declarations (same structural signature) rebind
      // silently — the same module arriving twice is not a conflict.
      // Anything else is the "two different models, one name" footgun:
      // relation / @mixin resolution is name-keyed and app-global, so
      // silently letting the last one win corrupts resolution. Throw.
      if (__schemaSignature(existing.def) !== __schemaSignature(def)) {
        throw new SchemaError(
          [{
            field: def.name, error: 'collision',
            message: "schema name '" + def.name + "' is already registered with a different definition. " +
              "Schema names are app-global (they resolve relations and @mixin references), so two different " +
              "schemas cannot share one name. Rename one of them — or, for dev/HMR reload semantics, set " +
              "__SchemaRegistry.replace = true before re-evaluating modules.",
          }],
          def.name, def.kind);
      }
    }
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
  // Run \`fn\` against a fresh, empty registry; restore the parent
  // registry afterward (success, throw, or async rejection). Replaces
  // ad-hoc reset() in tests and makes schema-declaring test blocks
  // safe to run without leaking registrations into each other.
  scope(fn) {
    const saved = this._entries;
    this._entries = new Map();
    const restore = () => { this._entries = saved; };
    try {
      const r = fn();
      if (r && typeof r.then === 'function') return r.finally(restore);
      restore();
      return r;
    } catch (e) {
      restore();
      throw e;
    }
  },
};

class __SchemaDef {
  constructor(desc) {
    this._desc = desc;
    this.kind = desc.kind;
    this.name = desc.name || null;
    this._norm = null;
    this._klass = null;
    this._sourceModel = null;
    this._unionPlanCache = null;
    // Per-schema adapter (\`schema :model, on: analytics\`). null → the
    // process-global adapter. Resolved per ORM call by the orm fragment.
    this._adapter = desc.adapter || null;
    // Install @scope statics eagerly so \`User.active()\` works as the
    // very first call on the model (normalization hasn't run yet at
    // that point; the scope invocation itself triggers it, which also
    // fires the duplicate / reserved-name collision checks). Prototype
    // methods win on name conflicts (\`in\` sees the prototype chain),
    // and normalize rejects those names anyway.
    for (const e of desc.entries || []) {
      if (e.tag !== 'scope' || (e.name in this)) continue;
      const self = this;
      const sfn = e.fn;
      Object.defineProperty(this, e.name, {
        enumerable: false, configurable: true,
        value: function(...args) { return __schemaInvokeScope(self, null, sfn, args); },
      });
    }
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
    const scopes = new Map();
    let defaultScope = null;
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

    const requireCanonicalName = (n, kindLabel) => {
      if (!__schemaValidateCanonicalName(n)) {
        throw new SchemaError(
          [{
            field: n,
            error: 'invalid-name',
            message: kindLabel + " name '" + n + "' is not canonical camelCase. " +
              "Use a lowercase-first, alphanumeric identifier with no consecutive uppercase letters " +
              "(e.g. 'mdmId' not 'mdmID'). This keeps snake_case <-> camelCase mapping unambiguous.",
          }],
          this.name, this.kind);
      }
    };

    for (const e of this._desc.entries) {
      switch (e.tag) {
        case 'field':
          requireCanonicalName(e.name, 'field');
          noteCollision(e.name);
          fields.set(e.name, {
            name: e.name,
            required: e.modifiers.includes('!'),
            unique: e.unique === true,
            optional: e.modifiers.includes('?'),
            typeName: e.typeName,
            literals: e.literals || null,
            array: e.array === true,
            coerce: e.coerce === true,
            coercer: e.coercer || null,
            constraints: e.constraints || null,
            attrs: e.attrs || null,
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
          // come out in the order authored. \`field\` attributes the
          // failure to a specific input; \`async\` marks an @ensure!
          // refinement (the schema becomes async-validating).
          ensures.push({
            message: e.message,
            field: e.field || '',
            async: e.async === true,
            fn: e.fn,
          });
          break;
        case 'scope':
          // Scopes live in the STATIC namespace (model + builder), not
          // the instance namespace — a field \`active\` and a scope
          // \`:active\` coexist by design. Collisions are checked against
          // other scopes and the reserved static/builder names.
          if (scopes.has(e.name)) collision(e.name, 'scope');
          if (__SCHEMA_SCOPE_RESERVED.has(e.name)) collision(e.name, 'reserved query API name');
          scopes.set(e.name, e.fn);
          break;
        case 'defaultScope':
          if (defaultScope) {
            throw new SchemaError(
              [{field: '', error: 'collision', message: 'only one @defaultScope per model'}],
              this.name, this.kind);
          }
          defaultScope = e.fn;
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

    // \`@tableWas old_name\` — table-rename annotation for the differ.
    let tableWas = null;
    for (const d of directives) {
      if (d.name === 'tableWas' && d.args?.[0]?.name) tableWas = d.args[0].name;
    }

    // :union metadata — discriminator field + constituent names.
    let unionOn = null;
    const unionMembers = [];
    if (this.kind === 'union') {
      for (const d of directives) {
        if (d.name === 'on' && d.args?.[0]?.field) unionOn = d.args[0].field;
      }
      for (const e of this._desc.entries) {
        if (e.tag === 'union-member') unionMembers.push(e.name);
      }
    }

    this._norm = {
      fields, methods, computed, derived, hooks, directives, enumMembers, relations,
      ensures, scopes, defaultScope,
      hasAsyncEnsures: ensures.some(r => r.async),
      timestamps, softDelete, primaryKey, tableName, tableWas,
      unionOn, unionMembers,
    };
    return this._norm;
  }

  // ---- :union dispatch -------------------------------------------------------
  //
  // Built lazily on first parse (consistent with registry resolution):
  // resolves every constituent from the registry, reads its declared
  // discriminator literals, and compiles a value → constituent map for
  // O(1) dispatch. Collisions and shapeless discriminators fail here
  // with the constituent names in the message.

  _unionPlan() {
    if (this._unionPlanCache) return this._unionPlanCache;
    const norm = this._normalize();
    const disc = norm.unionOn;
    if (this.kind !== 'union' || !disc) {
      throw new Error("schema: '" + (this.name || 'anon') + "' is not a :union");
    }
    const map = new Map();
    const members = [];
    for (const name of norm.unionMembers) {
      const def = __SchemaRegistry.get(name);
      if (!def) {
        throw new SchemaError(
          [{field: '', error: 'union', message: 'unknown union constituent: ' + name + ' (import the file that declares it)'}],
          this.name, this.kind);
      }
      members.push(def);
      const f = def._normalize().fields.get(disc);
      if (!f || f.typeName !== 'literal-union' || !f.literals?.length) {
        throw new SchemaError(
          [{field: disc, error: 'union', message: name + " must declare '" + disc +
            "' as a string-literal type (e.g. " + disc + '! "click") to join union ' + (this.name || '')}],
          this.name, this.kind);
      }
      for (const lit of f.literals) {
        if (map.has(lit)) {
          throw new SchemaError(
            [{field: disc, error: 'union', message: 'duplicate discriminator value ' + JSON.stringify(lit) +
              ' in ' + (map.get(lit).name || 'anon') + ' and ' + name}],
            this.name, this.kind);
        }
        map.set(lit, def);
      }
    }
    const plan = {
      disc, map,
      expected: [...map.keys()].join(' | '),
      hasAsyncEnsures: members.some(d => d._normalize().hasAsyncEnsures),
    };
    this._unionPlanCache = plan;
    return plan;
  }

  // Resolve a raw value to its constituent def, or produce the issue.
  _unionResolve(data) {
    const plan = this._unionPlan();
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { issue: {field: plan.disc, error: 'union', message: 'expected an object with ' + plan.disc} };
    }
    const def = plan.map.get(data[plan.disc]);
    if (!def) {
      return { issue: {field: plan.disc, error: 'union', message: 'expected one of ' + plan.expected} };
    }
    return { def };
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
          field: r.field || '', error: 'ensure',
          message: r.message || e?.message || 'ensure failed',
        });
        continue;
      }
      if (!ok) {
        errs.push({
          field: r.field || '', error: 'ensure',
          message: r.message || 'ensure failed',
        });
      }
    }
    return errs;
  }

  // Async-aware refinement pass for parseAsync/safeAsync/okAsync. Sync
  // refinements run first (cheap before expensive); async refinements
  // then run CONCURRENTLY (Promise.all) — preserving the no-short-
  // circuit rule. Issues come out in declaration order regardless of
  // completion order. A rejected async predicate counts as failure
  // with the declared message, same as a thrown sync one.
  async _applyEnsuresAsync(data) {
    const norm = this._normalize();
    if (!norm.ensures.length) return [];
    const results = [];
    const pending = [];
    norm.ensures.forEach((r, idx) => {
      const issue = () => ({
        field: r.field || '', error: 'ensure',
        message: r.message || 'ensure failed',
      });
      if (r.async) {
        pending.push((async () => {
          let ok = false;
          try { ok = !!(await r.fn(data)); } catch { ok = false; }
          if (!ok) results.push({ idx, issue: issue() });
        })());
      } else {
        let ok = false;
        try { ok = !!r.fn(data); } catch { ok = false; }
        if (!ok) results.push({ idx, issue: issue() });
      }
    });
    await Promise.all(pending);
    results.sort((a, b) => a.idx - b.idx);
    return results.map(r => r.issue);
  }

  // A schema with ≥1 @ensure! is async-validating: the sync entry
  // points refuse loudly rather than sometimes-returning a promise.
  _assertSyncValidatable(api) {
    const async = this.kind === 'union'
      ? this._unionPlan().hasAsyncEnsures
      : this._normalize().hasAsyncEnsures;
    if (async) {
      throw new Error(
        "schema '" + (this.name || 'anon') + "' has async refinements (@ensure!" +
        (this.kind === 'union' ? ' in a constituent' : '') + "); " +
        '.' + api + '() is sync. Use parseAsync!/safeAsync!/okAsync! instead.');
    }
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
        // Re-entry guard for save(): set true while a save is in flight,
        // cleared in __schemaSave's finally. Throws on same-instance
        // re-entry (typically from a hook accidentally calling save()
        // on its own instance) instead of looping forever or racing the
        // snapshot / savedChanges machinery.
        Object.defineProperty(this, '_saving', { value: false, enumerable: false, writable: true, configurable: true });
        // Mirrors Active Record's \`saved_changes\`: populated by save()
        // with the field-level diff of the just-completed write. INSERT
        // produces \`[null, newValue]\` per written field; UPDATE produces
        // \`[oldValue, newValue]\` per changed field. An empty Map after a
        // save() call means nothing was actually written. Reset to a
        // fresh Map at the start of every save() so it always reflects
        // the most recent save, never accumulates across calls.
        Object.defineProperty(this, 'savedChanges', { value: new Map(), enumerable: false, writable: true, configurable: true });
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

    // Relation methods: user.organization(). Accepts an optional opts
    // object; returns a promise to a target-model instance (or array
    // for has_many). Results memoize per instance — the second call
    // resolves from cache with no query, and eager loading (.includes)
    // fills the same memo so preloaded relations are free. Pass
    // {reload: true} to bust the memo and re-query.
    for (const [acc, rel] of norm.relations) {
      Object.defineProperty(klass.prototype, acc, {
        enumerable: false, configurable: true,
        value: async function(opts) {
          if (!(opts && opts.reload === true) && this._relMemo && this._relMemo.has(acc)) {
            return this._relMemo.get(acc);
          }
          const v = await __schemaResolveRelation(def, this, rel);
          __schemaRelMemoSet(this, acc, v);
          return v;
        },
      });
    }

    // Instance ORM methods — only for :model kind.
    if (this.kind === 'model') {
      Object.defineProperty(klass.prototype, 'save', {
        enumerable: false, configurable: true, writable: true,
        value: async function() { return __schemaSave(def, this); },
      });
      // destroy() honors @softDelete (UPDATE deleted_at) by default;
      // destroy(hard: true) forces a real DELETE. Hooks fire either way.
      Object.defineProperty(klass.prototype, 'destroy', {
        enumerable: false, configurable: true, writable: true,
        value: async function(opts) { return __schemaDestroy(def, this, opts); },
      });
      // restore() un-deletes a soft-deleted row (deleted_at = NULL).
      // Throws on models without @softDelete.
      Object.defineProperty(klass.prototype, 'restore', {
        enumerable: false, configurable: true, writable: true,
        value: async function() { return __schemaRestore(def, this); },
      });
      Object.defineProperty(klass.prototype, 'ok', {
        enumerable: false, configurable: true, writable: true,
        value: function() { return def._validateFields(this, false); },
      });
      Object.defineProperty(klass.prototype, 'errors', {
        enumerable: false, configurable: true, writable: true,
        value: function() { return def._validateFields(this, true); },
      });
      // Public API for forcing a column into the next UPDATE when value
      // identity can't detect the change — typically after an in-place
      // mutation of an object-valued field (json, Date) where the JS
      // reference is unchanged. Validates the field name against the
      // schema so typos throw instead of silently no-op'ing, and is
      // restricted to persisted instances since INSERT writes every
      // non-null field anyway (silently doing nothing is a footgun).
      Object.defineProperty(klass.prototype, 'markDirty', {
        enumerable: false, configurable: true, writable: true,
        value: function(name) {
          if (!this._persisted) {
            throw new Error(
              "schema: markDirty('" + name + "') is only valid on persisted instances; INSERT writes every set field"
            );
          }
          const n = __schemaCamel(name);
          const norm = def._normalize();
          // Accept declared fields and \`belongsTo\` FK column names
          // (camelCase or snake_case input both resolve via __schemaCamel).
          let valid = norm.fields.has(n);
          if (!valid) {
            for (const [, rel] of norm.relations) {
              if (rel.kind === 'belongsTo' && __schemaCamel(rel.foreignKey) === n) {
                valid = true;
                break;
              }
            }
          }
          if (!valid) {
            throw new Error(
              "schema: markDirty('" + name + "') — '" + n + "' is not a declared field or belongs_to FK on " + (def.name || 'anon')
            );
          }
          this._dirty.add(n);
          return this;
        },
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
    // Capture the as-loaded values so \`save()\` can emit a column-targeted
    // UPDATE that only touches fields the caller actually mutated. Two
    // reasons this matters: (a) avoids a pointless DB round-trip when the
    // caller didn't change anything, and (b) sidesteps a hard DuckDB FK
    // limitation — UPDATEs that touch indexed columns (PK / UNIQUE) on a
    // row referenced by another table's FK are rejected even when the
    // value isn't really changing. Writing only dirty columns keeps no-op
    // saves out of the index path entirely.
    inst._snapshot = __schemaSnapshot(this._normalize(), inst);
    return inst;
  }

  // Coerce ISO date strings to Date for date/datetime fields. Over JSON a
  // date is a string, so a value crossing the wire (or any \`.parse\` of
  // external input) arrives as a string; this lets it validate and be stored
  // as a Date. Runs on parse/safe only — hydrate gets canonical DB values.
  _coerceDates(working) {
    const norm = this._normalize();
    // Only ISO-shaped strings (\`YYYY-MM-DD\` optionally followed by a time) are
    // coerced. \`new Date(v)\` is otherwise lax — \`new Date("5")\` is a valid
    // Date — which would let clearly-bad input slip past a date field as a
    // bogus Date instead of failing validation. Array-of-date fields coerce
    // element-wise.
    const isoShaped = (s) => typeof s === 'string' && /^\\d{4}-\\d{2}-\\d{2}([T ].*)?$/.test(s);
    const toDate = (s) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? s : d; };
    for (const [n, f] of norm.fields) {
      if (f.typeName !== 'date' && f.typeName !== 'datetime') continue;
      const v = working[n];
      if (f.array && Array.isArray(v)) {
        working[n] = v.map(el => isoShaped(el) ? toDate(el) : el);
      } else if (isoShaped(v)) {
        working[n] = toDate(v);
      }
    }
  }

  _validateFields(data, collect, skip) {
    const norm = this._normalize();
    const errors = collect ? [] : null;
    for (const [n, f] of norm.fields) {
      // Fields whose coercion already failed carry a {error: 'coerce'}
      // issue; re-checking the uncoerced value would double-report.
      if (skip && skip.has(n)) continue;
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

  // \`~type\` coercions — part of pipeline step 1 (obtain raw candidate):
  // the wire value converts through the strict coercion table before
  // defaults and validation, so range checks see the coerced value.
  // Failed coercions collect {error: 'coerce'} issues and the field
  // lands in \`failed\` so per-field validation doesn't double-report
  // the same problem as a type error. Skipped on hydrate (rows arrive
  // canonical), like transforms. Mutually exclusive with transforms at
  // compile time.
  _applyCoercions(working, failed) {
    const norm = this._normalize();
    const errors = [];
    for (const [n, f] of norm.fields) {
      if (!f.coerce) continue;
      const v = working[n];
      if (v === undefined || v === null) continue;
      if (f.coercer) {
        // \`~:name\` — registry lookup. A missing coercer is a CONFIG
        // error (the package that provides it wasn't loaded), not a
        // validation failure — fail loud.
        const entry = __schemaNamedCoercers.get(f.coercer);
        if (!entry) {
          throw new Error(
            "schema: no coercer registered for '~:" + f.coercer + "' (field '" + n + "' on " +
            (this.name || 'anon') + "). Import '@rip-lang/validate' (browser-safe; registers the " +
            "whole vocabulary) or register it with schema.registerCoercer('" + f.coercer + "', fn).");
        }
        const input = entry.raw ? v : String(v).trim();
        let out;
        try { out = entry.fn(input); } catch { out = null; }
        if (out === null || out === undefined || out === false) {
          errors.push({field: n, error: 'coerce', message: n + ' is not a valid ' + f.coercer});
          failed.add(n);
        } else {
          working[n] = out;
        }
        continue;
      }
      const r = __SCHEMA_COERCERS[f.typeName] ? __SCHEMA_COERCERS[f.typeName](v) : { ok: false };
      if (r.ok) {
        working[n] = r.value;
      } else {
        errors.push({field: n, error: 'coerce', message: n + ' cannot be coerced to ' + f.typeName});
        failed.add(n);
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
    if (this.kind === 'union') {
      const plan = this._unionPlan();
      if (plan.hasAsyncEnsures) this._assertSyncValidatable('parse');
      const r = this._unionResolve(data);
      if (r.issue) throw new SchemaError([r.issue], this.name, this.kind);
      return r.def.parse(data);
    }
    if (this.kind === 'enum') {
      const errs = this._validateEnum(data, true);
      if (errs.length) throw new SchemaError(errs, this.name, this.kind);
      return this._materializeEnum(data);
    }
    this._assertSyncValidatable('parse');
    const raw = data || {};
    const working = { ...raw };
    const failed = new Set();
    const transformErrors = this._applyTransforms(raw, working);
    const coerceErrors = this._applyCoercions(working, failed);
    this._applyDefaults(working);
    this._coerceDates(working);
    const errs = transformErrors.concat(coerceErrors, this._validateFields(working, true, failed));
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

  // Array combinator: \`Schema.array\` is a list-of-this schema exposing the
  // same validation family (parse/safe/ok + async). The common list-endpoint
  // case is \`Schema.array.parse(api.get!('x').json!())\` → Out[]. A non-array
  // input fails fast with a descriptive error naming what it got — so passing
  // an enveloped \`{ items: [...] }\` whole, a typo'd key, or a changed server
  // contract surfaces clearly at the boundary. Item failures aggregate, each
  // issue tagged with its \`[index]\` so a bad element is locatable.
  get array() {
    const elem = this;
    const notArray = (data) => {
      const got = data === null ? 'null'
        : data === undefined ? 'undefined'
        : typeof data === 'object' ? ('an object with keys [' + Object.keys(data).join(', ') + ']')
        : typeof data;
      return { field: '', error: 'not_array', message: 'expected an array, received ' + got };
    };
    const collect = (results) => {
      const value = [];
      const errors = [];
      results.forEach((r, i) => {
        if (r.ok) value.push(r.value);
        else for (const e of r.errors) {
          errors.push({ ...e, field: '[' + i + ']' + (e.field ? '.' + e.field : '') });
        }
      });
      return { value, errors };
    };
    return {
      parse(data) {
        if (!Array.isArray(data)) throw new SchemaError([notArray(data)], elem.name, elem.kind);
        const { value, errors } = collect(data.map((x) => elem.safe(x)));
        if (errors.length) throw new SchemaError(errors, elem.name, elem.kind);
        return value;
      },
      safe(data) {
        if (!Array.isArray(data)) return { ok: false, value: null, errors: [notArray(data)] };
        const { value, errors } = collect(data.map((x) => elem.safe(x)));
        return errors.length ? { ok: false, value: null, errors } : { ok: true, value, errors: null };
      },
      ok(data) {
        return Array.isArray(data) && data.every((x) => elem.ok(x));
      },
      async parseAsync(data) {
        if (!Array.isArray(data)) throw new SchemaError([notArray(data)], elem.name, elem.kind);
        const { value, errors } = collect(await Promise.all(data.map((x) => elem.safeAsync(x))));
        if (errors.length) throw new SchemaError(errors, elem.name, elem.kind);
        return value;
      },
      async safeAsync(data) {
        if (!Array.isArray(data)) return { ok: false, value: null, errors: [notArray(data)] };
        const { value, errors } = collect(await Promise.all(data.map((x) => elem.safeAsync(x))));
        return errors.length ? { ok: false, value: null, errors } : { ok: true, value, errors: null };
      },
      async okAsync(data) {
        return Array.isArray(data) && (await Promise.all(data.map((x) => elem.okAsync(x)))).every(Boolean);
      },
      toJSONSchema() {
        return { type: 'array', items: elem.toJSONSchema() };
      },
    };
  }

  safe(data) {
    if (this.kind === 'mixin') {
      return {ok: false, value: null, errors: [{field: '', error: 'mixin', message: 'not instantiable'}]};
    }
    if (this.kind === 'union') {
      const plan = this._unionPlan();
      if (plan.hasAsyncEnsures) this._assertSyncValidatable('safe');
      const r = this._unionResolve(data);
      if (r.issue) return {ok: false, value: null, errors: [r.issue]};
      return r.def.safe(data);
    }
    if (this.kind === 'enum') {
      const errs = this._validateEnum(data, true);
      if (errs.length) return {ok: false, value: null, errors: errs};
      return {ok: true, value: this._materializeEnum(data), errors: null};
    }
    this._assertSyncValidatable('safe');
    const raw = data || {};
    const working = { ...raw };
    const failed = new Set();
    const transformErrors = this._applyTransforms(raw, working);
    const coerceErrors = this._applyCoercions(working, failed);
    this._applyDefaults(working);
    this._coerceDates(working);
    const errs = transformErrors.concat(coerceErrors, this._validateFields(working, true, failed));
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
    if (this.kind === 'union') {
      const plan = this._unionPlan();
      if (plan.hasAsyncEnsures) this._assertSyncValidatable('ok');
      const r = this._unionResolve(data);
      return r.issue ? false : r.def.ok(data);
    }
    if (this.kind === 'enum') return this._validateEnum(data, false);
    this._assertSyncValidatable('ok');
    const raw = data || {};
    const working = { ...raw };
    const failed = new Set();
    const transformErrors = this._applyTransforms(raw, working);
    if (transformErrors.length) return false;
    if (this._applyCoercions(working, failed).length) return false;
    this._applyDefaults(working);
    this._coerceDates(working);
    if (!this._validateFields(working, false)) return false;
    // Per-field validation passed — @ensure predicates are the final gate.
    return this._applyEnsures(working).length === 0;
  }

  // Async validation entry points. Work on EVERY schema (sync-only
  // schemas just resolve immediately); REQUIRED when the schema has
  // @ensure! refinements. The dammit operator gives the idiomatic
  // form: \`SignupInput.parseAsync! raw\`.
  async _runPipelineAsync(data) {
    const raw = data || {};
    const working = { ...raw };
    const failed = new Set();
    const transformErrors = this._applyTransforms(raw, working);
    const coerceErrors = this._applyCoercions(working, failed);
    this._applyDefaults(working);
    this._coerceDates(working);
    const errs = transformErrors.concat(coerceErrors, this._validateFields(working, true, failed));
    if (errs.length) return { errors: errs };
    const ensureErrs = await this._applyEnsuresAsync(working);
    if (ensureErrs.length) return { errors: ensureErrs };
    return { working };
  }

  async parseAsync(data) {
    if (this.kind === 'mixin') {
      throw new Error(":mixin schema '" + (this.name || 'anon') + "' is not instantiable");
    }
    if (this.kind === 'union') {
      const r = this._unionResolve(data);
      if (r.issue) throw new SchemaError([r.issue], this.name, this.kind);
      return r.def.parseAsync(data);
    }
    if (this.kind === 'enum') return this.parse(data);
    const r = await this._runPipelineAsync(data);
    if (r.errors) throw new SchemaError(r.errors, this.name, this.kind);
    const klass = this._getClass();
    const inst = new klass(r.working, false);
    this._applyEagerDerived(inst);
    return inst;
  }

  async safeAsync(data) {
    if (this.kind === 'mixin') {
      return {ok: false, value: null, errors: [{field: '', error: 'mixin', message: 'not instantiable'}]};
    }
    if (this.kind === 'union') {
      const r = this._unionResolve(data);
      if (r.issue) return {ok: false, value: null, errors: [r.issue]};
      return r.def.safeAsync(data);
    }
    if (this.kind === 'enum') return this.safe(data);
    const r = await this._runPipelineAsync(data);
    if (r.errors) return {ok: false, value: null, errors: r.errors};
    const klass = this._getClass();
    const inst = new klass(r.working, false);
    try { this._applyEagerDerived(inst); }
    catch (e) {
      return {ok: false, value: null, errors: [{field: '', error: 'derived', message: e?.message || String(e)}]};
    }
    return {ok: true, value: inst, errors: null};
  }

  async okAsync(data) {
    return (await this.safeAsync(data)).ok;
  }

  // ---- :model static ORM methods --------------------------------------------

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
    if (other.kind === 'union') {
      throw new Error('extend(): :union schemas have no fields to merge');
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

// ---- JSON Schema export (draft 2020-12) -------------------------------------
//
// One declaration → wire contract. Field types map per the table in the
// language reference; nested registry schemas become \`$ref\`s collected
// under \`$defs\` (cycle-safe); enums map to \`enum\`, unions to \`oneOf\` +
// an OpenAPI-style \`discriminator\`. Transforms and refinements have no
// executable JSON Schema equivalent — they export as \`description\`
// annotations rather than being silently dropped or approximated.

const __SCHEMA_JSON_TYPES = {
  string:   () => ({ type: 'string' }),
  text:     () => ({ type: 'string' }),
  email:    () => ({ type: 'string', format: 'email' }),
  url:      () => ({ type: 'string', format: 'uri' }),
  uuid:     () => ({ type: 'string', format: 'uuid' }),
  phone:    () => ({ type: 'string', pattern: '^[\\\\d\\\\s\\\\-+()]+$' }),
  zip:      () => ({ type: 'string', pattern: '^\\\\d{5}(-\\\\d{4})?$' }),
  number:   () => ({ type: 'number' }),
  integer:  () => ({ type: 'integer' }),
  boolean:  () => ({ type: 'boolean' }),
  date:     () => ({ type: 'string', format: 'date' }),
  datetime: () => ({ type: 'string', format: 'date-time' }),
  json:     () => ({}),
  any:      () => ({}),
};

function __schemaFieldJSONSchema(f, ctx) {
  let s;
  if (f.typeName === 'literal-union' && f.literals?.length) {
    s = f.literals.length === 1 ? { const: f.literals[0] } : { enum: [...f.literals] };
  } else if (__SCHEMA_JSON_TYPES[f.typeName]) {
    s = __SCHEMA_JSON_TYPES[f.typeName]();
  } else {
    const sub = __SchemaRegistry.get(f.typeName);
    if (sub) {
      s = __schemaJSONSchemaRef(sub, ctx);
    } else {
      s = {}; // unknown identifier — permissive, matching the validator
    }
  }
  const c = f.constraints;
  if (c && !f.array) {
    const stringish = s.type === 'string';
    const numeric = s.type === 'number' || s.type === 'integer';
    if (stringish) {
      if (c.min != null) s.minLength = c.min;
      if (c.max != null) s.maxLength = c.max;
      if (c.regex) s.pattern = c.regex.source;
    } else if (numeric) {
      if (c.min != null) s.minimum = c.min;
      if (c.max != null) s.maximum = c.max;
    }
  }
  if (f.array) {
    const items = s;
    s = { type: 'array', items };
    if (c) {
      if (c.min != null) s.minItems = c.min;
      if (c.max != null) s.maxItems = c.max;
    }
  }
  if (c && c.default !== undefined) s.default = c.default;
  if (f.coerce) {
    s.description = ((s.description ? s.description + ' ' : '') +
      'Coerced from wire data (' + (f.coercer ? '~:' + f.coercer : '~' + f.typeName) + ').').trim();
  }
  if (f.transform) {
    s.description = ((s.description ? s.description + ' ' : '') +
      'Derived via transform; the raw input may use different keys.').trim();
  }
  return s;
}

// A registry schema used as a field type / union constituent becomes a
// \`$ref\` into \`$defs\`, expanding each named schema exactly once.
function __schemaJSONSchemaRef(def, ctx) {
  const name = def.name || 'Anon';
  if (!ctx.defs.has(name) && !ctx.expanding.has(name)) {
    ctx.expanding.add(name);
    ctx.defs.set(name, null); // reserve slot to keep insertion order
    ctx.defs.set(name, __schemaJSONSchemaBody(def, ctx));
    ctx.expanding.delete(name);
  }
  return { $ref: '#/$defs/' + name };
}

function __schemaJSONSchemaBody(def, ctx) {
  const norm = def._normalize();

  if (def.kind === 'enum') {
    return { enum: [...new Set(norm.enumMembers.values())] };
  }

  if (def.kind === 'union') {
    const plan = def._unionPlan();
    const oneOf = norm.unionMembers.map(name => {
      const member = __SchemaRegistry.get(name);
      return member ? __schemaJSONSchemaRef(member, ctx) : {};
    });
    return {
      oneOf,
      discriminator: { propertyName: plan.disc },
    };
  }

  // Fielded kinds: object schema. A field is required on the wire only
  // when it's \`!\`-marked AND has no default (defaults apply before the
  // required check, so a defaulted field can never fail required).
  const properties = {};
  const required = [];
  for (const [n, f] of norm.fields) {
    properties[n] = __schemaFieldJSONSchema(f, ctx);
    if (f.required && f.constraints?.default === undefined) required.push(n);
  }
  // :model wire shapes include the DB-managed columns toJSON() carries.
  if (def.kind === 'model') {
    properties[norm.primaryKey] = { type: 'integer' };
    for (const [, rel] of norm.relations) {
      if (rel.kind !== 'belongsTo') continue;
      properties[__schemaCamel(rel.foreignKey)] = rel.optional
        ? { type: ['integer', 'null'] }
        : { type: 'integer' };
    }
    if (norm.timestamps) {
      properties.createdAt = { type: 'string', format: 'date-time' };
      properties.updatedAt = { type: 'string', format: 'date-time' };
    }
    if (norm.softDelete) {
      properties.deletedAt = { type: ['string', 'null'], format: 'date-time' };
    }
  }
  const out = { type: 'object', properties };
  if (required.length) out.required = required;
  if (norm.ensures.length) {
    out.description = 'Refinements (not expressible in JSON Schema): ' +
      norm.ensures.map(r => r.message).join('; ') + '.';
  }
  return out;
}

__SchemaDef.prototype.toJSONSchema = function () {
  const ctx = { defs: new Map(), expanding: new Set() };
  // The root schema expands inline; only REFERENCED schemas go to $defs.
  const root = __schemaJSONSchemaBody(this, ctx);
  root.$schema = 'https://json-schema.org/draft/2020-12/schema';
  if (this.name) root.title = this.name;
  if (ctx.defs.size) {
    root.$defs = {};
    for (const [k, v] of ctx.defs) root.$defs[k] = v;
  }
  return root;
};

function __schemaFlatten(keys) {
  const out = [];
  for (const k of keys) {
    if (typeof k === 'symbol') out.push(Symbol.keyFor(k) || k.description);
    else if (Array.isArray(k)) for (const kk of k) out.push(typeof kk === 'symbol' ? (Symbol.keyFor(kk) || kk.description) : kk);
    else out.push(k);
  }
  return out;
}

// The full projectable column set of a schema: declared fields plus the
// columns a :model manages implicitly — the \`id\` primary key, \`@timestamps\`
// (createdAt/updatedAt), \`@softDelete\` (deletedAt), and \`@belongs_to\` FK
// columns. Algebra (.pick/.omit/.partial/.required) operates over THIS set so
// a client projection can include \`id\`/\`createdAt\` even though they aren't
// declared fields. Non-model kinds have no implicit columns — declared only.
function __schemaProjectableFields(def) {
  const norm = def._normalize();
  const out = new Map(norm.fields);
  if (def.kind !== 'model') return out;
  const col = (name, typeName, required) => {
    if (!out.has(name)) out.set(name, {
      name, required: !!required, unique: false, optional: !required,
      typeName, literals: null, array: false, constraints: null, transform: null,
    });
  };
  col(norm.primaryKey, 'integer', true);
  if (norm.timestamps) { col('createdAt', 'datetime', true); col('updatedAt', 'datetime', true); }
  if (norm.softDelete) col('deletedAt', 'datetime', false);
  for (const [, rel] of norm.relations) {
    if (rel.kind === 'belongsTo') col(__schemaCamel(rel.foreignKey), 'integer', !rel.optional);
  }
  return out;
}

function __schemaDerive(source, transform) {
  // Algebra on a union has no obviously-right semantics (distribute?
  // intersect?) — deferring is honest. Derive from a constituent.
  if (source.kind === 'union') {
    throw new Error('schema algebra (.pick/.omit/.partial/.required/.extend) is not supported on :union — derive from a constituent schema instead');
  }
  const src = __schemaProjectableFields(source);
  const derivedFields = transform(src);
  const entries = [];
  for (const [, f] of derivedFields) {
    const mods = [];
    if (f.required) mods.push('!');
    if (f.optional && !f.required) mods.push('?');
    entries.push({
      tag: 'field', name: f.name, modifiers: mods,
      unique: f.unique === true,
      typeName: f.typeName, array: f.array,
      literals: f.literals || null,
      coerce: f.coerce === true,
      coercer: f.coercer || null,
      constraints: f.constraints,
      attrs: f.attrs || null,
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
        unique: e.unique === true,
        optional: e.modifiers.includes('?'),
        typeName: e.typeName,
        literals: e.literals || null,
        array: e.array === true,
        coerce: e.coerce === true,
        coercer: e.coercer || null,
        constraints: e.constraints || null,
        attrs: e.attrs || null,
        transform: e.transform || null,
      });
    }
    ctx.stack.pop();
  }
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
`;
export const SCHEMA_DB_NAMING_RUNTIME      = `const __SCHEMA_UNCOUNTABLE = new Set(['equipment','information','rice','money','species','series','fish','sheep','data']);

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
`;
export const SCHEMA_ORM_RUNTIME            = `// ---- Adapter (Contract v2) -------------------------------------------------
//
// \`query(sql, params) → {columns, data, rowCount}\` is the only REQUIRED
// method. v2 adds optional capabilities that the runtime feature-detects:
//
//   begin(options?) → TxHandle        transactions (schema.transaction!)
//     TxHandle: { query(sql, params), commit(), rollback() }
//   capabilities: { tx: true, ... }   truthful self-report (informational)
//
// Calling a feature whose method is absent throws a clear error — never
// a silent fallback.
//
// The default adapter talks to a duckdb-harbor server (or any
// /sql-compatible server). Configuration via env:
//
//   RIP_DB_URL    base URL (default http://127.0.0.1:9494; legacy DB_URL
//                 honored as a fallback)
//   RIP_DB_TOKEN  bearer token, required when harbor runs authenticated
//
// Transactions use harbor's session protocol: POST /sql/sessions/new
// pins a DB session (connection) so BEGIN/COMMIT survive across
// requests; statements carry the sessionId; the session is destroyed
// after COMMIT/ROLLBACK. Harbor enforces an idle TTL, so an abandoned
// transaction auto-rolls-back server-side.
function __schemaDefaultAdapter(overrides) {
  const env = (typeof process !== 'undefined' && process.env) || {};
  const base = () => String(
    overrides?.url || env.RIP_DB_URL || env.DB_URL || 'http://127.0.0.1:9494').replace(/\\/+$/, '');
  const headers = () => {
    const h = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const token = overrides?.token || env.RIP_DB_TOKEN;
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  };
  async function post(path, body) {
    const res = await fetch(base() + path, {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
    });
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok || data.ok === false || data.error) {
      const err = new Error(data.error || ('db request failed: ' + res.status + ' ' + (res.statusText || '')));
      if (data.errorCode) err.code = data.errorCode;
      if (data.errorDetails) err.details = data.errorDetails;
      err.httpStatus = res.status;
      throw err;
    }
    return data;
  }
  return {
    async query(sql, params) {
      return post('/sql', params && params.length ? { sql, params } : { sql });
    },
    async begin(options) {
      let session;
      try {
        session = await post('/sql/sessions/new', {});
      } catch (e) {
        if (e && e.httpStatus === 403) {
          e.message = 'transactions need a harbor DB session, and harbor denied session creation ' +
            '(authz policy __HARBOR_ADMIN__:sessions:create). Allow it in your harbor_authorization_function ' +
            'or set harbor_allow_admin_without_authz = true on a trusted deployment. Original error: ' + e.message;
        }
        throw e;
      }
      const sessionId = session.sessionId;
      const run = (sql, params) =>
        post('/sql', params && params.length ? { sql, params, sessionId } : { sql, sessionId });
      const drop = async () => {
        // Best-effort: harbor's idle TTL reaps abandoned sessions, so a
        // failed DELETE only delays cleanup, never leaks a transaction.
        try {
          await fetch(base() + '/sql/sessions/' + sessionId, { method: 'DELETE', headers: headers() });
        } catch {}
      };
      await run('BEGIN');
      return {
        query: run,
        async commit() { await run('COMMIT'); await drop(); },
        async rollback() {
          try { await run('ROLLBACK'); } finally { await drop(); }
        },
      };
    },
    capabilities: { tx: true },
  };
}

let __schemaAdapter = __schemaDefaultAdapter();

function __schemaSetAdapter(a) { __schemaAdapter = a; }

// Resolve the adapter for a def: its own \`on:\` adapter, else the
// process-global one. Migration internals pass def = null → global.
function __schemaAdapterFor(def) {
  return (def && def._adapter) || __schemaAdapter;
}

// Build a NEW adapter value (without installing it globally) — the
// counterpart of \`schema :model, on: analytics\`:
//
//   analytics = schema.connect url: env.ANALYTICS_URL, token: env.ANALYTICS_TOKEN
//   Event = schema :model, on: analytics
//
// Same duckdb-harbor contract as the default adapter (query + begin +
// capabilities), pinned to an explicit URL/token instead of env vars.
function __schemaConnect(opts) {
  const o = typeof opts === 'string' ? { url: opts } : (opts || {});
  if (!o.url) throw new Error("schema.connect({url, token?}): a url is required");
  return __schemaDefaultAdapter({ url: o.url, token: o.token });
}

// ---- Transactions ----------------------------------------------------------
//
// schema.transaction! ->                  propagates ambiently: every ORM
//   user = User.create! ...               call inside the block routes
//   Order.create! userId: user.id, ...    through the transaction's handle
//   user                                  via AsyncLocalStorage. Model code
//                                         is unchanged inside the block.
//
// Block throws   → ROLLBACK, exception propagates, afterRollback hooks fire.
// Block returns  → COMMIT, value returned, afterCommit hooks fire.
// Nested call    → joins the ambient transaction (Active Record's default;
//                  DuckDB has no SAVEPOINT, so nested-as-independent-unit
//                  cannot be honored on the primary backend).
//
// The ALS instance is created lazily on first use — \`node:async_hooks\`
// exists in Bun and Node, and the import never runs in browser bundles
// (this fragment is server/migration-only).
let __schemaTxALS = null;

// The ALS store is a Map<adapter, txContext> — each adapter gets its
// own slot, so a transaction pinned to one adapter never captures ORM
// calls bound to another (cross-adapter atomicity is impossible and
// the runtime never pretends otherwise), and an inner transaction on a
// second adapter doesn't shadow the outer one.
function __schemaTxStore(adapter) {
  if (!__schemaTxALS) return null;
  const map = __schemaTxALS.getStore();
  return (map && map.get(adapter)) || null;
}

// The single SQL funnel. Every ORM-issued statement flows through here:
// it resolves the def's adapter, routes to that adapter's ambient
// transaction handle when one exists, and translates DB constraint
// violations into structured SchemaErrors.
async function __schemaRunSQL(def, sql, params) {
  const adapter = __schemaAdapterFor(def);
  const tx = __schemaTxStore(adapter);
  try {
    return await (tx ? tx.handle.query(sql, params) : adapter.query(sql, params));
  } catch (e) {
    throw __schemaTranslateDBError(e, def);
  }
}

async function __schemaTransaction(optsOrFn, maybeFn) {
  const fn = typeof optsOrFn === 'function' ? optsOrFn : maybeFn;
  const opts = typeof optsOrFn === 'function' ? {} : (optsOrFn || {});
  if (typeof fn !== 'function') {
    throw new Error('schema.transaction(fn): expected a function (got ' + typeof fn + ')');
  }
  // \`on:\` pins the transaction to a specific adapter (per-schema
  // adapters); default is the process-global one.
  const adapter = opts.on || __schemaAdapter;

  // Nested transaction on the SAME adapter joins the ambient one — the
  // inner block's writes commit or roll back with the outer transaction.
  // A nested transaction on a DIFFERENT adapter is independent.
  if (__schemaTxStore(adapter)) return fn();

  if (typeof adapter.begin !== 'function') {
    throw new Error(
      'schema.transaction(): the configured adapter does not support transactions ' +
      '(no begin() method; see Adapter Contract v2). Install an adapter with begin() ' +
      'or use the default @rip-lang/db adapter against duckdb-harbor.');
  }
  if (!__schemaTxALS) {
    const { AsyncLocalStorage } = await import('node:async_hooks');
    __schemaTxALS = new AsyncLocalStorage();
  }

  const handle = await adapter.begin(opts);
  // \`after\` collects {def, inst} for every save/destroy that completed
  // inside the transaction on a model declaring afterCommit/afterRollback.
  const store = { adapter, handle, after: [] };
  // Copy-on-run: other adapters' ambient contexts stay visible inside
  // the block; only this adapter's slot is (re)bound.
  const nextMap = new Map(__schemaTxALS.getStore() || []);
  nextMap.set(adapter, store);
  let result;
  try {
    result = await __schemaTxALS.run(nextMap, fn);
  } catch (err) {
    try { await handle.rollback(); } catch {}
    await __schemaFlushTxHooks(store, 'afterRollback');
    throw err;
  }
  await handle.commit();
  // afterCommit runs OUTSIDE the transaction — this is where emails,
  // webhooks, and cache invalidation belong (they must never observe
  // uncommitted state). Exceptions here propagate to the caller but
  // cannot roll anything back: the COMMIT already happened.
  await __schemaFlushTxHooks(store, 'afterCommit');
  return result;
}

async function __schemaFlushTxHooks(store, hookName) {
  // Dedupe by instance: a row saved twice in one transaction gets one
  // callback, matching Active Record's after_commit semantics.
  const seen = new Set();
  for (const entry of store.after) {
    if (seen.has(entry.inst)) continue;
    seen.add(entry.inst);
    await __schemaRunHook(entry.def, entry.inst, hookName);
  }
}

// Queue an instance's commit-time hooks on the ambient transaction for
// ITS adapter. Returns true when queued; false means "no ambient tx —
// fire now".
function __schemaEnqueueTxHook(def, inst) {
  const tx = __schemaTxStore(__schemaAdapterFor(def));
  if (!tx) return false;
  tx.after.push({ def, inst });
  return true;
}

// ---- Constraint-violation translation --------------------------------------
//
// The ORM wraps every adapter call (via __schemaRunSQL). Errors that are
// recognizably DB constraint violations are translated into SchemaError
// so a \`save!\` that trips a UNIQUE index fails the same way a \`save!\`
// that trips a validator does: structured {field, error, message} issues.
// Unrecognized errors propagate untouched. The original error is kept
// as \`.cause\` for debugging.
//
// Recognition is message-pattern based (DuckDB first). Deliberately NOT
// added: \`validates_uniqueness_of\`-style pre-checks — they race. The DB
// constraint is the check; translation makes it ergonomic.
function __schemaTranslateDBError(e, def) {
  const msg = (e && e.message) || '';
  const issue = __schemaConstraintIssue(msg);
  if (!issue) return e;
  const err = new SchemaError([issue], def ? def.name : null, def ? def.kind : null);
  err.cause = e;
  return err;
}

function __schemaConstraintIssue(msg) {
  let m;
  // DuckDB: Constraint Error: Duplicate key "email: a@b.c" violates unique constraint ...
  //         (also "violates primary key constraint")
  m = msg.match(/[Dd]uplicate key "([A-Za-z0-9_]+):[^"]*" violates (?:unique|primary key) constraint/);
  if (m || /violates unique constraint/i.test(msg)) {
    const field = m ? __schemaCamel(m[1]) : '';
    return { field, error: 'unique', message: (field || 'value') + ' already taken' };
  }
  // DuckDB: Constraint Error: NOT NULL constraint failed: users.name
  m = msg.match(/NOT NULL constraint failed:\\s*(?:[A-Za-z0-9_]+\\.)?([A-Za-z0-9_]+)/i);
  if (m) {
    const field = __schemaCamel(m[1]);
    return { field, error: 'required', message: field + ' is required' };
  }
  // DuckDB: Constraint Error: Violates foreign key constraint because ... "user_id: 99" ...
  if (/[Vv]iolates foreign key constraint/.test(msg)) {
    m = msg.match(/"([A-Za-z0-9_]+):[^"]*"/);
    const field = m ? __schemaCamel(m[1]) : '';
    return { field, error: 'reference', message: (field || 'reference') + ' refers to a missing or still-referenced record' };
  }
  // DuckDB: Constraint Error: CHECK constraint failed: <table>
  if (/CHECK constraint failed/i.test(msg)) {
    return { field: '', error: 'check', message: msg };
  }
  return null;
}

// ---- Query builder ----------------------------------------------------------

// Run a scope body with \`this\` bound to a query builder. \`builder\` is
// null when invoked from a model static (User.active()) — a fresh
// builder is created; chained scope calls pass the existing builder.
// Scopes conventionally return the builder (\`@where\` does), but a body
// that returns something else falls back to the builder so chains never
// break on a stray trailing expression.
function __schemaInvokeScope(def, builder, fn, args) {
  const q = builder || new __SchemaQuery(def);
  const out = fn.apply(q, args);
  return out instanceof __SchemaQuery ? out : q;
}

class __SchemaQuery {
  constructor(def, opts = {}) {
    this._def = def;
    this._clauses = [];
    this._params = [];
    this._limit = null;
    this._offset = null;
    this._order = null;
    this._includes = [];
    this._unscoped = false;
    this._defaultScopeApplied = false;
    // Soft-delete filter mode: 'live' (default), 'all' (.withDeleted),
    // 'deleted' (.onlyDeleted). Pre-v2 \`includeDeleted\` option maps to 'all'.
    this._deleted = opts.includeDeleted === true ? 'all' : 'live';
    // Per-model scopes install as own methods so chains compose in any
    // order: User.where(role: 'admin').active().since(d). Builder
    // method names win on collision (normalize rejects those anyway).
    const scopes = def._normalize().scopes;
    if (scopes && scopes.size) {
      for (const [sname, sfn] of scopes) {
        if (!(sname in this)) {
          Object.defineProperty(this, sname, {
            enumerable: false, configurable: true,
            value: (...args) => __schemaInvokeScope(def, this, sfn, args),
          });
        }
      }
    }
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
        } else if (Array.isArray(v)) {
          this._clauses.push('"' + col + '" IN (' + v.map(() => '?').join(', ') + ')');
          this._params.push(...v);
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
  includes(...specs) {
    this._includes.push(...__schemaNormalizeIncludes(specs));
    return this;
  }
  withDeleted() { this._deleted = 'all'; return this; }
  onlyDeleted() { this._deleted = 'deleted'; return this; }
  unscoped() { this._unscoped = true; return this; }
  // @defaultScope applies lazily at terminal time (all/count/updateAll/
  // deleteAll) so .unscoped() works no matter where it appears in the
  // chain, and so the default's clauses never double-apply.
  _applyDefaultScope() {
    if (this._unscoped || this._defaultScopeApplied) return;
    this._defaultScopeApplied = true;
    const fn = this._def._normalize().defaultScope;
    if (fn) fn.call(this);
  }
  _whereParts(norm) {
    const where = [...this._clauses];
    if (norm.softDelete) {
      if (this._deleted === 'live') where.push('"deleted_at" IS NULL');
      else if (this._deleted === 'deleted') where.push('"deleted_at" IS NOT NULL');
    }
    return where;
  }
  _buildSQL() {
    const n = this._def._normalize();
    const parts = ['SELECT * FROM "' + n.tableName + '"'];
    const where = this._whereParts(n);
    if (where.length) parts.push('WHERE ' + where.join(' AND '));
    if (this._order) parts.push('ORDER BY ' + this._order);
    if (this._limit != null) parts.push('LIMIT ' + this._limit);
    if (this._offset != null) parts.push('OFFSET ' + this._offset);
    return parts.join(' ');
  }
  async all() {
    this._applyDefaultScope();
    const sql = this._buildSQL();
    const res = await __schemaRunSQL(this._def, sql, this._params);
    const instances = (res.data || []).map(row => this._def._hydrate(res.columns, row));
    // Eager loading: batched second queries (WHERE fk IN (...)) that
    // fill the relation memos. Never changes the root result set.
    if (this._includes.length && instances.length) {
      await __schemaPreload(this._def, instances, this._includes);
    }
    return instances;
  }
  async first() {
    this._limit = 1;
    const arr = await this.all();
    return arr[0] || null;
  }
  async count() {
    this._applyDefaultScope();
    const n = this._def._normalize();
    const parts = ['SELECT COUNT(*) FROM "' + n.tableName + '"'];
    const where = this._whereParts(n);
    if (where.length) parts.push('WHERE ' + where.join(' AND '));
    const res = await __schemaRunSQL(this._def, parts.join(' '), this._params);
    return res.data?.[0]?.[0] || 0;
  }
  // One UPDATE statement for every matching row. Bypasses validation
  // and per-instance hooks — the name says "all", the docs say "raw".
  // Returns the adapter's reported row count when available.
  async updateAll(values) {
    this._applyDefaultScope();
    const n = this._def._normalize();
    const keys = values && typeof values === 'object' ? Object.keys(values) : [];
    if (!keys.length) throw new Error('updateAll: requires at least one column to set');
    const sets = [];
    const params = [];
    for (const k of keys) {
      const name = __schemaCamel(k);
      const field = n.fields.get(name);
      sets.push('"' + __schemaSnake(k) + '" = ?');
      params.push(__schemaSerialize(values[k], field));
    }
    if (n.timestamps) {
      sets.push('"updated_at" = ?');
      params.push(new Date().toISOString());
    }
    const where = this._whereParts(n);
    let sql = 'UPDATE "' + n.tableName + '" SET ' + sets.join(', ');
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    const res = await __schemaRunSQL(this._def, sql, [...params, ...this._params]);
    return res.rowCount ?? res.rows ?? null;
  }
  // One statement for every matching row. Soft-delete aware: on a
  // @softDelete model this is an UPDATE setting deleted_at; on a hard
  // model it's a real DELETE. Bypasses per-instance hooks (bulk path).
  async deleteAll() {
    this._applyDefaultScope();
    const n = this._def._normalize();
    const where = this._whereParts(n);
    let sql, params;
    if (n.softDelete && this._deleted === 'live') {
      sql = 'UPDATE "' + n.tableName + '" SET "deleted_at" = ?';
      params = [new Date().toISOString(), ...this._params];
    } else {
      sql = 'DELETE FROM "' + n.tableName + '"';
      params = this._params;
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    const res = await __schemaRunSQL(this._def, sql, params);
    return res.rowCount ?? res.rows ?? null;
  }
}

// ---- Eager loading ----------------------------------------------------------

// Normalize .includes arguments into [{name, children}] trees. Accepts
// :symbols, strings, arrays, and nested maps to any depth:
//   .includes(:orders)
//   .includes(:author, comments: :author)
function __schemaNormalizeIncludes(specs) {
  const out = [];
  for (const s of specs) {
    if (s == null) continue;
    if (typeof s === 'symbol') out.push({ name: Symbol.keyFor(s) || s.description, children: [] });
    else if (typeof s === 'string') out.push({ name: s, children: [] });
    else if (Array.isArray(s)) out.push(...__schemaNormalizeIncludes(s));
    else if (typeof s === 'object') {
      for (const [k, v] of Object.entries(s)) {
        out.push({ name: k, children: __schemaNormalizeIncludes([v]) });
      }
    }
  }
  return out;
}

// Batched preload: one query per relation per nesting level
// (\`WHERE fk IN (?, …)\`), never JOINs — no row duplication, uniform
// across belongs_to / has_one / has_many. Results land in the relation
// memo, so \`user.orders!\` resolves from cache with no query. Invisible
// to call sites: preloading is purely a performance fact.
async function __schemaPreload(def, instances, specs) {
  if (!instances.length || !specs.length) return;
  const norm = def._normalize();
  for (const spec of specs) {
    const rel = norm.relations.get(spec.name);
    if (!rel) {
      throw new Error(
        "schema: includes('" + spec.name + "') — no such relation on " + (def.name || 'model') +
        '. Declared relations: ' + ([...norm.relations.keys()].join(', ') || '(none)'));
    }
    const target = __SchemaRegistry.get(rel.target);
    if (!target) throw new Error('schema: unknown relation target "' + rel.target + '" from ' + (def.name || 'anon'));
    const children = [];
    if (rel.kind === 'belongsTo') {
      const fkCamel = __schemaCamel(rel.foreignKey);
      const ids = [...new Set(instances.map(i => i[fkCamel]).filter(v => v != null))];
      const rows = ids.length ? await target.findMany(ids) : [];
      const pk = target._normalize().primaryKey;
      const byId = new Map(rows.map(r => [r[pk], r]));
      for (const inst of instances) {
        const v = inst[fkCamel] != null ? (byId.get(inst[fkCamel]) ?? null) : null;
        __schemaRelMemoSet(inst, spec.name, v);
        if (v && !children.includes(v)) children.push(v);
      }
    } else {
      const pk = norm.primaryKey;
      const fkCamel = __schemaCamel(rel.foreignKey);
      const ids = [...new Set(instances.map(i => i[pk]).filter(v => v != null))];
      let rows = [];
      if (ids.length) {
        rows = await new __SchemaQuery(target)
          .where('"' + rel.foreignKey + '" IN (' + ids.map(() => '?').join(', ') + ')', ...ids)
          .all();
      }
      const groups = new Map();
      for (const r of rows) {
        const k = r[fkCamel];
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
        children.push(r);
      }
      for (const inst of instances) {
        const g = groups.get(inst[pk]) || [];
        __schemaRelMemoSet(inst, spec.name, rel.kind === 'hasOne' ? (g[0] ?? null) : g);
      }
    }
    if (spec.children.length) await __schemaPreload(target, children, spec.children);
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

// ---- Save / destroy ----------------------------------------------------------

async function __schemaRunHook(def, inst, name) {
  const fn = def._normalize().hooks.get(name);
  if (fn) await fn.call(inst);
}

// After a successful save/destroy: queue afterCommit/afterRollback on
// the ambient transaction, or fire afterCommit immediately when no
// transaction is open (AR semantics: outside a tx, "commit" is the
// statement itself). Only models that declare one of the two hooks pay
// any cost here.
async function __schemaSettleTxHooks(def, inst) {
  const hooks = def._normalize().hooks;
  if (!hooks.has('afterCommit') && !hooks.has('afterRollback')) return;
  if (!__schemaEnqueueTxHook(def, inst)) {
    await __schemaRunHook(def, inst, 'afterCommit');
  }
}

async function __schemaSave(def, inst) {
  // Re-entry guard. Same-instance re-entry into save() — typically a
  // hook on this very instance calling .save() on \`this\` — would race
  // the snapshot / savedChanges machinery and almost certainly loop
  // forever. Throw a clear error instead. The flag is per-instance, so
  // independent instances saving in parallel are unaffected; sequential
  // saves on the same instance work fine because \`finally\` clears it.
  if (inst._saving) {
    throw new Error(
      "schema: save() re-entered on the same " + (def.name || 'instance') +
      "; a hook on this instance called save() while a save was already in flight."
    );
  }
  inst._saving = true;
  try {

  const norm = def._normalize();
  const isNew = !inst._persisted;

  await __schemaRunHook(def, inst, 'beforeValidation');
  const errs = def._validateFields(inst, true);
  if (errs.length) throw new SchemaError(errs, def.name, def.kind);
  await __schemaRunHook(def, inst, 'afterValidation');

  await __schemaRunHook(def, inst, 'beforeSave');
  if (isNew) await __schemaRunHook(def, inst, 'beforeCreate');
  else       await __schemaRunHook(def, inst, 'beforeUpdate');

  // Reset \`savedChanges\` at the start of every save so it always
  // reflects the most recent write, never accumulates. Hooks running
  // from this point until end-of-save read this Map; afterCreate /
  // afterUpdate / afterSave see the just-completed write's diff.
  inst.savedChanges = new Map();

  if (isNew) {
    const cols = [], placeholders = [], values = [];
    // Track which persisted columns actually got written so savedChanges
    // can record [null, newValue] entries below. Both declared fields
    // and belongsTo FK columns count.
    const writtenColumns = [];
    for (const [n, f] of norm.fields) {
      const v = inst[n];
      if (v == null) continue;
      cols.push('"' + __schemaSnake(n) + '"');
      placeholders.push('?');
      values.push(__schemaSerialize(v, f));
      writtenColumns.push([n, v]);
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
        writtenColumns.push([fkCamel, v]);
      }
    }
    const sql = 'INSERT INTO "' + norm.tableName + '" (' + cols.join(', ') + ') VALUES (' + placeholders.join(', ') + ') RETURNING *';
    const res = await __schemaRunSQL(def, sql, values);
    if (res.data?.[0] && res.columns) {
      __schemaAbsorbRow(inst, res.columns, res.data[0]);
    }
    // Now that the RETURNING columns (id, @timestamps, FKs) are on the
    // instance, !> eager-derived fields can see them. Mirrors the hydrate
    // path, which runs _applyEagerDerived once all declared fields are
    // populated. Per-docs semantics ("materialize once, not reactive")
    // still hold — we're firing once, at end of construction, not on
    // subsequent mutations.
    //
    // Order matters here: snapshot the declared-field state BEFORE
    // flipping \`_persisted\`, so a later save() can never see the
    // combination "_persisted = true, _snapshot = null" (which would
    // fall through to a full-row UPDATE and reintroduce the FK bug).
    def._applyEagerDerived(inst);
    inst._snapshot = __schemaSnapshot(norm, inst);
    inst._persisted = true;
    // Populate savedChanges with [null, newValue] per persisted column
    // that was written (declared fields + belongsTo FKs). Mirrors
    // Active Record: on a fresh INSERT every attribute "changed from
    // nil to its new value". @timestamps columns get the same
    // [null, newValue] treatment using the values RETURNING gave us
    // — they were assigned on this INSERT, so they belong in the diff.
    for (const [n, v] of writtenColumns) inst.savedChanges.set(n, [null, v]);
    if (norm.timestamps) {
      if (inst.createdAt != null) inst.savedChanges.set('createdAt', [null, inst.createdAt]);
      if (inst.updatedAt != null) inst.savedChanges.set('updatedAt', [null, inst.updatedAt]);
    }
  } else {
    // Column-targeted UPDATE: only write fields that actually changed
    // since hydrate / last save (snapshot comparison) or that the caller
    // explicitly marked dirty via .markDirty(name) — escape hatch for
    // in-place mutations of object-valued fields where === can't detect
    // change. Two reasons this matters:
    //   1. Skip a wasted DB round-trip when nothing changed.
    //   2. DuckDB's foreign-key implementation rejects UPDATE statements
    //      that touch indexed columns (PK / UNIQUE) on a row that is
    //      referenced by another table's FK — even when the SET is a
    //      no-op like "mrn = mrn". A full-row UPDATE on a parent table
    //      with any child rows is therefore a hard error in DuckDB.
    //      Writing only changed columns keeps no-op saves entirely off
    //      the index path.
    //
    // We build \`nextSnap\` from the values we are about to write — BEFORE
    // the await — and only install it on success. Doing this after the
    // await would be unsafe under concurrent mutation: a write to the
    // instance during the in-flight query would be captured into the
    // post-await snapshot, mark itself "clean", and never be persisted.
    //
    // \`nextSnap\` is allocated lazily on the first changed field; the
    // common no-op-save path keeps zero allocations.
    const sets = [], values = [];
    const snap = inst._snapshot;
    const dirty = inst._dirty;
    const changes = inst.savedChanges;
    let nextSnap = null;
    // Declared fields.
    for (const [n, f] of norm.fields) {
      const cur = inst[n];
      const isDirty = dirty && dirty.has(n);
      const changed = !snap || !Object.prototype.hasOwnProperty.call(snap, n) || !__schemaSameValue(snap[n], cur);
      if (!isDirty && !changed) continue;
      if (!nextSnap) nextSnap = Object.assign(Object.create(null), snap || {});
      sets.push('"' + __schemaSnake(n) + '" = ?');
      values.push(__schemaSerialize(cur, f));
      nextSnap[n] = cur;
      // Record [oldValue, newValue] for hook consumers / audit. Old
      // value comes from the snapshot; if no snapshot existed (first
      // save after a manually-constructed persisted instance) we
      // record null as the old value, which is the best information
      // we have.
      const old = snap && Object.prototype.hasOwnProperty.call(snap, n) ? snap[n] : null;
      changes.set(n, [old, cur]);
    }
    // belongsTo FK columns. Same dirty / snapshot / savedChanges
    // machinery as declared fields, but the SQL column name is
    // already snake_case (rel.foreignKey) and the value isn't passed
    // through __schemaSerialize since FKs are scalar IDs.
    for (const [, rel] of norm.relations) {
      if (rel.kind !== 'belongsTo') continue;
      const fkCamel = __schemaCamel(rel.foreignKey);
      const cur = inst[fkCamel];
      const isDirty = dirty && dirty.has(fkCamel);
      const changed = !snap || !Object.prototype.hasOwnProperty.call(snap, fkCamel) || !__schemaSameValue(snap[fkCamel], cur);
      if (!isDirty && !changed) continue;
      if (!nextSnap) nextSnap = Object.assign(Object.create(null), snap || {});
      sets.push('"' + rel.foreignKey + '" = ?');
      values.push(cur);
      nextSnap[fkCamel] = cur;
      const old = snap && Object.prototype.hasOwnProperty.call(snap, fkCamel) ? snap[fkCamel] : null;
      changes.set(fkCamel, [old, cur]);
    }
    // @timestamps: bump updated_at iff this UPDATE will actually emit
    // SQL. The check sits between the diff loops and the write, so we
    // only touch the column when sets has something else in it —
    // never on a no-op save (which would defeat the column-targeted
    // UPDATE optimization and reintroduce a wasted DB round-trip).
    // The column itself isn't in \`_snapshot\` (we always overwrite it
    // explicitly on every real write, never compare it for diffs),
    // so we mirror the new value onto the instance and record it in
    // savedChanges to mirror Active Record's saved_changes shape.
    //
    // \`oldTs\` is the in-memory value at this moment, which after
    // hydrate is the DB-loaded timestamp and after a prior save in
    // this session is the value we set then. If user code reassigns
    // \`inst.updatedAt\` between saves, the recorded "old" reflects
    // that reassignment, not what's actually in the DB. The implicit
    // column isn't in the snapshot for the same reason it isn't in
    // the diff loop: we always overwrite it on real writes.
    //
    // Declaring \`updatedAt\` as a regular field is rejected at schema
    // definition (__SCHEMA_RESERVED_IMPLICIT) so we can't end up with
    // duplicate "updated_at = ?" entries in \`sets\`.
    if (norm.timestamps && sets.length > 0) {
      const newTs = new Date().toISOString();
      const oldTs = inst.updatedAt != null ? inst.updatedAt : null;
      sets.push('"updated_at" = ?');
      values.push(newTs);
      inst.updatedAt = newTs;
      changes.set('updatedAt', [oldTs, newTs]);
    }
    if (sets.length) {
      // WHERE uses the *original* PK from the snapshot, not the live
      // \`inst[pk]\` value. If user code reassigns the in-memory PK
      // between hydrate and save, the UPDATE still targets the row
      // that was actually loaded — mirrors Active Record, which
      // ignores in-memory PK mutation when building the UPDATE.
      // Falls back to \`inst[pk]\` only when no snapshot exists (e.g.
      // a manually-constructed persisted instance), where there's
      // no better information available. We log a warning in non-prod
      // when the fallback fires, since "persisted instance with no
      // snapshot" is almost always an accidental misuse pattern.
      const pk = norm.primaryKey;
      let wherePk;
      if (snap && snap[pk] != null) {
        wherePk = snap[pk];
      } else {
        wherePk = inst[pk];
        if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
          console.warn(
            "[schema] " + (def.name || 'save()') + ": no _snapshot, falling back to inst." + pk +
            " for the UPDATE WHERE clause. This usually means the instance was constructed " +
            "with _persisted = true without going through hydrate(); the WHERE will target " +
            "whatever inst." + pk + " happens to be at save time."
          );
        }
      }
      values.push(wherePk);
      const sql = 'UPDATE "' + norm.tableName + '" SET ' + sets.join(', ') + ' WHERE "' + pk + '" = ?';
      await __schemaRunSQL(def, sql, values);
      inst._snapshot = nextSnap;
    }
  }
  inst._dirty.clear();

  if (isNew) await __schemaRunHook(def, inst, 'afterCreate');
  else       await __schemaRunHook(def, inst, 'afterUpdate');
  await __schemaRunHook(def, inst, 'afterSave');
  await __schemaSettleTxHooks(def, inst);
  return inst;

  } finally {
    inst._saving = false;
  }
}

// Absorb a RETURNING row onto an instance: camelCase canonical own
// properties plus non-enumerable snake_case aliases. Shared by the
// INSERT path, upsert, and restore.
function __schemaAbsorbRow(inst, columns, row) {
  for (let i = 0; i < columns.length; i++) {
    const snake = columns[i].name;
    const key = __schemaCamel(snake);
    if (!(key in inst)) {
      Object.defineProperty(inst, key, { value: row[i], enumerable: true, writable: true, configurable: true });
    } else {
      inst[key] = row[i];
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

async function __schemaDestroy(def, inst, opts) {
  if (!inst._persisted) return inst;
  const norm = def._normalize();
  const hard = opts && opts.hard === true;
  await __schemaRunHook(def, inst, 'beforeDestroy');
  if (norm.softDelete && !hard) {
    const now = new Date().toISOString();
    await __schemaRunSQL(def, 'UPDATE "' + norm.tableName + '" SET "deleted_at" = ? WHERE "' + norm.primaryKey + '" = ?', [now, inst[norm.primaryKey]]);
    inst.deletedAt = now;
  } else {
    await __schemaRunSQL(def, 'DELETE FROM "' + norm.tableName + '" WHERE "' + norm.primaryKey + '" = ?', [inst[norm.primaryKey]]);
    inst._persisted = false;
  }
  await __schemaRunHook(def, inst, 'afterDestroy');
  await __schemaSettleTxHooks(def, inst);
  return inst;
}

// Soft-delete recovery: UPDATE ... SET deleted_at = NULL. Fires the
// update lifecycle (beforeUpdate/afterUpdate) like Active Record's
// touch-style writes. Only meaningful on @softDelete models.
async function __schemaRestore(def, inst) {
  const norm = def._normalize();
  if (!norm.softDelete) {
    throw new Error('schema: restore() requires @softDelete on ' + (def.name || 'model'));
  }
  if (!inst._persisted) return inst;
  await __schemaRunHook(def, inst, 'beforeUpdate');
  await __schemaRunSQL(def, 'UPDATE "' + norm.tableName + '" SET "deleted_at" = NULL WHERE "' + norm.primaryKey + '" = ?', [inst[norm.primaryKey]]);
  inst.deletedAt = null;
  await __schemaRunHook(def, inst, 'afterUpdate');
  return inst;
}

function __schemaSerialize(v, field) {
  if (field && field.typeName === 'json' && v != null && typeof v === 'object') {
    return JSON.stringify(v);
  }
  return v;
}

// ---- ORM prototype augmentations — added to __SchemaDef ----------------------

__SchemaDef.prototype.find = async function (id) {
  this._assertModel('find');
  // Routed through the builder so find honors the same filters as every
  // other read: the @softDelete \`deleted_at IS NULL\` filter and the
  // model's @defaultScope (Active Record semantics — default_scope
  // applies to find). \`User.unscoped().where(id: …).first!\` is the
  // escape hatch.
  const norm = this._normalize();
  return new __SchemaQuery(this).where({ [norm.primaryKey]: id }).first();
};

__SchemaDef.prototype.findMany = async function (ids) {
  this._assertModel('findMany');
  if (!Array.isArray(ids)) throw new Error('schema: findMany(ids) expects an array');
  if (!ids.length) return [];
  const norm = this._normalize();
  return new __SchemaQuery(this)
    .where('"' + norm.primaryKey + '" IN (' + ids.map(() => '?').join(', ') + ')', ...ids)
    .all();
};

__SchemaDef.prototype.where = function (cond, ...params) {
  this._assertModel('where');
  return new __SchemaQuery(this).where(cond, ...params);
};

__SchemaDef.prototype.includes = function (...specs) {
  this._assertModel('includes');
  return new __SchemaQuery(this).includes(...specs);
};

__SchemaDef.prototype.withDeleted = function () {
  this._assertModel('withDeleted');
  return new __SchemaQuery(this).withDeleted();
};

__SchemaDef.prototype.onlyDeleted = function () {
  this._assertModel('onlyDeleted');
  return new __SchemaQuery(this).onlyDeleted();
};

__SchemaDef.prototype.unscoped = function () {
  this._assertModel('unscoped');
  return new __SchemaQuery(this).unscoped();
};

__SchemaDef.prototype.all = function () {
  this._assertModel('all');
  return new __SchemaQuery(this).all();
};

__SchemaDef.prototype.first = function () {
  this._assertModel('first');
  return new __SchemaQuery(this).first();
};

__SchemaDef.prototype.count = function () {
  this._assertModel('count');
  return new __SchemaQuery(this).count();
};

__SchemaDef.prototype.create = async function (data) {
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
};

// INSERT ... ON CONFLICT (target) DO UPDATE SET ... RETURNING *.
//
//   User.upsert! {email: "a@b.c", name: "Alice"}, on: :email
//
// Validates the row and fires beforeValidation / beforeSave / afterSave.
// beforeCreate/beforeUpdate do NOT fire — the runtime cannot know which
// branch the database took. The conflict target accepts a :symbol,
// string, or array of either (composite targets).
__SchemaDef.prototype.upsert = async function (data, opts) {
  this._assertModel('upsert');
  const norm = this._normalize();
  const on = opts && (opts.on ?? opts.conflict);
  if (on == null) throw new Error("schema: upsert(data, on: :column) requires a conflict target");
  const targets = (Array.isArray(on) ? on : [on]).map(t =>
    __schemaSnake(typeof t === 'symbol' ? (Symbol.keyFor(t) || t.description) : String(t)));

  const klass = this._getClass();
  const canonical = {};
  if (data && typeof data === 'object') {
    for (const k of Object.keys(data)) canonical[__schemaCamel(k)] = data[k];
  }
  const inst = new klass(this._applyDefaults(canonical), false);
  for (const [k, v] of Object.entries(canonical)) {
    if (!(k in inst)) {
      Object.defineProperty(inst, k, { value: v, enumerable: true, writable: true, configurable: true });
    }
  }

  await __schemaRunHook(this, inst, 'beforeValidation');
  const errs = this._validateFields(inst, true);
  if (errs.length) throw new SchemaError(errs, this.name, this.kind);
  await __schemaRunHook(this, inst, 'afterValidation');
  await __schemaRunHook(this, inst, 'beforeSave');

  const cols = [], placeholders = [], values = [];
  for (const [n, f] of norm.fields) {
    const v = inst[n];
    if (v == null) continue;
    cols.push(__schemaSnake(n));
    placeholders.push('?');
    values.push(__schemaSerialize(v, f));
  }
  for (const [, rel] of norm.relations) {
    if (rel.kind !== 'belongsTo') continue;
    const v = inst[__schemaCamel(rel.foreignKey)];
    if (v != null) {
      cols.push(rel.foreignKey);
      placeholders.push('?');
      values.push(v);
    }
  }
  if (!cols.length) throw new Error('schema: upsert() requires at least one column');
  const updateCols = cols.filter(c => !targets.includes(c));
  let conflict = ' ON CONFLICT (' + targets.map(t => '"' + t + '"').join(', ') + ')';
  if (updateCols.length) {
    const sets = updateCols.map(c => '"' + c + '" = EXCLUDED."' + c + '"');
    if (norm.timestamps) sets.push('"updated_at" = CURRENT_TIMESTAMP');
    conflict += ' DO UPDATE SET ' + sets.join(', ');
  } else {
    conflict += ' DO NOTHING';
  }
  const sql = 'INSERT INTO "' + norm.tableName + '" (' + cols.map(c => '"' + c + '"').join(', ') + ')' +
    ' VALUES (' + placeholders.join(', ') + ')' + conflict + ' RETURNING *';
  const res = await __schemaRunSQL(this, sql, values);
  if (res.data?.[0] && res.columns) __schemaAbsorbRow(inst, res.columns, res.data[0]);
  this._applyEagerDerived(inst);
  inst._snapshot = __schemaSnapshot(norm, inst);
  inst._persisted = true;
  await __schemaRunHook(this, inst, 'afterSave');
  await __schemaSettleTxHooks(this, inst);
  return inst;
};

// Bulk insert: validates EVERY row first (collecting all failures into
// one SchemaError, issues prefixed \`[i].field\`, before any SQL), then
// issues one multi-VALUES INSERT ... RETURNING *. Per-instance hooks
// are deliberately skipped — this is the bulk path; use create! in a
// loop when hooks matter. Returns hydrated instances.
__SchemaDef.prototype.insertMany = async function (rows) {
  this._assertModel('insertMany');
  if (!Array.isArray(rows)) throw new Error('schema: insertMany(rows) expects an array');
  if (!rows.length) return [];
  const norm = this._normalize();

  const canonicalRows = [];
  const allErrs = [];
  for (let i = 0; i < rows.length; i++) {
    const canonical = {};
    const data = rows[i];
    if (data && typeof data === 'object') {
      for (const k of Object.keys(data)) canonical[__schemaCamel(k)] = data[k];
    }
    this._applyDefaults(canonical);
    for (const e of this._validateFields(canonical, true)) {
      allErrs.push({
        field: '[' + i + ']' + (e.field ? '.' + e.field : ''),
        error: e.error,
        message: '[' + i + '] ' + e.message,
      });
    }
    canonicalRows.push(canonical);
  }
  if (allErrs.length) throw new SchemaError(allErrs, this.name, this.kind);

  // Column set = union of written columns across rows (missing values
  // insert as NULL / column default).
  const colSet = new Set();
  for (const row of canonicalRows) {
    for (const [n] of norm.fields) if (row[n] != null) colSet.add(n);
    for (const [, rel] of norm.relations) {
      if (rel.kind !== 'belongsTo') continue;
      if (row[__schemaCamel(rel.foreignKey)] != null) colSet.add(__schemaCamel(rel.foreignKey));
    }
  }
  const colNames = [...colSet];
  if (!colNames.length) throw new Error('schema: insertMany() requires at least one column');
  const values = [];
  const tuples = [];
  for (const row of canonicalRows) {
    const slots = [];
    for (const n of colNames) {
      slots.push('?');
      values.push(__schemaSerialize(row[n] ?? null, norm.fields.get(n)));
    }
    tuples.push('(' + slots.join(', ') + ')');
  }
  const sql = 'INSERT INTO "' + norm.tableName + '" (' +
    colNames.map(n => '"' + __schemaSnake(n) + '"').join(', ') + ') VALUES ' +
    tuples.join(', ') + ' RETURNING *';
  const res = await __schemaRunSQL(this, sql, values);
  return (res.data || []).map(row => this._hydrate(res.columns, row));
};

__SchemaDef.prototype._assertModel = function (api) {
  if (this.kind !== 'model') {
    throw new Error('schema: .' + api + '() is :model-only (got :' + this.kind + ')');
  }
}

// ---- Schema algebra (Phase 6) --------------------------------------------
// Invariant: every algebra operation returns a :shape. Model algebra
// strips ORM; :shape algebra drops behavior. Derived shapes preserve
// field metadata (constraints, defaults, modifiers) from the source
// normalized descriptor.
`;
export const SCHEMA_DDL_RUNTIME            = `const __SCHEMA_SQL_TYPES = {
  string: 'VARCHAR', text: 'TEXT', integer: 'INTEGER', number: 'DOUBLE',
  boolean: 'BOOLEAN', date: 'DATE', datetime: 'TIMESTAMP', email: 'VARCHAR',
  url: 'VARCHAR', uuid: 'UUID', phone: 'VARCHAR', zip: 'VARCHAR', json: 'JSON', any: 'JSON',
};

// ---- Canonical table spec ----------------------------------------------------
//
// The DDL emitter's internal model, exposed (roadmap §2.2). One structure
// serves both directions: \`_tableSpec()\` builds it from Layer 2 metadata,
// \`__schemaIntrospect()\` (migrate fragment) builds the same shape from the
// deployed database, and the differ operates on two values of the same type.
//
//   {
//     name,                                    // table name
//     sequence: { name, start } | null,        // auto-id sequence
//     primaryKey,                              // pk column name
//     columns: [{ name, type, notNull, unique, default, primary?, was? }],
//     indexes: [{ name, columns: [..], unique }],
//     foreignKeys: [{ column, refTable, refColumn }],
//     tableWas,                                // rename annotation or null
//   }
//
// \`type\` is the RENDER type (VARCHAR(100) keeps its length hint); the
// differ compares via __schemaTypeKey, which normalizes away parts DuckDB
// doesn't persist. \`default\` is the rendered SQL default string or null.

function __schemaColumnSpec(name, field) {
  let base = __SCHEMA_SQL_TYPES[field.typeName] || 'VARCHAR';
  if (field.array) base = 'JSON';
  if (base === 'VARCHAR' && field.constraints?.max != null) {
    base = 'VARCHAR(' + field.constraints.max + ')';
  }
  return {
    name: __schemaSnake(name),
    type: base,
    notNull: field.required === true,
    unique: field.unique === true,
    default: field.constraints?.default !== undefined
      ? __schemaSQLDefault(field.constraints.default) : null,
    was: field.attrs?.was || null,
  };
}

__SchemaDef.prototype._tableSpec = function (options) {
  this._assertModel('_tableSpec');
  const opts = options || {};
  const norm = this._normalize();
  const table = norm.tableName;
  const seq = table + '_seq';

  // Sequence seed: explicit option wins over @idStart directive wins over 1.
  // DuckDB 1.5.x does not implement ALTER SEQUENCE ... RESTART WITH N, so the
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
  columns.push({
    name: norm.primaryKey, type: 'INTEGER',
    notNull: true, unique: false, primary: true,
    default: "nextval('" + seq + "')", was: null,
  });
  for (const [n, f] of norm.fields) {
    columns.push(__schemaColumnSpec(n, f));
  }

  const foreignKeys = [];
  const notes = [];
  for (const [, rel] of norm.relations) {
    if (rel.kind !== 'belongsTo') continue;
    columns.push({
      name: rel.foreignKey, type: 'INTEGER',
      notNull: !rel.optional, unique: false, default: null, was: null,
    });
    // A relation whose target lives on a DIFFERENT adapter cannot carry
    // a database FK constraint — the referenced table is in another
    // database. The accessor still works (it's just a second query);
    // the DDL suppresses the constraint with a note.
    const targetDef = __SchemaRegistry.get(rel.target);
    const crossAdapter = targetDef &&
      (targetDef._adapter || null) !== (this._adapter || null);
    if (crossAdapter) {
      notes.push('-- NOTE: ' + rel.foreignKey + ' references ' + __schemaTableName(rel.target) +
        '(id) on a different adapter; FK constraint suppressed (cross-database constraints are impossible)');
      continue;
    }
    foreignKeys.push({
      column: rel.foreignKey,
      refTable: __schemaTableName(rel.target),
      refColumn: 'id',
    });
  }

  if (norm.timestamps) {
    columns.push({ name: 'created_at', type: 'TIMESTAMP', notNull: false, unique: false, default: 'CURRENT_TIMESTAMP', was: null });
    columns.push({ name: 'updated_at', type: 'TIMESTAMP', notNull: false, unique: false, default: 'CURRENT_TIMESTAMP', was: null });
  }
  if (norm.softDelete) {
    columns.push({ name: 'deleted_at', type: 'TIMESTAMP', notNull: false, unique: false, default: null, was: null });
  }

  // Index names are derived from their column set (\`idx_<table>_<cols>\`),
  // so two declarations on the same columns collide. That's always a
  // redundant/contradictory schema (a \`@unique\` index already serves as an
  // index for those columns) — reject it loudly rather than emit duplicate
  // CREATE INDEX statements.
  const indexes = [];
  const indexByName = new Map();
  const addIndex = (ix) => {
    if (indexByName.has(ix.name)) {
      throw new Error(
        \`Table '\${table}': duplicate index '\${ix.name}' on (\${ix.columns.join(', ')}). \` +
        \`Those columns are declared unique/indexed more than once — a '@unique' already \` +
        \`creates an index, so remove the redundant '@unique'/'@index' declaration.\`);
    }
    indexByName.set(ix.name, ix);
    indexes.push(ix);
  };
  for (const [n, f] of norm.fields) {
    if (!f.unique) continue;
    const col = __schemaSnake(n);
    addIndex({ name: 'idx_' + table + '_' + col, columns: [col], unique: true });
  }
  for (const d of norm.directives) {
    if (d.name !== 'index' && d.name !== 'unique') continue;
    const ixArgs = d.args?.[0] || {};
    const cols = (ixArgs.fields || []).map(__schemaSnake);
    if (!cols.length) continue;
    addIndex({ name: 'idx_' + table + '_' + cols.join('_'), columns: cols, unique: d.name === 'unique' });
  }

  return {
    name: table,
    sequence: { name: seq, start: idStart },
    primaryKey: norm.primaryKey,
    columns, indexes, foreignKeys, notes,
    tableWas: norm.tableWas || null,
  };
};

// ---- DDL rendering ------------------------------------------------------------

// Render one column line for CREATE TABLE — also used by the differ's
// ADD COLUMN steps (minus the parts DuckDB can't ALTER in).
function __schemaRenderColumn(spec, col, fkByColumn) {
  const parts = ['  ' + col.name + ' ' + col.type];
  if (col.primary) {
    parts[0] = '  ' + col.name + ' ' + col.type + ' PRIMARY KEY';
  } else {
    if (col.notNull) parts.push('NOT NULL');
    // Uniqueness is emitted as a single named index (\`idx_<table>_<col>\`),
    // never as an inline column \`UNIQUE\`. Inline UNIQUE created a second,
    // auto-named index the migrate differ's fold (__schemaFoldSpec) can't
    // normalize; the named index is what ADD COLUMN and introspection
    // already round-trip through. \`col.unique\` stays the canonical spec
    // flag — it drives the index below and the differ — it just no longer
    // renders here.
  }
  const fk = fkByColumn ? fkByColumn.get(col.name) : null;
  if (fk) parts.push('REFERENCES ' + fk.refTable + '(' + fk.refColumn + ')');
  if (col.default != null) parts.push('DEFAULT ' + col.default);
  return parts.join(' ');
}

function __schemaRenderIndex(spec, ix) {
  const u = ix.unique ? 'UNIQUE ' : '';
  return 'CREATE ' + u + 'INDEX ' + ix.name + ' ON ' + spec.name +
    ' (' + ix.columns.map(c => '"' + c + '"').join(', ') + ');';
}

// Render the CREATE SEQUENCE / CREATE TABLE / CREATE INDEX blocks for a
// table spec. toSQL() joins these; the differ's ADD TABLE step reuses them.
function __schemaRenderCreate(spec) {
  const blocks = [];
  const fkByColumn = new Map(spec.foreignKeys.map(fk => [fk.column, fk]));
  if (spec.sequence) {
    blocks.push('CREATE SEQUENCE ' + spec.sequence.name + ' START ' + spec.sequence.start + ';');
  }
  const lines = spec.columns.map(c => __schemaRenderColumn(spec, c, fkByColumn));
  blocks.push('CREATE TABLE ' + spec.name + ' (\\n' + lines.join(',\\n') + '\\n);');
  const ix = spec.indexes.map(i => __schemaRenderIndex(spec, i));
  if (ix.length) blocks.push(ix.join('\\n'));
  if (spec.notes && spec.notes.length) blocks.push(spec.notes.join('\\n'));
  return blocks;
}

function __schemaToSQL(def, options) {
  const opts = options || {};
  const { dropFirst = false, header } = opts;
  const spec = def._tableSpec(opts);
  const blocks = [];
  if (header) blocks.push(header);
  if (dropFirst) {
    blocks.push('DROP TABLE IF EXISTS ' + spec.name + ' CASCADE;\\nDROP SEQUENCE IF EXISTS ' + spec.sequence.name + ';');
  }
  blocks.push(...__schemaRenderCreate(spec));
  return blocks.join('\\n\\n') + '\\n';
}

function __schemaSQLDefault(v) {
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (v === null) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return "'" + v.replace(/'/g, "''") + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

// DDL prototype augmentation — added to __SchemaDef

__SchemaDef.prototype.toSQL = function (options) {
  this._assertModel('toSQL');
  return __schemaToSQL(this, options);
};
`;
export const SCHEMA_MIGRATE_RUNTIME        = `// ---- Schema evolution: introspect → diff → status / make / migrate ----------
//
// \`toSQL()\` solves greenfield CREATE; this fragment solves evolution:
// diff the declared models against the deployed database and emit ALTER
// migrations, with history, checksums, and destructive-change gates.
//
//   schema.plan()                 → classified diff steps (pure, no files)
//   schema.status(opts)           → { steps, applied, pending, mismatched }
//   schema.make(name, opts)       → write migrations/NNNN_name.sql from the diff
//   schema.migrate(opts)          → apply pending migration files in order
//   schema.introspect()           → DeployedSchema (canonical table specs)
//
// Migration FILES are plain SQL — numbered, hand-editable, checked into
// git. The generator writes them; humans may amend them; migrate()
// applies them and records (version, name, checksum, applied_at) in the
// \`_rip_migrations\` table. A checksum mismatch on an applied file aborts
// (someone edited history) unless {repair: true} re-records checksums.

const __SCHEMA_MIGRATIONS_TABLE = '_rip_migrations';

// ---- Row materializer ---------------------------------------------------------

function __schemaMigrateRows(res) {
  const cols = (res.columns || []).map(c => c.name);
  return (res.data || []).map(row => {
    const obj = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = row[i];
    return obj;
  });
}

// ---- Introspection ------------------------------------------------------------

// Build the DeployedSchema — an array of canonical table specs in the
// same shape \`_tableSpec()\` produces — from the live database. Uses the
// adapter's \`introspect()\` capability when present (Contract v2);
// otherwise falls back to DuckDB catalog queries through \`query()\`.
async function __schemaIntrospect() {
  if (typeof __schemaAdapter.introspect === 'function') {
    return await __schemaAdapter.introspect();
  }
  const q = (sql) => __schemaRunSQL(null, sql, []);
  const [tablesRes, columnsRes, constraintsRes, indexesRes, sequencesRes] = [
    await q("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_type = 'BASE TABLE'"),
    await q("SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'main' ORDER BY table_name, ordinal_position"),
    await q("SELECT table_name, constraint_type, constraint_column_names, constraint_text FROM duckdb_constraints() WHERE schema_name = 'main'"),
    await q("SELECT table_name, index_name, is_unique, expressions FROM duckdb_indexes() WHERE schema_name = 'main'"),
    await q("SELECT sequence_name, start_value FROM duckdb_sequences() WHERE schema_name = 'main'"),
  ];

  const tables = new Map();
  for (const r of __schemaMigrateRows(tablesRes)) {
    if (r.table_name === __SCHEMA_MIGRATIONS_TABLE) continue;
    tables.set(r.table_name, {
      name: r.table_name,
      sequence: null,
      primaryKey: null,
      columns: [],
      indexes: [],
      foreignKeys: [],
      tableWas: null,
    });
  }

  for (const r of __schemaMigrateRows(columnsRes)) {
    const t = tables.get(r.table_name);
    if (!t) continue;
    t.columns.push({
      name: r.column_name,
      type: r.data_type,
      notNull: r.is_nullable === 'NO',
      unique: false,
      default: r.column_default != null && r.column_default !== '' ? r.column_default : null,
      was: null,
    });
  }

  // constraint_column_names arrives as a JSON array over harbor, or as a
  // "[a, b]" string from other transports. Normalize to string[].
  const listOf = (v) => {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string') {
      const inner = v.replace(/^\\[/, '').replace(/\\]$/, '').trim();
      return inner ? inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')) : [];
    }
    return [];
  };

  for (const r of __schemaMigrateRows(constraintsRes)) {
    const t = tables.get(r.table_name);
    if (!t) continue;
    const cols = listOf(r.constraint_column_names);
    if (r.constraint_type === 'PRIMARY KEY' && cols.length === 1) {
      t.primaryKey = cols[0];
      const col = t.columns.find(c => c.name === cols[0]);
      if (col) col.primary = true;
    } else if (r.constraint_type === 'UNIQUE' && cols.length === 1) {
      const col = t.columns.find(c => c.name === cols[0]);
      if (col) col.unique = true;
    } else if (r.constraint_type === 'FOREIGN KEY') {
      const m = String(r.constraint_text || '').match(/FOREIGN KEY\\s*\\(([^)]+)\\)\\s*REFERENCES\\s+(\\S+?)\\s*\\(([^)]+)\\)/i);
      if (m) {
        t.foreignKeys.push({ column: m[1].trim(), refTable: m[2].trim(), refColumn: m[3].trim() });
      } else if (cols.length === 1) {
        t.foreignKeys.push({ column: cols[0], refTable: null, refColumn: null });
      }
    }
  }

  for (const r of __schemaMigrateRows(indexesRes)) {
    const t = tables.get(r.table_name);
    if (!t) continue;
    t.indexes.push({
      name: r.index_name,
      columns: listOf(r.expressions),
      unique: r.is_unique === true || r.is_unique === 'true',
    });
  }

  for (const r of __schemaMigrateRows(sequencesRes)) {
    // Attach by the \`<table>_seq\` naming convention the DDL emitter uses.
    const tableName = String(r.sequence_name).replace(/_seq$/, '');
    const t = tables.get(tableName);
    if (t && String(r.sequence_name).endsWith('_seq')) {
      t.sequence = { name: r.sequence_name, start: Number(r.start_value) };
    }
  }

  return { tables: [...tables.values()] };
}

// Canonical declared schema: one table spec per registered :model.
function __schemaCanonicalDeclared() {
  const tables = [];
  for (const [, entry] of __SchemaRegistry._entries) {
    if (entry.kind !== 'model') continue;
    tables.push(entry.def._tableSpec());
  }
  return { tables };
}

// ---- Comparison normalizers ----------------------------------------------------

// DuckDB does not persist VARCHAR length hints, and reports several type
// aliases under canonical names. Compare under those equivalences.
const __SCHEMA_TYPE_ALIASES = {
  'TEXT': 'VARCHAR', 'CHARACTER VARYING': 'VARCHAR', 'CHAR': 'VARCHAR', 'BPCHAR': 'VARCHAR', 'STRING': 'VARCHAR',
  'INT': 'INTEGER', 'INT4': 'INTEGER', 'SIGNED': 'INTEGER',
  'INT8': 'BIGINT', 'LONG': 'BIGINT',
  'FLOAT8': 'DOUBLE', 'DOUBLE PRECISION': 'DOUBLE',
  'BOOL': 'BOOLEAN', 'LOGICAL': 'BOOLEAN',
  'DATETIME': 'TIMESTAMP', 'TIMESTAMP WITHOUT TIME ZONE': 'TIMESTAMP',
};

function __schemaTypeKey(t) {
  let k = String(t || '').toUpperCase().replace(/\\(.*\\)\\s*$/, '').trim();
  return __SCHEMA_TYPE_ALIASES[k] || k;
}

// Tolerant default comparison: deployed defaults round-trip through the
// catalog with cosmetic differences (CAST wrappers, now() for
// CURRENT_TIMESTAMP, case). Don't emit ALTERs for representation noise.
function __schemaDefaultKey(d) {
  if (d == null) return '';
  let s = String(d).trim();
  const cast = s.match(/^CAST\\s*\\(\\s*(.*?)\\s+AS\\s+[A-Za-z0-9_ ()]+\\)$/i);
  if (cast) s = cast[1].trim();
  s = s.toLowerCase();
  if (s === 'now()' || s === 'current_timestamp()' || s === 'get_current_timestamp()') s = 'current_timestamp';
  return s;
}

// Fold the \`#\`-modifier pattern: a UNIQUE column plus its auto-named
// single-column unique index (\`idx_<table>_<col>\`) count as ONE fact —
// the column's unique flag. Applies to both sides so the differ never
// sees the pair as two separate diffs.
function __schemaFoldSpec(spec) {
  const columnsByName = new Map(spec.columns.map(c => [c.name, c]));
  const indexes = [];
  for (const ix of spec.indexes) {
    const autoName = ix.columns.length === 1 && ix.name === 'idx_' + spec.name + '_' + ix.columns[0];
    if (ix.unique && autoName) {
      const col = columnsByName.get(ix.columns[0]);
      if (col) { col.unique = true; continue; }
    }
    indexes.push(ix);
  }
  return { ...spec, indexes };
}

// ---- The differ -----------------------------------------------------------------
//
// Returns classified steps:
//
//   { table, kind, class: 'safe' | 'lossy' | 'destructive' | 'blocked',
//     sql: [statements/comments], notes: [strings] }
//
// Classes gate generation (\`make\` refuses lossy/destructive without the
// matching allow flag, and refuses \`blocked\` outright); the printed plan
// always shows everything.
//
// DuckDB ALTER constraints shape several decisions:
//   - ADD COLUMN cannot carry NOT NULL / UNIQUE / REFERENCES → required
//     adds become add + (backfill) + SET NOT NULL; unique adds get a
//     separate CREATE UNIQUE INDEX; FK constraints cannot be added to an
//     existing table at all (note emitted).
//   - A table referenced by another table's FOREIGN KEY is frozen for
//     everything except ADD COLUMN and index DDL ("Dependency Error:
//     cannot alter entry") — even DROP TABLE … CASCADE is refused.
//     Steps that hit this wall classify as \`blocked\`: the change
//     requires dropping/rebuilding the referencing tables around it.
//   - No SAVEPOINT / ALTER SEQUENCE RESTART → sequence-start drift is a
//     note, not a step.

// Step kinds DuckDB executes even when the table is FK-referenced.
const __SCHEMA_UNBLOCKED_KINDS = new Set([
  'create-table', 'add-column', 'create-index', 'drop-index', 'note-fk',
]);

// Mark steps that DuckDB will refuse because the target table is
// referenced by other tables' FOREIGN KEYs.
function __schemaApplyFkBlocks(steps, deployed) {
  const referencedBy = new Map(); // table → [child.fkColumn, ...]
  for (const t of deployed.tables) {
    for (const fk of t.foreignKeys) {
      if (!fk.refTable) continue;
      if (!referencedBy.has(fk.refTable)) referencedBy.set(fk.refTable, []);
      referencedBy.get(fk.refTable).push(t.name + '.' + fk.column);
    }
  }
  for (const s of steps) {
    if (__SCHEMA_UNBLOCKED_KINDS.has(s.kind)) continue;
    const refs = referencedBy.get(s.table) ||
      (s.kind === 'rename-table' && s.sql[0] ? referencedBy.get((s.sql[0].match(/^ALTER TABLE (\\S+) RENAME TO/) || [])[1]) : null);
    if (!refs || !refs.length) continue;
    s.class = 'blocked';
    s.notes.push(
      'DuckDB refuses this ALTER while ' + refs.join(', ') + ' reference(s) this table ' +
      '("Dependency Error"). Rebuild the referencing table(s) around this change, or ' +
      'apply it manually with the referencing tables dropped and recreated.');
  }
  return steps;
}

function __schemaDiff(declared, deployed) {
  const steps = [];
  const dTables = new Map(declared.tables.map(t => [t.name, __schemaFoldSpec(t)]));
  const pTables = new Map(deployed.tables.map(t => [t.name, __schemaFoldSpec(t)]));

  // Table renames first: declared table missing from deployed, with a
  // @tableWas pointing at a deployed table that no declared model claims.
  for (const [name, d] of dTables) {
    if (pTables.has(name) || !d.tableWas) continue;
    const old = pTables.get(d.tableWas);
    if (old && !dTables.has(d.tableWas)) {
      steps.push({
        table: name, kind: 'rename-table', class: 'safe',
        sql: ['ALTER TABLE ' + d.tableWas + ' RENAME TO ' + name + ';'],
        notes: ["@tableWas " + d.tableWas + " can be removed once this migration lands"],
      });
      pTables.delete(d.tableWas);
      pTables.set(name, { ...old, name });
    }
  }

  // Matched tables next: column / index / FK diffs. Alters run BEFORE
  // create-table steps on purpose — a new child table's FOREIGN KEY
  // freezes its parent the moment it exists, so a migration that both
  // alters \`orders\` and creates \`invoices REFERENCES orders\` must alter
  // first.
  for (const [name, d] of dTables) {
    const p = pTables.get(name);
    if (!p) continue;
    __schemaDiffTable(d, p, steps);
  }

  // New tables.
  for (const [name, d] of dTables) {
    if (pTables.has(name)) continue;
    steps.push({
      table: name, kind: 'create-table', class: 'safe',
      sql: __schemaRenderCreate(d),
      notes: [],
    });
  }

  // Dropped tables (deployed but not declared) — the "someone ran manual
  // SQL" detector doubles as the model-deletion path. Destructive.
  for (const [name, p] of pTables) {
    if (dTables.has(name)) continue;
    const sql = ['DROP TABLE ' + name + ';'];
    if (p.sequence) sql.push('DROP SEQUENCE ' + p.sequence.name + ';');
    steps.push({ table: name, kind: 'drop-table', class: 'destructive', sql, notes: [] });
  }

  return __schemaApplyFkBlocks(steps, deployed);
}

function __schemaDiffTable(d, p, steps) {
  const t = d.name;
  const dCols = new Map(d.columns.map(c => [c.name, c]));
  const pCols = new Map(p.columns.map(c => [c.name, c]));

  // Column renames: declared column missing from deployed whose \`was\`
  // names a deployed column that no declared column claims.
  for (const [name, col] of dCols) {
    if (pCols.has(name) || !col.was) continue;
    const old = pCols.get(col.was);
    if (old && !dCols.has(col.was)) {
      steps.push({
        table: t, kind: 'rename-column', class: 'safe',
        sql: ['ALTER TABLE ' + t + ' RENAME COLUMN ' + col.was + ' TO ' + name + ';'],
        notes: ['{was: "' + col.was + '"} on ' + name + ' can be removed once this migration lands'],
      });
      pCols.delete(col.was);
      pCols.set(name, { ...old, name });
    }
  }

  // Added columns.
  for (const [name, col] of dCols) {
    if (pCols.has(name)) continue;
    const sql = [];
    const notes = [];
    let cls = 'safe';
    // DuckDB: ADD COLUMN cannot carry constraints. DEFAULT is allowed
    // (and backfills existing rows), so add with the default when one
    // is declared, then tighten with SET NOT NULL.
    let add = 'ALTER TABLE ' + t + ' ADD COLUMN ' + name + ' ' + col.type;
    if (col.default != null) add += ' DEFAULT ' + col.default;
    sql.push(add + ';');
    if (col.notNull) {
      if (col.default == null) {
        sql.push("-- TODO: backfill " + t + "." + name + " before SET NOT NULL (required column, no default)");
      }
      sql.push('ALTER TABLE ' + t + ' ALTER COLUMN ' + name + ' SET NOT NULL;');
    }
    if (col.unique) {
      sql.push('CREATE UNIQUE INDEX idx_' + t + '_' + name + ' ON ' + t + ' ("' + name + '");');
    }
    const fk = d.foreignKeys.find(f => f.column === name);
    if (fk) {
      notes.push('DuckDB cannot add FOREIGN KEY constraints to an existing table; ' +
        name + ' -> ' + fk.refTable + '(' + fk.refColumn + ') is unenforced until the table is recreated');
    }
    steps.push({ table: t, kind: 'add-column', class: cls, sql, notes });
  }

  // Dropped columns.
  for (const [name] of pCols) {
    if (dCols.has(name)) continue;
    steps.push({
      table: t, kind: 'drop-column', class: 'destructive',
      sql: ['ALTER TABLE ' + t + ' DROP COLUMN ' + name + ';'],
      notes: [],
    });
  }

  // Altered columns.
  for (const [name, dc] of dCols) {
    const pc = pCols.get(name);
    if (!pc) continue;
    if (dc.primary || pc.primary) continue; // pk shape is fixed (INTEGER + nextval)
    if (__schemaTypeKey(dc.type) !== __schemaTypeKey(pc.type)) {
      steps.push({
        table: t, kind: 'alter-type', class: 'lossy',
        sql: ['ALTER TABLE ' + t + ' ALTER COLUMN ' + name + ' TYPE ' + dc.type + ';'],
        notes: [pc.type + ' -> ' + dc.type + ' casts existing values; rows that cannot cast will fail the migration'],
      });
    }
    if (dc.notNull !== pc.notNull) {
      if (dc.notNull) {
        steps.push({
          table: t, kind: 'set-not-null', class: 'lossy',
          sql: ['ALTER TABLE ' + t + ' ALTER COLUMN ' + name + ' SET NOT NULL;'],
          notes: ['fails if existing rows hold NULLs — backfill first'],
        });
      } else {
        steps.push({
          table: t, kind: 'drop-not-null', class: 'safe',
          sql: ['ALTER TABLE ' + t + ' ALTER COLUMN ' + name + ' DROP NOT NULL;'],
          notes: [],
        });
      }
    }
    if (__schemaDefaultKey(dc.default) !== __schemaDefaultKey(pc.default)) {
      steps.push({
        table: t, kind: 'alter-default', class: 'safe',
        sql: [dc.default != null
          ? 'ALTER TABLE ' + t + ' ALTER COLUMN ' + name + ' SET DEFAULT ' + dc.default + ';'
          : 'ALTER TABLE ' + t + ' ALTER COLUMN ' + name + ' DROP DEFAULT;'],
        notes: [],
      });
    }
    if (dc.unique !== pc.unique) {
      if (dc.unique) {
        steps.push({
          table: t, kind: 'add-unique', class: 'lossy',
          sql: ['CREATE UNIQUE INDEX idx_' + t + '_' + name + ' ON ' + t + ' ("' + name + '");'],
          notes: ['fails if existing rows hold duplicates'],
        });
      } else {
        steps.push({
          table: t, kind: 'drop-unique', class: 'safe',
          sql: ['DROP INDEX IF EXISTS idx_' + t + '_' + name + ';'],
          notes: ['a UNIQUE declared inline in CREATE TABLE cannot be dropped by index name; recreate the table if this fails'],
        });
      }
    }
  }

  // Index diffs (auto-unique indexes already folded into column flags).
  const dIdx = new Map(d.indexes.map(i => [i.name, i]));
  const pIdx = new Map(p.indexes.map(i => [i.name, i]));
  for (const [name, ix] of dIdx) {
    const ex = pIdx.get(name);
    if (ex && ex.unique === ix.unique &&
        ex.columns.join(',') === ix.columns.join(',')) continue;
    const sql = [];
    if (ex) sql.push('DROP INDEX ' + name + ';');
    sql.push(__schemaRenderIndex(d, ix));
    steps.push({
      table: t, kind: 'create-index', class: ix.unique ? 'lossy' : 'safe',
      sql,
      notes: ix.unique ? ['unique index creation fails if existing rows hold duplicates'] : [],
    });
  }
  for (const [name] of pIdx) {
    if (dIdx.has(name)) continue;
    steps.push({
      table: t, kind: 'drop-index', class: 'safe',
      sql: ['DROP INDEX ' + name + ';'],
      notes: [],
    });
  }

  // FK diffs are notes only — DuckDB has no ALTER TABLE ADD/DROP CONSTRAINT.
  const pFks = new Set(p.foreignKeys.map(f => f.column));
  for (const fk of d.foreignKeys) {
    if (pFks.has(fk.column) || !pCols.has(fk.column)) continue;
    steps.push({
      table: t, kind: 'note-fk', class: 'safe',
      sql: ['-- NOTE: ' + t + '.' + fk.column + ' should reference ' + fk.refTable + '(' + fk.refColumn + ') ' +
           'but DuckDB cannot add FK constraints to an existing table'],
      notes: [],
    });
  }
}

// ---- Plan rendering --------------------------------------------------------------

function __schemaRenderPlan(steps) {
  const lines = [];
  for (const s of steps) {
    lines.push('-- [' + s.class + '] ' + s.kind + ' ' + s.table);
    for (const n of s.notes) lines.push('--   ' + n);
    lines.push(...s.sql);
    lines.push('');
  }
  return lines.join('\\n');
}

// ---- Migration files & history ------------------------------------------------------

const __SCHEMA_MIGRATION_FILE_RE = /^(\\d{4,})_(.+)\\.sql$/;

async function __schemaMigrationFiles(dir) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const crypto = await import('node:crypto');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const m = f.match(__SCHEMA_MIGRATION_FILE_RE);
    if (!m) continue;
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    out.push({
      version: m[1],
      name: m[2],
      file: path.join(dir, f),
      checksum: crypto.createHash('sha256').update(content).digest('hex'),
      content,
    });
  }
  return out;
}

async function __schemaAppliedMigrations() {
  try {
    const res = await __schemaRunSQL(null,
      'SELECT version, name, checksum, applied_at FROM ' + __SCHEMA_MIGRATIONS_TABLE + ' ORDER BY version', []);
    return __schemaMigrateRows(res);
  } catch (e) {
    // History table doesn't exist yet — nothing applied. Anything else
    // (connection refused, auth) should propagate.
    if (/does not exist|Catalog Error/i.test(e?.message || '')) return [];
    throw e;
  }
}

async function __schemaEnsureMigrationsTable() {
  await __schemaRunSQL(null,
    'CREATE TABLE IF NOT EXISTS ' + __SCHEMA_MIGRATIONS_TABLE +
    ' (version VARCHAR PRIMARY KEY, name VARCHAR, checksum VARCHAR, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)', []);
}

// Split a migration file into statements: ';' terminates, except inside
// single-quoted strings; \`--\` line comments pass through attached to the
// following statement (so a leading TODO comment is visible in errors but
// never executed alone). Pure-comment / empty fragments are dropped.
function __schemaSplitStatements(sql) {
  const out = [];
  let cur = '';
  let inString = false;
  let inComment = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inComment) {
      cur += ch;
      if (ch === '\\n') inComment = false;
      continue;
    }
    if (inString) {
      cur += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") { cur += "'"; i++; }
        else inString = false;
      }
      continue;
    }
    if (ch === "'") { inString = true; cur += ch; continue; }
    if (ch === '-' && sql[i + 1] === '-') { inComment = true; cur += ch; continue; }
    if (ch === ';') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  // Strip comment-only / empty fragments; keep executable text intact.
  return out
    .map(s => s.trim())
    .filter(s => s && s.split('\\n').some(line => {
      const l = line.trim();
      return l && !l.startsWith('--');
    }));
}

// ---- Public functions ----------------------------------------------------------------

async function __schemaPlan() {
  const declared = __schemaCanonicalDeclared();
  if (!declared.tables.length) {
    throw new Error('schema.plan(): no :model schemas are registered — import your model files first');
  }
  const deployed = await __schemaIntrospect();
  return __schemaDiff(declared, deployed);
}

async function __schemaStatus(opts = {}) {
  const dir = opts.dir || 'migrations';
  const steps = await __schemaPlan();
  const files = await __schemaMigrationFiles(dir);
  const applied = await __schemaAppliedMigrations();
  const appliedByVersion = new Map(applied.map(a => [a.version, a]));
  const pending = files.filter(f => !appliedByVersion.has(f.version));
  const mismatched = files.filter(f => {
    const a = appliedByVersion.get(f.version);
    return a && a.checksum !== f.checksum;
  }).map(f => f.version + '_' + f.name);
  return { steps, files, applied, pending, mismatched };
}

async function __schemaMake(name, opts = {}) {
  if (!name || typeof name !== 'string') {
    throw new Error("schema.make(name): a migration name is required, e.g. schema.make('add_orders')");
  }
  const dir = opts.dir || 'migrations';
  const steps = await __schemaPlan();
  if (!steps.length) return null;

  const blocked = steps.filter(s => s.class === 'blocked');
  if (blocked.length) {
    const list = blocked.map(s => '  [blocked] ' + s.kind + ' ' + s.table + '\\n    ' + s.notes.join('\\n    ')).join('\\n');
    throw new Error(
      'schema.make: the plan contains steps DuckDB cannot execute while foreign keys reference the table:\\n' +
      list + '\\nThese need a manual rebuild of the referencing tables; no flag overrides this.');
  }
  const gated = [];
  for (const s of steps) {
    if (s.class === 'lossy' && !opts.allowLossy) gated.push(s);
    if (s.class === 'destructive' && !opts.allowDestructive) gated.push(s);
  }
  if (gated.length) {
    const list = gated.map(s => '  [' + s.class + '] ' + s.kind + ' ' + s.table).join('\\n');
    throw new Error(
      'schema.make: the plan contains gated steps:\\n' + list +
      '\\nPass {allowLossy: true} / {allowDestructive: true} (CLI: --allow-lossy / --allow-destructive) to include them.');
  }

  const fs = await import('node:fs');
  const path = await import('node:path');
  const files = await __schemaMigrationFiles(dir);
  const next = files.length ? Math.max(...files.map(f => parseInt(f.version, 10))) + 1 : 1;
  const version = String(next).padStart(4, '0');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'migration';
  const file = path.join(dir, version + '_' + slug + '.sql');

  const body =
    '-- ' + version + '_' + slug + '.sql\\n' +
    '-- Generated by \`rip schema make\` — review (and edit) before applying.\\n' +
    '-- Apply with \`rip schema migrate\`.\\n\\n' +
    __schemaRenderPlan(steps);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, body);
  return { file, version, steps };
}

async function __schemaMigrate(opts = {}) {
  const dir = opts.dir || 'migrations';
  const files = await __schemaMigrationFiles(dir);
  await __schemaEnsureMigrationsTable();
  const applied = await __schemaAppliedMigrations();
  const appliedByVersion = new Map(applied.map(a => [a.version, a]));

  // History integrity: an applied file whose content changed is an
  // edited-history error — abort unless {repair: true} re-records.
  for (const f of files) {
    const a = appliedByVersion.get(f.version);
    if (!a || a.checksum === f.checksum) continue;
    if (opts.repair) {
      await __schemaRunSQL(null,
        'UPDATE ' + __SCHEMA_MIGRATIONS_TABLE + ' SET checksum = ? WHERE version = ?',
        [f.checksum, f.version]);
    } else {
      throw new Error(
        'schema.migrate: checksum mismatch on applied migration ' + f.version + '_' + f.name +
        ' — the file changed after it was applied. Restore the original file, or re-record with {repair: true} (CLI: --repair).');
    }
  }

  const pending = files.filter(f => !appliedByVersion.has(f.version));
  const ran = [];
  for (const f of pending) {
    const statements = __schemaSplitStatements(f.content);
    const apply = async () => {
      for (const stmt of statements) {
        await __schemaRunSQL(null, stmt, []);
      }
      await __schemaRunSQL(null,
        'INSERT INTO ' + __SCHEMA_MIGRATIONS_TABLE + ' (version, name, checksum) VALUES (?, ?, ?)',
        [f.version, f.name, f.checksum]);
    };
    // Transactional apply when the adapter supports it — a failed
    // statement leaves neither earlier statements nor the history row.
    if (typeof __schemaAdapter.begin === 'function') {
      await __schemaTransaction(apply);
    } else {
      await apply();
    }
    ran.push(f.version + '_' + f.name);
  }
  return { ran, pending: [] };
}
`;
export const SCHEMA_BROWSER_STUBS_RUNTIME  = `// Browser stubs — throwing replacements for every ORM / DDL helper that
// the validate fragment references but doesn't implement. Loaded ONLY
// in browser mode.
//
// The validate fragment's \`_makeClass\`, \`_normalize\`, and
// \`__schemaNormalizeDirectiveRelation\` reference helpers that live in
// db-naming, orm, and ddl fragments at runtime. Browser mode doesn't
// include those fragments, so we provide thin throwing stubs here so
// browser-side schema declarations parse and validate cleanly while
// any attempt to use server-only behavior fails with a helpful message.

const __schemaBrowserStub = (api) => function() {
  throw new Error(
    "schema." + api + "() is not available in the browser. " +
    "Import @rip-lang/db on the server."
  );
};

// Static / class-level methods on __SchemaDef
__SchemaDef.prototype.find        = __schemaBrowserStub('find');
__SchemaDef.prototype.findMany    = __schemaBrowserStub('findMany');
__SchemaDef.prototype.where       = __schemaBrowserStub('where');
__SchemaDef.prototype.includes    = __schemaBrowserStub('includes');
__SchemaDef.prototype.withDeleted = __schemaBrowserStub('withDeleted');
__SchemaDef.prototype.onlyDeleted = __schemaBrowserStub('onlyDeleted');
__SchemaDef.prototype.unscoped    = __schemaBrowserStub('unscoped');
__SchemaDef.prototype.all         = __schemaBrowserStub('all');
__SchemaDef.prototype.first       = __schemaBrowserStub('first');
__SchemaDef.prototype.count       = __schemaBrowserStub('count');
__SchemaDef.prototype.create      = __schemaBrowserStub('create');
__SchemaDef.prototype.upsert      = __schemaBrowserStub('upsert');
__SchemaDef.prototype.insertMany  = __schemaBrowserStub('insertMany');
__SchemaDef.prototype.toSQL       = __schemaBrowserStub('toSQL');

// Helpers referenced by the validate fragment that are otherwise
// defined in db-naming / orm fragments. Kept inert (return safe
// defaults or throw on use) so validate's _makeClass / _normalize
// can run end-to-end in browser context.
function __schemaSave()            { throw new Error("schema instance.save() is not available in the browser. Import @rip-lang/db on the server."); }
function __schemaDestroy()         { throw new Error("schema instance.destroy() is not available in the browser. Import @rip-lang/db on the server."); }
function __schemaRestore()         { throw new Error("schema instance.restore() is not available in the browser. Import @rip-lang/db on the server."); }
function __schemaResolveRelation() { throw new Error("schema relation accessors are not available in the browser. Import @rip-lang/db on the server."); }
function __schemaTransaction()     { throw new Error("schema.transaction() is not available in the browser. Import @rip-lang/db on the server."); }
function __schemaInvokeScope()     { throw new Error("schema query scopes are not available in the browser. Import @rip-lang/db on the server."); }
function __schemaTableName(m) { return null; } // returned only for :model normalize; never used downstream in browser
function __schemaPluralize(w) { return w; }    // identity — relations work for type-resolution but never query
function __schemaFkName(m)    { return ''; }   // ditto
`;
