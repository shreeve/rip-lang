#!/usr/bin/env bun

import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'fs';
import { join } from 'path';

const src = './packages/ui';
const dst = './docs/ui';

console.log('Building widget gallery for docs/ui/...\n');

mkdirSync(dst, { recursive: true });

// Copy all .rip files
const ripFiles = readdirSync(src).filter(f => f.endsWith('.rip') && f !== 'index.rip');
for (const f of ripFiles) {
  cpSync(join(src, f), join(dst, f));
}
console.log(`  ${ripFiles.length} .rip files copied`);

// Copy CSS
cpSync(join(src, 'index.css'), join(dst, 'index.css'));
console.log('  index.css copied');

// Transform index.html for static hosting
let html = readFileSync(join(src, 'index.html'), 'utf-8');

// Rewrite rip.min.js path: /rip/rip.min.js → ../dist/rip.min.js
html = html.replace('src="/rip/rip.min.js"', 'src="../dist/rip.min.js"');

// Rewrite data-src paths: /name.rip → name.rip (relative)
html = html.replace(/\n\s+\/(\S+\.rip)/g, '\n      $1');

// Remove hot-reload script block (only useful with rip server)
html = html.replace(/  <script>\n    let ready = false;\n    const es[\s\S]*?<\/script>\n/, '');

// Rewrite source viewer fetch: /{id}.rip → {id}.rip (relative)
html = html.replace('fetch! "/#{id}.rip"', 'fetch! "#{id}.rip"');

writeFileSync(join(dst, 'index.html'), html);
console.log('  index.html copied (paths adjusted for static hosting)');

console.log(`\n✨ Gallery ready at docs/ui/ (${ripFiles.length} widgets)`);
