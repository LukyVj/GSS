// The color functions and the named colors of CSS, turned into #rrggbb at compile time
// (decisions 58 and 79): rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch(), color(),
// color-mix(), light-dark(), contrast-color().
// Like calc.ts and vars.ts: the rest of the compiler only ever sees a HASH token.
import type { Token } from "../syntax/tokenizer";
import { errorAt, rememberSpan, spanAcross } from "../syntax/errors";
import { closingParen } from "./calc";
import { NAMED_COLORS } from "./named-colors";
import {
  type Rgb,
  fromLinear,
  fromPolar,
  hslToRgb,
  hwbToRgb,
  labToRgb,
  luminance,
  oklabToRgb,
  p3ToRgb,
  rgbToHsl,
  rgbToHwb,
  rgbToLab,
  rgbToOklab,
  toLinear,
  toPolar,
  xyzD50ToRgb,
  xyzToRgb,
} from "./color-spaces";

export const COLOR_FUNCTIONS = [
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
  "color-mix",
  "light-dark",
  "contrast-color",
];
// light-dark() picks its color from the color scheme of the page: a scene that uses it gets
// one version per scheme, like @media (prefers-color-scheme: dark) (decisions 71 and 79)
export type ColorScheme = "light" | "dark";
export const DARK_QUERY = "(prefers-color-scheme: dark)";
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

