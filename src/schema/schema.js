// Schema reaches sideways to the host's parser table to re-parse @ensure
// predicate bodies. This is the one host coupling point — the host's lexer
// and compiler import `installSchemaSupport` from us, and we import the
// parser back from them. Same compilation unit, no package boundary.
import { parser } from '../parser.js';

// Runtime-string composition is delegated to a registered provider so the
// bundler can tree-shake server-only fragments out of the browser bundle.
// One of `./loader-server.js` or `./loader-browser.js` must be
// side-effect-imported before any compileToJS call that emits schemas.
// (`src/browser.js` imports loader-browser; CLI / typecheck / test runner
// import loader-server.)
let _schemaRuntimeProvider = null;
export function setSchemaRuntimeProvider(fn) { _schemaRuntimeProvider = fn; }

// Schema System — inline `schema` declarations compile to runtime validator
// and ORM plans.
//
// Architecture (parallels types.js and components.js sidecars):
//
//   installSchemaSupport(Lexer, CodeEmitter)
//     Adds rewriteSchema() to Lexer.prototype and emitSchema() to
//     CodeEmitter.prototype.
//
//   rewriteSchema()
//     Token-stream pass. Recognizes `schema [:kind] INDENT ... OUTDENT`
//     blocks at expression-start positions, parses the body with a
//     schema-specific sub-parser, and collapses the whole region into
//     `SCHEMA SCHEMA_BODY` where SCHEMA_BODY carries a structured
//     descriptor on its .data. The main Rip grammar only sees two
//     tiny productions. Schema body syntax never reaches the main
//     parser.
//
//   emitSchema(head, rest, context)
//     CodeEmitter dispatch. Reads the structured descriptor off the
//     SCHEMA_BODY node's metadata and emits a `__schema({...})` runtime
//     call. For Phase 1 the emission is a self-describing object; the
//     runtime (__schema) lands in Phase 3.
//
//   hasSchemas(source)
//     Cheap regex probe for the presence of a schema declaration.
//     Parallels hasTypeAnnotations. Used by typecheck.js and the LSP to
//     skip work on files without schemas.
//
// Two body sub-modes:
//
//   fielded — kinds :input, :shape, :model, :mixin. Permitted line forms:
//     field      IDENTIFIER[!|?|#]* TYPE [, constraints] [, attrs]
//     directive  @NAME [args]
//     callable   NAME: (-> | ~>) body
//
//   enum — kind :enum. Permitted line forms:
//     bare       IDENTIFIER
//     valued     IDENTIFIER : Literal
//
// Anything else at schema top level is a schema-mode-aware compile error
// with a helpful message.

const VALID_KINDS = new Set(['input', 'shape', 'model', 'mixin', 'enum']);
const KIND_DEFAULT = 'input';

const HOOK_NAMES = new Set([
  'beforeValidation', 'afterValidation',
  'beforeSave', 'afterSave',
  'beforeCreate', 'afterCreate',
  'beforeUpdate', 'afterUpdate',
  'beforeDestroy', 'afterDestroy',
]);

// Positions where `schema` can legitimately start an expression.
// If the prev token is one of these tags, the identifier `schema` is a
// candidate for retagging to SCHEMA.
const EXPR_START_PREV = new Set([
  'TERMINATOR', 'INDENT', 'OUTDENT',
  '=', '+=', '-=', '*=', '/=', '%=', '**=', '//=', '%%=',
  '?=', '??=', '&&=', '||=', '&=', '|=', '^=', '<<=', '>>=', '>>>=',
  'READONLY_ASSIGN', 'REACTIVE_ASSIGN', 'COMPUTED_ASSIGN',
  'RETURN', 'THROW', 'YIELD', 'AWAIT', 'EXPORT',
  ',', '(', '[', '{', 'CALL_START', 'PARAM_START', 'INDEX_START',
  '->', '=>', ':', 'WHEN', 'THEN', 'IF', 'UNLESS',
  'UNARY', '!', 'NOT',
]);

// ============================================================================
// hasSchemas — fast probe
// ============================================================================

