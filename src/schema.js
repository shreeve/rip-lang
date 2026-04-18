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

function rewriteSchema(lexer) {
  let tokens = lexer.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (!isSchemaStart(tokens, i)) continue;
    collapseSchemaAt(lexer, tokens, i);
  }
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
  // What follows: optional SYMBOL (kind), optional TERMINATOR, then INDENT.
  let j = i + 1;
  if (tokens[j]?.[0] === 'SYMBOL') j++;
  if (tokens[j]?.[0] === 'TERMINATOR') j++;
  return tokens[j]?.[0] === 'INDENT';
}

// Collapse `IDENTIFIER 'schema' [SYMBOL kind] [TERMINATOR] INDENT ... OUTDENT`
// at position i into `SCHEMA SCHEMA_BODY`. SCHEMA_BODY carries a structured
// descriptor on .data.
function collapseSchemaAt(lexer, tokens, i) {
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

  let bodyTokens = tokens.slice(indentIdx + 1, outdentIdx);
  let descriptor = parseSchemaBody(kind, bodyTokens, {
    schemaLoc: schemaTok.loc,
    kindLoc: kindToken?.loc ?? null,
    kind,
  });

  // Replace range `[i, outdentIdx]` with `SCHEMA SCHEMA_BODY`.
  let schemaNewTok = mkToken('SCHEMA', 'schema', schemaTok);
  let bodyNewTok = mkToken('SCHEMA_BODY', kind, schemaTok);
  bodyNewTok.data = { descriptor };
  tokens.splice(i, outdentIdx - i + 1, schemaNewTok, bodyNewTok);
}

// ============================================================================
// Sub-parser — fielded and enum modes
// ============================================================================

