import { defineConfig } from "vite";

// Three pages: the home page (index.html), the editor (playground.html)
// and the reference (docs.html). Without this list, `vite build` only builds index.html.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        playground: "playground.html",
        docs: "docs.html",
      },
    },
  },
});
