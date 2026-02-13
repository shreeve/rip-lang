// src/tags.js
var HTML_TAGS = new Set([
  "html",
  "head",
  "title",
  "base",
  "link",
  "meta",
  "style",
  "body",
  "address",
  "article",
  "aside",
  "footer",
  "header",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "main",
  "nav",
  "section",
  "blockquote",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "ul",
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "data",
  "dfn",
  "em",
  "i",
  "kbd",
  "mark",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
  "area",
  "audio",
  "img",
  "map",
  "track",
  "video",
  "embed",
  "iframe",
  "object",
  "param",
  "picture",
  "portal",
  "source",
  "svg",
  "math",
  "canvas",
  "noscript",
  "script",
  "del",
  "ins",
  "caption",
  "col",
  "colgroup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "button",
  "datalist",
  "fieldset",
  "form",
  "input",
  "label",
  "legend",
  "meter",
  "optgroup",
  "option",
  "output",
  "progress",
  "select",
  "textarea",
  "details",
  "dialog",
  "menu",
  "summary",
  "slot",
  "template"
]);
var SVG_TAGS = new Set([
  "svg",
  "g",
  "defs",
  "symbol",
  "use",
  "marker",
  "clipPath",
  "mask",
  "pattern",
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "text",
  "textPath",
  "tspan",
  "linearGradient",
  "radialGradient",
  "stop",
  "filter",
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
  "animate",
  "animateMotion",
  "animateTransform",
  "set",
  "mpath",
  "desc",
  "foreignObject",
  "image",
  "metadata",
  "switch",
  "title",
  "view"
]);
var TEMPLATE_TAGS = new Set([...HTML_TAGS, ...SVG_TAGS]);

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
          if (genTokens) {
            let isAlias = !isDef && tokens2[i + 1 + genTokens.length]?.[0] === "TYPE_ALIAS";
            if (isDef || isAlias) {
              if (!token.data)
                token.data = {};
              token.data.typeParams = buildTypeString(genTokens);
              tokens2.splice(i + 1, genTokens.length);
              if (isDef && tokens2[i + 1]?.[0] === "(") {
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
      if (tag === "TYPE_ALIAS") {
        let nameToken = tokens2[i - 1];
        if (!nameToken)
          return 1;
        let name = nameToken[1];
        let exported = i >= 2 && tokens2[i - 2]?.[0] === "EXPORT";
        let removeFrom = exported ? i - 2 : i - 1;
        let next = tokens2[i + 1];
        let makeDecl = (typeText) => {
          let dt = gen("TYPE_DECL", name, nameToken);
          dt.data = { name, typeText, exported };
          if (nameToken.data?.typeParams)
            dt.data.typeParams = nameToken.data.typeParams;
          return dt;
        };
        if (next && next[0] === "IDENTIFIER" && next[1] === "type" && tokens2[i + 2]?.[0] === "INDENT") {
          let endIdx = findMatchingOutdent(tokens2, i + 2);
          tokens2.splice(removeFrom, endIdx - removeFrom + 1, makeDecl(collectStructuralType(tokens2, i + 2)));
          return 0;
        }
        if (next && (next[0] === "TERMINATOR" || next[0] === "INDENT")) {
          let result = collectBlockUnion(tokens2, i + 1);
          if (result) {
            tokens2.splice(removeFrom, result.endIdx - removeFrom + 1, makeDecl(result.typeText));
            return 0;
          }
        }
        let typeTokens = collectTypeExpression(tokens2, i + 1);
        tokens2.splice(removeFrom, i + 1 + typeTokens.length - removeFrom, makeDecl(buildTypeString(typeTokens)));
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
    let isOpen = tTag === "(" || tTag === "[" || tTag === "CALL_START" || tTag === "PARAM_START" || tTag === "INDEX_START" || tTag === "COMPARE" && t[1] === "<";
    let isClose = tTag === ")" || tTag === "]" || tTag === "CALL_END" || tTag === "PARAM_END" || tTag === "INDEX_END" || tTag === "COMPARE" && t[1] === ">";
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
      if (tTag === "=" || tTag === "REACTIVE_ASSIGN" || tTag === "COMPUTED_ASSIGN" || tTag === "READONLY_ASSIGN" || tTag === "REACT_ASSIGN" || tTag === "TERMINATOR" || tTag === "INDENT" || tTag === "OUTDENT" || tTag === "->" || tTag === ",") {
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
    if (depth === 1 && (t[0] === "PROPERTY" || t[0] === "IDENTIFIER")) {
      let propName = t[1];
      let optional = false;
      let readonly = false;
      j++;
      if (propName === "readonly" && (tokens[j]?.[0] === "PROPERTY" || tokens[j]?.[0] === "IDENTIFIER")) {
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
function emitTypes(tokens, sexpr = null) {
  let lines = [];
  let indentLevel = 0;
  let indentStr = "  ";
  let indent = () => indentStr.repeat(indentLevel);
  let inClass = false;
  let usesSignal = false;
  let usesComputed = false;
  let emitBlock = (prefix, body, suffix) => {
    if (body.startsWith("{ ") && body.endsWith(" }")) {
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
    lines.push(`${indent()}${prefix}${body}${suffix}`);
  };
  let collectParams = (tokens2, startIdx) => {
    let params = [];
    let j = startIdx;
    let openTag = tokens2[j]?.[0];
    if (openTag !== "CALL_START" && openTag !== "PARAM_START")
      return { params, endIdx: j };
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
        let pattern = "{";
        j++;
        let d = 1;
        while (j < tokens2.length && d > 0) {
          if (tokens2[j][0] === "{")
            d++;
          if (tokens2[j][0] === "}")
            d--;
          if (d > 0)
            pattern += tokens2[j][1] + (tokens2[j + 1]?.[0] === "}" ? "" : ", ");
          j++;
        }
        pattern += "}";
        let type = tokens2[j - 1]?.data?.type;
        params.push(type ? `${pattern}: ${expandSuffixes(type)}` : pattern);
        continue;
      }
      if (tok[0] === "IDENTIFIER") {
        let paramName = tok[1];
        let paramType = tok.data?.type;
        let hasDefault = false;
        if (tokens2[j + 1]?.[0] === "=") {
          hasDefault = true;
        }
        if (paramType) {
          params.push(`${paramName}${hasDefault ? "?" : ""}: ${expandSuffixes(paramType)}`);
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
    return { params, endIdx: j };
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
          if (tokens[j]?.[0] === "PARAM_START") {
            let result = collectParams(tokens, j);
            params = result.params;
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
        } else if (next[0] === "REACT_ASSIGN") {
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
          } else {
            lines.push(`${indent()}${exp}let ${varName}: ${type};`);
          }
        } else if (inClass) {
          lines.push(`${indent()}${varName}: ${type};`);
        }
      } else if (inClass) {
        lines.push(`${indent()}${varName}: ${type};`);
      }
    }
  }
  let componentVars = new Set;
  if (sexpr) {
    emitComponentTypes(sexpr, lines, indent, indentLevel, componentVars);
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
  if (usesSignal) {
    preamble.push("interface Signal<T> { value: T; read(): T; lock(): Signal<T>; free(): Signal<T>; kill(): T; }");
  }
  if (usesComputed) {
    preamble.push("interface Computed<T> { readonly value: T; read(): T; lock(): Computed<T>; free(): Computed<T>; kill(): T; }");
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
function emitComponentTypes(sexpr, lines, indent, indentLevel, componentVars) {
  if (!Array.isArray(sexpr))
    return;
  let head = sexpr[0]?.valueOf?.() ?? sexpr[0];
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
    let body = compNode[2];
    let members = Array.isArray(body) && (body[0]?.valueOf?.() ?? body[0]) === "block" ? body.slice(1) : body ? [body] : [];
    let props = [];
    let methods = [];
    for (let member of members) {
      if (!Array.isArray(member))
        continue;
      let mHead = member[0]?.valueOf?.() ?? member[0];
      if (mHead === "state") {
        let propName = member[1]?.valueOf?.() ?? member[1];
        let type = member[1]?.type;
        props.push(`  ${propName}: ${type ? expandSuffixes(type) : "any"};`);
        componentVars.add(propName);
      } else if (mHead === "computed") {
        let propName = member[1]?.valueOf?.() ?? member[1];
        let type = member[1]?.type;
        props.push(`  readonly ${propName}: ${type ? expandSuffixes(type) : "any"};`);
        componentVars.add(propName);
      } else if (mHead === "object") {
        for (let j = 1;j < member.length; j++) {
          let entry = member[j];
          if (!Array.isArray(entry))
            continue;
          let methodName = entry[0]?.valueOf?.() ?? entry[0];
          if (methodName === "render")
            continue;
          let fn = entry[1];
          if (Array.isArray(fn)) {
            let fnHead = fn[0]?.valueOf?.() ?? fn[0];
            if (fnHead === "->" || fnHead === "=>") {
              methods.push(`  ${methodName}(): void;`);
            }
          }
        }
      } else if (mHead === "render") {
        continue;
      }
    }
    lines.push(`${exp}declare class ${name} {`);
    lines.push(`  constructor(props?: Record<string, any>);`);
    for (let p of props)
      lines.push(p);
    for (let m of methods)
      lines.push(m);
    lines.push(`  mount(target: Element | string): ${name};`);
    lines.push(`  unmount(): void;`);
    lines.push(`}`);
  }
  if (head === "program" || head === "block") {
    for (let i = 1;i < sexpr.length; i++) {
      if (Array.isArray(sexpr[i])) {
        emitComponentTypes(sexpr[i], lines, indent, indentLevel, componentVars);
      }
    }
  }
  if (head === "export" && Array.isArray(sexpr[1]) && !compNode) {
    emitComponentTypes(sexpr[1], lines, indent, indentLevel, componentVars);
  }
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
  "}"
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
  "}"
]);
var EXPRESSION_START = new Set(["(", "[", "{", "INDENT", "CALL_START", "PARAM_START", "INDEX_START", "STRING_START", "INTERPOLATION_START", "REGEX_START"]);
var EXPRESSION_END = new Set([")", "]", "}", "OUTDENT", "CALL_END", "PARAM_END", "INDEX_END", "STRING_END", "INTERPOLATION_END", "REGEX_END"]);
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
  REGEX_END: "REGEX_START"
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
  "SPACE?",
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
var IDENTIFIER_RE = /^(?!\d)((?:(?!\s)[$\w\x7f-\uffff])+(?:!|[?](?![.?[(]))?)([^\n\S]*:(?![=:]))?/;
var NUMBER_RE = /^0b[01](?:_?[01])*n?|^0o[0-7](?:_?[0-7])*n?|^0x[\da-f](?:_?[\da-f])*n?|^\d+(?:_\d+)*n|^(?:\d+(?:_\d+)*)?\.?\d+(?:_\d+)*(?:e[+-]?\d+(?:_\d+)*)?/i;
var OPERATOR_RE = /^(?:<=>|::=|::|[-=]>|~>|~=|:=|=!|===|!==|!\?|\?\?|=~|\|>|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|<>*\/%])\2=?|\?\.?|\.{2,3})/;
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
    if (colon && prev && prev[0] === "SPACE?")
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
    if (tag === "IDENTIFIER" && RESERVED.has(baseId)) {
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
  literalToken() {
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
      tag = "TERMINATOR";
    } else if (val === "|>")
      tag = "PIPE";
    else if (val === "::=")
      tag = "TYPE_ALIAS";
    else if (val === "::" && /^[a-zA-Z_$]/.test(this.chunk[2] || "")) {
      this.emit(".", ".");
      this.emit("PROPERTY", "prototype");
      this.emit(".", ".");
      return 2;
    } else if (val === "::")
      tag = "TYPE_ANNOTATION";
    else if (val === "~=")
      tag = "COMPUTED_ASSIGN";
    else if (val === ":=")
      tag = "REACTIVE_ASSIGN";
    else if (val === "<=>")
      tag = "BIND";
    else if (val === "~>")
      tag = "REACT_ASSIGN";
    else if (val === "=!")
      tag = "READONLY_ASSIGN";
    else if (val === "*" && (!prev || prev[0] === "TERMINATOR" || prev[0] === "INDENT" || prev[0] === "OUTDENT") && (/^[a-zA-Z_$]/.test(this.chunk[1] || "") || this.chunk[1] === "@")) {
      let rest = this.chunk.slice(1);
      let mAt = /^@(\s*)=(?!=)/.exec(rest);
      if (mAt) {
        let space = mAt[1];
        this.emit("IDENTIFIER", "Object");
        this.emit(".", ".");
        let t = this.emit("PROPERTY", "assign");
        t.spaced = true;
        this.emit("@", "@");
        this.emit(",", ",");
        return 1 + 1 + space.length + 1;
      }
      let m = /^((?:(?!\s)[$\w\x7f-\uffff])+(?:\.[a-zA-Z_$][\w]*)*)(\s*)=(?!=)/.exec(rest);
      if (m) {
        let target = m[1], space = m[2];
        let parts = target.split(".");
        let emitTarget = () => {
          this.emit("IDENTIFIER", parts[0]);
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
        return 1 + target.length + space.length + 1;
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
      tag = "SPACE?";
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
    this.closeOpenCalls();
    this.closeOpenIndexes();
    this.normalizeLines();
    this.rewriteRender();
    this.rewriteTypes();
    this.tagPostfixConditionals();
    this.addImplicitBracesAndParens();
    this.addImplicitCallCommas();
    this.closeMergeAssignments();
    return this.tokens;
  }
  removeLeadingNewlines() {
    let i = 0;
    while (this.tokens[i]?.[0] === "TERMINATOR")
      i++;
    if (i > 0)
      this.tokens.splice(0, i);
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
      if (SINGLE_LINERS.has(tag) && this.tokens[i + 1]?.[0] !== "INDENT" && !(tag === "ELSE" && this.tokens[i + 1]?.[0] === "IF")) {
        starter = tag;
        [indent, outdent] = this.makeIndentation();
        if (tag === "THEN")
          indent.fromThen = true;
        tokens.splice(i + 1, 0, indent);
        this.detectEnd(i + 2, condition, action);
        if (tag === "THEN")
          tokens.splice(i, 1);
        return 1;
      }
      return 1;
    });
  }
  rewriteRender() {
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
    let startsWithTag = (tokens, i) => {
      let j = i;
      while (j > 0) {
        let pt = tokens[j - 1][0];
        if (pt === "INDENT" || pt === "OUTDENT" || pt === "TERMINATOR" || pt === "RENDER" || pt === "CALL_END" || pt === ")") {
          break;
        }
        j--;
      }
      return tokens[j] && tokens[j][0] === "IDENTIFIER" && isTemplateTag(tokens[j][1]);
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
          let callEndToken = gen("CALL_END", ")", token);
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
          token[0] = "STRING";
          token[1] = `"${parts.join("-")}"`;
          tokens.splice(i + 1, j - i - 1);
          return 1;
        }
      }
      if (tag === ".") {
        let prevToken = i > 0 ? tokens[i - 1] : null;
        let prevTag = prevToken ? prevToken[0] : null;
        if (prevTag === "INDENT" || prevTag === "TERMINATOR") {
          if (nextToken && nextToken[0] === "PROPERTY") {
            let divToken = gen("IDENTIFIER", "div", token);
            tokens.splice(i, 0, divToken);
            return 2;
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
          return 1;
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
            let openBracket = gen("[", "[", token);
            tokens.splice(i, 0, openBracket);
            let closeBracket = gen("]", "]", tokens[j + 1]);
            tokens.splice(j + 1, 0, closeBracket);
            return 2;
          }
        }
      }
      if (tag === "." && nextToken && nextToken[0] === "(") {
        let prevToken = i > 0 ? tokens[i - 1] : null;
        let prevTag = prevToken ? prevToken[0] : null;
        let atLineStart = prevTag === "INDENT" || prevTag === "TERMINATOR";
        let cxToken = gen("PROPERTY", "__clsx", token);
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
          let divToken = gen("IDENTIFIER", "div", token);
          tokens.splice(i, 0, divToken);
          tokens.splice(i + 2, 0, cxToken);
          return 3;
        } else {
          tokens.splice(i + 1, 0, cxToken);
          return 2;
        }
      }
      if (nextToken && nextToken[0] === "INDENT") {
        if (tag === "->" || tag === "=>" || tag === "CALL_START" || tag === "(") {
          return 1;
        }
        let isTemplateElement = false;
        if (tag === "IDENTIFIER" && isTemplateTag(token[1])) {
          isTemplateElement = true;
        } else if (tag === "PROPERTY" || tag === "STRING" || tag === "CALL_END" || tag === ")") {
          isTemplateElement = startsWithTag(tokens, i);
        } else if (tag === "IDENTIFIER" && i > 1 && tokens[i - 1][0] === "...") {
          if (startsWithTag(tokens, i)) {
            let commaToken = gen(",", ",", token);
            let arrowToken = gen("->", "->", token);
            arrowToken.newLine = true;
            tokens.splice(i + 1, 0, commaToken, arrowToken);
            return 3;
          }
        }
        if (isTemplateElement) {
          let isClassOrIdTail = tag === "PROPERTY" && i > 0 && (tokens[i - 1][0] === "." || tokens[i - 1][0] === "#");
          if (tag === "IDENTIFIER" && isTemplateTag(token[1]) || isClassOrIdTail) {
            let callStartToken = gen("CALL_START", "(", token);
            let arrowToken = gen("->", "->", token);
            arrowToken.newLine = true;
            tokens.splice(i + 1, 0, callStartToken, arrowToken);
            pendingCallEnds.push(currentIndent + 1);
            return 3;
          } else {
            let commaToken = gen(",", ",", token);
            let arrowToken = gen("->", "->", token);
            arrowToken.newLine = true;
            tokens.splice(i + 1, 0, commaToken, arrowToken);
            return 3;
          }
        }
      }
      if (tag === "IDENTIFIER" && isComponent(token[1]) && nextToken && (nextToken[0] === "OUTDENT" || nextToken[0] === "TERMINATOR")) {
        tokens.splice(i + 1, 0, gen("CALL_START", "(", token), gen("CALL_END", ")", token));
        return 3;
      }
      return 1;
    });
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
      original = token;
      this.detectEnd(i + 1, condition, action);
      return 1;
    });
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
      if (tag === "SPACE?")
        inTernary = true;
      if (tag === ":") {
        if (inTernary) {
          inTernary = false;
          return forward(1);
        }
        let s = EXPRESSION_END.has(this.tokens[i - 1]?.[0]) ? stack[stack.length - 1]?.[1] ?? i - 1 : i - 1;
        if (this.tokens[i - 2]?.[0] === "@")
          s = i - 2;
        let startsLine = s <= 0 || LINE_BREAK.has(this.tokens[s - 1]?.[0]) || this.tokens[s - 1]?.newLine;
        if (stackTop()) {
          let [stackTag, stackIdx] = stackTop();
          let stackNext = stack[stack.length - 2];
          if ((stackTag === "{" || stackTag === "INDENT" && stackNext?.[0] === "{" && !isImplicit(stackNext)) && (startsLine || this.tokens[s - 1]?.[0] === "," || this.tokens[s - 1]?.[0] === "{" || this.tokens[s]?.[0] === "{")) {
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
  symbolIds: { $accept: 0, $end: 1, error: 2, Root: 3, Body: 4, Line: 5, TERMINATOR: 6, Expression: 7, ExpressionLine: 8, Statement: 9, Return: 10, STATEMENT: 11, Import: 12, Export: 13, Value: 14, Code: 15, Operation: 16, Assign: 17, ReactiveAssign: 18, ComputedAssign: 19, ReadonlyAssign: 20, ReactAssign: 21, If: 22, Try: 23, While: 24, For: 25, Switch: 26, Class: 27, Component: 28, Render: 29, Throw: 30, Yield: 31, Def: 32, Enum: 33, CodeLine: 34, OperationLine: 35, Assignable: 36, Literal: 37, Parenthetical: 38, Range: 39, Invocation: 40, DoIife: 41, This: 42, Super: 43, MetaProperty: 44, AlphaNumeric: 45, JS: 46, Regex: 47, UNDEFINED: 48, NULL: 49, BOOL: 50, INFINITY: 51, NAN: 52, NUMBER: 53, String: 54, Identifier: 55, IDENTIFIER: 56, Property: 57, PROPERTY: 58, STRING: 59, STRING_START: 60, Interpolations: 61, STRING_END: 62, InterpolationChunk: 63, INTERPOLATION_START: 64, INTERPOLATION_END: 65, INDENT: 66, OUTDENT: 67, REGEX: 68, REGEX_START: 69, REGEX_END: 70, RegexWithIndex: 71, ",": 72, "=": 73, REACTIVE_ASSIGN: 74, COMPUTED_ASSIGN: 75, READONLY_ASSIGN: 76, REACT_ASSIGN: 77, SimpleAssignable: 78, Array: 79, Object: 80, ThisProperty: 81, ".": 82, "?.": 83, INDEX_START: 84, INDEX_END: 85, Slice: 86, ES6_OPTIONAL_INDEX: 87, "{": 88, ObjAssignable: 89, ":": 90, FOR: 91, ForVariables: 92, FOROF: 93, OptComma: 94, "}": 95, WHEN: 96, OWN: 97, AssignList: 98, AssignObj: 99, ObjRestValue: 100, SimpleObjAssignable: 101, "[": 102, "]": 103, "@": 104, "...": 105, ObjSpreadExpr: 106, SUPER: 107, Arguments: 108, DYNAMIC_IMPORT: 109, Elisions: 110, ArgElisionList: 111, OptElisions: 112, ArgElision: 113, Arg: 114, Elision: 115, RangeDots: 116, "..": 117, DEF: 118, CALL_START: 119, ParamList: 120, CALL_END: 121, Block: 122, PARAM_START: 123, PARAM_END: 124, FuncGlyph: 125, "->": 126, "=>": 127, Param: 128, ParamVar: 129, Splat: 130, ES6_OPTIONAL_CALL: 131, ArgList: 132, SimpleArgs: 133, THIS: 134, NEW_TARGET: 135, IMPORT_META: 136, "(": 137, ")": 138, RETURN: 139, THROW: 140, YIELD: 141, FROM: 142, IfBlock: 143, IF: 144, ELSE: 145, UnlessBlock: 146, UNLESS: 147, POST_IF: 148, POST_UNLESS: 149, TRY: 150, Catch: 151, FINALLY: 152, CATCH: 153, SWITCH: 154, Whens: 155, When: 156, LEADING_WHEN: 157, WhileSource: 158, WHILE: 159, UNTIL: 160, Loop: 161, LOOP: 162, FORIN: 163, BY: 164, FORAS: 165, AWAIT: 166, FORASAWAIT: 167, ForValue: 168, CLASS: 169, EXTENDS: 170, ENUM: 171, COMPONENT: 172, ComponentBody: 173, ComponentLine: 174, RENDER: 175, IMPORT: 176, ImportDefaultSpecifier: 177, ImportNamespaceSpecifier: 178, ImportSpecifierList: 179, ImportSpecifier: 180, AS: 181, DEFAULT: 182, IMPORT_ALL: 183, EXPORT: 184, ExportSpecifierList: 185, EXPORT_ALL: 186, ExportSpecifier: 187, UNARY: 188, DO: 189, DO_IIFE: 190, UNARY_MATH: 191, "-": 192, "+": 193, "?": 194, "--": 195, "++": 196, MATH: 197, "**": 198, SHIFT: 199, COMPARE: 200, "&": 201, "^": 202, "|": 203, "||": 204, "??": 205, "&&": 206, "!?": 207, PIPE: 208, RELATION: 209, "SPACE?": 210, COMPOUND_ASSIGN: 211 },
  tokenNames: { 2: "error", 6: "TERMINATOR", 11: "STATEMENT", 46: "JS", 48: "UNDEFINED", 49: "NULL", 50: "BOOL", 51: "INFINITY", 52: "NAN", 53: "NUMBER", 56: "IDENTIFIER", 58: "PROPERTY", 59: "STRING", 60: "STRING_START", 62: "STRING_END", 64: "INTERPOLATION_START", 65: "INTERPOLATION_END", 66: "INDENT", 67: "OUTDENT", 68: "REGEX", 69: "REGEX_START", 70: "REGEX_END", 72: ",", 73: "=", 74: "REACTIVE_ASSIGN", 75: "COMPUTED_ASSIGN", 76: "READONLY_ASSIGN", 77: "REACT_ASSIGN", 82: ".", 83: "?.", 84: "INDEX_START", 85: "INDEX_END", 87: "ES6_OPTIONAL_INDEX", 88: "{", 90: ":", 91: "FOR", 93: "FOROF", 95: "}", 96: "WHEN", 97: "OWN", 102: "[", 103: "]", 104: "@", 105: "...", 107: "SUPER", 109: "DYNAMIC_IMPORT", 117: "..", 118: "DEF", 119: "CALL_START", 121: "CALL_END", 123: "PARAM_START", 124: "PARAM_END", 126: "->", 127: "=>", 131: "ES6_OPTIONAL_CALL", 134: "THIS", 135: "NEW_TARGET", 136: "IMPORT_META", 137: "(", 138: ")", 139: "RETURN", 140: "THROW", 141: "YIELD", 142: "FROM", 144: "IF", 145: "ELSE", 147: "UNLESS", 148: "POST_IF", 149: "POST_UNLESS", 150: "TRY", 152: "FINALLY", 153: "CATCH", 154: "SWITCH", 157: "LEADING_WHEN", 159: "WHILE", 160: "UNTIL", 162: "LOOP", 163: "FORIN", 164: "BY", 165: "FORAS", 166: "AWAIT", 167: "FORASAWAIT", 169: "CLASS", 170: "EXTENDS", 171: "ENUM", 172: "COMPONENT", 175: "RENDER", 176: "IMPORT", 181: "AS", 182: "DEFAULT", 183: "IMPORT_ALL", 184: "EXPORT", 186: "EXPORT_ALL", 188: "UNARY", 189: "DO", 190: "DO_IIFE", 191: "UNARY_MATH", 192: "-", 193: "+", 194: "?", 195: "--", 196: "++", 197: "MATH", 198: "**", 199: "SHIFT", 200: "COMPARE", 201: "&", 202: "^", 203: "|", 204: "||", 205: "??", 206: "&&", 207: "!?", 208: "PIPE", 209: "RELATION", 210: "SPACE?", 211: "COMPOUND_ASSIGN" },
  parseTable: (() => {
    let d = [107, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -1, 1, 2, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 42, 43, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 1, 1, 0, 2, 1, 5, -2, 107, 5, 1, 5, 59, 2, 71, -3, -3, -3, -3, -3, 31, 1, 5, 59, 1, 1, 5, 19, 12, 18, 17, 10, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -6, -6, -6, -6, -6, -6, 127, -6, -6, -6, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 9, 1, 5, 59, 1, 1, 5, 31, 18, 17, -7, -7, -7, -7, -7, -7, -7, -7, -7, 14, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 9, 1, 1, -8, -8, -8, -8, -8, -8, -8, -8, -8, 128, 129, 130, 96, 97, 54, 1, 5, 48, 5, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 3, 9, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -13, -13, 132, 105, 106, -13, -13, -13, -13, 135, 136, 137, -13, 138, -13, -13, -13, -13, -13, -13, -13, 133, -13, 139, -13, -13, 134, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, 131, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, 46, 1, 5, 59, 1, 1, 5, 10, 1, 1, 1, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -14, -14, -14, -14, -14, -14, 140, 141, 142, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, 9, 1, 5, 59, 1, 1, 5, 31, 18, 17, -33, -33, -33, -33, -33, -33, -33, -33, -33, 9, 1, 5, 59, 1, 1, 5, 31, 18, 17, -34, -34, -34, -34, -34, -34, -34, -34, -34, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -35, -35, -35, -35, -35, -35, -35, -35, 143, 144, 145, 146, 147, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, 18, 6, 49, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 1, 15, 1, 3, 4, 1, -173, 152, 104, -173, -173, -173, 154, 155, 153, 99, 157, 156, 151, 148, -173, -173, 149, 150, 106, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 4, 1, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 159, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 160, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 158, 42, 43, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 103, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 161, 162, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 42, 43, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 103, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 164, 165, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 42, 43, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 166, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 172, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 173, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 174, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 175, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 45, 14, 1, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 7, 14, 2, 3, 2, 14, 2, 1, 1, 7, 1, 1, 1, 53, 177, 178, 179, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 176, 72, 73, 93, 99, 83, 87, 84, 85, 167, 168, 90, 91, 86, 88, 89, 82, 171, 45, 14, 1, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 7, 14, 2, 3, 2, 14, 2, 1, 1, 7, 1, 1, 1, 53, 177, 178, 179, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 180, 72, 73, 93, 99, 83, 87, 84, 85, 167, 168, 90, 91, 86, 88, 89, 82, 171, 60, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, 181, 182, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, 183, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 185, 184, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 186, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, 187, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, 2, 66, 56, 160, 188, 2, 66, 56, 160, 189, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, 14, 39, 16, 1, 23, 1, 1, 7, 4, 5, 5, 2, 25, 37, 2, 193, 152, 104, 154, 155, 153, 99, 190, 191, 83, 156, 195, 192, 194, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 196, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 197, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 90, 1, 5, 8, 1, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 6, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 8, 4, 1, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 20, 2, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -304, -304, 177, 178, 179, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, -304, 160, -304, 102, 103, -304, 200, 72, 73, 93, -304, 99, -304, -304, -304, -304, -304, 83, -304, 87, -304, 84, 85, -304, -304, 198, 167, -304, 168, 90, 91, 86, 88, 89, 82, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, 199, 171, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, 1, 66, 201, 2, 66, 56, 160, 202, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 203, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 204, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 139, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 5, 1, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 8, 1, 3, 2, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -224, -224, 205, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, -224, 206, -224, 102, 103, -224, 53, 52, 72, 73, 93, -224, 99, -224, -224, -224, -224, -224, 83, -224, 87, -224, 84, 85, -224, 66, -224, 167, -224, 168, 90, 91, 86, 88, 89, 82, -224, 69, 64, 65, 207, 54, 94, -224, 55, 95, -224, -224, 56, 60, 57, -224, -224, 58, 98, -224, -224, -224, 49, -224, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, -224, 2, 55, 1, 208, 104, 2, 55, 1, 209, 104, 6, 15, 19, 89, 2, 1, 1, 211, 210, 42, 43, 90, 91, 138, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 5, 1, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 8, 1, 3, 2, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -221, -221, 212, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, -221, 213, -221, 102, 103, -221, 53, 52, 72, 73, 93, -221, 99, -221, -221, -221, -221, -221, 83, -221, 87, -221, 84, 85, -221, 66, -221, 167, -221, 168, 90, 91, 86, 88, 89, 82, -221, 69, 64, 65, 54, 94, -221, 55, 95, -221, -221, 56, 60, 57, -221, -221, 58, 98, -221, -221, -221, 49, -221, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, -221, 9, 54, 1, 1, 3, 1, 28, 89, 1, 5, 214, 218, 104, 105, 106, 217, 215, 216, 219, 60, 14, 1, 3, 1, 1, 1, 6, 1, 4, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 14, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 32, 2, 1, 10, 4, 4, 177, 178, 226, 227, 228, 229, 221, 222, 223, 224, 232, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 225, 104, 105, 106, 102, 103, 53, 233, 72, 73, 93, 220, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 61, 67, 62, 230, 231, 171, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, 106, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 234, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 235, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 42, 43, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 113, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 1, 2, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 236, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 242, 102, 103, 243, 53, 52, 72, 73, 93, 99, 59, 83, 237, 87, 247, 84, 85, 238, 239, 241, 244, 240, 66, 42, 43, 90, 91, 246, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 4, 82, 2, 24, 11, 249, 250, 248, 139, 2, 108, 11, 251, 139, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, -205, 54, 1, 5, 51, 1, 1, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -206, -206, 252, 253, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, 1, 82, 254, 1, 82, 255, 54, 11, 35, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 2, 1, 8, 11, 3, 11, 2, 3, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, -171, 54, 11, 35, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 2, 1, 8, 11, 3, 11, 2, 3, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, -172, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 256, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 257, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 258, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 259, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 4, 1, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 261, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 160, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 260, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 23, 6, 39, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 5, 9, 8, 6, 3, 1, 1, 1, 1, 2, 1, -109, 267, 100, 101, 269, 104, 270, 253, 105, 106, -109, -109, -109, 271, 262, -109, 263, 268, 272, 264, 265, 266, 273, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, -64, 45, 14, 1, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 7, 14, 2, 3, 2, 14, 2, 1, 1, 7, 1, 1, 1, 53, 177, 178, 179, 34, 35, 36, 274, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 233, 72, 73, 93, 99, 83, 87, 84, 85, 167, 168, 90, 91, 86, 88, 89, 82, 171, 63, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 4, 3, 3, 1, 10, 1, 3, 1, 1, 2, 3, 11, 11, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, 55, 1, 5, 53, 1, 2, 2, 1, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, 6, 54, 5, 1, 1, 2, 1, 278, 105, 106, 275, 276, 277, 109, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 2, 1, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -5, 279, -5, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, -5, -5, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 42, 43, 90, 91, 86, 88, 89, 82, -5, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 280, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 281, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 282, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 283, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 284, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 285, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 286, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 287, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 288, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 291, 163, 289, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 290, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 294, 163, 292, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 293, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 297, 163, 295, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 296, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 298, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 299, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 300, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 301, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 302, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 303, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, 14, 39, 16, 1, 23, 1, 1, 7, 4, 5, 5, 2, 25, 37, 2, 307, 152, 104, 154, 155, 153, 99, 304, 305, 83, 156, 195, 306, 194, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 308, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 309, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, 53, 1, 5, 53, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, -187, 53, 1, 5, 53, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, -188, 2, 108, 11, 310, 139, 2, 57, 1, 311, 253, 2, 57, 1, 312, 253, 106, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 2, 6, 1, 1, 1, 1, 5, 2, 3, 11, 2, 1, 2, 2, 7, 1, 1, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 313, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 318, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 314, 102, 103, 316, 53, 52, 72, 73, 93, 315, 99, 59, 83, 87, 320, 84, 85, 317, 319, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 1, 84, 321, 109, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 4, 3, 2, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 326, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 325, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 247, 84, 85, 324, 66, 322, 42, 43, 90, 91, 246, 323, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 2, 57, 1, 327, 253, 2, 57, 1, 328, 253, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 329, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 330, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 332, 331, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 333, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 335, 334, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 336, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 338, 337, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 339, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 341, 340, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 342, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 344, 343, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 345, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 9, 6, 60, 1, 5, 22, 1, 8, 18, 3, -217, -217, -217, 347, 348, -217, -217, -217, 346, 6, 6, 60, 1, 5, 49, 3, -174, -174, -174, -174, -174, -174, 7, 6, 60, 1, 5, 1, 48, 3, -178, -178, -178, -178, 349, -178, -178, 15, 6, 49, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 17, 3, 5, -181, 152, 104, -181, -181, -181, 154, 155, 153, 99, 157, 156, -181, -181, 350, 11, 6, 60, 1, 5, 1, 20, 28, 3, 39, 2, 2, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, 11, 6, 60, 1, 5, 1, 20, 28, 3, 39, 2, 2, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, 11, 6, 60, 1, 5, 1, 20, 28, 3, 39, 2, 2, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, 11, 6, 60, 1, 5, 1, 20, 28, 3, 39, 2, 2, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, -185, 2, 57, 1, 252, 253, 113, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 1, 2, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 326, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 242, 102, 103, 243, 53, 52, 72, 73, 93, 99, 59, 83, 237, 87, 247, 84, 85, 238, 239, 241, 244, 240, 66, 42, 43, 90, 91, 246, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, 9, 1, 5, 59, 1, 1, 5, 31, 18, 17, -170, -170, -170, -170, -170, -170, -170, -170, -170, 106, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 352, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 351, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 42, 43, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, 125, 126, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, 118, -370, 120, -370, -370, -370, 9, 1, 5, 59, 1, 1, 5, 31, 18, 17, -367, -367, -367, -367, -367, -367, -367, -367, -367, 5, 148, 1, 9, 1, 1, 128, 129, 130, 96, 97, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, 125, 126, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, 118, -371, 120, -371, -371, -371, 9, 1, 5, 59, 1, 1, 5, 31, 18, 17, -368, -368, -368, -368, -368, -368, -368, -368, -368, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, 125, 126, -372, -372, -372, -372, -372, -372, -372, -372, -372, 111, -372, -372, -372, -372, -372, -372, 118, -372, 120, -372, -372, -372, 18, 6, 49, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 1, 15, 1, 3, 4, 1, -173, 152, 104, -173, -173, -173, 154, 155, 153, 99, 157, 156, 151, 353, -173, -173, 149, 150, 2, 66, 56, 160, 158, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 161, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 164, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 5, 15, 108, 2, 1, 1, 211, 167, 168, 90, 91, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, -373, 125, 126, -373, -373, -373, -373, -373, -373, -373, -373, -373, 111, -373, -373, -373, -373, -373, -373, 118, -373, 120, -373, -373, -373, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, -374, 125, 126, -374, -374, -374, -374, -374, -374, -374, -374, -374, 111, -374, -374, -374, -374, -374, -374, 118, -374, 120, -374, -374, -374, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, 125, 126, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, 118, -376, 120, -376, -376, -376, 2, 80, 8, 354, 99, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -378, -378, -86, -86, -378, -378, -378, -378, -86, -86, -86, -86, -86, -86, -86, -86, -378, -86, -378, -378, -378, -378, -378, -378, -378, -378, -86, -378, -378, -86, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -86, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, 10, 54, 5, 1, 22, 1, 1, 3, 21, 11, 12, 132, 105, 106, 135, 136, 137, 138, 133, 139, 134, 3, 82, 1, 1, 140, 141, 142, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -379, -379, -86, -86, -379, -379, -379, -379, -86, -86, -86, -86, -86, -86, -86, -86, -379, -86, -379, -379, -379, -379, -379, -379, -379, -379, -86, -379, -379, -86, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -86, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, -380, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 357, 355, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 356, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -83, -83, -83, -83, -83, -83, -83, -83, 127, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, 124, 125, 126, 96, 97, -83, -83, -83, -83, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 358, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 359, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 3, 66, 56, 22, 160, 360, 361, 46, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 2, 1, 1, 6, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, 362, 363, 364, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, 4, 93, 70, 2, 2, 366, 365, 367, 368, 11, 55, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 152, 104, 154, 155, 153, 99, 369, 157, 156, 195, 194, 11, 55, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 152, 104, 154, 155, 153, 99, 370, 157, 156, 195, 194, 3, 66, 56, 42, 160, 371, 372, 5, 72, 21, 70, 2, 2, 373, -302, -302, -302, -302, 6, 72, 1, 20, 70, 2, 2, -300, 374, -300, -300, -300, -300, 23, 66, 25, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 375, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 3, 155, 1, 1, 376, 377, 378, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 379, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 59, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 1, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -308, -308, -86, -86, -308, 160, -308, -308, -86, -86, -86, -86, -86, -86, -86, -86, -308, -86, -308, -308, -308, -308, -308, -308, -308, -308, -86, -308, 380, -308, -86, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, 381, -308, -308, -86, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, 105, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 1, 1, 1, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 384, 385, 386, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 42, 43, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 382, 383, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, -222, 125, 126, -222, -222, -222, -222, -222, -222, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 80, 8, 387, 99, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, -225, 125, 126, -225, -225, -225, -225, -225, -225, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 80, 8, 388, 99, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 389, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 3, 66, 53, 3, 160, 390, 391, 2, 66, 56, 160, 392, 9, 1, 5, 59, 1, 1, 5, 31, 18, 17, -369, -369, -369, -369, -369, -369, -369, -369, -369, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, -219, 125, 126, -219, -219, -219, -219, -219, -219, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 80, 8, 393, 99, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, 2, 72, 70, 395, 394, 1, 142, 396, 7, 55, 1, 10, 29, 84, 1, 2, 401, 104, 400, 397, 398, 399, 402, 2, 72, 70, -337, -337, 1, 181, 403, 26, 6, 39, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 5, 9, 8, 6, 3, 1, 1, 1, 1, 2, 1, 77, 3, 2, -109, 267, 100, 101, 408, 104, 270, 253, 105, 106, 407, -109, -109, 271, 262, 404, 263, 268, 272, 264, 265, 266, 273, 409, 405, 406, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, -341, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -342, -342, -342, -342, -342, -342, -342, -342, -342, -342, -342, -342, -342, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -343, -343, -343, -343, -343, -343, -343, -343, -343, -343, -343, -343, -343, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -344, -344, -344, -344, -344, -344, -344, -344, -344, -344, -344, -344, -344, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -89, -89, -89, -89, -89, -89, -89, -89, 410, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 411, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 412, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 1, 142, 413, 56, 1, 5, 53, 1, 5, 1, 1, 5, 2, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -35, -35, -35, -35, -35, -35, -35, -35, 144, 145, 146, 147, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, 2, 6, 132, 107, 414, 105, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 415, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 42, 43, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 31, 6, 60, 1, 5, 19, 12, 2, 11, 1, 4, 27, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -199, -199, -199, -199, 127, -199, 320, 416, 319, -199, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, -142, 109, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 5, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 326, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 243, 53, 52, 72, 73, 93, 99, 59, 83, 417, 87, 247, 84, 85, 419, 418, 66, 42, 43, 90, 91, 246, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 9, 6, 60, 1, 5, 22, 1, 8, 9, 9, -217, -217, -217, 421, 422, -217, -217, 420, -217, 59, 6, 5, 35, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 5, 11, 3, 11, 1, 1, 1, 2, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 423, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, -154, 5, 6, 60, 1, 5, 31, -145, -145, -145, -145, -145, 112, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 1, 2, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 326, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 242, 102, 103, 243, 53, 52, 72, 73, 93, 99, 59, 83, 87, 247, 84, 85, 425, 424, 241, 244, 240, 66, 42, 43, 90, 91, 246, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 59, 6, 5, 35, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 5, 11, 3, 11, 1, 1, 1, 2, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, -156, 5, 6, 60, 1, 5, 31, -150, -150, -150, -150, -150, 6, 6, 60, 1, 5, 31, 18, -200, -200, -200, -200, -200, -200, 6, 6, 60, 1, 5, 31, 18, -201, -201, -201, -201, -201, -201, 106, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 3, 2, 9, 3, 2, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -202, 426, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, -202, -202, 102, 103, -202, 53, 52, 72, 73, 93, 99, 59, 83, -202, 87, 84, 85, 66, -202, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 53, 1, 5, 53, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, 2, 57, 1, 427, 253, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 428, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 429, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 53, 1, 5, 53, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, 2, 57, 1, 430, 253, 2, 57, 1, 431, 253, 24, 66, 25, 31, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 432, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 66, 25, 31, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 433, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -255, -255, -255, -255, -255, -255, -255, -255, 127, -255, -255, 434, -255, -255, -255, -255, -255, -255, -255, -255, 125, 126, 96, 97, -255, -255, -255, -255, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -257, -257, -257, -257, -257, -257, -257, -257, 127, -257, -257, 435, -257, -257, -257, -257, -257, -257, -257, -257, 125, 126, 96, 97, -257, -257, -257, -257, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, 45, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 1, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -264, -264, -264, 160, -264, -264, -264, -264, 127, -264, -264, -264, -264, -264, -264, -264, 436, -264, -264, -264, -264, 125, 126, 96, 97, -264, -264, -264, -264, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 6, 6, 60, 1, 5, 18, 5, -114, -114, -114, -114, 437, -114, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 439, 438, -217, -217, -217, 7, 6, 60, 1, 5, 1, 17, 5, -123, -123, -123, -123, 440, -123, -123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 441, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 3, 57, 1, 44, 252, 253, 442, 6, 6, 60, 1, 5, 18, 5, -126, -126, -126, -126, -126, -126, 5, 6, 60, 1, 5, 23, -110, -110, -110, -110, -110, 11, 6, 60, 1, 5, 1, 9, 1, 1, 6, 5, 24, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, -120, 11, 6, 60, 1, 5, 1, 9, 1, 1, 6, 5, 24, -121, -121, -121, -121, -121, -121, -121, -121, -121, -121, -121, 11, 6, 60, 1, 5, 1, 9, 1, 1, 6, 5, 24, -122, -122, -122, -122, -122, -122, -122, -122, -122, -122, -122, 5, 6, 60, 1, 5, 23, -115, -115, -115, -115, -115, 17, 38, 4, 1, 12, 1, 1, 1, 22, 1, 7, 13, 3, 2, 1, 2, 25, 3, 446, 448, 447, 269, 104, 270, 253, 445, 271, 99, 443, 87, 444, 449, 450, 86, 82, 53, 1, 5, 53, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -39, -39, -39, -39, -39, -39, -39, 451, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, 6, 54, 5, 1, 2, 1, 1, 278, 105, 106, 452, 453, 277, 4, 59, 1, 2, 2, -58, -58, -58, -58, 107, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 454, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 456, 455, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 42, 43, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 4, 59, 1, 2, 2, -63, -63, -63, -63, 5, 1, 5, 59, 2, 71, -4, -4, -4, -4, -4, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, 125, 126, -382, -382, -382, -382, -382, -382, -382, -382, 110, 111, -382, -382, -382, -382, -382, -382, 118, -382, 120, -382, -382, -382, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, 125, 126, -383, -383, -383, -383, -383, -383, -383, -383, 110, 111, -383, -383, -383, -383, -383, -383, 118, -383, 120, -383, -383, -383, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, 125, 126, -384, -384, -384, -384, -384, -384, -384, -384, -384, 111, -384, -384, -384, -384, -384, -384, 118, -384, 120, -384, -384, -384, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, -385, 125, 126, -385, -385, -385, -385, -385, -385, -385, -385, -385, 111, -385, -385, -385, -385, -385, -385, 118, -385, 120, -385, -385, -385, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, -386, 125, 126, -386, -386, -386, -386, -386, -386, 109, 108, 110, 111, -386, -386, -386, -386, -386, -386, 118, -386, 120, -386, -386, -386, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, -387, 125, 126, -387, -387, -387, -387, -387, -387, 109, 108, 110, 111, 112, -387, -387, -387, -387, -387, 118, -387, 120, -387, 122, -387, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, -388, 125, 126, -388, -388, -388, -388, -388, -388, 109, 108, 110, 111, 112, 113, -388, -388, -388, -388, 118, -388, 120, -388, 122, -388, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, -389, 125, 126, -389, -389, -389, -389, -389, -389, 109, 108, 110, 111, 112, 113, 114, -389, -389, -389, 118, -389, 120, -389, 122, -389, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, -390, 125, 126, -390, -390, -390, -390, -390, -390, 109, 108, 110, 111, 112, 113, 114, 115, -390, -390, 118, -390, 120, -390, 122, -390, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, -391, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, -392, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, 125, 126, -398, -398, -398, -398, -398, -398, 109, 108, 110, 111, 112, 113, 114, 115, 116, -398, 118, 119, 120, -398, 122, -398, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, -393, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, -394, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -399, -399, -399, -399, -399, -399, -399, -399, 127, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, 124, 125, 126, 96, 97, -399, -399, -399, -399, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, -395, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, -396, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, -397, 125, 126, -397, -397, -397, -397, -397, -397, 109, 108, 110, 111, 112, 113, 114, 115, 116, -397, 118, -397, 120, -397, 122, -397, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -400, -400, -400, -400, -400, -400, -400, -400, 127, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, 124, 125, 126, 96, 97, -400, -400, -400, -400, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, 125, 126, -401, -401, -401, -401, -401, -401, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, -401, 122, -401, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, 125, 126, -402, -402, -402, -402, -402, -402, 109, 108, 110, 111, 112, -402, -402, -402, -402, -402, 118, -402, 120, -402, -402, -402, 23, 90, 1, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 457, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -236, -236, -236, -236, -236, -236, -236, -236, 127, -236, -236, -236, -236, -236, -236, -236, -236, -236, 458, -236, 125, 126, 96, 97, -236, -236, -236, -236, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -239, -239, -239, -239, -239, -239, -239, -239, 127, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, 124, 125, 126, 96, 97, -239, -239, -239, -239, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 4, 93, 70, 2, 2, 460, 459, 461, 462, 11, 55, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 152, 104, 154, 155, 153, 99, 463, 157, 156, 195, 194, 11, 55, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 152, 104, 154, 155, 153, 99, 464, 157, 156, 195, 194, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, 465, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -235, -235, -235, -235, -235, -235, -235, -235, 127, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, 125, 126, 96, 97, -235, -235, -235, -235, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -238, -238, -238, -238, -238, -238, -238, -238, 127, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, 124, 125, 126, 96, 97, -238, -238, -238, -238, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 53, 1, 5, 53, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, 26, 85, 6, 14, 11, 1, 31, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 466, 127, 320, 467, 319, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 5, 2, 3, 11, 2, 1, 2, 2, 7, 1, 1, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 468, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 469, 99, 59, 83, 87, 320, 84, 85, 317, 319, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 1, 85, 470, 1, 85, 471, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 8, 1, 1, 1, 1, 4, 3, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 472, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, -164, 102, 103, 53, 52, 72, 73, 93, -164, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -46, -46, -46, -46, -46, -46, -46, 473, -46, -46, -46, -67, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, 55, 11, 35, 2, 1, 1, 1, 1, 1, 3, 3, 1, 7, 1, 1, 8, 8, 3, 3, 11, 2, 3, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, -158, 55, 11, 35, 2, 1, 1, 1, 1, 1, 3, 3, 1, 7, 1, 1, 8, 8, 3, 3, 11, 2, 3, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, -159, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 474, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 475, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 53, 1, 5, 53, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 477, 476, -217, -217, -217, 5, 6, 60, 1, 5, 49, -194, -194, -194, -194, -194, 108, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 4, 5, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 326, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 325, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 247, 84, 85, 324, 66, 42, 43, 90, 91, 246, 478, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 28, 6, 60, 1, 5, 19, 12, 18, 27, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -199, -199, -199, -199, 127, -199, -199, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, 23, 85, 6, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 479, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 480, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, -68, 125, 126, -68, -68, -68, -68, -68, -68, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 481, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 482, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -71, -71, -71, -71, -71, -71, -71, -71, 127, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, 124, 125, 126, 96, 97, -71, -71, -71, -71, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 483, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 484, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -74, -74, -74, -74, -74, -74, -74, -74, 127, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, 124, 125, 126, 96, 97, -74, -74, -74, -74, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 485, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 486, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -77, -77, -77, -77, -77, -77, -77, -77, 127, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, 124, 125, 126, 96, 97, -77, -77, -77, -77, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 487, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 488, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -80, -80, -80, -80, -80, -80, -80, -80, 127, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, 124, 125, 126, 96, 97, -80, -80, -80, -80, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 489, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 490, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 3, 125, 1, 1, 491, 90, 91, 17, 6, 49, 1, 10, 1, 12, 1, 1, 7, 7, 7, 1, 1, 1, 16, 7, 1, -218, 152, 104, -218, -218, 154, 155, 153, 99, -218, 157, -218, 156, 151, -218, 492, 150, 2, 6, 60, 493, 494, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 495, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 6, 6, 60, 1, 5, 49, 3, -180, -180, -180, -180, -180, -180, 55, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 3, 1, 4, 2, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, 2, 6, 61, 107, 496, 9, 6, 60, 1, 5, 22, 1, 8, 18, 3, -217, -217, -217, 347, 348, -217, -217, -217, 497, 1, 67, 498, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, 125, 126, -404, -404, -404, -404, -404, -404, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 499, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 500, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -84, -84, -84, -84, -84, -84, -84, -84, 127, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, 124, 125, 126, 96, 97, -84, -84, -84, -84, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 501, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 502, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 3, 7, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, 503, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, -241, 2, 66, 56, 160, 504, 6, 55, 1, 10, 14, 8, 34, 505, 104, 160, 506, 99, 507, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 508, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 509, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 510, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 511, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 1, 93, 512, 1, 165, 513, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 514, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 10, 55, 1, 23, 1, 1, 7, 14, 2, 25, 39, 152, 104, 154, 155, 153, 99, 157, 156, 195, 515, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 516, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 3, 155, 1, 1, 517, 377, 378, 4, 67, 78, 11, 1, 518, 519, 520, 378, 3, 67, 78, 12, -251, -251, -251, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 6, 1, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 522, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 521, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 45, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 1, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -306, -306, -306, 160, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, 523, -306, -306, -306, -306, 125, 126, -306, -306, -306, -306, -306, -306, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 524, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 2, 6, 61, 526, 525, 2, 6, 61, -314, -314, 24, 6, 61, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -317, -317, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 6, 61, -318, -318, 7, 6, 61, 81, 1, 9, 1, 1, -319, -319, 128, 129, 130, 96, 97, 1, 67, 527, 1, 67, 528, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, -227, 125, 126, -227, -227, -227, -227, -227, -227, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 18, 6, 49, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 1, 15, 1, 3, 4, 1, -173, 152, 104, -173, -173, -173, 154, 155, 153, 99, 157, 156, 151, 529, -173, -173, 149, 150, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, 1, 67, 530, 3, 54, 5, 1, 531, 105, 106, 3, 88, 90, 5, 533, 532, 219, 3, 54, 5, 1, 534, 105, 106, 1, 142, 535, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 537, 536, -217, -217, -217, 5, 6, 60, 1, 5, 23, -328, -328, -328, -328, -328, 6, 55, 1, 10, 113, 1, 2, 401, 104, 400, 538, 399, 402, 6, 6, 60, 1, 5, 23, 86, -333, -333, -333, -333, -333, 539, 6, 6, 60, 1, 5, 23, 86, -335, -335, -335, -335, -335, 540, 2, 55, 1, 541, 104, 14, 1, 5, 59, 1, 1, 5, 31, 18, 17, 4, 6, 1, 10, 1, -339, -339, -339, -339, -339, -339, -339, -339, -339, 542, -339, -339, -339, -339, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 544, 543, -217, -217, -217, 5, 6, 60, 1, 5, 23, -357, -357, -357, -357, -357, 6, 55, 1, 10, 116, 3, 2, 546, 104, 407, 409, 545, 406, 12, 6, 60, 1, 5, 1, 9, 1, 1, 6, 5, 24, 62, -362, -362, -362, -362, -120, -120, -120, -120, -120, -362, -120, 547, 6, 6, 60, 1, 5, 23, 86, -365, -365, -365, -365, -365, 548, 102, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 550, 549, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 551, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 31, 1, 5, 59, 1, 1, 5, 19, 12, 18, 17, 10, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -352, -352, -352, -352, -352, -352, 127, -352, -352, -352, -352, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 80, 8, 552, 99, 3, 54, 5, 1, 553, 105, 106, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, 2, 6, 61, 107, 554, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 555, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, 59, 6, 5, 35, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 5, 11, 3, 11, 1, 1, 1, 2, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 423, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, -155, 5, 6, 60, 1, 5, 31, -151, -151, -151, -151, -151, 2, 66, 37, 557, 556, 116, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 5, 1, 1, 1, 1, 7, 3, 4, 7, 1, 1, 1, 2, 2, 1, 3, 1, 1, 3, 3, 2, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -218, 326, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, -218, -218, 102, 103, 243, 53, 52, 72, 73, 93, 99, 59, -218, 83, -218, 87, 247, 84, 85, 559, 558, 244, 240, 66, -218, 42, 43, 90, 91, 246, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 4, 6, 60, 1, 36, 560, -152, -152, -152, 59, 6, 5, 35, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 5, 11, 3, 11, 1, 1, 1, 2, 2, 9, 5, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, -157, 9, 6, 60, 1, 5, 22, 1, 8, 9, 9, -217, -217, -217, 421, 422, -217, -217, 561, -217, 108, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 326, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 243, 53, 52, 72, 73, 93, 99, 59, 83, 87, 247, 84, 85, 419, 418, 66, 42, 43, 90, 91, 246, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 28, 6, 60, 1, 5, 19, 12, 18, 27, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -186, -186, -186, -186, 127, -186, -186, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, 23, 85, 6, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 562, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 563, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, -228, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, 564, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 565, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 566, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 567, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 568, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 3, 6, 60, 29, 570, 571, 569, 23, 6, 39, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 14, 8, 6, 4, 1, 1, 1, 1, 1, 1, 16, -218, 267, 100, 101, 269, 104, 270, 253, 105, 106, -218, -218, 271, 573, -218, 572, 272, 264, 265, -218, 266, 273, -218, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 574, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 575, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 23, 91, 12, 45, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, 576, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 577, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 10, 6, 60, 1, 5, 10, 1, 1, 11, 13, 11, -127, -127, -127, -127, -129, -129, -129, -127, 578, 139, 10, 6, 60, 1, 5, 10, 1, 1, 11, 13, 11, -128, -128, -128, -128, 580, 581, 582, -128, 579, 139, 9, 6, 60, 1, 5, 10, 1, 1, 11, 24, -130, -130, -130, -130, -130, -130, -130, -130, -130, 9, 6, 60, 1, 5, 10, 1, 1, 11, 24, -131, -131, -131, -131, -131, -131, -131, -131, -131, 9, 6, 60, 1, 5, 10, 1, 1, 11, 24, -132, -132, -132, -132, -132, -132, -132, -132, -132, 9, 6, 60, 1, 5, 10, 1, 1, 11, 24, -133, -133, -133, -133, -133, -133, -133, -133, -133, 4, 82, 2, 24, 11, 249, 250, 583, 139, 2, 108, 11, 584, 139, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, 55, 1, 5, 53, 1, 2, 2, 1, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, 4, 59, 1, 2, 2, -59, -59, -59, -59, 2, 6, 59, 107, 585, 105, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 586, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 42, 43, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 4, 59, 1, 2, 2, -62, -62, -62, -62, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 587, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 1, 66, 588, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 589, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 590, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 591, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 592, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 1, 93, 593, 1, 165, 594, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 595, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 8, 1, 1, 1, 1, 4, 3, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 596, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, -162, 102, 103, 53, 52, 72, 73, 93, -162, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 26, 67, 24, 14, 11, 1, 31, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 597, 127, 320, 467, 319, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 1, 67, 598, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, 24, 67, 18, 6, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -163, -163, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 599, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 23, 85, 6, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 600, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 601, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 3, 6, 60, 55, 603, 604, 602, 112, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 8, 1, 1, 1, 1, 7, 3, 4, 7, 1, 1, 1, 2, 2, 5, 4, 3, 2, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -218, 326, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, -218, -218, 102, 103, 53, 52, 72, 73, 93, 99, 59, -218, 83, -218, 87, 247, 84, 85, 605, 66, -218, 42, 43, 90, 91, 246, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 477, 606, -217, -217, -217, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 607, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, 125, 126, -69, -69, -69, -69, -69, -69, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 608, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -72, -72, -72, -72, -72, -72, -72, -72, 127, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, 124, 125, 126, 96, 97, -72, -72, -72, -72, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 609, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -75, -75, -75, -75, -75, -75, -75, -75, 127, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, 124, 125, 126, 96, 97, -75, -75, -75, -75, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 610, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -78, -78, -78, -78, -78, -78, -78, -78, 127, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, 124, 125, 126, 96, 97, -78, -78, -78, -78, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 611, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -81, -81, -81, -81, -81, -81, -81, -81, 127, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, 124, 125, 126, 96, 97, -81, -81, -81, -81, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 612, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 106, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 4, 1, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 614, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 160, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 613, 42, 43, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 6, 6, 60, 1, 5, 49, 3, -175, -175, -175, -175, -175, -175, 11, 55, 1, 23, 1, 1, 7, 14, 2, 1, 23, 1, 152, 104, 154, 155, 153, 99, 157, 156, 151, 615, 150, 18, 6, 49, 1, 10, 1, 5, 7, 1, 1, 7, 14, 2, 1, 15, 1, 3, 4, 1, -173, 152, 104, -173, -173, -173, 154, 155, 153, 99, 157, 156, 151, 616, -173, -173, 149, 150, 28, 6, 60, 1, 5, 19, 30, 3, 24, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -179, -179, -179, -179, 127, -179, -179, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 55, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 3, 1, 4, 2, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, 3, 125, 1, 1, 617, 90, 91, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 618, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, 125, 126, -406, -406, -406, -406, -406, -406, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, 24, 66, 25, 31, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 619, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 66, 56, 160, 620, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, -242, 2, 66, 56, 160, 621, 2, 66, 56, 160, 622, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 3, 7, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, 26, 66, 25, 5, 26, 26, 1, 9, 1, 1, 4, 28, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 624, 623, 124, 125, 126, 96, 97, 625, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 25, 66, 25, 5, 26, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 627, 626, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 25, 66, 25, 5, 26, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 629, 628, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 25, 66, 25, 5, 26, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 631, 630, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 632, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 633, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 24, 66, 25, 31, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 634, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 4, 93, 70, 2, 2, -303, -303, -303, -303, 27, 72, 19, 2, 55, 1, 9, 1, 1, 3, 2, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -301, 127, -301, 124, 125, 126, 96, 97, -301, -301, -301, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 4, 67, 78, 11, 1, 635, 636, 520, 378, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, 2, 66, 56, 160, 637, 3, 67, 78, 12, -252, -252, -252, 3, 66, 6, 50, 160, 639, 638, 24, 66, 6, 19, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -203, -203, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, 45, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 1, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -310, -310, -310, 160, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, 640, -310, -310, -310, -310, 125, 126, -310, -310, -310, -310, -310, -310, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, 106, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 2, 1, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, -316, 384, 385, 386, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, -316, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 42, 43, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 641, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, -223, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, -226, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 347, 348, -217, -217, 642, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, -220, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, 1, 142, 643, 6, 55, 1, 10, 113, 1, 2, 401, 104, 400, 644, 399, 402, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, 3, 54, 5, 1, 645, 105, 106, 3, 6, 60, 29, 647, 648, 646, 10, 6, 49, 1, 10, 1, 28, 8, 18, 59, 2, -218, 401, 104, -218, -218, -218, -218, -218, 649, 402, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 537, 650, -217, -217, -217, 2, 55, 1, 651, 104, 2, 55, 1, 652, 104, 1, 142, -338, 3, 54, 5, 1, 653, 105, 106, 3, 6, 60, 29, 655, 656, 654, 10, 6, 49, 1, 10, 1, 28, 8, 18, 61, 5, -218, 546, 104, -218, -218, -218, -218, -218, 409, 657, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 544, 658, -217, -217, -217, 6, 6, 60, 1, 5, 23, 86, -362, -362, -362, -362, -362, 547, 3, 55, 1, 126, 659, 104, 660, 2, 55, 1, 661, 104, 31, 1, 5, 59, 1, 1, 5, 19, 12, 18, 17, 10, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -345, -345, -345, -345, -345, -345, 127, -345, -345, -345, -345, 125, 126, -345, -345, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 662, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 663, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 1, 67, 664, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, 1, 138, 665, 23, 91, 12, 45, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, 666, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, 112, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 1, 2, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 326, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 242, 102, 103, 243, 53, 52, 72, 73, 93, 99, 59, 83, 87, 247, 84, 85, 425, 667, 241, 244, 240, 66, 42, 43, 90, 91, 246, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 5, 6, 60, 1, 5, 31, -146, -146, -146, -146, -146, 111, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 5, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 326, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, -153, -153, 102, 103, 243, 53, 52, 72, 73, 93, 99, 59, 83, -153, 87, 247, 84, 85, 419, 418, 66, 42, 43, 90, 91, 246, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 110, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 5, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 3, 1, 1, 3, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 326, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 243, 53, 52, 72, 73, 93, 99, 59, 83, 87, 247, 84, 85, 425, 668, 244, 240, 66, 42, 43, 90, 91, 246, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 2, 66, 1, 557, 669, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 670, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 2, 66, 56, 160, 671, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, 125, 126, -256, -256, -256, -256, -256, -256, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, 125, 126, -258, -258, -258, -258, -258, -258, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 27, 6, 60, 1, 5, 19, 4, 53, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -116, -116, -116, -116, 672, -116, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 673, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, 17, 45, 8, 1, 1, 1, 1, 1, 1, 1, 21, 8, 10, 1, 1, 1, 2, 1, 267, 100, 101, 269, 104, 270, 253, 105, 106, 271, 573, 674, 272, 264, 265, 266, 273, 23, 6, 39, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 5, 9, 8, 6, 3, 1, 1, 1, 1, 2, 1, -109, 267, 100, 101, 269, 104, 270, 253, 105, 106, -109, -109, -109, 271, 573, -109, 675, 268, 272, 264, 265, 266, 273, 5, 6, 60, 1, 5, 23, -111, -111, -111, -111, -111, 6, 6, 60, 1, 5, 18, 5, -114, -114, -114, -114, 676, -114, 27, 6, 60, 1, 5, 19, 4, 53, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -118, -118, -118, -118, 127, -118, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 677, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 6, 6, 60, 1, 5, 18, 5, -124, -124, -124, -124, -124, -124, 23, 91, 12, 45, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, 678, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 9, 6, 60, 1, 5, 10, 1, 1, 11, 24, -136, -136, -136, -136, -136, -136, -136, -136, -136, 9, 6, 60, 1, 5, 10, 1, 1, 11, 24, -137, -137, -137, -137, -137, -137, -137, -137, -137, 2, 57, 1, 679, 253, 2, 57, 1, 680, 253, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 681, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 682, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 9, 6, 60, 1, 5, 10, 1, 1, 11, 24, -134, -134, -134, -134, -134, -134, -134, -134, -134, 9, 6, 60, 1, 5, 10, 1, 1, 11, 24, -135, -135, -135, -135, -135, -135, -135, -135, -135, 4, 59, 1, 2, 2, -60, -60, -60, -60, 2, 6, 61, 107, 683, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, 125, 126, -403, -403, -403, -403, -403, -403, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 684, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, 685, -283, -283, -283, -283, -283, -283, -283, -283, 125, 126, -283, -283, -283, 686, -283, -283, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, 687, -288, -288, -288, -288, -288, -288, -288, -288, 125, 126, -288, -288, -288, -288, -288, -288, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, 688, -292, -292, -292, -292, -292, -292, -292, -292, 125, 126, -292, -292, -292, -292, -292, -292, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, 689, -296, -296, -296, -296, -296, -296, -296, -296, 125, 126, -296, -296, -296, -296, -296, -296, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 690, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 691, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, 125, 126, -299, -299, -299, -299, -299, -299, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 67, 18, 6, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -161, -161, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 1, 85, 692, 1, 85, 693, 23, 85, 6, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -66, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 694, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 53, 1, 5, 53, 1, 5, 1, 1, 3, 2, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, -193, 106, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 4, 5, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 326, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 247, 84, 85, 695, 66, 42, 43, 90, 91, 246, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 108, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 5, 4, 5, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 326, 245, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 325, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 247, 84, 85, 324, 66, 42, 43, 90, 91, 246, 696, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 44, 45, 68, 46, 47, 48, 50, 51, 5, 6, 60, 1, 5, 49, -195, -195, -195, -195, -195, 3, 6, 60, 1, 603, 604, 697, 1, 85, 698, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, 9, 1, 5, 59, 1, 1, 5, 31, 18, 17, -169, -169, -169, -169, -169, -169, -169, -169, -169, 6, 6, 60, 1, 5, 49, 3, -176, -176, -176, -176, -176, -176, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 347, 699, -217, -217, -217, 2, 66, 56, 160, 613, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 3, 7, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 3, 7, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 700, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 701, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 702, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 703, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, -279, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 704, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 25, 66, 25, 5, 26, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 706, 705, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 25, 66, 25, 5, 26, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 708, 707, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, 2, 66, 56, 160, 709, 1, 67, 710, 4, 6, 61, 78, 12, 711, -253, -253, -253, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 712, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, 2, 6, 61, -315, -315, 2, 66, 56, 160, 713, 3, 54, 5, 1, 714, 105, 106, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 537, 715, -217, -217, -217, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, 1, 142, 716, 4, 55, 1, 124, 2, 401, 104, 717, 402, 6, 55, 1, 10, 113, 1, 2, 401, 104, 400, 718, 399, 402, 5, 6, 60, 1, 5, 23, -329, -329, -329, -329, -329, 3, 6, 60, 1, 647, 648, 719, 5, 6, 60, 1, 5, 23, -334, -334, -334, -334, -334, 5, 6, 60, 1, 5, 23, -336, -336, -336, -336, -336, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, 14, 1, 5, 59, 1, 1, 5, 31, 18, 17, 4, 6, 1, 10, 1, -340, -340, -340, -340, -340, -340, -340, -340, -340, 720, -340, -340, -340, -340, 4, 55, 1, 126, 5, 546, 104, 409, 721, 6, 55, 1, 10, 116, 3, 2, 546, 104, 407, 409, 722, 406, 5, 6, 60, 1, 5, 23, -358, -358, -358, -358, -358, 3, 6, 60, 1, 655, 656, 723, 5, 6, 60, 1, 5, 23, -363, -363, -363, -363, -363, 5, 6, 60, 1, 5, 23, -364, -364, -364, -364, -364, 5, 6, 60, 1, 5, 23, -366, -366, -366, -366, -366, 31, 1, 5, 59, 1, 1, 5, 19, 12, 18, 17, 10, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -346, -346, -346, -346, -346, -346, 127, -346, -346, -346, -346, 125, 126, -346, -346, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 724, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, -160, 9, 6, 60, 1, 5, 22, 1, 8, 9, 9, -217, -217, -217, 421, 422, -217, -217, 725, -217, 5, 6, 60, 1, 5, 31, -147, -147, -147, -147, -147, 5, 6, 60, 1, 5, 31, -148, -148, -148, -148, -148, 1, 85, 726, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, 14, 39, 16, 1, 23, 1, 1, 7, 4, 5, 5, 2, 25, 37, 2, 307, 152, 104, 154, 155, 153, 99, 727, 728, 83, 156, 195, 306, 194, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 729, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 5, 6, 60, 1, 5, 23, -112, -112, -112, -112, -112, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 439, 730, -217, -217, -217, 101, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 731, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 568, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 732, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 6, 6, 60, 1, 5, 18, 5, -125, -125, -125, -125, -125, -125, 9, 6, 60, 1, 5, 10, 1, 1, 11, 24, -138, -138, -138, -138, -138, -138, -138, -138, -138, 9, 6, 60, 1, 5, 10, 1, 1, 11, 24, -139, -139, -139, -139, -139, -139, -139, -139, -139, 23, 85, 6, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 733, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 734, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 1, 65, 735, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 736, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 737, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 738, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 739, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 740, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 741, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, 742, -290, -290, -290, -290, -290, -290, -290, -290, 125, 126, -290, -290, -290, -290, -290, -290, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, 743, -294, -294, -294, -294, -294, -294, -294, -294, 125, 126, -294, -294, -294, -294, -294, -294, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, 1, 85, 744, 5, 6, 60, 1, 5, 49, -196, -196, -196, -196, -196, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 477, 745, -217, -217, -217, 5, 6, 60, 1, 5, 49, -197, -197, -197, -197, -197, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, 3, 6, 60, 1, 493, 494, 746, 25, 66, 25, 31, 26, 1, 9, 1, 1, 4, 28, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 747, 124, 125, 126, 96, 97, 748, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 25, 66, 25, 5, 26, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 750, 749, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 66, 25, 31, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 751, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 66, 25, 31, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 752, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 66, 25, 31, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 753, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 754, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, -277, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 755, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 1, 67, 756, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, 3, 67, 78, 12, -254, -254, -254, 24, 66, 6, 19, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -204, -204, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, -165, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, -326, 3, 6, 60, 29, 647, 648, 757, 3, 54, 5, 1, 758, 105, 106, 5, 6, 60, 1, 5, 23, -330, -330, -330, -330, -330, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 537, 759, -217, -217, -217, 5, 6, 60, 1, 5, 23, -331, -331, -331, -331, -331, 3, 54, 5, 1, 760, 105, 106, 5, 6, 60, 1, 5, 23, -359, -359, -359, -359, -359, 8, 6, 60, 1, 5, 22, 1, 8, 18, -217, -217, -217, 544, 761, -217, -217, -217, 5, 6, 60, 1, 5, 23, -360, -360, -360, -360, -360, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, -347, 2, 66, 1, 557, 762, 52, 1, 5, 53, 1, 5, 1, 1, 5, 10, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, -210, 4, 93, 70, 2, 2, 763, 459, 461, 462, 11, 55, 1, 23, 1, 1, 7, 4, 10, 2, 25, 39, 152, 104, 154, 155, 153, 99, 764, 157, 156, 195, 194, 5, 6, 60, 1, 5, 23, -117, -117, -117, -117, -117, 3, 6, 60, 1, 570, 571, 765, 27, 6, 60, 1, 5, 19, 4, 53, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -116, -116, -116, -116, 127, -116, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 5, 6, 60, 1, 5, 23, -119, -119, -119, -119, -119, 9, 6, 60, 1, 5, 10, 1, 1, 11, 24, -140, -140, -140, -140, -140, -140, -140, -140, -140, 23, 67, 24, 57, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 766, 127, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 4, 59, 1, 2, 2, -61, -61, -61, -61, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, 125, 126, -284, -284, -284, 767, -284, -284, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, 768, -285, -285, -285, -285, -285, -285, -285, -285, 125, 126, -285, -285, -285, -285, -285, -285, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, 125, 126, -289, -289, -289, -289, -289, -289, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, 125, 126, -293, -293, -293, -293, -293, -293, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, 125, 126, -297, -297, -297, -297, -297, -297, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 769, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 770, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 61, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, 3, 6, 60, 1, 603, 604, 771, 6, 6, 60, 1, 5, 49, 3, -177, -177, -177, -177, -177, -177, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 772, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 773, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, -276, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, 24, 66, 25, 31, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 774, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 66, 25, 31, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 775, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, 1, 142, 776, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, -325, 3, 6, 60, 1, 647, 648, 777, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, -356, 3, 6, 60, 1, 655, 656, 778, 5, 6, 60, 1, 5, 31, -149, -149, -149, -149, -149, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 779, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 1, 93, 780, 5, 6, 60, 1, 5, 23, -113, -113, -113, -113, -113, 1, 85, 781, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 782, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 783, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, 125, 126, -291, -291, -291, -291, -291, -291, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, 125, 126, -295, -295, -295, -295, -295, -295, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 5, 6, 60, 1, 5, 49, -198, -198, -198, -198, -198, 24, 66, 25, 31, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 784, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 24, 66, 25, 31, 26, 1, 9, 1, 1, 32, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 160, 127, 785, 124, 125, 126, 96, 97, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, -278, 3, 54, 5, 1, 786, 105, 106, 5, 6, 60, 1, 5, 23, -332, -332, -332, -332, -332, 5, 6, 60, 1, 5, 23, -361, -361, -361, -361, -361, 45, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 1, 1, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -288, -288, -288, -288, -288, 789, -288, -288, -288, -288, 787, -288, 788, -288, -288, -288, -288, -288, -288, -288, -288, 125, 126, -288, -288, -288, -288, -288, -288, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 790, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 9, 6, 60, 1, 5, 10, 1, 1, 11, 24, -141, -141, -141, -141, -141, -141, -141, -141, -141, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, 125, 126, -286, -286, -286, -286, -286, -286, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 44, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, 125, 126, -287, -287, -287, -287, -287, -287, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, 43, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 2, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, 13, 1, 5, 59, 1, 1, 5, 31, 18, 17, 10, 1, 10, 1, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, -327, 1, 95, 791, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 792, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 6, 6, 60, 1, 28, 8, 18, -218, -218, -218, -218, -218, -218, 45, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 1, 1, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -290, -290, -290, -290, -290, 789, -290, -290, -290, -290, 793, -290, 794, -290, -290, -290, -290, -290, -290, -290, -290, 125, 126, -290, -290, -290, -290, -290, -290, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, 45, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 1, 1, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -289, -289, -289, -289, -289, 789, -289, -289, -289, -289, 795, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, 125, 126, -289, -289, -289, -289, -289, -289, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 1, 95, 796, 100, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 8, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 9, 5, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 3, 1, 8, 4, 1, 1, 1, 1, 1, 2, 1, 797, 163, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 74, 75, 76, 77, 78, 79, 80, 81, 100, 101, 92, 104, 105, 106, 102, 103, 53, 52, 72, 73, 93, 99, 59, 83, 87, 84, 85, 66, 167, 168, 90, 91, 86, 88, 89, 82, 69, 64, 65, 54, 94, 55, 95, 56, 60, 57, 96, 97, 58, 98, 49, 61, 67, 62, 63, 70, 71, 169, 170, 171, 46, 47, 48, 50, 51, 1, 95, 798, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, 45, 1, 5, 59, 1, 1, 5, 13, 5, 1, 2, 1, 1, 1, 7, 2, 12, 4, 3, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 25, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -291, -291, -291, -291, -291, 789, -291, -291, -291, -291, 799, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, 125, 126, -291, -291, -291, -291, -291, -291, 109, 108, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, 1, 95, 800, 57, 1, 5, 53, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 12, 2, 2, 3, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 25, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107], t = [], p = 0, n, o, k, a;
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
  ruleTable: [0, 0, 3, 0, 3, 1, 4, 1, 4, 3, 4, 2, 5, 1, 5, 1, 5, 1, 9, 1, 9, 1, 9, 1, 9, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 8, 1, 8, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 37, 1, 37, 1, 37, 1, 37, 1, 37, 1, 37, 1, 37, 1, 37, 1, 45, 1, 45, 1, 55, 1, 57, 1, 54, 1, 54, 3, 61, 1, 61, 2, 63, 3, 63, 5, 63, 2, 63, 1, 47, 1, 47, 3, 71, 3, 71, 1, 17, 3, 17, 4, 17, 5, 18, 3, 18, 4, 18, 5, 19, 3, 19, 4, 19, 5, 20, 3, 20, 4, 20, 5, 21, 3, 21, 4, 21, 5, 21, 2, 21, 3, 21, 4, 36, 1, 36, 1, 36, 1, 78, 1, 78, 1, 78, 3, 78, 3, 78, 4, 78, 6, 78, 4, 78, 6, 78, 4, 78, 5, 78, 7, 78, 3, 78, 3, 78, 4, 78, 6, 80, 10, 80, 12, 80, 11, 80, 13, 80, 4, 98, 0, 98, 1, 98, 3, 98, 4, 98, 6, 99, 1, 99, 1, 99, 3, 99, 5, 99, 3, 99, 5, 101, 1, 101, 1, 101, 1, 89, 1, 89, 3, 89, 4, 89, 1, 100, 2, 100, 2, 106, 1, 106, 1, 106, 1, 106, 1, 106, 1, 106, 2, 106, 2, 106, 2, 106, 2, 106, 3, 106, 3, 106, 4, 106, 6, 79, 2, 79, 3, 79, 4, 111, 1, 111, 3, 111, 4, 111, 4, 111, 6, 113, 1, 113, 2, 112, 1, 112, 2, 110, 1, 110, 2, 115, 1, 115, 2, 116, 1, 116, 1, 39, 5, 86, 3, 86, 2, 86, 2, 86, 1, 32, 6, 32, 3, 15, 5, 15, 2, 34, 5, 34, 2, 125, 1, 125, 1, 120, 0, 120, 1, 120, 3, 120, 4, 120, 6, 128, 1, 128, 3, 128, 2, 128, 1, 129, 1, 129, 1, 129, 1, 129, 1, 130, 2, 40, 2, 40, 2, 40, 3, 40, 2, 40, 2, 108, 2, 108, 4, 132, 1, 132, 3, 132, 4, 132, 4, 132, 6, 114, 1, 114, 1, 114, 1, 114, 1, 133, 1, 133, 3, 42, 1, 42, 1, 81, 2, 43, 3, 43, 4, 43, 6, 44, 3, 44, 3, 122, 2, 122, 3, 38, 3, 38, 5, 94, 0, 94, 1, 10, 2, 10, 4, 10, 1, 30, 2, 30, 4, 31, 1, 31, 2, 31, 4, 31, 3, 143, 3, 143, 5, 146, 3, 146, 5, 22, 1, 22, 3, 22, 1, 22, 3, 22, 3, 22, 7, 22, 3, 22, 3, 23, 2, 23, 3, 23, 4, 23, 5, 151, 3, 151, 3, 151, 2, 26, 5, 26, 7, 26, 4, 26, 6, 155, 1, 155, 2, 156, 3, 156, 4, 158, 2, 158, 4, 158, 2, 158, 4, 24, 2, 24, 2, 24, 2, 24, 1, 161, 2, 161, 2, 161, 3, 25, 5, 25, 7, 25, 7, 25, 9, 25, 9, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 3, 25, 5, 25, 5, 25, 7, 25, 7, 25, 9, 25, 9, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 3, 25, 5, 168, 1, 168, 3, 92, 1, 92, 3, 27, 1, 27, 2, 27, 3, 27, 4, 27, 2, 27, 3, 27, 4, 27, 5, 33, 3, 28, 4, 173, 1, 173, 3, 173, 2, 174, 1, 174, 1, 174, 1, 29, 2, 12, 2, 12, 4, 12, 4, 12, 5, 12, 7, 12, 6, 12, 9, 179, 1, 179, 3, 179, 4, 179, 4, 179, 6, 180, 1, 180, 3, 180, 1, 180, 3, 177, 1, 178, 3, 13, 3, 13, 5, 13, 2, 13, 2, 13, 2, 13, 2, 13, 4, 13, 5, 13, 6, 13, 2, 13, 2, 13, 2, 13, 2, 13, 3, 13, 5, 13, 4, 13, 5, 13, 7, 185, 1, 185, 3, 185, 4, 185, 4, 185, 6, 187, 1, 187, 3, 187, 3, 187, 1, 187, 3, 35, 2, 35, 2, 35, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 4, 16, 2, 16, 2, 16, 2, 16, 2, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 5, 16, 3, 16, 5, 16, 4, 41, 2],
  ruleActions: (rule, vals, locs, shared) => {
    const $ = vals;
    const $0 = vals.length - 1;
    switch (rule) {
      case 1:
        return ["program"];
      case 2:
        return ["program", ...$[$0]];
      case 3:
      case 58:
      case 110:
      case 150:
      case 154:
      case 174:
      case 194:
      case 203:
      case 251:
      case 302:
      case 314:
      case 328:
      case 357:
        return [$[$0]];
      case 4:
      case 111:
      case 175:
      case 195:
      case 204:
      case 315:
      case 329:
      case 358:
        return [...$[$0 - 2], $[$0]];
      case 5:
      case 60:
      case 157:
      case 316:
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
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 63:
      case 64:
      case 86:
      case 87:
      case 88:
      case 89:
      case 90:
      case 115:
      case 120:
      case 121:
      case 122:
      case 123:
      case 126:
      case 129:
      case 130:
      case 131:
      case 132:
      case 133:
      case 145:
      case 171:
      case 172:
      case 178:
      case 182:
      case 183:
      case 184:
      case 185:
      case 199:
      case 200:
      case 201:
      case 217:
      case 218:
      case 232:
      case 234:
      case 262:
      case 300:
      case 317:
      case 318:
      case 319:
      case 333:
      case 335:
      case 337:
      case 362:
      case 365:
        return $[$0];
      case 47:
        return "undefined";
      case 48:
        return "null";
      case 57:
        return ["str", ...$[$0 - 1]];
      case 59:
      case 151:
      case 155:
      case 252:
        return [...$[$0 - 1], $[$0]];
      case 61:
      case 193:
      case 197:
      case 331:
      case 360:
        return $[$0 - 2];
      case 62:
        return "";
      case 65:
        return ["regex", $[$0 - 1]];
      case 66:
        return ["regex-index", $[$0 - 2], $[$0]];
      case 67:
        return ["regex-index", $[$0], null];
      case 68:
        return ["=", $[$0 - 2], $[$0]];
      case 69:
        return ["=", $[$0 - 3], $[$0]];
      case 70:
        return ["=", $[$0 - 4], $[$0 - 1]];
      case 71:
        return ["state", $[$0 - 2], $[$0]];
      case 72:
        return ["state", $[$0 - 3], $[$0]];
      case 73:
        return ["state", $[$0 - 4], $[$0 - 1]];
      case 74:
        return ["computed", $[$0 - 2], $[$0]];
      case 75:
        return ["computed", $[$0 - 3], $[$0]];
      case 76:
        return ["computed", $[$0 - 4], $[$0 - 1]];
      case 77:
        return ["readonly", $[$0 - 2], $[$0]];
      case 78:
        return ["readonly", $[$0 - 3], $[$0]];
      case 79:
        return ["readonly", $[$0 - 4], $[$0 - 1]];
      case 80:
        return ["effect", $[$0 - 2], $[$0]];
      case 81:
        return ["effect", $[$0 - 3], $[$0]];
      case 82:
        return ["effect", $[$0 - 4], $[$0 - 1]];
      case 83:
      case 84:
        return ["effect", null, $[$0]];
      case 85:
        return ["effect", null, $[$0 - 1]];
      case 91:
      case 100:
      case 138:
        return [".", $[$0 - 2], $[$0]];
      case 92:
      case 101:
      case 139:
        return ["?.", $[$0 - 2], $[$0]];
      case 93:
      case 95:
      case 102:
      case 140:
        return ["[]", $[$0 - 3], $[$0 - 1]];
      case 94:
      case 96:
      case 103:
      case 141:
        return ["[]", $[$0 - 5], $[$0 - 2]];
      case 97:
        return [$[$0 - 1][0], $[$0 - 3], ...$[$0 - 1].slice(1)];
      case 98:
        return ["optindex", $[$0 - 4], $[$0 - 1]];
      case 99:
        return ["optindex", $[$0 - 6], $[$0 - 2]];
      case 104:
        return ["object-comprehension", $[$0 - 8], $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], []];
      case 105:
        return ["object-comprehension", $[$0 - 10], $[$0 - 8], [["for-of", $[$0 - 6], $[$0 - 4], false]], [$[$0 - 2]]];
      case 106:
        return ["object-comprehension", $[$0 - 9], $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], []];
      case 107:
        return ["object-comprehension", $[$0 - 11], $[$0 - 9], [["for-of", $[$0 - 6], $[$0 - 4], true]], [$[$0 - 2]]];
      case 108:
        return ["object", ...$[$0 - 2]];
      case 109:
      case 152:
      case 173:
      case 192:
        return [];
      case 112:
      case 176:
      case 196:
      case 330:
      case 359:
        return [...$[$0 - 3], $[$0]];
      case 113:
      case 177:
      case 198:
      case 332:
      case 361:
        return [...$[$0 - 5], ...$[$0 - 2]];
      case 114:
        return [$[$0], $[$0], null];
      case 116:
        return [$[$0 - 2], $[$0], ":"];
      case 117:
        return [$[$0 - 4], $[$0 - 1], ":"];
      case 118:
        return [$[$0 - 2], $[$0], "="];
      case 119:
        return [$[$0 - 4], $[$0 - 1], "="];
      case 124:
        return ["dynamicKey", $[$0 - 1]];
      case 125:
        return ["[]", "this", $[$0 - 1]];
      case 127:
      case 128:
      case 186:
        return ["...", $[$0]];
      case 134:
      case 190:
        return ["super", ...$[$0]];
      case 135:
      case 136:
      case 137:
      case 188:
      case 191:
        return [$[$0 - 1], ...$[$0]];
      case 142:
        return ["array"];
      case 143:
        return ["array", ...$[$0 - 1]];
      case 144:
        return ["array", ...$[$0 - 2], ...$[$0 - 1]];
      case 146:
        return [...$[$0 - 2], ...$[$0]];
      case 147:
        return [...$[$0 - 3], ...$[$0]];
      case 148:
        return [...$[$0 - 2], ...$[$0 - 1]];
      case 149:
        return [...$[$0 - 5], ...$[$0 - 4], ...$[$0 - 2], ...$[$0 - 1]];
      case 153:
        return [...$[$0]];
      case 156:
        return null;
      case 158:
        return "..";
      case 159:
      case 202:
        return "...";
      case 160:
        return [$[$0 - 2], $[$0 - 3], $[$0 - 1]];
      case 161:
      case 384:
      case 386:
      case 387:
      case 402:
      case 404:
        return [$[$0 - 1], $[$0 - 2], $[$0]];
      case 162:
        return [$[$0], $[$0 - 1], null];
      case 163:
        return [$[$0 - 1], null, $[$0]];
      case 164:
        return [$[$0], null, null];
      case 165:
        return ["def", $[$0 - 4], $[$0 - 2], $[$0]];
      case 166:
        return ["def", $[$0 - 1], [], $[$0]];
      case 167:
      case 169:
        return [$[$0 - 1], $[$0 - 3], $[$0]];
      case 168:
      case 170:
        return [$[$0 - 1], [], $[$0]];
      case 179:
      case 301:
        return ["default", $[$0 - 2], $[$0]];
      case 180:
        return ["rest", $[$0]];
      case 181:
        return ["expansion"];
      case 187:
        return ["tagged-template", $[$0 - 1], $[$0]];
      case 189:
        return ["optcall", $[$0 - 2], ...$[$0]];
      case 205:
      case 206:
        return "this";
      case 207:
        return [".", "this", $[$0]];
      case 208:
        return [".", "super", $[$0]];
      case 209:
        return ["[]", "super", $[$0 - 1]];
      case 210:
        return ["[]", "super", $[$0 - 2]];
      case 211:
        return [".", "new", $[$0]];
      case 212:
        return [".", "import", $[$0]];
      case 213:
        return ["block"];
      case 214:
        return ["block", ...$[$0 - 1]];
      case 215:
        return $[$0 - 1].length === 1 ? $[$0 - 1][0] : ["block", ...$[$0 - 1]];
      case 216:
        return $[$0 - 2].length === 1 ? $[$0 - 2][0] : ["block", ...$[$0 - 2]];
      case 219:
        return ["return", $[$0]];
      case 220:
        return ["return", $[$0 - 1]];
      case 221:
        return ["return"];
      case 222:
        return ["throw", $[$0]];
      case 223:
        return ["throw", $[$0 - 1]];
      case 224:
        return ["yield"];
      case 225:
        return ["yield", $[$0]];
      case 226:
        return ["yield", $[$0 - 1]];
      case 227:
        return ["yield-from", $[$0]];
      case 228:
        return ["if", $[$0 - 1], $[$0]];
      case 229:
        return $[$0 - 4].length === 3 ? ["if", $[$0 - 4][1], $[$0 - 4][2], ["if", $[$0 - 1], $[$0]]] : [...$[$0 - 4], ["if", $[$0 - 1], $[$0]]];
      case 230:
        return ["unless", $[$0 - 1], $[$0]];
      case 231:
        return ["if", ["!", $[$0 - 3]], $[$0 - 2], $[$0]];
      case 233:
        return $[$0 - 2].length === 3 ? ["if", $[$0 - 2][1], $[$0 - 2][2], $[$0]] : [...$[$0 - 2], $[$0]];
      case 235:
      case 236:
        return ["if", $[$0], [$[$0 - 2]]];
      case 237:
        return ["?:", $[$0 - 4], $[$0 - 6], $[$0 - 1]];
      case 238:
      case 239:
        return ["unless", $[$0], [$[$0 - 2]]];
      case 240:
        return ["try", $[$0]];
      case 241:
        return ["try", $[$0 - 1], $[$0]];
      case 242:
        return ["try", $[$0 - 2], $[$0]];
      case 243:
        return ["try", $[$0 - 3], $[$0 - 2], $[$0]];
      case 244:
      case 245:
      case 367:
      case 370:
      case 372:
        return [$[$0 - 1], $[$0]];
      case 246:
        return [null, $[$0]];
      case 247:
        return ["switch", $[$0 - 3], $[$0 - 1], null];
      case 248:
        return ["switch", $[$0 - 5], $[$0 - 3], $[$0 - 1]];
      case 249:
        return ["switch", null, $[$0 - 1], null];
      case 250:
        return ["switch", null, $[$0 - 3], $[$0 - 1]];
      case 253:
        return ["when", $[$0 - 1], $[$0]];
      case 254:
        return ["when", $[$0 - 2], $[$0 - 1]];
      case 255:
        return ["while", $[$0]];
      case 256:
        return ["while", $[$0 - 2], $[$0]];
      case 257:
        return ["until", $[$0]];
      case 258:
        return ["until", $[$0 - 2], $[$0]];
      case 259:
        return $[$0 - 1].length === 2 ? [$[$0 - 1][0], $[$0 - 1][1], $[$0]] : [$[$0 - 1][0], $[$0 - 1][1], $[$0 - 1][2], $[$0]];
      case 260:
      case 261:
        return $[$0].length === 2 ? [$[$0][0], $[$0][1], [$[$0 - 1]]] : [$[$0][0], $[$0][1], $[$0][2], [$[$0 - 1]]];
      case 263:
        return ["loop", $[$0]];
      case 264:
        return ["loop", [$[$0]]];
      case 265:
        return ["loop-n", $[$0 - 1], $[$0]];
      case 266:
        return ["for-in", $[$0 - 3], $[$0 - 1], null, null, $[$0]];
      case 267:
        return ["for-in", $[$0 - 5], $[$0 - 3], null, $[$0 - 1], $[$0]];
      case 268:
        return ["for-in", $[$0 - 5], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 269:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 1], $[$0 - 3], $[$0]];
      case 270:
        return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 3], $[$0 - 1], $[$0]];
      case 271:
        return ["for-of", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 272:
        return ["for-of", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 273:
        return ["for-of", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 274:
        return ["for-of", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 275:
        return ["for-as", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
      case 276:
        return ["for-as", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
      case 277:
      case 279:
        return ["for-as", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
      case 278:
      case 280:
        return ["for-as", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
      case 281:
        return ["for-in", [], $[$0 - 1], null, null, $[$0]];
      case 282:
        return ["for-in", [], $[$0 - 3], $[$0 - 1], null, $[$0]];
      case 283:
        return ["comprehension", $[$0 - 4], [["for-in", $[$0 - 2], $[$0], null]], []];
      case 284:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], null]], [$[$0]]];
      case 285:
        return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], $[$0]]], []];
      case 286:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0]]], [$[$0 - 2]]];
      case 287:
        return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0 - 2]]], [$[$0]]];
      case 288:
        return ["comprehension", $[$0 - 4], [["for-of", $[$0 - 2], $[$0], false]], []];
      case 289:
        return ["comprehension", $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], [$[$0]]];
      case 290:
        return ["comprehension", $[$0 - 5], [["for-of", $[$0 - 2], $[$0], true]], []];
      case 291:
        return ["comprehension", $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], [$[$0]]];
      case 292:
        return ["comprehension", $[$0 - 4], [["for-as", $[$0 - 2], $[$0], false, null]], []];
      case 293:
        return ["comprehension", $[$0 - 6], [["for-as", $[$0 - 4], $[$0 - 2], false, null]], [$[$0]]];
      case 294:
        return ["comprehension", $[$0 - 5], [["for-as", $[$0 - 2], $[$0], true, null]], []];
      case 295:
        return ["comprehension", $[$0 - 7], [["for-as", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
      case 296:
        return ["comprehension", $[$0 - 4], [["for-as", $[$0 - 2], $[$0], true, null]], []];
      case 297:
        return ["comprehension", $[$0 - 6], [["for-as", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
      case 298:
        return ["comprehension", $[$0 - 2], [["for-in", [], $[$0], null]], []];
      case 299:
        return ["comprehension", $[$0 - 4], [["for-in", [], $[$0 - 2], $[$0]]], []];
      case 303:
      case 334:
      case 336:
      case 363:
      case 364:
      case 366:
        return [$[$0 - 2], $[$0]];
      case 304:
        return ["class", null, null];
      case 305:
        return ["class", null, null, $[$0]];
      case 306:
        return ["class", null, $[$0]];
      case 307:
        return ["class", null, $[$0 - 1], $[$0]];
      case 308:
        return ["class", $[$0], null];
      case 309:
        return ["class", $[$0 - 1], null, $[$0]];
      case 310:
        return ["class", $[$0 - 2], $[$0]];
      case 311:
        return ["class", $[$0 - 3], $[$0 - 1], $[$0]];
      case 312:
        return ["enum", $[$0 - 1], $[$0]];
      case 313:
        return ["component", null, ["block", ...$[$0 - 1]]];
      case 320:
        return ["render", $[$0]];
      case 321:
      case 324:
        return ["import", "{}", $[$0]];
      case 322:
      case 323:
        return ["import", $[$0 - 2], $[$0]];
      case 325:
        return ["import", $[$0 - 4], $[$0]];
      case 326:
        return ["import", [$[$0 - 4], $[$0 - 2]], $[$0]];
      case 327:
        return ["import", [$[$0 - 7], $[$0 - 4]], $[$0]];
      case 338:
        return ["*", $[$0]];
      case 339:
        return ["export", "{}"];
      case 340:
        return ["export", $[$0 - 2]];
      case 341:
      case 342:
      case 343:
      case 344:
      case 348:
      case 349:
      case 350:
      case 351:
        return ["export", $[$0]];
      case 345:
        return ["export", ["=", $[$0 - 2], $[$0]]];
      case 346:
        return ["export", ["=", $[$0 - 3], $[$0]]];
      case 347:
        return ["export", ["=", $[$0 - 4], $[$0 - 1]]];
      case 352:
        return ["export-default", $[$0]];
      case 353:
        return ["export-default", $[$0 - 1]];
      case 354:
        return ["export-all", $[$0]];
      case 355:
        return ["export-from", "{}", $[$0]];
      case 356:
        return ["export-from", $[$0 - 4], $[$0]];
      case 368:
      case 369:
      case 371:
      case 407:
        return ["do-iife", $[$0]];
      case 373:
        return ["-", $[$0]];
      case 374:
        return ["+", $[$0]];
      case 375:
        return ["?", $[$0 - 1]];
      case 376:
        return ["await", $[$0]];
      case 377:
        return ["await", $[$0 - 1]];
      case 378:
        return ["--", $[$0], false];
      case 379:
        return ["++", $[$0], false];
      case 380:
        return ["--", $[$0 - 1], true];
      case 381:
        return ["++", $[$0 - 1], true];
      case 382:
        return ["+", $[$0 - 2], $[$0]];
      case 383:
        return ["-", $[$0 - 2], $[$0]];
      case 385:
        return ["**", $[$0 - 2], $[$0]];
      case 388:
        return ["&", $[$0 - 2], $[$0]];
      case 389:
        return ["^", $[$0 - 2], $[$0]];
      case 390:
        return ["|", $[$0 - 2], $[$0]];
      case 391:
      case 392:
      case 393:
      case 394:
      case 395:
      case 396:
        return ["control", $[$0 - 1], $[$0 - 2], $[$0]];
      case 397:
        return ["&&", $[$0 - 2], $[$0]];
      case 398:
        return ["||", $[$0 - 2], $[$0]];
      case 399:
        return ["??", $[$0 - 2], $[$0]];
      case 400:
        return ["!?", $[$0 - 2], $[$0]];
      case 401:
        return ["|>", $[$0 - 2], $[$0]];
      case 403:
        return ["?:", $[$0 - 4], $[$0 - 2], $[$0]];
      case 405:
        return [$[$0 - 3], $[$0 - 4], $[$0 - 1]];
      case 406:
        return [$[$0 - 2], $[$0 - 3], $[$0]];
    }
  },
  parseError(str, hash) {
    let col, error, line, location, message, text, token;
    if (hash.recoverable)
      return this.trace(str);
    else {
      line = (hash.line || 0) + 1;
      col = hash.loc?.c || 0;
      token = hash.token ? ` (token: ${hash.token})` : "";
      text = hash.text ? ` near '${hash.text}'` : "";
      location = `line ${line}, column ${col}`;
      message = `Parse error at ${location}${token}${text}: ${str}`;
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
    for (const k in this.ctx)
      if (Object.hasOwn(this.ctx, k)) {
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
// src/components.js
var BIND_PREFIX = "__bind_";
var BIND_SUFFIX = "__";
var LIFECYCLE_HOOKS = new Set(["beforeMount", "mounted", "updated", "beforeUnmount", "unmounted"]);
function extractInputType(pairs) {
  for (const pair of pairs) {
    if (!Array.isArray(pair))
      continue;
    const key = pair[0] instanceof String ? pair[0].valueOf() : pair[0];
    const val = pair[1] instanceof String ? pair[1].valueOf() : pair[1];
    if (key === "type" && typeof val === "string") {
      return val.replace(/^["']|["']$/g, "");
    }
  }
  return null;
}
function getMemberName(target) {
  if (typeof target === "string")
    return target;
  if (Array.isArray(target) && target[0] === "." && target[1] === "this" && typeof target[2] === "string") {
    return target[2];
  }
  return null;
}
function installComponentSupport(CodeGenerator) {
  const proto = CodeGenerator.prototype;
  proto.localizeVar = function(line) {
    let result = line.replace(/this\.(_el\d+|_t\d+|_anchor\d+|_frag\d+|_slot\d+|_c\d+|_inst\d+|_empty\d+)/g, "$1");
    result = result.replace(/\bthis\./g, "ctx.");
    return result;
  };
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
    let raw = typeof current === "string" ? current : current instanceof String ? current.valueOf() : "div";
    let [tag, id] = raw.split("#");
    if (!tag)
      tag = "div";
    return { tag, classes, id };
  };
  proto.transformComponentMembers = function(sexpr) {
    if (!Array.isArray(sexpr)) {
      if (typeof sexpr === "string" && this.reactiveMembers && this.reactiveMembers.has(sexpr)) {
        return [".", [".", "this", sexpr], "value"];
      }
      if (typeof sexpr === "string" && this.componentMembers && this.componentMembers.has(sexpr)) {
        return [".", "this", sexpr];
      }
      return sexpr;
    }
    if (sexpr[0] === "." && sexpr[1] === "this" && typeof sexpr[2] === "string") {
      const memberName = sexpr[2];
      if (this.reactiveMembers && this.reactiveMembers.has(memberName)) {
        return [".", sexpr, "value"];
      }
      return sexpr;
    }
    if (sexpr[0] === ".") {
      return [".", this.transformComponentMembers(sexpr[1]), sexpr[2]];
    }
    if (sexpr[0] === "->") {
      return ["=>", ...sexpr.slice(1).map((item) => this.transformComponentMembers(item))];
    }
    return sexpr.map((item) => this.transformComponentMembers(item));
  };
  proto.generateComponent = function(head, rest, context, sexpr) {
    const [, body] = rest;
    this.usesTemplates = true;
    this.usesReactivity = true;
    const statements = this.is(body, "block") ? body.slice(1) : [];
    const stateVars = [];
    const derivedVars = [];
    const readonlyVars = [];
    const methods = [];
    const lifecycleHooks = [];
    const effects = [];
    let renderBlock = null;
    const memberNames = new Set;
    const reactiveMembers = new Set;
    for (const stmt of statements) {
      if (!Array.isArray(stmt))
        continue;
      const [op] = stmt;
      if (op === "state") {
        const varName = getMemberName(stmt[1]);
        if (varName) {
          stateVars.push({ name: varName, value: stmt[2] });
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
          readonlyVars.push({ name: varName, value: stmt[2] });
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
              stateVars.push({ name: varName, value: val });
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
          const [methodName, funcDef] = pair;
          if (typeof methodName === "string" && LIFECYCLE_HOOKS.has(methodName)) {
            lifecycleHooks.push({ name: methodName, value: funcDef });
          } else if (typeof methodName === "string") {
            methods.push({ name: methodName, func: funcDef });
            memberNames.add(methodName);
          }
        }
      }
    }
    const prevComponentMembers = this.componentMembers;
    const prevReactiveMembers = this.reactiveMembers;
    this.componentMembers = memberNames;
    this.reactiveMembers = reactiveMembers;
    const lines = [];
    let blockFactoriesCode = "";
    lines.push("class extends __Component {");
    lines.push("  _init(props) {");
    for (const { name, value } of readonlyVars) {
      const val = this.generateInComponent(value, "value");
      lines.push(`    this.${name} = props.${name} ?? ${val};`);
    }
    for (const { name, value } of stateVars) {
      const val = this.generateInComponent(value, "value");
      lines.push(`    this.${name} = __state(props.${name} ?? ${val});`);
    }
    for (const { name, expr } of derivedVars) {
      const val = this.generateInComponent(expr, "value");
      lines.push(`    this.${name} = __computed(() => ${val});`);
    }
    for (const effect of effects) {
      const effectBody = effect[2];
      const effectCode = this.generateInComponent(effectBody, "value");
      lines.push(`    __effect(() => { ${effectCode}; });`);
    }
    lines.push("  }");
    for (const { name, func } of methods) {
      if (Array.isArray(func) && (func[0] === "->" || func[0] === "=>")) {
        const [, params, methodBody] = func;
        const paramStr = Array.isArray(params) ? params.map((p) => this.formatParam(p)).join(", ") : "";
        const transformed = this.reactiveMembers ? this.transformComponentMembers(methodBody) : methodBody;
        const isAsync = this.containsAwait(methodBody);
        const bodyCode = this.generateFunctionBody(transformed, params || []);
        lines.push(`  ${isAsync ? "async " : ""}${name}(${paramStr}) ${bodyCode}`);
      }
    }
    for (const { name, value } of lifecycleHooks) {
      if (Array.isArray(value) && (value[0] === "->" || value[0] === "=>")) {
        const [, , hookBody] = value;
        const transformed = this.reactiveMembers ? this.transformComponentMembers(hookBody) : hookBody;
        const isAsync = this.containsAwait(hookBody);
        const bodyCode = this.generateFunctionBody(transformed, []);
        lines.push(`  ${isAsync ? "async " : ""}${name}() ${bodyCode}`);
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
      return `this.${sexpr}.value`;
    }
    if (typeof sexpr === "string" && this.componentMembers && this.componentMembers.has(sexpr)) {
      return `this.${sexpr}`;
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
  proto.buildRender = function(body) {
    this._elementCount = 0;
    this._textCount = 0;
    this._blockCount = 0;
    this._createLines = [];
    this._setupLines = [];
    this._blockFactories = [];
    const statements = this.is(body, "block") ? body.slice(1) : [body];
    let rootVar;
    if (statements.length === 0) {
      rootVar = "null";
    } else if (statements.length === 1) {
      rootVar = this.generateNode(statements[0]);
    } else {
      rootVar = this.newElementVar("frag");
      this._createLines.push(`${rootVar} = document.createDocumentFragment();`);
      for (const stmt of statements) {
        const childVar = this.generateNode(stmt);
        this._createLines.push(`${rootVar}.appendChild(${childVar});`);
      }
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
    return `this._${hint}${this._elementCount++}`;
  };
  proto.newTextVar = function() {
    return `this._t${this._textCount++}`;
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
        this._setupLines.push(`__effect(() => { ${textVar2}.data = this.${str}.value; });`);
        return textVar2;
      }
      const [tagStr, idStr] = str.split("#");
      const elVar = this.newElementVar();
      this._createLines.push(`${elVar} = document.createElement('${tagStr || "div"}');`);
      if (idStr)
        this._createLines.push(`${elVar}.id = '${idStr}';`);
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
    if (headStr && this.isHtmlTag(headStr)) {
      let [tagName, id] = headStr.split("#");
      return this.generateTag(tagName || "div", [], rest, id);
    }
    if (headStr === ".") {
      const [, obj, prop] = sexpr;
      if (obj === "this" && typeof prop === "string") {
        if (this.reactiveMembers && this.reactiveMembers.has(prop)) {
          const textVar3 = this.newTextVar();
          this._createLines.push(`${textVar3} = document.createTextNode('');`);
          this._setupLines.push(`__effect(() => { ${textVar3}.data = this.${prop}.value; });`);
          return textVar3;
        }
        const slotVar = this.newElementVar("slot");
        this._createLines.push(`${slotVar} = this.${prop} instanceof Node ? this.${prop} : (this.${prop} != null ? document.createTextNode(String(this.${prop})) : document.createComment(''));`);
        return slotVar;
      }
      const { tag, classes, id } = this.collectTemplateClasses(sexpr);
      if (tag && this.isHtmlTag(tag)) {
        return this.generateTag(tag, classes, [], id);
      }
      const textVar2 = this.newTextVar();
      const exprCode2 = this.generateInComponent(sexpr, "value");
      this._createLines.push(`${textVar2} = document.createTextNode(String(${exprCode2}));`);
      return textVar2;
    }
    if (Array.isArray(head)) {
      if (Array.isArray(head[0]) && head[0][0] === "." && (head[0][2] === "__clsx" || head[0][2] instanceof String && head[0][2].valueOf() === "__clsx")) {
        const tag2 = typeof head[0][1] === "string" ? head[0][1] : head[0][1].valueOf();
        const classExprs = head.slice(1);
        return this.generateDynamicTag(tag2, classExprs, rest);
      }
      const { tag, classes, id } = this.collectTemplateClasses(head);
      if (tag && this.isHtmlTag(tag)) {
        if (classes.length === 1 && classes[0] === "__clsx") {
          return this.generateDynamicTag(tag, rest, []);
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
    const textVar = this.newTextVar();
    const exprCode = this.generateInComponent(sexpr, "value");
    if (this.hasReactiveDeps(sexpr)) {
      this._createLines.push(`${textVar} = document.createTextNode('');`);
      this._setupLines.push(`__effect(() => { ${textVar}.data = ${exprCode}; });`);
    } else {
      this._createLines.push(`${textVar} = document.createTextNode(String(${exprCode}));`);
    }
    return textVar;
  };
  proto.generateTag = function(tag, classes, args, id) {
    const elVar = this.newElementVar();
    this._createLines.push(`${elVar} = document.createElement('${tag}');`);
    if (id) {
      this._createLines.push(`${elVar}.id = '${id}';`);
    }
    if (classes.length > 0) {
      this._createLines.push(`${elVar}.className = '${classes.join(" ")}';`);
    }
    for (const arg of args) {
      if (Array.isArray(arg) && (arg[0] === "->" || arg[0] === "=>")) {
        const block = arg[2];
        if (this.is(block, "block")) {
          for (const child of block.slice(1)) {
            const childVar = this.generateNode(child);
            this._createLines.push(`${elVar}.appendChild(${childVar});`);
          }
        } else if (block) {
          const childVar = this.generateNode(block);
          this._createLines.push(`${elVar}.appendChild(${childVar});`);
        }
      } else if (this.is(arg, "object")) {
        this.generateAttributes(elVar, arg);
      } else if (typeof arg === "string") {
        const textVar = this.newTextVar();
        if (arg.startsWith('"') || arg.startsWith("'") || arg.startsWith("`")) {
          this._createLines.push(`${textVar} = document.createTextNode(${arg});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(arg)) {
          this._createLines.push(`${textVar} = document.createTextNode('');`);
          this._setupLines.push(`__effect(() => { ${textVar}.data = this.${arg}.value; });`);
        } else if (this.componentMembers && this.componentMembers.has(arg)) {
          this._createLines.push(`${textVar} = document.createTextNode(String(this.${arg}));`);
        } else {
          this._createLines.push(`${textVar} = document.createTextNode(String(${arg}));`);
        }
        this._createLines.push(`${elVar}.appendChild(${textVar});`);
      } else if (arg instanceof String) {
        const val = arg.valueOf();
        const textVar = this.newTextVar();
        if (val.startsWith('"') || val.startsWith("'") || val.startsWith("`")) {
          this._createLines.push(`${textVar} = document.createTextNode(${val});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(val)) {
          this._createLines.push(`${textVar} = document.createTextNode('');`);
          this._setupLines.push(`__effect(() => { ${textVar}.data = this.${val}.value; });`);
        } else {
          this._createLines.push(`${textVar} = document.createTextNode(String(${val}));`);
        }
        this._createLines.push(`${elVar}.appendChild(${textVar});`);
      } else if (arg) {
        const childVar = this.generateNode(arg);
        this._createLines.push(`${elVar}.appendChild(${childVar});`);
      }
    }
    return elVar;
  };
  proto.generateDynamicTag = function(tag, classExprs, children) {
    const elVar = this.newElementVar();
    this._createLines.push(`${elVar} = document.createElement('${tag}');`);
    if (classExprs.length > 0) {
      const classArgs = classExprs.map((e) => this.generateInComponent(e, "value")).join(", ");
      const hasReactive = classExprs.some((e) => this.hasReactiveDeps(e));
      if (hasReactive) {
        this._setupLines.push(`__effect(() => { ${elVar}.className = __clsx(${classArgs}); });`);
      } else {
        this._createLines.push(`${elVar}.className = __clsx(${classArgs});`);
      }
    }
    for (const arg of children) {
      const argHead = Array.isArray(arg) ? arg[0] instanceof String ? arg[0].valueOf() : arg[0] : null;
      if (argHead === "->" || argHead === "=>") {
        const block = arg[2];
        const blockHead = Array.isArray(block) ? block[0] instanceof String ? block[0].valueOf() : block[0] : null;
        if (blockHead === "block") {
          for (const child of block.slice(1)) {
            const childVar = this.generateNode(child);
            this._createLines.push(`${elVar}.appendChild(${childVar});`);
          }
        } else if (block) {
          const childVar = this.generateNode(block);
          this._createLines.push(`${elVar}.appendChild(${childVar});`);
        }
      } else if (this.is(arg, "object")) {
        this.generateAttributes(elVar, arg);
      } else if (typeof arg === "string" || arg instanceof String) {
        const textVar = this.newTextVar();
        const argStr = arg.valueOf();
        if (argStr.startsWith('"') || argStr.startsWith("'") || argStr.startsWith("`")) {
          this._createLines.push(`${textVar} = document.createTextNode(${argStr});`);
        } else if (this.reactiveMembers && this.reactiveMembers.has(argStr)) {
          this._createLines.push(`${textVar} = document.createTextNode('');`);
          this._setupLines.push(`__effect(() => { ${textVar}.data = this.${argStr}.value; });`);
        } else {
          this._createLines.push(`${textVar} = document.createTextNode(${this.generateInComponent(arg, "value")});`);
        }
        this._createLines.push(`${elVar}.appendChild(${textVar});`);
      } else {
        const childVar = this.generateNode(arg);
        this._createLines.push(`${elVar}.appendChild(${childVar});`);
      }
    }
    return elVar;
  };
  proto.generateAttributes = function(elVar, objExpr) {
    const inputType = extractInputType(objExpr.slice(1));
    for (let i = 1;i < objExpr.length; i++) {
      let [key, value] = objExpr[i];
      if (this.is(key, ".") && key[1] === "this") {
        const eventName = key[2];
        if (typeof value === "string" && this.componentMembers?.has(value)) {
          this._createLines.push(`${elVar}.addEventListener('${eventName}', (e) => this.${value}(e));`);
        } else {
          const handlerCode = this.generateInComponent(value, "value");
          this._createLines.push(`${elVar}.addEventListener('${eventName}', (e) => (${handlerCode})(e));`);
        }
        continue;
      }
      if (typeof key === "string") {
        if (key.startsWith('"') && key.endsWith('"')) {
          key = key.slice(1, -1);
        }
        if (key === "ref") {
          const refName = String(value).replace(/^["']|["']$/g, "");
          this._createLines.push(`this.${refName} = ${elVar};`);
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
          this._setupLines.push(`__effect(() => { ${elVar}.${prop} = ${valueCode2}; });`);
          this._createLines.push(`${elVar}.addEventListener('${event}', (e) => ${valueCode2} = ${valueAccessor});`);
          continue;
        }
        const valueCode = this.generateInComponent(value, "value");
        if ((key === "value" || key === "checked") && this.hasReactiveDeps(value)) {
          this._setupLines.push(`__effect(() => { ${elVar}.${key} = ${valueCode}; });`);
          const event = key === "checked" ? "change" : "input";
          const accessor = key === "checked" ? "e.target.checked" : inputType === "number" || inputType === "range" ? "e.target.valueAsNumber" : "e.target.value";
          this._createLines.push(`${elVar}.addEventListener('${event}', (e) => { ${valueCode} = ${accessor}; });`);
          continue;
        }
        if (this.hasReactiveDeps(value)) {
          this._setupLines.push(`__effect(() => { ${elVar}.setAttribute('${key}', ${valueCode}); });`);
        } else {
          this._createLines.push(`${elVar}.setAttribute('${key}', ${valueCode});`);
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
    for (const stmt of statements) {
      const childVar = this.generateNode(stmt);
      this._createLines.push(`${fragVar}.appendChild(${childVar});`);
    }
    return fragVar;
  };
  proto.generateConditional = function(sexpr) {
    const [, condition, thenBlock, elseBlock] = sexpr;
    const anchorVar = this.newElementVar("anchor");
    this._createLines.push(`${anchorVar} = document.createComment('if');`);
    const condCode = this.generateInComponent(condition, "value");
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
    setupLines.push(`  __effect(() => {`);
    setupLines.push(`    const show = !!(${condCode});`);
    setupLines.push(`    const want = show ? 'then' : ${elseBlock ? "'else'" : "null"};`);
    setupLines.push(`    if (want === showing) return;`);
    setupLines.push(``);
    setupLines.push(`    if (currentBlock) {`);
    setupLines.push(`      currentBlock.d(true);`);
    setupLines.push(`      currentBlock = null;`);
    setupLines.push(`    }`);
    setupLines.push(`    showing = want;`);
    setupLines.push(``);
    setupLines.push(`    if (want === 'then') {`);
    setupLines.push(`      currentBlock = ${thenBlockName}(this);`);
    setupLines.push(`      currentBlock.c();`);
    setupLines.push(`      currentBlock.m(anchor.parentNode, anchor.nextSibling);`);
    setupLines.push(`      currentBlock.p(this);`);
    setupLines.push(`    }`);
    if (elseBlock) {
      setupLines.push(`    if (want === 'else') {`);
      setupLines.push(`      currentBlock = ${elseBlockName}(this);`);
      setupLines.push(`      currentBlock.c();`);
      setupLines.push(`      currentBlock.m(anchor.parentNode, anchor.nextSibling);`);
      setupLines.push(`      currentBlock.p(this);`);
      setupLines.push(`    }`);
    }
    setupLines.push(`  });`);
    setupLines.push(`}`);
    this._setupLines.push(setupLines.join(`
    `));
    return anchorVar;
  };
  proto.generateConditionBranch = function(blockName, block) {
    const savedCreateLines = this._createLines;
    const savedSetupLines = this._setupLines;
    this._createLines = [];
    this._setupLines = [];
    const rootVar = this.generateTemplateBlock(block);
    const createLines = this._createLines;
    const setupLines = this._setupLines;
    this._createLines = savedCreateLines;
    this._setupLines = savedSetupLines;
    const localizeVar = (line) => this.localizeVar(line);
    const factoryLines = [];
    factoryLines.push(`function ${blockName}(ctx) {`);
    const localVars = new Set;
    for (const line of createLines) {
      const match = line.match(/^this\.(_(?:el|t|anchor|frag|slot|c|inst|empty)\d+)\s*=/);
      if (match)
        localVars.add(match[1]);
    }
    if (localVars.size > 0) {
      factoryLines.push(`  let ${[...localVars].join(", ")};`);
    }
    const hasEffects = setupLines.length > 0;
    if (hasEffects) {
      factoryLines.push(`  let disposers = [];`);
    }
    factoryLines.push(`  return {`);
    factoryLines.push(`    c() {`);
    for (const line of createLines) {
      factoryLines.push(`      ${localizeVar(line)}`);
    }
    factoryLines.push(`    },`);
    factoryLines.push(`    m(target, anchor) {`);
    factoryLines.push(`      target.insertBefore(${localizeVar(rootVar)}, anchor);`);
    factoryLines.push(`    },`);
    factoryLines.push(`    p(ctx) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
      factoryLines.push(`      disposers = [];`);
      for (const line of setupLines) {
        const localizedLine = localizeVar(line);
        const wrappedLine = localizedLine.replace(/__effect\(\(\) => \{/g, "disposers.push(__effect(() => {").replace(/\}\);$/g, "}));");
        factoryLines.push(`      ${wrappedLine}`);
      }
    }
    factoryLines.push(`    },`);
    factoryLines.push(`    d(detaching) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
    }
    factoryLines.push(`      if (detaching) ${localizeVar(rootVar)}.remove();`);
    factoryLines.push(`    }`);
    factoryLines.push(`  };`);
    factoryLines.push(`}`);
    this._blockFactories.push(factoryLines.join(`
`));
  };
  proto.generateTemplateLoop = function(sexpr) {
    const [head, vars, collection, guard, step, body] = sexpr;
    const blockName = this.newBlockVar();
    const anchorVar = this.newElementVar("anchor");
    this._createLines.push(`${anchorVar} = document.createComment('for');`);
    const varNames = Array.isArray(vars) ? vars : [vars];
    const itemVar = varNames[0];
    const indexVar = varNames[1] || "i";
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
    const savedCreateLines = this._createLines;
    const savedSetupLines = this._setupLines;
    this._createLines = [];
    this._setupLines = [];
    const itemNode = this.generateTemplateBlock(body);
    const itemCreateLines = this._createLines;
    const itemSetupLines = this._setupLines;
    this._createLines = savedCreateLines;
    this._setupLines = savedSetupLines;
    const localizeVar = (line) => this.localizeVar(line);
    const factoryLines = [];
    factoryLines.push(`function ${blockName}(ctx, ${itemVar}, ${indexVar}) {`);
    const localVars = new Set;
    for (const line of itemCreateLines) {
      const match = line.match(/^this\.(_(?:el|t|anchor|frag|slot|c|inst|empty)\d+)\s*=/);
      if (match)
        localVars.add(match[1]);
    }
    if (localVars.size > 0) {
      factoryLines.push(`  let ${[...localVars].join(", ")};`);
    }
    const hasEffects = itemSetupLines.length > 0;
    if (hasEffects) {
      factoryLines.push(`  let disposers = [];`);
    }
    factoryLines.push(`  return {`);
    factoryLines.push(`    c() {`);
    for (const line of itemCreateLines) {
      factoryLines.push(`      ${localizeVar(line)}`);
    }
    factoryLines.push(`    },`);
    factoryLines.push(`    m(target, anchor) {`);
    factoryLines.push(`      target.insertBefore(${localizeVar(itemNode)}, anchor);`);
    factoryLines.push(`    },`);
    factoryLines.push(`    p(ctx, ${itemVar}, ${indexVar}) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
      factoryLines.push(`      disposers = [];`);
      for (const line of itemSetupLines) {
        const localizedLine = localizeVar(line);
        const wrappedLine = localizedLine.replace(/__effect\(\(\) => \{/g, "disposers.push(__effect(() => {").replace(/\}\);$/g, "}));");
        factoryLines.push(`      ${wrappedLine}`);
      }
    }
    factoryLines.push(`    },`);
    factoryLines.push(`    d(detaching) {`);
    if (hasEffects) {
      factoryLines.push(`      disposers.forEach(d => d());`);
    }
    factoryLines.push(`      if (detaching) ${localizeVar(itemNode)}.remove();`);
    factoryLines.push(`    }`);
    factoryLines.push(`  };`);
    factoryLines.push(`}`);
    this._blockFactories.push(factoryLines.join(`
`));
    const setupLines = [];
    setupLines.push(`// Loop: ${blockName}`);
    setupLines.push(`{`);
    setupLines.push(`  const anchor = ${anchorVar};`);
    setupLines.push(`  const map = new Map();`);
    setupLines.push(`  __effect(() => {`);
    setupLines.push(`    const items = ${collectionCode};`);
    setupLines.push(`    const parent = anchor.parentNode;`);
    setupLines.push(`    const newMap = new Map();`);
    setupLines.push(``);
    setupLines.push(`    for (let ${indexVar} = 0; ${indexVar} < items.length; ${indexVar}++) {`);
    setupLines.push(`      const ${itemVar} = items[${indexVar}];`);
    setupLines.push(`      const key = ${keyExpr};`);
    setupLines.push(`      let block = map.get(key);`);
    setupLines.push(`      if (block) {`);
    setupLines.push(`        block.p(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`      } else {`);
    setupLines.push(`        block = ${blockName}(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`        block.c();`);
    setupLines.push(`        block.m(parent, anchor);`);
    setupLines.push(`        block.p(this, ${itemVar}, ${indexVar});`);
    setupLines.push(`      }`);
    setupLines.push(`      newMap.set(key, block);`);
    setupLines.push(`    }`);
    setupLines.push(``);
    setupLines.push(`    for (const [key, block] of map) {`);
    setupLines.push(`      if (!newMap.has(key)) block.d(true);`);
    setupLines.push(`    }`);
    setupLines.push(``);
    setupLines.push(`    map.clear();`);
    setupLines.push(`    for (const [k, v] of newMap) map.set(k, v);`);
    setupLines.push(`  });`);
    setupLines.push(`}`);
    this._setupLines.push(setupLines.join(`
    `));
    return anchorVar;
  };
  proto.generateChildComponent = function(componentName, args) {
    const instVar = this.newElementVar("inst");
    const elVar = this.newElementVar("el");
    const { propsCode, childrenSetupLines } = this.buildComponentProps(args);
    this._createLines.push(`${instVar} = new ${componentName}(${propsCode});`);
    this._createLines.push(`${elVar} = ${instVar}._create();`);
    this._createLines.push(`(this._children || (this._children = [])).push(${instVar});`);
    this._setupLines.push(`if (${instVar}._setup) ${instVar}._setup();`);
    for (const line of childrenSetupLines) {
      this._setupLines.push(line);
    }
    return elVar;
  };
  proto.buildComponentProps = function(args) {
    const props = [];
    let childrenVar = null;
    const childrenSetupLines = [];
    for (const arg of args) {
      if (this.is(arg, "object")) {
        for (let i = 1;i < arg.length; i++) {
          const [key, value] = arg[i];
          if (typeof key === "string") {
            const prevReactive = this.reactiveMembers;
            this.reactiveMembers = new Set;
            const valueCode = this.generateInComponent(value, "value");
            this.reactiveMembers = prevReactive;
            props.push(`${key}: ${valueCode}`);
          }
        }
      } else if (Array.isArray(arg) && (arg[0] === "->" || arg[0] === "=>")) {
        const block = arg[2];
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
    }
    const propsCode = props.length > 0 ? `{ ${props.join(", ")} }` : "{}";
    return { propsCode, childrenSetupLines };
  };
  proto.hasReactiveDeps = function(sexpr) {
    if (!this.reactiveMembers || this.reactiveMembers.size === 0)
      return false;
    if (typeof sexpr === "string") {
      return this.reactiveMembers.has(sexpr);
    }
    if (!Array.isArray(sexpr))
      return false;
    if (sexpr[0] === "." && sexpr[1] === "this" && typeof sexpr[2] === "string") {
      return this.reactiveMembers.has(sexpr[2]);
    }
    for (const child of sexpr) {
      if (this.hasReactiveDeps(child))
        return true;
    }
    return false;
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
  return args.filter(Boolean).join(' ');
}

class __Component {
  constructor(props = {}) {
    Object.assign(this, props);
    const prev = __pushComponent(this);
    this._init(props);
    __popComponent(prev);
  }
  _init() {}
  mount(target) {
    if (typeof target === "string") target = document.querySelector(target);
    this._target = target;
    this._root = this._create();
    target.appendChild(this._root);
    if (this._setup) this._setup();
    if (this.mounted) this.mounted();
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
}

// Register on globalThis for runtime deduplication
if (typeof globalThis !== 'undefined') {
  globalThis.__ripComponent = { __pushComponent, __popComponent, setContext, getContext, hasContext, __clsx, __Component };
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
      if (!reverse.has(m.origLine)) {
        reverse.set(m.origLine, { genLine: m.genLine, genCol: m.genCol });
      }
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
    "break-if": "generateBreakIf",
    continue: "generateContinue",
    "continue-if": "generateContinueIf",
    "?": "generateExistential",
    "?:": "generateTernary",
    "|>": "generatePipe",
    loop: "generateLoop",
    "loop-n": "generateLoopN",
    await: "generateAwait",
    yield: "generateYield",
    "yield-from": "generateYieldFrom",
    if: "generateIf",
    unless: "generateIf",
    "for-in": "generateForIn",
    "for-of": "generateForOf",
    "for-as": "generateForAs",
    while: "generateWhile",
    until: "generateUntil",
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
      this.buildMappings(code, sexpr);
    return code;
  }
  buildMappings(code, sexpr) {
    if (!sexpr || sexpr[0] !== "program")
      return;
    let locs = [];
    let collect = (node) => {
      if (!Array.isArray(node))
        return;
      let head = node[0];
      if (head === "program" || head === "block") {
        for (let i = 1;i < node.length; i++) {
          let child = node[i];
          if (Array.isArray(child) && child.loc)
            locs.push(child.loc);
          collect(child);
        }
      } else {
        for (let i = 1;i < node.length; i++)
          collect(node[i]);
      }
    };
    collect(sexpr);
    let lines = code.split(`
`);
    let locIdx = 0;
    for (let outLine = 0;outLine < lines.length; outLine++) {
      let line = lines[outLine];
      let trimmed = line.trim();
      if (!trimmed || trimmed === "}" || trimmed === "});")
        continue;
      if (trimmed.startsWith("let ") || trimmed.startsWith("var "))
        continue;
      if (trimmed.startsWith("const slice") || trimmed.startsWith("const modulo") || trimmed.startsWith("const toSearchable"))
        continue;
      if (trimmed.startsWith("const {") && trimmed.includes("__"))
        continue;
      if (trimmed.startsWith("} else"))
        continue;
      if (trimmed.startsWith("//# source"))
        continue;
      if (locIdx < locs.length) {
        let indent = line.length - trimmed.length;
        this.sourceMap.addMapping(outLine, indent, locs[locIdx].r, locs[locIdx].c);
        locIdx++;
      }
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
    if (head === "readonly")
      return;
    if (head === "component")
      return;
    if (CodeGenerator.ASSIGNMENT_OPS.has(head)) {
      let [target, value] = rest;
      if (typeof target === "string" || target instanceof String) {
        let varName = str(target);
        if (!this.reactiveVars?.has(varName))
          this.programVars.add(varName);
      } else if (this.is(target, "array")) {
        this.collectVarsFromArray(target, this.programVars);
      } else if (this.is(target, "object")) {
        this.collectVarsFromObject(target, this.programVars);
      }
      this.collectProgramVariables(value);
      return;
    }
    if (head === "def" || head === "->" || head === "=>")
      return;
    if (head === "if") {
      let [condition, thenBranch, elseBranch] = rest;
      this.collectProgramVariables(condition);
      this.collectProgramVariables(thenBranch);
      if (elseBranch)
        this.collectProgramVariables(elseBranch);
      return;
    }
    if (head === "unless") {
      let [condition, body] = rest;
      this.collectProgramVariables(condition);
      this.collectProgramVariables(body);
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
      if (head === "def" || head === "->" || head === "=>")
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
          return cond.type === "unless" ? `if (!${condCode}) ${callStr2}` : `if (${condCode}) ${callStr2}`;
        }
      }
      let needsAwait = headAwaitMeta === true;
      let calleeName = this.generate(head, "value");
      let args = rest.map((arg) => this.unwrap(this.generate(arg, "value"))).join(", ");
      let callStr = `${calleeName}(${args})`;
      return needsAwait ? `await ${callStr}` : callStr;
    }
    if (Array.isArray(head) && typeof head[0] === "string") {
      let stmtOps = ["=", "+=", "-=", "*=", "/=", "%=", "**=", "&&=", "||=", "??=", "if", "unless", "return", "throw"];
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
          return cond.type === "unless" ? `if (!${condCode}) ${callStr2}` : `if (${condCode}) ${callStr2}`;
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
    let imports = [], exports = [], other = [];
    for (let stmt of statements) {
      if (!Array.isArray(stmt)) {
        other.push(stmt);
        continue;
      }
      let h = stmt[0];
      if (h === "import")
        imports.push(stmt);
      else if (h === "export" || h === "export-default" || h === "export-all" || h === "export-from")
        exports.push(stmt);
      else
        other.push(stmt);
    }
    let blockStmts = ["def", "class", "if", "unless", "for-in", "for-of", "for-as", "while", "until", "loop", "switch", "try"];
    let statementsCode = other.map((stmt, index) => {
      let isSingle = other.length === 1 && imports.length === 0 && exports.length === 0;
      let isObj = this.is(stmt, "object");
      let isObjComp = isObj && stmt.length === 2 && Array.isArray(stmt[1]) && Array.isArray(stmt[1][1]) && stmt[1][1][0] === "comprehension";
      let isAlreadyExpr = this.is(stmt, "comprehension") || this.is(stmt, "object-comprehension") || this.is(stmt, "do-iife");
      let hasNoVars = this.programVars.size === 0;
      let needsParens = isSingle && isObj && hasNoVars && !isAlreadyExpr && !isObjComp;
      let isLast = index === other.length - 1;
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
          return generated + ";";
      }
      return generated;
    }).join(`
`);
    let needsBlank = false;
    if (imports.length > 0) {
      code += imports.map((s) => this.addSemicolon(s, this.generate(s, "statement"))).join(`
`);
      needsBlank = true;
    }
    if (this.programVars.size > 0) {
      let vars = Array.from(this.programVars).sort().join(", ");
      if (needsBlank)
        code += `
`;
      code += `let ${vars};
`;
      needsBlank = true;
    }
    let skip = this.options.skipPreamble;
    if (!skip) {
      if (this.helpers.has("slice")) {
        code += `const slice = [].slice;
`;
        needsBlank = true;
      }
      if (this.helpers.has("modulo")) {
        code += `const modulo = (n, d) => { n = +n; d = +d; return (n % d + d) % d; };
`;
        needsBlank = true;
      }
      if (this.helpers.has("toSearchable")) {
        code += `const toSearchable = (v, allowNewlines) => {
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
    let exportsCode = "";
    if (exports.length > 0) {
      exportsCode = `
` + exports.map((s) => this.addSemicolon(s, this.generate(s, "statement"))).join(`
`);
    }
    if (this.usesReactivity && !skip) {
      if (typeof globalThis !== "undefined" && globalThis.__rip) {
        code += `const { __state, __computed, __effect, __batch, __readonly, __setErrorHandler, __handleError, __catchErrors } = globalThis.__rip;
`;
      } else {
        code += this.getReactiveRuntime();
      }
      needsBlank = true;
    }
    if (this.usesTemplates && !skip) {
      if (typeof globalThis !== "undefined" && globalThis.__ripComponent) {
        code += `const { __pushComponent, __popComponent, setContext, getContext, hasContext, __clsx, __Component } = globalThis.__ripComponent;
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
    code += statementsCode;
    code += exportsCode;
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
      if (typeof target === "string")
        this.programVars.add(target);
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
      if ((this.is(right, "unless") || this.is(right, "if")) && right.length === 3) {
        let [condType, condition, wrappedValue] = right;
        let unwrapped = Array.isArray(wrappedValue) && wrappedValue.length === 1 ? wrappedValue[0] : wrappedValue;
        let fullValue = [binOp, left, unwrapped];
        let t = this.generate(target, "value"), c = this.generate(condition, "value"), v = this.generate(fullValue, "value");
        return condType === "unless" ? `if (!${c}) ${t} = ${v}` : `if (${c}) ${t} = ${v}`;
      }
    }
    if (context === "statement" && head === "=" && Array.isArray(value) && value.length === 3) {
      let [valHead, condition, actualValue] = value;
      let isPostfix = Array.isArray(actualValue) && actualValue.length === 1 && (!Array.isArray(actualValue[0]) || actualValue[0][0] !== "block");
      if ((valHead === "unless" || valHead === "if") && isPostfix) {
        let unwrapped = Array.isArray(actualValue) && actualValue.length === 1 ? actualValue[0] : actualValue;
        let t = this.generate(target, "value");
        let condCode = this.unwrapLogical(this.generate(condition, "value"));
        let v = this.generate(unwrapped, "value");
        if (valHead === "unless") {
          if (condCode.includes(" ") || /[<>=&|]/.test(condCode))
            condCode = `(${condCode})`;
          return `if (!${condCode}) ${t} = ${v}`;
        }
        return `if (${condCode}) ${t} = ${v}`;
      }
    }
    let targetCode;
    if (target instanceof String && meta(target, "await") !== undefined) {
      targetCode = str(target);
    } else if (typeof target === "string" && this.reactiveVars?.has(target)) {
      targetCode = `${target}.value`;
    } else {
      this.suppressReactiveUnwrap = true;
      targetCode = this.generate(target, "value");
      this.suppressReactiveUnwrap = false;
    }
    let valueCode = this.generate(value, "value");
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
    this.suppressReactiveUnwrap = true;
    let objCode = this.generate(obj, "value");
    this.suppressReactiveUnwrap = false;
    let needsParens = CodeGenerator.NUMBER_LITERAL_RE.test(objCode) || (this.is(obj, "object") || this.is(obj, "await") || this.is(obj, "yield"));
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
    this.helpers.add("toSearchable");
    this.programVars.add("_");
    let v = this.generate(value, "value"), r = this.generate(regex, "value");
    let idx = captureIndex !== null ? this.generate(captureIndex, "value") : "0";
    let allowNL = r.includes("/m") ? ", true" : "";
    return `(_ = toSearchable(${v}${allowNL}).match(${r})) && _[${idx}]`;
  }
  generateIndexAccess(head, rest) {
    let [arr, index] = rest;
    if (this.is(index, "..") || this.is(index, "...")) {
      let isIncl = index[0] === "..";
      let arrCode = this.generate(arr, "value");
      let [start, end] = index.slice(1);
      if (start === null && end === null)
        return `${arrCode}.slice()`;
      if (start === null) {
        if (isIncl && this.is(end, "-", 1) && (str(end[1]) ?? end[1]) == 1)
          return `${arrCode}.slice(0)`;
        let e2 = this.generate(end, "value");
        return isIncl ? `${arrCode}.slice(0, +${e2} + 1 || 9e9)` : `${arrCode}.slice(0, ${e2})`;
      }
      if (end === null)
        return `${arrCode}.slice(${this.generate(start, "value")})`;
      let s = this.generate(start, "value");
      if (isIncl && this.is(end, "-", 1) && (str(end[1]) ?? end[1]) == 1)
        return `${arrCode}.slice(${s})`;
      let e = this.generate(end, "value");
      return isIncl ? `${arrCode}.slice(${s}, +${e} + 1 || 9e9)` : `${arrCode}.slice(${s}, ${e})`;
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
        if (!Array.isArray(expr) || expr[0] !== "return") {
          return `${prefix}${paramSyntax} => ${this.generate(expr, "value")}`;
        }
      }
      if (!Array.isArray(body) || body[0] !== "block") {
        return `${prefix}${paramSyntax} => ${this.generate(body, "value")}`;
      }
    }
    let bodyCode = this.generateFunctionBody(body, params, sideEffectOnly);
    return `${prefix}${paramSyntax} => ${bodyCode}`;
  }
  generateReturn(head, rest, context, sexpr) {
    if (rest.length === 0)
      return "return";
    let [expr] = rest;
    if (this.sideEffectOnly)
      return "return";
    if (this.is(expr, "unless")) {
      let [, condition, body] = expr;
      let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
      return `if (!${this.generate(condition, "value")}) return ${this.generate(val, "value")}`;
    }
    if (this.is(expr, "if")) {
      let [, condition, body, ...elseParts] = expr;
      if (elseParts.length === 0) {
        let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
        return `if (${this.generate(condition, "value")}) return ${this.generate(val, "value")}`;
      }
    }
    if (this.is(expr, "new") && Array.isArray(expr[1]) && expr[1][0] === "unless") {
      let [, unlessNode] = expr;
      let [, condition, body] = unlessNode;
      let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
      return `if (!${this.generate(condition, "value")}) return ${this.generate(["new", val], "value")}`;
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
      let stmts = this.withIndent(() => this.formatStatements(body.slice(1)));
      bodyCode = `{
${stmts.join(`
`)}
${this.indent()}}`;
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
  generateBreakIf(head, rest) {
    return `if (${this.generate(rest[0], "value")}) break`;
  }
  generateContinue() {
    return "continue";
  }
  generateContinueIf(head, rest) {
    return `if (${this.generate(rest[0], "value")}) continue`;
  }
  generateExistential(head, rest) {
    return `(${this.generate(rest[0], "value")} != null)`;
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
    if (head === "unless") {
      let [condition2, body] = rest;
      if (Array.isArray(body) && body.length === 1 && (!Array.isArray(body[0]) || body[0][0] !== "block"))
        body = body[0];
      if (context === "value") {
        return `(!${this.generate(condition2, "value")} ? ${this.extractExpression(body)} : undefined)`;
      }
      let condCode = this.unwrap(this.generate(condition2, "value"));
      if (/[ <>=&|]/.test(condCode))
        condCode = `(${condCode})`;
      return `if (!${condCode}) ` + this.generate(body, "statement");
    }
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
  generateUntil(head, rest) {
    let [cond, body] = rest;
    return `while (!(${this.unwrap(this.generate(cond, "value"))})) ` + this.generateLoopBody(body);
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
    this.helpers.add("toSearchable");
    this.programVars.add("_");
    let r = this.generate(right, "value");
    let allowNL = r.includes("/m") ? ", true" : "";
    return `(_ = toSearchable(${this.generate(left, "value")}${allowNL}).match(${r}))`;
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
    if (pairs.length === 1 && Array.isArray(pairs[0]) && Array.isArray(pairs[0][1]) && pairs[0][1][0] === "comprehension") {
      let [keyVar, compNode] = pairs[0];
      let [, valueExpr, iterators, guards] = compNode;
      return this.generate(["object-comprehension", keyVar, valueExpr, iterators, guards], context);
    }
    let codes = pairs.map((pair) => {
      if (this.is(pair, "..."))
        return `...${this.generate(pair[1], "value")}`;
      let [key, value, operator] = pair;
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
      if (expr[0] === "new" && Array.isArray(expr[1]) && (expr[1][0] === "if" || expr[1][0] === "unless")) {
        wrapperType = "new";
        checkExpr = expr[1];
      } else if (expr[0] === "if" || expr[0] === "unless") {
        checkExpr = expr;
      }
      if (checkExpr[0] === "if" || checkExpr[0] === "unless") {
        let [condType, condition, body] = checkExpr;
        let unwrapped = Array.isArray(body) && body.length === 1 ? body[0] : body;
        expr = wrapperType === "new" ? ["new", unwrapped] : unwrapped;
        let condCode = this.generate(condition, "value");
        let throwCode = `throw ${this.generate(expr, "value")}`;
        return condType === "unless" ? `if (!(${condCode})) {
${this.indent()}  ${throwCode};
${this.indent()}}` : `if (${condCode}) {
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
        let step = stepOrOwn;
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
            let sc = this.generate(s, "value"), ec = this.generate(e, "value"), stc = this.generate(step, "value");
            code += this.indent() + `for (let ${ivp} = ${sc}; ${ivp} ${isExcl ? "<" : "<="} ${ec}; ${ivp} += ${stc}) {
`;
            this.indentLevel++;
          } else {
            let ic = this.generate(iterable, "value"), idxN = indexVar || "_i", stc = this.generate(step, "value");
            let isNeg = this.is(step, "-", 1);
            code += isNeg ? this.indent() + `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${idxN} += ${stc}) {
` : this.indent() + `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${idxN} += ${stc}) {
`;
            this.indentLevel++;
            if (!noVar)
              code += this.indent() + `const ${ivp} = ${ic}[${idxN}];
`;
          }
        } else if (indexVar) {
          let ic = this.generate(iterable, "value");
          code += this.indent() + `for (let ${indexVar} = 0; ${indexVar} < ${ic}.length; ${indexVar}++) {
`;
          this.indentLevel++;
          code += this.indent() + `const ${ivp} = ${ic}[${indexVar}];
`;
        } else {
          code += this.indent() + `for (const ${ivp} of ${this.generate(iterable, "value")}) {
`;
          this.indentLevel++;
        }
      } else if (iterType === "for-of") {
        let own = stepOrOwn;
        let va = Array.isArray(vars) ? vars : [vars];
        let [kv, vv] = va;
        let kvp = this.is(kv, "array") || this.is(kv, "object") ? this.generateDestructuringPattern(kv) : kv;
        let oc = this.generate(iterable, "value");
        code += this.indent() + `for (const ${kvp} in ${oc}) {
`;
        this.indentLevel++;
        if (own)
          code += this.indent() + `if (!Object.hasOwn(${oc}, ${kvp})) continue;
`;
        if (vv)
          code += this.indent() + `const ${vv} = ${oc}[${kvp}];
`;
      } else if (iterType === "for-as") {
        let isAwait = iter[3];
        let va = Array.isArray(vars) ? vars : [vars];
        let [fv] = va;
        let ivp = this.is(fv, "array") || this.is(fv, "object") ? this.generateDestructuringPattern(fv) : fv;
        code += this.indent() + `for ${isAwait ? "await " : ""}(const ${ivp} of ${this.generate(iterable, "value")}) {
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
      if (["break", "continue", "break-if", "continue-if", "return", "throw"].includes(node[0]))
        return true;
      if (node[0] === "if" || node[0] === "unless")
        return node.slice(1).some(hasCtrl);
      return node.some(hasCtrl);
    };
    let loopStmts = ["for-in", "for-of", "for-as", "while", "until", "loop"];
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
          for (let [mk, mv] of members) {
            let isStatic = this.is(mk, ".") && mk[1] === "this";
            let isComputed = this.is(mk, "computed");
            let mName = this.extractMemberName(mk);
            if (this.is(mv, "=>") && !isStatic && !isComputed && mName !== "constructor")
              boundMethods.push(mName);
          }
          for (let [mk, mv] of members) {
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
          for (let [mk, mv] of members) {
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
    let [specifier, source] = rest;
    let fixedSource = this.addJsExtensionAndAssertions(source);
    if (typeof specifier === "string")
      return `import ${specifier} from ${fixedSource}`;
    if (Array.isArray(specifier)) {
      if (specifier[0] === "*" && specifier.length === 2)
        return `import * as ${specifier[1]} from ${fixedSource}`;
      if (typeof specifier[0] === "string" && Array.isArray(specifier[1])) {
        let def = specifier[0], second = specifier[1];
        if (second[0] === "*" && second.length === 2)
          return `import ${def}, * as ${second[1]} from ${fixedSource}`;
        let names2 = (Array.isArray(second) ? second : [second]).map((i) => Array.isArray(i) && i.length === 2 ? `${i[0]} as ${i[1]}` : i).join(", ");
        return `import ${def}, { ${names2} } from ${fixedSource}`;
      }
      let names = specifier.map((i) => Array.isArray(i) && i.length === 2 ? `${i[0]} as ${i[1]}` : i).join(", ");
      return `import { ${names} } from ${fixedSource}`;
    }
    return `import ${this.generate(specifier, "value")} from ${fixedSource}`;
  }
  generateExport(head, rest) {
    let [decl] = rest;
    if (Array.isArray(decl) && decl.every((i) => typeof i === "string"))
      return `export { ${decl.join(", ")} }`;
    if (this.is(decl, "="))
      return `export const ${decl[1]} = ${this.generate(decl[2], "value")}`;
    return `export ${this.generate(decl, "statement")}`;
  }
  generateExportDefault(head, rest) {
    let [expr] = rest;
    if (this.is(expr, "=")) {
      return `const ${expr[1]} = ${this.generate(expr[2], "value")};
export default ${expr[1]}`;
    }
    return `export default ${this.generate(expr, "statement")}`;
  }
  generateExportAll(head, rest) {
    return `export * from ${this.addJsExtensionAndAssertions(rest[0])}`;
  }
  generateExportFrom(head, rest) {
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
    if ((h === "unless" || h === "if") && expr.length === 3)
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
        let [key, value] = pair;
        if (key === value)
          return key;
        return `${key}: ${value}`;
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
    let loopStmts = ["for-in", "for-of", "for-as", "while", "until", "loop"];
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
          if (!isConstructor && !sideEffectOnly && isLast && (h === "if" || h === "unless")) {
            let [cond, thenB, ...elseB] = stmt.slice(1);
            let hasMulti = (b) => this.is(b, "block") && b.length > 2;
            if (hasMulti(thenB) || elseB.some(hasMulti)) {
              code += this.generateIfElseWithEarlyReturns(stmt);
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
        let step = stepOrOwn;
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
            code += this.indent() + `for (let ${ivp} = ${this.generate(s, "value")}; ${ivp} ${isExcl ? "<" : "<="} ${this.generate(e, "value")}; ${ivp} += ${this.generate(step, "value")}) {
`;
          } else {
            let ic = this.generate(iterable, "value"), idxN = indexVar || "_i", stc = this.generate(step, "value");
            let isNeg = this.is(step, "-", 1);
            code += isNeg ? this.indent() + `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${idxN} += ${stc}) {
` : this.indent() + `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${idxN} += ${stc}) {
`;
            this.indentLevel++;
            if (!noVar)
              code += this.indent() + `const ${ivp} = ${ic}[${idxN}];
`;
          }
        } else {
          code += this.indent() + `for (const ${ivp} of ${this.generate(iterable, "value")}) {
`;
        }
        this.indentLevel++;
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
    if (iterators.length === 1) {
      let [iterType, vars, iterable, stepOrOwn] = iterators[0];
      if (iterType === "for-in") {
        let step = stepOrOwn;
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
            code += `for (let ${ivp} = ${this.generate(s, "value")}; ${ivp} ${isExcl ? "<" : "<="} ${this.generate(e, "value")}; ${ivp} += ${this.generate(step, "value")}) `;
          } else {
            let ic = this.generate(iterable, "value"), idxN = indexVar || "_i", stc = this.generate(step, "value");
            let isNeg = this.is(step, "-", 1);
            let isMinus1 = isNeg && (step[1] === "1" || step[1] === 1 || str(step[1]) === "1");
            let isPlus1 = !isNeg && (step === "1" || step === 1 || str(step) === "1");
            if (isMinus1)
              code += `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${idxN}--) `;
            else if (isPlus1)
              code += `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${idxN}++) `;
            else if (isNeg)
              code += `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${idxN} += ${stc}) `;
            else
              code += `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${idxN} += ${stc}) `;
            code += `{
`;
            this.indentLevel++;
            if (!noVar)
              code += this.indent() + `const ${ivp} = ${ic}[${idxN}];
`;
          }
          if (guards?.length) {
            if (!isRange)
              code += this.indent();
            code += `{
`;
            this.indentLevel++;
            code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
            this.indentLevel++;
            code += this.indent() + this.generate(expr, "statement") + `;
`;
            this.indentLevel--;
            code += this.indent() + `}
`;
            this.indentLevel--;
            code += this.indent() + "}";
          } else {
            if (!isRange)
              code += this.indent();
            code += `{
`;
            this.indentLevel++;
            code += this.indent() + this.generate(expr, "statement") + `;
`;
            this.indentLevel--;
            code += this.indent() + "}";
          }
          if (!isRange) {
            this.indentLevel--;
            code += `
` + this.indent() + "}";
          }
          return code;
        }
        if (indexVar) {
          let ic = this.generate(iterable, "value");
          code += `for (let ${indexVar} = 0; ${indexVar} < ${ic}.length; ${indexVar}++) `;
          code += `{
`;
          this.indentLevel++;
          code += this.indent() + `const ${ivp} = ${ic}[${indexVar}];
`;
        } else {
          code += `for (const ${ivp} of ${this.generate(iterable, "value")}) `;
          if (guards?.length) {
            code += `{
`;
            this.indentLevel++;
            code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
            this.indentLevel++;
            code += this.indent() + this.generate(expr, "statement") + `;
`;
            this.indentLevel--;
            code += this.indent() + `}
`;
            this.indentLevel--;
            code += this.indent() + "}";
          } else {
            code += `{
`;
            this.indentLevel++;
            code += this.indent() + this.generate(expr, "statement") + `;
`;
            this.indentLevel--;
            code += this.indent() + "}";
          }
          return code;
        }
        if (guards?.length) {
          code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
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
        this.indentLevel--;
        code += this.indent() + "}";
        return code;
      }
      if (iterType === "for-as") {
        let va = Array.isArray(vars) ? vars : [vars];
        let [fv] = va;
        let ivp = this.is(fv, "array") || this.is(fv, "object") ? this.generateDestructuringPattern(fv) : fv;
        code += `for (const ${ivp} of ${this.generate(iterable, "value")}) `;
        if (guards?.length) {
          code += `{
`;
          this.indentLevel++;
          code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
          this.indentLevel--;
          code += this.indent() + "}";
        } else {
          code += `{
`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + "}";
        }
        return code;
      }
      if (iterType === "for-of") {
        let va = Array.isArray(vars) ? vars : [vars];
        let [kv, vv] = va;
        let own = stepOrOwn;
        let oc = this.generate(iterable, "value");
        code += `for (const ${kv} in ${oc}) {
`;
        this.indentLevel++;
        if (own && !vv && !guards?.length) {
          code += this.indent() + `if (!Object.hasOwn(${oc}, ${kv})) continue;
`;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
        } else if (own && vv && guards?.length) {
          code += this.indent() + `if (Object.hasOwn(${oc}, ${kv})) {
`;
          this.indentLevel++;
          code += this.indent() + `const ${vv} = ${oc}[${kv}];
`;
          code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
        } else if (own && vv) {
          code += this.indent() + `if (Object.hasOwn(${oc}, ${kv})) {
`;
          this.indentLevel++;
          code += this.indent() + `const ${vv} = ${oc}[${kv}];
`;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
        } else if (vv && guards?.length) {
          code += this.indent() + `const ${vv} = ${oc}[${kv}];
`;
          code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
`;
          this.indentLevel++;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
        } else if (vv) {
          code += this.indent() + `const ${vv} = ${oc}[${kv}];
`;
          code += this.indent() + this.generate(expr, "statement") + `;
`;
        } else if (guards?.length) {
          code += this.indent() + `if (${guards.map((g) => this.generate(g, "value")).join(" && ")}) {
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
    let condCode = head === "unless" ? `!${this.generate(condition, "value")}` : this.generate(condition, "value");
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
    if (hasFlow) {
      for (let s of this.unwrapBlock(body))
        code += this.indent() + this.generate(s, "statement") + `;
`;
    } else if (context === "value") {
      if (this.is(body, "block") && body.length > 2) {
        let stmts = body.slice(1);
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
      if (this.is(body, "block") && body.length > 1) {
        for (let s of body.slice(1))
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
    if (Array.isArray(body[0]))
      return body;
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
    return !["def", "class", "if", "unless", "for-in", "for-of", "for-as", "while", "until", "loop", "switch", "try"].includes(h);
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
    if (t === "if" || t === "unless") {
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
        let [key, value, operator] = pair;
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
  compile(source) {
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
        dts = emitTypes(typeTokens, ["program"]);
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
      skipPreamble: this.options.skipPreamble,
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
      dts = emitTypes(typeTokens, sexpr);
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
installComponentSupport(CodeGenerator);
CodeGenerator.prototype.generateEnum = generateEnum;
function compile(source, options = {}) {
  return new Compiler(options).compile(source);
}
function compileToJS(source, options = {}) {
  return new Compiler(options).compileToJS(source);
}
function getReactiveRuntime() {
  return new CodeGenerator({}).getReactiveRuntime();
}
function getComponentRuntime() {
  return new CodeGenerator({}).getComponentRuntime();
}
// src/browser.js
var VERSION = "3.8.3";
var BUILD_DATE = "2026-02-13@10:15:08GMT";
if (typeof globalThis !== "undefined" && !globalThis.__rip) {
  new Function(getReactiveRuntime())();
}
var dedent = (s) => {
  const m = s.match(/^[ \t]*(?=\S)/gm);
  const i = Math.min(...(m || []).map((x) => x.length));
  return s.replace(RegExp(`^[ 	]{${i}}`, "gm"), "").trim();
};
async function processRipScripts() {
  const scripts = document.querySelectorAll('script[type="text/rip"]');
  for (const script of scripts) {
    if (script.hasAttribute("data-rip-processed"))
      continue;
    try {
      const ripCode = dedent(script.textContent);
      let jsCode;
      try {
        jsCode = compileToJS(ripCode);
      } catch (compileError) {
        console.error("Rip compile error:", compileError.message);
        console.error("Source:", ripCode);
        continue;
      }
      await (0, eval)(`(async()=>{
${jsCode}
})()`);
      script.setAttribute("data-rip-processed", "true");
    } catch (error) {
      console.error("Rip runtime error:", error);
    }
  }
}
async function importRip(url) {
  const source = await fetch(url).then((r) => {
    if (!r.ok)
      throw new Error(`importRip: ${url} (${r.status})`);
    return r.text();
  });
  const js = compileToJS(source);
  const blob = new Blob([js], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  try {
    return await import(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
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
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", processRipScripts);
  } else {
    processRipScripts();
  }
}
export {
  rip,
  processRipScripts,
  parser,
  importRip,
  getReactiveRuntime,
  getComponentRuntime,
  formatSExpr,
  compileToJS,
  compile,
  VERSION,
  Lexer,
  Compiler,
  CodeGenerator,
  BUILD_DATE
};