function parseSchemaBody(kind, bodyTokens, ctx) {
  let entries = [];
  let lines = splitBodyLines(bodyTokens);

  if (kind === 'enum') {
    for (let line of lines) {
      parseEnumLine(line, entries);
    }
  } else {
    for (let line of lines) {
      parseFieldedLine(kind, line, entries);
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
function parseFieldedLine(kind, line, entries) {
  let first = line[0];
  if (!first) return;

  // Directive: @NAME [args]
  if (first[0] === '@') {
    let nameTok = line[1];
    if (!nameTok || (nameTok[0] !== 'IDENTIFIER' && nameTok[0] !== 'PROPERTY')) {
      throw schemaError(first, "Expected directive name after '@'.");
    }
    entries.push({
      tag: 'directive',
      name: nameTok[1],
      argTokens: line.slice(2),
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
  if (!typeFirst) {
    throw schemaError(first, `Schema field '${name}' is missing a type.`);
  }
  if (typeFirst[0] === ':') {
    throw schemaError(typeFirst,
      `Schema fields use 'name type' (space, no colon). Got 'name:'. For methods/computed use 'name: -> body' or 'name: ~> body'.`);
  }

  // Type: IDENTIFIER, optionally followed by `[]` for array.
  if (typeFirst[0] !== 'IDENTIFIER') {
    throw schemaError(typeFirst,
      `Expected type name for schema field '${name}'. Got ${typeFirst[0]}.`);
  }
  let typeName = typeFirst[1];
  pos++;
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

  // Remaining tokens on the line are `[, constraints] [, attrs]`.
  // For Phase 1 we capture raw token slices and defer semantic parsing.
  let rest = line.slice(pos);
  let constraintTokens = null;
  let attrsTokens = null;

  if (rest.length > 0) {
    if (rest[0]?.[0] !== ',') {
      throw schemaError(rest[0],
        `Expected ',' between type and constraints for field '${name}'.`);
    }
    // Split top-level by commas.
    let parts = splitTopLevelByComma(rest.slice(1));
    for (let part of parts) {
      if (!part.length) continue;
      let head = part[0];
      if (head[0] === '[' || head[0] === 'INDEX_START') {
        constraintTokens = part;
      } else if (head[0] === '{') {
        attrsTokens = part;
      } else {
        throw schemaError(head,
          `Unexpected trailer for field '${name}'. Expected '[...]' constraints or '{...}' attrs.`);
      }
    }
  }

  entries.push({
    tag: 'field',
    name,
    modifiers,
    typeName,
    array,
    constraintTokens,
    attrsTokens,
    loc: first.loc,
  });
}

function parseCallableLine(kind, headerTok, line, entries) {
  let name = headerTok[1];
  let colonTok = line[1];
  if (!colonTok || colonTok[0] !== ':') {
    throw schemaError(headerTok,
      `Expected ':' after '${name}' before arrow.`);
  }
  let arrowTok = line[2];
  if (!arrowTok || (arrowTok[0] !== '->' && arrowTok[0] !== 'EFFECT')) {
    throw schemaError(colonTok,
      `Schema top-level '${name}:' must be followed by '->' (method/hook) or '~>' (computed getter).`);
  }
  let arrow = arrowTok[0] === 'EFFECT' ? '~>' : '->';
  let bodyTokens = line.slice(3);
  let isHook = HOOK_NAMES.has(name);
  let entryTag;
  if (arrow === '~>') {
    entryTag = 'computed';
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
    arrowLoc: arrowTok.loc,
  });
}

function parseEnumLine(line, entries) {
  let first = line[0];
  if (!first) return;
  // `admin` lines tokenize as IDENTIFIER; `pending: 0` tokenizes as
  // PROPERTY ':' Literal because the identifier regex absorbs a trailing
  // colon.
  if (first[0] !== 'IDENTIFIER' && first[0] !== 'PROPERTY') {
    throw schemaError(first,
      `Enum member must be an identifier, got ${first[0]}.`);
  }
  let name = first[1];
  let second = line[1];
  if (!second) {
    entries.push({ tag: 'enum-member', name, value: undefined, loc: first.loc });
    return;
  }
  if (second[0] !== ':') {
    throw schemaError(second,
      `Enum member '${name}' — expected ':' before value.`);
  }
  let valTok = line[2];
  if (!valTok) {
    throw schemaError(second,
      `Enum member '${name}' has no value after ':'.`);
  }
  if (line.length > 3) {
    throw schemaError(line[3],
      `Extra tokens after enum member '${name}' value.`);
  }
  entries.push({
    tag: 'enum-member',
    name,
    value: literalOf(valTok),
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
      return `{${obj.join(', ')}}`;
    }
    case 'directive': {
      let obj = [`tag: "directive"`, `name: ${JSON.stringify(e.name)}`];
      if (e.argTokens && e.argTokens.length) {
        let argsCode = compileDirectiveArgs(emitter, e.argTokens);
        if (argsCode) obj.push(`args: ${argsCode}`);
      }
      return `{${obj.join(', ')}}`;
    }
    case 'computed':
    case 'method':
    case 'hook': {
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

// Placeholder for future directive-arg compilation. Phase 4 populates this.
function compileDirectiveArgs(emitter, argTokens) {
  return null;
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

const SCHEMA_RUNTIME = `
// ---- Rip Schema Runtime ----------------------------------------------------

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
  text:     v => typeof v === 'string',
  json:     v => v !== undefined,
  any:      ()  => true,
};

function __schemaCheckValue(v, typeName) {
  const check = __schemaTypes[typeName];
  return check ? check(v) : true;
}

class __SchemaDef {
  constructor(desc) {
    this._desc = desc;
    this.kind = desc.kind;
    this.name = desc.name || null;
    this._norm = null;
    this._klass = null;
  }

  _normalize() {
    if (this._norm) return this._norm;
    const fields = new Map();
    const methods = new Map();
    const computed = new Map();
    const hooks = new Map();
    const directives = [];
    const enumMembers = new Map();
    const reserved = new Set(['parse', 'safe', 'ok']);

    const note = (name, loc) => {
      const where = [];
      if (fields.has(name)) where.push('field');
      if (methods.has(name)) where.push('method');
      if (computed.has(name)) where.push('computed');
      if (hooks.has(name)) where.push('hook');
      if (enumMembers.has(name)) where.push('enum-member');
      if (reserved.has(name)) where.push('reserved');
      return where;
    };

    for (const e of this._desc.entries) {
      switch (e.tag) {
        case 'field': {
          const where = note(e.name);
          if (where.length) throw new SchemaError([{field: e.name, error: 'collision', message: e.name + ' collides with ' + where.join(', ')}], this.name, this.kind);
          fields.set(e.name, {
            name: e.name,
            required: e.modifiers.includes('!'),
            unique: e.modifiers.includes('#'),
            optional: e.modifiers.includes('?'),
            typeName: e.typeName,
            array: e.array === true,
          });
          break;
        }
        case 'method': {
          const where = note(e.name);
          if (where.length) throw new SchemaError([{field: e.name, error: 'collision', message: e.name + ' collides with ' + where.join(', ')}], this.name, this.kind);
          methods.set(e.name, e.fn);
          break;
        }
        case 'computed': {
          const where = note(e.name);
          if (where.length) throw new SchemaError([{field: e.name, error: 'collision', message: e.name + ' collides with ' + where.join(', ')}], this.name, this.kind);
          computed.set(e.name, e.fn);
          break;
        }
        case 'hook': {
          if (hooks.has(e.name)) throw new SchemaError([{field: e.name, error: 'collision', message: 'duplicate hook: ' + e.name}], this.name, this.kind);
          hooks.set(e.name, e.fn);
          break;
        }
        case 'directive':
          directives.push({name: e.name, args: e.args || []});
          break;
        case 'enum-member':
          enumMembers.set(e.name, e.value !== undefined ? e.value : e.name);
          break;
      }
    }
    return (this._norm = { fields, methods, computed, hooks, directives, enumMembers });
  }

  _getClass() {
    if (this._klass) return this._klass;
    const name = this.name || 'Schema';
    const klass = ({[name]: class {
      constructor(data) {
        if (data && typeof data === 'object') {
          for (const k of Object.keys(data)) this[k] = data[k];
        }
      }
    }})[name];
    const norm = this._normalize();
    for (const [n, fn] of norm.methods) {
      Object.defineProperty(klass.prototype, n, {value: fn, writable: true, enumerable: false, configurable: true});
    }
    for (const [n, fn] of norm.computed) {
      Object.defineProperty(klass.prototype, n, {get: fn, enumerable: false, configurable: true});
    }
    return (this._klass = klass);
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
        for (let i = 0; i < v.length; i++) {
          if (!__schemaCheckValue(v[i], f.typeName)) {
            if (!collect) return false;
            errors.push({field: n, error: 'type', message: n + '[' + i + '] must be ' + f.typeName});
          }
        }
      } else if (!__schemaCheckValue(v, f.typeName)) {
        if (!collect) return false;
        errors.push({field: n, error: 'type', message: n + ' must be ' + f.typeName});
      }
    }
    return collect ? errors : true;
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

  parse(data) {
    if (this.kind === 'mixin') {
      throw new Error(":mixin schema '" + (this.name || 'anon') + "' is not instantiable");
    }
    if (this.kind === 'enum') {
      const errs = this._validateEnum(data, true);
      if (errs.length) throw new SchemaError(errs, this.name, this.kind);
      return this._materializeEnum(data);
    }
    const errs = this._validateFields(data, true);
    if (errs.length) throw new SchemaError(errs, this.name, this.kind);
    const klass = this._getClass();
    return new klass(data);
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
    const errs = this._validateFields(data, true);
    if (errs.length) return {ok: false, value: null, errors: errs};
    const klass = this._getClass();
    return {ok: true, value: new klass(data), errors: null};
  }

  ok(data) {
    if (this.kind === 'mixin') return false;
    if (this.kind === 'enum') return this._validateEnum(data, false);
    return this._validateFields(data, false);
  }
}

function __schema(descriptor) { return new __SchemaDef(descriptor); }

if (typeof globalThis !== 'undefined') {
  globalThis.__ripSchema = { __schema, SchemaError };
}

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
