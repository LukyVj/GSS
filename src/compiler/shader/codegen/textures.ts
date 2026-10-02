// Textures (decision 59): one uniform per image, triplanar(), textureColor()
import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import { FACES, type Face, type StyledInstance } from "../../cascade/resolve";
import { readRendering, readTexture, sceneTextures } from "../../features/textures";
import { glslFloat, label, type Hover } from "./glsl";
import { g, liveNumber, liveSize3, mul, type Num } from "./live";
import { spaceFunction } from "./transforms";

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

// Which face a normal points to, in the object's space: its number in FACE_NUMBERS.
// The same tests as triplanar(), so a face and its image always agree.
const FACE_OF = `int faceOf(vec3 n) {
  vec3 a = abs(n);
  if (a.y >= a.x && a.y >= a.z) return n.y > 0.0 ? 1 : 2;  // top, bottom
  if (a.x >= a.z) return n.x > 0.0 ? 5 : 6;                // right, left
  return n.z > 0.0 ? 3 : 4;                                // front, back
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

  // A size set from JS (decision 105): the images follow it
  if (instance.tag === "cube") return liveSize3(instance.styles["size"]);
  if (instance.tag === "sphere") {
    const diameter = mul(2, liveNumber(instance.styles["radius"], "radius", 0.5)); // same default as SHAPES.sphere
    return [diameter, diameter, diameter];
  }
  return [1, 1, 1];
}

// The GLSL of the textures: one uniform per image, one space function per textured
// object, triplanar() and textureColor(). Nothing at all when the scene has no texture.
export function textureCode(
  instances: StyledInstance[],
  keyframes: Keyframes[],
  hoverOf: (instance: StyledInstance) => Hover | undefined,
) {
  const files = sceneTextures(instances);
  if (files.length === 0) return { uniforms: "", functions: "", call: "" };

  const uniforms = files
    .map((file, i) => `uniform sampler2D uTexture${i}; // ${file}`)
    .join("\n");

  const textured = instances.filter(
    (instance) =>
      instance.styles["texture"] ||
      FACES.some((face) => instance.faceStyles[face]["texture"]),
  );

  // The same moves as in map(): the groups from the outside in, then the object
  const spaces = textured.map((instance) => spaceFunction(instance, keyframes, hoverOf));

  const branches = textured.map((instance) => {
    const id = glslFloat(instance.index);
    const space = `space${instance.index}`;
    const box = `vec3(${textureBox(instance).map(g).join(", ")})`;
    const pixelated = readRendering(instance.styles["image-rendering"]); // one rendering for every face
    // The number of the image a texture value names, or null when there is none
    const imageOf = (value: Token[] | undefined): number | null =>
      value ? files.indexOf(readTexture(value)) : null;
    const read = (image: number, q: string, normal: string) =>
      `triplanar(uTexture${image}, ${q}, ${normal}, ${box}, color, ${pixelated})`;

    const side = imageOf(instance.styles["texture"]);
    // The faces with an image of their own, and that image
    const faces = FACES.map((face) => ({
      face,
      image: imageOf(instance.faceStyles[face]["texture"]),
    })).filter((entry) => entry.image !== null);

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
      TRIPLANAR,
      ...(branches.join("\n").includes("faceOf(") ? [FACE_OF] : []),
      textureColor,
    ].join("\n\n"),
    call: "    m.color = textureColor(id, p, n, m.color);",
  };
}
