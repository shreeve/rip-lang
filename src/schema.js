import { parser } from './parser.js';

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
      return getSchemaRuntime();
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

// Schema runtime ABI version. Bump when the shape of a __schema({...})
// descriptor or any cross-bundle-visible runtime surface changes
// incompatibly. Two bundles that disagree on this number can't share
// one runtime, so a mismatch at load time throws rather than silently
// fragmenting. Tracks runtime contract — not the rip-lang product
// semver.
const SCHEMA_RUNTIME_ABI_VERSION = 1;

const SCHEMA_RUNTIME = `
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
    if (globalThis.__ripSchema.__version !== ${SCHEMA_RUNTIME_ABI_VERSION}) {
      throw new Error(
        "rip-schema runtime version mismatch: loaded runtime is v" +
        globalThis.__ripSchema.__version +
        ", but this bundle expects v" + ${SCHEMA_RUNTIME_ABI_VERSION} +
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
    __version: ${SCHEMA_RUNTIME_ABI_VERSION},
  };
  if (typeof globalThis !== 'undefined') globalThis.__ripSchema = exports;
  return exports;
})();

// === End Schema Runtime ===
`;

function getSchemaRuntime() {
  return SCHEMA_RUNTIME.trimStart();
}


// Eagerly install the runtime on globalThis at module load so downstream
// compilation units emitted with `skipRuntimes: true` (a common test-harness
// setting) can pick up `{__schema, SchemaError}` without a separate bootstrap
// step. The same pattern is used by the reactive and component runtimes.
if (typeof globalThis !== 'undefined' && !globalThis.__ripSchema) {
  try { (0, eval)(SCHEMA_RUNTIME); } catch {}
}

export { SCHEMA_RUNTIME };
