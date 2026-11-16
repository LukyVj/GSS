import type { Token } from "../syntax/tokenizer";
import { FACES, type Face, type Styles, type StyledInstance } from "../cascade/resolve";
import { readFunction } from "../values/values";
import { errorAt } from "../syntax/errors";
import { textGroups, textImages } from "./text-layout";
import type { Keyframes } from "../syntax/ast";

const EXAMPLE = 'texture: url("dirt.png");';

export const MAX_IMAGES = 16; // WebGL2 guarantees 16 texture units

// texture: url("dirt.png") → "dirt.png"; texture: element(#card) → "element(#card)", a slot
// the runtime fills with a live image of that element of the page (decision 101)
export function readTexture(value: Token[]): string {
  const call = readFunction(value);
  const [arg] = call?.args ?? [];
  // texture: paint(rings): the texture a @paint draws (decision 151)
  if (call?.name === "paint") {
    if (call.args.length !== 1 || arg.length !== 1 || arg[0].type !== "IDENT")
      throw errorAt(value, "paint() takes the name of a @paint, like: texture: paint(rings);");
    return `paint(${arg[0].value})`;
  }
  if (call?.name === "element") {
    if (call.args.length !== 1 || arg.length !== 1 || arg[0].type !== "HASH")
      throw errorAt(value, "element() takes the id of an element of the page, like: element(#card)");
    return `element(#${arg[0].value})`;
  }
  if (
    call?.name !== "url" ||
    call.args.length !== 1 ||
    arg.length !== 1 ||
    arg[0].type !== "STRING"
  ) {
    throw errorAt(value, `texture expects url("…"), element(#id) or paint(name), like: ${EXAMPLE}`);
  }
  return arg[0].value;
}

// Every image of the scene, once each, in the order of the objects
export function sceneTextures(
  instances: StyledInstance[],
  keyframes: Keyframes[] = [],
): string[] {
  const files = new Set<string>(); // keeps the first order, ignores duplicates
  const add = (source: string, value: Token[]) => {
    files.add(source);
    // Only the image just added can go over the limit
    if (files.size > MAX_IMAGES) {
      throw errorAt(
        value,
        `a scene can use at most ${MAX_IMAGES} images (WebGL2 guarantees 16 texture units)`,
      );
    }
  };
  for (const instance of instances) {
    readRendering(instance.styles["image-rendering"]); // checked on every object, even without a texture
    readMapping(instance.styles["texture-mapping"]); // and so is its mapping
    // The object's own image first, then its faces
    const values = [
      instance.styles["texture"],
      ...FACES.map((face) => instance.faceStyles[face]["texture"]),
    ];
    for (const value of values) {
      if (!value) continue;
      add(readTexture(value), value);
    }
    // content: the text of each face, an image the runtime draws. Its font and its layout
    // are checked on every object, even without content
    for (const texts of textGroups(instance, keyframes))
      texts.forEach((text, i) => {
        if (text) for (const image of textImages(text)) add(image, instance.faceList[i]["content"] ?? instance.styles["content"] ?? []);
      });
  }
  return [...files];
}

// CSS values of image-rendering → does the object read the nearest pixel?
const RENDERINGS: Record<string, boolean> = {
  auto: false,
  smooth: false,
  pixelated: true,
  "crisp-edges": true, // in CSS, "keep the edges sharp": the same thing for a texture
};

// image-rendering: pixelated → true (the nearest pixel), auto → false (smooth)
export function readRendering(value: Token[] | undefined): boolean {
  if (!value) return false; // not set: auto, like CSS
  const [word] = value;
  if (
    value.length !== 1 ||
    word.type !== "IDENT" ||
    !(word.value in RENDERINGS)
  ) {
    throw errorAt(
      value,
      "image-rendering expects auto, smooth, pixelated or crisp-edges, like: image-rendering: pixelated;",
    );
  }
  return RENDERINGS[word.value];
}

