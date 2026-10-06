import { defineConfig } from "vite";
import { registryCore } from "./src/compiler/registry/core-plugin.ts";

// embed.js (decision 63): <gss-scene> in one file, served by gss-lang.dev, for pages
// without a build step. Built after the site, into the same dist/ (npm run build).
export default defineConfig({
  publicDir: false,
  plugins: [registryCore()], // the compiler without the docs (decision 147)
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: { output: { minify: true } }, // whitespace too (decision 147)
    lib: {
      entry: "src/embed/element.ts",
      formats: ["es"],
      fileName: () => "embed.js",
    },
  },
});
