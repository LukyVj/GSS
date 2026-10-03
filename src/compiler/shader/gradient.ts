// Gradients, like CSS: linear-gradient(), radial-gradient(), conic-gradient() and their
// repeating- forms (decisions 81, 82 and 98). The geometry is CSS's, over a rectangle `size`, at a point `at`
// measured from its bottom left corner:
// - the background: the rectangle is the canvas, and `at` is where the ray points, seen
//   through the camera (a primary ray lands on its own pixel, a reflection where it goes);
// - an object: the rectangle is the object seen from the front (from above for a plane),
//   and `at` the point that was hit, in the object's space.
// Colors are mixed in sRGB, like CSS with hex colors.
// noise() places its colors the same way, at the value of a 3D noise instead of a position
// in the rectangle (decision 111): the point of the object's space, or the direction of a
// ray in the background.
import type { Token } from "../syntax/tokenizer";
import { errorAt } from "../syntax/errors";
import { readFunction } from "../values/values";
import { NAMED_COLORS } from "../values/named-colors";
import { add, div, isLive, largest, mul, sub, type Num } from "./codegen/live";

export const GRADIENT_FUNCTIONS = [
  "linear-gradient",
  "radial-gradient",
  "repeating-linear-gradient",
  "repeating-radial-gradient",
  "conic-gradient",
  "repeating-conic-gradient",
  "noise",
];

