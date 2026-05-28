// Bun loader for .rip files

import { plugin } from "bun";
import { fileURLToPath } from "url";
import { dirname, resolve as resolvePath } from "path";
import { readFileSync, existsSync } from "fs";
import { compileToJS, formatError } from "./src/compiler.js";
// Register the full schema runtime provider so .rip files containing
// `schema :model` blocks compile correctly inside spawned workers.
// Workers are launched with `--preload rip-loader.js` and otherwise
// would call compileToJS without ever registering a provider.
import "./src/schema/loader-server.js";

// ── Undeclared-import diagnostic ────────────────────────────────────────
// Walk up from an importer to its nearest package.json, then verify that any
// `@rip-lang/<pkg>` specifier is declared in dependencies/devDependencies/
// peerDependencies/optionalDependencies (or is the package's own self-import).
//
// Throws a clear error before `import.meta.resolve` is even attempted, so
// "works on my machine" failures rooted in link-global rescue surface loudly
// instead of silently shipping.
const declarationCache = new Map(); // importerDir → { pkgName, declared } | null

function getDeclarationInfo(importerPath) {
  const start = dirname(importerPath);
  if (declarationCache.has(start)) return declarationCache.get(start);
  let cur = start;
  let info = null;
  while (true) {
    const pkgPath = resolvePath(cur, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        info = {
          pkgName: pkg.name || null,
          declared: new Set([
            ...Object.keys(pkg.dependencies || {}),
            ...Object.keys(pkg.devDependencies || {}),
            ...Object.keys(pkg.peerDependencies || {}),
            ...Object.keys(pkg.optionalDependencies || {}),
          ]),
        };
      } catch {
        info = { pkgName: null, declared: new Set() };
      }
      break;
    }
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  declarationCache.set(start, info);
  return info;
}

export function assertDeclaredRipImport(importerPath, specifier) {
  const m = specifier.match(/^(@rip-lang\/[^\/]+)/);
  if (!m) return;
  const pkgKey = m[1];
  const info = getDeclarationInfo(importerPath);
  if (!info) return; // ad-hoc script outside any package — don't block
  if (info.pkgName === pkgKey) return; // self-import
  if (info.declared.has(pkgKey)) return;
  throw new Error(
    `Import of '${pkgKey}' is not declared in package.json. ` +
    `Run \`bun add ${pkgKey}\` (or use \`workspace:*\` inside this monorepo).`
  );
}

await plugin({
  name: "rip-loader",
  async setup(build) {
    // Handle .rip files
    build.onLoad({ filter: /\.rip$/ }, async (args) => {
      try {
        const source = readFileSync(args.path, "utf-8");
        let js = compileToJS(source);

        // Rewrite @rip-lang/* imports to absolute paths. Bun workers ignore
        // NODE_PATH, onResolve skips compiled source, and require.resolve({ paths })
        // is broken in plugin handlers — so we use import.meta.resolve, which
        // resolves from this file's location (inside the global node_modules tree).
        js = js.replace(/(from\s+|import\s*\()(['"])(@rip-lang\/[^'"]+)\2/g, (match, prefix, quote, specifier) => {
          assertDeclaredRipImport(args.path, specifier);
          try {
            return `${prefix}${quote}${fileURLToPath(import.meta.resolve(specifier))}${quote}`;
          } catch {
            return match;
          }
        });

        return {
          contents: js,
          loader: "js",
        };
      } catch (err) {
        console.error(formatError(err, { file: args.path }));
        throw err;
      }
    });
  },
});
