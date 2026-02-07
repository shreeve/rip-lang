#!/usr/bin/env bun

// bump-version.js - Update version across all files
// Usage: bun scripts/bump-version.js 1.5.8

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..');

// Get new version from command line
const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Usage: bun scripts/bump-version.js <version>');
  console.error('Example: bun scripts/bump-version.js 1.5.8');
  process.exit(1);
}

// Validate version format
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
  console.error(`Invalid version format: ${newVersion}`);
  console.error('Expected: X.Y.Z or X.Y.Z-tag');
  process.exit(1);
}

// Read current version from package.json
const packageJsonPath = join(ROOT, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const oldVersion = packageJson.version;

if (oldVersion === newVersion) {
  console.log(`Version is already ${newVersion}`);
  process.exit(0);
}

console.log(`\nBumping version: ${oldVersion} → ${newVersion}\n`);

// Files to update with their patterns
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
      // Badge: version-1.5.7-blue
      [/version-\d+\.\d+\.\d+(-[\w.]+)?-blue/g, `version-${newVersion}-blue`],
      // Text: **Version 1.5.7**
      [/\*\*Version \d+\.\d+\.\d+(-[\w.]+)?\*\*/g, `**Version ${newVersion}**`]
    ]
  },
  {
    file: 'AGENT-RIP.md',
    replacements: [
      // Version line at bottom
      [/Version \d+\.\d+\.\d+(-[\w.]+)?/g, `Version ${newVersion}`]
    ]
  },
];

// Apply updates
let filesUpdated = 0;

for (const { file, replacements } of updates) {
  const filePath = join(ROOT, file);
  let content;

  try {
    content = readFileSync(filePath, 'utf8');
  } catch (e) {
    console.log(`  ⚠️  ${file} - not found, skipping`);
    continue;
  }

  let modified = false;
  let originalContent = content;

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

// Summary
console.log(`\n✨ Updated ${filesUpdated} files to version ${newVersion}`);
console.log('\nNext steps:');
console.log(`  1. Update CHANGELOG.md with release notes`);
console.log(`  2. Run: bun run browser  (rebuild browser bundle)`);
console.log(`  3. Run: bun run test     (verify tests pass)`);
console.log(`  4. Commit and tag: git tag v${newVersion}`);
