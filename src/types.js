// Type System — token-stream type stripping + runtime enum codegen.
//
// This module is browser-safe — the lexer needs installTypeSupport() to
// strip type annotations from the token stream so user-typed Rip parses,
// and the compiler needs emitEnum() to emit runtime JavaScript for enum
// blocks. The .d.ts emission half (emitTypes, intrinsic decl tables,
// component-type emitter) lives in src/types-emit.js, which is reachable
// only from CLI entry points and typecheck.js.

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

        let typeTokens = collectTypeExpression(tokens, i + 1);
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

        // Block union: type Name = (TERMINATOR?) INDENT | "a" | "b" ... OUTDENT
        // Must check before structural — `=` suppresses TERMINATOR so INDENT follows directly
        if (next && (next[0] === 'TERMINATOR' || next[0] === 'INDENT')) {
          let result = collectBlockUnion(tokens, afterEq);
          if (result) {
            tokens.splice(removeFrom, result.endIdx - removeFrom + 1, makeDecl(result.typeText));
            return 0;
          }
        }

        // Structural type: type Name = INDENT ... OUTDENT
        if (next && next[0] === 'INDENT') {
          let endIdx = findMatchingOutdent(tokens, afterEq);
          tokens.splice(removeFrom, endIdx - removeFrom + 1, makeDecl(collectStructuralType(tokens, afterEq)));
          return 0;
        }

        // Simple alias: type Name = type-expression
        let typeTokens = collectTypeExpression(tokens, afterEq);
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

// Collect type expression tokens starting at position j, respecting brackets
function collectTypeExpression(tokens, j) {
  let typeTokens = [];
  let depth = 0;
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
      typeTokens.push(t);
      j++;
      continue;
    }

    if (isOpen) {
      depth++;
      typeTokens.push(t);
      j++;
      continue;
    }
    if (isClose) {
      if (depth > 0) {
        depth--;
        typeTokens.push(t);
        j++;
        continue;
      }
      break;
    }

    // Delimiters that end the type at depth 0
    if (depth === 0) {
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
          tTag === 'EFFECT' || tTag === 'TERMINATOR' ||
          tTag === 'INDENT' || tTag === 'OUTDENT' ||
          tTag === '->' || tTag === ',') {
        break;
      }
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
  let typeStr = typeTokens.map(t => t[1]).join(' ').replace(/\s+/g, ' ').trim();
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
        // Carry predicate flag through
        if (tokens[j].data?.predicate) optional = true;
        j++;
      }

      // Check for ? (optional property) — lexer stores as .data.predicate
      if (t.data?.predicate) optional = true;
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
      props.push(`${prefix}${propName}${optMark}: ${typeStr}`);
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

// ============================================================================
// emitEnum — runtime JavaScript enum object (CodeEmitter method)
// ============================================================================

export function emitEnum(head, rest, context) {
  let [name, body] = rest;
  let enumName = name?.valueOf?.() ?? name;

  // Parse enum body from s-expression
  let pairs = [];
  if (Array.isArray(body)) {
    let items = body[0] === 'block' ? body.slice(1) : [body];
    for (let item of items) {
      if (Array.isArray(item)) {
        if (item[0]?.valueOf?.() === '=') {
          let key = item[1]?.valueOf?.() ?? item[1];
          let val = item[2]?.valueOf?.() ?? item[2];
          pairs.push([key, val]);
        }
      }
    }
  }

  if (pairs.length === 0) return `const ${enumName} = {}`;

  let forward = pairs.map(([k, v]) => `${k}: ${v}`).join(', ');
  let reverse = pairs.map(([k, v]) => `${v}: "${k}"`).join(', ');
  return `const ${enumName} = {${forward}, ${reverse}}`;
}