// A number of a gradient can be GLSL: a variable set from JS (decision 105)
type Stop = { color: string; at: Num | null };

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${+n.toFixed(6)}`);
const isWord = (t: Token | undefined, ...words: string[]) =>
  t?.type === "IDENT" && words.includes(t.value);

export function isGradient(value: Token[] | undefined): value is Token[] {
  if (value && hasTopComma(value)) return false; // several layers of background (decision 112)
  const call = value && readFunction(value);
  return !!call && GRADIENT_FUNCTIONS.includes(call.name);
}

// A comma outside any parentheses: a list, like the layers of a background
function hasTopComma(value: Token[]): boolean {
  let depth = 0;
  for (const token of value) {
    if (token.type !== "PUNCT") continue;
    if (token.value === "(") depth++;
    else if (token.value === ")") depth--;
    else if (token.value === "," && depth === 0) return true;
  }
  return false;
}

// The GLSL of the background: a function of the ray's direction, and BACKGROUND that calls it.
// moving: the numbers an animation of the scene changes (decision 103)
export function backgroundFunction(gradient: Gradient, moving: Map<string, string> = new Map()): string {
  return [
    ...BACKGROUND_CAMERA,
    "",
    "// The background: a gradient over the canvas, like a CSS background. A ray is",
    "// projected through the camera onto the canvas, so a reflection sees the gradient",
    "// where it points, not the pixel it was cast from.",
    "vec3 background(vec3 rd) {",
    ...BACKGROUND_CANVAS,
    ...linesOf(gradient, moving, "rd"),
    "  return col;",
    "}",
    "#define BACKGROUND background(rd)",
  ].join("\n");
}

// The camera, for a background drawn over the canvas: set at the start of main()
export const BACKGROUND_CAMERA = [
  "// The camera, for the background: set at the start of main()",
  "vec3 camForward;",
  "vec3 camRight;",
  "vec3 camUp;",
];

// The first lines of background(): where the ray lands on the canvas (at), and its size
export const BACKGROUND_CANVAS = [
  "  vec2 size = iResolution.xy;",
  "  vec2 d = vec2(dot(rd, camRight), dot(rd, camUp));",
  "  float z = dot(rd, camForward);",
  "  // Through the camera onto the canvas; a ray going sideways or back reaches its edge",
  "  vec2 at = z > 0.001 ? 1.5 * d / z * size.y + 0.5 * size : 0.5 * size + normalize(d + 1e-6) * 1e4;",
  "  at = clamp(at, vec2(0.0), size); // like CSS, nothing exists outside the box: its edge",
];

// The color of a gradient written on an object: the color the reflections see
export function gradientMean(value: Token[]): string {
  const { stops } = readGradient(value);
  const rgb = [0, 1, 2].map((i) => {
    // a color set from JS counts as a gray: its mean is not known (decision 105)
    const values = stops.map((s) => (s.color.startsWith("vec3(") ? Number(s.color.slice(5, -1).split(", ")[i]) : 0.5));
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 255);
  });
  return rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
}

// A gradient read into its numbers: what an animation can change (decision 102)
export type Gradient = {
  name: string; // linear-gradient, repeating-radial-gradient…
  shape: string; // radial: circle or ellipse, and its size; an animation cannot change it
  // linear: an angle in radians, or a side or corner; GLSL in radians when set from JS (decision 105)
  direction: number | { x: number; y: number } | string;
  center: [Num, Num]; // radial, conic: from the top left corner, fractions of the box
  from: Num; // conic: the start angle, in turns
  stops: { color: string; at: Num }[];
  // noise() (decision 111): kind, octaves and seed cannot change; scale and offset can
  noise?: { turbulence: boolean; scale: Num; octaves: number; seed: number; offset: [Num, Num, Num] };
  // A layer of background or a mask-image (decisions 112, 113): its colors can be transparent,
  // and it gives a premultiplied vec4, like CSS mixes the stops of a gradient
  alpha?: boolean;
};

// alpha: a layer of background or a mask-image, whose colors can be transparent (decisions 112, 113)
export function readGradient(value: Token[], alpha = false): Gradient {
  const call = readFunction(value)!;
  const radial = call.name.includes("radial");
  const conic = call.name.includes("conic");
  const noise = call.name === "noise";
  const [first, ...rest] = call.args;
  // The first argument is the direction (or shape) unless it starts with a color
  const hasSetup = first && !isColor(first[0]);
  const setup = hasSetup ? first : [];
  const gradient: Gradient = { name: call.name, shape: "", direction: Math.PI, center: [0.5, 0.5], from: 0, stops: [] };
  // The setup first: its errors say more than those of the stops it leaves behind
  if (noise) {
    gradient.noise = readNoise(setup, value);
    const { turbulence, octaves, seed } = gradient.noise;
    gradient.shape = `${turbulence ? "turbulence" : "fractal"}, ${octaves} octaves, seed ${seed}`;
  } else if (conic) Object.assign(gradient, readConic(setup, value));
  else if (radial) Object.assign(gradient, readRadial(setup, value));
  else gradient.direction = readLinear(setup, value);
  gradient.stops = readStops(hasSetup ? rest : call.args, value, call.name, alpha) as Gradient["stops"];
  if (alpha) gradient.alpha = true;
  return gradient;
}

// The numbers of a gradient that can change, each with a name: angle, cx, cy, from, at0…, color0…
export function channels(gradient: Gradient): string[] {
  if (gradient.noise) return ["scale", "ox", "oy", "oz", ...gradient.stops.flatMap((_, i) => [`at${i}`, `color${i}`])];
  const kind = gradient.name.includes("conic") ? "conic" : gradient.name.includes("radial") ? "radial" : "linear";
  return [
    ...(kind === "linear" ? ["angle"] : ["cx", "cy"]),
    ...(kind === "conic" ? ["from"] : []),
    ...gradient.stops.flatMap((_, i) => [`at${i}`, `color${i}`]),
  ];
}

// A number of a gradient that a variable set from JS gives (decision 105): written in
// GLSL like a number an animation moves
function fromJs(gradient: Gradient, name: string): boolean {
  if (name === "scale") return isLive(gradient.noise!.scale);
  if (name === "ox" || name === "oy" || name === "oz") return isLive(gradient.noise!.offset["xyz".indexOf(name[1])]);
  if (name === "angle") return typeof gradient.direction === "string";
  if (name === "cx" || name === "cy") return isLive(gradient.center[name === "cx" ? 0 : 1]);
  if (name === "from") return isLive(gradient.from);
  if (name.startsWith("at")) return isLive(gradient.stops[Number(name.slice(2))].at);
  return false;
}

// A number of a gradient in GLSL: f() for a number, its code for GLSL
const code = (n: Num, short = false) => (isLive(n) ? n : f(short ? +n.toFixed(6) : n));

// One number of a gradient, in GLSL
export function channel(gradient: Gradient, name: string): string {
  if (name === "angle") {
    const d = gradient.direction;
    if (typeof d === "string") return d;
    if (typeof d === "number") return f(+d.toFixed(6));
    // A corner depends on the size of the box: the angle of its direction
    if (d.x && d.y) return `atan(${f(d.x)} * size.y, ${f(d.y)} * size.x)`;
    // A side, like CSS: to top 0deg, to right 90deg, to bottom 180deg, to left 270deg
    return f(+(d.x ? (d.x > 0 ? Math.PI / 2 : (3 * Math.PI) / 2) : d.y > 0 ? 0 : Math.PI).toFixed(6));
  }
  if (name === "scale") return code(gradient.noise!.scale);
  if (name === "ox" || name === "oy" || name === "oz") return code(gradient.noise!.offset["xyz".indexOf(name[1])]);
  if (name === "cx") return code(gradient.center[0]);
  if (name === "cy") return code(sub(1, gradient.center[1])); // y goes up in the shader
  if (name === "from") return code(gradient.from, true);
  const stop = gradient.stops[Number(name.replace(/\D+/, ""))];
  if (name.startsWith("at")) return code(stop.at);
  return gradient.alpha ? opaque4(stop.color) : stop.color;
}

// A color of a layer as a premultiplied vec4: vec3(1.0, 0.0, 0.0) → vec4(1.0, 0.0, 0.0, 1.0)
function opaque4(color: string): string {
  if (color.startsWith("vec4(")) return color;
  const inside = color.match(/^vec3\((.*)\)$/)?.[1];
  return inside !== undefined && !inside.includes("(") ? `vec4(${inside}, 1.0)` : `vec4(${color}, 1.0)`;
}

// The lines that compute `vec3 col` from `vec2 at` and `vec2 size`
export function gradientLines(value: Token[]): string[] {
  return linesOf(readGradient(value));
}

// The lines of a gradient. moving: the GLSL of the numbers an animation or :hover changes
// (decision 102); the others are written as constants, like a still gradient.
// point: where a noise() is read, the point of the object's space or the direction of the ray.
export function linesOf(gradient: Gradient, moving: Map<string, string> = new Map(), point = "q"): string[] {
  const { name, stops } = gradient;
  const radial = name.includes("radial");
  const conic = name.includes("conic");
  const repeating = name.startsWith("repeating");
  const get = (key: string) => moving.get(key) ?? channel(gradient, key);
  // Moved by an animation or :hover, or set from JS: written in GLSL, never as a constant
  const moves = (key: string) => moving.has(key) || fromJs(gradient, key);

  const lines = gradient.noise
    ? noiseT(gradient, moves, get, point)
    : conic
      ? conicT(gradient, moves, get)
      : radial
        ? radialT(gradient, get)
        : linearT(gradient, moves, get);
  const last = stops.length - 1;
  const t0 = stops[0].at as number;
  const tn = stops[last].at as number;
  if (repeating && (moves("at0") || moves(`at${last}`)))
    lines.push(`  t = ${get("at0")} + mod(t - ${get("at0")}, max(${get(`at${last}`)} - ${get("at0")}, 0.00001));`);
  else if (repeating && tn > t0) lines.push(`  t = ${f(t0)} + mod(t - ${f(t0)}, ${f(tn - t0)});`);
  lines.push(`  ${gradient.alpha ? "vec4" : "vec3"} col = ${get("color0")};`);
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1].at as number;
    const b = stops[i].at as number;
    const weight =
      moves(`at${i - 1}`) || moves(`at${i}`)
        ? `clamp((t - ${get(`at${i - 1}`)}) / max(${get(`at${i}`)} - ${get(`at${i - 1}`)}, 0.00001), 0.0, 1.0)`
        : b > a
          ? `clamp((t - ${f(a)}) / ${f(b - a)}, 0.0, 1.0)`
          : `step(${f(a)}, t)`;
    lines.push(`  col = mix(col, ${get(`color${i}`)}, ${weight});`);
  }
  return lines;
}

function isColor(token: Token | undefined): boolean {
  if (token?.type === "HASH") return true;
  if (token?.type === "EXPR") return token.syntax === "color"; // set from JS (decision 105)
  if (token?.type === "IDENT" && token.value.toLowerCase() === "transparent") return true;
  return token?.type === "IDENT" && Object.hasOwn(NAMED_COLORS, token.value.toLowerCase());
}

// A color in GLSL: vec3, or a premultiplied vec4 when it is transparent, which only a
// layer of background or a mask-image takes (alpha, decisions 112, 113)
function colorOf(token: Token, value: Token[], alpha = false): string {
  if (token.type === "EXPR") return token.code;
  const word = (token as { value: string }).value.toLowerCase();
  const hex = token.type === "HASH" ? token.value : word === "transparent" ? "00000000" : NAMED_COLORS[word];
  // #rgb, #rgba: each digit twice
  const full = hex.length === 3 || hex.length === 4 ? [...hex].map((c) => c + c).join("") : hex;
  if (!/^([0-9a-f]{6}|[0-9a-f]{8})$/i.test(full)) throw errorAt(value, `"#${hex}" is not a hex color`);
  const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
  if (a === 1) return `vec3(${rgb.map((c) => f(+c.toFixed(3))).join(", ")})`;
  if (!alpha) throw errorAt(value, "GSS has no transparency yet, except in background and mask-image: write opaque colors here");
  return `vec4(${[...rgb.map((c) => c * a), a].map((c) => f(+c.toFixed(3))).join(", ")})`;
}

// red, #fff 20%, blue 40% 60%: a color, then 0, 1 or 2 positions, completed like CSS
function readStops(args: Token[][], value: Token[], name: string, alpha = false): Stop[] {
  const example = name === "noise" ? "noise(4, #1c1c24, #07070a)" : `${name}(#1c1c24, #07070a)`;
  const stops: Stop[] = [];
  for (const arg of args) {
    const [color, ...positions] = arg;
    if (!isColor(color) || positions.length > 2)
      throw errorAt(value, `${name}() expects colors, each with up to two percentages, like: ${example}`);
    // conic-gradient() also places its stops with angles: a full turn is 100%
    const conic = name.includes("conic");
    // A position set from JS (decision 105): a percentage, or an angle on a conic gradient
    const percent = (p: Token) => p.type === "PERCENTAGE" || (p.type === "EXPR" && p.syntax === "percentage");
    const angle = (p: Token) => (p.type === "DIMENSION" && p.unit in TURN) || (p.type === "EXPR" && p.syntax === "angle");
    if (conic && positions.some((p) => !percent(p) && !angle(p)))
      throw errorAt(value, `The positions of ${name}() are angles or percentages, like: #fff 90deg`);
    if (!conic && positions.some((p) => !percent(p)))
      throw errorAt(value, `The positions of ${name}() are percentages, like: #fff 20%`);
    const vec = colorOf(color, value, alpha);
    if (positions.length === 0) stops.push({ color: vec, at: null });
    for (const p of positions)
      stops.push({
        color: vec,
        at:
          p.type === "EXPR"
            ? p.syntax === "angle"
              ? `(${p.code} / 6.2831853)`
              : `(${p.code} / 100.0)`
            : p.type === "DIMENSION"
              ? (p.value * TURN[p.unit]) / (2 * Math.PI)
              : (p as { value: number }).value / 100,
      });
  }
  if (stops.length < 2) throw errorAt(value, `${name}() needs at least two colors, like: ${example}`);
  // The first stop is at 0%, the last at 100%; a position never goes back; the others spread
  stops[0].at ??= 0;
  stops[stops.length - 1].at ??= 1;
  let before: Num = -Infinity;
  for (const stop of stops) {
    if (stop.at === null) continue;
    stop.at = before === -Infinity ? stop.at : largest(stop.at, before);
    before = stop.at;
  }
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].at !== null) continue;
    let end = i;
    while (stops[end].at === null) end++;
    const from = stops[i - 1].at!;
    const to = stops[end].at!;
    for (let k = i; k < end; k++) stops[k].at = add(from, div(mul(sub(to, from), k - i + 1), end - i + 1));
    i = end;
  }
  return stops;
}

