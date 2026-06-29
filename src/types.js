// Type System — token-stream type stripping (browser-safe half).
//
// This module exists for one purpose: install rewriteTypes() on the lexer
// so user-typed Rip source parses cleanly. Type annotations are stored as
// token metadata and the parser never sees them, so all of this code only
// runs when source contains `::` annotations or `type` / `interface` /
// `enum` declarations.
//
// The .d.ts emission half (emitTypes, intrinsic decl tables, component-
// type emitter) lives in src/dts.js, which is reachable only from
// CLI entry points and typecheck.js. Runtime enum codegen lives in
// compiler.js (CodeEmitter.prototype.emitEnum) — that's real codegen,
// not type machinery.

import { RipError } from './error.js';

// ============================================================================
// `expr as Type` cast — recognition sets
// ============================================================================
//
// The cast is a contextual postfix operator: a bare `as` (already an
// IDENTIFIER here — the lexer emits AS / FORAS / FORASAWAIT for the
// import/export and for-loop cases, so an `as` that survives as an
// IDENTIFIER is never one of those) glued to a value on its left and a type
// on its right. We recognize it purely from token shape: the previous token
// must be able to END an expression, and the next must be able to START a
// type. Detection runs in rewriteTypes(), BEFORE addImplicitBracesAndParens(),
// so `x as Foo` is still three bare identifiers (not yet `x(as(Foo))`).

// Tokens whose token can be the tail of the cast's left-hand expression.
// CAST is included so chains (`x as A as B`) work: the first cast collapses
// to `<value> CAST`, and the second `as` sees CAST as its left edge.
const CAST_LHS_ENDERS = new Set([
  'IDENTIFIER', 'PROPERTY', 'NUMBER', 'STRING', 'STRING_END',
  'REGEX', 'REGEX_END', 'BOOL', 'NULL', 'UNDEFINED', 'INFINITY', 'NAN', 'JS',
  ')', 'CALL_END', 'PARAM_END', ']', 'INDEX_END', '}',
  'THIS', 'SUPER', '?', 'PRESENCE', 'CAST',
]);

// Tokens that can begin a type expression on the cast's right-hand side.
const CAST_TYPE_STARTERS = new Set([
  'IDENTIFIER', '(', 'CALL_START', 'PARAM_START', '{', '[', 'INDEX_START',
  'STRING', 'STRING_START', 'NUMBER', 'BOOL', 'NULL', 'UNDEFINED', '-', 'UNARY',
]);

// Does the `as` token at index i look like a cast (vs. a stray identifier)?
function isCastAs(tokens, i) {
  let prev = tokens[i - 1];
  if (!prev || prev[0] === '.' || prev[0] === '?.') return false;
  if (!CAST_LHS_ENDERS.has(prev[0])) return false;
  let next = tokens[i + 1];
  return !!next && CAST_TYPE_STARTERS.has(next[0]);
}

// ============================================================================
// installTypeSupport — adds rewriteTypes() to Lexer.prototype
// ============================================================================