// How the images of an object are laid on it (decision 185): box projects them on the faces
// of the box around the object, sphere wraps them once around it, like a map around a globe
export type Mapping = "box" | "sphere";

// texture-mapping: sphere → "sphere"; not set → "box", the faces of the box, as before
export function readMapping(value: Token[] | undefined): Mapping {
  if (!value) return "box";
  const [word] = value;
  if (
    value.length !== 1 ||
    word.type !== "IDENT" ||
    (word.value !== "box" && word.value !== "sphere")
  ) {
    throw errorAt(
      value,
      "texture-mapping expects box or sphere, like: texture-mapping: sphere;",
    );
  }
  return word.value;
}

// texture: paint(rings) → "rings"; null for an image or an element
export function paintName(texture: string): string | null {
  return /^paint\((.+)\)$/.exec(texture)?.[1] ?? null;
}

// The @paint the objects use, in the order of their textures (decision 151). An unknown
// name is reported where the object asks for it
// A @paint as the runtime draws it: its GLSL, the line of its "{", and its descriptors when
// written (decision 228): the size of its texture, and its mipmaps
export type ScenePaint = { name: string; code: string; line: number; size?: [number, number]; mipmap?: true };

// size and filter (decision 228), written before the GLSL of the block like the descriptors of
// an at-rule: "size: 1024px;" can never start GLSL. They are blanked out of the code, their
// line breaks kept, so the errors of the GLSL keep their line.
export function paintDescriptors(name: string, code: string, at?: Token): { code: string; size?: [number, number]; mipmap?: true } {
  const out: { code: string; size?: [number, number]; mipmap?: true } = { code };
  const blank = (text: string) => text.replace(/[^\n]/g, " ");
  // Comments and blank space, then "name: value;"
  const head = /^(\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*([a-z-]+)\s*:([^;{}]*);/;
  let rest = code;
  let done = "";
  for (let match = head.exec(rest); match; match = head.exec(rest)) {
    const [whole, , property, raw] = match;
    const value = raw.trim();
    if (property === "size") {
      const sizes = value.split(/\s+/).map((part) => (/^\d+px$/.test(part) ? Number(part.slice(0, -2)) : NaN));
      if (sizes.length < 1 || sizes.length > 2 || !sizes.every((n) => n >= 64 && n <= 4096))
        throw errorAt(at, `@paint ${name}: size expects one or two lengths from 64px to 4096px, like: size: 1024px;`);
      out.size = [sizes[0], sizes[1] ?? sizes[0]];
    } else if (property === "filter") {
      if (value !== "linear" && value !== "mipmap") throw errorAt(at, `@paint ${name}: filter expects linear or mipmap, like: filter: mipmap;`);
      if (value === "mipmap") out.mipmap = true;
    } else {
      throw errorAt(at, `@paint ${name} takes size and filter before its GLSL, like: @paint ${name} { size: 1024px; void main() { … } }`);
    }
    done += blank(whole);
    rest = rest.slice(whole.length);
  }
  out.code = done + rest;
  return out;
}

export function scenePaints(
  instances: { styles: Styles; faceStyles: Record<Face, Styles> }[],
  defined: Map<string, { code: string; line: number; at?: Token }>,
): ScenePaint[] {
  const used = new Map<string, ScenePaint>();
  for (const instance of instances) {
    const values = [instance.styles["texture"], ...FACES.map((face) => instance.faceStyles[face]["texture"])];
    for (const value of values) {
      if (!value) continue;
      const name = paintName(readTexture(value));
      if (name === null || used.has(name)) continue;
      const paint = defined.get(name);
      if (!paint) throw errorAt(value, `No @paint named "${name}": write one, like: @paint ${name} { void main() { … } }`);
      used.set(name, { name, line: paint.line, ...paintDescriptors(name, paint.code, paint.at) });
    }
  }
  return [...used.values()];
}
