// PRD Compiler - Uses Predictive Recursive Descent parser
// Same as compiler.js but imports parser-prd.js (generated with -r flag)

import { Lexer } from './lexer.js';
import { parser } from './parser-prd.js';
import { CodeGenerator } from './codegen.js';

// ==============================================================================
// S-Expression Pretty Printer
// ==============================================================================

/**
 * Forms that should stay on a single line when possible.
 * These are simple operations that are more readable inline.
 *
 * RULE: Only include operators that are ALWAYS simple enough for one line.
 * Function calls, constructors, and complex forms should NOT be here.
 */
const INLINE_FORMS = new Set([
  '+', '-', '*', '/', '%', '//', '%%', '**',         // Arithmetic
  '==', '!=', '<', '>', '<=', '>=', '===', '!==',    // Comparison
  '&&', '||', '??', '!?', 'not',                     // Logical
  '&', '|', '^', '<<', '>>', '>>>',                  // Bitwise and shifts
  '=', '.', '?.', '[]', '?[]', '::', '?::',          // Assignment & properties
  '!', 'typeof', 'void', 'delete', 'new',            // Prefix operators
  '...', 'rest', 'expansion', 'optindex', 'optcall', // Spread/rest & optionals
]);

/**
 * Determine if an array should be formatted inline (single line)
 */
function isInline(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;

  const head = arr[0]?.valueOf?.() ?? arr[0];
  if (INLINE_FORMS.has(head)) return true;

  // Small arrays without nesting can be inline
  return arr.length <= 4 && !arr.some(Array.isArray);
}

/**
 * Format a single atom (non-array element)
 */