export function installTypeSupport(Lexer) {
  let proto = Lexer.prototype;

  // ──────────────────────────────────────────────────────────────────────────
  // rewriteTypes() — strip type annotations, collect type declarations
  // ──────────────────────────────────────────────────────────────────────────
  //
  // Scans the token stream for:
  //   :: (TYPE_ANNOTATION) — collects type string, stores on surviving token
  //   type Name = (contextual keyword) — collects type body, replaces with TYPE_DECL marker
  //   INTERFACE — collects body, replaces with TYPE_DECL marker
  //   DEF IDENTIFIER<...> — collects generic params via .spaced detection
  //
  // After this pass, the token stream is type-free (except ENUM tokens and
  // TYPE_DECL markers that emitTypes() reads before they're filtered out).

  proto.rewriteTypes = function() {
    let tokens = this.tokens;
    let typeRefNames = this.typeRefNames = new Set();

    // Rip 3.17 — single-colon type annotations. A `:` in a type-annotation
    // slot (function params, return types, statement-level typed declarations)
    // is reclassified to TYPE_ANNOTATION so it flows through the same machinery
    // as the explicit `::`. Object properties, ternary branches, and nested
    // colons are deliberately left untouched. Runs before the main type scan.
    reclassifyColonTypes(tokens);

    let gen = (tag, val, origin) => {
      let t = [tag, val];
      t.pre = 0;
      t.data = null;
      t.loc = origin?.loc ?? {r: 0, c: 0, n: 0};
      t.spaced = false;
      t.newLine = false;
      t.generated = true;
      if (origin) t.origin = origin;
      return t;
    };

    this.scanTokens((token, i, tokens) => {
      let tag = token[0];

      // ── `expr as Type` cast — postfix type assertion (route A) ──────────
      // A bare `as` glued to a value on its left and a type on its right. The
      // Type RHS is collected as a string (the same machinery as `::`
      // annotations) and the whole `as Type` run COLLAPSES into a single
      // in-stream CAST marker token carrying that string as its value. The
      // grammar reduces `Expression CAST` to `['cast', expr, typeStr]` — so
      // the parser sees a structural postfix node (like `?`/`!`) but never a
      // type. The compiler erases it at runtime and re-materializes it as a
      // real TS `(expr as Type)` only in the shadow-TS check path. Because the
      // marker is a real token, the reduction fires AFTER the full postfix
      // expression is built, so call/index/paren results narrow too.
      // Chaining (`x as A as B`) emits one CAST per `as` (`x CAST CAST`); the
      // grammar's left-associativity nests them: `['cast',['cast',x,'A'],'B']`.
      if (tag === 'IDENTIFIER' && token[1] === 'as' && !token.data?.bang &&
          isCastAs(tokens, i)) {
        let typeTokens = collectTypeExpression(tokens, i + 1, { castContext: true });
        if (typeTokens.length > 0) {
          let typeStr = buildTypeString(typeTokens);
          for (let tt of typeTokens) {
            if (tt[0] === 'IDENTIFIER') typeRefNames.add(tt[1]);
          }
          let castTok = gen('CAST', typeStr, token);
          tokens.splice(i, 1 + typeTokens.consumed, castTok);
          // A trailing `>` (or other "unfinished" tail) makes the lexer
          // suppress the newline after the type, so once the `as Type` run is
          // collapsed the statement can collide with the next line. If what now
          // follows the marker sits on a later row and isn't already a
          // separator, restore the TERMINATOR the lexer ate.
          let follow = tokens[i + 1];
          if (follow && follow[0] !== 'TERMINATOR' && follow[0] !== 'INDENT' &&
              follow[0] !== 'CAST' &&
              follow.loc?.r != null && castTok.loc?.r != null &&
              follow.loc.r > castTok.loc.r) {
            tokens.splice(i + 1, 0, gen('TERMINATOR', '\n', follow));
          }
          return 1; // advance past the CAST marker (a chained `as` follows it)
        }
      }

      // ── Generic type parameters: DEF name<T>(...) or Name<T> = component ──
      // (Generic params on type aliases are handled by the `type` keyword handler below)
      if (tag === 'IDENTIFIER') {
        let next = tokens[i + 1];
        if (next && next[0] === 'COMPARE' && next[1] === '<' && !next.spaced) {
          let isDef = tokens[i - 1]?.[0] === 'DEF';
          let genTokens = collectBalancedAngles(tokens, i + 1);
          if (genTokens) {
            // Check for component pattern: Name<T> = component
            let afterAngles = i + 1 + genTokens.length;
            let isComponent = !isDef && tokens[afterAngles]?.[0] === '=' &&
                              tokens[afterAngles + 1]?.[0] === 'COMPONENT';
            if (isDef || isComponent) {
              if (!token.data) token.data = {};
              token.data.typeParams = buildTypeString(genTokens);
              tokens.splice(i + 1, genTokens.length);
              // After removing <T>, retag ( as CALL_START if it follows DEF IDENTIFIER
              if (isDef && tokens[i + 1]?.[0] === '(') {
                tokens[i + 1][0] = 'CALL_START';
                // Find matching ) and retag as CALL_END
                let d = 1, m = i + 2;
                while (m < tokens.length && d > 0) {
                  if (tokens[m][0] === '(' || tokens[m][0] === 'CALL_START') d++;
                  if (tokens[m][0] === ')' || tokens[m][0] === 'CALL_END') d--;
                  if (d === 0) tokens[m][0] = 'CALL_END';
                  m++;
                }
              }
            }
          }
        }
      }

      // ── TYPE_ANNOTATION (::) — collect type, store on token ─────────────
      if (tag === 'TYPE_ANNOTATION') {
        let prevToken = tokens[i - 1];
        if (!prevToken) return 1;

        // An arrow return type — `(params):: T -> body` / `(params):: T => body`
        // — is uniquely flagged by a preceding `PARAM_END` (arrow param close).
        // There the trailing `=>` is the arrow OPERATOR, not a TS function-type
        // arrow, so the collector must stop at a depth-0 `=>` (it already stops
        // at `->`). Without the flag it would eat the `=>` and the body as a
        // function type, and the parser would never see the arrow.
        let isArrowReturn = prevToken[0] === 'PARAM_END';
        let typeTokens = collectTypeExpression(tokens, i + 1, { stopAtFatArrow: isArrowReturn });

        // Foot-gun guard: a function-TYPE return must be parenthesized as a
        // whole — `(x):: ((a: T) => R) => body`, not `(x):: (a: T) => R => body`.
        // Unwrapped, the collector stops at the inner `=>` and the return type
        // comes back as a bare parameter list `(a: T)` (a single `(…)` group
        // with a top-level `:` , or empty `()`), which is never a valid type.
        // Catch that exact shape and point at the fix rather than silently
        // re-associating the body.
        if (isArrowReturn && looksLikeBareFunctionType(typeTokens)) {
          let loc = tokens[i + 1]?.loc;
          throw new RipError('A function-type return on an arrow must be parenthesized', {
            code: 'E_SYNTAX',
            phase: 'lexer',
            line: loc?.r ?? null,
            column: loc?.c ?? null,
            length: loc?.n ?? 1,
            suggestion: 'wrap the whole function type in parens — ' +
              '`(x):: ((a: T) => R) => body`, not `(x):: (a: T) => R => body`',
          });
        }

        let typeStr = buildTypeString(typeTokens);

        // Find the token that survives into the s-expression
        let target = prevToken;
        let propName = 'type';

        if (prevToken[0] === 'CALL_END' || prevToken[0] === ')') {
          // Return type on DEF with parameters — scan backward to function name
          let d = 1, k = i - 2;
          while (k >= 0 && d > 0) {
            let kTag = tokens[k][0];
            if (kTag === 'CALL_END' || kTag === ')') d++;
            if (kTag === 'CALL_START' || kTag === '(') d--;
            k--;
          }
          if (k >= 0) target = tokens[k];
          propName = 'returnType';
        } else if (prevToken[0] === 'PARAM_END') {
          // Return type on arrow function — scan forward to -> token
          let arrowIdx = i + 1 + typeTokens.consumed;
          let arrowToken = tokens[arrowIdx];
          if (arrowToken && (arrowToken[0] === '->' || arrowToken[0] === '=>')) {
            target = arrowToken;
          }
          propName = 'returnType';
        } else if (prevToken[0] === 'IDENTIFIER' && i >= 2 &&
                   tokens[i - 2]?.[0] === 'DEF') {
          // Return type on parameterless function: def foo:: string
          propName = 'returnType';
        }

        if (!target.data) target.data = {};
        target.data[propName] = typeStr;

        // Track identifiers used in type annotations for import elision
        for (let tt of typeTokens) {
          if (tt[0] === 'IDENTIFIER') typeRefNames.add(tt[1]);
        }

        // Remove :: and type tokens from stream
        let removeCount = 1 + typeTokens.consumed;
        tokens.splice(i, removeCount);
        return 0;
      }

      // ── type Name = ... — contextual type keyword ──────────────────────
      if (tag === 'IDENTIFIER' && token[1] === 'type') {
        let prevTag = tokens[i - 1]?.[0];
        let atStatement = !prevTag || prevTag === 'TERMINATOR' || prevTag === 'INDENT' || prevTag === 'EXPORT';
        if (!atStatement) return 1;

        let nameIdx = i + 1;
        let nameToken = tokens[nameIdx];
        if (!nameToken || nameToken[0] !== 'IDENTIFIER') return 1;
        let name = nameToken[1];

        let exported = prevTag === 'EXPORT';
        let removeFrom = exported ? i - 1 : i;

        // Handle generic type parameters: type Name<T> = ...
        let eqIdx = nameIdx + 1;
        if (tokens[eqIdx]?.[0] === 'COMPARE' && tokens[eqIdx]?.[1] === '<' && !tokens[eqIdx].spaced) {
          let genTokens = collectBalancedAngles(tokens, eqIdx);
          if (genTokens) {
            if (!nameToken.data) nameToken.data = {};
            nameToken.data.typeParams = buildTypeString(genTokens);
            tokens.splice(eqIdx, genTokens.length);
          }
        }

        // Must have = after name (or after stripped generics)
        if (tokens[eqIdx]?.[0] !== '=') return 1;

        let makeDecl = (typeText) => {
          let dt = gen('TYPE_DECL', name, nameToken);
          dt.data = { name, typeText, exported };
          if (nameToken.data?.typeParams) dt.data.typeParams = nameToken.data.typeParams;
          return dt;
        };

        let afterEq = eqIdx + 1;
        let next = tokens[afterEq];

        // Track identifiers in the type body so type-only imports get elided.
        let trackBodyRefs = (start, end) => {
          for (let k = start; k <= end && k < tokens.length; k++) {
            if (tokens[k][0] === 'IDENTIFIER') typeRefNames.add(tokens[k][1]);
          }
        };

        // Block union: type Name = (TERMINATOR?) INDENT | "a" | "b" ... OUTDENT
        // Must check before structural — `=` suppresses TERMINATOR so INDENT follows directly
        if (next && (next[0] === 'TERMINATOR' || next[0] === 'INDENT')) {
          let result = collectBlockUnion(tokens, afterEq);
          if (result) {
            trackBodyRefs(afterEq, result.endIdx);
            tokens.splice(removeFrom, result.endIdx - removeFrom + 1, makeDecl(result.typeText));
            return 0;
          }
        }

        // Structural type: type Name = INDENT ... OUTDENT
        if (next && next[0] === 'INDENT') {
          let endIdx = findMatchingOutdent(tokens, afterEq);
          trackBodyRefs(afterEq, endIdx);
          tokens.splice(removeFrom, endIdx - removeFrom + 1, makeDecl(collectStructuralType(tokens, afterEq)));
          return 0;
        }

        // Simple alias: type Name = type-expression
        let typeTokens = collectTypeExpression(tokens, afterEq);
        trackBodyRefs(afterEq, afterEq + typeTokens.consumed - 1);
        tokens.splice(removeFrom, afterEq + typeTokens.consumed - removeFrom, makeDecl(buildTypeString(typeTokens)));
        return 0;
      }

      // ── INTERFACE — collect body, create TYPE_DECL marker ───────────────
      if (tag === 'INTERFACE') {
        let exported = i >= 1 && tokens[i - 1]?.[0] === 'EXPORT';
        let nameIdx = i + 1;
        let nameToken = tokens[nameIdx];
        if (!nameToken) return 1;
        let name = nameToken[1];

        let extendsName = null;
        let bodyIdx = nameIdx + 1;

        // Check for extends
        if (tokens[bodyIdx]?.[0] === 'EXTENDS') {
          extendsName = tokens[bodyIdx + 1]?.[1];
          bodyIdx = bodyIdx + 2;
        }

        // Collect body
        if (tokens[bodyIdx]?.[0] === 'INDENT') {
          let typeText = collectStructuralType(tokens, bodyIdx);
          let endIdx = findMatchingOutdent(tokens, bodyIdx);
          for (let k = bodyIdx; k <= endIdx && k < tokens.length; k++) {
            if (tokens[k][0] === 'IDENTIFIER') typeRefNames.add(tokens[k][1]);
          }
          if (extendsName) typeRefNames.add(extendsName);
          let declToken = gen('TYPE_DECL', name, nameToken);
          declToken.data = {
            name,
            kind: 'interface',
            extends: extendsName,
            typeText,
            exported
          };

          let removeFrom = exported ? i - 1 : i;
          let removeCount = endIdx - removeFrom + 1;
          tokens.splice(removeFrom, removeCount, declToken);
          return 0;
        }

        return 1;
      }

      return 1;
    });

    // ── Second pass: detect bodiless typed DEF (overload signatures) ──────
    // Pattern: DEF IDENTIFIER CALL_START ... CALL_END TERMINATOR (no INDENT body)
    // These are type-only overload declarations — remove from token stream
    // and emit as TYPE_DECL markers so emitTypes() can generate DTS lines.
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i][0] !== 'DEF') continue;
      let nameToken = tokens[i + 1];
      if (!nameToken || nameToken[0] !== 'IDENTIFIER') continue;

      // Find CALL_END
      let j = i + 2;
      if (tokens[j]?.[0] !== 'CALL_START') continue;
      let depth = 1;
      j++;
      while (j < tokens.length && depth > 0) {
        if (tokens[j][0] === 'CALL_START') depth++;
        if (tokens[j][0] === 'CALL_END') depth--;
        j++;
      }
      // j is now past CALL_END
      let callEndIdx = j - 1;

      // Bodiless = next is TERMINATOR or EOF (not INDENT)
      let next = tokens[j];
      if (next && next[0] !== 'TERMINATOR') continue;

      // Must have type annotations to qualify as an overload signature
      let hasTypes = nameToken.data?.returnType;
      if (!hasTypes) {
        for (let k = i + 2; k <= callEndIdx; k++) {
          if (tokens[k].data?.type) { hasTypes = true; break; }
        }
      }
      if (!hasTypes) continue;

      // Save the overload tokens for emitTypes' collectParams
      let overloadTokens = tokens.slice(i, j + 1); // DEF through TERMINATOR

      // Check for export before DEF
      let exported = i >= 1 && tokens[i - 1]?.[0] === 'EXPORT';
      let spliceFrom = exported ? i - 1 : i;
      let spliceCount = (j + 1) - spliceFrom; // include TERMINATOR

      let marker = gen('TYPE_DECL', nameToken[1], nameToken);
      marker.data = {
        name: nameToken[1],
        kind: 'overload',
        overloadTokens,
        exported,
      };
      if (nameToken.data?.typeParams) marker.data.typeParams = nameToken.data.typeParams;

      tokens.splice(spliceFrom, spliceCount, marker);
    }
  };
}

