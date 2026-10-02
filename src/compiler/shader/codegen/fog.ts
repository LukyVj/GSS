// The fog of the scene (decision 108): fog: [<color>] <start> <end>, or none, the default.
// Measured from the camera: nothing before the start, only fog after the end, linear
// between. Without a color, an object fades into the background behind it; with one, the
// background becomes the fog too: past the end, only the fog is seen.
import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import type { Styles } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { clampComputed } from "../../values/calc";
import { animatedValue } from "./animation";
import { glslFloat } from "./glsl";
import { readColor } from "./read";

const ERROR =
  "fog expects none, or a start and an end measured from the camera, with a color first or last if needed, like: fog: 6 18; or fog: #dfe7ef 4 16;";

// The fog in GLSL: its color (BACKGROUND: the background behind the object), where it
// starts and where it ends
type Parts = { color: string; start: string; end: string };

// none: a fog that starts and ends where the scene ends (MAX_DIST): nothing is in it, and an
// animation can move it into a real fog
const NONE: Parts = { color: "BACKGROUND", start: "20.0", end: "20.0" };

const isColor = (token: Token | undefined) =>
  token?.type === "HASH" || (token?.type === "EXPR" && token.syntax === "color");

// A distance: never below 0. Computed below 0, it is 0, like CSS; set from JS, kept at 0 or more.
function distance(token: Token, value: Token[]): { glsl: string; n: number | null } {
  if (token.type === "EXPR" && token.syntax === "number") return { glsl: `max(${token.code}, 0.0)`, n: null };
  if (token.type !== "NUMBER") throw errorAt(value, ERROR);
  const n = clampComputed(token, 0);
  if (n < 0) throw errorAt(value, ERROR);
  return { glsl: glslFloat(n), n };
}

function readFog(value: Token[] | undefined): Parts {
  if (!value || (value.length === 1 && value[0].type === "IDENT" && value[0].value === "none")) return NONE;
  // The color, first or last
  const first = isColor(value[0]);
  const last = !first && value.length > 1 && isColor(value[value.length - 1]);
  const color = first ? value[0] : last ? value[value.length - 1] : undefined;
  const numbers = first ? value.slice(1) : last ? value.slice(0, -1) : value;
  if (numbers.length !== 2) throw errorAt(value, ERROR);
  const [start, end] = numbers.map((token) => distance(token, value));
  if (start.n !== null && end.n !== null && end.n < start.n)
    throw errorAt(value, `fog expects its end after its start, like: fog: ${glslFloat(end.n)} ${glslFloat(start.n)};`);
  return {
    color: !color ? "BACKGROUND" : color.type === "EXPR" ? color.code : readColor([color]),
    start: start.glsl,
    end: end.glsl,
  };
}

const known = (glsl: string) => (/^-?\d+(\.\d+)?$/.test(glsl) ? Number(glsl) : null);

// fogAmount(), and the line of main() that mixes the fog in; null without fog. The fog
// follows the animation of the scene and the variables set from JS.
export function fogCode(styles: Styles, keyframes: Keyframes[]): { functions: string; line: string } | null {
  const [color, start, end] = (["color", "start", "end"] as const).map((part) =>
    animatedValue(styles, keyframes, "fog", (value) => readFog(value)[part]),
  );
  if (color === NONE.color && start === NONE.start && end === NONE.end) return null; // none, and it never moves
  const [a, b] = [known(start), known(end)];
  const ramp =
    a !== null && b !== null
      ? b > a
        ? `clamp((t - ${start}) / ${glslFloat(+(b - a).toFixed(6))}, 0.0, 1.0)`
        : `step(${start}, t)` // a sharp edge
      : `clamp((t - ${start}) / max(${end} - ${start}, 0.00001), 0.0, 1.0)`;
  return {
    functions: [
      "// The fog: how much of it lies between the camera and what the ray hits. Past the",
      "// end of the scene, only the fog is seen",
      "float fogAmount(float t) {",
      `  return t < MAX_DIST ? ${ramp} : 1.0;`,
      "}",
    ].join("\n"),
    line: `\n  col = mix(col, ${color}, fogAmount(t)); // the fog`,
  };
}
