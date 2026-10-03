import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { readSteps } from "../../features/filter";
import { animatedValue, hoverValue } from "./animation";
import { glslFloat, label, round, type Hover } from "./glsl";
import { valuesOf } from "./gradients";
import { isLive } from "./live";
import { readColorAlpha } from "./read";

// opacity (decision 116): an object covers what is behind it as much as its opacity, like
// CSS. main() draws the surfaces along the ray from the front, each over what is behind it
// (LAYERS); a transparent object is a skin while the ray marches (shell(), masks.ts), so its
// back face and what is inside it show. The opacity of the groups multiplies into each
// object, unlike CSS, which fades a group as one picture.

const OPACITY_ERROR = "opacity expects a number from 0 to 1 or a percentage, like: opacity: 0.5;";
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// An opacity in GLSL, kept between 0 and 1 like CSS
export function readOpacity(value: Token[] | undefined): string {
  if (!value) return "1.0";
  const [token] = value;
  if (value.length !== 1) throw errorAt(value, OPACITY_ERROR);
  if (token.type === "NUMBER") return glslFloat(clamp01(token.value));
  if (token.type === "PERCENTAGE") return glslFloat(clamp01(token.value / 100));
  // A variable set from JS (decision 105)
  if (token.type === "EXPR" && token.syntax === "number") return `clamp(${token.code}, 0.0, 1.0)`;
  if (token.type === "EXPR" && token.syntax === "percentage") return `clamp(${token.code} / 100.0, 0.0, 1.0)`;
  throw errorAt(value, OPACITY_ERROR);
}

export type Transparent = { instance: StyledInstance; alpha: string };

const NUMBER = /^[\d.]+$/;

// The amounts of opacity() in a filter (decision 117), in GLSL
function filterOpacity(styles: Record<string, Token[]>): string[] {
  const steps = styles["filter"] ? readSteps(styles["filter"]) : [];
  return steps.flatMap((step) => (step.kind !== "opacity" ? [] : [isLive(step.amount) ? step.amount : glslFloat(round(step.amount))]));
}

// How much an object covers what is behind it, in GLSL: its opacity times those of its
// groups, the alpha of its color, opacity() in the filters of the object and of its groups,
// and the transparent stops of its gradient (painted, decision 117); null when it is opaque
// at every moment
export function objectAlpha(instance: StyledInstance, keyframes: Keyframes[], hover: Hover | undefined, painted = false): string | null {
  // An animation that keeps a value at 1 at every step is not a transparency: mix(1.0, 1.0, …)
  const opaque = (styles: Record<string, Token[]>, property: string, read: (value: Token[] | undefined) => string, on?: Hover) =>
    valuesOf(styles, keyframes, property, on).every((value) => read(value) === "1.0");
  const own = opaque(instance.styles, "opacity", readOpacity, hover)
    ? "1.0"
    : hoverValue(instance.styles, keyframes, "opacity", readOpacity, hover);
  const groups = instance.groupStyles.map((styles) =>
    opaque(styles, "opacity", readOpacity) ? "1.0" : animatedValue(styles, keyframes, "opacity", readOpacity),
  );
  // A color set from JS is opaque: its uniform has no alpha
  const values = valuesOf(instance.styles, keyframes, "color", hover);
  const live = values.some((value) => value.some((token) => token.type === "EXPR"));
  const color =
    live || values.every((value) => readColorAlpha(value) === "1.0")
      ? "1.0"
      : hoverValue(instance.styles, keyframes, "color", readColorAlpha, hover);
  const filters = [instance.styles, ...instance.groupStyles].flatMap(filterOpacity);
  const factors = [...groups, own, color, ...filters, ...(painted ? ["paintAlpha(id, p)"] : [])].filter((glsl) => glsl !== "1.0");
  if (factors.length === 0) return null;
  // The numbers known now are multiplied now
  const known = factors.filter((glsl) => NUMBER.test(glsl)).reduce((product, glsl) => product * Number(glsl), 1);
  const moving = factors.filter((glsl) => !NUMBER.test(glsl));
  return [...(known !== 1 || moving.length === 0 ? [glslFloat(round(known))] : []), ...moving].join(" * ");
}

// surfaceAlpha(): how much the surface of each object covers what is behind it at a point
export function alphaFunction(transparent: Transparent[]): string {
  return [
    "// opacity: how much the surface of each object covers what is behind it",
    "float surfaceAlpha(float id, vec3 p) {",
    ...transparent.map(({ instance, alpha }) => `  if (id == ${glslFloat(instance.index)}) return ${alpha};  // ${label(instance)}`),
    "  return 1.0;",
    "}",
  ].join("\n");
}

// surfaceColor(): the color the light takes through a transparent surface (shadows)
export function colorFunction(painted: boolean): string {
  return [
    "// The color of the surface of an object at a point: the light through it takes it",
    "vec3 surfaceColor(float id, vec3 p) {",
    painted ? "  return gradientColor(id, p, getMaterial(id).color);" : "  return getMaterial(id).color;",
    "}",
  ].join("\n");
}

// Past the surface a ray met at t: where it leaves the surface, to look for the one behind
export const PAST_SURFACE = `// opacity: past the surface the ray met at t, where it leaves it, to look for the one behind
float pastSurface(vec3 ro, vec3 rd, float t) {
  throughHoles = true;
  for (int i = 0; i < 16; i++) {
    t += 0.002;
    if (abs(map(ro + rd * t).x) >= 0.001) break;
  }
  throughHoles = false;
  return t;
}`;

// The surface of the template (SURFACE), in a function: main() calls it for each surface
// along the ray. /*@SURFACE_FILTER*/: the filters of the object, on its own color.
export function surfaceFunction(surface: string): string {
  return [
    "// opacity: the color of the surface a ray meets at t, lit, with its fog; main() calls it",
    "// for each surface along the ray",
    "vec3 shadeSurface(vec3 ro, vec3 rd, float t, float id) {",
    surface.trimEnd(),
    "/*@SURFACE_FILTER*/  return col;",
    "}",
    "",
    "",
  ].join("\n");
}

// main() with transparent objects, in place of the surface: the surfaces along the ray
// from the front, each over what is behind it. t and id stay those of the first surface:
// the picking and the passes of the filters read them.
export const LAYERS = `  // opacity: the surfaces along the ray, from the front, each over what is behind it
  vec3 col = vec3(0.0);  // what the surfaces in front give, premultiplied
  float cover = 0.0;     // how much of the pixel they cover
  float lt = t;
  float lid = id;
  for (int layer = 0; layer < 6; layer++) {
    vec3 c = shadeSurface(ro, rd, lt, lid);
    // The background, or the last surface the ray looks at, covers what is left
    float a = lt < MAX_DIST && layer < 5 ? surfaceAlpha(lid, ro + rd * lt) : 1.0;
    col += (1.0 - cover) * a * c;
    cover += (1.0 - cover) * a;
    if (cover > 0.996) break;
    float behind = pastSurface(ro, rd, lt);
    vec2 next = march(ro + rd * behind, rd);
    lt = behind + next.x;
    lid = next.y;
  }
`;
