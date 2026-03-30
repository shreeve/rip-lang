(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  function __accessProp(key) {
    return this[key];
  }
  var __toCommonJS = (from) => {
    var entry = (__moduleCache ??= new WeakMap).get(from), desc;
    if (entry)
      return entry;
    entry = __defProp({}, "__esModule", { value: true });
    if (from && typeof from === "object" || typeof from === "function") {
      for (var key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(entry, key))
          __defProp(entry, key, {
            get: __accessProp.bind(from, key),
            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
          });
    }
    __moduleCache.set(from, entry);
    return entry;
  };
  var __moduleCache;
  var __returnValue = (v) => v;
  function __exportSetter(name, newValue) {
    this[name] = __returnValue.bind(null, newValue);
  }
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, {
        get: all[name],
        enumerable: true,
        configurable: true,
        set: __exportSetter.bind(all, name)
      });
  };

  // docs/dist/_entry.js
  var exports__entry = {};
  __export(exports__entry, {
    rip: () => rip,
    processRipScripts: () => processRipScripts,
    parser: () => parser,
    importRip: () => importRip,
    getStdlibCode: () => getStdlibCode,
    getReactiveRuntime: () => getReactiveRuntime,
    getComponentRuntime: () => getComponentRuntime,
    formatSExpr: () => formatSExpr,
    compileToJS: () => compileToJS,
    compile: () => compile,
    VERSION: () => VERSION,
    Lexer: () => Lexer,
    Compiler: () => Compiler,
    CodeGenerator: () => CodeGenerator,
    BUILD_DATE: () => BUILD_DATE
  });

  // src/types.js
  function installTypeSupport(Lexer) {
    let proto = Lexer.prototype;
    proto.rewriteTypes = function() {
      let tokens = this.tokens;
      let gen = (tag, val, origin) => {
        let t = [tag, val];
        t.pre = 0;
        t.data = null;
        t.loc = origin?.loc ?? { r: 0, c: 0, n: 0 };
        t.spaced = false;
        t.newLine = false;
        t.generated = true;
        if (origin)
          t.origin = origin;
        return t;
      };
      this.scanTokens((token, i, tokens2) => {
        let tag = token[0];
        if (tag === "IDENTIFIER") {
          let next = tokens2[i + 1];
          if (next && next[0] === "COMPARE" && next[1] === "<" && !next.spaced) {
            let isDef = tokens2[i - 1]?.[0] === "DEF";
            let genTokens = collectBalancedAngles(tokens2, i + 1);
            if (genTokens && isDef) {
              if (!token.data)
                token.data = {};
              token.data.typeParams = buildTypeString(genTokens);
              tokens2.splice(i + 1, genTokens.length);
              if (tokens2[i + 1]?.[0] === "(") {
                tokens2[i + 1][0] = "CALL_START";
                let d = 1, m = i + 2;
                while (m < tokens2.length && d > 0) {
                  if (tokens2[m][0] === "(" || tokens2[m][0] === "CALL_START")
                    d++;
                  if (tokens2[m][0] === ")" || tokens2[m][0] === "CALL_END")
                    d--;
                  if (d === 0)
                    tokens2[m][0] = "CALL_END";
                  m++;
                }
              }
            }
          }
        }
        if (tag === "TYPE_ANNOTATION") {
          let prevToken = tokens2[i - 1];
          if (!prevToken)
            return 1;
          let typeTokens = collectTypeExpression(tokens2, i + 1);
          let typeStr = buildTypeString(typeTokens);
          let target = prevToken;
          let propName = "type";
          if (prevToken[0] === "CALL_END" || prevToken[0] === ")") {
            let d = 1, k = i - 2;
            while (k >= 0 && d > 0) {
              let kTag = tokens2[k][0];
              if (kTag === "CALL_END" || kTag === ")")
                d++;
              if (kTag === "CALL_START" || kTag === "(")
                d--;
              k--;
            }
            if (k >= 0)
              target = tokens2[k];
            propName = "returnType";
          } else if (prevToken[0] === "PARAM_END") {
            let arrowIdx = i + 1 + typeTokens.length;
            let arrowToken = tokens2[arrowIdx];
            if (arrowToken && (arrowToken[0] === "->" || arrowToken[0] === "=>")) {
              target = arrowToken;
            }
            propName = "returnType";
          } else if (prevToken[0] === "IDENTIFIER" && i >= 2 && tokens2[i - 2]?.[0] === "DEF") {
            propName = "returnType";
          }
          if (!target.data)
            target.data = {};
          target.data[propName] = typeStr;
          let removeCount = 1 + typeTokens.length;
          tokens2.splice(i, removeCount);
          return 0;
        }
        if (tag === "IDENTIFIER" && token[1] === "type") {
          let prevTag = tokens2[i - 1]?.[0];
          let atStatement = !prevTag || prevTag === "TERMINATOR" || prevTag === "INDENT" || prevTag === "EXPORT";
          if (!atStatement)
            return 1;
          let nameIdx = i + 1;
          let nameToken = tokens2[nameIdx];
          if (!nameToken || nameToken[0] !== "IDENTIFIER")
            return 1;
          let name = nameToken[1];
          let exported = prevTag === "EXPORT";
          let removeFrom = exported ? i - 1 : i;
          let eqIdx = nameIdx + 1;
          if (tokens2[eqIdx]?.[0] === "COMPARE" && tokens2[eqIdx]?.[1] === "<" && !tokens2[eqIdx].spaced) {
            let genTokens = collectBalancedAngles(tokens2, eqIdx);
            if (genTokens) {
              if (!nameToken.data)
                nameToken.data = {};
              nameToken.data.typeParams = buildTypeString(genTokens);
              tokens2.splice(eqIdx, genTokens.length);
            }
          }
          if (tokens2[eqIdx]?.[0] !== "=")
            return 1;
          let makeDecl = (typeText) => {
            let dt = gen("TYPE_DECL", name, nameToken);
            dt.data = { name, typeText, exported };
            if (nameToken.data?.typeParams)
              dt.data.typeParams = nameToken.data.typeParams;
            return dt;
          };
          let afterEq = eqIdx + 1;
          let next = tokens2[afterEq];
          if (next && (next[0] === "TERMINATOR" || next[0] === "INDENT")) {
            let result = collectBlockUnion(tokens2, afterEq);
            if (result) {
              tokens2.splice(removeFrom, result.endIdx - removeFrom + 1, makeDecl(result.typeText));
              return 0;
            }
          }
          if (next && next[0] === "INDENT") {
            let endIdx = findMatchingOutdent(tokens2, afterEq);
            tokens2.splice(removeFrom, endIdx - removeFrom + 1, makeDecl(collectStructuralType(tokens2, afterEq)));
            return 0;
          }
          let typeTokens = collectTypeExpression(tokens2, afterEq);
          tokens2.splice(removeFrom, afterEq + typeTokens.length - removeFrom, makeDecl(buildTypeString(typeTokens)));
          return 0;
        }
        if (tag === "INTERFACE") {
          let exported = i >= 1 && tokens2[i - 1]?.[0] === "EXPORT";
          let nameIdx = i + 1;
          let nameToken = tokens2[nameIdx];
          if (!nameToken)
            return 1;
          let name = nameToken[1];
          let extendsName = null;
          let bodyIdx = nameIdx + 1;
          if (tokens2[bodyIdx]?.[0] === "EXTENDS") {
            extendsName = tokens2[bodyIdx + 1]?.[1];
            bodyIdx = bodyIdx + 2;
          }
          if (tokens2[bodyIdx]?.[0] === "INDENT") {
            let typeText = collectStructuralType(tokens2, bodyIdx);
            let endIdx = findMatchingOutdent(tokens2, bodyIdx);
            let declToken = gen("TYPE_DECL", name, nameToken);
            declToken.data = {
              name,
              kind: "interface",
              extends: extendsName,
              typeText,
              exported
            };
            let removeFrom = exported ? i - 1 : i;
            let removeCount = endIdx - removeFrom + 1;
            tokens2.splice(removeFrom, removeCount, declToken);
            return 0;
          }
          return 1;
        }
        return 1;
      });
    };
  }
  function collectTypeExpression(tokens, j) {
    let typeTokens = [];
    let depth = 0;
    while (j < tokens.length) {
      let t = tokens[j];
      let tTag = t[0];
      let isOpen = tTag === "(" || tTag === "[" || tTag === "{" || tTag === "CALL_START" || tTag === "PARAM_START" || tTag === "INDEX_START" || tTag === "COMPARE" && t[1] === "<";
      let isClose = tTag === ")" || tTag === "]" || tTag === "}" || tTag === "CALL_END" || tTag === "PARAM_END" || tTag === "INDEX_END" || tTag === "COMPARE" && t[1] === ">";
      if (tTag === "SHIFT" && t[1] === ">>" && depth >= 2) {
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
      if (depth === 0) {
        if (tTag === "=" || tTag === "REACTIVE_ASSIGN" || tTag === "COMPUTED_ASSIGN" || tTag === "READONLY_ASSIGN" || tTag === "EFFECT" || tTag === "TERMINATOR" || tTag === "INDENT" || tTag === "OUTDENT" || tTag === "->" || tTag === ",") {
          break;
        }
      }
      typeTokens.push(t);
      j++;
    }
    return typeTokens;
  }
  function buildTypeString(typeTokens) {
    if (typeTokens.length === 0)
      return "";
    if (typeTokens[0]?.[0] === "=>")
      typeTokens.unshift(["", "()"]);
    let typeStr = typeTokens.map((t) => t[1]).join(" ").replace(/\s+/g, " ").trim();
    typeStr = typeStr.replace(/\s*<\s*/g, "<").replace(/\s*>\s*/g, ">").replace(/\s*\[\s*/g, "[").replace(/\s*\]\s*/g, "]").replace(/\s*\(\s*/g, "(").replace(/\s*\)\s*/g, ")").replace(/\s*,\s*/g, ", ").replace(/\s*=>\s*/g, " => ").replace(/ :: /g, ": ").replace(/:: /g, ": ");
    return typeStr;
  }
  function collectBalancedAngles(tokens, j) {
    if (j >= tokens.length)
      return null;
    let t = tokens[j];
    if (t[0] !== "COMPARE" || t[1] !== "<")
      return null;
    let collected = [t];
    let depth = 1;
    let k = j + 1;
    while (k < tokens.length && depth > 0) {
      let tk = tokens[k];
      collected.push(tk);
      if (tk[0] === "COMPARE" && tk[1] === "<")
        depth++;
      else if (tk[0] === "COMPARE" && tk[1] === ">")
        depth--;
      k++;
    }
    return depth === 0 ? collected : null;
  }
  function collectStructuralType(tokens, indentIdx) {
    let props = [];
    let j = indentIdx + 1;
    let depth = 1;
    while (j < tokens.length && depth > 0) {
      let t = tokens[j];
      if (t[0] === "INDENT") {
        depth++;
        j++;
        continue;
      }
      if (t[0] === "OUTDENT") {
        depth--;
        if (depth === 0)
          break;
        j++;
        continue;
      }
      if (t[0] === "TERMINATOR") {
        j++;
        continue;
      }
      let isProperty = t[0] === "PROPERTY" || t[0] === "IDENTIFIER" || depth === 1 && /^[a-zA-Z_$]/.test(t[1]) && tokens[j + 1]?.[0] === "TYPE_ANNOTATION";
      if (depth === 1 && isProperty) {
        let propName = t[1];
        let optional = false;
        let readonly = false;
        j++;
        if (propName === "readonly" && tokens[j] && (tokens[j][0] === "PROPERTY" || tokens[j][0] === "IDENTIFIER" || /^[a-zA-Z_$]/.test(tokens[j][1]) && tokens[j + 1]?.[0] === "TYPE_ANNOTATION")) {
          readonly = true;
          propName = tokens[j][1];
          if (tokens[j].data?.predicate)
            optional = true;
          j++;
        }
        if (t.data?.predicate)
          optional = true;
        if (tokens[j]?.[1] === "?" && !tokens[j]?.spaced) {
          optional = true;
          j++;
        }
        if (tokens[j]?.[1] === ":" || tokens[j]?.[0] === "TYPE_ANNOTATION")
          j++;
        let propTypeTokens = [];
        let typeDepth = 0;
        while (j < tokens.length) {
          let pt = tokens[j];
          if (pt[0] === "INDENT") {
            typeDepth++;
            j++;
            continue;
          }
          if (pt[0] === "OUTDENT") {
            if (typeDepth > 0) {
              typeDepth--;
              j++;
              continue;
            }
            break;
          }
          if (pt[0] === "TERMINATOR" && typeDepth === 0)
            break;
          propTypeTokens.push(pt);
          j++;
        }
        let typeStr = buildTypeString(propTypeTokens);
        let prefix = readonly ? "readonly " : "";
        let optMark = optional ? "?" : "";
        props.push(`${prefix}${propName}${optMark}: ${typeStr}`);
      } else {
        j++;
      }
    }
    return "{ " + props.join("; ") + " }";
  }
  function findMatchingOutdent(tokens, idx) {
    let depth = 0;
    for (let j = idx;j < tokens.length; j++) {
      if (tokens[j][0] === "INDENT")
        depth++;
      if (tokens[j][0] === "OUTDENT") {
        depth--;
        if (depth === 0)
          return j;
      }
    }
    return tokens.length - 1;
  }
  function collectBlockUnion(tokens, startIdx) {
    let j = startIdx;
    if (tokens[j]?.[0] === "TERMINATOR")
      j++;
    if (tokens[j]?.[0] !== "INDENT")
      return null;
    let indentIdx = j;
    j++;
    while (j < tokens.length && tokens[j][0] === "TERMINATOR")
      j++;
    if (!tokens[j] || tokens[j][1] !== "|")
      return null;
    let members = [];
    let depth = 1;
    j = indentIdx + 1;
    while (j < tokens.length && depth > 0) {
      let t = tokens[j];
      if (t[0] === "INDENT") {
        depth++;
        j++;
        continue;
      }
      if (t[0] === "OUTDENT") {
        depth--;
        if (depth === 0)
          break;
        j++;
        continue;
      }
      if (t[0] === "TERMINATOR") {
        j++;
        continue;
      }
      if (t[1] === "|" && depth === 1) {
        j++;
        let memberTokens = [];
        while (j < tokens.length) {
          let mt = tokens[j];
          if (mt[0] === "TERMINATOR" || mt[0] === "OUTDENT" || mt[1] === "|" && depth === 1)
            break;
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
    if (members.length === 0)
      return null;
    let endIdx = findMatchingOutdent(tokens, indentIdx);
    return { typeText: members.join(" | "), endIdx };
  }
  function emitTypes(tokens, sexpr = null, source = "") {
    let lines = [];
    let indentLevel = 0;
    let indentStr = "  ";
    let indent = () => indentStr.repeat(indentLevel);
    let inClass = false;
    let classFields = new Set;
    let usesSignal = false;
    let usesComputed = false;
    let usesRipIntrinsicProps = false;
    const sourceLines = typeof source === "string" ? source.split(`
`) : [];
    for (let i = 0;i < tokens.length; i++) {
      const tag = tokens[i][0];
      if (tag === "REACTIVE_ASSIGN")
        usesSignal = true;
      else if (tag === "COMPUTED_ASSIGN")
        usesComputed = true;
    }
    let emitBlock = (prefix, body, suffix) => {
      if (body.startsWith("{ ") && body.endsWith(" }")) {
        let depth = 0, firstTopClose = -1;
        for (let c = 0;c < body.length; c++) {
          if (body[c] === "{")
            depth++;
          else if (body[c] === "}") {
            depth--;
            if (depth === 0) {
              firstTopClose = c;
              break;
            }
          }
        }
        if (firstTopClose === body.length - 1) {
          let props = body.slice(2, -2).split("; ").filter((p) => p.trim());
          if (props.length > 0) {
            lines.push(`${indent()}${prefix}{`);
            indentLevel++;
            for (let prop of props)
              lines.push(`${indent()}${prop};`);
            indentLevel--;
            lines.push(`${indent()}}${suffix}`);
            return;
          }
        }
      }
      lines.push(`${indent()}${prefix}${body}${suffix}`);
    };
    let skipDefault = (tokens2, j) => {
      j++;
      let dd = 0;
      while (j < tokens2.length) {
        let dt = tokens2[j];
        if (dt[0] === "(" || dt[0] === "[" || dt[0] === "{")
          dd++;
        if (dt[0] === ")" || dt[0] === "]" || dt[0] === "}") {
          if (dd === 0)
            break;
          dd--;
        }
        if (dd === 0 && dt[1] === ",")
          break;
        j++;
      }
      return j;
    };
    let collectDestructuredObj = (tokens2, startJ) => {
      let props = [];
      let hasAnyType = false;
      let j = startJ + 1;
      let d = 1;
      while (j < tokens2.length && d > 0) {
        if (tokens2[j][0] === "{")
          d++;
        if (tokens2[j][0] === "}")
          d--;
        if (d <= 0) {
          j++;
          break;
        }
        if (tokens2[j][0] === "..." || tokens2[j][0] === "SPREAD") {
          j++;
          if (tokens2[j]?.[0] === "IDENTIFIER") {
            props.push({ kind: "rest", propName: tokens2[j][1] });
            j++;
          }
          continue;
        }
        if (tokens2[j][0] === "PROPERTY" && tokens2[j + 1]?.[0] === ":") {
          let propName = tokens2[j][1];
          j += 2;
          if (tokens2[j]?.[0] === "{") {
            let inner = collectDestructuredObj(tokens2, j);
            if (inner.hasAnyType)
              hasAnyType = true;
            props.push({ kind: "nested-obj", propName, inner });
            j = inner.endJ;
            continue;
          }
          if (tokens2[j]?.[0] === "[") {
            let inner = collectDestructuredArr(tokens2, j);
            if (inner.hasAnyType)
              hasAnyType = true;
            props.push({ kind: "nested-arr", propName, inner });
            j = inner.endJ;
            continue;
          }
          if (tokens2[j]?.[0] === "IDENTIFIER") {
            let localName = tokens2[j][1];
            let type = tokens2[j].data?.type;
            if (type)
              hasAnyType = true;
            let hasDefault = tokens2[j + 1]?.[0] === "=";
            props.push({ kind: "rename", propName, localName, type: type ? expandSuffixes(type) : null, hasDefault });
            j++;
            if (hasDefault)
              j = skipDefault(tokens2, j);
          }
          continue;
        }
        if (tokens2[j][0] === "IDENTIFIER") {
          let name = tokens2[j][1];
          let type = tokens2[j].data?.type;
          if (type)
            hasAnyType = true;
          let hasDefault = tokens2[j + 1]?.[0] === "=";
          props.push({ kind: "simple", propName: name, type: type ? expandSuffixes(type) : null, hasDefault });
          j++;
          if (hasDefault)
            j = skipDefault(tokens2, j);
          continue;
        }
        j++;
      }
      let patternParts = [];
      let typeParts = [];
      for (let p of props) {
        if (p.kind === "rest") {
          patternParts.push(`...${p.propName}`);
          typeParts.push(`[key: string]: unknown`);
        } else if (p.kind === "nested-obj" || p.kind === "nested-arr") {
          patternParts.push(`${p.propName}: ${p.inner.patternStr}`);
          typeParts.push(`${p.propName}: ${p.inner.typeStr}`);
        } else if (p.kind === "rename") {
          patternParts.push(`${p.propName}: ${p.localName}`);
          typeParts.push(`${p.propName}${p.hasDefault ? "?" : ""}: ${p.type || "any"}`);
        } else {
          patternParts.push(p.propName);
          typeParts.push(`${p.propName}${p.hasDefault ? "?" : ""}: ${p.type || "any"}`);
        }
      }
      return {
        patternStr: `{${patternParts.join(", ")}}`,
        typeStr: `{${typeParts.join(", ")}}`,
        endJ: j,
        hasAnyType
      };
    };
    let collectDestructuredArr = (tokens2, startJ) => {
      let names = [];
      let elemTypes = [];
      let hasAnyType = false;
      let j = startJ + 1;
      let d = 1;
      while (j < tokens2.length && d > 0) {
        if (tokens2[j][0] === "[")
          d++;
        if (tokens2[j][0] === "]")
          d--;
        if (d > 0 && tokens2[j][0] === "IDENTIFIER") {
          let name = tokens2[j][1];
          let type = tokens2[j].data?.type;
          names.push(name);
          elemTypes.push(type ? expandSuffixes(type) : null);
          if (type)
            hasAnyType = true;
        }
        j++;
      }
      return {
        patternStr: `[${names.join(", ")}]`,
        typeStr: `[${elemTypes.map((t) => t || "any").join(", ")}]`,
        endJ: j,
        hasAnyType
      };
    };
    let collectParams = (tokens2, startIdx) => {
      let params = [];
      let fields = [];
      let j = startIdx;
      let openTag = tokens2[j]?.[0];
      if (openTag !== "CALL_START" && openTag !== "PARAM_START")
        return { params, fields, endIdx: j };
      let closeTag = openTag === "CALL_START" ? "CALL_END" : "PARAM_END";
      j++;
      let depth = 0;
      while (j < tokens2.length && !(tokens2[j][0] === closeTag && depth === 0)) {
        let tok = tokens2[j];
        if (tok[1] === "," && depth === 0) {
          j++;
          continue;
        }
        if (tok[0] === "{" || tok[0] === "[" || tok[0] === "CALL_START" || tok[0] === "PARAM_START" || tok[0] === "INDEX_START")
          depth++;
        if (tok[0] === "}" || tok[0] === "]" || tok[0] === "CALL_END" || tok[0] === "PARAM_END" || tok[0] === "INDEX_END") {
          depth--;
          j++;
          continue;
        }
        if (tok[0] === "@") {
          j++;
          if (tokens2[j]?.[0] === "PROPERTY" || tokens2[j]?.[0] === "IDENTIFIER") {
            let name = tokens2[j][1];
            let type = tokens2[j].data?.type;
            params.push(type ? `${name}: ${expandSuffixes(type)}` : name);
            if (type)
              fields.push({ name, type: expandSuffixes(type) });
            j++;
          }
          continue;
        }
        if (tok[0] === "SPREAD" || tok[1] === "...") {
          j++;
          if (tokens2[j]?.[0] === "IDENTIFIER") {
            let name = tokens2[j][1];
            let type = tokens2[j].data?.type;
            params.push(type ? `...${name}: ${expandSuffixes(type)}` : `...${name}: any[]`);
            j++;
          }
          continue;
        }
        if (tok[0] === "{") {
          depth--;
          let result = collectDestructuredObj(tokens2, j);
          j = result.endJ;
          if (result.hasAnyType) {
            params.push(`${result.patternStr}: ${result.typeStr}`);
          } else {
            params.push(result.patternStr);
          }
          continue;
        }
        if (tok[0] === "[") {
          depth--;
          let result = collectDestructuredArr(tokens2, j);
          j = result.endJ;
          if (result.hasAnyType) {
            params.push(`${result.patternStr}: ${result.typeStr}`);
          } else {
            params.push(result.patternStr);
          }
          continue;
        }
        if (tok[0] === "IDENTIFIER") {
          let paramName = tok[1];
          let paramType = tok.data?.type;
          let hasDefault = false;
          if (tokens2[j + 1]?.[0] === "=") {
            hasDefault = true;
          }
          let isOptional = hasDefault || tok.data?.predicate;
          if (paramType) {
            params.push(`${paramName}${isOptional ? "?" : ""}: ${expandSuffixes(paramType)}`);
          } else {
            params.push(paramName);
          }
          j++;
          if (hasDefault) {
            j++;
            let dd = 0;
            while (j < tokens2.length) {
              let dt = tokens2[j];
              if (dt[0] === "(" || dt[0] === "[" || dt[0] === "{")
                dd++;
              if (dt[0] === ")" || dt[0] === "]" || dt[0] === "}")
                dd--;
              if (dd === 0 && (dt[1] === "," || dt[0] === "CALL_END"))
                break;
              j++;
            }
          }
          continue;
        }
        j++;
      }
      return { params, fields, endIdx: j };
    };
    for (let i = 0;i < tokens.length; i++) {
      let t = tokens[i];
      let tag = t[0];
      let exported = false;
      if (tag === "EXPORT") {
        exported = true;
        i++;
        if (i >= tokens.length)
          break;
        t = tokens[i];
        tag = t[0];
        if (tag === "DEFAULT") {
          i++;
          if (i >= tokens.length)
            break;
          t = tokens[i];
          tag = t[0];
          if (tag === "IDENTIFIER") {
            lines.push(`${indent()}export default ${t[1]};`);
          }
          continue;
        }
      }
      if (tag === "IMPORT") {
        let importTokens = [];
        let j = i + 1;
        while (j < tokens.length && tokens[j][0] !== "TERMINATOR") {
          importTokens.push(tokens[j]);
          j++;
        }
        let raw = "import " + importTokens.map((tk) => tk[1]).join(" ");
        raw = raw.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").replace(/\{\s*/g, "{ ").replace(/\s*\}/g, " }").trim();
        lines.push(`${indent()}${raw};`);
        i = j;
        continue;
      }
      if (tag === "TYPE_DECL") {
        let data = t.data;
        if (!data)
          continue;
        let exp = exported || data.exported ? "export " : "";
        let params = data.typeParams || "";
        if (data.kind === "interface") {
          let ext = data.extends ? ` extends ${data.extends}` : "";
          emitBlock(`${exp}interface ${data.name}${params}${ext} `, data.typeText || "{}", "");
        } else {
          let typeText = expandSuffixes(data.typeText || "");
          emitBlock(`${exp}type ${data.name}${params} = `, typeText, ";");
        }
        continue;
      }
      if (tag === "ENUM") {
        let exp = exported ? "export " : "";
        let nameToken = tokens[i + 1];
        if (!nameToken)
          continue;
        let enumName = nameToken[1];
        let j = i + 2;
        if (tokens[j]?.[0] === "INDENT") {
          lines.push(`${indent()}${exp}enum ${enumName} {`);
          indentLevel++;
          j++;
          let members = [];
          while (j < tokens.length && tokens[j][0] !== "OUTDENT") {
            if (tokens[j][0] === "TERMINATOR") {
              j++;
              continue;
            }
            if (tokens[j][0] === "IDENTIFIER") {
              let memberName = tokens[j][1];
              j++;
              if (tokens[j]?.[1] === "=") {
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
          for (let m = 0;m < members.length; m++) {
            let comma = m < members.length - 1 ? "," : "";
            lines.push(`${indent()}${members[m]}${comma}`);
          }
          indentLevel--;
          lines.push(`${indent()}}`);
        }
        continue;
      }
      if (tag === "CLASS") {
        let exp = exported ? "export " : "";
        let classNameToken = tokens[i + 1];
        if (!classNameToken)
          continue;
        let className = classNameToken[1];
        let ext = "";
        let j = i + 2;
        if (tokens[j]?.[0] === "EXTENDS") {
          ext = ` extends ${tokens[j + 1]?.[1] || ""}`;
          j += 2;
        }
        if (tokens[j]?.[0] === "INDENT") {
          let hasTypedMembers = false;
          let k = j + 1;
          while (k < tokens.length && tokens[k][0] !== "OUTDENT") {
            if (tokens[k].data?.type || tokens[k].data?.returnType) {
              hasTypedMembers = true;
              break;
            }
            k++;
          }
          if (hasTypedMembers) {
            lines.push(`${indent()}${exp}declare class ${className}${ext} {`);
            inClass = true;
            classFields.clear();
            indentLevel++;
          }
        }
        continue;
      }
      if (tag === "DEF") {
        let nameToken = tokens[i + 1];
        if (!nameToken)
          continue;
        let fnName = nameToken[1];
        let returnType = nameToken.data?.returnType;
        if (!returnType && nameToken.data?.await === true)
          returnType = "void";
        let typeParams = nameToken.data?.typeParams || "";
        let { params, endIdx } = collectParams(tokens, i + 2);
        if (returnType || params.some((p) => p.includes(":"))) {
          let exp = exported ? "export " : "";
          let declare = inClass ? "" : exported ? "" : "declare ";
          let ret = returnType ? `: ${expandSuffixes(returnType)}` : "";
          let paramStr = params.join(", ");
          if (inClass) {
            lines.push(`${indent()}${fnName}${typeParams}(${paramStr})${ret};`);
          } else {
            lines.push(`${indent()}${exp}${declare}function ${fnName}${typeParams}(${paramStr})${ret};`);
          }
        }
        i = endIdx;
        continue;
      }
      if (tag === "{" && inClass) {
        let j = i + 1;
        let braceDepth = 1;
        while (j < tokens.length && braceDepth > 0) {
          let tok = tokens[j];
          if (tok[0] === "{") {
            braceDepth++;
            j++;
            continue;
          }
          if (tok[0] === "}") {
            braceDepth--;
            j++;
            continue;
          }
          if (tok[0] === "TERMINATOR") {
            j++;
            continue;
          }
          if (tok[0] === "PROPERTY" && braceDepth === 1) {
            let methodName = tok[1];
            let returnType = tok.data?.returnType;
            j++;
            if (tokens[j]?.[1] === ":")
              j++;
            let params = [];
            let fields = [];
            if (tokens[j]?.[0] === "PARAM_START") {
              let result = collectParams(tokens, j);
              params = result.params;
              fields = result.fields;
              j = result.endIdx + 1;
            }
            if (tokens[j]?.[0] === "->" || tokens[j]?.[0] === "=>")
              j++;
            if (tokens[j]?.[0] === "INDENT") {
              let d = 1;
              j++;
              while (j < tokens.length && d > 0) {
                if (tokens[j][0] === "INDENT")
                  d++;
                if (tokens[j][0] === "OUTDENT")
                  d--;
                j++;
              }
            }
            if (returnType || params.some((p) => p.includes(":"))) {
              let ret = returnType ? `: ${expandSuffixes(returnType)}` : "";
              let paramStr = params.join(", ");
              if (methodName === "constructor" && fields.length) {
                for (let f of fields) {
                  if (!classFields.has(f.name)) {
                    lines.push(`${indent()}${f.name}: ${f.type};`);
                    classFields.add(f.name);
                  }
                }
              }
              lines.push(`${indent()}${methodName}(${paramStr})${ret};`);
            }
            continue;
          }
          j++;
        }
        i = j - 1;
        continue;
      }
      if (tag === "INDENT") {
        continue;
      }
      if (tag === "OUTDENT") {
        if (inClass) {
          indentLevel--;
          lines.push(`${indent()}}`);
          inClass = false;
        }
        continue;
      }
      if (tag === "IDENTIFIER" && !inClass && tokens[i + 1]?.[0] === "=" && (tokens[i + 2]?.[0] === "PARAM_START" || tokens[i + 2]?.[0] === "(")) {
        let fnName = t[1];
        let j = i + 2;
        let { params } = collectParams(tokens, j);
        let k = j;
        let depth = 0;
        while (k < tokens.length) {
          if (tokens[k][0] === "PARAM_START" || tokens[k][0] === "(")
            depth++;
          if (tokens[k][0] === "PARAM_END" || tokens[k][0] === ")")
            depth--;
          if (depth === 0 && (tokens[k][0] === "->" || tokens[k][0] === "=>"))
            break;
          k++;
        }
        let returnType = tokens[k]?.data?.returnType;
        if (returnType || params.some((p) => p.includes(":"))) {
          let exp = exported ? "export " : "";
          let declare = exported ? "" : "declare ";
          let ret = returnType ? `: ${expandSuffixes(returnType)}` : "";
          let paramStr = params.join(", ");
          lines.push(`${indent()}${exp}${declare}function ${fnName}(${paramStr})${ret};`);
          continue;
        }
      }
      if (tag === "IDENTIFIER" && t.data?.type) {
        let varName = t[1];
        let type = expandSuffixes(t.data.type);
        let next = tokens[i + 1];
        if (next) {
          let exp = exported ? "export " : "";
          let declare = exported ? "" : "declare ";
          if (next[0] === "READONLY_ASSIGN") {
            lines.push(`${indent()}${exp}${declare}const ${varName}: ${type};`);
          } else if (next[0] === "REACTIVE_ASSIGN") {
            usesSignal = true;
            lines.push(`${indent()}${exp}${declare}const ${varName}: Signal<${type}>;`);
          } else if (next[0] === "COMPUTED_ASSIGN") {
            usesComputed = true;
            lines.push(`${indent()}${exp}${declare}const ${varName}: Computed<${type}>;`);
          } else if (next[0] === "EFFECT") {
            lines.push(`${indent()}${exp}${declare}const ${varName}: () => void;`);
          } else if (next[0] === "=") {
            let arrowIdx = i + 2;
            if (tokens[arrowIdx]?.[0] === "PARAM_START") {
              let d = 1, k = arrowIdx + 1;
              while (k < tokens.length && d > 0) {
                if (tokens[k][0] === "PARAM_START")
                  d++;
                if (tokens[k][0] === "PARAM_END")
                  d--;
                k++;
              }
              arrowIdx = k;
            }
            let arrowToken = tokens[arrowIdx];
            if (arrowToken && (arrowToken[0] === "->" || arrowToken[0] === "=>") && arrowToken.data?.returnType) {
              let returnType = expandSuffixes(arrowToken.data.returnType);
              let { params } = collectParams(tokens, i + 2);
              let paramStr = params.join(", ");
              lines.push(`${indent()}${exp}${declare}function ${varName}(${paramStr}): ${returnType};`);
            } else if (inClass) {
              lines.push(`${indent()}${varName}: ${type};`);
              classFields.add(varName);
            } else {
              lines.push(`${indent()}${exp}let ${varName}: ${type};`);
            }
          } else if (inClass) {
            lines.push(`${indent()}${varName}: ${type};`);
            classFields.add(varName);
          }
        } else if (inClass) {
          lines.push(`${indent()}${varName}: ${type};`);
        }
      }
    }
    let componentVars = new Set;
    if (sexpr) {
      usesRipIntrinsicProps = emitComponentTypes(sexpr, lines, indent, indentLevel, componentVars, sourceLines) || usesRipIntrinsicProps;
      if (componentVars.size > 0) {
        for (let k = lines.length - 1;k >= 0; k--) {
          let match = lines[k].match(/(?:declare |export )*(?:const|let) (\w+)/);
          if (match && componentVars.has(match[1]))
            lines.splice(k, 1);
        }
      }
    }
    if (lines.length === 0)
      return null;
    let preamble = [];
    if (usesRipIntrinsicProps) {
      preamble.push("type __RipElementMap = HTMLElementTagNameMap & Omit<SVGElementTagNameMap, keyof HTMLElementTagNameMap>;");
      preamble.push("type __RipTag = keyof __RipElementMap;");
      preamble.push("type __RipBrowserElement = Omit<HTMLElement, 'querySelector' | 'querySelectorAll' | 'closest' | 'setAttribute' | 'hidden'> & { hidden: boolean | 'until-found'; setAttribute(qualifiedName: string, value: any): void; querySelector(selectors: string): __RipBrowserElement | null; querySelectorAll(selectors: string): NodeListOf<__RipBrowserElement>; closest(selectors: string): __RipBrowserElement | null; };");
      preamble.push("type __RipDomEl<K extends __RipTag> = Omit<__RipElementMap[K], 'querySelector' | 'querySelectorAll' | 'closest' | 'setAttribute' | 'hidden'> & __RipBrowserElement;");
      preamble.push("type __RipAttrKeys<T> = { [K in keyof T]-?: K extends 'style' ? never : T[K] extends (...args: any[]) => any ? never : K }[keyof T] & string;");
      preamble.push("type __RipEvents = { [K in keyof HTMLElementEventMap as `@${K}`]?: ((event: HTMLElementEventMap[K]) => void) | null };");
      preamble.push("type __RipClassValue = string | boolean | null | undefined | Record<string, boolean> | __RipClassValue[]");
      preamble.push("type __RipProps<K extends __RipTag> = { [P in __RipAttrKeys<__RipElementMap[K]>]?: __RipElementMap[K][P] } & __RipEvents & { ref?: string; class?: __RipClassValue | __RipClassValue[]; style?: string; [k: `data-${string}`]: any; [k: `aria-${string}`]: any };");
    }
    if (/\bARIA\./.test(source)) {
      preamble.push("type __RipAriaNavHandlers = { next?: () => void; prev?: () => void; first?: () => void; last?: () => void; select?: () => void; dismiss?: () => void; tab?: () => void; char?: () => void; };");
      preamble.push("declare const ARIA: {");
      preamble.push("  bindPopover(open: boolean, popover: () => Element | null | undefined, setOpen: (isOpen: boolean) => void, source?: (() => Element | null | undefined) | null): void;");
      preamble.push("  bindDialog(open: boolean, dialog: () => Element | null | undefined, setOpen: (isOpen: boolean) => void, dismissable?: boolean): void;");
      preamble.push("  popupDismiss(open: boolean, popup: () => Element | null | undefined, close: () => void, els?: Array<() => Element | null | undefined>, repos?: (() => void) | null): void;");
      preamble.push("  popupGuard(delay?: number): any;");
      preamble.push("  listNav(event: KeyboardEvent, handlers: __RipAriaNavHandlers): void;");
      preamble.push("  rovingNav(event: KeyboardEvent, handlers: __RipAriaNavHandlers, orientation?: 'vertical' | 'horizontal' | 'both'): void;");
      preamble.push("  positionBelow(trigger: Element | null | undefined, popup: Element | null | undefined, gap?: number, setVisible?: boolean): void;");
      preamble.push("  position(trigger: Element | null | undefined, floating: Element | null | undefined, opts?: any): void;");
      preamble.push("  trapFocus(panel: Element | null | undefined): void;");
      preamble.push("  wireAria(panel: Element, id: string): void;");
      preamble.push("  lockScroll(instance: any): void;");
      preamble.push("  unlockScroll(instance: any): void;");
      preamble.push("  hasAnchor: boolean;");
      preamble.push("  [key: string]: any;");
      preamble.push("};");
    }
    if (usesSignal) {
      preamble.push("interface Signal<T> { value: T; read(): T; lock(): Signal<T>; free(): Signal<T>; kill(): T; }");
      preamble.push("declare function __state<T>(value: T | Signal<T>): Signal<T>;");
    }
    if (usesComputed) {
      preamble.push("interface Computed<T> { readonly value: T; read(): T; lock(): Computed<T>; free(): Computed<T>; kill(): T; }");
      preamble.push("declare function __computed<T>(fn: () => T): Computed<T>;");
    }
    if (usesSignal || usesComputed) {
      preamble.push("declare function __effect(fn: () => void | (() => void)): () => void;");
    }
    if (preamble.length > 0) {
      preamble.push("");
    }
    return preamble.concat(lines).join(`
`) + `
`;
  }
  function expandSuffixes(typeStr) {
    if (!typeStr)
      return typeStr;
    typeStr = typeStr.replace(/::/g, ":");
    typeStr = typeStr.replace(/(\w+(?:<[^>]+>)?)\?\?/g, "$1 | null | undefined");
    typeStr = typeStr.replace(/(\w+(?:<[^>]+>)?)\?(?![.:])/g, "$1 | undefined");
    typeStr = typeStr.replace(/(\w+(?:<[^>]+>)?)\!/g, "NonNullable<$1>");
    return typeStr;
  }
  function emitComponentTypes(sexpr, lines, indent, indentLevel, componentVars, sourceLines) {
    if (!Array.isArray(sexpr))
      return false;
    let head = sexpr[0]?.valueOf?.() ?? sexpr[0];
    let usesIntrinsicProps = false;
    const refMembers = new Map;
    const isIntrinsicTag = (name2) => typeof name2 === "string" && /^[a-z]/.test(name2);
    const collectRefMembers = (node) => {
      if (!Array.isArray(node))
        return;
      let nodeHead = node[0]?.valueOf?.() ?? node[0];
      if (isIntrinsicTag(nodeHead)) {
        for (let i = 1;i < node.length; i++) {
          let child = node[i];
          if (!Array.isArray(child))
            continue;
          let childHead = child[0]?.valueOf?.() ?? child[0];
          if (childHead !== "object")
            continue;
          for (let j = 1;j < child.length; j++) {
            let entry = child[j];
            if (!Array.isArray(entry))
              continue;
            let key = entry[0]?.valueOf?.() ?? entry[0];
            if (key !== "ref")
              continue;
            let refName = entry[1]?.valueOf?.() ?? entry[1];
            if (typeof refName === "string")
              refName = refName.replace(/^["']|["']$/g, "");
            if (typeof refName === "string" && !refMembers.has(refName)) {
              refMembers.set(refName, `__RipDomEl<'${nodeHead}'> | null`);
            }
          }
        }
      }
      for (let i = 1;i < node.length; i++) {
        if (Array.isArray(node[i]))
          collectRefMembers(node[i]);
      }
    };
    let exported = false;
    let name = null;
    let compNode = null;
    if (head === "export" && Array.isArray(sexpr[1])) {
      exported = true;
      let inner = sexpr[1];
      let innerHead = inner[0]?.valueOf?.() ?? inner[0];
      if (innerHead === "=" && Array.isArray(inner[2]) && (inner[2][0]?.valueOf?.() ?? inner[2][0]) === "component") {
        name = inner[1]?.valueOf?.() ?? inner[1];
        compNode = inner[2];
      }
    } else if (head === "=" && Array.isArray(sexpr[2]) && (sexpr[2][0]?.valueOf?.() ?? sexpr[2][0]) === "component") {
      name = sexpr[1]?.valueOf?.() ?? sexpr[1];
      compNode = sexpr[2];
    }
    if (name && compNode) {
      let exp = exported ? "export " : "";
      let inheritsTag = compNode[1]?.valueOf?.() ?? null;
      let inheritedPropsType = inheritsTag ? `__RipProps<'${inheritsTag}'>` : null;
      if (inheritedPropsType)
        usesIntrinsicProps = true;
      let body = compNode[2];
      let members = Array.isArray(body) && (body[0]?.valueOf?.() ?? body[0]) === "block" ? body.slice(1) : body ? [body] : [];
      let publicProps = [];
      let bodyMembers = [];
      let hasRequired = false;
      let inferLiteralType = (v) => {
        let s = v?.valueOf?.() ?? v;
        if (typeof s !== "string")
          return null;
        if (s === "true" || s === "false")
          return "boolean";
        if (/^-?\d+(\.\d+)?$/.test(s))
          return "number";
        if (s.startsWith('"') || s.startsWith("'"))
          return "string";
        return null;
      };
      for (let member of members) {
        if (!Array.isArray(member))
          continue;
        let mHead = member[0]?.valueOf?.() ?? member[0];
        let target, propName, isProp, type, hasDefault;
        if (mHead === "state" || mHead === "readonly" || mHead === "computed") {
          target = member[1];
          isProp = Array.isArray(target) && (target[0]?.valueOf?.() ?? target[0]) === "." && (target[1]?.valueOf?.() ?? target[1]) === "this";
          propName = isProp ? target[2]?.valueOf?.() ?? target[2] : target?.valueOf?.() ?? target;
          type = isProp ? target[2]?.type : target?.type;
          hasDefault = true;
          if (!isProp) {
            componentVars.add(propName);
            let wrapper = mHead === "computed" ? "Computed" : "Signal";
            let typeStr2 = type ? expandSuffixes(type) : inferLiteralType(member[2]) || "any";
            bodyMembers.push(`  ${propName}: ${wrapper}<${typeStr2}>;`);
            continue;
          }
        } else if (mHead === ".") {
          isProp = (member[1]?.valueOf?.() ?? member[1]) === "this";
          propName = isProp ? member[2]?.valueOf?.() ?? member[2] : null;
          type = isProp ? member[2]?.type : null;
          hasDefault = false;
          if (!isProp && propName)
            componentVars.add(propName);
        } else if (mHead === "object") {
          for (let i = 1;i < member.length; i++) {
            let entry = member[i];
            if (!Array.isArray(entry) || entry.length < 3)
              continue;
            let methName = entry[1]?.valueOf?.() ?? entry[1];
            let funcDef = entry[2];
            if (!Array.isArray(funcDef))
              continue;
            let fHead = funcDef[0]?.valueOf?.() ?? funcDef[0];
            if (fHead !== "->" && fHead !== "=>")
              continue;
            let params = funcDef[1];
            if (!Array.isArray(params))
              continue;
            let hasTypedParams = params.some((p) => p?.type);
            if (!hasTypedParams)
              continue;
            let paramStrs = [];
            for (let p of params) {
              let pName = p?.valueOf?.() ?? p;
              let pType = p?.type ? expandSuffixes(p.type) : "any";
              paramStrs.push(`${pName}: ${pType}`);
            }
            bodyMembers.push(`  ${methName}(${paramStrs.join(", ")}): void;`);
          }
          continue;
        } else if (mHead === "render") {
          usesIntrinsicProps = true;
          collectRefMembers(member[1]);
          continue;
        } else {
          continue;
        }
        if (!isProp || !propName)
          continue;
        let typeStr = type ? expandSuffixes(type) : "any";
        let opt = hasDefault ? "?" : "";
        if (!hasDefault)
          hasRequired = true;
        publicProps.push(`    ${propName}${opt}: ${typeStr};`);
        if (mHead === "state") {
          publicProps.push(`    __bind_${propName}__?: Signal<${typeStr}>;`);
        }
      }
      lines.push(`${exp}declare class ${name} {`);
      if (publicProps.length > 0 || inheritedPropsType) {
        let propsOpt = hasRequired ? "" : "?";
        if (publicProps.length > 0) {
          lines.push(`  constructor(props${propsOpt}: {`);
          for (let p of publicProps)
            lines.push(p);
          lines.push(inheritedPropsType ? `  } & ${inheritedPropsType});` : "  });");
        } else {
          lines.push(`  constructor(props${propsOpt}: ${inheritedPropsType});`);
        }
      }
      for (let [refName, refType] of refMembers) {
        bodyMembers.push(`  ${refName}: ${refType};`);
      }
      for (let m of bodyMembers)
        lines.push(m);
      lines.push(`}`);
    }
    if (head === "program" || head === "block") {
      for (let i = 1;i < sexpr.length; i++) {
        if (Array.isArray(sexpr[i])) {
          usesIntrinsicProps = emitComponentTypes(sexpr[i], lines, indent, indentLevel, componentVars, sourceLines) || usesIntrinsicProps;
        }
      }
    }
    if (head === "export" && Array.isArray(sexpr[1]) && !compNode) {
      usesIntrinsicProps = emitComponentTypes(sexpr[1], lines, indent, indentLevel, componentVars, sourceLines) || usesIntrinsicProps;
    }
    return usesIntrinsicProps;
  }
  function generateEnum(head, rest, context) {
    let [name, body] = rest;
    let enumName = name?.valueOf?.() ?? name;
    let pairs = [];
    if (Array.isArray(body)) {
      let items = body[0] === "block" ? body.slice(1) : [body];
      for (let item of items) {
        if (Array.isArray(item)) {
          if (item[0]?.valueOf?.() === "=") {
            let key = item[1]?.valueOf?.() ?? item[1];
            let val = item[2]?.valueOf?.() ?? item[2];
            pairs.push([key, val]);
          }
        }
      }
    }
    if (pairs.length === 0)
      return `const ${enumName} = {}`;
    let forward = pairs.map(([k, v]) => `${k}: ${v}`).join(", ");
    let reverse = pairs.map(([k, v]) => `${v}: "${k}"`).join(", ");
    return `const ${enumName} = {${forward}, ${reverse}}`;
  }

  // src/lexer.js
  var JS_KEYWORDS = new Set([
    "true",
    "false",
    "null",
    "this",
    "new",
    "delete",
    "typeof",
    "in",
    "instanceof",
    "return",
    "throw",
    "break",
    "continue",
    "debugger",
    "yield",
    "await",
    "if",
    "else",
    "switch",
    "for",
    "while",
    "do",
    "try",
    "catch",
    "finally",
    "class",
    "extends",
    "super",
    "import",
    "export",
    "default"
  ]);
  var RIP_KEYWORDS = new Set([
    "undefined",
    "Infinity",
    "NaN",
    "then",
    "unless",
    "until",
    "loop",
    "of",
    "by",
    "when",
    "def",
    "component",
    "render",
    "enum",
    "interface"
  ]);
  var ALIASES = {
    and: "&&",
    or: "||",
    is: "==",
    isnt: "!=",
    not: "!",
    yes: "true",
    no: "false",
    on: "true",
    off: "false"
  };
  var ALIAS_WORDS = new Set(Object.keys(ALIASES));
  var RESERVED = new Set([
    "case",
    "function",
    "var",
    "void",
    "with",
    "const",
    "let",
    "native",
    "implements",
    "package",
    "private",
    "protected",
    "public",
    "static"
  ]);
  var STATEMENTS = new Set(["break", "continue", "debugger"]);
  var UNARY_WORDS = new Set(["NEW", "TYPEOF", "DELETE"]);
  var RELATIONS = new Set(["IN", "OF", "INSTANCEOF"]);
  var CALLABLE = new Set([
    "IDENTIFIER",
    "PROPERTY",
    ")",
    "]",
    "@",
    "THIS",
    "SUPER",
    "DYNAMIC_IMPORT",
    "?."
  ]);
  var INDEXABLE = new Set([
    ...CALLABLE,
    "NUMBER",
    "INFINITY",
    "NAN",
    "STRING",
    "STRING_END",
    "REGEX",
    "REGEX_END",
    "BOOL",
    "NULL",
    "UNDEFINED",
    "}",
    "MAP_END"
  ]);
  var IMPLICIT_CALL = new Set([
    "IDENTIFIER",
    "PROPERTY",
    "NUMBER",
    "INFINITY",
    "NAN",
    "STRING",
    "STRING_START",
    "REGEX",
    "REGEX_START",
    "JS",
    "NEW",
    "PARAM_START",
    "CLASS",
    "IF",
    "TRY",
    "SWITCH",
    "THIS",
    "DYNAMIC_IMPORT",
    "IMPORT_META",
    "NEW_TARGET",
    "UNDEFINED",
    "NULL",
    "BOOL",
    "UNARY",
    "DO",
    "DO_IIFE",
    "YIELD",
    "AWAIT",
    "UNARY_MATH",
    "SUPER",
    "THROW",
    "@",
    "->",
    "=>",
    "[",
    "(",
    "{",
    "MAP_START",
    "--",
    "++"
  ]);
  var IMPLICIT_UNSPACED_CALL = new Set(["+", "-"]);
  var IMPLICIT_END = new Set([
    "POST_IF",
    "POST_UNLESS",
    "FOR",
    "WHILE",
    "UNTIL",
    "WHEN",
    "BY",
    "LOOP",
    "TERMINATOR",
    "||",
    "&&",
    "PIPE"
  ]);
  var IMPLICIT_COMMA_BEFORE_ARROW = new Set([
    "STRING",
    "STRING_END",
    "REGEX",
    "REGEX_END",
    "NUMBER",
    "BOOL",
    "NULL",
    "UNDEFINED",
    "INFINITY",
    "NAN",
    "]",
    "}",
    "MAP_END"
  ]);
  var EXPRESSION_START = new Set(["(", "[", "{", "MAP_START", "INDENT", "CALL_START", "PARAM_START", "INDEX_START", "STRING_START", "INTERPOLATION_START", "REGEX_START"]);
  var EXPRESSION_END = new Set([")", "]", "}", "MAP_END", "OUTDENT", "CALL_END", "PARAM_END", "INDEX_END", "STRING_END", "INTERPOLATION_END", "REGEX_END"]);
  var INVERSES = {
    "(": ")",
    ")": "(",
    "[": "]",
    "]": "[",
    "{": "}",
    "}": "{",
    INDENT: "OUTDENT",
    OUTDENT: "INDENT",
    CALL_START: "CALL_END",
    CALL_END: "CALL_START",
    PARAM_START: "PARAM_END",
    PARAM_END: "PARAM_START",
    INDEX_START: "INDEX_END",
    INDEX_END: "INDEX_START",
    STRING_START: "STRING_END",
    STRING_END: "STRING_START",
    INTERPOLATION_START: "INTERPOLATION_END",
    INTERPOLATION_END: "INTERPOLATION_START",
    REGEX_START: "REGEX_END",
    REGEX_END: "REGEX_START",
    MAP_START: "MAP_END",
    MAP_END: "MAP_START"
  };
  var EXPRESSION_CLOSE = new Set(["CATCH", "THEN", "ELSE", "FINALLY", ...EXPRESSION_END]);
  var IMPLICIT_FUNC = new Set([
    "IDENTIFIER",
    "PROPERTY",
    "SUPER",
    ")",
    "CALL_END",
    "]",
    "INDEX_END",
    "@",
    "THIS"
  ]);
  var TAGGABLE = new Set(["IDENTIFIER", "PROPERTY", ")", "CALL_END", "]", "INDEX_END"]);
  var CONTROL_IN_IMPLICIT = new Set(["IF", "TRY", "FINALLY", "CATCH", "CLASS", "SWITCH", "COMPONENT"]);
  var SINGLE_LINERS = new Set(["ELSE", "->", "=>", "TRY", "FINALLY", "THEN"]);
  var SINGLE_CLOSERS = new Set(["TERMINATOR", "CATCH", "FINALLY", "ELSE", "OUTDENT", "LEADING_WHEN"]);
  var LINE_BREAK = new Set(["INDENT", "OUTDENT", "TERMINATOR"]);
  var CALL_CLOSERS = new Set([".", "?."]);
  var UNFINISHED = new Set([
    "\\",
    ".",
    "?.",
    "UNARY",
    "DO",
    "DO_IIFE",
    "MATH",
    "UNARY_MATH",
    "+",
    "-",
    "**",
    "SHIFT",
    "RELATION",
    "COMPARE",
    "&",
    "^",
    "|",
    "&&",
    "||",
    "TERNARY",
    "EXTENDS"
  ]);
  var NOT_REGEX = new Set([...INDEXABLE, "++", "--"]);
  var COMPOUND_ASSIGN = new Set([
    "-=",
    "+=",
    "/=",
    "*=",
    "%=",
    "||=",
    "&&=",
    "?=",
    "??=",
    "<<=",
    ">>=",
    ">>>=",
    "&=",
    "^=",
    "|=",
    "**=",
    "//=",
    "%%="
  ]);
  var MATH = new Set(["*", "/", "%", "//", "%%"]);
  var COMPARE = new Set(["==", "!=", "===", "!==", "<", ">", "<=", ">=", "=~"]);
  var SHIFT = new Set(["<<", ">>", ">>>"]);
  var UNARY_MATH = new Set(["!", "~"]);
  var IDENTIFIER_RE = /^(?!\d)((?:(?!\s)[$\w\x7f-\uffff])+(?:!(?!\?)|[?](?![.?![(]))?)([^\n\S]*:(?![=:>]))?/;
  var NUMBER_RE = /^0b[01](?:_?[01])*n?|^0o[0-7](?:_?[0-7])*n?|^0x[\da-f](?:_?[\da-f])*n?|^\d+(?:_\d+)*n|^(?:\d+(?:_\d+)*)?\.?\d+(?:_\d+)*(?:e[+-]?\d+(?:_\d+)*)?/i;
  var OPERATOR_RE = /^(?:<=>|::|\*>|[-=]>|~>|~=|:>|:=|=!|===|!==|!\?|\?\!|\?\?|=~|\|>|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|<>*\/%])\2=?|\?\.?|\.{2,3})/;
  var WHITESPACE_RE = /^[^\n\S]+/;
  var NEWLINE_RE = /^(?:\n[^\n\S]*)+/;
  var COMMENT_RE = /^(\s*)###([^#][\s\S]*?)(?:###([^\n\S]*)|###$)|^((?:\s*#(?!##[^#]).*)+)/;
  var CODE_RE = /^[-=]>/;
  var REACTIVE_RE = /^(?:~[=>]|=!)/;
  var STRING_START_RE = /^(?:'''\\|"""\\|'''|"""|'|")/;
  var STRING_SINGLE_RE = /^(?:[^\\']|\\[\s\S])*/;
  var STRING_DOUBLE_RE = /^(?:[^\\"#$]|\\[\s\S]|\#(?!\{)|\$(?!\{))*/;
  var HEREDOC_SINGLE_RE = /^(?:[^\\']|\\[\s\S]|'(?!''))*/;
  var HEREDOC_DOUBLE_RE = /^(?:[^\\"#$]|\\[\s\S]|"(?!"")|\#(?!\{)|\$(?!\{))*/;
  var HEREDOC_INDENT_RE = /\n+([^\n\S]*)(?=\S)/g;
  var REGEX_RE = /^\/(?!\/)((?:[^[\/\n\\]|\\[^\n]|\[(?:\\[^\n]|[^\]\n\\])*\])*)(\/)?/;
  var REGEX_FLAGS_RE = /^\w*/;
  var VALID_FLAGS_RE = /^(?!.*(.).*\1)[gimsuy]*$/;
  var HEREGEX_RE = /^(?:[^\\\/#\s]|\\[\s\S]|\/(?!\/\/)|\#(?!\{)|\s+(?:#(?!\{).*)?)*/;
  var JSTOKEN_RE = /^`(?!``)((?:[^`\\]|\\[\s\S])*)`/;
  var HERE_JSTOKEN_RE = /^```((?:[^`\\]|\\[\s\S]|`(?!``))*)```/;
  var TRAILING_SPACES_RE = /\s+$/;
  var LINE_CONTINUER_RE = /^\s*(?:,|\??\.(?![.\d]))/;
  var BOM = 65279;
  function tok(tag, val, { pre = 0, row = 0, col = 0, len = 0, data = null } = {}) {
    let t = [tag, val];
    t.pre = pre;
    t.data = data;
    t.loc = { r: row, c: col, n: len };
    t.spaced = pre > 0;
    t.newLine = false;
    return t;
  }
  function gen(tag, val, origin) {
    let t = tok(tag, val);
    t.generated = true;
    if (origin)
      t.origin = origin;
    return t;
  }
  function syntaxError(message, { row = 0, col = 0, len = 1 } = {}) {
    let err = new SyntaxError(message);
    err.location = { first_line: row, first_column: col, last_column: col + len - 1 };
    throw err;
  }
  function parseNumber(str) {
    if (str == null)
      return NaN;
    switch (str.charAt(1)) {
      case "b":
        return parseInt(str.slice(2).replace(/_/g, ""), 2);
      case "o":
        return parseInt(str.slice(2).replace(/_/g, ""), 8);
      case "x":
        return parseInt(str.slice(2).replace(/_/g, ""), 16);
      default:
        return parseFloat(str.replace(/_/g, ""));
    }
  }

  class Lexer {
    tokenize(code, opts = {}) {
      this.code = code;
      this.tokens = [];
      this.ends = [];
      this.chunk = "";
      this.pos = 0;
      this.row = opts.row || 0;
      this.col = opts.col || 0;
      this.indent = 0;
      this.indents = [];
      this.seenFor = false;
      this.seenImport = false;
      this.seenExport = false;
      this.importSpecifierList = false;
      this.exportSpecifierList = false;
      this.inRenderBlock = false;
      this.renderIndent = 0;
      this.inTypeAnnotation = false;
      code = this.clean(code);
      this.code = code;
      while (this.pos < code.length) {
        this.chunk = code.slice(this.pos);
        let consumed = this.identifierToken() || this.commentToken() || this.whitespaceToken() || this.lineToken() || this.stringToken() || this.numberToken() || this.regexToken() || this.jsToken() || this.literalToken();
        if (consumed === 0) {
          syntaxError(`unexpected character: ${this.chunk.charAt(0)}`, {
            row: this.row,
            col: this.col
          });
        }
        this.advance(consumed);
        if (opts.untilBalanced && this.ends.length === 0) {
          return { tokens: this.tokens, index: this.pos };
        }
      }
      this.closeIndentation();
      if (this.ends.length > 0) {
        let unclosed = this.ends[this.ends.length - 1];
        syntaxError(`missing ${unclosed.tag}`, { row: this.row, col: this.col });
      }
      if (opts.rewrite === false)
        return this.tokens;
      return this.rewrite(this.tokens);
    }
    clean(code) {
      if (code.charCodeAt(0) === BOM)
        code = code.slice(1);
      code = code.replace(/\r\n?/g, `
`);
      code = code.replace(TRAILING_SPACES_RE, "");
      if (/^[^\n\S]/.test(code))
        code = `
` + code;
      return code;
    }
    advance(n) {
      let consumed = this.code.slice(this.pos, this.pos + n);
      for (let i = 0;i < consumed.length; i++) {
        if (consumed[i] === `
`) {
          this.row++;
          this.col = 0;
        } else {
          this.col++;
        }
      }
      this.pos += n;
    }
    emit(tag, val, { len, data, pre } = {}) {
      let t = tok(tag, val, {
        pre: pre ?? 0,
        row: this.row,
        col: this.col,
        len: len ?? (typeof val === "string" ? val.length : 0),
        data
      });
      this.tokens.push(t);
      return t;
    }
    prev() {
      return this.tokens[this.tokens.length - 1];
    }
    prevTag() {
      let p = this.prev();
      return p ? p[0] : undefined;
    }
    prevVal() {
      let p = this.prev();
      return p ? p[1] : undefined;
    }
    identifierToken() {
      if (REACTIVE_RE.test(this.chunk))
        return 0;
      let match = IDENTIFIER_RE.exec(this.chunk);
      if (!match)
        return 0;
      let [, id, colon] = match;
      let idLen = id.length;
      let data = {};
      let tag;
      if (id === "own" && this.prevTag() === "FOR") {
        this.emit("OWN", id, { len: idLen });
        return idLen;
      }
      if (id === "from" && this.prevTag() === "YIELD") {
        this.emit("FROM", id, { len: idLen });
        return idLen;
      }
      if (id === "as" && !this.seenFor && (this.seenImport || this.seenExport)) {
        if (this.seenImport) {
          if (this.prevVal() === "*")
            this.prev()[0] = "IMPORT_ALL";
        }
        let pt = this.prevTag();
        if (pt === "DEFAULT" || pt === "IMPORT_ALL" || pt === "IDENTIFIER") {
          this.emit("AS", id, { len: idLen });
          return idLen;
        }
      }
      if ((id === "as" || id === "as!") && this.seenFor) {
        this.seenFor = false;
        this.emit(id === "as!" ? "FORASAWAIT" : "FORAS", "as", { len: idLen });
        return idLen;
      }
      if (id === "default" && this.seenExport && (this.prevTag() === "EXPORT" || this.prevTag() === "AS")) {
        this.emit("DEFAULT", id, { len: idLen });
        return idLen;
      }
      let m;
      if (id === "do" && (m = /^(\s*super)(?!\(\))/.exec(this.chunk.slice(3)))) {
        this.emit("SUPER", "super");
        this.emit("CALL_START", "(");
        this.emit("CALL_END", ")");
        return m[1].length + 3;
      }
      let prev = this.prev();
      if (colon && prev && prev[0] === "TERNARY")
        colon = null;
      if (colon || prev && (prev[0] === "." || prev[0] === "?." || !prev.spaced && prev[0] === "@")) {
        tag = "PROPERTY";
        if (this.inRenderBlock && prev && prev[0] === "." && !colon) {
          let rest = this.chunk.slice(idLen);
          while (rest[0] === "-" && /^-[a-zA-Z]/.test(rest)) {
            let m2 = /^-([a-zA-Z][\w]*)/.exec(rest);
            if (!m2)
              break;
            id += "-" + m2[1];
            idLen += 1 + m2[1].length;
            rest = this.chunk.slice(idLen);
          }
        }
      } else {
        tag = "IDENTIFIER";
      }
      let baseId = id.endsWith("!") || id.endsWith("?") ? id.slice(0, -1) : id;
      if (tag === "IDENTIFIER" && !id.endsWith("!") && !id.endsWith("?") && (JS_KEYWORDS.has(id) || RIP_KEYWORDS.has(id) || ALIAS_WORDS.has(id)) && !(this.exportSpecifierList && ALIAS_WORDS.has(id))) {
        if (ALIASES[id] !== undefined) {
          data.original = id;
          id = ALIASES[id];
        }
        tag = this.classifyKeyword(id, tag, data);
      }
      if (tag === "IDENTIFIER" && RESERVED.has(baseId) && !(baseId === "void" && this.inTypeAnnotation)) {
        syntaxError(`reserved word '${baseId}'`, { row: this.row, col: this.col, len: idLen });
      }
      if (tag === "PROPERTY" && prev) {
        if (prev[0] === "." && this.tokens.length > 1) {
          let pp = this.tokens[this.tokens.length - 2];
          if (pp[0] === "UNARY" && pp[1] === "new")
            pp[0] = "NEW_TARGET";
          if (pp[0] === "IMPORT" && pp[1] === "import") {
            this.seenImport = false;
            pp[0] = "IMPORT_META";
          }
        }
      }
      if (id.length > 1 && id.endsWith("!")) {
        data.await = true;
        id = id.slice(0, -1);
      }
      if (id.length > 1 && id.endsWith("?")) {
        data.predicate = true;
        id = id.slice(0, -1);
      }
      let t = this.emit(tag, id, { len: idLen, data: Object.keys(data).length ? data : null });
      if (tag === "RENDER") {
        this.inRenderBlock = true;
        this.renderIndent = this.indent;
      }
      if (colon) {
        this.emit(":", ":", { len: 1 });
        return idLen + colon.length;
      }
      return idLen;
    }
    classifyKeyword(id, fallback, data) {
      switch (id) {
        case "!":
          return "UNARY";
        case "==":
        case "!=":
          return "COMPARE";
        case "true":
        case "false":
          return "BOOL";
        case "&&":
        case "||":
          return id;
      }
      if (STATEMENTS.has(id))
        return "STATEMENT";
      let upper = id.toUpperCase();
      if (upper === "WHEN" && LINE_BREAK.has(this.prevTag()))
        return "LEADING_WHEN";
      if (upper === "FOR") {
        this.seenFor = { endsLength: this.ends.length };
        return "FOR";
      }
      if (upper === "UNLESS")
        return "UNLESS";
      if (upper === "IMPORT") {
        this.seenImport = true;
        return "IMPORT";
      }
      if (upper === "EXPORT") {
        this.seenExport = true;
        return "EXPORT";
      }
      if (UNARY_WORDS.has(upper))
        return "UNARY";
      if (RELATIONS.has(upper)) {
        if (upper !== "INSTANCEOF" && this.seenFor) {
          this.seenFor = false;
          return "FOR" + upper;
        }
        if (this.prevVal() === "!") {
          let popped = this.tokens.pop();
          data.invert = popped.data?.original || popped[1];
        }
        return "RELATION";
      }
      if (JS_KEYWORDS.has(id) || RIP_KEYWORDS.has(id))
        return upper;
      return fallback;
    }
    commentToken() {
      if (this.inRenderBlock) {
        if (/^#[a-zA-Z_]/.test(this.chunk)) {
          let prev = this.prev();
          if (prev && (prev[0] === "IDENTIFIER" || prev[0] === "PROPERTY"))
            return 0;
          let m = /^#([a-zA-Z_][\w-]*)/.exec(this.chunk);
          if (m) {
            this.emit("IDENTIFIER", "div#" + m[1]);
            return m[0].length;
          }
        }
        if (/^\s+#[a-zA-Z_]/.test(this.chunk))
          return 0;
      }
      let match = COMMENT_RE.exec(this.chunk);
      if (!match)
        return 0;
      return match[0].length;
    }
    whitespaceToken() {
      let match = WHITESPACE_RE.exec(this.chunk);
      if (!match && this.chunk[0] !== `
`)
        return 0;
      let prev = this.prev();
      if (prev) {
        if (match) {
          prev.spaced = true;
          prev.pre = match[0].length;
        } else {
          prev.newLine = true;
        }
      }
      return match ? match[0].length : 0;
    }
    lineToken() {
      let match = NEWLINE_RE.exec(this.chunk);
      if (!match)
        return 0;
      let indent = match[0];
      let size = indent.length - 1 - indent.lastIndexOf(`
`);
      if (this.isUnfinished()) {
        if (size < this.indent && /^\s*,/.test(this.chunk) && !UNFINISHED.has(this.prevTag())) {
          this.outdentTo(size, indent.length);
          if (this.prevTag() === "TERMINATOR")
            this.tokens.pop();
          return indent.length;
        }
        return indent.length;
      }
      if (this.seenFor && !(this.seenFor.endsLength < this.ends.length)) {
        this.seenFor = false;
      }
      if (!this.importSpecifierList)
        this.seenImport = false;
      if (!this.exportSpecifierList)
        this.seenExport = false;
      this.inTypeAnnotation = false;
      if (size === this.indent) {
        this.emitNewline();
        return indent.length;
      }
      if (size > this.indent) {
        if (!this.tokens.length) {
          this.indent = size;
          return indent.length;
        }
        let diff = size - this.indent;
        this.emit("INDENT", diff, { len: size });
        this.indents.push(diff);
        this.ends.push({ tag: "OUTDENT" });
        this.indent = size;
        return indent.length;
      }
      this.outdentTo(size, indent.length);
      return indent.length;
    }
    outdentTo(targetSize, outdentLength = 0) {
      if (this.inRenderBlock && targetSize <= this.renderIndent) {
        this.inRenderBlock = false;
      }
      let moveOut = this.indent - targetSize;
      while (moveOut > 0) {
        let lastIndent = this.indents[this.indents.length - 1];
        if (!lastIndent) {
          moveOut = 0;
        } else {
          this.indents.pop();
          this.pair("OUTDENT");
          this.emit("OUTDENT", moveOut, { len: outdentLength });
          moveOut -= lastIndent;
        }
      }
      this.emitNewline();
      this.indent = targetSize;
    }
    closeIndentation() {
      this.outdentTo(0);
    }
    emitNewline() {
      if (this.prevTag() !== "TERMINATOR") {
        this.emit("TERMINATOR", `
`, { len: 0 });
      }
    }
    isUnfinished() {
      if (this.inRenderBlock && LINE_CONTINUER_RE.test(this.chunk) && /^\s*\./.test(this.chunk)) {
        return false;
      }
      if (this.inRenderBlock && this.prevTag() === ".") {
        let len = this.tokens.length;
        if (len >= 2) {
          let beforeDot = this.tokens[len - 2][0];
          if (beforeDot === "INDENT" || beforeDot === "TERMINATOR" || beforeDot === "OUTDENT") {
            return false;
          }
        }
      }
      let prev = this.tokens[this.tokens.length - 1];
      if (prev?.[0] === "COMPARE" && prev[1] === ">") {
        let depth = 0;
        for (let k = this.tokens.length - 1;k >= 0; k--) {
          let tk = this.tokens[k];
          if (tk[0] === "COMPARE" && tk[1] === ">")
            depth++;
          else if (tk[0] === "COMPARE" && tk[1] === "<")
            depth--;
          if (depth === 0 && tk[0] === "TYPE_ANNOTATION")
            return false;
          if (tk[0] === "TERMINATOR" || tk[0] === "INDENT" || tk[0] === "OUTDENT")
            break;
        }
      }
      return LINE_CONTINUER_RE.test(this.chunk) || UNFINISHED.has(this.prevTag());
    }
    pair(tag) {
      let expected = this.ends[this.ends.length - 1];
      if (!expected || tag !== expected.tag) {
        if (expected?.tag === "OUTDENT") {
          let lastIndent = this.indents[this.indents.length - 1];
          if (lastIndent) {
            this.outdentTo(this.indent - lastIndent);
          }
          return this.pair(tag);
        }
        syntaxError(`unmatched ${tag}`, { row: this.row, col: this.col });
      }
      return this.ends.pop();
    }
    stringToken() {
      let m = STRING_START_RE.exec(this.chunk);
      if (!m)
        return 0;
      let quote = m[0];
      let raw = quote.length > 1 && quote.endsWith("\\");
      let baseQuote = raw ? quote.slice(0, -1) : quote;
      let prev = this.prev();
      if (prev && this.prevVal() === "from" && (this.seenImport || this.seenExport)) {
        prev[0] = "FROM";
      }
      let regex;
      switch (baseQuote) {
        case "'":
          regex = STRING_SINGLE_RE;
          break;
        case '"':
          regex = STRING_DOUBLE_RE;
          break;
        case "'''":
          regex = HEREDOC_SINGLE_RE;
          break;
        case '"""':
          regex = HEREDOC_DOUBLE_RE;
          break;
      }
      let { tokens: parts, index: end } = this.matchWithInterpolations(regex, quote, baseQuote);
      let heredoc = baseQuote.length === 3;
      let indent = null;
      if (heredoc) {
        indent = this.processHeredocIndent(end, baseQuote, parts);
      }
      this.mergeInterpolationTokens(parts, { quote: baseQuote, indent, endOffset: end, raw });
      return end;
    }
    processHeredocIndent(end, quote, tokens) {
      let closingPos = end - quote.length;
      let lineStart = closingPos - 1;
      while (lineStart >= 0 && this.chunk[lineStart] !== `
`)
        lineStart--;
      lineStart++;
      let beforeClosing = this.chunk.slice(lineStart, closingPos);
      let closingColumn = /^\s*$/.test(beforeClosing) ? beforeClosing.length : null;
      let doc = "";
      for (let t of tokens) {
        if (t[0] === "NEOSTRING")
          doc += t[1];
      }
      let minIndent = null;
      let m;
      HEREDOC_INDENT_RE.lastIndex = 0;
      while (m = HEREDOC_INDENT_RE.exec(doc)) {
        if (minIndent === null || m[1].length > 0 && m[1].length < minIndent.length) {
          minIndent = m[1];
        }
      }
      if (closingColumn === null)
        return minIndent;
      if (minIndent === null)
        return " ".repeat(closingColumn);
      if (closingColumn <= minIndent.length)
        return " ".repeat(closingColumn);
      return minIndent;
    }
    matchWithInterpolations(regex, delimiter, closingDelimiter, interpolators) {
      if (!closingDelimiter)
        closingDelimiter = delimiter;
      if (!interpolators)
        interpolators = /^[#$]\{/;
      let tokens = [];
      let offset = delimiter.length;
      if (this.chunk.slice(0, offset) !== delimiter)
        return null;
      let str = this.chunk.slice(offset);
      while (true) {
        let [strPart] = regex.exec(str);
        tokens.push(["NEOSTRING", strPart, { offset }]);
        str = str.slice(strPart.length);
        offset += strPart.length;
        let m = interpolators.exec(str);
        if (!m)
          break;
        let interpolator = m[0];
        let interpOffset = interpolator.length - 1;
        let rest = str.slice(interpOffset);
        let nested = new Lexer().tokenize(rest, {
          row: this.row,
          col: this.col + offset + interpOffset,
          untilBalanced: true,
          rewrite: false
        });
        let index = nested.index + interpOffset;
        if (str[index - 1] === "}") {
          let open = nested.tokens[0];
          let close = nested.tokens[nested.tokens.length - 1];
          open[0] = "INTERPOLATION_START";
          open[1] = "(";
          close[0] = "INTERPOLATION_END";
          close[1] = ")";
        }
        if (nested.tokens[1]?.[0] === "TERMINATOR")
          nested.tokens.splice(1, 1);
        let ntl = nested.tokens.length;
        if (ntl > 2 && nested.tokens[ntl - 3]?.[0] === "INDENT" && nested.tokens[ntl - 2]?.[0] === "OUTDENT") {
          nested.tokens.splice(ntl - 3, 2);
        }
        tokens.push(["TOKENS", nested.tokens]);
        str = str.slice(index);
        offset += index;
      }
      if (str.slice(0, closingDelimiter.length) !== closingDelimiter) {
        syntaxError(`missing ${closingDelimiter}`, { row: this.row, col: this.col });
      }
      return { tokens, index: offset + closingDelimiter.length };
    }
    mergeInterpolationTokens(tokens, { quote, indent, endOffset, raw }) {
      if (tokens.length > 1) {
        this.emit("STRING_START", "(", { len: quote?.length || 0, data: { quote } });
      }
      for (let i = 0;i < tokens.length; i++) {
        let [tag, val] = tokens[i];
        if (tag === "TOKENS") {
          for (let nested of val)
            this.tokens.push(nested);
        } else if (tag === "NEOSTRING") {
          let processed = val;
          if (indent) {
            let indentRe = new RegExp("\\n" + indent, "g");
            processed = processed.replace(indentRe, `
`);
          }
          if (i === 0 && quote?.length === 3) {
            processed = processed.replace(/^\n/, "");
          }
          if (i === tokens.length - 1 && quote?.length === 3) {
            processed = processed.replace(/\n[^\S\n]*$/, "");
          }
          if (raw) {
            processed = processed.replace(/\\([nrtbfv0\\'"`xu])/g, "\\\\$1");
          }
          this.emit("STRING", `"${processed}"`, { len: val.length, data: { quote } });
        }
      }
      if (tokens.length > 1) {
        this.emit("STRING_END", ")", { len: quote?.length || 0 });
      }
      return endOffset;
    }
    numberToken() {
      let match = NUMBER_RE.exec(this.chunk);
      if (!match)
        return 0;
      let number = match[0];
      let len = number.length;
      let loc = { row: this.row, col: this.col };
      if (/^0[BOX]/.test(number)) {
        syntaxError(`radix prefix in '${number}' must be lowercase`, { ...loc, col: loc.col + 1 });
      }
      if (/^0\d*[89]/.test(number)) {
        syntaxError(`decimal literal '${number}' must not be prefixed with '0'`, { ...loc, len });
      }
      if (/^0\d+/.test(number)) {
        syntaxError(`octal literal '${number}' must be prefixed with '0o'`, { ...loc, len });
      }
      let parsed = parseNumber(number);
      let tag = parsed === Infinity ? "INFINITY" : "NUMBER";
      let data = { parsedValue: parsed };
      if (tag === "INFINITY")
        data.original = number;
      this.emit(tag, number, { len, data });
      return len;
    }
    regexToken() {
      let hm = this.matchWithInterpolations(HEREGEX_RE, "///");
      if (hm) {
        let { tokens: parts, index: index2 } = hm;
        let [flags2] = REGEX_FLAGS_RE.exec(this.chunk.slice(index2));
        let end2 = index2 + flags2.length;
        if (parts.length === 1 || !parts.some((p) => p[0] === "TOKENS")) {
          let body2 = (parts[0]?.[1] || "").replace(/(?<!\\)\//g, "\\/");
          this.emit("REGEX", `/${body2}/${flags2}`, { len: end2, data: { delimiter: "///", heregex: { flags: flags2 } } });
        } else {
          this.emit("REGEX_START", "(", { len: 0 });
          this.emit("IDENTIFIER", "RegExp", { len: 0 });
          this.emit("CALL_START", "(", { len: 0 });
          this.mergeInterpolationTokens(parts, { quote: "///", endOffset: end2 - flags2.length });
          if (flags2) {
            this.emit(",", ",", { len: 0 });
            this.emit("STRING", `"${flags2}"`, { len: flags2.length });
          }
          this.emit(")", ")", { len: 0 });
          this.emit("REGEX_END", ")", { len: 0 });
        }
        return end2;
      }
      let match = REGEX_RE.exec(this.chunk);
      if (!match)
        return 0;
      let [regex, body, closed] = match;
      let prev = this.prev();
      if (prev) {
        if (prev.spaced && CALLABLE.has(prev[0]) && (!closed || /^\/=?\s/.test(regex)))
          return 0;
        if (NOT_REGEX.has(prev[0]) && !(prev.spaced && CALLABLE.has(prev[0])))
          return 0;
      }
      if (!closed)
        syntaxError("missing / (unclosed regex)", { row: this.row, col: this.col });
      let index = regex.length;
      let [flags] = REGEX_FLAGS_RE.exec(this.chunk.slice(index));
      let end = index + flags.length;
      if (!VALID_FLAGS_RE.test(flags)) {
        syntaxError(`invalid regular expression flags ${flags}`, { row: this.row, col: this.col + index, len: flags.length });
      }
      this.emit("REGEX", `/${body}/${flags}`, { len: end, data: { delimiter: "/" } });
      return end;
    }
    jsToken() {
      if (this.chunk[0] !== "`")
        return 0;
      let match = HERE_JSTOKEN_RE.exec(this.chunk) || JSTOKEN_RE.exec(this.chunk);
      if (!match)
        return 0;
      let script = match[1];
      let len = match[0].length;
      this.emit("JS", script, { len, data: { here: match[0].startsWith("```") } });
      return len;
    }
    wordLiteral() {
      if (this.chunk[0] !== "%" || this.chunk[1] !== "w")
        return 0;
      let opener = this.chunk[2];
      if (!opener || /\s/.test(opener))
        return 0;
      let PAIRS = { "[": "]", "(": ")", "{": "}", "<": ">" };
      let closer = PAIRS[opener] || opener;
      let paired = closer !== opener;
      let depth = 1;
      let i = 3;
      while (i < this.chunk.length && depth > 0) {
        let ch = this.chunk[i];
        if (ch === "\\") {
          i += 2;
          continue;
        }
        if (paired && ch === opener)
          depth++;
        if (ch === closer)
          depth--;
        if (depth > 0)
          i++;
      }
      if (depth !== 0)
        return 0;
      let content = this.chunk.slice(3, i);
      let total = i + 1;
      let words = [];
      if (content.trim()) {
        let raw = content.trim().split(/(?<!\\)\s+/);
        for (let w of raw) {
          words.push(w.replace(/\\ /g, " "));
        }
      }
      this.emit("[", "[", { len: total });
      for (let j = 0;j < words.length; j++) {
        if (j > 0)
          this.emit(",", ",");
        this.emit("STRING", `"${words[j]}"`);
      }
      this.emit("]", "]");
      return total;
    }
    literalToken() {
      let wl = this.wordLiteral();
      if (wl)
        return wl;
      let match = OPERATOR_RE.exec(this.chunk);
      let val = match ? match[0] : this.chunk.charAt(0);
      let tag = val;
      let prev = this.prev();
      if (CODE_RE.test(val))
        this.tagParameters();
      if (val === "=" && prev && prev[1] === "." && !prev.spaced) {
        let tokens = this.tokens;
        let j = tokens.length - 2;
        while (j >= 1 && tokens[j][0] === "PROPERTY" && tokens[j - 1]?.[1] === ".")
          j -= 2;
        if (j >= 0 && (tokens[j][0] === "IDENTIFIER" || tokens[j][0] === ")" || tokens[j][0] === "]")) {
          let chainTokens = tokens.slice(j, tokens.length - 1);
          prev[0] = "=";
          prev[1] = "=";
          for (let t of chainTokens) {
            this.tokens.push(tok(t[0], t[1], { pre: 0, row: t[2], col: t[3], len: t[4] }));
          }
          this.tokens.push(tok(".", ".", { pre: 0, row: this.row, col: this.col, len: 1 }));
          return val.length;
        }
      }
      if (prev && (val === "=" || COMPOUND_ASSIGN.has(val))) {
        if (val === "=" && (prev[1] === "||" || prev[1] === "&&" || prev[1] === "??") && !prev.spaced) {
          prev[0] = "COMPOUND_ASSIGN";
          prev[1] += "=";
          return val.length;
        }
      }
      if (val === "(" && prev?.[0] === "IMPORT")
        prev[0] = "DYNAMIC_IMPORT";
      if (val === "{" && this.seenImport)
        this.importSpecifierList = true;
      if (val === "}" && this.importSpecifierList)
        this.importSpecifierList = false;
      if (val === "{" && prev?.[0] === "EXPORT")
        this.exportSpecifierList = true;
      if (val === "}" && this.exportSpecifierList)
        this.exportSpecifierList = false;
      if (val === ";") {
        this.seenFor = this.seenImport = this.seenExport = false;
        this.inTypeAnnotation = false;
        tag = "TERMINATOR";
      } else if (val === "|>")
        tag = "PIPE";
      else if (val === "::" && /^[a-zA-Z_$]/.test(this.chunk[2] || "")) {
        this.emit(".", ".");
        this.emit("PROPERTY", "prototype");
        this.emit(".", ".");
        return 2;
      } else if (val === "::") {
        tag = "TYPE_ANNOTATION";
        this.inTypeAnnotation = true;
      } else if (val === "~=")
        tag = "COMPUTED_ASSIGN";
      else if (val === ":=")
        tag = "REACTIVE_ASSIGN";
      else if (val === ":>")
        tag = "RIGHTWARD_ASSIGN";
      else if (val === "<=>")
        tag = "BIND";
      else if (val === "~>") {
        tag = "EFFECT";
        this.inTypeAnnotation = false;
      } else if (val === "=!") {
        tag = "READONLY_ASSIGN";
        this.inTypeAnnotation = false;
      } else if (val === "*>" && (!prev || prev[0] === "TERMINATOR" || prev[0] === "INDENT" || prev[0] === "OUTDENT") && (/^[a-zA-Z_$]/.test(this.chunk[2] || "") || this.chunk[2] === "@")) {
        let rest = this.chunk.slice(2);
        let mAt = /^@(\s*)=(?!=)/.exec(rest);
        if (mAt) {
          let space = mAt[1];
          this.emit("IDENTIFIER", "Object");
          this.emit(".", ".");
          let t = this.emit("PROPERTY", "assign");
          t.spaced = true;
          this.emit("@", "@");
          this.emit(",", ",");
          return 2 + 1 + space.length + 1;
        }
        let m = /^(@?(?:(?!\s)[$\w\x7f-\uffff])+(?:\.[a-zA-Z_$][\w]*)*)(\s*)=(?!=)/.exec(rest);
        if (m) {
          let target = m[1], space = m[2];
          let hasAt = target[0] === "@";
          let bare = hasAt ? target.slice(1) : target;
          let parts = bare ? bare.split(".") : [];
          let emitTarget = () => {
            if (hasAt) {
              this.emit("@", "@");
              if (parts.length > 0)
                this.emit("PROPERTY", parts[0]);
            } else {
              this.emit("IDENTIFIER", parts[0]);
            }
            for (let i = 1;i < parts.length; i++) {
              this.emit(".", ".");
              this.emit("PROPERTY", parts[i]);
            }
          };
          emitTarget();
          this.emit("=", "=");
          this.emit("IDENTIFIER", "Object");
          this.emit(".", ".");
          this.emit("PROPERTY", "assign");
          this.emit("CALL_START", "(");
          emitTarget();
          this.emit("COMPOUND_ASSIGN", "??=");
          this.emit("{", "{");
          this.emit("}", "}");
          this.emit(",", ",");
          let comma = this.prev();
          comma.mergeClose = true;
          return 2 + target.length + space.length + 1;
        }
      } else if (val === "*" && prev?.[0] === "EXPORT")
        tag = "EXPORT_ALL";
      else if (MATH.has(val))
        tag = "MATH";
      else if (COMPARE.has(val))
        tag = "COMPARE";
      else if (COMPOUND_ASSIGN.has(val))
        tag = "COMPOUND_ASSIGN";
      else if (UNARY_MATH.has(val))
        tag = "UNARY_MATH";
      else if (SHIFT.has(val))
        tag = "SHIFT";
      else if (val === "?" && prev?.spaced)
        tag = "TERNARY";
      else if (val === "!?" && prev && !prev.spaced)
        tag = "DEFINED";
      else if (val === "?!" && prev && !prev.spaced)
        tag = "PRESENCE";
      else if (val === "?" && (this.chunk[1] === "[" || this.chunk[1] === "("))
        tag = "?.";
      else if (prev) {
        if (val === "(" && !prev.spaced && CALLABLE.has(prev[0])) {
          if (prev[0] === "?.")
            prev[0] = "ES6_OPTIONAL_CALL";
          tag = "CALL_START";
        }
        if (val === "[" && !prev.spaced && INDEXABLE.has(prev[0])) {
          tag = "INDEX_START";
          if (prev[0] === "?.")
            prev[0] = "ES6_OPTIONAL_INDEX";
        }
      }
      if (this.inTypeAnnotation && (val === "=" || tag === "COMPOUND_ASSIGN")) {
        this.inTypeAnnotation = false;
      }
      if (val === "(" || val === "{" || val === "[") {
        this.ends.push({ tag: INVERSES[val], origin: [tag, val] });
      } else if (val === ")" || val === "}" || val === "]") {
        this.pair(val);
      }
      this.emit(tag, val, { len: val.length });
      return val.length;
    }
    tagParameters() {
      if (this.prevTag() !== ")")
        return this.tagDoIife();
      let i = this.tokens.length - 1;
      let stack = [];
      this.tokens[i][0] = "PARAM_END";
      while (i-- > 0) {
        let tok2 = this.tokens[i];
        if (tok2[0] === ")") {
          stack.push(tok2);
        } else if (tok2[0] === "(" || tok2[0] === "CALL_START") {
          if (stack.length) {
            stack.pop();
          } else if (tok2[0] === "(") {
            tok2[0] = "PARAM_START";
            return this.tagDoIife(i - 1);
          } else {
            this.tokens[this.tokens.length - 1][0] = "CALL_END";
            return;
          }
        }
      }
    }
    tagDoIife(index) {
      let t = this.tokens[index ?? this.tokens.length - 1];
      if (t?.[0] === "DO")
        t[0] = "DO_IIFE";
    }
    rewrite(tokens) {
      this.tokens = tokens;
      this.removeLeadingNewlines();
      this.rewriteMapLiterals();
      this.closeMergeAssignments();
      this.closeOpenCalls();
      this.closeOpenIndexes();
      this.normalizeLines();
      this.rewriteRender?.();
      this.rewriteTypes();
      this.tagPostfixConditionals();
      this.rewriteTaggedTemplates();
      this.addImplicitBracesAndParens();
      this.addImplicitCallCommas();
      return this.tokens;
    }
    removeLeadingNewlines() {
      let i = 0;
      while (this.tokens[i]?.[0] === "TERMINATOR")
        i++;
      if (i > 0)
        this.tokens.splice(0, i);
    }
    rewriteMapLiterals() {
      let tokens = this.tokens;
      for (let i = 0;i < tokens.length; i++) {
        if (tokens[i][0] !== "MATH" || tokens[i][1] !== "*")
          continue;
        let next = tokens[i + 1];
        if (!next || next[0] !== "{")
          continue;
        if (tokens[i].spaced || tokens[i].newLine)
          continue;
        let prev = tokens[i - 1];
        if (prev && INDEXABLE.has(prev[0]))
          continue;
        tokens.splice(i, 1);
        tokens[i][0] = "MAP_START";
        let depth = 1;
        for (let j = i + 1;j < tokens.length && depth > 0; j++) {
          let tag = tokens[j][0];
          if (tag === "{" || tag === "MAP_START")
            depth++;
          if (tag === "}") {
            depth--;
            if (depth === 0)
              tokens[j][0] = "MAP_END";
          }
        }
      }
    }
    closeOpenCalls() {
      this.scanTokens((token, i) => {
        if (token[0] === "CALL_START") {
          this.detectEnd(i + 1, (t) => t[0] === ")" || t[0] === "CALL_END", (t) => t[0] = "CALL_END");
        }
        return 1;
      });
    }
    closeOpenIndexes() {
      this.scanTokens((token, i) => {
        if (token[0] === "INDEX_START") {
          this.detectEnd(i + 1, (t) => t[0] === "]" || t[0] === "INDEX_END", (t, idx) => {
            if (this.tokens[idx + 1]?.[0] === ":") {
              token[0] = "[";
              t[0] = "]";
            } else {
              t[0] = "INDEX_END";
            }
          });
        }
        return 1;
      });
    }
    normalizeLines() {
      let starter = null;
      let indent = null;
      let outdent = null;
      let condition = (token, i) => {
        return token[1] !== ";" && SINGLE_CLOSERS.has(token[0]) && !(token[0] === "TERMINATOR" && EXPRESSION_CLOSE.has(this.tokens[i + 1]?.[0])) && !(token[0] === "ELSE" && starter !== "THEN") || token[0] === "INDENT" && !token.generated && (starter === "->" || starter === "=>") || token[0] === "," && (starter === "->" || starter === "=>") && !this.commaInImplicitCall(i) && !this.commaInImplicitObject(i) || CALL_CLOSERS.has(token[0]) && (this.tokens[i - 1]?.newLine || this.tokens[i - 1]?.[0] === "OUTDENT");
      };
      let action = (token, i) => {
        let idx = this.tokens[i - 1]?.[0] === "," ? i - 1 : i;
        this.tokens.splice(idx, 0, outdent);
      };
      this.scanTokens((token, i, tokens) => {
        let [tag] = token;
        if (tag === "TERMINATOR") {
          if (this.tokens[i + 1]?.[0] === "ELSE" && this.tokens[i - 1]?.[0] !== "OUTDENT") {
            tokens.splice(i, 1, ...this.makeIndentation());
            return 1;
          }
          if (EXPRESSION_CLOSE.has(this.tokens[i + 1]?.[0])) {
            tokens.splice(i, 1);
            return 0;
          }
        }
        if (tag === "CATCH") {
          for (let j = 1;j <= 2; j++) {
            let nextTag = this.tokens[i + j]?.[0];
            if (nextTag === "OUTDENT" || nextTag === "TERMINATOR" || nextTag === "FINALLY") {
              tokens.splice(i + j, 0, ...this.makeIndentation());
              return 2 + j;
            }
          }
        }
        if ((tag === "->" || tag === "=>") && (this.tokens[i + 1]?.[0] === "," || this.tokens[i + 1]?.[0] === "]")) {
          [indent, outdent] = this.makeIndentation();
          tokens.splice(i + 1, 0, indent, outdent);
          return 1;
        }
        if (SINGLE_LINERS.has(tag) && this.tokens[i + 1]?.[0] !== "INDENT" && !(tag === "ELSE" && this.tokens[i + 1]?.[0] === "IF") && !(tag === "ELSE" && this.tokens[i - 1]?.[0] !== "OUTDENT")) {
          starter = tag;
          [indent, outdent] = this.makeIndentation();
          if (tag === "THEN")
            indent.fromThen = true;
          tokens.splice(i + 1, 0, indent);
          if (tag === "THEN" && this.singleLineOwner(i) === "LEADING_WHEN")
            this.detectWhenThenEnd(i + 2, condition, action);
          else
            this.detectEnd(i + 2, condition, action);
          if (tag === "THEN")
            tokens.splice(i, 1);
          return 1;
        }
        return 1;
      });
    }
    singleLineOwner(i) {
      let starters = new Set(["LEADING_WHEN", "IF", "POST_IF", "UNLESS", "POST_UNLESS", "ELSE", "CATCH", "TRY", "FINALLY", "->", "=>"]);
      for (let j = i - 1;j >= 0; j--) {
        let token = this.tokens[j];
        let tag = token?.[0];
        if (starters.has(tag))
          return tag;
        if (LINE_BREAK.has(tag) || token?.newLine)
          return null;
      }
      return null;
    }
    detectWhenThenEnd(i, condition, action) {
      let levels = 0;
      let nestedInlineBranches = 0;
      while (i < this.tokens.length) {
        let token = this.tokens[i];
        let tag = token[0];
        if (levels === 0) {
          if (tag === "THEN" && this.singleLineOwner(i) !== "LEADING_WHEN")
            nestedInlineBranches++;
          else if (tag === "ELSE" && nestedInlineBranches > 0)
            nestedInlineBranches--;
          else if (condition.call(this, token, i))
            return action.call(this, token, i);
        }
        if (EXPRESSION_START.has(tag))
          levels++;
        if (EXPRESSION_END.has(tag))
          levels--;
        if (levels < 0)
          return action.call(this, token, i);
        i++;
      }
    }
    tagPostfixConditionals() {
      let original = null;
      let condition = (token, i) => {
        return token[0] === "TERMINATOR" || token[0] === "INDENT" && !SINGLE_LINERS.has(this.tokens[i - 1]?.[0]);
      };
      let action = (token) => {
        if (token[0] !== "INDENT" || token.generated && !token.fromThen) {
          original[0] = "POST_" + original[0];
        }
      };
      this.scanTokens((token, i) => {
        if (token[0] !== "IF" && token[0] !== "UNLESS")
          return 1;
        if (this.tokens[i - 1]?.[0] === "INTERPOLATION_START")
          return 1;
        original = token;
        this.detectEnd(i + 1, condition, action);
        return 1;
      });
    }
    rewriteTaggedTemplates() {
      let tokens = this.tokens;
      for (let i = tokens.length - 2;i >= 0; i--) {
        if (tokens[i][0] === "IDENTIFIER" && tokens[i][1] === "$" && (tokens[i + 1]?.[0] === "STRING" || tokens[i + 1]?.[0] === "STRING_START")) {
          let prev = tokens[i - 1];
          if (prev && TAGGABLE.has(prev[0])) {
            tokens.splice(i, 1);
            prev.spaced = false;
            tokens[i].spaced = false;
            tokens[i].pre = 0;
            if (tokens[i].newLine)
              tokens[i].newLine = false;
          }
        }
      }
    }
    addImplicitBracesAndParens() {
      let stack = [];
      let inTernary = false;
      this.scanTokens((token, i, tokens) => {
        let [tag] = token;
        let prevToken = tokens[i - 1] || [];
        let nextToken = tokens[i + 1] || [];
        let [prevTag] = prevToken;
        let [nextTag] = nextToken;
        let startIdx = i;
        let forward = (n) => i - startIdx + n;
        let stackTop = () => stack[stack.length - 1];
        let isImplicit = (s) => s?.[2]?.ours;
        let inImplicitCall = () => isImplicit(stackTop()) && stackTop()?.[0] === "(";
        let inImplicitObject = () => isImplicit(stackTop()) && stackTop()?.[0] === "{";
        let startImplicitCall = (idx) => {
          stack.push(["(", idx, { ours: true }]);
          tokens.splice(idx, 0, gen("CALL_START", "("));
        };
        let endImplicitCall = () => {
          stack.pop();
          tokens.splice(i, 0, gen("CALL_END", ")"));
          i += 1;
        };
        let startImplicitObject = (idx, opts = {}) => {
          stack.push(["{", idx, { sameLine: true, startsLine: opts.startsLine ?? true, ours: true }]);
          let t = gen("{", "{");
          if (!t.data)
            t.data = {};
          t.data.generated = true;
          tokens.splice(idx, 0, t);
        };
        let endImplicitObject = (j) => {
          j = j ?? i;
          stack.pop();
          tokens.splice(j, 0, gen("}", "}"));
          i += 1;
        };
        if ((inImplicitCall() || inImplicitObject()) && CONTROL_IN_IMPLICIT.has(tag)) {
          stack.push(["CONTROL", i, { ours: true }]);
          return forward(1);
        }
        if (tag === "INDENT" && isImplicit(stackTop())) {
          if (prevTag !== "=>" && prevTag !== "->" && prevTag !== "[" && prevTag !== "(" && prevTag !== "," && prevTag !== "{" && prevTag !== "ELSE" && prevTag !== "=") {
            while (inImplicitCall() || inImplicitObject() && prevTag !== ":") {
              if (inImplicitCall())
                endImplicitCall();
              else
                endImplicitObject();
            }
          }
          if (stackTop()?.[2]?.ours && stackTop()[0] === "CONTROL")
            stack.pop();
          stack.push([tag, i]);
          return forward(1);
        }
        if (EXPRESSION_START.has(tag)) {
          stack.push([tag, i]);
          return forward(1);
        }
        if (EXPRESSION_END.has(tag)) {
          while (isImplicit(stackTop())) {
            if (inImplicitCall())
              endImplicitCall();
            else if (inImplicitObject())
              endImplicitObject();
            else
              stack.pop();
          }
          stack.pop();
        }
        if (IMPLICIT_FUNC.has(tag) && token.spaced && (IMPLICIT_CALL.has(nextTag) || nextTag === "..." && IMPLICIT_CALL.has(tokens[i + 2]?.[0]) || IMPLICIT_UNSPACED_CALL.has(nextTag) && !nextToken.spaced && !nextToken.newLine) && !((tag === "]" || tag === "}") && (nextTag === "->" || nextTag === "=>"))) {
          startImplicitCall(i + 1);
          return forward(2);
        }
        if (IMPLICIT_FUNC.has(tag) && this.tokens[i + 1]?.[0] === "INDENT" && this.looksObjectish(i + 2) && !this.findTagsBackwards(i, ["CLASS", "EXTENDS", "IF", "CATCH", "SWITCH", "LEADING_WHEN", "FOR", "WHILE", "UNTIL"])) {
          startImplicitCall(i + 1);
          stack.push(["INDENT", i + 2]);
          return forward(3);
        }
        if (tag === "TERNARY")
          inTernary = true;
        if (tag === ":") {
          if (inTernary) {
            inTernary = false;
            return forward(1);
          }
          if (tokens[i - 1]?.[0] === "PROPERTY" && tokens[i - 2]?.[0] === ".") {
            let j = i - 2;
            while (j >= 2 && tokens[j]?.[0] === "." && (tokens[j - 1]?.[0] === "PROPERTY" || tokens[j - 1]?.[0] === "IDENTIFIER")) {
              j -= 2;
            }
            j += 1;
            if (tokens[j]?.[0] === "IDENTIFIER" || tokens[j]?.[0] === "PROPERTY") {
              let parts = [];
              for (let k = j;k < i; k += 2)
                parts.push(tokens[k][1]);
              let str = gen("STRING", `"${parts.join(".")}"`, tokens[j]);
              str.pre = tokens[j].pre;
              str.spaced = tokens[j].spaced;
              str.newLine = tokens[j].newLine;
              str.loc = tokens[j].loc;
              tokens.splice(j, i - j, str);
              i = j + 1;
            }
          }
          let s = EXPRESSION_END.has(this.tokens[i - 1]?.[0]) ? stack[stack.length - 1]?.[1] ?? i - 1 : i - 1;
          if (this.tokens[i - 2]?.[0] === "@")
            s = i - 2;
          let startsLine = s <= 0 || LINE_BREAK.has(this.tokens[s - 1]?.[0]) || this.tokens[s - 1]?.newLine;
          if (stackTop()) {
            let [stackTag, stackIdx] = stackTop();
            let stackNext = stack[stack.length - 2];
            let isBrace = (t) => t === "{" || t === "MAP_START";
            if ((isBrace(stackTag) || stackTag === "INDENT" && isBrace(stackNext?.[0]) && !isImplicit(stackNext)) && (startsLine || this.tokens[s - 1]?.[0] === "," || isBrace(this.tokens[s - 1]?.[0]) || isBrace(this.tokens[s]?.[0]))) {
              return forward(1);
            }
          }
          startImplicitObject(s, { startsLine: !!startsLine });
          return forward(2);
        }
        if (LINE_BREAK.has(tag)) {
          for (let k = stack.length - 1;k >= 0; k--) {
            if (!isImplicit(stack[k]))
              break;
            if (stack[k][0] === "{")
              stack[k][2].sameLine = false;
          }
        }
        let newLine = prevTag === "OUTDENT" || prevToken.newLine;
        let isLogicalOp = tag === "||" || tag === "&&";
        let logicalKeep = false;
        if (isLogicalOp) {
          let j = i + 1, t = tokens[j]?.[0];
          if (t === "(" || t === "[" || t === "{") {
            for (let d = 1;++j < tokens.length && d > 0; ) {
              t = tokens[j][0];
              if (t === "(" || t === "[" || t === "{")
                d++;
              else if (t === ")" || t === "]" || t === "}")
                d--;
            }
          } else if (t && t !== "TERMINATOR" && t !== "OUTDENT" && t !== ",")
            j++;
          logicalKeep = tokens[j]?.[0] === ",";
        }
        if (IMPLICIT_END.has(tag) && !logicalKeep || CALL_CLOSERS.has(tag) && newLine) {
          while (isImplicit(stackTop())) {
            let [stackTag, , { sameLine, startsLine }] = stackTop();
            if (inImplicitCall() && prevTag !== ",") {
              endImplicitCall();
            } else if (inImplicitObject() && !isLogicalOp && sameLine && tag !== "TERMINATOR" && prevTag !== ":") {
              endImplicitObject();
            } else if (inImplicitObject() && tag === "TERMINATOR" && prevTag !== "," && !(startsLine && this.looksObjectish(i + 1))) {
              endImplicitObject();
            } else if (stackTop()?.[2]?.ours && stackTop()[0] === "CONTROL" && tokens[stackTop()[1]]?.[0] === "CLASS" && tag === "TERMINATOR") {
              stack.pop();
            } else {
              break;
            }
          }
        }
        if (tag === "," && !this.looksObjectish(i + 1) && inImplicitObject() && (nextTag !== "TERMINATOR" || !this.looksObjectish(i + 2))) {
          let offset = nextTag === "OUTDENT" ? 1 : 0;
          while (inImplicitObject())
            endImplicitObject(i + offset);
        }
        return forward(1);
      });
    }
    addImplicitCallCommas() {
      let callDepth = 0;
      let i = 0;
      let tokens = this.tokens;
      while (i < tokens.length) {
        let tag = tokens[i][0];
        let prevTag = i > 0 ? tokens[i - 1][0] : null;
        if (tag === "CALL_START" || tag === "(")
          callDepth++;
        if (tag === "CALL_END" || tag === ")")
          callDepth--;
        if (callDepth > 0 && (tag === "->" || tag === "=>") && IMPLICIT_COMMA_BEFORE_ARROW.has(prevTag)) {
          tokens.splice(i, 0, gen(",", ","));
          i++;
        }
        i++;
      }
    }
    scanTokens(fn) {
      let i = 0;
      while (i < this.tokens.length) {
        i += fn.call(this, this.tokens[i], i, this.tokens);
      }
    }
    detectEnd(i, condition, action, opts = {}) {
      let levels = 0;
      while (i < this.tokens.length) {
        let token = this.tokens[i];
        if (levels === 0 && condition.call(this, token, i)) {
          return action.call(this, token, i);
        }
        if (EXPRESSION_START.has(token[0]))
          levels++;
        if (EXPRESSION_END.has(token[0]))
          levels--;
        if (levels < 0) {
          if (opts.returnOnNegativeLevel)
            return;
          return action.call(this, token, i);
        }
        i++;
      }
    }
    closeMergeAssignments() {
      let tokens = this.tokens;
      for (let i = 0;i < tokens.length; i++) {
        if (!tokens[i].mergeClose)
          continue;
        let depth = 0;
        for (let j = i + 1;j < tokens.length; j++) {
          let tag = tokens[j][0];
          if (tag === "(" || tag === "[" || tag === "{" || tag === "CALL_START" || tag === "INDEX_START" || tag === "INDENT")
            depth++;
          if (tag === ")" || tag === "]" || tag === "}" || tag === "CALL_END" || tag === "INDEX_END" || tag === "OUTDENT")
            depth--;
          if (depth < 0 || depth === 0 && tag === "TERMINATOR") {
            tokens.splice(j, 0, gen("CALL_END", ")", tokens[j - 1]));
            break;
          }
          if (j === tokens.length - 1) {
            tokens.splice(j + 1, 0, gen("CALL_END", ")", tokens[j]));
            break;
          }
        }
      }
    }
    commaInImplicitCall(i) {
      let levels = 0;
      for (let j = i - 1;j >= 0; j--) {
        let tag = this.tokens[j][0];
        if (EXPRESSION_END.has(tag)) {
          levels++;
          continue;
        }
        if (EXPRESSION_START.has(tag)) {
          if (tag === "INDENT")
            return false;
          levels--;
          if (levels < 0)
            return false;
          continue;
        }
        if (levels > 0)
          continue;
        if (IMPLICIT_FUNC.has(tag) && this.tokens[j].spaced) {
          let nt = this.tokens[j + 1]?.[0];
          return IMPLICIT_CALL.has(nt) || nt === "..." && IMPLICIT_CALL.has(this.tokens[j + 2]?.[0]);
        }
      }
      return false;
    }
    commaInImplicitObject(i) {
      let levels = 0;
      for (let j = i - 1;j >= 0; j--) {
        let tag = this.tokens[j][0];
        if (EXPRESSION_END.has(tag)) {
          levels++;
          continue;
        }
        if (EXPRESSION_START.has(tag)) {
          levels--;
          if (levels < 0)
            return false;
          continue;
        }
        if (levels > 0)
          continue;
        if (tag === ":" && j > 0 && this.tokens[j - 1][0] === "PROPERTY") {
          return this.looksObjectish(i + 1);
        }
        if (LINE_BREAK.has(tag))
          return false;
      }
      return false;
    }
    looksObjectish(j) {
      if (!this.tokens[j])
        return false;
      if (this.tokens[j]?.[0] === "@" && this.tokens[j + 2]?.[0] === ":")
        return true;
      if (this.tokens[j + 1]?.[0] === ":")
        return true;
      if ((this.tokens[j]?.[0] === "IDENTIFIER" || this.tokens[j]?.[0] === "PROPERTY") && this.tokens[j + 1]?.[0] === ".") {
        let k = j + 2;
        while (this.tokens[k]?.[0] === "PROPERTY" && this.tokens[k + 1]?.[0] === ".")
          k += 2;
        if (this.tokens[k]?.[0] === "PROPERTY" && this.tokens[k + 1]?.[0] === ":")
          return true;
      }
      if (EXPRESSION_START.has(this.tokens[j]?.[0])) {
        let end = null;
        this.detectEnd(j + 1, (t) => EXPRESSION_END.has(t[0]), (t, i) => end = i);
        if (end && this.tokens[end + 1]?.[0] === ":")
          return true;
      }
      return false;
    }
    findTagsBackwards(i, tags) {
      let tagSet = new Set(tags);
      let backStack = [];
      while (i >= 0) {
        let tag = this.tokens[i]?.[0];
        if (!backStack.length && tagSet.has(tag))
          return true;
        if (EXPRESSION_END.has(tag))
          backStack.push(tag);
        if (EXPRESSION_START.has(tag) && backStack.length)
          backStack.pop();
        if (!backStack.length && (EXPRESSION_START.has(tag) && !this.tokens[i]?.generated || LINE_BREAK.has(tag)))
          break;
        i--;
      }
      return false;
    }
    makeIndentation(origin) {
      let indent = gen("INDENT", 2);
      let outdent = gen("OUTDENT", 2);
      if (origin) {
        indent.generated = outdent.generated = true;
        indent.origin = outdent.origin = origin;
      } else {
        indent.explicit = outdent.explicit = true;
      }
      return [indent, outdent];
    }
  }
  installTypeSupport(Lexer);
  // src/parser.js
  var parserInstance = {
    symbolIds: { $accept: 0, $end: 1, error: 2, Root: 3, Body: 4, Line: 5, TERMINATOR: 6, Expression: 7, ExpressionLine: 8, Statement: 9, Return: 10, STATEMENT: 11, Import: 12, Export: 13, Value: 14, Code: 15, Operation: 16, Assign: 17, RightwardAssign: 18, ReactiveAssign: 19, ComputedAssign: 20, ReadonlyAssign: 21, Effect: 22, If: 23, Try: 24, While: 25, For: 26, Switch: 27, Class: 28, Component: 29, Render: 30, Throw: 31, Yield: 32, Def: 33, Enum: 34, CodeLine: 35, OperationLine: 36, Assignable: 37, Literal: 38, Parenthetical: 39, Range: 40, Invocation: 41, DoIife: 42, This: 43, Super: 44, MetaProperty: 45, MapLiteral: 46, AlphaNumeric: 47, JS: 48, Regex: 49, UNDEFINED: 50, NULL: 51, BOOL: 52, INFINITY: 53, NAN: 54, NUMBER: 55, String: 56, Identifier: 57, IDENTIFIER: 58, Property: 59, PROPERTY: 60, STRING: 61, STRING_START: 62, Interpolations: 63, STRING_END: 64, InterpolationChunk: 65, INTERPOLATION_START: 66, INTERPOLATION_END: 67, INDENT: 68, OUTDENT: 69, REGEX: 70, REGEX_START: 71, REGEX_END: 72, RegexWithIndex: 73, ",": 74, "=": 75, RIGHTWARD_ASSIGN: 76, REACTIVE_ASSIGN: 77, COMPUTED_ASSIGN: 78, Block: 79, READONLY_ASSIGN: 80, EFFECT: 81, SimpleAssignable: 82, Array: 83, Object: 84, ThisProperty: 85, ".": 86, "?.": 87, INDEX_START: 88, INDEX_END: 89, Slice: 90, ES6_OPTIONAL_INDEX: 91, "{": 92, ObjAssignable: 93, ":": 94, FOR: 95, ForVariables: 96, FOROF: 97, OptComma: 98, "}": 99, WHEN: 100, OWN: 101, AssignList: 102, AssignObj: 103, ObjRestValue: 104, SimpleObjAssignable: 105, "[": 106, "]": 107, "@": 108, "...": 109, ObjSpreadExpr: 110, SUPER: 111, Arguments: 112, DYNAMIC_IMPORT: 113, MAP_START: 114, MAP_END: 115, MapAssignList: 116, MapAssignObj: 117, MapAssignable: 118, Elisions: 119, ArgElisionList: 120, OptElisions: 121, ArgElision: 122, Arg: 123, Elision: 124, RangeDots: 125, "..": 126, DEF: 127, CALL_START: 128, ParamList: 129, CALL_END: 130, PARAM_START: 131, PARAM_END: 132, FuncGlyph: 133, "->": 134, "=>": 135, Param: 136, ParamVar: 137, Splat: 138, ES6_OPTIONAL_CALL: 139, ArgList: 140, SimpleArgs: 141, THIS: 142, NEW_TARGET: 143, IMPORT_META: 144, "(": 145, ")": 146, RETURN: 147, THROW: 148, YIELD: 149, FROM: 150, IfBlock: 151, IF: 152, ELSE: 153, UnlessBlock: 154, UNLESS: 155, POST_IF: 156, POST_UNLESS: 157, TRY: 158, Catch: 159, FINALLY: 160, CATCH: 161, SWITCH: 162, Whens: 163, When: 164, LEADING_WHEN: 165, WhileSource: 166, WHILE: 167, UNTIL: 168, Loop: 169, LOOP: 170, FORIN: 171, BY: 172, FORAS: 173, AWAIT: 174, FORASAWAIT: 175, ForValue: 176, CLASS: 177, EXTENDS: 178, ENUM: 179, COMPONENT: 180, ComponentBody: 181, ComponentLine: 182, OFFER: 183, ACCEPT: 184, RENDER: 185, IMPORT: 186, ImportDefaultSpecifier: 187, ImportNamespaceSpecifier: 188, ImportSpecifierList: 189, ImportSpecifier: 190, AS: 191, DEFAULT: 192, IMPORT_ALL: 193, EXPORT: 194, ExportSpecifierList: 195, EXPORT_ALL: 196, ExportSpecifier: 197, UNARY: 198, DO: 199, DO_IIFE: 200, UNARY_MATH: 201, "-": 202, "+": 203, "?": 204, DEFINED: 205, PRESENCE: 206, "--": 207, "++": 208, MATH: 209, "**": 210, SHIFT: 211, COMPARE: 212, "&": 213, "^": 214, "|": 215, "||": 216, "??": 217, "&&": 218, "!?": 219, PIPE: 220, RELATION: 221, TERNARY: 222, COMPOUND_ASSIGN: 223 },
    tokenNames: { 2: "error", 6: "TERMINATOR", 11: "STATEMENT", 48: "JS", 50: "UNDEFINED", 51: "NULL", 52: "BOOL", 53: "INFINITY", 54: "NAN", 55: "NUMBER", 58: "IDENTIFIER", 60: "PROPERTY", 61: "STRING", 62: "STRING_START", 64: "STRING_END", 66: "INTERPOLATION_START", 67: "INTERPOLATION_END", 68: "INDENT", 69: "OUTDENT", 70: "REGEX", 71: "REGEX_START", 72: "REGEX_END", 74: ",", 75: "=", 76: "RIGHTWARD_ASSIGN", 77: "REACTIVE_ASSIGN", 78: "COMPUTED_ASSIGN", 80: "READONLY_ASSIGN", 81: "EFFECT", 86: ".", 87: "?.", 88: "INDEX_START", 89: "INDEX_END", 91: "ES6_OPTIONAL_INDEX", 92: "{", 94: ":", 95: "FOR", 97: "FOROF", 99: "}", 100: "WHEN", 101: "OWN", 106: "[", 107: "]", 108: "@", 109: "...", 111: "SUPER", 113: "DYNAMIC_IMPORT", 114: "MAP_START", 115: "MAP_END", 126: "..", 127: "DEF", 128: "CALL_START", 130: "CALL_END", 131: "PARAM_START", 132: "PARAM_END", 134: "->", 135: "=>", 139: "ES6_OPTIONAL_CALL", 142: "THIS", 143: "NEW_TARGET", 144: "IMPORT_META", 145: "(", 146: ")", 147: "RETURN", 148: "THROW", 149: "YIELD", 150: "FROM", 152: "IF", 153: "ELSE", 155: "UNLESS", 156: "POST_IF", 157: "POST_UNLESS", 158: "TRY", 160: "FINALLY", 161: "CATCH", 162: "SWITCH", 165: "LEADING_WHEN", 167: "WHILE", 168: "UNTIL", 170: "LOOP", 171: "FORIN", 172: "BY", 173: "FORAS", 174: "AWAIT", 175: "FORASAWAIT", 177: "CLASS", 178: "EXTENDS", 179: "ENUM", 180: "COMPONENT", 183: "OFFER", 184: "ACCEPT", 185: "RENDER", 186: "IMPORT", 191: "AS", 192: "DEFAULT", 193: "IMPORT_ALL", 194: "EXPORT", 196: "EXPORT_ALL", 198: "UNARY", 199: "DO", 200: "DO_IIFE", 201: "UNARY_MATH", 202: "-", 203: "+", 204: "?", 205: "DEFINED", 206: "PRESENCE", 207: "--", 208: "++", 209: "MATH", 210: "**", 211: "SHIFT", 212: "COMPARE", 213: "&", 214: "^", 215: "|", 216: "||", 217: "??", 218: "&&", 219: "!?", 220: "PIPE", 221: "RELATION", 222: "TERNARY", 223: "COMPOUND_ASSIGN" },
    parseTable: (() => {
      let d = [110, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, -1, 1, 2, 3, 4, 5, 6, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 1, 1, 0, 2, 1, 5, -2, 110, 5, 1, 5, 61, 2, 77, -3, -3, -3, -3, -3, 32, 1, 5, 61, 1, 1, 5, 2, 19, 12, 23, 16, 10, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -6, -6, -6, -6, -6, -6, 127, 131, -6, -6, -6, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 9, 1, 5, 61, 1, 1, 5, 33, 23, 16, -7, -7, -7, -7, -7, -7, -7, -7, -7, 14, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 9, 1, 1, -8, -8, -8, -8, -8, -8, -8, -8, -8, 132, 133, 134, 99, 100, 58, 1, 5, 50, 5, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 3, 3, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -13, -13, 138, 108, 109, -13, -13, -13, -13, -13, 141, 142, 143, -13, 144, -13, -13, -13, -13, -13, -13, -13, 139, -13, -13, 145, -13, -13, 140, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, 135, 136, 137, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, 48, 1, 5, 61, 1, 1, 5, 2, 10, 1, 1, 1, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -14, -14, -14, -14, -14, -14, -14, 146, 147, 148, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, -33, 9, 1, 5, 61, 1, 1, 5, 33, 23, 16, -34, -34, -34, -34, -34, -34, -34, -34, -34, 9, 1, 5, 61, 1, 1, 5, 33, 23, 16, -35, -35, -35, -35, -35, -35, -35, -35, -35, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -36, -36, -36, -36, -36, -36, -36, -36, 149, -36, 150, 151, 152, 153, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, 18, 6, 51, 1, 10, 1, 5, 9, 1, 1, 7, 14, 2, 1, 20, 1, 2, 4, 1, -199, 158, 107, -199, -199, -199, 160, 161, 159, 102, 163, 162, 157, 154, -199, -199, 155, 156, 109, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 2, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 165, 4, 5, 6, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 166, 105, 106, 164, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 106, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 167, 168, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 106, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 170, 171, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 172, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 178, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 179, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 180, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 181, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 47, 14, 1, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 11, 1, 1, 1, 7, 14, 2, 3, 2, 1, 17, 2, 1, 1, 7, 1, 1, 1, 55, 183, 184, 185, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 182, 74, 75, 96, 102, 85, 89, 86, 87, 92, 173, 174, 93, 94, 88, 90, 91, 84, 177, 47, 14, 1, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 11, 1, 1, 1, 7, 14, 2, 3, 2, 1, 17, 2, 1, 1, 7, 1, 1, 1, 55, 183, 184, 185, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 186, 74, 75, 96, 102, 85, 89, 86, 87, 92, 173, 174, 93, 94, 88, 90, 91, 84, 177, 64, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, 187, 188, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, 189, 106, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 2, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 191, 190, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 166, 105, 106, 192, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, 193, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, 2, 68, 11, 166, 194, 2, 68, 11, 166, 195, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, 14, 40, 17, 1, 25, 1, 1, 7, 4, 5, 5, 2, 29, 37, 2, 199, 158, 107, 160, 161, 159, 102, 196, 197, 85, 162, 201, 198, 200, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 202, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 203, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 94, 1, 5, 8, 1, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 2, 3, 3, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 1, 1, 11, 4, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 2, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -331, -331, 183, 184, 185, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, -331, 166, -331, 105, 106, -331, -331, 204, 206, 74, 75, 96, -331, 102, -331, -331, -331, -331, -331, 85, -331, 89, -331, 86, 87, 92, -331, -331, -331, 173, -331, 174, 93, 94, 88, 90, 91, 84, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, 205, 177, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, 2, 68, 110, 207, 208, 2, 68, 11, 166, 209, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 210, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 211, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 144, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 2, 5, 1, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 1, 1, 11, 1, 3, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -250, -250, 212, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, -250, 213, -250, 105, 106, -250, -250, 55, 54, 74, 75, 96, -250, 102, -250, -250, -250, -250, -250, 85, -250, 89, -250, 86, 87, 92, -250, -250, 68, -250, 173, -250, 174, 93, 94, 88, 90, 91, 84, -250, 71, 66, 67, 214, 56, 97, -250, 57, 98, -250, -250, 58, 62, 59, -250, -250, 60, 101, -250, -250, -250, 51, -250, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, 2, 57, 1, 215, 107, 2, 57, 1, 216, 107, 6, 15, 20, 96, 2, 1, 1, 218, 217, 44, 45, 93, 94, 143, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 2, 5, 1, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 1, 1, 11, 1, 3, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -247, -247, 219, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, -247, 220, -247, 105, 106, -247, -247, 55, 54, 74, 75, 96, -247, 102, -247, -247, -247, -247, -247, 85, -247, 89, -247, 86, 87, 92, -247, -247, 68, -247, 173, -247, 174, 93, 94, 88, 90, 91, 84, -247, 71, 66, 67, 56, 97, -247, 57, 98, -247, -247, 58, 62, 59, -247, -247, 60, 101, -247, -247, -247, 51, -247, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, 9, 56, 1, 1, 3, 1, 30, 95, 1, 5, 221, 225, 107, 108, 109, 224, 222, 223, 226, 62, 14, 1, 4, 1, 1, 1, 6, 1, 4, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 14, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 32, 2, 1, 12, 4, 4, 183, 184, 233, 234, 235, 236, 228, 229, 230, 231, 239, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 232, 107, 108, 109, 105, 106, 55, 240, 74, 75, 96, 227, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 63, 69, 64, 237, 238, 177, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, 109, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 241, 3, 4, 5, 6, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 242, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 116, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 7, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 5, 1, 2, 1, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 243, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 249, 105, 106, 250, 55, 54, 74, 75, 96, 102, 61, 85, 244, 89, 254, 86, 87, 92, 245, 246, 248, 251, 247, 68, 44, 45, 93, 94, 253, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 4, 86, 2, 24, 16, 256, 257, 255, 145, 2, 112, 16, 258, 145, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, 58, 1, 5, 53, 1, 1, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -232, -232, 259, 260, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, 1, 86, 261, 1, 86, 262, 34, 6, 33, 8, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 1, 3, 9, 1, 1, 7, 14, 2, 1, 6, 1, 1, 1, 27, -147, 280, 271, 272, 275, 274, 273, 276, 277, 103, 104, 268, 107, 269, 260, 108, 109, -147, -147, 105, 106, -147, 278, 279, 270, 102, 163, 162, 267, 263, 264, 265, 266, 84, 55, 11, 37, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 2, 1, 10, 11, 3, 11, 2, 3, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, -197, 55, 11, 37, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 2, 1, 10, 11, 3, 11, 2, 3, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, -198, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 281, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 282, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 283, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 284, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 105, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 2, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 286, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 166, 105, 106, 285, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 23, 6, 41, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 5, 11, 8, 6, 3, 1, 1, 1, 1, 2, 1, -112, 292, 103, 104, 294, 107, 295, 260, 108, 109, -112, -112, -112, 296, 287, -112, 288, 293, 297, 289, 290, 291, 298, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, 47, 14, 1, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 11, 1, 1, 1, 7, 14, 2, 3, 2, 1, 17, 2, 1, 1, 7, 1, 1, 1, 55, 183, 184, 185, 35, 36, 37, 299, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 240, 74, 75, 96, 102, 85, 89, 86, 87, 92, 173, 174, 93, 94, 88, 90, 91, 84, 177, 67, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 4, 3, 3, 1, 10, 1, 3, 1, 1, 2, 3, 13, 11, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, 59, 1, 5, 55, 1, 2, 2, 1, 1, 1, 3, 2, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, 6, 56, 5, 1, 1, 2, 1, 303, 108, 109, 300, 301, 302, 112, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 2, 1, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, -5, 304, -5, 4, 5, 6, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, -5, -5, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, -5, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 305, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 306, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 307, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 308, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 309, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 310, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 311, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 312, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 313, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 316, 169, 314, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 315, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 319, 169, 317, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 318, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 322, 169, 320, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 321, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 323, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 324, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 325, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 326, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 47, 14, 1, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 11, 1, 1, 1, 7, 14, 2, 3, 2, 1, 17, 2, 1, 1, 7, 1, 1, 1, 55, 183, 184, 327, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 240, 74, 75, 96, 102, 85, 89, 86, 87, 92, 173, 174, 93, 94, 88, 90, 91, 84, 177, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 328, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 329, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, 14, 40, 17, 1, 25, 1, 1, 7, 4, 5, 5, 2, 29, 37, 2, 333, 158, 107, 160, 161, 159, 102, 330, 331, 85, 162, 201, 332, 200, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 334, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 335, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, 57, 1, 5, 55, 1, 5, 1, 1, 3, 2, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, 57, 1, 5, 55, 1, 5, 1, 1, 3, 2, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, 2, 112, 16, 336, 145, 2, 59, 1, 337, 260, 2, 59, 1, 338, 260, 109, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 2, 8, 1, 1, 1, 1, 5, 2, 3, 11, 2, 1, 2, 2, 1, 11, 1, 1, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 339, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 344, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 340, 105, 106, 342, 55, 54, 74, 75, 96, 341, 102, 61, 85, 89, 346, 86, 87, 92, 343, 345, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 1, 88, 347, 112, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 9, 4, 3, 1, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 352, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 351, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 254, 86, 87, 92, 350, 68, 348, 44, 45, 93, 94, 253, 349, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 2, 59, 1, 353, 260, 2, 59, 1, 354, 260, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 355, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 356, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 105, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 358, 357, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 359, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 105, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 361, 360, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 362, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 106, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 2, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 364, 363, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 166, 105, 106, 365, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 105, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 367, 366, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 368, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 106, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 2, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 370, 369, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 166, 105, 106, 371, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 10, 6, 62, 1, 5, 24, 1, 8, 8, 15, 2, -243, -243, -243, 373, 374, -243, -243, -243, -243, 372, 6, 6, 62, 1, 5, 56, 2, -200, -200, -200, -200, -200, -200, 7, 6, 62, 1, 5, 1, 55, 2, -204, -204, -204, -204, 375, -204, -204, 15, 6, 51, 1, 10, 1, 5, 9, 1, 1, 7, 14, 2, 22, 2, 5, -207, 158, 107, -207, -207, -207, 160, 161, 159, 102, 163, 162, -207, -207, 376, 11, 6, 62, 1, 5, 1, 22, 33, 2, 39, 2, 2, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, 11, 6, 62, 1, 5, 1, 22, 33, 2, 39, 2, 2, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, 11, 6, 62, 1, 5, 1, 22, 33, 2, 39, 2, 2, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, 11, 6, 62, 1, 5, 1, 22, 33, 2, 39, 2, 2, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, 2, 59, 1, 259, 260, 116, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 7, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 5, 1, 2, 1, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 352, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 249, 105, 106, 250, 55, 54, 74, 75, 96, 102, 61, 85, 244, 89, 254, 86, 87, 92, 245, 246, 248, 251, 247, 68, 44, 45, 93, 94, 253, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, -194, 9, 1, 5, 61, 1, 1, 5, 33, 23, 16, -196, -196, -196, -196, -196, -196, -196, -196, -196, 109, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 378, 3, 4, 5, 6, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 377, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, 130, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, 121, -400, 123, -400, -400, -400, 9, 1, 5, 61, 1, 1, 5, 33, 23, 16, -397, -397, -397, -397, -397, -397, -397, -397, -397, 5, 156, 1, 9, 1, 1, 132, 133, 134, 99, 100, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, 130, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, 121, -401, 123, -401, -401, -401, 9, 1, 5, 61, 1, 1, 5, 33, 23, 16, -398, -398, -398, -398, -398, -398, -398, -398, -398, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, 130, -402, -402, -402, -402, -402, -402, -402, -402, -402, 114, -402, -402, -402, -402, -402, -402, 121, -402, 123, -402, -402, -402, 18, 6, 51, 1, 10, 1, 5, 9, 1, 1, 7, 14, 2, 1, 20, 1, 2, 4, 1, -199, 158, 107, -199, -199, -199, 160, 161, 159, 102, 163, 162, 157, 379, -199, -199, 155, 156, 2, 68, 11, 166, 164, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 167, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 170, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 5, 15, 116, 2, 1, 1, 218, 173, 174, 93, 94, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, 130, -403, -403, -403, -403, -403, -403, -403, -403, -403, 114, -403, -403, -403, -403, -403, -403, 121, -403, 123, -403, -403, -403, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, 130, -404, -404, -404, -404, -404, -404, -404, -404, -404, 114, -404, -404, -404, -404, -404, -404, 121, -404, 123, -404, -404, -404, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, 130, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, 121, -408, 123, -408, -408, -408, 2, 84, 8, 380, 102, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -410, -410, -89, -89, -410, -410, -410, -410, -89, -410, -89, -89, -89, -89, -89, -89, -89, -410, -89, -410, -410, -410, -410, -410, -410, -410, -410, -410, -89, -410, -410, -89, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -89, -89, -89, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, 10, 56, 5, 1, 24, 1, 1, 3, 21, 16, 11, 138, 108, 109, 141, 142, 143, 144, 139, 145, 140, 3, 86, 1, 1, 146, 147, 148, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -411, -411, -89, -89, -411, -411, -411, -411, -89, -411, -89, -89, -89, -89, -89, -89, -89, -411, -89, -411, -411, -411, -411, -411, -411, -411, -411, -411, -89, -411, -411, -89, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -89, -89, -89, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, 105, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 383, 381, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 382, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -86, -86, -86, -86, -86, -86, 127, -86, -86, 131, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, 128, 129, 130, 99, 100, -86, -86, -86, -86, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 384, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, 3, 68, 11, 73, 166, 385, 386, 48, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 2, 1, 1, 6, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, 387, 388, 389, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, 4, 97, 74, 2, 2, 391, 390, 392, 393, 11, 57, 1, 25, 1, 1, 7, 4, 10, 2, 29, 39, 158, 107, 160, 161, 159, 102, 394, 163, 162, 201, 200, 11, 57, 1, 25, 1, 1, 7, 4, 10, 2, 29, 39, 158, 107, 160, 161, 159, 102, 395, 163, 162, 201, 200, 3, 68, 11, 93, 166, 396, 397, 5, 74, 23, 74, 2, 2, 398, -329, -329, -329, -329, 6, 74, 1, 22, 74, 2, 2, -327, 399, -327, -327, -327, -327, 24, 68, 8, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 400, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 3, 163, 1, 1, 401, 402, 403, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 404, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 63, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -335, -335, -89, -89, -335, 166, -335, -335, -89, -335, -89, -89, 405, -89, -89, -89, -89, -89, -335, -89, -335, -335, -335, -335, -335, -335, -335, -335, -335, -89, -335, -335, -89, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, 406, -335, -335, -89, -89, -89, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, 110, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 409, 410, 411, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 407, 408, 412, 413, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 414, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -248, -248, -248, -248, -248, -248, 127, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, 130, -248, -248, -248, -248, -248, -248, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 2, 84, 8, 415, 102, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, 130, -251, -251, -251, -251, -251, -251, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 2, 84, 8, 416, 102, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 417, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 3, 68, 11, 49, 166, 419, 418, 2, 68, 11, 166, 420, 9, 1, 5, 61, 1, 1, 5, 33, 23, 16, -399, -399, -399, -399, -399, -399, -399, -399, -399, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, -439, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -245, -245, -245, -245, -245, -245, 127, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, 130, -245, -245, -245, -245, -245, -245, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 2, 84, 8, 421, 102, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, 2, 74, 76, 423, 422, 1, 150, 424, 7, 57, 1, 10, 31, 90, 1, 2, 429, 107, 428, 425, 426, 427, 430, 2, 74, 76, -367, -367, 1, 191, 431, 26, 6, 41, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 5, 11, 8, 6, 3, 1, 1, 1, 1, 2, 1, 83, 3, 2, -112, 292, 103, 104, 436, 107, 295, 260, 108, 109, 435, -112, -112, 296, 287, 432, 288, 293, 297, 289, 290, 291, 298, 437, 433, 434, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -92, -92, -92, -92, -92, -92, -92, -92, 438, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 439, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 440, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 1, 150, 441, 60, 1, 5, 55, 1, 5, 1, 1, 5, 2, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -36, -36, -36, -36, -36, -36, -36, -36, -36, 150, 151, 152, 153, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, 2, 6, 140, 110, 442, 108, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 443, 3, 4, 5, 6, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 32, 6, 62, 1, 5, 2, 19, 12, 2, 16, 1, 4, 26, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -225, -225, -225, -225, 127, 131, -225, 346, 444, 345, -225, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, 112, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 7, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 9, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 352, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 250, 55, 54, 74, 75, 96, 102, 61, 85, 445, 89, 254, 86, 87, 92, 447, 446, 68, 44, 45, 93, 94, 253, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 10, 6, 62, 1, 5, 24, 1, 8, 8, 6, 9, -243, -243, -243, 449, 450, -243, -243, -243, 448, -243, 60, 6, 5, 37, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 7, 11, 3, 11, 1, 1, 1, 2, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 451, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, 5, 6, 62, 1, 5, 33, -171, -171, -171, -171, -171, 115, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 7, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 5, 1, 2, 1, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 352, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 249, 105, 106, 250, 55, 54, 74, 75, 96, 102, 61, 85, 89, 254, 86, 87, 92, 453, 452, 248, 251, 247, 68, 44, 45, 93, 94, 253, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 60, 6, 5, 37, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 7, 11, 3, 11, 1, 1, 1, 2, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, 5, 6, 62, 1, 5, 33, -176, -176, -176, -176, -176, 6, 6, 62, 1, 5, 33, 23, -226, -226, -226, -226, -226, -226, 6, 6, 62, 1, 5, 33, 23, -227, -227, -227, -227, -227, -227, 109, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 7, 1, 1, 1, 1, 7, 3, 11, 1, 1, 3, 2, 1, 13, 3, 1, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, -228, 454, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, -228, -228, 105, 106, -228, 55, 54, 74, 75, 96, 102, 61, 85, -228, 89, 86, 87, 92, 68, -228, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 57, 1, 5, 55, 1, 5, 1, 1, 3, 2, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, 2, 59, 1, 455, 260, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 456, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 457, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 57, 1, 5, 55, 1, 5, 1, 1, 3, 2, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, 2, 59, 1, 458, 260, 2, 59, 1, 459, 260, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, -145, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 461, 460, -243, -243, -243, -243, 5, 6, 62, 1, 5, 41, -148, -148, -148, -148, -148, 1, 94, 462, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 463, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 1, 94, -155, 1, 94, -156, 1, 94, -157, 1, 94, -158, 1, 94, -159, 1, 94, -160, 1, 94, -161, 1, 94, -162, 1, 94, -163, 1, 94, -164, 1, 94, -165, 1, 94, -166, 1, 94, -167, 25, 68, 8, 3, 16, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 464, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 25, 68, 8, 3, 16, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 465, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -282, -282, -282, -282, -282, -282, 127, -282, -282, 131, -282, -282, 466, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, 130, 99, 100, -282, -282, -282, -282, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -284, -284, -284, -284, -284, -284, 127, -284, -284, 131, -284, -284, 467, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, 130, 99, 100, -284, -284, -284, -284, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, 47, 1, 5, 61, 1, 1, 5, 2, 3, 10, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -291, -291, -291, 166, -291, -291, 127, 468, -291, -291, 131, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, 130, 99, 100, -291, -291, -291, -291, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 6, 6, 62, 1, 5, 20, 5, -117, -117, -117, -117, 469, -117, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 471, 470, -243, -243, -243, -243, 7, 6, 62, 1, 5, 1, 19, 5, -126, -126, -126, -126, 472, -126, -126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 473, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 3, 59, 1, 46, 259, 260, 474, 6, 6, 62, 1, 5, 20, 5, -129, -129, -129, -129, -129, -129, 5, 6, 62, 1, 5, 25, -113, -113, -113, -113, -113, 11, 6, 62, 1, 5, 1, 11, 1, 1, 6, 5, 29, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, 11, 6, 62, 1, 5, 1, 11, 1, 1, 6, 5, 29, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, -124, 11, 6, 62, 1, 5, 1, 11, 1, 1, 6, 5, 29, -125, -125, -125, -125, -125, -125, -125, -125, -125, -125, -125, 5, 6, 62, 1, 5, 25, -118, -118, -118, -118, -118, 17, 39, 4, 1, 13, 1, 1, 1, 24, 1, 7, 13, 3, 2, 1, 2, 29, 3, 478, 480, 479, 294, 107, 295, 260, 477, 296, 102, 475, 89, 476, 481, 482, 88, 84, 57, 1, 5, 55, 1, 5, 1, 1, 3, 2, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -40, -40, -40, -40, -40, -40, -40, 483, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, 6, 56, 5, 1, 2, 1, 1, 303, 108, 109, 484, 485, 302, 4, 61, 1, 2, 2, -60, -60, -60, -60, 110, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 486, 3, 4, 5, 6, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 488, 487, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 4, 61, 1, 2, 2, -65, -65, -65, -65, 5, 1, 5, 61, 2, 77, -4, -4, -4, -4, -4, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, 130, -414, -414, -414, -414, -414, -414, -414, -414, 113, 114, -414, -414, -414, -414, -414, -414, 121, -414, 123, -414, -414, -414, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, 130, -415, -415, -415, -415, -415, -415, -415, -415, 113, 114, -415, -415, -415, -415, -415, -415, 121, -415, 123, -415, -415, -415, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, 130, -416, -416, -416, -416, -416, -416, -416, -416, -416, 114, -416, -416, -416, -416, -416, -416, 121, -416, 123, -416, -416, -416, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, 130, -417, -417, -417, -417, -417, -417, -417, -417, -417, 114, -417, -417, -417, -417, -417, -417, 121, -417, 123, -417, -417, -417, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, 130, -418, -418, -418, -418, -418, -418, 112, 111, 113, 114, -418, -418, -418, -418, -418, -418, 121, -418, 123, -418, -418, -418, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, 130, -419, -419, -419, -419, -419, -419, 112, 111, 113, 114, 115, -419, -419, -419, -419, -419, 121, -419, 123, -419, 125, -419, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, 130, -420, -420, -420, -420, -420, -420, 112, 111, 113, 114, 115, 116, -420, -420, -420, -420, 121, -420, 123, -420, 125, -420, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, 130, -421, -421, -421, -421, -421, -421, 112, 111, 113, 114, 115, 116, 117, -421, -421, -421, 121, -421, 123, -421, 125, -421, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, 130, -422, -422, -422, -422, -422, -422, 112, 111, 113, 114, 115, 116, 117, 118, -422, -422, 121, -422, 123, -422, 125, -422, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, 130, -430, -430, -430, -430, -430, -430, 112, 111, 113, 114, 115, 116, 117, 118, 119, -430, 121, 122, 123, -430, 125, -430, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -431, -431, -431, -431, -431, -431, 127, -431, -431, 131, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, 128, 129, 130, 99, 100, -431, -431, -431, -431, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, 130, -429, -429, -429, -429, -429, -429, 112, 111, 113, 114, 115, 116, 117, 118, 119, -429, 121, -429, 123, -429, 125, -429, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -432, -432, -432, -432, -432, -432, 127, -432, -432, 131, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, 128, 129, 130, 99, 100, -432, -432, -432, -432, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, 130, -433, -433, -433, -433, -433, -433, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, -433, 125, -433, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, 130, -434, -434, -434, -434, -434, -434, 112, 111, 113, 114, 115, -434, -434, -434, -434, -434, 121, -434, 123, -434, -434, -434, 24, 76, 18, 1, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, 489, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -73, -73, -36, -36, -73, -73, -73, -73, -73, -36, -36, -36, -73, -36, -73, -73, -73, -73, -73, -73, -73, -73, -73, -36, -73, -73, -36, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -36, -36, -36, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -262, -262, -262, -262, -262, -262, 127, -262, -262, 131, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, 490, -262, -262, 130, 99, 100, -262, -262, -262, -262, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -266, -266, -266, -266, -266, -266, 127, -266, -266, 131, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, 130, 99, 100, -266, -266, -266, -266, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 4, 97, 74, 2, 2, 492, 491, 493, 494, 11, 57, 1, 25, 1, 1, 7, 4, 10, 2, 29, 39, 158, 107, 160, 161, 159, 102, 495, 163, 162, 201, 200, 11, 57, 1, 25, 1, 1, 7, 4, 10, 2, 29, 39, 158, 107, 160, 161, 159, 102, 496, 163, 162, 201, 200, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, 497, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -261, -261, -261, -261, -261, -261, 127, -261, -261, 131, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, 130, 99, 100, -261, -261, -261, -261, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -265, -265, -265, -265, -265, -265, 127, -265, -265, 131, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, 130, 99, 100, -265, -265, -265, -265, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 57, 1, 5, 55, 1, 5, 1, 1, 3, 2, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, 27, 76, 13, 6, 14, 16, 1, 30, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, 498, 131, 346, 499, 345, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 107, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 5, 2, 3, 11, 2, 1, 2, 2, 1, 11, 1, 1, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 500, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 501, 102, 61, 85, 89, 346, 86, 87, 92, 343, 345, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 1, 89, 502, 1, 89, 503, 105, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 10, 1, 1, 1, 1, 4, 3, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 504, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, -190, 105, 106, 55, 54, 74, 75, 96, -190, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -48, -48, -48, -48, -48, -48, -48, 505, -48, -48, -48, -48, -69, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, 56, 11, 37, 2, 1, 1, 1, 1, 1, 3, 3, 1, 7, 1, 1, 10, 8, 3, 3, 11, 2, 3, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, 56, 11, 37, 2, 1, 1, 1, 1, 1, 3, 3, 1, 7, 1, 1, 10, 8, 3, 3, 11, 2, 3, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 506, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 507, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 57, 1, 5, 55, 1, 5, 1, 1, 3, 2, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, -218, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 509, 508, -243, -243, -243, -243, 5, 6, 62, 1, 5, 56, -220, -220, -220, -220, -220, 111, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 9, 4, 4, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 352, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 351, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 254, 86, 87, 92, 350, 68, 44, 45, 93, 94, 253, 510, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 29, 6, 62, 1, 5, 2, 19, 12, 23, 26, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -225, -225, -225, -225, 127, 131, -225, -225, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, 24, 76, 13, 6, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, 511, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 512, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -70, -70, -70, -70, -70, -70, 127, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, 130, -70, -70, -70, -70, -70, -70, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 513, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 514, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -74, -74, -74, -74, -74, -74, 127, -74, -74, 131, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, 128, 129, 130, 99, 100, -74, -74, -74, -74, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 515, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 516, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -77, -77, -77, -77, -77, -77, 127, -77, -77, 131, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, 128, 129, 130, 99, 100, -77, -77, -77, -77, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 517, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -80, -80, -80, -80, -80, -80, 127, -80, -80, 131, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, 128, 129, 130, 99, 100, -80, -80, -80, -80, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 518, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 519, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -83, -83, -83, -83, -83, -83, 127, -83, -83, 131, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, 128, 129, 130, 99, 100, -83, -83, -83, -83, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 520, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, 3, 133, 1, 1, 521, 93, 94, 18, 6, 51, 1, 10, 1, 14, 1, 1, 7, 7, 7, 1, 1, 1, 6, 15, 6, 1, -244, 158, 107, -244, -244, 160, 161, 159, 102, -244, 163, -244, 162, 157, -244, -244, 522, 156, 2, 6, 62, 523, 524, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 525, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 6, 6, 62, 1, 5, 56, 2, -206, -206, -206, -206, -206, -206, 59, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 3, 1, 4, 2, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, 2, 6, 63, 110, 526, 10, 6, 62, 1, 5, 24, 1, 8, 8, 15, 2, -243, -243, -243, 373, 374, -243, -243, -243, -243, 527, 1, 69, 528, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -436, -436, -436, -436, -436, -436, 127, -436, -436, -436, -436, -436, -436, -436, -436, -436, -436, -436, -436, -436, -436, -436, -436, 130, -436, -436, -436, -436, -436, -436, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 529, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 530, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -87, -87, -87, -87, -87, -87, 127, -87, -87, 131, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, 128, 129, 130, 99, 100, -87, -87, -87, -87, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 531, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 3, 7, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, 532, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, 2, 68, 11, 166, 533, 6, 57, 1, 10, 11, 5, 8, 534, 107, 166, 536, 535, 102, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 537, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 538, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 539, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 540, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 1, 97, 541, 1, 173, 542, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 543, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 10, 57, 1, 25, 1, 1, 7, 14, 2, 29, 39, 158, 107, 160, 161, 159, 102, 163, 162, 201, 544, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 545, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 3, 163, 1, 1, 546, 402, 403, 4, 69, 84, 11, 1, 547, 548, 549, 403, 3, 69, 84, 12, -278, -278, -278, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 6, 1, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 551, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 550, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 47, 1, 5, 61, 1, 1, 5, 2, 3, 10, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -333, -333, -333, 166, -333, -333, 127, 552, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, 130, -333, -333, -333, -333, -333, -333, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 553, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 2, 6, 63, 555, 554, 2, 6, 63, -342, -342, 25, 6, 63, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -345, -345, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 2, 6, 63, -346, -346, 7, 6, 63, 87, 1, 9, 1, 1, -347, -347, 132, 133, 134, 99, 100, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 556, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 1, 58, 557, 24, 68, 8, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 558, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 1, 69, 559, 1, 69, 560, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, 130, -253, -253, -253, -253, -253, -253, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 18, 6, 51, 1, 10, 1, 5, 9, 1, 1, 7, 14, 2, 1, 20, 1, 2, 4, 1, -199, 158, 107, -199, -199, -199, 160, 161, 159, 102, 163, 162, 157, 561, -199, -199, 155, 156, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, 1, 69, 562, 3, 56, 5, 1, 563, 108, 109, 3, 92, 96, 5, 565, 564, 226, 3, 56, 5, 1, 566, 108, 109, 1, 150, 567, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 569, 568, -243, -243, -243, -243, 5, 6, 62, 1, 5, 25, -358, -358, -358, -358, -358, 6, 57, 1, 10, 121, 1, 2, 429, 107, 428, 570, 427, 430, 6, 6, 62, 1, 5, 25, 92, -363, -363, -363, -363, -363, 571, 6, 6, 62, 1, 5, 25, 92, -365, -365, -365, -365, -365, 572, 2, 57, 1, 573, 107, 14, 1, 5, 61, 1, 1, 5, 33, 23, 16, 4, 6, 1, 10, 1, -369, -369, -369, -369, -369, -369, -369, -369, -369, 574, -369, -369, -369, -369, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 576, 575, -243, -243, -243, -243, 5, 6, 62, 1, 5, 25, -387, -387, -387, -387, -387, 6, 57, 1, 10, 124, 3, 2, 578, 107, 435, 437, 577, 434, 12, 6, 62, 1, 5, 1, 11, 1, 1, 6, 5, 29, 63, -392, -392, -392, -392, -123, -123, -123, -123, -123, -392, -123, 579, 6, 6, 62, 1, 5, 25, 92, -395, -395, -395, -395, -395, 580, 105, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 582, 581, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 583, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 32, 1, 5, 61, 1, 1, 5, 2, 19, 12, 23, 16, 10, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -382, -382, -382, -382, -382, -382, 127, 131, -382, -382, -382, -382, -382, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 2, 84, 8, 584, 102, 3, 56, 5, 1, 585, 108, 109, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, 2, 6, 63, 110, 586, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 587, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, -169, 60, 6, 5, 37, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 7, 11, 3, 11, 1, 1, 1, 2, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 451, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, 5, 6, 62, 1, 5, 33, -177, -177, -177, -177, -177, 2, 68, 39, 589, 588, 120, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 7, 1, 1, 1, 1, 7, 3, 4, 7, 1, 1, 1, 2, 2, 1, 1, 4, 3, 1, 1, 3, 3, 1, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, -244, 352, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, -244, -244, 105, 106, 250, 55, 54, 74, 75, 96, 102, 61, -244, 85, -244, 89, 254, 86, 87, 92, -244, 591, 590, 251, 247, 68, -244, 44, 45, 93, 94, 253, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 4, 6, 62, 1, 38, 592, -178, -178, -178, 60, 6, 5, 37, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 7, 11, 3, 11, 1, 1, 1, 2, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, 10, 6, 62, 1, 5, 24, 1, 8, 8, 6, 9, -243, -243, -243, 449, 450, -243, -243, -243, 593, -243, 111, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 7, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 9, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 352, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 250, 55, 54, 74, 75, 96, 102, 61, 85, 89, 254, 86, 87, 92, 447, 446, 68, 44, 45, 93, 94, 253, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 29, 6, 62, 1, 5, 2, 19, 12, 23, 26, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -212, -212, -212, -212, 127, 131, -212, -212, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, 24, 76, 13, 6, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, 594, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 595, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, 3, 6, 62, 47, 597, 598, 596, 35, 6, 33, 8, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 1, 12, 1, 1, 7, 7, 7, 1, 1, 1, 6, 2, 1, 12, 15, -244, 280, 271, 272, 275, 274, 273, 276, 277, 103, 104, 268, 107, 269, 260, 108, 109, -244, -244, 105, 106, 278, 279, 270, 102, -244, 163, -244, 162, 267, -244, 599, 266, -244, 84, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 600, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 601, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 28, 6, 62, 1, 5, 2, 19, 20, 41, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -154, -154, -154, -154, 127, 131, -154, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, 602, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 603, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 604, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 605, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 606, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 3, 6, 62, 31, 608, 609, 607, 24, 6, 41, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 16, 8, 6, 4, 1, 1, 1, 1, 1, 1, 6, 15, -244, 292, 103, 104, 294, 107, 295, 260, 108, 109, -244, -244, 296, 611, -244, 610, 297, 289, 290, -244, 291, 298, -244, -244, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 612, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 613, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 24, 76, 19, 12, 49, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, 131, 614, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 615, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 10, 6, 62, 1, 5, 12, 1, 1, 11, 13, 16, -130, -130, -130, -130, -132, -132, -132, -130, 616, 145, 10, 6, 62, 1, 5, 12, 1, 1, 11, 13, 16, -131, -131, -131, -131, 618, 619, 620, -131, 617, 145, 9, 6, 62, 1, 5, 12, 1, 1, 11, 29, -133, -133, -133, -133, -133, -133, -133, -133, -133, 9, 6, 62, 1, 5, 12, 1, 1, 11, 29, -134, -134, -134, -134, -134, -134, -134, -134, -134, 9, 6, 62, 1, 5, 12, 1, 1, 11, 29, -135, -135, -135, -135, -135, -135, -135, -135, -135, 9, 6, 62, 1, 5, 12, 1, 1, 11, 29, -136, -136, -136, -136, -136, -136, -136, -136, -136, 4, 86, 2, 24, 16, 256, 257, 621, 145, 2, 112, 16, 622, 145, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, -67, 59, 1, 5, 55, 1, 2, 2, 1, 1, 1, 3, 2, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, -59, 4, 61, 1, 2, 2, -61, -61, -61, -61, 2, 6, 61, 110, 623, 108, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 624, 3, 4, 5, 6, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 4, 61, 1, 2, 2, -64, -64, -64, -64, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 625, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 627, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 626, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 628, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 629, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 630, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 631, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 1, 97, 632, 1, 173, 633, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 634, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, 105, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 10, 1, 1, 1, 1, 4, 3, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 635, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, -188, 105, 106, 55, 54, 74, 75, 96, -188, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 27, 69, 7, 19, 14, 16, 1, 30, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 636, 127, 131, 346, 499, 345, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 1, 69, 637, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, 25, 69, 7, 13, 6, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -189, 127, -189, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 638, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 24, 76, 13, 6, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, 639, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 640, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 3, 6, 62, 62, 642, 643, 641, 116, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 10, 1, 1, 1, 1, 7, 3, 4, 7, 1, 1, 1, 2, 2, 1, 1, 8, 4, 3, 1, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, -244, 352, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, -244, -244, 105, 106, 55, 54, 74, 75, 96, 102, 61, -244, 85, -244, 89, 254, 86, 87, 92, -244, 644, 68, -244, 44, 45, 93, 94, 253, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 509, 645, -243, -243, -243, -243, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, 24, 69, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 646, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -71, -71, -71, -71, -71, -71, 127, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, 130, -71, -71, -71, -71, -71, -71, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 24, 69, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 647, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -75, -75, -75, -75, -75, -75, 127, -75, -75, 131, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, 128, 129, 130, 99, 100, -75, -75, -75, -75, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 24, 69, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 648, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -78, -78, -78, -78, -78, -78, 127, -78, -78, 131, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, 128, 129, 130, 99, 100, -78, -78, -78, -78, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -81, -81, -81, -81, -81, -81, 127, -81, -81, 131, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, 128, 129, 130, 99, 100, -81, -81, -81, -81, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 24, 69, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 649, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -84, -84, -84, -84, -84, -84, 127, -84, -84, 131, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, 128, 129, 130, 99, 100, -84, -84, -84, -84, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 109, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 2, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 651, 4, 5, 6, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 166, 105, 106, 650, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 6, 6, 62, 1, 5, 56, 2, -201, -201, -201, -201, -201, -201, 11, 57, 1, 25, 1, 1, 7, 14, 2, 1, 27, 1, 158, 107, 160, 161, 159, 102, 163, 162, 157, 652, 156, 18, 6, 51, 1, 10, 1, 5, 9, 1, 1, 7, 14, 2, 1, 20, 1, 2, 4, 1, -199, 158, 107, -199, -199, -199, 160, 161, 159, 102, 163, 162, 157, 653, -199, -199, 155, 156, 29, 6, 62, 1, 5, 2, 19, 35, 2, 24, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -205, -205, -205, -205, 127, 131, -205, -205, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 59, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 3, 1, 4, 2, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, 3, 133, 1, 1, 654, 93, 94, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, 24, 69, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 655, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -438, -438, -438, -438, -438, -438, 127, -438, -438, -438, -438, -438, -438, -438, -438, -438, -438, -438, -438, -438, -438, -438, -438, 130, -438, -438, -438, -438, -438, -438, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 25, 68, 8, 3, 16, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 656, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 2, 68, 11, 166, 657, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, 2, 68, 11, 166, 658, 2, 68, 11, 166, 659, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 3, 7, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, 27, 68, 8, 3, 16, 5, 56, 1, 9, 1, 1, 4, 30, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 660, 131, 661, 128, 129, 130, 99, 100, 662, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 26, 68, 8, 3, 16, 5, 56, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 663, 131, 664, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 26, 68, 8, 3, 16, 5, 56, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 665, 131, 666, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 26, 68, 8, 3, 16, 5, 56, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 667, 131, 668, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 669, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 670, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 25, 68, 8, 3, 16, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 671, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 4, 97, 74, 2, 2, -330, -330, -330, -330, 28, 74, 2, 19, 2, 59, 1, 9, 1, 1, 3, 2, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -328, 127, 131, -328, 128, 129, 130, 99, 100, -328, -328, -328, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 4, 69, 84, 11, 1, 672, 673, 549, 403, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, 2, 68, 11, 166, 674, 3, 69, 84, 12, -279, -279, -279, 3, 68, 6, 5, 166, 676, 675, 25, 68, 6, 2, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -229, -229, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, 47, 1, 5, 61, 1, 1, 5, 2, 3, 10, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -337, -337, -337, 166, -337, -337, 127, 677, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, 130, -337, -337, -337, -337, -337, -337, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, -340, 111, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 2, 1, 1, 1, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, -344, 409, 410, 411, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, -344, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 678, 412, 413, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 25, 6, 63, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -348, -348, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 2, 6, 63, -349, -349, 110, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 409, 410, 411, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 44, 45, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 679, 408, 412, 413, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 373, 374, -243, -243, -243, 680, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, 1, 150, 681, 6, 57, 1, 10, 121, 1, 2, 429, 107, 428, 682, 427, 430, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, 3, 56, 5, 1, 683, 108, 109, 3, 6, 62, 31, 685, 686, 684, 11, 6, 51, 1, 10, 1, 30, 8, 8, 15, 60, 2, -244, 429, 107, -244, -244, -244, -244, -244, -244, 687, 430, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 569, 688, -243, -243, -243, -243, 2, 57, 1, 689, 107, 2, 57, 1, 690, 107, 1, 150, -368, 3, 56, 5, 1, 691, 108, 109, 3, 6, 62, 31, 693, 694, 692, 11, 6, 51, 1, 10, 1, 30, 8, 8, 15, 62, 5, -244, 578, 107, -244, -244, -244, -244, -244, -244, 437, 695, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 576, 696, -243, -243, -243, -243, 6, 6, 62, 1, 5, 25, 92, -392, -392, -392, -392, -392, 579, 3, 57, 1, 134, 697, 107, 698, 2, 57, 1, 699, 107, 32, 1, 5, 61, 1, 1, 5, 2, 19, 12, 23, 16, 10, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -375, -375, -375, -375, -375, -375, 127, 131, -375, -375, -375, -375, -375, 130, -375, -375, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 700, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 701, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 1, 69, 702, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, 1, 146, 703, 24, 76, 19, 12, 49, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, 131, 704, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, -170, 115, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 7, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 5, 1, 2, 1, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 352, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 249, 105, 106, 250, 55, 54, 74, 75, 96, 102, 61, 85, 89, 254, 86, 87, 92, 453, 705, 248, 251, 247, 68, 44, 45, 93, 94, 253, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 5, 6, 62, 1, 5, 33, -172, -172, -172, -172, -172, 114, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 7, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 9, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 352, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, -179, -179, 105, 106, 250, 55, 54, 74, 75, 96, 102, 61, 85, -179, 89, 254, 86, 87, 92, 447, 446, 68, 44, 45, 93, 94, 253, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 113, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 7, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 5, 3, 1, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 352, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 250, 55, 54, 74, 75, 96, 102, 61, 85, 89, 254, 86, 87, 92, 453, 706, 251, 247, 68, 44, 45, 93, 94, 253, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 2, 68, 1, 589, 707, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, 24, 69, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 708, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, -146, 28, 39, 8, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 1, 12, 1, 1, 7, 14, 2, 1, 8, 1, 27, 280, 271, 272, 275, 274, 273, 276, 277, 103, 104, 268, 107, 269, 260, 108, 109, 105, 106, 278, 279, 270, 102, 163, 162, 267, 709, 266, 84, 34, 6, 33, 8, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 1, 3, 9, 1, 1, 7, 14, 2, 1, 6, 1, 1, 1, 27, -147, 280, 271, 272, 275, 274, 273, 276, 277, 103, 104, 268, 107, 269, 260, 108, 109, -147, -147, 105, 106, -147, 278, 279, 270, 102, 163, 162, 267, -147, 710, 265, 266, 84, 5, 6, 62, 1, 5, 41, -149, -149, -149, -149, -149, 28, 6, 62, 1, 5, 2, 19, 20, 41, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -152, -152, -152, -152, 127, 131, -152, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 711, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 2, 68, 11, 166, 712, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -283, -283, -283, -283, -283, -283, 127, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, 130, -283, -283, -283, -283, -283, -283, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -285, -285, -285, -285, -285, -285, 127, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, 130, -285, -285, -285, -285, -285, -285, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 28, 6, 62, 1, 5, 2, 19, 4, 57, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -119, -119, -119, -119, 127, 713, -119, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 714, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, -111, 17, 47, 8, 1, 1, 1, 1, 1, 1, 1, 23, 8, 10, 1, 1, 1, 2, 1, 292, 103, 104, 294, 107, 295, 260, 108, 109, 296, 611, 715, 297, 289, 290, 291, 298, 23, 6, 41, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 5, 11, 8, 6, 3, 1, 1, 1, 1, 2, 1, -112, 292, 103, 104, 294, 107, 295, 260, 108, 109, -112, -112, -112, 296, 611, -112, 716, 293, 297, 289, 290, 291, 298, 5, 6, 62, 1, 5, 25, -114, -114, -114, -114, -114, 6, 6, 62, 1, 5, 20, 5, -117, -117, -117, -117, 717, -117, 28, 6, 62, 1, 5, 2, 19, 4, 57, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -121, -121, -121, -121, 127, 131, -121, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 718, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 6, 6, 62, 1, 5, 20, 5, -127, -127, -127, -127, -127, -127, 24, 76, 19, 12, 49, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, 131, 719, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 9, 6, 62, 1, 5, 12, 1, 1, 11, 29, -139, -139, -139, -139, -139, -139, -139, -139, -139, 9, 6, 62, 1, 5, 12, 1, 1, 11, 29, -140, -140, -140, -140, -140, -140, -140, -140, -140, 2, 59, 1, 720, 260, 2, 59, 1, 721, 260, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 722, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 723, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 9, 6, 62, 1, 5, 12, 1, 1, 11, 29, -137, -137, -137, -137, -137, -137, -137, -137, -137, 9, 6, 62, 1, 5, 12, 1, 1, 11, 29, -138, -138, -138, -138, -138, -138, -138, -138, -138, 4, 61, 1, 2, 2, -62, -62, -62, -62, 2, 6, 63, 110, 724, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -435, -435, -435, -435, -435, -435, 127, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, 130, -435, -435, -435, -435, -435, -435, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 725, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -264, -264, -264, -264, -264, -264, 127, -264, -264, 131, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, 130, 99, 100, -264, -264, -264, -264, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -310, -310, -310, -310, -310, -310, 127, -310, -310, -310, -310, -310, 726, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, 130, -310, -310, -310, 727, -310, -310, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -315, -315, -315, -315, -315, -315, 127, -315, -315, -315, -315, -315, 728, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, 130, -315, -315, -315, -315, -315, -315, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -319, -319, -319, -319, -319, -319, 127, -319, -319, -319, -319, -319, 729, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, 130, -319, -319, -319, -319, -319, -319, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -323, -323, -323, -323, -323, -323, 127, -323, -323, -323, -323, -323, 730, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, 130, -323, -323, -323, -323, -323, -323, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 731, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 732, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -326, -326, -326, -326, -326, -326, 127, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, 130, -326, -326, -326, -326, -326, -326, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 25, 69, 7, 13, 6, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -187, 127, -187, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 1, 89, 733, 1, 89, 734, 24, 76, 13, 6, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, -68, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, 24, 69, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 735, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 57, 1, 5, 55, 1, 5, 1, 1, 3, 2, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, 109, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 9, 4, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 352, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 254, 86, 87, 92, 736, 68, 44, 45, 93, 94, 253, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 111, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 9, 4, 4, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 352, 252, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 351, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 254, 86, 87, 92, 350, 68, 44, 45, 93, 94, 253, 737, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 46, 47, 70, 48, 49, 50, 52, 53, 5, 6, 62, 1, 5, 56, -221, -221, -221, -221, -221, 3, 6, 62, 1, 642, 643, 738, 1, 89, 739, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, 9, 1, 5, 61, 1, 1, 5, 33, 23, 16, -195, -195, -195, -195, -195, -195, -195, -195, -195, 6, 6, 62, 1, 5, 56, 2, -202, -202, -202, -202, -202, -202, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 373, 740, -243, -243, -243, -243, 2, 68, 11, 166, 650, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, -437, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 3, 7, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 3, 7, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 741, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 742, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 743, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 744, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 745, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 26, 68, 8, 3, 16, 5, 56, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 746, 131, 747, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 26, 68, 8, 3, 16, 5, 56, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 748, 131, 749, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, 2, 68, 11, 166, 750, 1, 69, 751, 4, 6, 63, 84, 12, 752, -280, -280, -280, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 753, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, 2, 6, 63, -343, -343, 2, 6, 63, 555, 754, 2, 68, 11, 166, 755, 3, 56, 5, 1, 756, 108, 109, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 569, 757, -243, -243, -243, -243, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, 1, 150, 758, 4, 57, 1, 132, 2, 429, 107, 759, 430, 6, 57, 1, 10, 121, 1, 2, 429, 107, 428, 760, 427, 430, 5, 6, 62, 1, 5, 25, -359, -359, -359, -359, -359, 3, 6, 62, 1, 685, 686, 761, 5, 6, 62, 1, 5, 25, -364, -364, -364, -364, -364, 5, 6, 62, 1, 5, 25, -366, -366, -366, -366, -366, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, 14, 1, 5, 61, 1, 1, 5, 33, 23, 16, 4, 6, 1, 10, 1, -370, -370, -370, -370, -370, -370, -370, -370, -370, 762, -370, -370, -370, -370, 4, 57, 1, 134, 5, 578, 107, 437, 763, 6, 57, 1, 10, 124, 3, 2, 578, 107, 435, 437, 764, 434, 5, 6, 62, 1, 5, 25, -388, -388, -388, -388, -388, 3, 6, 62, 1, 693, 694, 765, 5, 6, 62, 1, 5, 25, -393, -393, -393, -393, -393, 5, 6, 62, 1, 5, 25, -394, -394, -394, -394, -394, 5, 6, 62, 1, 5, 25, -396, -396, -396, -396, -396, 32, 1, 5, 61, 1, 1, 5, 2, 19, 12, 23, 16, 10, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -376, -376, -376, -376, -376, -376, 127, 131, -376, -376, -376, -376, -376, 130, -376, -376, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 24, 69, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 766, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, -186, 10, 6, 62, 1, 5, 24, 1, 8, 8, 6, 9, -243, -243, -243, 449, 450, -243, -243, -243, 767, -243, 5, 6, 62, 1, 5, 33, -173, -173, -173, -173, -173, 5, 6, 62, 1, 5, 33, -174, -174, -174, -174, -174, 1, 89, 768, 5, 6, 62, 1, 5, 41, -150, -150, -150, -150, -150, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 461, 769, -243, -243, -243, -243, 24, 69, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 770, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, 14, 40, 17, 1, 25, 1, 1, 7, 4, 5, 5, 2, 29, 37, 2, 333, 158, 107, 160, 161, 159, 102, 771, 772, 85, 162, 201, 332, 200, 24, 69, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 773, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 5, 6, 62, 1, 5, 25, -115, -115, -115, -115, -115, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 471, 774, -243, -243, -243, -243, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 775, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 606, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 24, 69, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 776, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 6, 6, 62, 1, 5, 20, 5, -128, -128, -128, -128, -128, -128, 9, 6, 62, 1, 5, 12, 1, 1, 11, 29, -141, -141, -141, -141, -141, -141, -141, -141, -141, 9, 6, 62, 1, 5, 12, 1, 1, 11, 29, -142, -142, -142, -142, -142, -142, -142, -142, -142, 24, 76, 13, 6, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, 777, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 778, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 1, 67, 779, 24, 69, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 780, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 781, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 782, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 783, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 784, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 785, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -317, -317, -317, -317, -317, -317, 127, -317, -317, -317, -317, -317, 786, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, 130, -317, -317, -317, -317, -317, -317, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -321, -321, -321, -321, -321, -321, 127, -321, -321, -321, -321, -321, 787, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, 130, -321, -321, -321, -321, -321, -321, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, 1, 89, 788, 5, 6, 62, 1, 5, 56, -222, -222, -222, -222, -222, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 509, 789, -243, -243, -243, -243, 5, 6, 62, 1, 5, 56, -223, -223, -223, -223, -223, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, 3, 6, 62, 1, 523, 524, 790, 26, 68, 8, 3, 16, 61, 1, 9, 1, 1, 4, 30, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 791, 131, 128, 129, 130, 99, 100, 792, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 26, 68, 8, 3, 16, 5, 56, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 793, 131, 794, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 25, 68, 8, 3, 16, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 795, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 25, 68, 8, 3, 16, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 796, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 25, 68, 8, 3, 16, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 797, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 798, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 799, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 1, 69, 800, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, 3, 69, 84, 12, -281, -281, -281, 25, 68, 6, 2, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -230, -230, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, 3, 6, 62, 31, 685, 686, 801, 3, 56, 5, 1, 802, 108, 109, 5, 6, 62, 1, 5, 25, -360, -360, -360, -360, -360, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 569, 803, -243, -243, -243, -243, 5, 6, 62, 1, 5, 25, -361, -361, -361, -361, -361, 3, 56, 5, 1, 804, 108, 109, 5, 6, 62, 1, 5, 25, -389, -389, -389, -389, -389, 9, 6, 62, 1, 5, 24, 1, 8, 8, 15, -243, -243, -243, 576, 805, -243, -243, -243, -243, 5, 6, 62, 1, 5, 25, -390, -390, -390, -390, -390, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, 2, 68, 1, 589, 806, 56, 1, 5, 55, 1, 5, 1, 1, 5, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, 3, 6, 62, 1, 597, 598, 807, 5, 6, 62, 1, 5, 41, -153, -153, -153, -153, -153, 4, 97, 74, 2, 2, 808, 491, 493, 494, 11, 57, 1, 25, 1, 1, 7, 4, 10, 2, 29, 39, 158, 107, 160, 161, 159, 102, 809, 163, 162, 201, 200, 5, 6, 62, 1, 5, 25, -120, -120, -120, -120, -120, 3, 6, 62, 1, 608, 609, 810, 28, 6, 62, 1, 5, 2, 19, 4, 57, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -119, -119, -119, -119, 127, 131, -119, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 5, 6, 62, 1, 5, 25, -122, -122, -122, -122, -122, 9, 6, 62, 1, 5, 12, 1, 1, 11, 29, -143, -143, -143, -143, -143, -143, -143, -143, -143, 24, 69, 7, 19, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 811, 127, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 4, 61, 1, 2, 2, -63, -63, -63, -63, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -311, -311, -311, -311, -311, -311, 127, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, 130, -311, -311, -311, 812, -311, -311, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -312, -312, -312, -312, -312, -312, 127, -312, -312, -312, -312, -312, 813, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, 130, -312, -312, -312, -312, -312, -312, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -316, -316, -316, -316, -316, -316, 127, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, 130, -316, -316, -316, -316, -316, -316, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -320, -320, -320, -320, -320, -320, 127, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, 130, -320, -320, -320, -320, -320, -320, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -324, -324, -324, -324, -324, -324, 127, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, 130, -324, -324, -324, -324, -324, -324, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 814, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 815, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 65, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, 3, 6, 62, 1, 642, 643, 816, 6, 6, 62, 1, 5, 56, 2, -203, -203, -203, -203, -203, -203, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 817, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 818, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, 25, 68, 8, 3, 16, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 819, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 25, 68, 8, 3, 16, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 820, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, 1, 150, 821, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, 3, 6, 62, 1, 685, 686, 822, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, 3, 6, 62, 1, 693, 694, 823, 5, 6, 62, 1, 5, 33, -175, -175, -175, -175, -175, 5, 6, 62, 1, 5, 41, -151, -151, -151, -151, -151, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 824, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 1, 97, 825, 5, 6, 62, 1, 5, 25, -116, -116, -116, -116, -116, 1, 89, 826, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 827, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 828, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -318, -318, -318, -318, -318, -318, 127, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, 130, -318, -318, -318, -318, -318, -318, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -322, -322, -322, -322, -322, -322, 127, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, 130, -322, -322, -322, -322, -322, -322, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 5, 6, 62, 1, 5, 56, -224, -224, -224, -224, -224, 25, 68, 8, 3, 16, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 829, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 25, 68, 8, 3, 16, 61, 1, 9, 1, 1, 34, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 166, 127, 830, 131, 128, 129, 130, 99, 100, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, 3, 56, 5, 1, 831, 108, 109, 5, 6, 62, 1, 5, 25, -362, -362, -362, -362, -362, 5, 6, 62, 1, 5, 25, -391, -391, -391, -391, -391, 47, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 1, 1, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -315, -315, -315, -315, -315, 834, 127, -315, -315, -315, -315, 832, -315, 833, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, 130, -315, -315, -315, -315, -315, -315, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 835, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 9, 6, 62, 1, 5, 12, 1, 1, 11, 29, -144, -144, -144, -144, -144, -144, -144, -144, -144, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -313, -313, -313, -313, -313, -313, 127, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, 130, -313, -313, -313, -313, -313, -313, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 46, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -314, -314, -314, -314, -314, -314, 127, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, 130, -314, -314, -314, -314, -314, -314, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, 45, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, 13, 1, 5, 61, 1, 1, 5, 33, 23, 16, 10, 1, 10, 1, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, -357, 1, 99, 836, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 837, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 7, 6, 62, 1, 30, 8, 8, 15, -244, -244, -244, -244, -244, -244, -244, 47, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 1, 1, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -317, -317, -317, -317, -317, 834, 127, -317, -317, -317, -317, 838, -317, 839, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, 130, -317, -317, -317, -317, -317, -317, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, 47, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 1, 1, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -316, -316, -316, -316, -316, 834, 127, -316, -316, -316, -316, 840, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, 130, -316, -316, -316, -316, -316, -316, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 1, 99, 841, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 4, 1, 842, 169, 30, 31, 32, 33, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 76, 77, 78, 79, 80, 81, 82, 83, 103, 104, 95, 107, 108, 109, 105, 106, 55, 54, 74, 75, 96, 102, 61, 85, 89, 86, 87, 92, 68, 173, 174, 93, 94, 88, 90, 91, 84, 71, 66, 67, 56, 97, 57, 98, 58, 62, 59, 99, 100, 60, 101, 51, 63, 69, 64, 65, 72, 73, 175, 176, 177, 48, 49, 50, 52, 53, 1, 99, 843, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, 47, 1, 5, 61, 1, 1, 5, 2, 13, 5, 1, 2, 1, 1, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -318, -318, -318, -318, -318, 834, 127, -318, -318, -318, -318, 844, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, 130, -318, -318, -318, -318, -318, -318, 112, 111, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, 1, 99, 845, 61, 1, 5, 55, 1, 5, 1, 1, 5, 1, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110, -110], t = [], p = 0, n, o, k, a;
      while (p < d.length) {
        n = d[p++];
        o = {};
        k = 0;
        a = [];
        while (n--)
          k += d[p++], a.push(k);
        for (k of a)
          o[k] = d[p++];
        t.push(o);
      }
      return t;
    })(),
    ruleTable: [0, 0, 3, 0, 3, 1, 4, 1, 4, 3, 4, 2, 5, 1, 5, 1, 5, 1, 9, 1, 9, 1, 9, 1, 9, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 8, 1, 8, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 38, 1, 38, 1, 38, 1, 38, 1, 38, 1, 38, 1, 38, 1, 38, 1, 47, 1, 47, 1, 57, 1, 59, 1, 56, 1, 56, 3, 63, 1, 63, 2, 65, 3, 65, 5, 65, 2, 65, 1, 49, 1, 49, 3, 73, 3, 73, 1, 17, 3, 17, 4, 17, 5, 18, 3, 19, 3, 19, 4, 19, 5, 20, 3, 20, 4, 20, 3, 21, 3, 21, 4, 21, 5, 22, 3, 22, 4, 22, 3, 22, 2, 22, 3, 22, 2, 37, 1, 37, 1, 37, 1, 82, 1, 82, 1, 82, 3, 82, 3, 82, 4, 82, 6, 82, 4, 82, 6, 82, 4, 82, 5, 82, 7, 82, 3, 82, 3, 82, 4, 82, 6, 84, 10, 84, 12, 84, 11, 84, 13, 84, 4, 102, 0, 102, 1, 102, 3, 102, 4, 102, 6, 103, 1, 103, 1, 103, 3, 103, 5, 103, 3, 103, 5, 105, 1, 105, 1, 105, 1, 93, 1, 93, 3, 93, 4, 93, 1, 104, 2, 104, 2, 110, 1, 110, 1, 110, 1, 110, 1, 110, 1, 110, 2, 110, 2, 110, 2, 110, 2, 110, 3, 110, 3, 110, 4, 110, 6, 46, 2, 46, 4, 116, 0, 116, 1, 116, 3, 116, 4, 116, 6, 117, 3, 117, 5, 117, 2, 118, 1, 118, 1, 118, 1, 118, 1, 118, 1, 118, 1, 118, 1, 118, 1, 118, 1, 118, 1, 118, 1, 118, 1, 118, 1, 83, 2, 83, 3, 83, 4, 120, 1, 120, 3, 120, 4, 120, 4, 120, 6, 122, 1, 122, 2, 121, 1, 121, 2, 119, 1, 119, 2, 124, 1, 124, 2, 125, 1, 125, 1, 40, 5, 90, 3, 90, 2, 90, 2, 90, 1, 33, 6, 33, 3, 15, 5, 15, 2, 35, 5, 35, 2, 133, 1, 133, 1, 129, 0, 129, 1, 129, 3, 129, 4, 129, 6, 136, 1, 136, 3, 136, 2, 136, 1, 137, 1, 137, 1, 137, 1, 137, 1, 138, 2, 41, 2, 41, 2, 41, 3, 41, 2, 41, 2, 112, 2, 112, 4, 140, 1, 140, 3, 140, 4, 140, 4, 140, 6, 123, 1, 123, 1, 123, 1, 123, 1, 141, 1, 141, 3, 43, 1, 43, 1, 85, 2, 44, 3, 44, 4, 44, 6, 45, 3, 45, 3, 79, 2, 79, 3, 39, 3, 39, 5, 98, 0, 98, 1, 10, 2, 10, 4, 10, 1, 31, 2, 31, 4, 32, 1, 32, 2, 32, 4, 32, 3, 151, 3, 151, 5, 154, 3, 154, 5, 23, 1, 23, 3, 23, 1, 23, 3, 23, 3, 23, 7, 23, 5, 23, 3, 23, 3, 24, 2, 24, 3, 24, 4, 24, 5, 159, 3, 159, 3, 159, 2, 27, 5, 27, 7, 27, 4, 27, 6, 163, 1, 163, 2, 164, 3, 164, 4, 166, 2, 166, 4, 166, 2, 166, 4, 25, 2, 25, 2, 25, 2, 25, 1, 169, 2, 169, 2, 169, 3, 26, 5, 26, 7, 26, 7, 26, 9, 26, 9, 26, 5, 26, 7, 26, 6, 26, 8, 26, 5, 26, 7, 26, 6, 26, 8, 26, 5, 26, 7, 26, 3, 26, 5, 26, 5, 26, 7, 26, 7, 26, 9, 26, 9, 26, 5, 26, 7, 26, 6, 26, 8, 26, 5, 26, 7, 26, 6, 26, 8, 26, 5, 26, 7, 26, 3, 26, 5, 176, 1, 176, 3, 96, 1, 96, 3, 28, 1, 28, 2, 28, 3, 28, 4, 28, 2, 28, 3, 28, 4, 28, 5, 34, 3, 29, 4, 29, 6, 181, 1, 181, 3, 181, 2, 182, 1, 182, 1, 182, 1, 182, 2, 182, 2, 30, 2, 12, 2, 12, 4, 12, 4, 12, 5, 12, 7, 12, 6, 12, 9, 189, 1, 189, 3, 189, 4, 189, 4, 189, 6, 190, 1, 190, 3, 190, 1, 190, 3, 187, 1, 188, 3, 13, 3, 13, 5, 13, 2, 13, 2, 13, 2, 13, 2, 13, 4, 13, 5, 13, 6, 13, 2, 13, 2, 13, 2, 13, 2, 13, 3, 13, 5, 13, 4, 13, 5, 13, 7, 195, 1, 195, 3, 195, 4, 195, 4, 195, 6, 197, 1, 197, 3, 197, 3, 197, 1, 197, 3, 36, 2, 36, 2, 36, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 4, 16, 2, 16, 2, 16, 2, 16, 2, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 5, 16, 3, 16, 5, 16, 4, 42, 2],
    ruleActions: (rule, vals, locs, shared) => {
      const $ = vals;
      const $0 = vals.length - 1;
      switch (rule) {
        case 1:
          return ["program"];
        case 2:
          return ["program", ...$[$0]];
        case 3:
        case 60:
        case 113:
        case 148:
        case 176:
        case 180:
        case 200:
        case 220:
        case 229:
        case 278:
        case 329:
        case 342:
        case 358:
        case 387:
          return [$[$0]];
        case 4:
        case 114:
        case 149:
        case 201:
        case 221:
        case 230:
        case 343:
        case 359:
        case 388:
          return [...$[$0 - 2], $[$0]];
        case 5:
        case 62:
        case 183:
        case 344:
          return $[$0 - 1];
        case 6:
        case 7:
        case 8:
        case 9:
        case 10:
        case 11:
        case 12:
        case 13:
        case 14:
        case 15:
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 21:
        case 22:
        case 23:
        case 24:
        case 25:
        case 26:
        case 27:
        case 28:
        case 29:
        case 30:
        case 31:
        case 32:
        case 33:
        case 34:
        case 35:
        case 36:
        case 37:
        case 38:
        case 39:
        case 40:
        case 41:
        case 42:
        case 43:
        case 44:
        case 45:
        case 46:
        case 47:
        case 48:
        case 51:
        case 52:
        case 53:
        case 54:
        case 55:
        case 56:
        case 57:
        case 58:
        case 65:
        case 66:
        case 89:
        case 90:
        case 91:
        case 92:
        case 93:
        case 118:
        case 123:
        case 124:
        case 125:
        case 126:
        case 129:
        case 132:
        case 133:
        case 134:
        case 135:
        case 136:
        case 155:
        case 156:
        case 157:
        case 158:
        case 159:
        case 160:
        case 163:
        case 164:
        case 165:
        case 166:
        case 167:
        case 171:
        case 197:
        case 198:
        case 204:
        case 208:
        case 209:
        case 210:
        case 211:
        case 225:
        case 226:
        case 227:
        case 243:
        case 244:
        case 258:
        case 260:
        case 289:
        case 327:
        case 345:
        case 346:
        case 347:
        case 363:
        case 365:
        case 367:
        case 392:
        case 395:
          return $[$0];
        case 49:
        case 162:
          return "undefined";
        case 50:
        case 161:
          return "null";
        case 59:
          return ["str", ...$[$0 - 1]];
        case 61:
        case 177:
        case 181:
        case 279:
          return [...$[$0 - 1], $[$0]];
        case 63:
        case 219:
        case 223:
        case 361:
        case 390:
          return $[$0 - 2];
        case 64:
          return "";
        case 67:
          return ["regex", $[$0 - 1]];
        case 68:
          return ["regex-index", $[$0 - 2], $[$0]];
        case 69:
          return ["regex-index", $[$0], null];
        case 70:
        case 121:
          return ["=", $[$0 - 2], $[$0]];
        case 71:
          return ["=", $[$0 - 3], $[$0]];
        case 72:
        case 122:
          return ["=", $[$0 - 4], $[$0 - 1]];
        case 73:
          return ["=", $[$0], $[$0 - 2]];
        case 74:
          return ["state", $[$0 - 2], $[$0]];
        case 75:
          return ["state", $[$0 - 3], $[$0]];
        case 76:
          return ["state", $[$0 - 4], $[$0 - 1]];
        case 77:
        case 79:
          return ["computed", $[$0 - 2], $[$0]];
        case 78:
          return ["computed", $[$0 - 3], $[$0]];
        case 80:
          return ["readonly", $[$0 - 2], $[$0]];
        case 81:
          return ["readonly", $[$0 - 3], $[$0]];
        case 82:
          return ["readonly", $[$0 - 4], $[$0 - 1]];
        case 83:
        case 85:
          return ["effect", $[$0 - 2], $[$0]];
        case 84:
          return ["effect", $[$0 - 3], $[$0]];
        case 86:
        case 87:
        case 88:
          return ["effect", null, $[$0]];
        case 94:
        case 103:
        case 141:
          return [".", $[$0 - 2], $[$0]];
        case 95:
        case 104:
        case 142:
          return ["?.", $[$0 - 2], $[$0]];
        case 96:
        case 98:
        case 105:
        case 143:
          return ["[]", $[$0 - 3], $[$0 - 1]];
        case 97:
        case 99:
        case 106:
        case 144:
          return ["[]", $[$0 - 5], $[$0 - 2]];
        case 100:
          return [$[$0 - 1][0], $[$0 - 3], ...$[$0 - 1].slice(1)];
        case 101:
          return ["optindex", $[$0 - 4], $[$0 - 1]];
        case 102:
          return ["optindex", $[$0 - 6], $[$0 - 2]];
        case 107:
          return ["object-comprehension", $[$0 - 8], $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], []];
        case 108:
          return ["object-comprehension", $[$0 - 10], $[$0 - 8], [["for-of", $[$0 - 6], $[$0 - 4], false]], [$[$0 - 2]]];
        case 109:
          return ["object-comprehension", $[$0 - 9], $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], []];
        case 110:
          return ["object-comprehension", $[$0 - 11], $[$0 - 9], [["for-of", $[$0 - 6], $[$0 - 4], true]], [$[$0 - 2]]];
        case 111:
          return ["object", ...$[$0 - 2]];
        case 112:
        case 147:
        case 178:
        case 199:
        case 218:
          return [];
        case 115:
        case 150:
        case 202:
        case 222:
        case 360:
        case 389:
          return [...$[$0 - 3], $[$0]];
        case 116:
        case 151:
        case 203:
        case 224:
        case 362:
        case 391:
          return [...$[$0 - 5], ...$[$0 - 2]];
        case 117:
          return [null, $[$0], $[$0]];
        case 119:
        case 152:
          return [":", $[$0 - 2], $[$0]];
        case 120:
        case 153:
          return [":", $[$0 - 4], $[$0 - 1]];
        case 127:
          return ["dynamicKey", $[$0 - 1]];
        case 128:
          return ["[]", "this", $[$0 - 1]];
        case 130:
        case 131:
        case 154:
        case 212:
          return ["...", $[$0]];
        case 137:
        case 216:
          return ["super", ...$[$0]];
        case 138:
        case 139:
        case 140:
        case 214:
        case 217:
          return [$[$0 - 1], ...$[$0]];
        case 145:
          return ["map-literal"];
        case 146:
          return ["map-literal", ...$[$0 - 2]];
        case 168:
          return ["array"];
        case 169:
          return ["array", ...$[$0 - 1]];
        case 170:
          return ["array", ...$[$0 - 2], ...$[$0 - 1]];
        case 172:
          return [...$[$0 - 2], ...$[$0]];
        case 173:
          return [...$[$0 - 3], ...$[$0]];
        case 174:
          return [...$[$0 - 2], ...$[$0 - 1]];
        case 175:
          return [...$[$0 - 5], ...$[$0 - 4], ...$[$0 - 2], ...$[$0 - 1]];
        case 179:
          return [...$[$0]];
        case 182:
          return null;
        case 184:
          return "..";
        case 185:
        case 228:
          return "...";
        case 186:
          return [$[$0 - 2], $[$0 - 3], $[$0 - 1]];
        case 187:
        case 416:
        case 418:
        case 419:
        case 434:
        case 436:
          return [$[$0 - 1], $[$0 - 2], $[$0]];
        case 188:
          return [$[$0], $[$0 - 1], null];
        case 189:
          return [$[$0 - 1], null, $[$0]];
        case 190:
          return [$[$0], null, null];
        case 191:
          return ["def", $[$0 - 4], $[$0 - 2], $[$0]];
        case 192:
          return ["def", $[$0 - 1], [], $[$0]];
        case 193:
        case 195:
          return [$[$0 - 1], $[$0 - 3], $[$0]];
        case 194:
        case 196:
          return [$[$0 - 1], [], $[$0]];
        case 205:
        case 328:
          return ["default", $[$0 - 2], $[$0]];
        case 206:
          return ["rest", $[$0]];
        case 207:
          return ["expansion"];
        case 213:
          return ["tagged-template", $[$0 - 1], $[$0]];
        case 215:
          return ["optcall", $[$0 - 2], ...$[$0]];
        case 231:
        case 232:
          return "this";
        case 233:
          return [".", "this", $[$0]];
        case 234:
          return [".", "super", $[$0]];
        case 235:
          return ["[]", "super", $[$0 - 1]];
        case 236:
          return ["[]", "super", $[$0 - 2]];
        case 237:
          return [".", "new", $[$0]];
        case 238:
          return [".", "import", $[$0]];
        case 239:
          return ["block"];
        case 240:
          return ["block", ...$[$0 - 1]];
        case 241:
          return $[$0 - 1].length === 1 ? $[$0 - 1][0] : ["block", ...$[$0 - 1]];
        case 242:
          return $[$0 - 2].length === 1 ? $[$0 - 2][0] : ["block", ...$[$0 - 2]];
        case 245:
          return ["return", $[$0]];
        case 246:
          return ["return", $[$0 - 1]];
        case 247:
          return ["return"];
        case 248:
          return ["throw", $[$0]];
        case 249:
          return ["throw", $[$0 - 1]];
        case 250:
          return ["yield"];
        case 251:
          return ["yield", $[$0]];
        case 252:
          return ["yield", $[$0 - 1]];
        case 253:
          return ["yield-from", $[$0]];
        case 254:
          return ["if", $[$0 - 1], $[$0]];
        case 255:
          return $[$0 - 4].length === 3 ? ["if", $[$0 - 4][1], $[$0 - 4][2], ["if", $[$0 - 1], $[$0]]] : [...$[$0 - 4], ["if", $[$0 - 1], $[$0]]];
        case 256:
          return ["if", ["!", $[$0 - 1]], $[$0]];
        case 257:
          return ["if", ["!", $[$0 - 3]], $[$0 - 2], $[$0]];
        case 259:
          return $[$0 - 2].length === 3 ? ["if", $[$0 - 2][1], $[$0 - 2][2], $[$0]] : [...$[$0 - 2], $[$0]];
        case 261:
        case 262:
          return ["if", $[$0], [$[$0 - 2]]];
        case 263:
          return ["?:", $[$0 - 4], $[$0 - 6], $[$0 - 1]];
        case 264:
          return ["?:", $[$0 - 2], $[$0 - 4], $[$0]];
        case 265:
        case 266:
          return ["if", ["!", $[$0]], [$[$0 - 2]]];
        case 267:
          return ["try", $[$0]];
        case 268:
          return ["try", $[$0 - 1], $[$0]];
        case 269:
          return ["try", $[$0 - 2], $[$0]];
        case 270:
          return ["try", $[$0 - 3], $[$0 - 2], $[$0]];
        case 271:
        case 272:
        case 397:
        case 400:
        case 402:
          return [$[$0 - 1], $[$0]];
        case 273:
          return [null, $[$0]];
        case 274:
          return ["switch", $[$0 - 3], $[$0 - 1], null];
        case 275:
          return ["switch", $[$0 - 5], $[$0 - 3], $[$0 - 1]];
        case 276:
          return ["switch", null, $[$0 - 1], null];
        case 277:
          return ["switch", null, $[$0 - 3], $[$0 - 1]];
        case 280:
          return ["when", $[$0 - 1], $[$0]];
        case 281:
          return ["when", $[$0 - 2], $[$0 - 1]];
        case 282:
          return ["while", $[$0]];
        case 283:
          return ["while", $[$0 - 2], $[$0]];
        case 284:
          return ["while", ["!", $[$0]]];
        case 285:
          return ["while", ["!", $[$0 - 2]], $[$0]];
        case 286:
          return $[$0 - 1].length === 2 ? [$[$0 - 1][0], $[$0 - 1][1], $[$0]] : [$[$0 - 1][0], $[$0 - 1][1], $[$0 - 1][2], $[$0]];
        case 287:
        case 288:
          return $[$0].length === 2 ? [$[$0][0], $[$0][1], [$[$0 - 1]]] : [$[$0][0], $[$0][1], $[$0][2], [$[$0 - 1]]];
        case 290:
          return ["loop", $[$0]];
        case 291:
          return ["loop", [$[$0]]];
        case 292:
          return ["loop-n", $[$0 - 1], $[$0]];
        case 293:
          return ["for-in", $[$0 - 3], $[$0 - 1], null, null, $[$0]];
        case 294:
          return ["for-in", $[$0 - 5], $[$0 - 3], null, $[$0 - 1], $[$0]];
        case 295:
          return ["for-in", $[$0 - 5], $[$0 - 3], $[$0 - 1], null, $[$0]];
        case 296:
          return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 1], $[$0 - 3], $[$0]];
        case 297:
          return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 3], $[$0 - 1], $[$0]];
        case 298:
          return ["for-of", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
        case 299:
          return ["for-of", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
        case 300:
          return ["for-of", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
        case 301:
          return ["for-of", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
        case 302:
          return ["for-as", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
        case 303:
          return ["for-as", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
        case 304:
        case 306:
          return ["for-as", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
        case 305:
        case 307:
          return ["for-as", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
        case 308:
          return ["for-in", [], $[$0 - 1], null, null, $[$0]];
        case 309:
          return ["for-in", [], $[$0 - 3], $[$0 - 1], null, $[$0]];
        case 310:
          return ["comprehension", $[$0 - 4], [["for-in", $[$0 - 2], $[$0], null]], []];
        case 311:
          return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], null]], [$[$0]]];
        case 312:
          return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], $[$0]]], []];
        case 313:
          return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0]]], [$[$0 - 2]]];
        case 314:
          return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0 - 2]]], [$[$0]]];
        case 315:
          return ["comprehension", $[$0 - 4], [["for-of", $[$0 - 2], $[$0], false]], []];
        case 316:
          return ["comprehension", $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], [$[$0]]];
        case 317:
          return ["comprehension", $[$0 - 5], [["for-of", $[$0 - 2], $[$0], true]], []];
        case 318:
          return ["comprehension", $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], [$[$0]]];
        case 319:
          return ["comprehension", $[$0 - 4], [["for-as", $[$0 - 2], $[$0], false, null]], []];
        case 320:
          return ["comprehension", $[$0 - 6], [["for-as", $[$0 - 4], $[$0 - 2], false, null]], [$[$0]]];
        case 321:
          return ["comprehension", $[$0 - 5], [["for-as", $[$0 - 2], $[$0], true, null]], []];
        case 322:
          return ["comprehension", $[$0 - 7], [["for-as", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
        case 323:
          return ["comprehension", $[$0 - 4], [["for-as", $[$0 - 2], $[$0], true, null]], []];
        case 324:
          return ["comprehension", $[$0 - 6], [["for-as", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
        case 325:
          return ["comprehension", $[$0 - 2], [["for-in", [], $[$0], null]], []];
        case 326:
          return ["comprehension", $[$0 - 4], [["for-in", [], $[$0 - 2], $[$0]]], []];
        case 330:
        case 364:
        case 366:
        case 393:
        case 394:
        case 396:
          return [$[$0 - 2], $[$0]];
        case 331:
          return ["class", null, null];
        case 332:
          return ["class", null, null, $[$0]];
        case 333:
          return ["class", null, $[$0]];
        case 334:
          return ["class", null, $[$0 - 1], $[$0]];
        case 335:
          return ["class", $[$0], null];
        case 336:
          return ["class", $[$0 - 1], null, $[$0]];
        case 337:
          return ["class", $[$0 - 2], $[$0]];
        case 338:
          return ["class", $[$0 - 3], $[$0 - 1], $[$0]];
        case 339:
          return ["enum", $[$0 - 1], $[$0]];
        case 340:
          return ["component", null, ["block", ...$[$0 - 1]]];
        case 341:
          return ["component", $[$0 - 3], ["block", ...$[$0 - 1]]];
        case 348:
          return ["offer", $[$0]];
        case 349:
          return ["accept", $[$0]];
        case 350:
          return ["render", $[$0]];
        case 351:
        case 354:
          return ["import", "{}", $[$0]];
        case 352:
        case 353:
          return ["import", $[$0 - 2], $[$0]];
        case 355:
          return ["import", $[$0 - 4], $[$0]];
        case 356:
          return ["import", $[$0 - 4], $[$0 - 2], $[$0]];
        case 357:
          return ["import", $[$0 - 7], $[$0 - 4], $[$0]];
        case 368:
          return ["*", $[$0]];
        case 369:
          return ["export", "{}"];
        case 370:
          return ["export", $[$0 - 2]];
        case 371:
        case 372:
        case 373:
        case 374:
        case 378:
        case 379:
        case 380:
        case 381:
          return ["export", $[$0]];
        case 375:
          return ["export", ["=", $[$0 - 2], $[$0]]];
        case 376:
          return ["export", ["=", $[$0 - 3], $[$0]]];
        case 377:
          return ["export", ["=", $[$0 - 4], $[$0 - 1]]];
        case 382:
          return ["export-default", $[$0]];
        case 383:
          return ["export-default", $[$0 - 1]];
        case 384:
          return ["export-all", $[$0]];
        case 385:
          return ["export-from", "{}", $[$0]];
        case 386:
          return ["export-from", $[$0 - 4], $[$0]];
        case 398:
        case 399:
        case 401:
        case 439:
          return ["do-iife", $[$0]];
        case 403:
          return ["-", $[$0]];
        case 404:
          return ["+", $[$0]];
        case 405:
          return ["?", $[$0 - 1]];
        case 406:
          return ["defined", $[$0 - 1]];
        case 407:
          return ["presence", $[$0 - 1]];
        case 408:
          return ["await", $[$0]];
        case 409:
          return ["await", $[$0 - 1]];
        case 410:
          return ["--", $[$0], false];
        case 411:
          return ["++", $[$0], false];
        case 412:
          return ["--", $[$0 - 1], true];
        case 413:
          return ["++", $[$0 - 1], true];
        case 414:
          return ["+", $[$0 - 2], $[$0]];
        case 415:
          return ["-", $[$0 - 2], $[$0]];
        case 417:
          return ["**", $[$0 - 2], $[$0]];
        case 420:
          return ["&", $[$0 - 2], $[$0]];
        case 421:
          return ["^", $[$0 - 2], $[$0]];
        case 422:
          return ["|", $[$0 - 2], $[$0]];
        case 423:
        case 424:
        case 425:
        case 426:
        case 427:
        case 428:
          return ["control", $[$0 - 1], $[$0 - 2], $[$0]];
        case 429:
          return ["&&", $[$0 - 2], $[$0]];
        case 430:
          return ["||", $[$0 - 2], $[$0]];
        case 431:
          return ["??", $[$0 - 2], $[$0]];
        case 432:
          return ["!?", $[$0 - 2], $[$0]];
        case 433:
          return ["|>", $[$0 - 2], $[$0]];
        case 435:
          return ["?:", $[$0 - 4], $[$0 - 2], $[$0]];
        case 437:
          return [$[$0 - 3], $[$0 - 4], $[$0 - 1]];
        case 438:
          return [$[$0 - 2], $[$0 - 3], $[$0]];
      }
    },
    parseError(str, hash) {
      let col, error, line, location2, message, text, token;
      if (hash.recoverable)
        return this.trace(str);
      else {
        line = (hash.line || 0) + 1;
        col = hash.loc?.c || 0;
        token = hash.token ? ` (token: ${hash.token})` : "";
        text = hash.text ? ` near '${hash.text}'` : "";
        location2 = `line ${line}, column ${col}`;
        message = `Parse error at ${location2}${token}${text}: ${str}`;
        error = Error(message);
        error.hash = hash;
        throw error;
      }
    },
    parse(input) {
      let EOF, TERROR, action, errStr, expected, len, lex, lexer, loc, locs, newState, p, parseTable, preErrorSymbol, r, recovering, rv, sharedState, state, stk, symbol, tokenLen, tokenLine, tokenLoc, tokenText, vals;
      [stk, vals, locs] = [[0], [null], []];
      [parseTable, tokenText, tokenLine, tokenLen, recovering] = [this.parseTable, "", 0, 0, 0];
      [TERROR, EOF] = [2, 1];
      lexer = Object.create(this.lexer);
      sharedState = { ctx: {} };
      for (const k in this.ctx) {
        if (!Object.hasOwn(this.ctx, k))
          continue;
        const v = this.ctx[k];
        sharedState.ctx[k] = v;
      }
      lexer.setInput(input, sharedState.ctx);
      [sharedState.ctx.lexer, sharedState.ctx.parser] = [lexer, this];
      if (lexer.loc == null)
        lexer.loc = {};
      tokenLoc = lexer.loc;
      locs.push(tokenLoc);
      this.parseError = typeof sharedState.ctx.parseError === "function" ? sharedState.ctx.parseError : Object.getPrototypeOf(this).parseError;
      lex = () => {
        let token;
        token = lexer.lex() || EOF;
        if (typeof token !== "number")
          token = this.symbolIds[token] || token;
        return token;
      };
      symbol = preErrorSymbol = state = action = r = p = len = newState = expected = null;
      rv = {};
      while (true) {
        state = stk[stk.length - 1];
        if (symbol == null)
          symbol = lex();
        action = parseTable[state]?.[symbol];
        if (action == null) {
          errStr = "";
          if (!recovering)
            expected = (() => {
              const result = [];
              for (const p2 in parseTable[state]) {
                if (!Object.hasOwn(parseTable[state], p2))
                  continue;
                if (this.tokenNames[p2] && p2 > TERROR)
                  result.push(`'${this.tokenNames[p2]}'`);
              }
              return result;
            })();
          errStr = (() => {
            if (lexer.showPosition)
              return `Parse error on line ${tokenLine + 1}:
${lexer.showPosition()}
Expecting ${expected.join(", ")}, got '${this.tokenNames[symbol] || symbol}'`;
            else {
              `Parse error on line ${tokenLine + 1}: Unexpected ${symbol === EOF ? "end of input" : `'${this.tokenNames[symbol] || symbol}'`}`;
              return this.parseError(errStr, { text: lexer.match, token: this.tokenNames[symbol] || symbol, line: lexer.line, loc: tokenLoc, expected });
            }
          })();
          throw Error(errStr);
        }
        if (action > 0) {
          stk.push(symbol, action);
          vals.push(lexer.text);
          locs.push(lexer.loc);
          symbol = null;
          if (!preErrorSymbol) {
            [tokenLen, tokenText, tokenLine, tokenLoc] = [lexer.len, lexer.text, lexer.line, lexer.loc];
            if (recovering > 0)
              recovering--;
          } else
            [symbol, preErrorSymbol] = [preErrorSymbol, null];
        } else if (action < 0) {
          len = this.ruleTable[-action * 2 + 1];
          rv.$ = vals[vals.length - len];
          loc = locs[locs.length - (len || 1)];
          rv._$ = { r: loc.r, c: loc.c };
          r = this.ruleActions.call(rv, -action, vals, locs, sharedState.ctx);
          if (r != null)
            rv.$ = r;
          if (Array.isArray(rv.$))
            rv.$.loc = rv._$;
          if (len) {
            stk.length -= len * 2;
            vals.length -= len;
            locs.length -= len;
          }
          stk.push(this.ruleTable[-action * 2]);
          vals.push(rv.$);
          locs.push(rv._$);
          newState = parseTable[stk[stk.length - 2]][stk[stk.length - 1]];
          stk.push(newState);
        } else if (action === 0)
          return vals[vals.length - 1];
      }
    },
    trace() {},
    ctx: {}
  };
  var createParser = (init = {}) => {
    const p = Object.create(parserInstance);
    Object.defineProperty(p, "ctx", {
      value: { ...init },
      enumerable: false,
      writable: true,
      configurable: true
    });
    return p;
  };
  var parser = /* @__PURE__ */ createParser();
  var parse = parser.parse.bind(parser);
  // src/generated/dom-events.js
  var DOM_EVENT_NAMES = [
    "abort",
    "animationcancel",
    "animationend",
    "animationiteration",
    "animationstart",
    "auxclick",
    "beforeinput",
    "beforematch",
    "beforetoggle",
    "blur",
    "cancel",
    "canplay",
    "canplaythrough",
    "change",
    "click",
    "close",
    "compositionend",
    "compositionstart",
    "compositionupdate",
    "contextlost",
    "contextmenu",
    "contextrestored",
    "copy",
    "cuechange",
    "cut",
    "dblclick",
    "drag",
    "dragend",
    "dragenter",
    "dragleave",
    "dragover",
    "dragstart",
    "drop",
    "durationchange",
    "emptied",
    "ended",
    "error",
    "focus",
    "focusin",
    "focusout",
    "formdata",
    "fullscreenchange",
    "fullscreenerror",
    "gotpointercapture",
    "input",
    "invalid",
    "keydown",
    "keypress",
    "keyup",
    "load",
    "loadeddata",
    "loadedmetadata",
    "loadstart",
    "lostpointercapture",
    "mousedown",
    "mouseenter",
    "mouseleave",
    "mousemove",
    "mouseout",
    "mouseover",
    "mouseup",
    "paste",
    "pause",
    "play",
    "playing",
    "pointercancel",
    "pointerdown",
    "pointerenter",
    "pointerleave",
    "pointermove",
    "pointerout",
    "pointerover",
    "pointerrawupdate",
    "pointerup",
    "progress",
    "ratechange",
    "reset",
    "resize",
    "scroll",
    "scrollend",
    "securitypolicyviolation",
    "seeked",
    "seeking",
    "select",
    "selectionchange",
    "selectstart",
    "slotchange",
    "stalled",
    "submit",
    "suspend",
    "timeupdate",
    "toggle",
    "touchcancel",
    "touchend",
    "touchmove",
    "touchstart",
    "transitioncancel",
    "transitionend",
    "transitionrun",
    "transitionstart",
    "volumechange",
    "waiting",
    "webkitanimationend",
    "webkitanimationiteration",
    "webkitanimationstart",
    "webkittransitionend",
    "wheel"
  ];
  var DOM_EVENTS = new Set(DOM_EVENT_NAMES);

  // src/generated/dom-tags.js
  var HTML_TAG_NAMES = [
    "a",
    "abbr",
    "address",
    "area",
    "article",
    "aside",
    "audio",
    "b",
    "base",
    "bdi",
    "bdo",
    "blockquote",
    "body",
    "br",
    "button",
    "canvas",
    "caption",
    "cite",
    "code",
    "col",
    "colgroup",
    "data",
    "datalist",
    "dd",
    "del",
    "details",
    "dfn",
    "dialog",
    "div",
    "dl",
    "dt",
    "em",
    "embed",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "head",
    "header",
    "hgroup",
    "hr",
    "html",
    "i",
    "iframe",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "link",
    "main",
    "map",
    "mark",
    "menu",
    "meta",
    "meter",
    "nav",
    "noscript",
    "object",
    "ol",
    "optgroup",
    "option",
    "output",
    "p",
    "picture",
    "pre",
    "progress",
    "q",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "script",
    "search",
    "section",
    "select",
    "slot",
    "small",
    "source",
    "span",
    "strong",
    "style",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "template",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "title",
    "tr",
    "track",
    "u",
    "ul",
    "var",
    "video",
    "wbr"
  ];
  var SVG_NAMESPACE_TAG_NAMES = [
    "animate",
    "animateMotion",
    "animateTransform",
    "circle",
    "clipPath",
    "defs",
    "desc",
    "ellipse",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feDropShadow",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "filter",
    "foreignObject",
    "g",
    "image",
    "line",
    "linearGradient",
    "marker",
    "mask",
    "metadata",
    "mpath",
    "path",
    "pattern",
    "polygon",
    "polyline",
    "radialGradient",
    "rect",
    "set",
    "stop",
    "svg",
    "switch",
    "symbol",
    "text",
    "textPath",
    "tspan",
    "use",
    "view"
  ];
  var HTML_COMPAT_EXTRA_TAG_NAMES = [
    "math",
    "param",
    "portal"
  ];
  var HTML_TAGS = new Set([...HTML_TAG_NAMES, ...HTML_COMPAT_EXTRA_TAG_NAMES]);
  var SVG_TAGS = new Set(SVG_NAMESPACE_TAG_NAMES);
  var TEMPLATE_TAGS = new Set([...HTML_TAGS, ...SVG_TAGS]);

  // src/components.js
  var BIND_PREFIX = "__bind_";
  var BIND_SUFFIX = "__";
  var LIFECYCLE_HOOKS = new Set(["beforeMount", "mounted", "updated", "beforeUnmount", "unmounted", "onError"]);
  var BOOLEAN_ATTRS = new Set([
    "disabled",
    "hidden",
    "readonly",
    "required",
    "checked",
    "selected",
    "autofocus",
    "autoplay",
    "controls",
    "loop",
    "muted",
    "multiple",
    "novalidate",
    "open",
    "reversed",
    "defer",
    "async",
    "formnovalidate",
    "allowfullscreen",
    "inert"
  ]);
  var SVG_NS = "http://www.w3.org/2000/svg";
  function extractInputType(pairs) {
    for (const pair of pairs) {
      if (!Array.isArray(pair))
        continue;
      const key = pair[1] instanceof String ? pair[1].valueOf() : pair[1];
      const val = pair[2] instanceof String ? pair[2].valueOf() : pair[2];
      if (key === "type" && typeof val === "string") {
        return val.replace(/^["']|["']$/g, "");
      }
    }
    return null;
  }
  function getMemberName(target) {
    if (typeof target === "string" || target instanceof String)
      return target.valueOf();
    if (Array.isArray(target) && target[0] === "." && target[1] === "this" && (typeof target[2] === "string" || target[2] instanceof String)) {
      return target[2].valueOf();
    }
    return null;
  }
  function isPublicProp(target) {
    return Array.isArray(target) && target[0] === "." && target[1] === "this";
  }
  function getMemberType(target) {
    if (target instanceof String && target.type)
      return target.type;
    if (Array.isArray(target) && target[2] instanceof String && target[2].type)
      return target[2].type;
    return null;
  }
  function installComponentSupport(CodeGenerator, Lexer2) {
    let meta = (node, key) => node instanceof String ? node[key] : undefined;
    const origClassify = Lexer2.prototype.classifyKeyword;
    Lexer2.prototype.classifyKeyword = function(id, fallback, data) {
      if (id === "offer" || id === "accept") {
        let depth = 0;
        for (let i = this.tokens.length - 1;i >= 0; i--) {
          const tag = this.tokens[i][0];
          if (tag === "OUTDENT")
            depth++;
          else if (tag === "INDENT")
            depth--;
          if (depth < 0 && this.tokens[i - 1]?.[0] === "COMPONENT")
            return id.toUpperCase();
        }
        return fallback;
      }
      return origClassify.call(this, id, fallback, data);
    };
    Lexer2.prototype.rewriteRender = function() {
      let gen2 = (tag, val, origin) => {
        let t = [tag, val];
        t.pre = 0;
        t.data = null;
        t.loc = origin?.loc ?? { r: 0, c: 0, n: 0 };
        t.spaced = false;
        t.newLine = false;
        t.generated = true;
        if (origin)
          t.origin = origin;
        return t;
      };
      let inRender = false;
      let renderIndentLevel = 0;
      let currentIndent = 0;
      let pendingCallEnds = [];
      let isHtmlTag = (name) => {
        let tagPart = name.split("#")[0];
        return TEMPLATE_TAGS.has(tagPart);
      };
      let isComponent = (name) => {
        if (!name || typeof name !== "string")
          return false;
        return /^[A-Z]/.test(name);
      };
      let isTemplateTag = (name) => {
        return isHtmlTag(name) || isComponent(name);
      };
      let skipBalancedPair = (tokens, from, closer, opener) => {
        let depth = 1;
        let k = from;
        while (k >= 0 && depth > 0) {
          let kt = tokens[k][0];
          if (kt === closer)
            depth++;
          else if (kt === opener)
            depth--;
          if (depth > 0)
            k--;
        }
        return k;
      };
      let startsWithTag = (tokens, i) => {
        let j = i;
        while (j > 0) {
          let pt = tokens[j - 1][0];
          if (pt === "TERMINATOR" || pt === "RENDER") {
            break;
          }
          if (pt === "INDENT" || pt === "OUTDENT") {
            let jt = tokens[j][0];
            if (jt === "CALL_END" || jt === ")") {
              j = skipBalancedPair(tokens, j - 1, jt, jt === "CALL_END" ? "CALL_START" : "(");
              continue;
            }
            break;
          }
          if (pt === "CALL_END" || pt === ")") {
            j = skipBalancedPair(tokens, j - 2, pt, pt === "CALL_END" ? "CALL_START" : "(");
            continue;
          }
          if (pt === "INTERPOLATION_END") {
            j = skipBalancedPair(tokens, j - 2, "INTERPOLATION_END", "INTERPOLATION_START");
            continue;
          }
          if (pt === "STRING_END") {
            j = skipBalancedPair(tokens, j - 2, "STRING_END", "STRING_START");
            continue;
          }
          j--;
        }
        return tokens[j] && tokens[j][0] === "IDENTIFIER" && (isTemplateTag(tokens[j][1]) || (j === 0 || tokens[j - 1][0] === "INDENT" || tokens[j - 1][0] === "TERMINATOR" || tokens[j - 1][0] === "RENDER"));
      };
      this.scanTokens(function(token, i, tokens) {
        let tag = token[0];
        let nextToken = i < tokens.length - 1 ? tokens[i + 1] : null;
        if (tag === "RENDER") {
          inRender = true;
          renderIndentLevel = currentIndent + 1;
          return 1;
        }
        if (tag === "INDENT") {
          currentIndent++;
          return 1;
        }
        if (tag === "OUTDENT") {
          currentIndent--;
          let inserted = 0;
          while (pendingCallEnds.length > 0 && pendingCallEnds[pendingCallEnds.length - 1] > currentIndent) {
            let callEndToken = gen2("CALL_END", ")", token);
            tokens.splice(i + 1 + inserted, 0, callEndToken);
            pendingCallEnds.pop();
            inserted++;
          }
          if (inRender && currentIndent < renderIndentLevel) {
            inRender = false;
          }
          return 1 + inserted;
        }
        if (!inRender)
          return 1;
        if (tag === "=" && i > 0) {
          let prev = tokens[i - 1][0];
          if (prev === "TERMINATOR" || prev === "INDENT" || prev === "RENDER") {
            const textToken = gen2("IDENTIFIER", "__text__", token);
            const callStart = gen2("CALL_START", "(", token);
            tokens.splice(i, 1, textToken, callStart);
            this.detectEnd(i + 2, (t) => t[0] === "TERMINATOR" || t[0] === "OUTDENT", (t, j) => tokens.splice(j, 0, gen2("CALL_END", ")", t)), { returnOnNegativeLevel: true });
            return 2;
          }
        }
        if (tag === "UNARY_MATH" && token[1] === "~" && nextToken && nextToken[0] === "IDENTIFIER") {
          token[0] = "PROPERTY";
          token[1] = "__transition__";
          let colonToken = gen2(":", ":", token);
          let valueToken = gen2("STRING", `"${nextToken[1]}"`, nextToken);
          tokens.splice(i + 1, 1, colonToken, valueToken);
          return 1;
        }
        if (tag === "PROPERTY" && token[1][0] === "$" && token[1].length > 1) {
          token[0] = "STRING";
          token[1] = `"data-${token[1].slice(1)}"`;
          return 1;
        }
        if (tag === "IDENTIFIER" && !token.spaced) {
          let parts = [token[1]];
          let j = i + 1;
          while (j + 1 < tokens.length) {
            let hyphen = tokens[j];
            let nextPart = tokens[j + 1];
            if (hyphen[0] === "-" && !hyphen.spaced && (nextPart[0] === "IDENTIFIER" || nextPart[0] === "PROPERTY")) {
              parts.push(nextPart[1]);
              j += 2;
              if (nextPart[0] === "PROPERTY")
                break;
            } else {
              break;
            }
          }
          if (parts.length > 1 && j > i + 1 && tokens[j - 1][0] === "PROPERTY") {
            let joined = parts.join("-");
            if (joined[0] === "$")
              joined = "data-" + joined.slice(1);
            token[0] = "STRING";
            token[1] = `"${joined}"`;
            tokens.splice(i + 1, j - i - 1);
            return 1;
          }
        }
        if (tag === ".") {
          let prevToken = i > 0 ? tokens[i - 1] : null;
          let prevTag = prevToken ? prevToken[0] : null;
          if (prevTag === "INDENT" || prevTag === "TERMINATOR") {
            if (nextToken && nextToken[0] === "PROPERTY") {
              let nextNext = i + 2 < tokens.length ? tokens[i + 2] : null;
              if (!nextNext || nextNext[0] !== ":") {
                let divToken = gen2("IDENTIFIER", "div", token);
                tokens.splice(i, 0, divToken);
                return 2;
              }
            }
            if (!nextToken || nextToken[0] !== "(") {
              token[0] = "IDENTIFIER";
              token[1] = "div";
              return 0;
            }
          }
        }
        if (tag === "IDENTIFIER" || tag === "PROPERTY") {
          let next = tokens[i + 1];
          let nextNext = tokens[i + 2];
          if (next && next[0] === "#" && nextNext && (nextNext[0] === "PROPERTY" || nextNext[0] === "IDENTIFIER")) {
            token[1] = token[1] + "#" + nextNext[1];
            if (nextNext.spaced)
              token.spaced = true;
            tokens.splice(i + 1, 2);
            return 0;
          }
        }
        if (tag === "BIND") {
          let prevToken = i > 0 ? tokens[i - 1] : null;
          let nextBindToken = tokens[i + 1];
          if (prevToken && (prevToken[0] === "IDENTIFIER" || prevToken[0] === "PROPERTY") && nextBindToken && nextBindToken[0] === "IDENTIFIER") {
            prevToken[1] = `__bind_${prevToken[1]}__`;
            token[0] = ":";
            token[1] = ":";
            return 1;
          }
        }
        if (tag === "@") {
          let j = i + 1;
          if (j < tokens.length && tokens[j][0] === "PROPERTY") {
            j++;
            while (j + 1 < tokens.length && tokens[j][0] === "." && tokens[j + 1][0] === "PROPERTY") {
              j += 2;
            }
            if (j > i + 2 && j < tokens.length && tokens[j][0] === ":") {
              let openBracket = gen2("[", "[", token);
              tokens.splice(i, 0, openBracket);
              let closeBracket = gen2("]", "]", tokens[j + 1]);
              tokens.splice(j + 1, 0, closeBracket);
              return 2;
            }
          }
        }
        if (tag === "." && nextToken && nextToken[0] === "(") {
          let prevToken = i > 0 ? tokens[i - 1] : null;
          let prevTag = prevToken ? prevToken[0] : null;
          let atLineStart = prevTag === "INDENT" || prevTag === "TERMINATOR";
          let cxToken = gen2("PROPERTY", "__clsx", token);
          nextToken[0] = "CALL_START";
          let depth = 1;
          for (let j = i + 2;j < tokens.length && depth > 0; j++) {
            if (tokens[j][0] === "(" || tokens[j][0] === "CALL_START")
              depth++;
            else if (tokens[j][0] === ")") {
              depth--;
              if (depth === 0)
                tokens[j][0] = "CALL_END";
            } else if (tokens[j][0] === "CALL_END")
              depth--;
          }
          if (atLineStart) {
            let divToken = gen2("IDENTIFIER", "div", token);
            tokens.splice(i, 0, divToken);
            tokens.splice(i + 2, 0, cxToken);
            return 3;
          } else if (prevTag === ":") {
            tokens[i] = gen2("IDENTIFIER", "__clsx", token);
            return 1;
          } else {
            tokens.splice(i + 1, 0, cxToken);
            return 2;
          }
        }
        if (nextToken && nextToken[0] === "INDENT") {
          if (nextToken.fromThen)
            return 1;
          if (tag === "->" || tag === "=>" || tag === "CALL_START" || tag === "(") {
            return 1;
          }
          let isTemplateElement = false;
          let prevTag = i > 0 ? tokens[i - 1][0] : null;
          let isAfterControlFlow = prevTag === "IF" || prevTag === "UNLESS" || prevTag === "WHILE" || prevTag === "UNTIL" || prevTag === "WHEN" || prevTag === "FORIN" || prevTag === "FOROF" || prevTag === "FORAS" || prevTag === "FORASAWAIT" || prevTag === "BY";
          let isClsxCallEnd = false;
          if (tag === "CALL_END") {
            let depth = 1;
            for (let j = i - 1;j >= 0 && depth > 0; j--) {
              if (tokens[j][0] === "CALL_END")
                depth++;
              else if (tokens[j][0] === "CALL_START") {
                depth--;
                if (depth === 0 && j > 0 && tokens[j - 1][0] === "PROPERTY" && tokens[j - 1][1] === "__clsx") {
                  isClsxCallEnd = true;
                }
              }
            }
          }
          let atLineStart = tag === "IDENTIFIER" && (prevTag === "INDENT" || prevTag === "TERMINATOR" || prevTag === "RENDER");
          if (isClsxCallEnd) {
            isTemplateElement = true;
          } else if (tag === "IDENTIFIER" && isTemplateTag(token[1]) && !isAfterControlFlow) {
            isTemplateElement = true;
          } else if (tag === "IDENTIFIER" && !isAfterControlFlow) {
            isTemplateElement = atLineStart || startsWithTag(tokens, i);
          } else if (tag === "PROPERTY" || tag === "STRING" || tag === "STRING_END" || tag === "NUMBER" || tag === "BOOL" || tag === "CALL_END" || tag === ")" || tag === "PRESENCE") {
            isTemplateElement = startsWithTag(tokens, i);
          }
          if (isTemplateElement) {
            let isClassOrIdTail = false;
            if (tag === "PROPERTY" && i > 0 && tokens[i - 1][0] === ".") {
              let j = i;
              while (j >= 2 && tokens[j - 1][0] === "." && tokens[j - 2][0] === "PROPERTY")
                j -= 2;
              if (j >= 2 && tokens[j - 1][0] === "." && tokens[j - 2][0] === "IDENTIFIER" && isTemplateTag(tokens[j - 2][1])) {
                let before = j >= 3 ? tokens[j - 3][0] : null;
                if (!before || before === "INDENT" || before === "OUTDENT" || before === "TERMINATOR" || before === "RENDER") {
                  isClassOrIdTail = true;
                }
              }
            }
            let isBareTag = isClsxCallEnd || tag === "IDENTIFIER" && (isTemplateTag(token[1]) || atLineStart) || isClassOrIdTail;
            if (isBareTag) {
              let callStartToken = gen2("CALL_START", "(", token);
              let arrowToken = gen2("->", "->", token);
              arrowToken.newLine = true;
              tokens.splice(i + 1, 0, callStartToken, arrowToken);
              pendingCallEnds.push(currentIndent + 1);
              return 3;
            } else {
              let commaToken = gen2(",", ",", token);
              let arrowToken = gen2("->", "->", token);
              arrowToken.newLine = true;
              tokens.splice(i + 1, 0, commaToken, arrowToken);
              return 3;
            }
          }
        }
        if (tag === "IDENTIFIER" && isComponent(token[1]) && nextToken && (nextToken[0] === "OUTDENT" || nextToken[0] === "TERMINATOR")) {
          tokens.splice(i + 1, 0, gen2("CALL_START", "(", token), gen2("CALL_END", ")", token));
          return 3;
        }
        return 1;
      });
    };
    const proto = CodeGenerator.prototype;
    proto.isHtmlTag = function(name) {
      const tagPart = name.split("#")[0];
      return TEMPLATE_TAGS.has(tagPart.toLowerCase());
    };
    proto.isComponent = function(name) {
      if (!name || typeof name !== "string")
        return false;
      return /^[A-Z]/.test(name);
    };
    proto.collectTemplateClasses = function(sexpr) {
      const classes = [];
      let current = sexpr;
      while (this.is(current, ".")) {
        const prop = current[2];
        if (typeof prop === "string" || prop instanceof String) {
          classes.unshift(prop.valueOf());
        }
        current = current[1];
      }
      let raw = typeof current === "string" ? current : current instanceof String ? current.valueOf() : null;
      if (raw === null)
        return { tag: null, classes, id: undefined, base: current };
      let [tag, id] = raw.split("#");
      if (!tag)
        tag = "div";
      return { tag, classes, id, base: current };
    };
    const _str = (s) => typeof s === "string" ? s : s instanceof String ? s.valueOf() : null;
    const _transferMeta = (from, to) => {
      if (!(from instanceof String))
        return to;
      const s = new String(to);
      if (from.predicate)
        s.predicate = true;
      if (from.await)
        s.await = true;
      return s.predicate || s.await ? s : to;
    };
    proto.transformComponentMembers = function(sexpr, localScope = new Set) {
      const self = this._self;
      if (!Array.isArray(sexpr)) {
        const sv = _str(sexpr);
        if (sv && localScope.has(sv))
          return sexpr;
        if (sv && this.reactiveMembers && this.reactiveMembers.has(sv)) {
          return [".", [".", self, sv], _transferMeta(sexpr, "value")];
        }
        if (sv && this.componentMembers && this.componentMembers.has(sv)) {
          return [".", self, _transferMeta(sexpr, sv)];
        }
        return sexpr;
      }
      if (sexpr[0] === "." && sexpr[1] === "this" && _str(sexpr[2]) != null) {
        const prop = sexpr[2];
        const memberName = _str(prop);
        if (this.reactiveMembers && this.reactiveMembers.has(memberName)) {
          return [".", [".", self, memberName], _transferMeta(prop, "value")];
        }
        return this._factoryMode ? [".", self, prop] : sexpr;
      }
      if (sexpr[0] === "." || sexpr[0] === "?.") {
        return [sexpr[0], this.transformComponentMembers(sexpr[1]), sexpr[2]];
      }
      if (sexpr[0] === "->") {
        const params = sexpr[1];
        const childScope = new Set(localScope);
        if (Array.isArray(params)) {
          for (const p of params) {
            const name = _str(Array.isArray(p) && p[0] === "default" ? p[1] : p);
            if (name)
              childScope.add(name);
          }
        }
        return ["=>", sexpr[1], this.transformComponentMembers(sexpr[2], childScope)];
      }
      if (sexpr[0] === "object" || sexpr[0] === "map-literal") {
        return [sexpr[0], ...sexpr.slice(1).map((pair) => {
          if (Array.isArray(pair) && pair[0] === "...") {
            return ["...", this.transformComponentMembers(pair[1], localScope)];
          }
          if (Array.isArray(pair) && pair.length >= 2) {
            let key = pair[1];
            let newKey = Array.isArray(key) ? this.transformComponentMembers(key, localScope) : key;
            let newValue = this.transformComponentMembers(pair[2], localScope);
            return [pair[0], newKey, newValue];
          }
          return this.transformComponentMembers(pair, localScope);
        })];
      }
      if (sexpr[0] === "block" || sexpr[0] === "program") {
        const scope = new Set(localScope);
        const items = [sexpr[0]];
        for (let i = 1;i < sexpr.length; i++) {
          const item = sexpr[i];
          if (Array.isArray(item) && item[0] === "=") {
            const targetName = _str(item[1]);
            if (targetName && !(this.reactiveMembers && this.reactiveMembers.has(targetName))) {
              items.push(["=", item[1], this.transformComponentMembers(item[2], scope)]);
              scope.add(targetName);
              continue;
            }
          }
          items.push(this.transformComponentMembers(item, scope));
        }
        return items;
      }
      return sexpr.map((item) => this.transformComponentMembers(item, localScope));
    };
    proto.generateComponent = function(head, rest, context, sexpr) {
      const [, body] = rest;
      const statements = this.is(body, "block") ? body.slice(1) : [];
      const stateVars = [];
      const derivedVars = [];
      const readonlyVars = [];
      const methods = [];
      const lifecycleHooks = [];
      const effects = [];
      const offeredVars = [];
      const acceptedVars = [];
      let renderBlock = null;
      const memberNames = new Set;
      const reactiveMembers = new Set;
      for (let stmt of statements) {
        if (!Array.isArray(stmt))
          continue;
        let [op] = stmt;
        if (op === "offer") {
          stmt = stmt[1];
          if (!Array.isArray(stmt))
            continue;
          op = stmt[0];
          const varName = getMemberName(stmt[1]);
          if (varName)
            offeredVars.push(varName);
        }
        if (op === "accept") {
          const varName = typeof stmt[1] === "string" ? stmt[1] : getMemberName(stmt[1]);
          if (varName) {
            acceptedVars.push(varName);
            memberNames.add(varName);
            reactiveMembers.add(varName);
          }
        } else if (op === "." && stmt[1] === "this" && getMemberName(stmt)) {
          const varName = typeof stmt[2] === "string" || stmt[2] instanceof String ? stmt[2].valueOf() : null;
          if (varName) {
            stateVars.push({ name: varName, value: undefined, isPublic: true, type: stmt[2]?.type || null, required: true });
            memberNames.add(varName);
            reactiveMembers.add(varName);
          }
        } else if (op === "state") {
          const varName = getMemberName(stmt[1]);
          if (varName) {
            stateVars.push({ name: varName, value: stmt[2], isPublic: isPublicProp(stmt[1]), type: getMemberType(stmt[1]) });
            memberNames.add(varName);
            reactiveMembers.add(varName);
          }
        } else if (op === "computed") {
          const varName = getMemberName(stmt[1]);
          if (varName) {
            derivedVars.push({ name: varName, expr: stmt[2] });
            memberNames.add(varName);
            reactiveMembers.add(varName);
          }
        } else if (op === "readonly") {
          const varName = getMemberName(stmt[1]);
          if (varName) {
            readonlyVars.push({ name: varName, value: stmt[2], isPublic: isPublicProp(stmt[1]), type: getMemberType(stmt[1]) });
            memberNames.add(varName);
          }
        } else if (op === "=") {
          const varName = getMemberName(stmt[1]);
          if (varName) {
            if (LIFECYCLE_HOOKS.has(varName)) {
              lifecycleHooks.push({ name: varName, value: stmt[2] });
            } else {
              const val = stmt[2];
              if (Array.isArray(val) && (val[0] === "->" || val[0] === "=>")) {
                methods.push({ name: varName, func: val });
                memberNames.add(varName);
              } else {
                stateVars.push({ name: varName, value: val, isPublic: isPublicProp(stmt[1]) });
                memberNames.add(varName);
                reactiveMembers.add(varName);
              }
            }
          }
        } else if (op === "effect") {
          effects.push(stmt);
        } else if (op === "render") {
          renderBlock = stmt;
        } else if (op === "object") {
          for (let i = 1;i < stmt.length; i++) {
            const pair = stmt[i];
            if (!Array.isArray(pair))
              continue;
            const [, methodName, funcDef] = pair;
            if (typeof methodName === "string" && LIFECYCLE_HOOKS.has(methodName)) {
              lifecycleHooks.push({ name: methodName, value: funcDef });
            } else if (typeof methodName === "string") {
              methods.push({ name: methodName, func: funcDef });
              memberNames.add(methodName);
            }
          }
        }
      }
      const autoEventHandlers = new Map;
      for (const { name } of methods) {
        if (/^on[A-Z]/.test(name) && !LIFECYCLE_HOOKS.has(name)) {
          const eventName = name[2].toLowerCase() + name.slice(3);
          if (DOM_EVENTS.has(eventName))
            autoEventHandlers.set(eventName, name);
        }
      }
      const inheritsTag = rest[0]?.valueOf?.() ?? null;
      const publicPropNames = new Set;
      for (const { name, isPublic } of stateVars)
        if (isPublic)
          publicPropNames.add(name);
      for (const { name, isPublic } of readonlyVars)
        if (isPublic)
          publicPropNames.add(name);
      const prevComponentMembers = this.componentMembers;
      const prevReactiveMembers = this.reactiveMembers;
      const prevAutoEventHandlers = this._autoEventHandlers;
      const prevInheritsTag = this._inheritsTag;
      this.componentMembers = memberNames;
      this.reactiveMembers = reactiveMembers;
      this._autoEventHandlers = autoEventHandlers.size > 0 ? autoEventHandlers : null;
      this._inheritsTag = inheritsTag || null;
      if (this.options.stubComponents) {
        const expandType = (t) => t ? t.replace(/::/g, ":").replace(/(\w+(?:<[^>]+>)?)\?\?/g, "$1 | null | undefined").replace(/(\w+(?:<[^>]+>)?)\?(?![.:])/g, "$1 | undefined").replace(/(\w+(?:<[^>]+>)?)\!/g, "NonNullable<$1>") : null;
        const sl = [];
        sl.push("class {");
        sl.push("  declare _root: Element | null;");
        sl.push("  emit(_name: string, _detail?: any): void {}");
        const propEntries = [];
        for (const { name, type, isPublic, required } of stateVars) {
          if (!isPublic)
            continue;
          const ts = expandType(type);
          const opt = required ? "" : "?";
          propEntries.push(`${name}${opt}: ${ts || "any"}`);
          propEntries.push(`__bind_${name}__?: Signal<${ts || "any"}>`);
        }
        for (const { name, type, isPublic } of readonlyVars) {
          if (!isPublic)
            continue;
          const ts = expandType(type);
          propEntries.push(`${name}?: ${ts || "any"}`);
        }
        {
          const hasRequired = propEntries.length > 0 && stateVars.some((v) => v.isPublic && v.required);
          const propsOpt = hasRequired ? "" : "?";
          let propsType = propEntries.length > 0 ? `{${propEntries.join("; ")}}` : "{}";
          if (inheritsTag)
            propsType += ` & __RipProps<'${inheritsTag}'>`;
          sl.push(`  constructor(_props${propsOpt}: ${propsType}) {}`);
        }
        const inferLiteralType = (v) => {
          const s = v?.valueOf?.() ?? v;
          if (typeof s !== "string")
            return null;
          if (s === "true" || s === "false")
            return "boolean";
          if (/^-?\d+(\.\d+)?$/.test(s))
            return "number";
          if (s.startsWith('"') || s.startsWith("'"))
            return "string";
          return null;
        };
        for (const { name, type, value } of stateVars) {
          const ts = expandType(type) || inferLiteralType(value);
          sl.push(ts ? `  declare ${name}: Signal<${ts}>;` : `  declare ${name}: Signal<any>;`);
        }
        for (const { name, type, value } of readonlyVars) {
          const ts = expandType(type) || inferLiteralType(value);
          sl.push(ts ? `  declare ${name}: ${ts};` : `  declare ${name}: any;`);
        }
        for (const { name, expr } of derivedVars) {
          if (this.is(expr, "block")) {
            const transformed = this.transformComponentMembers(expr);
            const body2 = this.generateFunctionBody(transformed);
            sl.push(`  ${name} = __computed(() => ${body2});`);
          } else {
            const val = this.generateInComponent(expr, "value");
            sl.push(`  ${name} = __computed(() => ${val});`);
          }
        }
        sl.push("  _init(props) {");
        for (const { name, value, isPublic } of readonlyVars) {
          const val = this.generateInComponent(value, "value");
          sl.push(isPublic ? `    this.${name} = props.${name} ?? ${val};` : `    this.${name} = ${val};`);
        }
        for (const { name, value, isPublic, required, type } of stateVars) {
          if (isPublic && required) {
            sl.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name});`);
          } else if (isPublic) {
            const val = this.generateInComponent(value, "value");
            sl.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name} ?? ${val});`);
          } else {
            const val = this.generateInComponent(value, "value");
            sl.push(`    this.${name} = __state(${val});`);
          }
        }
        for (const effect of effects) {
          const effectBody = effect[2];
          const isAsync = this.containsAwait(effectBody) ? "async " : "";
          if (this.is(effectBody, "block")) {
            const transformed = this.transformComponentMembers(effectBody);
            const body2 = this.generateFunctionBody(transformed, [], true);
            sl.push(`    __effect(${isAsync}() => ${body2});`);
          } else {
            const effectCode = this.generateInComponent(effectBody, "value");
            sl.push(`    __effect(${isAsync}() => { ${effectCode}; });`);
          }
        }
        sl.push("  }");
        const eventMethodTypes = new Map;
        for (const [eventName, methodName] of autoEventHandlers) {
          eventMethodTypes.set(methodName, eventName);
        }
        if (renderBlock) {
          const scanEvents = (node) => {
            if (!Array.isArray(node))
              return;
            const head2 = node[0]?.valueOf?.() ?? node[0];
            if (typeof head2 === "string" && head2 !== "object" && head2 !== "switch" && TEMPLATE_TAGS.has(head2.split(/[.#]/)[0])) {
              for (let i = 1;i < node.length; i++) {
                const arg = node[i];
                let obj = this.is(arg, "object") ? arg : null;
                if (!obj && Array.isArray(arg) && (arg[0] === "->" || arg[0] === "=>") && this.is(arg[2], "block")) {
                  for (let k = 1;k < arg[2].length; k++) {
                    if (this.is(arg[2][k], "object")) {
                      obj = arg[2][k];
                      break;
                    }
                  }
                }
                if (!obj)
                  continue;
                for (let j = 1;j < obj.length; j++) {
                  const pair = obj[j];
                  if (!Array.isArray(pair) || pair.length < 2)
                    continue;
                  const [, key, value] = pair;
                  if (Array.isArray(key) && key[0] === "." && key[1] === "this" && Array.isArray(value) && value[0] === "." && value[1] === "this") {
                    const eventName = typeof key[2] === "string" ? key[2] : key[2]?.valueOf?.();
                    const methodName = typeof value[2] === "string" ? value[2] : value[2]?.valueOf?.();
                    if (eventName && methodName && !eventMethodTypes.has(methodName)) {
                      eventMethodTypes.set(methodName, eventName);
                    }
                  }
                }
              }
            }
            for (let i = 1;i < node.length; i++)
              scanEvents(node[i]);
          };
          scanEvents(renderBlock);
        }
        for (const { name, func } of methods) {
          if (Array.isArray(func) && (func[0] === "->" || func[0] === "=>")) {
            let [, params, methodBody] = func;
            if ((!params || Array.isArray(params) && params.length === 0) && this.containsIt(methodBody))
              params = ["it"];
            let paramStr = Array.isArray(params) ? params.map((p) => {
              let base = this.formatParam(p);
              if (p?.type)
                base += `: ${p.type}`;
              return base;
            }).join(", ") : "";
            const boundEvent = eventMethodTypes.get(name);
            if (boundEvent && Array.isArray(params) && params.length > 0) {
              const firstParam = params[0];
              const hasType = firstParam?.type || firstParam instanceof String && firstParam.type;
              if (!hasType && typeof (firstParam?.valueOf?.() ?? firstParam) === "string") {
                const paramName = firstParam?.valueOf?.() ?? firstParam;
                paramStr = paramStr.replace(paramName, `${paramName}: HTMLElementEventMap['${boundEvent}']`);
              }
            }
            const transformed = this.reactiveMembers ? this.transformComponentMembers(methodBody) : methodBody;
            const isAsync = this.containsAwait(methodBody);
            const bodyCode = this.generateFunctionBody(transformed, params || []);
            sl.push(`  ${isAsync ? "async " : ""}${name}(${paramStr}) ${bodyCode}`);
          }
        }
        for (const { name, value } of lifecycleHooks) {
          if (Array.isArray(value) && (value[0] === "->" || value[0] === "=>")) {
            const [, params, hookBody] = value;
            const paramStr = Array.isArray(params) ? params.map((p) => this.formatParam(p)).join(", ") : "";
            const transformed = this.reactiveMembers ? this.transformComponentMembers(hookBody) : hookBody;
            const isAsync = this.containsAwait(hookBody);
            const bodyCode = this.generateFunctionBody(transformed, params || []);
            sl.push(`  ${isAsync ? "async " : ""}${name}(${paramStr}) ${bodyCode}`);
          }
        }
        if (renderBlock) {
          const constructions = [];
          let constructionIdx = 0;
          const extractProps = (args) => {
            const props = [];
            for (const arg of args) {
              let obj = null;
              if (this.is(arg, "object")) {
                obj = arg;
              } else if (Array.isArray(arg) && (arg[0] === "->" || arg[0] === "=>") && this.is(arg[2], "block")) {
                for (let k = 1;k < arg[2].length; k++) {
                  if (this.is(arg[2][k], "object")) {
                    obj = arg[2][k];
                    break;
                  }
                }
              }
              if (obj) {
                for (let j = 1;j < obj.length; j++) {
                  const pair = obj[j];
                  const [, key, value] = pair;
                  if (typeof key === "string" && !key.startsWith("@")) {
                    const srcLine = pair.loc?.r ?? obj.loc?.r;
                    if (key.startsWith("__bind_") && key.endsWith("__")) {
                      const member = typeof value === "string" && this.reactiveMembers?.has(value) ? `this.${value}` : this.generateInComponent(value, "value");
                      props.push({ code: `${key}: ${member}`, srcLine });
                    } else {
                      const val = this.generateInComponent(value, "value");
                      props.push({ code: `${key}: ${val}`, srcLine });
                    }
                  }
                }
              }
            }
            return props;
          };
          const extractIntrinsicProps = (args) => {
            const props = [];
            for (const arg of args) {
              let obj = null;
              if (this.is(arg, "object")) {
                obj = arg;
              } else if (Array.isArray(arg) && (arg[0] === "->" || arg[0] === "=>") && this.is(arg[2], "block")) {
                for (let k = 1;k < arg[2].length; k++) {
                  if (this.is(arg[2][k], "object")) {
                    obj = arg[2][k];
                    break;
                  }
                }
              }
              if (obj) {
                for (let j = 1;j < obj.length; j++) {
                  const pair = obj[j];
                  if (!Array.isArray(pair) || pair.length < 2)
                    continue;
                  const [, key, value] = pair;
                  const srcLine = pair.loc?.r ?? obj.loc?.r;
                  if (Array.isArray(key) && key[0] === "." && key[1] === "this") {
                    let memberName = typeof key[2] === "string" ? key[2] : key[2]?.valueOf?.();
                    if (!memberName)
                      continue;
                    const eventKey = "@" + memberName.split(".")[0];
                    const val = this.generateInComponent(value, "value");
                    props.push({ code: `'${eventKey}': ${val}`, srcLine });
                  } else if (typeof key === "string") {
                    if (key === "key")
                      continue;
                    if (key.startsWith("__bind_") && key.endsWith("__")) {
                      const propName = key.slice(7, -2);
                      const val = this.generateInComponent(value, "value");
                      props.push({ code: `${propName}: ${val}`, srcLine });
                    } else {
                      const val = this.generateInComponent(value, "value");
                      props.push({ code: `${key}: ${val}`, srcLine });
                    }
                  }
                }
              }
            }
            return props;
          };
          const walkRender = (node) => {
            if (!Array.isArray(node))
              return;
            const head2 = node[0]?.valueOf?.() ?? node[0];
            if (typeof head2 === "string" && /^[A-Z]/.test(head2)) {
              const props = extractProps(node.slice(1));
              const varName = `_${constructionIdx++}`;
              const propsType = `ConstructorParameters<typeof ${head2}>[0] & {}`;
              if (props.length === 0) {
                const tagLine = node.loc?.r;
                constructions.push(`    const ${varName}: ${propsType} = {};` + (tagLine != null ? ` // @rip-src:${tagLine}` : ""));
              } else if (props.length === 1) {
                const srcLine = node.loc?.r ?? props[0].srcLine;
                constructions.push(`    const ${varName}: ${propsType} = {${props[0].code}};` + (srcLine != null ? ` // @rip-src:${srcLine}` : ""));
              } else {
                const tagLine = node.loc?.r;
                const distinctLines = new Set(props.map((p) => p.srcLine).filter((l) => l != null));
                if (distinctLines.size <= 1) {
                  const srcLine = props[0].srcLine ?? tagLine;
                  constructions.push(`    const ${varName}: ${propsType} = {${props.map((p) => p.code).join(", ")}};` + (srcLine != null ? ` // @rip-src:${srcLine}` : ""));
                } else {
                  constructions.push(`    const ${varName}: ${propsType} = {` + (tagLine != null ? ` // @rip-src:${tagLine}` : ""));
                  for (const p of props) {
                    constructions.push(`      ${p.code},` + (p.srcLine != null ? ` // @rip-src:${p.srcLine}` : ""));
                  }
                  constructions.push(`    };`);
                }
              }
            } else if (typeof head2 === "string" && !CodeGenerator.GENERATORS[head2] && (TEMPLATE_TAGS.has(head2.split(/[.#]/)[0]) || /^[a-z][\w-]*$/.test(head2) && node.length > 1)) {
              const tagName = head2.split(/[.#]/)[0];
              const iProps = extractIntrinsicProps(node.slice(1));
              const tagLine = node.loc?.r;
              const srcMarker = tagLine != null ? ` // @rip-src:${tagLine}` : "";
              if (iProps.length === 0) {
                constructions.push(`    __ripEl('${tagName}');${srcMarker}`);
              } else if (iProps.length === 1) {
                const srcLine = iProps[0].srcLine ?? tagLine;
                const marker = srcLine != null ? ` // @rip-src:${srcLine}` : "";
                constructions.push(`    __ripEl('${tagName}', {${iProps[0].code}});${marker}`);
              } else {
                const distinctLines = new Set(iProps.map((p) => p.srcLine).filter((l) => l != null));
                if (distinctLines.size <= 1) {
                  const srcLine = iProps[0].srcLine ?? tagLine;
                  const marker = srcLine != null ? ` // @rip-src:${srcLine}` : "";
                  constructions.push(`    __ripEl('${tagName}', {${iProps.map((p) => p.code).join(", ")}});${marker}`);
                } else {
                  constructions.push(`    __ripEl('${tagName}', {${srcMarker}`);
                  for (const p of iProps) {
                    constructions.push(`      ${p.code},` + (p.srcLine != null ? ` // @rip-src:${p.srcLine}` : ""));
                  }
                  constructions.push(`    });`);
                }
              }
            }
            for (let i = 1;i < node.length; i++)
              walkRender(node[i]);
          };
          walkRender(renderBlock);
          if (constructions.length > 0) {
            sl.push("  _render() {");
            for (const c of constructions)
              sl.push(c);
            sl.push("  }");
          }
        }
        sl.push("}");
        this.componentMembers = prevComponentMembers;
        this.reactiveMembers = prevReactiveMembers;
        this._autoEventHandlers = prevAutoEventHandlers;
        this._inheritsTag = prevInheritsTag;
        return sl.join(`
`);
      }
      this.usesTemplates = true;
      this.usesReactivity = true;
      const lines = [];
      let blockFactoriesCode = "";
      lines.push("class extends __Component {");
      lines.push("  _init(props) {");
      for (const { name, value, isPublic } of readonlyVars) {
        const val = this.generateInComponent(value, "value");
        lines.push(isPublic ? `    this.${name} = props.${name} ?? ${val};` : `    this.${name} = ${val};`);
      }
      for (const name of acceptedVars) {
        lines.push(`    this.${name} = getContext('${name}');`);
      }
      for (const { name, value, isPublic, required } of stateVars) {
        if (isPublic && required) {
          lines.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name});`);
        } else if (isPublic) {
          const val = this.generateInComponent(value, "value");
          lines.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name} ?? ${val});`);
        } else {
          const val = this.generateInComponent(value, "value");
          lines.push(`    this.${name} = __state(${val});`);
        }
      }
      if (inheritsTag) {
        lines.push("    this._rest = {};");
        lines.push("    for (const __k in props) {");
        if (publicPropNames.size > 0) {
          const checks = [...publicPropNames].map((name) => `__k !== '${name}'`).join(" && ");
          lines.push(`      if (${checks} && !__k.startsWith('__bind_')) this._rest[__k] = props[__k];`);
        } else {
          lines.push("      if (!__k.startsWith('__bind_')) this._rest[__k] = props[__k];");
        }
        lines.push("    }");
      }
      for (const { name, expr } of derivedVars) {
        if (this.is(expr, "block")) {
          const transformed = this.transformComponentMembers(expr);
          const body2 = this.generateFunctionBody(transformed);
          lines.push(`    this.${name} = __computed(() => ${body2});`);
        } else {
          const val = this.generateInComponent(expr, "value");
          lines.push(`    this.${name} = __computed(() => ${val});`);
        }
      }
      for (const name of offeredVars) {
        lines.push(`    setContext('${name}', this.${name});`);
      }
      for (const effect of effects) {
        const effectBody = effect[2];
        const isAsync = this.containsAwait(effectBody) ? "async " : "";
        if (this.is(effectBody, "block")) {
          const transformed = this.transformComponentMembers(effectBody);
          const body2 = this.generateFunctionBody(transformed, [], true);
          lines.push(`    __effect(${isAsync}() => ${body2});`);
        } else {
          const effectCode = this.generateInComponent(effectBody, "value");
          lines.push(`    __effect(${isAsync}() => { ${effectCode}; });`);
        }
      }
      lines.push("  }");
      if (inheritsTag) {
        lines.push("  _setRestProp(key, value) {");
        lines.push("    if (key.startsWith('__bind_')) return;");
        lines.push("    this._rest || (this._rest = {});");
        lines.push("    if (value == null) delete this._rest[key];");
        lines.push("    else this._rest[key] = value;");
        lines.push("    this._applyInheritedProp(this._inheritedEl, key, value);");
        lines.push("  }");
        lines.push("  _applyRestToInheritedEl() {");
        lines.push("    if (!this._inheritedEl || !this._rest) return;");
        lines.push("    for (const key in this._rest) this._applyInheritedProp(this._inheritedEl, key, this._rest[key]);");
        lines.push("  }");
        lines.push("  _applyInheritedProp(el, key, value) {");
        lines.push("    if (!el || key === 'key' || key === 'ref' || key === 'children' || key.startsWith('__bind_')) return;");
        lines.push("    if (key[0] === '@') {");
        lines.push("      const event = key.slice(1).split('.')[0];");
        lines.push("      this._restHandlers || (this._restHandlers = {});");
        lines.push("      const prev = this._restHandlers[key];");
        lines.push("      if (prev) el.removeEventListener(event, prev);");
        lines.push("      if (typeof value === 'function') {");
        lines.push("        const next = (e) => __batch(() => value(e));");
        lines.push("        this._restHandlers[key] = next;");
        lines.push("        el.addEventListener(event, next);");
        lines.push("      } else {");
        lines.push("        delete this._restHandlers[key];");
        lines.push("      }");
        lines.push("      return;");
        lines.push("    }");
        lines.push("    if (key === 'class' || key === 'className') {");
        lines.push("      if (el instanceof SVGElement) el.setAttribute('class', __clsx(value));");
        lines.push("      else el.className = __clsx(value);");
        lines.push("      return;");
        lines.push("    }");
        lines.push("    if (key === 'style') {");
        lines.push("      if (value == null) { el.removeAttribute('style'); return; }");
        lines.push("      if (typeof value === 'string') { el.setAttribute('style', value); return; }");
        lines.push("      if (typeof value === 'object') { Object.assign(el.style, value); return; }");
        lines.push("    }");
        lines.push("    if (key === 'innerHTML' || key === 'textContent' || key === 'innerText') {");
        lines.push("      el[key] = value ?? '';");
        lines.push("      return;");
        lines.push("    }");
        lines.push("    if (key in el && !key.includes('-')) {");
        lines.push("      el[key] = value;");
        lines.push("      return;");
        lines.push("    }");
        lines.push("    if (value == null || value === false) {");
        lines.push("      el.removeAttribute(key);");
        lines.push("      return;");
        lines.push("    }");
        lines.push("    if (value === true) {");
        lines.push("      el.setAttribute(key, '');");
        lines.push("      return;");
        lines.push("    }");
        lines.push("    el.setAttribute(key, value);");
        lines.push("  }");
      }
      for (const { name, func } of methods) {
        if (Array.isArray(func) && (func[0] === "->" || func[0] === "=>")) {
          let [, params, methodBody] = func;
          if ((!params || Array.isArray(params) && params.length === 0) && this.containsIt(methodBody))
            params = ["it"];
          const paramStr = Array.isArray(params) ? params.map((p) => this.formatParam(p)).join(", ") : "";
          const transformed = this.reactiveMembers ? this.transformComponentMembers(methodBody) : methodBody;
          const isAsync = this.containsAwait(methodBody);
          const bodyCode = this.generateFunctionBody(transformed, params || []);
          lines.push(`  ${isAsync ? "async " : ""}${name}(${paramStr}) ${bodyCode}`);
        }
      }
      for (const { name, value } of lifecycleHooks) {
        if (Array.isArray(value) && (value[0] === "->" || value[0] === "=>")) {
          const [, params, hookBody] = value;
          const paramStr = Array.isArray(params) ? params.map((p) => this.formatParam(p)).join(", ") : "";
          const transformed = this.reactiveMembers ? this.transformComponentMembers(hookBody) : hookBody;
          const isAsync = this.containsAwait(hookBody);
          const bodyCode = this.generateFunctionBody(transformed, params || []);
          lines.push(`  ${isAsync ? "async " : ""}${name}(${paramStr}) ${bodyCode}`);
        }
      }
      if (renderBlock) {
        const renderBody = renderBlock[1];
        const result = this.buildRender(renderBody);
        if (result.blockFactories.length > 0) {
          blockFactoriesCode = result.blockFactories.join(`

`) + `

`;
        }
        lines.push("  _create() {");
        for (const line of result.createLines) {
          lines.push(`    ${line}`);
        }
        lines.push(`    return ${result.rootVar};`);
        lines.push("  }");
        if (result.setupLines.length > 0) {
          lines.push("  _setup() {");
          for (const line of result.setupLines) {
            lines.push(`    ${line}`);
          }
          lines.push("  }");
        }
      }
      lines.push("}");
      this.componentMembers = prevComponentMembers;
      this.reactiveMembers = prevReactiveMembers;
      this._autoEventHandlers = prevAutoEventHandlers;
      this._inheritsTag = prevInheritsTag;
      if (blockFactoriesCode) {
        return `(() => {
${blockFactoriesCode}return ${lines.join(`
`)};
})()`;
      }
      return lines.join(`
`);
    };
    proto.generateInComponent = function(sexpr, context) {
      if (typeof sexpr === "string" && this.reactiveMembers && this.reactiveMembers.has(sexpr)) {
        return `${this._self}.${sexpr}.value`;
      }
      if (typeof sexpr === "string" && this.componentMembers && this.componentMembers.has(sexpr)) {
        return `${this._self}.${sexpr}`;
      }
      if (Array.isArray(sexpr) && this.reactiveMembers) {
        const transformed = this.transformComponentMembers(sexpr);
        return this.generate(transformed, context);
      }
      return this.generate(sexpr, context);
    };
    proto.generateRender = function(head, rest, context, sexpr) {
      throw new Error("render blocks can only be used inside a component");
    };
    proto.generateOffer = function(head, rest, context, sexpr) {
      throw new Error("offer can only be used inside a component");
    };
    proto.generateAccept = function(head, rest, context, sexpr) {
      throw new Error("accept can only be used inside a component");
    };
    proto.buildRender = function(body) {
      this._elementCount = 0;
      this._textCount = 0;
      this._blockCount = 0;
      this._createLines = [];
      this._setupLines = [];
      this._blockFactories = [];
      this._loopVarStack = [];
      this._factoryMode = false;
      this._factoryVars = null;
      this._fragChildren = new Map;
      this._pendingAutoWire = false;
      this._autoWireEl = null;
      this._autoWireExplicit = null;
      this._inheritsTargetBound = false;
      const statements = this.is(body, "block") ? body.slice(1) : [body];
      let rootVar;
      if (statements.length === 0) {
        rootVar = "null";
      } else if (statements.length === 1) {
        this._pendingAutoWire = !!this._autoEventHandlers;
        rootVar = this.generateNode(statements[0]);
        this._pendingAutoWire = false;
      } else {
        rootVar = this.newElementVar("frag");
        this._createLines.push(`${rootVar} = document.createDocumentFragment();`);
        const children = [];
        for (const stmt of statements) {
          const childVar = this.generateNode(stmt);
          this._createLines.push(`${rootVar}.appendChild(${childVar});`);
          children.push(childVar);
        }
        this._fragChildren.set(rootVar, children);
      }
      return {
        createLines: this._createLines,
        setupLines: this._setupLines,
        blockFactories: this._blockFactories,
        rootVar
      };
    };
    proto.newBlockVar = function() {
      return `create_block_${this._blockCount++}`;
    };
    proto.newElementVar = function(hint = "el") {
      const name = `_${hint}${this._elementCount++}`;
      if (this._factoryVars)
        this._factoryVars.add(name);
      return this._factoryMode ? name : `this.${name}`;
    };
    proto.newTextVar = function() {
      const name = `_t${this._textCount++}`;
      if (this._factoryVars)
        this._factoryVars.add(name);
      return this._factoryMode ? name : `this.${name}`;
    };
    Object.defineProperty(proto, "_self", {
      get() {
        return this._factoryMode ? "ctx" : "this";
      }
    });
    proto._pushEffect = function(body) {
      if (this._factoryMode) {
        this._setupLines.push(`disposers.push(__effect(() => { ${body} }));`);
      } else {
        this._setupLines.push(`__effect(() => { ${body} });`);
      }
    };
    proto.generateNode = function(sexpr) {
      if (typeof sexpr === "string" || sexpr instanceof String) {
        const str = sexpr.valueOf();
        if (str.startsWith('"') || str.startsWith("'") || str.startsWith("`")) {
          const textVar2 = this.newTextVar();
          this._createLines.push(`${textVar2} = document.createTextNode(${str});`);
          return textVar2;
        }
        if (this.reactiveMembers && this.reactiveMembers.has(str)) {
          const textVar2 = this.newTextVar();
          this._createLines.push(`${textVar2} = document.createTextNode('');`);
          this._pushEffect(`${textVar2}.data = ${this._self}.${str}.value;`);
          return textVar2;
        }
        if (str === "slot" && this.componentMembers) {
          const s = this._self;
          const slotVar = this.newElementVar("slot");
          this._createLines.push(`${slotVar} = ${s}.children instanceof Node ? ${s}.children : (${s}.children != null ? document.createTextNode(String(${s}.children)) : document.createComment(''));`);
          return slotVar;
        }
        const [tagStr, idStr] = str.split("#");
        const elVar = this.newElementVar();
        const actualTag = tagStr || "div";
        if (SVG_TAGS.has(actualTag) || this._svgDepth > 0) {
          this._createLines.push(`${elVar} = document.createElementNS('${SVG_NS}', '${actualTag}');`);
        } else {
          this._createLines.push(`${elVar} = document.createElement('${actualTag}');`);
        }
        if (idStr)
          this._createLines.push(`${elVar}.id = '${idStr}';`);
        this._bindInheritedTarget(actualTag, elVar);
        return elVar;
      }
      if (!Array.isArray(sexpr)) {
        const commentVar = this.newElementVar("c");
        this._createLines.push(`${commentVar} = document.createComment('unknown');`);
        return commentVar;
      }
      const [head, ...rest] = sexpr;
      const headStr = typeof head === "string" ? head : head instanceof String ? head.valueOf() : null;
      if (headStr && this.isComponent(headStr)) {
        return this.generateChildComponent(headStr, rest);
      }
      if (headStr === "slot" && this.componentMembers) {
        const s = this._self;
        const slotVar = this.newElementVar("slot");
        this._createLines.push(`${slotVar} = ${s}.children instanceof Node ? ${s}.children : (${s}.children != null ? document.createTextNode(String(${s}.children)) : document.createComment(''));`);
        return slotVar;
      }
      if (headStr === "switch") {
        const disc = rest[0];
        const whens = rest[1] || [];
        const defaultCase = rest[2] || null;
        let chain = defaultCase;
        for (let i = whens.length - 1;i >= 0; i--) {
          const [, tests, body] = whens[i];
          let cond;
          if (disc === null) {
            cond = tests.length === 1 ? tests[0] : tests.reduce((a, t) => a ? ["||", a, t] : t, null);
          } else {
            cond = tests.length === 1 ? ["==", disc, tests[0]] : tests.map((t) => ["==", disc, t]).reduce((a, c) => a ? ["||", a, c] : c, null);
          }
          chain = ["if", cond, body, chain];
        }
        if (chain) {
          if (Array.isArray(chain) && chain[0] === "if")
            return this.generateConditional(chain);
          return this.generateTemplateBlock(chain);
        }
        const cv = this.newElementVar("c");
        this._createLines.push(`${cv} = document.createComment('switch');`);
        return cv;
      }
      if (headStr && this.isHtmlTag(headStr) && !meta(head, "text")) {
        let [tagName, id] = headStr.split("#");
        return this.generateTag(tagName || "div", [], rest, id);
      }
      if (headStr === ".") {
        const [, obj, prop] = sexpr;
        if (obj === "this" && typeof prop === "string") {
          const s = this._self;
          if (this.reactiveMembers && this.reactiveMembers.has(prop)) {
            const textVar3 = this.newTextVar();
            this._createLines.push(`${textVar3} = document.createTextNode('');`);
            this._pushEffect(`${textVar3}.data = ${s}.${prop}.value;`);
            return textVar3;
          }
          const slotVar = this.newElementVar("slot");
          this._createLines.push(`${slotVar} = ${s}.${prop} instanceof Node ? ${s}.${prop} : (${s}.${prop} != null ? document.createTextNode(String(${s}.${prop})) : document.createComment(''));`);
          return slotVar;
        }
        const { tag, classes, id, base } = this.collectTemplateClasses(sexpr);
        if (!meta(base, "text") && tag && this.isHtmlTag(tag)) {
          return this.generateTag(tag, classes, [], id);
        }
        const textVar2 = this.newTextVar();
        const exprCode2 = this.generateInComponent(sexpr, "value");
        this._createLines.push(`${textVar2} = document.createTextNode(String(${exprCode2}));`);
        return textVar2;
      }
      if (Array.isArray(head)) {
        if (Array.isArray(head[0]) && head[0][0] === "." && (head[0][2] === "__clsx" || head[0][2] instanceof String && head[0][2].valueOf() === "__clsx")) {
          const tagExpr = head[0][1];
          const classExprs = head.slice(1);
          if (Array.isArray(tagExpr)) {
            const { tag: tag3, classes: classes2, id: id2 } = this.collectTemplateClasses(tagExpr);
            if (tag3) {
              const staticArgs = classes2.map((c) => `"${c}"`);
              return this.generateDynamicTag(tag3, classExprs, rest, staticArgs, id2);
            }
          }
          const tag2 = typeof tagExpr === "string" ? tagExpr : tagExpr.valueOf();
          return this.generateDynamicTag(tag2, classExprs, rest);
        }
        const { tag, classes, id } = this.collectTemplateClasses(head);
        if (tag && this.isHtmlTag(tag)) {
          if (classes.length > 0 && classes[classes.length - 1] === "__clsx") {
            const staticClasses = classes.slice(0, -1);
            const staticArgs = staticClasses.map((c) => `"${c}"`);
            return this.generateDynamicTag(tag, rest, [], staticArgs, id);
          }
          return this.generateTag(tag, classes, rest, id);
        }
      }
      if (headStr === "->" || headStr === "=>") {
        return this.generateTemplateBlock(rest[1]);
      }
      if (headStr === "if") {
        return this.generateConditional(sexpr);
      }
      if (headStr === "for" || headStr === "for-in" || headStr === "for-of" || headStr === "for-as") {
        return this.generateTemplateLoop(sexpr);
      }
      if (headStr === "__text__") {
        const expr = rest[0] ?? "undefined";
        const textVar2 = this.newTextVar();
        const exprCode2 = this.generateInComponent(expr, "value");
        if (this.hasReactiveDeps(expr)) {
          this._createLines.push(`${textVar2} = document.createTextNode('');`);
          this._pushEffect(`${textVar2}.data = String(${exprCode2});`);
        } else {
          this._createLines.push(`${textVar2} = document.createTextNode(String(${exprCode2}));`);
        }
        return textVar2;
      }
      const textVar = this.newTextVar();
      const exprCode = this.generateInComponent(sexpr, "value");
      if (this.hasReactiveDeps(sexpr)) {
        this._createLines.push(`${textVar} = document.createTextNode('');`);
        this._pushEffect(`${textVar}.data = ${exprCode};`);
      } else {
        this._createLines.push(`${textVar} = document.createTextNode(String(${exprCode}));`);
      }
      return textVar;
    };
    proto.appendChildren = function(elVar, args) {
      for (const arg of args) {
        if (this.is(arg, "->") || this.is(arg, "=>")) {
          const block = arg[2];
          if (this.is(block, "block")) {
            for (const child of block.slice(1)) {
              if (this.is(child, "object")) {
                this.generateAttributes(elVar, child);
              } else {
                const childVar = this.generateNode(child);
                this._createLines.push(`${elVar}.appendChild(${childVar});`);
              }
            }
          } else if (block) {
            const childVar = this.generateNode(block);
            this._createLines.push(`${elVar}.appendChild(${childVar});`);
          }
        } else if (this.is(arg, "object")) {
          this.generateAttributes(elVar, arg);
        } else if (typeof arg === "string" || arg instanceof String) {
          const val = arg.valueOf();
          const baseName = val.split(/[#.]/)[0];
          if (this.isHtmlTag(baseName || "div") || this.isComponent(baseName)) {
            const childVar = this.generateNode(arg);
            this._createLines.push(`${elVar}.appendChild(${childVar});`);
          } else {
            const textVar = this.newTextVar();
            if (val.startsWith('"') || val.startsWith("'") || val.startsWith("`")) {
              this._createLines.push(`${textVar} = document.createTextNode(${val});`);
            } else if (this.reactiveMembers && this.reactiveMembers.has(val)) {
              this._createLines.push(`${textVar} = document.createTextNode('');`);
              this._pushEffect(`${textVar}.data = ${this._self}.${val}.value;`);
            } else if (this.componentMembers && this.componentMembers.has(val)) {
              this._createLines.push(`${textVar} = document.createTextNode(String(${this._self}.${val}));`);
            } else {
              this._createLines.push(`${textVar} = document.createTextNode(${this.generateInComponent(arg, "value")});`);
            }
            this._createLines.push(`${elVar}.appendChild(${textVar});`);
          }
        } else if (arg) {
          const childVar = this.generateNode(arg);
          this._createLines.push(`${elVar}.appendChild(${childVar});`);
        }
      }
    };
    proto._claimAutoWire = function(elVar) {
      if (!this._pendingAutoWire || !this._autoEventHandlers?.size)
        return false;
      this._pendingAutoWire = false;
      this._autoWireEl = elVar;
      this._autoWireExplicit = new Set;
      return true;
    };
    proto._emitAutoWire = function(elVar, claimed) {
      if (!claimed)
        return;
      for (const [eventName, methodName] of this._autoEventHandlers) {
        if (!this._autoWireExplicit.has(eventName)) {
          this._createLines.push(`${elVar}.addEventListener('${eventName}', (e) => __batch(() => ${this._self}.${methodName}(e)));`);
        }
      }
      this._autoWireEl = null;
      this._autoWireExplicit = null;
    };
    proto._bindInheritedTarget = function(tag, elVar) {
      if (!this._inheritsTag || this._factoryMode || this._inheritsTargetBound)
        return;
      if (tag !== this._inheritsTag)
        return;
      this._inheritsTargetBound = true;
      this._createLines.push(`this._inheritedEl = ${elVar};`);
      this._createLines.push("this._applyRestToInheritedEl();");
    };
    proto.generateTag = function(tag, classes, args, id) {
      const elVar = this.newElementVar();
      const isSvg = SVG_TAGS.has(tag) || this._svgDepth > 0;
      if (isSvg) {
        this._createLines.push(`${elVar} = document.createElementNS('${SVG_NS}', '${tag}');`);
      } else {
        this._createLines.push(`${elVar} = document.createElement('${tag}');`);
      }
      if (id) {
        this._createLines.push(`${elVar}.id = '${id}';`);
      }
      this._bindInheritedTarget(tag, elVar);
      if (this._componentName && this._elementCount === 1 && !this._factoryMode && !this.options.skipDataPart) {
        this._createLines.push(`${elVar}.setAttribute('data-part', '${this._componentName}');`);
      }
      const autoWireClaimed = this._claimAutoWire(elVar);
      const prevClassArgs = this._pendingClassArgs;
      const prevClassEl = this._pendingClassEl;
      if (classes.length > 0) {
        this._pendingClassArgs = [`'${classes.join(" ")}'`];
        this._pendingClassEl = elVar;
      }
      if (tag === "svg")
        this._svgDepth = (this._svgDepth || 0) + 1;
      this.appendChildren(elVar, args);
      if (tag === "svg")
        this._svgDepth--;
      if (classes.length > 0) {
        if (this._pendingClassArgs.length === 1) {
          if (isSvg) {
            this._createLines.push(`${elVar}.setAttribute('class', '${classes.join(" ")}');`);
          } else {
            this._createLines.push(`${elVar}.className = '${classes.join(" ")}';`);
          }
        } else {
          const combined = this._pendingClassArgs.join(", ");
          if (isSvg) {
            this._pushEffect(`${elVar}.setAttribute('class', __clsx(${combined}));`);
          } else {
            this._pushEffect(`${elVar}.className = __clsx(${combined});`);
          }
        }
        this._pendingClassArgs = prevClassArgs;
        this._pendingClassEl = prevClassEl;
      }
      this._emitAutoWire(elVar, autoWireClaimed);
      return elVar;
    };
    proto.generateDynamicTag = function(tag, classExprs, children, staticClassArgs, id) {
      const elVar = this.newElementVar();
      if (SVG_TAGS.has(tag) || this._svgDepth > 0) {
        this._createLines.push(`${elVar} = document.createElementNS('${SVG_NS}', '${tag}');`);
      } else {
        this._createLines.push(`${elVar} = document.createElement('${tag}');`);
      }
      if (id)
        this._createLines.push(`${elVar}.id = '${id}';`);
      this._bindInheritedTarget(tag, elVar);
      const autoWireClaimed = this._claimAutoWire(elVar);
      const classArgs = [...staticClassArgs || [], ...classExprs.map((e) => this.generateInComponent(e, "value"))];
      const prevClassArgs = this._pendingClassArgs;
      const prevClassEl = this._pendingClassEl;
      this._pendingClassArgs = classArgs;
      this._pendingClassEl = elVar;
      if (tag === "svg")
        this._svgDepth = (this._svgDepth || 0) + 1;
      this.appendChildren(elVar, children);
      if (tag === "svg")
        this._svgDepth--;
      if (this._pendingClassArgs.length > 0) {
        const combined = this._pendingClassArgs.join(", ");
        const isSvg = SVG_TAGS.has(tag) || this._svgDepth > 0;
        if (isSvg) {
          this._pushEffect(`${elVar}.setAttribute('class', __clsx(${combined}));`);
        } else {
          this._pushEffect(`${elVar}.className = __clsx(${combined});`);
        }
      }
      this._pendingClassArgs = prevClassArgs;
      this._pendingClassEl = prevClassEl;
      this._emitAutoWire(elVar, autoWireClaimed);
      return elVar;
    };
    proto.generateAttributes = function(elVar, objExpr) {
      const inputType = extractInputType(objExpr.slice(1));
      for (let i = 1;i < objExpr.length; i++) {
        let [, key, value] = objExpr[i];
        if (this.is(key, ".") && key[1] === "this") {
          const eventName = key[2];
          if (this._autoWireExplicit && this._autoWireEl === elVar) {
            this._autoWireExplicit.add(eventName);
          }
          if (typeof value === "string" && this.componentMembers?.has(value)) {
            this._createLines.push(`${elVar}.addEventListener('${eventName}', (e) => __batch(() => ${this._self}.${value}(e)));`);
          } else {
            const handlerCode = this.generateInComponent(value, "value");
            this._createLines.push(`${elVar}.addEventListener('${eventName}', (e) => __batch(() => (${handlerCode})(e)));`);
          }
          continue;
        }
        if (typeof key === "string" || key instanceof String) {
          if (key.startsWith('"') && key.endsWith('"')) {
            key = key.slice(1, -1);
          }
          if (key === "class" || key === "className") {
            const valueCode2 = this.generateInComponent(value, "value");
            if (this._pendingClassArgs && this._pendingClassEl === elVar) {
              this._pendingClassArgs.push(valueCode2);
            } else if (this.hasReactiveDeps(value)) {
              if (this._svgDepth > 0) {
                this._pushEffect(`${elVar}.setAttribute('class', __clsx(${valueCode2}));`);
              } else {
                this._pushEffect(`${elVar}.className = __clsx(${valueCode2});`);
              }
            } else {
              if (this._svgDepth > 0) {
                this._createLines.push(`${elVar}.setAttribute('class', ${valueCode2});`);
              } else {
                this._createLines.push(`${elVar}.className = ${valueCode2};`);
              }
            }
            continue;
          }
          if (key === "__transition__") {
            const transName = String(value).replace(/^["']|["']$/g, "");
            this._createLines.push(`this._t = "${transName}";`);
            continue;
          }
          if (key === "ref") {
            const refName = String(value).replace(/^["']|["']$/g, "");
            this._createLines.push(`${this._self}.${refName} = ${elVar};`);
            continue;
          }
          if (key.startsWith(BIND_PREFIX) && key.endsWith(BIND_SUFFIX)) {
            const prop = key.slice(BIND_PREFIX.length, -BIND_SUFFIX.length);
            const valueCode2 = this.generateInComponent(value, "value");
            let event, valueAccessor;
            if (prop === "checked") {
              event = "change";
              valueAccessor = "e.target.checked";
            } else {
              event = "input";
              valueAccessor = inputType === "number" || inputType === "range" ? "e.target.valueAsNumber" : "e.target.value";
            }
            this._pushEffect(`${elVar}.${prop} = ${valueCode2};`);
            let assignCode = `${valueCode2} = ${valueAccessor}`;
            const rootMember = !this.isSimpleAssignable(value) && this.findRootReactiveMember(value);
            if (rootMember) {
              assignCode += `; ${this._self}.${rootMember}.touch?.()`;
            }
            this._createLines.push(`${elVar}.addEventListener('${event}', (e) => { ${assignCode}; });`);
            continue;
          }
          const valueCode = this.generateInComponent(value, "value");
          if ((key === "value" || key === "checked") && this.hasReactiveDeps(value)) {
            this._pushEffect(`${elVar}.${key} = ${valueCode};`);
            continue;
          }
          if (key === "innerHTML" || key === "textContent" || key === "innerText") {
            if (this.hasReactiveDeps(value)) {
              this._pushEffect(`${elVar}.${key} = ${valueCode};`);
            } else {
              this._createLines.push(`${elVar}.${key} = ${valueCode};`);
            }
          } else if (BOOLEAN_ATTRS.has(key)) {
            if (this.hasReactiveDeps(value)) {
              this._pushEffect(`${elVar}.toggleAttribute('${key}', !!${valueCode});`);
            } else {
              this._createLines.push(`if (${valueCode}) ${elVar}.setAttribute('${key}', '');`);
            }
          } else if (this.hasReactiveDeps(value)) {
            if (Array.isArray(value) && value[0] === "presence") {
              this._pushEffect(`{ const __v = ${valueCode}; __v == null ? ${elVar}.removeAttribute('${key}') : ${elVar}.setAttribute('${key}', __v); }`);
            } else {
              this._pushEffect(`${elVar}.setAttribute('${key}', ${valueCode});`);
            }
          } else {
            if (Array.isArray(value) && value[0] === "presence") {
              this._createLines.push(`{ const __v = ${valueCode}; if (__v != null) ${elVar}.setAttribute('${key}', __v); }`);
            } else {
              this._createLines.push(`${elVar}.setAttribute('${key}', ${valueCode});`);
            }
          }
        }
      }
    };
    proto.generateTemplateBlock = function(body) {
      if (!Array.isArray(body) || body[0] !== "block") {
        return this.generateNode(body);
      }
      const statements = body.slice(1);
      if (statements.length === 0) {
        const commentVar = this.newElementVar("empty");
        this._createLines.push(`${commentVar} = document.createComment('');`);
        return commentVar;
      }
      if (statements.length === 1) {
        return this.generateNode(statements[0]);
      }
      const fragVar = this.newElementVar("frag");
      this._createLines.push(`${fragVar} = document.createDocumentFragment();`);
      const children = [];
      for (const stmt of statements) {
        const childVar = this.generateNode(stmt);
        this._createLines.push(`${fragVar}.appendChild(${childVar});`);
        children.push(childVar);
      }
      this._fragChildren.set(fragVar, children);
      return fragVar;
    };
    proto.generateConditional = function(sexpr) {
      this._pendingAutoWire = false;
      const [, condition, thenBlock, elseBlock] = sexpr;
      const anchorVar = this.newElementVar("anchor");
      this._createLines.push(`${anchorVar} = document.createComment('if');`);
      const condCode = this.generateInComponent(condition, "value");
      const outerParams = this._loopVarStack.map((v) => `${v.itemVar}, ${v.indexVar}`).join(", ");
      const outerExtra = outerParams ? `, ${outerParams}` : "";
      const thenBlockName = this.newBlockVar();
      this.generateConditionBranch(thenBlockName, thenBlock);
      let elseBlockName = null;
      if (elseBlock) {
        elseBlockName = this.newBlockVar();
        this.generateConditionBranch(elseBlockName, elseBlock);
      }
      const setupLines = [];
      setupLines.push(`// Conditional: ${thenBlockName}${elseBlockName ? " / " + elseBlockName : ""}`);
      setupLines.push(`{`);
      setupLines.push(`  const anchor = ${anchorVar};`);
      setupLines.push(`  let currentBlock = null;`);
      setupLines.push(`  let showing = null;`);
      const effOpen = this._factoryMode ? "disposers.push(__effect(() => {" : "__effect(() => {";
      const effClose = this._factoryMode ? "}));" : "});";
      setupLines.push(`  ${effOpen}`);
      setupLines.push(`    const show = !!(${condCode});`);
      setupLines.push(`    const want = show ? 'then' : ${elseBlock ? "'else'" : "null"};`);
      setupLines.push(`    if (want === showing) return;`);
      setupLines.push(``);
      setupLines.push(`    if (currentBlock) {`);
      setupLines.push(`      const leaving = currentBlock;`);
      setupLines.push(`      if (leaving._t) { __transition(leaving._first, leaving._t, 'leave', () => leaving.d(true)); }`);
      setupLines.push(`      else { leaving.d(true); }`);
      setupLines.push(`      currentBlock = null;`);
      setupLines.push(`    }`);
      setupLines.push(`    showing = want;`);
      setupLines.push(``);
      setupLines.push(`    if (want === 'then') {`);
      setupLines.push(`      currentBlock = ${thenBlockName}(${this._self}${outerExtra});`);
      setupLines.push(`      currentBlock.c();`);
      setupLines.push(`      if (anchor.parentNode) currentBlock.m(anchor.parentNode, anchor.nextSibling);`);
      setupLines.push(`      currentBlock.p(${this._self}${outerExtra});`);
      setupLines.push(`      if (currentBlock._t) __transition(currentBlock._first, currentBlock._t, 'enter');`);
      setupLines.push(`    }`);
      if (elseBlock) {
        setupLines.push(`    if (want === 'else') {`);
        setupLines.push(`      currentBlock = ${elseBlockName}(${this._self}${outerExtra});`);
        setupLines.push(`      currentBlock.c();`);
        setupLines.push(`      if (anchor.parentNode) currentBlock.m(anchor.parentNode, anchor.nextSibling);`);
        setupLines.push(`      currentBlock.p(${this._self}${outerExtra});`);
        setupLines.push(`      if (currentBlock._t) __transition(currentBlock._first, currentBlock._t, 'enter');`);
        setupLines.push(`    }`);
      }
      setupLines.push(`  ${effClose}`);
      setupLines.push(`}`);
      this._setupLines.push(setupLines.join(`
    `));
      return anchorVar;
    };
    proto.generateConditionBranch = function(blockName, block) {
      const saved = [this._createLines, this._setupLines, this._factoryMode, this._factoryVars];
      this._createLines = [];
      this._setupLines = [];
      this._factoryMode = true;
      this._factoryVars = new Set;
      const rootVar = this.generateTemplateBlock(block);
      const createLines = this._createLines;
      const setupLines = this._setupLines;
      const factoryVars = this._factoryVars;
      [this._createLines, this._setupLines, this._factoryMode, this._factoryVars] = saved;
      const outerParams = this._loopVarStack.map((v) => `${v.itemVar}, ${v.indexVar}`).join(", ");
      const extraParams = outerParams ? `, ${outerParams}` : "";
      this.emitBlockFactory(blockName, `ctx${extraParams}`, rootVar, createLines, setupLines, factoryVars);
    };
    proto.emitBlockFactory = function(blockName, params, rootVar, createLines, setupLines, factoryVars, isStatic) {
      const factoryLines = [];
      factoryLines.push(`function ${blockName}(${params}) {`);
      if (factoryVars.size > 0) {
        factoryLines.push(`  let ${[...factoryVars].join(", ")};`);
      }
      const hasEffects = setupLines.length > 0;
      if (hasEffects) {
        factoryLines.push(`  let disposers = [];`);
      }
      factoryLines.push(`  return {`);
      if (isStatic) {
        factoryLines.push(`    _s: true,`);
      }
      const fragChildren = this._fragChildren.get(rootVar);
      const firstNode = fragChildren ? fragChildren[0] : rootVar;
      factoryLines.push(`    c() {`);
      for (const line of createLines) {
        factoryLines.push(`      ${line}`);
      }
      factoryLines.push(`      this._first = ${firstNode};`);
      factoryLines.push(`    },`);
      factoryLines.push(`    m(target, anchor) {`);
      if (fragChildren) {
        for (const child of fragChildren) {
          factoryLines.push(`      if (target) target.insertBefore(${child}, anchor);`);
        }
      } else {
        factoryLines.push(`      if (target) target.insertBefore(${rootVar}, anchor);`);
      }
      factoryLines.push(`    },`);
      factoryLines.push(`    p(${params}) {`);
      if (hasEffects) {
        factoryLines.push(`      disposers.forEach(d => d());`);
        factoryLines.push(`      disposers = [];`);
        for (const line of setupLines) {
          factoryLines.push(`      ${line}`);
        }
      }
      factoryLines.push(`    },`);
      factoryLines.push(`    d(detaching) {`);
      if (hasEffects) {
        factoryLines.push(`      disposers.forEach(d => d());`);
      }
      if (fragChildren) {
        for (const child of fragChildren) {
          factoryLines.push(`      if (detaching && ${child}) ${child}.remove();`);
        }
      } else {
        factoryLines.push(`      if (detaching && ${rootVar}) ${rootVar}.remove();`);
      }
      factoryLines.push(`    }`);
      factoryLines.push(`  };`);
      factoryLines.push(`}`);
      this._blockFactories.push(factoryLines.join(`
`));
    };
    proto.generateTemplateLoop = function(sexpr) {
      this._pendingAutoWire = false;
      const [head, vars, collection, guard, step, body] = sexpr;
      const blockName = this.newBlockVar();
      const anchorVar = this.newElementVar("anchor");
      this._createLines.push(`${anchorVar} = document.createComment('for');`);
      const varNames = Array.isArray(vars) ? vars : [vars];
      const itemVar = varNames[0];
      let indexVar = varNames[1] || null;
      if (!indexVar) {
        const usedNames = new Set(this._loopVarStack.flatMap((v) => [v.itemVar, v.indexVar]));
        usedNames.add(itemVar);
        for (const candidate of ["i", "j", "k", "l", "m", "n"]) {
          if (!usedNames.has(candidate)) {
            indexVar = candidate;
            break;
          }
        }
        indexVar = indexVar || `_i${this._loopVarStack.length}`;
      }
      const collectionCode = this.generateInComponent(collection, "value");
      let keyExpr = itemVar;
      if (this.is(body, "block") && body.length > 1) {
        const firstChild = body[1];
        if (Array.isArray(firstChild)) {
          for (const arg of firstChild) {
            if (this.is(arg, "object")) {
              for (let i = 1;i < arg.length; i++) {
                const [k, v] = arg[i];
                if (k === "key") {
                  keyExpr = this.generate(v, "value");
                  break;
                }
              }
            }
            if (keyExpr !== itemVar)
              break;
          }
        }
      }
      const saved = [this._createLines, this._setupLines, this._factoryMode, this._factoryVars];
      this._createLines = [];
      this._setupLines = [];
      this._factoryMode = true;
      this._factoryVars = new Set;
      const outerParams = this._loopVarStack.map((v) => `${v.itemVar}, ${v.indexVar}`).join(", ");
      const outerExtra = outerParams ? `, ${outerParams}` : "";
      this._loopVarStack.push({ itemVar, indexVar });
      const itemNode = this.generateTemplateBlock(body);
      this._loopVarStack.pop();
      const itemCreateLines = this._createLines;
      const itemSetupLines = this._setupLines;
      const itemFactoryVars = this._factoryVars;
      [this._createLines, this._setupLines, this._factoryMode, this._factoryVars] = saved;
      const isStatic = itemSetupLines.length === 0;
      const loopParams = `ctx, ${itemVar}, ${indexVar}${outerExtra}`;
      this.emitBlockFactory(blockName, loopParams, itemNode, itemCreateLines, itemSetupLines, itemFactoryVars, isStatic);
      const hasCustomKey = keyExpr !== itemVar;
      const keyFnCode = hasCustomKey ? `(${itemVar}, ${indexVar}) => ${keyExpr}` : "null";
      const outerArgs = outerParams ? `, ${outerParams}` : "";
      const setupLines = [];
      setupLines.push(`// Loop: ${blockName}`);
      setupLines.push(`{`);
      setupLines.push(`  const __s = { blocks: [], keys: [] };`);
      const effOpen = this._factoryMode ? "disposers.push(__effect(() => {" : "__effect(() => {";
      const effClose = this._factoryMode ? "}));" : "});";
      setupLines.push(`  ${effOpen}`);
      setupLines.push(`    __reconcile(${anchorVar}, __s, ${collectionCode}, ${this._self}, ${blockName}, ${keyFnCode}${outerArgs});`);
      setupLines.push(`  ${effClose}`);
      setupLines.push(`}`);
      this._setupLines.push(setupLines.join(`
    `));
      return anchorVar;
    };
    proto.generateChildComponent = function(componentName, args) {
      this._pendingAutoWire = false;
      const instVar = this.newElementVar("inst");
      const elVar = this.newElementVar("el");
      const { propsCode, reactiveProps, eventBindings, childrenSetupLines } = this.buildComponentProps(args);
      const s = this._self;
      this._createLines.push(`{ const __prev = __pushComponent(${s}); try {`);
      this._createLines.push(`${instVar} = new ${componentName}(${propsCode});`);
      this._createLines.push(`${elVar} = ${instVar}._root = ${instVar}._create();`);
      this._createLines.push(`(${s}._children || (${s}._children = [])).push(${instVar});`);
      this._createLines.push(`} finally { __popComponent(__prev); } }`);
      for (const { event, value } of eventBindings) {
        const handlerCode = this.generateInComponent(value, "value");
        this._createLines.push(`${elVar}.addEventListener('${event}', (e) => __batch(() => (${handlerCode})(e)));`);
      }
      this._setupLines.push(`try { if (${instVar}._setup) ${instVar}._setup(); if (${instVar}.mounted) ${instVar}.mounted(); } catch (__e) { __handleComponentError(__e, ${instVar}); }`);
      for (const { key, valueCode } of reactiveProps) {
        this._pushEffect(`if (${instVar}.${key} && typeof ${instVar}.${key} === 'object' && 'value' in ${instVar}.${key}) ${instVar}.${key}.value = ${valueCode}; else if (${instVar}._setRestProp) ${instVar}._setRestProp('${key}', ${valueCode});`);
      }
      for (const line of childrenSetupLines) {
        this._setupLines.push(line);
      }
      return elVar;
    };
    proto.buildComponentProps = function(args) {
      const props = [];
      const reactiveProps = [];
      const eventBindings = [];
      let childrenVar = null;
      const childrenSetupLines = [];
      const addProp = (key, value) => {
        if (key.startsWith("@")) {
          eventBindings.push({ event: key.slice(1).split(".")[0], value });
          return;
        }
        const isDirectSignal = this.reactiveMembers && (typeof value === "string" && this.reactiveMembers.has(value) || Array.isArray(value) && value[0] === "." && value[1] === "this" && typeof value[2] === "string" && this.reactiveMembers.has(value[2]));
        if (isDirectSignal) {
          const member = typeof value === "string" ? value : value[2];
          props.push(`${key}: ${this._self}.${member}`);
        } else {
          const valueCode = this.generateInComponent(value, "value");
          props.push(`${key}: ${valueCode}`);
          if (this.hasReactiveDeps(value)) {
            reactiveProps.push({ key, valueCode });
          }
        }
      };
      const addObjectProps = (objExpr) => {
        for (let i = 1;i < objExpr.length; i++) {
          const [, key, value] = objExpr[i];
          if (typeof key === "string") {
            addProp(key, value);
          } else if (Array.isArray(key) && key[0] === "." && key[1] === "this" && typeof key[2] === "string") {
            eventBindings.push({ event: key[2], value });
          }
        }
      };
      for (const arg of args) {
        if (this.is(arg, "object")) {
          addObjectProps(arg);
        } else if (Array.isArray(arg) && (arg[0] === "->" || arg[0] === "=>")) {
          let block = arg[2];
          if (block) {
            if (this.is(block, "block")) {
              const domChildren = [];
              for (const child of block.slice(1)) {
                if (this.is(child, "object")) {
                  addObjectProps(child);
                } else {
                  domChildren.push(child);
                }
              }
              block = domChildren.length > 0 ? ["block", ...domChildren] : null;
            }
            if (block) {
              const savedCreateLines = this._createLines;
              const savedSetupLines = this._setupLines;
              this._createLines = [];
              this._setupLines = [];
              childrenVar = this.generateTemplateBlock(block);
              const childCreateLines = this._createLines;
              const childSetupLinesCopy = this._setupLines;
              this._createLines = savedCreateLines;
              this._setupLines = savedSetupLines;
              for (const line of childCreateLines) {
                this._createLines.push(line);
              }
              childrenSetupLines.push(...childSetupLinesCopy);
              props.push(`children: ${childrenVar}`);
            }
          }
        } else if (arg && !childrenVar) {
          const textVar = this.newTextVar();
          const exprCode = this.generateInComponent(arg, "value");
          if (this.hasReactiveDeps(arg)) {
            this._createLines.push(`${textVar} = document.createTextNode('');`);
            const body = `${textVar}.data = ${exprCode};`;
            const effect = this._factoryMode ? `disposers.push(__effect(() => { ${body} }));` : `__effect(() => { ${body} });`;
            childrenSetupLines.push(effect);
          } else {
            this._createLines.push(`${textVar} = document.createTextNode(${exprCode});`);
          }
          childrenVar = textVar;
          props.push(`children: ${childrenVar}`);
        }
      }
      const propsCode = props.length > 0 ? `{ ${props.join(", ")} }` : "{}";
      return { propsCode, reactiveProps, eventBindings, childrenSetupLines };
    };
    proto.hasReactiveDeps = function(sexpr) {
      if (typeof sexpr === "string") {
        return !!(this.reactiveMembers && this.reactiveMembers.has(sexpr));
      }
      if (!Array.isArray(sexpr))
        return false;
      if (sexpr[0] === "." && sexpr[1] === "this" && typeof sexpr[2] === "string") {
        return !!(this.reactiveMembers && this.reactiveMembers.has(sexpr[2]));
      }
      if (sexpr[0] === "." && this._rootsAtThis(sexpr[1])) {
        return true;
      }
      if (Array.isArray(sexpr[0]) && sexpr[0][0] === "." && sexpr[0][1] === "this") {
        const name = _str(sexpr[0][2]);
        if (name && this.componentMembers?.has(name))
          return true;
      }
      for (const child of sexpr) {
        if (this.hasReactiveDeps(child))
          return true;
      }
      return false;
    };
    proto.isSimpleAssignable = function(sexpr) {
      if (typeof sexpr === "string") {
        return !!(this.reactiveMembers && this.reactiveMembers.has(sexpr));
      }
      if (Array.isArray(sexpr) && sexpr[0] === "." && sexpr[1] === "this" && typeof sexpr[2] === "string") {
        return !!(this.reactiveMembers && this.reactiveMembers.has(sexpr[2]));
      }
      return false;
    };
    proto.findRootReactiveMember = function(sexpr) {
      if (typeof sexpr === "string") {
        return this.reactiveMembers?.has(sexpr) ? sexpr : null;
      }
      if (!Array.isArray(sexpr))
        return null;
      if (sexpr[0] === "." && sexpr[1] === "this" && typeof sexpr[2] === "string") {
        return this.reactiveMembers?.has(sexpr[2]) ? sexpr[2] : null;
      }
      if (sexpr[0] === "." || sexpr[0] === "[]") {
        return this.findRootReactiveMember(sexpr[1]);
      }
      return null;
    };
    proto._rootsAtThis = function(sexpr) {
      if (typeof sexpr === "string")
        return sexpr === "this";
      if (!Array.isArray(sexpr) || sexpr[0] !== ".")
        return false;
      return this._rootsAtThis(sexpr[1]);
    };
    proto.getComponentRuntime = function() {
      return `
// ============================================================================
// Rip Component Runtime
// ============================================================================

let __currentComponent = null;

function __pushComponent(component) {
  component._parent = __currentComponent;
  const prev = __currentComponent;
  __currentComponent = component;
  return prev;
}

function __popComponent(prev) {
  __currentComponent = prev;
}

function setContext(key, value) {
  if (!__currentComponent) throw new Error('setContext must be called during component initialization');
  if (!__currentComponent._context) __currentComponent._context = new Map();
  __currentComponent._context.set(key, value);
}

function getContext(key) {
  let component = __currentComponent;
  while (component) {
    if (component._context && component._context.has(key)) return component._context.get(key);
    component = component._parent;
  }
  return undefined;
}

function hasContext(key) {
  let component = __currentComponent;
  while (component) {
    if (component._context && component._context.has(key)) return true;
    component = component._parent;
  }
  return false;
}

function __clsx(...args) {
  let out = '';
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === 'string') { out && (out += ' '); out += arg; }
    else if (typeof arg === 'object') {
      if (Array.isArray(arg)) { const v = __clsx(...arg); v && (out && (out += ' '), out += v); }
      else for (const k in arg) if (arg[k]) { out && (out += ' '); out += k; }
    }
  }
  return out;
}

function __lis(arr) {
  const n = arr.length;
  if (n === 0) return [];
  const tails = [], indices = [], prev = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (arr[i] === -1) continue;
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < arr[i]) lo = mid + 1; else hi = mid;
    }
    tails[lo] = arr[i];
    indices[lo] = i;
    if (lo > 0) prev[i] = indices[lo - 1];
  }
  const result = [];
  let k = indices[tails.length - 1];
  for (let i = tails.length - 1; i >= 0; i--) { result.push(k); k = prev[k]; }
  result.reverse();
  return result;
}

function __reconcile(anchor, state, items, ctx, factory, keyFn, ...outer) {
  const parent = anchor.parentNode;
  if (!parent) return;

  const oldKeys = state.keys;
  const oldBlocks = state.blocks;
  const oldLen = oldKeys.length;
  const newLen = items.length;
  const newBlocks = new Array(newLen);
  const hasKeyFn = keyFn != null;
  const newKeys = hasKeyFn ? items.map((item, i) => keyFn(item, i)) : items;

  // Phase 0: first render — batch create via DocumentFragment
  if (oldLen === 0) {
    if (newLen > 0) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < newLen; i++) {
        const block = factory(ctx, items[i], i, ...outer);
        block.c();
        block.m(frag, null);
        if (!block._s) block.p(ctx, items[i], i, ...outer);
        newBlocks[i] = block;
      }
      parent.insertBefore(frag, anchor);
    }
    state.keys = hasKeyFn ? newKeys : items.slice();
    state.blocks = newBlocks;
    return;
  }

  // Phase 1: prefix scan — skip p() (item+index identical, effects already live)
  let start = 0;
  const minLen = oldLen < newLen ? oldLen : newLen;
  while (start < minLen && oldKeys[start] === newKeys[start]) {
    newBlocks[start] = oldBlocks[start];
    start++;
  }

  // Phase 2: suffix scan — call p() (index may differ)
  let oldEnd = oldLen - 1;
  let newEnd = newLen - 1;
  while (oldEnd >= start && newEnd >= start && oldKeys[oldEnd] === newKeys[newEnd]) {
    const block = oldBlocks[oldEnd];
    if (!block._s) block.p(ctx, items[newEnd], newEnd, ...outer);
    newBlocks[newEnd] = block;
    oldEnd--;
    newEnd--;
  }

  // Remove old blocks in the middle that aren't in the new set
  if (start > newEnd) {
    for (let i = start; i <= oldEnd; i++) oldBlocks[i].d(true);
  } else if (start > oldEnd) {
    // Phase 3a: pure insertion — batch via DocumentFragment
    const next = newEnd + 1 < newLen ? newBlocks[newEnd + 1]._first : anchor;
    const frag = document.createDocumentFragment();
    for (let i = start; i <= newEnd; i++) {
      const block = factory(ctx, items[i], i, ...outer);
      block.c();
      block.m(frag, null);
      if (!block._s) block.p(ctx, items[i], i, ...outer);
      newBlocks[i] = block;
    }
    parent.insertBefore(frag, next);
  } else {
    // Phase 4: general case — temp Map + LIS
    const oldKeyIdx = new Map();
    for (let i = start; i <= oldEnd; i++) oldKeyIdx.set(oldKeys[i], i);

    const seq = new Array(newEnd - start + 1);
    for (let i = start; i <= newEnd; i++) {
      const key = newKeys[i];
      const oldIdx = oldKeyIdx.get(key);
      if (oldIdx !== undefined) {
        seq[i - start] = oldIdx - start;
        const block = oldBlocks[oldIdx];
        if (!block._s) block.p(ctx, items[i], i, ...outer);
        newBlocks[i] = block;
        oldKeyIdx.delete(key);
      } else {
        seq[i - start] = -1;
        const block = factory(ctx, items[i], i, ...outer);
        block.c();
        if (!block._s) block.p(ctx, items[i], i, ...outer);
        newBlocks[i] = block;
      }
    }

    for (const idx of oldKeyIdx.values()) oldBlocks[idx].d(true);

    const lis = __lis(seq);
    const lisSet = new Set(lis);
    let next = newEnd + 1 < newLen ? newBlocks[newEnd + 1]._first : anchor;
    for (let i = newEnd; i >= start; i--) {
      const block = newBlocks[i];
      if (!lisSet.has(i - start)) {
        block.m(parent, next);
      }
      next = block._first;
    }
  }

  state.keys = hasKeyFn ? newKeys : items.slice();
  state.blocks = newBlocks;
}

let __cssInjected = false;
function __transitionCSS() {
  if (__cssInjected) return;
  __cssInjected = true;
  const s = document.createElement('style');
  s.textContent = [
    '.fade-enter-active,.fade-leave-active{transition:opacity .2s ease}',
    '.fade-enter-from,.fade-leave-to{opacity:0}',
    '.slide-enter-active,.slide-leave-active{transition:opacity .2s ease,transform .2s ease}',
    '.slide-enter-from{opacity:0;transform:translateY(-8px)}',
    '.slide-leave-to{opacity:0;transform:translateY(8px)}',
    '.scale-enter-active,.scale-leave-active{transition:opacity .2s ease,transform .2s ease}',
    '.scale-enter-from,.scale-leave-to{opacity:0;transform:scale(.95)}',
    '.blur-enter-active,.blur-leave-active{transition:opacity .2s ease,filter .2s ease}',
    '.blur-enter-from,.blur-leave-to{opacity:0;filter:blur(4px)}',
    '.fly-enter-active,.fly-leave-active{transition:opacity .2s ease,transform .2s ease}',
    '.fly-enter-from{opacity:0;transform:translateY(-20px)}',
    '.fly-leave-to{opacity:0;transform:translateY(20px)}',
  ].join('');
  document.head.appendChild(s);
}

function __transition(el, name, dir, done) {
  __transitionCSS();
  const cl = el.classList;
  const from = name + '-' + dir + '-from';
  const active = name + '-' + dir + '-active';
  const to = name + '-' + dir + '-to';
  cl.add(from, active);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      cl.remove(from);
      cl.add(to);
      const end = () => { cl.remove(active, to); if (done) done(); };
      el.addEventListener('transitionend', end, { once: true });
    });
  });
}

function __handleComponentError(error, component) {
  let current = component;
  while (current) {
    if (current.onError) {
      try { current.onError(error, component); return; } catch (_) {}
    }
    current = current._parent;
  }
  throw error;
}

class __Component {
  constructor(props = {}) {
    Object.assign(this, props);
    if (!this.app && globalThis.__ripApp) this.app = globalThis.__ripApp;
    const prev = __pushComponent(this);
    try { this._init(props); } catch (e) { __popComponent(prev); __handleComponentError(e, this); return; }
    __popComponent(prev);
  }
  _init() {}
  mount(target) {
    if (typeof target === "string") target = document.querySelector(target);
    this._target = target;
    try {
      this._root = this._create();
      target.appendChild(this._root);
      if (this._setup) this._setup();
      if (this.mounted) this.mounted();
    } catch (error) {
      __handleComponentError(error, this);
    }
    return this;
  }
  unmount() {
    if (this._children) {
      for (const child of this._children) {
        child.unmount();
      }
    }
    if (this.unmounted) this.unmounted();
    if (this._root && this._root.parentNode) {
      this._root.parentNode.removeChild(this._root);
    }
  }
  emit(name, detail) {
    if (this._root) {
      this._root.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
    }
  }
  static mount(target = 'body') {
    return new this().mount(target);
  }
}

// Register on globalThis for runtime deduplication
if (typeof globalThis !== 'undefined') {
  globalThis.__ripComponent = { __pushComponent, __popComponent, setContext, getContext, hasContext, __clsx, __lis, __reconcile, __transition, __handleComponentError, __Component };
}

`;
    };
  }

  // src/sourcemaps.js
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function vlqEncode(value) {
    let result = "";
    let vlq = value < 0 ? -value << 1 | 1 : value << 1;
    do {
      let digit = vlq & 31;
      vlq >>>= 5;
      if (vlq > 0)
        digit |= 32;
      result += B64[digit];
    } while (vlq > 0);
    return result;
  }

  class SourceMapGenerator {
    constructor(file, source, sourceContent = null) {
      this.file = file;
      this.source = source;
      this.sourceContent = sourceContent;
      this.names = [];
      this.nameIndex = new Map;
      this.lines = [];
      this.mappings = [];
      this.prevGenCol = 0;
      this.prevOrigLine = 0;
      this.prevOrigCol = 0;
      this.prevNameIdx = 0;
      this.currentLine = -1;
    }
    ensureLine(line) {
      while (this.lines.length <= line)
        this.lines.push([]);
    }
    addName(name) {
      if (this.nameIndex.has(name))
        return this.nameIndex.get(name);
      let idx = this.names.length;
      this.names.push(name);
      this.nameIndex.set(name, idx);
      return idx;
    }
    addMapping(genLine, genCol, origLine, origCol, name) {
      this.ensureLine(genLine);
      if (this.currentLine !== genLine) {
        this.prevGenCol = 0;
        this.currentLine = genLine;
      }
      if (origLine == null) {
        this.lines[genLine].push(vlqEncode(genCol - this.prevGenCol));
        this.prevGenCol = genCol;
        return;
      }
      this.mappings.push({ genLine, genCol, origLine, origCol });
      let segment = vlqEncode(genCol - this.prevGenCol);
      this.prevGenCol = genCol;
      segment += vlqEncode(0);
      segment += vlqEncode(origLine - this.prevOrigLine);
      this.prevOrigLine = origLine;
      segment += vlqEncode(origCol - this.prevOrigCol);
      this.prevOrigCol = origCol;
      if (name != null) {
        let idx = this.addName(name);
        segment += vlqEncode(idx - this.prevNameIdx);
        this.prevNameIdx = idx;
      }
      this.lines[genLine].push(segment);
    }
    toReverseMap() {
      let reverse = new Map;
      for (let m of this.mappings) {
        if (!reverse.has(m.origLine))
          reverse.set(m.origLine, []);
        reverse.get(m.origLine).push({ origCol: m.origCol, genLine: m.genLine, genCol: m.genCol });
      }
      return reverse;
    }
    toJSON() {
      let mappings = this.lines.map((segs) => segs.join(",")).join(";");
      let map = { version: 3, file: this.file, sources: [this.source], names: this.names, mappings };
      if (this.sourceContent != null)
        map.sourcesContent = [this.sourceContent];
      return JSON.stringify(map);
    }
  }

  // src/compiler.js
  var meta = (node, key) => node instanceof String ? node[key] : undefined;
  var str = (node) => node instanceof String ? node.valueOf() : node;
  var INLINE_FORMS = new Set([
    "+",
    "-",
    "*",
    "/",
    "%",
    "//",
    "%%",
    "**",
    "==",
    "!=",
    "<",
    ">",
    "<=",
    ">=",
    "===",
    "!==",
    "&&",
    "||",
    "??",
    "!?",
    "not",
    "&",
    "|",
    "^",
    "<<",
    ">>",
    ">>>",
    "=",
    ".",
    "?.",
    "[]",
    "!",
    "typeof",
    "void",
    "delete",
    "new",
    "...",
    "rest",
    "expansion",
    "optindex",
    "optcall"
  ]);
  var STMT_ONLY = new Set([
    "def",
    "class",
    "if",
    "unless",
    "for-in",
    "for-of",
    "for-as",
    "while",
    "until",
    "loop",
    "switch",
    "try",
    "throw"
  ]);
  var MAP_LITERAL_KEYS = new Set(["true", "false", "null", "undefined", "Infinity", "NaN"]);
  function isInline(arr) {
    if (!Array.isArray(arr) || arr.length === 0)
      return false;
    let head = arr[0]?.valueOf?.() ?? arr[0];
    if (INLINE_FORMS.has(head))
      return true;
    return arr.length <= 4 && !arr.some(Array.isArray);
  }
  function formatAtom(elem) {
    if (Array.isArray(elem))
      return "(???)";
    if (typeof elem === "number")
      return String(elem);
    if (elem === null)
      return "null";
    if (elem === "")
      return '""';
    let s = String(elem);
    if (s[0] === "/" && s.indexOf(`
`) >= 0) {
      let match = s.match(/\/([gimsuvy]*)$/);
      let flags = match ? match[1] : "";
      let content = s.slice(1);
      content = flags ? content.slice(0, -flags.length - 1) : content.slice(0, -1);
      let lines = content.split(`
`);
      let cleaned = lines.map((line) => line.replace(/#.*$/, "").trim());
      return `"/${cleaned.join("")}/${flags}"`;
    }
    return s;
  }
  function formatSExpr(arr, indent = 0, isTopLevel = false) {
    if (!Array.isArray(arr))
      return formatAtom(arr);
    if (isTopLevel && arr[0] === "program") {
      let secondElem = arr[1];
      let header = Array.isArray(secondElem) ? "(program" : "(program " + formatAtom(secondElem);
      let lines2 = [header];
      let startIndex = Array.isArray(secondElem) ? 1 : 2;
      for (let i = startIndex;i < arr.length; i++) {
        let child = formatSExpr(arr[i], 2, false);
        lines2.push(child[0] === "(" ? "  " + child : child);
      }
      lines2.push(")");
      return lines2.join(`
`);
    }
    let head = arr[0];
    let canBeInline = isInline(arr) && arr.slice(1).every((elem) => !Array.isArray(elem) || isInline(elem));
    if (canBeInline) {
      let parts = arr.map((elem) => Array.isArray(elem) ? formatSExpr(elem, 0, false) : formatAtom(elem));
      let inline = `(${parts.join(" ")})`;
      if (!inline.includes(`
`))
        return " ".repeat(indent) + inline;
    }
    let spaces = " ".repeat(indent);
    let formattedHead;
    if (Array.isArray(head)) {
      formattedHead = formatSExpr(head, 0, false);
      if (formattedHead.includes(`
`)) {
        let headLines = formattedHead.split(`
`);
        formattedHead = headLines.map((line, i) => i === 0 ? line : " ".repeat(indent + 2) + line).join(`
`);
      }
    } else {
      formattedHead = formatAtom(head);
    }
    let lines = [`${spaces}(${formattedHead}`];
    let forceChildrenOnNewLines = head === "block";
    for (let i = 1;i < arr.length; i++) {
      let elem = arr[i];
      if (!Array.isArray(elem)) {
        lines[lines.length - 1] += " " + formatAtom(elem);
      } else {
        let childInline = isInline(elem) && elem.every((e) => !Array.isArray(e) || isInline(e));
        if (!forceChildrenOnNewLines && childInline) {
          let formatted = formatSExpr(elem, 0, false);
          if (!formatted.includes(`
`)) {
            lines[lines.length - 1] += " " + formatted;
            continue;
          }
        }
        lines.push(formatSExpr(elem, indent + 2, false));
      }
    }
    lines[lines.length - 1] += ")";
    return lines.join(`
`);
  }

  class CodeGenerator {
    static ASSIGNMENT_OPS = new Set([
      "=",
      "+=",
      "-=",
      "*=",
      "/=",
      "?=",
      "&=",
      "|=",
      "^=",
      "%=",
      "**=",
      "??=",
      "&&=",
      "||=",
      "<<=",
      ">>=",
      ">>>="
    ]);
    static NUMBER_LITERAL_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
    static NUMBER_START_RE = /^-?\d/;
    static GENERATORS = {
      program: "generateProgram",
      "&&": "generateLogicalAnd",
      "||": "generateLogicalOr",
      "+": "generateBinaryOp",
      "-": "generateBinaryOp",
      "*": "generateBinaryOp",
      "/": "generateBinaryOp",
      "%": "generateBinaryOp",
      "**": "generateBinaryOp",
      "==": "generateBinaryOp",
      "===": "generateBinaryOp",
      "!=": "generateBinaryOp",
      "!==": "generateBinaryOp",
      "<": "generateBinaryOp",
      ">": "generateBinaryOp",
      "<=": "generateBinaryOp",
      ">=": "generateBinaryOp",
      "??": "generateBinaryOp",
      "!?": "generateBinaryOp",
      "&": "generateBinaryOp",
      "|": "generateBinaryOp",
      "^": "generateBinaryOp",
      "<<": "generateBinaryOp",
      ">>": "generateBinaryOp",
      ">>>": "generateBinaryOp",
      "%%": "generateModulo",
      "%%=": "generateModuloAssign",
      "//": "generateFloorDiv",
      "//=": "generateFloorDivAssign",
      "..": "generateRange",
      "=": "generateAssignment",
      "+=": "generateAssignment",
      "-=": "generateAssignment",
      "*=": "generateAssignment",
      "/=": "generateAssignment",
      "%=": "generateAssignment",
      "**=": "generateAssignment",
      "&&=": "generateAssignment",
      "||=": "generateAssignment",
      "??=": "generateAssignment",
      "?=": "generateAssignment",
      "&=": "generateAssignment",
      "|=": "generateAssignment",
      "^=": "generateAssignment",
      "<<=": "generateAssignment",
      ">>=": "generateAssignment",
      ">>>=": "generateAssignment",
      "...": "generateRange",
      "!": "generateNot",
      "~": "generateBitwiseNot",
      "++": "generateIncDec",
      "--": "generateIncDec",
      "=~": "generateRegexMatch",
      instanceof: "generateInstanceof",
      in: "generateIn",
      of: "generateOf",
      typeof: "generateTypeof",
      delete: "generateDelete",
      new: "generateNew",
      array: "generateArray",
      object: "generateObject",
      "map-literal": "generateMap",
      block: "generateBlock",
      ".": "generatePropertyAccess",
      "?.": "generateOptionalProperty",
      "[]": "generateIndexAccess",
      optindex: "generateOptIndex",
      optcall: "generateOptCall",
      "regex-index": "generateRegexIndex",
      def: "generateDef",
      "->": "generateThinArrow",
      "=>": "generateFatArrow",
      return: "generateReturn",
      state: "generateState",
      computed: "generateComputed",
      readonly: "generateReadonly",
      effect: "generateEffect",
      break: "generateBreak",
      continue: "generateContinue",
      "?": "generateExistential",
      defined: "generateDefined",
      presence: "generatePresence",
      "?:": "generateTernary",
      "|>": "generatePipe",
      loop: "generateLoop",
      "loop-n": "generateLoopN",
      await: "generateAwait",
      yield: "generateYield",
      "yield-from": "generateYieldFrom",
      if: "generateIf",
      "for-in": "generateForIn",
      "for-of": "generateForOf",
      "for-as": "generateForAs",
      while: "generateWhile",
      try: "generateTry",
      throw: "generateThrow",
      control: "generateControl",
      switch: "generateSwitch",
      when: "generateWhen",
      comprehension: "generateComprehension",
      "object-comprehension": "generateObjectComprehension",
      class: "generateClass",
      super: "generateSuper",
      component: "generateComponent",
      render: "generateRender",
      offer: "generateOffer",
      accept: "generateAccept",
      enum: "generateEnum",
      import: "generateImport",
      export: "generateExport",
      "export-default": "generateExportDefault",
      "export-all": "generateExportAll",
      "export-from": "generateExportFrom",
      "do-iife": "generateDoIIFE",
      regex: "generateRegex",
      "tagged-template": "generateTaggedTemplate",
      str: "generateString"
    };
    constructor(options = {}) {
      this.options = options;
      this.indentLevel = 0;
      this.indentString = "  ";
      this.comprehensionDepth = 0;
      this.dataSection = options.dataSection;
      this.sourceMap = options.sourceMap || null;
      if (options.reactiveVars) {
        this.reactiveVars = new Set(options.reactiveVars);
      }
    }
    compile(sexpr) {
      this.programVars = new Set;
      this.functionVars = new Map;
      this.helpers = new Set;
      this.scopeStack = [];
      this.collectProgramVariables(sexpr);
      let code = this.generate(sexpr);
      if (this.sourceMap)
        this.buildMappings();
      return code;
    }
    buildMappings() {
      if (!this._stmtEntries)
        return;
      let lineOffset = this._preambleLines;
      for (let entry of this._stmtEntries) {
        if (entry.loc) {
          this.sourceMap.addMapping(lineOffset, 0, entry.loc.r, entry.loc.c);
        }
        if (entry.sexpr && entry.loc) {
          this.recordSubMappings(entry.code, entry.sexpr, lineOffset);
        }
        lineOffset += entry.code.split(`
`).length;
      }
    }
    recordSubMappings(code, sexpr, lineOffset) {
      let stmtOrigLine = sexpr.loc ? sexpr.loc.r : 0;
      let subs = [];
      this.collectSubExprs(sexpr, subs);
      for (let { name, origLine, origCol } of subs) {
        let escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        let re = new RegExp("\\b" + escaped + "\\b", "g");
        let m, bestMatch = null, bestDist = Infinity;
        let origLineInStmt = origLine - stmtOrigLine;
        while ((m = re.exec(code)) !== null) {
          let before = code.substring(0, m.index);
          let nl = before.split(`
`);
          let genLine = lineOffset + nl.length - 1;
          let genCol = nl[nl.length - 1].length;
          let genLineInStmt = nl.length - 1;
          let dist = Math.abs(genLineInStmt - origLineInStmt) * 1e4 + Math.abs(genCol - origCol);
          if (dist < bestDist) {
            bestDist = dist;
            bestMatch = { genLine, genCol };
          }
        }
        if (bestMatch) {
          this.sourceMap.addMapping(bestMatch.genLine, bestMatch.genCol, origLine, origCol);
        }
      }
    }
    collectSubExprs(node, result) {
      if (!Array.isArray(node))
        return;
      let head = node[0];
      if (Array.isArray(head) || head != null && typeof head !== "string" && !(head instanceof String)) {
        for (let i = 0;i < node.length; i++) {
          if (Array.isArray(node[i]))
            this.collectSubExprs(node[i], result);
        }
        return;
      }
      if (node.loc) {
        head = str(head);
        let ident = null;
        if (head === ".") {
          if (typeof node[2] === "string")
            ident = node[2];
        } else if (typeof head === "string" && /^[=+\-*/%<>!&|?~^]|^\.\.?$|^def$|^class$|^state$|^computed$|^readonly$|^for-/.test(head)) {
          if (typeof node[1] === "string" && /^[a-zA-Z_$]/.test(node[1]))
            ident = node[1];
        } else if (typeof head === "string" && /^[a-zA-Z_$]/.test(head)) {
          ident = head;
        }
        if (ident)
          result.push({ name: ident, origLine: node.loc.r, origCol: node.loc.c });
      }
      for (let i = 1;i < node.length; i++) {
        if (Array.isArray(node[i]))
          this.collectSubExprs(node[i], result);
      }
    }
    collectProgramVariables(sexpr) {
      if (!Array.isArray(sexpr))
        return;
      let [head, ...rest] = sexpr;
      head = str(head);
      if (Array.isArray(head)) {
        sexpr.forEach((item) => this.collectProgramVariables(item));
        return;
      }
      if (head === "export" || head === "export-default" || head === "export-all" || head === "export-from")
        return;
      if (head === "state" || head === "computed") {
        let [target] = rest;
        let varName = str(target) ?? target;
        if (!this.reactiveVars)
          this.reactiveVars = new Set;
        this.reactiveVars.add(varName);
        return;
      }
      if (head === "readonly") {
        let [name] = rest;
        let varName = str(name) ?? name;
        if (!this.readonlyVars)
          this.readonlyVars = new Set;
        this.readonlyVars.add(varName);
        return;
      }
      if (head === "component")
        return;
      if (head === "enum")
        return;
      if (CodeGenerator.ASSIGNMENT_OPS.has(head)) {
        let [target, value] = rest;
        if (typeof target === "string" || target instanceof String) {
          let varName = str(target);
          if (!this.reactiveVars?.has(varName) && !this.readonlyVars?.has(varName))
            this.programVars.add(varName);
        } else if (this.is(target, "array")) {
          this.collectVarsFromArray(target, this.programVars);
        } else if (this.is(target, "object")) {
          this.collectVarsFromObject(target, this.programVars);
        }
        this.collectProgramVariables(value);
        return;
      }
      if (head === "def" || head === "->" || head === "=>" || head === "effect")
        return;
      if (head === "if") {
        let [condition, thenBranch, elseBranch] = rest;
        this.collectProgramVariables(condition);
        this.collectProgramVariables(thenBranch);
        if (elseBranch)
          this.collectProgramVariables(elseBranch);
        return;
      }
      if (head === "try") {
        this.collectProgramVariables(rest[0]);
        if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== "block") {
          let [param, catchBlock] = rest[1];
          if (param && this.is(param, "object")) {
            param.slice(1).forEach((pair) => {
              if (Array.isArray(pair) && pair.length === 2 && typeof pair[1] === "string") {
                this.programVars.add(pair[1]);
              }
            });
          } else if (param && this.is(param, "array")) {
            param.slice(1).forEach((item) => {
              if (typeof item === "string")
                this.programVars.add(item);
            });
          }
          this.collectProgramVariables(catchBlock);
        }
        if (rest.length === 3)
          this.collectProgramVariables(rest[2]);
        else if (rest.length === 2 && (!Array.isArray(rest[1]) || rest[1][0] === "block")) {
          this.collectProgramVariables(rest[1]);
        }
        return;
      }
      rest.forEach((item) => this.collectProgramVariables(item));
    }
    collectFunctionVariables(body) {
      let vars = new Set;
      let collect = (sexpr) => {
        if (!Array.isArray(sexpr))
          return;
        let [head, ...rest] = sexpr;
        head = str(head);
        if (Array.isArray(head)) {
          sexpr.forEach((item) => collect(item));
          return;
        }
        if (CodeGenerator.ASSIGNMENT_OPS.has(head)) {
          let [target, value] = rest;
          if (typeof target === "string")
            vars.add(target);
          else if (this.is(target, "array"))
            this.collectVarsFromArray(target, vars);
          else if (this.is(target, "object"))
            this.collectVarsFromObject(target, vars);
          collect(value);
          return;
        }
        if (head === "def" || head === "->" || head === "=>" || head === "effect")
          return;
        if (head === "try") {
          collect(rest[0]);
          if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== "block") {
            let [param, catchBlock] = rest[1];
            if (param && this.is(param, "object")) {
              param.slice(1).forEach((pair) => {
                if (Array.isArray(pair) && pair.length === 2 && typeof pair[1] === "string")
                  vars.add(pair[1]);
              });
            } else if (param && this.is(param, "array")) {
              param.slice(1).forEach((item) => {
                if (typeof item === "string")
                  vars.add(item);
              });
            }
            collect(catchBlock);
          }
          if (rest.length === 3)
            collect(rest[2]);
          else if (rest.length === 2 && (!Array.isArray(rest[1]) || rest[1][0] === "block"))
            collect(rest[1]);
          return;
        }
        rest.forEach((item) => collect(item));
      };
      collect(body);
      return vars;
    }
    generate(sexpr, context = "statement") {
      if (sexpr instanceof String) {
        if (meta(sexpr, "await") === true) {
          return `await ${str(sexpr)}()`;
        }
        if (meta(sexpr, "predicate")) {
          return `(${str(sexpr)} != null)`;
        }
        if (meta(sexpr, "delimiter") === "///" && meta(sexpr, "heregex")) {
          let primitive = str(sexpr);
          let match = primitive.match(/^\/(.*)\/([gimsuvy]*)$/s);
          if (match) {
            let [, pattern, flags] = match;
            return `/${this.processHeregex(pattern)}/${flags}`;
          }
          return primitive;
        }
        let quote = meta(sexpr, "quote");
        if (quote) {
          let primitive = str(sexpr);
          if (quote === '"""' || quote === "'''") {
            let content2 = this.extractStringContent(sexpr);
            content2 = content2.replace(/`/g, "\\`").replace(/\${/g, "\\${");
            return `\`${content2}\``;
          }
          if (primitive[0] === quote)
            return primitive;
          let content = primitive.slice(1, -1);
          return `${quote}${content}${quote}`;
        }
        sexpr = str(sexpr);
      }
      if (typeof sexpr === "string") {
        if (sexpr.startsWith('"') || sexpr.startsWith("'") || sexpr.startsWith("`")) {
          if (this.options.debug)
            console.warn("[Rip] Unexpected quoted primitive:", sexpr);
          let content = sexpr.slice(1, -1);
          if (content.includes(`
`)) {
            return `\`${content.replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\``;
          }
          let delim = content.includes("'") && !content.includes('"') ? '"' : "'";
          let escaped = content.replace(new RegExp(delim, "g"), `\\${delim}`);
          return `${delim}${escaped}${delim}`;
        }
        if (this.reactiveVars?.has(sexpr) && !this.suppressReactiveUnwrap) {
          return `${sexpr}.value`;
        }
        return sexpr;
      }
      if (typeof sexpr === "number")
        return String(sexpr);
      if (sexpr === null || sexpr === undefined)
        return "null";
      if (!Array.isArray(sexpr))
        throw new Error(`Invalid s-expression: ${JSON.stringify(sexpr)}`);
      let [head, ...rest] = sexpr;
      let headAwaitMeta = meta(head, "await");
      head = str(head);
      let method = CodeGenerator.GENERATORS[head];
      if (method)
        return this[method](head, rest, context, sexpr);
      if (typeof head === "string" && !head.startsWith('"') && !head.startsWith("'")) {
        if (CodeGenerator.NUMBER_START_RE.test(head))
          return head;
        if (head === "super" && this.currentMethodName && this.currentMethodName !== "constructor") {
          let args2 = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
          return `super.${this.currentMethodName}(${args2})`;
        }
        if (context === "statement" && rest.length === 1) {
          let cond = this.findPostfixConditional(rest[0]);
          if (cond) {
            let argWithout = this.rebuildWithoutConditional(cond);
            let callee = this.generate(head, "value");
            let condCode = this.generate(cond.condition, "value");
            let valCode = this.generate(argWithout, "value");
            let callStr2 = `${callee}(${valCode})`;
            return `if (${condCode}) ${callStr2}`;
          }
        }
        let needsAwait = headAwaitMeta === true;
        let calleeName = this.generate(head, "value");
        let args = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
        let callStr = `${calleeName}(${args})`;
        return needsAwait ? `await ${callStr}` : callStr;
      }
      if (Array.isArray(head) && typeof head[0] === "string") {
        let stmtOps = ["=", "+=", "-=", "*=", "/=", "%=", "**=", "&&=", "||=", "??=", "if", "return", "throw"];
        if (stmtOps.includes(head[0])) {
          let exprs = sexpr.map((stmt) => this.generate(stmt, "value"));
          return `(${exprs.join(", ")})`;
        }
      }
      if (Array.isArray(head)) {
        if (head[0] === "." && (head[2] === "new" || str(head[2]) === "new")) {
          let ctorExpr = head[1];
          let ctorCode = this.generate(ctorExpr, "value");
          let args2 = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
          let needsParens = Array.isArray(ctorExpr);
          return `new ${needsParens ? `(${ctorCode})` : ctorCode}(${args2})`;
        }
        if (context === "statement" && rest.length === 1) {
          let cond = this.findPostfixConditional(rest[0]);
          if (cond) {
            let argWithout = this.rebuildWithoutConditional(cond);
            let calleeCode2 = this.generate(head, "value");
            let condCode = this.generate(cond.condition, "value");
            let valCode = this.generate(argWithout, "value");
            let callStr2 = `${calleeCode2}(${valCode})`;
            return `if (${condCode}) ${callStr2}`;
          }
        }
        let needsAwait = false;
        let calleeCode;
        if (head[0] === "." && meta(head[2], "await") === true) {
          needsAwait = true;
          let [obj, prop] = head.slice(1);
          let objCode = this.generate(obj, "value");
          let needsParens = CodeGenerator.NUMBER_LITERAL_RE.test(objCode) || (this.is(obj, "object") || this.is(obj, "await") || this.is(obj, "yield"));
          let base = needsParens ? `(${objCode})` : objCode;
          calleeCode = `${base}.${str(prop)}`;
        } else {
          calleeCode = this.generate(head, "value");
        }
        let args = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
        let callStr = `${calleeCode}(${args})`;
        return needsAwait ? `await ${callStr}` : callStr;
      }
      throw new Error(`Unknown s-expression type: ${head}`);
    }
    generateProgram(head, statements, context, sexpr) {
      let code = "";
      let imports = [], body = [];
      for (let stmt of statements) {
        if (!Array.isArray(stmt)) {
          body.push(stmt);
          continue;
        }
        let h = stmt[0];
        if (h === "import")
          imports.push(stmt);
        else
          body.push(stmt);
      }
      let blockStmts = ["def", "class", "if", "for-in", "for-of", "for-as", "while", "loop", "switch", "try"];
      let stmtEntries = body.map((stmt, index) => {
        let isSingle = body.length === 1 && imports.length === 0;
        let isObj = this.is(stmt, "object");
        let isObjComp = isObj && stmt.length === 2 && Array.isArray(stmt[1]) && Array.isArray(stmt[1][2]) && stmt[1][2][0] === "comprehension";
        let isAlreadyExpr = this.is(stmt, "comprehension") || this.is(stmt, "object-comprehension") || this.is(stmt, "do-iife");
        let hasNoVars = this.programVars.size === 0;
        let needsParens = isSingle && isObj && hasNoVars && !isAlreadyExpr && !isObjComp;
        let isLast = index === body.length - 1;
        let isLastComp = isLast && isAlreadyExpr;
        let generated;
        if (needsParens)
          generated = `(${this.generate(stmt, "value")})`;
        else if (isLastComp)
          generated = this.generate(stmt, "value");
        else
          generated = this.generate(stmt, "statement");
        if (generated && !generated.endsWith(";")) {
          let h = Array.isArray(stmt) ? stmt[0] : null;
          if (!blockStmts.includes(h) || !generated.endsWith("}"))
            generated += ";";
        }
        let loc = Array.isArray(stmt) ? stmt.loc : null;
        return { code: generated, loc, sexpr: Array.isArray(stmt) ? stmt : null };
      });
      let statementsCode = stmtEntries.map((e) => e.code).join(`
`);
      let needsBlank = false;
      if (imports.length > 0) {
        code += imports.map((s) => this.addSemicolon(s, this.generate(s, "statement"))).join(`
`);
        needsBlank = true;
      }
      if (this.programVars.size > 0) {
        let hasUnderscore = this.programVars.has("_");
        if (hasUnderscore)
          this.programVars.delete("_");
        if (this.programVars.size > 0) {
          let vars = Array.from(this.programVars).sort().join(", ");
          if (needsBlank)
            code += `
`;
          code += `let ${vars};
`;
          needsBlank = true;
        }
        if (hasUnderscore) {
          if (needsBlank)
            code += `
`;
          code += `var _;
`;
          needsBlank = true;
        }
      }
      let skip = this.options.skipPreamble;
      let skipRT = this.options.skipRuntimes;
      if (!skip) {
        if (needsBlank)
          code += `
`;
        code += getStdlibCode();
        needsBlank = true;
        let helperDecl = skipRT ? "var" : "const";
        if (this.helpers.has("slice")) {
          code += `${helperDecl} slice = [].slice;
`;
          needsBlank = true;
        }
        if (this.helpers.has("modulo")) {
          code += `${helperDecl} modulo = (n, d) => { n = +n; d = +d; return (n % d + d) % d; };
`;
          needsBlank = true;
        }
        if (this.helpers.has("toMatchable")) {
          code += `${helperDecl} toMatchable = (v, allowNewlines) => {
`;
          code += `  if (typeof v === "string") return !allowNewlines && /[\\n\\r]/.test(v) ? null : v;
`;
          code += `  if (v == null) return "";
`;
          code += `  if (typeof v === "number" || typeof v === "bigint" || typeof v === "boolean") return String(v);
`;
          code += `  if (typeof v === "symbol") return v.description || "";
`;
          code += `  if (v instanceof Uint8Array || v instanceof ArrayBuffer) {
`;
          code += `    return new TextDecoder().decode(v instanceof Uint8Array ? v : new Uint8Array(v));
`;
          code += `  }
`;
          code += `  if (Array.isArray(v)) return v.join(",");
`;
          code += `  if (typeof v.toString === "function" && v.toString !== Object.prototype.toString) {
`;
          code += `    try { return v.toString(); } catch { return ""; }
`;
          code += `  }
`;
          code += `  return "";
`;
          code += `};
`;
          needsBlank = true;
        }
      }
      if (this.usesReactivity && !skip) {
        if (skipRT) {
          code += `var { __state, __computed, __effect, __batch, __readonly, __setErrorHandler, __handleError, __catchErrors } = globalThis.__rip;
`;
        } else if (typeof globalThis !== "undefined" && globalThis.__rip) {
          code += `const { __state, __computed, __effect, __batch, __readonly, __setErrorHandler, __handleError, __catchErrors } = globalThis.__rip;
`;
        } else {
          code += this.getReactiveRuntime();
        }
        needsBlank = true;
      }
      if (this.usesTemplates && !skip) {
        if (skipRT) {
          code += `var { __pushComponent, __popComponent, setContext, getContext, hasContext, __clsx, __lis, __reconcile, __transition, __handleComponentError, __Component } = globalThis.__ripComponent;
`;
        } else if (typeof globalThis !== "undefined" && globalThis.__ripComponent) {
          code += `const { __pushComponent, __popComponent, setContext, getContext, hasContext, __clsx, __lis, __reconcile, __transition, __handleComponentError, __Component } = globalThis.__ripComponent;
`;
        } else {
          code += this.getComponentRuntime();
        }
        needsBlank = true;
      }
      if (this.dataSection !== null && this.dataSection !== undefined && !skip) {
        code += `var DATA;
_setDataSection();
`;
        needsBlank = true;
      }
      if (needsBlank && code.length > 0)
        code += `
`;
      this._stmtEntries = stmtEntries;
      this._preambleLines = code.length === 0 ? 0 : code.split(`
`).length - 1;
      code += statementsCode;
      if (this.dataSection !== null && this.dataSection !== undefined) {
        code += `

function _setDataSection() {
  DATA = ${JSON.stringify(this.dataSection)};
}`;
      }
      return code;
    }
    generateBinaryOp(op, rest, context, sexpr) {
      if ((op === "+" || op === "-") && rest.length === 1) {
        return `(${op}${this.generate(rest[0], "value")})`;
      }
      let [left, right] = rest;
      if (op === "*") {
        let leftStr = left?.valueOf?.() ?? left;
        if (typeof leftStr === "string" && /^["']/.test(leftStr)) {
          return `${this.generate(left, "value")}.repeat(${this.generate(right, "value")})`;
        }
      }
      let COMPARE_OPS = new Set(["<", ">", "<=", ">="]);
      if (COMPARE_OPS.has(op) && Array.isArray(left)) {
        let leftOp = left[0]?.valueOf?.() ?? left[0];
        if (COMPARE_OPS.has(leftOp)) {
          let a = this.generate(left[1], "value");
          let b = this.generate(left[2], "value");
          let c = this.generate(right, "value");
          return `((${a} ${leftOp} ${b}) && (${b} ${op} ${c}))`;
        }
      }
      if (op === "!?") {
        let l = this.generate(left, "value"), r = this.generate(right, "value");
        return `(${l} !== undefined ? ${l} : ${r})`;
      }
      if (op === "==")
        op = "===";
      if (op === "!=")
        op = "!==";
      return `(${this.generate(left, "value")} ${op} ${this.generate(right, "value")})`;
    }
    generateModulo(head, rest) {
      let [left, right] = rest;
      this.helpers.add("modulo");
      return `modulo(${this.generate(left, "value")}, ${this.generate(right, "value")})`;
    }
    generateModuloAssign(head, rest) {
      let [target, value] = rest;
      this.helpers.add("modulo");
      let t = this.generate(target, "value"), v = this.generate(value, "value");
      return `${t} = modulo(${t}, ${v})`;
    }
    generateFloorDiv(head, rest) {
      let [left, right] = rest;
      return `Math.floor(${this.generate(left, "value")} / ${this.generate(right, "value")})`;
    }
    generateFloorDivAssign(head, rest) {
      let [target, value] = rest;
      let t = this.generate(target, "value"), v = this.generate(value, "value");
      return `${t} = Math.floor(${t} / ${v})`;
    }
    generateAssignment(head, rest, context, sexpr) {
      let [target, value] = rest;
      let op = head === "?=" ? "??=" : head;
      let optInfo = this._findOptionalInTarget(target);
      if (optInfo) {
        let guardCode = this.generate(optInfo.guard, "value");
        let targetCode2 = this.generate(optInfo.rewritten, "value");
        let valueCode2 = this.generate(value, "value");
        if (context === "value") {
          return `(${guardCode} != null ? (${targetCode2} ${op} ${valueCode2}) : undefined)`;
        }
        return `if (${guardCode} != null) ${targetCode2} ${op} ${valueCode2}`;
      }
      let isFnValue = this.is(value, "->") || this.is(value, "=>") || this.is(value, "def");
      if (target instanceof String && meta(target, "await") !== undefined && !isFnValue) {
        let sigil = meta(target, "await") === true ? "!" : "&";
        throw new Error(`Cannot use ${sigil} sigil in variable declaration '${str(target)}'.`);
      }
      if (target instanceof String && meta(target, "await") === true && isFnValue) {
        this.nextFunctionIsVoid = true;
      }
      let isEmptyArr = this.is(target, "array", 0);
      let isEmptyObj = this.is(target, "object", 0);
      if (isEmptyArr || isEmptyObj) {
        let v = this.generate(value, "value");
        return isEmptyObj && context === "statement" ? `(${v})` : v;
      }
      if (Array.isArray(value) && op === "=" && value[0] === "control") {
        let [, rawCtrlOp, expr, ctrlSexpr] = value;
        let ctrlOp = str(rawCtrlOp);
        let isReturn = ctrlSexpr[0] === "return";
        let targetCode2 = this.generate(target, "value");
        let exprCode = this.generate(expr, "value");
        let ctrlValue = ctrlSexpr.length > 1 ? ctrlSexpr[1] : null;
        let ctrlCode = isReturn ? ctrlValue ? `return ${this.generate(ctrlValue, "value")}` : "return" : ctrlValue ? `throw ${this.generate(ctrlValue, "value")}` : "throw new Error()";
        if (context === "value") {
          if (ctrlOp === "??")
            return `(() => { const __v = ${exprCode}; if (__v == null) ${ctrlCode}; return (${targetCode2} = __v); })()`;
          if (ctrlOp === "||")
            return `(() => { const __v = ${exprCode}; if (!__v) ${ctrlCode}; return (${targetCode2} = __v); })()`;
          return `(() => { const __v = ${exprCode}; if (__v) ${ctrlCode}; return (${targetCode2} = __v); })()`;
        }
        if (ctrlOp === "??")
          return `if ((${targetCode2} = ${exprCode}) == null) ${ctrlCode}`;
        if (ctrlOp === "||")
          return `if (!(${targetCode2} = ${exprCode})) ${ctrlCode}`;
        return `if ((${targetCode2} = ${exprCode})) ${ctrlCode}`;
      }
      if (this.is(target, "array")) {
        let restIdx = target.slice(1).findIndex((el) => this.is(el, "...") || el === "...");
        if (restIdx !== -1 && restIdx < target.length - 2) {
          let elements = target.slice(1);
          let afterRest = elements.slice(restIdx + 1);
          let afterCount = afterRest.length;
          if (afterCount > 0) {
            let valueCode2 = this.generate(value, "value");
            let beforeRest = elements.slice(0, restIdx);
            let beforePattern = beforeRest.map((el) => el === "," ? "" : typeof el === "string" ? el : this.generate(el, "value")).join(", ");
            let afterPattern = afterRest.map((el) => el === "," ? "" : typeof el === "string" ? el : this.generate(el, "value")).join(", ");
            this.helpers.add("slice");
            elements.forEach((el) => {
              if (el === "," || el === "...")
                return;
              if (typeof el === "string")
                this.programVars.add(el);
              else if (this.is(el, "...") && typeof el[1] === "string")
                this.programVars.add(el[1]);
            });
            let restEl = elements[restIdx];
            let restVar = this.is(restEl, "...") ? restEl[1] : null;
            let stmts = [];
            if (beforePattern)
              stmts.push(`[${beforePattern}] = ${valueCode2}`);
            if (restVar)
              stmts.push(`[...${restVar}] = ${valueCode2}.slice(${restIdx}, -${afterCount})`);
            stmts.push(`[${afterPattern}] = slice.call(${valueCode2}, -${afterCount})`);
            return stmts.join(", ");
          }
        }
      }
      if (context === "statement" && head === "=" && Array.isArray(value) && (value[0] === "||" || value[0] === "&&") && value.length === 3) {
        let [binOp, left, right] = value;
        if (this.is(right, "if") && right.length === 3) {
          let [, condition, wrappedValue] = right;
          let unwrapped = Array.isArray(wrappedValue) && wrappedValue.length === 1 ? wrappedValue[0] : wrappedValue;
          let fullValue = [binOp, left, unwrapped];
          let t = this.generate(target, "value"), c = this.generate(condition, "value"), v = this.generate(fullValue, "value");
          return `if (${c}) ${t} = ${v}`;
        }
      }
      if (context === "statement" && head === "=" && Array.isArray(value) && value.length === 3) {
        let [valHead, condition, actualValue] = value;
        let isPostfix = Array.isArray(actualValue) && actualValue.length === 1 && (!Array.isArray(actualValue[0]) || actualValue[0][0] !== "block");
        if (valHead === "if" && isPostfix) {
          let unwrapped = Array.isArray(actualValue) && actualValue.length === 1 ? actualValue[0] : actualValue;
          let t = this.generate(target, "value");
          let condCode = this.unwrapLogical(this.generate(condition, "value"));
          let v = this.generate(unwrapped, "value");
          return `if (${condCode}) ${t} = ${v}`;
        }
      }
      let targetCode;
      if (target instanceof String && meta(target, "await") !== undefined) {
        targetCode = str(target);
      } else if (typeof target === "string" && this.reactiveVars?.has(target)) {
        targetCode = `${target}.value`;
      } else {
        targetCode = this.generate(target, "value");
      }
      const prevComponentName = this._componentName;
      if (this.is(value, "component") && (typeof target === "string" || target instanceof String))
        this._componentName = str(target);
      let valueCode = this.generate(value, "value");
      this._componentName = prevComponentName;
      let isObjLit = this.is(value, "object");
      if (!isObjLit)
        valueCode = this.unwrap(valueCode);
      let needsParensVal = context === "value";
      let needsParensObj = context === "statement" && this.is(target, "object");
      if (needsParensVal || needsParensObj)
        return `(${targetCode} ${op} ${valueCode})`;
      return `${targetCode} ${op} ${valueCode}`;
    }
    generatePropertyAccess(head, rest, context, sexpr) {
      let [obj, prop] = rest;
      if (this._atParamMap && obj === "this") {
        let mapped = this._atParamMap.get(str(prop));
        if (mapped)
          return mapped;
      }
      let objCode = this.generate(obj, "value");
      let needsParens = CodeGenerator.NUMBER_LITERAL_RE.test(objCode) || objCode.startsWith("await ") || (this.is(obj, "object") || this.is(obj, "yield"));
      let base = needsParens ? `(${objCode})` : objCode;
      if (meta(prop, "await") === true)
        return `await ${base}.${str(prop)}()`;
      if (meta(prop, "predicate"))
        return `(${base}.${str(prop)} != null)`;
      return `${base}.${str(prop)}`;
    }
    generateOptionalProperty(head, rest) {
      let [obj, prop] = rest;
      return `${this.generate(obj, "value")}?.${prop}`;
    }
    generateRegexIndex(head, rest) {
      let [value, regex, captureIndex] = rest;
      this.helpers.add("toMatchable");
      this.programVars.add("_");
      let v = this.generate(value, "value"), r = this.generate(regex, "value");
      let idx = captureIndex !== null ? this.generate(captureIndex, "value") : "0";
      let allowNL = r.includes("/m") ? ", true" : "";
      return `(_ = toMatchable(${v}${allowNL}).match(${r})) && _[${idx}]`;
    }
    generateIndexAccess(head, rest) {
      let [arr, index] = rest;
      if (this.is(index, "..") || this.is(index, "...")) {
        let isIncl = index[0] === "..";
        let arrCode = this.generate(arr, "value");
        let [start, end] = index.slice(1);
        let numericLiteral = (node) => {
          if (node === null)
            return null;
          let v = str(node) ?? node;
          if (typeof v === "number")
            return v;
          if (typeof v === "string" && /^\d+$/.test(v))
            return +v;
          if (Array.isArray(node) && node[0] === "-" && node.length === 2) {
            let inner = str(node[1]) ?? node[1];
            if (typeof inner === "number")
              return -inner;
            if (typeof inner === "string" && /^\d+$/.test(inner))
              return -inner;
          }
          return null;
        };
        let inclEnd = (s2, e2, endNode) => {
          let n = numericLiteral(endNode);
          if (n !== null && n !== -1)
            return `${arrCode}.slice(${s2}, ${n + 1})`;
          return `${arrCode}.slice(${s2}, +${e2} + 1 || 9e9)`;
        };
        if (start === null && end === null)
          return `${arrCode}.slice()`;
        if (start === null) {
          if (isIncl && this.is(end, "-", 1) && (str(end[1]) ?? end[1]) == 1)
            return `${arrCode}.slice(0)`;
          let e2 = this.generate(end, "value");
          return isIncl ? inclEnd("0", e2, end) : `${arrCode}.slice(0, ${e2})`;
        }
        if (end === null)
          return `${arrCode}.slice(${this.generate(start, "value")})`;
        let s = this.generate(start, "value");
        if (isIncl && this.is(end, "-", 1) && (str(end[1]) ?? end[1]) == 1)
          return `${arrCode}.slice(${s})`;
        let e = this.generate(end, "value");
        return isIncl ? inclEnd(s, e, end) : `${arrCode}.slice(${s}, ${e})`;
      }
      if (this.is(index, "-", 1)) {
        let n = str(index[1]) ?? index[1];
        if (typeof n === "number" || typeof n === "string" && /^\d+$/.test(n)) {
          return `${this.generate(arr, "value")}.at(-${n})`;
        }
      }
      return `${this.generate(arr, "value")}[${this.unwrap(this.generate(index, "value"))}]`;
    }
    generateOptIndex(head, rest) {
      let [arr, index] = rest;
      if (this.is(index, "-", 1)) {
        let n = str(index[1]) ?? index[1];
        if (typeof n === "number" || typeof n === "string" && /^\d+$/.test(n)) {
          return `${this.generate(arr, "value")}?.at(-${n})`;
        }
      }
      return `${this.generate(arr, "value")}?.[${this.generate(index, "value")}]`;
    }
    generateOptCall(head, rest) {
      let [fn, ...args] = rest;
      return `${this.generate(fn, "value")}?.(${args.map((a) => this.generate(a, "value")).join(", ")})`;
    }
    generateDef(head, rest, context, sexpr) {
      let [name, params, body] = rest;
      let sideEffectOnly = meta(name, "await") === true;
      let cleanName = str(name);
      let paramList = this.generateParamList(params);
      let bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
      let isAsync = this.containsAwait(body);
      let isGen = this.containsYield(body);
      return `${isAsync ? "async " : ""}function${isGen ? "*" : ""} ${cleanName}(${paramList}) ${bodyCode}`;
    }
    generateThinArrow(head, rest, context, sexpr) {
      let [params, body] = rest;
      if ((!params || Array.isArray(params) && params.length === 0) && this.containsIt(body))
        params = ["it"];
      let sideEffectOnly = this.nextFunctionIsVoid || false;
      this.nextFunctionIsVoid = false;
      let paramList = this.generateParamList(params);
      let bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
      let isAsync = this.containsAwait(body);
      let isGen = this.containsYield(body);
      let fn = `${isAsync ? "async " : ""}function${isGen ? "*" : ""}(${paramList}) ${bodyCode}`;
      return context === "value" ? `(${fn})` : fn;
    }
    generateFatArrow(head, rest, context, sexpr) {
      let [params, body] = rest;
      if ((!params || Array.isArray(params) && params.length === 0) && this.containsIt(body))
        params = ["it"];
      let sideEffectOnly = this.nextFunctionIsVoid || false;
      this.nextFunctionIsVoid = false;
      let paramList = this.generateParamList(params);
      let isSingle = params.length === 1 && typeof params[0] === "string" && !paramList.includes("=") && !paramList.includes("...") && !paramList.includes("[") && !paramList.includes("{");
      let paramSyntax = isSingle ? paramList : `(${paramList})`;
      let isAsync = this.containsAwait(body);
      let prefix = isAsync ? "async " : "";
      if (!sideEffectOnly) {
        if (this.is(body, "block") && body.length === 2) {
          let expr = body[1];
          let exprHead = Array.isArray(expr) ? expr[0] : null;
          if (exprHead !== "return" && !STMT_ONLY.has(exprHead)) {
            let code = this.generate(expr, "value");
            if (code[0] === "{")
              code = `(${code})`;
            return `${prefix}${paramSyntax} => ${code}`;
          }
        }
        if (!Array.isArray(body) || body[0] !== "block") {
          let code = this.generate(body, "value");
          if (code[0] === "{")
            code = `(${code})`;
          return `${prefix}${paramSyntax} => ${code}`;
        }
      }
      let bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
      return `${prefix}${paramSyntax} => ${bodyCode}`;
    }
    generateReturn(head, rest, context, sexpr) {
      if (rest.length === 0)
        return "return";
      let [expr] = rest;
      if (this.sideEffectOnly && !(this.is(expr, "->") || this.is(expr, "=>"))) {
        throw new Error(`Cannot return a value from a void function (declared with !)`);
      }
      if (this.is(expr, "if")) {
        let [, condition, body, ...elseParts] = expr;
        if (elseParts.length === 0) {
          let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
          return `if (${this.generate(condition, "value")}) return ${this.generate(val, "value")}`;
        }
      }
      if (this.is(expr, "new") && Array.isArray(expr[1]) && expr[1][0] === "if") {
        let [, condition, body] = expr[1];
        let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
        return `if (${this.generate(condition, "value")}) return ${this.generate(["new", val], "value")}`;
      }
      return `return ${this.generate(expr, "value")}`;
    }
    generateState(head, rest) {
      let [name, expr] = rest;
      this.usesReactivity = true;
      let varName = str(name) ?? name;
      if (!this.reactiveVars)
        this.reactiveVars = new Set;
      this.reactiveVars.add(varName);
      return `const ${varName} = __state(${this.generate(expr, "value")})`;
    }
    generateComputed(head, rest) {
      let [name, expr] = rest;
      this.usesReactivity = true;
      if (!this.reactiveVars)
        this.reactiveVars = new Set;
      let varName = str(name) ?? name;
      this.reactiveVars.add(varName);
      if (this.is(expr, "block") && expr.length > 2) {
        return `const ${varName} = __computed(() => ${this.generateFunctionBody(expr)})`;
      }
      return `const ${varName} = __computed(() => ${this.generate(expr, "value")})`;
    }
    generateReadonly(head, rest) {
      let [name, expr] = rest;
      return `const ${str(name) ?? name} = ${this.generate(expr, "value")}`;
    }
    generateEffect(head, rest) {
      let [target, body] = rest;
      this.usesReactivity = true;
      let bodyCode;
      if (this.is(body, "block")) {
        bodyCode = this.generateFunctionBody(body);
      } else if (this.is(body, "->") || this.is(body, "=>")) {
        let fnCode = this.generate(body, "value");
        if (target)
          return `const ${str(target) ?? this.generate(target, "value")} = __effect(${fnCode})`;
        return `__effect(${fnCode})`;
      } else {
        bodyCode = `{ ${this.generate(body, "value")}; }`;
      }
      let effectCode = `__effect(() => ${bodyCode})`;
      if (target)
        return `const ${str(target) ?? this.generate(target, "value")} = ${effectCode}`;
      return effectCode;
    }
    generateBreak() {
      return "break";
    }
    generateContinue() {
      return "continue";
    }
    generateExistential(head, rest) {
      return `(${this.generate(rest[0], "value")} != null)`;
    }
    generateDefined(head, rest) {
      return `(${this.generate(rest[0], "value")} !== undefined)`;
    }
    generatePresence(head, rest) {
      return `(${this.generate(rest[0], "value")} ? true : undefined)`;
    }
    generateTernary(head, rest, context) {
      let [cond, then_, else_] = rest;
      let thenHead = then_?.[0]?.valueOf?.() ?? then_?.[0];
      if (thenHead === "=" && Array.isArray(then_)) {
        let target = this.generate(then_[1], "value");
        let thenVal = this.generate(then_[2], "value");
        let elseVal = this.generate(else_, "value");
        return `${target} = (${this.unwrap(this.generate(cond, "value"))} ? ${thenVal} : ${elseVal})`;
      }
      return `(${this.unwrap(this.generate(cond, "value"))} ? ${this.generate(then_, "value")} : ${this.generate(else_, "value")})`;
    }
    generatePipe(head, rest) {
      let [left, right] = rest;
      let leftCode = this.generate(left, "value");
      if (Array.isArray(right) && right.length > 1) {
        let fn = right[0];
        let isCall = Array.isArray(fn) || typeof fn === "string" && /^[a-zA-Z_$]/.test(fn);
        if (isCall) {
          let fnCode = this.generate(fn, "value");
          let args = right.slice(1).map((a) => this.generate(a, "value"));
          return `${fnCode}(${leftCode}, ${args.join(", ")})`;
        }
      }
      return `${this.generate(right, "value")}(${leftCode})`;
    }
    generateLoop(head, rest) {
      return `while (true) ${this.generateLoopBody(rest[0])}`;
    }
    generateLoopN(head, rest) {
      let [count, body] = rest;
      let n = this.generate(count, "value");
      return `for (let it = 0; it < ${n}; it++) ${this.generateLoopBody(body)}`;
    }
    generateAwait(head, rest) {
      return `await ${this.generate(rest[0], "value")}`;
    }
    generateYield(head, rest) {
      return rest.length === 0 ? "yield" : `yield ${this.generate(rest[0], "value")}`;
    }
    generateYieldFrom(head, rest) {
      return `yield* ${this.generate(rest[0], "value")}`;
    }
    generateIf(head, rest, context, sexpr) {
      let [condition, thenBranch, ...elseBranches] = rest;
      return context === "value" ? this.generateIfAsExpression(condition, thenBranch, elseBranches) : this.generateIfAsStatement(condition, thenBranch, elseBranches);
    }
    generateForIn(head, rest, context, sexpr) {
      let [vars, iterable, step, guard, body] = rest;
      if (context === "value" && this.comprehensionDepth === 0) {
        let iterator = ["for-in", vars, iterable, step];
        return this.generate(["comprehension", body, [iterator], guard ? [guard] : []], context);
      }
      let varsArray = Array.isArray(vars) ? vars : [vars];
      let noVar = varsArray.length === 0;
      let [itemVar, indexVar] = noVar ? ["_i", null] : varsArray;
      let itemVarPattern = this.is(itemVar, "array") || this.is(itemVar, "object") ? this.generateDestructuringPattern(itemVar) : itemVar;
      if (step && step !== null) {
        let iterCode = this.generate(iterable, "value");
        let idxName = indexVar || "_i";
        let stepCode = this.generate(step, "value");
        let isNeg = this.is(step, "-", 1);
        let isMinus1 = isNeg && (step[1] === "1" || step[1] === 1 || str(step[1]) === "1");
        let isPlus1 = !isNeg && (step === "1" || step === 1 || str(step) === "1");
        let loopHeader;
        if (isMinus1)
          loopHeader = `for (let ${idxName} = ${iterCode}.length - 1; ${idxName} >= 0; ${idxName}--) `;
        else if (isPlus1)
          loopHeader = `for (let ${idxName} = 0; ${idxName} < ${iterCode}.length; ${idxName}++) `;
        else if (isNeg)
          loopHeader = `for (let ${idxName} = ${iterCode}.length - 1; ${idxName} >= 0; ${idxName} += ${stepCode}) `;
        else
          loopHeader = `for (let ${idxName} = 0; ${idxName} < ${iterCode}.length; ${idxName} += ${stepCode}) `;
        if (this.is(body, "block")) {
          let stmts = body.slice(1);
          this.indentLevel++;
          let lines = [];
          if (!noVar)
            lines.push(`const ${itemVarPattern} = ${iterCode}[${idxName}];`);
          if (guard) {
            lines.push(`if (${this.generate(guard, "value")}) {`);
            this.indentLevel++;
            lines.push(...this.formatStatements(stmts));
            this.indentLevel--;
            lines.push(this.indent() + "}");
          } else {
            lines.push(...stmts.map((s) => this.addSemicolon(s, this.generate(s, "statement"))));
          }
          this.indentLevel--;
          return loopHeader + `{
${lines.map((s) => this.indent() + s).join(`
`)}
${this.indent()}}`;
        }
        if (noVar) {
          return guard ? loopHeader + `{ if (${this.generate(guard, "value")}) ${this.generate(body, "statement")}; }` : loopHeader + `{ ${this.generate(body, "statement")}; }`;
        }
        return guard ? loopHeader + `{ const ${itemVarPattern} = ${iterCode}[${idxName}]; if (${this.generate(guard, "value")}) ${this.generate(body, "statement")}; }` : loopHeader + `{ const ${itemVarPattern} = ${iterCode}[${idxName}]; ${this.generate(body, "statement")}; }`;
      }
      if (indexVar) {
        let iterCode = this.generate(iterable, "value");
        let code2 = `for (let ${indexVar} = 0; ${indexVar} < ${iterCode}.length; ${indexVar}++) `;
        if (this.is(body, "block")) {
          code2 += `{
`;
          this.indentLevel++;
          code2 += this.indent() + `const ${itemVarPattern} = ${iterCode}[${indexVar}];
`;
          if (guard) {
            code2 += this.indent() + `if (${this.unwrap(this.generate(guard, "value"))}) {
`;
            this.indentLevel++;
            code2 += this.formatStatements(body.slice(1)).join(`
`) + `
`;
            this.indentLevel--;
            code2 += this.indent() + `}
`;
          } else {
            code2 += this.formatStatements(body.slice(1)).join(`
`) + `
`;
          }
          this.indentLevel--;
          code2 += this.indent() + "}";
        } else {
          code2 += guard ? `{ const ${itemVarPattern} = ${iterCode}[${indexVar}]; if (${this.unwrap(this.generate(guard, "value"))}) ${this.generate(body, "statement")}; }` : `{ const ${itemVarPattern} = ${iterCode}[${indexVar}]; ${this.generate(body, "statement")}; }`;
        }
        return code2;
      }
      let iterHead = Array.isArray(iterable) && iterable[0];
      if (iterHead instanceof String)
        iterHead = str(iterHead);
      if (iterHead === ".." || iterHead === "...") {
        let isExcl = iterHead === "...";
        let [start, end] = iterable.slice(1);
        let isSimple = (e) => typeof e === "number" || typeof e === "string" && !e.includes("(") || e instanceof String && !str(e).includes("(") || this.is(e, ".");
        if (isSimple(start) && isSimple(end)) {
          let s = this.generate(start, "value"), e = this.generate(end, "value");
          let cmp = isExcl ? "<" : "<=";
          let inc = step ? `${itemVarPattern} += ${this.generate(step, "value")}` : `${itemVarPattern}++`;
          let code2 = `for (let ${itemVarPattern} = ${s}; ${itemVarPattern} ${cmp} ${e}; ${inc}) `;
          code2 += guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body);
          return code2;
        }
      }
      let code = `for (const ${itemVarPattern} of ${this.generate(iterable, "value")}) `;
      code += guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body);
      return code;
    }
    generateForOf(head, rest, context, sexpr) {
      let [vars, obj, own, guard, body] = rest;
      if (context === "value" && this.comprehensionDepth === 0) {
        let iterator = ["for-of", vars, obj, own];
        return this.generate(["comprehension", body, [iterator], guard ? [guard] : []], context);
      }
      let [keyVar, valueVar] = Array.isArray(vars) ? vars : [vars];
      let objCode = this.generate(obj, "value");
      let code = `for (const ${keyVar} in ${objCode}) `;
      if (own && !valueVar && !guard) {
        if (this.is(body, "block")) {
          this.indentLevel++;
          let stmts = [`if (!Object.hasOwn(${objCode}, ${keyVar})) continue;`, ...body.slice(1).map((s) => this.addSemicolon(s, this.generate(s, "statement")))];
          this.indentLevel--;
          return code + `{
${stmts.map((s) => this.indent() + s).join(`
`)}
${this.indent()}}`;
        }
        return code + `{ if (!Object.hasOwn(${objCode}, ${keyVar})) continue; ${this.generate(body, "statement")}; }`;
      }
      if (valueVar) {
        if (this.is(body, "block")) {
          let stmts = body.slice(1);
          this.indentLevel++;
          let lines = [];
          if (own)
            lines.push(`if (!Object.hasOwn(${objCode}, ${keyVar})) continue;`);
          lines.push(`const ${valueVar} = ${objCode}[${keyVar}];`);
          if (guard) {
            lines.push(`if (${this.generate(guard, "value")}) {`);
            this.indentLevel++;
            lines.push(...stmts.map((s) => this.addSemicolon(s, this.generate(s, "statement"))));
            this.indentLevel--;
            lines.push(this.indent() + "}");
          } else {
            lines.push(...stmts.map((s) => this.addSemicolon(s, this.generate(s, "statement"))));
          }
          this.indentLevel--;
          return code + `{
${lines.map((s) => this.indent() + s).join(`
`)}
${this.indent()}}`;
        }
        let inline = "";
        if (own)
          inline += `if (!Object.hasOwn(${objCode}, ${keyVar})) continue; `;
        inline += `const ${valueVar} = ${objCode}[${keyVar}]; `;
        if (guard)
          inline += `if (${this.generate(guard, "value")}) `;
        inline += `${this.generate(body, "statement")};`;
        return code + `{ ${inline} }`;
      }
      code += guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body);
      return code;
    }
    generateForAs(head, rest, context, sexpr) {
      let varsArray = Array.isArray(rest[0]) ? rest[0] : [rest[0]];
      let [firstVar] = varsArray;
      let iterable = rest[1], isAwait = rest[2], guard = rest[3], body = rest[4];
      let needsTempVar = false, destructStmts = [];
      if (this.is(firstVar, "array")) {
        let elements = firstVar.slice(1);
        let restIdx = elements.findIndex((el) => this.is(el, "...") || el === "...");
        if (restIdx !== -1 && restIdx < elements.length - 1) {
          needsTempVar = true;
          let afterRest = elements.slice(restIdx + 1), afterCount = afterRest.length;
          let beforeRest = elements.slice(0, restIdx);
          let restEl = elements[restIdx];
          let restVar = this.is(restEl, "...") ? restEl[1] : "_rest";
          let beforePattern = beforeRest.map((el) => el === "," ? "" : typeof el === "string" ? el : this.generate(el, "value")).join(", ");
          let firstPattern = beforePattern ? `${beforePattern}, ...${restVar}` : `...${restVar}`;
          let afterPattern = afterRest.map((el) => el === "," ? "" : typeof el === "string" ? el : this.generate(el, "value")).join(", ");
          destructStmts.push(`[${firstPattern}] = _item`);
          destructStmts.push(`[${afterPattern}] = ${restVar}.splice(-${afterCount})`);
          this.helpers.add("slice");
          elements.forEach((el) => {
            if (el === "," || el === "...")
              return;
            if (typeof el === "string")
              this.programVars.add(el);
            else if (this.is(el, "...") && typeof el[1] === "string")
              this.programVars.add(el[1]);
          });
        }
      }
      let iterCode = this.generate(iterable, "value");
      let awaitKw = isAwait ? "await " : "";
      let itemVarPattern;
      if (needsTempVar)
        itemVarPattern = "_item";
      else if (this.is(firstVar, "array") || this.is(firstVar, "object"))
        itemVarPattern = this.generateDestructuringPattern(firstVar);
      else
        itemVarPattern = firstVar;
      let code = `for ${awaitKw}(const ${itemVarPattern} of ${iterCode}) `;
      if (needsTempVar && destructStmts.length > 0) {
        let stmts = this.unwrapBlock(body);
        let allStmts = this.withIndent(() => [
          ...destructStmts.map((s) => this.indent() + s + ";"),
          ...this.formatStatements(stmts)
        ]);
        code += `{
${allStmts.join(`
`)}
${this.indent()}}`;
      } else {
        code += guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body);
      }
      return code;
    }
    generateWhile(head, rest) {
      let cond = rest[0], guard = rest.length === 3 ? rest[1] : null, body = rest[rest.length - 1];
      let code = `while (${this.unwrap(this.generate(cond, "value"))}) `;
      return code + (guard ? this.generateLoopBodyWithGuard(body, guard) : this.generateLoopBody(body));
    }
    generateRange(head, rest) {
      if (head === "...") {
        if (rest.length === 1)
          return `...${this.generate(rest[0], "value")}`;
        let [s2, e2] = rest;
        let sc2 = this.generate(s2, "value"), ec2 = this.generate(e2, "value");
        return `((s, e) => Array.from({length: Math.max(0, Math.abs(e - s))}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${sc2}, ${ec2})`;
      }
      let [s, e] = rest;
      let sc = this.generate(s, "value"), ec = this.generate(e, "value");
      return `((s, e) => Array.from({length: Math.abs(e - s) + 1}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${sc}, ${ec})`;
    }
    generateNot(head, rest) {
      let [operand] = rest;
      if (typeof operand === "string" || operand instanceof String)
        return `!${this.generate(operand, "value")}`;
      if (Array.isArray(operand)) {
        let highPrec = [".", "?.", "[]", "optindex", "optcall"];
        if (highPrec.includes(operand[0]))
          return `!${this.generate(operand, "value")}`;
      }
      let code = this.generate(operand, "value");
      return code.startsWith("(") ? `!${code}` : `(!${code})`;
    }
    generateBitwiseNot(head, rest) {
      return `(~${this.generate(rest[0], "value")})`;
    }
    generateIncDec(head, rest) {
      let [operand, isPostfix] = rest;
      let code = this.generate(operand, "value");
      return isPostfix ? `(${code}${head})` : `(${head}${code})`;
    }
    generateTypeof(head, rest) {
      return `typeof ${this.generate(rest[0], "value")}`;
    }
    generateDelete(head, rest) {
      return `(delete ${this.generate(rest[0], "value")})`;
    }
    generateInstanceof(head, rest, context, sexpr) {
      let [expr, type] = rest;
      let isNeg = meta(sexpr[0], "invert");
      let result = `(${this.generate(expr, "value")} instanceof ${this.generate(type, "value")})`;
      return isNeg ? `(!${result})` : result;
    }
    generateIn(head, rest, context, sexpr) {
      let [key, container] = rest;
      let keyCode = this.generate(key, "value");
      let isNeg = meta(sexpr[0], "invert");
      if (this.is(container, "object")) {
        let result2 = `(${keyCode} in ${this.generate(container, "value")})`;
        return isNeg ? `(!${result2})` : result2;
      }
      let c = this.generate(container, "value");
      let result = `(Array.isArray(${c}) || typeof ${c} === 'string' ? ${c}.includes(${keyCode}) : (${keyCode} in ${c}))`;
      return isNeg ? `(!${result})` : result;
    }
    generateOf(head, rest, context, sexpr) {
      let [value, container] = rest;
      let v = this.generate(value, "value"), c = this.generate(container, "value");
      let isNeg = meta(sexpr[0], "invert");
      let result = `(${v} in ${c})`;
      return isNeg ? `(!${result})` : result;
    }
    generateRegexMatch(head, rest) {
      let [left, right] = rest;
      this.helpers.add("toMatchable");
      this.programVars.add("_");
      let r = this.generate(right, "value");
      let allowNL = r.includes("/m") ? ", true" : "";
      return `(_ = toMatchable(${this.generate(left, "value")}${allowNL}).match(${r}))`;
    }
    generateNew(head, rest) {
      let [call] = rest;
      if (this.is(call, ".") || this.is(call, "?.")) {
        let [accType, target, prop] = call;
        if (Array.isArray(target) && !target[0].startsWith) {
          return `(${this.generate(["new", target], "value")}).${prop}`;
        }
        return `new ${this.generate(target, "value")}.${prop}`;
      }
      if (Array.isArray(call)) {
        let [ctor, ...args] = call;
        return `new ${this.generate(ctor, "value")}(${args.map((a) => this.unwrap(this.generate(a, "value"))).join(", ")})`;
      }
      return `new ${this.generate(call, "value")}()`;
    }
    generateLogicalAnd(head, rest, context, sexpr) {
      let ops = this.flattenBinaryChain(sexpr).slice(1);
      if (ops.length === 0)
        return "true";
      if (ops.length === 1)
        return this.generate(ops[0], "value");
      return `(${ops.map((o) => this.generate(o, "value")).join(" && ")})`;
    }
    generateLogicalOr(head, rest, context, sexpr) {
      let ops = this.flattenBinaryChain(sexpr).slice(1);
      if (ops.length === 0)
        return "true";
      if (ops.length === 1)
        return this.generate(ops[0], "value");
      return `(${ops.map((o) => this.generate(o, "value")).join(" || ")})`;
    }
    generateArray(head, elements) {
      let hasTrailingElision = elements.length > 0 && elements[elements.length - 1] === ",";
      let codes = elements.map((el) => {
        if (el === ",")
          return "";
        if (el === "...")
          return "";
        if (this.is(el, "..."))
          return `...${this.generate(el[1], "value")}`;
        return this.generate(el, "value");
      }).join(", ");
      return hasTrailingElision ? `[${codes},]` : `[${codes}]`;
    }
    generateObject(head, pairs, context) {
      if (pairs.length === 1 && Array.isArray(pairs[0]) && Array.isArray(pairs[0][2]) && pairs[0][2][0] === "comprehension") {
        let [, keyVar, compNode] = pairs[0];
        let [, valueExpr, iterators, guards] = compNode;
        return this.generate(["object-comprehension", keyVar, valueExpr, iterators, guards], context);
      }
      let codes = pairs.map((pair) => {
        if (this.is(pair, "..."))
          return `...${this.generate(pair[1], "value")}`;
        let [operator, key, value] = pair;
        let keyCode;
        if (this.is(key, "dynamicKey"))
          keyCode = `[${this.generate(key[1], "value")}]`;
        else if (this.is(key, "str"))
          keyCode = `[${this.generate(key, "value")}]`;
        else {
          this.suppressReactiveUnwrap = true;
          keyCode = this.generate(key, "value");
          this.suppressReactiveUnwrap = false;
        }
        let valCode = this.generate(value, "value");
        if (operator === "=")
          return `${keyCode} = ${valCode}`;
        if (operator === ":")
          return `${keyCode}: ${valCode}`;
        if (keyCode === valCode && !Array.isArray(key))
          return keyCode;
        return `${keyCode}: ${valCode}`;
      }).join(", ");
      return `{${codes}}`;
    }
    generateMap(head, pairs, context) {
      if (pairs.length === 0)
        return "new Map()";
      let entries = pairs.map((pair) => {
        if (this.is(pair, "..."))
          return `...${this.generate(pair[1], "value")}`;
        let [, key, value] = pair;
        let keyCode;
        if (Array.isArray(key)) {
          keyCode = this.generate(key, "value");
        } else {
          let k = str(key) ?? key;
          let isIdentifier = !k.startsWith('"') && !k.startsWith("'") && !k.startsWith("/") && !CodeGenerator.NUMBER_START_RE.test(k) && !MAP_LITERAL_KEYS.has(k);
          keyCode = isIdentifier ? `"${k}"` : this.generate(key, "value");
        }
        let valCode = this.generate(value, "value");
        return `[${keyCode}, ${valCode}]`;
      }).join(", ");
      return `new Map([${entries}])`;
    }
    generateBlock(head, statements, context) {
      if (context === "statement") {
        let stmts = this.withIndent(() => this.formatStatements(statements));
        return `{
${stmts.join(`
`)}
${this.indent()}}`;
      }
      if (statements.length === 0)
        return "undefined";
      if (statements.length === 1)
        return this.generate(statements[0], context);
      let last = statements[statements.length - 1];
      let lastIsCtrl = Array.isArray(last) && ["break", "continue", "return", "throw"].includes(last[0]);
      if (lastIsCtrl) {
        let parts = statements.map((s) => this.addSemicolon(s, this.generate(s, "statement")));
        return `{
${this.withIndent(() => parts.map((p) => this.indent() + p).join(`
`))}
${this.indent()}}`;
      }
      return `(${statements.map((s) => this.generate(s, "value")).join(", ")})`;
    }
    generateTry(head, rest, context) {
      let needsReturns = context === "value";
      let tryCode = "try ";
      let tryBlock = rest[0];
      tryCode += needsReturns && this.is(tryBlock, "block") ? this.generateBlockWithReturns(tryBlock) : this.generate(tryBlock, "statement");
      if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== "block") {
        let [param, catchBlock] = rest[1];
        tryCode += " catch";
        if (param && (this.is(param, "object") || this.is(param, "array"))) {
          tryCode += " (error)";
          let destructStmt = `(${this.generate(param, "value")} = error)`;
          catchBlock = this.is(catchBlock, "block") ? ["block", destructStmt, ...catchBlock.slice(1)] : ["block", destructStmt, catchBlock];
        } else if (param) {
          tryCode += ` (${param})`;
        }
        tryCode += " " + (needsReturns && this.is(catchBlock, "block") ? this.generateBlockWithReturns(catchBlock) : this.generate(catchBlock, "statement"));
      } else if (rest.length === 2) {
        tryCode += " finally " + this.generate(rest[1], "statement");
      }
      if (rest.length === 3)
        tryCode += " finally " + this.generate(rest[2], "statement");
      if (rest.length === 1)
        tryCode += " catch {}";
      if (needsReturns) {
        let isAsync = this.containsAwait(rest[0]) || rest[1] && this.containsAwait(rest[1]);
        return `(${isAsync ? "async " : ""}() => { ${tryCode} })()`;
      }
      return tryCode;
    }
    generateThrow(head, rest, context) {
      let [expr] = rest;
      if (Array.isArray(expr)) {
        let checkExpr = expr, wrapperType = null;
        if (expr[0] === "new" && Array.isArray(expr[1]) && expr[1][0] === "if") {
          wrapperType = "new";
          checkExpr = expr[1];
        } else if (expr[0] === "if") {
          checkExpr = expr;
        }
        if (checkExpr[0] === "if") {
          let [, condition, body] = checkExpr;
          let unwrapped = Array.isArray(body) && body.length === 1 ? body[0] : body;
          expr = wrapperType === "new" ? ["new", unwrapped] : unwrapped;
          let condCode = this.generate(condition, "value");
          let throwCode = `throw ${this.generate(expr, "value")}`;
          return `if (${condCode}) {
${this.indent()}  ${throwCode};
${this.indent()}}`;
        }
      }
      let throwStmt = `throw ${this.generate(expr, "value")}`;
      return context === "value" ? `(() => { ${throwStmt}; })()` : throwStmt;
    }
    generateControl(head, rest, context) {
      let [rawOp, expr, ctrlSexpr] = rest;
      let op = str(rawOp);
      let isReturn = ctrlSexpr[0] === "return";
      let exprCode = this.generate(expr, "value");
      let ctrlValue = ctrlSexpr.length > 1 ? ctrlSexpr[1] : null;
      let ctrlCode = isReturn ? ctrlValue ? `return ${this.generate(ctrlValue, "value")}` : "return" : ctrlValue ? `throw ${this.generate(ctrlValue, "value")}` : "throw new Error()";
      let wrapped = this.wrapForCondition(exprCode);
      if (context === "value") {
        if (op === "??")
          return `(() => { const __v = ${exprCode}; if (__v == null) ${ctrlCode}; return __v; })()`;
        if (op === "||")
          return `(() => { const __v = ${exprCode}; if (!__v) ${ctrlCode}; return __v; })()`;
        return `(() => { const __v = ${exprCode}; if (__v) ${ctrlCode}; return __v; })()`;
      }
      if (op === "??")
        return `if (${wrapped} == null) ${ctrlCode}`;
      if (op === "||")
        return `if (!${wrapped}) ${ctrlCode}`;
      return `if (${wrapped}) ${ctrlCode}`;
    }
    generateSwitch(head, rest, context) {
      let [disc, whens, defaultCase] = rest;
      if (disc === null)
        return this.generateSwitchAsIfChain(whens, defaultCase, context);
      let switchBody = `switch (${this.generate(disc, "value")}) {
`;
      this.indentLevel++;
      for (let clause of whens) {
        let [, test, body] = clause;
        for (let t of test) {
          let tv = str(t) ?? t;
          let cv;
          if (Array.isArray(tv))
            cv = this.generate(tv, "value");
          else if (typeof tv === "string" && (tv.startsWith('"') || tv.startsWith("'")))
            cv = `'${tv.slice(1, -1)}'`;
          else
            cv = this.generate(tv, "value");
          switchBody += this.indent() + `case ${cv}:
`;
        }
        this.indentLevel++;
        switchBody += this.generateSwitchCaseBody(body, context);
        this.indentLevel--;
      }
      if (defaultCase) {
        switchBody += this.indent() + `default:
`;
        this.indentLevel++;
        switchBody += this.generateSwitchCaseBody(defaultCase, context);
        this.indentLevel--;
      }
      this.indentLevel--;
      switchBody += this.indent() + "}";
      if (context === "value") {
        let hasAwait = whens.some((w) => this.containsAwait(w[2])) || defaultCase && this.containsAwait(defaultCase);
        return `(${hasAwait ? "async " : ""}() => { ${switchBody} })()`;
      }
      return switchBody;
    }
    generateWhen() {
      throw new Error("when clause should be handled by switch");
    }
    _forInHeader(vars, iterable, step) {
      let va = Array.isArray(vars) ? vars : [vars];
      let noVar = va.length === 0;
      let [itemVar, indexVar] = noVar ? ["_i", null] : va;
      let ivp = this.is(itemVar, "array") || this.is(itemVar, "object") ? this.generateDestructuringPattern(itemVar) : itemVar;
      if (step && step !== null) {
        let ih = Array.isArray(iterable) && iterable[0];
        if (ih instanceof String)
          ih = str(ih);
        let isRange = ih === ".." || ih === "...";
        if (isRange) {
          let isExcl = ih === "...";
          let [s, e] = iterable.slice(1);
          let sc = this.generate(s, "value"), ec = this.generate(e, "value"), stc2 = this.generate(step, "value");
          return { header: `for (let ${ivp} = ${sc}; ${ivp} ${isExcl ? "<" : "<="} ${ec}; ${ivp} += ${stc2})`, setup: null };
        }
        let ic = this.generate(iterable, "value"), idxN = indexVar || "_i", stc = this.generate(step, "value");
        let isNeg = this.is(step, "-", 1);
        let isMinus1 = isNeg && (step[1] === "1" || step[1] === 1 || str(step[1]) === "1");
        let isPlus1 = !isNeg && (step === "1" || step === 1 || str(step) === "1");
        let update = isMinus1 ? `${idxN}--` : isPlus1 ? `${idxN}++` : `${idxN} += ${stc}`;
        let header = isNeg ? `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${update})` : `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${update})`;
        return { header, setup: noVar ? null : `const ${ivp} = ${ic}[${idxN}];` };
      }
      if (indexVar) {
        let ic = this.generate(iterable, "value");
        return {
          header: `for (let ${indexVar} = 0; ${indexVar} < ${ic}.length; ${indexVar}++)`,
          setup: `const ${ivp} = ${ic}[${indexVar}];`
        };
      }
      return { header: `for (const ${ivp} of ${this.generate(iterable, "value")})`, setup: null };
    }
    _forOfHeader(vars, iterable, own) {
      let va = Array.isArray(vars) ? vars : [vars];
      let [kv, vv] = va;
      let kvp = this.is(kv, "array") || this.is(kv, "object") ? this.generateDestructuringPattern(kv) : kv;
      let oc = this.generate(iterable, "value");
      return { header: `for (const ${kvp} in ${oc})`, own, vv, oc, kvp };
    }
    _forAsHeader(vars, iterable, isAwait) {
      let va = Array.isArray(vars) ? vars : [vars];
      let [fv] = va;
      let ivp = this.is(fv, "array") || this.is(fv, "object") ? this.generateDestructuringPattern(fv) : fv;
      return { header: `for ${isAwait ? "await " : ""}(const ${ivp} of ${this.generate(iterable, "value")})` };
    }
    generateComprehension(head, rest, context) {
      let [expr, iterators, guards] = rest;
      if (context === "statement")
        return this.generateComprehensionAsLoop(expr, iterators, guards);
      if (this.comprehensionTarget)
        return this.generateComprehensionWithTarget(expr, iterators, guards, this.comprehensionTarget);
      let hasAwait = this.containsAwait(expr);
      let code = `(${hasAwait ? "async " : ""}() => {
`;
      this.indentLevel++;
      this.comprehensionDepth++;
      code += this.indent() + `const result = [];
`;
      for (let iter of iterators) {
        let [iterType, vars, iterable, stepOrOwn] = iter;
        if (iterType === "for-in") {
          let { header, setup } = this._forInHeader(vars, iterable, stepOrOwn);
          code += this.indent() + header + ` {
`;
          this.indentLevel++;
          if (setup)
            code += this.indent() + setup + `
`;
        } else if (iterType === "for-of") {
          let { header, own, vv, oc, kvp } = this._forOfHeader(vars, iterable, stepOrOwn);
          code += this.indent() + header + ` {
`;
          this.indentLevel++;
          if (own)
            code += this.indent() + `if (!Object.hasOwn(${oc}, ${kvp})) continue;
`;
          if (vv)
            code += this.indent() + `const ${vv} = ${oc}[${kvp}];
`;
        } else if (iterType === "for-as") {
          let { header } = this._forAsHeader(vars, iterable, iter[3]);
          code += this.indent() + header + ` {
`;
          this.indentLevel++;
        }
      }
      for (let guard of guards) {
        code += this.indent() + `if (${this.generate(guard, "value")}) {
`;
        this.indentLevel++;
      }
      let hasCtrl = (node) => {
        if (typeof node === "string" && (node === "break" || node === "continue"))
          return true;
        if (!Array.isArray(node))
          return false;
        if (["break", "continue", "return", "throw"].includes(node[0]))
          return true;
        if (node[0] === "if")
          return node.slice(1).some(hasCtrl);
        return node.some(hasCtrl);
      };
      let loopStmts = ["for-in", "for-of", "for-as", "while", "loop"];
      if (this.is(expr, "block")) {
        for (let i = 0;i < expr.length - 1; i++) {
          let s = expr[i + 1], isLast = i === expr.length - 2;
          if (!isLast || hasCtrl(s)) {
            code += this.indent() + this.generate(s, "statement") + `;
`;
          } else if (Array.isArray(s) && loopStmts.includes(s[0])) {
            code += this.indent() + this.generate(s, "statement") + `;
`;
          } else {
            code += this.indent() + `result.push(${this.generate(s, "value")});
`;
          }
        }
      } else {
        if (hasCtrl(expr)) {
          code += this.indent() + this.generate(expr, "statement") + `;
`;
        } else if (Array.isArray(expr) && loopStmts.includes(expr[0])) {
          code += this.indent() + this.generate(expr, "statement") + `;
`;
        } else {
          code += this.indent() + `result.push(${this.generate(expr, "value")});
`;
        }
      }
      for (let i = 0;i < guards.length; i++) {
        this.indentLevel--;
        code += this.indent() + `}
`;
      }
      for (let i = 0;i < iterators.length; i++) {
        this.indentLevel--;
        code += this.indent() + `}
`;
      }
      code += this.indent() + `return result;
`;
      this.indentLevel--;
      this.comprehensionDepth--;
      code += this.indent() + "})()";
      return code;
    }
    generateObjectComprehension(head, rest, context) {
      let [keyExpr, valueExpr, iterators, guards] = rest;
      let code = `(() => {
`;
      this.indentLevel++;
      code += this.indent() + `const result = {};
`;
      for (let iter of iterators) {
        let [iterType, vars, iterable, own] = iter;
        if (iterType === "for-of") {
          let [kv, vv] = vars;
          let oc = this.generate(iterable, "value");
          code += this.indent() + `for (const ${kv} in ${oc}) {
`;
          this.indentLevel++;
          if (own)
            code += this.indent() + `if (!Object.hasOwn(${oc}, ${kv})) continue;
`;
          if (vv)
            code += this.indent() + `const ${vv} = ${oc}[${kv}];
`;
        }
      }
      for (let guard of guards) {
        code += this.indent() + `if (${this.generate(guard, "value")}) {
`;
        this.indentLevel++;
      }
      code += this.indent() + `result[${this.generate(keyExpr, "value")}] = ${this.generate(valueExpr, "value")};
`;
      for (let i = 0;i < guards.length; i++) {
        this.indentLevel--;
        code += this.indent() + `}
`;
      }
      for (let i = 0;i < iterators.length; i++) {
        this.indentLevel--;
        code += this.indent() + `}
`;
      }
      code += this.indent() + `return result;
`;
      this.indentLevel--;
      code += this.indent() + "})()";
      return code;
    }
    generateClass(head, rest, context) {
      let [className, parentClass, ...bodyParts] = rest;
      let code = className ? `class ${className}` : "class";
      if (parentClass)
        code += ` extends ${this.generate(parentClass, "value")}`;
      code += ` {
`;
      if (bodyParts.length > 0 && Array.isArray(bodyParts[0])) {
        let bodyBlock = bodyParts[0];
        if (bodyBlock[0] === "block") {
          let bodyStmts = bodyBlock.slice(1);
          let hasObjFirst = bodyStmts.length > 0 && Array.isArray(bodyStmts[0]) && bodyStmts[0][0] === "object";
          if (hasObjFirst && bodyStmts.length === 1) {
            let members = bodyStmts[0].slice(1);
            this.indentLevel++;
            let boundMethods = [];
            for (let [, mk, mv] of members) {
              let isStatic = this.is(mk, ".") && mk[1] === "this";
              let isComputed = this.is(mk, "computed");
              let mName = this.extractMemberName(mk);
              if (this.is(mv, "=>") && !isStatic && !isComputed && mName !== "constructor")
                boundMethods.push(mName);
            }
            for (let [, mk, mv] of members) {
              let isStatic = this.is(mk, ".") && mk[1] === "this";
              let isComputed = this.is(mk, "computed");
              let mName = this.extractMemberName(mk);
              if (this.is(mv, "->") || this.is(mv, "=>")) {
                let [, params, body] = mv;
                let hasAwait = this.containsAwait(body), hasYield = this.containsYield(body);
                let cleanParams = params, autoAssign = [];
                if (mName === "constructor") {
                  let isSubclass = !!parentClass;
                  let atParamMap = isSubclass ? new Map : null;
                  cleanParams = params.map((p) => {
                    if (this.is(p, ".") && p[1] === "this") {
                      let name = p[2];
                      let param = isSubclass ? `_${name}` : name;
                      autoAssign.push(`this.${name} = ${param}`);
                      if (isSubclass)
                        atParamMap.set(name, param);
                      return param;
                    }
                    if (this.is(p, "default") && this.is(p[1], ".") && p[1][1] === "this") {
                      let name = p[1][2];
                      let param = isSubclass ? `_${name}` : name;
                      autoAssign.push(`this.${name} = ${param}`);
                      if (isSubclass)
                        atParamMap.set(name, param);
                      return ["default", param, p[2]];
                    }
                    return p;
                  });
                  for (let bm of boundMethods)
                    autoAssign.unshift(`this.${bm} = this.${bm}.bind(this)`);
                  if (atParamMap?.size > 0)
                    this._atParamMap = atParamMap;
                }
                let pList = this.generateParamList(cleanParams);
                let prefix = (isStatic ? "static " : "") + (hasAwait ? "async " : "") + (hasYield ? "*" : "");
                code += this.indent() + `${prefix}${mName}(${pList}) `;
                if (!isComputed)
                  this.currentMethodName = mName;
                code += this.generateMethodBody(body, autoAssign, mName === "constructor", cleanParams);
                this._atParamMap = null;
                this.currentMethodName = null;
                code += `
`;
              } else if (isStatic) {
                code += this.indent() + `static ${mName} = ${this.generate(mv, "value")};
`;
              } else {
                code += this.indent() + `${mName} = ${this.generate(mv, "value")};
`;
              }
            }
            this.indentLevel--;
          } else if (hasObjFirst) {
            let members = bodyStmts[0].slice(1);
            let additionalStmts = bodyStmts.slice(1);
            this.indentLevel++;
            for (let [, mk, mv] of members) {
              let isStatic = this.is(mk, ".") && mk[1] === "this", mName = this.extractMemberName(mk);
              if (this.is(mv, "->") || this.is(mv, "=>")) {
                let [, params, body] = mv;
                let pList = this.generateParamList(params);
                let prefix = (isStatic ? "static " : "") + (this.containsAwait(body) ? "async " : "") + (this.containsYield(body) ? "*" : "");
                code += this.indent() + `${prefix}${mName}(${pList}) `;
                this.currentMethodName = mName;
                code += this.generateMethodBody(body, [], mName === "constructor", params);
                this.currentMethodName = null;
                code += `
`;
              } else if (isStatic) {
                code += this.indent() + `static ${mName} = ${this.generate(mv, "value")};
`;
              } else {
                code += this.indent() + `${mName} = ${this.generate(mv, "value")};
`;
              }
            }
            for (let stmt of additionalStmts) {
              if (this.is(stmt, "class")) {
                let [, nestedName, parent, ...nestedBody] = stmt;
                if (this.is(nestedName, ".") && nestedName[1] === "this") {
                  code += this.indent() + `static ${nestedName[2]} = ${this.generate(["class", null, parent, ...nestedBody], "value")};
`;
                }
              } else {
                code += this.indent() + this.generate(stmt, "statement") + `;
`;
              }
            }
            this.indentLevel--;
          } else {
            this.indentLevel++;
            for (let stmt of bodyStmts) {
              if (this.is(stmt, "=") && Array.isArray(stmt[1]) && stmt[1][0] === "." && stmt[1][1] === "this") {
                code += this.indent() + `static ${stmt[1][2]} = ${this.generate(stmt[2], "value")};
`;
              } else {
                code += this.indent() + this.generate(stmt, "statement") + `;
`;
              }
            }
            this.indentLevel--;
          }
        }
      }
      code += this.indent() + "}";
      return code;
    }
    generateSuper(head, rest) {
      if (rest.length === 0) {
        if (this.currentMethodName && this.currentMethodName !== "constructor")
          return `super.${this.currentMethodName}()`;
        return "super";
      }
      let args = rest.map((a) => this.unwrap(this.generate(a, "value"))).join(", ");
      if (this.currentMethodName && this.currentMethodName !== "constructor")
        return `super.${this.currentMethodName}(${args})`;
      return `super(${args})`;
    }
    generateImport(head, rest, context, sexpr) {
      if (rest.length === 1) {
        let importExpr = `import(${this.generate(rest[0], "value")})`;
        if (meta(sexpr[0], "await") === true)
          return `(await ${importExpr})`;
        return importExpr;
      }
      if (this.options.skipImports)
        return "";
      if (rest.length === 3) {
        let [def, named, source2] = rest;
        let fixedSource2 = this.addJsExtensionAndAssertions(source2);
        if (named[0] === "*" && named.length === 2)
          return `import ${def}, * as ${named[1]} from ${fixedSource2}`;
        let names = named.map((i) => Array.isArray(i) && i.length === 2 ? `${i[0]} as ${i[1]}` : i).join(", ");
        return `import ${def}, { ${names} } from ${fixedSource2}`;
      }
      let [specifier, source] = rest;
      let fixedSource = this.addJsExtensionAndAssertions(source);
      if (typeof specifier === "string")
        return `import ${specifier} from ${fixedSource}`;
      if (Array.isArray(specifier)) {
        if (specifier[0] === "*" && specifier.length === 2)
          return `import * as ${specifier[1]} from ${fixedSource}`;
        let names = specifier.map((i) => Array.isArray(i) && i.length === 2 ? `${i[0]} as ${i[1]}` : i).join(", ");
        return `import { ${names} } from ${fixedSource}`;
      }
      return `import ${this.generate(specifier, "value")} from ${fixedSource}`;
    }
    generateExport(head, rest) {
      let [decl] = rest;
      if (this.options.skipExports) {
        if (Array.isArray(decl) && decl.every((i) => typeof i === "string"))
          return "";
        if (this.is(decl, "=")) {
          const prev = this._componentName;
          if (this.is(decl[2], "component"))
            this._componentName = str(decl[1]);
          const result = `const ${decl[1]} = ${this.generate(decl[2], "value")}`;
          this._componentName = prev;
          return result;
        }
        return this.generate(decl, "statement");
      }
      if (Array.isArray(decl) && decl.every((i) => typeof i === "string"))
        return `export { ${decl.join(", ")} }`;
      if (this.is(decl, "=")) {
        const prev = this._componentName;
        if (this.is(decl[2], "component"))
          this._componentName = str(decl[1]);
        const result = `export const ${decl[1]} = ${this.generate(decl[2], "value")}`;
        this._componentName = prev;
        return result;
      }
      return `export ${this.generate(decl, "statement")}`;
    }
    generateExportDefault(head, rest) {
      let [expr] = rest;
      if (this.options.skipExports) {
        if (this.is(expr, "="))
          return `const ${expr[1]} = ${this.generate(expr[2], "value")}`;
        return this.generate(expr, "statement");
      }
      if (this.is(expr, "=")) {
        return `const ${expr[1]} = ${this.generate(expr[2], "value")};
export default ${expr[1]}`;
      }
      return `export default ${this.generate(expr, "statement")}`;
    }
    generateExportAll(head, rest) {
      if (this.options.skipExports)
        return "";
      return `export * from ${this.addJsExtensionAndAssertions(rest[0])}`;
    }
    generateExportFrom(head, rest) {
      if (this.options.skipExports)
        return "";
      let [specifiers, source] = rest;
      let fixedSource = this.addJsExtensionAndAssertions(source);
      if (Array.isArray(specifiers)) {
        let names = specifiers.map((i) => Array.isArray(i) && i.length === 2 ? `${i[0]} as ${i[1]}` : i).join(", ");
        return `export { ${names} } from ${fixedSource}`;
      }
      return `export ${specifiers} from ${fixedSource}`;
    }
    generateDoIIFE(head, rest) {
      return `(${this.generate(rest[0], "statement")})()`;
    }
    generateRegex(head, rest) {
      return rest.length === 0 ? head : this.generate(rest[0], "value");
    }
    generateTaggedTemplate(head, rest) {
      let [tag, s] = rest;
      let tagCode = this.generate(tag, "value");
      let content = this.generate(s, "value");
      if (content.startsWith("`"))
        return `${tagCode}${content}`;
      if (content.startsWith('"') || content.startsWith("'"))
        return `${tagCode}\`${content.slice(1, -1)}\``;
      return `${tagCode}\`${content}\``;
    }
    generateString(head, rest) {
      let result = "`";
      for (let part of rest) {
        if (part instanceof String) {
          result += this.extractStringContent(part);
        } else if (typeof part === "string") {
          if (part.startsWith('"') || part.startsWith("'")) {
            if (this.options.debug)
              console.warn("[Rip] Unexpected quoted primitive in str:", part);
            result += part.slice(1, -1);
          } else {
            result += part;
          }
        } else if (Array.isArray(part)) {
          if (part.length === 1 && typeof part[0] === "string" && !Array.isArray(part[0])) {
            let v = part[0];
            result += /^[\d"']/.test(v) ? "${" + this.generate(v, "value") + "}" : "${" + v + "}";
          } else {
            let expr = part.length === 1 && Array.isArray(part[0]) ? part[0] : part;
            result += "${" + this.generate(expr, "value") + "}";
          }
        }
      }
      return result + "`";
    }
    findPostfixConditional(expr) {
      if (!Array.isArray(expr))
        return null;
      let h = expr[0];
      if (h === "if" && expr.length === 3)
        return { type: h, condition: expr[1], value: expr[2] };
      if (h === "+" || h === "-" || h === "*" || h === "/") {
        for (let i = 1;i < expr.length; i++) {
          let found = this.findPostfixConditional(expr[i]);
          if (found) {
            found.parentOp = h;
            found.operandIndex = i;
            found.otherOperands = expr.slice(1).filter((_, idx) => idx !== i - 1);
            return found;
          }
        }
      }
      return null;
    }
    rebuildWithoutConditional(cond) {
      let val = Array.isArray(cond.value) && cond.value.length === 1 ? cond.value[0] : cond.value;
      if (cond.parentOp)
        return [cond.parentOp, ...cond.otherOperands, val];
      return val;
    }
    generateDestructuringPattern(pattern) {
      return this.formatParam(pattern);
    }
    generateParamList(params) {
      let expIdx = params.findIndex((p) => this.is(p, "expansion"));
      if (expIdx !== -1) {
        let before = params.slice(0, expIdx), after = params.slice(expIdx + 1);
        let regular = before.map((p) => this.formatParam(p)).join(", ");
        this.expansionAfterParams = after;
        return regular ? `${regular}, ..._rest` : "..._rest";
      }
      let restIdx = params.findIndex((p) => this.is(p, "rest"));
      if (restIdx !== -1 && restIdx < params.length - 1) {
        let before = params.slice(0, restIdx), restP = params[restIdx], after = params.slice(restIdx + 1);
        let beforeP = before.map((p) => this.formatParam(p));
        this.restMiddleParam = { restName: restP[1], afterParams: after, beforeCount: before.length };
        return beforeP.length > 0 ? `${beforeP.join(", ")}, ...${restP[1]}` : `...${restP[1]}`;
      }
      this.expansionAfterParams = null;
      this.restMiddleParam = null;
      return params.map((p) => this.formatParam(p)).join(", ");
    }
    formatParam(param) {
      if (typeof param === "string")
        return param;
      if (param instanceof String)
        return param.valueOf();
      if (this.is(param, "rest"))
        return `...${param[1]}`;
      if (this.is(param, "default"))
        return `${param[1]} = ${this.generate(param[2], "value")}`;
      if (this.is(param, ".") && param[1] === "this")
        return param[2];
      if (this.is(param, "array")) {
        let els = param.slice(1).map((el) => {
          if (el === ",")
            return "";
          if (el === "...")
            return "";
          if (this.is(el, "..."))
            return `...${el[1]}`;
          if (this.is(el, "=") && typeof el[1] === "string")
            return `${el[1]} = ${this.generate(el[2], "value")}`;
          if (typeof el === "string")
            return el;
          return this.formatParam(el);
        });
        return `[${els.join(", ")}]`;
      }
      if (this.is(param, "object")) {
        let pairs = param.slice(1).map((pair) => {
          if (this.is(pair, "..."))
            return `...${pair[1]}`;
          if (this.is(pair, "default"))
            return `${pair[1]} = ${this.generate(pair[2], "value")}`;
          let [operator, key, value] = pair;
          if (operator === "=")
            return `${key} = ${this.generate(value, "value")}`;
          if (key === value)
            return key;
          return `${key}: ${this.formatParam(value)}`;
        });
        return `{${pairs.join(", ")}}`;
      }
      return JSON.stringify(param);
    }
    generateBodyWithReturns(body, params = [], options = {}) {
      let { sideEffectOnly = false, autoAssignments = [], isConstructor = false, hasExpansionParams = false } = options;
      let prevSEO = this.sideEffectOnly;
      this.sideEffectOnly = sideEffectOnly;
      let paramNames = new Set;
      let extractPN = (p) => {
        if (typeof p === "string")
          paramNames.add(p);
        else if (Array.isArray(p)) {
          if (p[0] === "rest" || p[0] === "...") {
            if (typeof p[1] === "string")
              paramNames.add(p[1]);
          } else if (p[0] === "default") {
            if (typeof p[1] === "string")
              paramNames.add(p[1]);
          } else if (p[0] === "array" || p[0] === "object")
            this.collectVarsFromArray(p, paramNames);
        }
      };
      if (Array.isArray(params))
        params.forEach(extractPN);
      let bodyVars = this.collectFunctionVariables(body);
      let newVars = new Set([...bodyVars].filter((v) => !this.programVars.has(v) && !this.reactiveVars?.has(v) && !paramNames.has(v) && !this.scopeStack.some((s) => s.has(v))));
      let noRetStmts = ["return", "throw", "break", "continue"];
      let loopStmts = ["for-in", "for-of", "for-as", "while", "loop"];
      this.scopeStack.push(new Set([...newVars, ...paramNames]));
      if (this.is(body, "block")) {
        let statements = this.unwrapBlock(body);
        if (hasExpansionParams && this.expansionAfterParams?.length > 0) {
          let extr = this.expansionAfterParams.map((p, i) => {
            let pn = typeof p === "string" ? p : JSON.stringify(p);
            return `const ${pn} = _rest[_rest.length - ${this.expansionAfterParams.length - i}]`;
          });
          statements = [...extr, ...statements];
          this.expansionAfterParams = null;
        }
        if (this.restMiddleParam) {
          let { restName, afterParams } = this.restMiddleParam;
          let afterCount = afterParams.length;
          let extr = [];
          afterParams.forEach((p, i) => {
            let pn = typeof p === "string" ? p : this.is(p, "default") ? p[1] : JSON.stringify(p);
            extr.push(`const ${pn} = ${restName}[${restName}.length - ${afterCount - i}]`);
          });
          if (afterCount > 0)
            extr.push(`${restName} = ${restName}.slice(0, -${afterCount})`);
          statements = [...extr, ...statements];
          this.restMiddleParam = null;
        }
        this.indentLevel++;
        let code = `{
`;
        if (newVars.size > 0)
          code += this.indent() + `let ${Array.from(newVars).sort().join(", ")};
`;
        let firstIsSuper = autoAssignments.length > 0 && statements.length > 0 && Array.isArray(statements[0]) && statements[0][0] === "super";
        let genStatements = (stmts) => {
          stmts.forEach((stmt, index) => {
            let isLast = index === stmts.length - 1;
            let h = Array.isArray(stmt) ? stmt[0] : null;
            if (!isLast && h === "comprehension") {
              let [, expr, iters, guards] = stmt;
              code += this.indent() + this.generateComprehensionAsLoop(expr, iters, guards) + `
`;
              return;
            }
            if (!isConstructor && !sideEffectOnly && isLast && h === "if") {
              let [cond, thenB, ...elseB] = stmt.slice(1);
              let hasMulti = (b) => this.is(b, "block") && b.length > 2;
              let hasCtrlStmt = this.hasStatementInBranch(thenB) || elseB.some((b) => this.hasStatementInBranch(b));
              if (hasCtrlStmt || hasMulti(thenB) || elseB.some(hasMulti)) {
                code += this.generateIfElseWithEarlyReturns(stmt) + `
`;
                return;
              }
            }
            if (!isConstructor && !sideEffectOnly && isLast && h === "=") {
              let [target, value] = stmt.slice(1);
              if (typeof target === "string" && Array.isArray(value)) {
                let vh = value[0];
                if (vh === "comprehension" || vh === "for-in") {
                  this.comprehensionTarget = target;
                  code += this.generate(value, "value");
                  this.comprehensionTarget = null;
                  code += this.indent() + `return ${target};
`;
                  return;
                }
              }
            }
            let needsReturn = !isConstructor && !sideEffectOnly && isLast && !noRetStmts.includes(h) && !loopStmts.includes(h) && !this.hasExplicitControlFlow(stmt);
            let ctx = needsReturn ? "value" : "statement";
            let sc = this.generate(stmt, ctx);
            if (needsReturn)
              code += this.indent() + "return " + sc + `;
`;
            else
              code += this.indent() + this.addSemicolon(stmt, sc) + `
`;
          });
        };
        if (firstIsSuper) {
          let isSuperOnly = statements.length === 1;
          if (isSuperOnly && !isConstructor)
            code += this.indent() + "return " + this.generate(statements[0], "value") + `;
`;
          else
            code += this.indent() + this.generate(statements[0], "statement") + `;
`;
          for (let a of autoAssignments)
            code += this.indent() + a + `;
`;
          genStatements(statements.slice(1));
        } else {
          for (let a of autoAssignments)
            code += this.indent() + a + `;
`;
          genStatements(statements);
        }
        if (sideEffectOnly && statements.length > 0) {
          let lastH = Array.isArray(statements[statements.length - 1]) ? statements[statements.length - 1][0] : null;
          if (!noRetStmts.includes(lastH))
            code += this.indent() + `return;
`;
        }
        this.indentLevel--;
        code += this.indent() + "}";
        this.scopeStack.pop();
        this.sideEffectOnly = prevSEO;
        return code;
      }
      this.sideEffectOnly = prevSEO;
      let result;
      if (isConstructor && autoAssignments.length > 0) {
        let isSuper = Array.isArray(body) && body[0] === "super";
        let bodyCode = this.generate(body, "statement");
        let assigns = autoAssignments.map((a) => `${a};`).join(" ");
        result = isSuper ? `{ ${bodyCode}; ${assigns} }` : `{ ${assigns} ${bodyCode}; }`;
      } else if (isConstructor || this.hasExplicitControlFlow(body))
        result = `{ ${this.generate(body, "statement")}; }`;
      else if (Array.isArray(body) && (noRetStmts.includes(body[0]) || loopStmts.includes(body[0])))
        result = `{ ${this.generate(body, "statement")}; }`;
      else if (sideEffectOnly)
        result = `{ ${this.generate(body, "statement")}; return; }`;
      else
        result = `{ return ${this.generate(body, "value")}; }`;
      this.scopeStack.pop();
      return result;
    }
    generateFunctionBody(body, params = [], sideEffectOnly = false) {
      return this.generateBodyWithReturns(body, params, { sideEffectOnly, hasExpansionParams: this.expansionAfterParams?.length > 0 });
    }
    generateMethodBody(body, autoAssignments = [], isConstructor = false, params = []) {
      return this.generateBodyWithReturns(body, params, { autoAssignments, isConstructor });
    }
    generateBlockWithReturns(block) {
      if (!Array.isArray(block) || block[0] !== "block")
        return this.generate(block, "statement");
      let stmts = this.unwrapBlock(block);
      let lines = this.withIndent(() => stmts.map((stmt, i) => {
        let isLast = i === stmts.length - 1;
        let h = Array.isArray(stmt) ? stmt[0] : null;
        let needsReturn = isLast && !["return", "throw", "break", "continue"].includes(h);
        let code = this.generate(stmt, needsReturn ? "value" : "statement");
        return needsReturn ? this.indent() + "return " + code + ";" : this.indent() + code + ";";
      }));
      return `{
${lines.join(`
`)}
${this.indent()}}`;
    }
    generateLoopBody(body) {
      if (!Array.isArray(body))
        return `{ ${this.generate(body, "statement")}; }`;
      if (body[0] === "block" || Array.isArray(body[0])) {
        let stmts = body[0] === "block" ? body.slice(1) : body;
        let lines = this.withIndent(() => stmts.map((s) => {
          if (this.is(s, "comprehension")) {
            let [, expr, iters, guards] = s;
            return this.indent() + this.generateComprehensionAsLoop(expr, iters, guards);
          }
          return this.indent() + this.addSemicolon(s, this.generate(s, "statement"));
        }));
        return `{
${lines.join(`
`)}
${this.indent()}}`;
      }
      return `{ ${this.generate(body, "statement")}; }`;
    }
    generateLoopBodyWithGuard(body, guard) {
      let guardCond = this.unwrap(this.generate(guard, "value"));
      if (!Array.isArray(body))
        return `{ if (${guardCond}) ${this.generate(body, "statement")}; }`;
      if (body[0] === "block" || Array.isArray(body[0])) {
        let stmts = body[0] === "block" ? body.slice(1) : body;
        let loopIndent = this.withIndent(() => this.indent());
        let guardCode = `if (${guardCond}) {
`;
        let innerStmts = this.withIndent(() => {
          this.indentLevel++;
          let r = this.formatStatements(stmts);
          this.indentLevel--;
          return r;
        });
        let close = this.withIndent(() => this.indent() + "}");
        return `{
${loopIndent}${guardCode}${innerStmts.join(`
`)}
${close}
${this.indent()}}`;
      }
      return `{ if (${this.generate(guard, "value")}) ${this.generate(body, "statement")}; }`;
    }
    generateComprehensionWithTarget(expr, iterators, guards, targetVar) {
      let code = "";
      code += this.indent() + `${targetVar} = [];
`;
      let unwrappedExpr = this.is(expr, "block") && expr.length === 2 ? expr[1] : expr;
      if (iterators.length === 1) {
        let [iterType, vars, iterable, stepOrOwn] = iterators[0];
        if (iterType === "for-in") {
          let { header, setup } = this._forInHeader(vars, iterable, stepOrOwn);
          code += this.indent() + header + ` {
`;
          this.indentLevel++;
          if (setup)
            code += this.indent() + setup + `
`;
          if (guards && guards.length > 0) {
            code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
            this.indentLevel++;
          }
          code += this.indent() + `${targetVar}.push(${this.unwrap(this.generate(unwrappedExpr, "value"))});
`;
          if (guards && guards.length > 0) {
            this.indentLevel--;
            code += this.indent() + `}
`;
          }
          this.indentLevel--;
          code += this.indent() + `}
`;
          return code;
        }
      }
      return this.indent() + `${targetVar} = (() => { /* complex comprehension */ })();
`;
    }
    generateComprehensionAsLoop(expr, iterators, guards) {
      let code = "";
      let guardCond = guards?.length ? guards.map((g) => this.generate(g, "value")).join(" && ") : null;
      let emitBody = () => {
        if (guardCond) {
          code += this.indent() + `if (${guardCond}) {
`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
        } else {
          code += this.indent() + this.generate(expr, "statement") + `;
`;
        }
      };
      if (iterators.length === 1) {
        let [iterType, vars, iterable, stepOrOwn] = iterators[0];
        if (iterType === "for-in") {
          let { header, setup } = this._forInHeader(vars, iterable, stepOrOwn);
          code += header + ` {
`;
          this.indentLevel++;
          if (setup)
            code += this.indent() + setup + `
`;
          emitBody();
          this.indentLevel--;
          code += this.indent() + "}";
          return code;
        }
        if (iterType === "for-as") {
          let { header } = this._forAsHeader(vars, iterable, stepOrOwn);
          code += header + ` {
`;
          this.indentLevel++;
          emitBody();
          this.indentLevel--;
          code += this.indent() + "}";
          return code;
        }
        if (iterType === "for-of") {
          let { header, own, vv, oc, kvp } = this._forOfHeader(vars, iterable, stepOrOwn);
          code += header + ` {
`;
          this.indentLevel++;
          if (own)
            code += this.indent() + `if (!Object.hasOwn(${oc}, ${kvp})) continue;
`;
          if (vv)
            code += this.indent() + `const ${vv} = ${oc}[${kvp}];
`;
          emitBody();
          this.indentLevel--;
          code += this.indent() + "}";
          return code;
        }
      }
      return this.generate(["comprehension", expr, iterators, guards], "value");
    }
    generateIfElseWithEarlyReturns(ifStmt) {
      let [head, condition, thenBranch, ...elseBranches] = ifStmt;
      let code = "";
      let condCode = this.generate(condition, "value");
      code += this.indent() + `if (${condCode}) {
`;
      code += this.withIndent(() => this.generateBranchWithReturn(thenBranch));
      code += this.indent() + "}";
      for (let branch of elseBranches) {
        code += " else ";
        if (this.is(branch, "if")) {
          let [, nc, nt, ...ne] = branch;
          code += `if (${this.generate(nc, "value")}) {
`;
          code += this.withIndent(() => this.generateBranchWithReturn(nt));
          code += this.indent() + "}";
          for (let rb of ne) {
            code += ` else {
`;
            code += this.withIndent(() => this.generateBranchWithReturn(rb));
            code += this.indent() + "}";
          }
        } else {
          code += `{
`;
          code += this.withIndent(() => this.generateBranchWithReturn(branch));
          code += this.indent() + "}";
        }
      }
      return code;
    }
    generateBranchWithReturn(branch) {
      branch = this.unwrapIfBranch(branch);
      let stmts = this.unwrapBlock(branch);
      let code = "";
      for (let i = 0;i < stmts.length; i++) {
        let isLast = i === stmts.length - 1, s = stmts[i];
        let h = Array.isArray(s) ? s[0] : null;
        let hasCtrl = h === "return" || h === "throw" || h === "break" || h === "continue";
        if (isLast && !hasCtrl)
          code += this.indent() + `return ${this.generate(s, "value")};
`;
        else
          code += this.indent() + this.generate(s, "statement") + `;
`;
      }
      return code;
    }
    generateIfAsExpression(condition, thenBranch, elseBranches) {
      let needsIIFE = this.is(thenBranch, "block") && thenBranch.length > 2 || this.hasStatementInBranch(thenBranch) || elseBranches.some((b) => this.is(b, "block") && b.length > 2 || this.hasStatementInBranch(b) || this.hasNestedMultiStatement(b));
      if (needsIIFE) {
        let hasAwait = this.containsAwait(condition) || this.containsAwait(thenBranch) || elseBranches.some((b) => this.containsAwait(b));
        let code = `${hasAwait ? "await " : ""}(${hasAwait ? "async " : ""}() => { `;
        code += `if (${this.generate(condition, "value")}) `;
        code += this.generateBlockWithReturns(thenBranch);
        for (let branch of elseBranches) {
          code += " else ";
          if (this.is(branch, "if")) {
            let [_, nc, nt, ...ne] = branch;
            code += `if (${this.generate(nc, "value")}) `;
            code += this.generateBlockWithReturns(nt);
            for (let nb of ne) {
              code += " else ";
              if (this.is(nb, "if")) {
                let [__, nnc, nnt, ...nne] = nb;
                code += `if (${this.generate(nnc, "value")}) `;
                code += this.generateBlockWithReturns(nnt);
                elseBranches.push(...nne);
              } else {
                code += this.generateBlockWithReturns(nb);
              }
            }
          } else {
            code += this.generateBlockWithReturns(branch);
          }
        }
        return code + " })()";
      }
      let thenExpr = this.extractExpression(this.unwrapIfBranch(thenBranch));
      let elseExpr = this.buildTernaryChain(elseBranches);
      let condCode = this.generate(condition, "value");
      if (this.is(condition, "yield") || this.is(condition, "await"))
        condCode = `(${condCode})`;
      return `(${condCode} ? ${thenExpr} : ${elseExpr})`;
    }
    generateIfAsStatement(condition, thenBranch, elseBranches) {
      let code = `if (${this.unwrap(this.generate(condition, "value"))}) `;
      code += this.generate(this.unwrapIfBranch(thenBranch), "statement");
      for (let branch of elseBranches)
        code += ` else ` + this.generate(this.unwrapIfBranch(branch), "statement");
      return code;
    }
    generateSwitchCaseBody(body, context) {
      let code = "";
      let hasFlow = this.hasExplicitControlFlow(body);
      let stmts = this.unwrapBlock(body);
      if (hasFlow) {
        for (let s of stmts)
          code += this.indent() + this.generate(s, "statement") + `;
`;
      } else if (context === "value") {
        if (this.is(body, "block") && body.length > 2) {
          for (let i = 0;i < stmts.length; i++) {
            if (i === stmts.length - 1)
              code += this.indent() + `return ${this.generate(stmts[i], "value")};
`;
            else
              code += this.indent() + this.generate(stmts[i], "statement") + `;
`;
          }
        } else {
          code += this.indent() + `return ${this.extractExpression(body)};
`;
        }
      } else {
        if (stmts.length === 1 && this.is(stmts[0], "if") && !this.hasStatementInBranch(stmts[0]) && !this.hasNestedMultiStatement(stmts[0])) {
          let [_, condition, thenBranch, ...elseBranches] = stmts[0];
          let thenExpr = this.extractExpression(this.unwrapIfBranch(thenBranch));
          let elseExpr = this.buildTernaryChain(elseBranches);
          code += this.indent() + `(${this.unwrap(this.generate(condition, "value"))} ? ${thenExpr} : ${elseExpr});
`;
        } else if (this.is(body, "block") && body.length > 1) {
          for (let s of stmts)
            code += this.indent() + this.generate(s, "statement") + `;
`;
        } else {
          code += this.indent() + this.generate(body, "statement") + `;
`;
        }
        code += this.indent() + `break;
`;
      }
      return code;
    }
    generateSwitchAsIfChain(whens, defaultCase, context) {
      let code = "";
      for (let i = 0;i < whens.length; i++) {
        let [, test, body] = whens[i];
        let cond = Array.isArray(test) ? test[0] : test;
        code += (i === 0 ? "" : " else ") + `if (${this.generate(cond, "value")}) {
`;
        this.indentLevel++;
        if (context === "value")
          code += this.indent() + `return ${this.extractExpression(body)};
`;
        else
          for (let s of this.unwrapBlock(body))
            code += this.indent() + this.generate(s, "statement") + `;
`;
        this.indentLevel--;
        code += this.indent() + "}";
      }
      if (defaultCase) {
        code += ` else {
`;
        this.indentLevel++;
        if (context === "value")
          code += this.indent() + `return ${this.extractExpression(defaultCase)};
`;
        else
          for (let s of this.unwrapBlock(defaultCase))
            code += this.indent() + this.generate(s, "statement") + `;
`;
        this.indentLevel--;
        code += this.indent() + "}";
      }
      return context === "value" ? `(() => { ${code} })()` : code;
    }
    extractExpression(branch) {
      let stmts = this.unwrapBlock(branch);
      return stmts.length > 0 ? this.generate(stmts[stmts.length - 1], "value") : "undefined";
    }
    unwrapBlock(body) {
      if (!Array.isArray(body))
        return [body];
      if (body[0] === "block")
        return body.slice(1);
      if (Array.isArray(body[0])) {
        if (typeof body[0][0] === "string")
          return [body];
        return body;
      }
      return [body];
    }
    indent() {
      return this.indentString.repeat(this.indentLevel);
    }
    needsSemicolon(stmt, generated) {
      if (!generated || generated.endsWith(";"))
        return false;
      if (!generated.endsWith("}"))
        return true;
      let h = Array.isArray(stmt) ? stmt[0] : null;
      return !["def", "class", "if", "for-in", "for-of", "for-as", "while", "loop", "switch", "try"].includes(h);
    }
    addSemicolon(stmt, generated) {
      return generated + (this.needsSemicolon(stmt, generated) ? ";" : "");
    }
    formatStatements(stmts, context = "statement") {
      return stmts.map((s) => this.indent() + this.addSemicolon(s, this.generate(s, context)));
    }
    wrapForCondition(code) {
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(code))
        return code;
      if (code.startsWith("(") && code.endsWith(")"))
        return code;
      return `(${code})`;
    }
    hasExplicitControlFlow(body) {
      if (!Array.isArray(body))
        return false;
      let t = body[0];
      if (t === "return" || t === "throw" || t === "break" || t === "continue")
        return true;
      if (t === "block")
        return body.slice(1).some((s) => Array.isArray(s) && ["return", "throw", "break", "continue"].includes(s[0]));
      if (t === "switch") {
        let [, , whens] = body;
        return whens?.some((w) => {
          let stmts = this.unwrapBlock(w[2]);
          return stmts.some((s) => Array.isArray(s) && ["return", "throw", "break", "continue"].includes(s[0]));
        });
      }
      if (t === "if") {
        let [, , thenB, elseB] = body;
        return this.branchHasControlFlow(thenB) && elseB && this.branchHasControlFlow(elseB);
      }
      return false;
    }
    branchHasControlFlow(branch) {
      if (!Array.isArray(branch))
        return false;
      let stmts = this.unwrapBlock(branch);
      if (stmts.length === 0)
        return false;
      let last = stmts[stmts.length - 1];
      return Array.isArray(last) && ["return", "throw", "break", "continue"].includes(last[0]);
    }
    withIndent(callback) {
      this.indentLevel++;
      let result = callback();
      this.indentLevel--;
      return result;
    }
    is(node, op, arity) {
      if (!Array.isArray(node))
        return null;
      if ((str(node[0]) ?? node[0]) !== op)
        return null;
      let args = node.slice(1);
      if (arity != null && args.length !== arity)
        return null;
      return args;
    }
    unwrap(code) {
      if (typeof code !== "string")
        return code;
      while (code.startsWith("(") && code.endsWith(")")) {
        let pd = 0, bd = 0, canUnwrap = true, hasComma = false;
        for (let i = 0;i < code.length; i++) {
          if (code[i] === "(")
            pd++;
          if (code[i] === ")")
            pd--;
          if (code[i] === "[" || code[i] === "{")
            bd++;
          if (code[i] === "]" || code[i] === "}")
            bd--;
          if (code[i] === "," && pd === 1 && bd === 0)
            hasComma = true;
          if (pd === 0 && i < code.length - 1) {
            canUnwrap = false;
            break;
          }
        }
        if (hasComma)
          canUnwrap = false;
        if (canUnwrap)
          code = code.slice(1, -1);
        else
          break;
      }
      return code;
    }
    _findOptionalInTarget(node) {
      if (!Array.isArray(node))
        return null;
      if (node[0] === "?.")
        return { guard: node[1], rewritten: [".", node[1], node[2]] };
      if (node[0] === "optindex")
        return { guard: node[1], rewritten: ["[]", node[1], node[2]] };
      if (node[0] === "." || node[0] === "[]") {
        let inner = this._findOptionalInTarget(node[1]);
        if (inner)
          return { guard: inner.guard, rewritten: [node[0], inner.rewritten, node[2]] };
      }
      return null;
    }
    unwrapLogical(code) {
      if (typeof code !== "string")
        return code;
      while (code.startsWith("(") && code.endsWith(")")) {
        let depth = 0, minDepth = Infinity;
        for (let i = 1;i < code.length - 1; i++) {
          if (code[i] === "(")
            depth++;
          if (code[i] === ")")
            depth--;
          minDepth = Math.min(minDepth, depth);
        }
        if (minDepth >= 0)
          code = code.slice(1, -1);
        else
          break;
      }
      return code;
    }
    unwrapIfBranch(branch) {
      if (Array.isArray(branch) && branch.length === 1 && (!Array.isArray(branch[0]) || branch[0][0] !== "block"))
        return branch[0];
      return branch;
    }
    flattenBinaryChain(sexpr) {
      if (!Array.isArray(sexpr) || sexpr.length < 3)
        return sexpr;
      let [head, ...rest] = sexpr;
      if (head !== "&&" && head !== "||")
        return sexpr;
      let ops = [];
      let collect = (expr) => {
        if (Array.isArray(expr) && expr[0] === head) {
          for (let i = 1;i < expr.length; i++)
            collect(expr[i]);
        } else
          ops.push(expr);
      };
      for (let op of rest)
        collect(op);
      return [head, ...ops];
    }
    hasStatementInBranch(branch) {
      if (!Array.isArray(branch))
        return false;
      if (branch.length === 1 && Array.isArray(branch[0]))
        return this.hasStatementInBranch(branch[0]);
      let h = branch[0];
      if (h === "return" || h === "throw" || h === "break" || h === "continue")
        return true;
      if (h === "block")
        return branch.slice(1).some((s) => this.hasStatementInBranch(s));
      return false;
    }
    hasNestedMultiStatement(branch) {
      if (!Array.isArray(branch))
        return false;
      if (branch[0] === "if") {
        let [_, cond, then_, ...elseB] = branch;
        return this.is(then_, "block") && then_.length > 2 || elseB.some((b) => this.hasNestedMultiStatement(b));
      }
      return false;
    }
    buildTernaryChain(branches) {
      if (branches.length === 0)
        return "undefined";
      if (branches.length === 1)
        return this.extractExpression(this.unwrapIfBranch(branches[0]));
      let first = branches[0];
      if (this.is(first, "if")) {
        let [_, cond, then_, ...rest] = first;
        let thenPart = this.extractExpression(this.unwrapIfBranch(then_));
        let elsePart = this.buildTernaryChain([...rest, ...branches.slice(1)]);
        return `(${this.generate(cond, "value")} ? ${thenPart} : ${elsePart})`;
      }
      return this.extractExpression(this.unwrapIfBranch(first));
    }
    collectVarsFromArray(arr, varSet) {
      arr.slice(1).forEach((item) => {
        if (item === "," || item === "...")
          return;
        if (typeof item === "string") {
          varSet.add(item);
          return;
        }
        if (Array.isArray(item)) {
          if (item[0] === "..." && typeof item[1] === "string")
            varSet.add(item[1]);
          else if (item[0] === "array")
            this.collectVarsFromArray(item, varSet);
          else if (item[0] === "object")
            this.collectVarsFromObject(item, varSet);
        }
      });
    }
    collectVarsFromObject(obj, varSet) {
      obj.slice(1).forEach((pair) => {
        if (!Array.isArray(pair))
          return;
        if (pair[0] === "..." && typeof pair[1] === "string") {
          varSet.add(pair[1]);
          return;
        }
        if (pair.length >= 2) {
          let [operator, key, value] = pair;
          if (operator === "=") {
            if (typeof key === "string")
              varSet.add(key);
          } else {
            if (typeof value === "string")
              varSet.add(value);
            else if (Array.isArray(value)) {
              if (value[0] === "array")
                this.collectVarsFromArray(value, varSet);
              else if (value[0] === "object")
                this.collectVarsFromObject(value, varSet);
            }
          }
        }
      });
    }
    extractStringContent(strObj) {
      let content = str(strObj).slice(1, -1);
      let indent = meta(strObj, "indent");
      if (indent)
        content = content.replace(new RegExp(`\\n${indent}`, "g"), `
`);
      if (meta(strObj, "initialChunk") && content.startsWith(`
`))
        content = content.slice(1);
      if (meta(strObj, "finalChunk") && content.endsWith(`
`))
        content = content.slice(0, -1);
      return content;
    }
    processHeregex(content) {
      let result = "", inCharClass = false, i = 0;
      let isEscaped = () => {
        let c = 0, j = i - 1;
        while (j >= 0 && content[j] === "\\") {
          c++;
          j--;
        }
        return c % 2 === 1;
      };
      while (i < content.length) {
        let ch = content[i];
        if (ch === "[" && !isEscaped()) {
          inCharClass = true;
          result += ch;
          i++;
          continue;
        }
        if (ch === "]" && inCharClass && !isEscaped()) {
          inCharClass = false;
          result += ch;
          i++;
          continue;
        }
        if (inCharClass) {
          result += ch;
          i++;
          continue;
        }
        if (/\s/.test(ch)) {
          i++;
          continue;
        }
        if (ch === "#") {
          if (isEscaped()) {
            result += ch;
            i++;
            continue;
          }
          let j = i - 1;
          while (j >= 0 && content[j] === "\\")
            j--;
          if (j < i - 1) {
            result += ch;
            i++;
            continue;
          }
          while (i < content.length && content[i] !== `
`)
            i++;
          continue;
        }
        result += ch;
        i++;
      }
      return result;
    }
    addJsExtensionAndAssertions(source) {
      if (source instanceof String)
        source = str(source);
      if (typeof source !== "string")
        return source;
      let hasQuotes = source.startsWith('"') || source.startsWith("'");
      let path = hasQuotes ? source.slice(1, -1) : source;
      let isLocal = path.startsWith("./") || path.startsWith("../");
      let finalPath = path, assertion = "";
      if (isLocal) {
        let lastSlash = path.lastIndexOf("/");
        let fileName = lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
        let hasExt = fileName.includes(".");
        if (hasExt) {
          if (fileName.endsWith(".json"))
            assertion = " with { type: 'json' }";
        } else
          finalPath = path + ".js";
      }
      return `'${finalPath}'` + assertion;
    }
    containsIt(sexpr) {
      if (!sexpr)
        return false;
      if (sexpr === "it" || sexpr instanceof String && str(sexpr) === "it")
        return true;
      if (typeof sexpr !== "object")
        return false;
      if (this.is(sexpr, "def") || this.is(sexpr, "->") || this.is(sexpr, "=>"))
        return false;
      if (Array.isArray(sexpr))
        return sexpr.some((item) => this.containsIt(item));
      return false;
    }
    containsAwait(sexpr) {
      if (!sexpr)
        return false;
      if (sexpr instanceof String && meta(sexpr, "await") === true)
        return true;
      if (typeof sexpr !== "object")
        return false;
      if (this.is(sexpr, "await"))
        return true;
      if (this.is(sexpr, "for-as") && sexpr[3] === true)
        return true;
      if (this.is(sexpr, "def") || this.is(sexpr, "->") || this.is(sexpr, "=>") || this.is(sexpr, "class"))
        return false;
      if (Array.isArray(sexpr))
        return sexpr.some((item) => this.containsAwait(item));
      return false;
    }
    containsYield(sexpr) {
      if (!sexpr)
        return false;
      if (typeof sexpr !== "object")
        return false;
      if (this.is(sexpr, "yield") || this.is(sexpr, "yield-from"))
        return true;
      if (this.is(sexpr, "def") || this.is(sexpr, "->") || this.is(sexpr, "=>") || this.is(sexpr, "class"))
        return false;
      if (Array.isArray(sexpr))
        return sexpr.some((item) => this.containsYield(item));
      return false;
    }
    extractMemberName(mk) {
      if (this.is(mk, ".") && mk[1] === "this")
        return mk[2];
      if (this.is(mk, "computed"))
        return `[${this.generate(mk[1], "value")}]`;
      return mk;
    }
    getReactiveRuntime() {
      return `// ============================================================================
// Rip Reactive Runtime
// A minimal, fine-grained reactivity system
//
// Reactivity:
//   __state(value)     - Reactive state container
//   __computed(fn)     - Computed value (lazy, cached)
//   __effect(fn)       - Side effect that re-runs when dependencies change
//   __batch(fn)        - Group multiple updates into one flush
//   __readonly(value)  - Immutable value wrapper
//
// Error Handling:
//   __catchErrors(fn)  - Wrap function to route errors to handler
//   __handleError(err) - Route error to handler
//
// How reactivity works:
//   - Reading a state/computed inside an effect tracks it as a dependency
//   - Writing to a state notifies all subscribers
//   - Batching defers effect execution until the batch completes
// ============================================================================

// Global state for dependency tracking
let __currentEffect = null;   // The effect/computed currently being evaluated
let __pendingEffects = new Set();  // Effects queued to run
let __batching = false;       // Are we inside a batch()?

// Flush all pending effects (called after state updates, or at end of batch)
function __flushEffects() {
  const effects = [...__pendingEffects];
  __pendingEffects.clear();
  for (const effect of effects) effect.run();
}

// Shared primitive coercion (used by state and computed)
const __primitiveCoercion = {
  valueOf() { return this.value; },
  toString() { return String(this.value); },
  [Symbol.toPrimitive](hint) { return hint === 'string' ? this.toString() : this.valueOf(); }
};

function __state(initialValue) {
  if (initialValue != null && typeof initialValue === 'object' && typeof initialValue.read === 'function') return initialValue;
  let value = initialValue;
  const subscribers = new Set();
  let notifying = false;
  let locked = false;
  let dead = false;

  const state = {
    get value() {
      if (dead) return value;
      if (__currentEffect) {
        subscribers.add(__currentEffect);
        __currentEffect.dependencies.add(subscribers);
      }
      return value;
    },

    set value(newValue) {
      if (dead || locked || newValue === value || notifying) return;
      value = newValue;
      notifying = true;
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();
        else __pendingEffects.add(sub);
      }
      if (!__batching) __flushEffects();
      notifying = false;
    },

    read() { return value; },
    touch() {
      if (dead || notifying) return;
      notifying = true;
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();
        else __pendingEffects.add(sub);
      }
      if (!__batching) __flushEffects();
      notifying = false;
    },
    lock() { locked = true; return state; },
    free() { subscribers.clear(); return state; },
    kill() { dead = true; subscribers.clear(); return value; },

    ...__primitiveCoercion
  };
  return state;
}

function __computed(fn) {
  let value;
  let dirty = true;
  const subscribers = new Set();
  let locked = false;
  let dead = false;

  const computed = {
    dependencies: new Set(),

    markDirty() {
      if (dead || locked || dirty) return;
      dirty = true;
      for (const sub of subscribers) {
        if (sub.markDirty) sub.markDirty();
        else __pendingEffects.add(sub);
      }
    },

    get value() {
      if (dead) return value;
      if (__currentEffect) {
        subscribers.add(__currentEffect);
        __currentEffect.dependencies.add(subscribers);
      }
      if (dirty && !locked) {
        for (const dep of computed.dependencies) dep.delete(computed);
        computed.dependencies.clear();
        const prev = __currentEffect;
        __currentEffect = computed;
        try { value = fn(); } finally { __currentEffect = prev; }
        dirty = false;
      }
      return value;
    },

    read() { return value; },
    lock() { locked = true; computed.value; return computed; },
    free() {
      for (const dep of computed.dependencies) dep.delete(computed);
      computed.dependencies.clear();
      subscribers.clear();
      return computed;
    },
    kill() {
      dead = true;
      const result = value;
      computed.free();
      return result;
    },

    ...__primitiveCoercion
  };
  return computed;
}

function __effect(fn) {
  const effect = {
    dependencies: new Set(),

    run() {
      if (effect._cleanup) { effect._cleanup(); effect._cleanup = null; }
      for (const dep of effect.dependencies) dep.delete(effect);
      effect.dependencies.clear();
      const prev = __currentEffect;
      __currentEffect = effect;
      try {
        const result = fn();
        if (typeof result === 'function') effect._cleanup = result;
      } finally { __currentEffect = prev; }
    },

    dispose() {
      if (effect._cleanup) { effect._cleanup(); effect._cleanup = null; }
      for (const dep of effect.dependencies) dep.delete(effect);
      effect.dependencies.clear();
    }
  };

  effect.run();
  return () => effect.dispose();
}

function __batch(fn) {
  if (__batching) return fn();
  __batching = true;
  try {
    return fn();
  } finally {
    __batching = false;
    __flushEffects();
  }
}

function __readonly(value) {
  return Object.freeze({ value });
}

// ============================================================================
// Error Handling
// ============================================================================

let __errorHandler = null;

function __setErrorHandler(handler) {
  const prev = __errorHandler;
  __errorHandler = handler;
  return prev;
}

function __handleError(error) {
  if (__errorHandler) {
    try {
      __errorHandler(error);
    } catch (handlerError) {
      console.error('Error in error handler:', handlerError);
      console.error('Original error:', error);
    }
  } else {
    throw error;
  }
}

function __catchErrors(fn) {
  return function(...args) {
    try {
      return fn.apply(this, args);
    } catch (error) {
      __handleError(error);
    }
  };
}

// Register on globalThis for runtime deduplication
if (typeof globalThis !== 'undefined') {
  globalThis.__rip = { __state, __computed, __effect, __batch, __readonly, __setErrorHandler, __handleError, __catchErrors };
}

// === End Reactive Runtime ===
`;
    }
  }

  class Compiler {
    constructor(options = {}) {
      this.options = { showTokens: false, showSExpr: false, ...options };
    }
    compile(source, options) {
      if (options)
        this.options = { ...this.options, ...options };
      let dataSection = null;
      let lines = source.split(`
`);
      let dataLineIndex = lines.findIndex((line) => line === "__DATA__");
      if (dataLineIndex !== -1) {
        let dataLines = lines.slice(dataLineIndex + 1);
        dataSection = dataLines.length > 0 ? dataLines.join(`
`) + `
` : "";
        source = lines.slice(0, dataLineIndex).join(`
`);
      }
      let lexer = new Lexer;
      let tokens = lexer.tokenize(source);
      if (this.options.showTokens) {
        tokens.forEach((t) => console.log(`${t[0].padEnd(12)} ${JSON.stringify(t[1])}`));
        console.log();
      }
      let dts = null;
      let typeTokens = null;
      if (this.options.types === "emit" || this.options.types === "check" || this.options.types === true) {
        typeTokens = [...tokens];
      }
      tokens = tokens.filter((t) => t[0] !== "TYPE_DECL");
      while (tokens.length > 0 && tokens[0][0] === "TERMINATOR") {
        tokens.shift();
      }
      if (tokens.every((t) => t[0] === "TERMINATOR")) {
        if (typeTokens)
          dts = emitTypes(typeTokens, ["program"], source);
        return { tokens, sexpr: ["program"], code: "", dts, data: dataSection, reactiveVars: {} };
      }
      parser.lexer = {
        tokens,
        pos: 0,
        setInput: function() {},
        lex: function() {
          if (this.pos >= this.tokens.length)
            return 1;
          let token = this.tokens[this.pos++];
          let val = token[1];
          if (token.data) {
            val = new String(val);
            Object.assign(val, token.data);
          }
          this.text = val;
          this.loc = token.loc;
          return token[0];
        }
      };
      let sexpr;
      try {
        sexpr = parser.parse(source);
      } catch (parseError) {
        if (/\?\s*\([^)]*\?[^)]*:[^)]*\)\s*:/.test(source) || /\?\s+\w+\s+\?\s+/.test(source)) {
          throw new Error("Nested ternary operators are not supported. Use if/else statements instead.");
        }
        throw parseError;
      }
      if (this.options.showSExpr) {
        console.log(formatSExpr(sexpr, 0, true));
        console.log();
      }
      let sourceMap = null;
      if (this.options.sourceMap) {
        let file = (this.options.filename || "output") + ".js";
        let sourceFile = this.options.filename || "input.rip";
        sourceMap = new SourceMapGenerator(file, sourceFile, source);
      }
      let generator = new CodeGenerator({
        dataSection,
        source,
        skipPreamble: this.options.skipPreamble,
        skipRuntimes: this.options.skipRuntimes,
        skipExports: this.options.skipExports,
        skipImports: this.options.skipImports,
        skipDataPart: this.options.skipDataPart,
        stubComponents: this.options.stubComponents,
        reactiveVars: this.options.reactiveVars,
        sourceMap
      });
      let code = generator.compile(sexpr);
      let map = sourceMap ? sourceMap.toJSON() : null;
      let reverseMap = sourceMap ? sourceMap.toReverseMap() : null;
      if (map && this.options.sourceMap === "inline") {
        let b64 = typeof Buffer !== "undefined" ? Buffer.from(map).toString("base64") : btoa(map);
        code += `
//# sourceMappingURL=data:application/json;base64,${b64}`;
      } else if (map && this.options.filename) {
        code += `
//# sourceMappingURL=${this.options.filename}.js.map`;
      }
      if (typeTokens) {
        dts = emitTypes(typeTokens, sexpr, source);
      }
      return { tokens, sexpr, code, dts, map, reverseMap, data: dataSection, reactiveVars: generator.reactiveVars };
    }
    compileToJS(source) {
      return this.compile(source).code;
    }
    compileToSExpr(source) {
      return this.compile(source).sexpr;
    }
  }
  installComponentSupport(CodeGenerator, Lexer);
  CodeGenerator.prototype.generateEnum = generateEnum;
  function compile(source, options = {}) {
    return new Compiler(options).compile(source);
  }
  function compileToJS(source, options = {}) {
    return new Compiler(options).compileToJS(source);
  }
  function getStdlibCode() {
    return `globalThis.abort  ??= (msg) => { if (msg) console.error(msg); process.exit(1); };
globalThis.assert ??= (v, msg) => { if (!v) throw new Error(msg || "Assertion failed"); };
globalThis.exit   ??= (code) => process.exit(code || 0);
globalThis.kind   ??= (v) => v != null ? (v.constructor?.name || Object.prototype.toString.call(v).slice(8, -1)).toLowerCase() : String(v);
globalThis.noop   ??= () => {};
globalThis.p      ??= console.log;
globalThis.pp     ??= (v) => { console.log(JSON.stringify(v, null, 2)); return v; };
globalThis.raise  ??= (a, b) => { throw (b !== undefined ? new a(b) : new Error(a)); };
globalThis.rand   ??= (a, b) => b !== undefined ? (a > b && ([a, b] = [b, a]), Math.floor(Math.random() * (b - a + 1) + a)) : a ? Math.floor(Math.random() * a) : Math.random();
globalThis.sleep  ??= (ms) => new Promise(r => setTimeout(r, ms));
globalThis.todo   ??= (msg) => { throw new Error(msg || "Not implemented"); };
globalThis.warn   ??= console.warn;
globalThis.zip    ??= (...a) => a[0].map((_, i) => a.map(b => b[i]));
`;
  }
  function getReactiveRuntime() {
    return new CodeGenerator({}).getReactiveRuntime();
  }
  function getComponentRuntime() {
    return new CodeGenerator({}).getComponentRuntime();
  }
  // src/browser.js
  var VERSION = "3.13.129";
  var BUILD_DATE = "2026-03-30@09:39:44GMT";
  if (typeof globalThis !== "undefined") {
    if (!globalThis.__rip)
      new Function(getReactiveRuntime())();
    if (!globalThis.__ripComponent)
      new Function(getComponentRuntime())();
  }
  var dedent = (s) => {
    const m = s.match(/^[ \t]*(?=\S)/gm);
    const i = Math.min(...(m || []).map((x) => x.length));
    return s.replace(RegExp(`^[ 	]{${i}}`, "gm"), "").trim();
  };
  async function processRipScripts() {
    const sources = [];
    const runtimeTag = document.querySelector('script[src$="rip.min.js"], script[src$="rip.js"]');
    const dataSrc = runtimeTag?.getAttribute("data-src");
    if (dataSrc) {
      for (const url of dataSrc.trim().split(/\s+/)) {
        if (url)
          sources.push({ url });
      }
    }
    for (const script of document.querySelectorAll('script[type="text/rip"]')) {
      if (script.src) {
        sources.push({ url: script.src });
      } else {
        const code = dedent(script.textContent);
        if (code)
          sources.push({ code });
      }
    }
    if (sources.length > 0) {
      const results = await Promise.allSettled(sources.map(async (s) => {
        if (!s.url)
          return;
        const res = await fetch(s.url);
        if (!res.ok)
          throw new Error(`${s.url} (${res.status})`);
        if (s.url.endsWith(".rip")) {
          s.code = await res.text();
        } else {
          const bundle = await res.json();
          s.bundle = bundle;
        }
      }));
      for (const r of results) {
        if (r.status === "rejected")
          console.warn("Rip: fetch failed:", r.reason.message);
      }
      const bundles = [];
      const individual = [];
      for (const s of sources) {
        if (s.bundle)
          bundles.push(s.bundle);
        else if (s.code)
          individual.push(s);
      }
      const routerAttr = runtimeTag?.getAttribute("data-router");
      const hasRouter = routerAttr != null;
      if (hasRouter && bundles.length > 0) {
        const opts = { skipRuntimes: true, skipExports: true, skipImports: true };
        if (individual.length > 0) {
          let js = "";
          for (const s of individual) {
            try {
              js += compileToJS(s.code, opts) + `
`;
            } catch (e) {
              console.error(`Rip compile error in ${s.url || "inline"}:`, e.message);
            }
          }
          if (js) {
            try {
              await (0, eval)(`(async()=>{
${js}
})()`);
            } catch (e) {
              console.error("Rip runtime error:", e);
            }
          }
        }
        const ui = importRip.modules?.["ui.rip"];
        if (ui?.launch) {
          const appBundle = bundles[bundles.length - 1];
          const persistAttr = runtimeTag.getAttribute("data-persist");
          const launchOpts = { bundle: appBundle, hash: routerAttr === "hash" };
          if (persistAttr != null)
            launchOpts.persist = persistAttr === "local" ? "local" : true;
          await ui.launch("", launchOpts);
        }
      } else {
        const expanded = [];
        for (const b of bundles) {
          for (const [name, code] of Object.entries(b.components || {})) {
            expanded.push({ code, url: name });
          }
          if (b.data) {
            const stateAttr = runtimeTag?.getAttribute("data-state");
            let initial = {};
            if (stateAttr) {
              try {
                initial = JSON.parse(stateAttr);
              } catch {}
            }
            Object.assign(initial, b.data);
            runtimeTag?.setAttribute("data-state", JSON.stringify(initial));
          }
        }
        expanded.push(...individual);
        const opts = { skipRuntimes: true, skipExports: true, skipImports: true };
        const compiled = [];
        for (const s of expanded) {
          if (!s.code)
            continue;
          try {
            const js = compileToJS(s.code, opts);
            compiled.push({ js, url: s.url || "inline" });
          } catch (e) {
            console.error(`Rip compile error in ${s.url || "inline"}:`, e.message);
          }
        }
        if (!globalThis.__ripApp && runtimeTag) {
          const stashFn = globalThis.stash;
          if (stashFn) {
            let initial = {};
            const stateAttr = runtimeTag.getAttribute("data-state");
            if (stateAttr) {
              try {
                initial = JSON.parse(stateAttr);
              } catch (e) {
                console.error("Rip: invalid data-state JSON:", e.message);
              }
            }
            const app = stashFn({ data: initial });
            globalThis.__ripApp = app;
            if (typeof window !== "undefined")
              window.app = app;
            const persistAttr = runtimeTag.getAttribute("data-persist");
            if (persistAttr != null && globalThis.persistStash) {
              globalThis.persistStash(app, { local: persistAttr === "local" });
            }
          }
        }
        if (compiled.length > 0) {
          let js = compiled.map((c) => c.js).join(`
`);
          const mount = runtimeTag?.getAttribute("data-mount");
          if (mount) {
            const target = runtimeTag.getAttribute("data-target") || "body";
            js += `
${mount}.mount(${JSON.stringify(target)});`;
          }
          try {
            await (0, eval)(`(async()=>{
${js}
})()`);
            document.body.classList.add("ready");
          } catch (e) {
            if (e instanceof SyntaxError) {
              console.error(`Rip syntax error in combined output: ${e.message}`);
              for (const c of compiled) {
                try {
                  new Function(`(async()=>{
${c.js}
})()`);
                } catch (e2) {
                  console.error(`  → source: ${c.url}`, e2.message);
                }
              }
            } else {
              console.error("Rip runtime error:", e);
            }
          }
        }
      }
    }
    if (runtimeTag?.hasAttribute("data-reload") && !globalThis.__ripLaunched) {
      let ready = false;
      let retryDelay = 1000;
      const maxDelay = 30000;
      const connectWatch = () => {
        const es = new EventSource("/watch");
        es.addEventListener("connected", () => {
          retryDelay = 1000;
          if (ready)
            location.reload();
          ready = true;
        });
        es.addEventListener("reload", (e) => {
          if (e.data === "styles") {
            const t = Date.now();
            let refreshed = 0;
            document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
              if (new URL(l.href).origin !== location.origin)
                return;
              const url = new URL(l.href);
              url.searchParams.set("_r", t);
              l.href = url.toString();
              refreshed++;
            });
            if (!refreshed)
              location.reload();
          } else {
            location.reload();
          }
        });
        es.onerror = () => {
          es.close();
          setTimeout(connectWatch, retryDelay);
          retryDelay = Math.min(retryDelay * 2, maxDelay);
        };
      };
      connectWatch();
    }
  }
  async function importRip(url) {
    for (const [key, mod] of Object.entries(importRip.modules)) {
      if (url.includes(key))
        return mod;
    }
    const source = await fetch(url).then((r) => {
      if (!r.ok)
        throw new Error(`importRip: ${url} (${r.status})`);
      return r.text();
    });
    const js = compileToJS(source);
    const header = `// ${url}
`;
    const blob = new Blob([header + js], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    return await import(blobUrl);
  }
  importRip.modules = {};
  function rip(code) {
    try {
      const indented = code.replace(/^/gm, "  ");
      const wrapped = compileToJS(`do ->
${indented}`);
      let js = wrapped.replace(/^let\s+[^;]+;\s*\n\s*/m, "");
      js = js.replace(/^const\s+(\w+)\s*=/gm, "globalThis.$1 =");
      const result = (0, eval)(js);
      if (result && typeof result.then === "function") {
        return result.then((v) => {
          if (v !== undefined)
            globalThis._ = v;
          return v;
        });
      }
      if (result !== undefined)
        globalThis._ = result;
      return result;
    } catch (error) {
      console.error("Rip compilation error:", error.message);
      return;
    }
  }
  if (typeof globalThis !== "undefined") {
    globalThis.rip = rip;
    globalThis.importRip = importRip;
    globalThis.compileToJS = compileToJS;
    globalThis.__ripExports = { compile, compileToJS, formatSExpr, getStdlibCode, VERSION, BUILD_DATE, getReactiveRuntime, getComponentRuntime };
  }
  if (typeof document !== "undefined") {
    globalThis.__ripScriptsReady = new Promise((resolve) => {
      const run = () => processRipScripts().then(resolve);
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => queueMicrotask(run));
      } else {
        queueMicrotask(run);
      }
    });
  }
  // docs/dist/_ui.js
  var exports__ui = {};
  __export(exports__ui, {
    throttle: () => throttle,
    stash: () => stash,
    setContext: () => setContext,
    raw: () => raw,
    persistStash: () => persistStash,
    launch: () => launch,
    isStash: () => isStash,
    hold: () => hold,
    hasContext: () => hasContext,
    getContext: () => getContext,
    delay: () => delay,
    debounce: () => debounce,
    createRouter: () => createRouter,
    createResource: () => createResource,
    createRenderer: () => createRenderer,
    createComponents: () => createComponents
  });
  var PATH_RE;
  var PERSISTED;
  var PROXIES;
  var RAW;
  var SIGNALS;
  var STASH;
  var __batch;
  var __effect;
  var __state;
  var _ariaBindDialog;
  var _ariaBindPopover;
  var _ariaHasAnchor;
  var _ariaListNav;
  var _ariaLockScroll;
  var _ariaModalStack;
  var _ariaNAV;
  var _ariaPopupDismiss;
  var _ariaPopupGuard;
  var _ariaPosition;
  var _ariaPositionBelow;
  var _ariaRovingNav;
  var _ariaTrapFocus;
  var _ariaUnlockScroll;
  var _ariaWireAria;
  var _keysVersion;
  var _proxy;
  var _toFn;
  var _writeVersion;
  var arraysEqual;
  var buildComponentMap;
  var buildRoutes;
  var compileAndImport;
  var connectWatch;
  var fileToComponentName;
  var fileToPattern;
  var findAllComponents;
  var findComponent;
  var getContext;
  var getLayoutChain;
  var getSignal;
  var hasContext;
  var keysSignal;
  var makeProxy;
  var matchRoute;
  var patternToRegex;
  var setContext;
  var stashGet;
  var stashSet;
  var walk;
  var wrapDeep;
  globalThis.abort ??= (msg) => {
    if (msg)
      console.error(msg);
    process.exit(1);
  };
  globalThis.assert ??= (v, msg) => {
    if (!v)
      throw new Error(msg || "Assertion failed");
  };
  globalThis.exit ??= (code) => process.exit(code || 0);
  globalThis.kind ??= (v) => v != null ? (v.constructor?.name || Object.prototype.toString.call(v).slice(8, -1)).toLowerCase() : String(v);
  globalThis.noop ??= () => {};
  globalThis.p ??= console.log;
  globalThis.pp ??= (v) => {
    console.log(JSON.stringify(v, null, 2));
    return v;
  };
  globalThis.raise ??= (a, b) => {
    throw b !== undefined ? new a(b) : new Error(a);
  };
  globalThis.rand ??= (a, b) => b !== undefined ? (a > b && ([a, b] = [b, a]), Math.floor(Math.random() * (b - a + 1) + a)) : a ? Math.floor(Math.random() * a) : Math.random();
  globalThis.sleep ??= (ms) => new Promise((r) => setTimeout(r, ms));
  globalThis.todo ??= (msg) => {
    throw new Error(msg || "Not implemented");
  };
  globalThis.warn ??= console.warn;
  globalThis.zip ??= (...a) => a[0].map((_, i) => a.map((b) => b[i]));
  ({ __state, __effect, __batch } = globalThis.__rip);
  ({ setContext, getContext, hasContext } = globalThis.__ripComponent || {});
  STASH = Symbol("stash");
  SIGNALS = Symbol("signals");
  RAW = Symbol("raw");
  PERSISTED = Symbol("persisted");
  PROXIES = new WeakMap;
  _keysVersion = 0;
  _writeVersion = __state(0);
  getSignal = function(target, prop) {
    let sig;
    if (!target[SIGNALS]) {
      Object.defineProperty(target, SIGNALS, { value: new Map, enumerable: false });
    }
    sig = target[SIGNALS].get(prop);
    if (!sig) {
      sig = __state(target[prop]);
      target[SIGNALS].set(prop, sig);
    }
    return sig;
  };
  keysSignal = function(target) {
    return getSignal(target, Symbol.for("keys"));
  };
  wrapDeep = function(value) {
    let existing;
    if (!(value != null && typeof value === "object"))
      return value;
    if (value[STASH])
      return value;
    if (value instanceof Date || value instanceof RegExp || value instanceof Map || value instanceof Set || value instanceof Promise)
      return value;
    existing = PROXIES.get(value);
    if (existing)
      return existing;
    return makeProxy(value);
  };
  makeProxy = function(target) {
    let handler, proxy;
    proxy = null;
    handler = { get: function(target2, prop) {
      let sig, val;
      if (prop === STASH)
        return true;
      if (prop === RAW)
        return target2;
      if (typeof prop === "symbol")
        return Reflect.get(target2, prop);
      if (prop === "length" && Array.isArray(target2)) {
        keysSignal(target2).value;
        return target2.length;
      }
      if (prop === "get")
        return function(path) {
          return stashGet(proxy, path);
        };
      if (prop === "set")
        return function(path, val2) {
          return stashSet(proxy, path, val2);
        };
      sig = getSignal(target2, prop);
      val = sig.value;
      if (val != null && typeof val === "object")
        return wrapDeep(val);
      return val;
    }, set: function(target2, prop, value) {
      let old, r;
      old = target2[prop];
      r = value?.[RAW] ? value[RAW] : value;
      if (r === old)
        return true;
      target2[prop] = r;
      if (target2[SIGNALS]?.has(prop)) {
        target2[SIGNALS].get(prop).value = r;
      }
      if (old === undefined && r !== undefined) {
        keysSignal(target2).value = ++_keysVersion;
      }
      _writeVersion.value++;
      return true;
    }, deleteProperty: function(target2, prop) {
      let sig;
      delete target2[prop];
      sig = target2[SIGNALS]?.get(prop);
      if (sig != null)
        sig.value = undefined;
      keysSignal(target2).value = ++_keysVersion;
      return true;
    }, ownKeys: function(target2) {
      keysSignal(target2).value;
      return Reflect.ownKeys(target2);
    } };
    proxy = new Proxy(target, handler);
    PROXIES.set(target, proxy);
    return proxy;
  };
  PATH_RE = /([./][^./\[\s]+|\[[-+]?\d+\]|\[(?:"[^"]+"|'[^']+')\])/;
  walk = function(path) {
    let chr, i, list, part, result;
    list = ("." + path).split(PATH_RE);
    list.shift();
    result = [];
    i = 0;
    while (i < list.length) {
      part = list[i];
      chr = part[0];
      if (chr === "." || chr === "/") {
        result.push(part.slice(1));
      } else if (chr === "[") {
        if (part[1] === '"' || part[1] === "'") {
          result.push(part.slice(2, -2));
        } else {
          result.push(+part.slice(1, -1));
        }
      }
      i += 2;
    }
    return result;
  };
  stashGet = function(proxy, path) {
    let obj, segs;
    segs = walk(path);
    obj = proxy;
    for (const seg of segs) {
      if (!(obj != null))
        return;
      obj = obj[seg];
    }
    return obj;
  };
  stashSet = function(proxy, path, value) {
    let obj, segs;
    segs = walk(path);
    obj = proxy;
    for (let i = 0;i < segs.length; i++) {
      const seg = segs[i];
      if (i === segs.length - 1) {
        obj[seg] = value;
      } else {
        if (!(obj[seg] != null))
          obj[seg] = {};
        obj = obj[seg];
      }
    }
    return value;
  };
  var stash = function(data = {}) {
    return makeProxy(data);
  };
  var raw = function(proxy) {
    return proxy?.[RAW] ? proxy[RAW] : proxy;
  };
  var isStash = function(obj) {
    return obj?.[STASH] === true;
  };
  var persistStash = function(app, opts = {}) {
    let _save, saved, savedData, storage, storageKey, target;
    target = raw(app) || app;
    if (target[PERSISTED])
      return;
    target[PERSISTED] = true;
    storage = opts.local ? localStorage : sessionStorage;
    storageKey = opts.key || "__rip_app";
    try {
      saved = storage.getItem(storageKey);
      if (saved) {
        savedData = JSON.parse(saved);
        for (const k in savedData) {
          const v = savedData[k];
          app.data[k] = v;
        }
      }
    } catch {}
    _save = function() {
      return (() => {
        try {
          return storage.setItem(storageKey, JSON.stringify(raw(app.data)));
        } catch {
          return null;
        }
      })();
    };
    __effect(function() {
      let t;
      _writeVersion.value;
      t = setTimeout(_save, 2000);
      return function() {
        return clearTimeout(t);
      };
    });
    return window.addEventListener("beforeunload", _save);
  };
  var createResource = function(fn, opts = {}) {
    let _data, _error, _loading, load, resource;
    _data = __state(opts.initial || null);
    _loading = __state(false);
    _error = __state(null);
    load = async function() {
      let result;
      _loading.value = true;
      _error.value = null;
      return (async () => {
        try {
          result = await fn();
          return _data.value = result;
        } catch (err) {
          return _error.value = err;
        } finally {
          _loading.value = false;
        }
      })();
    };
    resource = { data: undefined, loading: undefined, error: undefined, refetch: load };
    Object.defineProperty(resource, "data", { get: function() {
      return _data.value;
    } });
    Object.defineProperty(resource, "loading", { get: function() {
      return _loading.value;
    } });
    Object.defineProperty(resource, "error", { get: function() {
      return _error.value;
    } });
    if (!opts.lazy)
      load();
    return resource;
  };
  _toFn = function(source) {
    return typeof source === "function" ? source : function() {
      return source.value;
    };
  };
  _proxy = function(out, source) {
    let obj;
    obj = { read: function() {
      return out.read();
    } };
    Object.defineProperty(obj, "value", { get: function() {
      return out.value;
    }, set: function(v) {
      return source.value = v;
    } });
    return obj;
  };
  var delay = function(ms, source) {
    let fn, out;
    fn = _toFn(source);
    out = __state(!!fn());
    __effect(function() {
      let t;
      if (fn()) {
        t = setTimeout(function() {
          return out.value = true;
        }, ms);
        return function() {
          return clearTimeout(t);
        };
      } else {
        return out.value = false;
      }
    });
    return typeof source !== "function" ? _proxy(out, source) : out;
  };
  var debounce = function(ms, source) {
    let fn, out;
    fn = _toFn(source);
    out = __state(fn());
    __effect(function() {
      let t, val;
      val = fn();
      t = setTimeout(function() {
        return out.value = val;
      }, ms);
      return function() {
        return clearTimeout(t);
      };
    });
    return typeof source !== "function" ? _proxy(out, source) : out;
  };
  var throttle = function(ms, source) {
    let fn, last, out;
    fn = _toFn(source);
    out = __state(fn());
    last = 0;
    __effect(function() {
      let now, remaining, t, val;
      val = fn();
      now = Date.now();
      remaining = ms - (now - last);
      if (remaining <= 0) {
        out.value = val;
        return last = now;
      } else {
        t = setTimeout(function() {
          out.value = fn();
          return last = Date.now();
        }, remaining);
        return function() {
          return clearTimeout(t);
        };
      }
    });
    return typeof source !== "function" ? _proxy(out, source) : out;
  };
  var hold = function(ms, source) {
    let fn, out;
    fn = _toFn(source);
    out = __state(!!fn());
    __effect(function() {
      let t;
      if (fn()) {
        return out.value = true;
      } else {
        t = setTimeout(function() {
          return out.value = false;
        }, ms);
        return function() {
          return clearTimeout(t);
        };
      }
    });
    return typeof source !== "function" ? _proxy(out, source) : out;
  };
  var createComponents = function() {
    let compiled, files, notify, watchers;
    files = new Map;
    watchers = [];
    compiled = new Map;
    notify = function(event, path) {
      for (const watcher of watchers) {
        watcher(event, path);
      }
    };
    return { read: function(path) {
      return files.get(path);
    }, write: function(path, content) {
      let isNew;
      isNew = !files.has(path);
      files.set(path, content);
      compiled.delete(path);
      return notify(isNew ? "create" : "change", path);
    }, del: function(path) {
      files.delete(path);
      compiled.delete(path);
      return notify("delete", path);
    }, exists: function(path) {
      return files.has(path);
    }, size: function() {
      return files.size;
    }, list: function(dir = "") {
      let prefix, rest, result;
      result = [];
      prefix = dir ? dir + "/" : "";
      for (const [path] of files) {
        if (path.startsWith(prefix)) {
          rest = path.slice(prefix.length);
          if (rest.includes("/"))
            continue;
          result.push(path);
        }
      }
      return result;
    }, listAll: function(dir = "") {
      let prefix, result;
      result = [];
      prefix = dir ? dir + "/" : "";
      for (const [path] of files) {
        if (path.startsWith(prefix))
          result.push(path);
      }
      return result;
    }, load: function(obj) {
      for (const key in obj) {
        const content = obj[key];
        files.set(key, content);
      }
    }, watch: function(fn) {
      watchers.push(fn);
      return function() {
        return watchers.splice(watchers.indexOf(fn), 1);
      };
    }, getCompiled: function(path) {
      return compiled.get(path);
    }, setCompiled: function(path, result) {
      return compiled.set(path, result);
    } };
  };
  fileToPattern = function(rel) {
    let pattern;
    pattern = rel.replace(/\.rip$/, "");
    pattern = pattern.replace(/\[\.\.\.(\w+)\]/g, "*$1");
    pattern = pattern.replace(/\[(\w+)\]/g, ":$1");
    if (pattern === "index")
      return "/";
    pattern = pattern.replace(/\/index$/, "");
    return "/" + pattern;
  };
  patternToRegex = function(pattern) {
    let names, str2;
    names = [];
    str2 = pattern.replace(/\*(\w+)/g, function(_, name) {
      names.push(name);
      return "(.+)";
    }).replace(/:(\w+)/g, function(_, name) {
      names.push(name);
      return "([^/]+)";
    });
    return { regex: new RegExp("^" + str2 + "$"), names };
  };
  matchRoute = function(path, routes) {
    let match, params;
    for (const route of routes) {
      match = path.match(route.regex.regex);
      if (match) {
        params = {};
        for (let i = 0;i < route.regex.names.length; i++) {
          const name = route.regex.names[i];
          params[name] = decodeURIComponent(match[i + 1]);
        }
        return { route, params };
      }
    }
    return null;
  };
  buildRoutes = function(components, root = "components") {
    let allFiles, dir, layouts, name, regex, rel, routes, segs, urlPattern;
    routes = [];
    layouts = new Map;
    allFiles = components.listAll(root);
    for (const filePath of allFiles) {
      rel = filePath.slice(root.length + 1);
      if (!rel.endsWith(".rip"))
        continue;
      name = rel.split("/").pop();
      if (name === "_layout.rip") {
        dir = rel === "_layout.rip" ? "" : rel.slice(0, -"/_layout.rip".length);
        layouts.set(dir, filePath);
        continue;
      }
      if (name.startsWith("_"))
        continue;
      segs = rel.split("/");
      if (segs.length > 1 && segs.some(function(s, i) {
        return i < segs.length - 1 && s.startsWith("_");
      }))
        continue;
      urlPattern = fileToPattern(rel);
      regex = patternToRegex(urlPattern);
      routes.push({ pattern: urlPattern, regex, file: filePath, rel });
    }
    routes.sort(function(a, b) {
      let aCatch, aDyn, bCatch, bDyn;
      aDyn = (a.pattern.match(/:/g) || []).length;
      bDyn = (b.pattern.match(/:/g) || []).length;
      aCatch = a.pattern.includes("*") ? 1 : 0;
      bCatch = b.pattern.includes("*") ? 1 : 0;
      if (aCatch !== bCatch)
        return aCatch - bCatch;
      if (aDyn !== bDyn)
        return aDyn - bDyn;
      return a.pattern.localeCompare(b.pattern);
    });
    return { routes, layouts };
  };
  getLayoutChain = function(routeFile, root, layouts) {
    let chain, dir, rel, segments;
    chain = [];
    rel = routeFile.slice(root.length + 1);
    segments = rel.split("/");
    dir = "";
    if (layouts.has(""))
      chain.push(layouts.get(""));
    for (let i = 0;i < segments.length; i++) {
      const seg = segments[i];
      if (i === segments.length - 1)
        break;
      dir = dir ? dir + "/" + seg : seg;
      if (layouts.has(dir))
        chain.push(layouts.get(dir));
    }
    return chain;
  };
  var createRouter = function(components, opts = {}) {
    let _hash, _layouts, _navigating, _params, _path, _query, _route, addBase, base, hashMode, navCallbacks, onClick, onError, onPopState, readUrl, resolve, root, router, stripBase, tree, writeUrl;
    root = opts.root || "components";
    base = opts.base || "";
    hashMode = opts.hash || false;
    onError = opts.onError || null;
    stripBase = function(url) {
      return base && url.startsWith(base) ? url.slice(base.length) || "/" : url;
    };
    addBase = function(path) {
      return base ? base + path : path;
    };
    readUrl = function() {
      let h;
      if (hashMode) {
        h = location.hash.slice(1);
        if (!h)
          return "/";
        return h[0] === "/" ? h : "/" + h;
      } else {
        return location.pathname + location.search + location.hash;
      }
    };
    writeUrl = function(path) {
      return hashMode ? path === "/" ? location.pathname : "#" + path.slice(1) : addBase(path);
    };
    _path = __state(stripBase(hashMode ? readUrl() : location.pathname));
    _params = __state({});
    _route = __state(null);
    _layouts = __state([]);
    _query = __state({});
    _hash = __state("");
    _navigating = delay(100, __state(false));
    tree = buildRoutes(components, root);
    navCallbacks = new Set;
    components.watch(function(event, path) {
      if (!path.startsWith(root + "/"))
        return;
      return tree = buildRoutes(components, root);
    });
    resolve = function(url) {
      let hash, path, queryStr, rawPath, result;
      rawPath = url.split("?")[0].split("#")[0];
      path = stripBase(rawPath);
      path = path[0] === "/" ? path : "/" + path;
      queryStr = url.split("?")[1]?.split("#")[0] || "";
      hash = url.includes("#") ? url.split("#")[1] : "";
      result = matchRoute(path, tree.routes);
      if (result) {
        __batch(function() {
          _path.value = path;
          _params.value = result.params;
          _route.value = result.route;
          _layouts.value = getLayoutChain(result.route.file, root, tree.layouts);
          _query.value = Object.fromEntries(new URLSearchParams(queryStr));
          return _hash.value = hash;
        });
        for (const cb of navCallbacks) {
          cb(router.current);
        }
        return true;
      }
      if (onError)
        onError({ status: 404, path });
      return false;
    };
    onPopState = function() {
      return resolve(readUrl());
    };
    if (typeof window !== "undefined")
      window.addEventListener("popstate", onPopState);
    onClick = function(e) {
      let dest, target, url;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      target = e.target;
      while (target && target.tagName !== "A") {
        target = target.parentElement;
      }
      if (!target?.href)
        return;
      url = new URL(target.href, location.origin);
      if (url.origin !== location.origin)
        return;
      if (target.target === "_blank" || target.hasAttribute("data-external"))
        return;
      e.preventDefault();
      dest = hashMode && url.hash ? url.hash.slice(1) || "/" : url.pathname + url.search + url.hash;
      return router.push(dest);
    };
    if (typeof document !== "undefined")
      document.addEventListener("click", onClick);
    router = { push: function(url) {
      return resolve(url) ? history.pushState(null, "", writeUrl(_path.read())) : undefined;
    }, replace: function(url) {
      return resolve(url) ? history.replaceState(null, "", writeUrl(_path.read())) : undefined;
    }, back: function() {
      return history.back();
    }, forward: function() {
      return history.forward();
    }, current: undefined, path: undefined, params: undefined, route: undefined, layouts: undefined, query: undefined, hash: undefined, navigating: undefined, onNavigate: function(cb) {
      navCallbacks.add(cb);
      return function() {
        return navCallbacks.delete(cb);
      };
    }, rebuild: function() {
      return tree = buildRoutes(components, root);
    }, routes: undefined, init: function() {
      resolve(readUrl());
      return router;
    }, destroy: function() {
      if (typeof window !== "undefined")
        window.removeEventListener("popstate", onPopState);
      if (typeof document !== "undefined")
        document.removeEventListener("click", onClick);
      return navCallbacks.clear();
    } };
    Object.defineProperty(router, "current", { get: function() {
      return { path: _path.value, params: _params.value, route: _route.value, layouts: _layouts.value, query: _query.value, hash: _hash.value };
    } });
    Object.defineProperty(router, "path", { get: function() {
      return _path.value;
    } });
    Object.defineProperty(router, "params", { get: function() {
      return _params.value;
    } });
    Object.defineProperty(router, "route", { get: function() {
      return _route.value;
    } });
    Object.defineProperty(router, "layouts", { get: function() {
      return _layouts.value;
    } });
    Object.defineProperty(router, "query", { get: function() {
      return _query.value;
    } });
    Object.defineProperty(router, "hash", { get: function() {
      return _hash.value;
    } });
    Object.defineProperty(router, "navigating", { get: function() {
      return _navigating.value;
    }, set: function(v) {
      return _navigating.value = v;
    } });
    Object.defineProperty(router, "routes", { get: function() {
      return tree.routes;
    } });
    return router;
  };
  arraysEqual = function(a, b) {
    if (a.length !== b.length)
      return false;
    for (let i = 0;i < a.length; i++) {
      const item = a[i];
      if (item !== b[i])
        return false;
    }
    return true;
  };
  findComponent = function(mod) {
    for (const key in mod) {
      const val = mod[key];
      if (typeof val === "function" && (val.prototype?.mount || val.prototype?._create))
        return val;
    }
    return typeof mod.default === "function" ? mod.default : undefined;
  };
  findAllComponents = function(mod) {
    let result;
    result = {};
    for (const key in mod) {
      const val = mod[key];
      if (typeof val === "function" && (val.prototype?.mount || val.prototype?._create)) {
        result[key] = val;
      }
    }
    return result;
  };
  fileToComponentName = function(filePath) {
    let name;
    name = filePath.split("/").pop().replace(/\.rip$/, "");
    return name.replace(/(^|[-_])([a-z])/g, function(_, sep, ch) {
      return ch.toUpperCase();
    });
  };
  buildComponentMap = function(components, root = "components") {
    let fileName, map, name;
    map = {};
    for (const path of components.listAll(root)) {
      if (!path.endsWith(".rip"))
        continue;
      fileName = path.split("/").pop();
      if (fileName.startsWith("_"))
        continue;
      name = fileToComponentName(path);
      if (map[name]) {
        console.warn(`[Rip] Component name collision: ${name} (${map[name]} vs ${path})`);
      }
      map[name] = path;
    }
    return map;
  };
  compileAndImport = async function(source, compile2, components = null, path = null, resolver = null) {
    let blob, cached, depMod, depSource, found, header, js, mod, names, needed, preamble, url;
    if (components && path) {
      cached = components.getCompiled(path);
      if (cached)
        return cached;
    }
    js = compile2(source);
    if (resolver) {
      needed = {};
      for (const name in resolver.map) {
        const depPath = resolver.map[name];
        if (depPath !== path && js.includes(`new ${name}(`)) {
          if (!resolver.classes[name]) {
            depSource = components.read(depPath);
            if (depSource) {
              depMod = await compileAndImport(depSource, compile2, components, depPath, resolver);
              found = findAllComponents(depMod);
              for (const k in found) {
                const v = found[k];
                resolver.classes[k] = v;
              }
            }
          }
          if (resolver.classes[name])
            needed[name] = true;
        }
      }
      names = Object.keys(needed);
      if (names.length > 0) {
        preamble = `const {${names.join(", ")}} = globalThis['${resolver.key}'];
`;
        js = preamble + js;
      }
    }
    header = path ? `// ${path}
` : "";
    blob = new Blob([header + js], { type: "application/javascript" });
    url = URL.createObjectURL(blob);
    mod = await import(url);
    if (resolver) {
      found = findAllComponents(mod);
      for (const k in found) {
        const v = found[k];
        resolver.classes[k] = v;
      }
    }
    if (components && path)
      components.setCompiled(path, mod);
    return mod;
  };
  var createRenderer = function(opts = {}) {
    let app, cacheComponent, compile2, componentCache, components, container, currentComponent, currentLayouts, currentParams, currentRoute, disposeEffect, generation, layoutInstances, maxCacheSize, mountPoint, mountRoute, onError, renderer, resolver, router, target, unmount;
    ({ router, app, components, resolver, compile: compile2, target, onError } = opts);
    container = typeof target === "string" ? document.querySelector(target) : target || document.getElementById("app");
    if (!container) {
      container = document.createElement("div");
      container.id = "app";
      document.body.appendChild(container);
    }
    container.style.opacity = "0";
    currentComponent = null;
    currentRoute = null;
    currentParams = null;
    currentLayouts = [];
    layoutInstances = [];
    mountPoint = container;
    generation = 0;
    disposeEffect = null;
    componentCache = new Map;
    maxCacheSize = opts.cacheSize || 10;
    cacheComponent = function() {
      let evicted, oldest;
      if (currentComponent && currentRoute) {
        if (currentComponent.beforeUnmount)
          currentComponent.beforeUnmount();
        componentCache.set(currentRoute, currentComponent);
        if (componentCache.size > maxCacheSize) {
          oldest = componentCache.keys().next().value;
          evicted = componentCache.get(oldest);
          if (evicted.unmounted)
            evicted.unmounted();
          componentCache.delete(oldest);
        }
        currentComponent = null;
        return currentRoute = null;
      }
    };
    unmount = function() {
      cacheComponent();
      for (let _i = layoutInstances.length - 1;_i >= 0; _i--) {
        const inst = layoutInstances[_i];
        if (inst.beforeUnmount)
          inst.beforeUnmount();
        if (inst.unmounted)
          inst.unmounted();
        inst._target?.remove();
      }
      layoutInstances = [];
      return mountPoint = container;
    };
    components.watch(function(event, path) {
      let evicted;
      if (componentCache.has(path)) {
        evicted = componentCache.get(path);
        if (evicted.unmounted)
          evicted.unmounted();
        return componentCache.delete(path);
      }
    });
    mountRoute = async function(info) {
      let Component, LayoutClass, cached, gen2, handled, inst, instance, layoutFiles, layoutMod, layoutSource, layoutsChanged, mod, mp, oldTarget, pageWrapper, params, pre, query, route, slot, source, wrapper;
      ({ route, params, layouts: layoutFiles, query } = info);
      if (!route)
        return;
      if (route.file === currentRoute && JSON.stringify(params) === JSON.stringify(currentParams)) {
        return;
      }
      currentParams = params;
      gen2 = ++generation;
      router.navigating = true;
      return (async () => {
        try {
          source = components.read(route.file);
          if (!source) {
            if (onError)
              onError({ status: 404, message: `File not found: ${route.file}` });
            router.navigating = false;
            return;
          }
          mod = await compileAndImport(source, compile2, components, route.file, resolver);
          if (gen2 !== generation) {
            router.navigating = false;
            return;
          }
          Component = findComponent(mod);
          if (!Component) {
            if (onError)
              onError({ status: 500, message: `No component found in ${route.file}` });
            router.navigating = false;
            return;
          }
          layoutsChanged = !arraysEqual(layoutFiles, currentLayouts);
          oldTarget = currentComponent?._target;
          if (layoutsChanged) {
            unmount();
          } else {
            cacheComponent();
          }
          mp = layoutsChanged ? container : mountPoint;
          if (layoutsChanged && layoutFiles.length > 0) {
            container.innerHTML = "";
            mp = container;
            for (const layoutFile of layoutFiles) {
              layoutSource = components.read(layoutFile);
              if (!layoutSource)
                continue;
              layoutMod = await compileAndImport(layoutSource, compile2, components, layoutFile, resolver);
              if (gen2 !== generation) {
                router.navigating = false;
                return;
              }
              LayoutClass = findComponent(layoutMod);
              if (!LayoutClass)
                continue;
              inst = new LayoutClass({ app, params, router });
              if (inst.beforeMount)
                inst.beforeMount();
              wrapper = document.createElement("div");
              wrapper.setAttribute("data-layout", layoutFile);
              mp.appendChild(wrapper);
              inst.mount(wrapper);
              layoutInstances.push(inst);
              slot = wrapper.querySelector("#content") || wrapper;
              mp = slot;
            }
            currentLayouts = [...layoutFiles];
            mountPoint = mp;
          } else if (layoutsChanged) {
            container.innerHTML = "";
            currentLayouts = [];
            mountPoint = container;
          }
          cached = componentCache.get(route.file);
          if (cached) {
            componentCache.delete(route.file);
            mp.appendChild(cached._target);
            currentComponent = cached;
            currentRoute = route.file;
          } else {
            pageWrapper = document.createElement("div");
            pageWrapper.setAttribute("data-component", route.file);
            mp.appendChild(pageWrapper);
            instance = new Component({ app, params, query, router });
            if (instance.beforeMount)
              instance.beforeMount();
            instance.mount(pageWrapper);
            currentComponent = instance;
            currentRoute = route.file;
            if (instance.load)
              await instance.load(params, query);
          }
          oldTarget?.remove();
          router.navigating = false;
          return container.style.opacity === "0" ? document.fonts.ready.then(function() {
            return requestAnimationFrame(function() {
              container.style.transition = "opacity 150ms ease-in";
              return container.style.opacity = "1";
            });
          }) : undefined;
        } catch (err) {
          router.navigating = false;
          container.style.opacity = "1";
          console.error(`Renderer: error mounting ${route.file}:`, err);
          if (onError)
            onError({ status: 500, message: err.message, error: err });
          handled = false;
          for (let _i = layoutInstances.length - 1;_i >= 0; _i--) {
            const inst2 = layoutInstances[_i];
            if (inst2.onError) {
              try {
                inst2.onError(err);
                handled = true;
                break;
              } catch (boundaryErr) {
                console.error("Renderer: error boundary failed:", boundaryErr);
              }
            }
          }
          return (() => {
            if (!handled) {
              pre = document.createElement("pre");
              pre.style.cssText = "color:red;padding:1em";
              pre.textContent = err.stack || err.message;
              container.innerHTML = "";
              return container.appendChild(pre);
            }
          })();
        }
      })();
    };
    renderer = { start: function() {
      disposeEffect = __effect(function() {
        let current;
        current = router.current;
        return current.route ? mountRoute(current) : undefined;
      });
      router.init();
      return renderer;
    }, stop: function() {
      unmount();
      if (disposeEffect) {
        disposeEffect();
        disposeEffect = null;
      }
      return container.innerHTML = "";
    }, remount: function() {
      let current;
      current = router.current;
      return current.route ? mountRoute(current) : undefined;
    }, cache: componentCache };
    return renderer;
  };
  connectWatch = function(url) {
    let connect, maxDelay, retryDelay;
    retryDelay = 1000;
    maxDelay = 30000;
    connect = function() {
      let es;
      es = new EventSource(url);
      es.addEventListener("connected", function() {
        retryDelay = 1000;
        return console.log("[Rip] Hot reload connected");
      });
      es.addEventListener("reload", function() {
        console.log("[Rip] Reloading...");
        return location.reload();
      });
      es.addEventListener("css", function() {
        for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
          url = new URL(link.href);
          url.searchParams.set("_t", Date.now());
          link.href = url.toString();
        }
      });
      return es.onerror = function() {
        es.close();
        setTimeout(connect, retryDelay);
        return retryDelay = Math.min(retryDelay * 2, maxDelay);
      };
    };
    return connect();
  };
  var launch = async function(appBase = "", opts = {}) {
    let app, appComponents, bundle, cached, classesKey, compile2, el, etag, etagKey, hash, headers, persist, renderer, res, resolver, router, target;
    globalThis.__ripLaunched = true;
    if (typeof appBase === "object") {
      opts = appBase;
      appBase = "";
    }
    appBase = appBase.replace(/\/+$/, "");
    target = opts.target || "#app";
    compile2 = opts.compile || null;
    persist = opts.persist || false;
    hash = opts.hash || false;
    if (!compile2) {
      compile2 = globalThis?.compileToJS || null;
    }
    if (typeof document !== "undefined" && !document.querySelector(target)) {
      el = document.createElement("div");
      el.id = target.replace(/^#/, "");
      document.body.prepend(el);
    }
    if (opts.bundle) {
      bundle = opts.bundle;
    } else if (opts.bundleUrl) {
      headers = {};
      etagKey = `__rip_etag_${opts.bundleUrl}`;
      cached = sessionStorage.getItem(etagKey);
      if (cached)
        headers["If-None-Match"] = cached;
      res = await fetch(opts.bundleUrl, { headers });
      if (res.status === 304) {
        bundle = JSON.parse(sessionStorage.getItem(`${etagKey}_data`));
      } else if (res.ok) {
        bundle = await res.json();
        etag = res.headers.get("etag");
        if (etag) {
          sessionStorage.setItem(etagKey, etag);
          sessionStorage.setItem(`${etagKey}_data`, JSON.stringify(bundle));
        }
      } else {
        throw new Error(`launch: ${opts.bundleUrl} (${res.status})`);
      }
    } else {
      throw new Error("launch: no bundle or bundleUrl provided");
    }
    app = stash({ components: {}, routes: {}, data: {} });
    globalThis.__ripApp = app;
    if (bundle.data)
      app.data = bundle.data;
    if (bundle.routes) {
      app.routes = bundle.routes;
    }
    if (persist && typeof sessionStorage !== "undefined") {
      persistStash(app, { local: persist === "local", key: `__rip_${appBase}` });
    }
    appComponents = createComponents();
    if (bundle.components)
      appComponents.load(bundle.components);
    classesKey = `__rip_${appBase.replace(/\//g, "_") || "app"}`;
    resolver = { map: buildComponentMap(appComponents), classes: {}, key: classesKey };
    if (typeof globalThis !== "undefined")
      globalThis[classesKey] = resolver.classes;
    if (app.data.title && typeof document !== "undefined")
      document.title = app.data.title;
    router = createRouter(appComponents, { root: "components", base: appBase, hash, onError: function(err) {
      return console.error(`[Rip] Error ${err.status}: ${err.message || err.path}`);
    } });
    renderer = createRenderer({ router, app, components: appComponents, resolver, compile: compile2, target, onError: function(err) {
      return console.error(`[Rip] ${err.message}`, err.error);
    } });
    renderer.start();
    if (bundle.data?.watch) {
      connectWatch(`${appBase}/watch`);
    }
    if (typeof window !== "undefined") {
      window.app = app;
      window.__RIP__ = { app, components: appComponents, router, renderer, cache: renderer.cache, version: "0.3.0" };
    }
    return { app, components: appComponents, router, renderer };
  };
  _ariaNAV = function(e, fn) {
    if (!fn)
      return;
    e.preventDefault();
    e.stopPropagation();
    return fn();
  };
  globalThis.__ariaLastFocusedEl ??= null;
  if (typeof document !== "undefined" && !globalThis.__ariaFocusTrackerBound) {
    document.addEventListener("focusin", function(e) {
      return globalThis.__ariaLastFocusedEl = e.target;
    }, true);
    globalThis.__ariaFocusTrackerBound = true;
  }
  _ariaListNav = function(e, h) {
    if (e.isComposing)
      return;
    return (() => {
      switch (e.key) {
        case "ArrowDown":
          return _ariaNAV(e, h.next);
        case "ArrowUp":
          return _ariaNAV(e, h.prev);
        case "Home":
        case "PageUp":
          return _ariaNAV(e, h.first);
        case "End":
        case "PageDown":
          return _ariaNAV(e, h.last);
        case "Enter":
        case " ":
          return _ariaNAV(e, h.select);
        case "Escape":
          return _ariaNAV(e, h.dismiss);
        case "Tab":
          return h.tab?.();
        default:
          return e.key.length === 1 ? h.char?.(e.key) : undefined;
      }
    })();
  };
  _ariaPopupDismiss = function(open, popup, close, els = [], repos = null) {
    let get, onDown, onScroll;
    if (!open)
      return;
    get = function(x) {
      return typeof x === "function" ? x() : x;
    };
    onDown = (e) => {
      return ![get(popup), ...els.map(get)].some(function(el) {
        return el?.contains(e.target);
      }) ? close() : undefined;
    };
    onScroll = (e) => {
      if (get(popup)?.contains(e.target))
        return;
      return repos ? repos() : close();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return function() {
      document.removeEventListener("mousedown", onDown);
      return window.removeEventListener("scroll", onScroll, true);
    };
  };
  _ariaPopupGuard = function(delay2 = 250) {
    let blockedUntil;
    blockedUntil = 0;
    return { block: function(ms = delay2) {
      return blockedUntil = Date.now() + ms;
    }, canOpen: function() {
      return Date.now() >= blockedUntil;
    } };
  };
  _ariaBindPopover = function(open, popover, setOpen, source = null) {
    let currentFocus, desired, el, get, onToggle, opts, restoreEl, restoreFocus, shown, src, syncState;
    get = function(x) {
      return typeof x === "function" ? x() : x;
    };
    currentFocus = function() {
      let active, last;
      active = document.activeElement;
      if (active && active !== document.body)
        return active;
      last = globalThis.__ariaLastFocusedEl;
      if (last?.isConnected !== false)
        return last;
      return null;
    };
    el = get(popover);
    if (!el)
      return;
    if (!Object.hasOwn(HTMLElement.prototype, "togglePopover"))
      return;
    restoreEl = null;
    syncState = function(isOpen) {
      if (isOpen) {
        el.hidden = false;
        try {
          el.inert = false;
        } catch {}
        return el.removeAttribute("aria-hidden");
      } else {
        try {
          el.inert = true;
        } catch {}
        el.setAttribute("aria-hidden", "true");
        return el.hidden = true;
      }
    };
    restoreFocus = function() {
      let focusAttempt, target;
      target = restoreEl;
      restoreEl = null;
      if (!target?.focus)
        return;
      focusAttempt = function(tries = 6) {
        if (!(target.isConnected !== false))
          return;
        try {
          target.focus({ preventScroll: true });
        } catch {
          target.focus();
        }
        if (document.activeElement === target || tries <= 1)
          return;
        return setTimeout(function() {
          return focusAttempt(tries - 1);
        }, 16);
      };
      return requestAnimationFrame(function() {
        return focusAttempt();
      });
    };
    onToggle = function(e) {
      let isOpen;
      isOpen = e.newState === "open";
      if (isOpen) {
        restoreEl = get(source) || currentFocus();
        syncState(true);
      } else {
        syncState(false);
        restoreFocus();
      }
      return setOpen?.(isOpen);
    };
    el.addEventListener("toggle", onToggle);
    shown = el.matches(":popover-open");
    desired = !!open;
    if (shown !== desired) {
      src = get(source);
      if (desired) {
        restoreEl = src || currentFocus();
        syncState(true);
      }
      opts = src && desired ? { force: desired, source: src } : { force: desired };
      try {
        el.togglePopover(opts);
      } catch {}
    } else {
      syncState(desired);
    }
    return function() {
      return el.removeEventListener("toggle", onToggle);
    };
  };
  _ariaBindDialog = function(open, dialog, setOpen, dismissable = true) {
    let currentFocus, el, get, onCancel, onClose, restoreEl, restoreFocus, syncState;
    get = function(x) {
      return typeof x === "function" ? x() : x;
    };
    currentFocus = function() {
      let active, last;
      active = document.activeElement;
      if (active && active !== document.body)
        return active;
      last = globalThis.__ariaLastFocusedEl;
      if (last?.isConnected !== false)
        return last;
      return null;
    };
    el = get(dialog);
    if (!el?.showModal)
      return;
    restoreEl = null;
    syncState = function(isOpen) {
      if (isOpen) {
        el.hidden = false;
        try {
          el.inert = false;
        } catch {}
        return el.removeAttribute("aria-hidden");
      } else {
        try {
          el.inert = true;
        } catch {}
        el.setAttribute("aria-hidden", "true");
        return el.hidden = true;
      }
    };
    restoreFocus = function() {
      let focusAttempt, target;
      target = restoreEl;
      restoreEl = null;
      if (!target?.focus)
        return;
      focusAttempt = function(tries = 6) {
        if (!(target.isConnected !== false))
          return;
        try {
          target.focus({ preventScroll: true });
        } catch {
          target.focus();
        }
        if (document.activeElement === target || tries <= 1)
          return;
        return setTimeout(function() {
          return focusAttempt(tries - 1);
        }, 16);
      };
      return requestAnimationFrame(function() {
        return focusAttempt();
      });
    };
    onCancel = function(e) {
      if (!dismissable) {
        e.preventDefault();
        return;
      }
      return setOpen?.(false);
    };
    onClose = function() {
      setOpen?.(false);
      syncState(false);
      return restoreFocus();
    };
    el.addEventListener("cancel", onCancel);
    el.addEventListener("close", onClose);
    if (open && !el.open) {
      if (!restoreEl)
        restoreEl = currentFocus();
      syncState(true);
      try {
        el.showModal();
      } catch {}
    } else if (!open && el.open) {
      el.close();
    } else {
      syncState(!!open);
    }
    return function() {
      el.removeEventListener("cancel", onCancel);
      return el.removeEventListener("close", onClose);
    };
  };
  _ariaRovingNav = function(e, h, orientation = "vertical") {
    let horz, vert;
    if (e.isComposing)
      return;
    vert = orientation !== "horizontal";
    horz = orientation !== "vertical";
    return (() => {
      switch (e.key) {
        case "ArrowDown":
          return vert ? _ariaNAV(e, h.next) : undefined;
        case "ArrowUp":
          return vert ? _ariaNAV(e, h.prev) : undefined;
        case "ArrowRight":
          return horz ? _ariaNAV(e, h.next) : undefined;
        case "ArrowLeft":
          return horz ? _ariaNAV(e, h.prev) : undefined;
        case "Home":
        case "PageUp":
          return _ariaNAV(e, h.first);
        case "End":
        case "PageDown":
          return _ariaNAV(e, h.last);
        case "Enter":
        case " ":
          return _ariaNAV(e, h.select);
        case "Escape":
          return _ariaNAV(e, h.dismiss);
        default:
          return e.key.length === 1 ? h.char?.(e.key) : undefined;
      }
    })();
  };
  _ariaPositionBelow = function(trigger, popup, gap = 4, setVisible = true) {
    let fl, tr;
    if (!(trigger && popup))
      return;
    tr = trigger.getBoundingClientRect();
    popup.style.position = "fixed";
    popup.style.left = `${tr.left}px`;
    popup.style.top = `${tr.bottom + gap}px`;
    popup.style.minWidth = `${tr.width}px`;
    fl = popup.getBoundingClientRect();
    if (fl.bottom > window.innerHeight)
      popup.style.top = `${tr.top - fl.height - gap}px`;
    if (fl.right > window.innerWidth)
      popup.style.left = `${window.innerWidth - fl.width - gap}px`;
    return setVisible ? popup.style.visibility = "visible" : undefined;
  };
  var _FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  _ariaTrapFocus = function(panel) {
    let handler;
    handler = function(e) {
      let first, last, list;
      if (!(e.key === "Tab"))
        return;
      list = Array.from(panel.querySelectorAll(_FOCUSABLE)).filter(function(f) {
        return f.offsetParent !== null;
      });
      if (!list.length)
        return;
      first = list[0];
      last = list[list.length - 1];
      return e.shiftKey ? document.activeElement === first ? (e.preventDefault(), last.focus()) : undefined : document.activeElement === last ? (e.preventDefault(), first.focus()) : undefined;
    };
    panel.addEventListener("keydown", handler);
    return function() {
      return panel.removeEventListener("keydown", handler);
    };
  };
  _ariaWireAria = function(panel, id) {
    let desc, heading;
    if (!panel)
      return;
    heading = panel.querySelector("h1,h2,h3,h4,h5,h6");
    if (heading) {
      heading.id ??= `${id}-title`;
      panel.setAttribute("aria-labelledby", heading.id);
    }
    desc = panel.querySelector("p");
    if (desc) {
      desc.id ??= `${id}-desc`;
      return panel.setAttribute("aria-describedby", desc.id);
    }
  };
  _ariaModalStack = [];
  _ariaLockScroll = function(instance) {
    let scrollY;
    scrollY = window.scrollY;
    _ariaModalStack.push({ instance, scrollY });
    if (_ariaModalStack.length === 1) {
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      return document.body.style.width = "100%";
    }
  };
  _ariaUnlockScroll = function(instance) {
    let idx, scrollY;
    idx = _ariaModalStack.findIndex(function(m) {
      return m.instance === instance;
    });
    if (idx < 0)
      return;
    ({ scrollY } = _ariaModalStack.splice(idx, 1)[0]);
    if (!_ariaModalStack.length) {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      return window.scrollTo(0, scrollY);
    }
  };
  _ariaHasAnchor = function() {
    let anchor, floating, rect;
    return (() => {
      try {
        if (!document?.createElement)
          return false;
        anchor = document.createElement("div");
        floating = document.createElement("div");
        anchor.style.cssText = "position:fixed;top:100px;left:100px;width:10px;height:10px;anchor-name:--probe";
        floating.style.cssText = "position:fixed;inset:auto;margin:0;position-anchor:--probe;position-area:bottom start;width:10px;height:10px";
        document.body.appendChild(anchor);
        document.body.appendChild(floating);
        rect = floating.getBoundingClientRect();
        anchor.remove();
        floating.remove();
        return rect.top > 50;
      } catch {
        return false;
      }
    })();
  }();
  _ariaPosition = function(trigger, floating, opts = {}) {
    let align, matchWidth, name, offset, placement, rect, side;
    if (!(trigger && floating))
      return;
    placement = opts.placement ?? "bottom start";
    offset = opts.offset ?? 4;
    matchWidth = opts.matchWidth ?? false;
    if (_ariaHasAnchor) {
      name = `--anchor-${floating.id || Math.random().toString(36).slice(2, 8)}`;
      trigger.style.anchorName = name;
      floating.style.positionAnchor = name;
      floating.style.position = "fixed";
      floating.style.inset = "auto";
      floating.style.margin = "0";
      floating.style.positionArea = placement;
      floating.style.positionTry = "flip-block, flip-inline, flip-block flip-inline";
      floating.style.positionVisibility = "anchors-visible";
      [side] = placement.split(" ");
      floating.style.marginTop = "";
      floating.style.marginBottom = "";
      floating.style.marginLeft = "";
      floating.style.marginRight = "";
      switch (side) {
        case "bottom":
          floating.style.marginTop = `${offset}px`;
          break;
        case "top":
          floating.style.marginBottom = `${offset}px`;
          break;
        case "left":
          floating.style.marginRight = `${offset}px`;
          break;
        case "right":
          floating.style.marginLeft = `${offset}px`;
          break;
      }
      return matchWidth ? floating.style.minWidth = "anchor-size(width)" : undefined;
    } else {
      rect = trigger.getBoundingClientRect();
      floating.style.position = "fixed";
      floating.style.inset = "auto";
      floating.style.margin = "0";
      [side, align] = placement.split(" ");
      align ??= "start";
      switch (side) {
        case "bottom":
          floating.style.top = `${rect.bottom + offset}px`;
          break;
        case "top":
          floating.style.bottom = `${window.innerHeight - rect.top + offset}px`;
          break;
        case "left":
          floating.style.right = `${window.innerWidth - rect.left + offset}px`;
          break;
        case "right":
          floating.style.left = `${rect.right + offset}px`;
          break;
      }
      if (Array.isArray(["bottom", "top"]) ? ["bottom", "top"].includes(side) : (side in ["bottom", "top"])) {
        switch (align) {
          case "start":
            floating.style.left = `${rect.left}px`;
            break;
          case "center":
            floating.style.left = `${rect.left + rect.width / 2}px`;
            floating.style.transform = "translateX(-50%)";
            break;
          case "end":
            floating.style.right = `${window.innerWidth - rect.right}px`;
            break;
        }
      } else {
        switch (align) {
          case "start":
            floating.style.top = `${rect.top}px`;
            break;
          case "center":
            floating.style.top = `${rect.top + rect.height / 2}px`;
            floating.style.transform = "translateY(-50%)";
            break;
          case "end":
            floating.style.bottom = `${window.innerHeight - rect.bottom}px`;
            break;
        }
      }
      return matchWidth ? floating.style.minWidth = `${rect.width}px` : undefined;
    }
  };
  globalThis.__aria ??= { listNav: _ariaListNav, rovingNav: _ariaRovingNav, popupDismiss: _ariaPopupDismiss, popupGuard: _ariaPopupGuard, bindPopover: _ariaBindPopover, bindDialog: _ariaBindDialog, positionBelow: _ariaPositionBelow, trapFocus: _ariaTrapFocus, wireAria: _ariaWireAria, lockScroll: _ariaLockScroll, unlockScroll: _ariaUnlockScroll, position: _ariaPosition, hasAnchor: _ariaHasAnchor };
  globalThis.ARIA ??= globalThis.__aria;

  // docs/dist/_entry.js
  importRip.modules["ui.rip"] = exports__ui;
  for (const [k, v] of Object.entries(exports__ui))
    if (typeof v === "function")
      globalThis[k] = v;
})();