// True when source looks like it contains a schema declaration. We look
// for `schema` followed by either a `:kind` symbol or by a newline +
// deeper indent. Conservative: a false positive just means typecheck
// pays a bit more work, never wrong behavior.
export function hasSchemas(source) {
  if (typeof source !== 'string') return false;
  if (!/\bschema\b/.test(source)) return false;
  return /(?:^|[\s=,(\[{:])schema(?:\s*:[A-Za-z_$][\w$]*|\s*\n[ \t]+\S)/m.test(source);
}

// ============================================================================
// installSchemaSupport — prototype installation
// ============================================================================

export function installSchemaSupport(Lexer, CodeEmitter) {
  if (Lexer) {
    Lexer.prototype.rewriteSchema = function() {
      rewriteSchema(this);
    };
    // Captured body tokens need the tail rewriter passes before parsing.
    // parseBodyTokens runs those passes on a fresh Lexer instance.
    parseBodyTokens._LexerCtor = Lexer;
  }
  if (CodeEmitter) {
    CodeEmitter.prototype.emitSchema = function(head, rest, context) {
      return emitSchemaNode(this, head, rest, context);
    };
    CodeEmitter.prototype.getSchemaRuntime = function() {
      // Compiler-controlled mode. Defaults to 'migration' (everything) for
      // compatibility with existing CLI / Node compilation, where the user
      // might invoke any schema feature including .toSQL(). Browser-bundle
      // build overrides to 'browser' for size reduction — see Phase 2 step 3.
      const mode = this.options?.schemaMode || 'migration';
      return getSchemaRuntime({ mode });
    };
  }
}

// ============================================================================
// Lexer pass: rewriteSchema
// ============================================================================

// Known keys for the `schema.<key> = <value>` file-level pragma. Each
// pragma takes effect from its declaration forward and is scoped to the
// current compilation unit — schemas in other files are unaffected.
// Extend this map when new pragma keys land.
const SCHEMA_PRAGMA_KEYS = new Set(['defaultMaxString']);

function rewriteSchema(lexer) {
  let tokens = lexer.tokens;
  // File-scoped config, updated in-place as pragmas are encountered, then
  // snapshotted into each schema descriptor at collapse time so post-pragma
  // changes don't mutate earlier schemas retroactively.
  let config = { defaultMaxString: null };
  // Top-level INDENT/OUTDENT depth. Pragmas are file-level only so we
  // reject them inside function / class / block bodies — otherwise a
  // pragma nested in `foo = ->` would leak to module-scope schemas
  // declared later on. Schemas themselves get collapsed out of the
  // token stream before their internal INDENT/OUTDENT reach this
  // counter, so depth reflects only user-written nesting.
  let depth = 0;
  let i = 0;
  while (i < tokens.length) {
    let t = tokens[i];
    if (t[0] === 'INDENT') depth++;
    else if (t[0] === 'OUTDENT') depth--;
    let consumed = matchSchemaPragma(tokens, i, config, depth);
    if (consumed > 0) {
      tokens.splice(i, consumed);
      continue;
    }
    if (isSchemaStart(tokens, i)) {
      collapseSchemaAt(lexer, tokens, i, config);
    }
    i++;
  }
}

// Recognize `schema.<key> = <value>` at statement position. Returns the
// number of tokens consumed (including any trailing TERMINATOR) when the
// pragma is applied, or 0 when the sequence isn't a pragma. Unknown keys
// and non-literal values error loudly — silently ignoring a typo like
// `schema.defaultMacString = 100` would bake a wrong value into every
// downstream schema.
function matchSchemaPragma(tokens, i, config, depth) {
  let t = tokens[i];
  if (!t || t[0] !== 'IDENTIFIER' || t[1] !== 'schema') return 0;
  if (tokens[i + 1]?.[0] !== '.') return 0;
  let keyTok = tokens[i + 2];
  if (!keyTok || keyTok[0] !== 'PROPERTY') return 0;
  if (tokens[i + 3]?.[0] !== '=') return 0;
  // Pragmas must start a statement — the `schema` identifier must be
  // preceded by nothing, TERMINATOR, INDENT, or OUTDENT so we don't
  // accidentally rewrite `foo.schema.defaultMaxString = 100` or similar.
  let prev = tokens[i - 1];
  if (prev) {
    let ptag = prev[0];
    if (ptag !== 'TERMINATOR' && ptag !== 'INDENT' && ptag !== 'OUTDENT') return 0;
  }
  let key = keyTok[1];
  if (!SCHEMA_PRAGMA_KEYS.has(key)) {
    throw schemaError(keyTok,
      `Unknown schema pragma 'schema.${key}'. Known pragmas: ${[...SCHEMA_PRAGMA_KEYS].join(', ')}.`);
  }
  if (depth > 0) {
    throw schemaError(keyTok,
      `Schema pragma 'schema.${key}' must be declared at file top level. It was found inside a nested block (function / class / if / loop body), where it would leak into later top-level schemas.`);
  }
  let valTok = tokens[i + 4];
  if (!valTok || valTok[0] !== 'NUMBER') {
    throw schemaError(valTok || keyTok,
      `Pragma 'schema.${key}' requires a number literal. Example: schema.${key} = 100.`);
  }
  let n = Number(valTok[1]);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw schemaError(valTok,
      `Pragma 'schema.${key}' expects a non-negative integer (got ${valTok[1]}). Use 0 to disable.`);
  }
  // `0` means "no default cap" — explicit way to reset a pragma mid-file.
  config[key] = n === 0 ? null : n;
  // Consume trailing TERMINATOR so the pragma line leaves no blank statement behind.
  let end = i + 5;
  if (tokens[end]?.[0] === 'TERMINATOR') end++;
  return end - i;
}

function isSchemaStart(tokens, i) {
  let t = tokens[i];
  if (!t || t[0] !== 'IDENTIFIER' || t[1] !== 'schema') return false;
  // Skip property access — `x.schema` is lexed as PROPERTY, not IDENTIFIER.
  // Still guard against generated IDENTIFIER tokens in odd positions.
  let prev = tokens[i - 1];
  if (prev) {
    let ptag = prev[0];
    if (ptag === '.' || ptag === '?.') return false;
    if (prev[0] === 'IDENTIFIER' || prev[0] === 'PROPERTY' ||
        prev[0] === ')' || prev[0] === ']' || prev[0] === '}' ||
        prev[0] === 'STRING' || prev[0] === 'NUMBER') {
      // `x schema` is an implicit call of x on schema — not a decl.
      if (!EXPR_START_PREV.has(ptag)) return false;
    }
  }
  // What follows determines the body form:
  //   SYMBOL? then INDENT           — indented block body.
  //   SYMBOL? then `TERMINATOR ;`   — inline body (one-liner), with field
  //                                   entries separated by more `;`
  //                                   terminators up to the newline.
  let j = i + 1;
  if (tokens[j]?.[0] === 'SYMBOL') j++;
  if (tokens[j]?.[0] === 'TERMINATOR') {
    if (tokens[j][1] === ';') return true;
    j++;
  }
  return tokens[j]?.[0] === 'INDENT';
}

// Collapse `IDENTIFIER 'schema' [SYMBOL kind] [TERMINATOR] INDENT ... OUTDENT`
// at position i into `SCHEMA SCHEMA_BODY`. SCHEMA_BODY carries a structured
// descriptor on .data. `config` snapshots any `schema.<key>` pragmas in
// effect at this point so later pragma changes don't retroactively alter
// earlier schemas.
function collapseSchemaAt(lexer, tokens, i, config) {
  let schemaTok = tokens[i];
  let kindToken = null;
  let kind = KIND_DEFAULT;
  let j = i + 1;

  if (tokens[j]?.[0] === 'SYMBOL') {
    kindToken = tokens[j];
    let k = kindToken[1];
    if (!VALID_KINDS.has(k)) {
      throw schemaError(kindToken,
        `Unknown schema kind :${k}. Expected one of :input, :shape, :model, :mixin, :enum.`);
    }
    kind = k;
    j++;
  }

  let bodyTokens;
  let endIdx;
  if (tokens[j]?.[0] === 'TERMINATOR' && tokens[j][1] === ';') {
    // Inline one-liner: `schema [:kind]; field; field; ...` up to the
    // next `\n` TERMINATOR at depth 0. The `;` separators are already
    // TERMINATOR tokens, so splitBodyLines handles them unchanged.
    // Arrows (`->`, `~>`, `!>`) would make the body ambiguous with
    // subsequent `;`-separated fields, so methods/computed/hooks/
    // transforms are rejected on the inline form.
    let inlineStart = j + 1;
    let end = inlineStart;
    let depth = 0;
    // Rip's lexer collapses `;\n` into a single `;`-valued TERMINATOR,
    // so value-based "end of inline" detection alone misses trailing
    // `X = schema :shape; name!;\ny = 1`. We track the inline body's
    // starting row and break the moment a token's row advances past
    // it at depth 0 — that captures both plain `\n` and the folded
    // `;\n` case.
    let startRow = tokens[inlineStart]?.loc?.r ?? null;
    while (end < tokens.length) {
      let tk = tokens[end];
      let tag = tk[0];
      if (depth === 0 && startRow != null && tk.loc && tk.loc.r > startRow) break;
      if (tag === '(' || tag === '[' || tag === '{' ||
          tag === 'CALL_START' || tag === 'INDEX_START' || tag === 'PARAM_START') depth++;
      else if (tag === ')' || tag === ']' || tag === '}' ||
               tag === 'CALL_END' || tag === 'INDEX_END' || tag === 'PARAM_END') depth--;
      // Inline body ends at the first depth-0 newline OR at any
      // INDENT/OUTDENT — INDENT would mean the user opened a block
      // (incompatible with inline), and OUTDENT means we're exiting
      // a surrounding block and must leave that token in place for
      // the outer scanner's depth bookkeeping.
      else if (depth === 0 && tag === 'TERMINATOR' && tk[1] !== ';') break;
      else if (depth === 0 && (tag === 'INDENT' || tag === 'OUTDENT')) break;
      // Arrows (`->` method/hook/transform, `~>` computed, `!>` eager
      // derived) make field bodies ambiguous with subsequent
      // `;`-separated entries on the same line, so reject them early
      // with a clear message that points users at the indented form.
      // `~>` lexes as EFFECT; `!>` lexes as UNARY_MATH '!' + COMPARE '>'.
      else if (depth === 0 && tag === '->') {
        throw schemaError(tk, `Inline schema body does not support '->' (method/hook/transform). Use the indented form.`);
      }
      else if (depth === 0 && tag === 'EFFECT') {
        throw schemaError(tk, `Inline schema body does not support '~>' (computed getter). Use the indented form.`);
      }
      else if (depth === 0 && tag === 'UNARY_MATH' && tk[1] === '!' &&
               tokens[end + 1]?.[0] === 'COMPARE' && tokens[end + 1][1] === '>') {
        throw schemaError(tk, `Inline schema body does not support '!>' (eager derived). Use the indented form.`);
      }
      end++;
    }
    // A trailing TERMINATOR at the boundary (`;` that the lexer folded
    // with `\n`, or a plain `\n` that happened to land inside our
    // capture range) must remain in the token stream as a statement
    // separator between this schema and whatever follows on the next
    // line. Trim it out of the body / splice span so the parser
    // keeps seeing it. splitBodyLines is safe with a body that
    // doesn't end in TERMINATOR.
    while (end > inlineStart && tokens[end - 1][0] === 'TERMINATOR') end--;
    bodyTokens = tokens.slice(inlineStart, end);
    endIdx = end;
    // Empty inline body (`X = schema :shape;` with nothing after the
    // leading `;`) is almost always a typo — an indented body that
    // wasn't written, or a stray `;` on an otherwise complete decl.
    // Fail loud rather than emit a schema with no entries.
    if (!bodyTokens.length) {
      throw schemaError(schemaTok,
        `Inline schema body is empty. Either add '; field; …' entries after 'schema${kindToken ? ' :' + kind : ''};' or switch to the indented form.`);
    }
  } else {
    if (tokens[j]?.[0] === 'TERMINATOR') j++;
    if (tokens[j]?.[0] !== 'INDENT') {
      throw schemaError(schemaTok,
        `Expected indented schema body after 'schema${kindToken ? ' :' + kind : ''}'.`);
    }
    let indentIdx = j;
    let outdentIdx = findMatchingOutdent(tokens, indentIdx);
    if (outdentIdx < 0) {
      throw schemaError(tokens[indentIdx], 'Unterminated schema body.');
    }
    bodyTokens = tokens.slice(indentIdx + 1, outdentIdx);
    endIdx = outdentIdx + 1; // include the OUTDENT itself in the replaced span
  }

  let descriptor = parseSchemaBody(kind, bodyTokens, {
    schemaLoc: schemaTok.loc,
    kindLoc: kindToken?.loc ?? null,
    kind,
    // Snapshot pragmas in effect at this decl so later pragma writes
    // don't retroactively change already-parsed schemas.
    defaultMaxString: config?.defaultMaxString ?? null,
  });

  // Replace range `[i, endIdx-1]` with `SCHEMA SCHEMA_BODY`.
  let schemaNewTok = mkToken('SCHEMA', 'schema', schemaTok);
  let bodyNewTok = mkToken('SCHEMA_BODY', kind, schemaTok);
  bodyNewTok.data = { descriptor };
  tokens.splice(i, endIdx - i, schemaNewTok, bodyNewTok);
}

// ============================================================================
// Sub-parser — fielded and enum modes
// ============================================================================

function parseSchemaBody(kind, bodyTokens, ctx) {
  let entries = [];
  let lines = splitBodyLines(bodyTokens);

  // Kind inference: a body whose first non-empty line begins with a
  // SYMBOL token is unambiguously an enum. Promote the default :input
  // kind to :enum so `schema\n  :draft\n  :active` needs no marker.
  // Explicit `:input` or any other kind stays as written.
  if (kind === KIND_DEFAULT && !ctx.kindLoc && lines.length > 0 &&
      lines[0][0]?.[0] === 'SYMBOL') {
    kind = 'enum';
    ctx.kind = 'enum';
  }

  if (kind === 'enum') {
    for (let line of lines) {
      parseEnumLine(line, entries);
    }
  } else {
    for (let line of lines) {
      parseFieldedLine(kind, line, entries, ctx);
    }
    // Capability-matrix enforcement by kind. `@mixin` is allowed as a
    // field-inclusion directive on every fielded kind because it adds
    // fields (not behavior). Other directives are restricted per the
    // matrix in the language reference.
    if (kind === 'mixin') {
      for (let e of entries) {
        if (e.tag === 'method' || e.tag === 'computed' || e.tag === 'hook') {
          throw schemaError({ loc: e.headerLoc || e.loc },
            `:mixin schemas are fields-only. '${e.name}' is a ${e.tag}; move it to a :shape or :model.`);
        }
        if (e.tag === 'ensure') {
          throw schemaError({ loc: e.headerLoc || e.loc },
            `:mixin schemas don't accept @ensure refinements. Move the invariant to a :shape or :model that composes this mixin.`);
        }
        if (e.tag === 'directive' && e.name !== 'mixin') {
          throw schemaError({ loc: e.loc },
            `:mixin schemas only accept '@mixin Name' directives. '@${e.name}' is not allowed.`);
        }
      }
    } else if (kind === 'input') {
      // :input accepts fields, @mixin, and @ensure (cross-field predicates
      // are a natural fit for form validation — "passwords must match").
      // Other methods, computed getters, hooks, and non-mixin directives
      // are rejected.
      for (let e of entries) {
        if (e.tag === 'method' || e.tag === 'computed' || e.tag === 'hook') {
          throw schemaError({ loc: e.headerLoc || e.loc },
            `:input schemas are fields-only. '${e.name}' is a ${e.tag}; use :shape or :model if you need behavior.`);
        }
        if (e.tag === 'directive' && e.name !== 'mixin') {
          throw schemaError({ loc: e.loc },
            `:input schemas only accept '@mixin Name' and '@ensure'. '@${e.name}' is not allowed.`);
        }
      }
    } else if (kind === 'shape') {
      // :shape accepts fields, methods, computed, and @mixin. Hooks
      // and ORM-bound directives (timestamps, softDelete, index,
      // belongs_to, has_many, has_one, link) are :model-only.
      for (let e of entries) {
        if (e.tag === 'hook') {
          throw schemaError({ loc: e.headerLoc || e.loc },
            `:shape schemas don't have lifecycle hooks. '${e.name}' runs only on :model; move it or remove it.`);
        }
        if (e.tag === 'directive' && e.name !== 'mixin') {
          throw schemaError({ loc: e.loc },
            `:shape schemas only accept '@mixin Name'. '@${e.name}' is :model-only.`);
        }
      }
    }
  }

  return {
    kind,
    loc: ctx.schemaLoc,
    kindLoc: ctx.kindLoc,
    entries,
  };
}

// Split top-level lines inside a schema body. Nested INDENT/OUTDENT stays
// inside its owning line (belongs to a callable body, multi-line
// constraints, etc.). Each returned line is the raw sub-stream of tokens
// for that line (no outer TERMINATORs).
function splitBodyLines(tokens) {
  let lines = [];
  let cur = [];
  let depth = 0;
  for (let t of tokens) {
    let tag = t[0];
    if (tag === 'INDENT') depth++;
    if (tag === 'OUTDENT') depth--;
    if (tag === 'TERMINATOR' && depth === 0) {
      if (cur.length) { lines.push(cur); cur = []; }
      continue;
    }
    cur.push(t);
  }
  if (cur.length) lines.push(cur);
  return lines;
}

// Fielded body: field, directive, or callable.
// Field-line grammar (v2, locked):
//
//   name[!|?|#]*  [type]  [range]  [default]  [regex]  [attrs]  [, -> transform]
//
// Invariants enforced here:
//   1. Line classification: IDENTIFIER-start = field; PROPERTY-start (the
//      lexer absorbs trailing `:` into the identifier's tag) = callable.
//   2. Type slot is optional — default is `string`. Identifier types
//      (`email`, `integer`, …), array suffix (`string[]`), and string-
//      literal unions (`"M" | "F" | "U"`) are the three valid shapes.
//   3. Literal unions require 2+ members, all string literals, no mixing
//      with identifier types or null. Nullability is carried by the `?`
//      modifier, not by union membership.
//   4. The `->` transform is TERMINAL — nothing follows it on the line.
//   5. Comma before `->` is required when anything precedes the arrow
//      (type, range, regex, default, attrs). Only the bare form
//      `name! -> body` parses comma-less, because there's nothing to
//      elide.
//   6. Each comma-separated rest part is one of: `[…]` default,
//      `{…}` attrs, `/regex/` pattern, `n..n` range, `-> transform`.
//      The head token uniquely identifies the form. Duplicates of any
//      single form are rejected.
// VARCHAR-like primitive types — the `schema.defaultMaxString` pragma
// applies a default `max` to these when no explicit range/regex/literals
// are declared. `text` stays uncapped by design (it's the opt-out for
// long-form content); `uuid` has fixed length; `json`/`any` aren't strings.
const VARCHAR_TYPES = new Set(['string', 'email', 'url', 'phone', 'zip']);

function parseFieldedLine(kind, line, entries, ctx) {
  let first = line[0];
  if (!first) return;

  // Directive: @NAME [args]
  if (first[0] === '@') {
    let nameTok = line[1];
    if (!nameTok || (nameTok[0] !== 'IDENTIFIER' && nameTok[0] !== 'PROPERTY')) {
      throw schemaError(first, "Expected directive name after '@'.");
    }
    let argTokens = line.slice(2);
    let dname = nameTok[1];

    // `@ensure` is a refinement directive with its own grammar — it takes
    // either an inline `"msg", (args) -> body` or a bracketed array of
    // those pairs. Emits one `tag: "ensure"` entry per refinement; the
    // per-entry shape mirrors methods so compileCallableFn-style codegen
    // can fire.
    if (dname === 'ensure') {
      let pairs = parseEnsurePairs(argTokens, first);
      for (let p of pairs) {
        entries.push({
          tag: 'ensure',
          name: 'ensure',
          message: p.message,
          paramTokens: p.paramTokens,
          bodyTokens: p.bodyTokens,
          loc: p.loc,
          headerLoc: first.loc,
        });
      }
      return;
    }

    // Pre-parse structured args so shadow-TS and runtime-codegen share
    // the same descriptor shape. Relation and mixin directives get a
    // `[{target, optional?}]` array; other directives leave `args` unset.
    let args = null;
    if (dname === 'belongs_to' || dname === 'has_many' || dname === 'has_one' ||
        dname === 'one' || dname === 'many' || dname === 'mixin') {
      let t0 = argTokens[0];
      if (t0 && (t0[0] === 'IDENTIFIER' || t0[0] === 'PROPERTY')) {
        let optional = t0.data?.predicate === true;
        if (!optional && argTokens[1]?.[0] === '?') optional = true;
        args = [{ target: t0[1], optional }];
      }
    }
    entries.push({
      tag: 'directive',
      name: dname,
      args,
      argTokens,
      loc: first.loc,
    });
    return;
  }

  // The identifier regex absorbs a trailing `:` by retagging the ident as
  // PROPERTY and emitting a separate `:` token. So a line starting with
  // PROPERTY is always a callable (`name: -> body` or `name: ~> body`);
  // a line starting with IDENTIFIER is always a field.
  if (first[0] === 'PROPERTY') {
    parseCallableLine(kind, first, line, entries);
    return;
  }
  if (first[0] !== 'IDENTIFIER') {
    throw schemaError(first,
      `Unexpected ${first[0]} at schema top level. Allowed: fields ('name! type'), directives ('@name'), methods ('name: -> body'), or computed getters ('name: ~> body').`);
  }

  let name = first[1];

  // Guard: `name:` without the colon absorbed — shouldn't happen but
  // produces a friendly error if it does.
  if (line[1]?.[0] === ':') {
    throw schemaError(line[1],
      `Schema fields use 'name type' (space, no colon). For methods or computed use 'name: -> body' or 'name: ~> body'.`);
  }

  // Field: IDENTIFIER [modifiers] TYPE [, constraints] [, attrs]
  let modifiers = collectModifiers(first);
  let pos = 1;

  // Adjacent `!`, `#`, `?` modifier tokens. `!` and `?` are absorbed into
  // the IDENTIFIER's data by the main lexer. `#` arrives as a standalone
  // token because the schema commentToken exception kicks in when `#` is
  // adjacent to an identifier. A modifier must be unspaced from the
  // token it follows, so we check the preceding token's `.spaced` flag
  // (which the whitespace pass sets to true when whitespace follows).
  while (pos < line.length) {
    let tk = line[pos];
    let adjacent = line[pos - 1] && !line[pos - 1].spaced;
    if (!adjacent) break;
    if (tk[0] === '#' || tk[0] === '?' || tk[0] === '!') {
      modifiers.push(tk[0]);
      pos++;
      continue;
    }
    break;
  }

  // Reject a stray colon here — gives a clear diagnostic for the common
  // mistake `name: type` instead of `name type`.
  let typeFirst = line[pos];
  if (typeFirst?.[0] === ':') {
    throw schemaError(typeFirst,
      `Schema fields use 'name type' (space, no colon). Got 'name:'. For methods/computed use 'name: -> body' or 'name: ~> body'.`);
  }

  // Type: IDENTIFIER (optionally followed by `[]` for array) OR a
  // string-literal union like `"M" | "F" | "U"`. The type slot is
  // OPTIONAL — if the next token isn't a type-starting token, the
  // field defaults to `string` and we fall through to constraint
  // parsing.
  let typeName = 'string';
  let literals = null;
  if (typeFirst?.[0] === 'IDENTIFIER') {
    typeName = typeFirst[1];
    pos++;
  } else if (typeFirst?.[0] === 'STRING') {
    // Literal union: collect alternating STRING | STRING | STRING...
    literals = [JSON.parse(typeFirst[1])];
    pos++;
    while (line[pos]?.[0] === '|' && line[pos + 1]?.[0] === 'STRING') {
      pos++; // consume '|'
      literals.push(JSON.parse(line[pos][1]));
      pos++;
    }
    // Forbid mixing with identifier types or null/undefined.
    if (line[pos]?.[0] === '|') {
      let next = line[pos + 1];
      let tag = next?.[0] ?? '<end>';
      throw schemaError(next || line[pos],
        `Literal unions contain string literals only. '${tag}' is not allowed as a union member. Use the '?' modifier for nullability.`);
    }
    if (literals.length < 2) {
      throw schemaError(typeFirst,
        `Literal union needs at least two string literals. Use '${JSON.stringify(literals[0])}' as a default with '[${JSON.stringify(literals[0])}]' instead.`);
    }
    typeName = 'literal-union';
  }
  let array = false;
  // `string[]` tokenizes as IDENTIFIER INDEX_START INDEX_END (or `[` `]`
  // depending on context; closeOpenIndexes retags the empty bracket pair
  // as INDEX_START/INDEX_END when it follows an indexable token).
  let openTag = line[pos]?.[0];
  let closeTag = line[pos + 1]?.[0];
  if ((openTag === '[' || openTag === 'INDEX_START') &&
      (closeTag === ']' || closeTag === 'INDEX_END')) {
    array = true;
    pos += 2;
  }

  // Remaining tokens on the line are a mix of `[…]` constraints (default,
  // regex), `{…}` attrs, and `n..n` range constraints. Each form is
  // self-identifying by its head token shape. Raw token slices are
  // captured here and semantic-parsed at compile time.
  let rest = line.slice(pos);

  // Comma-required rule: if a type was consumed and the next token is
  // `->` (no comma separator), reject with a clear diagnostic. The
  // comma is a structural boundary between the field declaration and
  // the transform; skipping it makes `email!# email -> fn` read as
  // if 'email' were an argument to the arrow, which it isn't.
  let typeConsumed = typeFirst?.[0] === 'IDENTIFIER' || typeFirst?.[0] === 'STRING';
  if (typeConsumed && rest[0]?.[0] === '->') {
    throw schemaError(rest[0],
      `Field '${name}' has a transform after the type; a comma is required before '->'. Write '${name} ${typeName}, -> …'.`);
  }
  let constraintTokens = null;
  let attrsTokens = null;
  let rangeTokens = null;
  let regexToken = null;
  let transformTokens = null;

  if (rest.length > 0) {
    // The leading comma is only required when a type was consumed. If
    // the type slot was empty, constraints may follow the modifiers
    // directly (`name? [1, 20]`). Both shapes produce the same parts.
    if (rest[0]?.[0] === ',') {
      rest = rest.slice(1);
    }
    // Split top-level by commas. Multi-line trailers (`name! type,\n
    // [8, 100]`) introduce surrounding INDENT/OUTDENT tokens that
    // don't affect semantics — strip them from each part so the head
    // is the literal `[` or `{`.
    let parts = splitTopLevelByComma(rest);
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      // Strip leading INDENT/TERMINATOR so we can inspect the head token.
      while (part.length && (part[0][0] === 'INDENT' || part[0][0] === 'TERMINATOR')) {
        part = part.slice(1);
      }
      if (!part.length) continue;

      // A `->` at the head of a part is the transform arrow — the
      // preceding comma separated it out. `->` elsewhere in the part
      // (after content) means the user wrote something like
      // `email -> fn` without the separator; the comma is required
      // as a structural boundary between the field declaration and
      // the transform.
      if (part[0][0] !== '->') {
        let innerArrow = findTopLevelArrowIdx(part);
        if (innerArrow > 0) {
          throw schemaError(part[innerArrow],
            `Field '${name}' has a transform after other content; a comma is required before '->'. Write 'name! <constraints>, -> <body>'.`);
        }
      }
      let head = part[0];
      // For non-transform parts, also strip trailing OUTDENT/TERMINATOR.
      // Transform parts own their INDENT/OUTDENT wrapping — parseBodyTokens
      // handles it.
      if (head[0] !== '->') {
        while (part.length && (part[part.length - 1][0] === 'OUTDENT' || part[part.length - 1][0] === 'TERMINATOR')) {
          part = part.slice(0, -1);
        }
        if (!part.length) continue;
        head = part[0];
      }
      if (head[0] === '[' || head[0] === 'INDEX_START') {
        if (constraintTokens) {
          throw schemaError(head,
            `Field '${name}' has more than one '[…]' constraint. At most one default / regex bracket per field.`);
        }
        constraintTokens = part;
      } else if (head[0] === '{') {
        if (attrsTokens) {
          throw schemaError(head,
            `Field '${name}' has more than one '{…}' attrs bracket.`);
        }
        attrsTokens = part;
      } else if (isRangeConstraintTokens(part)) {
        if (rangeTokens) {
          throw schemaError(head,
            `Field '${name}' has more than one range constraint. Only one 'min..max' per field.`);
        }
        rangeTokens = part;
      } else if (head[0] === 'REGEX' && part.length === 1) {
        if (regexToken) {
          throw schemaError(head,
            `Field '${name}' has more than one regex constraint.`);
        }
        regexToken = head;
      } else if (head[0] === '->') {
        // Transform part. Must be the last comma-separated part on the
        // line (transform is terminal).
        if (i !== parts.length - 1) {
          throw schemaError(head,
            `Transform '-> …' must be the last element on the field line for '${name}'.`);
        }
        transformTokens = part.slice(1);
      } else {
        throw schemaError(head,
          `Unexpected trailer for field '${name}'. Expected '[…]' default, '{…}' attrs, '/regex/', 'min..max' range, or '-> transform'.`);
      }
    }
  }

  // Array suffix is incompatible with literal-union types in v2.
  if (array && literals) {
    throw schemaError(typeFirst,
      `Array-of-literal-union is not supported. Use 'string[]' if you need an array of strings.`);
  }

  // The `schema.defaultMaxString` pragma baked into this schema's ctx
  // is a candidate for any VARCHAR-like primitive that isn't already
  // narrowed by a regex or literal-union. The final "fill it in only
  // if max is still absent" decision happens in mergeFieldConstraints
  // so open-ended ranges (`5..` → only min) still get the pragma's max.
  // Using `!= null` (not truthy) keeps future non-positive pragma
  // values valid if more keys land here.
  let defaultMax = null;
  if (ctx?.defaultMaxString != null && !regexToken && !literals &&
      VARCHAR_TYPES.has(typeName)) {
    defaultMax = ctx.defaultMaxString;
  }

  entries.push({
    tag: 'field',
    name,
    modifiers,
    typeName,
    array,
    literals,
    constraintTokens,
    attrsTokens,
    rangeTokens,
    regexToken,
    transformTokens,
    defaultMax,
    loc: first.loc,
  });
}

// Scan a constraint part for a top-level `->` (depth-zero arrow). Returns
// the index of the arrow or -1 if absent. Used to split parts like
// `8..100 -> transform` without requiring a comma between them.
function findTopLevelArrowIdx(tokens) {
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    let tag = tokens[i][0];
    if (tag === '(' || tag === '[' || tag === '{' ||
        tag === 'CALL_START' || tag === 'INDEX_START' ||
        tag === 'PARAM_START') depth++;
    else if (tag === ')' || tag === ']' || tag === '}' ||
             tag === 'CALL_END' || tag === 'INDEX_END' ||
             tag === 'PARAM_END') depth--;
    else if (depth === 0 && tag === '->') return i;
  }
  return -1;
}

