import { SCHEMA_INTRINSIC_DECLS, emitSchemaTypes } from "./schema-types.js";
import { setTypesEmitter } from "./compiler.js";

// Type System — .d.ts emission for Rip (CLI / typecheck only).
//
// This module is a CLI/editor-only sidecar:
//
//   emitTypes(tokens, sexpr, source) — generates .d.ts from annotated
//     tokens and the parsed s-expression tree.
//
//   INTRINSIC_TYPE_DECLS / INTRINSIC_FN_DECL / ARIA_TYPE_DECLS /
//   SIGNAL_*, COMPUTED_*, EFFECT_* — declaration tables consumed by
//     emitTypes() and by typecheck.js when building the virtual TS
//     file. Browser code never references these.
//
//   The browser bundle must NOT import this module — see
//   scripts/check-bundle-graph.js. Token-level type stripping
//   (installTypeSupport) and runtime enum codegen (emitEnum) live
//   in types.js, which the browser does need.

// ============================================================================
// Shared type declaration constants — single source of truth
// ============================================================================
// Used by emitTypes() for .d.ts emission and by compileForCheck() in
// typecheck.js for virtual .ts injection. Keeping them here eliminates
// divergence between what gets written to disk and what TS analyzes.

export const INTRINSIC_TYPE_DECLS = [
  'type __RipElementMap = HTMLElementTagNameMap & Omit<SVGElementTagNameMap, keyof HTMLElementTagNameMap>;',
  'type __RipTag = keyof __RipElementMap;',
  "type __RipBrowserElement = Omit<HTMLElement, 'querySelector' | 'querySelectorAll' | 'closest' | 'setAttribute' | 'hidden'> & { hidden: boolean | 'until-found'; setAttribute(qualifiedName: string, value: any): void; querySelector(selectors: string): __RipBrowserElement | null; querySelectorAll(selectors: string): NodeListOf<__RipBrowserElement>; closest(selectors: string): __RipBrowserElement | null; };",
  "type __RipDomEl<K extends __RipTag> = Omit<__RipElementMap[K], 'querySelector' | 'querySelectorAll' | 'closest' | 'setAttribute' | 'hidden'> & __RipBrowserElement;",
  "type __RipAttrKeys<T> = { [K in keyof T]-?: K extends 'style' | 'classList' | 'className' | 'nodeValue' | 'textContent' | 'innerHTML' | 'innerText' | 'outerHTML' | 'outerText' | 'scrollLeft' | 'scrollTop' ? never : K extends `on${string}` | `aria${string}Element` | `aria${string}Elements` ? never : T[K] extends (...args: any[]) => any ? never : (<V>() => V extends Pick<T, K> ? 1 : 2) extends (<V>() => V extends { -readonly [P in K]: T[P] } ? 1 : 2) ? K : never }[keyof T] & string;",
  'type __RipEvents = { [K in keyof HTMLElementEventMap as `@${K}`]?: ((event: HTMLElementEventMap[K]) => void) | null };',
  'type __RipClassValue = string | boolean | null | undefined | Record<string, boolean> | __RipClassValue[];',
  'type __RipProps<K extends __RipTag> = { [P in __RipAttrKeys<__RipElementMap[K]>]?: __RipElementMap[K][P] } & __RipEvents & { ref?: string; class?: __RipClassValue | __RipClassValue[]; style?: string; [k: `data-${string}`]: any; [k: `aria-${string}`]: any };',
];

export const INTRINSIC_FN_DECL = 'declare function __ripEl<K extends __RipTag>(tag: K, props?: __RipProps<K>): void;';

export const ARIA_TYPE_DECLS = [
  'type __RipAriaNavHandlers = { next?: () => void; prev?: () => void; first?: () => void; last?: () => void; select?: () => void; dismiss?: () => void; tab?: () => void; char?: () => void; };',
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
  "};",
];

export const SIGNAL_INTERFACE = 'interface Signal<T> { value: T; read(): T; lock(): Signal<T>; free(): Signal<T>; kill(): T; }';
export const SIGNAL_FN = 'declare function __state<T>(value: T | Signal<T>): Signal<T>;';
export const COMPUTED_INTERFACE = 'interface Computed<T> { readonly value: T; read(): T; lock(): Computed<T>; free(): Computed<T>; kill(): T; }';
export const COMPUTED_FN = 'declare function __computed<T>(fn: () => T): Computed<T>;';
export const EFFECT_FN = 'declare function __effect(fn: () => void | (() => void)): () => void;';

