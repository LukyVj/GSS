import { defineConfig } from "vite";

// Two pages: the editor (index.html) and the reference (docs.html).
// Without this list, `vite build` only builds index.html.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        docs: "docs.html",
      },
    },
  },
});