// Range constraint: `min..max` with optional leading `-` on either
// endpoint. Either endpoint may be omitted for open-ended ranges —
// `..N` is "at most N" (no min), `N..` is "at least N" (no max). At
// least one endpoint must be present; a bare `..` is rejected.
// Operates on a top-level comma-split part; stripping any surrounding
// INDENT/OUTDENT is handled by the caller.
function isRangeConstraintTokens(tokens) {
  let i = 0;
  // Left endpoint (optional).
  let hasLeft = false;
  if (tokens[i]?.[0] === '-' && tokens[i + 1]?.[0] === 'NUMBER') { i += 2; hasLeft = true; }
  else if (tokens[i]?.[0] === 'NUMBER') { i++; hasLeft = true; }
  // Dots.
  if (tokens[i]?.[0] !== '..') return false;
  i++;
  // Right endpoint (optional).
  let hasRight = false;
  if (tokens[i]?.[0] === '-' && tokens[i + 1]?.[0] === 'NUMBER') { i += 2; hasRight = true; }
  else if (tokens[i]?.[0] === 'NUMBER') { i++; hasRight = true; }
  // Need at least one endpoint, and nothing trailing.
  return (hasLeft || hasRight) && i === tokens.length;
}

function parseCallableLine(kind, headerTok, line, entries) {
  let name = headerTok[1];
  let colonTok = line[1];
  if (!colonTok || colonTok[0] !== ':') {
    throw schemaError(headerTok,
      `Expected ':' after '${name}' before arrow.`);
  }
  // Three arrow forms:
  //   name: -> body   — method / hook
  //   name: ~> body   — lazy computed getter (EFFECT token)
  //   name: !> body   — eager derived field (UNARY_MATH '!' + COMPARE '>')
  let arrowTok = line[2];
  let nextTok = line[3];
  let arrow, arrowLoc, bodyStart;
  if (arrowTok && arrowTok[0] === '->') {
    arrow = '->';
    arrowLoc = arrowTok.loc;
    bodyStart = 3;
  } else if (arrowTok && arrowTok[0] === 'EFFECT') {
    arrow = '~>';
    arrowLoc = arrowTok.loc;
    bodyStart = 3;
  } else if (arrowTok && arrowTok[0] === 'UNARY_MATH' && arrowTok[1] === '!' &&
             nextTok && nextTok[0] === 'COMPARE' && nextTok[1] === '>' &&
             !arrowTok.spaced) {
    arrow = '!>';
    arrowLoc = arrowTok.loc;
    bodyStart = 4;
  } else {
    throw schemaError(colonTok,
      `Schema top-level '${name}:' must be followed by '->' (method/hook), '~>' (computed getter), or '!>' (eager derived).`);
  }
  let bodyTokens = line.slice(bodyStart);
  let isHook = HOOK_NAMES.has(name);
  let entryTag;
  if (arrow === '~>') {
    entryTag = 'computed';
  } else if (arrow === '!>') {
    entryTag = 'derived';
  } else if (kind === 'model' && isHook) {
    entryTag = 'hook';
  } else {
    entryTag = 'method';
  }
  entries.push({
    tag: entryTag,
    name,
    arrow,
    paramTokens: [],
    bodyTokens,
    headerLoc: headerTok.loc,
    arrowLoc,
  });
}

