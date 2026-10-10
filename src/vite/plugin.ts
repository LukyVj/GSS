import type { Plugin } from "vite";
import { compileScene, type CompiledScene } from "../compiler";
import { describeErrors } from "../compiler/syntax/errors";
import { textOf } from "../runtime/text";

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
// The text of an object (content) is no file
function isRelative(file: string): boolean {
  return !file.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(file) && textOf(file) === null;
}

// GSS text → the JavaScript module. Relative images go through new URL(…, import.meta.url),
// which Vite copies into the build (with a hash) like any other asset.
export function gssModule(source: string): string {
  const compiled = compileScene(source);
  // The images of the scene, and of each @media version of it, as JavaScript
  const images = (files: string[]) =>
    files
      .map((file) =>
        isRelative(file)
          ? `new URL(${JSON.stringify(file.startsWith(".") ? file : `./${file}`)}, import.meta.url).href`
          : JSON.stringify(file),
      )
      .join(", ");
  const withoutImages = ({ textures: _, ...rest }: CompiledScene) => rest;
  const variants = compiled.media?.variants ?? [];
  const data = {
    ...withoutImages(compiled),
    ...(compiled.media && {
      media: { ...compiled.media, variants: variants.map(withoutImages) },
    }),
  };
  return [
    `const scene = ${JSON.stringify(data, null, 2)};`,
    `scene.textures = [${images(compiled.textures)}];`,
    ...variants.map(
      (variant, i) =>
        `scene.media.variants[${i}].textures = [${images(variant.textures)}];`,
    ),
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
        // In Vite's terminal (and its overlay in dev), with the file: every error
        // of the compile, each with its line and column (decision 86)
        const lines = describeErrors(source, error).split("\n");
        const title = lines.length > 1 ? `${lines.length} GSS errors` : "GSS error";
        this.error(`${title} in ${id}\n${lines.map((line) => `  ${line}`).join("\n")}`);
      }
    },
  };
}
