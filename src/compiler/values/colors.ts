// rgb(), hsl() and the named colors of CSS, turned into #rrggbb at compile time (decision 58).
// Like calc.ts and vars.ts: the rest of the compiler only ever sees a HASH token.
import type { Token } from "../syntax/tokenizer";
import { errorAt, rememberSpan, spanAcross } from "../syntax/errors";
import { closingParen } from "./calc";
import { NAMED_COLORS } from "./named-colors";

export const COLOR_FUNCTIONS = ["rgb", "rgba", "hsl", "hsla"];
// The properties whose whole value is a color
const COLOR_PROPERTIES = ["color", "floor", "background"];
// The materials whose first argument is a color: metal(tomato, 0.2)
const MATERIAL_FUNCTIONS = ["matte", "metal", "jelly", "glass"];

// tomato → #ff6347, but only where a color is expected (decision 58):
// material: gold stays the gold material, while color: gold is #ffd700.
export function resolveNamedColors(property: string, value: Token[]): Token[] {
  // 1. color: tomato → the value is a single name
  if (COLOR_PROPERTIES.includes(property) && value.length === 1) {
    return [named(value[0])];
  }
  // 2. material: metal(tomato, 0.2) → the token right after "metal ("
  if (property === "material") {
    return value.map((token, i) =>
      isFirstArgument(value, i) ? named(token) : token,
    );
  }
  return value;
}

// Is the token at i the first argument of a material function? metal ( → i
function isFirstArgument(value: Token[], i: number): boolean {
  const fn = value[i - 2];
  const paren = value[i - 1];
  return (
    fn?.type === "IDENT" &&
    MATERIAL_FUNCTIONS.includes(fn.value) &&
    paren?.type === "PUNCT" &&
    paren.value === "("
  );
}

// The token of a color name, as a HASH; any other token comes back unchanged
function named(token: Token): Token {
  if (token.type !== "IDENT") return token;
  const hex = NAMED_COLORS[token.value.toLowerCase()];
  if (!hex) return token;
  const hash: Token = { type: "HASH", value: hex };
  const span = spanAcross(token);
  if (span) rememberSpan(hash, span); // an error underlines the name
  return hash;
}

export function resolveColors(value: Token[]): Token[] {
  if (!value.some((_, i) => isColorCall(value, i))) return value;
  const out: Token[] = [];
  let i = 0;
  while (i < value.length) {
    if (!isColorCall(value, i)) {
      out.push(value[i]);
      i++;
      continue;
    }
    const end = closingParen(value, i + 1);
    const call = value.slice(i, end + 1); // rgb ( … )
    const args = value.slice(i + 2, end); // only what is between the parentheses
    const name = (value[i] as { value: string }).value;
    const [r, g, b] = name.startsWith("rgb")
      ? readRgb(args, call)
      : readHsl(args, call);

    out.push(toHash(r, g, b, call));
    i = end + 1;
  }
  return out;
}

function isColorCall(value: Token[], i: number): boolean {
  if (value[i + 1]?.type !== "PUNCT" || value[i + 1].value !== "(")
    return false;
  if (value[i].type !== "IDENT" || !COLOR_FUNCTIONS.includes(value[i].value))
    return false;
  return true;
}

function channelsOf(args: Token[], call: Token[], example: string): Token[] {
  const name = (call[0] as { value: string }).value;
  // 1. and 2. and 3. of readRgb, moved here: the message uses `name` and `example`

  // 1. A "/" means an alpha: GSS has none
  if (args.some((t) => t.type === "PUNCT" && t.value === "/")) {
    throw errorAt(
      call,
      "GSS has no transparency yet: remove the alpha after the /",
    );
  }
  // 2. The commas of the old syntax change nothing: drop them
  const channels = args.filter((t) => t.type !== "PUNCT" || t.value !== ",");
  // 3. Exactly three channels
  if (channels.length !== 3) {
    throw errorAt(call, `${name}() expects three channels, like: ${example}`);
  }

  return channels;
}

// "255 90 54", "255, 90, 54" or "100% 35% 21%" → [255, 90, 54]
function readRgb(args: Token[], call: Token[]): number[] {
  const channels = channelsOf(args, call, "rgb(255 90 54)");

  // 4. A number (0 to 255) or a percentage (100% = 255), kept between 0 and 255
  return channels.map((t) => {
    if (t.type === "NUMBER") return clamp(t.value);
    if (t.type === "PERCENTAGE") return clamp((t.value * 255) / 100);
    throw errorAt(
      call,
      "rgb() expects numbers or percentages, like: rgb(255 90 54)",
    );
  });
}

function readHsl(args: Token[], call: Token[]): number[] {
  const [h, s, l] = channelsOf(args, call, "hsl(20 100% 60%)");
  const hue = readHue(h, call);
  const unit = (n: number) => Math.min(Math.max(n, 0), 1);
  const saturation = unit(percentOf(s, call));
  const lightness = unit(percentOf(l, call));
  return hslToRgb(hue, saturation, lightness);
}

// 90, 90deg, 1.57rad, 0.25turn → 90, always between 0 and 360
function readHue(token: Token, call: Token[]): number {
  let degrees: number;
  if (token.type === "NUMBER") degrees = token.value;
  else if (token.type === "DIMENSION" && token.unit === "deg")
    degrees = token.value;
  else if (token.type === "DIMENSION" && token.unit === "rad")
    degrees = (token.value * 180) / Math.PI;
  else if (token.type === "DIMENSION" && token.unit === "turn")
    degrees = token.value * 360;
  else
    throw errorAt(
      call,
      "hsl() expects a hue in deg, rad, turn or a number, like: hsl(20 100% 60%)",
    );
  return ((degrees % 360) + 360) % 360; // -120 must give 240, and 480 must give 120
}

// The formula of CSS Color 4: h in degrees, s and l between 0 and 1 → [r, g, b] from 0 to 255
function hslToRgb(h: number, s: number, l: number): number[] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)].map((c) => c * 255);
}

const clamp = (n: number) => Math.min(Math.max(n, 0), 255);

// [255, 90, 54] → the token #ff5a36, placed where the call was
function toHash(r: number, g: number, b: number, call: Token[]): Token {
  const hex = [r, g, b]
    .map((c) => Math.round(c).toString(16).padStart(2, "0"))
    .join("");
  const token: Token = { type: "HASH", value: hex };
  const span = spanAcross(call);
  if (span) rememberSpan(token, span); // an error about it underlines rgb(…)
  return token;
}

function percentOf(token: Token, call: Token[]): number {
  if (token.type === "NUMBER" || token.type === "PERCENTAGE")
    return token.value / 100;
  throw errorAt(
    call,
    "hsl() expects percentages for the saturation and the lightness",
  );
}