// Parse `@ensure` arguments into one or more refinement pairs. Accepts two
// forms:
//
//   inline: `@ensure "msg", (args) -> body`
//   array:  `@ensure [ "msg", (args) -> body
//                     , "msg", (args) -> body
//                     , ... ]`
//
// Both forms compile to the SAME entry shape — each pair becomes one
// `{tag: "ensure", message, paramTokens, bodyTokens}` entry. Downstream
// runtime code can't tell the two source forms apart.
//
// The directive arrives wrapped in the implicit CALL_START/CALL_END pair
// because Rip sees `@ensure args...` as a call; we strip that wrapper
// before looking for the array bracket or the inline string.
function parseEnsurePairs(argTokens, directiveTok) {
  let tokens = argTokens;
  if (!tokens.length) {
    throw schemaError(directiveTok,
      "@ensure requires 'message, (x) -> body' or '[...]' array of pairs.");
  }
  // Strip implicit call wrapper if present.
  if (tokens[0]?.[0] === 'CALL_START' &&
      tokens[tokens.length - 1]?.[0] === 'CALL_END') {
    tokens = tokens.slice(1, -1);
  }
  if (!tokens.length) {
    throw schemaError(directiveTok,
      "@ensure requires 'message, (x) -> body' or '[...]' array of pairs.");
  }

  let first = tokens[0];
  // Array form: tokens start with `[` (or INDEX_START).
  if (first[0] === '[' || first[0] === 'INDEX_START') {
    let inner = extractEnsureBracketInner(tokens, first);
    let parts = splitEnsureElements(inner);
    if (parts.length === 0) {
      throw schemaError(first, "@ensure [...] must contain at least one 'message, fn' pair.");
    }
    if (parts.length % 2 !== 0) {
      throw schemaError(first,
        `@ensure [...] must have pairs of 'message, fn' (got ${parts.length} elements; odd count).`);
    }
    let pairs = [];
    for (let i = 0; i < parts.length; i += 2) {
      pairs.push(extractEnsurePair(parts[i], parts[i + 1], first));
    }
    return pairs;
  }

  // Inline form: STRING, (args) -> body
  let parts = splitTopLevelByComma(tokens);
  if (parts.length < 2) {
    throw schemaError(first,
      "@ensure inline form must be 'message, (x) -> body'. Did you forget the comma?");
  }
  if (parts.length > 2) {
    throw schemaError(first,
      `@ensure inline form takes exactly 'message, fn' (got ${parts.length} comma-separated parts). Use '@ensure [...]' for multiple refinements.`);
  }
  return [extractEnsurePair(parts[0], parts[1], first)];
}

