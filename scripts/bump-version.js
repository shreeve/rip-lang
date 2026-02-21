#!/usr/bin/env bun

// bump-version.js - Update version across all files
// Usage: bun run bump 1.5.8

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..');

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Usage: bun run bump <version>');
  console.error('Example: bun run bump 3.11.0');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
  console.error(`Invalid version format: ${newVersion}`);
  console.error('Expected: X.Y.Z or X.Y.Z-tag');
  process.exit(1);
}

const packageJsonPath = join(ROOT, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const oldVersion = packageJson.version;

if (oldVersion === newVersion) {
  console.log(`Version is already ${newVersion}`);
  process.exit(0);
}

console.log(`\nBumping version: ${oldVersion} → ${newVersion}\n`);

const updates = [
  {
    file: 'package.json',
    replacements: [
      [/"version": "\d+\.\d+\.\d+(-[\w.]+)?"/, `"version": "${newVersion}"`]
    ]
  },
  {
    file: 'README.md',
    replacements: [
      [/version-\d+\.\d+\.\d+(-[\w.]+)?-blue/g, `version-${newVersion}-blue`],
      [/\*\*Version \d+\.\d+\.\d+(-[\w.]+)?\*\*/g, `**Version ${newVersion}**`]
    ]
  },
  {
    file: 'AGENT.md',
    replacements: [
      [/\| Version \| \d+\.\d+\.\d+(-[\w.]+)? \|/g, `| Version | ${newVersion} |`]
    ]
  },
];

let filesUpdated = 0;

for (const { file, replacements } of updates) {
  const filePath = join(ROOT, file);
  let content;

  try {
    content = readFileSync(filePath, 'utf8');
  } catch (e) {
    console.log(`  - ${file} (not found, skipping)`);
    continue;
  }

  let modified = false;

  for (const [pattern, replacement] of replacements) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(filePath, content);
    console.log(`  ✓ ${file}`);
    filesUpdated++;
  } else {
    console.log(`  - ${file} (no changes)`);
  }
}

console.log(`\n✨ Version ${oldVersion} → ${newVersion} (${filesUpdated} files updated)`);
console.log('\nNext steps:');
console.log('  bun run build     # rebuild browser bundle');
console.log('  bun run test      # verify tests pass');
console.log(`  git tag v${newVersion}`);
