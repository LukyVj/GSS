// The lights of the scene (decision 110): the sun (scene { light }), the ambient light, and
// the light elements of @scene, points of light placed like objects. A scene lit by a
// white sun only keeps the lighting it always had, line for line (lightingCode() returns
// null); otherwise diffuse() and the highlights of metal, jelly and glass add up every light.
import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance, Styles } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { clampComputed } from "../../values/calc";
import { readAngle } from "../../values/values";
import { isGradient } from "../gradient";
import { animatedValue, hoverValue } from "./animation";
import { glslFloat, label, round, type Hover } from "./glsl";
import { hexToRgb } from "./read";
import { forwardLines, hoist, type Hoisted } from "./transforms";
import { shadowFunction, type Shadows } from "./shadows";

export const MAX_LIGHTS = 8;
export const isLight = (instance: { tag: string }) => instance.tag === "light";

const SUN_ERROR =
  "light expects none, or two angles for the direction of the sun, then a color and an intensity if needed, like: light: -45deg 54.7deg #ffd27a 0.8;";
const AMBIENT_ERROR = "ambient expects a number between 0 and 1, then a color if needed, like: ambient: 0.2 #9db4ff;";

const isColor = (token: Token | undefined) =>
  token?.type === "HASH" || (token?.type === "EXPR" && token.syntax === "color");
const isNumber = (token: Token | undefined) =>
  token?.type === "NUMBER" || (token?.type === "EXPR" && token.syntax === "number");

// A color in GLSL: a hex color, or a color set from JS
function colorOf(token: Token, value: Token[]): string {
  if (token.type === "EXPR") return token.code;
  if (token.type !== "HASH") throw errorAt(value, SUN_ERROR);
  return `vec3(${hexToRgb(token.value).map(glslFloat).join(", ")})`;
}

// An intensity in GLSL: 0 or more. Computed below 0, it is 0 (decision 104).
function intensityOf(token: Token, value: Token[], error: string): string {
  if (token.type === "EXPR" && token.syntax === "number") return `max(${token.code}, 0.0)`;
  if (token.type !== "NUMBER") throw errorAt(value, error);
  const n = clampComputed(token, 0);
  if (n < 0) throw errorAt(value, error);
  return glslFloat(n);
}

// ----- The sun -----

// The sun in GLSL: its direction, its color and its intensity. none is a sun of
// intensity 0, so an animation can make it rise.
type Sun = { direction: string; color: string; intensity: string };
const DEFAULT_DIRECTION = "vec3(-0.408, 0.816, 0.408)";
const WHITE = "vec3(1.0)";

function angleOf(token: Token, value: Token[]): string | number {
  if (token.type === "EXPR") {
    if (token.syntax !== "angle") throw errorAt(value, SUN_ERROR);
    return token.code;
  }
  if (token.type !== "DIMENSION" && token.type !== "NUMBER") throw errorAt(value, SUN_ERROR);
  return readAngle([token]);
}

export function readSun(value: Token[] | undefined): Sun {
  if (!value) return { direction: DEFAULT_DIRECTION, color: WHITE, intensity: "1.0" };
  if (value.length === 1 && value[0].type === "IDENT" && value[0].value === "none")
    return { direction: DEFAULT_DIRECTION, color: WHITE, intensity: "0.0" };
  if (value.length < 2 || value.length > 4) throw errorAt(value, SUN_ERROR);
  const [azimuth, elevation] = value.slice(0, 2).map((token) => angleOf(token, value));
  const rest = value.slice(2);
  const color = rest.filter(isColor);
  const number = rest.filter(isNumber);
  if (color.length > 1 || number.length > 1 || color.length + number.length !== rest.length)
    throw errorAt(value, SUN_ERROR);
  const direction =
    typeof azimuth === "number" && typeof elevation === "number"
      ? `vec3(${[
          Math.cos(elevation) * Math.sin(azimuth),
          Math.sin(elevation),
          Math.cos(elevation) * Math.cos(azimuth),
        ]
          .map((n) => glslFloat(round(n)))
          .join(", ")})`
      : // Set from JS: computed on the GPU, like lightDirection()
        (() => {
          const a = typeof azimuth === "number" ? glslFloat(+azimuth.toFixed(6)) : azimuth;
          const e = typeof elevation === "number" ? glslFloat(+elevation.toFixed(6)) : elevation;
          return `vec3(cos(${e}) * sin(${a}), sin(${e}), cos(${e}) * cos(${a}))`;
        })();
  return {
    direction,
    color: color[0] ? colorOf(color[0], value) : WHITE,
    intensity: number[0] ? intensityOf(number[0], value, SUN_ERROR) : "1.0",
  };
}