// ============================================================================
// emitTypes — generate .d.ts from annotated tokens + s-expression tree
// ============================================================================

export function emitTypes(tokens, sexpr = null, source = '') {
  let lines = [];
  let indentLevel = 0;
  let indentStr = '  ';
  let indent = () => indentStr.repeat(indentLevel);
  let inClass = false;
  let classFields = new Set(); // Track emitted field names to avoid duplicates
  let usesSignal = false;
  let usesComputed = false;
  let usesRipIntrinsicProps = false;
  const sourceLines = typeof source === 'string' ? source.split('\n') : [];

  // Pre-scan: detect reactive operators regardless of type annotations.
  // This ensures the DTS preamble declares __state/__computed/__effect
  // so TypeScript can infer types for untyped reactive variables.
  for (let i = 0; i < tokens.length; i++) {
    const tag = tokens[i][0];
    if (tag === 'REACTIVE_ASSIGN') usesSignal = true;
    else if (tag === 'COMPUTED_ASSIGN') usesComputed = true;
  }

  // Format { prop; prop } into multi-line block.  Only applies when the
  // body is a single { ... } object — not a union like { ... } | { ... }.
  let emitBlock = (prefix, body, suffix) => {
    if (body.startsWith('{ ') && body.endsWith(' }')) {
      let depth = 0, firstTopClose = -1;
      for (let c = 0; c < body.length; c++) {
        if (body[c] === '{') depth++;
        else if (body[c] === '}') { depth--; if (depth === 0) { firstTopClose = c; break; } }
      }
      if (firstTopClose === body.length - 1) {
        // Depth-aware split on '; ' at top level only
        let inner = body.slice(2, -2);
        let props = [], start = 0, d = 0;
        for (let c = 0; c < inner.length; c++) {
          if (inner[c] === '{') d++;
          else if (inner[c] === '}') d--;
          else if (d === 0 && inner[c] === ';' && inner[c + 1] === ' ') {
            props.push(inner.slice(start, c));
            start = c + 2;
          }
        }
        if (start < inner.length) props.push(inner.slice(start));
        props = props.filter(p => p.trim());
        if (props.length > 0) {
          lines.push(`${indent()}${prefix}{`);
          indentLevel++;
          for (let prop of props) lines.push(`${indent()}${prop};`);
          indentLevel--;
          lines.push(`${indent()}}${suffix}`);
          return;
        }
      }
    }
    lines.push(`${indent()}${prefix}${body}${suffix}`);
  };

  // Skip past a default value expression (= ...) returning the new j
  let skipDefault = (tokens, j) => {
    j++; // skip =
    let dd = 0;
    while (j < tokens.length) {
      let dt = tokens[j];
      if (dt[0] === '(' || dt[0] === '[' || dt[0] === '{') dd++;
      if (dt[0] === ')' || dt[0] === ']' || dt[0] === '}') {
        if (dd === 0) break; // closing bracket of enclosing structure
        dd--;
      }
      if (dd === 0 && dt[1] === ',') break;
      j++;
    }
    return j;
  };

  // Collect a destructured object { a, b: c, ...rest } recursively.
  // tokens[startJ] must be '{'. Returns { patternStr, typeStr, endJ, hasAnyType }.
  let collectDestructuredObj = (tokens, startJ) => {
    let props = [];
    let hasAnyType = false;
    let j = startJ + 1; // skip opening {
    let d = 1;
    while (j < tokens.length && d > 0) {
      if (tokens[j][0] === '{') d++;
      if (tokens[j][0] === '}') d--;
      if (d <= 0) { j++; break; }

      // Rest: ...name
      if (tokens[j][0] === '...' || tokens[j][0] === 'SPREAD') {
        j++;
        if (tokens[j]?.[0] === 'IDENTIFIER') {
          props.push({ kind: 'rest', propName: tokens[j][1] });
          j++;
        }
        continue;
      }

      // PROPERTY : ... (rename, nested object, or nested array)
      if (tokens[j][0] === 'PROPERTY' && tokens[j + 1]?.[0] === ':') {
        let propName = tokens[j][1];
        j += 2; // skip PROPERTY and :
        // Nested object
        if (tokens[j]?.[0] === '{') {
          let inner = collectDestructuredObj(tokens, j);
          if (inner.hasAnyType) hasAnyType = true;
          props.push({ kind: 'nested-obj', propName, inner });
          j = inner.endJ;
          continue;
        }
        // Nested array
        if (tokens[j]?.[0] === '[') {
          let inner = collectDestructuredArr(tokens, j);
          if (inner.hasAnyType) hasAnyType = true;
          props.push({ kind: 'nested-arr', propName, inner });
          j = inner.endJ;
          continue;
        }
        // Simple rename: PROPERTY : IDENTIFIER
        if (tokens[j]?.[0] === 'IDENTIFIER') {
          let localName = tokens[j][1];
          let type = tokens[j].data?.type;
          if (type) hasAnyType = true;
          let hasDefault = tokens[j + 1]?.[0] === '=';
          props.push({ kind: 'rename', propName, localName, type: type ? expandSuffixes(type) : null, hasDefault });
          j++;
          if (hasDefault) j = skipDefault(tokens, j);
        }
        continue;
      }

      // Simple: IDENTIFIER (possibly with default)
      if (tokens[j][0] === 'IDENTIFIER') {
        let name = tokens[j][1];
        let type = tokens[j].data?.type;
        if (type) hasAnyType = true;
        let hasDefault = tokens[j + 1]?.[0] === '=';
        props.push({ kind: 'simple', propName: name, type: type ? expandSuffixes(type) : null, hasDefault });
        j++;
        if (hasDefault) j = skipDefault(tokens, j);
        continue;
      }

      // Skip commas and other tokens
      j++;
    }

    // Build pattern and type strings
    let patternParts = [];
    let typeParts = [];
    for (let p of props) {
      if (p.kind === 'rest') {
        patternParts.push(`...${p.propName}`);
        typeParts.push(`[key: string]: unknown`);
      } else if (p.kind === 'nested-obj' || p.kind === 'nested-arr') {
        patternParts.push(`${p.propName}: ${p.inner.patternStr}`);
        typeParts.push(`${p.propName}: ${p.inner.typeStr}`);
      } else if (p.kind === 'rename') {
        patternParts.push(`${p.propName}: ${p.localName}`);
        typeParts.push(`${p.propName}${p.hasDefault ? '?' : ''}: ${p.type || 'any'}`);
      } else {
        patternParts.push(p.propName);
        typeParts.push(`${p.propName}${p.hasDefault ? '?' : ''}: ${p.type || 'any'}`);
      }
    }
    return {
      patternStr: `{${patternParts.join(', ')}}`,
      typeStr: `{${typeParts.join(', ')}}`,
      endJ: j,
      hasAnyType,
    };
  };

  // Collect a destructured array [ a, b ] from tokens.
  // tokens[startJ] must be '['. Returns { patternStr, typeStr, endJ, hasAnyType }.
  let collectDestructuredArr = (tokens, startJ) => {
    let names = [];
    let elemTypes = [];
    let hasAnyType = false;
    let j = startJ + 1; // skip opening [
    let d = 1;
    while (j < tokens.length && d > 0) {
      if (tokens[j][0] === '[') d++;
      if (tokens[j][0] === ']') d--;
      if (d > 0 && tokens[j][0] === 'IDENTIFIER') {
        let name = tokens[j][1];
        let type = tokens[j].data?.type;
        names.push(name);
        elemTypes.push(type ? expandSuffixes(type) : null);
        if (type) hasAnyType = true;
      }
      j++;
    }
    return {
      patternStr: `[${names.join(', ')}]`,
      typeStr: `[${elemTypes.map(t => t || 'any').join(', ')}]`,
      endJ: j,
      hasAnyType,
    };
  };

  // Collect function parameters (handles simple, destructured, rest, defaults)
  let collectParams = (tokens, startIdx) => {
    let params = [];
    let fields = []; // Track @param:: type for class field emission
    let j = startIdx;
    let openTag = tokens[j]?.[0];
    if (openTag !== 'CALL_START' && openTag !== 'PARAM_START') return { params, fields, endIdx: j };
    let closeTag = openTag === 'CALL_START' ? 'CALL_END' : 'PARAM_END';
    j++;
    let depth = 0;

    while (j < tokens.length && !(tokens[j][0] === closeTag && depth === 0)) {
      let tok = tokens[j];

      // Skip commas at depth 0
      if (tok[1] === ',' && depth === 0) { j++; continue; }

      // Track nesting
      if (tok[0] === '{' || tok[0] === '[' || tok[0] === 'CALL_START' ||
          tok[0] === 'PARAM_START' || tok[0] === 'INDEX_START') depth++;
      if (tok[0] === '}' || tok[0] === ']' || tok[0] === 'CALL_END' ||
          tok[0] === 'PARAM_END' || tok[0] === 'INDEX_END') { depth--; j++; continue; }

      // @ prefix (constructor shorthand: @name)
      if (tok[0] === '@') {
        j++;
        if (tokens[j]?.[0] === 'PROPERTY' || tokens[j]?.[0] === 'IDENTIFIER') {
          let name = tokens[j][1];
          let type = tokens[j].data?.type;
          params.push(type ? `${name}: ${expandSuffixes(type)}` : name);
          if (type) fields.push({ name, type: expandSuffixes(type) });
          j++;
        }
        continue;
      }

      // Rest parameter: ...name
      if (tok[0] === 'SPREAD' || tok[1] === '...') {
        j++;
        if (tokens[j]?.[0] === 'IDENTIFIER') {
          let name = tokens[j][1];
          let type = tokens[j].data?.type;
          params.push(type ? `...${name}: ${expandSuffixes(type)}` : `...${name}: any[]`);
          j++;
        }
        continue;
      }

      // Destructured object parameter: { a, b }
      if (tok[0] === '{') {
        depth--; // undo the depth++ from nesting tracker above
        let result = collectDestructuredObj(tokens, j);
        j = result.endJ;
        if (result.hasAnyType) {
          params.push(`${result.patternStr}: ${result.typeStr}`);
        } else {
          params.push(result.patternStr);
        }
        continue;
      }

      // Destructured array parameter: [ a, b ]
      if (tok[0] === '[') {
        depth--; // undo the depth++ from nesting tracker above
        let result = collectDestructuredArr(tokens, j);
        j = result.endJ;
        if (result.hasAnyType) {
          params.push(`${result.patternStr}: ${result.typeStr}`);
        } else {
          params.push(result.patternStr);
        }
        continue;
      }

      // Simple identifier parameter
      if (tok[0] === 'IDENTIFIER') {
        let paramName = tok[1];
        let paramType = tok.data?.type;

        // Check for default value (skip = and the default expression)
        let hasDefault = false;
        if (tokens[j + 1]?.[0] === '=') {
          hasDefault = true;
        }

        let isOptional = hasDefault || tok.data?.predicate;
        if (paramType) {
          params.push(`${paramName}${isOptional ? '?' : ''}: ${expandSuffixes(paramType)}`);
        } else {
          params.push(paramName);
        }
        j++;

        // Skip past default value expression
        if (hasDefault) {
          j++; // skip =
          let dd = 0;
          while (j < tokens.length) {
            let dt = tokens[j];
            if (dt[0] === '(' || dt[0] === '[' || dt[0] === '{') dd++;
            if (dt[0] === ')' || dt[0] === ']' || dt[0] === '}') dd--;
            if (dd === 0 && (dt[1] === ',' || dt[0] === 'CALL_END')) break;
            j++;
          }
        }
        continue;
      }

      j++;
    }

    return { params, fields, endIdx: j };
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

      // Export default
      if (tag === 'DEFAULT') {
        i++;
        if (i >= tokens.length) break;
        t = tokens[i];
        tag = t[0];

        // export default IDENTIFIER (re-export)
        if (tag === 'IDENTIFIER') {
          lines.push(`${indent()}export default ${t[1]};`);
        }
        // export default { ... } or other expressions — skip for now
        continue;
      }
    }

    // Import statements — pass through for type references
    if (tag === 'IMPORT') {
      let importTokens = [];
      let j = i + 1;
      while (j < tokens.length && tokens[j][0] !== 'TERMINATOR') {
        importTokens.push(tokens[j]);
        j++;
      }
      // Reconstruct: join with spaces, then clean up spacing
      let raw = 'import ' + importTokens.map(tk => tk[1]).join(' ');
      raw = raw.replace(/\s+/g, ' ')
               .replace(/\s*,\s*/g, ', ')
               .replace(/\{\s*/g, '{ ').replace(/\s*\}/g, ' }')
               .trim();
      lines.push(`${indent()}${raw};`);
      i = j;
      continue;
    }

    // TYPE_DECL marker — emit type alias or interface
    if (tag === 'TYPE_DECL') {
      let data = t.data;
      if (!data) continue;
      let exp = (exported || data.exported) ? 'export ' : '';
      let params = data.typeParams || '';

      if (data.kind === 'overload') {
        // Emit function overload signature from saved tokens
        let ot = data.overloadTokens;
        let nameToken = ot[1]; // DEF is [0], name is [1]
        let { params: paramList } = collectParams(ot, 2);
        let returnType = nameToken.data?.returnType;
        let ret = returnType ? `: ${expandSuffixes(returnType)}` : '';
        let declare = inClass ? '' : (exp ? '' : 'declare ');
        let typeParams = data.typeParams || '';
        if (inClass) {
          lines.push(`${indent()}${data.name}${typeParams}(${paramList.join(', ')})${ret};`);
        } else {
          lines.push(`${indent()}${exp}${declare}function ${data.name}${typeParams}(${paramList.join(', ')})${ret};`);
        }
      } else if (data.kind === 'interface') {
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
          classFields.clear();
          indentLevel++;
        }
      }
      continue;
    }

    // DEF — emit function or method declaration
    if (tag === 'DEF') {
      let nameToken = tokens[i + 1];
      if (!nameToken) continue;
      let fnName = nameToken[1];
      let returnType = nameToken.data?.returnType;
      if (!returnType && nameToken.data?.await === true) returnType = 'void';
      let typeParams = nameToken.data?.typeParams || '';

      let { params, endIdx } = collectParams(tokens, i + 2);

      // Only emit if there are type annotations
      if (returnType || params.some(p => p.includes(':'))) {
        let exp = exported ? 'export ' : '';
        let declare = inClass ? '' : (exported ? '' : 'declare ');
        let ret = returnType ? `: ${expandSuffixes(returnType)}` : '';
        let paramStr = params.join(', ');
        if (inClass) {
          lines.push(`${indent()}${fnName}${typeParams}(${paramStr})${ret};`);
        } else {
          lines.push(`${indent()}${exp}${declare}function ${fnName}${typeParams}(${paramStr})${ret};`);
        }
      }
      i = endIdx; // advance past params to avoid leaking destructured typed identifiers
      continue;
    }

    // Class method block: { PROPERTY ... PROPERTY ... }
    // Contains one or more methods separated by TERMINATOR
    if (tag === '{' && inClass) {
      let j = i + 1;
      let braceDepth = 1;

      while (j < tokens.length && braceDepth > 0) {
        let tok = tokens[j];

        if (tok[0] === '{') { braceDepth++; j++; continue; }
        if (tok[0] === '}') { braceDepth--; j++; continue; }
        if (tok[0] === 'TERMINATOR') { j++; continue; }

        // Found a method: PROPERTY "name" : PARAM_START ... PARAM_END -> body
        if (tok[0] === 'PROPERTY' && braceDepth === 1) {
          let methodName = tok[1];
          let returnType = tok.data?.returnType;
          j++;

          // Skip : separator
          if (tokens[j]?.[1] === ':') j++;

          let params = [];
          let fields = [];
          if (tokens[j]?.[0] === 'PARAM_START') {
            let result = collectParams(tokens, j);
            params = result.params;
            fields = result.fields;
            j = result.endIdx + 1;
          }

          // Skip -> and method body (INDENT ... OUTDENT)
          if (tokens[j]?.[0] === '->' || tokens[j]?.[0] === '=>') j++;
          if (tokens[j]?.[0] === 'INDENT') {
            let d = 1;
            j++;
            while (j < tokens.length && d > 0) {
              if (tokens[j][0] === 'INDENT') d++;
              if (tokens[j][0] === 'OUTDENT') d--;
              j++;
            }
          }

          if (returnType || params.some(p => p.includes(':'))) {
            let ret = returnType ? `: ${expandSuffixes(returnType)}` : '';
            let paramStr = params.join(', ');
            // Emit field declarations for constructor @param:: type shorthand
            if (methodName === 'constructor' && fields.length) {
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

    // Arrow function assignment: name = (params) -> body
    if (tag === 'IDENTIFIER' && !inClass && tokens[i + 1]?.[0] === '=' &&
        (tokens[i + 2]?.[0] === 'PARAM_START' || tokens[i + 2]?.[0] === '(')) {
      let fnName = t[1];
      let j = i + 2;

      let { params } = collectParams(tokens, j);

      // Find the -> or => token to get return type
      let k = j;
      let depth = 0;
      while (k < tokens.length) {
        if (tokens[k][0] === 'PARAM_START' || tokens[k][0] === '(') depth++;
        if (tokens[k][0] === 'PARAM_END' || tokens[k][0] === ')') depth--;
        if (depth === 0 && (tokens[k][0] === '->' || tokens[k][0] === '=>')) break;
        k++;
      }
      let returnType = tokens[k]?.data?.returnType;

      if (returnType || params.some(p => p.includes(':'))) {
        let exp = exported ? 'export ' : '';
        let declare = exported ? '' : 'declare ';
        let ret = returnType ? `: ${expandSuffixes(returnType)}` : '';
        let paramStr = params.join(', ');
        lines.push(`${indent()}${exp}${declare}function ${fnName}(${paramStr})${ret};`);
        continue;
      }
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
          usesSignal = true;
          lines.push(`${indent()}${exp}${declare}const ${varName}: Signal<${type}>;`);
        } else if (next[0] === 'COMPUTED_ASSIGN') {
          usesComputed = true;
          lines.push(`${indent()}${exp}${declare}const ${varName}: Computed<${type}>;`);
        } else if (next[0] === 'EFFECT') {
          lines.push(`${indent()}${exp}${declare}const ${varName}: () => void;`);
        } else if (next[0] === '=') {
          // Check if RHS is an arrow function with return type
          let arrowIdx = i + 2;
          // Skip past PARAM_START ... PARAM_END if present
          if (tokens[arrowIdx]?.[0] === 'PARAM_START') {
            let d = 1, k = arrowIdx + 1;
            while (k < tokens.length && d > 0) {
              if (tokens[k][0] === 'PARAM_START') d++;
              if (tokens[k][0] === 'PARAM_END') d--;
              k++;
            }
            arrowIdx = k;
          }
          let arrowToken = tokens[arrowIdx];
          if (arrowToken && (arrowToken[0] === '->' || arrowToken[0] === '=>') &&
              arrowToken.data?.returnType) {
            // Typed arrow function assignment
            let returnType = expandSuffixes(arrowToken.data.returnType);
            let { params } = collectParams(tokens, i + 2);
            let paramStr = params.join(', ');
            lines.push(`${indent()}${exp}${declare}function ${varName}(${paramStr}): ${returnType};`);
          } else if (inClass) {
            lines.push(`${indent()}${varName}: ${type};`);
            classFields.add(varName);
          } else {
            lines.push(`${indent()}${exp}let ${varName}: ${type};`);
          }
        } else if (inClass) {
          // Class property without assignment
          lines.push(`${indent()}${varName}: ${type};`);
          classFields.add(varName);
        }
      } else if (inClass) {
        lines.push(`${indent()}${varName}: ${type};`);
      }
    }
  }

  // Walk s-expression tree for component declarations
  let componentVars = new Set();
  let hasSchemaDecls = false;
  if (sexpr) {
    usesRipIntrinsicProps = emitComponentTypes(sexpr, lines, indent, indentLevel, componentVars, sourceLines) || usesRipIntrinsicProps;

    // Remove lines for variables that belong to components (emitted as class members)
    if (componentVars.size > 0) {
      for (let k = lines.length - 1; k >= 0; k--) {
        let match = lines[k].match(/(?:declare |export )*(?:const|let) (\w+)/);
        if (match && componentVars.has(match[1])) lines.splice(k, 1);
      }
    }

    // Schema declarations — strip any prior auto-emitted `declare let Foo`
    // for the same bindings (they are re-emitted as typed Schema<T>).
    let schemaLines = [];
    hasSchemaDecls = emitSchemaTypes(sexpr, schemaLines);
    if (hasSchemaDecls) {
      let bindings = new Set();
      for (let line of schemaLines) {
        let m = line.match(/(?:declare |export )*const (\w+)/);
        if (m) bindings.add(m[1]);
      }
      for (let k = lines.length - 1; k >= 0; k--) {
        let m = lines[k].match(/(?:declare |export )*(?:const|let) (\w+)/);
        if (m && bindings.has(m[1])) lines.splice(k, 1);
      }
      lines.push(...schemaLines);
    }
  }

  if (lines.length === 0) return null;

  // Prepend reactive type definitions if used
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
  if (hasSchemaDecls) {
    preamble.push(...SCHEMA_INTRINSIC_DECLS);
  }
  if (preamble.length > 0) {
    preamble.push('');
  }

  return preamble.concat(lines).join('\n') + '\n';
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
// Component type emission — walk s-expression for component declarations
// ============================================================================

function emitComponentTypes(sexpr, lines, indent, indentLevel, componentVars, sourceLines) {
  if (!Array.isArray(sexpr)) return false;
  let head = sexpr[0]?.valueOf?.() ?? sexpr[0];
  let usesIntrinsicProps = false;

  const refMembers = new Map();
  const isIntrinsicTag = (name) => typeof name === 'string' && /^[a-z]/.test(name);
  const collectRefMembers = (node) => {
    if (!Array.isArray(node)) return;
    let nodeHead = node[0]?.valueOf?.() ?? node[0];
    if (isIntrinsicTag(nodeHead)) {
      for (let i = 1; i < node.length; i++) {
        let child = node[i];
        if (!Array.isArray(child)) continue;
        let childHead = child[0]?.valueOf?.() ?? child[0];
        if (childHead !== 'object') continue;
        for (let j = 1; j < child.length; j++) {
          let entry = child[j];
          if (!Array.isArray(entry)) continue;
          let key = entry[0]?.valueOf?.() ?? entry[0];
          if (key !== 'ref') continue;
          let refName = entry[1]?.valueOf?.() ?? entry[1];
          if (typeof refName === 'string') refName = refName.replace(/^["']|["']$/g, '');
          if (typeof refName === 'string' && !refMembers.has(refName)) {
            refMembers.set(refName, `__RipDomEl<'${nodeHead}'> | null`);
          }
        }
      }
    }
    for (let i = 1; i < node.length; i++) {
      if (Array.isArray(node[i])) collectRefMembers(node[i]);
    }
  };

  // export Name = component ... → ["export", ["=", "Name", ["component", ...members]]]
  // Name = component ...       → ["=", "Name", ["component", ...members]]
  let exported = false;
  let name = null;
  let compNode = null;
  let typeParams = '';

  if (head === 'export' && Array.isArray(sexpr[1])) {
    exported = true;
    let inner = sexpr[1];
    let innerHead = inner[0]?.valueOf?.() ?? inner[0];
    if (innerHead === '=' && Array.isArray(inner[2]) &&
        (inner[2][0]?.valueOf?.() ?? inner[2][0]) === 'component') {
      typeParams = inner[1]?.typeParams || '';
      name = inner[1]?.valueOf?.() ?? inner[1];
      compNode = inner[2];
    }
  } else if (head === '=' && Array.isArray(sexpr[2]) &&
             (sexpr[2][0]?.valueOf?.() ?? sexpr[2][0]) === 'component') {
    typeParams = sexpr[1]?.typeParams || '';
    name = sexpr[1]?.valueOf?.() ?? sexpr[1];
    compNode = sexpr[2];
  }

  if (name && compNode) {
    let exp = exported ? 'export ' : '';
    let inheritsTag = compNode[1]?.valueOf?.() ?? null;
    let inheritedPropsType = inheritsTag ? `__RipProps<'${inheritsTag}'>` : null;
    if (inheritedPropsType) usesIntrinsicProps = true;

    // Component structure: ["component", parent, ["block", ...members]]
    let body = compNode[2];
    let members = (Array.isArray(body) && (body[0]?.valueOf?.() ?? body[0]) === 'block')
      ? body.slice(1) : (body ? [body] : []);

    let publicProps = [];
    let bodyMembers = [];
    let hasRequired = false;

    // Infer type from literal initializer when no explicit annotation
    let inferLiteralType = (v) => {
      let s = v?.valueOf?.() ?? v;
      if (typeof s !== 'string') return null;
      if (s === 'true' || s === 'false') return 'boolean';
      if (/^-?\d+(\.\d+)?$/.test(s)) return 'number';
      if (s.startsWith('"') || s.startsWith("'")) return 'string';
      return null;
    };

    for (let member of members) {
      if (!Array.isArray(member)) continue;
      let mHead = member[0]?.valueOf?.() ?? member[0];

      let target, propName, isProp, type, hasDefault;

      if (mHead === 'state' || mHead === 'readonly' || mHead === 'computed') {
        target = member[1];
        isProp = Array.isArray(target) && (target[0]?.valueOf?.() ?? target[0]) === '.' && (target[1]?.valueOf?.() ?? target[1]) === 'this';
        propName = isProp ? (target[2]?.valueOf?.() ?? target[2]) : (target?.valueOf?.() ?? target);
        type = isProp ? target[2]?.type : target?.type;
        hasDefault = true;
        if (!isProp) {
          componentVars.add(propName);
          let wrapper = (mHead === 'computed') ? 'Computed' : 'Signal';
          let typeStr = type ? expandSuffixes(type) : (inferLiteralType(member[2]) || 'any');
          bodyMembers.push(`  ${propName}: ${wrapper}<${typeStr}>;`);
          continue;
        }
      } else if (mHead === '.') {
        isProp = (member[1]?.valueOf?.() ?? member[1]) === 'this';
        propName = isProp ? (member[2]?.valueOf?.() ?? member[2]) : null;
        type = isProp ? member[2]?.type : null;
        hasDefault = false;
        if (!isProp && propName) componentVars.add(propName);
      } else if (mHead === 'object') {
        // Method definitions: (object (: methodName (-> (params...) (block ...))))
        for (let i = 1; i < member.length; i++) {
          let entry = member[i];
          if (!Array.isArray(entry) || entry.length < 3) continue;
          let methName = entry[1]?.valueOf?.() ?? entry[1];
          let funcDef = entry[2];
          if (!Array.isArray(funcDef)) continue;
          let fHead = funcDef[0]?.valueOf?.() ?? funcDef[0];
          if (fHead !== '->' && fHead !== '=>') continue;
          let params = funcDef[1];
          if (!Array.isArray(params)) continue;
          let hasTypedParams = params.some(p => p?.type);
          if (!hasTypedParams) continue;
          let paramStrs = [];
          for (let p of params) {
            let pName = p?.valueOf?.() ?? p;
            let pType = p?.type ? expandSuffixes(p.type) : 'any';
            paramStrs.push(`${pName}: ${pType}`);
          }
          bodyMembers.push(`  ${methName}(${paramStrs.join(', ')}): void;`);
        }
        continue;
      } else if (mHead === 'render') {
        usesIntrinsicProps = true;
        collectRefMembers(member[1]);
        continue;
      } else {
        continue;
      }

      if (!isProp || !propName) continue;

      let typeStr = type ? expandSuffixes(type) : 'any';
      let opt = hasDefault ? '?' : '';
      if (!hasDefault) hasRequired = true;
      publicProps.push(`    ${propName}${opt}: ${typeStr};`);
      if (mHead === 'state') {
        publicProps.push(`    __bind_${propName}__?: Signal<${typeStr}>;`);
      }
    }

    lines.push(`${exp}declare class ${name}${typeParams} {`);
    if (publicProps.length > 0 || inheritedPropsType) {
      let propsOpt = hasRequired ? '' : '?';
      if (publicProps.length > 0) {
        lines.push(`  constructor(props${propsOpt}: {`);
        for (let p of publicProps) lines.push(p);
        lines.push(inheritedPropsType ? `  } & ${inheritedPropsType});` : '  });');
      } else {
        lines.push(`  constructor(props${propsOpt}: ${inheritedPropsType});`);
      }
    } else {
      lines.push(`  constructor(props?: {});`);
    }
    for (let [refName, refType] of refMembers) {
      bodyMembers.push(`  ${refName}: ${refType};`);
    }
    for (let m of bodyMembers) lines.push(m);
    lines.push(`}`);
  }

  // Recurse into child nodes
  if (head === 'program' || head === 'block') {
    for (let i = 1; i < sexpr.length; i++) {
      if (Array.isArray(sexpr[i])) {
        usesIntrinsicProps = emitComponentTypes(sexpr[i], lines, indent, indentLevel, componentVars, sourceLines) || usesIntrinsicProps;
      }
    }
  }
  // Also check inside export wrappers
  if (head === 'export' && Array.isArray(sexpr[1]) && !compNode) {
    usesIntrinsicProps = emitComponentTypes(sexpr[1], lines, indent, indentLevel, componentVars, sourceLines) || usesIntrinsicProps;
  }

  return usesIntrinsicProps;
}

// ============================================================================
// Registration — install emitTypes into the compiler at module load.
// ============================================================================
// The compiler exposes setTypesEmitter() as a no-op-friendly hook. When
// nothing imports types-emit.js (browser bundle), the emitter stays null
// and compile()s .d.ts output is silently skipped. CLI entry points and
// typecheck.js import this module specifically to install the emitter.

setTypesEmitter(emitTypes);