// Walk `[ ... ]` tokens and return the inner slice. Rejects trailing
// tokens after the close bracket. Strips an outermost INDENT/OUTDENT
// pair if the bracket body is multi-line (Rip wraps multi-line array
// contents in one), since @ensure splits pairs at depth 0 and that
// outer wrap would hide every internal comma/newline.
function extractEnsureBracketInner(tokens, openTok) {
  let depth = 0;
  let inner = [];
  for (let i = 0; i < tokens.length; i++) {
    let t = tokens[i];
    let tag = t[0];
    if (tag === '[' || tag === 'INDEX_START') {
      depth++;
      if (depth === 1) continue;
    }
    if (tag === ']' || tag === 'INDEX_END') {
      depth--;
      if (depth === 0) {
        if (i < tokens.length - 1) {
          throw schemaError(tokens[i + 1],
            "@ensure [...] must be the only argument — extra tokens after ']'.");
        }
        // Strip outer INDENT/OUTDENT pair if it wraps the whole inner.
        if (inner.length >= 2 &&
            inner[0][0] === 'INDENT' &&
            inner[inner.length - 1][0] === 'OUTDENT') {
          let wd = 0, matched = false;
          for (let k = 0; k < inner.length; k++) {
            if (inner[k][0] === 'INDENT') wd++;
            else if (inner[k][0] === 'OUTDENT') {
              wd--;
              if (wd === 0 && k === inner.length - 1) { matched = true; break; }
              if (wd === 0) break;
            }
          }
          if (matched) inner = inner.slice(1, -1);
        }
        return inner;
      }
    }
    if (depth >= 1) inner.push(t);
  }
  throw schemaError(openTok, "@ensure: unclosed '['.");
}

// Split an @ensure array body into elements. Mirrors Rip's array-literal
// rule: both `,` and newlines (TERMINATOR) are element separators at
// depth 0. This lets users write rows without trailing commas:
//
//   @ensure [
//     "msg1", (u) -> body
//     "msg2", (u) -> body     <-- no comma needed between pairs
//   ]
function splitEnsureElements(tokens) {
  let parts = [];
  let cur = [];
  let depth = 0;
  for (let t of tokens) {
    let tag = t[0];
    if (tag === '(' || tag === '[' || tag === '{' ||
        tag === 'CALL_START' || tag === 'INDEX_START' ||
        tag === 'PARAM_START' || tag === 'INDENT') depth++;
    if (tag === ')' || tag === ']' || tag === '}' ||
        tag === 'CALL_END' || tag === 'INDEX_END' ||
        tag === 'PARAM_END' || tag === 'OUTDENT') depth--;
    if (depth === 0 && (tag === ',' || tag === 'TERMINATOR')) {
      if (cur.length) { parts.push(cur); cur = []; }
      continue;
    }
    cur.push(t);
  }
  if (cur.length) parts.push(cur);
  return parts;
}

// Extract one refinement pair from `messagePart` and `fnPart` (two token
// slices already split by splitTopLevelByComma). Validates shape at parse
// time so typos surface with targeted diagnostics instead of runtime
// "expected function" noise.
function extractEnsurePair(messagePart, fnPart, refTok) {
  if (!messagePart || !messagePart.length) {
    throw schemaError(refTok, "@ensure: missing message (expected a string literal).");
  }
  if (messagePart.length !== 1 || messagePart[0][0] !== 'STRING') {
    throw schemaError(messagePart[0] || refTok,
      "@ensure: each refinement's first element must be a string literal message.");
  }
  let msgTok = messagePart[0];
  let message = JSON.parse(msgTok[1]);

  if (!fnPart || !fnPart.length) {
    throw schemaError(msgTok, "@ensure: missing function after message.");
  }
  // The fn part should open with `(` / PARAM_START and contain `->`. An
  // `->` with no params (e.g. `-> true`) is rejected — refinements must
  // declare the object parameter explicitly.
  let t0 = fnPart[0];
  if (t0[0] !== '(' && t0[0] !== 'PARAM_START') {
    throw schemaError(t0,
      "@ensure: expected '(args) -> body' after the message. Predicates must declare their parameter explicitly — '(u) -> ...'.");
  }
  // Walk matching paren to find PARAM_END.
  let depth = 1;
  let pos = 1;
  let paramTokens = [];
  while (pos < fnPart.length && depth > 0) {
    let t = fnPart[pos];
    let tag = t[0];
    if (tag === '(' || tag === 'PARAM_START') depth++;
    if (tag === ')' || tag === 'PARAM_END') {
      depth--;
      if (depth === 0) { pos++; break; }
    }
    paramTokens.push(t);
    pos++;
  }
  if (depth !== 0) {
    throw schemaError(t0, "@ensure: unclosed '(' in predicate parameters.");
  }
  let arrowTok = fnPart[pos];
  if (!arrowTok || arrowTok[0] !== '->') {
    throw schemaError(arrowTok || fnPart[pos - 1] || msgTok,
      "@ensure: expected '->' after predicate parameters.");
  }
  let bodyTokens = fnPart.slice(pos + 1);
  if (!bodyTokens.length) {
    throw schemaError(arrowTok, "@ensure: predicate function body is empty.");
  }
  return { message, paramTokens, bodyTokens, loc: msgTok.loc };
}

// Extract param names from `(u)` or `(u, opts)` token slice. Accepts
// plain identifiers only (no destructuring, defaults, or rest args —
// refinements don't need that complexity yet).
function ensureParamNames(paramTokens, refTok) {
  if (!paramTokens.length) return [];
  let parts = splitTopLevelByComma(paramTokens);
  return parts.map(part => {
    let pTokens = part.filter(t => t[0] !== 'TERMINATOR');
    if (pTokens.length !== 1 || pTokens[0][0] !== 'IDENTIFIER') {
      throw schemaError(pTokens[0] || refTok,
        "@ensure: predicate parameters must be plain identifiers.");
    }
    return pTokens[0][1];
  });
}

