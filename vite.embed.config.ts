import { defineConfig } from "vite";

// embed.js (decision 63): <gss-scene> in one file, served by gss-lang.dev, for pages
// without a build step. Built after the site, into the same dist/ (npm run build).
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: "src/embed/element.ts",
      formats: ["es"],
      fileName: () => "embed.js",
    },
  },
});