// ============================================================================
// Type expression collection helpers
// ============================================================================

// Does a collected arrow-return type look like a bare (un-parenthesized)
// function type — i.e. a single balanced `(…)` group spanning the whole type
// whose top level is a parameter list (an empty `()`, or a depth-1 `:`)? Such
// a "type" is only valid as the params of a function type, so seeing it in
// return position means the user wrote `(x):: (a: T) => R => body` and forgot
// to wrap the function type: `(x):: ((a: T) => R) => body`.
function looksLikeBareFunctionType(typeTokens) {
  const isOpen  = t => t === '(' || t === 'PARAM_START' || t === 'CALL_START';
  const isClose = t => t === ')' || t === 'PARAM_END'   || t === 'CALL_END';
  if (typeTokens.length < 2 || !isOpen(typeTokens[0][0])) return false;

  // The opening paren must match the LAST token: one group spanning the type.
  let depth = 0;
  for (let k = 0; k < typeTokens.length; k++) {
    const tag = typeTokens[k][0];
    if (isOpen(tag)) depth++;
    else if (isClose(tag)) {
      if (--depth === 0 && k !== typeTokens.length - 1) return false;
    }
  }
  if (depth !== 0) return false;

  if (typeTokens.length === 2) return true; // empty `()`

  // A `:` directly inside the outer parens (depth 1) ⇒ parameter-list shape.
  // Brackets/braces nested inside don't count (e.g. `(string | number)` and the
  // object literal `({ a: number })` have no depth-1 `:`). One more exclusion:
  // a parenthesized CONDITIONAL type `(T extends U ? A : B)` has a depth-1 `:`,
  // but it's the conditional's else-branch, always paired with a preceding `?`
  // (TERNARY) at the same depth — a parameter `:` never is. Track that so a
  // conditional return type isn't mistaken for a bare parameter list.
  let d = 0, pendingTernary = false;
  for (const t of typeTokens) {
    const tag = t[0];
    if (isOpen(tag) || tag === '[' || tag === '{' || tag === 'INDEX_START') d++;
    else if (isClose(tag) || tag === ']' || tag === '}' || tag === 'INDEX_END') d--;
    else if (d === 1 && tag === 'TERNARY') pendingTernary = true;
    else if (d === 1 && tag === ':') {
      if (pendingTernary) pendingTernary = false; // conditional else-branch
      else return true;                           // parameter-list colon
    }
  }
  return false;
}

// Rip 3.17 — does the token slice [a, b) form a complete, well-formed *type*
// expression (vs a value expression)? Used to decide whether a single `:` in a
// bare decl (`r: R`) or a function-type-valued decl (`get: (p) => void = …`) is
// a type annotation. A whitelist of type tokens + bracket/generic balance + an
// adjacency rule (two atoms with no separator is not a type — kills the value
// comparison `x < y > z`). Anything outside the whitelist (a CALL_START, `->`,
// `new`/UNARY, arithmetic, `&&`, `==`, …) marks it as a value, so the `:` is
// left alone and any side effects survive.
function isCompleteTypeExpr(tokens, a, b) {
  if (b <= a) return false;
  const SEP = new Set(['|', '&', ',', ':', '?', '.', '...']);
  let par = 0, brk = 0, brc = 0, gen = 0, atomEnd = false;
  const parInfo = [];          // per-paren-depth: { colon, open }
  let lastClosedParen = null;  // { colon, empty } of the most recently closed group
  for (let j = a; j < b; j++) {
    const t = tokens[j][0], v = tokens[j][1];
    // Function-type arrow: valid only after a closed param group that is empty
    // `()` or typed `(x: T)`. An untyped `(e) =>` (or leading `=>`) is a value
    // arrow, so context B won't misread `@input: (e) => x = y` as a typed decl.
    if (t === '=>') {
      const p = j > a ? tokens[j - 1][0] : null;
      if ((p === ')' || p === 'PARAM_END') && lastClosedParen &&
          (lastClosedParen.colon || lastClosedParen.empty)) { atomEnd = false; continue; }
      return false;
    }
    if (t === '(' || t === 'PARAM_START')      { parInfo.push({ colon: false, open: j }); par++; atomEnd = false; continue; }
    if (t === ')' || t === 'PARAM_END')        { if (--par < 0) return false; const pi = parInfo.pop(); lastClosedParen = pi ? { colon: pi.colon, empty: j === pi.open + 1 } : null; atomEnd = true; continue; }
    if (t === '[' || t === 'INDEX_START')      { brk++; atomEnd = false; continue; }
    if (t === ']' || t === 'INDEX_END')        { if (--brk < 0) return false; atomEnd = true; continue; }
    if (t === '{')                             { brc++; atomEnd = false; continue; }
    if (t === '}')                             { if (--brc < 0) return false; atomEnd = true; continue; }
    if (t === 'COMPARE') {
      if (v === '<') { gen++; atomEnd = false; continue; }
      if (v === '>') { if (gen <= 0) return false; gen--; atomEnd = true; continue; }
      return false;                            // ==, !=, <=, >= → not a type
    }
    if (t === 'SHIFT') {
      if (v === '>>') { if (gen < 2) return false; gen -= 2; atomEnd = true; continue; }
      return false;
    }
    if (t === '=') { if (gen > 0) { atomEnd = false; continue; } return false; } // generic default only
    if (SEP.has(t)) { if (t === ':' && parInfo.length) parInfo[parInfo.length - 1].colon = true; atomEnd = false; continue; }
    if (t === 'IDENTIFIER' || t === 'PROPERTY' || t === 'NUMBER' ||
        t === 'STRING' || t === 'NULL' || t === 'UNDEFINED' || t === 'BOOL') {
      if (atomEnd) return false;               // two atoms, no separator → not a type
      atomEnd = true; continue;
    }
    return false;                              // any non-type token → value
  }
  return par === 0 && brk === 0 && brc === 0 && gen === 0 && atomEnd;
}

