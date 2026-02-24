#!/usr/bin/env bun

// bump-version.js — Automated release script for rip-lang
//
// Usage:
//   bun run bump           # bump patch (default)
//   bun run bump patch     # same
//   bun run bump minor     # bump minor, reset patch
//   bun run bump major     # bump major, reset minor+patch

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const ROOT = join(import.meta.dir, '..');
const SKIP_PACKAGES = new Set(['vscode']);

function read(file) { return readFileSync(join(ROOT, file), 'utf8'); }
function write(file, content) { writeFileSync(join(ROOT, file), content); }
function readJSON(file) { return JSON.parse(read(file)); }
function writeJSON(file, obj) { write(file, JSON.stringify(obj, null, 2) + '\n'); }

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: opts.cwd || ROOT, encoding: 'utf8', stdio: opts.stdio || 'pipe', ...opts }).trim();
  } catch (e) {
    if (opts.throws !== false) throw e;
    return null;
  }
}

function bumpVersion(version, level) {
  let [major, minor, patch] = version.split('.').map(Number);
  if (level === 'major') { major++; minor = 0; patch = 0; }
  else if (level === 'minor') { minor++; patch = 0; }
  else { patch++; }
  return `${major}.${minor}.${patch}`;
}

async function registryVersion(name) {
  try {
    const res = await fetch(`https://registry.npmjs.org/${name}/latest`);
    if (!res.ok) return null;
    return (await res.json()).version;
  } catch {
    return null;
  }
}

function packageDirs() {
  return readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
    .filter(d => d.isDirectory() && !SKIP_PACKAGES.has(d.name))
    .filter(d => existsSync(join(ROOT, 'packages', d.name, 'package.json')))
    .map(d => d.name);
}

// ── Parse arguments ──

const level = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(level)) {
  console.error(`Usage: bun run bump [patch|minor|major]`);
  process.exit(1);
}

// ── Step 1: Bump rip-lang ──

const rootPkg = readJSON('package.json');
const oldVersion = rootPkg.version;
const newVersion = bumpVersion(oldVersion, level);

console.log(`\nBumping rip-lang: ${oldVersion} → ${newVersion}\n`);

rootPkg.version = newVersion;
writeJSON('package.json', rootPkg);

// Update AGENTS.md version table
let agents = read('AGENTS.md');
agents = agents.replace(
  /\| Version \| \d+\.\d+\.\d+(-[\w.]+)? \|/g,
  `| Version | ${newVersion} |`
);
write('AGENTS.md', agents);

// Update README.md version badge
let readme = read('README.md');
readme = readme.replace(/version-\d+\.\d+\.\d+(-[\w.]+)?-blue/g, `version-${newVersion}-blue`);
write('README.md', readme);

// ── Step 2: Detect changed packages ──

const dirs = packageDirs();
const changed = [];
const unchanged = [];

// Fetch all published versions in parallel
const pkgEntries = dirs.filter(d => d !== 'all').map(dir => {
  const pkgPath = `packages/${dir}/package.json`;
  const pkg = readJSON(pkgPath);
  return { dir, pkg, pkgPath };
});

const publishedVersions = await Promise.all(
  pkgEntries.map(e => registryVersion(e.pkg.name))
);

for (let i = 0; i < pkgEntries.length; i++) {
  const { dir, pkg, pkgPath } = pkgEntries[i];
  const published = publishedVersions[i];

  if (!published || published !== pkg.version) {
    changed.push({ dir, pkg, pkgPath, reason: 'version mismatch' });
  } else {
    const diff = run(`git diff HEAD -- packages/${dir}/`, { throws: false });
    if (diff && diff.length > 0) {
      changed.push({ dir, pkg, pkgPath, reason: 'uncommitted changes' });
    } else {
      unchanged.push({ dir, pkg, pkgPath });
    }
  }
}

// ── Step 3: Bump changed packages ──

const bumped = [];