function formatAtom(elem) {
  if (Array.isArray(elem)) return '(???)';
  if (typeof elem === 'number') return String(elem);
  if (elem === null) return 'null';
  if (elem === '') return '""';

  const str = String(elem);

  // Handle multi-line regexes (heregex) - collapse to single line
  if (str[0] === '/' && str.indexOf('\n') >= 0) {
    const match = str.match(/\/([gimsuvy]*)$/);
    const flags = match ? match[1] : '';

    let content = str.slice(1);
    if (flags) {
      content = content.slice(0, -flags.length - 1);
    } else {
      content = content.slice(0, -1);
    }

    // Remove whitespace and comments
    const lines = content.split('\n');
    const cleaned = lines.map(line => line.replace(/#.*$/, '').trim());
    const processed = cleaned.join('');

    return `"/${processed}/${flags}"`;
  }

  return str;
}

/**
 * Pretty-print S-expression AST (Clean Room Implementation)
 *
 * RULES:
 * 1. Inline forms stay on one line: (+ 1 2) (. obj prop)
 * 2. Block forms have children on separate lines (each child indented +2)
 * 3. 'block' nodes ALWAYS format children on separate lines
 * 4. Children are ALWAYS indented more than parents (no column alignment)
 *
 * @param {Array} arr - S-expression to format
 * @param {number} indent - Current indentation level (spaces)
 * @param {boolean} isTopLevel - Whether this is the top-level program node
 * @returns {string} Formatted string
 */
function formatSExpr(arr, indent = 0, isTopLevel = false) {
  // Base case: atom
  if (!Array.isArray(arr)) return formatAtom(arr);

  // Special case: top-level program node
  if (isTopLevel && arr[0] === 'program') {
    const secondElem = arr[1];
    const header = Array.isArray(secondElem)
      ? '(program'
      : '(program ' + formatAtom(secondElem);

    const lines = [header];
    const startIndex = Array.isArray(secondElem) ? 1 : 2;

    for (let i = startIndex; i < arr.length; i++) {
      const child = formatSExpr(arr[i], 2, false);
      lines.push(child[0] === '(' ? '  ' + child : child);
    }
    lines.push(')');
    return lines.join('\n');
  }

  // Check if this can be truly inline (single line, no complex children)
  const head = arr[0];
  const canBeInline = isInline(arr) && arr.slice(1).every(elem =>
    !Array.isArray(elem) || isInline(elem)
  );

  if (canBeInline) {
    // Try formatting as inline
    const parts = arr.map(elem =>
      Array.isArray(elem) ? formatSExpr(elem, 0, false) : formatAtom(elem)
    );
    const inline = `(${parts.join(' ')})`;

    // If result is truly single-line, use it
    if (!inline.includes('\n')) {
      return ' '.repeat(indent) + inline;
    }
    // Otherwise fall through to block formatting
  }

  // Block formatting: head on first line, children on subsequent lines
  const spaces = ' '.repeat(indent);

  // Format the head
  let formattedHead;
  if (Array.isArray(head)) {
    formattedHead = formatSExpr(head, 0, false);
    // If head spans multiple lines, re-indent continuation lines to match parent indent
    if (formattedHead.includes('\n')) {
      const headLines = formattedHead.split('\n');
      formattedHead = headLines.map((line, i) =>
        i === 0 ? line : ' '.repeat(indent + 2) + line
      ).join('\n');
    }
  } else {
    formattedHead = formatAtom(head);
  }

  const lines = [`${spaces}(${formattedHead}`];

  // Determine if children should be inline or on separate lines
  const forceChildrenOnNewLines = head === 'block';

  for (let i = 1; i < arr.length; i++) {
    const elem = arr[i];

    if (!Array.isArray(elem)) {
      // Atom - append to current line
      lines[lines.length - 1] += ' ' + formatAtom(elem);
    } else {
      // Array child - check if it can be inlined
      const childInline = isInline(elem) && elem.every(e => !Array.isArray(e) || isInline(e));

      if (!forceChildrenOnNewLines && childInline) {
        // Try inline
        const formatted = formatSExpr(elem, 0, false);
        if (!formatted.includes('\n')) {
          lines[lines.length - 1] += ' ' + formatted;
          continue;
        }
      }

      // Format as block child (new line, properly indented)
      const formatted = formatSExpr(elem, indent + 2, false);
      lines.push(formatted);
    }
  }

  // Close paren on last line
  lines[lines.length - 1] += ')';
  return lines.join('\n');
}

export class Compiler {
  constructor(options = {}) {
    this.options = {
      showTokens: false,
      showSExpr: false,
      ...options
    };
  }

  compile(source) {
    // Step 0: Handle __DATA__ marker (Ruby-style)
    // Everything after __DATA__ goes into a DATA variable
    // Only matches when line is EXACTLY __DATA__ (no whitespace, not indented)
    let dataSection = null;
    const lines = source.split('\n');
    const dataLineIndex = lines.findIndex(line => line === '__DATA__');

    if (dataLineIndex !== -1) {
      // Extract everything after __DATA__ line (preserve final newline if present)
      const dataLines = lines.slice(dataLineIndex + 1);
      dataSection = dataLines.length > 0 ? dataLines.join('\n') + '\n' : '';
      // Keep only lines before __DATA__
      source = lines.slice(0, dataLineIndex).join('\n');
    }

    // Step 1: Tokenize with CoffeeScript lexer
    const lexer = new Lexer();
    const tokens = lexer.tokenize(source);

    if (this.options.showTokens) {
      tokens.forEach(t => {
        console.log(`${t[0].padEnd(12)} ${JSON.stringify(t[1])}`);
      });
      console.log();
    }

    // Step 2: Parse with Solar parser (PRD version) to build s-expressions
    parser.lexer = {
      tokens: tokens,
      pos: 0,
      setInput: function(input, yy) {
        // Already tokenized, nothing to do
      },
      lex: function() {
        if (this.pos >= this.tokens.length) return 1; // EOF
        const token = this.tokens[this.pos++];
        // IMPORTANT: token[1] can be a String object with metadata (.quote, .heregex, etc.)
        // Preserve the String object - don't convert to primitive!
        this.yytext = token[1];
        this.yylloc = token[2];
        return token[0]; // Return tag
      }
    };

    let sexpr;
    try {
      sexpr = parser.parse(source);
    } catch (parseError) {
      // Check for common patterns that aren't supported and provide helpful messages
      // Nested ternaries: x ? (y ? a : b) : c
      if (/\?\s*\([^)]*\?[^)]*:[^)]*\)\s*:/.test(source) ||
          /\?\s+\w+\s+\?\s+/.test(source)) {
        throw new Error('Nested ternary operators are not supported. Use if/else statements instead:\n' +
                       '  Instead of: x ? (y ? a : b) : c\n' +
                       '  Use: if x then (if y then a else b) else c');
      }
      // Re-throw original error if not a known pattern
      throw parseError;
    }

    if (this.options.showSExpr) {
      console.log(formatSExpr(sexpr, 0, true));
      console.log();
    }

    // Step 3: Generate JavaScript code (pass dataSection to generator)
    const generator = new CodeGenerator({ dataSection });
    let code = generator.compile(sexpr);

    return {
      tokens,
      sexpr,
      code,
      data: dataSection  // Include data section in result
    };
  }

  compileToJS(source) {
    return this.compile(source).code;
  }

  compileToSExpr(source) {
    return this.compile(source).sexpr;
  }
}

// Convenience function
export function compile(source, options = {}) {
  const compiler = new Compiler(options);
  return compiler.compile(source);
}

export function compileToJS(source, options = {}) {
  const compiler = new Compiler(options);
  return compiler.compileToJS(source);
}

// Export the s-expression formatter for external use (e.g., browser REPL)
export { formatSExpr };

