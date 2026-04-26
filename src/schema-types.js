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
// schema.js and is shared between browser and server.

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
  '  parse(data: In): Out;',
  '  safe(data: In): SchemaSafeResult<Out>;',
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
    if (c.descriptor.kind === 'mixin') emitOneSchemaType(c, byName, known, lines);
  }
  for (const c of collected) {
    if (c.descriptor.kind !== 'mixin') emitOneSchemaType(c, byName, known, lines);
  }
  return true;
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
    const descriptor = descriptorFromSchemaNode(assignNode[2]);
    if (typeof name === 'string' && descriptor) {
      out.push({ name, descriptor, exported });
    }
  }
}

function emitOneSchemaType(collected, byName, known, lines) {
  const { name, descriptor, exported } = collected;
  const exp = exported ? 'export ' : '';
  const decl = exported ? '' : 'declare ';

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
    const instName = `${name}Instance`;
    const relationAccessors = modelRelationAccessors(descriptor, known);
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
    lines.push(`${exp}type ${dataName} = ${dataType};`);
    lines.push(`${exp}type ${instName} = ${dataName} & { ${instanceExtras.join('; ')} };`);
    lines.push(`${exp}${decl}const ${name}: ModelSchema<${instName}, ${dataName}>;`);
    return;
  }

  if (descriptor.kind === 'shape') {
    const dataName = `${name}Data`;
    const instName = `${name}Instance`;
    const hasBehavior = methods.length + computed.length > 0;
    lines.push(`${exp}type ${dataName} = ${dataType};`);
    if (hasBehavior) {
      lines.push(`${exp}type ${instName} = ${dataName} & { ${[...computed, ...methods].join('; ')} };`);
      lines.push(`${exp}${decl}const ${name}: Schema<${instName}, ${dataName}>;`);
    } else {
      lines.push(`${exp}${decl}const ${name}: Schema<${dataName}, ${dataName}>;`);
    }
    return;
  }

  // :input — parse returns the Data shape directly (no behavior).
  const valueName = `${name}Value`;
  lines.push(`${exp}type ${valueName} = ${dataType};`);
  lines.push(`${exp}${decl}const ${name}: Schema<${valueName}, ${valueName}>;`);
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
    const instName = `${target}Instance`;
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
