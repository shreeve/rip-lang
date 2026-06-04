// Schema .d.ts emission — CLI / typecheck only.
//
// This module is a CLI/editor-only sidecar that walks parsed schema
// s-expressions and emits TypeScript declarations for the LSP and
// `rip check`. The browser bundle must NOT import this module — see
// scripts/check-bundle-graph.js.
//
// SCHEMA_INTRINSIC_DECLS holds the Schema<Out, In> / SchemaIssue /
// SchemaSafeResult / SchemaQuery / ModelSchema interface declarations
// that prepend a schema-using compilation. emitSchemaTypes() walks
// the parsed s-expression, builds per-schema descriptors, and emits
// `declare const Foo: Schema<...>` / ModelSchema / etc. lines.
//
// All the runtime (parsing, validation, ORM, DDL, registry) lives in
// ./schema.js and the runtime-*.js fragments in this same directory,
// shared between browser and server. The `runtime-*` files are concatenated
// at build into runtime.generated.js and execute at runtime; THIS file is
// orthogonal — it runs at compile time and never reaches runtime.

// ============================================================================
// Shadow TypeScript — Phase 3.5
// ============================================================================
//
// Emits virtual `.d.ts` / `.ts` declarations for :input, :shape, and :enum
// schemas so the TS language service can offer autocomplete and catch
// AST-shape mistakes before Phase 4 layers in :model/ORM/algebra. Written
// to mirror `emitComponentTypes()` in src/types.js — same prototype:
// `emitSchemaTypes(sexpr, lines)` returns true when any schema declaration
// was found (drives preamble injection), mutates `lines` with declarations.
//
// Type surface (locked with peer AI):
//
//   interface Schema<T> {
//     parse(data: unknown): T;
//     safe(data: unknown): SchemaSafeResult<T>;
//     ok(data: unknown): boolean;
//   }
//
// `:input`  emits  declare const Foo: Schema<FooValue>;
// `:shape`  emits  declare const Foo: Schema<FooInstance>;   where
//                  FooInstance = FooData & {methods/readonly getters}.
// `:enum`   emits  declare const Role: { parse(...): Role; ok(d): d is Role; ... }
//
// Methods are typed `(...args: any[]) => unknown`. Computed are
// `readonly name: unknown`. Body inference is out of scope for 3.5.

export const SCHEMA_INTRINSIC_DECLS = [
  'interface SchemaIssue { field: string; error: string; message: string; }',
  'type SchemaSafeResult<T> = { ok: true; value: T; errors: null } | { ok: false; value: null; errors: SchemaIssue[] };',
  // Base Schema interface. `Out` is the parsed value type; `In` is the
  // data shape (defaults to unknown). Algebra methods are parameterized
  // over `In` so chained operations on a typed :shape or :model derive
  // correctly; when `In` defaults to unknown, `keyof In` is `never` and
  // algebra methods don't autocomplete — which is the right behavior
  // for :input schemas where the input shape isn't statically known.
  'interface Schema<Out, In = unknown> {',
  '  parse(data: unknown): Out;',
  '  safe(data: unknown): SchemaSafeResult<Out>;',
  '  ok(data: unknown): boolean;',
  '  pick<K extends keyof In>(...keys: K[]): Schema<Pick<In, K>, Pick<In, K>>;',
  '  omit<K extends keyof In>(...keys: K[]): Schema<Omit<In, K>, Omit<In, K>>;',
  '  partial(): Schema<Partial<In>, Partial<In>>;',
  '  required<K extends keyof In>(...keys: K[]): Schema<Omit<In, K> & Required<Pick<In, K>>, Omit<In, K> & Required<Pick<In, K>>>;',
  '  extend<U>(other: Schema<U>): Schema<In & U, In & U>;',
  '}',
  // Chainable query builder for :model.
  'interface SchemaQuery<T> {',
  '  all(): Promise<T[]>;',
  '  first(): Promise<T | null>;',
  '  count(): Promise<number>;',
  '  limit(n: number): SchemaQuery<T>;',
  '  offset(n: number): SchemaQuery<T>;',
  '  order(spec: string): SchemaQuery<T>;',
  '}',
  // ModelSchema extends the base schema surface with ORM methods. Algebra
  // over `Data` (not `Instance`) so derived shapes reflect runtime
  // behavior-dropping semantics.
  'interface ModelSchema<Instance, Data = unknown> extends Schema<Instance, Data> {',
  '  find(id: unknown): Promise<Instance | null>;',
  '  findMany(ids: unknown[]): Promise<Instance[]>;',
  '  where(cond: Record<string, unknown> | string, ...params: unknown[]): SchemaQuery<Instance>;',
  '  all(limit?: number): Promise<Instance[]>;',
  '  first(): Promise<Instance | null>;',
  '  count(cond?: Record<string, unknown>): Promise<number>;',
  '  create(data: Partial<Data>): Promise<Instance>;',
  '  toSQL(options?: { dropFirst?: boolean; header?: string; idStart?: number }): string;',
  '}',
];