// Rip 3.17 — positive evidence that a bare `name: T` is a typed forward
// declaration: the same identifier is assigned (`name = …`, `:=`, etc.)
// somewhere later in the same block (any nesting depth before the block's
// OUTDENT). Distinguishes `r: R` (then `r = …`) from a discarded object
// property. Starts scanning at `start` (just past the decl line's TERMINATOR).
function assignedLaterInBlock(tokens, start, name) {
  const ASSIGN = new Set(['=', 'REACTIVE_ASSIGN', 'COMPUTED_ASSIGN', 'READONLY_ASSIGN']);
  // Descend into control-flow sub-blocks (try/if/for — the medlabs `r = …`
  // sits inside a `try`), but SKIP nested function bodies: an assignment inside
  // a closure (`init -> … name = …`) is a different scope and must not count
  // as evidence. A closure body is an INDENT immediately preceded by `->`/`=>`.
  let indent = 0, bracket = 0, closureDepth = 0;
  const closureAt = [];
  for (let j = start; j < tokens.length; j++) {
    const g = tokens[j][0];
    if (g === 'INDENT') {
      indent++;
      const p = tokens[j - 1]?.[0];
      if (p === '->' || p === '=>') { closureAt.push(indent); closureDepth++; }
      continue;
    }
    if (g === 'OUTDENT') {
      if (indent === 0) return false;            // left the starting block
      if (closureAt[closureAt.length - 1] === indent) { closureAt.pop(); closureDepth--; }
      indent--; continue;
    }
    if (g === '(' || g === 'CALL_START' || g === 'PARAM_START' ||
        g === '[' || g === 'INDEX_START' || g === '{') { bracket++; continue; }
    if (g === ')' || g === 'CALL_END' || g === 'PARAM_END' ||
        g === ']' || g === 'INDEX_END' || g === '}') { bracket--; continue; }
    if (closureDepth === 0 && bracket === 0 && (g === 'IDENTIFIER' || g === 'PROPERTY') &&
        tokens[j][1] === name && ASSIGN.has(tokens[j + 1]?.[0])) return true;
  }
  return false;
}

