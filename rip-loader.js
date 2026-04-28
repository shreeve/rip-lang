// Bun loader for .rip files

import { plugin } from "bun";
import { fileURLToPath } from "url";
import { compileToJS, formatError } from "./src/compiler.js";
// Register the full schema runtime provider so .rip files containing
// `schema :model` blocks compile correctly inside spawned workers.
// Workers are launched with `--preload rip-loader.js` and otherwise
// would call compileToJS without ever registering a provider.
import "./src/schema/loader-server.js";

await plugin({
  name: "rip-loader",
  async setup(build) {
    const { readFileSync } = await import("fs");

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
