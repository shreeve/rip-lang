// Schema runtime fragment: validate (universal — browser + server)
//
// This file is the source of truth for one slice of the schema runtime.
// Edit here, then run `bun run build:schema-runtime` to regenerate
// `src/schema/runtime.generated.js`. Tests pin the public surface via
// test/schema/errors.test.js, test/schema/modes.test.js, and the source
// schema test suite.
//
// Fragments are concatenated INSIDE one shared IIFE wrapper at build time.
// They share scope; references like `__SchemaRegistry` resolve to bindings
// defined in earlier-included fragments. Editor tooling (LSP / lint) may
// not recognize cross-fragment references — that is expected; behavior is
// pinned by the test suite.

/* eslint-disable no-undef, no-unused-vars */
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
  email:    v => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  url:      v => typeof v === 'string' && /^https?:\/\/.+/.test(v),
  uuid:     v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  phone:    v => typeof v === 'string' && /^[\d\s\-+()]+$/.test(v),
  zip:      v => typeof v === 'string' && /^\d{5}(-\d{4})?$/.test(v),
  text:     v => typeof v === 'string',
  json:     v => v !== undefined,
  any:      ()  => true,
};

function __schemaCheckValue(v, typeName) {
  const check = __schemaTypes[typeName];
  return check ? check(v) : true;
}

// Strict coercion tables for the `~type` marker — "coerce, then
// validate". Deliberately narrow: `~integer` rejects "12.5" and NaN,
// `~boolean` accepts exactly six tokens, `~date` accepts ISO-8601
// strings and finite epoch numbers. A failed coercion is
// {error: 'coerce'}, distinct from {error: 'type'} — the value LOOKED
// like wire data but didn't convert, which is a different user mistake
// than sending the wrong shape entirely.
const __SCHEMA_COERCERS = {
  integer(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? { ok: true, value: v } : { ok: false };
    if (typeof v === 'string' && /^[+-]?\d+$/.test(v.trim())) return { ok: true, value: parseInt(v.trim(), 10) };
    return { ok: false };
  },
  number(v) {
    if (typeof v === 'number') return Number.isNaN(v) ? { ok: false } : { ok: true, value: v };
    if (typeof v === 'string' && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v.trim())) {
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
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return { ok: true, value: d };
    }
    return { ok: false };
  },
};
__SCHEMA_COERCERS.datetime = __SCHEMA_COERCERS.date;

// Named-coercer registry for the `~:name` field syntax. A coercer is a
// function (wireValue) → coercedValue, where null/undefined/false means
// "didn't convert" → {error: 'coerce'}. @rip-lang/server registers its
// entire read() validator vocabulary (id, money, ssn, phone, name,
// date, …) here at module load, so every wire normalizer that works in
// `read 'x', 'ssn'` also works as `x? ~:ssn` in a schema. Apps register
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

