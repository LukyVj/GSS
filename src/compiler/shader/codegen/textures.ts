// Textures (decision 59): one uniform per image, triplanar() or spherical() (decision 185), textureColor()
import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import { FACES, shapeFaces, type Face, type StyledInstance } from "../../cascade/resolve";
import { readMapping, readRendering, readTexture, sceneTextures } from "../../features/textures";
import { readFontSize, TEXT_COLOR } from "../../features/content";
import { frameStyles, objectBox, short, textGroups, textRoom, textsIn, textsKey, type FaceText, type NumberText, type Texts } from "../../features/text-layout";
import type { Styles } from "../../cascade/resolve";
import { hoverValue } from "./animation";
import { glslFloat, label, round, type Hover } from "./glsl";
import { readColor } from "./read";
import { div, g, liveNumber, type Num } from "./live";
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
  return textAt(image, uv, face, color, ink, zoom);
}`;

// The text at a point of a face: uv from its middle, along the face and up it; face, its room
const TEXT_AT = `vec3 textAt(sampler2D image, vec2 uv, vec2 face, vec3 color, vec3 ink, float zoom) {
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

// content with a number (decision 203): one piece of it, an image drawn twice like a text,
// read at st with the gradients of st on the screen. The pieces are read by hand, so the
// image is read with the gradients of the whole text: no line where two pieces meet
const TEXT_PIECE = `vec3 textPiece(sampler2D image, vec2 st, vec2 dx, vec2 dy, vec3 color, vec3 ink) {
  vec2 copy = vec2(1.0, 0.5);                                                         // one copy is half the image
  vec4 light = textureGrad(image, vec2(st.x, 0.5 + 0.5 * st.y), dx * copy, dy * copy); // the copy in white
  vec4 dark = textureGrad(image, vec2(st.x, 0.5 * st.y), dx * copy, dy * copy);       // the copy in black
  float plain = clamp(dot(light.rgb - dark.rgb, vec3(0.3333)), 0.0, 1.0);             // 1: a letter, 0: an emoji
  return mix(color, mix(dark.rgb, ink, plain), light.a);
}`;

// content with a number: the string before it, its characters, the string after it, end
// to end on one line, like textAt() with one image. digits: 0123456789-. in twelve cells
// of one width; before and after are drawn at the height of the digits (sides: 1 there is
// a string before, 2 after, 3 both). number: the cells of the characters, four bits each
// from the left, six in x and six in y, then how many (z) and sides (w). place: the width
// of a line in pixels of the digits and where the text goes in it (font-size); else 0, 0
// and the room around the text
const TEXT_NUMBER = `vec3 textNumber(sampler2D before, sampler2D digits, sampler2D after, vec4 number, vec3 place, vec2 uv, vec2 face, vec3 color, vec3 ink, float zoom) {
  vec2 cells = vec2(textureSize(digits, 0)) * vec2(1.0, 0.5);                         // one copy of the digits, in pixels
  float line = cells.y;
  float cell = cells.x / 12.0;
  vec2 first = vec2(textureSize(before, 0)) * vec2(1.0, 0.5);
  vec2 last = vec2(textureSize(after, 0)) * vec2(1.0, 0.5);
  float wb = mod(number.w, 2.0) > 0.5 ? first.x * line / first.y : 0.0;              // the strings, at the height of the digits
  float wa = number.w > 1.5 ? last.x * line / last.y : 0.0;
  float wd = number.z * cell;
  float total = wb + wd + wa;
  vec2 box = place.x > 0.0 ? vec2(place.x, line) : vec2(total, line) + 2.0 * place.z;
  float scale = zoom > 0.0 ? zoom * face.x / box.x : min(face.x / box.x, face.y / box.y);
  vec2 at = uv / scale + 0.5 * box;                                                   // in pixels, from the bottom left
  vec2 dx = dFdx(at);
  vec2 dy = dFdy(at);
  float x = at.x - (place.x > 0.0 ? place.y * (box.x - total) : place.z);         // from the start of the text
  float y = (at.y - 0.5 * (box.y - line)) / line;
  if (x < 0.0 || x > total || y < 0.0 || y > 1.0) return color;                      // nothing around the text
  if (x < wb) return textPiece(before, vec2(x / wb, y), vec2(dx.x / wb, dx.y / line), vec2(dy.x / wb, dy.y / line), color, ink);
  if (x >= wb + wd) return textPiece(after, vec2((x - wb - wd) / wa, y), vec2(dx.x / wa, dx.y / line), vec2(dy.x / wa, dy.y / line), color, ink);
  float k = floor((x - wb) / cell);                                                   // the character x is on
  float code = k < 5.5 ? number.x : number.y;
  float shift = mod(k, 6.0);                                                          // code / 16^shift, exactly
  code = floor(code / (shift > 0.5 ? 16.0 : 1.0));
  code = floor(code / (shift > 1.5 ? 16.0 : 1.0));
  code = floor(code / (shift > 2.5 ? 16.0 : 1.0));
  code = floor(code / (shift > 3.5 ? 16.0 : 1.0));
  code = floor(code / (shift > 4.5 ? 16.0 : 1.0));
  float u = (mod(code, 16.0) * cell + x - wb - k * cell) / cells.x;                   // in its cell of the digits
  return textPiece(digits, vec2(u, y), vec2(dx.x / cells.x, dx.y / line), vec2(dy.x / cells.x, dy.y / line), color, ink);
}`;

// The functions of the texts for a text with a number: the same, with the images of its
// pieces and how to write it instead of one image
const numbered = (code: string) =>
  code
    .replace(/^vec3 text(\w+)\(sampler2D image,/, "vec3 number$1(sampler2D before, sampler2D digits, sampler2D after, vec4 number, vec3 place,")
    .replace(/textAt\(image, /g, "textNumber(before, digits, after, number, place, ")
    .replace(/text(Label|Facet)\(image, /g, "number$1(before, digits, after, number, place, ");

// content on a flat face that is not a side of a box (a triangle of an octahedron, a slope
// of a pyramid): the text lies in its plane, around its middle, upright (its top toward +y,
// or toward the front on a face that looks down)
const TEXT_FACET = `vec3 textFacet(sampler2D image, vec3 q, vec3 normal, vec3 middle, vec2 room, vec3 color, vec3 ink, float zoom) {
  vec3 up = abs(normal.y) > 0.99 ? vec3(0.0, 0.0, -sign(normal.y)) : normalize(vec3(0.0, 1.0, 0.0) - normal * normal.y);
  vec3 right = cross(up, normal);
  vec3 d = q - middle;
  return textAt(image, vec2(dot(d, right), dot(d, up)), room, color, ink, zoom);
}`;

// content on a pyramid of size s: its base, then the slope the point is on, each with its
// normal, its middle and its room (half of its base, a third of its height)
const TEXT_PYRAMID = `vec3 textPyramid(sampler2D image, vec3 q, vec3 s, vec3 color, vec3 ink, float zoom) {
  if (q.y < -0.49 * s.y) return textFacet(image, q, vec3(0.0, -1.0, 0.0), vec3(0.0, -0.5 * s.y, 0.0), s.xz, color, ink, zoom);  // the base
  vec2 xz = q.xz / s.xz;
  if (abs(xz.y) >= abs(xz.x)) {                                                       // the front or the back
    float side = sign(xz.y);
    vec3 normal = normalize(vec3(0.0, 0.5 * s.z, side * s.y));
    return textFacet(image, q, normal, vec3(0.0, -s.y / 6.0, side * s.z / 3.0), vec2(0.5 * s.x, length(vec2(s.y, 0.5 * s.z)) / 3.0), color, ink, zoom);
  }
  float side = sign(xz.x);                                                            // the right or the left
  vec3 normal = normalize(vec3(side * s.y, 0.5 * s.x, 0.0));
  return textFacet(image, q, normal, vec3(side * s.x / 3.0, -s.y / 6.0, 0.0), vec2(0.5 * s.z, length(vec2(s.y, 0.5 * s.x)) / 3.0), color, ink, zoom);
}`

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

// The face of an octahedron a normal is on: 1 to 4 on top, from the front-right turning
// right (front-right, back-right, back-left, front-left), 5 to 8 below them
const OCTAHEDRON_FACE = `int octahedronFace(vec3 n) {
  int i = n.x >= 0.0 ? (n.z >= 0.0 ? 1 : 2) : (n.z >= 0.0 ? 4 : 3);
  return n.y >= 0.0 ? i : i + 4;
}`;

// The face of a pyramid of size s a point is on: 1 front, 2 right, 3 back, 4 left, 5 the base
const PYRAMID_FACE = `int pyramidFace(vec3 q, vec3 s) {
  if (q.y < -0.49 * s.y) return 5;
  vec2 xz = q.xz / s.xz;
  if (abs(xz.y) >= abs(xz.x)) return xz.y >= 0.0 ? 1 : 3;
  return xz.x >= 0.0 ? 2 : 4;
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

    if (groups.every((texts) => texts.every((text) => text === null))) {
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
    const facet = room.facet;
    const write = (text: FaceText) => {
      if (!text) return "color";
      const number = text.number;
      // a text with a number: the images of its pieces and how to write it (decision 203)
      const image = number ? numberImages(number, files) : `uTexture${files.indexOf(text.source)}`;
      const name = (fn: string) => (number ? fn.replace(/^text/, "number") : fn);
      const end = `color, ${ink}, ${text.sized ? zoom : "0.0"})`;
      if (facet?.shape === "octahedron")
        return `${name("textFacet")}(${image}, q, normalize(sign(ln)), sign(ln) * ${g(short(div(facet.r, 3)))}, vec2(${g(room.box[0])}, ${g(room.box[1])}), ${end}`;
      if (facet?.shape === "pyramid") return `${name("textPyramid")}(${image}, q, vec3(${facet.size.map(g).join(", ")}), ${end}`;
      return `${name(room.sticker ? "textSticker" : "textLabel")}(${image}, ${at}, ln, vec3(${room.box.map(g).join(", ")}), ${end}`;
    };
    // The texts of the faces: the one most faces share is written last, the others face by
    // face. faceOf() gives the face of a shape seen from six sides (its own numbers); a
    // pyramid and an octahedron number their faces as ::face() does
    const names = shapeFaces(instance.tag);
    const faceCode = facet?.shape === "octahedron" ? "octahedronFace(ln)" : facet?.shape === "pyramid" ? `pyramidFace(q, vec3(${facet.size.map(g).join(", ")}))` : "faceOf(ln)";
    const glslFace = (i: number) => (facet ? i + 1 : FACE_NUMBERS[names[i]!]);
    const lines = (texts: Texts, indent: string) => {
      const key = (text: FaceText) => text?.source ?? "";
      const count = (text: FaceText) => texts.filter((other) => key(other) === key(text)).length;
      const shared = texts.reduce((best, text) => (count(text) > count(best) ? text : best));
      return [
        ...texts.flatMap((text, i) =>
          key(text) === key(shared) ? [] : [`${indent}if (face == ${glslFace(i)}) return ${write(text)}; // ${names[i] ?? `face ${i + 1}`}`],
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
      // the faces of the images are seen from six sides; on a pyramid or an octahedron, the
      // texts have faces of their own
      ...(facet
        ? textLines.some((line) => line.includes("face ==")) ? [`    int face = ${faceCode};`] : []
        : faces.length > 0 || textLines.some((line) => line.includes("face ==")) ? [`    int face = faceOf(ln);`] : []),
      ...faces.map(
        ({ face, image }, i) =>
          `    ${i > 0 ? "else " : ""}if (${facet ? "faceOf(ln)" : "face"} == ${FACE_NUMBERS[face]}) color = ${read(image!, "q", "ln")}; // ${face}`,
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
      ...(/text(Label|Sticker|Facet|Pyramid)\(/.test(branches.join("\n")) ? [TEXT_AT] : []),
      ...(branches.join("\n").includes("textLabel(") || branches.join("\n").includes("textSticker(") ? [TEXT_LABEL] : []),
      ...(/text(Facet|Pyramid)\(/.test(branches.join("\n")) ? [TEXT_FACET] : []),
      ...(branches.join("\n").includes("textPyramid(") ? [TEXT_PYRAMID] : []),
      ...(branches.join("\n").includes("textSticker(") ? [TEXT_STICKER] : []),
      ...(branches.join("\n").includes("wrapped(") ? [WRAPPED] : []),
      ...(/number(Label|Sticker|Facet|Pyramid)\(/.test(branches.join("\n")) ? [TEXT_PIECE, TEXT_NUMBER] : []),
      ...(branches.join("\n").includes("numberLabel(") || branches.join("\n").includes("numberSticker(") ? [numbered(TEXT_LABEL)] : []),
      ...(/number(Facet|Pyramid)\(/.test(branches.join("\n")) ? [numbered(TEXT_FACET)] : []),
      ...(branches.join("\n").includes("numberPyramid(") ? [numbered(TEXT_PYRAMID)] : []),
      ...(branches.join("\n").includes("numberSticker(") ? [numbered(TEXT_STICKER)] : []),
      ...(branches.join("\n").includes("textInk(") ? [TEXT_INK] : []),
      ...(branches.join("\n").includes("faceOf(") ? [FACE_OF] : []),
      ...(branches.join("\n").includes("octahedronFace(") ? [OCTAHEDRON_FACE] : []),
      ...(branches.join("\n").includes("pyramidFace(") ? [PYRAMID_FACE] : []),
      textureColor,
    ].join("\n\n"),
    call: "    m.color = textureColor(id, p, n, m.color);",
  };
}

// The images of a text with a number and how to write it, for numberLabel() and the others:
// before, digits, after (the digits again where there is no string), number, place
function numberImages(number: NumberText, files: string[]): string {
  const digits = `uTexture${files.indexOf(number.digits)}`;
  const piece = (image: string | null) => (image === null ? digits : `uTexture${files.indexOf(image)}`);
  const sides = (number.before === null ? 0 : 1) + (number.after === null ? 0 : 2);
  return `${piece(number.before)}, ${digits}, ${piece(number.after)}, vec4(${[...number.code, number.count, sides].map(glslFloat).join(", ")}), vec3(${number.layout.map(glslFloat).join(", ")})`;
}
