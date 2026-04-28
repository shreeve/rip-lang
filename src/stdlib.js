// =============================================================================
// stdlib.js — Rip's standard library
//
// One file, three concerns, all related to the small set of helpers Rip
// makes available without an explicit import:
//
//   1. `getStdlibCode()`
//      Returns a string of self-contained JavaScript that the compiler
//      prepends to every emitted file. Defines the `globalThis.*` helpers
//      every Rip program can rely on (p, pp, pr, pj, kind, abort, …).
//      The string is bracketed with `// rip:stdlib:begin` / `:end` markers
//      so tooling (test runner, source viewers) can strip the preamble
//      cleanly even when individual helper bodies span multiple lines.
//
//   2. `stringify(value, opts?)`
//      The importable, *strict* JS-value -> Rip-syntax serializer used
//      from `import { stringify } from 'rip-lang'`. Throws on values
//      that have no faithful Rip-literal form (Date, BigInt, Map, Set,
//      class instances, functions, non-interned symbols), preserving the
//      round-trip property: `compile(stringify(v))` returns `v`.
//
//   3. `STDLIB_TYPE_DECLS`
//      A map from helper name to TypeScript declaration string. The
//      typecheck pipeline injects these into shadow `.d.ts` so user code
//      that calls `assert(x)`, `kind(v)`, etc. type-checks under the
//      strict configuration. Co-located here so adding a stdlib helper
//      is a one-file change — both the runtime body and the TS
//      declaration live in this module.
//
// The runtime `pr` formatter inlined in `getStdlibCode()` is intentionally
// duplicated with `stringify` rather than refactored through Function-
// constructor indirection. Two visible function bodies in one file are
// easier to keep in sync than one source threaded through `eval`-style
// evaluation. If they ever diverge the diff will be local and obvious.
// =============================================================================

// -----------------------------------------------------------------------------
// 1. Runtime stdlib injection (string-literal JS, NOT executed in this scope)
// -----------------------------------------------------------------------------
//
// IMPORTANT: this string is not parsed by the JS engine here — it is
// literally prepended to other compiled files as text. It cannot reference
// anything from this module's scope. It must be self-contained.
//
// The `// rip:stdlib:begin` / `// rip:stdlib:end` markers are LOAD-BEARING.
// `test/runner.js` strips everything between them in `normalizeCode()`
// before comparing compiled output against expected JS in `code` tests.
// Removing or renaming these markers without updating the runner will
// silently break every `code` snapshot test in the suite.
//
// `pr` here mirrors the strict `stringify()` defined later in this file,
// with one deliberate difference: `pr` returns null from its inner
// formatter for any value that has no Rip-literal form (class instance,
// Date, BigInt, Map, Set, function, non-interned Symbol) and the outer
// wrapper falls back to `console.dir` for those values, so a debug
// session never crashes on whatever the caller happens to hand it. The
// strict version throws so round-trip-safe consumers can detect the
// problem at call time. Keep the formatting logic in sync with the
// `stringify` body below — same key/string quoting rules, same array
// and object shapes, same symbol literal form.