// Reject acronym-style camelCase like `mdmID`, `userOrgID`, or
// `XMLHttpRequest`. Two consecutive uppercase letters break the
// snake_case <-> camelCase bijection: `mdmID` would round-trip via
// __schemaSnake to `mdm_i_d` and back via __schemaCamel to `mdmID`,
// while a more natural snake_case spelling `mdm_id` round-trips to
// `mdmId` (different identifier). Forcing canonical camelCase at
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
// the primary key, declared fields (from `norm.fields`), and `belongsTo`
// FK columns (from `norm.relations`). Used by `_hydrate` and the INSERT
// / UPDATE branches of `__schemaSave` (defined in the orm fragment,
// which loads after this one) so that a later .save() can compare and
// emit a SET only for columns the caller actually mutated. Lives in the
// validate fragment because `_hydrate` owns it; the orm fragment is
// the consumer.
//
// FK columns are keyed by their camelCase property name on the instance
// (e.g. `userId`) — same convention the dirty Set, savedChanges Map,
// and markDirty() resolver use.
//
// The primary key is captured so __schemaSave's UPDATE WHERE clause can
// target the originally-loaded row even if `inst[pk]` is reassigned in
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
// unless `__SchemaRegistry.replace` is set (dev/HMR semantics).
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
  // Run `fn` against a fresh, empty registry; restore the parent
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
    // Per-schema adapter (`schema :model, on: analytics`). null → the
    // process-global adapter. Resolved per ORM call by the orm fragment.
    this._adapter = desc.adapter || null;
    // Install @scope statics eagerly so `User.active()` works as the
    // very first call on the model (normalization hasn't run yet at
    // that point; the scope invocation itself triggers it, which also
    // fires the duplicate / reserved-name collision checks). Prototype
    // methods win on name conflicts (`in` sees the prototype chain),
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
          // come out in the order authored. `field` attributes the
          // failure to a specific input; `async` marks an @ensure!
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
          // the instance namespace — a field `active` and a scope
          // `:active` coexist by design. Collisions are checked against
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

    // `@tableWas old_name` — table-rename annotation for the differ.
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
        // Mirrors Active Record's `saved_changes`: populated by save()
        // with the field-level diff of the just-completed write. INSERT
        // produces `[null, newValue]` per written field; UPDATE produces
        // `[oldValue, newValue]` per changed field. An empty Map after a
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
          // Accept declared fields and `belongsTo` FK column names
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
    // Capture the as-loaded values so `save()` can emit a column-targeted
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
  // date is a string, so a value crossing the wire (or any `.parse` of
  // external input) arrives as a string; this lets it validate and be stored
  // as a Date. Runs on parse/safe only — hydrate gets canonical DB values.
  _coerceDates(working) {
    const norm = this._normalize();
    // Only ISO-shaped strings (`YYYY-MM-DD` optionally followed by a time) are
    // coerced. `new Date(v)` is otherwise lax — `new Date("5")` is a valid
    // Date — which would let clearly-bad input slip past a date field as a
    // bogus Date instead of failing validation. Array-of-date fields coerce
    // element-wise.
    const isoShaped = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}([T ].*)?$/.test(s);
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

  // `~type` coercions — part of pipeline step 1 (obtain raw candidate):
  // the wire value converts through the strict coercion table before
  // defaults and validation, so range checks see the coerced value.
  // Failed coercions collect {error: 'coerce'} issues and the field
  // lands in `failed` so per-field validation doesn't double-report
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
        // `~:name` — registry lookup. A missing coercer is a CONFIG
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

  // Array combinator: `Schema.array` is a list-of-this schema exposing the
  // same validation family (parse/safe/ok + async). The common list-endpoint
  // case is `Schema.array.parse(api.get!('x').json!())` → Out[]. A non-array
  // input fails fast with a descriptive error naming what it got — so passing
  // an enveloped `{ items: [...] }` whole, a typo'd key, or a changed server
  // contract surfaces clearly at the boundary. Item failures aggregate, each
  // issue tagged with its `[index]` so a bad element is locatable.
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
  // form: `SignupInput.parseAsync! raw`.
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
// language reference; nested registry schemas become `$ref`s collected
// under `$defs` (cycle-safe); enums map to `enum`, unions to `oneOf` +
// an OpenAPI-style `discriminator`. Transforms and refinements have no
// executable JSON Schema equivalent — they export as `description`
// annotations rather than being silently dropped or approximated.

const __SCHEMA_JSON_TYPES = {
  string:   () => ({ type: 'string' }),
  text:     () => ({ type: 'string' }),
  email:    () => ({ type: 'string', format: 'email' }),
  url:      () => ({ type: 'string', format: 'uri' }),
  uuid:     () => ({ type: 'string', format: 'uuid' }),
  phone:    () => ({ type: 'string', pattern: '^[\\d\\s\\-+()]+$' }),
  zip:      () => ({ type: 'string', pattern: '^\\d{5}(-\\d{4})?$' }),
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
// `$ref` into `$defs`, expanding each named schema exactly once.
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
  // when it's `!`-marked AND has no default (defaults apply before the
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
// columns a :model manages implicitly — the `id` primary key, `@timestamps`
// (createdAt/updatedAt), `@softDelete` (deletedAt), and `@belongs_to` FK
// columns. Algebra (.pick/.omit/.partial/.required) operates over THIS set so
// a client projection can include `id`/`createdAt` even though they aren't
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