// ----- The ambient light -----

// ambient: a number, then a color if needed. The number goes on to what ambient always
// was; the color is new.
export function splitAmbient(value: Token[] | undefined): { number: Token[] | undefined; color: string | null } {
  if (!value || value.length === 1) return { number: value, color: null };
  if (value.length !== 2 || !isColor(value[1])) throw errorAt(value, AMBIENT_ERROR);
  return { number: [value[0]], color: colorOf(value[1], value) };
}

// ----- The lights of @scene -----

// The color of a light: a plain color, white by default
function lightColor(value: Token[] | undefined): string {
  if (!value) return WHITE;
  const gradient: boolean = isGradient(value); // a boolean: value stays a list of tokens after it
  if (gradient) throw errorAt(value, "A light takes a color, not a gradient, like: color: #ffd27a;");
  if (value.length !== 1) throw errorAt(value, "A light takes a color, like: color: #ffd27a;");
  return colorOf(value[0], value);
}

const INTENSITY_ERROR = "intensity expects a number, 0 or more, like: intensity: 2;";
function lightIntensity(value: Token[] | undefined): string {
  if (!value) return "1.0";
  if (value.length !== 1) throw errorAt(value, INTENSITY_ERROR);
  return intensityOf(value[0], value, INTENSITY_ERROR);
}

// Two GLSL values multiplied: computed now when both are known
const NUMBERS = /^vec3\(([-\d.]+)(?:, ([-\d.]+), ([-\d.]+))?\)$/;
function times(color: string, intensity: string): string {
  const c = color.match(NUMBERS);
  const k = Number(intensity);
  if (!c || Number.isNaN(k)) return `(${color} * ${intensity})`;
  const rgb = (c[2] === undefined ? [c[1], c[1], c[1]] : [c[1], c[2], c[3]]).map((x) => round(Number(x) * k));
  return rgb.every((x) => x === rgb[0]) ? `vec3(${glslFloat(rgb[0])})` : `vec3(${rgb.map(glslFloat).join(", ")})`;
}
const known = (glsl: string) => NUMBERS.test(glsl) || /^-?[\d.]+$/.test(glsl);

// ----- The code -----

// The template's diffuse(): replaced when the lighting is not the white sun of always
export const DIFFUSE = `// The sun and the ambient light on a surface
vec3 diffuse(vec3 n, vec3 color) {
  float diff = max(dot(n, LIGHT_DIR), 0.0);
  return color * (/*@AMBIENT*/ + /*@DIRECT*/ * diff);
}`;

export type Lighting = {
  definitions: string; // in place of the template's LIGHT_DIR
  diffuse: string; // in place of the template's diffuse()
  positions: string; // the functions that place the lights, called by animate()
  rewrite: (shader: string) => string; // the highlights of the materials, from every light
};

