import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance, Styles } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { hoverValue } from "./animation";
import { BLEND_MODES } from "./blend-library";
import { glslFloat, label, type Hover } from "./glsl";
import { valuesOf } from "./gradients";

// mix-blend-mode (decision 173): an object blends its color with what is behind it along the
// ray (the objects behind it, the floor, the background), like CSS, with the blend functions
// of background-blend-mode (blend-library.ts). Like a transparent object (decision 116), a
// blended object is a skin while the ray marches, so the ray can go on behind it. main()
// keeps the surfaces along the ray from the front, then draws them from the back, each over
// what is behind it: a blend needs its backdrop first, where opacity alone could add the
// surfaces from the front. A blended object is seen once, its nearest surface: the ray goes
// on past the rest of it, so it never blends with its own back face.

// The modes of background-blend-mode, then plus-lighter (Compositing and Blending 2). Each
// one's number in the shader is its place in this list: 0 is normal.
export const MIX_BLEND_MODES = [...Object.keys(BLEND_MODES), "plus-lighter"];

export function readMixBlendMode(value: Token[] | undefined): string {
  if (!value) return "normal";
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT" && MIX_BLEND_MODES.includes(token.value)) return token.value;
  throw errorAt(value, `mix-blend-mode expects ${MIX_BLEND_MODES.join(", ")}, like: mix-blend-mode: multiply;`);
}

// On a group, the mode goes into each of its objects that has none of its own, the closest
// group first, like the opacity of a group goes into each object (decision 116)
export function withInheritedBlendMode(instance: StyledInstance): StyledInstance {
  const inherited = instance.groupStyles.findLast((styles) => styles["mix-blend-mode"])?.["mix-blend-mode"];
  if (!inherited) return instance;
  readMixBlendMode(inherited);
  const inherit = (styles: Styles): Styles => (styles["mix-blend-mode"] ? styles : { ...styles, "mix-blend-mode": inherited });
  return {
    ...instance,
    styles: inherit(instance.styles),
    hoverStyles: inherit(instance.hoverStyles),
    activeStyles: inherit(instance.activeStyles),
  };
}

// An object that blends at some moment: its branch of blendMode(), and every mode it takes
export type Blended = { instance: StyledInstance; code: string; modes: string[] };

const numberOf = (mode: string) => glslFloat(MIX_BLEND_MODES.indexOf(mode));

// The mode of an object, at rest, on :hover and :active, and in its @keyframes; null when it
// is normal at every moment. Like a discrete property of CSS, the mode changes from one to
// the other halfway: each mode has a weight, which moves like a number from 0 to 1, and the
// mode with the most weight is the one drawn.
export function objectBlend(instance: StyledInstance, keyframes: Keyframes[], hover: Hover | undefined): Blended | null {
  const rest = readMixBlendMode(instance.styles["mix-blend-mode"]);
  const modes = [...new Set([rest, ...valuesOf(instance.styles, keyframes, "mix-blend-mode", hover).map(readMixBlendMode)])];
  if (modes.every((mode) => mode === "normal")) return null;
  const head = `  if (id == ${glslFloat(instance.index)})`;
  if (modes.length === 1) return { instance, modes, code: `${head} return ${numberOf(rest)};  // ${label(instance)}: ${rest}` };
  const weight = (mode: string) =>
    hoverValue(instance.styles, keyframes, "mix-blend-mode", (value) => (readMixBlendMode(value) === mode ? "1.0" : "0.0"), hover);
  const code = [
    `${head} {  // ${label(instance)}: ${modes.join(", ")}`,
    `    float mode = ${numberOf(modes[0])};`,
    `    float most = ${weight(modes[0])};`,
    ...modes.slice(1).flatMap((mode, i) => [
      `    ${i === 0 ? "float w" : "w"} = ${weight(mode)};`,
      "    if (w >= most) {",
      `      mode = ${numberOf(mode)};  // ${mode}`,
      "      most = w;",
      "    }",
    ]),
    "    return mode;",
    "  }",
  ].join("\n");
  return { instance, modes, code };
}

