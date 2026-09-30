import type { Plugin } from "vite";
import { compileScene } from "../compiler";

// gss-lang/vite (decision 63): `import scene from "./logo.gss"` gives the compiled
// scene. The compiler runs at build time; the page only ships the runtime and the shader:
//
//   // vite.config.ts                     // main.ts
//   import gss from "gss-lang/vite";      import { mount } from "gss-lang/runtime";
//   plugins: [gss()]                      import scene from "./logo.gss";
//                                         mount(canvas, scene);

// A .gss file with no query: "scene.gss?raw" stays Vite's (the site uses it)
export function isGssModule(id: string): boolean {
  return id.endsWith(".gss") && !id.includes("?");
}

// "dirt.png" or "./dirt.png": next to the .gss file. "/textures/…", "https://…", "data:…": as written
function isRelative(file: string): boolean {
  return !file.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(file);
}

// GSS text → the JavaScript module. Relative images go through new URL(…, import.meta.url),
// which Vite copies into the build (with a hash) like any other asset.
export function gssModule(source: string): string {
  const compiled = compileScene(source);
  const textures = compiled.textures.map((file) =>
    isRelative(file)
      ? `new URL(${JSON.stringify(file.startsWith(".") ? file : `./${file}`)}, import.meta.url).href`
      : JSON.stringify(file),
  );
  const { textures: _, ...rest } = compiled;
  return [
    `const scene = ${JSON.stringify(rest, null, 2)};`,
    `scene.textures = [${textures.join(", ")}];`,
    `export default scene;`,
    "",
  ].join("\n");
}

export default function gss(): Plugin {
  return {
    name: "gss-lang",
    transform(source, id) {
      if (!isGssModule(id)) return null;
      try {
        return { code: gssModule(source), map: null };
      } catch (error) {
        // In Vite's terminal (and its overlay in dev), with the file
        const message = error instanceof Error ? error.message : String(error);
        this.error(`GSS: ${message}\n  in ${id}`);
      }
    },
  };
}