// noise() (decision 111): [turbulence] <scale> [<octaves>] [seed <n>] [at <x> <y> <z>].
// The scale is how many patterns fit in a unit; the octaves add finer and finer detail,
// like numOctaves in SVG feTurbulence; turbulence makes sharp creases (type="turbulence");
// seed draws another pattern; at moves it, so an animation of at makes it drift.
const NOISE_ERROR =
  "noise() starts with a scale, then if needed the octaves, turbulence, seed <number> and at <x> <y> <z>, like: noise(4 3, #1a1d2b, #3a7bff)";
function readNoise(setup: Token[], value: Token[]): NonNullable<Gradient["noise"]> {
  const noise: NonNullable<Gradient["noise"]> = { turbulence: false, scale: 1, octaves: 1, seed: 0, offset: [0, 0, 0] };
  let i = 0;
  if (isWord(setup[i], "turbulence")) (noise.turbulence = true), i++;
  // A number, or a variable set from JS (decision 105)
  const number = (t: Token | undefined): Num | null =>
    t?.type === "NUMBER" ? t.value : t?.type === "EXPR" && t.syntax === "number" ? t.code : null;
  const scale = number(setup[i++]);
  if (scale === null || (typeof scale === "number" && scale <= 0)) throw errorAt(value, NOISE_ERROR);
  noise.scale = typeof scale === "number" ? scale : `max(${scale}, 0.0001)`;
  if (setup[i]?.type === "NUMBER") {
    const octaves = (setup[i++] as { value: number }).value;
    if (!Number.isInteger(octaves) || octaves < 1 || octaves > 8)
      throw errorAt(value, "noise() takes octaves from 1 to 8, like: noise(4 3, #1a1d2b, #3a7bff)");
    noise.octaves = octaves;
  }
  while (i < setup.length) {
    if (isWord(setup[i], "turbulence")) (noise.turbulence = true), i++;
    else if (isWord(setup[i], "seed") && setup[i + 1]?.type === "NUMBER" && Number.isInteger((setup[i + 1] as { value: number }).value))
      (noise.seed = (setup[i + 1] as { value: number }).value), (i += 2);
    else if (isWord(setup[i], "at")) {
      const xyz = setup.slice(i + 1, i + 4).map(number);
      if (xyz.length !== 3 || xyz.some((n) => n === null))
        throw errorAt(value, "noise(): at needs three numbers, like: noise(4 at 0 1 0, #1a1d2b, #3a7bff)");
      noise.offset = xyz as [Num, Num, Num];
      i += 4;
    } else throw errorAt(value, NOISE_ERROR);
  }
  return noise;
}