// Rip 3.17 — reclassify single-colon `:` into TYPE_ANNOTATION in the contexts
// where it means a type, so `:` and `::` share one code path. Scoped tightly:
//
//   - function parameters:  `(x: T)`, `(x: T = d)`  (arrow PARAM_START + def)
//   - return types:         `(…): T ->`, `def f(…): T`
//   - statement decls:      `x: T = v`  (binding name at statement start)
//
// Everything else keeps `:` as-is: object properties (`{x: 1}`, `foo a: 1`),
// implicit-object call args (`foo(a: 1)`), ternary (`a ? b : c`), and any colon
// nested inside `{}`/`[]`/`<>` (object-type interiors, generic args). The
// preceding object-key `PROPERTY` token is retagged back to `IDENTIFIER` so the
// downstream `::` handler treats it as a binder, not a property.
//
// Frame state is per parameter segment: a `:` is a param type only before any
// top-level `=` (so a ternary in a default `(x = a ? b : c)` is untouched) and
// only the first colon in the segment.
function reclassifyColonTypes(tokens) {
  const isOpen  = t => t === '(' || t === 'CALL_START' || t === 'PARAM_START' ||
                       t === '{' || t === '[' || t === 'INDEX_START';
  const isClose = t => t === ')' || t === 'CALL_END' || t === 'PARAM_END' ||
                       t === '}' || t === ']' || t === 'INDEX_END';

  // Is this CALL_START the param list of a `def`? Matches `DEF IDENT (` and
  // `DEF IDENT <generics> (`. Deliberately narrow so an ordinary call
  // `foo(a: 1)` (no preceding DEF) is never mistaken for a def param list.
  const isDefParamStart = (i) => {
    let j = i - 1;
    // Skip a balanced generic list `<…>` between the def name and `(`.
    const g0 = tokens[j]?.[0], v0 = tokens[j]?.[1];
    if ((g0 === 'COMPARE' && v0 === '>') || (g0 === 'SHIFT' && v0 === '>>')) {
      let depth = g0 === 'SHIFT' ? 2 : 1;
      j--;
      while (j >= 0 && depth > 0) {
        const g = tokens[j][0], v = tokens[j][1];
        if (g === 'COMPARE' && v === '>') depth++;
        else if (g === 'SHIFT' && v === '>>') depth += 2;
        else if (g === 'COMPARE' && v === '<') depth--;
        else if (g === 'SHIFT' && v === '<<') depth -= 2;
        j--;
      }
    }
    if (tokens[j]?.[0] !== 'IDENTIFIER' && tokens[j]?.[0] !== 'PROPERTY') return false;
    return tokens[j - 1]?.[0] === 'DEF';
  };

  // Statement-level typed declaration `name: T = v` (and `:=`, `~=`, `=!`,
  // `~>`, `<~`). True only when an assignment/binding operator appears at the
  // top level BEFORE any function arrow — so a method/value like
  // `name: (x) -> …` or `name: (x) => y = x` (arrow first) stays a binding,
  // and a bare `name: T` (no binding op) stays an object property.
  const STMT_START  = new Set(['TERMINATOR', 'INDENT', 'OUTDENT', 'EXPORT']);
  // Assignment/binding operators that mark `name: T <op> …` as a typed
  // declaration. EFFECT (`~>`) and GATE (`<~`) are deliberately excluded: a
  // bare `name: ~> …` is a schema computed getter (no type), so treating `~>`
  // as a binding op would misread schema bodies as typed declarations.
  const BINDING_OPS = new Set(['=', 'REACTIVE_ASSIGN', 'COMPUTED_ASSIGN', 'READONLY_ASSIGN']);
  const atStatementStart = (t) => !t || STMT_START.has(t[0]);
  const declBindsBeforeArrow = (start) => {
    let depth = 0;
    for (let j = start; j < tokens.length; j++) {
      const g = tokens[j][0];
      if (isOpen(g)) depth++;
      else if (isClose(g)) depth--;
      else if (depth === 0) {
        if (g === '->' || g === '=>') return false;
        if (BINDING_OPS.has(g)) return true;
        // Typed effect/gate: `name: T ~> …` — an EFFECT/GATE that is NOT the
        // first token after `:` follows a type (a bare `name: ~> …` schema
        // getter has it first, so j === start, and stays excluded).
        if ((g === 'EFFECT' || g === 'GATE') && j > start) return true;
        if (g === 'TERMINATOR' || g === 'INDENT' || g === 'OUTDENT') return false;
      }
    }
    return false;
  };

  // Does the value after a class-member `:` look like a function (a method),
  // i.e. does a `->`/`=>` arrow appear at depth 0 before the member ends? If so
  // it's a method binding, not a typed field — leave it alone.
  const valueIsMethod = (start) => {
    let depth = 0;
    for (let j = start; j < tokens.length; j++) {
      const g = tokens[j][0];
      if (isOpen(g)) depth++;
      else if (isClose(g)) depth--;
      else if (depth === 0) {
        if (g === '->' || g === '=>') return true;
        if (g === 'TERMINATOR' || g === 'INDENT' || g === 'OUTDENT') return false;
      }
    }
    return false;
  };

  // Track class/component bodies via INDENT/OUTDENT so a bare `name: T` member
  // (or `@name: T` component prop) is read as a typed field. `pendingBody` is
  // armed by `class`/`component` and consumed by the next INDENT (the body);
  // methods inside it open their own (non-body) INDENT, so a member is in a
  // typed body only when the innermost indent frame is that body.
  let pendingBody = false;
  const indentStack = [];
  const inTypedBody = () => indentStack.length > 0 && indentStack[indentStack.length - 1];

  // The binding name for a statement/field annotation is `tokens[i-1]` (a
  // PROPERTY/IDENTIFIER), optionally preceded by `@` (component prop / promoted
  // field). Returns true when that name sits at a statement boundary.
  const nameAtStatementStart = (i) => {
    const p = tokens[i - 1]?.[0];
    if (p !== 'PROPERTY' && p !== 'IDENTIFIER') return false;
    if (tokens[i - 2]?.[0] === '@') return atStatementStart(tokens[i - 3]);
    return atStatementStart(tokens[i - 2]);
  };

  // Is this top-level `=` the assignment of a `type Name [<generics>] =`
  // declaration? Its RHS is a whole type expression, so we arm `inType` there —
  // otherwise a braced type literal RHS (`type X = { f: (e: Event) => void }`,
  // incl. intersections `… & { … }`) reaches the field colon at bracket-depth
  // ≥ 1, where none of the `:`-reclassify branches (all `stack.length === 0`)
  // fire, so `inType` is never armed and the function-type's `(e: Event)` param
  // is wrongly reclassified — putting a synthetic `::` inside a structural type
  // literal. Mirrors `isDefParamStart`'s backward generic skip. (The indented
  // `type T =` ⏎ INDENT form is unaffected: it disarms `inType` at the INDENT
  // and is collected per-field by `collectStructuralType`.)
  const isTypeDeclEq = (i) => {
    let j = i - 1;
    const g0 = tokens[j]?.[0], v0 = tokens[j]?.[1];
    if ((g0 === 'COMPARE' && v0 === '>') || (g0 === 'SHIFT' && v0 === '>>')) {
      let depth = g0 === 'SHIFT' ? 2 : 1;
      j--;
      while (j >= 0 && depth > 0) {
        const g = tokens[j][0], v = tokens[j][1];
        if (g === 'COMPARE' && v === '>') depth++;
        else if (g === 'SHIFT' && v === '>>') depth += 2;
        else if (g === 'COMPARE' && v === '<') depth--;
        else if (g === 'SHIFT' && v === '<<') depth -= 2;
        j--;
      }
    }
    // tokens[j] is the type name, preceded by the `type` contextual keyword at
    // a statement boundary (the same shape the `type Name =` collector matches).
    if (tokens[j]?.[0] !== 'IDENTIFIER') return false;
    if (!(tokens[j - 1]?.[0] === 'IDENTIFIER' && tokens[j - 1]?.[1] === 'type')) return false;
    return atStatementStart(tokens[j - 2]);
  };

  // A type expression (opened by any `::` / TYPE_ANNOTATION, or by a `:` we
  // reclassify) must never have its interior touched: a function type like
  // `{ cb: (r: R) => void }` carries single `:` colons that are TS member/param
  // separators, not Rip annotations. `inType` suppresses reclassification until
  // the type ends (a terminator at its start depth, or exiting that depth).
  let inType = false, typeStartDepth = 0;
  const enterType = () => { inType = true; typeStartDepth = stack.length; };

  // Object-context detection for context D: a statement-start `name:` line that
  // sits next to another `key:` line is an object member (`{a: A, b: B}`), not a
  // bare typed declaration. `curLineKV` marks the current line as starting
  // `name:`; committed to `prevSiblingKV` at the line's TERMINATOR; both reset
  // at block boundaries.
  let prevSiblingKV = false, curLineKV = false;

  const stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const tag = tokens[i][0];

    // Class-body tracking (INDENT/OUTDENT). `class` arms the next INDENT as a
    // class body; nested method/blocks push non-class indents. INDENT/OUTDENT
    // at the type's start depth also end a type expression.
    if (tag === 'CLASS' || tag === 'COMPONENT') { pendingBody = true; continue; }
    if (tag === 'INDENT') { indentStack.push(pendingBody); pendingBody = false; prevSiblingKV = curLineKV = false; if (inType && stack.length <= typeStartDepth) inType = false; continue; }
    if (tag === 'OUTDENT') { indentStack.pop(); prevSiblingKV = curLineKV = false; if (inType && stack.length <= typeStartDepth) inType = false; continue; }

    // Brackets are always tracked (depth drives the type-context boundary).
    // Inside a type, an opener is never a real parameter list (it's a
    // function-type's params), so it pushes a plain frame.
    if (isOpen(tag)) {
      let kind = 'other';
      if (!inType) {
        if (tag === 'PARAM_START') kind = 'param';
        else if ((tag === 'CALL_START' || tag === '(') && isDefParamStart(i)) kind = 'defparam';
      }
      stack.push({ kind, sawEq: false, sawType: false });
      continue;
    }
    if (isClose(tag)) {
      const f = stack.pop();
      if (f?.kind === 'defparam') { (tokens[i].data ??= {}).isDefParamEnd = true; }
      if (inType && stack.length < typeStartDepth) inType = false;
      continue;
    }

    // A type annotation token (pre-existing `::`, or one created below) opens a
    // type expression.
    if (tag === 'TYPE_ANNOTATION') { if (!inType) enterType(); continue; }

    // Inside a type: clear at the type's terminator (at its start depth);
    // otherwise skip — never reclassify a colon that belongs to a type. `=>`
    // does not terminate (it's a function-type arrow).
    if (inType) {
      if (stack.length <= typeStartDepth &&
          (tag === '=' || tag === ',' || tag === 'TERMINATOR' || tag === '->' ||
           BINDING_OPS.has(tag))) {
        inType = false;   // fall through; a terminator is never a `:` to reclassify
      } else {
        continue;
      }
    }

    // Commit per-line key:value state at statement boundaries (depth 0).
    if (tag === 'TERMINATOR' && stack.length === 0) { prevSiblingKV = curLineKV; curLineKV = false; }

    // Type-alias RHS: `type Name [<generics>] = <type>`. The whole RHS is a
    // type expression — arm `inType` so its interior colons (a braced literal's
    // field `:`, a function-type param's `:`) are left as TS separators rather
    // than reclassified. Disarms at the RHS terminator / on exiting its depth,
    // like every other `enterType`. A value-position `=` (`x = { a: 1 }`) is not
    // a type decl, so `isTypeDeclEq` rejects it and object literals stay intact.
    if (tag === '=' && stack.length === 0 && !inType && isTypeDeclEq(i)) {
      enterType(); continue;
    }

    if (tag === ':') {
      const prev = tokens[i - 1];
      const prevTag = prev?.[0];
      // Mark this line as `name:`-shaped (object-member candidate) for D's
      // adjacent-key detection.
      if (stack.length === 0 && (prevTag === 'IDENTIFIER' || prevTag === 'PROPERTY') &&
          atStatementStart(tokens[i - 2])) curLineKV = true;
      // Return type: a `:` immediately after a closed param list. Arrow param
      // lists close as PARAM_END; def param lists close as `)` or CALL_END
      // (flagged `isDefParamEnd`).
      if (prevTag === 'PARAM_END' ||
          ((prevTag === ')' || prevTag === 'CALL_END') && prev.data?.isDefParamEnd)) {
        tokens[i][0] = 'TYPE_ANNOTATION'; enterType(); continue;
      }
      // Parameterless def return type: `def foo: T`.
      if ((prevTag === 'IDENTIFIER' || prevTag === 'PROPERTY') &&
          tokens[i - 2]?.[0] === 'DEF') {
        if (prevTag === 'PROPERTY') prev[0] = 'IDENTIFIER';
        tokens[i][0] = 'TYPE_ANNOTATION'; enterType(); continue;
      }
      // Statement-level typed declaration (top level, name at statement start,
      // binding operator before any arrow). Covers `@name: T := v` props too.
      // An `@`-prefixed name stays PROPERTY (the `@`-prop / promoted-field
      // machinery needs it); a plain name is retagged IDENTIFIER like `::`.
      if (stack.length === 0 && nameAtStatementStart(i) &&
          declBindsBeforeArrow(i + 1)) {
        if (prevTag === 'PROPERTY' && tokens[i - 2]?.[0] !== '@') prev[0] = 'IDENTIFIER';
        tokens[i][0] = 'TYPE_ANNOTATION'; enterType(); continue;
      }
      // Context B — function-type-valued declaration: `name: (…) => Ret = value`
      // (statement start). The type carries a `=>` arrow, so the binding-before-
      // arrow check above misses it. Scan for the first bracket-depth-0 `=`
      // (only ()[]{} count) whose preceding slice is a complete type expression
      // — the `=>` is then a function-TYPE arrow. Try-and-continue handles
      // generic defaults `Foo<T = U>` (the inner `=` leaves `Foo<T` incomplete).
      if (stack.length === 0 && nameAtStatementStart(i)) {
        let depth = 0;
        for (let j = i + 1; j < tokens.length; j++) {
          const g = tokens[j][0];
          if (isOpen(g)) depth++;
          else if (isClose(g)) { if (depth === 0) break; depth--; }
          else if (depth === 0) {
            if (g === 'TERMINATOR' || g === 'INDENT' || g === 'OUTDENT') break;
            if (g === '=' && isCompleteTypeExpr(tokens, i + 1, j)) {
              if (prevTag === 'PROPERTY' && tokens[i - 2]?.[0] !== '@') prev[0] = 'IDENTIFIER';
              tokens[i][0] = 'TYPE_ANNOTATION'; enterType(); break;
            }
          }
        }
        if (tokens[i][0] === 'TYPE_ANNOTATION') continue;
      }
      // Class/component-body typed field: a bare `name: T` (or `@name: T`)
      // member with no initializer is a typed field unless its value is a
      // method (`name: (…) -> …`).
      if (inTypedBody() && stack.length === 0 && nameAtStatementStart(i) &&
          !valueIsMethod(i + 1)) {
        if (prevTag === 'PROPERTY' && tokens[i - 2]?.[0] !== '@') prev[0] = 'IDENTIFIER';
        tokens[i][0] = 'TYPE_ANNOTATION'; enterType(); continue;
      }
      // Context D — bare typed declaration, no initializer: `name: T` at
      // statement start, the line is NON-TAIL (not the last expression of its
      // block — that would be an implicit-return object), the type slice is a
      // complete type expression (rejects `name: build()` so side effects
      // survive), and the same `name` is assigned later in the block (positive
      // evidence it's a forward declaration, not a discarded object property).
      if (stack.length === 0 && nameAtStatementStart(i) && tokens[i - 2]?.[0] !== '@') {
        let depth = 0, end = -1;
        for (let j = i + 1; j < tokens.length; j++) {
          const g = tokens[j][0];
          if (isOpen(g)) depth++;
          else if (isClose(g)) { if (depth === 0) break; depth--; }
          else if (depth === 0) {
            if (g === 'TERMINATOR') { end = j; break; }
            if (g === 'INDENT' || g === 'OUTDENT' || g === '=' || BINDING_OPS.has(g)) break;
          }
        }
        const nk = tokens[end + 1];
        const nextKV = nk && (nk[0] === 'IDENTIFIER' || nk[0] === 'PROPERTY') &&
                       tokens[end + 2]?.[0] === ':';
        if (end > i + 1 && nk && nk[0] !== 'OUTDENT' &&
            !prevSiblingKV && !nextKV &&
            isCompleteTypeExpr(tokens, i + 1, end) &&
            assignedLaterInBlock(tokens, end + 1, prev[1])) {
          if (prevTag === 'PROPERTY') prev[0] = 'IDENTIFIER';
          tokens[i][0] = 'TYPE_ANNOTATION'; enterType(); continue;
        }
      }
    }

    const f = stack[stack.length - 1];
    if (f && (f.kind === 'param' || f.kind === 'defparam')) {
      if (tag === ',') { f.sawEq = false; f.sawType = false; continue; }
      if (tag === '=') { f.sawEq = true; continue; }
      if (tag === ':' && !f.sawEq && !f.sawType) {
        const prev = tokens[i - 1];
        const prevTag = prev?.[0];
        if (prevTag === 'PROPERTY' || prevTag === 'IDENTIFIER') {
          if (prevTag === 'PROPERTY' && tokens[i - 2]?.[0] !== '@') prev[0] = 'IDENTIFIER';
          tokens[i][0] = 'TYPE_ANNOTATION';
          f.sawType = true;
          enterType();
        } else if (prevTag === '}' || prevTag === ']' || prevTag === 'INDEX_END') {
          // Context A — external destructuring param type, TS-style:
          // `({pat}: Type)` / `([pat]: Type)`. The `:` follows the ROOT pattern
          // close (the stack top is this param frame, so the pattern's own
          // brackets have already been popped — a nested pattern's `:` is seen
          // while an inner frame is on top and stays a rename). In-pattern `:`
          // therefore keeps its destructuring-rename meaning; the type lives
          // outside the pattern, after `}`/`]`.
          tokens[i][0] = 'TYPE_ANNOTATION';
          f.sawType = true;
          enterType();
        }
      }
    }
  }
}

