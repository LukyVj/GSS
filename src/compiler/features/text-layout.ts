// content: where the text of an object goes, face by face, and how its lines are laid out
import { FACES, type Face, type Styles, type StyledInstance } from "../cascade/resolve";
import type { Keyframes } from "../syntax/ast";
import { readAnimation } from "./animation";
import { errorAt } from "../syntax/errors";
import { liveNumber, liveSize3, mul, type Num } from "../shader/codegen/live";
import { readAlign, readContent, readFont, readFontSize, textSource } from "./content";

// The full size of the object: what one image, or its text, covers
export function objectBox(instance: StyledInstance): Num[] {
  // A size set from JS (decision 105): the images follow it
  if (instance.tag === "cube") return liveSize3(instance.styles["size"]);
  if (instance.tag === "sphere") {
    const diameter = mul(2, liveNumber(instance.styles["radius"], "radius", 0.5)); // same default as SHAPES.sphere
    return [diameter, diameter, diameter];
  }
  return [1, 1, 1];
}

// The room a text has on each side of the object. A sphere is seen from six sides, each
// one a sixth of it: the square that fits in a sixth is 1 / sqrt(3) of its diameter
export function textBox(instance: StyledInstance): Num[] {
  const box = objectBox(instance);
  return instance.tag === "sphere" ? box.map((side) => mul(0.577, side)) : box;
}

// The text of a face: its name among the images of the scene, and whether font-size sets
// its size (sized) or the face does
export type FaceText = { source: string; sized: boolean } | null;

// The text of each face: its own content, or else the object's (a face's none wins). With
// font-size, a line is as wide as the face: the top, the bottom, the front and the back are
// as wide as the object, the left and the right as deep as it.
export function faceTexts(instance: StyledInstance): Record<Face, FaceText> {
  const font = readFont(instance.styles);
  const size = readFontSize(instance.styles["font-size"]);
  const align = readAlign(instance.styles["text-align"]);
  readContent(instance.styles["content"]); // checked even when every face has its own
  const box = size === null ? null : textBox(instance);
  const texts = {} as Record<Face, FaceText>;
  for (const face of FACES) {
    const own = instance.faceStyles[face]["content"];
    const text = readContent(own ?? instance.styles["content"]);
    if (text === null) {
      texts[face] = null;
      continue;
    }
    let width: number | null = null;
    if (size !== null) {
      const across = face === "left" || face === "right" ? box![2] : box![0];
      if (typeof across !== "number")
        throw errorAt(instance.styles["font-size"], "font-size cannot go yet on an object whose size is set from JS");
      width = Math.round((across / size) * 1000) / 1000;
    }
    texts[face] = { source: textSource(text, font, width, align), sized: size !== null };
  }
  return texts;
}

// content, the font and text-align change the image: a hovered or pressed object, or a frame
// of its animation, can show another text. font-size does not: it zooms the text laid out at rest
export const TEXT_SWAPS = ["content", "font-family", "font-weight", "font-style", "text-align"];

// The styles of a frame that sets a text property: the object at rest, with the frame on top
export function frameStyles(instance: StyledInstance, frame: Keyframes["frames"][number]): Styles | null {
  const set = frame.declarations.filter((declaration) => TEXT_SWAPS.includes(declaration.property));
  return set.length === 0 ? null : { ...instance.styles, ...Object.fromEntries(set.map((d) => [d.property, d.value])) };
}

// The texts of the object in some styles, laid out with its font-size at rest
export function textsIn(instance: StyledInstance, styles: Styles): Record<Face, FaceText> {
  return faceTexts({ ...instance, styles: { ...styles, "font-size": instance.styles["font-size"] } });
}

// A name for the texts of the six faces, to tell two of them apart
export const textsKey = (texts: Record<Face, FaceText>) => JSON.stringify(FACES.map((face) => texts[face]?.source ?? null));

// Every text the object can show, once each, the one at rest first: at rest, hovered,
// pressed, then at each frame of their animations that sets a text property
export function textGroups(instance: StyledInstance, keyframes: Keyframes[]): Record<Face, FaceText>[] {
  const states = [instance.styles, instance.hoverStyles, instance.activeStyles];
  const all = states.map((styles) => textsIn(instance, styles));
  for (const styles of states) {
    const name = readAnimation(styles)?.name.value;
    const found = name === undefined ? undefined : keyframes.findLast((k) => k.name === name);
    for (const frame of found?.frames ?? []) {
      const set = frameStyles(instance, frame);
      if (set) all.push(textsIn(instance, set));
    }
  }
  return [...new Map(all.map((texts) => [textsKey(texts), texts])).values()];
}