// t from the noise at the point: 0 to 1, the colors placed on it like a gradient's
function noiseT(gradient: Gradient, moves: (key: string) => boolean, get: (key: string) => string, point: string): string[] {
  const { turbulence, octaves, seed, offset } = gradient.noise!;
  const still = !["ox", "oy", "oz"].some(moves) && offset.every((n) => n === 0);
  const at = still ? "vec3(0.0)" : `vec3(${get("ox")}, ${get("oy")}, ${get("oz")})`;
  // Another seed reads the noise far away, where it draws another pattern
  const shift = seed ? ` + vec3(${[37.1, 17.3, 51.9].map((k) => f(+(k * seed).toFixed(3))).join(", ")})` : "";
  return [`  float t = ${turbulence ? "turbulence" : "fractal"}Noise((${point} + ${at}) * ${get("scale")}${shift}, ${octaves});`];
}

// An angle unit, in radians
const TURN: Record<string, number> = { deg: Math.PI / 180, rad: 1, grad: Math.PI / 200, turn: 2 * Math.PI };

// conic-gradient(): "from <angle>" turns the start, "at <position>" moves the center
function readConic(setup: Token[], value: Token[]): Pick<Gradient, "from" | "center"> {
  const error = (what: string) =>
    errorAt(value, `conic-gradient(): ${what}, like: conic-gradient(from 90deg at 30% 40%, …)`);
  const at = setup.findIndex((t) => isWord(t, "at"));
  const head = at >= 0 ? setup.slice(0, at) : setup;
  const where = at >= 0 ? setup.slice(at + 1) : [];
  let from: Num = 0; // in turns
  if (head.length > 0) {
    const angle = head[1];
    const fromJs = angle?.type === "EXPR" && angle.syntax === "angle"; // set from JS (decision 105)
    if (!isWord(head[0], "from") || head.length !== 2 || (!fromJs && (angle.type !== "DIMENSION" || !(angle.unit in TURN))))
      throw error("it starts with from <angle>, at <position>, or both");
    from =
      angle.type === "EXPR"
        ? `(${angle.code} / 6.2831853)`
        : ((angle as { value: number }).value * TURN[(angle as { unit: string }).unit]) / (2 * Math.PI);
  }
  return { from, center: readPosition(where, at >= 0, error) };
}

