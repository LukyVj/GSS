// Textures (decision 59): one uniform per image, triplanar() or spherical() (decision 185), textureColor()
import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import { FACES, type Face, type StyledInstance } from "../../cascade/resolve";
import { readMapping, readRendering, readTexture, sceneTextures } from "../../features/textures";
import { TEXT_COLOR } from "../../features/content";
import { frameStyles, textGroups, textsIn, textsKey, objectBox, textRoom, type FaceText } from "../../features/text-layout";
import { readFontSize } from "../../features/content";
import type { Styles } from "../../cascade/resolve";
import { hoverValue } from "./animation";
import { round } from "./glsl";
import { glslFloat, label, type Hover } from "./glsl";
import { readColor } from "./read";
import { g, liveNumber, type Num } from "./live";
import { spaceFunction } from "./transforms";
import { errorAt } from "../../syntax/errors";

// The image seen from the axis the surface faces most: y is the top and the bottom,
// x and z are the sides. q: the point in the object's space (centered on 0),
// n: the normal in that space, box: the full size of the object
const TRIPLANAR = `vec3 triplanar(sampler2D image, vec3 q, vec3 n, vec3 box, vec3 color, bool pixelated) {
  vec3 a = abs(n);
  vec2 uv;
  if (a.y >= a.x && a.y >= a.z) uv = q.xz / box.xz;  // top and bottom
  else if (a.x >= a.z) uv = q.zy / box.zy;           // left and right
  else uv = q.xy / box.xy;                           // front and back
  vec2 st = fract(uv + 0.5);                         // from 0 to 1, again at each image: the pattern repeats
  if (pixelated) {
    vec2 size = vec2(textureSize(image, 0));         // the image in pixels: 16×16
    st = (floor(st * size) + 0.5) / size;            // the center of the pixel st falls in
  }
  vec4 pixel = texture(image, st);
  return mix(color, pixel.rgb, pixel.a);
}`;

// The image wrapped once around the object, like a map around a globe (decision 185): the
// longitude across, the latitude up, seen from the center of the object. The middle of the
// image faces the front (+z), east is on the right (+x), the top is the top (+y), and the
// left and right edges meet at the back. q: the point in the object's space
const SPHERICAL = `vec3 spherical(sampler2D image, vec3 q, vec3 color, bool pixelated) {
  vec3 d = normalize(q);
  vec2 st = vec2(0.5 + atan(d.x, d.z) / 6.2831853,               // the longitude, from 0 to 1
                 0.5 + asin(clamp(d.y, -1.0, 1.0)) / 3.1415927); // the latitude, from 0 to 1
  if (pixelated) {
    vec2 size = vec2(textureSize(image, 0));                     // the image in pixels: 1024×512
    st = (floor(st * size) + 0.5) / size;                        // the center of the pixel st falls in
  }
  vec4 pixel = texture(image, st);
  return mix(color, pixel.rgb, pixel.a);
}`;

// Which face a normal points to, in the object's space: its number in FACE_NUMBERS.
// The same tests as triplanar(), so a face and its image always agree.
const FACE_OF = `int faceOf(vec3 n) {
  vec3 a = abs(n);
  if (a.y >= a.x && a.y >= a.z) return n.y > 0.0 ? 1 : 2;  // top, bottom
  if (a.x >= a.z) return n.x > 0.0 ? 5 : 6;                // right, left
  return n.z > 0.0 ? 3 : 4;                                // front, back
}`;