// Collect type expression tokens starting at position j, respecting brackets
function collectTypeExpression(tokens, j, opts = {}) {
  let typeTokens = [];
  let depth = 0;
  let bracketStack = []; // tracks innermost open bracket: '{', '[', '(', '<'
  let startJ = j;

  while (j < tokens.length) {
    let t = tokens[j];
    let tTag = t[0];

    // Bracket balancing
    let isOpen = tTag === '(' || tTag === '[' || tTag === '{' ||
        tTag === 'CALL_START' || tTag === 'PARAM_START' || tTag === 'INDEX_START' ||
        (tTag === 'COMPARE' && t[1] === '<');
    let isClose = tTag === ')' || tTag === ']' || tTag === '}' ||
        tTag === 'CALL_END' || tTag === 'PARAM_END' || tTag === 'INDEX_END' ||
        (tTag === 'COMPARE' && t[1] === '>');

    // Handle >> as two > closes (nested generics: Map<string, Set<number>>)
    if (tTag === 'SHIFT' && t[1] === '>>' && depth >= 2) {
      depth -= 2;
      if (bracketStack[bracketStack.length - 1] === '<') bracketStack.pop();
      if (bracketStack[bracketStack.length - 1] === '<') bracketStack.pop();
      typeTokens.push(t);
      j++;
      continue;
    }

    if (isOpen) {
      depth++;
      let kind = (tTag === '{') ? '{'
               : (tTag === '[' || tTag === 'INDEX_START') ? '['
               : (tTag === 'COMPARE' && t[1] === '<') ? '<'
               : '(';
      bracketStack.push(kind);
      typeTokens.push(t);
      j++;
      continue;
    }
    if (isClose) {
      if (depth > 0) {
        depth--;
        bracketStack.pop();
        typeTokens.push(t);
        j++;
        continue;
      }
      break;
    }

    // Cast context: a cast's type lives on one logical line, but the lexer
    // suppresses the newline after a trailing `>` (a COMPARE token is
    // "unfinished"), so no TERMINATOR separates `x as Map<K, V>` from the next
    // statement. Stop at a depth-0 row change so the collector can't run past
    // end-of-line into the following code (the `Map<K, V> nextStmt` footgun).
    if (opts.castContext && depth === 0 && j > startJ) {
      let prevRow = tokens[j - 1]?.loc?.r;
      let curRow = t.loc?.r;
      if (prevRow != null && curRow != null && curRow > prevRow) break;
    }

    // Cast context: a chained cast (`x as A as B`) — the type RHS is just `A`;
    // the second `as` starts a new cast on the result. Stop here so each `as`
    // becomes its own CAST marker and the grammar nests them left-to-right.
    // (`as` never appears inside a real type expression, so this is safe.)
    if (opts.castContext && depth === 0 && tTag === 'IDENTIFIER' && t[1] === 'as') {
      break;
    }

    // Delimiters that end the type at depth 0
    if (depth === 0) {
      // Arrow-return context: a depth-0 `=>` is the arrow OPERATOR, so it ends
      // the return type (symmetric with `->` below). A function-type return
      // must therefore be parenthesized as a whole — see the foot-gun guard in
      // the TYPE_ANNOTATION handler. Everywhere else `=>` is a TS function-type
      // arrow and is collected (e.g. `cb:: () => void`).
      if (opts.stopAtFatArrow && tTag === '=>') break;
      // After =>, INDENT wraps the return type body — collect through OUTDENT
      if (tTag === 'INDENT' && typeTokens.length > 0 && typeTokens[typeTokens.length - 1][0] === '=>') {
        j++; // skip INDENT
        let nest = 1;
        while (j < tokens.length && nest > 0) {
          if (tokens[j][0] === 'INDENT') { nest++; j++; }
          else if (tokens[j][0] === 'OUTDENT') { nest--; j++; }
          else { typeTokens.push(tokens[j]); j++; }
        }
        continue;
      }
      if (tTag === '=' || tTag === 'REACTIVE_ASSIGN' ||
          tTag === 'COMPUTED_ASSIGN' || tTag === 'READONLY_ASSIGN' ||
          tTag === 'EFFECT' || tTag === 'GATE' || tTag === 'TERMINATOR' ||
          tTag === 'INDENT' || tTag === 'OUTDENT' ||
          tTag === '->' || tTag === ',') {
        break;
      }
      // Cast context (`expr as Type`): the type RHS lives inside a larger
      // expression, so it must also end at any depth-0 binary/relational/
      // ternary operator. `|` and `&` are NOT stops — they're union /
      // intersection type operators (TS reads everything after `as` as a
      // type, so `x as A & B` is `x as (A & B)`). COMPARE's `<`/`>` never
      // reach here (handled as generic brackets above), leaving only
      // `== != <= >=`, which do stop.
      if (opts.castContext && (
          tTag === '+' || tTag === '-' || tTag === 'MATH' || tTag === '**' ||
          tTag === 'SHIFT' || tTag === 'COMPARE' || tTag === '&&' ||
          tTag === '||' || tTag === '??' || tTag === '^' ||
          tTag === 'RELATION' || tTag === 'TERNARY' || tTag === '?' ||
          tTag === 'PRESENCE' || tTag === ':')) {
        break;
      }
    }

    // Inside a bracketed type expression, INDENT/OUTDENT/TERMINATOR are
    // pure layout tokens (multi-line type literal `{ \n field: T \n }`).
    // They carry no semantic meaning and would otherwise leak their raw
    // `[1]` value (e.g. an indent level integer like `2`) into the
    // type string. INDENT/OUTDENT are dropped silently; TERMINATOR
    // separates fields and is replaced with a synthetic `;` so the
    // emitted type literal is valid TS (`{ a: T; b: U }`).
    if (depth > 0 && (tTag === 'INDENT' || tTag === 'OUTDENT')) {
      j++;
      continue;
    }
    if (depth > 0 && tTag === 'TERMINATOR') {
      typeTokens.push(['', ';']);
      j++;
      continue;
    }

    // Inside `{ ... }` the Rip rewriter sometimes drops TERMINATOR
    // between fields (e.g. after `Record<string, string[]>` because `>`
    // looks like a binary operator wanting a RHS). Detect a new field
    // by seeing a PROPERTY token at the top of a `{` and inject `;` if
    // the previously emitted token isn't already a separator/opener.
    if (tTag === 'PROPERTY' &&
        bracketStack[bracketStack.length - 1] === '{') {
      let prev = typeTokens[typeTokens.length - 1];
      let prevTag = prev?.[0];
      let prevVal = prev?.[1];
      let needsSep = prev && prevTag !== '{' && prevTag !== ',' &&
                     !(prevTag === '' && prevVal === ';');
      if (needsSep) typeTokens.push(['', ';']);
    }

    // => at depth 0: function type arrow, continue collecting
    // -> at depth 0: code arrow, handled as delimiter above
    typeTokens.push(t);
    j++;
  }

  typeTokens.consumed = j - startJ;

  return typeTokens;
}