// t around the center: 0 at the start angle, 1 a full turn later, clockwise from the top
// like CSS (CSS Images 4)
function conicT(gradient: Gradient, moves: (key: string) => boolean, get: (key: string) => string): string[] {
  const from = moves("from") || gradient.from ? ` - ${get("from")}` : "";
  return [
    `  vec2 c = vec2(${get("cx")}, ${get("cy")}) * size;`, // y goes up in the shader
    "  vec2 p = at - c;",
    "  // atan(x, y): 0 straight up, a quarter turn to the right, like CSS",
    `  float t = fract((p.x == 0.0 && p.y == 0.0 ? 0.0 : atan(p.x, p.y)) / 6.2831853${from});`,
  ];
}

// linear-gradient(): an angle, or to a side or a corner (to bottom by default)
function readLinear(setup: Token[], value: Token[]): Gradient["direction"] {
  const error = () =>
    errorAt(value, "linear-gradient() starts with an angle or a side, like: linear-gradient(to top right, …) or linear-gradient(45deg, …)");
  // An angle set from JS (decision 105): its GLSL, in radians
  if (setup.length === 1 && setup[0].type === "EXPR" && setup[0].syntax === "angle") return setup[0].code;
  if (setup.length === 1 && setup[0].type === "DIMENSION") {
    const turn: Record<string, number> = { deg: Math.PI / 180, rad: 1, turn: 2 * Math.PI };
    const t = setup[0];
    if (!(t.unit in turn)) throw error();
    return t.value * turn[t.unit]; // 0deg points up, 90deg right
  }
  if (setup.length === 0) return { x: 0, y: -1 }; // to bottom (y goes up in the shader)
  if (!isWord(setup[0], "to") || setup.length < 2 || setup.length > 3) throw error();
  let x = 0;
  let y = 0;
  for (const side of setup.slice(1)) {
    if (isWord(side, "left") && !x) x = -1;
    else if (isWord(side, "right") && !x) x = 1;
    else if (isWord(side, "top") && !y) y = 1;
    else if (isWord(side, "bottom") && !y) y = -1;
    else throw error();
  }
  return { x, y };
}

