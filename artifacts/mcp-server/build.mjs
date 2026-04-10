import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.mjs",
  platform: "node",
  format: "esm",
  sourcemap: true,
  target: "node22",
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
  external: [],
});

console.log("Build complete: dist/index.mjs");