// content: the text of an object, drawn by the runtime in an image twice: in white above, in
// black below. Where the two copies differ the letters take the ink; where they agree, an
// emoji keeps its own colors.
// The image keeps its proportions: it is as large as the face lets it be, in its middle,
// and reads from left to right on every face (the top from the front, the bottom from under)
// zoom: 0 fits the text to the face; else font-size sets it, the image being as wide as the
// face at a zoom of 1
const TEXT_LABEL = `vec3 textLabel(sampler2D image, vec3 q, vec3 n, vec3 box, vec3 color, vec3 ink, float zoom) {
  vec3 a = abs(n);
  vec2 uv;
  vec2 face;
  if (a.y >= a.x && a.y >= a.z) { uv = vec2(q.x, -sign(n.y) * q.z); face = box.xz; }  // top and bottom
  else if (a.x >= a.z) { uv = vec2(-sign(n.x) * q.z, q.y); face = box.zy; }           // left and right
  else { uv = vec2(sign(n.z) * q.x, q.y); face = box.xy; }                            // front and back
  vec2 size = vec2(textureSize(image, 0)) * vec2(1.0, 0.5);                           // one copy, in pixels
  float scale = zoom > 0.0 ? zoom * face.x / size.x : min(face.x / size.x, face.y / size.y);
  vec2 st = uv / (size * scale) + 0.5;
  vec2 inside = step(vec2(0.0), st) * step(st, vec2(1.0));                            // nothing around the image
  st = clamp(st, 0.0, 1.0);
  vec4 light = texture(image, vec2(st.x, 0.5 + 0.5 * st.y));                          // the copy in white
  vec4 dark = texture(image, vec2(st.x, 0.5 * st.y));                                 // the copy in black
  float plain = clamp(dot(light.rgb - dark.rgb, vec3(0.3333)), 0.0, 1.0);             // 1: a letter, 0: an emoji
  return mix(color, mix(dark.rgb, ink, plain), light.a * inside.x * inside.y);
}`;

// content on a round shape: the point seen as if the side it is on were flat, so the text
// wraps around the shape like a label on a can. A side is a quarter turn around the axis;
// the top and the bottom stay flat, scaled to the room of a side (spread)
const WRAPPED = `vec3 wrapped(vec3 q, vec3 n, float r, float spread) {
  vec3 a = abs(n);
  if (a.y >= a.x && a.y >= a.z) return vec3(q.x * spread, q.y, q.z * spread);  // top and bottom
  float middle = floor(atan(n.x, n.z) / 1.5707963 + 0.5) * 1.5707963;     // the side: front, right, back or left
  float arc = (atan(q.x, q.z) - middle) * r;                               // along the side, from its middle
  arc -= 6.2831853 * r * floor(arc / (6.2831853 * r) + 0.5);               // the back, across the seam
  return vec3(arc * cos(middle) + r * sin(middle), q.y, r * cos(middle) - arc * sin(middle));
}`;

// content on a shape without faces: the text of each side, fading where the surface turns
// away from it
const TEXT_STICKER = `vec3 textSticker(sampler2D image, vec3 q, vec3 n, vec3 box, vec3 color, vec3 ink, float zoom) {
  vec3 a = abs(n) / length(n);
  return mix(color, textLabel(image, q, n, box, color, ink, zoom), smoothstep(0.35, 0.55, max(a.x, max(a.y, a.z))));
}`;

// The ink of a text without a color of its own: black on a light surface, white on a dark one
const TEXT_INK = `vec3 textInk(vec3 color) {
  return vec3(step(dot(color, vec3(0.2126, 0.7152, 0.0722)), 0.5));
}`;

// The number faceOf() gives each face
const FACE_NUMBERS: Record<Face, number> = {
  top: 1,
  bottom: 2,
  front: 3,
  back: 4,
  right: 5,
  left: 6,
};

// The size one image covers: texture-size, or else the full size of the object (one image per face)
function textureBox(instance: StyledInstance): Num[] {
  // texture-size: the size of one image on the surface; the pattern repeats (like background-size)
  const imageSize = instance.styles["texture-size"];
  if (imageSize) {
    const size = liveNumber(imageSize, "texture-size", 1); // its error: "texture-size expects one positive number"
    return [size, size, size];
  }
  return objectBox(instance);
}

