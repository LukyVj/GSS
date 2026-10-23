/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import { prerenderSite } from "./src/vite/prerender-site.ts";

// Six pages: the home page (index.html), the editor (playground.html), the reference
// (docs.html), the marks (brand.html), the showcase (showcase.html) and the changelog
// (changelog.html). Without this list, `vite build` only builds index.html.
// prerenderSite fills docs / home / showcase / brand / changelog HTML at build (and in dev) so they read without JS.
export default defineConfig({
  plugins: [prerenderSite()],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        playground: "playground.html",
        docs: "docs.html",
        brand: "brand.html",
        showcase: "showcase.html",
        changelog: "changelog.html",
      },
    },
  },
  // The worktrees of the Claude sessions and of the bench hold old copies of the tests.
  test: {
    exclude: [...configDefaults.exclude, ".claude/**", ".bench-worktrees/**"],
  },
});
