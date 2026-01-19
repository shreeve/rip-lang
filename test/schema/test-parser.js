#!/usr/bin/env bun
// Test Schema Parser

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parse, SchemaLexer } from '../../packages/schema/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get schema file from args or use default
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const schemaFile = args[0] || 'basic.schema';
const schemaPath = path.isAbsolute(schemaFile) ? schemaFile : path.join(__dirname, schemaFile);
const schemaSource = fs.readFileSync(schemaPath, 'utf-8');

console.log('Parsing schema:');
console.log('─'.repeat(50));
console.log(schemaSource);
console.log('─'.repeat(50));

// Debug: show tokens
if (process.argv.includes('--tokens')) {
  console.log('\nTokens:');
  const lexer = new SchemaLexer();
  lexer.setInput(schemaSource);
  for (const token of lexer.tokens) {
    const loc = `L${token.loc.first_line + 1}:${token.loc.first_column}`;
    console.log(`  ${loc.padEnd(8)} ${token.type.padEnd(15)} ${JSON.stringify(token.value)}`);
  }
  console.log();
}

try {
  const ast = parse(schemaSource);
  console.log('Parse successful!\n');
  console.log('AST:');
  console.log(JSON.stringify(ast, null, 2));
} catch (err) {
  console.error('Parse error:', err.message);
  if (err.hash) {
    console.error('  Line:', err.hash.line + 1);
    console.error('  Token:', err.hash.token);
    console.error('  Expected:', err.hash.expected?.join(', '));
  }
  process.exit(1);
}
