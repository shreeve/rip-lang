// Bun loader for .rip files

import { plugin } from "bun";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { compileToJS } from "./src/compiler.js";

// Resolution paths for @rip-lang/* packages: the loader's own node_modules tree,
// plus the global bun install as a fallback (covers dev repo running outside workspace).
const _loaderModules = dirname(dirname(fileURLToPath(import.meta.url)));
const _globalModules = join(process.env.HOME || '', '.bun', 'install', 'global', 'node_modules');
const _resolvePaths = [...new Set([_loaderModules, _globalModules])];

// Set NODE_PATH so child processes can also resolve @rip-lang/* packages.
for (const p of _resolvePaths) {
  if (!process.env.NODE_PATH?.split(':').includes(p)) {
    process.env.NODE_PATH = [p, process.env.NODE_PATH].filter(Boolean).join(':');
  }
}

await plugin({
  name: "rip-loader",
  async setup(build) {
    const { readFileSync } = await import("fs");

    // Handle .rip files
    build.onLoad({ filter: /\.rip$/ }, async (args) => {
      try {
        const source = readFileSync(args.path, "utf-8");
        let js = compileToJS(source);

        // Rewrite @rip-lang/* imports to absolute paths. Bun's worker threads
        // don't respect NODE_PATH, and onResolve doesn't fire for imports in
        // compiled source, so we resolve them here during compilation.
        js = js.replace(/(from\s+|import\s*\()(['"])(@rip-lang\/[^'"]+)\2/g, (match, prefix, quote, specifier) => {
          try {
            return `${prefix}${quote}${require.resolve(specifier, { paths: _resolvePaths })}${quote}`;
          } catch {
            return match;
          }
        });

        return {
          contents: js,
          loader: "js",
        };
      } catch (err) {
        console.error(`Error compiling ${args.path}:`, err.message);
        throw err;
      }
    });
  },
});