// The GLSL of the textures: one uniform per image, one space function per textured
// object, triplanar() or spherical(), and textureColor(). Nothing at all when the scene has no texture.
export function textureCode(
  instances: StyledInstance[],
  keyframes: Keyframes[],
  hoverOf: (instance: StyledInstance) => Hover | undefined,
) {
  const files = sceneTextures(instances, keyframes);
  if (files.length === 0) return { uniforms: "", functions: "", call: "" };

  const uniforms = files
    .map((file, i) => `uniform sampler2D uTexture${i}; // ${file}`)
    .join("\n");

  const textured = instances.filter((instance) => sceneTextures([instance], keyframes).length > 0);

  // The same moves as in map(): the groups from the outside in, then the object
  const spaces = textured.map((instance) => spaceFunction(instance, keyframes, hoverOf));

  const branches = textured.map((instance) => {
    const id = glslFloat(instance.index);
    const space = `space${instance.index}`;
    const box = `vec3(${textureBox(instance).map(g).join(", ")})`; // read with sphere too, to check texture-size
    const pixelated = readRendering(instance.styles["image-rendering"]); // one rendering for every face
    const mapping = readMapping(instance.styles["texture-mapping"]); // one mapping for every face
    // The number of the image a texture value names, or null when there is none
    const imageOf = (value: Token[] | undefined): number | null =>
      value ? files.indexOf(readTexture(value)) : null;
    const read = (image: number, q: string, normal: string) =>
      mapping === "sphere"
        ? `spherical(uTexture${image}, ${q}, color, ${pixelated})`
        : `triplanar(uTexture${image}, ${q}, ${normal}, ${box}, color, ${pixelated})`;

    const side = imageOf(instance.styles["texture"]);
    // The faces with an image of their own, and that image
    const faces = FACES.map((face) => ({
      face,
      image: imageOf(instance.faceStyles[face]["texture"]),
    })).filter((entry) => entry.image !== null);

    // content: every text the object can show, the one at rest first
    const groups = textGroups(instance, keyframes);

    if (groups.every((texts) => FACES.every((face) => texts[face] === null))) {
      // No face of its own: one line, like before
      if (faces.length === 0) {
        return `  if (id == ${id}) return ${read(side!, `${space}(p)`, `${space}(p + n * 0.01) - ${space}(p)`)};`;
      }
      return [
        `  if (id == ${id}) {  // ${label(instance)}`,
        `    vec3 q = ${space}(p);`,
        `    vec3 ln = ${space}(p + n * 0.01) - q; // the normal in the object's space`,
        `    int face = faceOf(ln);`,
        ...faces.map(
          ({ face, image }) =>
            `    if (face == ${FACE_NUMBERS[face]}) return ${read(image!, "q", "ln")}; // ${face}`,
        ),
        side !== null
          ? `    return ${read(side, "q", "ln")};`
          : "    return color;", // no side image: the color
        "  }",
      ].join("\n");
    }

    // With a text: the image first, then the text over it. Its color and its zoom mix on
    // :hover and in @keyframes, like any color and number
    const hover = hoverOf(instance);
    const ink = hoverValue(instance.styles, keyframes, TEXT_COLOR, (value) => (value ? readColor(value) : "textInk(color)"), hover);
    const restSize = readFontSize(instance.styles["font-size"]);
    const zoom = hoverValue(instance.styles, keyframes, "font-size", (value) => {
      const size = readFontSize(value);
      if (restSize !== null) return glslFloat(round((size ?? restSize) / restSize));
      if (size !== null)
        throw errorAt(value!, "font-size can change on :hover or in @keyframes only from a number: write one at rest, like: font-size: 0.3;");
      return "0.0";
    }, hover);
    // A cube writes on its faces; a round shape wraps the text around itself; any other
    // shape takes it like a sticker on each side
    const room = textRoom(instance);
    const at = room.wrap ? `wrapped(q, ln, ${g(room.wrap.r)}, ${g(room.wrap.flat)})` : "q";
    const write = (text: FaceText) =>
      text
        ? `${room.sticker ? "textSticker" : "textLabel"}(uTexture${files.indexOf(text.source)}, ${at}, ln, vec3(${room.box.map(g).join(", ")}), color, ${ink}, ${text.sized ? zoom : "0.0"})`
        : "color";
    // The texts of the six faces: the one most faces share is written last, the others face by face
    const lines = (texts: Record<Face, FaceText>, indent: string) => {
      const key = (text: FaceText) => text?.source ?? "";
      const count = (text: FaceText) => FACES.filter((face) => key(texts[face]) === key(text)).length;
      const shared = FACES.map((face) => texts[face]).reduce((best, text) => (count(text) > count(best) ? text : best));
      return [
        ...FACES.filter((face) => key(texts[face]) !== key(shared)).map(
          (face) => `${indent}if (face == ${FACE_NUMBERS[face]}) return ${write(texts[face])}; // ${face}`,
        ),
        `${indent}return ${write(shared)};`,
      ];
    };
    // Several texts: each has a weight, 1 in the states that show it, mixed like a number
    // by :hover and the animations; the text whose weight is past one half is shown, so it
    // changes halfway, like a value of CSS that does not interpolate
    const named = (g: number) => ` text ${g}`; // a property no rule can write
    const one = (on: boolean): Token[] => [{ type: "NUMBER", value: on ? 1 : 0 }];
    const mark = (styles: Styles): Styles => {
      const key = textsKey(textsIn(instance, styles));
      return { ...styles, ...Object.fromEntries(groups.map((texts, g) => [named(g), one(textsKey(texts) === key)])) };
    };
    const marked = keyframes.map((k) => ({
      ...k,
      frames: k.frames.map((frame) => {
        const styles = frameStyles(instance, frame);
        if (!styles) return frame;
        const key = textsKey(textsIn(instance, styles));
        return { ...frame, declarations: [...frame.declarations, ...groups.map((texts, g) => ({ property: named(g), value: one(textsKey(texts) === key) }))] };
      }),
    }));
    const layers = hover?.map((layer) => ({ ...layer, styles: mark(layer.styles) }));
    const weights = groups.slice(0, -1).map((_, g) =>
      `    float text${g} = ${hoverValue(mark(instance.styles), marked, named(g), (value) => glslFloat(Number(value![0].value)), layers)};`,
    );
    const textLines = [
      ...weights,
      ...groups.slice(0, -1).flatMap((texts, g) => [`    if (text${g} > 0.5) {`, ...lines(texts, "      "), "    }"]),
      ...lines(groups[groups.length - 1], "    "),
    ];
    return [
      `  if (id == ${id}) {  // ${label(instance)}`,
      `    vec3 q = ${space}(p);`,
      `    vec3 ln = ${space}(p + n * 0.01) - q; // the normal in the object's space`,
      ...(faces.length > 0 || textLines.some((line) => line.includes("face ==")) ? [`    int face = faceOf(ln);`] : []),
      ...faces.map(
        ({ face, image }, i) =>
          `    ${i > 0 ? "else " : ""}if (face == ${FACE_NUMBERS[face]}) color = ${read(image!, "q", "ln")}; // ${face}`,
      ),
      ...(side !== null ? [`    ${faces.length > 0 ? "else " : ""}color = ${read(side, "q", "ln")};`] : []),
      ...textLines,
      "  }",
    ].join("\n");
  });

  const textureColor = [
    "vec3 textureColor(float id, vec3 p, vec3 n, vec3 color) {",
    ...branches,
    "  return color;", // the objects without a texture keep their color
    "}",
  ].join("\n");

  return {
    uniforms,
    functions: [
      ...spaces,
      ...(branches.join("\n").includes("triplanar(") ? [TRIPLANAR] : []),
      ...(branches.join("\n").includes("spherical(") ? [SPHERICAL] : []),
      ...(branches.join("\n").includes("textLabel(") || branches.join("\n").includes("textSticker(") ? [TEXT_LABEL] : []),
      ...(branches.join("\n").includes("textSticker(") ? [TEXT_STICKER] : []),
      ...(branches.join("\n").includes("wrapped(") ? [WRAPPED] : []),
      ...(branches.join("\n").includes("textInk(") ? [TEXT_INK] : []),
      ...(branches.join("\n").includes("faceOf(") ? [FACE_OF] : []),
      textureColor,
    ].join("\n\n"),
    call: "    m.color = textureColor(id, p, n, m.color);",
  };
}
