import type { Plugin } from "vite";
import { coreModule } from "./core.ts";

// The npm package and embed.js (decision 147): core.ts becomes plain data, so the compiler
// they ship holds no docs or examples. The site keeps the full registry: its docs need it.
export function registryCore(): Plugin {
  return {
    name: "gss-registry-core",
    enforce: "pre",
    load(id) {
      if (id.replace(/\\/g, "/").endsWith("/src/compiler/registry/core.ts")) return coreModule();
    },
  };
}