export function getStdlibCode() {
  return `\
// rip:stdlib:begin
globalThis.abort  ??= (msg) => { if (msg) console.error(msg); process.exit(1); };
globalThis.assert ??= (v, msg) => { if (!v) throw new Error(msg || "Assertion failed"); };
globalThis.exit   ??= (code) => process.exit(code || 0);
globalThis.kind   ??= (v) => v != null ? (v.constructor?.name || Object.prototype.toString.call(v).slice(8, -1)).toLowerCase() : String(v);
globalThis.noop   ??= () => {};
globalThis.p      ??= console.log;
globalThis.pp     ??= (v) => { console.dir(v, { depth: null, colors: true }); return v; };
globalThis.pj     ??= (v) => { console.log(JSON.stringify(v, null, 2)); return v; };
globalThis.pr     ??= (() => {
  const BARE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  const esc = (s, q) => s.replace(/\\\\/g, "\\\\\\\\").replace(/\\n/g, "\\\\n").replace(/\\r/g, "\\\\r").replace(/\\t/g, "\\\\t").replace(new RegExp(q, 'g'), "\\\\" + q);
  const qs = (s) => !s.includes("'") ? "'" + esc(s, "'") + "'" : !s.includes('"') ? '"' + esc(s, '"').split("#{").join("\\\\#{") + '"' : "'" + esc(s, "'") + "'";
  const ks = (k) => { if (typeof k === 'symbol') { const n = Symbol.keyFor(k); return n && BARE.test(n) ? ':' + n : qs(String(k)); } return BARE.test(k) ? k : qs(k); };
  const fmt = (v, d) => {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    const t = typeof v;
    if (t === 'number' || t === 'boolean') return String(v);
    if (t === 'string') return qs(v);
    if (t === 'symbol') { const n = Symbol.keyFor(v); return n && BARE.test(n) ? ':' + n : null; }
    if (Array.isArray(v)) {
      if (v.length === 0) return '[]';
      const pad = '  '.repeat(d + 1), end = '  '.repeat(d);
      return '[\\n' + pad + v.map(x => fmt(x, d + 1) ?? 'null').join('\\n' + pad) + '\\n' + end + ']';
    }
    if (t === 'object') {
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) return null;
      const keys = Object.keys(v);
      if (keys.length === 0) return '{}';
      const pad = '  '.repeat(d + 1), end = '  '.repeat(d);
      return '{\\n' + pad + keys.map(k => ks(k) + ': ' + (fmt(v[k], d + 1) ?? 'null')).join('\\n' + pad) + '\\n' + end + '}';
    }
    return null;
  };
  return (v) => { const s = fmt(v, 0); s !== null ? console.log(s) : console.dir(v, { depth: null, colors: true }); return v; };
})();
globalThis.raise  ??= (a, b) => { throw (b !== undefined ? new a(b) : new Error(a)); };
globalThis.rand   ??= (a, b) => b !== undefined ? (a > b && ([a, b] = [b, a]), Math.floor(Math.random() * (b - a + 1) + a)) : a ? Math.floor(Math.random() * a) : Math.random();
globalThis.sleep  ??= (ms) => new Promise(r => setTimeout(r, ms));
globalThis.todo   ??= (msg) => { throw new Error(msg || "Not implemented"); };
globalThis.warn   ??= console.warn;
globalThis.zip    ??= (...a) => a[0].map((_, i) => a.map(b => b[i]));
// rip:stdlib:end
`;
}

// -----------------------------------------------------------------------------
// 2. Importable, strict Rip-syntax serializer
// -----------------------------------------------------------------------------
//
// Public API. `import { stringify } from 'rip-lang'` is the supported
// surface for tools that emit `.rip` files programmatically (config
// migrations, scaffolders, code generators).
//
// Round-trip property: for any value the function accepts,
// `compile(stringify(v))` evaluates to a value structurally equal to `v`.
// That guarantee is preserved by REJECTING values with no faithful Rip-
// literal form rather than rendering them best-effort. The accepted set:
//
//   * null, undefined
//   * number, boolean, string
//   * interned Symbol (`Symbol.for(name)` where `name` is bare-key shape)
//   * plain Array (any depth, any accepted element types)
//   * plain Object (own enumerable string keys, accepted values)
//
// Anything else throws `StringifyError`:
//
//   * Date, BigInt, RegExp
//   * Map, Set, WeakMap, WeakSet
//   * class instances (anything with a non-Object prototype)
//   * functions
//   * non-interned Symbols
//   * circular references (would already throw via stack overflow before
//     the type check fires; explicit detection is a future enhancement)
//
// `opts.indent` accepts a string or a number-of-spaces; defaults to 2.

