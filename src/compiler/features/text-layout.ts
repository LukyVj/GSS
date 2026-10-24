// content: where the text of an object goes, face by face, and how its lines are laid out
import { FACES, missingFaceName, shapeFaces, type Styles, type StyledInstance } from "../cascade/resolve";
import type { Keyframes } from "../syntax/ast";
import { readAnimation } from "./animation";
import { errorAt } from "../syntax/errors";
import { add, div, hypot, largest, liveFlatSize, liveNumber, liveRadii, liveSize3, mul, type Num } from "../shader/codegen/live";
import { shapeRadius } from "../shader/codegen/shapes";
import { contentNumber, digitsSource, DIGITS, LETTER_PIXELS, pieceSource, readAlign, readContent, readFont, readFontSize, textSource, type Align } from "./content";

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

// How a text lies on the object. A cube and a plane have flat faces: the box of the
// object. A round shape (wrap) has four sides around its axis and a top and a bottom: the
// text wraps around a side like a label on a can, a quarter turn wide (r: the radius it is
// measured at), and lies flat on the top and the bottom, scaled by flat to the room of a
// side. Any other shape (sticker) is seen from its six sides, in the box of its bounding
// sphere, the text fading where the surface turns away from the side.
// An octahedron and a pyramid have flat faces that are not the sides of a box: the text
// lies on each of them (facet), the box giving the room of one face for font-size.
export type TextRoom = {
  box: Num[];
  wrap?: { r: Num; flat: Num };
  sticker?: true;
  facet?: { shape: "octahedron"; r: Num } | { shape: "pyramid"; size: Num[] };
};

const QUARTER = Math.PI / 2;

// Three decimals, like the other numbers GSS writes
export const short = (n: Num): Num => (typeof n === "number" ? Math.round(n * 1000) / 1000 : n);

export function textRoom(instance: StyledInstance): TextRoom {
  const room = roomOf(instance);
  return {
    ...room,
    box: room.box.map(short),
    ...(room.wrap && { wrap: { r: short(room.wrap.r), flat: short(room.wrap.flat) } }),
  };
}

function roomOf(instance: StyledInstance): TextRoom {
  const { tag, styles } = instance;
  // A round shape: the radius its sides are measured at, their height, and the side of
  // the square that fits on its top
  const round = (r: Num, height: Num, top: Num): TextRoom => {
    const side = mul(QUARTER, r);
    return { box: [side, height, side], wrap: { r, flat: div(side, top) } };
  };
  const radius = (fallback: number) => liveNumber(styles["radius"], "radius", fallback); // the defaults of the shapes
  const height = () => liveNumber(styles["height"], "height", 1);
  switch (tag) {
    case "cube":
      return { box: objectBox(instance) };
    case "plane": {
      const [width, depth] = liveFlatSize(styles["size"]);
      return { box: [width, 0.02, depth] };
    }
    case "sphere": {
      // a side is the band where the sphere faces it, a square of 1 / sqrt(2) of the
      // diameter high; the top holds a square of 1 / sqrt(3) of it
      const diameter = mul(2, radius(0.5));
      return round(radius(0.5), mul(0.707, diameter), mul(0.577, diameter));
    }
    case "cylinder":
    case "tube":
      return round(radius(0.5), height(), mul(1.414, radius(0.5)));
    case "capsule":
      return round(radius(0.25), height(), mul(1.154, radius(0.25)));
    case "cone": {
      const [bottom, top] = liveRadii(styles["radius"]);
      return round(div(add(bottom, top), 2), height(), mul(1.414, largest(bottom, top)));
    }
    case "octahedron": {
      // a triangle of sides r * sqrt(2): the text fits half of its base, a third of its height
      const r = radius(0.5);
      return { box: [mul(0.707, r), mul(0.408, r), mul(0.707, r)], facet: { shape: "octahedron", r } };
    }
    case "pyramid": {
      // the front slope: half of its base, a third of its height
      const size = liveSize3(styles["size"]);
      return { box: [div(size[0], 2), div(hypot(size[1], div(size[2], 2)), 3), div(size[2], 2)], facet: { shape: "pyramid", size } };
    }
    case "torus": {
      // around the ring, on its outside; as high as the tube is thick
      const thickness = liveNumber(styles["thickness"], "thickness", 0.28);
      return { box: [mul(QUARTER, add(radius(1), thickness)), mul(2, thickness), mul(QUARTER, add(radius(1), thickness))], wrap: { r: add(radius(1), thickness), flat: 1 } };
    }
    default: {
      // a side is where the shape faces it: a square of 1 / sqrt(3) of the diameter of its sphere
      const reach = shapeRadius(tag, styles);
      const side = reach === null ? 1 : 1.154 * reach;
      return { box: [side, side, side], sticker: true };
    }
  }
}