// The functions main() calls in a scene with blended objects: the mode of each object, a
// surface over what is behind it, and how the surfaces along a ray are kept
export function blendFunctions(blended: Blended[]): string {
  const used = new Set(blended.flatMap(({ modes }) => modes));
  const branches = MIX_BLEND_MODES.filter((mode) => mode !== "normal" && used.has(mode)).map((mode) =>
    mode === "plus-lighter"
      ? `  if (mode == ${numberOf(mode)}) return min(b + a * s, vec3(1.0));  // plus-lighter`
      : `  if (mode == ${numberOf(mode)}) return mix(b, ${BLEND_MODES[mode]}(b, s), a);  // ${mode}`,
  );
  return [
    [
      "// mix-blend-mode: the mode each object blends with, as a number: 0 is normal",
      "float blendMode(float id) {",
      ...blended.map(({ code }) => code),
      "  return 0.0;",
      "}",
    ].join("\n"),
    [
      "// mix-blend-mode: a surface over what is behind it, like CSS: b is the backdrop, s the color",
      "// of the surface, a how much of the pixel it covers, mode the number of its blend mode",
      "vec3 blendOver(float mode, vec3 b, vec3 s, float a) {",
      "  if (mode == 0.0) return mix(b, s, a);  // normal",
      "  // The colors as they show, between 0 and 1, like the colors of CSS",
      "  b = clamp(b, 0.0, 1.0);",
      "  s = clamp(s, 0.0, 1.0);",
      ...branches,
      "  return mix(b, s, a);",
      "}",
    ].join("\n"),
    `// mix-blend-mode: the n-th of the 6 numbers main() keeps along a ray, the first four in a,
// the next two in b
float layerOf(vec4 a, vec4 b, int n) {
  if (n < 4) return a[n];
  return b[n - 4];
}`,
    `// mix-blend-mode: whether an object blends and is already among the n surfaces kept. A
// blended object is seen once: its nearest surface, over what is behind the whole of it.
bool blendedAgain(float id, vec4 ids, vec4 moreIds, int n) {
  if (blendMode(id) == 0.0) return false;
  for (int k = 0; k < 6; k++) {
    if (k < n && layerOf(ids, moreIds, k) == id) return true;
  }
  return false;
}`,
  ].join("\n\n");
}

// main() with blended objects, in place of the surface: the surfaces along the ray from the
// front, then each one over what is behind it from the back. t and id stay those of the
// first surface: the picking and the passes of the filters read them.
export const BLENDED_LAYERS = `  // mix-blend-mode: the surfaces along the ray from the front, 6 at most; the ray goes on past
  // the rest of a blended object
  vec4 depths = vec4(0.0);  // where the first four surfaces are along the ray
  vec4 moreDepths = vec4(0.0);  // and the next two
  vec4 ids = vec4(0.0);  // the objects they belong to
  vec4 moreIds = vec4(0.0);
  int count = 0;
  float cover = 0.0;  // how much of the pixel the surfaces kept cover, those that do not blend
  float lt = t;
  float lid = id;
  for (int i = 0; i < 12; i++) {
    if (lt >= MAX_DIST || !blendedAgain(lid, ids, moreIds, count)) {
      if (count < 4) {
        depths[count] = lt;
        ids[count] = lid;
      } else {
        moreDepths[count - 4] = lt;
        moreIds[count - 4] = lid;
      }
      count++;
      // The background, or the last surface the ray looks at, covers what is left
      if (lt >= MAX_DIST || count == 6) break;
      if (blendMode(lid) == 0.0) cover += (1.0 - cover) * surfaceAlpha(lid, ro + rd * lt);
      if (cover > 0.996) break;
    }
    float behind = pastSurface(ro, rd, lt);
    vec2 next = march(ro + rd * behind, rd);
    lt = behind + next.x;
    lid = next.y;
  }
  // Then each surface over what is behind it, from the back, blended by its mode
  vec3 col = vec3(0.0);
  for (int k = 5; k >= 0; k--) {
    if (k >= count) continue;
    float st = layerOf(depths, moreDepths, k);
    float sid = layerOf(ids, moreIds, k);
    vec3 c = shadeSurface(ro, rd, st, sid);
    if (k == count - 1) {
      col = c;  // the background, or the last surface: it covers what is left
    } else {
      col = blendOver(blendMode(sid), col, c, surfaceAlpha(sid, ro + rd * st));
    }
  }
`;