const RIP_TYPE_TO_TS = {
  string:   'string',
  text:     'string',
  email:    'string',
  url:      'string',
  uuid:     'string',
  phone:    'string',
  zip:      'string',
  number:   'number',
  integer:  'number',
  boolean:  'boolean',
  date:     'Date',
  datetime: 'Date',
  json:     'unknown',
  any:      'any',
};

function mapFieldType(entry) {
  if (entry.typeName === 'literal-union' && entry.literals?.length) {
    return entry.literals.map(l => JSON.stringify(l)).join(' | ');
  }
  let base = RIP_TYPE_TO_TS[entry.typeName] ?? entry.typeName;
  return entry.array ? `${base}[]` : base;
}

// Extract descriptor from a SCHEMA_BODY s-expr node. Grammar reduces
// `['schema', SCHEMA_BODY_VAL]` where the value is the String wrapper
// carrying `.descriptor` via the metadata bridge.
function descriptorFromSchemaNode(schemaNode) {
  if (!Array.isArray(schemaNode)) return null;
  let head = schemaNode[0]?.valueOf?.() ?? schemaNode[0];
  if (head !== 'schema') return null;
  let body = schemaNode[1];
  if (!body || typeof body !== 'object') return null;
  if (body.descriptor) return body.descriptor;
  if (body.data?.descriptor) return body.data.descriptor;
  return null;
}

// Walk the parsed s-expression collecting every named schema declaration.
// Mixins are emitted first so subsequent :shape/:model type aliases can
// reference them in `& Timestamps`-style intersections. Within a group,
// source order is preserved. Returns true when at least one schema was
// found (drives intrinsic preamble injection).
export function emitSchemaTypes(sexpr, lines) {
  const collected = [];
  collectSchemas(sexpr, collected);
  if (!collected.length) return false;

  // Set of locally-known schema names (for relation-accessor type
  // resolution — same-file targets get typed, unknown targets degrade).
  const known = new Set(collected.map(c => c.name));
  const byName = new Map(collected.map(c => [c.name, c]));

  // Mixin types first so type aliases down-file can reference them.
  for (const c of collected) {
    if (c.descriptor?.kind === 'mixin') emitOneSchemaType(c, byName, known, lines);
  }
  for (const c of collected) {
    if (c.descriptor?.kind !== 'mixin') emitOneSchemaType(c, byName, known, lines);
  }
  return true;
}

// Schema algebra methods that derive a fresh schema from an existing one.
// A `Name = Base.<method>(...)` assignment (possibly chained) is a derived
// schema and gets a bare `type Name` even though it has no `schema` body.
const SCHEMA_ALGEBRA = new Set(['pick', 'omit', 'partial', 'required', 'extend']);

