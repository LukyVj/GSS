import type { Token } from "./tokenizer";
import { FACES, type Face, type Styles } from "./resolve";
import { readFunction } from "./values";
import { errorAt } from "./errors";

const EXAMPLE = 'texture: url("dirt.png");';

const MAX_IMAGES = 16; // WebGL2 guarantees 16 texture units

// texture: url("dirt.png") → "dirt.png"
export function readTexture(value: Token[]): string {
  const call = readFunction(value);
  const [arg] = call?.args ?? [];
  if (
    call?.name !== "url" ||
    call.args.length !== 1 ||
    arg.length !== 1 ||
    arg[0].type !== "STRING"
  ) {
    throw errorAt(value, `texture expects url("…"), like: ${EXAMPLE}`);
  }
  return arg[0].value;
}

// Every image of the scene, once each, in the order of the objects
export function sceneTextures(
  instances: { styles: Styles; faceStyles: Record<Face, Styles> }[],
): string[] {
  const files = new Set<string>(); // keeps the first order, ignores duplicates
  for (const instance of instances) {
    readRendering(instance.styles["image-rendering"]); // checked on every object, even without a texture
    // The object's own image first, then its faces
    const values = [
      instance.styles["texture"],
      ...FACES.map((face) => instance.faceStyles[face]["texture"]),
    ];
    for (const value of values) {
      if (!value) continue;
      files.add(readTexture(value));
      // Only the image just added can go over the limit
      if (files.size > MAX_IMAGES) {
        throw errorAt(
          value,
          `a scene can use at most ${MAX_IMAGES} images (WebGL2 guarantees 16 texture units)`,
        );
      }
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