function parseEnumLine(line, entries) {
  let first = line[0];
  if (!first) return;
  // Enum member forms:
  //   :admin          bare symbol    → maps to name string "admin"
  //   :pending 0      valued symbol  → maps "pending" (and 0) to 0
  //
  // Values are any literal (number, string, boolean, null, regex).
  // Mixing bare and valued members in one enum is permitted but
  // unusual: the Map is heterogeneous when you do it — bare entries
  // hold name strings, valued entries hold their literal. Keep the
  // members uniform if that matters for downstream consumers.
  if (first[0] === '@') {
    let nameTok = line[1];
    let dname = nameTok && (nameTok[0] === 'IDENTIFIER' || nameTok[0] === 'PROPERTY')
      ? nameTok[1] : 'directive';
    throw schemaError(first,
      `:enum schemas don't accept '@${dname}'. Enums hold only :symbol members. Move the invariant to a :shape or :model that uses this enum as a field type.`);
  }
  if (first[0] !== 'SYMBOL') {
    throw schemaError(first,
      `Enum member must be a :symbol. Use ':${first[1] ?? 'name'}' for a bare member or ':${first[1] ?? 'name'} value' for a valued one.`);
  }
  let name = first[1];
  let second = line[1];
  if (!second) {
    entries.push({ tag: 'enum-member', name, value: undefined, loc: first.loc });
    return;
  }
  if (second[0] === ':') {
    throw schemaError(second,
      `Enum member ':${name}' — drop the ':' before the value. Use ':${name} value'.`);
  }
  if (line.length > 2) {
    throw schemaError(line[2],
      `Extra tokens after enum member ':${name}' value.`);
  }
  entries.push({
    tag: 'enum-member',
    name,
    value: literalOf(second),
    loc: first.loc,
  });
}

// ============================================================================
// Codegen — emitSchema
// ============================================================================

function emitSchemaNode(emitter, head, rest, context) {
  // rest[0] is the SCHEMA_BODY node. The parser metadata bridge wraps the
  // token value in `new String()` and copies token.data fields onto it, so
  // the descriptor surfaces as `node.descriptor` here.
  let node = rest[0];
  let descriptor = readDescriptor(node);
  if (!descriptor) {
    throw new Error('schema: missing descriptor on SCHEMA_BODY token');
  }
  emitter.usesSchemas = true;

  // The binding name is threaded through `_schemaName` by emitAssignment
  // (parallels `_componentName`). When present, we embed it so SchemaError,
  // generated class name, and debug output all have a stable identity.
  let schemaName = emitter._schemaName || null;

  let parts = [`kind: ${JSON.stringify(descriptor.kind)}`];
  if (schemaName) parts.push(`name: ${JSON.stringify(schemaName)}`);
  parts.push(`entries: [${descriptor.entries.map(e => entryLiteral(emitter, e)).join(', ')}]`);
  return `__schema({${parts.join(', ')}})`;
}

function readDescriptor(node) {
  if (node && typeof node === 'object') {
    if (node.descriptor) return node.descriptor;
    if (node.data?.descriptor) return node.data.descriptor;
  }
  return null;
}

function entryLiteral(emitter, e) {
  switch (e.tag) {
    case 'field': {
      let obj = [
        `tag: "field"`,
        `name: ${JSON.stringify(e.name)}`,
        `modifiers: ${JSON.stringify(e.modifiers)}`,
        `typeName: ${JSON.stringify(e.typeName)}`,
        `array: ${e.array ? 'true' : 'false'}`,
      ];
      if (e.literals) {
        obj.push(`literals: ${JSON.stringify(e.literals)}`);
      }
      let range = e.rangeTokens ? compileRangeTokens(e.rangeTokens, e) : null;
      let bracket = e.constraintTokens ? compileConstraintsLiteral(e.constraintTokens, e) : null;
      let regex = e.regexToken ? regexLiteralOf(e.regexToken) : null;
      let merged = mergeFieldConstraints(range, bracket, regex, e);
      if (merged) obj.push(`constraints: ${merged}`);
      if (e.transformTokens) {
        obj.push(`transform: ${compileTransformFn(emitter, e.transformTokens)}`);
      }
      return `{${obj.join(', ')}}`;
    }
    case 'directive': {
      let obj = [`tag: "directive"`, `name: ${JSON.stringify(e.name)}`];
      let args = compileDirectiveArgsLiteral(e.name, e.argTokens || []);
      if (args) obj.push(`args: ${args}`);
      return `{${obj.join(', ')}}`;
    }
    case 'ensure': {
      let fnCode = compileEnsureFn(emitter, e);
      let obj = [
        `tag: "ensure"`,
        `message: ${JSON.stringify(e.message)}`,
        `fn: ${fnCode}`,
      ];
      return `{${obj.join(', ')}}`;
    }
    case 'computed':
    case 'method':
    case 'hook':
    case 'derived': {
      let fnCode = compileCallableFn(emitter, e);
      let obj = [
        `tag: ${JSON.stringify(e.tag)}`,
        `name: ${JSON.stringify(e.name)}`,
        `fn: ${fnCode}`,
      ];
      return `{${obj.join(', ')}}`;
    }
    case 'enum-member': {
      let obj = [`tag: "enum-member"`, `name: ${JSON.stringify(e.name)}`];
      if (e.value !== undefined) obj.push(`value: ${JSON.stringify(e.value)}`);
      return `{${obj.join(', ')}}`;
    }
    default:
      return `{tag: "unknown"}`;
  }
}

// Compile a callable body (`-> body` or `~> body`) to a JS `function(...)`
// expression with dynamic `this`. Both computed getters and methods are
// emitted using the Rip thin-arrow codegen, which naturally produces a
// `function() { ... }` (Rip `->` is NOT a JS arrow). This gives us the
// right `this` semantics for instance-attached methods and proto getters.
function compileCallableFn(emitter, entry) {
  let bodySexpr = parseBodyTokens(entry.bodyTokens);
  if (!bodySexpr) {
    // Empty body — emit a no-op.
    return `(function() {})`;
  }
  // Wrap as a thin-arrow with no params. `emit` in value context produces
  // a parenthesized function expression.
  let arrowSexpr = ['->', [], bodySexpr];
  return emitter.emit(arrowSexpr, 'value');
}

// Compile an inline field transform body (`-> body`). The body receives
// the raw input object via Rip's implicit `it` parameter; no explicit
// params are emitted. Transform runs on .parse() only, not on hydrate.
function compileTransformFn(emitter, bodyTokens) {
  let bodySexpr = parseBodyTokens(bodyTokens);
  if (!bodySexpr) {
    return `(function() { return undefined; })`;
  }
  let arrowSexpr = ['->', [], bodySexpr];
  return emitter.emit(arrowSexpr, 'value');
}

// Compile an `@ensure` predicate — `(args) -> body` — into a thin-arrow
// function expression with explicit params. Unlike transforms (which use
// implicit `it`), refinements require the parameter to be named so the
// contract of "what the predicate sees" is visible at the call site.
function compileEnsureFn(emitter, entry) {
  let bodySexpr = parseBodyTokens(entry.bodyTokens);
  if (!bodySexpr) {
    return `(function() { return undefined; })`;
  }
  let params = ensureParamNames(entry.paramTokens, entry);
  let arrowSexpr = ['->', params, bodySexpr];
  return emitter.emit(arrowSexpr, 'value');
}

// ----------------------------------------------------------------------------
// Compile-time constraint + directive argument evaluation
// ----------------------------------------------------------------------------
//
// Constraints are captured as raw token slices during the lexer pass; this
// layer evaluates them into a normalized {min?, max?, default?, regex?}
// shape shared by runtime validation and DDL emission. Only literal-
// deterministic values are accepted — identifiers, calls, and arbitrary
// expressions are rejected.
//
// v2 constraint grammar (each form is self-identifying by token shape):
//   `min..max`    — range: string length / array length / numeric value
//   `[value]`     — default: a single literal payload in brackets
//   `/regex/`     — pattern: bare regex literal, no wrapping brackets
//   `{key: val}`  — attrs: object literal for `unique`, `index`, etc.
//   `-> body`     — transform: terminal, comma-required before arrow
//                   when anything precedes (see parseFieldedLine)
//
// Pre-v2 multi-element bracket forms (`[n, n]`, `[n, n, n]`, `[/re/]`) are
// explicitly rejected with migration diagnostics pointing at the new form.
function compileConstraintsLiteral(tokens, fieldEntry) {
  let inner = tokens.slice(1, -1);
  let items = splitTopLevelByComma(inner);
  if (!items.length) return { c: null };

  let values = items.map(part => evalLiteralTokens(part, fieldEntry));

  if (values.length === 1) {
    let v = values[0];
    if (v instanceof RegExp) {
      throw schemaError(tokens[0],
        `Regex constraints are written bare, not in brackets. Replace '[${v}]' with '${v}'.`);
    }
    return { c: { default: v } };
  }

  if (values.length === 2 && typeof values[0] === 'number' && typeof values[1] === 'number') {
    throw schemaError(tokens[0],
      `Size/value ranges use 'min..max' syntax, not brackets. Replace '[${values[0]}, ${values[1]}]' with '${values[0]}..${values[1]}'.`);
  }
  if (values.length === 3 && values.every(v => typeof v === 'number')) {
    throw schemaError(tokens[0],
      `Range + default is two separate constraints in v2. Replace '[${values[0]}, ${values[1]}, ${values[2]}]' with '${values[0]}..${values[1]}, [${values[2]}]'.`);
  }
  throw schemaError(tokens[0],
    `Constraint bracket takes a single default value in v2. Got ${values.length} elements.`);
}