// Given an assignment's RHS s-expr, decide whether it's a schema-algebra
// call chain (`Base.pick(...)`, `Base.pick(...).omit(...)`, …) and return the
// root base identifier — or null when it isn't one. The base lets the caller
// confirm it resolves to a known schema before emitting a type for it, so an
// unrelated `foo = bar.partial()` never gets a (spurious) schema type.
function derivedSchemaBase(rhs) {
  if (!Array.isArray(rhs)) return null;
  const callee = rhs[0];
  if (!Array.isArray(callee)) return null;
  const dot = callee[0]?.valueOf?.() ?? callee[0];
  if (dot !== '.') return null;
  const method = callee[2]?.valueOf?.() ?? callee[2];
  if (!SCHEMA_ALGEBRA.has(method)) return null;
  // Descend through member accesses and call nodes to the root identifier:
  // `User.pick(...).omit(...)` → callee[1] is the inner `.pick(...)` call.
  let obj = callee[1];
  while (Array.isArray(obj)) {
    const head = obj[0]?.valueOf?.() ?? obj[0];
    if (head === '.') obj = obj[1];          // member access — descend the object
    else if (Array.isArray(obj[0])) obj = obj[0]; // call node — descend the callee
    else break;
  }
  const root = obj?.valueOf?.() ?? obj;
  return typeof root === 'string' ? root : null;
}

function collectSchemas(sexpr, out) {
  if (!Array.isArray(sexpr)) return;
  const head = sexpr[0]?.valueOf?.() ?? sexpr[0];
  let exported = false;
  let assignNode = null;
  if (head === 'export' && Array.isArray(sexpr[1])) {
    const inner = sexpr[1];
    const innerHead = inner[0]?.valueOf?.() ?? inner[0];
    if (innerHead === '=') { exported = true; assignNode = inner; }
    else collectSchemas(sexpr[1], out);
  } else if (head === '=') {
    assignNode = sexpr;
  } else if (head === 'program' || head === 'block') {
    for (let i = 1; i < sexpr.length; i++) {
      if (Array.isArray(sexpr[i])) collectSchemas(sexpr[i], out);
    }
  }
  if (assignNode && Array.isArray(assignNode[2])) {
    const name = assignNode[1]?.valueOf?.() ?? assignNode[1];
    if (typeof name !== 'string') return;
    const descriptor = descriptorFromSchemaNode(assignNode[2]);
    if (descriptor) {
      out.push({ name, descriptor, exported });
    } else {
      // A derived schema (`Name = Base.pick(...)`) has no `schema` body, so it
      // carries no descriptor — record its base instead. emitSchemaTypes emits
      // a bare `type Name` for it once the base is confirmed to be a schema.
      const derivedBase = derivedSchemaBase(assignNode[2]);
      if (derivedBase) out.push({ name, derivedBase, exported });
    }
  }
}