// Build a clean type string from collected tokens
function buildTypeString(typeTokens) {
  if (typeTokens.length === 0) return '';
  // Bare => (no params) means () => — add empty parens
  if (typeTokens[0]?.[0] === '=>') typeTokens.unshift(['', '()']);
  // Validation: `::` inside `{ ... }` in type position is illegal.
  // `::` binds a name to a type (params, var decls, return types).
  // Inside a structural type literal `{ ... }`, fields are key→type
  // pairs and use `:` (TS-style), the same way TS type literals do.
  // `::` has no role inside a type literal — every `:` there is
  // already unambiguously a type separator.
  {
    let curlyDepth = 0;
    for (let t of typeTokens) {
      let tag = t[0];
      if (tag === '{') curlyDepth++;
      else if (tag === '}') curlyDepth--;
      else if (tag === 'TYPE_ANNOTATION' && curlyDepth > 0) {
        let loc = t.loc;
        let where = loc ? ` (line ${loc.r}, col ${loc.c})` : '';
        let err = new Error(
          `Use \`:\` (not \`::\`) inside a structural type literal${where}. ` +
          `\`::\` binds a name to a type; inside \`{ ... }\` in type ` +
          `position, fields use \`:\` (TS-style).`
        );
        err.loc = loc;
        throw err;
      }
    }
  }
  // Inline structural / function-param property-name optional marker:
  // an IDENTIFIER carrying `.data.optional` and followed by TYPE_ANNOTATION
  // gets a trailing `?` appended to its emitted name. The lexer stripped
  // the trailing `?` from the token text but flagged it on `.data.optional`.
  let parts = typeTokens.map((t, i) => {
    let next = typeTokens[i + 1];
    // Re-attach the trailing `?` for optional property names. The next
    // separator is `::` (TYPE_ANNOTATION) in function param lists, or
    // `:` inside an inline structural type literal `{ x?: T }`.
    if (t.data?.optional && next && (next[0] === 'TYPE_ANNOTATION' || next[0] === ':')) {
      return `${t[1]}?`;
    }
    // Embedded-JS tokens are backtick literals with the delimiters stripped
    // by the lexer. In type position they are TS template-literal types
    // (e.g. `${number} min`) — re-wrap them so the emitted type is valid.
    if (t[0] === 'JS') return '`' + t[1] + '`';
    return t[1];
  });
  let typeStr = parts.join(' ').replace(/\s+/g, ' ').trim();
  typeStr = typeStr
    .replace(/\s*<\s*/g, '<').replace(/\s*>\s*/g, '>')
    .replace(/\s*\[\s*/g, '[').replace(/\s*\]\s*/g, ']')
    .replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*=>\s*/g, ' => ')
    .replace(/ :: /g, ': ')
    .replace(/:: /g, ': ')
    .replace(/ : /g, ': ');
  return typeStr;
}