// t along the gradient line: 0 at its start, 1 at its end (CSS Images 3)
function linearT(gradient: Gradient, moves: (key: string) => boolean, get: (key: string) => string): string[] {
  const d = gradient.direction;
  const side = typeof d === "object" ? d : { x: 0, y: 0 };
  const dir =
    moves("angle") || typeof d === "string"
      ? `vec2(sin(${get("angle")}), cos(${get("angle")}))` // the angle turns (decision 102), or is set from JS (105)
      : typeof d === "number"
        ? `vec2(${f(+Math.sin(d).toFixed(6))}, ${f(+Math.cos(d).toFixed(6))})`
        : // A corner: the line is perpendicular to the diagonal between the two other corners
          side.x && side.y
          ? `normalize(vec2(${f(side.x)} * size.y, ${f(side.y)} * size.x))`
          : `vec2(${f(side.x)}, ${f(side.y)})`;
  return [
    `  vec2 dir = ${dir};`,
    "  vec2 p = at - 0.5 * size;",
    "  float t = dot(p, dir) / (abs(size.x * dir.x) + abs(size.y * dir.y)) + 0.5;",
  ];
}

// radial-gradient(): circle or ellipse, its size, and "at <position>"
function readRadial(setup: Token[], value: Token[]): Pick<Gradient, "shape" | "center"> {
  const error = (what: string) => errorAt(value, `radial-gradient(): ${what}, like: radial-gradient(circle closest-side at 30% 40%, …)`);
  const at = setup.findIndex((t) => isWord(t, "at"));
  const shapeWords = at >= 0 ? setup.slice(0, at) : setup;
  const where = at >= 0 ? setup.slice(at + 1) : [];
  let circle = false;
  let size = "farthest-corner";
  for (const word of shapeWords) {
    if (isWord(word, "circle", "ellipse")) circle = (word as { value: string }).value === "circle";
    else if (isWord(word, "closest-side", "farthest-side", "closest-corner", "farthest-corner"))
      size = (word as { value: string }).value;
    else throw error("the shape is circle or ellipse, the size a side or corner keyword");
  }
  return { shape: `${circle ? "circle" : "ellipse"} ${size}`, center: readPosition(where, at >= 0, error) };
}