const BARE_KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

class StringifyError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'StringifyError';
  }
}

// Render a string. Single-quote by default; switch to double-quote when
// the value contains an apostrophe but no double-quote, and escape any
// `#{...}` sequences inside double-quoted output so Rip interpolation
// can't fire on the round-trip.
function quoteString(str) {
  const hasSingle = str.includes("'");
  const hasDouble = str.includes('"');
  const escape = (s, q) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(new RegExp(q, 'g'), `\\${q}`);
  if (!hasSingle) return `'${escape(str, "'")}'`;
  if (!hasDouble) {
    let body = escape(str, '"').split('#{').join('\\#{');
    return `"${body}"`;
  }
  return `'${escape(str, "'")}'`;
}

function formatKey(key) {
  if (typeof key === 'symbol') {
    const name = Symbol.keyFor(key);
    if (name && BARE_KEY_RE.test(name)) return `:${name}`;
    return quoteString(String(key));
  }
  if (BARE_KEY_RE.test(key)) return key;
  return quoteString(key);
}

function formatValue(value, indent, depth) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  const t = typeof value;
  if (t === 'number' || t === 'boolean') return String(value);
  if (t === 'string') return quoteString(value);
  if (t === 'symbol') {
    const name = Symbol.keyFor(value);
    if (name && BARE_KEY_RE.test(name)) return `:${name}`;
    throw new StringifyError('cannot stringify non-interned symbol');
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const pad = indent.repeat(depth + 1);
    const closePad = indent.repeat(depth);
    const items = value.map((v) => formatValue(v, indent, depth + 1));
    return `[\n${pad}${items.join(`\n${pad}`)}\n${closePad}]`;
  }
  if (t === 'object') {
    // Reject class instances and exotic objects — they don't round-trip.
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new StringifyError(`cannot stringify ${value.constructor?.name || 'non-plain'} instance`);
    }
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const pad = indent.repeat(depth + 1);
    const closePad = indent.repeat(depth);
    const pairs = keys.map((k) => {
      const v = value[k];
      return `${formatKey(k)}: ${formatValue(v, indent, depth + 1)}`;
    });
    return `{\n${pad}${pairs.join(`\n${pad}`)}\n${closePad}}`;
  }
  throw new StringifyError(`cannot stringify value of type ${t}`);
}

export function stringify(value, opts = {}) {
  let indent = opts.indent ?? '  ';
  if (typeof indent === 'number') indent = ' '.repeat(indent);
  return formatValue(value, indent, 0);
}

export { StringifyError };

// -----------------------------------------------------------------------------
// 3. TypeScript declarations for stdlib helpers
// -----------------------------------------------------------------------------
//
// `typecheck.js` injects these into the shadow `.d.ts` file it feeds the
// TypeScript language service so user code that calls `assert(x)`,
// `kind(v)`, etc. type-checks correctly. Helpers not listed here fall back
// to a generic `(...args: any[]) => any` signature in typecheck.js.

export const STDLIB_TYPE_DECLS = {
  abort:  'declare function abort(msg?: string): never;',
  assert: 'declare function assert(v: any, msg?: string): asserts v;',
  exit:   'declare function exit(code?: number): never;',
  kind:   'declare function kind(v: any): string;',
  noop:   'declare function noop(): void;',
  p:      'declare function p(...args: any[]): void;',
  pp:     'declare function pp<T>(v: T): T;',
  pr:     'declare function pr<T>(v: T): T;',
  pj:     'declare function pj<T>(v: T): T;',
  raise:  'declare function raise(a: any, b?: any): never;',
  rand:   'declare function rand(a?: number, b?: number): number;',
  sleep:  'declare function sleep(ms: number): Promise<void>;',
  todo:   'declare function todo(msg?: string): never;',
  warn:   'declare function warn(...args: any[]): void;',
  zip:    'declare function zip(...arrays: any[][]): any[][];',
};
