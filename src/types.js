// Type System — Optional type annotations and .d.ts emission for Rip
//
// Architecture: installTypeSupport(Lexer) adds rewriteTypes() to the lexer
// prototype (sidecar pattern, same as components.js for CodeGenerator).
// emitTypes(tokens) generates .d.ts from annotated tokens before parsing.
// generateEnum() is the one CodeGenerator method for runtime enum output.
//
// Design: Types are fully resolved at the token level. The parser never sees
// type annotations, type aliases, or interfaces — only enum crosses into the
// grammar because it emits runtime JavaScript.

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
  //   ::= (TYPE_ALIAS) — collects type body, replaces with TYPE_DECL marker
  //   INTERFACE — collects body, replaces with TYPE_DECL marker
  //   DEF IDENTIFIER<...> — collects generic params via .spaced detection
  //
  // After this pass, the token stream is type-free (except ENUM tokens and
  // TYPE_DECL markers that emitTypes() reads before they're filtered out).

  proto.rewriteTypes = function() {
    let tokens = this.tokens;
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

      // ── Generic type parameters: DEF name<T>(...) or Name<T> ::= ───────
      if (tag === 'IDENTIFIER') {
        let next = tokens[i + 1];
        if (next && next[0] === 'COMPARE' && next[1] === '<' && !next.spaced) {
          let isDef = tokens[i - 1]?.[0] === 'DEF';
          let genTokens = collectBalancedAngles(tokens, i + 1);
          if (genTokens) {
            let isAlias = !isDef && tokens[i + 1 + genTokens.length]?.[0] === 'TYPE_ALIAS';
            if (isDef || isAlias) {
              if (!token.data) token.data = {};
              token.data.typeParams = genTokens.map(t => t[1]).join('');
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
          let arrowIdx = i + 1 + typeTokens.length;
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

        // Remove :: and type tokens from stream
        let removeCount = 1 + typeTokens.length;
        tokens.splice(i, removeCount);
        return 0;
      }

      // ── TYPE_ALIAS (::=) — collect type body, create TYPE_DECL marker ───
      if (tag === 'TYPE_ALIAS') {
        let nameToken = tokens[i - 1];
        if (!nameToken) return 1;
        let name = nameToken[1];
        let exported = i >= 2 && tokens[i - 2]?.[0] === 'EXPORT';
        let removeFrom = exported ? i - 2 : i - 1;
        let next = tokens[i + 1];

        let makeDecl = (typeText) => {
          let dt = gen('TYPE_DECL', name, nameToken);
          dt.data = { name, typeText, exported };
          if (nameToken.data?.typeParams) dt.data.typeParams = nameToken.data.typeParams;
          return dt;
        };

        // Structural type: Name ::= type INDENT ... OUTDENT
        if (next && next[0] === 'IDENTIFIER' && next[1] === 'type' &&
            tokens[i + 2]?.[0] === 'INDENT') {
          let endIdx = findMatchingOutdent(tokens, i + 2);
          tokens.splice(removeFrom, endIdx - removeFrom + 1, makeDecl(collectStructuralType(tokens, i + 2)));
          return 0;
        }

        // Block union: Name ::= TERMINATOR INDENT | "a" | "b" ... OUTDENT
        if (next && (next[0] === 'TERMINATOR' || next[0] === 'INDENT')) {
          let result = collectBlockUnion(tokens, i + 1);
          if (result) {
            tokens.splice(removeFrom, result.endIdx - removeFrom + 1, makeDecl(result.typeText));
            return 0;
          }
        }

        // Simple alias: Name ::= type-expression
        let typeTokens = collectTypeExpression(tokens, i + 1);
        tokens.splice(removeFrom, i + 1 + typeTokens.length - removeFrom, makeDecl(buildTypeString(typeTokens)));
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
  };
}

// ============================================================================
// Type expression collection helpers
// ============================================================================

// Collect type expression tokens starting at position j, respecting brackets
function collectTypeExpression(tokens, j) {
  let typeTokens = [];
  let depth = 0;

  while (j < tokens.length) {
    let t = tokens[j];
    let tTag = t[0];

    // Bracket balancing
    let isOpen = tTag === '(' || tTag === '[' ||
        tTag === 'CALL_START' || tTag === 'PARAM_START' || tTag === 'INDEX_START' ||
        (tTag === 'COMPARE' && t[1] === '<');
    let isClose = tTag === ')' || tTag === ']' ||
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
      if (tTag === '=' || tTag === 'REACTIVE_ASSIGN' ||
          tTag === 'COMPUTED_ASSIGN' || tTag === 'READONLY_ASSIGN' ||
          tTag === 'REACT_ASSIGN' || tTag === 'TERMINATOR' ||
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

  return typeTokens;
}

// Build a clean type string from collected tokens
function buildTypeString(typeTokens) {
  if (typeTokens.length === 0) return '';
  let typeStr = typeTokens.map(t => t[1]).join(' ').replace(/\s+/g, ' ').trim();
  typeStr = typeStr
    .replace(/\s*<\s*/g, '<').replace(/\s*>\s*/g, '>')
    .replace(/\s*\[\s*/g, '[').replace(/\s*\]\s*/g, ']')
    .replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')')
    .replace(/\s*,\s*/g, ', ');
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

    // Collect a property line: name (? optional) : type
    // Property tokens can be PROPERTY or IDENTIFIER
    if (depth === 1 && (t[0] === 'PROPERTY' || t[0] === 'IDENTIFIER')) {
      let propName = t[1];
      let optional = false;
      let readonly = false;
      j++;

      // Check for readonly prefix
      if (propName === 'readonly' && (tokens[j]?.[0] === 'PROPERTY' || tokens[j]?.[0] === 'IDENTIFIER')) {
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

      // Skip : separator
      if (tokens[j]?.[1] === ':') j++;

      // Collect the type (until TERMINATOR, OUTDENT, or next property)
      let propTypeTokens = [];
      while (j < tokens.length) {
        let pt = tokens[j];
        if (pt[0] === 'TERMINATOR' || pt[0] === 'OUTDENT' || pt[0] === 'INDENT') break;
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
// emitTypes — generate .d.ts from annotated token stream
// ============================================================================

export function emitTypes(tokens) {
  let lines = [];
  let indentLevel = 0;
  let indentStr = '  ';
  let indent = () => indentStr.repeat(indentLevel);
  let inClass = false;

  // Format { prop; prop } into multi-line block
  let emitBlock = (prefix, body, suffix) => {
    if (body.startsWith('{ ') && body.endsWith(' }')) {
      let props = body.slice(2, -2).split('; ').filter(p => p.trim());
      if (props.length > 0) {
        lines.push(`${indent()}${prefix}{`);
        indentLevel++;
        for (let prop of props) lines.push(`${indent()}${prop};`);
        indentLevel--;
        lines.push(`${indent()}}${suffix}`);
        return;
      }
    }
    lines.push(`${indent()}${prefix}${body}${suffix}`);
  };

  for (let i = 0; i < tokens.length; i++) {
    let t = tokens[i];
    let tag = t[0];

    // Track export flag
    let exported = false;
    if (tag === 'EXPORT') {
      exported = true;
      i++;
      if (i >= tokens.length) break;
      t = tokens[i];
      tag = t[0];
    }

    // TYPE_DECL marker — emit type alias or interface
    if (tag === 'TYPE_DECL') {
      let data = t.data;
      if (!data) continue;
      let exp = (exported || data.exported) ? 'export ' : '';
      let params = data.typeParams || '';

      if (data.kind === 'interface') {
        let ext = data.extends ? ` extends ${data.extends}` : '';
        emitBlock(`${exp}interface ${data.name}${params}${ext} `, data.typeText || '{}', '');
      } else {
        let typeText = expandSuffixes(data.typeText || '');
        emitBlock(`${exp}type ${data.name}${params} = `, typeText, ';');
      }
      continue;
    }

    // ENUM — emit enum declaration for .d.ts
    if (tag === 'ENUM') {
      let exp = exported ? 'export ' : '';
      let nameToken = tokens[i + 1];
      if (!nameToken) continue;
      let enumName = nameToken[1];

      // Find INDENT ... OUTDENT for enum body
      let j = i + 2;
      if (tokens[j]?.[0] === 'INDENT') {
        lines.push(`${indent()}${exp}enum ${enumName} {`);
        indentLevel++;
        j++;
        let members = [];

        while (j < tokens.length && tokens[j][0] !== 'OUTDENT') {
          if (tokens[j][0] === 'TERMINATOR') { j++; continue; }
          if (tokens[j][0] === 'IDENTIFIER') {
            let memberName = tokens[j][1];
            j++;
            if (tokens[j]?.[1] === '=') {
              j++;
              let val = tokens[j]?.[1];
              members.push(`${memberName} = ${val}`);
              j++;
            } else {
              members.push(memberName);
            }
          } else {
            j++;
          }
        }

        for (let m = 0; m < members.length; m++) {
          let comma = m < members.length - 1 ? ',' : '';
          lines.push(`${indent()}${members[m]}${comma}`);
        }

        indentLevel--;
        lines.push(`${indent()}}`);
      }
      // Don't advance i — the parser still needs to see ENUM tokens
      continue;
    }

    // CLASS — emit class declaration
    if (tag === 'CLASS') {
      let exp = exported ? 'export ' : '';
      let classNameToken = tokens[i + 1];
      if (!classNameToken) continue;
      let className = classNameToken[1];

      // Check for extends
      let ext = '';
      let j = i + 2;
      if (tokens[j]?.[0] === 'EXTENDS') {
        ext = ` extends ${tokens[j + 1]?.[1] || ''}`;
        j += 2;
      }

      // Only emit if there are typed members
      if (tokens[j]?.[0] === 'INDENT') {
        let hasTypedMembers = false;
        let k = j + 1;
        while (k < tokens.length && tokens[k][0] !== 'OUTDENT') {
          if (tokens[k].data?.type || tokens[k].data?.returnType) {
            hasTypedMembers = true;
            break;
          }
          k++;
        }
        if (hasTypedMembers) {
          lines.push(`${indent()}${exp}declare class ${className}${ext} {`);
          inClass = true;
          indentLevel++;
        }
      }
      continue;
    }

    // DEF — emit function declaration
    if (tag === 'DEF') {
      let nameToken = tokens[i + 1];
      if (!nameToken) continue;
      let fnName = nameToken[1];
      let returnType = nameToken.data?.returnType;
      let typeParams = nameToken.data?.typeParams || '';

      // Collect parameters
      let j = i + 2;
      let params = [];
      if (tokens[j]?.[0] === 'CALL_START') {
        j++;
        while (j < tokens.length && tokens[j][0] !== 'CALL_END') {
          if (tokens[j][0] === 'IDENTIFIER') {
            let paramName = tokens[j][1];
            let paramType = tokens[j].data?.type;
            if (paramType) {
              params.push(`${paramName}: ${expandSuffixes(paramType)}`);
            } else {
              params.push(paramName);
            }
          }
          j++;
        }
      }

      // Only emit if there are type annotations
      if (returnType || params.some(p => p.includes(':'))) {
        let exp = exported ? 'export ' : '';
        let declare = inClass ? '' : (exported ? '' : 'declare ');
        let ret = returnType ? `: ${expandSuffixes(returnType)}` : '';
        let paramStr = params.join(', ');
        lines.push(`${indent()}${exp}${declare}function ${fnName}${typeParams}(${paramStr})${ret};`);
      }
      continue;
    }

    // Track INDENT/OUTDENT for class body
    if (tag === 'INDENT') {
      continue;
    }
    if (tag === 'OUTDENT') {
      if (inClass) {
        indentLevel--;
        lines.push(`${indent()}}`);
        inClass = false;
      }
      continue;
    }

    // Variable assignments with type annotations
    if (tag === 'IDENTIFIER' && t.data?.type) {
      let varName = t[1];
      let type = expandSuffixes(t.data.type);
      let next = tokens[i + 1];

      if (next) {
        let exp = exported ? 'export ' : '';
        let declare = exported ? '' : 'declare ';

        if (next[0] === 'READONLY_ASSIGN') {
          lines.push(`${indent()}${exp}${declare}const ${varName}: ${type};`);
        } else if (next[0] === 'REACTIVE_ASSIGN') {
          lines.push(`${indent()}${exp}${declare}const ${varName}: Signal<${type}>;`);
        } else if (next[0] === 'COMPUTED_ASSIGN') {
          lines.push(`${indent()}${exp}${declare}const ${varName}: Computed<${type}>;`);
        } else if (next[0] === '=') {
          if (inClass) {
            lines.push(`${indent()}${varName}: ${type};`);
          } else {
            lines.push(`${indent()}${exp}let ${varName}: ${type};`);
          }
        } else if (inClass) {
          // Class property without assignment
          lines.push(`${indent()}${varName}: ${type};`);
        }
      } else if (inClass) {
        lines.push(`${indent()}${varName}: ${type};`);
      }
    }
  }

  if (lines.length === 0) return null;
  return lines.join('\n') + '\n';
}

// ============================================================================
// Suffix expansion — Rip type suffixes to TypeScript
// ============================================================================

function expandSuffixes(typeStr) {
  if (!typeStr) return typeStr;

  // Convert :: to : (annotation sigil to type separator)
  typeStr = typeStr.replace(/::/g, ':');

  // T?? → T | null | undefined
  typeStr = typeStr.replace(/(\w+(?:<[^>]+>)?)\?\?/g, '$1 | null | undefined');

  // T? → T | undefined (but not ?. or ?: which are different)
  typeStr = typeStr.replace(/(\w+(?:<[^>]+>)?)\?(?![.:])/g, '$1 | undefined');

  // T! → NonNullable<T>
  typeStr = typeStr.replace(/(\w+(?:<[^>]+>)?)\!/g, 'NonNullable<$1>');

  return typeStr;
}

// ============================================================================
// generateEnum — runtime JavaScript enum object (CodeGenerator method)
// ============================================================================

export function generateEnum(head, rest, context) {
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
