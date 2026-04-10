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
    formatErrorHTML: () => formatErrorHTML,
    formatError: () => formatError,
    compileToJS: () => compileToJS,
    compile: () => compile,
    VERSION: () => VERSION,
    RipError: () => RipError,
    Lexer: () => Lexer,
    Compiler: () => Compiler,
    CodeEmitter: () => CodeEmitter,
    BUILD_DATE: () => BUILD_DATE
  });

  // src/types.js
  var INTRINSIC_TYPE_DECLS = [
    "type __RipElementMap = HTMLElementTagNameMap & Omit<SVGElementTagNameMap, keyof HTMLElementTagNameMap>;",
    "type __RipTag = keyof __RipElementMap;",
    "type __RipBrowserElement = Omit<HTMLElement, 'querySelector' | 'querySelectorAll' | 'closest' | 'setAttribute' | 'hidden'> & { hidden: boolean | 'until-found'; setAttribute(qualifiedName: string, value: any): void; querySelector(selectors: string): __RipBrowserElement | null; querySelectorAll(selectors: string): NodeListOf<__RipBrowserElement>; closest(selectors: string): __RipBrowserElement | null; };",
    "type __RipDomEl<K extends __RipTag> = Omit<__RipElementMap[K], 'querySelector' | 'querySelectorAll' | 'closest' | 'setAttribute' | 'hidden'> & __RipBrowserElement;",
    "type __RipAttrKeys<T> = { [K in keyof T]-?: K extends 'style' | 'classList' | 'className' | 'nodeValue' | 'textContent' | 'innerHTML' | 'innerText' | 'outerHTML' | 'outerText' | 'scrollLeft' | 'scrollTop' ? never : K extends `on${string}` | `aria${string}Element` | `aria${string}Elements` ? never : T[K] extends (...args: any[]) => any ? never : (<V>() => V extends Pick<T, K> ? 1 : 2) extends (<V>() => V extends { -readonly [P in K]: T[P] } ? 1 : 2) ? K : never }[keyof T] & string;",
    "type __RipEvents = { [K in keyof HTMLElementEventMap as `@${K}`]?: ((event: HTMLElementEventMap[K]) => void) | null };",
    "type __RipClassValue = string | boolean | null | undefined | Record<string, boolean> | __RipClassValue[];",
    "type __RipProps<K extends __RipTag> = { [P in __RipAttrKeys<__RipElementMap[K]>]?: __RipElementMap[K][P] } & __RipEvents & { ref?: string; class?: __RipClassValue | __RipClassValue[]; style?: string; [k: `data-${string}`]: any; [k: `aria-${string}`]: any };"
  ];
  var ARIA_TYPE_DECLS = [
    "type __RipAriaNavHandlers = { next?: () => void; prev?: () => void; first?: () => void; last?: () => void; select?: () => void; dismiss?: () => void; tab?: () => void; char?: () => void; };",
    "declare const ARIA: {",
    "  bindPopover(open: boolean, popover: () => Element | null | undefined, setOpen: (isOpen: boolean) => void, source?: (() => Element | null | undefined) | null): void;",
    "  bindDialog(open: boolean, dialog: () => Element | null | undefined, setOpen: (isOpen: boolean) => void, dismissable?: boolean): void;",
    "  popupDismiss(open: boolean, popup: () => Element | null | undefined, close: () => void, els?: Array<() => Element | null | undefined>, repos?: (() => void) | null): void;",
    "  popupGuard(delay?: number): any;",
    "  listNav(event: KeyboardEvent, handlers: __RipAriaNavHandlers): void;",
    "  rovingNav(event: KeyboardEvent, handlers: __RipAriaNavHandlers, orientation?: 'vertical' | 'horizontal' | 'both'): void;",
    "  positionBelow(trigger: Element | null | undefined, popup: Element | null | undefined, gap?: number, setVisible?: boolean): void;",
    "  position(trigger: Element | null | undefined, floating: Element | null | undefined, opts?: any): void;",
    "  trapFocus(panel: Element | null | undefined): void;",
    "  wireAria(panel: Element, id: string): void;",
    "  lockScroll(instance: any): void;",
    "  unlockScroll(instance: any): void;",
    "  hasAnchor: boolean;",
    "  [key: string]: any;",
    "};"
  ];
  var SIGNAL_INTERFACE = "interface Signal<T> { value: T; read(): T; lock(): Signal<T>; free(): Signal<T>; kill(): T; }";
  var SIGNAL_FN = "declare function __state<T>(value: T | Signal<T>): Signal<T>;";
  var COMPUTED_INTERFACE = "interface Computed<T> { readonly value: T; read(): T; lock(): Computed<T>; free(): Computed<T>; kill(): T; }";
  var COMPUTED_FN = "declare function __computed<T>(fn: () => T): Computed<T>;";
  var EFFECT_FN = "declare function __effect(fn: () => void | (() => void)): () => void;";
  function installTypeSupport(Lexer) {
    let proto = Lexer.prototype;
    proto.rewriteTypes = function() {
      let tokens = this.tokens;
      let typeRefNames = this.typeRefNames = new Set;
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
              let afterAngles = i + 1 + genTokens.length;
              let isComponent = !isDef && tokens2[afterAngles]?.[0] === "=" && tokens2[afterAngles + 1]?.[0] === "COMPONENT";
              if (isDef || isComponent) {
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
            let arrowIdx = i + 1 + typeTokens.consumed;
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
          for (let tt of typeTokens) {
            if (tt[0] === "IDENTIFIER")
              typeRefNames.add(tt[1]);
          }
          let removeCount = 1 + typeTokens.consumed;
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
          tokens2.splice(removeFrom, afterEq + typeTokens.consumed - removeFrom, makeDecl(buildTypeString(typeTokens)));
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
      for (let i = tokens.length - 1;i >= 0; i--) {
        if (tokens[i][0] !== "DEF")
          continue;
        let nameToken = tokens[i + 1];
        if (!nameToken || nameToken[0] !== "IDENTIFIER")
          continue;
        let j = i + 2;
        if (tokens[j]?.[0] !== "CALL_START")
          continue;
        let depth = 1;
        j++;
        while (j < tokens.length && depth > 0) {
          if (tokens[j][0] === "CALL_START")
            depth++;
          if (tokens[j][0] === "CALL_END")
            depth--;
          j++;
        }
        let callEndIdx = j - 1;
        let next = tokens[j];
        if (next && next[0] !== "TERMINATOR")
          continue;
        let hasTypes = nameToken.data?.returnType;
        if (!hasTypes) {
          for (let k = i + 2;k <= callEndIdx; k++) {
            if (tokens[k].data?.type) {
              hasTypes = true;
              break;
            }
          }
        }
        if (!hasTypes)
          continue;
        let overloadTokens = tokens.slice(i, j + 1);
        let exported = i >= 1 && tokens[i - 1]?.[0] === "EXPORT";
        let spliceFrom = exported ? i - 1 : i;
        let spliceCount = j + 1 - spliceFrom;
        let marker = gen("TYPE_DECL", nameToken[1], nameToken);
        marker.data = {
          name: nameToken[1],
          kind: "overload",
          overloadTokens,
          exported
        };
        if (nameToken.data?.typeParams)
          marker.data.typeParams = nameToken.data.typeParams;
        tokens.splice(spliceFrom, spliceCount, marker);
      }
    };
  }
  function collectTypeExpression(tokens, j) {
    let typeTokens = [];
    let depth = 0;
    let startJ = j;
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
        if (tTag === "INDENT" && typeTokens.length > 0 && typeTokens[typeTokens.length - 1][0] === "=>") {
          j++;
          let nest = 1;
          while (j < tokens.length && nest > 0) {
            if (tokens[j][0] === "INDENT") {
              nest++;
              j++;
            } else if (tokens[j][0] === "OUTDENT") {
              nest--;
              j++;
            } else {
              typeTokens.push(tokens[j]);
              j++;
            }
          }
          continue;
        }
        if (tTag === "=" || tTag === "REACTIVE_ASSIGN" || tTag === "COMPUTED_ASSIGN" || tTag === "READONLY_ASSIGN" || tTag === "EFFECT" || tTag === "TERMINATOR" || tTag === "INDENT" || tTag === "OUTDENT" || tTag === "->" || tTag === ",") {
          break;
        }
      }
      typeTokens.push(t);
      j++;
    }
    typeTokens.consumed = j - startJ;
    return typeTokens;
  }
  function buildTypeString(typeTokens) {
    if (typeTokens.length === 0)
      return "";
    if (typeTokens[0]?.[0] === "=>")
      typeTokens.unshift(["", "()"]);
    let typeStr = typeTokens.map((t) => t[1]).join(" ").replace(/\s+/g, " ").trim();
    typeStr = typeStr.replace(/\s*<\s*/g, "<").replace(/\s*>\s*/g, ">").replace(/\s*\[\s*/g, "[").replace(/\s*\]\s*/g, "]").replace(/\s*\(\s*/g, "(").replace(/\s*\)\s*/g, ")").replace(/\s*,\s*/g, ", ").replace(/\s*=>\s*/g, " => ").replace(/ :: /g, ": ").replace(/:: /g, ": ").replace(/ : /g, ": ");
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
      if (depth === 1 && t[0] === "[") {
        let sigTokens = [];
        j++;
        while (j < tokens.length && tokens[j][0] !== "]") {
          sigTokens.push(tokens[j]);
          j++;
        }
        j++;
        if (tokens[j]?.[1] === ":" || tokens[j]?.[0] === "TYPE_ANNOTATION")
          j++;
        let valTypeTokens = [];
        while (j < tokens.length) {
          let pt = tokens[j];
          if (pt[0] === "TERMINATOR" || pt[0] === "OUTDENT")
            break;
          valTypeTokens.push(pt);
          j++;
        }
        let sigStr = buildTypeString(sigTokens);
        let valStr = buildTypeString(valTypeTokens);
        props.push(`[${sigStr}]: ${valStr}`);
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
          if (pt[0] === "IDENTIFIER" && pt[1] === "type" && tokens[j + 1]?.[0] === "INDENT") {
            j++;
            let nestedType = collectStructuralType(tokens, j);
            propTypeTokens.push(["", nestedType]);
            let nd = 1;
            j++;
            while (j < tokens.length && nd > 0) {
              if (tokens[j][0] === "INDENT")
                nd++;
              if (tokens[j][0] === "OUTDENT")
                nd--;
              j++;
            }
            continue;
          }
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
          let inner = body.slice(2, -2);
          let props = [], start = 0, d = 0;
          for (let c = 0;c < inner.length; c++) {
            if (inner[c] === "{")
              d++;
            else if (inner[c] === "}")
              d--;
            else if (d === 0 && inner[c] === ";" && inner[c + 1] === " ") {
              props.push(inner.slice(start, c));
              start = c + 2;
            }
          }
          if (start < inner.length)
            props.push(inner.slice(start));
          props = props.filter((p) => p.trim());
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
        if (data.kind === "overload") {
          let ot = data.overloadTokens;
          let nameToken = ot[1];
          let { params: paramList } = collectParams(ot, 2);
          let returnType = nameToken.data?.returnType;
          let ret = returnType ? `: ${expandSuffixes(returnType)}` : "";
          let declare = inClass ? "" : exp ? "" : "declare ";
          let typeParams = data.typeParams || "";
          if (inClass) {
            lines.push(`${indent()}${data.name}${typeParams}(${paramList.join(", ")})${ret};`);
          } else {
            lines.push(`${indent()}${exp}${declare}function ${data.name}${typeParams}(${paramList.join(", ")})${ret};`);
          }
        } else if (data.kind === "interface") {
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
      preamble.push(...INTRINSIC_TYPE_DECLS);
    }
    if (/\bARIA\./.test(source)) {
      preamble.push(...ARIA_TYPE_DECLS);
    }
    if (usesSignal) {
      preamble.push(SIGNAL_INTERFACE);
      preamble.push(SIGNAL_FN);
    }
    if (usesComputed) {
      preamble.push(COMPUTED_INTERFACE);
      preamble.push(COMPUTED_FN);
    }
    if (usesSignal || usesComputed) {
      preamble.push(EFFECT_FN);
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
    let typeParams = "";
    if (head === "export" && Array.isArray(sexpr[1])) {
      exported = true;
      let inner = sexpr[1];
      let innerHead = inner[0]?.valueOf?.() ?? inner[0];
      if (innerHead === "=" && Array.isArray(inner[2]) && (inner[2][0]?.valueOf?.() ?? inner[2][0]) === "component") {
        typeParams = inner[1]?.typeParams || "";
        name = inner[1]?.valueOf?.() ?? inner[1];
        compNode = inner[2];
      }
    } else if (head === "=" && Array.isArray(sexpr[2]) && (sexpr[2][0]?.valueOf?.() ?? sexpr[2][0]) === "component") {
      typeParams = sexpr[1]?.typeParams || "";
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
      lines.push(`${exp}declare class ${name}${typeParams} {`);
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
  function emitEnum(head, rest, context) {
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
  var IDENTIFIER_RE = /^(?!\d)((?:(?!\s)[$\w\x7f-\uffff])+(?:!|[?](?![.?![(]))?)([^\n\S]*:(?![=:]))?/;
  var NUMBER_RE = /^0b[01](?:_?[01])*n?|^0o[0-7](?:_?[0-7])*n?|^0x[\da-f](?:_?[\da-f])*n?|^\d+(?:_\d+)*n|^(?:\d+(?:_\d+)*)?\.?\d+(?:_\d+)*(?:e[+-]?\d+(?:_\d+)*)?/i;
  var OPERATOR_RE = /^(?:<=>|::|\*>|[-=]>|~>|~=|:=|=!|===|!==|\?\!|\?\?|=~|\|>|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|<>*\/%])\2=?|\?\.?|\.{2,3})/;
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
      if (tag === "IDENTIFIER" && RESERVED.has(baseId)) {
        if (baseId === "void" && (this.inTypeAnnotation || this.prevTag() === "=>")) {} else {
          syntaxError(`reserved word '${baseId}'`, { row: this.row, col: this.col, len: idLen });
        }
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
      let isGenericClose = prev?.[0] === "COMPARE" && prev[1] === ">" || prev?.[0] === "SHIFT" && (prev[1] === ">>" || prev[1] === ">>>");
      if (isGenericClose) {
        let depth = 0;
        for (let k = this.tokens.length - 1;k >= 0; k--) {
          let tk = this.tokens[k];
          if (tk[0] === "COMPARE" && tk[1] === ">")
            depth++;
          else if (tk[0] === "SHIFT" && tk[1] === ">>")
            depth += 2;
          else if (tk[0] === "SHIFT" && tk[1] === ">>>")
            depth += 3;
          else if (tk[0] === "COMPARE" && tk[1] === "<")
            depth--;
          if (depth === 0 && tk[0] === "TYPE_ANNOTATION")
            return false;
          if (depth === 0 && tk[0] === "IDENTIFIER" && tk[1] === "type")
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
    symbolIds: { $accept: 0, $end: 1, error: 2, Root: 3, Body: 4, Line: 5, TERMINATOR: 6, Expression: 7, ExpressionLine: 8, Statement: 9, Return: 10, STATEMENT: 11, Import: 12, Export: 13, Value: 14, Code: 15, Operation: 16, Assign: 17, ReactiveAssign: 18, ComputedAssign: 19, ReadonlyAssign: 20, Effect: 21, If: 22, Try: 23, While: 24, For: 25, Switch: 26, Class: 27, Component: 28, Render: 29, Throw: 30, Yield: 31, Def: 32, Enum: 33, CodeLine: 34, OperationLine: 35, Assignable: 36, Literal: 37, Parenthetical: 38, Range: 39, Invocation: 40, DoIife: 41, This: 42, Super: 43, MetaProperty: 44, MapLiteral: 45, AlphaNumeric: 46, JS: 47, Regex: 48, UNDEFINED: 49, NULL: 50, BOOL: 51, INFINITY: 52, NAN: 53, NUMBER: 54, String: 55, Identifier: 56, IDENTIFIER: 57, Property: 58, PROPERTY: 59, STRING: 60, STRING_START: 61, Interpolations: 62, STRING_END: 63, InterpolationChunk: 64, INTERPOLATION_START: 65, INTERPOLATION_END: 66, INDENT: 67, OUTDENT: 68, REGEX: 69, REGEX_START: 70, REGEX_END: 71, RegexWithIndex: 72, ",": 73, "=": 74, REACTIVE_ASSIGN: 75, COMPUTED_ASSIGN: 76, Block: 77, READONLY_ASSIGN: 78, EFFECT: 79, SimpleAssignable: 80, Array: 81, Object: 82, ThisProperty: 83, ".": 84, "?.": 85, INDEX_START: 86, INDEX_END: 87, Slice: 88, ES6_OPTIONAL_INDEX: 89, "{": 90, ObjAssignable: 91, ":": 92, FOR: 93, ForVariables: 94, FOROF: 95, OptComma: 96, "}": 97, WHEN: 98, OWN: 99, AssignList: 100, AssignObj: 101, ObjRestValue: 102, SimpleObjAssignable: 103, "[": 104, "]": 105, "@": 106, "...": 107, ObjSpreadExpr: 108, SUPER: 109, Arguments: 110, DYNAMIC_IMPORT: 111, MAP_START: 112, MAP_END: 113, MapAssignList: 114, MapAssignObj: 115, MapAssignable: 116, Elisions: 117, ArgElisionList: 118, OptElisions: 119, ArgElision: 120, Arg: 121, Elision: 122, RangeDots: 123, "..": 124, DEF: 125, CALL_START: 126, ParamList: 127, CALL_END: 128, PARAM_START: 129, PARAM_END: 130, FuncGlyph: 131, "->": 132, "=>": 133, Param: 134, ParamVar: 135, Splat: 136, ES6_OPTIONAL_CALL: 137, ArgList: 138, SimpleArgs: 139, THIS: 140, NEW_TARGET: 141, IMPORT_META: 142, "(": 143, ")": 144, RETURN: 145, THROW: 146, YIELD: 147, FROM: 148, IfBlock: 149, IF: 150, ELSE: 151, UnlessBlock: 152, UNLESS: 153, POST_IF: 154, POST_UNLESS: 155, TRY: 156, Catch: 157, FINALLY: 158, CATCH: 159, SWITCH: 160, Whens: 161, When: 162, LEADING_WHEN: 163, WhileSource: 164, WHILE: 165, UNTIL: 166, Loop: 167, LOOP: 168, FORIN: 169, BY: 170, FORAS: 171, AWAIT: 172, FORASAWAIT: 173, ForValue: 174, CLASS: 175, EXTENDS: 176, ENUM: 177, COMPONENT: 178, ComponentBody: 179, ComponentLine: 180, OFFER: 181, ACCEPT: 182, RENDER: 183, IMPORT: 184, ImportDefaultSpecifier: 185, ImportNamespaceSpecifier: 186, ImportSpecifierList: 187, ImportSpecifier: 188, AS: 189, DEFAULT: 190, IMPORT_ALL: 191, EXPORT: 192, ExportSpecifierList: 193, EXPORT_ALL: 194, ExportSpecifier: 195, UNARY: 196, DO: 197, DO_IIFE: 198, UNARY_MATH: 199, "-": 200, "+": 201, "?": 202, PRESENCE: 203, "--": 204, "++": 205, MATH: 206, "**": 207, SHIFT: 208, COMPARE: 209, "&": 210, "^": 211, "|": 212, "||": 213, "??": 214, "&&": 215, PIPE: 216, RELATION: 217, TERNARY: 218, COMPOUND_ASSIGN: 219 },
    tokenNames: { 2: "error", 6: "TERMINATOR", 11: "STATEMENT", 47: "JS", 49: "UNDEFINED", 50: "NULL", 51: "BOOL", 52: "INFINITY", 53: "NAN", 54: "NUMBER", 57: "IDENTIFIER", 59: "PROPERTY", 60: "STRING", 61: "STRING_START", 63: "STRING_END", 65: "INTERPOLATION_START", 66: "INTERPOLATION_END", 67: "INDENT", 68: "OUTDENT", 69: "REGEX", 70: "REGEX_START", 71: "REGEX_END", 73: ",", 74: "=", 75: "REACTIVE_ASSIGN", 76: "COMPUTED_ASSIGN", 78: "READONLY_ASSIGN", 79: "EFFECT", 84: ".", 85: "?.", 86: "INDEX_START", 87: "INDEX_END", 89: "ES6_OPTIONAL_INDEX", 90: "{", 92: ":", 93: "FOR", 95: "FOROF", 97: "}", 98: "WHEN", 99: "OWN", 104: "[", 105: "]", 106: "@", 107: "...", 109: "SUPER", 111: "DYNAMIC_IMPORT", 112: "MAP_START", 113: "MAP_END", 124: "..", 125: "DEF", 126: "CALL_START", 128: "CALL_END", 129: "PARAM_START", 130: "PARAM_END", 132: "->", 133: "=>", 137: "ES6_OPTIONAL_CALL", 140: "THIS", 141: "NEW_TARGET", 142: "IMPORT_META", 143: "(", 144: ")", 145: "RETURN", 146: "THROW", 147: "YIELD", 148: "FROM", 150: "IF", 151: "ELSE", 153: "UNLESS", 154: "POST_IF", 155: "POST_UNLESS", 156: "TRY", 158: "FINALLY", 159: "CATCH", 160: "SWITCH", 163: "LEADING_WHEN", 165: "WHILE", 166: "UNTIL", 168: "LOOP", 169: "FORIN", 170: "BY", 171: "FORAS", 172: "AWAIT", 173: "FORASAWAIT", 175: "CLASS", 176: "EXTENDS", 177: "ENUM", 178: "COMPONENT", 181: "OFFER", 182: "ACCEPT", 183: "RENDER", 184: "IMPORT", 189: "AS", 190: "DEFAULT", 191: "IMPORT_ALL", 192: "EXPORT", 194: "EXPORT_ALL", 196: "UNARY", 197: "DO", 198: "DO_IIFE", 199: "UNARY_MATH", 200: "-", 201: "+", 202: "?", 203: "PRESENCE", 204: "--", 205: "++", 206: "MATH", 207: "**", 208: "SHIFT", 209: "COMPARE", 210: "&", 211: "^", 212: "|", 213: "||", 214: "??", 215: "&&", 216: "PIPE", 217: "RELATION", 218: "TERNARY", 219: "COMPOUND_ASSIGN" },
    parseTable: (() => {
      let d = [109, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, -1, 1, 2, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 1, 1, 0, 2, 1, 5, -2, 109, 5, 1, 5, 60, 2, 76, -3, -3, -3, -3, -3, 30, 1, 5, 60, 1, 1, 5, 20, 12, 23, 16, 10, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -6, -6, -6, -6, -6, -6, 128, -6, -6, -6, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 9, 1, 5, 60, 1, 1, 5, 32, 23, 16, -7, -7, -7, -7, -7, -7, -7, -7, -7, 14, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 9, 1, 1, -8, -8, -8, -8, -8, -8, -8, -8, -8, 129, 130, 131, 98, 99, 55, 1, 5, 49, 5, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 3, 3, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -13, -13, 134, 107, 108, -13, -13, -13, -13, 137, 138, 139, -13, 140, -13, -13, -13, -13, -13, -13, -13, 135, -13, -13, 141, -13, -13, 136, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, 132, 133, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, -13, 46, 1, 5, 60, 1, 1, 5, 11, 1, 1, 1, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -14, -14, -14, -14, -14, -14, 142, 143, 144, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, -14, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, -15, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, -16, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, -17, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, -18, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, -19, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, -21, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, -22, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, -23, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, -26, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, -27, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, -28, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, -29, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, -30, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, -31, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, -32, 9, 1, 5, 60, 1, 1, 5, 32, 23, 16, -33, -33, -33, -33, -33, -33, -33, -33, -33, 9, 1, 5, 60, 1, 1, 5, 32, 23, 16, -34, -34, -34, -34, -34, -34, -34, -34, -34, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, -9, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, -10, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, -11, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -35, -35, -35, -35, -35, -35, -35, -35, 145, 146, 147, 148, 149, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, -37, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, -38, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, -40, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, -41, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, -42, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, -43, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, -44, 18, 6, 50, 1, 10, 1, 5, 8, 1, 1, 7, 14, 2, 1, 20, 1, 2, 4, 1, -197, 154, 106, -197, -197, -197, 156, 157, 155, 101, 159, 158, 153, 150, -197, -197, 151, 152, 108, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 7, 2, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 161, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 162, 104, 105, 160, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 105, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 163, 164, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 105, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 166, 167, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 168, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 174, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 175, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 176, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 177, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 47, 14, 1, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 7, 14, 2, 3, 2, 1, 17, 2, 1, 1, 7, 1, 1, 1, 55, 179, 180, 181, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 178, 73, 74, 95, 101, 84, 88, 85, 86, 91, 169, 170, 92, 93, 87, 89, 90, 83, 173, 47, 14, 1, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 7, 14, 2, 3, 2, 1, 17, 2, 1, 1, 7, 1, 1, 1, 55, 179, 180, 181, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 182, 73, 74, 95, 101, 84, 88, 85, 86, 91, 169, 170, 92, 93, 87, 89, 90, 83, 173, 61, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, 183, 184, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, 185, 105, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 7, 2, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 187, 186, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 162, 104, 105, 188, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, 189, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, -256, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, -258, 2, 67, 10, 162, 190, 2, 67, 10, 162, 191, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, -287, 14, 39, 17, 1, 24, 1, 1, 7, 4, 5, 5, 2, 29, 37, 2, 195, 154, 106, 156, 157, 155, 101, 192, 193, 84, 158, 197, 194, 196, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 198, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 199, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 92, 1, 5, 8, 1, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 4, 3, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 1, 1, 11, 4, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 22, 2, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -329, -329, 179, 180, 181, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, -329, 162, -329, 104, 105, -329, 200, 202, 73, 74, 95, -329, 101, -329, -329, -329, -329, -329, 84, -329, 88, -329, 85, 86, 91, -329, -329, -329, 169, -329, 170, 92, 93, 87, 89, 90, 83, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, 201, 173, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, -329, 2, 67, 109, 203, 204, 2, 67, 10, 162, 205, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 206, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 207, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 141, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 6, 1, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 1, 1, 11, 1, 3, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -248, -248, 208, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, -248, 209, -248, 104, 105, -248, 54, 53, 73, 74, 95, -248, 101, -248, -248, -248, -248, -248, 84, -248, 88, -248, 85, 86, 91, -248, -248, 67, -248, 169, -248, 170, 92, 93, 87, 89, 90, 83, -248, 70, 65, 66, 210, 55, 96, -248, 56, 97, -248, -248, 57, 61, 58, -248, -248, 59, 100, -248, -248, -248, 50, -248, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, -248, 2, 56, 1, 211, 106, 2, 56, 1, 212, 106, 6, 15, 19, 95, 2, 1, 1, 214, 213, 43, 44, 92, 93, 140, 1, 5, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 1, 1, 1, 3, 6, 1, 1, 1, 1, 4, 3, 2, 1, 2, 2, 1, 6, 1, 1, 1, 2, 2, 1, 1, 11, 1, 3, 1, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -245, -245, 215, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, -245, 216, -245, 104, 105, -245, 54, 53, 73, 74, 95, -245, 101, -245, -245, -245, -245, -245, 84, -245, 88, -245, 85, 86, 91, -245, -245, 67, -245, 169, -245, 170, 92, 93, 87, 89, 90, 83, -245, 70, 65, 66, 55, 96, -245, 56, 97, -245, -245, 57, 61, 58, -245, -245, 59, 100, -245, -245, -245, 50, -245, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, -245, 9, 55, 1, 1, 3, 1, 29, 95, 1, 5, 217, 221, 106, 107, 108, 220, 218, 219, 222, 62, 14, 1, 3, 1, 1, 1, 6, 1, 4, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 14, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 32, 2, 1, 12, 4, 4, 179, 180, 229, 230, 231, 232, 224, 225, 226, 227, 235, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 228, 106, 107, 108, 104, 105, 54, 236, 73, 74, 95, 223, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 62, 68, 63, 233, 234, 173, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, -88, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, -89, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, -45, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, -46, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, -48, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, -49, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, -50, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, -51, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, -52, 108, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 237, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 238, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 115, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 6, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 5, 1, 2, 1, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 239, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 245, 104, 105, 246, 54, 53, 73, 74, 95, 101, 60, 84, 240, 88, 250, 85, 86, 91, 241, 242, 244, 247, 243, 67, 43, 44, 92, 93, 249, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 4, 84, 2, 24, 16, 252, 253, 251, 141, 2, 110, 16, 254, 141, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, -229, 55, 1, 5, 52, 1, 1, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -230, -230, 255, 256, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, -230, 1, 84, 257, 1, 84, 258, 34, 6, 32, 8, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 1, 3, 8, 1, 1, 7, 14, 2, 1, 6, 1, 1, 1, 27, -145, 276, 267, 268, 271, 270, 269, 272, 273, 102, 103, 264, 106, 265, 256, 107, 108, -145, -145, 104, 105, -145, 274, 275, 266, 101, 159, 158, 263, 259, 260, 261, 262, 83, 55, 11, 36, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 2, 1, 9, 11, 3, 11, 2, 3, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, -195, 55, 11, 36, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 2, 1, 9, 11, 3, 11, 2, 3, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, -196, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, -91, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 277, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 278, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 279, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 280, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 7, 2, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 282, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 162, 104, 105, 281, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 23, 6, 40, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 5, 10, 8, 6, 3, 1, 1, 1, 1, 2, 1, -110, 288, 102, 103, 290, 106, 291, 256, 107, 108, -110, -110, -110, 292, 283, -110, 284, 289, 293, 285, 286, 287, 294, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, -53, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, -54, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, -65, 47, 14, 1, 21, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 10, 1, 1, 1, 7, 14, 2, 3, 2, 1, 17, 2, 1, 1, 7, 1, 1, 1, 55, 179, 180, 181, 34, 35, 36, 295, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 236, 73, 74, 95, 101, 84, 88, 85, 86, 91, 169, 170, 92, 93, 87, 89, 90, 83, 173, 64, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 4, 3, 3, 1, 10, 1, 3, 1, 1, 2, 3, 13, 11, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, -55, 56, 1, 5, 54, 1, 2, 2, 1, 1, 1, 3, 2, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, -57, 6, 55, 5, 1, 1, 2, 1, 299, 107, 108, 296, 297, 298, 111, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 2, 1, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, -5, 300, -5, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, -5, -5, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, -5, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 301, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 302, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 303, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 304, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 305, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 306, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 307, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 308, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 309, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 312, 165, 310, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 311, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 315, 165, 313, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 314, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 318, 165, 316, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 317, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 319, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 320, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 321, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 322, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 323, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, -286, 14, 39, 17, 1, 24, 1, 1, 7, 4, 5, 5, 2, 29, 37, 2, 327, 154, 106, 156, 157, 155, 101, 324, 325, 84, 158, 197, 326, 196, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 328, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 329, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, -285, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, -403, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, -404, 54, 1, 5, 54, 1, 5, 1, 1, 3, 2, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, -211, 54, 1, 5, 54, 1, 5, 1, 1, 3, 2, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, -212, 2, 110, 16, 330, 141, 2, 58, 1, 331, 256, 2, 58, 1, 332, 256, 108, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 2, 7, 1, 1, 1, 1, 5, 2, 3, 11, 2, 1, 2, 2, 1, 11, 1, 1, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 333, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 338, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 334, 104, 105, 336, 54, 53, 73, 74, 95, 335, 101, 60, 84, 88, 340, 85, 86, 91, 337, 339, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 1, 86, 341, 111, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 9, 4, 3, 1, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 346, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 345, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 250, 85, 86, 91, 344, 67, 342, 43, 44, 92, 93, 249, 343, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 2, 58, 1, 347, 256, 2, 58, 1, 348, 256, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 349, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 350, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 104, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 352, 351, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 353, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 104, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 355, 354, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 356, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 105, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 7, 2, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 358, 357, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 162, 104, 105, 359, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 104, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 361, 360, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 362, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 105, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 7, 2, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 364, 363, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 162, 104, 105, 365, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 10, 6, 61, 1, 5, 23, 1, 8, 8, 15, 2, -241, -241, -241, 367, 368, -241, -241, -241, -241, 366, 6, 6, 61, 1, 5, 55, 2, -198, -198, -198, -198, -198, -198, 7, 6, 61, 1, 5, 1, 54, 2, -202, -202, -202, -202, 369, -202, -202, 15, 6, 50, 1, 10, 1, 5, 8, 1, 1, 7, 14, 2, 22, 2, 5, -205, 154, 106, -205, -205, -205, 156, 157, 155, 101, 159, 158, -205, -205, 370, 11, 6, 61, 1, 5, 1, 21, 33, 2, 39, 2, 2, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, -206, 11, 6, 61, 1, 5, 1, 21, 33, 2, 39, 2, 2, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, -207, 11, 6, 61, 1, 5, 1, 21, 33, 2, 39, 2, 2, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, -208, 11, 6, 61, 1, 5, 1, 21, 33, 2, 39, 2, 2, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, -209, 2, 58, 1, 255, 256, 115, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 6, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 5, 1, 2, 1, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 346, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 245, 104, 105, 246, 54, 53, 73, 74, 95, 101, 60, 84, 240, 88, 250, 85, 86, 91, 241, 242, 244, 247, 243, 67, 43, 44, 92, 93, 249, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, -192, 9, 1, 5, 60, 1, 1, 5, 32, 23, 16, -194, -194, -194, -194, -194, -194, -194, -194, -194, 108, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 372, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 371, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, 127, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, -398, 120, -398, -398, -398, -398, 9, 1, 5, 60, 1, 1, 5, 32, 23, 16, -395, -395, -395, -395, -395, -395, -395, -395, -395, 5, 154, 1, 9, 1, 1, 129, 130, 131, 98, 99, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, 127, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, -399, 120, -399, -399, -399, -399, 9, 1, 5, 60, 1, 1, 5, 32, 23, 16, -396, -396, -396, -396, -396, -396, -396, -396, -396, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, -400, 127, -400, -400, -400, -400, -400, -400, -400, -400, -400, 113, -400, -400, -400, -400, -400, -400, 120, -400, -400, -400, -400, 18, 6, 50, 1, 10, 1, 5, 8, 1, 1, 7, 14, 2, 1, 20, 1, 2, 4, 1, -197, 154, 106, -197, -197, -197, 156, 157, 155, 101, 159, 158, 153, 373, -197, -197, 151, 152, 2, 67, 10, 162, 160, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 163, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 166, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 5, 15, 114, 2, 1, 1, 214, 169, 170, 92, 93, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, -401, 127, -401, -401, -401, -401, -401, -401, -401, -401, -401, 113, -401, -401, -401, -401, -401, -401, 120, -401, -401, -401, -401, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, -402, 127, -402, -402, -402, -402, -402, -402, -402, -402, -402, 113, -402, -402, -402, -402, -402, -402, 120, -402, -402, -402, -402, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, 127, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, -405, 120, -405, -405, -405, -405, 2, 82, 8, 374, 101, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -407, -407, -87, -87, -407, -407, -407, -407, -87, -87, -87, -87, -87, -87, -87, -87, -407, -87, -407, -407, -407, -407, -407, -407, -407, -407, -407, -87, -407, -407, -87, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -87, -87, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, -407, 10, 55, 5, 1, 23, 1, 1, 3, 21, 16, 11, 134, 107, 108, 137, 138, 139, 140, 135, 141, 136, 3, 84, 1, 1, 142, 143, 144, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -408, -408, -87, -87, -408, -408, -408, -408, -87, -87, -87, -87, -87, -87, -87, -87, -408, -87, -408, -408, -408, -408, -408, -408, -408, -408, -408, -87, -408, -408, -87, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -87, -87, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, -408, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, -409, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, -410, 104, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 377, 375, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 376, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -84, -84, -84, -84, -84, -84, -84, -84, 128, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, -84, 125, 126, 127, 98, 99, -84, -84, -84, -84, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 378, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, -86, 3, 67, 10, 73, 162, 379, 380, 46, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 2, 1, 1, 6, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, 381, 382, 383, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, -265, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, -284, 4, 95, 74, 2, 2, 385, 384, 386, 387, 11, 56, 1, 24, 1, 1, 7, 4, 10, 2, 29, 39, 154, 106, 156, 157, 155, 101, 388, 159, 158, 197, 196, 11, 56, 1, 24, 1, 1, 7, 4, 10, 2, 29, 39, 154, 106, 156, 157, 155, 101, 389, 159, 158, 197, 196, 3, 67, 10, 93, 162, 390, 391, 5, 73, 22, 74, 2, 2, 392, -327, -327, -327, -327, 6, 73, 1, 21, 74, 2, 2, -325, 393, -325, -325, -325, -325, 22, 67, 26, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 394, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 3, 161, 1, 1, 395, 396, 397, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, -330, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 398, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 60, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -333, -333, -87, -87, -333, 162, -333, -333, -87, -87, -87, 399, -87, -87, -87, -87, -87, -333, -87, -333, -333, -333, -333, -333, -333, -333, -333, -333, -87, -333, -333, -87, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, 400, -333, -333, -87, -87, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, -333, 109, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 403, 404, 405, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 401, 402, 406, 407, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 408, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, -348, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, -246, 127, -246, -246, -246, -246, -246, -246, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 2, 82, 8, 409, 101, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, -249, 127, -249, -249, -249, -249, -249, -249, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 2, 82, 8, 410, 101, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 411, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 3, 67, 10, 49, 162, 413, 412, 2, 67, 10, 162, 414, 9, 1, 5, 60, 1, 1, 5, 32, 23, 16, -397, -397, -397, -397, -397, -397, -397, -397, -397, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, -435, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, -243, 127, -243, -243, -243, -243, -243, -243, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 2, 82, 8, 415, 101, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, -349, 2, 73, 75, 417, 416, 1, 148, 418, 7, 56, 1, 10, 30, 90, 1, 2, 423, 106, 422, 419, 420, 421, 424, 2, 73, 75, -365, -365, 1, 189, 425, 26, 6, 40, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 5, 10, 8, 6, 3, 1, 1, 1, 1, 2, 1, 83, 3, 2, -110, 288, 102, 103, 430, 106, 291, 256, 107, 108, 429, -110, -110, 292, 283, 426, 284, 289, 293, 285, 286, 287, 294, 431, 427, 428, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, -369, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, -370, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, -371, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, -372, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -90, -90, -90, -90, -90, -90, -90, -90, 432, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, -90, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, -376, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, -377, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, -378, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, -379, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 433, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 434, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 1, 148, 435, 57, 1, 5, 54, 1, 5, 1, 1, 5, 2, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -35, -35, -35, -35, -35, -35, -35, -35, 146, 147, 148, 149, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, -35, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, -87, 2, 6, 138, 109, 436, 107, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 437, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 30, 6, 61, 1, 5, 20, 12, 2, 16, 1, 4, 26, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -223, -223, -223, -223, 128, -223, 340, 438, 339, -223, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, -166, 111, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 6, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 9, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 346, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 246, 54, 53, 73, 74, 95, 101, 60, 84, 439, 88, 250, 85, 86, 91, 441, 440, 67, 43, 44, 92, 93, 249, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 10, 6, 61, 1, 5, 23, 1, 8, 8, 6, 9, -241, -241, -241, 443, 444, -241, -241, -241, 442, -241, 60, 6, 5, 36, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 6, 11, 3, 11, 1, 1, 1, 2, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 445, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, -178, 5, 6, 61, 1, 5, 32, -169, -169, -169, -169, -169, 114, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 6, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 5, 1, 2, 1, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 346, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 245, 104, 105, 246, 54, 53, 73, 74, 95, 101, 60, 84, 88, 250, 85, 86, 91, 447, 446, 244, 247, 243, 67, 43, 44, 92, 93, 249, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 60, 6, 5, 36, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 6, 11, 3, 11, 1, 1, 1, 2, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, -180, 5, 6, 61, 1, 5, 32, -174, -174, -174, -174, -174, 6, 6, 61, 1, 5, 32, 23, -224, -224, -224, -224, -224, -224, 6, 6, 61, 1, 5, 32, 23, -225, -225, -225, -225, -225, -225, 108, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 6, 1, 1, 1, 1, 7, 3, 11, 1, 1, 3, 2, 1, 13, 3, 1, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, -226, 448, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, -226, -226, 104, 105, -226, 54, 53, 73, 74, 95, 101, 60, 84, -226, 88, 85, 86, 91, 67, -226, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 54, 1, 5, 54, 1, 5, 1, 1, 3, 2, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, -214, 2, 58, 1, 449, 256, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 450, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 451, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 54, 1, 5, 54, 1, 5, 1, 1, 3, 2, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, -215, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, -231, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, -56, 2, 58, 1, 452, 256, 2, 58, 1, 453, 256, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, -143, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 455, 454, -241, -241, -241, -241, 5, 6, 61, 1, 5, 40, -146, -146, -146, -146, -146, 1, 92, 456, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 457, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 1, 92, -153, 1, 92, -154, 1, 92, -155, 1, 92, -156, 1, 92, -157, 1, 92, -158, 1, 92, -159, 1, 92, -160, 1, 92, -161, 1, 92, -162, 1, 92, -163, 1, 92, -164, 1, 92, -165, 23, 67, 10, 16, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 458, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 23, 67, 10, 16, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 459, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -280, -280, -280, -280, -280, -280, -280, -280, 128, -280, -280, 460, -280, -280, -280, -280, -280, -280, -280, -280, -280, -280, 127, 98, 99, -280, -280, -280, -280, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -282, -282, -282, -282, -282, -282, -282, -282, 128, -282, -282, 461, -282, -282, -282, -282, -282, -282, -282, -282, -282, -282, 127, 98, 99, -282, -282, -282, -282, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, -288, 45, 1, 5, 60, 1, 1, 5, 4, 10, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -289, -289, -289, 162, -289, -289, 462, -289, -289, 128, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, -289, 127, 98, 99, -289, -289, -289, -289, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 6, 6, 61, 1, 5, 19, 5, -115, -115, -115, -115, 463, -115, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 465, 464, -241, -241, -241, -241, 7, 6, 61, 1, 5, 1, 18, 5, -124, -124, -124, -124, 466, -124, -124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 467, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 3, 58, 1, 45, 255, 256, 468, 6, 6, 61, 1, 5, 19, 5, -127, -127, -127, -127, -127, -127, 5, 6, 61, 1, 5, 24, -111, -111, -111, -111, -111, 11, 6, 61, 1, 5, 1, 10, 1, 1, 6, 5, 29, -121, -121, -121, -121, -121, -121, -121, -121, -121, -121, -121, 11, 6, 61, 1, 5, 1, 10, 1, 1, 6, 5, 29, -122, -122, -122, -122, -122, -122, -122, -122, -122, -122, -122, 11, 6, 61, 1, 5, 1, 10, 1, 1, 6, 5, 29, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, -123, 5, 6, 61, 1, 5, 24, -116, -116, -116, -116, -116, 17, 38, 4, 1, 13, 1, 1, 1, 23, 1, 7, 13, 3, 2, 1, 2, 29, 3, 472, 474, 473, 290, 106, 291, 256, 471, 292, 101, 469, 88, 470, 475, 476, 87, 83, 54, 1, 5, 54, 1, 5, 1, 1, 3, 2, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -39, -39, -39, -39, -39, -39, -39, 477, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, -39, 6, 55, 5, 1, 2, 1, 1, 299, 107, 108, 478, 479, 298, 4, 60, 1, 2, 2, -59, -59, -59, -59, 109, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 5, 1, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 480, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 482, 481, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 4, 60, 1, 2, 2, -64, -64, -64, -64, 5, 1, 5, 60, 2, 76, -4, -4, -4, -4, -4, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, -411, 127, -411, -411, -411, -411, -411, -411, -411, -411, 112, 113, -411, -411, -411, -411, -411, -411, 120, -411, -411, -411, -411, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, -412, 127, -412, -412, -412, -412, -412, -412, -412, -412, 112, 113, -412, -412, -412, -412, -412, -412, 120, -412, -412, -412, -412, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, -413, 127, -413, -413, -413, -413, -413, -413, -413, -413, -413, 113, -413, -413, -413, -413, -413, -413, 120, -413, -413, -413, -413, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, -414, 127, -414, -414, -414, -414, -414, -414, -414, -414, -414, 113, -414, -414, -414, -414, -414, -414, 120, -414, -414, -414, -414, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, -415, 127, -415, -415, -415, -415, -415, -415, 111, 110, 112, 113, -415, -415, -415, -415, -415, -415, 120, -415, -415, -415, -415, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, -416, 127, -416, -416, -416, -416, -416, -416, 111, 110, 112, 113, 114, -416, -416, -416, -416, -416, 120, -416, -416, 123, -416, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, -417, 127, -417, -417, -417, -417, -417, -417, 111, 110, 112, 113, 114, 115, -417, -417, -417, -417, 120, -417, -417, 123, -417, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, -418, 127, -418, -418, -418, -418, -418, -418, 111, 110, 112, 113, 114, 115, 116, -418, -418, -418, 120, -418, -418, 123, -418, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, -419, 127, -419, -419, -419, -419, -419, -419, 111, 110, 112, 113, 114, 115, 116, 117, -419, -419, 120, -419, -419, 123, -419, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, -420, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, -421, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, -427, 127, -427, -427, -427, -427, -427, -427, 111, 110, 112, 113, 114, 115, 116, 117, 118, -427, 120, 121, -427, 123, -427, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, -422, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, -423, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -428, -428, -428, -428, -428, -428, -428, -428, 128, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, -428, 125, 126, 127, 98, 99, -428, -428, -428, -428, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, -424, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, -425, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, -426, 127, -426, -426, -426, -426, -426, -426, 111, 110, 112, 113, 114, 115, 116, 117, 118, -426, 120, -426, -426, 123, -426, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, -429, 127, -429, -429, -429, -429, -429, -429, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, -429, 123, -429, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, -430, 127, -430, -430, -430, -430, -430, -430, 111, 110, 112, 113, 114, -430, -430, -430, -430, -430, 120, -430, -430, -430, -430, 22, 92, 1, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 483, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -260, -260, -260, -260, -260, -260, -260, -260, 128, -260, -260, -260, -260, -260, -260, -260, -260, -260, -260, 484, -260, -260, 127, 98, 99, -260, -260, -260, -260, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -264, -264, -264, -264, -264, -264, -264, -264, 128, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, -264, 127, 98, 99, -264, -264, -264, -264, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 4, 95, 74, 2, 2, 486, 485, 487, 488, 11, 56, 1, 24, 1, 1, 7, 4, 10, 2, 29, 39, 154, 106, 156, 157, 155, 101, 489, 159, 158, 197, 196, 11, 56, 1, 24, 1, 1, 7, 4, 10, 2, 29, 39, 154, 106, 156, 157, 155, 101, 490, 159, 158, 197, 196, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, 491, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, -323, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -259, -259, -259, -259, -259, -259, -259, -259, 128, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, -259, 127, 98, 99, -259, -259, -259, -259, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -263, -263, -263, -263, -263, -263, -263, -263, 128, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, -263, 127, 98, 99, -263, -263, -263, -263, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 54, 1, 5, 54, 1, 5, 1, 1, 3, 2, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, -213, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, -92, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, -93, 25, 87, 6, 14, 16, 1, 30, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 492, 128, 340, 493, 339, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 106, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 5, 2, 3, 11, 2, 1, 2, 2, 1, 11, 1, 1, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 494, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 495, 101, 60, 84, 88, 340, 85, 86, 91, 337, 339, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 1, 87, 496, 1, 87, 497, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 9, 1, 1, 1, 1, 4, 3, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 498, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, -188, 104, 105, 54, 53, 73, 74, 95, -188, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -47, -47, -47, -47, -47, -47, -47, 499, -47, -47, -47, -68, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, -47, 56, 11, 36, 2, 1, 1, 1, 1, 1, 3, 3, 1, 7, 1, 1, 9, 8, 3, 3, 11, 2, 3, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, -182, 56, 11, 36, 2, 1, 1, 1, 1, 1, 3, 3, 1, 7, 1, 1, 9, 8, 3, 3, 11, 2, 3, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, -183, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 500, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 501, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 54, 1, 5, 54, 1, 5, 1, 1, 3, 2, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, -216, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 503, 502, -241, -241, -241, -241, 5, 6, 61, 1, 5, 55, -218, -218, -218, -218, -218, 110, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 9, 4, 4, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 346, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 345, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 250, 85, 86, 91, 344, 67, 43, 44, 92, 93, 249, 504, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 27, 6, 61, 1, 5, 20, 12, 23, 26, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -223, -223, -223, -223, 128, -223, -223, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, -101, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, -102, 22, 87, 6, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 505, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 506, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, -69, 127, -69, -69, -69, -69, -69, -69, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 507, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 508, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -72, -72, -72, -72, -72, -72, -72, -72, 128, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, -72, 125, 126, 127, 98, 99, -72, -72, -72, -72, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 509, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 510, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -75, -75, -75, -75, -75, -75, -75, -75, 128, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, -75, 125, 126, 127, 98, 99, -75, -75, -75, -75, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 511, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, -77, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -78, -78, -78, -78, -78, -78, -78, -78, 128, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, -78, 125, 126, 127, 98, 99, -78, -78, -78, -78, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 512, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 513, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -81, -81, -81, -81, -81, -81, -81, -81, 128, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, -81, 125, 126, 127, 98, 99, -81, -81, -81, -81, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 514, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, -83, 3, 131, 1, 1, 515, 92, 93, 18, 6, 50, 1, 10, 1, 13, 1, 1, 7, 7, 7, 1, 1, 1, 6, 15, 6, 1, -242, 154, 106, -242, -242, 156, 157, 155, 101, -242, 159, -242, 158, 153, -242, -242, 516, 152, 2, 6, 61, 517, 518, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 519, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 6, 6, 61, 1, 5, 55, 2, -204, -204, -204, -204, -204, -204, 56, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 3, 1, 4, 2, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, -237, 2, 6, 62, 109, 520, 10, 6, 61, 1, 5, 23, 1, 8, 8, 15, 2, -241, -241, -241, 367, 368, -241, -241, -241, -241, 521, 1, 68, 522, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, -432, 127, -432, -432, -432, -432, -432, -432, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 523, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 524, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -85, -85, -85, -85, -85, -85, -85, -85, 128, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, -85, 125, 126, 127, 98, 99, -85, -85, -85, -85, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, -257, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 525, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 3, 7, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, 526, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, -266, 2, 67, 10, 162, 527, 6, 56, 1, 10, 10, 5, 8, 528, 106, 162, 530, 529, 101, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 531, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 532, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 533, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 534, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 1, 95, 535, 1, 171, 536, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, -306, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 537, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 10, 56, 1, 24, 1, 1, 7, 14, 2, 29, 39, 154, 106, 156, 157, 155, 101, 159, 158, 197, 538, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 539, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 3, 161, 1, 1, 540, 396, 397, 4, 68, 83, 11, 1, 541, 542, 543, 397, 3, 68, 83, 12, -276, -276, -276, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 6, 1, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 545, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 544, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 45, 1, 5, 60, 1, 1, 5, 4, 10, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -331, -331, -331, 162, -331, -331, 546, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, -331, 127, -331, -331, -331, -331, -331, -331, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, -334, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 547, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 2, 6, 62, 549, 548, 2, 6, 62, -340, -340, 23, 6, 62, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -343, -343, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 2, 6, 62, -344, -344, 7, 6, 62, 86, 1, 9, 1, 1, -345, -345, 129, 130, 131, 98, 99, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 550, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 1, 57, 551, 22, 67, 26, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 552, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 1, 68, 553, 1, 68, 554, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, -251, 127, -251, -251, -251, -251, -251, -251, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 18, 6, 50, 1, 10, 1, 5, 8, 1, 1, 7, 14, 2, 1, 20, 1, 2, 4, 1, -197, 154, 106, -197, -197, -197, 156, 157, 155, 101, 159, 158, 153, 555, -197, -197, 151, 152, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, -190, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, -337, 1, 68, 556, 3, 55, 5, 1, 557, 107, 108, 3, 90, 96, 5, 559, 558, 222, 3, 55, 5, 1, 560, 107, 108, 1, 148, 561, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 563, 562, -241, -241, -241, -241, 5, 6, 61, 1, 5, 24, -356, -356, -356, -356, -356, 6, 56, 1, 10, 120, 1, 2, 423, 106, 422, 564, 421, 424, 6, 6, 61, 1, 5, 24, 92, -361, -361, -361, -361, -361, 565, 6, 6, 61, 1, 5, 24, 92, -363, -363, -363, -363, -363, 566, 2, 56, 1, 567, 106, 14, 1, 5, 60, 1, 1, 5, 32, 23, 16, 4, 6, 1, 10, 1, -367, -367, -367, -367, -367, -367, -367, -367, -367, 568, -367, -367, -367, -367, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 570, 569, -241, -241, -241, -241, 5, 6, 61, 1, 5, 24, -385, -385, -385, -385, -385, 6, 56, 1, 10, 123, 3, 2, 572, 106, 429, 431, 571, 428, 12, 6, 61, 1, 5, 1, 10, 1, 1, 6, 5, 29, 63, -390, -390, -390, -390, -121, -121, -121, -121, -121, -390, -121, 573, 6, 6, 61, 1, 5, 24, 92, -393, -393, -393, -393, -393, 574, 104, 6, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 576, 575, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 577, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 30, 1, 5, 60, 1, 1, 5, 20, 12, 23, 16, 10, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -380, -380, -380, -380, -380, -380, 128, -380, -380, -380, -380, -380, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 2, 82, 8, 578, 101, 3, 55, 5, 1, 579, 107, 108, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, -239, 2, 6, 62, 109, 580, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 581, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, -167, 60, 6, 5, 36, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 6, 11, 3, 11, 1, 1, 1, 2, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 445, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, -179, 5, 6, 61, 1, 5, 32, -175, -175, -175, -175, -175, 2, 67, 38, 583, 582, 119, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 6, 1, 1, 1, 1, 7, 3, 4, 7, 1, 1, 1, 2, 2, 1, 1, 4, 3, 1, 1, 3, 3, 1, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, -242, 346, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, -242, -242, 104, 105, 246, 54, 53, 73, 74, 95, 101, 60, -242, 84, -242, 88, 250, 85, 86, 91, -242, 585, 584, 247, 243, 67, -242, 43, 44, 92, 93, 249, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 4, 6, 61, 1, 37, 586, -176, -176, -176, 60, 6, 5, 36, 2, 1, 1, 1, 1, 1, 3, 3, 1, 6, 1, 1, 1, 3, 6, 11, 3, 11, 1, 1, 1, 2, 2, 1, 13, 4, 3, 1, 7, 1, 1, 1, 2, 1, 1, 3, 3, 3, 4, 5, 1, 2, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, -181, 10, 6, 61, 1, 5, 23, 1, 8, 8, 6, 9, -241, -241, -241, 443, 444, -241, -241, -241, 587, -241, 110, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 6, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 9, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 346, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 246, 54, 53, 73, 74, 95, 101, 60, 84, 88, 250, 85, 86, 91, 441, 440, 67, 43, 44, 92, 93, 249, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 27, 6, 61, 1, 5, 20, 12, 23, 26, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -210, -210, -210, -210, 128, -210, -210, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, -232, 22, 87, 6, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 588, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 589, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, -235, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, -236, 3, 6, 61, 46, 591, 592, 590, 35, 6, 32, 8, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 1, 11, 1, 1, 7, 7, 7, 1, 1, 1, 6, 2, 1, 12, 15, -242, 276, 267, 268, 271, 270, 269, 272, 273, 102, 103, 264, 106, 265, 256, 107, 108, -242, -242, 104, 105, 274, 275, 266, 101, -242, 159, -242, 158, 263, -242, 593, 262, -242, 83, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 594, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 595, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 26, 6, 61, 1, 5, 20, 20, 41, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -152, -152, -152, -152, 128, -152, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, -252, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, 596, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, -254, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 597, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 598, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, -290, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 599, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 600, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 3, 6, 61, 30, 602, 603, 601, 24, 6, 40, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 15, 8, 6, 4, 1, 1, 1, 1, 1, 1, 6, 15, -242, 288, 102, 103, 290, 106, 291, 256, 107, 108, -242, -242, 292, 605, -242, 604, 293, 285, 286, -242, 287, 294, -242, -242, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 606, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 607, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 22, 93, 12, 49, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 128, 608, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 609, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 10, 6, 61, 1, 5, 11, 1, 1, 11, 13, 16, -128, -128, -128, -128, -130, -130, -130, -128, 610, 141, 10, 6, 61, 1, 5, 11, 1, 1, 11, 13, 16, -129, -129, -129, -129, 612, 613, 614, -129, 611, 141, 9, 6, 61, 1, 5, 11, 1, 1, 11, 29, -131, -131, -131, -131, -131, -131, -131, -131, -131, 9, 6, 61, 1, 5, 11, 1, 1, 11, 29, -132, -132, -132, -132, -132, -132, -132, -132, -132, 9, 6, 61, 1, 5, 11, 1, 1, 11, 29, -133, -133, -133, -133, -133, -133, -133, -133, -133, 9, 6, 61, 1, 5, 11, 1, 1, 11, 29, -134, -134, -134, -134, -134, -134, -134, -134, -134, 4, 84, 2, 24, 16, 252, 253, 615, 141, 2, 110, 16, 616, 141, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, -66, 56, 1, 5, 54, 1, 2, 2, 1, 1, 1, 3, 2, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, -58, 4, 60, 1, 2, 2, -60, -60, -60, -60, 2, 6, 60, 109, 617, 107, 4, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 618, 3, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 4, 60, 1, 2, 2, -63, -63, -63, -63, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 619, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 621, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 620, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 622, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 623, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 624, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 625, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 1, 95, 626, 1, 171, 627, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 628, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, -94, 104, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 9, 1, 1, 1, 1, 4, 3, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 629, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, -186, 104, 105, 54, 53, 73, 74, 95, -186, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 25, 68, 25, 14, 16, 1, 30, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 630, 128, 340, 493, 339, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 1, 68, 631, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, -96, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, -98, 23, 68, 19, 6, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -187, -187, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 632, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 22, 87, 6, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 633, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 634, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 3, 6, 61, 61, 636, 637, 635, 115, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 9, 1, 1, 1, 1, 7, 3, 4, 7, 1, 1, 1, 2, 2, 1, 1, 8, 4, 3, 1, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, -242, 346, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, -242, -242, 104, 105, 54, 53, 73, 74, 95, 101, 60, -242, 84, -242, 88, 250, 85, 86, 91, -242, 638, 67, -242, 43, 44, 92, 93, 249, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 503, 639, -241, -241, -241, -241, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, -103, 22, 68, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 640, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, -70, 127, -70, -70, -70, -70, -70, -70, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 22, 68, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 641, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -73, -73, -73, -73, -73, -73, -73, -73, 128, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, -73, 125, 126, 127, 98, 99, -73, -73, -73, -73, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 22, 68, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 642, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -76, -76, -76, -76, -76, -76, -76, -76, 128, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, -76, 125, 126, 127, 98, 99, -76, -76, -76, -76, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -79, -79, -79, -79, -79, -79, -79, -79, 128, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, -79, 125, 126, 127, 98, 99, -79, -79, -79, -79, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 22, 68, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 643, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -82, -82, -82, -82, -82, -82, -82, -82, 128, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, -82, 125, 126, 127, 98, 99, -82, -82, -82, -82, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 108, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 7, 2, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 645, 4, 5, 6, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 162, 104, 105, 644, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 6, 6, 61, 1, 5, 55, 2, -199, -199, -199, -199, -199, -199, 11, 56, 1, 24, 1, 1, 7, 14, 2, 1, 27, 1, 154, 106, 156, 157, 155, 101, 159, 158, 153, 646, 152, 18, 6, 50, 1, 10, 1, 5, 8, 1, 1, 7, 14, 2, 1, 20, 1, 2, 4, 1, -197, 154, 106, -197, -197, -197, 156, 157, 155, 101, 159, 158, 153, 647, -197, -197, 151, 152, 27, 6, 61, 1, 5, 20, 35, 2, 24, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -203, -203, -203, -203, 128, -203, -203, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 56, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 3, 1, 4, 2, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, -238, 3, 131, 1, 1, 648, 92, 93, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, -406, 22, 68, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 649, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, -434, 127, -434, -434, -434, -434, -434, -434, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 23, 67, 10, 16, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 650, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 2, 67, 10, 162, 651, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, -267, 2, 67, 10, 162, 652, 2, 67, 10, 162, 653, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 3, 7, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, -271, 25, 67, 10, 16, 5, 56, 1, 9, 1, 1, 4, 30, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 654, 128, 655, 125, 126, 127, 98, 99, 656, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 24, 67, 10, 16, 5, 56, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 657, 128, 658, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 24, 67, 10, 16, 5, 56, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 659, 128, 660, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 24, 67, 10, 16, 5, 56, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 661, 128, 662, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 663, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 664, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 23, 67, 10, 16, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 665, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 4, 95, 74, 2, 2, -328, -328, -328, -328, 26, 73, 20, 2, 59, 1, 9, 1, 1, 3, 2, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -326, 128, -326, 125, 126, 127, 98, 99, -326, -326, -326, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 4, 68, 83, 11, 1, 666, 667, 543, 397, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, -274, 2, 67, 10, 162, 668, 3, 68, 83, 12, -277, -277, -277, 3, 67, 6, 4, 162, 670, 669, 23, 67, 6, 20, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -227, -227, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, -332, 45, 1, 5, 60, 1, 1, 5, 4, 10, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -335, -335, -335, 162, -335, -335, 671, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, -335, 127, -335, -335, -335, -335, -335, -335, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, -338, 110, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 7, 1, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 2, 1, 1, 1, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, -342, 403, 404, 405, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, -342, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 672, 406, 407, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 23, 6, 62, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -346, -346, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 2, 6, 62, -347, -347, 109, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 403, 404, 405, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 43, 44, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 673, 402, 406, 407, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, -247, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, -250, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 367, 368, -241, -241, -241, 674, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, -244, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, -350, 1, 148, 675, 6, 56, 1, 10, 120, 1, 2, 423, 106, 422, 676, 421, 424, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, -351, 3, 55, 5, 1, 677, 107, 108, 3, 6, 61, 30, 679, 680, 678, 11, 6, 50, 1, 10, 1, 29, 8, 8, 15, 60, 2, -242, 423, 106, -242, -242, -242, -242, -242, -242, 681, 424, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 563, 682, -241, -241, -241, -241, 2, 56, 1, 683, 106, 2, 56, 1, 684, 106, 1, 148, -366, 3, 55, 5, 1, 685, 107, 108, 3, 6, 61, 30, 687, 688, 686, 11, 6, 50, 1, 10, 1, 29, 8, 8, 15, 62, 5, -242, 572, 106, -242, -242, -242, -242, -242, -242, 431, 689, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 570, 690, -241, -241, -241, -241, 6, 6, 61, 1, 5, 24, 92, -390, -390, -390, -390, -390, 573, 3, 56, 1, 133, 691, 106, 692, 2, 56, 1, 693, 106, 30, 1, 5, 60, 1, 1, 5, 20, 12, 23, 16, 10, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -373, -373, -373, -373, -373, -373, 128, -373, -373, -373, -373, -373, 127, -373, -373, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 694, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 695, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 1, 68, 696, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, -382, 1, 144, 697, 22, 93, 12, 49, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 128, 698, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, -168, 114, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 3, 6, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 5, 1, 2, 1, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 346, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 245, 104, 105, 246, 54, 53, 73, 74, 95, 101, 60, 84, 88, 250, 85, 86, 91, 447, 699, 244, 247, 243, 67, 43, 44, 92, 93, 249, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 5, 6, 61, 1, 5, 32, -170, -170, -170, -170, -170, 113, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 1, 1, 1, 3, 6, 1, 1, 1, 1, 7, 3, 11, 1, 1, 1, 2, 2, 1, 9, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 346, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, -177, -177, 104, 105, 246, 54, 53, 73, 74, 95, 101, 60, 84, -177, 88, 250, 85, 86, 91, 441, 440, 67, 43, 44, 92, 93, 249, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 112, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 3, 6, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 5, 3, 1, 1, 3, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 346, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 246, 54, 53, 73, 74, 95, 101, 60, 84, 88, 250, 85, 86, 91, 447, 700, 247, 243, 67, 43, 44, 92, 93, 249, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 2, 67, 1, 583, 701, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, -233, 22, 68, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 702, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, -144, 28, 38, 8, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 1, 11, 1, 1, 7, 14, 2, 1, 8, 1, 27, 276, 267, 268, 271, 270, 269, 272, 273, 102, 103, 264, 106, 265, 256, 107, 108, 104, 105, 274, 275, 266, 101, 159, 158, 263, 703, 262, 83, 34, 6, 32, 8, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 1, 3, 8, 1, 1, 7, 14, 2, 1, 6, 1, 1, 1, 27, -145, 276, 267, 268, 271, 270, 269, 272, 273, 102, 103, 264, 106, 265, 256, 107, 108, -145, -145, 104, 105, -145, 274, 275, 266, 101, 159, 158, 263, -145, 704, 261, 262, 83, 5, 6, 61, 1, 5, 40, -147, -147, -147, -147, -147, 26, 6, 61, 1, 5, 20, 20, 41, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -150, -150, -150, -150, 128, -150, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 705, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 2, 67, 10, 162, 706, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, -281, 127, -281, -281, -281, -281, -281, -281, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, -283, 127, -283, -283, -283, -283, -283, -283, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 26, 6, 61, 1, 5, 20, 4, 57, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -117, -117, -117, -117, 707, -117, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 708, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, -109, 17, 46, 8, 1, 1, 1, 1, 1, 1, 1, 22, 8, 10, 1, 1, 1, 2, 1, 288, 102, 103, 290, 106, 291, 256, 107, 108, 292, 605, 709, 293, 285, 286, 287, 294, 23, 6, 40, 8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 5, 10, 8, 6, 3, 1, 1, 1, 1, 2, 1, -110, 288, 102, 103, 290, 106, 291, 256, 107, 108, -110, -110, -110, 292, 605, -110, 710, 289, 293, 285, 286, 287, 294, 5, 6, 61, 1, 5, 24, -112, -112, -112, -112, -112, 6, 6, 61, 1, 5, 19, 5, -115, -115, -115, -115, 711, -115, 26, 6, 61, 1, 5, 20, 4, 57, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -119, -119, -119, -119, 128, -119, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 712, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 6, 6, 61, 1, 5, 19, 5, -125, -125, -125, -125, -125, -125, 22, 93, 12, 49, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 128, 713, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 9, 6, 61, 1, 5, 11, 1, 1, 11, 29, -137, -137, -137, -137, -137, -137, -137, -137, -137, 9, 6, 61, 1, 5, 11, 1, 1, 11, 29, -138, -138, -138, -138, -138, -138, -138, -138, -138, 2, 58, 1, 714, 256, 2, 58, 1, 715, 256, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 716, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 717, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 9, 6, 61, 1, 5, 11, 1, 1, 11, 29, -135, -135, -135, -135, -135, -135, -135, -135, -135, 9, 6, 61, 1, 5, 11, 1, 1, 11, 29, -136, -136, -136, -136, -136, -136, -136, -136, -136, 4, 60, 1, 2, 2, -61, -61, -61, -61, 2, 6, 62, 109, 718, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, -431, 127, -431, -431, -431, -431, -431, -431, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 719, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -262, -262, -262, -262, -262, -262, -262, -262, 128, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, -262, 127, 98, 99, -262, -262, -262, -262, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, 720, -308, -308, -308, -308, -308, -308, -308, -308, -308, -308, 127, -308, -308, -308, 721, -308, -308, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, 722, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, 127, -313, -313, -313, -313, -313, -313, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, 723, -317, -317, -317, -317, -317, -317, -317, -317, -317, -317, 127, -317, -317, -317, -317, -317, -317, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, 724, -321, -321, -321, -321, -321, -321, -321, -321, -321, -321, 127, -321, -321, -321, -321, -321, -321, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 725, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 726, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, -324, 127, -324, -324, -324, -324, -324, -324, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 23, 68, 19, 6, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -185, -185, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 1, 87, 727, 1, 87, 728, 22, 87, 6, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -67, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, -99, 22, 68, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 729, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 54, 1, 5, 54, 1, 5, 1, 1, 3, 2, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, -217, 108, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 9, 4, 4, 2, 1, 1, 3, 4, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 346, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 250, 85, 86, 91, 730, 67, 43, 44, 92, 93, 249, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 110, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 1, 2, 2, 1, 9, 4, 4, 2, 1, 1, 3, 2, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 346, 248, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 345, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 250, 85, 86, 91, 344, 67, 43, 44, 92, 93, 249, 731, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 45, 46, 69, 47, 48, 49, 51, 52, 5, 6, 61, 1, 5, 55, -219, -219, -219, -219, -219, 3, 6, 61, 1, 636, 637, 732, 1, 87, 733, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, -71, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, -74, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, -80, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, -191, 9, 1, 5, 60, 1, 1, 5, 32, 23, 16, -193, -193, -193, -193, -193, -193, -193, -193, -193, 6, 6, 61, 1, 5, 55, 2, -200, -200, -200, -200, -200, -200, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 367, 734, -241, -241, -241, -241, 2, 67, 10, 162, 644, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, -433, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, -253, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, -268, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 3, 7, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, -269, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 3, 7, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, -270, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, -291, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 735, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 736, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, -296, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 737, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, -300, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 738, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, -304, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 739, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 24, 67, 10, 16, 5, 56, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 740, 128, 741, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 24, 67, 10, 16, 5, 56, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 742, 128, 743, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, -307, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, -272, 2, 67, 10, 162, 744, 1, 68, 745, 4, 6, 62, 83, 12, 746, -278, -278, -278, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 747, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, -336, 2, 6, 62, -341, -341, 2, 6, 62, 549, 748, 2, 67, 10, 162, 749, 3, 55, 5, 1, 750, 107, 108, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 563, 751, -241, -241, -241, -241, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, -352, 1, 148, 752, 4, 56, 1, 131, 2, 423, 106, 753, 424, 6, 56, 1, 10, 120, 1, 2, 423, 106, 422, 754, 421, 424, 5, 6, 61, 1, 5, 24, -357, -357, -357, -357, -357, 3, 6, 61, 1, 679, 680, 755, 5, 6, 61, 1, 5, 24, -362, -362, -362, -362, -362, 5, 6, 61, 1, 5, 24, -364, -364, -364, -364, -364, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, -383, 14, 1, 5, 60, 1, 1, 5, 32, 23, 16, 4, 6, 1, 10, 1, -368, -368, -368, -368, -368, -368, -368, -368, -368, 756, -368, -368, -368, -368, 4, 56, 1, 133, 5, 572, 106, 431, 757, 6, 56, 1, 10, 123, 3, 2, 572, 106, 429, 431, 758, 428, 5, 6, 61, 1, 5, 24, -386, -386, -386, -386, -386, 3, 6, 61, 1, 687, 688, 759, 5, 6, 61, 1, 5, 24, -391, -391, -391, -391, -391, 5, 6, 61, 1, 5, 24, -392, -392, -392, -392, -392, 5, 6, 61, 1, 5, 24, -394, -394, -394, -394, -394, 30, 1, 5, 60, 1, 1, 5, 20, 12, 23, 16, 10, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -374, -374, -374, -374, -374, -374, 128, -374, -374, -374, -374, -374, 127, -374, -374, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 22, 68, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 760, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, -381, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, -240, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, -184, 10, 6, 61, 1, 5, 23, 1, 8, 8, 6, 9, -241, -241, -241, 443, 444, -241, -241, -241, 761, -241, 5, 6, 61, 1, 5, 32, -171, -171, -171, -171, -171, 5, 6, 61, 1, 5, 32, -172, -172, -172, -172, -172, 1, 87, 762, 5, 6, 61, 1, 5, 40, -148, -148, -148, -148, -148, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 455, 763, -241, -241, -241, -241, 22, 68, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 764, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, -255, 14, 39, 17, 1, 24, 1, 1, 7, 4, 5, 5, 2, 29, 37, 2, 327, 154, 106, 156, 157, 155, 101, 765, 766, 84, 158, 197, 326, 196, 22, 68, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 767, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 5, 6, 61, 1, 5, 24, -113, -113, -113, -113, -113, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 465, 768, -241, -241, -241, -241, 103, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 6, 2, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 769, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 600, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 22, 68, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 770, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 6, 6, 61, 1, 5, 19, 5, -126, -126, -126, -126, -126, -126, 9, 6, 61, 1, 5, 11, 1, 1, 11, 29, -139, -139, -139, -139, -139, -139, -139, -139, -139, 9, 6, 61, 1, 5, 11, 1, 1, 11, 29, -140, -140, -140, -140, -140, -140, -140, -140, -140, 22, 87, 6, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 771, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 772, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 1, 66, 773, 22, 68, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 774, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 775, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 776, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 777, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 778, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 779, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, 780, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, 127, -315, -315, -315, -315, -315, -315, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, 781, -319, -319, -319, -319, -319, -319, -319, -319, -319, -319, 127, -319, -319, -319, -319, -319, -319, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, -95, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, -97, 1, 87, 782, 5, 6, 61, 1, 5, 55, -220, -220, -220, -220, -220, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 503, 783, -241, -241, -241, -241, 5, 6, 61, 1, 5, 55, -221, -221, -221, -221, -221, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, -104, 3, 6, 61, 1, 517, 518, 784, 24, 67, 10, 16, 61, 1, 9, 1, 1, 4, 30, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 785, 128, 125, 126, 127, 98, 99, 786, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 24, 67, 10, 16, 5, 56, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 787, 128, 788, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 23, 67, 10, 16, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 789, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 23, 67, 10, 16, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 790, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 23, 67, 10, 16, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 791, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, -298, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 792, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, -302, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 793, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 1, 68, 794, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, -275, 3, 68, 83, 12, -279, -279, -279, 23, 67, 6, 20, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -228, -228, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, -339, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, -189, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, -354, 3, 6, 61, 30, 679, 680, 795, 3, 55, 5, 1, 796, 107, 108, 5, 6, 61, 1, 5, 24, -358, -358, -358, -358, -358, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 563, 797, -241, -241, -241, -241, 5, 6, 61, 1, 5, 24, -359, -359, -359, -359, -359, 3, 55, 5, 1, 798, 107, 108, 5, 6, 61, 1, 5, 24, -387, -387, -387, -387, -387, 9, 6, 61, 1, 5, 23, 1, 8, 8, 15, -241, -241, -241, 570, 799, -241, -241, -241, -241, 5, 6, 61, 1, 5, 24, -388, -388, -388, -388, -388, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, -375, 2, 67, 1, 583, 800, 53, 1, 5, 54, 1, 5, 1, 1, 5, 11, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, -234, 3, 6, 61, 1, 591, 592, 801, 5, 6, 61, 1, 5, 40, -151, -151, -151, -151, -151, 4, 95, 74, 2, 2, 802, 485, 487, 488, 11, 56, 1, 24, 1, 1, 7, 4, 10, 2, 29, 39, 154, 106, 156, 157, 155, 101, 803, 159, 158, 197, 196, 5, 6, 61, 1, 5, 24, -118, -118, -118, -118, -118, 3, 6, 61, 1, 602, 603, 804, 26, 6, 61, 1, 5, 20, 4, 57, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -117, -117, -117, -117, 128, -117, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 5, 6, 61, 1, 5, 24, -120, -120, -120, -120, -120, 9, 6, 61, 1, 5, 11, 1, 1, 11, 29, -141, -141, -141, -141, -141, -141, -141, -141, -141, 22, 68, 25, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 805, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 4, 60, 1, 2, 2, -62, -62, -62, -62, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, -261, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, -309, 127, -309, -309, -309, 806, -309, -309, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, 807, -310, -310, -310, -310, -310, -310, -310, -310, -310, -310, 127, -310, -310, -310, -310, -310, -310, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, 127, -314, -314, -314, -314, -314, -314, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, -318, 127, -318, -318, -318, -318, -318, -318, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, -322, 127, -322, -322, -322, -322, -322, -322, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 808, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 809, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 62, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 3, 24, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, -100, 3, 6, 61, 1, 636, 637, 810, 6, 6, 61, 1, 5, 55, 2, -201, -201, -201, -201, -201, -201, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, -292, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 811, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, -293, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 812, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, -297, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, -301, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, -305, 23, 67, 10, 16, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 813, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 23, 67, 10, 16, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 814, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, -273, 1, 148, 815, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, -353, 3, 6, 61, 1, 679, 680, 816, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, -384, 3, 6, 61, 1, 687, 688, 817, 5, 6, 61, 1, 5, 32, -173, -173, -173, -173, -173, 5, 6, 61, 1, 5, 40, -149, -149, -149, -149, -149, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 818, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 1, 95, 819, 5, 6, 61, 1, 5, 24, -114, -114, -114, -114, -114, 1, 87, 820, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 821, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 822, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, 127, -316, -316, -316, -316, -316, -316, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, -320, 127, -320, -320, -320, -320, -320, -320, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 5, 6, 61, 1, 5, 55, -222, -222, -222, -222, -222, 23, 67, 10, 16, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 823, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 23, 67, 10, 16, 61, 1, 9, 1, 1, 34, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 162, 824, 128, 125, 126, 127, 98, 99, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, -299, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, -303, 3, 55, 5, 1, 825, 107, 108, 5, 6, 61, 1, 5, 24, -360, -360, -360, -360, -360, 5, 6, 61, 1, 5, 24, -389, -389, -389, -389, -389, 45, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 1, 1, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -313, -313, -313, -313, -313, 828, -313, -313, -313, -313, 826, -313, 827, -313, -313, -313, -313, -313, -313, -313, -313, -313, -313, 127, -313, -313, -313, -313, -313, -313, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 829, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 9, 6, 61, 1, 5, 11, 1, 1, 11, 29, -142, -142, -142, -142, -142, -142, -142, -142, -142, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, -311, 127, -311, -311, -311, -311, -311, -311, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 44, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, -312, 127, -312, -312, -312, -312, -312, -312, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, -294, 43, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 2, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, -295, 13, 1, 5, 60, 1, 1, 5, 32, 23, 16, 10, 1, 10, 1, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, -355, 1, 97, 830, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 831, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 7, 6, 61, 1, 29, 8, 8, 15, -242, -242, -242, -242, -242, -242, -242, 45, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 1, 1, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -315, -315, -315, -315, -315, 828, -315, -315, -315, -315, 832, -315, 833, -315, -315, -315, -315, -315, -315, -315, -315, -315, -315, 127, -315, -315, -315, -315, -315, -315, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, -105, 45, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 1, 1, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -314, -314, -314, -314, -314, 828, -314, -314, -314, -314, 834, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, -314, 127, -314, -314, -314, -314, -314, -314, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 1, 97, 835, 102, 7, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 1, 8, 1, 9, 1, 1, 1, 1, 7, 3, 11, 2, 3, 2, 1, 13, 4, 2, 1, 1, 7, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 3, 4, 4, 1, 1, 1, 1, 4, 3, 2, 1, 5, 1, 8, 4, 1, 1, 1, 1, 1, 3, 1, 836, 165, 29, 30, 31, 32, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 75, 76, 77, 78, 79, 80, 81, 82, 102, 103, 94, 106, 107, 108, 104, 105, 54, 53, 73, 74, 95, 101, 60, 84, 88, 85, 86, 91, 67, 169, 170, 92, 93, 87, 89, 90, 83, 70, 65, 66, 55, 96, 56, 97, 57, 61, 58, 98, 99, 59, 100, 50, 62, 68, 63, 64, 71, 72, 171, 172, 173, 47, 48, 49, 51, 52, 1, 97, 837, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, -107, 45, 1, 5, 60, 1, 1, 5, 14, 5, 1, 2, 1, 1, 1, 7, 2, 6, 11, 4, 2, 14, 7, 3, 1, 9, 1, 1, 3, 1, 1, 2, 27, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -316, -316, -316, -316, -316, 828, -316, -316, -316, -316, 838, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, -316, 127, -316, -316, -316, -316, -316, -316, 111, 110, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, -106, 1, 97, 839, 58, 1, 5, 54, 1, 5, 1, 1, 5, 1, 1, 1, 2, 1, 5, 1, 1, 1, 2, 3, 1, 2, 2, 1, 7, 2, 6, 11, 2, 2, 2, 7, 7, 7, 3, 1, 10, 1, 3, 1, 1, 2, 27, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108, -108], t = [], p = 0, n, o, k, a;
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
    ruleTable: [0, 0, 3, 0, 3, 1, 4, 1, 4, 3, 4, 2, 5, 1, 5, 1, 5, 1, 9, 1, 9, 1, 9, 1, 9, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 7, 1, 8, 1, 8, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 14, 1, 37, 1, 37, 1, 37, 1, 37, 1, 37, 1, 37, 1, 37, 1, 37, 1, 46, 1, 46, 1, 56, 1, 58, 1, 55, 1, 55, 3, 62, 1, 62, 2, 64, 3, 64, 5, 64, 2, 64, 1, 48, 1, 48, 3, 72, 3, 72, 1, 17, 3, 17, 4, 17, 5, 18, 3, 18, 4, 18, 5, 19, 3, 19, 4, 19, 3, 20, 3, 20, 4, 20, 5, 21, 3, 21, 4, 21, 3, 21, 2, 21, 3, 21, 2, 36, 1, 36, 1, 36, 1, 80, 1, 80, 1, 80, 3, 80, 3, 80, 4, 80, 6, 80, 4, 80, 6, 80, 4, 80, 5, 80, 7, 80, 3, 80, 3, 80, 4, 80, 6, 82, 10, 82, 12, 82, 11, 82, 13, 82, 4, 100, 0, 100, 1, 100, 3, 100, 4, 100, 6, 101, 1, 101, 1, 101, 3, 101, 5, 101, 3, 101, 5, 103, 1, 103, 1, 103, 1, 91, 1, 91, 3, 91, 4, 91, 1, 102, 2, 102, 2, 108, 1, 108, 1, 108, 1, 108, 1, 108, 1, 108, 2, 108, 2, 108, 2, 108, 2, 108, 3, 108, 3, 108, 4, 108, 6, 45, 2, 45, 4, 114, 0, 114, 1, 114, 3, 114, 4, 114, 6, 115, 3, 115, 5, 115, 2, 116, 1, 116, 1, 116, 1, 116, 1, 116, 1, 116, 1, 116, 1, 116, 1, 116, 1, 116, 1, 116, 1, 116, 1, 116, 1, 81, 2, 81, 3, 81, 4, 118, 1, 118, 3, 118, 4, 118, 4, 118, 6, 120, 1, 120, 2, 119, 1, 119, 2, 117, 1, 117, 2, 122, 1, 122, 2, 123, 1, 123, 1, 39, 5, 88, 3, 88, 2, 88, 2, 88, 1, 32, 6, 32, 3, 15, 5, 15, 2, 34, 5, 34, 2, 131, 1, 131, 1, 127, 0, 127, 1, 127, 3, 127, 4, 127, 6, 134, 1, 134, 3, 134, 2, 134, 1, 135, 1, 135, 1, 135, 1, 135, 1, 136, 2, 40, 2, 40, 2, 40, 3, 40, 2, 40, 2, 110, 2, 110, 4, 138, 1, 138, 3, 138, 4, 138, 4, 138, 6, 121, 1, 121, 1, 121, 1, 121, 1, 139, 1, 139, 3, 42, 1, 42, 1, 83, 2, 43, 3, 43, 4, 43, 6, 44, 3, 44, 3, 77, 2, 77, 3, 38, 3, 38, 5, 96, 0, 96, 1, 10, 2, 10, 4, 10, 1, 30, 2, 30, 4, 31, 1, 31, 2, 31, 4, 31, 3, 149, 3, 149, 5, 152, 3, 152, 5, 22, 1, 22, 3, 22, 1, 22, 3, 22, 3, 22, 7, 22, 5, 22, 3, 22, 3, 23, 2, 23, 3, 23, 4, 23, 5, 157, 3, 157, 3, 157, 2, 26, 5, 26, 7, 26, 4, 26, 6, 161, 1, 161, 2, 162, 3, 162, 4, 164, 2, 164, 4, 164, 2, 164, 4, 24, 2, 24, 2, 24, 2, 24, 1, 167, 2, 167, 2, 167, 3, 25, 5, 25, 7, 25, 7, 25, 9, 25, 9, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 3, 25, 5, 25, 5, 25, 7, 25, 7, 25, 9, 25, 9, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 6, 25, 8, 25, 5, 25, 7, 25, 3, 25, 5, 174, 1, 174, 3, 94, 1, 94, 3, 27, 1, 27, 2, 27, 3, 27, 4, 27, 2, 27, 3, 27, 4, 27, 5, 33, 3, 28, 4, 28, 6, 179, 1, 179, 3, 179, 2, 180, 1, 180, 1, 180, 1, 180, 2, 180, 2, 29, 2, 12, 2, 12, 4, 12, 4, 12, 5, 12, 7, 12, 6, 12, 9, 187, 1, 187, 3, 187, 4, 187, 4, 187, 6, 188, 1, 188, 3, 188, 1, 188, 3, 185, 1, 186, 3, 13, 3, 13, 5, 13, 2, 13, 2, 13, 2, 13, 2, 13, 4, 13, 5, 13, 6, 13, 2, 13, 2, 13, 2, 13, 2, 13, 3, 13, 5, 13, 4, 13, 5, 13, 7, 193, 1, 193, 3, 193, 4, 193, 4, 193, 6, 195, 1, 195, 3, 195, 3, 195, 1, 195, 3, 35, 2, 35, 2, 35, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 2, 16, 4, 16, 2, 16, 2, 16, 2, 16, 2, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 3, 16, 5, 16, 3, 16, 5, 16, 4, 41, 2],
    ruleActions: (rule, vals, locs, shared) => {
      const $ = vals;
      const $0 = vals.length - 1;
      switch (rule) {
        case 1:
          return ["program"];
        case 2:
          return ["program", ...$[$0]];
        case 3:
        case 59:
        case 111:
        case 146:
        case 174:
        case 178:
        case 198:
        case 218:
        case 227:
        case 276:
        case 327:
        case 340:
        case 356:
        case 385:
          return [$[$0]];
        case 4:
        case 112:
        case 147:
        case 199:
        case 219:
        case 228:
        case 341:
        case 357:
        case 386:
          return [...$[$0 - 2], $[$0]];
        case 5:
        case 61:
        case 181:
        case 342:
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
        case 50:
        case 51:
        case 52:
        case 53:
        case 54:
        case 55:
        case 56:
        case 57:
        case 64:
        case 65:
        case 87:
        case 88:
        case 89:
        case 90:
        case 91:
        case 116:
        case 121:
        case 122:
        case 123:
        case 124:
        case 127:
        case 130:
        case 131:
        case 132:
        case 133:
        case 134:
        case 153:
        case 154:
        case 155:
        case 156:
        case 157:
        case 158:
        case 161:
        case 162:
        case 163:
        case 164:
        case 165:
        case 169:
        case 195:
        case 196:
        case 202:
        case 206:
        case 207:
        case 208:
        case 209:
        case 223:
        case 224:
        case 225:
        case 241:
        case 242:
        case 256:
        case 258:
        case 287:
        case 325:
        case 343:
        case 344:
        case 345:
        case 361:
        case 363:
        case 365:
        case 390:
        case 393:
          return $[$0];
        case 48:
        case 160:
          return "undefined";
        case 49:
        case 159:
          return "null";
        case 58:
          return ["str", ...$[$0 - 1]];
        case 60:
        case 175:
        case 179:
        case 277:
          return [...$[$0 - 1], $[$0]];
        case 62:
        case 217:
        case 221:
        case 359:
        case 388:
          return $[$0 - 2];
        case 63:
          return "";
        case 66:
          return ["regex", $[$0 - 1]];
        case 67:
          return ["regex-index", $[$0 - 2], $[$0]];
        case 68:
          return ["regex-index", $[$0], null];
        case 69:
        case 119:
          return ["=", $[$0 - 2], $[$0]];
        case 70:
          return ["=", $[$0 - 3], $[$0]];
        case 71:
        case 120:
          return ["=", $[$0 - 4], $[$0 - 1]];
        case 72:
          return ["state", $[$0 - 2], $[$0]];
        case 73:
          return ["state", $[$0 - 3], $[$0]];
        case 74:
          return ["state", $[$0 - 4], $[$0 - 1]];
        case 75:
        case 77:
          return ["computed", $[$0 - 2], $[$0]];
        case 76:
          return ["computed", $[$0 - 3], $[$0]];
        case 78:
          return ["readonly", $[$0 - 2], $[$0]];
        case 79:
          return ["readonly", $[$0 - 3], $[$0]];
        case 80:
          return ["readonly", $[$0 - 4], $[$0 - 1]];
        case 81:
        case 83:
          return ["effect", $[$0 - 2], $[$0]];
        case 82:
          return ["effect", $[$0 - 3], $[$0]];
        case 84:
        case 85:
        case 86:
          return ["effect", null, $[$0]];
        case 92:
        case 101:
        case 139:
          return [".", $[$0 - 2], $[$0]];
        case 93:
        case 102:
        case 140:
          return ["?.", $[$0 - 2], $[$0]];
        case 94:
        case 96:
        case 103:
        case 141:
          return ["[]", $[$0 - 3], $[$0 - 1]];
        case 95:
        case 97:
        case 104:
        case 142:
          return ["[]", $[$0 - 5], $[$0 - 2]];
        case 98:
          return [$[$0 - 1][0], $[$0 - 3], ...$[$0 - 1].slice(1)];
        case 99:
          return ["optindex", $[$0 - 4], $[$0 - 1]];
        case 100:
          return ["optindex", $[$0 - 6], $[$0 - 2]];
        case 105:
          return ["object-comprehension", $[$0 - 8], $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], []];
        case 106:
          return ["object-comprehension", $[$0 - 10], $[$0 - 8], [["for-of", $[$0 - 6], $[$0 - 4], false]], [$[$0 - 2]]];
        case 107:
          return ["object-comprehension", $[$0 - 9], $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], []];
        case 108:
          return ["object-comprehension", $[$0 - 11], $[$0 - 9], [["for-of", $[$0 - 6], $[$0 - 4], true]], [$[$0 - 2]]];
        case 109:
          return ["object", ...$[$0 - 2]];
        case 110:
        case 145:
        case 176:
        case 197:
        case 216:
          return [];
        case 113:
        case 148:
        case 200:
        case 220:
        case 358:
        case 387:
          return [...$[$0 - 3], $[$0]];
        case 114:
        case 149:
        case 201:
        case 222:
        case 360:
        case 389:
          return [...$[$0 - 5], ...$[$0 - 2]];
        case 115:
          return [null, $[$0], $[$0]];
        case 117:
        case 150:
          return [":", $[$0 - 2], $[$0]];
        case 118:
        case 151:
          return [":", $[$0 - 4], $[$0 - 1]];
        case 125:
          return ["dynamicKey", $[$0 - 1]];
        case 126:
          return ["[]", "this", $[$0 - 1]];
        case 128:
        case 129:
        case 152:
        case 210:
          return ["...", $[$0]];
        case 135:
        case 214:
          return ["super", ...$[$0]];
        case 136:
        case 137:
        case 138:
        case 212:
        case 215:
          return [$[$0 - 1], ...$[$0]];
        case 143:
          return ["map-literal"];
        case 144:
          return ["map-literal", ...$[$0 - 2]];
        case 166:
          return ["array"];
        case 167:
          return ["array", ...$[$0 - 1]];
        case 168:
          return ["array", ...$[$0 - 2], ...$[$0 - 1]];
        case 170:
          return [...$[$0 - 2], ...$[$0]];
        case 171:
          return [...$[$0 - 3], ...$[$0]];
        case 172:
          return [...$[$0 - 2], ...$[$0 - 1]];
        case 173:
          return [...$[$0 - 5], ...$[$0 - 4], ...$[$0 - 2], ...$[$0 - 1]];
        case 177:
          return [...$[$0]];
        case 180:
          return null;
        case 182:
          return "..";
        case 183:
        case 226:
          return "...";
        case 184:
          return [$[$0 - 2], $[$0 - 3], $[$0 - 1]];
        case 185:
        case 413:
        case 415:
        case 416:
        case 430:
        case 432:
          return [$[$0 - 1], $[$0 - 2], $[$0]];
        case 186:
          return [$[$0], $[$0 - 1], null];
        case 187:
          return [$[$0 - 1], null, $[$0]];
        case 188:
          return [$[$0], null, null];
        case 189:
          return ["def", $[$0 - 4], $[$0 - 2], $[$0]];
        case 190:
          return ["def", $[$0 - 1], [], $[$0]];
        case 191:
        case 193:
          return [$[$0 - 1], $[$0 - 3], $[$0]];
        case 192:
        case 194:
          return [$[$0 - 1], [], $[$0]];
        case 203:
        case 326:
          return ["default", $[$0 - 2], $[$0]];
        case 204:
          return ["rest", $[$0]];
        case 205:
          return ["expansion"];
        case 211:
          return ["tagged-template", $[$0 - 1], $[$0]];
        case 213:
          return ["optcall", $[$0 - 2], ...$[$0]];
        case 229:
        case 230:
          return "this";
        case 231:
          return [".", "this", $[$0]];
        case 232:
          return [".", "super", $[$0]];
        case 233:
          return ["[]", "super", $[$0 - 1]];
        case 234:
          return ["[]", "super", $[$0 - 2]];
        case 235:
          return [".", "new", $[$0]];
        case 236:
          return [".", "import", $[$0]];
        case 237:
          return ["block"];
        case 238:
          return ["block", ...$[$0 - 1]];
        case 239:
          return $[$0 - 1].length === 1 ? $[$0 - 1][0] : ["block", ...$[$0 - 1]];
        case 240:
          return $[$0 - 2].length === 1 ? $[$0 - 2][0] : ["block", ...$[$0 - 2]];
        case 243:
          return ["return", $[$0]];
        case 244:
          return ["return", $[$0 - 1]];
        case 245:
          return ["return"];
        case 246:
          return ["throw", $[$0]];
        case 247:
          return ["throw", $[$0 - 1]];
        case 248:
          return ["yield"];
        case 249:
          return ["yield", $[$0]];
        case 250:
          return ["yield", $[$0 - 1]];
        case 251:
          return ["yield-from", $[$0]];
        case 252:
          return ["if", $[$0 - 1], $[$0]];
        case 253:
          return $[$0 - 4].length === 3 ? ["if", $[$0 - 4][1], $[$0 - 4][2], ["if", $[$0 - 1], $[$0]]] : [...$[$0 - 4], ["if", $[$0 - 1], $[$0]]];
        case 254:
          return ["if", ["!", $[$0 - 1]], $[$0]];
        case 255:
          return ["if", ["!", $[$0 - 3]], $[$0 - 2], $[$0]];
        case 257:
          return $[$0 - 2].length === 3 ? ["if", $[$0 - 2][1], $[$0 - 2][2], $[$0]] : [...$[$0 - 2], $[$0]];
        case 259:
        case 260:
          return ["if", $[$0], [$[$0 - 2]]];
        case 261:
          return ["?:", $[$0 - 4], $[$0 - 6], $[$0 - 1]];
        case 262:
          return ["?:", $[$0 - 2], $[$0 - 4], $[$0]];
        case 263:
        case 264:
          return ["if", ["!", $[$0]], [$[$0 - 2]]];
        case 265:
          return ["try", $[$0]];
        case 266:
          return ["try", $[$0 - 1], $[$0]];
        case 267:
          return ["try", $[$0 - 2], $[$0]];
        case 268:
          return ["try", $[$0 - 3], $[$0 - 2], $[$0]];
        case 269:
        case 270:
        case 395:
        case 398:
        case 400:
          return [$[$0 - 1], $[$0]];
        case 271:
          return [null, $[$0]];
        case 272:
          return ["switch", $[$0 - 3], $[$0 - 1], null];
        case 273:
          return ["switch", $[$0 - 5], $[$0 - 3], $[$0 - 1]];
        case 274:
          return ["switch", null, $[$0 - 1], null];
        case 275:
          return ["switch", null, $[$0 - 3], $[$0 - 1]];
        case 278:
          return ["when", $[$0 - 1], $[$0]];
        case 279:
          return ["when", $[$0 - 2], $[$0 - 1]];
        case 280:
          return ["while", $[$0]];
        case 281:
          return ["while", $[$0 - 2], $[$0]];
        case 282:
          return ["while", ["!", $[$0]]];
        case 283:
          return ["while", ["!", $[$0 - 2]], $[$0]];
        case 284:
          return $[$0 - 1].length === 2 ? [$[$0 - 1][0], $[$0 - 1][1], $[$0]] : [$[$0 - 1][0], $[$0 - 1][1], $[$0 - 1][2], $[$0]];
        case 285:
        case 286:
          return $[$0].length === 2 ? [$[$0][0], $[$0][1], [$[$0 - 1]]] : [$[$0][0], $[$0][1], $[$0][2], [$[$0 - 1]]];
        case 288:
          return ["loop", $[$0]];
        case 289:
          return ["loop", [$[$0]]];
        case 290:
          return ["loop-n", $[$0 - 1], $[$0]];
        case 291:
          return ["for-in", $[$0 - 3], $[$0 - 1], null, null, $[$0]];
        case 292:
          return ["for-in", $[$0 - 5], $[$0 - 3], null, $[$0 - 1], $[$0]];
        case 293:
          return ["for-in", $[$0 - 5], $[$0 - 3], $[$0 - 1], null, $[$0]];
        case 294:
          return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 1], $[$0 - 3], $[$0]];
        case 295:
          return ["for-in", $[$0 - 7], $[$0 - 5], $[$0 - 3], $[$0 - 1], $[$0]];
        case 296:
          return ["for-of", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
        case 297:
          return ["for-of", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
        case 298:
          return ["for-of", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
        case 299:
          return ["for-of", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
        case 300:
          return ["for-as", $[$0 - 3], $[$0 - 1], false, null, $[$0]];
        case 301:
          return ["for-as", $[$0 - 5], $[$0 - 3], false, $[$0 - 1], $[$0]];
        case 302:
        case 304:
          return ["for-as", $[$0 - 3], $[$0 - 1], true, null, $[$0]];
        case 303:
        case 305:
          return ["for-as", $[$0 - 5], $[$0 - 3], true, $[$0 - 1], $[$0]];
        case 306:
          return ["for-in", [], $[$0 - 1], null, null, $[$0]];
        case 307:
          return ["for-in", [], $[$0 - 3], $[$0 - 1], null, $[$0]];
        case 308:
          return ["comprehension", $[$0 - 4], [["for-in", $[$0 - 2], $[$0], null]], []];
        case 309:
          return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], null]], [$[$0]]];
        case 310:
          return ["comprehension", $[$0 - 6], [["for-in", $[$0 - 4], $[$0 - 2], $[$0]]], []];
        case 311:
          return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0]]], [$[$0 - 2]]];
        case 312:
          return ["comprehension", $[$0 - 8], [["for-in", $[$0 - 6], $[$0 - 4], $[$0 - 2]]], [$[$0]]];
        case 313:
          return ["comprehension", $[$0 - 4], [["for-of", $[$0 - 2], $[$0], false]], []];
        case 314:
          return ["comprehension", $[$0 - 6], [["for-of", $[$0 - 4], $[$0 - 2], false]], [$[$0]]];
        case 315:
          return ["comprehension", $[$0 - 5], [["for-of", $[$0 - 2], $[$0], true]], []];
        case 316:
          return ["comprehension", $[$0 - 7], [["for-of", $[$0 - 4], $[$0 - 2], true]], [$[$0]]];
        case 317:
          return ["comprehension", $[$0 - 4], [["for-as", $[$0 - 2], $[$0], false, null]], []];
        case 318:
          return ["comprehension", $[$0 - 6], [["for-as", $[$0 - 4], $[$0 - 2], false, null]], [$[$0]]];
        case 319:
          return ["comprehension", $[$0 - 5], [["for-as", $[$0 - 2], $[$0], true, null]], []];
        case 320:
          return ["comprehension", $[$0 - 7], [["for-as", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
        case 321:
          return ["comprehension", $[$0 - 4], [["for-as", $[$0 - 2], $[$0], true, null]], []];
        case 322:
          return ["comprehension", $[$0 - 6], [["for-as", $[$0 - 4], $[$0 - 2], true, null]], [$[$0]]];
        case 323:
          return ["comprehension", $[$0 - 2], [["for-in", [], $[$0], null]], []];
        case 324:
          return ["comprehension", $[$0 - 4], [["for-in", [], $[$0 - 2], $[$0]]], []];
        case 328:
        case 362:
        case 364:
        case 391:
        case 392:
        case 394:
          return [$[$0 - 2], $[$0]];
        case 329:
          return ["class", null, null];
        case 330:
          return ["class", null, null, $[$0]];
        case 331:
          return ["class", null, $[$0]];
        case 332:
          return ["class", null, $[$0 - 1], $[$0]];
        case 333:
          return ["class", $[$0], null];
        case 334:
          return ["class", $[$0 - 1], null, $[$0]];
        case 335:
          return ["class", $[$0 - 2], $[$0]];
        case 336:
          return ["class", $[$0 - 3], $[$0 - 1], $[$0]];
        case 337:
          return ["enum", $[$0 - 1], $[$0]];
        case 338:
          return ["component", null, ["block", ...$[$0 - 1]]];
        case 339:
          return ["component", $[$0 - 3], ["block", ...$[$0 - 1]]];
        case 346:
          return ["offer", $[$0]];
        case 347:
          return ["accept", $[$0]];
        case 348:
          return ["render", $[$0]];
        case 349:
        case 352:
          return ["import", "{}", $[$0]];
        case 350:
        case 351:
          return ["import", $[$0 - 2], $[$0]];
        case 353:
          return ["import", $[$0 - 4], $[$0]];
        case 354:
          return ["import", $[$0 - 4], $[$0 - 2], $[$0]];
        case 355:
          return ["import", $[$0 - 7], $[$0 - 4], $[$0]];
        case 366:
          return ["*", $[$0]];
        case 367:
          return ["export", "{}"];
        case 368:
          return ["export", $[$0 - 2]];
        case 369:
        case 370:
        case 371:
        case 372:
        case 376:
        case 377:
        case 378:
        case 379:
          return ["export", $[$0]];
        case 373:
          return ["export", ["=", $[$0 - 2], $[$0]]];
        case 374:
          return ["export", ["=", $[$0 - 3], $[$0]]];
        case 375:
          return ["export", ["=", $[$0 - 4], $[$0 - 1]]];
        case 380:
          return ["export-default", $[$0]];
        case 381:
          return ["export-default", $[$0 - 1]];
        case 382:
          return ["export-all", $[$0]];
        case 383:
          return ["export-from", "{}", $[$0]];
        case 384:
          return ["export-from", $[$0 - 4], $[$0]];
        case 396:
        case 397:
        case 399:
        case 435:
          return ["do-iife", $[$0]];
        case 401:
          return ["-", $[$0]];
        case 402:
          return ["+", $[$0]];
        case 403:
          return ["?", $[$0 - 1]];
        case 404:
          return ["presence", $[$0 - 1]];
        case 405:
          return ["await", $[$0]];
        case 406:
          return ["await", $[$0 - 1]];
        case 407:
          return ["--", $[$0], false];
        case 408:
          return ["++", $[$0], false];
        case 409:
          return ["--", $[$0 - 1], true];
        case 410:
          return ["++", $[$0 - 1], true];
        case 411:
          return ["+", $[$0 - 2], $[$0]];
        case 412:
          return ["-", $[$0 - 2], $[$0]];
        case 414:
          return ["**", $[$0 - 2], $[$0]];
        case 417:
          return ["&", $[$0 - 2], $[$0]];
        case 418:
          return ["^", $[$0 - 2], $[$0]];
        case 419:
          return ["|", $[$0 - 2], $[$0]];
        case 420:
        case 421:
        case 422:
        case 423:
        case 424:
        case 425:
          return ["control", $[$0 - 1], $[$0 - 2], $[$0]];
        case 426:
          return ["&&", $[$0 - 2], $[$0]];
        case 427:
          return ["||", $[$0 - 2], $[$0]];
        case 428:
          return ["??", $[$0 - 2], $[$0]];
        case 429:
          return ["|>", $[$0 - 2], $[$0]];
        case 431:
          return ["?:", $[$0 - 4], $[$0 - 2], $[$0]];
        case 433:
          return [$[$0 - 3], $[$0 - 4], $[$0 - 1]];
        case 434:
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
  function installComponentSupport(CodeEmitter, Lexer2) {
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
    const proto = CodeEmitter.prototype;
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
    proto.emitComponent = function(head, rest, context, sexpr) {
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
            derivedVars.push({ name: varName, expr: stmt[2], type: getMemberType(stmt[1]) });
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
        const componentTypeParams = this._componentTypeParams || "";
        sl.push(`class ${componentTypeParams}{`);
        sl.push("  declare _root: Element | null; declare app: any;");
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
        for (const { name, expr, type } of derivedVars) {
          const ts = expandType(type);
          const typeAnnot = ts ? `: Computed<${ts}>` : "";
          if (this.is(expr, "block")) {
            const transformed = this.transformComponentMembers(expr);
            const body2 = this.emitFunctionBody(transformed);
            sl.push(`  ${name}${typeAnnot} = __computed(() => ${body2});`);
          } else {
            const val = this.emitInComponent(expr, "value");
            sl.push(`  ${name}${typeAnnot} = __computed(() => ${val});`);
          }
        }
        sl.push("  _init(props) {");
        for (const { name, value, isPublic } of readonlyVars) {
          const val = this.emitInComponent(value, "value");
          sl.push(isPublic ? `    this.${name} = props.${name} ?? ${val};` : `    this.${name} = ${val};`);
        }
        for (const { name, value, isPublic, required, type } of stateVars) {
          if (isPublic && required) {
            sl.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name});`);
          } else if (isPublic) {
            const val = this.emitInComponent(value, "value");
            sl.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name} ?? ${val});`);
          } else {
            const val = this.emitInComponent(value, "value");
            sl.push(`    this.${name} = __state(${val});`);
          }
        }
        for (const effect of effects) {
          const effectBody = effect[2];
          const isAsync = this.containsAwait(effectBody) ? "async " : "";
          if (this.is(effectBody, "block")) {
            const transformed = this.transformComponentMembers(effectBody);
            const body2 = this.emitFunctionBody(transformed, [], true);
            sl.push(`    __effect(${isAsync}() => ${body2});`);
          } else {
            const effectCode = this.emitInComponent(effectBody, "value");
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
            const bodyCode = this.emitFunctionBody(transformed, params || []);
            sl.push(`  ${isAsync ? "async " : ""}${name}(${paramStr}) ${bodyCode}`);
          }
        }
        for (const { name, value } of lifecycleHooks) {
          if (Array.isArray(value) && (value[0] === "->" || value[0] === "=>")) {
            const [, params, hookBody] = value;
            const paramStr = Array.isArray(params) ? params.map((p) => this.formatParam(p)).join(", ") : "";
            const transformed = this.reactiveMembers ? this.transformComponentMembers(hookBody) : hookBody;
            const isAsync = this.containsAwait(hookBody);
            const bodyCode = this.emitFunctionBody(transformed, params || []);
            sl.push(`  ${isAsync ? "async " : ""}${name}(${paramStr}) ${bodyCode}`);
          }
        }
        if (renderBlock) {
          const constructions = [];
          let constructionIdx = 0;
          const sourceLines = this.options.source?.split(`
`);
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
                      const member = typeof value === "string" && this.reactiveMembers?.has(value) ? `this.${value}` : this.emitInComponent(value, "value");
                      props.push({ code: `${key}: ${member}`, srcLine });
                    } else {
                      const val = this.emitInComponent(value, "value");
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
                    const val = this.emitInComponent(value, "value");
                    props.push({ code: `'${eventKey}': ${val}`, srcLine });
                  } else if (typeof key === "string") {
                    if (key === "key") {
                      const val = this.emitInComponent(value, "value");
                      const marker = srcLine != null ? ` // @rip-src:${srcLine}` : "";
                      constructions.push(`    (${val});${marker}`);
                      continue;
                    }
                    if (key.startsWith("__bind_") && key.endsWith("__")) {
                      const propName = key.slice(7, -2);
                      const val = this.emitInComponent(value, "value");
                      props.push({ code: `${propName}: ${val}`, srcLine });
                    } else {
                      const val = this.emitInComponent(value, "value");
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
            if (head2 === "object")
              return;
            if (head2 === "if" || head2 === "unless") {
              const condition = node[1];
              if (condition != null) {
                const condCode = this.emitInComponent(condition, "value");
                const srcLine = node.loc?.r;
                const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : "";
                constructions.push(`    ${condCode};${srcMarker}`);
              }
            } else if (head2 === "?:") {
              const ternCode = this.emitInComponent(node, "value");
              const srcLine = node.loc?.r;
              const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : "";
              constructions.push(`    ${ternCode};${srcMarker}`);
            } else if (head2 === "switch") {
              const discriminant = node[1];
              if (discriminant != null) {
                const discCode = this.emitInComponent(discriminant, "value");
                const srcLine = node.loc?.r;
                const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : "";
                constructions.push(`    ${discCode};${srcMarker}`);
              }
            } else if (head2 === "for-in" || head2 === "for-of" || head2 === "for-as") {
              const vars = node[1];
              const iterable = node[2];
              if (iterable != null) {
                const iterCode = this.emitInComponent(iterable, "value");
                const srcLine = node.loc?.r;
                const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : "";
                let varPattern;
                if (Array.isArray(vars)) {
                  if (vars.length === 1) {
                    const v = vars[0];
                    varPattern = Array.isArray(v) ? this.emitDestructuringPattern(v) : String(v);
                  } else if (head2 === "for-of") {
                    varPattern = `[${vars.map((v) => String(v)).join(", ")}]`;
                  } else {
                    varPattern = String(vars[0]);
                  }
                } else {
                  varPattern = String(vars);
                }
                if (head2 === "for-of") {
                  constructions.push(`    for (const ${varPattern} of Object.entries(${iterCode})) {${srcMarker}`);
                } else {
                  constructions.push(`    for (const ${varPattern} of ${iterCode}) {${srcMarker}`);
                }
                for (let bi = 3;bi < node.length; bi++) {
                  if (node[bi] != null)
                    walkRender(node[bi]);
                }
                constructions.push(`    }`);
                return;
              }
            } else if (head2 === "__text__") {
              const textExpr = node[1];
              if (textExpr != null) {
                const exprCode = this.emitInComponent(textExpr, "value");
                const srcLine = node.loc?.r;
                const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : "";
                constructions.push(`    ${exprCode};${srcMarker}`);
              }
            }
            const emitBareIdent = (child, parentNode, isTextChild) => {
              if (typeof child !== "string" || !/^[a-z][\w-]*$/.test(child))
                return;
              if (CodeEmitter.GENERATORS[child])
                return;
              if (child === "null" || child === "undefined" || child === "true" || child === "false")
                return;
              let srcLine = parentNode.loc?.r;
              if (srcLine != null && sourceLines) {
                const re = new RegExp(`\\b${child}\\b`);
                for (let ln = srcLine;ln < sourceLines.length; ln++) {
                  if (re.test(sourceLines[ln])) {
                    srcLine = ln;
                    break;
                  }
                }
              }
              const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : "";
              if (this.componentMembers && this.componentMembers.has(child)) {
                constructions.push(`    this.${child};${srcMarker}`);
              } else if (isTextChild) {
                constructions.push(`    ${child};${srcMarker}`);
              } else {
                constructions.push(`    __ripEl('${child}');${srcMarker}`);
              }
            };
            const isTagHead = typeof head2 === "string" && /^[a-z][\w-]*$/.test(head2) && !CodeEmitter.GENERATORS[head2] && TEMPLATE_TAGS.has(head2.split(/[.#]/)[0]);
            if (head2 === "block") {
              for (let i = 1;i < node.length; i++)
                emitBareIdent(node[i], node, false);
            } else if (isTagHead) {
              for (let i = 1;i < node.length; i++)
                emitBareIdent(node[i], node, true);
              for (let i = 1;i < node.length; i++) {
                const child = node[i];
                if (!Array.isArray(child))
                  continue;
                const ch = child[0]?.valueOf?.() ?? child[0];
                if (ch === "object" || ch === "block" || ch === "__text__")
                  continue;
                if (typeof ch === "string") {
                  if (/^[A-Z]/.test(ch))
                    continue;
                  if (TEMPLATE_TAGS.has(ch.split(/[.#]/)[0]))
                    continue;
                  if (/^[a-z][\w-]*$/.test(ch) && !CodeEmitter.GENERATORS[ch])
                    continue;
                  if (/^(if|unless|switch|for-in|for-of|for-as|while|until|loop|loop-n|try|throw|break|continue|break-if|continue-if|control|when|return|def|->|=>|class|enum|state|computed|readonly|effect|=|program)$/.test(ch))
                    continue;
                }
                try {
                  const exprCode = this.emitInComponent(child, "value");
                  const srcLine = child.loc?.r ?? node.loc?.r;
                  const srcMarker = srcLine != null ? ` // @rip-src:${srcLine}` : "";
                  constructions.push(`    ${exprCode};${srcMarker}`);
                } catch {}
              }
            }
            for (let i = 1;i < node.length; i++)
              walkRender(node[i]);
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
            } else if (typeof head2 === "string" && !CodeEmitter.GENERATORS[head2] && (TEMPLATE_TAGS.has(head2.split(/[.#]/)[0]) || /^[a-z][\w-]*$/.test(head2) && node.length > 1)) {
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
        const val = this.emitInComponent(value, "value");
        lines.push(isPublic ? `    this.${name} = props.${name} ?? ${val};` : `    this.${name} = ${val};`);
      }
      for (const name of acceptedVars) {
        lines.push(`    this.${name} = getContext('${name}');`);
      }
      for (const { name, value, isPublic, required } of stateVars) {
        if (isPublic && required) {
          lines.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name});`);
        } else if (isPublic) {
          const val = this.emitInComponent(value, "value");
          lines.push(`    this.${name} = __state(props.__bind_${name}__ ?? props.${name} ?? ${val});`);
        } else {
          const val = this.emitInComponent(value, "value");
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
          const body2 = this.emitFunctionBody(transformed);
          lines.push(`    this.${name} = __computed(() => ${body2});`);
        } else {
          const val = this.emitInComponent(expr, "value");
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
          const body2 = this.emitFunctionBody(transformed, [], true);
          lines.push(`    __effect(${isAsync}() => ${body2});`);
        } else {
          const effectCode = this.emitInComponent(effectBody, "value");
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
          const bodyCode = this.emitFunctionBody(transformed, params || []);
          lines.push(`  ${isAsync ? "async " : ""}${name}(${paramStr}) ${bodyCode}`);
        }
      }
      for (const { name, value } of lifecycleHooks) {
        if (Array.isArray(value) && (value[0] === "->" || value[0] === "=>")) {
          const [, params, hookBody] = value;
          const paramStr = Array.isArray(params) ? params.map((p) => this.formatParam(p)).join(", ") : "";
          const transformed = this.reactiveMembers ? this.transformComponentMembers(hookBody) : hookBody;
          const isAsync = this.containsAwait(hookBody);
          const bodyCode = this.emitFunctionBody(transformed, params || []);
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
    proto.emitInComponent = function(sexpr, context) {
      if (typeof sexpr === "string" && this.reactiveMembers && this.reactiveMembers.has(sexpr)) {
        return `${this._self}.${sexpr}.value`;
      }
      if (typeof sexpr === "string" && this.componentMembers && this.componentMembers.has(sexpr)) {
        return `${this._self}.${sexpr}`;
      }
      if (Array.isArray(sexpr) && this.reactiveMembers) {
        const transformed = this.transformComponentMembers(sexpr);
        return this.emit(transformed, context);
      }
      return this.emit(sexpr, context);
    };
    proto.emitRender = function(head, rest, context, sexpr) {
      this.error("render blocks can only be used inside a component", sexpr);
    };
    proto.emitOffer = function(head, rest, context, sexpr) {
      this.error("offer can only be used inside a component", sexpr);
    };
    proto.emitAccept = function(head, rest, context, sexpr) {
      this.error("accept can only be used inside a component", sexpr);
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
        rootVar = this.emitNode(statements[0]);
        this._pendingAutoWire = false;
      } else {
        rootVar = this.newElementVar("frag");
        this._createLines.push(`${rootVar} = document.createDocumentFragment();`);
        const children = [];
        for (const stmt of statements) {
          const childVar = this.emitNode(stmt);
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
    proto.emitNode = function(sexpr) {
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
        return this.emitChildComponent(headStr, rest);
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
            return this.emitConditional(chain);
          return this.emitTemplateBlock(chain);
        }
        const cv = this.newElementVar("c");
        this._createLines.push(`${cv} = document.createComment('switch');`);
        return cv;
      }
      if (headStr && this.isHtmlTag(headStr) && !meta(head, "text")) {
        let [tagName, id] = headStr.split("#");
        return this.emitTag(tagName || "div", [], rest, id);
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
          return this.emitTag(tag, classes, [], id);
        }
        const textVar2 = this.newTextVar();
        const exprCode2 = this.emitInComponent(sexpr, "value");
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
              return this.emitDynamicTag(tag3, classExprs, rest, staticArgs, id2);
            }
          }
          const tag2 = typeof tagExpr === "string" ? tagExpr : tagExpr.valueOf();
          return this.emitDynamicTag(tag2, classExprs, rest);
        }
        const { tag, classes, id } = this.collectTemplateClasses(head);
        if (tag && this.isHtmlTag(tag)) {
          if (classes.length > 0 && classes[classes.length - 1] === "__clsx") {
            const staticClasses = classes.slice(0, -1);
            const staticArgs = staticClasses.map((c) => `"${c}"`);
            return this.emitDynamicTag(tag, rest, [], staticArgs, id);
          }
          return this.emitTag(tag, classes, rest, id);
        }
      }
      if (headStr === "->" || headStr === "=>") {
        return this.emitTemplateBlock(rest[1]);
      }
      if (headStr === "if") {
        return this.emitConditional(sexpr);
      }
      if (headStr === "for" || headStr === "for-in" || headStr === "for-of" || headStr === "for-as") {
        return this.emitTemplateLoop(sexpr);
      }
      if (headStr === "__text__") {
        const expr = rest[0] ?? "undefined";
        const textVar2 = this.newTextVar();
        const exprCode2 = this.emitInComponent(expr, "value");
        if (this.hasReactiveDeps(expr)) {
          this._createLines.push(`${textVar2} = document.createTextNode('');`);
          this._pushEffect(`${textVar2}.data = String(${exprCode2});`);
        } else {
          this._createLines.push(`${textVar2} = document.createTextNode(String(${exprCode2}));`);
        }
        return textVar2;
      }
      const textVar = this.newTextVar();
      const exprCode = this.emitInComponent(sexpr, "value");
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
                this.emitAttributes(elVar, child);
              } else {
                const childVar = this.emitNode(child);
                this._createLines.push(`${elVar}.appendChild(${childVar});`);
              }
            }
          } else if (block) {
            const childVar = this.emitNode(block);
            this._createLines.push(`${elVar}.appendChild(${childVar});`);
          }
        } else if (this.is(arg, "object")) {
          this.emitAttributes(elVar, arg);
        } else if (typeof arg === "string" || arg instanceof String) {
          const val = arg.valueOf();
          const baseName = val.split(/[#.]/)[0];
          if (this.isHtmlTag(baseName || "div") || this.isComponent(baseName)) {
            const childVar = this.emitNode(arg);
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
              this._createLines.push(`${textVar} = document.createTextNode(${this.emitInComponent(arg, "value")});`);
            }
            this._createLines.push(`${elVar}.appendChild(${textVar});`);
          }
        } else if (arg) {
          const childVar = this.emitNode(arg);
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
    proto.emitTag = function(tag, classes, args, id) {
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
    proto.emitDynamicTag = function(tag, classExprs, children, staticClassArgs, id) {
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
      const classArgs = [...staticClassArgs || [], ...classExprs.map((e) => this.emitInComponent(e, "value"))];
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
    proto.emitAttributes = function(elVar, objExpr) {
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
            const handlerCode = this.emitInComponent(value, "value");
            this._createLines.push(`${elVar}.addEventListener('${eventName}', (e) => __batch(() => (${handlerCode})(e)));`);
          }
          continue;
        }
        if (typeof key === "string" || key instanceof String) {
          if (key.startsWith('"') && key.endsWith('"')) {
            key = key.slice(1, -1);
          }
          if (key === "class" || key === "className") {
            const valueCode2 = this.emitInComponent(value, "value");
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
            const valueCode2 = this.emitInComponent(value, "value");
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
          const valueCode = this.emitInComponent(value, "value");
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
    proto.emitTemplateBlock = function(body) {
      if (!Array.isArray(body) || body[0] !== "block") {
        return this.emitNode(body);
      }
      const statements = body.slice(1);
      if (statements.length === 0) {
        const commentVar = this.newElementVar("empty");
        this._createLines.push(`${commentVar} = document.createComment('');`);
        return commentVar;
      }
      if (statements.length === 1) {
        return this.emitNode(statements[0]);
      }
      const fragVar = this.newElementVar("frag");
      this._createLines.push(`${fragVar} = document.createDocumentFragment();`);
      const children = [];
      for (const stmt of statements) {
        const childVar = this.emitNode(stmt);
        this._createLines.push(`${fragVar}.appendChild(${childVar});`);
        children.push(childVar);
      }
      this._fragChildren.set(fragVar, children);
      return fragVar;
    };
    proto.emitConditional = function(sexpr) {
      this._pendingAutoWire = false;
      if (sexpr.length > 4) {
        let chain = sexpr[sexpr.length - 1];
        for (let i = sexpr.length - 2;i >= 3; i--) {
          chain = [...sexpr[i], chain];
        }
        sexpr = [sexpr[0], sexpr[1], sexpr[2], chain];
      }
      const [, condition, thenBlock, elseBlock] = sexpr;
      const anchorVar = this.newElementVar("anchor");
      this._createLines.push(`${anchorVar} = document.createComment('if');`);
      const condCode = this.emitInComponent(condition, "value");
      const outerParams = this._loopVarStack.map((v) => `${v.itemVar}, ${v.indexVar}`).join(", ");
      const outerExtra = outerParams ? `, ${outerParams}` : "";
      const thenBlockName = this.newBlockVar();
      this.emitConditionBranch(thenBlockName, thenBlock);
      let elseBlockName = null;
      if (elseBlock) {
        elseBlockName = this.newBlockVar();
        this.emitConditionBranch(elseBlockName, elseBlock);
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
      if (this._factoryMode) {
        setupLines.push(`  disposers.push(() => { if (currentBlock) { currentBlock.d(true); currentBlock = null; } });`);
      }
      setupLines.push(`}`);
      this._setupLines.push(setupLines.join(`
    `));
      return anchorVar;
    };
    proto.emitConditionBranch = function(blockName, block) {
      const saved = [this._createLines, this._setupLines, this._factoryMode, this._factoryVars];
      this._createLines = [];
      this._setupLines = [];
      this._factoryMode = true;
      this._factoryVars = new Set;
      const rootVar = this.emitTemplateBlock(block);
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
    proto.emitTemplateLoop = function(sexpr) {
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
      const collectionCode = this.emitInComponent(collection, "value");
      let keyExpr = itemVar;
      if (this.is(body, "block") && body.length > 1) {
        const firstChild = body[1];
        if (Array.isArray(firstChild)) {
          for (const arg of firstChild) {
            if (this.is(arg, "object")) {
              for (let i = 1;i < arg.length; i++) {
                const [k, v] = arg[i];
                if (k === "key") {
                  keyExpr = this.emit(v, "value");
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
      const itemNode = this.emitTemplateBlock(body);
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
    proto.emitChildComponent = function(componentName, args) {
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
        const handlerCode = this.emitInComponent(value, "value");
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
          const valueCode = this.emitInComponent(value, "value");
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
              childrenVar = this.emitTemplateBlock(block);
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
          const exprCode = this.emitInComponent(arg, "value");
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

  // src/error.js
  class RipError extends Error {
    constructor(message, {
      code = null,
      file = null,
      line = null,
      column = null,
      length = 1,
      source = null,
      suggestion = null,
      phase = null
    } = {}) {
      super(message);
      this.name = "RipError";
      this.code = code;
      this.file = file;
      this.line = line;
      this.column = column;
      this.length = length;
      this.source = source;
      this.suggestion = suggestion;
      this.phase = phase;
    }
    static fromLexer(err, source, file) {
      let loc = err.location || {};
      return new RipError(err.message, {
        code: "E_SYNTAX",
        file,
        line: loc.first_line ?? null,
        column: loc.first_column ?? null,
        length: loc.last_column != null && loc.first_column != null ? loc.last_column - loc.first_column + 1 : 1,
        source,
        phase: "lexer"
      });
    }
    static fromParser(err, source, file) {
      let h = err.hash || {};
      let loc = h.loc || {};
      let line = h.line ?? loc.r ?? null;
      let column = loc.first_column ?? loc.c ?? null;
      let suggestion = null;
      if (h.expected?.length) {
        let first5 = h.expected.slice(0, 5).map((e) => e.replace(/'/g, ""));
        suggestion = `Expected ${first5.join(", ")}`;
        if (h.expected.length > 5)
          suggestion += `, ... (${h.expected.length} total)`;
      }
      let token = h.token || "token";
      let near = h.text ? ` near '${h.text}'` : "";
      let message = `Unexpected ${token}${near}`;
      return new RipError(message, {
        code: "E_PARSE",
        file,
        line,
        column,
        length: h.text?.length || 1,
        source,
        suggestion,
        phase: "parser"
      });
    }
    static fromSExpr(message, sexpr, source, file, suggestion) {
      let loc = sexpr?.loc || {};
      return new RipError(message, {
        code: "E_CODEGEN",
        file,
        line: loc.r ?? null,
        column: loc.c ?? null,
        length: loc.n ?? 1,
        source,
        suggestion,
        phase: "codegen"
      });
    }
    get locationString() {
      let parts = [];
      if (this.file)
        parts.push(this.file);
      if (this.line != null) {
        parts.push(`${this.line + 1}:${(this.column ?? 0) + 1}`);
      }
      return parts.join(":");
    }
    format({ color = true } = {}) {
      let c = color ? {
        red: "\x1B[31m",
        yellow: "\x1B[33m",
        cyan: "\x1B[36m",
        dim: "\x1B[2m",
        bold: "\x1B[1m",
        reset: "\x1B[0m"
      } : { red: "", yellow: "", cyan: "", dim: "", bold: "", reset: "" };
      let lines = [];
      let loc = this.locationString;
      let header = loc ? `${c.cyan}${loc}${c.reset} ` : "";
      lines.push(`${header}${c.red}${c.bold}error${c.reset}${c.bold}: ${this.message}${c.reset}`);
      let snippet = this._snippet();
      if (snippet) {
        lines.push("");
        for (let s of snippet) {
          if (s.type === "source") {
            lines.push(`${c.dim}${s.gutter}${c.reset}${s.text}`);
          } else if (s.type === "caret") {
            lines.push(`${c.dim}${s.gutter}${c.reset}${c.red}${c.bold}${s.text}${c.reset}`);
          }
        }
      }
      if (this.suggestion) {
        lines.push("");
        lines.push(`${c.yellow}hint${c.reset}: ${this.suggestion}`);
      }
      return lines.join(`
`);
    }
    formatHTML() {
      let lines = [];
      lines.push('<div class="rip-error">');
      lines.push("<style>");
      lines.push(`.rip-error { font-family: ui-monospace, "SF Mono", Menlo, Monaco, monospace; font-size: 13px; line-height: 1.5; padding: 16px 20px; background: #1e1e2e; color: #cdd6f4; border-radius: 8px; overflow-x: auto; }`);
      lines.push(`.rip-error .re-header { color: #f38ba8; font-weight: 600; }`);
      lines.push(`.rip-error .re-loc { color: #89b4fa; }`);
      lines.push(`.rip-error .re-gutter { color: #585b70; user-select: none; }`);
      lines.push(`.rip-error .re-caret { color: #f38ba8; font-weight: 700; }`);
      lines.push(`.rip-error .re-hint { color: #f9e2af; }`);
      lines.push(`.rip-error .re-snippet { margin: 8px 0; }`);
      lines.push("</style>");
      let loc = this.locationString;
      let locSpan = loc ? `<span class="re-loc">${esc(loc)}</span> ` : "";
      lines.push(`<div class="re-header">${locSpan}error: ${esc(this.message)}</div>`);
      let snippet = this._snippet();
      if (snippet) {
        lines.push('<pre class="re-snippet">');
        for (let s of snippet) {
          if (s.type === "source") {
            lines.push(`<span class="re-gutter">${esc(s.gutter)}</span>${esc(s.text)}`);
          } else if (s.type === "caret") {
            lines.push(`<span class="re-gutter">${esc(s.gutter)}</span><span class="re-caret">${esc(s.text)}</span>`);
          }
        }
        lines.push("</pre>");
      }
      if (this.suggestion) {
        lines.push(`<div class="re-hint">hint: ${esc(this.suggestion)}</div>`);
      }
      lines.push("</div>");
      return lines.join(`
`);
    }
    _snippet() {
      if (this.source == null || this.line == null)
        return null;
      let sourceLines = this.source.split(`
`);
      let errLine = this.line;
      if (errLine < 0 || errLine >= sourceLines.length)
        return null;
      let contextRadius = 2;
      let start = Math.max(0, errLine - contextRadius);
      let end = Math.min(sourceLines.length - 1, errLine + contextRadius);
      let gutterWidth = String(end + 1).length;
      let result = [];
      for (let i = start;i <= end; i++) {
        let lineNum = String(i + 1).padStart(gutterWidth);
        let gutter = ` ${lineNum} │ `;
        result.push({ type: "source", gutter, text: sourceLines[i] });
        if (i === errLine && this.column != null) {
          let pad = " ".repeat(this.column);
          let caretLen = Math.max(1, Math.min(this.length || 1, sourceLines[i].length - this.column));
          let carets = "^".repeat(caretLen);
          let emptyGutter = " ".repeat(gutterWidth + 2) + "│ ";
          result.push({ type: "caret", gutter: emptyGutter, text: `${pad}${carets}` });
        }
      }
      return result;
    }
  }
  function isLexerError(err) {
    return err instanceof SyntaxError && err.location != null;
  }
  function isParserError(err) {
    return !(err instanceof SyntaxError) && err.hash != null;
  }
  function toRipError(err, source, file) {
    if (err instanceof RipError) {
      if (file && !err.file)
        err.file = file;
      if (source && !err.source)
        err.source = source;
      return err;
    }
    if (isLexerError(err))
      return RipError.fromLexer(err, source, file);
    if (isParserError(err))
      return RipError.fromParser(err, source, file);
    return new RipError(err.message, { file, source, phase: "unknown" });
  }
  function formatError(err, { source, file, color = true } = {}) {
    let re = err instanceof RipError ? err : toRipError(err, source, file);
    return re.format({ color });
  }
  function formatErrorHTML(err, { source, file } = {}) {
    let re = err instanceof RipError ? err : toRipError(err, source, file);
    return re.formatHTML();
  }
  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

  class CodeEmitter {
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
      program: "emitProgram",
      "&&": "emitLogicalAnd",
      "||": "emitLogicalOr",
      "+": "emitBinaryOp",
      "-": "emitBinaryOp",
      "*": "emitBinaryOp",
      "/": "emitBinaryOp",
      "%": "emitBinaryOp",
      "**": "emitBinaryOp",
      "==": "emitBinaryOp",
      "===": "emitBinaryOp",
      "!=": "emitBinaryOp",
      "!==": "emitBinaryOp",
      "<": "emitBinaryOp",
      ">": "emitBinaryOp",
      "<=": "emitBinaryOp",
      ">=": "emitBinaryOp",
      "??": "emitBinaryOp",
      "&": "emitBinaryOp",
      "|": "emitBinaryOp",
      "^": "emitBinaryOp",
      "<<": "emitBinaryOp",
      ">>": "emitBinaryOp",
      ">>>": "emitBinaryOp",
      "%%": "emitModulo",
      "%%=": "emitModuloAssign",
      "//": "emitFloorDiv",
      "//=": "emitFloorDivAssign",
      "..": "emitRange",
      "=": "emitAssignment",
      "+=": "emitAssignment",
      "-=": "emitAssignment",
      "*=": "emitAssignment",
      "/=": "emitAssignment",
      "%=": "emitAssignment",
      "**=": "emitAssignment",
      "&&=": "emitAssignment",
      "||=": "emitAssignment",
      "??=": "emitAssignment",
      "?=": "emitAssignment",
      "&=": "emitAssignment",
      "|=": "emitAssignment",
      "^=": "emitAssignment",
      "<<=": "emitAssignment",
      ">>=": "emitAssignment",
      ">>>=": "emitAssignment",
      "...": "emitRange",
      "!": "emitNot",
      "~": "emitBitwiseNot",
      "++": "emitIncDec",
      "--": "emitIncDec",
      "=~": "emitRegexMatch",
      instanceof: "emitInstanceof",
      in: "emitIn",
      of: "emitOf",
      typeof: "emitTypeof",
      delete: "emitDelete",
      new: "emitNew",
      array: "emitArray",
      object: "emitObject",
      "map-literal": "emitMap",
      block: "emitBlock",
      ".": "emitPropertyAccess",
      "?.": "emitOptionalProperty",
      "[]": "emitIndexAccess",
      optindex: "emitOptIndex",
      optcall: "emitOptCall",
      "regex-index": "emitRegexIndex",
      def: "emitDef",
      "->": "emitThinArrow",
      "=>": "emitFatArrow",
      return: "emitReturn",
      state: "emitState",
      computed: "emitComputed",
      readonly: "emitReadonly",
      effect: "emitEffect",
      break: "emitBreak",
      continue: "emitContinue",
      "?": "emitExistential",
      presence: "emitPresence",
      "?:": "emitTernary",
      "|>": "emitPipe",
      loop: "emitLoop",
      "loop-n": "emitLoopN",
      await: "emitAwait",
      yield: "emitYield",
      "yield-from": "emitYieldFrom",
      if: "emitIf",
      "for-in": "emitForIn",
      "for-of": "emitForOf",
      "for-as": "emitForAs",
      while: "emitWhile",
      try: "emitTry",
      throw: "emitThrow",
      control: "emitControl",
      switch: "emitSwitch",
      when: "emitWhen",
      comprehension: "emitComprehension",
      "object-comprehension": "emitObjectComprehension",
      class: "emitClass",
      super: "emitSuper",
      component: "emitComponent",
      render: "emitRender",
      offer: "emitOffer",
      accept: "emitAccept",
      enum: "emitEnum",
      import: "emitImport",
      export: "emitExport",
      "export-default": "emitExportDefault",
      "export-all": "emitExportAll",
      "export-from": "emitExportFrom",
      "do-iife": "emitDoIIFE",
      regex: "emitRegex",
      "tagged-template": "emitTaggedTemplate",
      str: "emitString"
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
    error(message, sexpr, { suggestion } = {}) {
      throw RipError.fromSExpr(message, sexpr, this.options.source, this.options.filename, suggestion);
    }
    compile(sexpr) {
      this.programVars = new Set;
      this.functionVars = new Map;
      this.helpers = new Set;
      this.scopeStack = [];
      this.collectProgramVariables(sexpr);
      let code = this.emit(sexpr);
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
      let start = head === "->" || head === "=>" ? 2 : 1;
      for (let i = start;i < node.length; i++) {
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
      if (CodeEmitter.ASSIGNMENT_OPS.has(head)) {
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
        if (CodeEmitter.ASSIGNMENT_OPS.has(head)) {
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
    emit(sexpr, context = "statement") {
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
        this.error(`Invalid s-expression: ${JSON.stringify(sexpr)}`, sexpr);
      let [head, ...rest] = sexpr;
      let headAwaitMeta = meta(head, "await");
      head = str(head);
      let method = CodeEmitter.GENERATORS[head];
      if (method)
        return this[method](head, rest, context, sexpr);
      if (typeof head === "string" && !head.startsWith('"') && !head.startsWith("'")) {
        if (CodeEmitter.NUMBER_START_RE.test(head))
          return head;
        if (head === "super" && this.currentMethodName && this.currentMethodName !== "constructor") {
          return `super.${this.currentMethodName}(${this._emitArgs(rest)})`;
        }
        let postfix = this._tryPostfixCall(head, rest, context);
        if (postfix)
          return postfix;
        let needsAwait = headAwaitMeta === true;
        let callStr = `${this.emit(head, "value")}(${this._emitArgs(rest)})`;
        return needsAwait ? `await ${callStr}` : callStr;
      }
      if (Array.isArray(head) && typeof head[0] === "string") {
        let stmtOps = ["=", "+=", "-=", "*=", "/=", "%=", "**=", "&&=", "||=", "??=", "if", "return", "throw"];
        if (stmtOps.includes(head[0])) {
          return `(${sexpr.map((stmt) => this.emit(stmt, "value")).join(", ")})`;
        }
      }
      if (Array.isArray(head)) {
        if (head[0] === "." && (head[2] === "new" || str(head[2]) === "new")) {
          let ctorExpr = head[1];
          let ctorCode = this.emit(ctorExpr, "value");
          let needsParens = Array.isArray(ctorExpr);
          return `new ${needsParens ? `(${ctorCode})` : ctorCode}(${this._emitArgs(rest)})`;
        }
        let postfix = this._tryPostfixCall(head, rest, context);
        if (postfix)
          return postfix;
        let needsAwait = false;
        let calleeCode;
        if (head[0] === "." && meta(head[2], "await") === true) {
          needsAwait = true;
          let [obj, prop] = head.slice(1);
          let objCode = this.emit(obj, "value");
          let needsParens = CodeEmitter.NUMBER_LITERAL_RE.test(objCode) || (this.is(obj, "object") || this.is(obj, "await") || this.is(obj, "yield"));
          let base = needsParens ? `(${objCode})` : objCode;
          calleeCode = `${base}.${str(prop)}`;
        } else {
          calleeCode = this.emit(head, "value");
        }
        let callStr = `${calleeCode}(${this._emitArgs(rest)})`;
        return needsAwait ? `await ${callStr}` : callStr;
      }
      this.error(`Unknown s-expression type: ${head}`, sexpr);
    }
    emitProgram(head, statements, context, sexpr) {
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
      let prevInlinePending = this._inlineVarsPending;
      let programInlineVars = new Set;
      if (this.programVars.size > 0 && body.length > 0) {
        let classified = this.classifyVarsForInlining(body, this.programVars);
        programInlineVars = classified.inlineVars;
        programInlineVars.delete("_");
        if (programInlineVars.size > 0)
          this._inlineVarsPending = new Set(programInlineVars);
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
          generated = `(${this.emit(stmt, "value")})`;
        else if (isLastComp)
          generated = this.emit(stmt, "value");
        else
          generated = this.emit(stmt, "statement");
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
      this._inlineVarsPending = prevInlinePending;
      let needsBlank = false;
      if (imports.length > 0) {
        code += imports.map((s) => this.addSemicolon(s, this.emit(s, "statement"))).join(`
`);
        needsBlank = true;
      }
      if (this.programVars.size > 0) {
        let hasUnderscore = this.programVars.has("_");
        if (hasUnderscore)
          this.programVars.delete("_");
        if (this.programVars.size > 0) {
          let vars = Array.from(this.programVars).filter((v) => !programInlineVars.has(v)).sort().join(", ");
          if (vars) {
            if (needsBlank)
              code += `
`;
            code += `let ${vars};
`;
            needsBlank = true;
          }
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
    emitBinaryOp(op, rest, context, sexpr) {
      if ((op === "+" || op === "-") && rest.length === 1) {
        return `(${op}${this.emit(rest[0], "value")})`;
      }
      let [left, right] = rest;
      if (op === "*") {
        let leftStr = left?.valueOf?.() ?? left;
        if (typeof leftStr === "string" && /^["']/.test(leftStr)) {
          return `${this.emit(left, "value")}.repeat(${this.emit(right, "value")})`;
        }
      }
      let COMPARE_OPS = new Set(["<", ">", "<=", ">="]);
      if (COMPARE_OPS.has(op) && Array.isArray(left)) {
        let leftOp = left[0]?.valueOf?.() ?? left[0];
        if (COMPARE_OPS.has(leftOp)) {
          let a = this.emit(left[1], "value");
          let b = this.emit(left[2], "value");
          let c = this.emit(right, "value");
          return `((${a} ${leftOp} ${b}) && (${b} ${op} ${c}))`;
        }
      }
      if (op === "==")
        op = "===";
      if (op === "!=")
        op = "!==";
      return `(${this.emit(left, "value")} ${op} ${this.emit(right, "value")})`;
    }
    emitModulo(head, rest) {
      let [left, right] = rest;
      this.helpers.add("modulo");
      return `modulo(${this.emit(left, "value")}, ${this.emit(right, "value")})`;
    }
    emitModuloAssign(head, rest) {
      let [target, value] = rest;
      this.helpers.add("modulo");
      let t = this.emit(target, "value"), v = this.emit(value, "value");
      return `${t} = modulo(${t}, ${v})`;
    }
    emitFloorDiv(head, rest) {
      let [left, right] = rest;
      return `Math.floor(${this.emit(left, "value")} / ${this.emit(right, "value")})`;
    }
    emitFloorDivAssign(head, rest) {
      let [target, value] = rest;
      let t = this.emit(target, "value"), v = this.emit(value, "value");
      return `${t} = Math.floor(${t} / ${v})`;
    }
    emitAssignment(head, rest, context, sexpr) {
      let [target, value] = rest;
      let op = head === "?=" ? "??=" : head;
      let optInfo = this._findOptionalInTarget(target);
      if (optInfo) {
        let guardCode = this.emit(optInfo.guard, "value");
        let targetCode2 = this.emit(optInfo.rewritten, "value");
        let valueCode2 = this.emit(value, "value");
        if (context === "value") {
          return `(${guardCode} != null ? (${targetCode2} ${op} ${valueCode2}) : undefined)`;
        }
        return `if (${guardCode} != null) ${targetCode2} ${op} ${valueCode2}`;
      }
      let isFnValue = this.is(value, "->") || this.is(value, "=>") || this.is(value, "def");
      if (target instanceof String && meta(target, "await") !== undefined && !isFnValue) {
        let sigil = meta(target, "await") === true ? "!" : "&";
        this.error(`Cannot use ${sigil} sigil in variable declaration '${str(target)}'`, sexpr);
      }
      if (target instanceof String && meta(target, "await") === true && isFnValue) {
        this.nextFunctionIsVoid = true;
      }
      let isEmptyArr = this.is(target, "array", 0);
      let isEmptyObj = this.is(target, "object", 0);
      if (isEmptyArr || isEmptyObj) {
        let v = this.emit(value, "value");
        return isEmptyObj && context === "statement" ? `(${v})` : v;
      }
      if (Array.isArray(value) && op === "=" && value[0] === "control") {
        let [, rawCtrlOp, expr, ctrlSexpr] = value;
        let ctrlOp = str(rawCtrlOp);
        let isReturn = ctrlSexpr[0] === "return";
        let targetCode2 = this.emit(target, "value");
        let exprCode = this.emit(expr, "value");
        let ctrlValue = ctrlSexpr.length > 1 ? ctrlSexpr[1] : null;
        let ctrlCode = isReturn ? ctrlValue ? `return ${this.emit(ctrlValue, "value")}` : "return" : ctrlValue ? `throw ${this.emit(ctrlValue, "value")}` : "throw new Error()";
        if (context === "value") {
          if (ctrlOp === "??")
            return `(() => { const __v = ${exprCode}; if (__v == null) ${ctrlCode}; return (${targetCode2} = __v); })()`;
          if (ctrlOp === "||")
            return `(() => { const __v = ${exprCode}; if (!__v) ${ctrlCode}; return (${targetCode2} = __v); })()`;
          return `(() => { const __v = ${exprCode}; if (__v) ${ctrlCode}; return (${targetCode2} = __v); })()`;
        }
        let tgtName = typeof target === "string" ? target : target instanceof String ? str(target) : null;
        if (tgtName && context === "statement" && this._inlineVarsPending?.delete(tgtName)) {
          let ind = this.indent();
          if (ctrlOp === "??")
            return `let ${targetCode2} = ${exprCode};
${ind}if (${targetCode2} == null) ${ctrlCode}`;
          if (ctrlOp === "||")
            return `let ${targetCode2} = ${exprCode};
${ind}if (!${targetCode2}) ${ctrlCode}`;
          return `let ${targetCode2} = ${exprCode};
${ind}if (${targetCode2}) ${ctrlCode}`;
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
            let valueCode2 = this.emit(value, "value");
            let beforeRest = elements.slice(0, restIdx);
            let beforePattern = beforeRest.map((el) => el === "," ? "" : typeof el === "string" ? el : this.emit(el, "value")).join(", ");
            let afterPattern = afterRest.map((el) => el === "," ? "" : typeof el === "string" ? el : this.emit(el, "value")).join(", ");
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
          let t = this.emit(target, "value"), c = this.emit(condition, "value"), v = this.emit(fullValue, "value");
          let tgtName = typeof target === "string" ? target : target instanceof String ? str(target) : null;
          if (tgtName && this._inlineVarsPending?.delete(tgtName))
            return `let ${t};
${this.indent()}if (${c}) ${t} = ${v}`;
          return `if (${c}) ${t} = ${v}`;
        }
      }
      if (context === "statement" && head === "=" && Array.isArray(value) && value.length === 3) {
        let [valHead, condition, actualValue] = value;
        let isPostfix = Array.isArray(actualValue) && actualValue.length === 1 && (!Array.isArray(actualValue[0]) || actualValue[0][0] !== "block");
        if (valHead === "if" && isPostfix) {
          let unwrapped = Array.isArray(actualValue) && actualValue.length === 1 ? actualValue[0] : actualValue;
          let t = this.emit(target, "value");
          let condCode = this.unwrapLogical(this.emit(condition, "value"));
          let v = this.emit(unwrapped, "value");
          let tgtName = typeof target === "string" ? target : target instanceof String ? str(target) : null;
          if (tgtName && this._inlineVarsPending?.delete(tgtName))
            return `let ${t};
${this.indent()}if (${condCode}) ${t} = ${v}`;
          return `if (${condCode}) ${t} = ${v}`;
        }
      }
      let targetCode;
      if (target instanceof String && meta(target, "await") !== undefined) {
        targetCode = str(target);
      } else if (typeof target === "string" && this.reactiveVars?.has(target)) {
        targetCode = `${target}.value`;
      } else {
        targetCode = this.emit(target, "value");
      }
      const prevComponentName = this._componentName;
      const prevComponentTypeParams = this._componentTypeParams;
      if (this.is(value, "component") && (typeof target === "string" || target instanceof String)) {
        this._componentName = str(target);
        this._componentTypeParams = target.typeParams || "";
      }
      let valueCode = this.emit(value, "value");
      this._componentName = prevComponentName;
      this._componentTypeParams = prevComponentTypeParams;
      let isObjLit = this.is(value, "object");
      if (!isObjLit)
        valueCode = this.unwrap(valueCode);
      let targetName = typeof target === "string" ? target : target instanceof String ? str(target) : null;
      if (head === "=" && targetName && context === "statement" && this._inlineVarsPending?.delete(targetName)) {
        return `let ${targetCode} = ${valueCode}`;
      }
      let needsParensVal = context === "value";
      let needsParensObj = context === "statement" && this.is(target, "object");
      if (needsParensVal || needsParensObj)
        return `(${targetCode} ${op} ${valueCode})`;
      return `${targetCode} ${op} ${valueCode}`;
    }
    emitPropertyAccess(head, rest, context, sexpr) {
      let [obj, prop] = rest;
      if (this._atParamMap && obj === "this") {
        let mapped = this._atParamMap.get(str(prop));
        if (mapped)
          return mapped;
      }
      let objCode = this.emit(obj, "value");
      let needsParens = CodeEmitter.NUMBER_LITERAL_RE.test(objCode) || objCode.startsWith("await ") || (this.is(obj, "object") || this.is(obj, "yield"));
      let base = needsParens ? `(${objCode})` : objCode;
      if (meta(prop, "await") === true)
        return `await ${base}.${str(prop)}()`;
      if (meta(prop, "predicate"))
        return `(${base}.${str(prop)} != null)`;
      return `${base}.${str(prop)}`;
    }
    emitOptionalProperty(head, rest) {
      let [obj, prop] = rest;
      return `${this.emit(obj, "value")}?.${prop}`;
    }
    emitRegexIndex(head, rest) {
      let [value, regex, captureIndex] = rest;
      this.helpers.add("toMatchable");
      this.programVars.add("_");
      let v = this.emit(value, "value"), r = this.emit(regex, "value");
      let idx = captureIndex !== null ? this.emit(captureIndex, "value") : "0";
      let allowNL = r.includes("/m") ? ", true" : "";
      return `(_ = toMatchable(${v}${allowNL}).match(${r})) && _[${idx}]`;
    }
    emitIndexAccess(head, rest) {
      let [arr, index] = rest;
      if (this.is(index, "..") || this.is(index, "...")) {
        let isIncl = index[0] === "..";
        let arrCode = this.emit(arr, "value");
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
          let e2 = this.emit(end, "value");
          return isIncl ? inclEnd("0", e2, end) : `${arrCode}.slice(0, ${e2})`;
        }
        if (end === null)
          return `${arrCode}.slice(${this.emit(start, "value")})`;
        let s = this.emit(start, "value");
        if (isIncl && this.is(end, "-", 1) && (str(end[1]) ?? end[1]) == 1)
          return `${arrCode}.slice(${s})`;
        let e = this.emit(end, "value");
        return isIncl ? inclEnd(s, e, end) : `${arrCode}.slice(${s}, ${e})`;
      }
      if (this.is(index, "-", 1)) {
        let n = str(index[1]) ?? index[1];
        if (typeof n === "number" || typeof n === "string" && /^\d+$/.test(n)) {
          return `${this.emit(arr, "value")}.at(-${n})`;
        }
      }
      return `${this.emit(arr, "value")}[${this.unwrap(this.emit(index, "value"))}]`;
    }
    emitOptIndex(head, rest) {
      let [arr, index] = rest;
      if (this.is(index, "-", 1)) {
        let n = str(index[1]) ?? index[1];
        if (typeof n === "number" || typeof n === "string" && /^\d+$/.test(n)) {
          return `${this.emit(arr, "value")}?.at(-${n})`;
        }
      }
      return `${this.emit(arr, "value")}?.[${this.emit(index, "value")}]`;
    }
    emitOptCall(head, rest) {
      let [fn, ...args] = rest;
      return `${this.emit(fn, "value")}?.(${args.map((a) => this.emit(a, "value")).join(", ")})`;
    }
    emitDef(head, rest, context, sexpr) {
      let [name, params, body] = rest;
      let sideEffectOnly = meta(name, "await") === true;
      let cleanName = str(name);
      let paramList = this.emitParamList(params);
      let bodyCode = this.emitFunctionBody(body, params, sideEffectOnly);
      let isAsync = this.containsAwait(body);
      let isGen = this.containsYield(body);
      return `${isAsync ? "async " : ""}function${isGen ? "*" : ""} ${cleanName}(${paramList}) ${bodyCode}`;
    }
    emitThinArrow(head, rest, context, sexpr) {
      let [params, body] = rest;
      if ((!params || Array.isArray(params) && params.length === 0) && this.containsIt(body))
        params = ["it"];
      let sideEffectOnly = this.nextFunctionIsVoid || false;
      this.nextFunctionIsVoid = false;
      let paramList = this.emitParamList(params);
      let bodyCode = this.emitFunctionBody(body, params, sideEffectOnly);
      let isAsync = this.containsAwait(body);
      let isGen = this.containsYield(body);
      let fn = `${isAsync ? "async " : ""}function${isGen ? "*" : ""}(${paramList}) ${bodyCode}`;
      return context === "value" ? `(${fn})` : fn;
    }
    emitFatArrow(head, rest, context, sexpr) {
      let [params, body] = rest;
      if ((!params || Array.isArray(params) && params.length === 0) && this.containsIt(body))
        params = ["it"];
      let sideEffectOnly = this.nextFunctionIsVoid || false;
      this.nextFunctionIsVoid = false;
      let paramList = this.emitParamList(params);
      let isSingle = params.length === 1 && typeof params[0] === "string" && !paramList.includes("=") && !paramList.includes("...") && !paramList.includes("[") && !paramList.includes("{");
      let paramSyntax = isSingle ? paramList : `(${paramList})`;
      let isAsync = this.containsAwait(body);
      let prefix = isAsync ? "async " : "";
      if (!sideEffectOnly) {
        if (this.is(body, "block") && body.length === 2) {
          let expr = body[1];
          let exprHead = Array.isArray(expr) ? expr[0] : null;
          if (exprHead !== "return" && !STMT_ONLY.has(exprHead)) {
            let code = this.emit(expr, "value");
            if (code[0] === "{")
              code = `(${code})`;
            return `${prefix}${paramSyntax} => ${code}`;
          }
        }
        if (!Array.isArray(body) || body[0] !== "block") {
          let code = this.emit(body, "value");
          if (code[0] === "{")
            code = `(${code})`;
          return `${prefix}${paramSyntax} => ${code}`;
        }
      }
      let bodyCode = this.emitFunctionBody(body, params, sideEffectOnly);
      return `${prefix}${paramSyntax} => ${bodyCode}`;
    }
    emitReturn(head, rest, context, sexpr) {
      if (rest.length === 0)
        return "return";
      let [expr] = rest;
      if (this.sideEffectOnly && !(this.is(expr, "->") || this.is(expr, "=>"))) {
        this.error("Cannot return a value from a void function (declared with !)", sexpr);
      }
      if (this.is(expr, "if")) {
        let [, condition, body, ...elseParts] = expr;
        if (elseParts.length === 0) {
          let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
          return `if (${this.emit(condition, "value")}) return ${this.emit(val, "value")}`;
        }
      }
      if (this.is(expr, "new") && Array.isArray(expr[1]) && expr[1][0] === "if") {
        let [, condition, body] = expr[1];
        let val = Array.isArray(body) && body.length === 1 ? body[0] : body;
        return `if (${this.emit(condition, "value")}) return ${this.emit(["new", val], "value")}`;
      }
      return `return ${this.emit(expr, "value")}`;
    }
    emitState(head, rest) {
      let [name, expr] = rest;
      this.usesReactivity = true;
      let varName = str(name) ?? name;
      if (!this.reactiveVars)
        this.reactiveVars = new Set;
      this.reactiveVars.add(varName);
      return `const ${varName} = __state(${this.emit(expr, "value")})`;
    }
    emitComputed(head, rest) {
      let [name, expr] = rest;
      this.usesReactivity = true;
      if (!this.reactiveVars)
        this.reactiveVars = new Set;
      let varName = str(name) ?? name;
      this.reactiveVars.add(varName);
      if (this.is(expr, "block") && expr.length > 2) {
        return `const ${varName} = __computed(() => ${this.emitFunctionBody(expr)})`;
      }
      return `const ${varName} = __computed(() => ${this.emit(expr, "value")})`;
    }
    emitReadonly(head, rest) {
      let [name, expr] = rest;
      return `const ${str(name) ?? name} = ${this.emit(expr, "value")}`;
    }
    emitEffect(head, rest) {
      let [target, body] = rest;
      this.usesReactivity = true;
      let bodyCode;
      if (this.is(body, "block")) {
        bodyCode = this.emitFunctionBody(body);
      } else if (this.is(body, "->") || this.is(body, "=>")) {
        let fnCode = this.emit(body, "value");
        if (target)
          return `const ${str(target) ?? this.emit(target, "value")} = __effect(${fnCode})`;
        return `__effect(${fnCode})`;
      } else {
        bodyCode = `{ ${this.emit(body, "value")}; }`;
      }
      let effectCode = `__effect(() => ${bodyCode})`;
      if (target)
        return `const ${str(target) ?? this.emit(target, "value")} = ${effectCode}`;
      return effectCode;
    }
    emitBreak() {
      return "break";
    }
    emitContinue() {
      return "continue";
    }
    emitExistential(head, rest) {
      return `(${this.emit(rest[0], "value")} != null)`;
    }
    emitPresence(head, rest) {
      return `(${this.emit(rest[0], "value")} ? true : undefined)`;
    }
    emitTernary(head, rest, context) {
      let [cond, then_, else_] = rest;
      let thenHead = then_?.[0]?.valueOf?.() ?? then_?.[0];
      if (thenHead === "=" && Array.isArray(then_)) {
        let target = this.emit(then_[1], "value");
        let thenVal = this.emit(then_[2], "value");
        let elseVal = this.emit(else_, "value");
        return `${target} = (${this.unwrap(this.emit(cond, "value"))} ? ${thenVal} : ${elseVal})`;
      }
      return `(${this.unwrap(this.emit(cond, "value"))} ? ${this.emit(then_, "value")} : ${this.emit(else_, "value")})`;
    }
    emitPipe(head, rest) {
      let [left, right] = rest;
      let leftCode = this.emit(left, "value");
      if (Array.isArray(right) && right.length > 1) {
        let fn = right[0];
        let isCall = Array.isArray(fn) || typeof fn === "string" && /^[a-zA-Z_$]/.test(fn);
        if (isCall) {
          let fnCode = this.emit(fn, "value");
          let args = right.slice(1).map((a) => this.emit(a, "value"));
          return `${fnCode}(${leftCode}, ${args.join(", ")})`;
        }
      }
      return `${this.emit(right, "value")}(${leftCode})`;
    }
    emitLoop(head, rest) {
      return `while (true) ${this.emitLoopBody(rest[0])}`;
    }
    emitLoopN(head, rest) {
      let [count, body] = rest;
      let n = this.emit(count, "value");
      return `for (let it = 0; it < ${n}; it++) ${this.emitLoopBody(body)}`;
    }
    emitAwait(head, rest) {
      return `await ${this.emit(rest[0], "value")}`;
    }
    emitYield(head, rest) {
      return rest.length === 0 ? "yield" : `yield ${this.emit(rest[0], "value")}`;
    }
    emitYieldFrom(head, rest) {
      return `yield* ${this.emit(rest[0], "value")}`;
    }
    emitIf(head, rest, context, sexpr) {
      let [condition, thenBranch, ...elseBranches] = rest;
      return context === "value" ? this.emitIfAsExpression(condition, thenBranch, elseBranches) : this.emitIfAsStatement(condition, thenBranch, elseBranches);
    }
    emitForIn(head, rest, context, sexpr) {
      let [vars, iterable, step, guard, body] = rest;
      if (context === "value" && this.comprehensionDepth === 0) {
        let iterator = ["for-in", vars, iterable, step];
        return this.emit(["comprehension", body, [iterator], guard ? [guard] : []], context);
      }
      let varsArray = Array.isArray(vars) ? vars : [vars];
      let noVar = varsArray.length === 0;
      let [itemVar, indexVar] = noVar ? ["_i", null] : varsArray;
      let itemVarPattern = this.is(itemVar, "array") || this.is(itemVar, "object") ? this.emitDestructuringPattern(itemVar) : itemVar;
      if (step && step !== null) {
        let iterCode = this.emit(iterable, "value");
        let idxName = indexVar || "_i";
        let stepCode = this.emit(step, "value");
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
            lines.push(`if (${this.emit(guard, "value")}) {`);
            this.indentLevel++;
            lines.push(...this.formatStatements(stmts));
            this.indentLevel--;
            lines.push(this.indent() + "}");
          } else {
            lines.push(...stmts.map((s) => this.addSemicolon(s, this.emit(s, "statement"))));
          }
          this.indentLevel--;
          return loopHeader + `{
${lines.map((s) => this.indent() + s).join(`
`)}
${this.indent()}}`;
        }
        if (noVar) {
          return guard ? loopHeader + `{ if (${this.emit(guard, "value")}) ${this.emit(body, "statement")}; }` : loopHeader + `{ ${this.emit(body, "statement")}; }`;
        }
        return guard ? loopHeader + `{ const ${itemVarPattern} = ${iterCode}[${idxName}]; if (${this.emit(guard, "value")}) ${this.emit(body, "statement")}; }` : loopHeader + `{ const ${itemVarPattern} = ${iterCode}[${idxName}]; ${this.emit(body, "statement")}; }`;
      }
      if (indexVar) {
        let iterCode = this.emit(iterable, "value");
        let code2 = `for (let ${indexVar} = 0; ${indexVar} < ${iterCode}.length; ${indexVar}++) `;
        if (this.is(body, "block")) {
          code2 += `{
`;
          this.indentLevel++;
          code2 += this.indent() + `const ${itemVarPattern} = ${iterCode}[${indexVar}];
`;
          if (guard) {
            code2 += this.indent() + `if (${this.unwrap(this.emit(guard, "value"))}) {
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
          code2 += guard ? `{ const ${itemVarPattern} = ${iterCode}[${indexVar}]; if (${this.unwrap(this.emit(guard, "value"))}) ${this.emit(body, "statement")}; }` : `{ const ${itemVarPattern} = ${iterCode}[${indexVar}]; ${this.emit(body, "statement")}; }`;
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
          let s = this.emit(start, "value"), e = this.emit(end, "value");
          let cmp = isExcl ? "<" : "<=";
          let inc = step ? `${itemVarPattern} += ${this.emit(step, "value")}` : `${itemVarPattern}++`;
          let code2 = `for (let ${itemVarPattern} = ${s}; ${itemVarPattern} ${cmp} ${e}; ${inc}) `;
          code2 += guard ? this.emitLoopBodyWithGuard(body, guard) : this.emitLoopBody(body);
          return code2;
        }
      }
      let code = `for (const ${itemVarPattern} of ${this.emit(iterable, "value")}) `;
      code += guard ? this.emitLoopBodyWithGuard(body, guard) : this.emitLoopBody(body);
      return code;
    }
    emitForOf(head, rest, context, sexpr) {
      let [vars, obj, own, guard, body] = rest;
      if (context === "value" && this.comprehensionDepth === 0) {
        let iterator = ["for-of", vars, obj, own];
        return this.emit(["comprehension", body, [iterator], guard ? [guard] : []], context);
      }
      let [keyVar, valueVar] = Array.isArray(vars) ? vars : [vars];
      let objCode = this.emit(obj, "value");
      let code = `for (const ${keyVar} in ${objCode}) `;
      if (own && !valueVar && !guard) {
        if (this.is(body, "block")) {
          this.indentLevel++;
          let stmts = [`if (!Object.hasOwn(${objCode}, ${keyVar})) continue;`, ...body.slice(1).map((s) => this.addSemicolon(s, this.emit(s, "statement")))];
          this.indentLevel--;
          return code + `{
${stmts.map((s) => this.indent() + s).join(`
`)}
${this.indent()}}`;
        }
        return code + `{ if (!Object.hasOwn(${objCode}, ${keyVar})) continue; ${this.emit(body, "statement")}; }`;
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
            lines.push(`if (${this.emit(guard, "value")}) {`);
            this.indentLevel++;
            lines.push(...stmts.map((s) => this.addSemicolon(s, this.emit(s, "statement"))));
            this.indentLevel--;
            lines.push(this.indent() + "}");
          } else {
            lines.push(...stmts.map((s) => this.addSemicolon(s, this.emit(s, "statement"))));
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
          inline += `if (${this.emit(guard, "value")}) `;
        inline += `${this.emit(body, "statement")};`;
        return code + `{ ${inline} }`;
      }
      code += guard ? this.emitLoopBodyWithGuard(body, guard) : this.emitLoopBody(body);
      return code;
    }
    emitForAs(head, rest, context, sexpr) {
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
          let beforePattern = beforeRest.map((el) => el === "," ? "" : typeof el === "string" ? el : this.emit(el, "value")).join(", ");
          let firstPattern = beforePattern ? `${beforePattern}, ...${restVar}` : `...${restVar}`;
          let afterPattern = afterRest.map((el) => el === "," ? "" : typeof el === "string" ? el : this.emit(el, "value")).join(", ");
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
      let iterCode = this.emit(iterable, "value");
      let awaitKw = isAwait ? "await " : "";
      let itemVarPattern;
      if (needsTempVar)
        itemVarPattern = "_item";
      else if (this.is(firstVar, "array") || this.is(firstVar, "object"))
        itemVarPattern = this.emitDestructuringPattern(firstVar);
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
        code += guard ? this.emitLoopBodyWithGuard(body, guard) : this.emitLoopBody(body);
      }
      return code;
    }
    emitWhile(head, rest) {
      let cond = rest[0], guard = rest.length === 3 ? rest[1] : null, body = rest[rest.length - 1];
      let code = `while (${this.unwrap(this.emit(cond, "value"))}) `;
      return code + (guard ? this.emitLoopBodyWithGuard(body, guard) : this.emitLoopBody(body));
    }
    emitRange(head, rest) {
      if (head === "...") {
        if (rest.length === 1)
          return `...${this.emit(rest[0], "value")}`;
        let [s2, e2] = rest;
        let sc2 = this.emit(s2, "value"), ec2 = this.emit(e2, "value");
        return `((s, e) => Array.from({length: Math.max(0, Math.abs(e - s))}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${sc2}, ${ec2})`;
      }
      let [s, e] = rest;
      let sc = this.emit(s, "value"), ec = this.emit(e, "value");
      return `((s, e) => Array.from({length: Math.abs(e - s) + 1}, (_, i) => s + (i * (s <= e ? 1 : -1))))(${sc}, ${ec})`;
    }
    emitNot(head, rest) {
      let [operand] = rest;
      if (typeof operand === "string" || operand instanceof String)
        return `!${this.emit(operand, "value")}`;
      if (Array.isArray(operand)) {
        let highPrec = [".", "?.", "[]", "optindex", "optcall"];
        if (highPrec.includes(operand[0]))
          return `!${this.emit(operand, "value")}`;
      }
      let code = this.emit(operand, "value");
      return code.startsWith("(") ? `!${code}` : `(!${code})`;
    }
    emitBitwiseNot(head, rest) {
      return `(~${this.emit(rest[0], "value")})`;
    }
    emitIncDec(head, rest) {
      let [operand, isPostfix] = rest;
      let code = this.emit(operand, "value");
      return isPostfix ? `(${code}${head})` : `(${head}${code})`;
    }
    emitTypeof(head, rest) {
      return `typeof ${this.emit(rest[0], "value")}`;
    }
    emitDelete(head, rest) {
      return `(delete ${this.emit(rest[0], "value")})`;
    }
    emitInstanceof(head, rest, context, sexpr) {
      let [expr, type] = rest;
      let isNeg = meta(sexpr[0], "invert");
      let result = `(${this.emit(expr, "value")} instanceof ${this.emit(type, "value")})`;
      return isNeg ? `(!${result})` : result;
    }
    emitIn(head, rest, context, sexpr) {
      let [key, container] = rest;
      let keyCode = this.emit(key, "value");
      let isNeg = meta(sexpr[0], "invert");
      if (this.is(container, "object")) {
        let result2 = `(${keyCode} in ${this.emit(container, "value")})`;
        return isNeg ? `(!${result2})` : result2;
      }
      let c = this.emit(container, "value");
      let result = `(Array.isArray(${c}) || typeof ${c} === 'string' ? ${c}.includes(${keyCode}) : (${keyCode} in ${c}))`;
      return isNeg ? `(!${result})` : result;
    }
    emitOf(head, rest, context, sexpr) {
      let [value, container] = rest;
      let v = this.emit(value, "value"), c = this.emit(container, "value");
      let isNeg = meta(sexpr[0], "invert");
      let result = `(${v} in ${c})`;
      return isNeg ? `(!${result})` : result;
    }
    emitRegexMatch(head, rest) {
      let [left, right] = rest;
      this.helpers.add("toMatchable");
      this.programVars.add("_");
      let r = this.emit(right, "value");
      let allowNL = r.includes("/m") ? ", true" : "";
      return `(_ = toMatchable(${this.emit(left, "value")}${allowNL}).match(${r}))`;
    }
    emitNew(head, rest) {
      let [call] = rest;
      if (this.is(call, ".") || this.is(call, "?.")) {
        let [accType, target, prop] = call;
        if (Array.isArray(target) && !target[0].startsWith) {
          return `(${this.emit(["new", target], "value")}).${prop}`;
        }
        return `new ${this.emit(target, "value")}.${prop}`;
      }
      if (Array.isArray(call)) {
        let [ctor, ...args] = call;
        return `new ${this.emit(ctor, "value")}(${args.map((a) => this.unwrap(this.emit(a, "value"))).join(", ")})`;
      }
      return `new ${this.emit(call, "value")}()`;
    }
    emitLogicalAnd(head, rest, context, sexpr) {
      let ops = this.flattenBinaryChain(sexpr).slice(1);
      if (ops.length === 0)
        return "true";
      if (ops.length === 1)
        return this.emit(ops[0], "value");
      return `(${ops.map((o) => this.emit(o, "value")).join(" && ")})`;
    }
    emitLogicalOr(head, rest, context, sexpr) {
      let ops = this.flattenBinaryChain(sexpr).slice(1);
      if (ops.length === 0)
        return "true";
      if (ops.length === 1)
        return this.emit(ops[0], "value");
      return `(${ops.map((o) => this.emit(o, "value")).join(" || ")})`;
    }
    emitArray(head, elements) {
      let hasTrailingElision = elements.length > 0 && elements[elements.length - 1] === ",";
      let codes = elements.map((el) => {
        if (el === ",")
          return "";
        if (el === "...")
          return "";
        if (this.is(el, "..."))
          return `...${this.emit(el[1], "value")}`;
        return this.emit(el, "value");
      }).join(", ");
      return hasTrailingElision ? `[${codes},]` : `[${codes}]`;
    }
    emitObject(head, pairs, context) {
      if (pairs.length === 1 && Array.isArray(pairs[0]) && Array.isArray(pairs[0][2]) && pairs[0][2][0] === "comprehension") {
        let [, keyVar, compNode] = pairs[0];
        let [, valueExpr, iterators, guards] = compNode;
        return this.emit(["object-comprehension", keyVar, valueExpr, iterators, guards], context);
      }
      let codes = pairs.map((pair) => {
        if (this.is(pair, "..."))
          return `...${this.emit(pair[1], "value")}`;
        let [operator, key, value] = pair;
        let keyCode;
        if (this.is(key, "dynamicKey"))
          keyCode = `[${this.emit(key[1], "value")}]`;
        else if (this.is(key, "str"))
          keyCode = `[${this.emit(key, "value")}]`;
        else {
          this.suppressReactiveUnwrap = true;
          keyCode = this.emit(key, "value");
          this.suppressReactiveUnwrap = false;
        }
        let valCode = this.emit(value, "value");
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
    emitMap(head, pairs, context) {
      if (pairs.length === 0)
        return "new Map()";
      let entries = pairs.map((pair) => {
        if (this.is(pair, "..."))
          return `...${this.emit(pair[1], "value")}`;
        let [, key, value] = pair;
        let keyCode;
        if (Array.isArray(key)) {
          keyCode = this.emit(key, "value");
        } else {
          let k = str(key) ?? key;
          let isIdentifier = !k.startsWith('"') && !k.startsWith("'") && !k.startsWith("/") && !CodeEmitter.NUMBER_START_RE.test(k) && !MAP_LITERAL_KEYS.has(k);
          keyCode = isIdentifier ? `"${k}"` : this.emit(key, "value");
        }
        let valCode = this.emit(value, "value");
        return `[${keyCode}, ${valCode}]`;
      }).join(", ");
      return `new Map([${entries}])`;
    }
    emitBlock(head, statements, context) {
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
        return this.emit(statements[0], context);
      let last = statements[statements.length - 1];
      let lastIsCtrl = Array.isArray(last) && ["break", "continue", "return", "throw"].includes(last[0]);
      if (lastIsCtrl) {
        let parts = statements.map((s) => this.addSemicolon(s, this.emit(s, "statement")));
        return `{
${this.withIndent(() => parts.map((p) => this.indent() + p).join(`
`))}
${this.indent()}}`;
      }
      return `(${statements.map((s) => this.emit(s, "value")).join(", ")})`;
    }
    emitTry(head, rest, context) {
      let needsReturns = context === "value";
      let tryCode = "try ";
      let tryBlock = rest[0];
      tryCode += needsReturns && this.is(tryBlock, "block") ? this.emitBlockWithReturns(tryBlock) : this.emit(tryBlock, "statement");
      if (rest.length >= 2 && Array.isArray(rest[1]) && rest[1].length === 2 && rest[1][0] !== "block") {
        let [param, catchBlock] = rest[1];
        tryCode += " catch";
        if (param && (this.is(param, "object") || this.is(param, "array"))) {
          tryCode += " (error)";
          let destructStmt = `(${this.emit(param, "value")} = error)`;
          catchBlock = this.is(catchBlock, "block") ? ["block", destructStmt, ...catchBlock.slice(1)] : ["block", destructStmt, catchBlock];
        } else if (param) {
          tryCode += ` (${param})`;
        }
        tryCode += " " + (needsReturns && this.is(catchBlock, "block") ? this.emitBlockWithReturns(catchBlock) : this.emit(catchBlock, "statement"));
      } else if (rest.length === 2) {
        tryCode += " finally " + this.emit(rest[1], "statement");
      }
      if (rest.length === 3)
        tryCode += " finally " + this.emit(rest[2], "statement");
      if (rest.length === 1)
        tryCode += " catch {}";
      if (needsReturns) {
        let hasAwait = this.containsAwait(rest[0]) || rest[1] && this.containsAwait(rest[1]) || rest[2] && this.containsAwait(rest[2]);
        return this.asyncIIFE(hasAwait, tryCode);
      }
      return tryCode;
    }
    emitThrow(head, rest, context) {
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
          let condCode = this.emit(condition, "value");
          let throwCode = `throw ${this.emit(expr, "value")}`;
          return `if (${condCode}) {
${this.indent()}  ${throwCode};
${this.indent()}}`;
        }
      }
      let throwStmt = `throw ${this.emit(expr, "value")}`;
      return context === "value" ? `(() => { ${throwStmt}; })()` : throwStmt;
    }
    emitControl(head, rest, context) {
      let [rawOp, expr, ctrlSexpr] = rest;
      let op = str(rawOp);
      let isReturn = ctrlSexpr[0] === "return";
      let exprCode = this.emit(expr, "value");
      let ctrlValue = ctrlSexpr.length > 1 ? ctrlSexpr[1] : null;
      let ctrlCode = isReturn ? ctrlValue ? `return ${this.emit(ctrlValue, "value")}` : "return" : ctrlValue ? `throw ${this.emit(ctrlValue, "value")}` : "throw new Error()";
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
    emitSwitch(head, rest, context) {
      let [disc, whens, defaultCase] = rest;
      if (disc === null)
        return this.emitSwitchAsIfChain(whens, defaultCase, context);
      let switchBody = `switch (${this.emit(disc, "value")}) {
`;
      this.indentLevel++;
      for (let clause of whens) {
        let [, test, body] = clause;
        for (let t of test) {
          let tv = str(t) ?? t;
          let cv;
          if (Array.isArray(tv))
            cv = this.emit(tv, "value");
          else if (typeof tv === "string" && (tv.startsWith('"') || tv.startsWith("'")))
            cv = `'${tv.slice(1, -1)}'`;
          else
            cv = this.emit(tv, "value");
          switchBody += this.indent() + `case ${cv}:
`;
        }
        this.indentLevel++;
        switchBody += this.emitSwitchCaseBody(body, context);
        this.indentLevel--;
      }
      if (defaultCase) {
        switchBody += this.indent() + `default:
`;
        this.indentLevel++;
        switchBody += this.emitSwitchCaseBody(defaultCase, context);
        this.indentLevel--;
      }
      this.indentLevel--;
      switchBody += this.indent() + "}";
      if (context === "value") {
        let hasAwait = this.containsAwait(disc) || whens.some((w) => this.containsAwait(w[1]) || this.containsAwait(w[2])) || defaultCase && this.containsAwait(defaultCase);
        return this.asyncIIFE(hasAwait, switchBody);
      }
      return switchBody;
    }
    emitWhen(head, rest, context, sexpr) {
      this.error("when clause should be handled by switch", sexpr);
    }
    _forInHeader(vars, iterable, step) {
      let va = Array.isArray(vars) ? vars : [vars];
      let noVar = va.length === 0;
      let [itemVar, indexVar] = noVar ? ["_i", null] : va;
      let ivp = this.is(itemVar, "array") || this.is(itemVar, "object") ? this.emitDestructuringPattern(itemVar) : itemVar;
      if (step && step !== null) {
        let ih = Array.isArray(iterable) && iterable[0];
        if (ih instanceof String)
          ih = str(ih);
        let isRange = ih === ".." || ih === "...";
        if (isRange) {
          let isExcl = ih === "...";
          let [s, e] = iterable.slice(1);
          let sc = this.emit(s, "value"), ec = this.emit(e, "value"), stc2 = this.emit(step, "value");
          return { header: `for (let ${ivp} = ${sc}; ${ivp} ${isExcl ? "<" : "<="} ${ec}; ${ivp} += ${stc2})`, setup: null };
        }
        let ic = this.emit(iterable, "value"), idxN = indexVar || "_i", stc = this.emit(step, "value");
        let isNeg = this.is(step, "-", 1);
        let isMinus1 = isNeg && (step[1] === "1" || step[1] === 1 || str(step[1]) === "1");
        let isPlus1 = !isNeg && (step === "1" || step === 1 || str(step) === "1");
        let update = isMinus1 ? `${idxN}--` : isPlus1 ? `${idxN}++` : `${idxN} += ${stc}`;
        let header = isNeg ? `for (let ${idxN} = ${ic}.length - 1; ${idxN} >= 0; ${update})` : `for (let ${idxN} = 0; ${idxN} < ${ic}.length; ${update})`;
        return { header, setup: noVar ? null : `const ${ivp} = ${ic}[${idxN}];` };
      }
      if (indexVar) {
        let ic = this.emit(iterable, "value");
        return {
          header: `for (let ${indexVar} = 0; ${indexVar} < ${ic}.length; ${indexVar}++)`,
          setup: `const ${ivp} = ${ic}[${indexVar}];`
        };
      }
      return { header: `for (const ${ivp} of ${this.emit(iterable, "value")})`, setup: null };
    }
    _forOfHeader(vars, iterable, own) {
      let va = Array.isArray(vars) ? vars : [vars];
      let [kv, vv] = va;
      let kvp = this.is(kv, "array") || this.is(kv, "object") ? this.emitDestructuringPattern(kv) : kv;
      let oc = this.emit(iterable, "value");
      return { header: `for (const ${kvp} in ${oc})`, own, vv, oc, kvp };
    }
    _forAsHeader(vars, iterable, isAwait) {
      let va = Array.isArray(vars) ? vars : [vars];
      let [fv] = va;
      let ivp = this.is(fv, "array") || this.is(fv, "object") ? this.emitDestructuringPattern(fv) : fv;
      return { header: `for ${isAwait ? "await " : ""}(const ${ivp} of ${this.emit(iterable, "value")})` };
    }
    emitComprehension(head, rest, context) {
      let [expr, iterators, guards] = rest;
      if (context === "statement")
        return this.emitComprehensionAsLoop(expr, iterators, guards);
      if (this.comprehensionTarget)
        return this.emitComprehensionWithTarget(expr, iterators, guards, this.comprehensionTarget);
      let hasAwait = this.containsAwait(expr) || iterators.some((i) => this.containsAwait(i)) || guards.some((g) => this.containsAwait(g));
      let code = this.asyncIIFEOpen(hasAwait) + `
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
        code += this.indent() + `if (${this.emit(guard, "value")}) {
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
            code += this.indent() + this.emit(s, "statement") + `;
`;
          } else if (Array.isArray(s) && loopStmts.includes(s[0])) {
            code += this.indent() + this.emit(s, "statement") + `;
`;
          } else {
            code += this.indent() + `result.push(${this.emit(s, "value")});
`;
          }
        }
      } else {
        if (hasCtrl(expr)) {
          code += this.indent() + this.emit(expr, "statement") + `;
`;
        } else if (Array.isArray(expr) && loopStmts.includes(expr[0])) {
          code += this.indent() + this.emit(expr, "statement") + `;
`;
        } else {
          code += this.indent() + `result.push(${this.emit(expr, "value")});
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
    emitObjectComprehension(head, rest, context) {
      let [keyExpr, valueExpr, iterators, guards] = rest;
      let hasAwait = this.containsAwait(keyExpr) || this.containsAwait(valueExpr) || iterators.some((i) => this.containsAwait(i)) || guards.some((g) => this.containsAwait(g));
      let code = this.asyncIIFEOpen(hasAwait) + `
`;
      this.indentLevel++;
      code += this.indent() + `const result = {};
`;
      for (let iter of iterators) {
        let [iterType, vars, iterable, own] = iter;
        if (iterType === "for-of") {
          let [kv, vv] = vars;
          let oc = this.emit(iterable, "value");
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
        code += this.indent() + `if (${this.emit(guard, "value")}) {
`;
        this.indentLevel++;
      }
      code += this.indent() + `result[${this.emit(keyExpr, "value")}] = ${this.emit(valueExpr, "value")};
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
    emitClass(head, rest, context) {
      let [className, parentClass, ...bodyParts] = rest;
      let code = className ? `class ${className}` : "class";
      if (parentClass)
        code += ` extends ${this.emit(parentClass, "value")}`;
      code += ` {
`;
      if (bodyParts.length > 0 && Array.isArray(bodyParts[0])) {
        let bodyBlock = bodyParts[0];
        if (bodyBlock[0] === "block") {
          let bodyStmts = bodyBlock.slice(1);
          let hasObjFirst = bodyStmts.length > 0 && Array.isArray(bodyStmts[0]) && bodyStmts[0][0] === "object";
          if (hasObjFirst) {
            let members = bodyStmts[0].slice(1);
            this.indentLevel++;
            code += this._emitClassMembers(members, parentClass);
            for (let stmt of bodyStmts.slice(1)) {
              if (this.is(stmt, "class")) {
                let [, nestedName, parent, ...nestedBody] = stmt;
                if (this.is(nestedName, ".") && nestedName[1] === "this") {
                  code += this.indent() + `static ${nestedName[2]} = ${this.emit(["class", null, parent, ...nestedBody], "value")};
`;
                } else {
                  code += this.indent() + this.emit(stmt, "statement") + `;
`;
                }
              } else {
                code += this.indent() + this.emit(stmt, "statement") + `;
`;
              }
            }
            this.indentLevel--;
          } else {
            this.indentLevel++;
            for (let stmt of bodyStmts) {
              if (this.is(stmt, "=") && Array.isArray(stmt[1]) && stmt[1][0] === "." && stmt[1][1] === "this") {
                code += this.indent() + `static ${stmt[1][2]} = ${this.emit(stmt[2], "value")};
`;
              } else {
                code += this.indent() + this.emit(stmt, "statement") + `;
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
    _emitClassMembers(members, parentClass) {
      let code = "";
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
          let pList = this.emitParamList(cleanParams);
          let prefix = (isStatic ? "static " : "") + (hasAwait ? "async " : "") + (hasYield ? "*" : "");
          code += this.indent() + `${prefix}${mName}(${pList}) `;
          if (!isComputed)
            this.currentMethodName = mName;
          code += this.emitMethodBody(body, autoAssign, mName === "constructor", cleanParams);
          this._atParamMap = null;
          this.currentMethodName = null;
          code += `
`;
        } else if (isStatic) {
          code += this.indent() + `static ${mName} = ${this.emit(mv, "value")};
`;
        } else {
          code += this.indent() + `${mName} = ${this.emit(mv, "value")};
`;
        }
      }
      return code;
    }
    emitSuper(head, rest) {
      if (rest.length === 0) {
        if (this.currentMethodName && this.currentMethodName !== "constructor")
          return `super.${this.currentMethodName}()`;
        return "super";
      }
      let args = rest.map((a) => this.unwrap(this.emit(a, "value"))).join(", ");
      if (this.currentMethodName && this.currentMethodName !== "constructor")
        return `super.${this.currentMethodName}(${args})`;
      return `super(${args})`;
    }
    emitImport(head, rest, context, sexpr) {
      if (rest.length === 1) {
        let importExpr = `import(${this.emit(rest[0], "value")})`;
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
      return `import ${this.emit(specifier, "value")} from ${fixedSource}`;
    }
    emitExport(head, rest) {
      let [decl] = rest;
      if (this.options.skipExports) {
        if (this.is(decl, "=")) {
          const prev = this._componentName;
          const prevTP = this._componentTypeParams;
          if (this.is(decl[2], "component")) {
            this._componentName = str(decl[1]);
            this._componentTypeParams = decl[1]?.typeParams || "";
          }
          const result = `const ${decl[1]} = ${this.emit(decl[2], "value")}`;
          this._componentName = prev;
          this._componentTypeParams = prevTP;
          return result;
        }
        if (Array.isArray(decl) && decl.every((i) => typeof i === "string"))
          return "";
        return this.emit(decl, "statement");
      }
      if (this.is(decl, "=")) {
        const prev = this._componentName;
        const prevTP = this._componentTypeParams;
        if (this.is(decl[2], "component")) {
          this._componentName = str(decl[1]);
          this._componentTypeParams = decl[1]?.typeParams || "";
        }
        const result = `export const ${decl[1]} = ${this.emit(decl[2], "value")}`;
        this._componentName = prev;
        this._componentTypeParams = prevTP;
        return result;
      }
      if (Array.isArray(decl) && decl.every((i) => typeof i === "string"))
        return `export { ${decl.join(", ")} }`;
      return `export ${this.emit(decl, "statement")}`;
    }
    emitExportDefault(head, rest) {
      let [expr] = rest;
      if (this.options.skipExports) {
        if (this.is(expr, "="))
          return `const ${expr[1]} = ${this.emit(expr[2], "value")}`;
        return this.emit(expr, "statement");
      }
      if (this.is(expr, "=")) {
        return `const ${expr[1]} = ${this.emit(expr[2], "value")};
export default ${expr[1]}`;
      }
      return `export default ${this.emit(expr, "statement")}`;
    }
    emitExportAll(head, rest) {
      if (this.options.skipExports)
        return "";
      return `export * from ${this.addJsExtensionAndAssertions(rest[0])}`;
    }
    emitExportFrom(head, rest) {
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
    emitDoIIFE(head, rest) {
      return `(${this.emit(rest[0], "statement")})()`;
    }
    emitRegex(head, rest) {
      return rest.length === 0 ? head : this.emit(rest[0], "value");
    }
    emitTaggedTemplate(head, rest) {
      let [tag, s] = rest;
      let tagCode = this.emit(tag, "value");
      let content = this.emit(s, "value");
      if (content.startsWith("`"))
        return `${tagCode}${content}`;
      if (content.startsWith('"') || content.startsWith("'"))
        return `${tagCode}\`${content.slice(1, -1)}\``;
      return `${tagCode}\`${content}\``;
    }
    emitString(head, rest) {
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
            result += /^[\d"']/.test(v) ? "${" + this.emit(v, "value") + "}" : "${" + v + "}";
          } else {
            let expr = part.length === 1 && Array.isArray(part[0]) ? part[0] : part;
            result += "${" + this.emit(expr, "value") + "}";
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
    _tryPostfixCall(head, rest, context) {
      if (context !== "statement" || rest.length !== 1)
        return null;
      let cond = this.findPostfixConditional(rest[0]);
      if (!cond)
        return null;
      let argWithout = this.rebuildWithoutConditional(cond);
      let calleeCode = this.emit(head, "value");
      let condCode = this.emit(cond.condition, "value");
      let valCode = this.emit(argWithout, "value");
      return `if (${condCode}) ${calleeCode}(${valCode})`;
    }
    _emitArgs(rest) {
      return rest.map((arg) => this.unwrap(this.emit(arg, "value"))).join(", ");
    }
    emitDestructuringPattern(pattern) {
      return this.formatParam(pattern);
    }
    emitParamList(params) {
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
        return `${param[1]} = ${this.emit(param[2], "value")}`;
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
            return `${el[1]} = ${this.emit(el[2], "value")}`;
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
            return `${pair[1]} = ${this.emit(pair[2], "value")}`;
          let [operator, key, value] = pair;
          if (operator === "=")
            return `${key} = ${this.emit(value, "value")}`;
          if (key === value)
            return key;
          return `${key}: ${this.formatParam(value)}`;
        });
        return `{${pairs.join(", ")}}`;
      }
      return JSON.stringify(param);
    }
    emitBodyWithReturns(body, params = [], options = {}) {
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
        let prevInlinePending = this._inlineVarsPending;
        let inlineVars = new Set;
        if (newVars.size > 0 && statements.length > 0) {
          let classified = this.classifyVarsForInlining(statements, newVars);
          inlineVars = classified.inlineVars;
          if (inlineVars.size > 0)
            this._inlineVarsPending = new Set(inlineVars);
        }
        this.indentLevel++;
        let code = `{
`;
        let hoistVars = new Set([...newVars].filter((v) => !inlineVars.has(v)));
        if (hoistVars.size > 0)
          code += this.indent() + `let ${Array.from(hoistVars).sort().join(", ")};
`;
        let firstIsSuper = autoAssignments.length > 0 && statements.length > 0 && Array.isArray(statements[0]) && statements[0][0] === "super";
        let genStatements = (stmts) => {
          stmts.forEach((stmt, index) => {
            let isLast = index === stmts.length - 1;
            let h = Array.isArray(stmt) ? stmt[0] : null;
            if (!isLast && h === "comprehension") {
              let [, expr, iters, guards] = stmt;
              code += this.indent() + this.emitComprehensionAsLoop(expr, iters, guards) + `
`;
              return;
            }
            if (!isConstructor && !sideEffectOnly && isLast && h === "if") {
              let [cond, thenB, ...elseB] = stmt.slice(1);
              let hasMulti = (b) => this.is(b, "block") && b.length > 2;
              let hasCtrlStmt = this.hasStatementInBranch(thenB) || elseB.some((b) => this.hasStatementInBranch(b));
              if (hasCtrlStmt || hasMulti(thenB) || elseB.some(hasMulti)) {
                code += this.emitIfElseWithEarlyReturns(stmt) + `
`;
                return;
              }
            }
            if (!isConstructor && !sideEffectOnly && isLast && h === "=") {
              let [target, value] = stmt.slice(1);
              if (typeof target === "string" && Array.isArray(value)) {
                let vh = value[0];
                if (vh === "comprehension" || vh === "for-in") {
                  if (this._inlineVarsPending?.delete(target))
                    code += this.indent() + `let ${target};
`;
                  this.comprehensionTarget = target;
                  code += this.emit(value, "value");
                  this.comprehensionTarget = null;
                  code += this.indent() + `return ${target};
`;
                  return;
                }
              }
              if ((typeof target === "string" || target instanceof String) && this._inlineVarsPending?.has(str(target))) {
                this._inlineVarsPending.delete(str(target));
                let assignCode = this.emit(stmt, "statement");
                code += this.indent() + "let " + this.addSemicolon(stmt, assignCode) + `
`;
                code += this.indent() + `return ${str(target)};
`;
                return;
              }
            }
            let needsReturn = !isConstructor && !sideEffectOnly && isLast && !noRetStmts.includes(h) && !loopStmts.includes(h) && !this.hasExplicitControlFlow(stmt);
            let ctx = needsReturn ? "value" : "statement";
            let sc = this.emit(stmt, ctx);
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
            code += this.indent() + "return " + this.emit(statements[0], "value") + `;
`;
          else
            code += this.indent() + this.emit(statements[0], "statement") + `;
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
        this._inlineVarsPending = prevInlinePending;
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
        let bodyCode = this.emit(body, "statement");
        let assigns = autoAssignments.map((a) => `${a};`).join(" ");
        result = isSuper ? `{ ${bodyCode}; ${assigns} }` : `{ ${assigns} ${bodyCode}; }`;
      } else if (isConstructor || this.hasExplicitControlFlow(body))
        result = `{ ${this.emit(body, "statement")}; }`;
      else if (Array.isArray(body) && (noRetStmts.includes(body[0]) || loopStmts.includes(body[0])))
        result = `{ ${this.emit(body, "statement")}; }`;
      else if (sideEffectOnly)
        result = `{ ${this.emit(body, "statement")}; return; }`;
      else
        result = `{ return ${this.emit(body, "value")}; }`;
      this.scopeStack.pop();
      return result;
    }
    emitFunctionBody(body, params = [], sideEffectOnly = false) {
      return this.emitBodyWithReturns(body, params, { sideEffectOnly, hasExpansionParams: this.expansionAfterParams?.length > 0 });
    }
    emitMethodBody(body, autoAssignments = [], isConstructor = false, params = []) {
      return this.emitBodyWithReturns(body, params, { autoAssignments, isConstructor });
    }
    emitBlockWithReturns(block) {
      if (!Array.isArray(block) || block[0] !== "block")
        return this.emit(block, "statement");
      let stmts = this.unwrapBlock(block);
      let lines = this.withIndent(() => stmts.map((stmt, i) => {
        let isLast = i === stmts.length - 1;
        let h = Array.isArray(stmt) ? stmt[0] : null;
        let needsReturn = isLast && !["return", "throw", "break", "continue"].includes(h);
        let code = this.emit(stmt, needsReturn ? "value" : "statement");
        return needsReturn ? this.indent() + "return " + code + ";" : this.indent() + code + ";";
      }));
      return `{
${lines.join(`
`)}
${this.indent()}}`;
    }
    emitLoopBody(body) {
      if (!Array.isArray(body))
        return `{ ${this.emit(body, "statement")}; }`;
      if (body[0] === "block" || Array.isArray(body[0])) {
        let stmts = body[0] === "block" ? body.slice(1) : body;
        let lines = this.withIndent(() => stmts.map((s) => {
          if (this.is(s, "comprehension")) {
            let [, expr, iters, guards] = s;
            return this.indent() + this.emitComprehensionAsLoop(expr, iters, guards);
          }
          return this.indent() + this.addSemicolon(s, this.emit(s, "statement"));
        }));
        return `{
${lines.join(`
`)}
${this.indent()}}`;
      }
      return `{ ${this.emit(body, "statement")}; }`;
    }
    emitLoopBodyWithGuard(body, guard) {
      let guardCond = this.unwrap(this.emit(guard, "value"));
      if (!Array.isArray(body))
        return `{ if (${guardCond}) ${this.emit(body, "statement")}; }`;
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
      return `{ if (${this.emit(guard, "value")}) ${this.emit(body, "statement")}; }`;
    }
    emitComprehensionWithTarget(expr, iterators, guards, targetVar) {
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
            code += this.indent() + `if (${guards.map((g) => this.emit(g, "value")).join(" && ")}) {
`;
            this.indentLevel++;
          }
          code += this.indent() + `${targetVar}.push(${this.unwrap(this.emit(unwrappedExpr, "value"))});
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
    emitComprehensionAsLoop(expr, iterators, guards) {
      let code = "";
      let guardCond = guards?.length ? guards.map((g) => this.emit(g, "value")).join(" && ") : null;
      let emitBody = () => {
        if (guardCond) {
          code += this.indent() + `if (${guardCond}) {
`;
          this.indentLevel++;
          code += this.indent() + this.emit(expr, "statement") + `;
`;
          this.indentLevel--;
          code += this.indent() + `}
`;
        } else {
          code += this.indent() + this.emit(expr, "statement") + `;
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
      return this.emit(["comprehension", expr, iterators, guards], "value");
    }
    emitIfElseWithEarlyReturns(ifStmt) {
      let [head, condition, thenBranch, ...elseBranches] = ifStmt;
      let code = "";
      let condCode = this.emit(condition, "value");
      code += this.indent() + `if (${condCode}) {
`;
      code += this.withIndent(() => this.emitBranchWithReturn(thenBranch));
      code += this.indent() + "}";
      for (let branch of elseBranches) {
        code += " else ";
        if (this.is(branch, "if")) {
          let [, nc, nt, ...ne] = branch;
          code += `if (${this.emit(nc, "value")}) {
`;
          code += this.withIndent(() => this.emitBranchWithReturn(nt));
          code += this.indent() + "}";
          for (let rb of ne) {
            code += ` else {
`;
            code += this.withIndent(() => this.emitBranchWithReturn(rb));
            code += this.indent() + "}";
          }
        } else {
          code += `{
`;
          code += this.withIndent(() => this.emitBranchWithReturn(branch));
          code += this.indent() + "}";
        }
      }
      return code;
    }
    emitBranchWithReturn(branch) {
      branch = this.unwrapIfBranch(branch);
      let stmts = this.unwrapBlock(branch);
      let code = "";
      for (let i = 0;i < stmts.length; i++) {
        let isLast = i === stmts.length - 1, s = stmts[i];
        let h = Array.isArray(s) ? s[0] : null;
        let hasCtrl = h === "return" || h === "throw" || h === "break" || h === "continue";
        if (isLast && !hasCtrl)
          code += this.indent() + `return ${this.emit(s, "value")};
`;
        else
          code += this.indent() + this.emit(s, "statement") + `;
`;
      }
      return code;
    }
    emitIfAsExpression(condition, thenBranch, elseBranches) {
      let needsIIFE = this.is(thenBranch, "block") && thenBranch.length > 2 || this.hasStatementInBranch(thenBranch) || elseBranches.some((b) => this.is(b, "block") && b.length > 2 || this.hasStatementInBranch(b) || this.hasNestedMultiStatement(b));
      if (needsIIFE) {
        let hasAwait = this.containsAwait(condition) || this.containsAwait(thenBranch) || elseBranches.some((b) => this.containsAwait(b));
        let code = this.asyncIIFEOpen(hasAwait) + " ";
        code += `if (${this.emit(condition, "value")}) `;
        code += this.emitBlockWithReturns(thenBranch);
        for (let branch of elseBranches) {
          code += " else ";
          if (this.is(branch, "if")) {
            let [_, nc, nt, ...ne] = branch;
            code += `if (${this.emit(nc, "value")}) `;
            code += this.emitBlockWithReturns(nt);
            for (let nb of ne) {
              code += " else ";
              if (this.is(nb, "if")) {
                let [__, nnc, nnt, ...nne] = nb;
                code += `if (${this.emit(nnc, "value")}) `;
                code += this.emitBlockWithReturns(nnt);
                elseBranches.push(...nne);
              } else {
                code += this.emitBlockWithReturns(nb);
              }
            }
          } else {
            code += this.emitBlockWithReturns(branch);
          }
        }
        return code + " })()";
      }
      let thenExpr = this.extractExpression(this.unwrapIfBranch(thenBranch));
      let elseExpr = this.buildTernaryChain(elseBranches);
      let condCode = this.emit(condition, "value");
      if (this.is(condition, "yield") || this.is(condition, "await"))
        condCode = `(${condCode})`;
      return `(${condCode} ? ${thenExpr} : ${elseExpr})`;
    }
    emitIfAsStatement(condition, thenBranch, elseBranches) {
      let code = `if (${this.unwrap(this.emit(condition, "value"))}) `;
      code += this.emit(this.unwrapIfBranch(thenBranch), "statement");
      for (let branch of elseBranches)
        code += ` else ` + this.emit(this.unwrapIfBranch(branch), "statement");
      return code;
    }
    emitSwitchCaseBody(body, context) {
      let code = "";
      let hasFlow = this.hasExplicitControlFlow(body);
      let stmts = this.unwrapBlock(body);
      if (hasFlow) {
        for (let s of stmts)
          code += this.indent() + this.emit(s, "statement") + `;
`;
      } else if (context === "value") {
        if (this.is(body, "block") && body.length > 2) {
          for (let i = 0;i < stmts.length; i++) {
            if (i === stmts.length - 1)
              code += this.indent() + `return ${this.emit(stmts[i], "value")};
`;
            else
              code += this.indent() + this.emit(stmts[i], "statement") + `;
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
          code += this.indent() + `(${this.unwrap(this.emit(condition, "value"))} ? ${thenExpr} : ${elseExpr});
`;
        } else if (this.is(body, "block") && body.length > 1) {
          for (let s of stmts)
            code += this.indent() + this.emit(s, "statement") + `;
`;
        } else {
          code += this.indent() + this.emit(body, "statement") + `;
`;
        }
        code += this.indent() + `break;
`;
      }
      return code;
    }
    emitSwitchAsIfChain(whens, defaultCase, context) {
      let code = "";
      for (let i = 0;i < whens.length; i++) {
        let [, test, body] = whens[i];
        let cond = Array.isArray(test) ? test[0] : test;
        code += (i === 0 ? "" : " else ") + `if (${this.emit(cond, "value")}) {
`;
        this.indentLevel++;
        if (context === "value")
          code += this.indent() + `return ${this.extractExpression(body)};
`;
        else
          for (let s of this.unwrapBlock(body))
            code += this.indent() + this.emit(s, "statement") + `;
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
            code += this.indent() + this.emit(s, "statement") + `;
`;
        this.indentLevel--;
        code += this.indent() + "}";
      }
      if (context === "value") {
        let hasAwait = whens.some((w) => this.containsAwait(w[1]) || this.containsAwait(w[2])) || defaultCase && this.containsAwait(defaultCase);
        return this.asyncIIFE(hasAwait, code);
      }
      return code;
    }
    asyncIIFE(hasAwait, body) {
      let prefix = hasAwait ? "await " : "";
      let async_ = hasAwait ? "async " : "";
      return `${prefix}(${async_}() => { ${body} })()`;
    }
    asyncIIFEOpen(hasAwait) {
      let prefix = hasAwait ? "await " : "";
      let async_ = hasAwait ? "async " : "";
      return `${prefix}(${async_}() => {`;
    }
    extractExpression(branch) {
      let stmts = this.unwrapBlock(branch);
      return stmts.length > 0 ? this.emit(stmts[stmts.length - 1], "value") : "undefined";
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
      return stmts.map((s) => this.indent() + this.addSemicolon(s, this.emit(s, context)));
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
        return `(${this.emit(cond, "value")} ? ${thenPart} : ${elsePart})`;
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
    referencesVar(sexpr, varName) {
      if (!sexpr)
        return false;
      if (sexpr instanceof String)
        return str(sexpr) === varName;
      if (typeof sexpr === "string")
        return sexpr === varName;
      if (!Array.isArray(sexpr))
        return false;
      let h = sexpr[0];
      let hs = typeof h === "string" ? h : h instanceof String ? str(h) : null;
      if (hs === "def" || hs === "->" || hs === "=>" || hs === "effect")
        return false;
      if (hs === "." || hs === "?.")
        return this.referencesVar(sexpr[1], varName);
      if (hs === "object") {
        for (let i = 1;i < sexpr.length; i++) {
          let pair = sexpr[i];
          if (Array.isArray(pair)) {
            if (this.is(pair, "...")) {
              if (this.referencesVar(pair[1], varName))
                return true;
            } else if (pair.length >= 2) {
              if (this.referencesVar(pair[pair.length - 1], varName))
                return true;
            }
          } else {
            if (this.referencesVar(pair, varName))
              return true;
          }
        }
        return false;
      }
      return sexpr.some((item) => this.referencesVar(item, varName));
    }
    firstRefIsAssignment(sexpr, varName) {
      let result = null;
      let isVar = (n) => (n instanceof String ? str(n) : n) === varName;
      let walk = (node, inValue) => {
        if (result !== null)
          return;
        if (!node)
          return;
        if (!Array.isArray(node)) {
          if (isVar(node))
            result = "read";
          return;
        }
        let h = node[0];
        let hs = typeof h === "string" ? h : h instanceof String ? str(h) : null;
        if (hs === "def" || hs === "->" || hs === "=>" || hs === "effect")
          return;
        if (hs === "=" && (typeof node[1] === "string" || node[1] instanceof String) && str(node[1]) === varName) {
          if (inValue) {
            result = "read";
            return;
          }
          result = this.referencesVar(node[2], varName) ? "read" : "write";
          return;
        }
        if (CodeEmitter.ASSIGNMENT_OPS.has(hs) && hs !== "=" && (typeof node[1] === "string" || node[1] instanceof String) && str(node[1]) === varName) {
          result = "read";
          return;
        }
        if (hs === "." || hs === "?.") {
          walk(node[1], inValue);
          return;
        }
        if (hs === "object") {
          for (let i = 1;i < node.length; i++) {
            let pair = node[i];
            if (Array.isArray(pair)) {
              if (this.is(pair, "..."))
                walk(pair[1], true);
              else if (pair.length >= 2)
                walk(pair[pair.length - 1], true);
            } else
              walk(pair, true);
          }
          return;
        }
        if (hs === "block") {
          for (let i = 1;i < node.length; i++)
            walk(node[i], false);
          return;
        }
        if (hs === "if") {
          walk(node[1], true);
          for (let i = 2;i < node.length; i++)
            walk(node[i], inValue);
          return;
        }
        if (hs === "for-in" || hs === "for-of" || hs === "for-as") {
          walk(node[2], true);
          if (node.length > 3)
            walk(node[node.length - 1], false);
          return;
        }
        if (hs === "while") {
          walk(node[1], true);
          walk(node[2], false);
          return;
        }
        if (hs === "try") {
          for (let i = 1;i < node.length; i++)
            walk(node[i], false);
          return;
        }
        if (CodeEmitter.ASSIGNMENT_OPS.has(hs)) {
          walk(node[2], true);
          return;
        }
        for (let i = 0;i < node.length; i++)
          walk(node[i], true);
      };
      walk(sexpr, false);
      return result === "write";
    }
    allRefsInSingleBlock(sexpr, varName) {
      if (!Array.isArray(sexpr))
        return false;
      let h = sexpr[0];
      let hs = typeof h === "string" ? h : h instanceof String ? str(h) : null;
      if (hs === "if") {
        if (this.referencesVar(sexpr[1], varName))
          return false;
        let branchCount = 0;
        let refBranch = null;
        for (let i = 2;i < sexpr.length; i++) {
          if (this.referencesVar(sexpr[i], varName)) {
            branchCount++;
            refBranch = sexpr[i];
          }
        }
        if (branchCount !== 1)
          return false;
        return this.allRefsInSingleBlock(refBranch, varName);
      }
      if (hs === "block") {
        let childCount = 0;
        let refChild = null;
        for (let i = 1;i < sexpr.length; i++) {
          if (this.referencesVar(sexpr[i], varName)) {
            childCount++;
            refChild = sexpr[i];
          }
        }
        if (childCount !== 1)
          return false;
        if (Array.isArray(refChild) && refChild[0] === "=" && (typeof refChild[1] === "string" || refChild[1] instanceof String) && str(refChild[1]) === varName)
          return true;
        return this.allRefsInSingleBlock(refChild, varName);
      }
      if (hs === "for-in" || hs === "for-of" || hs === "for-as") {
        if (this.referencesVar(sexpr[2], varName))
          return false;
        return true;
      }
      if (hs === "while") {
        if (this.referencesVar(sexpr[1], varName))
          return false;
        return true;
      }
      if (hs === "try")
        return true;
      return false;
    }
    classifyVarsForInlining(statements, vars) {
      if (vars.size === 0)
        return { inlineVars: new Set, hoistVars: new Set(vars) };
      let typedVars = new Set;
      let findTypedAssigns = (node) => {
        if (!Array.isArray(node))
          return;
        if (node[0] === "=" && node[1] instanceof String && node[1].type && vars.has(str(node[1]))) {
          typedVars.add(str(node[1]));
        }
        for (let i = 1;i < node.length; i++)
          findTypedAssigns(node[i]);
      };
      for (let stmt of statements)
        findTypedAssigns(stmt);
      let varStmts = new Map;
      for (let v of vars)
        varStmts.set(v, []);
      for (let i = 0;i < statements.length; i++) {
        for (let v of vars) {
          if (this.referencesVar(statements[i], v))
            varStmts.get(v).push(i);
        }
      }
      let inlineVars = new Set, hoistVars = new Set;
      for (let [v, indices] of varStmts) {
        if (indices.length === 0) {
          hoistVars.add(v);
          continue;
        }
        if (typedVars.has(v)) {
          hoistVars.add(v);
          continue;
        }
        let firstIdx = indices[0];
        let firstStmt = statements[firstIdx];
        let isDirectAssign = Array.isArray(firstStmt) && firstStmt[0] === "=" && (typeof firstStmt[1] === "string" || firstStmt[1] instanceof String) && str(firstStmt[1]) === v && !this.referencesVar(firstStmt[2], v);
        if (isDirectAssign) {
          inlineVars.add(v);
        } else if (indices.length === 1 && !this.is(firstStmt, "switch") && this.allRefsInSingleBlock(firstStmt, v) && this.firstRefIsAssignment(firstStmt, v)) {
          inlineVars.add(v);
        } else {
          hoistVars.add(v);
        }
      }
      return { inlineVars, hoistVars };
    }
    extractMemberName(mk) {
      if (this.is(mk, ".") && mk[1] === "this")
        return mk[2];
      if (this.is(mk, "computed"))
        return `[${this.emit(mk[1], "value")}]`;
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
      let tokens;
      try {
        tokens = lexer.tokenize(source);
      } catch (err) {
        throw toRipError(err, source, this.options.filename);
      }
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
      if (lexer.typeRefNames?.size > 0) {
        let typeRefNames = lexer.typeRefNames;
        let usedNames = new Set;
        let inImport = false;
        for (let t of tokens) {
          if (t[0] === "IMPORT") {
            inImport = true;
            continue;
          }
          if (inImport && t[0] === "TERMINATOR") {
            inImport = false;
            continue;
          }
          if (inImport)
            continue;
          if (t[0] === "IDENTIFIER")
            usedNames.add(t[1]);
        }
        for (let i = tokens.length - 1;i >= 0; i--) {
          if (tokens[i][0] !== "IMPORT")
            continue;
          let j = i + 1;
          if (j >= tokens.length)
            continue;
          if (tokens[j][0] === "CALL_START" || tokens[j][0] === "(")
            continue;
          if (tokens[j][0] === "STRING")
            continue;
          let names = [];
          while (j < tokens.length && tokens[j][0] !== "FROM" && tokens[j][0] !== "TERMINATOR") {
            if (tokens[j][0] === "IDENTIFIER")
              names.push(tokens[j][1]);
            j++;
          }
          if (names.length === 0)
            continue;
          if (names.some((n) => usedNames.has(n)))
            continue;
          if (!names.some((n) => typeRefNames.has(n)))
            continue;
          let end = j;
          while (end < tokens.length && tokens[end][0] !== "TERMINATOR")
            end++;
          if (end < tokens.length)
            end++;
          tokens.splice(i, end - i);
        }
      }
      while (tokens.length > 0 && tokens[0][0] === "TERMINATOR") {
        tokens.shift();
      }
      if (tokens.every((t) => t[0] === "TERMINATOR")) {
        if (typeTokens)
          dts = emitTypes(typeTokens, ["program"], source);
        return { tokens, sexpr: ["program"], code: "", dts, data: dataSection, reactiveVars: {} };
      }
      let lastLexedLoc = null;
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
          this.line = token.loc?.r;
          lastLexedLoc = token.loc;
          return token[0];
        }
      };
      let sexpr;
      try {
        sexpr = parser.parse(source);
      } catch (err) {
        if (/\?\s*\([^)]*\?[^)]*:[^)]*\)\s*:/.test(source) || /\?\s+\w+\s+\?\s+/.test(source)) {
          throw new RipError("Nested ternary operators are not supported", {
            code: "E_PARSE",
            source,
            file: this.options.filename,
            suggestion: "Use if/else statements instead.",
            phase: "parser"
          });
        }
        let re = toRipError(err, source, this.options.filename);
        if (re.phase === "parser" && lastLexedLoc) {
          re.line = lastLexedLoc.r ?? re.line;
          re.column = lastLexedLoc.c ?? re.column;
          re.length = lastLexedLoc.n || 1;
        }
        throw re;
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
      let generator = new CodeEmitter({
        dataSection,
        source,
        filename: this.options.filename,
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
  installComponentSupport(CodeEmitter, Lexer);
  CodeEmitter.prototype.emitEnum = emitEnum;
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
    return new CodeEmitter({}).getReactiveRuntime();
  }
  function getComponentRuntime() {
    return new CodeEmitter({}).getComponentRuntime();
  }
  // src/browser.js
  var VERSION = "3.13.135";
  var BUILD_DATE = "2026-04-10@10:00:31GMT";
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
              console.error(formatError(e, { source: s.code, file: s.url || "inline", color: false }));
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
            console.error(formatError(e, { source: s.code, file: s.url || "inline", color: false }));
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
      console.error(formatError(error, { source: code, color: false }));
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
  var __batch;
  var __effect;
  var __state;
  var getContext;
  var hasContext;
  var setContext;
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
  var STASH = Symbol("stash");
  var SIGNALS = Symbol("signals");
  var RAW = Symbol("raw");
  var PERSISTED = Symbol("persisted");
  var PROXIES = new WeakMap;
  var _keysVersion = 0;
  var _writeVersion = __state(0);
  var getSignal = function(target, prop) {
    if (!target[SIGNALS]) {
      Object.defineProperty(target, SIGNALS, { value: new Map, enumerable: false });
    }
    let sig = target[SIGNALS].get(prop);
    if (!sig) {
      sig = __state(target[prop]);
      target[SIGNALS].set(prop, sig);
    }
    return sig;
  };
  var keysSignal = function(target) {
    return getSignal(target, Symbol.for("keys"));
  };
  var wrapDeep = function(value) {
    if (!(value != null && typeof value === "object"))
      return value;
    if (value[STASH])
      return value;
    if (value instanceof Date || value instanceof RegExp || value instanceof Map || value instanceof Set || value instanceof Promise)
      return value;
    let existing = PROXIES.get(value);
    if (existing)
      return existing;
    return makeProxy(value);
  };
  var makeProxy = function(target) {
    let proxy = null;
    let handler = { get: function(target2, prop) {
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
      let sig = getSignal(target2, prop);
      let val = sig.value;
      if (val != null && typeof val === "object")
        return wrapDeep(val);
      return val;
    }, set: function(target2, prop, value) {
      let old = target2[prop];
      let r = value?.[RAW] ? value[RAW] : value;
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
      delete target2[prop];
      let sig = target2[SIGNALS]?.get(prop);
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
  var PATH_RE = /([./][^./\[\s]+|\[[-+]?\d+\]|\[(?:"[^"]+"|'[^']+')\])/;
  var walk = function(path) {
    let list = ("." + path).split(PATH_RE);
    list.shift();
    let result = [];
    let i = 0;
    while (i < list.length) {
      let part = list[i];
      let chr = part[0];
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
  var stashGet = function(proxy, path) {
    let segs = walk(path);
    let obj = proxy;
    for (const seg of segs) {
      if (!(obj != null))
        return;
      obj = obj[seg];
    }
    return obj;
  };
  var stashSet = function(proxy, path, value) {
    let segs = walk(path);
    let obj = proxy;
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
    let target = raw(app) || app;
    if (target[PERSISTED])
      return;
    target[PERSISTED] = true;
    let storage = opts.local ? localStorage : sessionStorage;
    let storageKey = opts.key || "__rip_app";
    try {
      let saved = storage.getItem(storageKey);
      if (saved) {
        let savedData = JSON.parse(saved);
        for (const k in savedData) {
          const v = savedData[k];
          app.data[k] = v;
        }
      }
    } catch {}
    let _save = function() {
      return (() => {
        try {
          return storage.setItem(storageKey, JSON.stringify(raw(app.data)));
        } catch {
          return null;
        }
      })();
    };
    __effect(function() {
      _writeVersion.value;
      let t = setTimeout(_save, 2000);
      return function() {
        return clearTimeout(t);
      };
    });
    return window.addEventListener("beforeunload", _save);
  };
  var createResource = function(fn, opts = {}) {
    let _data = __state(opts.initial || null);
    let _loading = __state(false);
    let _error = __state(null);
    let load = async function() {
      _loading.value = true;
      _error.value = null;
      return await (async () => {
        try {
          let result = await fn();
          return _data.value = result;
        } catch (err) {
          return _error.value = err;
        } finally {
          _loading.value = false;
        }
      })();
    };
    let resource = { data: undefined, loading: undefined, error: undefined, refetch: load };
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
  var _toFn = function(source) {
    return typeof source === "function" ? source : function() {
      return source.value;
    };
  };
  var _proxy = function(out, source) {
    let obj = { read: function() {
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
    let fn = _toFn(source);
    let out = __state(!!fn());
    __effect(function() {
      if (fn()) {
        let t = setTimeout(function() {
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
    let fn = _toFn(source);
    let out = __state(fn());
    __effect(function() {
      let val = fn();
      let t = setTimeout(function() {
        return out.value = val;
      }, ms);
      return function() {
        return clearTimeout(t);
      };
    });
    return typeof source !== "function" ? _proxy(out, source) : out;
  };
  var throttle = function(ms, source) {
    let fn = _toFn(source);
    let out = __state(fn());
    let last = 0;
    __effect(function() {
      let val = fn();
      let now = Date.now();
      let remaining = ms - (now - last);
      if (remaining <= 0) {
        out.value = val;
        return last = now;
      } else {
        let t = setTimeout(function() {
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
    let fn = _toFn(source);
    let out = __state(!!fn());
    __effect(function() {
      if (fn()) {
        return out.value = true;
      } else {
        let t = setTimeout(function() {
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
    let files = new Map;
    let watchers = [];
    let compiled = new Map;
    let notify = function(event, path) {
      for (const watcher of watchers) {
        watcher(event, path);
      }
    };
    return { read: function(path) {
      return files.get(path);
    }, write: function(path, content) {
      let isNew = !files.has(path);
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
      let result = [];
      let prefix = dir ? dir + "/" : "";
      for (const [path] of files) {
        if (path.startsWith(prefix)) {
          let rest = path.slice(prefix.length);
          if (rest.includes("/"))
            continue;
          result.push(path);
        }
      }
      return result;
    }, listAll: function(dir = "") {
      let result = [];
      let prefix = dir ? dir + "/" : "";
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
  var fileToPattern = function(rel) {
    let pattern = rel.replace(/\.rip$/, "");
    pattern = pattern.replace(/\[\.\.\.(\w+)\]/g, "*$1");
    pattern = pattern.replace(/\[(\w+)\]/g, ":$1");
    if (pattern === "index")
      return "/";
    pattern = pattern.replace(/\/index$/, "");
    return "/" + pattern;
  };
  var patternToRegex = function(pattern) {
    let names = [];
    let str2 = pattern.replace(/\*(\w+)/g, function(_, name) {
      names.push(name);
      return "(.+)";
    }).replace(/:(\w+)/g, function(_, name) {
      names.push(name);
      return "([^/]+)";
    });
    return { regex: new RegExp("^" + str2 + "$"), names };
  };
  var matchRoute = function(path, routes) {
    for (const route of routes) {
      let match = path.match(route.regex.regex);
      if (match) {
        let params = {};
        for (let i = 0;i < route.regex.names.length; i++) {
          const name = route.regex.names[i];
          params[name] = decodeURIComponent(match[i + 1]);
        }
        return { route, params };
      }
    }
    return null;
  };
  var buildRoutes = function(components, root = "components") {
    let routes = [];
    let layouts = new Map;
    let allFiles = components.listAll(root);
    for (const filePath of allFiles) {
      let rel = filePath.slice(root.length + 1);
      if (!rel.endsWith(".rip"))
        continue;
      let name = rel.split("/").pop();
      if (name === "_layout.rip") {
        let dir = rel === "_layout.rip" ? "" : rel.slice(0, -"/_layout.rip".length);
        layouts.set(dir, filePath);
        continue;
      }
      if (name.startsWith("_"))
        continue;
      let segs = rel.split("/");
      if (segs.length > 1 && segs.some(function(s, i) {
        return i < segs.length - 1 && s.startsWith("_");
      }))
        continue;
      let urlPattern = fileToPattern(rel);
      let regex = patternToRegex(urlPattern);
      routes.push({ pattern: urlPattern, regex, file: filePath, rel });
    }
    routes.sort(function(a, b) {
      let aDyn = (a.pattern.match(/:/g) || []).length;
      let bDyn = (b.pattern.match(/:/g) || []).length;
      let aCatch = a.pattern.includes("*") ? 1 : 0;
      let bCatch = b.pattern.includes("*") ? 1 : 0;
      if (aCatch !== bCatch)
        return aCatch - bCatch;
      if (aDyn !== bDyn)
        return aDyn - bDyn;
      return a.pattern.localeCompare(b.pattern);
    });
    return { routes, layouts };
  };
  var getLayoutChain = function(routeFile, root, layouts) {
    let chain = [];
    let rel = routeFile.slice(root.length + 1);
    let segments = rel.split("/");
    let dir = "";
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
    let root = opts.root || "components";
    let base = opts.base || "";
    let hashMode = opts.hash || false;
    let onError = opts.onError || null;
    let stripBase = function(url) {
      return base && url.startsWith(base) ? url.slice(base.length) || "/" : url;
    };
    let addBase = function(path) {
      return base ? base + path : path;
    };
    let readUrl = function() {
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
    let writeUrl = function(path) {
      return hashMode ? path === "/" ? location.pathname : "#" + path.slice(1) : addBase(path);
    };
    let _path = __state(stripBase(hashMode ? readUrl() : location.pathname));
    let _params = __state({});
    let _route = __state(null);
    let _layouts = __state([]);
    let _query = __state({});
    let _hash = __state("");
    let _navigating = delay(100, __state(false));
    let tree = buildRoutes(components, root);
    let navCallbacks = new Set;
    components.watch(function(event, path) {
      if (!path.startsWith(root + "/"))
        return;
      return tree = buildRoutes(components, root);
    });
    let resolve = function(url) {
      let rawPath = url.split("?")[0].split("#")[0];
      let path = stripBase(rawPath);
      path = path[0] === "/" ? path : "/" + path;
      let queryStr = url.split("?")[1]?.split("#")[0] || "";
      let hash = url.includes("#") ? url.split("#")[1] : "";
      let result = matchRoute(path, tree.routes);
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
    let onPopState = function() {
      return resolve(readUrl());
    };
    if (typeof window !== "undefined")
      window.addEventListener("popstate", onPopState);
    let onClick = function(e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      let target = e.target;
      while (target && target.tagName !== "A") {
        target = target.parentElement;
      }
      if (!target?.href)
        return;
      let url = new URL(target.href, location.origin);
      if (url.origin !== location.origin)
        return;
      if (target.target === "_blank" || target.hasAttribute("data-external"))
        return;
      e.preventDefault();
      let dest = hashMode && url.hash ? url.hash.slice(1) || "/" : url.pathname + url.search + url.hash;
      return router.push(dest);
    };
    if (typeof document !== "undefined")
      document.addEventListener("click", onClick);
    let router = { push: function(url) {
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
  var arraysEqual = function(a, b) {
    if (a.length !== b.length)
      return false;
    for (let i = 0;i < a.length; i++) {
      const item = a[i];
      if (item !== b[i])
        return false;
    }
    return true;
  };
  var findComponent = function(mod) {
    for (const key in mod) {
      const val = mod[key];
      if (typeof val === "function" && (val.prototype?.mount || val.prototype?._create))
        return val;
    }
    return typeof mod.default === "function" ? mod.default : undefined;
  };
  var findAllComponents = function(mod) {
    let result = {};
    for (const key in mod) {
      const val = mod[key];
      if (typeof val === "function" && (val.prototype?.mount || val.prototype?._create)) {
        result[key] = val;
      }
    }
    return result;
  };
  var fileToComponentName = function(filePath) {
    let name = filePath.split("/").pop().replace(/\.rip$/, "");
    return name.replace(/(^|[-_])([a-z])/g, function(_, sep, ch) {
      return ch.toUpperCase();
    });
  };
  var buildComponentMap = function(components, root = "components") {
    let map = {};
    for (const path of components.listAll(root)) {
      if (!path.endsWith(".rip"))
        continue;
      let fileName = path.split("/").pop();
      if (fileName.startsWith("_"))
        continue;
      let name = fileToComponentName(path);
      if (map[name]) {
        console.warn(`[Rip] Component name collision: ${name} (${map[name]} vs ${path})`);
      }
      map[name] = path;
    }
    return map;
  };
  var compileAndImport = async function(source, compile2, components = null, path = null, resolver = null) {
    let cached, found, names, needed, preamble;
    if (components && path) {
      cached = components.getCompiled(path);
      if (cached)
        return cached;
    }
    let js = compile2(source);
    if (resolver) {
      needed = {};
      for (const name in resolver.map) {
        const depPath = resolver.map[name];
        if (depPath !== path && js.includes(`new ${name}(`)) {
          if (!resolver.classes[name]) {
            let depSource = components.read(depPath);
            if (depSource) {
              let depMod = await compileAndImport(depSource, compile2, components, depPath, resolver);
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
    let header = path ? `// ${path}
` : "";
    let blob = new Blob([header + js], { type: "application/javascript" });
    let url = URL.createObjectURL(blob);
    let mod = await import(url);
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
    let app, compile2, components, onError, resolver, router, target;
    ({ router, app, components, resolver, compile: compile2, target, onError } = opts);
    let container = typeof target === "string" ? document.querySelector(target) : target || document.getElementById("app");
    if (!container) {
      container = document.createElement("div");
      container.id = "app";
      document.body.appendChild(container);
    }
    container.style.opacity = "0";
    let currentComponent = null;
    let currentRoute = null;
    let currentParams = null;
    let currentLayouts = [];
    let layoutInstances = [];
    let mountPoint = container;
    let generation = 0;
    let disposeEffect = null;
    let componentCache = new Map;
    let maxCacheSize = opts.cacheSize || 10;
    let cacheComponent = function() {
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
    let unmount = function() {
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
    let mountRoute = async function(info) {
      let layoutFiles, params, query, route;
      ({ route, params, layouts: layoutFiles, query } = info);
      if (!route)
        return;
      if (route.file === currentRoute && JSON.stringify(params) === JSON.stringify(currentParams)) {
        return;
      }
      currentParams = params;
      let gen2 = ++generation;
      router.navigating = true;
      return await (async () => {
        try {
          let source = components.read(route.file);
          if (!source) {
            if (onError)
              onError({ status: 404, message: `File not found: ${route.file}` });
            router.navigating = false;
            return;
          }
          let mod = await compileAndImport(source, compile2, components, route.file, resolver);
          if (gen2 !== generation) {
            router.navigating = false;
            return;
          }
          let Component = findComponent(mod);
          if (!Component) {
            if (onError)
              onError({ status: 500, message: `No component found in ${route.file}` });
            router.navigating = false;
            return;
          }
          let layoutsChanged = !arraysEqual(layoutFiles, currentLayouts);
          let oldTarget = currentComponent?._target;
          if (layoutsChanged) {
            unmount();
          } else {
            cacheComponent();
          }
          let mp = layoutsChanged ? container : mountPoint;
          if (layoutsChanged && layoutFiles.length > 0) {
            container.innerHTML = "";
            mp = container;
            for (const layoutFile of layoutFiles) {
              let layoutSource = components.read(layoutFile);
              if (!layoutSource)
                continue;
              let layoutMod = await compileAndImport(layoutSource, compile2, components, layoutFile, resolver);
              if (gen2 !== generation) {
                router.navigating = false;
                return;
              }
              let LayoutClass = findComponent(layoutMod);
              if (!LayoutClass)
                continue;
              let inst = new LayoutClass({ app, params, router });
              if (inst.beforeMount)
                inst.beforeMount();
              let wrapper = document.createElement("div");
              wrapper.setAttribute("data-layout", layoutFile);
              mp.appendChild(wrapper);
              inst.mount(wrapper);
              layoutInstances.push(inst);
              let slot = wrapper.querySelector("#content") || wrapper;
              mp = slot;
            }
            currentLayouts = [...layoutFiles];
            mountPoint = mp;
          } else if (layoutsChanged) {
            container.innerHTML = "";
            currentLayouts = [];
            mountPoint = container;
          }
          let cached = componentCache.get(route.file);
          if (cached) {
            componentCache.delete(route.file);
            mp.appendChild(cached._target);
            currentComponent = cached;
            currentRoute = route.file;
            if (params)
              cached.params = params;
            if (query)
              cached.query = query;
            if (cached.mounted)
              cached.mounted();
            if (cached.load)
              await cached.load(params, query);
          } else {
            let pageWrapper = document.createElement("div");
            pageWrapper.setAttribute("data-component", route.file);
            mp.appendChild(pageWrapper);
            let instance = new Component({ app, params, query, router });
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
          let handled = false;
          for (let _i = layoutInstances.length - 1;_i >= 0; _i--) {
            const inst = layoutInstances[_i];
            if (inst.onError) {
              try {
                inst.onError(err);
                handled = true;
                break;
              } catch (boundaryErr) {
                console.error("Renderer: error boundary failed:", boundaryErr);
              }
            }
          }
          return (() => {
            if (!handled) {
              let pre = document.createElement("pre");
              pre.style.cssText = "color:red;padding:1em";
              pre.textContent = err.stack || err.message;
              container.innerHTML = "";
              return container.appendChild(pre);
            }
          })();
        }
      })();
    };
    let renderer = { start: function() {
      disposeEffect = __effect(function() {
        let current = router.current;
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
      let current = router.current;
      return current.route ? mountRoute(current) : undefined;
    }, cache: componentCache };
    return renderer;
  };
  var connectWatch = function(url) {
    let retryDelay = 1000;
    let maxDelay = 30000;
    let connect = function() {
      let es = new EventSource(url);
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
    let bundle, cached, el, etag, etagKey, headers, res;
    globalThis.__ripLaunched = true;
    if (typeof appBase === "object") {
      opts = appBase;
      appBase = "";
    }
    appBase = appBase.replace(/\/+$/, "");
    let target = opts.target || "#app";
    let compile2 = opts.compile || null;
    let persist = opts.persist || false;
    let hash = opts.hash || false;
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
    let app = stash({ components: {}, routes: {}, data: {} });
    globalThis.__ripApp = app;
    if (bundle.data)
      app.data = bundle.data;
    if (bundle.routes) {
      app.routes = bundle.routes;
    }
    if (persist && typeof sessionStorage !== "undefined") {
      persistStash(app, { local: persist === "local", key: `__rip_${appBase}` });
    }
    let appComponents = createComponents();
    if (bundle.components)
      appComponents.load(bundle.components);
    let classesKey = `__rip_${appBase.replace(/\//g, "_") || "app"}`;
    let resolver = { map: buildComponentMap(appComponents), classes: {}, key: classesKey };
    if (typeof globalThis !== "undefined")
      globalThis[classesKey] = resolver.classes;
    if (app.data.title && typeof document !== "undefined")
      document.title = app.data.title;
    let router = createRouter(appComponents, { root: "components", base: appBase, hash, onError: function(err) {
      return console.error(`[Rip] Error ${err.status}: ${err.message || err.path}`);
    } });
    let renderer = createRenderer({ router, app, components: appComponents, resolver, compile: compile2, target, onError: function(err) {
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
  var _ariaNAV = function(e, fn) {
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
  var _ariaListNav = function(e, h) {
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
  var _ariaPopupDismiss = function(open, popup, close, els = [], repos = null) {
    if (!open)
      return;
    let get = function(x) {
      return typeof x === "function" ? x() : x;
    };
    let onDown = (e) => {
      return ![get(popup), ...els.map(get)].some(function(el) {
        return el?.contains(e.target);
      }) ? close() : undefined;
    };
    let onScroll = (e) => {
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
  var _ariaPopupGuard = function(delay2 = 250) {
    let blockedUntil = 0;
    return { block: function(ms = delay2) {
      return blockedUntil = Date.now() + ms;
    }, canOpen: function() {
      return Date.now() >= blockedUntil;
    } };
  };
  var _ariaBindPopover = function(open, popover, setOpen, source = null) {
    let opts, src;
    let get = function(x) {
      return typeof x === "function" ? x() : x;
    };
    let currentFocus = function() {
      let active = document.activeElement;
      if (active && active !== document.body)
        return active;
      let last = globalThis.__ariaLastFocusedEl;
      if (last?.isConnected !== false)
        return last;
      return null;
    };
    let el = get(popover);
    if (!el)
      return;
    if (!Object.hasOwn(HTMLElement.prototype, "togglePopover"))
      return;
    let restoreEl = null;
    let syncState = function(isOpen) {
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
    let restoreFocus = function() {
      let target = restoreEl;
      restoreEl = null;
      if (!target?.focus)
        return;
      let focusAttempt = function(tries = 6) {
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
    let onToggle = function(e) {
      let isOpen = e.newState === "open";
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
    let shown = el.matches(":popover-open");
    let desired = !!open;
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
  var _ariaBindDialog = function(open, dialog, setOpen, dismissable = true) {
    let get = function(x) {
      return typeof x === "function" ? x() : x;
    };
    let currentFocus = function() {
      let active = document.activeElement;
      if (active && active !== document.body)
        return active;
      let last = globalThis.__ariaLastFocusedEl;
      if (last?.isConnected !== false)
        return last;
      return null;
    };
    let el = get(dialog);
    if (!el?.showModal)
      return;
    let restoreEl = null;
    let syncState = function(isOpen) {
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
    let restoreFocus = function() {
      let target = restoreEl;
      restoreEl = null;
      if (!target?.focus)
        return;
      let focusAttempt = function(tries = 6) {
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
    let onCancel = function(e) {
      if (!dismissable) {
        e.preventDefault();
        return;
      }
      return setOpen?.(false);
    };
    let onClose = function() {
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
  var _ariaRovingNav = function(e, h, orientation = "vertical") {
    if (e.isComposing)
      return;
    let vert = orientation !== "horizontal";
    let horz = orientation !== "vertical";
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
  var _ariaPositionBelow = function(trigger, popup, gap = 4, setVisible = true) {
    if (!(trigger && popup))
      return;
    let tr = trigger.getBoundingClientRect();
    popup.style.position = "fixed";
    popup.style.left = `${tr.left}px`;
    popup.style.top = `${tr.bottom + gap}px`;
    popup.style.minWidth = `${tr.width}px`;
    let fl = popup.getBoundingClientRect();
    if (fl.bottom > window.innerHeight)
      popup.style.top = `${tr.top - fl.height - gap}px`;
    if (fl.right > window.innerWidth)
      popup.style.left = `${window.innerWidth - fl.width - gap}px`;
    return setVisible ? popup.style.visibility = "visible" : undefined;
  };
  var _FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var _ariaTrapFocus = function(panel) {
    let handler = function(e) {
      if (!(e.key === "Tab"))
        return;
      let list = Array.from(panel.querySelectorAll(_FOCUSABLE)).filter(function(f) {
        return f.offsetParent !== null;
      });
      if (!list.length)
        return;
      let first = list[0];
      let last = list[list.length - 1];
      return e.shiftKey ? document.activeElement === first ? (e.preventDefault(), last.focus()) : undefined : document.activeElement === last ? (e.preventDefault(), first.focus()) : undefined;
    };
    panel.addEventListener("keydown", handler);
    return function() {
      return panel.removeEventListener("keydown", handler);
    };
  };
  var _ariaWireAria = function(panel, id) {
    if (!panel)
      return;
    let heading = panel.querySelector("h1,h2,h3,h4,h5,h6");
    if (heading) {
      heading.id ??= `${id}-title`;
      panel.setAttribute("aria-labelledby", heading.id);
    }
    let desc = panel.querySelector("p");
    if (desc) {
      desc.id ??= `${id}-desc`;
      return panel.setAttribute("aria-describedby", desc.id);
    }
  };
  var _ariaModalStack = [];
  var _ariaLockScroll = function(instance) {
    let scrollY = window.scrollY;
    _ariaModalStack.push({ instance, scrollY });
    if (_ariaModalStack.length === 1) {
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      return document.body.style.width = "100%";
    }
  };
  var _ariaUnlockScroll = function(instance) {
    let scrollY;
    let idx = _ariaModalStack.findIndex(function(m) {
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
  var _ariaHasAnchor = function() {
    return (() => {
      try {
        if (!document?.createElement)
          return false;
        let anchor = document.createElement("div");
        let floating = document.createElement("div");
        anchor.style.cssText = "position:fixed;top:100px;left:100px;width:10px;height:10px;anchor-name:--probe";
        floating.style.cssText = "position:fixed;inset:auto;margin:0;position-anchor:--probe;position-area:bottom start;width:10px;height:10px";
        document.body.appendChild(anchor);
        document.body.appendChild(floating);
        let rect = floating.getBoundingClientRect();
        anchor.remove();
        floating.remove();
        return rect.top > 50;
      } catch {
        return false;
      }
    })();
  }();
  var _ariaPosition = function(trigger, floating, opts = {}) {
    let align, name, rect, side;
    if (!(trigger && floating))
      return;
    let placement = opts.placement ?? "bottom start";
    let offset = opts.offset ?? 4;
    let matchWidth = opts.matchWidth ?? false;
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