// t from the center (0) to the ending shape (1): circle or ellipse, sized like CSS
function radialT(gradient: Gradient, get: (key: string) => string): string[] {
  const [shape, size] = gradient.shape.split(" ");
  const lines = [
    `  vec2 c = vec2(${get("cx")}, ${get("cy")}) * size;`, // y goes up in the shader
    "  vec2 p = at - c;",
    "  vec2 near = min(c, size - c);",
    "  vec2 far = max(c, size - c);",
  ];
  if (shape === "circle") {
    const r: Record<string, string> = {
      "closest-side": "min(near.x, near.y)",
      "farthest-side": "max(far.x, far.y)",
      "closest-corner": "length(near)",
      "farthest-corner": "length(far)",
    };
    lines.push(`  float t = length(p) / max(${r[size]}, 0.0001);`);
  } else {
    // An ellipse keeps the proportions of its sides; a corner size scales them by √2
    const r: Record<string, string> = {
      "closest-side": "near",
      "farthest-side": "far",
      "closest-corner": "near * 1.41421356",
      "farthest-corner": "far * 1.41421356",
    };
    lines.push(`  float t = length(p / max(${r[size]}, vec2(0.0001)));`);
  }
  return lines;
}

// The center of a radial or conic gradient: "at" and one or two positions, from the
// top left corner, as fractions of the box (CSS <position>)
function readPosition(
  where: Token[],
  written: boolean,
  error: (what: string) => Error,
): [Num, Num] {
  // The center, from the top left corner, as fractions of the canvas
  let cx: Num = 0.5;
  let cy: Num = 0.5;
  const fraction = (t: Token, axis: "x" | "y"): Num => {
    if (t.type === "PERCENTAGE") return t.value / 100;
    if (t.type === "EXPR" && t.syntax === "percentage") return `(${t.code} / 100.0)`; // set from JS (decision 105)
    if (isWord(t, "center")) return 0.5;
    if (axis === "x" && isWord(t, "left")) return 0;
    if (axis === "x" && isWord(t, "right")) return 1;
    if (axis === "y" && isWord(t, "top")) return 0;
    if (axis === "y" && isWord(t, "bottom")) return 1;
    throw error("the position is percentages or left, center, right, top, bottom");
  };
  if (written && (where.length === 0 || where.length > 2)) throw error("at needs one or two positions");
  if (where.length === 1) {
    if (isWord(where[0], "top", "bottom")) cy = fraction(where[0], "y");
    else cx = fraction(where[0], "x");
  } else if (where.length === 2) {
    const swap = isWord(where[0], "top", "bottom") || isWord(where[1], "left", "right");
    cx = fraction(swap ? where[1] : where[0], "x");
    cy = fraction(swap ? where[0] : where[1], "y");
  }

  return [cx, cy];
}