// Extract a regex literal from a bare REGEX token. The lexer's raw text
// includes the surrounding `/.../` plus any flags.
function regexLiteralOf(tok) {
  let raw = tok[1];
  let m = /^\/((?:\\.|[^\\/])+)\/([a-z]*)$/.exec(raw);
  if (!m) throw schemaError(tok, `Invalid regex literal ${JSON.stringify(raw)}.`);
  try {
    return new RegExp(m[1], m[2]);
  } catch (e) {
    throw schemaError(tok, `Invalid regex '${raw}': ${e.message}`);
  }
}

// Evaluate a range token slice into {min?, max?}. Caller has already
// verified shape via isRangeConstraintTokens. Open-ended forms omit
// the corresponding key rather than emitting undefined, so downstream
// constraint serialization stays clean.
function compileRangeTokens(tokens, fieldEntry) {
  let i = 0;
  let readOneAt = () => {
    let sign = 1;
    if (tokens[i]?.[0] === '-') { sign = -1; i++; }
    let numTok = tokens[i++];
    let v = evalLiteralTokens([numTok], fieldEntry);
    if (typeof v !== 'number') {
      throw schemaError(numTok, `Range endpoints must be numeric literals.`);
    }
    return sign * v;
  };
  let min;
  if (tokens[i]?.[0] !== '..') min = readOneAt();
  i++; // consume `..`
  let max;
  if (i < tokens.length) max = readOneAt();
  if (min !== undefined && max !== undefined && min > max) {
    throw schemaError(tokens[0],
      `Range '${min}..${max}' is reversed. Write the smaller endpoint first.`);
  }
  let out = {};
  if (min !== undefined) out.min = min;
  if (max !== undefined) out.max = max;
  return out;
}

// Merge the optional range, bracket-default, and bare-regex constraints
// into a single literal object. Each source contributes disjoint keys
// by construction — range sets min/max, bracket sets default, regex
// sets regex.
function mergeFieldConstraints(range, bracketLiteral, regex, fieldEntry) {
  let c = (bracketLiteral && bracketLiteral.c) || {};
  // Track whether this field's range used open-left shorthand (`..N`).
  // The implicit-min sugar is gated on *syntax* (range omitted its
  // min) rather than on merged state, so a future sugar that also
  // writes to c.min can't accidentally trigger the implicit.
  let openLeftRange = range && range.min === undefined;
  if (range) {
    if (range.min !== undefined) c.min = range.min;
    if (range.max !== undefined) c.max = range.max;
    // Open-min shorthand (`..N`) with a `!` modifier implies min=1 —
    // "required and non-empty" is the default reading for required
    // varchar-like fields. Gated on openLeftRange syntactically so
    // adding more sugar layers later doesn't trigger this by accident.
    if (openLeftRange && c.min === undefined && fieldEntry?.modifiers?.includes('!')) {
      c.min = 1;
    }
  }
  if (regex) {
    c.regex = regex;
  }
  // File-level `schema.defaultMaxString` pragma fills in max only when
  // the field didn't narrow the max any other way — parseFieldedLine
  // suppresses defaultMax on regex / literal-union fields already, so
  // this last check covers the open-ended `N..` case (min set, max
  // still unbounded) where the pragma should fill the gap.
  if (fieldEntry?.defaultMax != null && c.max === undefined) {
    c.max = fieldEntry.defaultMax;
  }
  // Post-merge consistency check. Sugar (`!` implicit min=1) and the
  // pragma default max can compose with a user-written explicit max to
  // produce min > max — e.g. `name! ..0` would naively emit
  // `{min: 1, max: 0}`, a constraint no value can satisfy. The
  // parse-time reversed-range check only sees syntactically-present
  // endpoints, so we re-validate here after every sugar has been
  // applied. Error message names the actual sources so the user can
  // pinpoint which side to fix.
  if (c.min !== undefined && c.max !== undefined && c.min > c.max) {
    let minSrc = (range && range.min !== undefined) ? `range min ${range.min}` : 'implicit min=1 from `!`';
    let maxSrc = (range && range.max !== undefined)
      ? `range max ${range.max}`
      : `pragma defaultMaxString=${fieldEntry?.defaultMax}`;
    throw schemaError({ loc: fieldEntry?.loc },
      `Field '${fieldEntry?.name}' would have impossible constraints min=${c.min} > max=${c.max} after sugar is applied (${minSrc} vs ${maxSrc}). Write an explicit range or drop the conflicting pragma.`);
  }
  if (c.min === undefined && c.max === undefined && c.default === undefined && c.regex === undefined) {
    return null;
  }
  return constraintLiteral(c);
}

function constraintLiteral(c) {
  let parts = [];
  if (c.min !== undefined) parts.push(`min: ${serializeLiteral(c.min)}`);
  if (c.max !== undefined) parts.push(`max: ${serializeLiteral(c.max)}`);
  if (c.default !== undefined) parts.push(`default: ${serializeLiteral(c.default)}`);
  if (c.regex !== undefined) parts.push(`regex: ${c.regex.toString()}`);
  return parts.length ? `{${parts.join(', ')}}` : null;
}

function serializeLiteral(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof RegExp) return v.toString();
  return JSON.stringify(v);
}

// Compile directive args to a JS literal list or null. Each directive has
// its own arg shape — we centralize the parsing here so Layer 2 can rely
// on normalized structures.
function compileDirectiveArgsLiteral(name, tokens) {
  // @idStart requires its arg, so validate before the generic empty-bail.
  if (name === 'idStart' && !tokens.length) {
    throw schemaError(null,
      '@idStart requires an integer literal, e.g. @idStart 10001.');
  }
  if (!tokens.length) return null;

  // Relation directives: `@belongs_to Org`, `@belongs_to Org?`,
  // `@has_many Order`, `@has_one Profile`, `@one X`, `@many X`.
  if (name === 'belongs_to' || name === 'has_many' || name === 'has_one' ||
      name === 'one' || name === 'many' || name === 'mixin') {
    let t0 = tokens[0];
    if (!t0 || (t0[0] !== 'IDENTIFIER' && t0[0] !== 'PROPERTY')) {
      throw schemaError(t0 || tokens[tokens.length - 1],
        `@${name} requires a target name.`);
    }
    let target = t0[1];
    // `@belongs_to User?` tokenizes as IDENTIFIER "User" with
    // data.predicate=true. A trailing `?` in a later token position is
    // also accepted for robustness.
    let optional = t0.data?.predicate === true;
    let pos = 1;
    if (!optional && tokens[pos]?.[0] === '?') { optional = true; pos++; }
    let parts = [`target: ${JSON.stringify(target)}`];
    if (optional) parts.push('optional: true');
    return `[{${parts.join(', ')}}]`;
  }

  // `@index field` or `@index [a, b]` or `@index [a, b] #` for unique.
  if (name === 'index') {
    let fields = [];
    let unique = false;
    let pos = 0;
    if (tokens[pos]?.[0] === 'IDENTIFIER' || tokens[pos]?.[0] === 'PROPERTY') {
      fields.push(tokens[pos][1]);
      pos++;
    } else if (tokens[pos]?.[0] === '[' || tokens[pos]?.[0] === 'INDEX_START') {
      let inner = [];
      let depth = 1;
      pos++;
      while (pos < tokens.length && depth > 0) {
        let t = tokens[pos];
        if (t[0] === '[' || t[0] === 'INDEX_START') depth++;
        if (t[0] === ']' || t[0] === 'INDEX_END') {
          depth--;
          if (depth === 0) { pos++; break; }
        }
        inner.push(t);
        pos++;
      }
      for (let part of splitTopLevelByComma(inner)) {
        if (part[0] && (part[0][0] === 'IDENTIFIER' || part[0][0] === 'PROPERTY')) {
          fields.push(part[0][1]);
        }
      }
    }
    if (tokens[pos]?.[0] === '#') unique = true;
    let parts = [`fields: ${JSON.stringify(fields)}`];
    if (unique) parts.push('unique: true');
    return `[{${parts.join(', ')}}]`;
  }

  // @idStart N sets the seed value for the table's auto-id sequence.
  // Accepts a single integer literal (optionally negative). Consumed by
  // .toSQL(); models that never call .toSQL() simply ignore it.
  if (name === 'idStart') {
    let tok = tokens[0];
    let sign = 1;
    let numTok = tok;
    if (tok && tok[0] === '-' && tokens[1] && tokens[1][0] === 'NUMBER') {
      sign = -1;
      numTok = tokens[1];
    }
    if (!numTok || numTok[0] !== 'NUMBER') {
      throw schemaError(tok || tokens[tokens.length - 1],
        '@idStart requires an integer literal, e.g. @idStart 10001.');
    }
    let n = sign * Number(numTok[1]);
    if (!Number.isInteger(n)) {
      throw schemaError(numTok,
        '@idStart requires an integer literal; got ' + numTok[1] + '.');
    }
    return '[{value: ' + n + '}]';
  }

  // Bare flag-like directives (@timestamps, @softDelete) don't take args.
  // Anything else — capture as raw literal tokens conservatively.
  return null;
}