// null: the white sun of always, without lights of @scene nor a colored ambient light
export function lightingCode(
  lamps: StyledInstance[],
  styles: Styles,
  keyframes: Keyframes[],
  hoverOf: (instance: StyledInstance) => Hover | undefined,
  hoisted: Hoisted,
  ambient: { level: string; color: string | null }, // the share of ambient light, in GLSL
  // shadows (decision 115): none, hard or soft, and whether the scene has holes to let light through
  shadows: { mode: Shadows; holes: boolean } = { mode: null, holes: false },
): Lighting | null {
  if (lamps.length > MAX_LIGHTS)
    throw errorAt(undefined, `A scene has ${MAX_LIGHTS} lights at most: this one has ${lamps.length}`);

  // The sun, at rest and in the frames of the scene's animation
  const still = readSun(styles["light"]);
  const [direction, color, intensity] = (["direction", "color", "intensity"] as const).map((part) =>
    animatedValue(styles, keyframes, "light", (value) => readSun(value)[part]),
  );
  const moves = direction !== still.direction || color !== still.color || intensity !== still.intensity;
  const plainSun = styles["light"]?.length !== 1 && still.color === WHITE && still.intensity === "1.0" && !moves;
  const shaded = shadows.mode !== null;
  if (!shaded && lamps.length === 0 && ambient.color === null && plainSun && (styles["light"]?.length ?? 2) === 2) return null;

  const sun = intensity !== "0.0"; // none, and it never rises
  const definitions: string[] = ["// The lights: the sun, the ambient light and the lights of @scene"];
  if (sun) {
    const turning = known(direction) ? direction : hoist(hoisted, "vec3", `normalize(${direction})`);
    definitions.push(known(turning) ? `const vec3 LIGHT_DIR = ${turning};` : `#define LIGHT_DIR ${turning}`);
    const power = times(color, intensity);
    definitions.push(known(power) ? `const vec3 SUN = ${power};` : `#define SUN ${hoist(hoisted, "vec3", power)}`);
  }
  const ambientLight = times(ambient.color ?? WHITE, ambient.level);
  definitions.push(
    known(ambientLight) ? `const vec3 AMBIENT_LIGHT = ${ambientLight};` : `#define AMBIENT_LIGHT ${hoist(hoisted, "vec3", ambientLight)}`,
  );
  const direct = known(ambient.level) ? glslFloat(round(1 - Number(ambient.level))) : `(1.0 - ${ambient.level})`;

  // Each light of @scene: where it is, once per pixel in animate(), and how much light it gives
  const positions: string[] = [];
  const powers = lamps.map((lamp, i) => {
    const hover = hoverOf(lamp);
    const noBox = () => {
      throw errorAt(lamp.styles["transform-origin"], "A light has no size: transform-origin takes numbers on a light, like: transform-origin: 0 -1 0;");
    };
    // The light itself, then its groups from the inside out
    const lines = [
      ...forwardLines(lamp.styles, keyframes, hover, hoisted, noBox),
      ...[...lamp.groupStyles].reverse().flatMap((group) => forwardLines(group, keyframes, undefined, hoisted)),
    ];
    positions.push([`vec3 lightPosition${i}() {  // ${label(lamp)}`, "  vec3 v = vec3(0.0);", ...lines, "  return v;", "}"].join("\n"));
    hoisted.values.push({ type: "vec3", name: `light${i}`, expr: `lightPosition${i}()` });
    const color = hoverValue(lamp.styles, keyframes, "color", lightColor, hover);
    const intensity = hoverValue(lamp.styles, keyframes, "intensity", lightIntensity, hover);
    return hoist(hoisted, "vec3", times(color, intensity));
  });

  // A function that adds up every light: the sun, then the lights of @scene.
  // term(L): what one light gives through the direction L toward it. lit: through the
  // shadows (decision 115), each light as much as reaches the point.
  const sum = (signature: string, term: (L: string) => string, sunScale = "", lit = shaded) =>
    [
      `vec3 ${signature} {`,
      "  vec3 light = vec3(0.0);",
      ...(sun ? [`  light += ${sunScale}SUN * ${lit ? "sunLit * " : ""}${term("LIGHT_DIR")};`] : []),
      ...lamps.flatMap((lamp, i) => [
        `  vec4 l${i} = lamp(light${i}, p);`,
        `  light += ${powers[i]} * l${i}.w * ${lit ? `lit${i} * ` : ""}${term(`l${i}.xyz`)};  // ${label(lamp)}`,
      ]),
      "  return light;",
      "}",
    ].join("\n");

  const helpers: Record<string, string> = {
    "lightShine(": `// The highlights of every light: sharp when k is high, wide when it is low\n${sum("lightShine(vec3 p, vec3 r, float k)", (L) => `pow(max(dot(r, ${L}), 0.0), k)`)}`,
    "lightWrap(": `// Light that wraps around a surface, with no hard shadow side (jelly)\n${sum("lightWrap(vec3 p, vec3 n)", (L) => `(dot(n, ${L}) * 0.5 + 0.5)`)}`,
    "lightBump(": `// Light on the bumps of frosted glass\n${sum("lightBump(vec3 p, vec3 b)", (L) => `max(dot(b, ${L}), 0.0)`)}`,
  };

  const sunScale = direct === "1.0" ? "" : `${direct} * `;
  const diffuse = [
    // shadows (decision 115): how much of each light reaches the point main() shades
    ...(shaded
      ? [
          "// shadows: how much of each light reaches the point main() shades, from 0 to 1",
          ...(sun ? ["float sunLit = 1.0;"] : []),
          ...lamps.map((_, i) => `float lit${i} = 1.0;`),
          "",
          shadowFunction(shadows.mode!, shadows.holes),
          "",
          "// Each light seen from p, through the objects on the way: main() calls it once",
          "void castShadows(vec3 p, vec3 n) {",
          "  vec3 from = p + n * 0.01;",
          ...(sun ? ["  sunLit = shadow(from, LIGHT_DIR, MAX_DIST);"] : []),
          ...lamps.map((_, i) => `  lit${i} = shadow(from, normalize(light${i} - from), length(light${i} - from));`),
          "}",
          "",
        ]
      : []),
    ...(lamps.length > 0
      ? [
          "// A light of @scene seen from p: the direction toward it, and the share of it that",
          "// reaches p: all of it at 1 unit, then 1 / distance²",
          "vec4 lamp(vec3 at, vec3 p) {",
          "  vec3 d = at - p;",
          "  float d2 = dot(d, d);",
          "  return vec4(d / sqrt(max(d2, 1e-8)), 1.0 / max(d2, 0.01));",
          "}",
          "",
        ]
      : []),
    "// The direct light on a surface at p facing n: the sun, then each light of @scene",
    sum("lighting(vec3 p, vec3 n)", (L) => `max(dot(n, ${L}), 0.0)`, sunScale),
    "",
    "// The ambient light, the sun and the lights of @scene on a surface",
    "vec3 diffuse(vec3 p, vec3 n, vec3 color) {",
    "  return color * (AMBIENT_LIGHT + lighting(p, n));",
    "}",
    // The reflections and the refractions show the objects without shadows
    ...(shaded
      ? [
          "",
          "// The same without shadows: what the reflections and the refractions see",
          sum("lightingOpen(vec3 p, vec3 n)", (L) => `max(dot(n, ${L}), 0.0)`, sunScale, false),
          "vec3 diffuseOpen(vec3 p, vec3 n, vec3 color) {",
          "  return color * (AMBIENT_LIGHT + lightingOpen(p, n));",
          "}",
        ]
      : []),
    "/*@LIGHT_HELPERS*/",
  ].join("\n");

  // The materials read the sun's direction: each place now adds up every light
  const rewrite = (shader: string): string => {
    let out = shader
      .replaceAll("diffuse(n, ", "diffuse(p, n, ")
      .replaceAll("float shine = pow(max(dot(r, LIGHT_DIR), 0.0), ", "vec3 shine = lightShine(p, r, ")
      .replaceAll("pow(max(dot(r, LIGHT_DIR), 0.0), ", "lightShine(p, r, ")
      .replace("float wrap = dot(n, LIGHT_DIR) * 0.5 + 0.5;", "vec3 wrap = lightWrap(p, n);")
      .replace("max(dot(bump(p, fs.x), LIGHT_DIR), 0.0)", "lightBump(p, bump(p, fs.x))");
    const used = Object.entries(helpers)
      .filter(([call]) => out.includes(`${call}p, `))
      .map(([, code]) => `\n${code}`);
    out = out.replace("/*@LIGHT_HELPERS*/", used.join("\n"));
    if (shaded) {
      // main() looks toward each light once, at the point it shades
      out = out.replace(/^( {4}vec3 n = (?:calcNormal\(p\)|holeNormal\(p, rd, id\));)$/m, "$1\n    castShadows(p, n);");
      // A reflection or a refraction: lit without shadows
      out = out.replace(/vec3 trace\(vec3 ro, vec3 rd\) \{[\s\S]*?\n\}/, (body) => body.replace("diffuse(p, n, ", "diffuseOpen(p, n, "));
    }
    // Every place that reads the sun's direction was rewritten: none is left without a sun
    if (!sun && out.includes("LIGHT_DIR")) throw new Error("GSS: a light term reads LIGHT_DIR without a sun");
    return out;
  };

  return { definitions: definitions.join("\n"), diffuse, positions: positions.join("\n\n"), rewrite };
}
