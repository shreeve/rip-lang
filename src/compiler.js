// Main Compiler - ties together CoffeeScript lexer, Solar parser, and code generator

import { Lexer } from './lexer.js';
import { parser } from './parser.js';
import { CodeGenerator } from './codegen.js';

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
      console.log('=== TOKENS ===');
      tokens.forEach(t => {
        console.log(`${t[0].padEnd(12)} ${JSON.stringify(t[1])}`);
      });
      console.log();
    }

    // Step 2: Parse with Solar parser to build s-expressions
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
      console.log('=== S-EXPRESSIONS ===');
      console.log(JSON.stringify(sexpr, null, 2));
      console.log();
    }

    // Step 3: Generate JavaScript code
    const generator = new CodeGenerator();
    let code = generator.compile(sexpr);

    // Step 4: Inject DATA variable if __DATA__ section present
    if (dataSection !== null) {
      // Strategy:
      // 1. Declare let DATA; at top
      // 2. Call setData() right after
      // 3. Define setData() at bottom with the data string
      // This keeps the big data blob at the bottom but DATA is available throughout

      const lines = code.split('\n');

      // Find where to insert let DATA and setData() call (after other declarations)
      const insertIndex = lines.findIndex((line, i) => {
        if (i === 0) return false;
        return line.trim() &&
               !line.startsWith('let ') &&
               !line.startsWith('const ') &&
               !line.startsWith('var ') &&
               !line.startsWith('//');
      });

      // Insert declaration and call at top
      const topCode = 'var DATA;\n_setDataSection();\n';
      if (insertIndex !== -1) {
        lines.splice(insertIndex, 0, topCode);
      } else {
        lines.unshift(topCode);
      }

      // Add function definition at bottom (function hoists, so available before call)
      const bottomCode = `\nfunction _setDataSection() {\n  DATA = ${JSON.stringify(dataSection)};\n}`;
      lines.push(bottomCode);

      code = lines.join('\n');
    }

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