// Evaluate a small expression as a literal. Accepts NUMBER, STRING, BOOL,
// NULL, UNDEFINED, REGEX, SYMBOL (returns its name string — for enum-member
// defaults like `[:draft]`), and unary minus on NUMBER. Anything else throws.
function evalLiteralTokens(tokens, fieldEntry) {
  if (!tokens.length) {
    throw schemaError(null, 'Empty constraint value.');
  }
  let first = tokens[0];
  let tag = first[0];
  if (tokens.length === 1) {
    if (tag === 'NUMBER') return Number(first[1]);
    if (tag === 'STRING') return JSON.parse(first[1]);
    if (tag === 'BOOL') return first[1] === 'true';
    if (tag === 'NULL') return null;
    if (tag === 'UNDEFINED') return undefined;
    if (tag === 'REGEX') return parseRegexLiteral(first[1]);
    if (tag === 'SYMBOL') return first[1];
  }
  if (tokens.length === 2 && tag === '-' && tokens[1][0] === 'NUMBER') {
    return -Number(tokens[1][1]);
  }
  // Deterministic but not literal — IDENTIFIER references aren't supported.
  throw schemaError(first,
    `Constraint values must be literals (number, string, boolean, null, regex, :symbol). Got ${tag}.`);
}

function parseRegexLiteral(val) {
  let s = typeof val === 'string' ? val : String(val);
  let m = s.match(/^\/(.*)\/([gimsuy]*)$/s);
  return m ? new RegExp(m[1], m[2]) : new RegExp(s);
}

// Run the tail rewriter passes on a captured body token slice, then feed
// the result through parser.parse() via a temporary lex adapter. The
// returned s-expression is the parsed body — either a single statement or
// a block of statements — ready to wrap in `['->', [], body]`.
function parseBodyTokens(bodyTokens) {
  if (!bodyTokens || !bodyTokens.length) return null;

  // The body tokens were captured by rewriteSchema BEFORE rewriteTypes,
  // tagPostfixConditionals, rewriteTaggedTemplates, addImplicitBracesAndParens,
  // and addImplicitCallCommas ran. Run those tail passes on a sub-lexer
  // whose `this.tokens` is the body slice.
  let LexerCtor = parseBodyTokens._LexerCtor;
  if (!LexerCtor) {
    throw new Error('schema: parseBodyTokens called before Lexer was wired');
  }
  let sub = Object.create(LexerCtor.prototype);
  let toks = bodyTokens.slice();
  // Multi-line callable bodies open with a matched INDENT ... OUTDENT pair
  // wrapping the statements. parser.parse() expects a Body (list of Lines),
  // not a leading INDENT, so strip the outer pair when the first INDENT's
  // matching OUTDENT is the last token.
  if (toks.length >= 2 && toks[0]?.[0] === 'INDENT') {
    let depth = 0;
    let lastOutdent = -1;
    for (let k = 0; k < toks.length; k++) {
      if (toks[k][0] === 'INDENT') depth++;
      else if (toks[k][0] === 'OUTDENT') {
        depth--;
        if (depth === 0) { lastOutdent = k; break; }
      }
    }
    if (lastOutdent === toks.length - 1) {
      toks = toks.slice(1, -1);
    }
  }
  sub.tokens = toks;
  sub.seenFor = sub.seenImport = sub.seenExport = false;
  sub.ends = [];
  sub.indent = 0;
  sub.outdebt = 0;
  sub.indents = [];
  // Ensure a terminating TERMINATOR so parser.parse() sees a clean EOF.
  let lastTag = sub.tokens[sub.tokens.length - 1]?.[0];
  if (lastTag !== 'TERMINATOR') {
    sub.tokens.push(mkToken('TERMINATOR', '\n', bodyTokens[bodyTokens.length - 1]));
  }
  try {
    sub.rewriteTypes?.();
    sub.tagPostfixConditionals?.();
    sub.rewriteTaggedTemplates?.();
    sub.addImplicitBracesAndParens?.();
    sub.addImplicitCallCommas?.();
  } catch (e) {
    // If a tail pass throws, surface a clean schema error.
    throw schemaError(bodyTokens[0], `schema: failed to compile body: ${e.message}`);
  }
  let tokens = sub.tokens.filter(t => t[0] !== 'TYPE_DECL');

  // Swap parser.lexer, parse, restore.
  let savedLexer = parser.lexer;
  parser.lexer = {
    tokens, pos: 0,
    setInput() {},
    lex() {
      if (this.pos >= this.tokens.length) return 1;
      let token = this.tokens[this.pos++];
      let val = token[1];
      if (token.data) {
        val = new String(val);
        Object.assign(val, token.data);
      }
      this.text = val;
      this.loc = token.loc;
      this.line = token.loc?.r;
      return token[0];
    },
  };
  let sexpr;
  try {
    sexpr = parser.parse('');
  } finally {
    parser.lexer = savedLexer;
  }

  // sexpr is `['program', ...statements]`. Unwrap to a body we can feed
  // a thin-arrow AST. One statement → the statement itself. Multiple →
  // ['block', ...].
  if (!Array.isArray(sexpr) || sexpr[0] !== 'program') return null;
  let stmts = sexpr.slice(1);
  if (stmts.length === 0) return null;
  if (stmts.length === 1) return stmts[0];
  return ['block', ...stmts];
}

// ============================================================================
// Helpers
// ============================================================================

function collectModifiers(identToken) {
  let mods = [];
  let d = identToken.data;
  if (d?.await === true) mods.push('!');
  if (d?.predicate === true) mods.push('?');
  return mods;
}

function findMatchingOutdent(tokens, indentIdx) {
  let depth = 0;
  for (let j = indentIdx; j < tokens.length; j++) {
    if (tokens[j][0] === 'INDENT') depth++;
    else if (tokens[j][0] === 'OUTDENT') {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

function splitTopLevelByComma(tokens) {
  let parts = [];
  let cur = [];
  let depth = 0;
  for (let t of tokens) {
    let tag = t[0];
    if (tag === '(' || tag === '[' || tag === '{' ||
        tag === 'CALL_START' || tag === 'INDEX_START' ||
        tag === 'PARAM_START' || tag === 'INDENT') depth++;
    if (tag === ')' || tag === ']' || tag === '}' ||
        tag === 'CALL_END' || tag === 'INDEX_END' ||
        tag === 'PARAM_END' || tag === 'OUTDENT') depth--;
    if (tag === ',' && depth === 0) {
      if (cur.length) parts.push(cur);
      cur = [];
      continue;
    }
    cur.push(t);
  }
  if (cur.length) parts.push(cur);
  return parts;
}

function literalOf(tok) {
  let tag = tok[0], val = tok[1];
  if (tag === 'NUMBER') return Number(val);
  if (tag === 'STRING') return JSON.parse(val);
  if (tag === 'BOOL') return val === 'true';
  if (tag === 'NULL') return null;
  if (tag === 'UNDEFINED') return undefined;
  return val;
}

function mkToken(tag, value, origin) {
  let t = [tag, value];
  t.pre = 0;
  t.data = null;
  t.loc = origin?.loc ?? { r: 0, c: 0, n: 0 };
  t.spaced = false;
  t.newLine = false;
  t.generated = true;
  if (origin) t.origin = origin;
  return t;
}

function schemaError(tok, message) {
  let loc = tok?.loc || { r: 0, c: 0 };
  let err = new Error(message);
  err.name = 'SchemaSyntaxError';
  err.loc = loc;
  err.line = loc.r;
  err.column = loc.c;
  err.phase = 'schema';
  err.code = 'E_SCHEMA';
  return err;
}

// ============================================================================
// Runtime — injected into compiled output when the source uses `schema`
// ============================================================================
//
// Four-layer architecture (D22):
//   Layer 1 — Descriptor: the object passed to `__schema({...})`. Raw
//             metadata from compiler, plus real functions for callables.
//   Layer 2 — Normalized: fields map / methods map / computed map / hooks
//             map / directives / enum members. Built lazily on first
//             downstream need. Collision and kind-legality checks live
//             here (Phase 4 tightens them).
//   Layer 3 — Validator plan: compiled validator tree. Built on first
//             `.parse` / `.safe` / `.ok`.
//   Layer 4 — ORM plan (Phase 4) and DDL plan (Phase 4) — not in Phase 3.
//
// Public API per kind (v1):
//   .parse(data)  throws SchemaError on failure, returns value
//   .safe(data)   {ok: true, value, errors: null} | {ok: false, value: null, errors: [...]}
//   .ok(data)     boolean, fast path (no allocation)
//
// Result `value` shape:
//   :shape   — generated class instance (fields enumerable own props,
//              methods non-enumerable prototype fns, computed non-enumerable
//              prototype getters)
//   :input   — plain object (same class-instance plumbing; Phase 3 treats
//              :input like :shape sans methods for consistency)
//   :enum    — the member value (or name when the enum is bare)
//   :mixin   — non-instantiable; raises `Cannot parse :mixin`
//   :model   — Phase 4 (the class additionally wires ORM methods)

// =============================================================================
// Runtime composition (delegated to registered provider)
// =============================================================================
// Mode matrix:
//
//   validate   = VALIDATE                                (pure)
//   browser    = VALIDATE + BROWSER_STUBS                (browser bundle)
//   server     = VALIDATE + DB_NAMING + ORM              (server runtime)
//   migration  = VALIDATE + DB_NAMING + ORM + DDL        (migration tool)
//
// The actual fragment imports + composition live in the loader files so
// only the fragments needed by a given entry are bundled. Browser bundles
// import loader-browser.js (validate + browser-stubs only); CLI / server
// imports loader-server.js (all five fragments).

export function getSchemaRuntime(opts = {}) {
  if (!_schemaRuntimeProvider) {
    throw new Error(
      "schema runtime provider not registered. Side-effect-import either " +
      "'./schema/loader-server.js' (CLI / server / tests) or " +
      "'./schema/loader-browser.js' (browser bundle) before calling " +
      "any compileToJS that emits schemas."
    );
  }
  return _schemaRuntimeProvider(opts);
}
