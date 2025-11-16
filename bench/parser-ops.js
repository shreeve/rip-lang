#!/usr/bin/env bun
// Count parser operations (shifts, reduces, lookups)

import { Lexer } from '../src/lexer.js';
import parser from '../src/parser.js';
import * as fs from 'fs';

const testFile = 'src/grammar/solar.rip';
const source = fs.readFileSync(testFile, 'utf8');

console.log('=== Parser Operation Analysis ===');
console.log(`File: ${testFile}\n`);

// Instrument parser by wrapping the parse function
const originalParse = parser.parse;
const stats = {
  lexCalls: 0,
  tableLookups: 0,
  shifts: 0,
  reduces: 0,
  aliasReduces: 0,
  complexReduces: 0,
};

// Hook into parser internals by modifying the instance temporarily
const originalTableAccess = parser.parseTable;
const instrumentedTable = new Proxy(originalTableAccess, {
  get(target, prop) {
    stats.tableLookups++;
    return target[prop];
  }
});

// We can't easily instrument the internal parse loop without modifying it,
// so let's analyze the grammar structure instead

const aliasRules = parser.aliasRules || new Set();
console.log(`Alias rules in grammar: ${aliasRules.size}`);
console.log(`Total rules: ${parser.ruleTable.length / 2}`);
console.log(`Alias percentage: ${(aliasRules.size / (parser.ruleTable.length / 2) * 100).toFixed(1)}%\n`);

// Analyze rule lengths (impacts reduction cost)
const lengthDist = {};
for (let i = 2; i < parser.ruleTable.length; i += 2) {
  const len = parser.ruleTable[i + 1];
  lengthDist[len] = (lengthDist[len] || 0) + 1;
}

console.log('Rule length distribution (impacts stack ops):');
Object.entries(lengthDist)
  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  .forEach(([len, count]) => {
    const pct = (count / (parser.ruleTable.length / 2) * 100).toFixed(1);
    console.log(`  Length ${len}: ${count.toString().padStart(3)} rules (${pct.padStart(5)}%) - ${len * count} stack pops total`);
  });

// Calculate weighted average
let totalStackOps = 0;
let totalRules = 0;
for (const [len, count] of Object.entries(lengthDist)) {
  totalStackOps += parseInt(len) * count;
  totalRules += count;
}
console.log(`\nWeighted avg rule length: ${(totalStackOps / totalRules).toFixed(2)} symbols`);
console.log(`Total stack ops per full parse: ~${totalStackOps} pops/pushes`);