// The room a text has on each side of the object
export function textBox(instance: StyledInstance): Num[] {
  return textRoom(instance).box;
}

// The text of a face: its name among the images of the scene, and whether font-size sets
// its size (sized) or the face does. A text with a number (decision 203) is not one image:
// its source only names it, and number says which images the shader puts end to end
export type FaceText = { source: string; sized: boolean; number?: NumberText } | null;

// A text with a number: the images of the strings before and after it (null: none), the
// image of the digits of its font, and what the shader needs to write it: its characters
// (code: their cells in the image of the digits, four bits each from the left, six in
// each number), how many, and its layout (layout: the width of a line in pixels of the
// digits and where the text goes in it, 0 to 1, with font-size; else 0, 0 and the room
// around the text, in the same pixels)
export type NumberText = {
  before: string | null;
  digits: string;
  after: string | null;
  code: [number, number];
  count: number;
  layout: [number, number, number];
};

const ALIGN_SHARE: Record<Align, number> = { left: 0, center: 0.5, right: 1 };

function numberText(value: Parameters<typeof contentNumber>[0], font: string, width: number | null, align: Align): NumberText | undefined {
  const number = contentNumber(value);
  if (!number) return undefined;
  const code: [number, number] = [0, 0];
  [...number.number].forEach((character, i) => (code[i < 6 ? 0 : 1] += DIGITS.indexOf(character) * 16 ** (i % 6)));
  return {
    before: number.before ? pieceSource(number.before, font) : null,
    digits: digitsSource(font),
    after: number.after ? pieceSource(number.after, font) : null,
    code,
    count: number.number.length,
    // the room around a text without font-size: 0.15 of its letters, as the runtime draws it
    layout: width === null ? [0, 0, 0.15 * LETTER_PIXELS] : [Math.round(width * LETTER_PIXELS * 1000) / 1000, ALIGN_SHARE[align], 0],
  };
}

// The images a text needs: its own, or the pieces of a text with a number
export function textImages(text: NonNullable<FaceText>): string[] {
  if (!text.number) return [text.source];
  const { before, digits, after } = text.number;
  return [before, digits, after].filter((image): image is string => image !== null);
}

// The text of each face, by number (faceList[0] is ::face(1)): its own content, or else
// the object's (a face's none wins). With font-size, a line is as wide as the face: the
// left and the right are as deep as the object, the other faces as wide as it.
export type Texts = FaceText[];
export function faceTexts(instance: StyledInstance): Texts {
  const font = readFont(instance.styles);
  const size = readFontSize(instance.styles["font-size"]);
  const align = readAlign(instance.styles["text-align"]);
  readContent(instance.styles["content"]); // checked even when every face has its own
  // content on a face the shape does not have: pyramid::face(top), octahedron::face(front)
  for (const face of FACES) {
    const value = instance.faceStyles[face]["content"];
    const missing = value && missingFaceName(face, instance.tag);
    if (missing) throw errorAt(value, missing);
  }
  const names = shapeFaces(instance.tag);
  const box = size === null ? null : textBox(instance);
  return instance.faceList.map((styles, i) => {
    const value = styles["content"] ?? instance.styles["content"];
    const text = readContent(value);
    if (text === null) return null;
    let width: number | null = null;
    if (size !== null) {
      const across = names[i] === "left" || names[i] === "right" ? box![2] : box![0];
      if (typeof across !== "number")
        throw errorAt(instance.styles["font-size"], "font-size cannot go yet on an object whose size is set from JS");
      width = Math.round((across / size) * 1000) / 1000;
    }
    const number = numberText(value!, font, width, align);
    return { source: textSource(text, font, width, align), sized: size !== null, ...(number && { number }) };
  });
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
export function textsIn(instance: StyledInstance, styles: Styles): Texts {
  return faceTexts({ ...instance, styles: { ...styles, "font-size": instance.styles["font-size"] } });
}

// A name for the texts of the faces, to tell two of them apart
export const textsKey = (texts: Texts) => JSON.stringify(texts.map((text) => text?.source ?? null));

// Every text the object can show, once each, the one at rest first: at rest, hovered,
// pressed, then at each frame of their animations that sets a text property
export function textGroups(instance: StyledInstance, keyframes: Keyframes[]): Texts[] {
  // each hover state last: alone, it can show a text that every state together hides
  const states = [instance.styles, instance.hoverStyles, instance.activeStyles, ...instance.hoverStates.map((state) => state.styles)];
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