function emitOneSchemaType(collected, byName, known, lines) {
  const { name, descriptor, exported } = collected;
  const exp = exported ? 'export ' : '';

  // Derived schema (`Name = Base.pick(...)`): no body, so no descriptor. Give it
  // a bare type so it can be annotated (`u:: UserView`) and re-exported under a
  // clean name. The type is the source-free result
  // of the algebra, which the `Schema<Out, In>` interface methods already model
  // exactly; reading it back off the value's own `parse` return reuses that
  // inference rather than re-deriving Pick/Omit/Partial here, and so handles
  // every operator and chained projection for free. Gated on the base being a
  // locally-known schema, so an unrelated `foo = bar.partial()` never gets a
  // bogus schema type (its `parse` lookup would otherwise error).
  if (collected.derivedBase) {
    if (!known.has(collected.derivedBase)) return;
    lines.push(`${exp}type ${name} = ReturnType<(typeof ${name})['parse']>;`);
    return;
  }
  // Always `declare`: the value binding is provided by the compiled body
  // (`const Name = __schema(...)`), so the type surface is ambient. Without
  // `declare`, an exported `export const Name: T;` in a `.ts` shadow is an
  // uninitialized const (TS1155). `export declare const` is valid in both
  // the `.ts` shadow and a published `.d.ts`.
  const decl = 'declare ';

  if (descriptor.kind === 'enum') {
    const members = [];
    for (const e of descriptor.entries) {
      if (e.tag !== 'enum-member') continue;
      const v = e.value !== undefined ? e.value : e.name;
      members.push(typeof v === 'string' ? JSON.stringify(v) : String(v));
    }
    const union = members.length ? members.join(' | ') : 'never';
    lines.push(`${exp}type ${name} = ${union};`);
    lines.push(`${exp}${decl}const ${name}: { parse(data: unknown): ${name}; safe(data: unknown): SchemaSafeResult<${name}>; ok(data: unknown): data is ${name}; };`);
    return;
  }

  if (descriptor.kind === 'mixin') {
    // :mixin is declaration-time-only; expose it as a field type alias
    // so hosts that `@mixin Foo` can intersect it into their Data type.
    // No value declaration — mixins aren't user-facing runtime values.
    const fieldProps = fieldPropList(descriptor);
    lines.push(`${exp}type ${name} = { ${fieldProps.join('; ')} };`);
    return;
  }

  const fieldProps = fieldPropList(descriptor);
  const mixinRefs = mixinIntersections(descriptor, byName);
  const methods = [];
  const computed = [];
  for (const e of descriptor.entries) {
    if (e.tag === 'method') {
      methods.push(`${e.name}: (...args: any[]) => unknown`);
    } else if (e.tag === 'computed') {
      computed.push(`readonly ${e.name}: unknown`);
    }
    // hooks are intentionally omitted — they fire automatically and
    // shouldn't appear in autocomplete.
  }

  const dataBase = `{ ${fieldProps.join('; ')} }`;
  const dataType = mixinRefs.length ? `${dataBase} & ${mixinRefs.join(' & ')}` : dataBase;

  if (descriptor.kind === 'model') {
    const dataName = `${name}Data`;
    // Class-style: the bare schema name IS the instance type (parse result),
    // mirroring how a class names both its value and its instance type — and
    // how :enum/:mixin already emit a bare type. `${name}Data` survives as the
    // fields-only shape that algebra/`toJSON` derive from.
    const instName = name;
    const relationAccessors = modelRelationAccessors(descriptor, known);
    // `${name}Data` includes the columns a :model manages implicitly — the
    // `id` primary key, `@timestamps`, `@softDelete`, and `@belongs_to` FKs —
    // so they appear in `toJSON()` and are projectable via `.pick`/`.omit`,
    // matching the runtime's projectable field set.
    const implicitProps = modelImplicitProps(descriptor);
    const modelDataType = implicitProps.length ? `${dataType} & { ${implicitProps.join('; ')} }` : dataType;
    const instanceExtras = [
      ...computed,
      ...methods,
      ...relationAccessors,
      `save(): Promise<${instName}>`,
      `destroy(): Promise<${instName}>`,
      `ok(): boolean`,
      `errors(): SchemaIssue[]`,
      `toJSON(): ${dataName}`,
    ];
    lines.push(`${exp}type ${dataName} = ${modelDataType};`);
    lines.push(`${exp}type ${instName} = ${dataName} & { ${instanceExtras.join('; ')} };`);
    lines.push(`${exp}${decl}const ${name}: ModelSchema<${instName}, ${dataName}>;`);
    return;
  }

  if (descriptor.kind === 'shape') {
    const dataName = `${name}Data`;
    const hasBehavior = methods.length + computed.length > 0;
    if (hasBehavior) {
      // Behavior present: `${name}Data` = fields, bare `${name}` = instance.
      lines.push(`${exp}type ${dataName} = ${dataType};`);
      lines.push(`${exp}type ${name} = ${dataName} & { ${[...computed, ...methods].join('; ')} };`);
      lines.push(`${exp}${decl}const ${name}: Schema<${name}, ${dataName}>;`);
    } else {
      // No behavior: instance === data, so collapse to a single bare `${name}`
      // (matching :input). No `${name}Data` alias to learn.
      lines.push(`${exp}type ${name} = ${dataType};`);
      lines.push(`${exp}${decl}const ${name}: Schema<${name}, ${name}>;`);
    }
    return;
  }

  // :input — no behavior, so the bare name IS the parsed value type.
  lines.push(`${exp}type ${name} = ${dataType};`);
  lines.push(`${exp}${decl}const ${name}: Schema<${name}, ${name}>;`);
}

