#!/usr/bin/env bun
// Package the Rip VS Code extension into a .vsix.
//
// Why this script exists:
//
// vsce expects an extension to live in a self-contained directory with its
// own npm-style node_modules. We have two violations of that assumption:
//
//   1. Bun's workspace install puts all real package files in a central
//      `<repoRoot>/node_modules/.bun/` store and symlinks them into each
//      package's `node_modules/`. vsce can't follow node_modules symlinks
//      that point outside the package directory — files just get skipped.
//
//   2. `npm ls` (which vsce shells out to for dep enumeration) walks
//      upward from cwd. Run from packages/vscode/, it discovers the
//      workspace root's hoisted node_modules and reports every dep
//      installed for any package in the monorepo (axe-core, dayjs,
//      playwright, …) as belonging to this extension. vsce then tries
//      to bundle all of them, producing case-collision errors on
//      APFS/Windows.
//
// Fix: stage a clean, self-contained copy of the extension in a temp
// directory — minimal package.json (one runtime dep: typescript), real
// node_modules/typescript copied from bun's store, stub package-lock.json
// so vsce uses npm and doesn't re-install. Run vsce there. Move the
// .vsix back. This is the same pattern Volar (Vue) and Astro use for
// their monorepo extensions, just inlined instead of hidden behind a
// rolldown config.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const pkgDir   = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pkgDir, '..', '..');
const pkgJson  = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
let tsVer      = pkgJson.dependencies?.typescript;
if (!tsVer) { console.error('typescript dep missing from package.json'); process.exit(1); }

// The dep is declared as a bun catalog reference (`catalog:` / `catalog:<name>`)
// so the version lives in one place — the root workspace catalog. Resolve it to
// the concrete version here: vsce knows nothing about catalogs, and tsVer is used
// below to locate TypeScript in bun's store and to write the staged manifest, so
// a literal `catalog:` would both fail to resolve and leak into the published vsix.
if (tsVer.startsWith('catalog:')) {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const name = tsVer.slice('catalog:'.length); // '' = the default catalog
  const resolved = (name ? rootPkg.catalogs?.[name] : rootPkg.catalog)?.typescript;
  if (!resolved) { console.error(`could not resolve "${tsVer}" for typescript from root catalog`); process.exit(1); }
  tsVer = resolved;
}

const tsSrc = path.join(repoRoot, 'node_modules', '.bun', `typescript@${tsVer}`, 'node_modules', 'typescript');
if (!fs.existsSync(tsSrc)) {
  console.error(`typescript@${tsVer} not found at ${tsSrc}; run \`bun install\` at the repo root first`);
  process.exit(1);
}

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'rip-vscode-'));

// Copy the files vsce needs.
const include = [
  'README.md', 'icon.png',
  'language-configuration.json', 'schema-language-configuration.json',
  'dist', 'src', 'syntaxes', 'test',
];
for (const name of include) {
  const src = path.join(pkgDir, name);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, path.join(stage, name), { recursive: true, dereference: true });
}

// Real (dereferenced) copy of typescript from bun's central store.
fs.mkdirSync(path.join(stage, 'node_modules'));
fs.cpSync(tsSrc, path.join(stage, 'node_modules', 'typescript'), { recursive: true, dereference: true });

// Stripped package.json: typescript as the only runtime dep, no devDeps.
const stagedPkg = {
  name: pkgJson.name,
  displayName: pkgJson.displayName,
  description: pkgJson.description,
  version: pkgJson.version,
  publisher: pkgJson.publisher,
  license: pkgJson.license,
  repository: pkgJson.repository,
  engines: pkgJson.engines,
  categories: pkgJson.categories,
  keywords: pkgJson.keywords,
  icon: pkgJson.icon,
  main: pkgJson.main,
  contributes: pkgJson.contributes,
  dependencies: { typescript: tsVer },
};
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(stagedPkg, null, 2));

// Stub package-lock.json so vsce's npm-ls call sees a valid lockfile and
// doesn't try to install anything.
fs.writeFileSync(path.join(stage, 'package-lock.json'), JSON.stringify({
  name: pkgJson.name,
  version: pkgJson.version,
  lockfileVersion: 3,
  requires: true,
  packages: {
    '': { name: pkgJson.name, version: pkgJson.version, dependencies: { typescript: tsVer } },
    'node_modules/typescript': { version: tsVer },
  },
}, null, 2));

fs.writeFileSync(path.join(stage, '.vscodeignore'), '.vscode/**\n');

const result = spawnSync('bunx', ['@vscode/vsce', 'package', '--skip-license'], {
  cwd: stage,
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status ?? 1);

const vsix = fs.readdirSync(stage).find(f => f.endsWith('.vsix'));
if (!vsix) { console.error('no .vsix produced'); process.exit(1); }
fs.renameSync(path.join(stage, vsix), path.join(pkgDir, vsix));
fs.rmSync(stage, { recursive: true, force: true });
console.log(`packaged ${vsix}`);
