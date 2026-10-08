import { defineConfig } from "vite";
import { registryCore } from "./src/compiler/registry/core-plugin.ts";

// The npm package (decision 63), into lib/: npm run build:lib.
//   gss-lang          compile + mount (GSS text in the page)
//   gss-lang/runtime  mount only, for scenes compiled at build time
//   gss-lang/vite     the plugin: import scene from "./logo.gss"
//   gss-lang/embed    <gss-scene>, for pages without a build step (a CDN): it imports the
//                     same compiler and runtime files, so the package holds them once
// The types come from tsconfig.lib.json.
export default defineConfig({
  publicDir: false,
  plugins: [registryCore()], // the compiler without the docs (decision 147)
  build: {
    outDir: "lib",
    emptyOutDir: true,
    lib: {
      entry: {
        index: "src/embed/index.ts",
        runtime: "src/embed/runtime.ts",
        vite: "src/vite/plugin.ts",
        embed: "src/embed/element.ts",
      },
      formats: ["es"],
    },
    // Minified (decision 147): a page that loads embed.js from a CDN has no bundler to do it.
    // An app's bundler reads it as well; the types (lib/types) stay readable.
    rollupOptions: { external: ["vite"], output: { minify: true } },
  },
});
