// Bun loader for .rip files

import { plugin } from "bun";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { compileToJS } from "./src/compiler.js";

// Ensure NODE_PATH includes the node_modules where rip-lang is installed, so workers
// (and any code running through this loader) can resolve @rip-lang/* packages even
// when the script lives in a directory without its own node_modules.
const _nodeModules = dirname(dirname(fileURLToPath(import.meta.url)));
if (!process.env.NODE_PATH?.split(':').includes(_nodeModules)) {
  process.env.NODE_PATH = [_nodeModules, process.env.NODE_PATH].filter(Boolean).join(':');
}

await plugin({
  name: "rip-loader",
  async setup(build) {
    const { readFileSync } = await import("fs");

    // Handle .rip files
    build.onLoad({ filter: /\.rip$/ }, async (args) => {
      try {
        const source = readFileSync(args.path, "utf-8");
        const js = compileToJS(source);

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
