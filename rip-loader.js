// Bun loader for .rip files

import { plugin } from "bun";
import { compileToJS } from "./src/compiler.js";

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
