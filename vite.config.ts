import { defineConfig } from "vite";

// Four pages: the home page (index.html), the editor (playground.html),
// the reference (docs.html) and the marks (brand.html). Without this list, `vite build` only builds index.html.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        playground: "playground.html",
        docs: "docs.html",
        brand: "brand.html",
      },
    },
  },
});
