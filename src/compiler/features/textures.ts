import type { Token } from "../syntax/tokenizer";
import { FACES, type Face, type Styles } from "../cascade/resolve";
import { readFunction } from "../values/values";
import { errorAt } from "../syntax/errors";
import { readContent, readFont, textSource } from "./content";

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
  instances: { styles: Styles; faceStyles: Record<Face, Styles> }[],
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
    const font = readFont(instance.styles); // and so is its font, even without content
    // The object's own image first, then its faces
    const values = [
      instance.styles["texture"],
      ...FACES.map((face) => instance.faceStyles[face]["texture"]),
    ];
    for (const value of values) {
      if (!value) continue;
      add(readTexture(value), value);
    }
    // content: the text of the object, then of its faces, an image the runtime draws
    for (const value of [instance.styles["content"], ...FACES.map((face) => instance.faceStyles[face]["content"])]) {
      const text = readContent(value);
      if (text !== null) add(textSource(text, font), value!);
    }
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
