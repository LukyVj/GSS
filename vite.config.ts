import { defineConfig } from "vite";

// Five pages: the home page (index.html), the editor (playground.html),
// the reference (docs.html), the marks (brand.html) and the showcase (showcase.html). Without this list, `vite build` only builds index.html.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        playground: "playground.html",
        docs: "docs.html",
        brand: "brand.html",
        showcase: "showcase.html",
      },
    },
  },
});