for (const item of changed) {
  const oldVer = item.pkg.version;
  const newVer = bumpVersion(oldVer, 'patch');
  item.pkg.version = newVer;

  if (item.pkg.dependencies?.['rip-lang']) {
    item.pkg.dependencies['rip-lang'] = `>=${newVersion}`;
  }

  writeJSON(item.pkgPath, item.pkg);
  bumped.push({ name: item.pkg.name, old: oldVer, new: newVer, dir: item.dir });
}

if (bumped.length > 0) {
  console.log('Changed packages:');
  for (const b of bumped) {
    console.log(`  ${b.name.padEnd(22)} ${b.old} → ${b.new}`);
  }
} else {
  console.log('No package changes detected.');
}

// ── Step 4: Bump @rip-lang/all ──

const allPkgPath = 'packages/all/package.json';
const allPkg = readJSON(allPkgPath);
const allOldVer = allPkg.version;
const allNewVer = bumpVersion(allOldVer, 'patch');
allPkg.version = allNewVer;

if (allPkg.dependencies) {
  allPkg.dependencies['rip-lang'] = `>=${newVersion}`;
  for (const dir of dirs) {
    if (dir === 'all') continue;
    const pkg = readJSON(`packages/${dir}/package.json`);
    if (allPkg.dependencies[pkg.name]) {
      allPkg.dependencies[pkg.name] = `>=${pkg.version}`;
    }
  }
}

writeJSON(allPkgPath, allPkg);
bumped.push({ name: '@rip-lang/all', old: allOldVer, new: allNewVer, dir: 'all' });
console.log(`  ${'@rip-lang/all'.padEnd(22)} ${allOldVer} → ${allNewVer}`);

// ── Step 5: Rebuild and test ──

console.log('\nRebuilding...');

const grammarChanged = run('git diff HEAD -- src/grammar/grammar.rip', { throws: false });
if (grammarChanged && grammarChanged.length > 0) {
  run('bun run parser', { stdio: 'inherit' });
  console.log('  ✓ parser (grammar changed)');
} else {
  console.log('  - parser (no grammar changes)');
}

run('bun run build', { stdio: 'inherit' });
console.log('  ✓ build');

try {
  const testOutput = run('bun run test');
  const match = testOutput.match(/(\d+) passing/);
  const count = match ? match[1] : '?';
  console.log(`  ✓ test (${count} passing)`);
} catch (e) {
  console.error('\n✗ Tests failed! Aborting release.\n');
  run('git checkout -- .', { throws: false });
  process.exit(1);
}

// ── Step 6: Commit and push ──

console.log('\nCommitting...');

const pkgList = bumped.map(b => `  ${b.name}@${b.new}`).join('\n');
const commitMsg = `Release rip-lang ${newVersion}\n\n${pkgList}`;

run('git add -A');
run(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
run('git push');
console.log('  ✓ committed and pushed');

// ── Step 7: Publish ──

console.log('\nPublishing...');

function publish(dir, name, version) {
  const cwd = dir === '.' ? ROOT : join(ROOT, 'packages', dir);
  try {
    run('bun publish --access public', { cwd });
    console.log(`  ✓ ${name}@${version}`);
    return true;
  } catch (e) {
    const msg = e.stderr || e.message || '';
    if (msg.includes('already exists')) {
      console.log(`  - ${name}@${version} (already published)`);
    } else {
      console.error(`  ✗ ${name}@${version}: ${msg.split('\n')[0]}`);
    }
    return false;
  }
}

publish('.', 'rip-lang', newVersion);

for (const b of bumped) {
  if (b.name === '@rip-lang/all') continue;
  publish(b.dir, b.name, b.new);
}

publish('all', '@rip-lang/all', allNewVer);

// ── Step 8: Summary ──

console.log(`\n✨ Released rip-lang ${newVersion}\n`);

const all = [{ name: 'rip-lang', old: oldVersion, new: newVersion }, ...bumped];
const maxName = Math.max(...all.map(b => b.name.length));
for (const b of all) {
  console.log(`  ${b.name.padEnd(maxName + 2)} ${b.old} → ${b.new}`);
}
console.log('');
