import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { isGradient, linesOf, readGradient, type Gradient } from "../gradient";
import { gradientBox, layersOf, movingGradient, valuesOf } from "./gradients";
import { glslFloat, label, type Hover } from "./glsl";
import { g } from "./live";
import { spaceFunction } from "./transforms";

// mask-image (decision 113): holes in an object. The mask is read like a gradient in color,
// in the object's own space (seen from the front, noise() in 3D); where it covers less than
// half, the surface is not there, and march() goes on through it, into the object and out.
// While march() looks for a surface, an object with holes is a thin skin (shell()): what is
// inside it is not swallowed by its inside, and can be seen through a hole.

const MODES = ["alpha", "luminance", "match-source"];
const isNone = (value: Token[]) => value.length === 1 && value[0].type === "IDENT" && value[0].value === "none";

export type Masked = { instance: StyledInstance; gradient: Gradient; moving: Map<string, string>; luminance: boolean };

// The mask of an object, with the numbers an animation or a :hover moves; null without one
export function objectMask(instance: StyledInstance, keyframes: Keyframes[], hover: Hover | undefined): Masked | null {
  const styles = instance.styles;
  const mode = styles["mask-mode"];
  if (mode && !(mode.length === 1 && mode[0].type === "IDENT" && MODES.includes(mode[0].value)))
    throw errorAt(mode, "mask-mode expects alpha, luminance or match-source, like: mask-mode: luminance;");
  const value = styles["mask-image"];
  const values = valuesOf(styles, keyframes, "mask-image", hover);
  if (!value || isNone(value)) {
    const brought = values.find((other) => !isNone(other));
    if (brought)
      throw errorAt(brought, "mask-image cannot change from none into an image: write the image at rest too, with stops that show the whole object");
    return null;
  }
  if (layersOf(value).length > 1) throw errorAt(value, "mask-image takes one image: GSS does not combine several masks yet");
  if (!isGradient(value))
    throw errorAt(
      value,
      "mask-image expects none or an image: linear-gradient(), radial-gradient(), conic-gradient() or noise(), like: mask-image: noise(3, black 50%, transparent 52%);",
    );
  const name = readGradient(value, true).name;
  const other = values.find((other) => !isGradient(other));
  if (other)
    throw errorAt(other, `mask-image can only change into another ${name}(): write a ${name}() here too, with stops that show the whole object`);
  const { gradient, moving } = movingGradient(styles, keyframes, "mask-image", hover, { alpha: true });
  // match-source, the initial value: a gradient is read by its alpha, like CSS
  return { instance, gradient, moving, luminance: mode?.[0].value === "luminance" };
}

// maskAlpha(): how much of each masked object's surface is there at a point, from 0 to 1.
// spaced: the objects whose space function the textures or the gradients already write.
export function maskCode(
  masked: Masked[],
  spaced: Set<StyledInstance>,
  keyframes: Keyframes[],
  hoverOf: (instance: StyledInstance) => Hover | undefined,
): string {
  if (masked.length === 0) return "";
  const spaces = masked
    .filter(({ instance }) => !spaced.has(instance))
    .map(({ instance }) => spaceFunction(instance, keyframes, hoverOf));
  const branches = masked.map(({ instance, gradient, moving, luminance }) => {
    const { size, at } = gradientBox(instance);
    return [
      `  if (id == ${glslFloat(instance.index)}) {  // ${label(instance)}`,
      `    vec3 q = space${instance.index}(p);`,
      `    vec2 size = vec2(${size.map(g).join(", ")});`,
      `    vec2 at = ${at} + 0.5 * size;`,
      ...linesOf(gradient, moving).map((line) => `  ${line}`),
      // The colors are premultiplied: their luminance, times their alpha, like CSS
      luminance ? "    return dot(col.rgb, vec3(0.2125, 0.7154, 0.0721));" : "    return col.a;",
      "  }",
    ].join("\n");
  });
  const ids = masked.map(({ instance }) => `id == ${glslFloat(instance.index)}`).join(" || ");
  return [
    ...spaces,
    ["float maskAlpha(float id, vec3 p) {", ...branches, "  return 1.0;", "}"].join("\n"),
    `bool hasHoles(float id) {\n  return ${ids};\n}`,
  ].join("\n\n");
}

// Before map(): an object with holes is a skin while march() looks for a surface
export const SHELL = `// mask-image: while march() looks for a surface, an object with holes is a thin skin,
// so the ray can go in through a hole and see what is inside
bool throughHoles = false;
float shell(float d) {
  return throughHoles ? abs(d) : d;
}`;

// After calcNormal(): the normal of the surface a ray hits, in a scene with holes
export const HOLE_NORMAL = `// The normal at a point that was hit, in a scene with holes. An object with holes takes the
// normal of its own distance; an object inside one takes it where the objects with holes
// are skins, so it gets its own too. Seen through a hole, the inside of an object faces the
// viewer: its normal is turned toward the ray.
vec3 holeNormal(vec3 p, vec3 rd, float id) {
  throughHoles = !hasHoles(id);
  vec3 n = calcNormal(p);
  throughHoles = false;
  return dot(n, rd) > 0.0 ? -n : n;
}`;

// The loop of march() in a scene with holes. The distance, taken either way (map() is
// negative inside a solid object), is how far the ray can go. At a surface, the ray stops
// if the mask covers it, and goes on a little at a time through a hole.
export const MASKED_MARCH_LOOP = `  throughHoles = true;
  for (int i = 0; i < 200; i++) {
    vec3 p = ro + rd * t;
    vec2 res = map(p);
    id = res.y;
    float d = abs(res.x);
    if (d < 0.001) {
      if (maskAlpha(id, p) >= 0.5) break;  // the surface is there
      d = 0.002;                            // a hole: through it
    }
    t += d;
    if (t > MAX_DIST) break;
  }
  throughHoles = false;
`;

// The normals of main() and of the reflections of trace(), in a scene with holes
export function holeNormals(shader: string): string {
  return shader
    .replace("    vec3 p = ro + rd * t;\n    vec3 n = calcNormal(p);", "    vec3 p = ro + rd * t;\n    vec3 n = holeNormal(p, rd, id);")
    .replace(
      "  vec3 p = ro + rd * hit.x;  // the point that was hit\n  vec3 n = calcNormal(p);",
      "  vec3 p = ro + rd * hit.x;  // the point that was hit\n  vec3 n = holeNormal(p, rd, hit.y);",
    );
}