export function resolveColors(
  value: Token[],
  scheme: ColorScheme = "light",
): Token[] {
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
    out.push(toHash(readCall(name, args, call, scheme), call));
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

// One call → its color in sRGB, from 0 to 1
function readCall(
  name: string,
  args: Token[],
  call: Token[],
  scheme: ColorScheme,
): Rgb {
  switch (name) {
    case "rgb":
    case "rgba":
      return readRgb(args, call);
    case "hsl":
    case "hsla":
      return readHsl(args, call);
    case "hwb": {
      const [h, w, b] = channelsOf(args, call, "hwb(20 10% 20%)");
      return hwbToRgb(readHue(h, call), unit(percentOf(w, call)), unit(percentOf(b, call)));
    }
    case "lab": {
      const [l, a, b] = channelsOf(args, call, "lab(60 50 40)");
      return labToRgb([
        bound(scaled(l, 100, call), 0, 100),
        scaled(a, 125, call),
        scaled(b, 125, call),
      ]);
    }
    case "lch": {
      const [l, c, h] = channelsOf(args, call, "lch(60 60 40)");
      return labToRgb(
        fromPolar([
          bound(scaled(l, 100, call), 0, 100),
          Math.max(scaled(c, 150, call), 0),
          readHue(h, call),
        ]),
      );
    }
    case "oklab": {
      const [l, a, b] = channelsOf(args, call, "oklab(0.7 0.15 0.1)");
      return oklabToRgb([
        bound(scaled(l, 1, call), 0, 1),
        scaled(a, 0.4, call),
        scaled(b, 0.4, call),
      ]);
    }
    case "oklch": {
      const [l, c, h] = channelsOf(args, call, "oklch(70% 0.15 30)");
      return oklabToRgb(
        fromPolar([
          bound(scaled(l, 1, call), 0, 1),
          Math.max(scaled(c, 0.4, call), 0),
          readHue(h, call),
        ]),
      );
    }
    case "color":
      return readColorFunction(args, call);
    case "color-mix":
      return readColorMix(args, call, scheme);
    case "light-dark": {
      const colors = colorArguments(args, call, scheme, "light-dark(#fff, #111)");
      if (colors.length !== 2)
        throw errorAt(call, "light-dark() takes two colors, like: light-dark(#fff, #111)");
      return readColorToken(colors[scheme === "dark" ? 1 : 0], call);
    }
    case "contrast-color": {
      const colors = colorArguments(args, call, scheme, "contrast-color(#3a7bff)");
      if (colors.length !== 1)
        throw errorAt(call, "contrast-color() takes one color, like: contrast-color(#3a7bff)");
      // White or black, whichever contrasts most (WCAG 2); white when they tie
      const y = luminance(readColorToken(colors[0], call));
      return 1.05 / (y + 0.05) >= (y + 0.05) / 0.05 ? [1, 1, 1] : [0, 0, 0];
    }
  }
  throw errorAt(call, `${name}() is not a color function`);
}

function channelsOf(args: Token[], call: Token[], example: string): Token[] {
  const name = (call[0] as { value: string }).value;

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

// "255 90 54", "255, 90, 54" or "100% 35% 21%" → [1, 0.35, 0.21]
function readRgb(args: Token[], call: Token[]): Rgb {
  const channels = channelsOf(args, call, "rgb(255 90 54)");

  // A number (0 to 255) or a percentage (100% = 255), kept between 0 and 255
  return channels.map((t) => {
    if (t.type === "NUMBER") return bound(t.value, 0, 255) / 255;
    if (t.type === "PERCENTAGE") return bound(t.value, 0, 100) / 100;
    throw errorAt(
      call,
      "rgb() expects numbers or percentages, like: rgb(255 90 54)",
    );
  }) as Rgb;
}

function readHsl(args: Token[], call: Token[]): Rgb {
  const [h, s, l] = channelsOf(args, call, "hsl(20 100% 60%)");
  return hslToRgb(readHue(h, call), unit(percentOf(s, call)), unit(percentOf(l, call)));
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
  else {
    const name = (call[0] as { value: string }).value;
    throw errorAt(
      call,
      `${name}() expects a hue in deg, rad, turn or a number, like: ${name === "hsl" ? "hsl(20 100% 60%)" : `${name}(… 30deg)`}`,
    );
  }
  return ((degrees % 360) + 360) % 360; // -120 must give 240, and 480 must give 120
}

// A number, or a percentage of `full`: lab(50% …) is lab(50 …), oklch(… 50% …) a chroma of 0.2
function scaled(token: Token, full: number, call: Token[]): number {
  if (token.type === "NUMBER") return token.value;
  if (token.type === "PERCENTAGE") return (token.value / 100) * full;
  const name = (call[0] as { value: string }).value;
  throw errorAt(call, `${name}() expects numbers or percentages`);
}

const bound = (n: number, low: number, high: number) =>
  Math.min(Math.max(n, low), high);
const unit = (n: number) => bound(n, 0, 1);

function percentOf(token: Token, call: Token[]): number {
  if (token.type === "NUMBER" || token.type === "PERCENTAGE")
    return token.value / 100;
  const name = (call[0] as { value: string }).value;
  throw errorAt(
    call,
    name.startsWith("hsl")
      ? "hsl() expects percentages for the saturation and the lightness"
      : `${name}() expects percentages for the whiteness and the blackness`,
  );
}

// color(display-p3 1 0.4 0.2): a space, then three channels from 0 to 1 (or percentages)
const COLOR_SPACES: Record<string, (c: Rgb) => Rgb> = {
  srgb: (c) => c,
  "srgb-linear": (c) => fromLinear(c),
  "display-p3": p3ToRgb,
  xyz: xyzToRgb,
  "xyz-d65": xyzToRgb,
  "xyz-d50": xyzD50ToRgb,
};

function readColorFunction(args: Token[], call: Token[]): Rgb {
  const [space, ...rest] = args;
  const example = "color(display-p3 1 0.4 0.2)";
  if (space?.type !== "IDENT" || !(space.value in COLOR_SPACES)) {
    throw errorAt(
      call,
      `color() starts with a color space (${Object.keys(COLOR_SPACES).join(", ")}), like: ${example}`,
    );
  }
  const channels = channelsOf(rest, call, example).map((t) => scaled(t, 1, call));
  return COLOR_SPACES[space.value](channels as Rgb);
}

// ----- Colors as arguments: color-mix(), light-dark(), contrast-color() -----

// The arguments, split at their commas, with the color functions inside already computed
function colorArguments(
  args: Token[],
  call: Token[],
  scheme: ColorScheme,
  example: string,
): Token[][] {
  const resolved = resolveColors(args, scheme);
  const parts: Token[][] = [[]];
  for (const token of resolved) {
    if (token.type === "PUNCT" && token.value === ",") parts.push([]);
    else parts[parts.length - 1].push(token);
  }
  if (parts.some((part) => part.length === 0)) {
    const name = (call[0] as { value: string }).value;
    throw errorAt(call, `${name}() is missing a value, like: ${example}`);
  }
  return parts;
}

// A single token: a hex color or a name
function readColorToken(part: Token[], call: Token[]): Rgb {
  const [token] = part;
  const name = (call[0] as { value: string }).value;
  const hex =
    part.length !== 1
      ? undefined
      : token.type === "HASH"
        ? token.value
        : token.type === "IDENT"
          ? NAMED_COLORS[token.value.toLowerCase()]
          : undefined;
  if (!hex || !/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
    throw errorAt(call, `${name}() expects colors: a hex color, a name or a color function`);
  }
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as Rgb;
}

// The spaces color-mix() can mix in: to the space and back, and where the hue is, if any
type Space = {
  to: (rgb: Rgb) => [number, number, number];
  from: (c: [number, number, number]) => Rgb;
  hue?: number;
};
const MIX_SPACES: Record<string, Space> = {
  srgb: { to: (c) => c, from: (c) => c },
  "srgb-linear": { to: toLinear, from: fromLinear },
  oklab: { to: rgbToOklab, from: oklabToRgb },
  oklch: {
    to: (c) => toPolar(rgbToOklab(c), 1e-4),
    from: (c) => oklabToRgb(fromPolar(c)),
    hue: 2,
  },
  lab: { to: rgbToLab, from: labToRgb },
  lch: {
    to: (c) => toPolar(rgbToLab(c), 1e-2),
    from: (c) => labToRgb(fromPolar(c)),
    hue: 2,
  },
  hsl: {
    to: (c) => {
      const [h, s, l] = rgbToHsl(c);
      return [s === 0 ? NaN : h, s, l];
    },
    from: ([h, s, l]) => hslToRgb(h, s, l),
    hue: 0,
  },
  hwb: {
    to: (c) => {
      const [h, w, b] = rgbToHwb(c);
      return [w + b >= 1 ? NaN : h, w, b];
    },
    from: ([h, w, b]) => hwbToRgb(h, w, b),
    hue: 0,
  },
};

// color-mix(in oklch, tomato 30%, #3a7bff): two colors mixed in a space, like CSS
function readColorMix(args: Token[], call: Token[], scheme: ColorScheme): Rgb {
  const example = "color-mix(in oklch, tomato 30%, #3a7bff)";
  const [method, ...colors] = colorArguments(args, call, scheme, example);
  const [keyword, space, ...hue] = method;
  if (
    keyword?.type !== "IDENT" ||
    keyword.value !== "in" ||
    space?.type !== "IDENT" ||
    !(space.value in MIX_SPACES)
  ) {
    throw errorAt(
      call,
      `color-mix() starts with "in" and a color space (${Object.keys(MIX_SPACES).join(", ")}), like: ${example}`,
    );
  }
  const mix = MIX_SPACES[space.value];
  const hueMethod = hue.map((t) => (t as { value: unknown }).value).join(" ");
  if (hue.length > 0 && (mix.hue === undefined || !["shorter hue", "longer hue"].includes(hueMethod))) {
    throw errorAt(call, `color-mix() takes "shorter hue" or "longer hue", in a space with a hue (hsl, hwb, lch, oklch)`);
  }
  if (colors.length !== 2) {
    throw errorAt(call, `color-mix() mixes two colors, like: ${example}`);
  }

  // Each color, with its percentage before or after it
  const read = colors.map((part) => {
    const percentages = part.filter((t) => t.type === "PERCENTAGE");
    const color = part.filter((t) => t.type !== "PERCENTAGE");
    if (percentages.length > 1) throw errorAt(call, "color-mix() takes one percentage per color");
    const p = percentages[0] as { value: number } | undefined;
    if (p && (p.value < 0 || p.value > 100))
      throw errorAt(call, "color-mix() takes percentages from 0% to 100%");
    return { rgb: readColorToken(color, call), p: p?.value };
  });

  // The percentages, like CSS: one missing is the rest of 100%, both missing is 50% each
  let [p1, p2] = read.map((c) => c.p);
  if (p1 === undefined && p2 === undefined) p1 = p2 = 50;
  else if (p1 === undefined) p1 = 100 - p2!;
  else if (p2 === undefined) p2 = 100 - p1;
  const sum = p1 + p2!;
  if (sum === 0) throw errorAt(call, "color-mix() needs percentages that do not add up to 0%");
  if (sum < 100) throw errorAt(call, "GSS has no transparency yet: the percentages of color-mix() must add up to 100% or more");
  const t = p2! / sum; // the share of the second color

  const [a, b] = read.map((c) => mix.to(c.rgb));
  const mixed = a.map((x, i) => {
    let y = b[i];
    let from = x;
    if (i === mix.hue) {
      // A gray has no hue: it takes the hue of the other color
      if (Number.isNaN(from) && Number.isNaN(y)) return 0;
      if (Number.isNaN(from)) from = y;
      if (Number.isNaN(y)) y = from;
      let delta = y - from;
      if (hueMethod === "longer hue") {
        if (delta > 0 && delta < 180) delta -= 360;
        else if (delta > -180 && delta <= 0) delta += 360;
      } else if (delta > 180) delta -= 360;
      else if (delta < -180) delta += 360;
      return (((from + delta * t) % 360) + 360) % 360;
    }
    return from + (y - from) * t;
  }) as [number, number, number];
  return mix.from(mixed);
}

// [1, 0.35, 0.21] → the token #ff5a36, placed where the call was. A color outside sRGB is
// clipped to it.
function toHash(rgb: Rgb, call: Token[]): Token {
  const hex = rgb
    .map((c) => Math.round(unit(c) * 255).toString(16).padStart(2, "0"))
    .join("");
  const token: Token = { type: "HASH", value: hex };
  const span = spanAcross(call);
  if (span) rememberSpan(token, span); // an error about it underlines rgb(…)
  return token;
}