// Return an array of mixin type-reference strings for `& Foo & Bar` joins.
function mixinIntersections(descriptor, byName) {
  const refs = [];
  for (const e of descriptor.entries) {
    if (e.tag !== 'directive' || e.name !== 'mixin') continue;
    const args = e.args;
    const target = args && args[0] && args[0].target;
    if (!target) continue;
    const known = byName && byName.get(target);
    if (known && known.descriptor.kind === 'mixin') {
      refs.push(target);
    }
  }
  return refs;
}

// The TS property strings for a :model's implicitly-managed columns: the
// `id` PK, `@timestamps`, `@softDelete`, and `@belongs_to` FK columns. These
// aren't declared fields but are real columns on every row — so they belong
// in `<Name>Data` (what `toJSON()` returns and `.pick`/`.omit` project over).
function modelImplicitProps(descriptor) {
  const props = ['id: number'];
  let timestamps = false, softDelete = false;
  for (const e of descriptor.entries) {
    if (e.tag !== 'directive') continue;
    if (e.name === 'timestamps') timestamps = true;
    else if (e.name === 'softDelete') softDelete = true;
    else if (e.name === 'belongs_to') {
      const target = e.args && e.args[0] && e.args[0].target;
      if (target) {
        const optional = e.args[0].optional === true;
        const fk = target[0].toLowerCase() + target.slice(1) + 'Id';
        props.push(`${fk}: number${optional ? ' | null' : ''}`);
      }
    }
  }
  if (timestamps) { props.push('createdAt: Date'); props.push('updatedAt: Date'); }
  if (softDelete) props.push('deletedAt: Date | null');
  return props;
}

// Emit relation accessor type declarations for :model instances. For
// targets declared in the same file we emit a typed Promise; for
// unknown (cross-file) targets we degrade to `Promise<unknown>` rather
// than emit an unresolved bare name.
function modelRelationAccessors(descriptor, known) {
  const out = [];
  for (const e of descriptor.entries) {
    if (e.tag !== 'directive') continue;
    const args = e.args;
    if (!args || !args[0]) continue;
    const target = args[0].target;
    if (!target) continue;
    const optional = args[0].optional === true;
    const targetLc = target[0].toLowerCase() + target.slice(1);
    // Class-style: the target's bare name IS its instance type.
    const instName = target;
    const isKnown = known && known.has(target);
    if (e.name === 'belongs_to') {
      const retT = isKnown ? (optional ? `${instName} | null` : `${instName} | null`) : 'unknown';
      out.push(`${targetLc}(): Promise<${retT}>`);
    } else if (e.name === 'has_one' || e.name === 'one') {
      const retT = isKnown ? `${instName} | null` : 'unknown';
      out.push(`${targetLc}(): Promise<${retT}>`);
    } else if (e.name === 'has_many' || e.name === 'many') {
      const retT = isKnown ? `${instName}[]` : 'unknown[]';
      const pluralLc = __schemaClientPluralize(targetLc);
      out.push(`${pluralLc}(): Promise<${retT}>`);
    }
  }
  return out;
}

// Minimal pluralizer for accessor names. Keep in sync with the runtime
// __schemaPluralize rules (same surface for declaration parity).
function __schemaClientPluralize(w) {
  const lw = w.toLowerCase();
  if (/[^aeiouy]y$/i.test(w)) return w.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/i.test(w)) return w + 'es';
  return w + 's';
}

function fieldPropList(descriptor) {
  const props = [];
  for (const e of descriptor.entries) {
    if (e.tag !== 'field') continue;
    const required = e.modifiers.includes('!');
    const mark = required ? '' : '?';
    props.push(`${e.name}${mark}: ${mapFieldType(e)}`);
  }
  return props;
}
