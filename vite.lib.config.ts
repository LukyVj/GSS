import { defineConfig } from "vite";

// The npm package (decision 63), into lib/: npm run build:lib.
//   gss-lang          compile + mount (GSS text in the page)
//   gss-lang/runtime  mount only, for scenes compiled at build time
//   gss-lang/vite     the plugin: import scene from "./logo.gss"
// The types come from tsconfig.lib.json.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "lib",
    emptyOutDir: true,
    minify: false, // a library: the app that uses it minifies
    lib: {
      entry: {
        index: "src/embed/index.ts",
        runtime: "src/embed/runtime.ts",
        vite: "src/vite/plugin.ts",
      },
      formats: ["es"],
    },
    rollupOptions: { external: ["vite"] },
  },
});
