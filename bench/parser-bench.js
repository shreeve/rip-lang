#!/usr/bin/env bun
// Parser performance benchmark - isolate each compilation stage

import { Lexer } from '../src/lexer.js';
import parser from '../src/parser.js';
import { Compiler } from '../src/compiler.js';
import * as fs from 'fs';
import * as path from 'path';

const testFiles = [
  'src/grammar/solar.rip',      // Real complex program (928 LOC)
  'src/grammar/grammar.rip',    // Grammar spec (795 LOC)
  'test/rip/functions.rip',     // Complex tests
];

console.log('=== Parser Performance Benchmark ===\n');

// Warm up
const compiler = new Compiler();
for (const file of testFiles) {
  const source = fs.readFileSync(file, 'utf8');
  compiler.compile(source);
}

// Benchmark each file
const results = [];
for (const file of testFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const iterations = 100;

  // Pre-lex once
  const lexer = new Lexer();
  const tokens = lexer.tokenize(source);

  // Time just parsing (no lexer, no codegen)
  let parseStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    parser.lexer = {
      tokens: [...tokens],  // Copy tokens
      pos: 0,
      setInput: function() {},
      lex: function() {
        if (this.pos >= this.tokens.length) return 1; // EOF
        const token = this.tokens[this.pos++];
        this.yytext = token[1];
        this.yylloc = token[2];
        return token[0];
      }
    };
    parser.parse(source);
  }
  const parseTime = (Date.now() - parseStart) / iterations;

  // Time full compilation (lex + parse + codegen)
  const fullStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    compiler.compile(source);
  }
  const fullTime = (Date.now() - fullStart) / iterations;

  const lexTime = fullTime - parseTime;  // Approximate

  results.push({ file, parseTime, lexTime, fullTime });
  const name = path.basename(file);
  console.log(`${name.padEnd(25)} parse: ${parseTime.toFixed(2)}ms  lex+gen: ${lexTime.toFixed(2)}ms  full: ${fullTime.toFixed(2)}ms`);
}

// Totals
const avgParse = results.reduce((sum, r) => sum + r.parseTime, 0) / results.length;
const avgFull = results.reduce((sum, r) => sum + r.fullTime, 0) / results.length;
const parsePercent = ((avgParse / avgFull) * 100).toFixed(1);

console.log('\n' + '─'.repeat(70));
console.log(`Average parse only:           ${avgParse.toFixed(2)}ms (${parsePercent}% of total)`);
console.log(`Average full compile:         ${avgFull.toFixed(2)}ms\n`);

// Parser size
const parserSize = fs.statSync('src/parser.js').size;
console.log(`Parser size:                  ${(parserSize / 1024).toFixed(1)}KB`);