// Collect balanced angle brackets starting at position j (the < token)
function collectBalancedAngles(tokens, j) {
  if (j >= tokens.length) return null;
  let t = tokens[j];
  if (t[0] !== 'COMPARE' || t[1] !== '<') return null;

  let collected = [t];
  let depth = 1;
  let k = j + 1;

  while (k < tokens.length && depth > 0) {
    let tk = tokens[k];
    collected.push(tk);
    if (tk[0] === 'COMPARE' && tk[1] === '<') depth++;
    else if (tk[0] === 'COMPARE' && tk[1] === '>') depth--;
    k++;
  }

  return depth === 0 ? collected : null;
}

// Collect structural type body: { prop: type; ... }
function collectStructuralType(tokens, indentIdx) {
  let props = [];
  let j = indentIdx + 1; // skip INDENT
  let depth = 1;

  while (j < tokens.length && depth > 0) {
    let t = tokens[j];
    if (t[0] === 'INDENT') { depth++; j++; continue; }
    if (t[0] === 'OUTDENT') {
      depth--;
      if (depth === 0) break;
      j++;
      continue;
    }
    if (t[0] === 'TERMINATOR') { j++; continue; }

    // Index signature: [key: Type]: ValueType
    if (depth === 1 && t[0] === '[') {
      let sigTokens = [];
      j++; // skip [
      // Collect tokens through matching ]
      while (j < tokens.length && tokens[j][0] !== ']') {
        sigTokens.push(tokens[j]);
        j++;
      }
      j++; // skip ]
      // Skip : separator after ]
      if (tokens[j]?.[1] === ':' || tokens[j]?.[0] === 'TYPE_ANNOTATION') j++;
      // Collect value type
      let valTypeTokens = [];
      while (j < tokens.length) {
        let pt = tokens[j];
        if (pt[0] === 'TERMINATOR' || pt[0] === 'OUTDENT') break;
        valTypeTokens.push(pt);
        j++;
      }
      let sigStr = buildTypeString(sigTokens);
      let valStr = buildTypeString(valTypeTokens);
      props.push(`[${sigStr}]: ${valStr}`);
      continue;
    }

    // Collect a property line: name (? optional) : type
    // Property tokens can be PROPERTY, IDENTIFIER, or keyword tags whose
    // value is a valid identifier (e.g. RENDER "render" in interfaces).
    let isProperty = t[0] === 'PROPERTY' || t[0] === 'IDENTIFIER' ||
        (depth === 1 && /^[a-zA-Z_$]/.test(t[1]) && tokens[j + 1]?.[0] === 'TYPE_ANNOTATION');
    if (depth === 1 && isProperty) {
      let propName = t[1];
      let optional = false;
      let readonly = false;
      j++;

      // Check for readonly prefix
      if (propName === 'readonly' && tokens[j] && (tokens[j][0] === 'PROPERTY' || tokens[j][0] === 'IDENTIFIER' ||
          (/^[a-zA-Z_$]/.test(tokens[j][1]) && tokens[j + 1]?.[0] === 'TYPE_ANNOTATION'))) {
        readonly = true;
        propName = tokens[j][1];
        // Carry optional flag through
        if (tokens[j].data?.optional) optional = true;
        j++;
      }

      // Check for ? (optional property) — lexer stores as .data.optional
      if (t.data?.optional) optional = true;
      // Also check for standalone ? token
      if (tokens[j]?.[1] === '?' && !tokens[j]?.spaced) {
        optional = true;
        j++;
      }

      // Skip : or :: separator
      if (tokens[j]?.[1] === ':' || tokens[j]?.[0] === 'TYPE_ANNOTATION') j++;

      // Collect the type (until TERMINATOR or OUTDENT at property depth)
      let propTypeTokens = [];
      let typeDepth = 0;
      while (j < tokens.length) {
        let pt = tokens[j];
        // Nested structural type: `prop: type` followed by INDENT block
        if (pt[0] === 'IDENTIFIER' && pt[1] === 'type' && tokens[j + 1]?.[0] === 'INDENT') {
          j++; // skip 'type'
          let nestedType = collectStructuralType(tokens, j);
          propTypeTokens.push(['', nestedType]);
          // Skip past the INDENT...OUTDENT block
          let nd = 1; j++;
          while (j < tokens.length && nd > 0) {
            if (tokens[j][0] === 'INDENT') nd++;
            if (tokens[j][0] === 'OUTDENT') nd--;
            j++;
          }
          continue;
        }
        if (pt[0] === 'INDENT') { typeDepth++; j++; continue; }
        if (pt[0] === 'OUTDENT') {
          if (typeDepth > 0) { typeDepth--; j++; continue; }
          break;
        }
        if (pt[0] === 'TERMINATOR' && typeDepth === 0) break;
        propTypeTokens.push(pt);
        j++;
      }

      let typeStr = buildTypeString(propTypeTokens);
      let prefix = readonly ? 'readonly ' : '';
      let optMark = optional ? '?' : '';
      // Method-shorthand: `name(args)` or `name(args): retType` — typeStr
      // is parenthesized and has either nothing or `:` (not `::`) after the
      // matching `)`. Emit without the property `:` separator so TS treats
      // `this` inside the method as the containing type.
      let methodShorthand = false;
      if (!optional && typeStr.startsWith('(')) {
        let depthM = 0;
        for (let m = 0; m < typeStr.length; m++) {
          let ch = typeStr[m];
          if (ch === '(') depthM++;
          else if (ch === ')') {
            depthM--;
            if (depthM === 0) {
              let rest = typeStr.slice(m + 1).trimStart();
              if (rest === '' || (rest.startsWith(':') && !rest.startsWith('::'))) {
                methodShorthand = true;
              }
              break;
            }
          }
        }
      }
      if (methodShorthand) {
        props.push(`${prefix}${propName}${typeStr}`);
      } else {
        props.push(`${prefix}${propName}${optMark}: ${typeStr}`);
      }
    } else {
      j++;
    }
  }

  return '{ ' + props.join('; ') + ' }';
}

// Find the matching OUTDENT for an INDENT at position idx
function findMatchingOutdent(tokens, idx) {
  let depth = 0;
  for (let j = idx; j < tokens.length; j++) {
    if (tokens[j][0] === 'INDENT') depth++;
    if (tokens[j][0] === 'OUTDENT') {
      depth--;
      if (depth === 0) return j;
    }
  }
  return tokens.length - 1;
}

// Collect block union members: | "a" | "b" | "c"
function collectBlockUnion(tokens, startIdx) {
  let j = startIdx;

  // Skip TERMINATOR if present
  if (tokens[j]?.[0] === 'TERMINATOR') j++;

  // Need INDENT for block form
  if (tokens[j]?.[0] !== 'INDENT') return null;

  let indentIdx = j;
  j++;

  // Check if first non-terminator token is |
  while (j < tokens.length && tokens[j][0] === 'TERMINATOR') j++;
  if (!tokens[j] || tokens[j][1] !== '|') return null;

  let members = [];
  let depth = 1;
  j = indentIdx + 1;

  while (j < tokens.length && depth > 0) {
    let t = tokens[j];
    if (t[0] === 'INDENT') { depth++; j++; continue; }
    if (t[0] === 'OUTDENT') {
      depth--;
      if (depth === 0) break;
      j++;
      continue;
    }
    if (t[0] === 'TERMINATOR') { j++; continue; }

    // Skip leading |
    if (t[1] === '|' && depth === 1) {
      j++;
      // Collect member tokens until next | or TERMINATOR
      let memberTokens = [];
      while (j < tokens.length) {
        let mt = tokens[j];
        if (mt[0] === 'TERMINATOR' || mt[0] === 'OUTDENT' ||
            (mt[1] === '|' && depth === 1)) break;
        memberTokens.push(mt);
        j++;
      }
      if (memberTokens.length > 0) {
        members.push(buildTypeString(memberTokens));
      }
      continue;
    }

    j++;
  }

  if (members.length === 0) return null;

  let endIdx = findMatchingOutdent(tokens, indentIdx);
  return { typeText: members.join(' | '), endIdx };
}

