import type { Token } from "../syntax/tokenizer";
import { FACES, type Face, type Styles, type StyledInstance } from "../cascade/resolve";
import { readFunction } from "../values/values";
import { errorAt } from "../syntax/errors";
import { textGroups } from "./text-layout";
import type { Keyframes } from "../syntax/ast";

const EXAMPLE = 'texture: url("dirt.png");';

const MAX_IMAGES = 16; // WebGL2 guarantees 16 texture units

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
        if (text) add(text.source, instance.faceList[i]["content"] ?? instance.styles["content"] ?? []);
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
export function scenePaints(
  instances: { styles: Styles; faceStyles: Record<Face, Styles> }[],
  defined: Map<string, { code: string; line: number }>,
): { name: string; code: string; line: number }[] {
  const used = new Map<string, { name: string; code: string; line: number }>();
  for (const instance of instances) {
    const values = [instance.styles["texture"], ...FACES.map((face) => instance.faceStyles[face]["texture"])];
    for (const value of values) {
      if (!value) continue;
      const name = paintName(readTexture(value));
      if (name === null || used.has(name)) continue;
      const paint = defined.get(name);
      if (!paint) throw errorAt(value, `No @paint named "${name}": write one, like: @paint ${name} { void main() { … } }`);
      used.set(name, { name, ...paint });
    }
  }
  return [...used.values()];
}
