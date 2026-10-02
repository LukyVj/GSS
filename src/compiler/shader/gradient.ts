// Gradients, like CSS: linear-gradient(), radial-gradient(), conic-gradient() and their
// repeating- forms (decisions 81, 82 and 98). The geometry is CSS's, over a rectangle `size`, at a point `at`
// measured from its bottom left corner:
// - the background: the rectangle is the canvas, and `at` is where the ray points, seen
//   through the camera (a primary ray lands on its own pixel, a reflection where it goes);
// - an object: the rectangle is the object seen from the front (from above for a plane),
//   and `at` the point that was hit, in the object's space.
// Colors are mixed in sRGB, like CSS with hex colors.
import type { Token } from "../syntax/tokenizer";
import { errorAt } from "../syntax/errors";
import { readFunction } from "../values/values";
import { NAMED_COLORS } from "../values/named-colors";

export const GRADIENT_FUNCTIONS = [
  "linear-gradient",
  "radial-gradient",
  "repeating-linear-gradient",
  "repeating-radial-gradient",
  "conic-gradient",
  "repeating-conic-gradient",
];

type Stop = { color: string; at: number | null };

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${+n.toFixed(6)}`);
const isWord = (t: Token | undefined, ...words: string[]) =>
  t?.type === "IDENT" && words.includes(t.value);

export function isGradient(value: Token[] | undefined): value is Token[] {
  const call = value && readFunction(value);
  return !!call && GRADIENT_FUNCTIONS.includes(call.name);
}

// The GLSL of the background: a function of the ray's direction, and BACKGROUND that calls it
export function backgroundFunction(value: Token[]): string {
  return [
    "// The camera, for the background: set at the start of main()",
    "vec3 camForward;",
    "vec3 camRight;",
    "vec3 camUp;",
    "",
    "// The background: a gradient over the canvas, like a CSS background. A ray is",
    "// projected through the camera onto the canvas, so a reflection sees the gradient",
    "// where it points, not the pixel it was cast from.",
    "vec3 background(vec3 rd) {",
    "  vec2 size = iResolution.xy;",
    "  vec2 d = vec2(dot(rd, camRight), dot(rd, camUp));",
    "  float z = dot(rd, camForward);",
    "  // Through the camera onto the canvas; a ray going sideways or back reaches its edge",
    "  vec2 at = z > 0.001 ? 1.5 * d / z * size.y + 0.5 * size : 0.5 * size + normalize(d + 1e-6) * 1e4;",
    "  at = clamp(at, vec2(0.0), size); // like CSS, nothing exists outside the box: its edge",
    ...gradientLines(value),
    "  return col;",
    "}",
    "#define BACKGROUND background(rd)",
  ].join("\n");
}

// The color of a gradient written on an object: the color the reflections see
export function gradientMean(value: Token[]): string {
  const call = readFunction(value)!;
  const first = call.args[0];
  const stops = readStops(first && !isColor(first[0]) ? call.args.slice(1) : call.args, value, call.name);
  const rgb = [0, 1, 2].map((i) => {
    const values = stops.map((s) => Number(s.color.slice(5, -1).split(", ")[i]));
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 255);
  });
  return rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
}

// The lines that compute `vec3 col` from `vec2 at` and `vec2 size`
export function gradientLines(value: Token[]): string[] {
  const call = readFunction(value)!;
  const radial = call.name.includes("radial");
  const conic = call.name.includes("conic");
  const repeating = call.name.startsWith("repeating");
  const [first, ...rest] = call.args;
  // The first argument is the direction (or shape) unless it starts with a color
  const hasSetup = first && !isColor(first[0]);
  const setup = hasSetup ? first : [];
  // The setup first: its errors say more than those of the stops it leaves behind
  const t = conic ? conicT(setup, value) : radial ? radialT(setup, value) : linearT(setup, value);
  const stops = readStops(hasSetup ? rest : call.args, value, call.name);

  const lines = [...t];
  const t0 = stops[0].at!;
  const tn = stops[stops.length - 1].at!;
  if (repeating && tn > t0) lines.push(`  t = ${f(t0)} + mod(t - ${f(t0)}, ${f(tn - t0)});`);
  lines.push(`  vec3 col = ${stops[0].color};`);
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1].at!;
    const b = stops[i].at!;
    const weight = b > a ? `clamp((t - ${f(a)}) / ${f(b - a)}, 0.0, 1.0)` : `step(${f(a)}, t)`;
    lines.push(`  col = mix(col, ${stops[i].color}, ${weight});`);
  }
  return lines;
}

function isColor(token: Token | undefined): boolean {
  if (token?.type === "HASH") return true;
  return token?.type === "IDENT" && Object.hasOwn(NAMED_COLORS, token.value.toLowerCase());
}

function colorOf(token: Token, value: Token[]): string {
  const hex =
    token.type === "HASH" ? token.value : NAMED_COLORS[(token as { value: string }).value.toLowerCase()];
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw errorAt(value, `"#${hex}" is not a hex color`);
  const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return `vec3(${rgb.map((c) => f(+c.toFixed(3))).join(", ")})`;
}

// red, #fff 20%, blue 40% 60%: a color, then 0, 1 or 2 positions, completed like CSS
function readStops(args: Token[][], value: Token[], name: string): Stop[] {
  const example = `${name}(#1c1c24, #07070a)`;
  const stops: Stop[] = [];
  for (const arg of args) {
    const [color, ...positions] = arg;
    if (!isColor(color) || positions.length > 2)
      throw errorAt(value, `${name}() expects colors, each with up to two percentages, like: ${example}`);
    // conic-gradient() also places its stops with angles: a full turn is 100%
    const conic = name.includes("conic");
    if (conic && positions.some((p) => p.type !== "PERCENTAGE" && !(p.type === "DIMENSION" && p.unit in TURN)))
      throw errorAt(value, `The positions of ${name}() are angles or percentages, like: #fff 90deg`);
    if (!conic && positions.some((p) => p.type !== "PERCENTAGE"))
      throw errorAt(value, `The positions of ${name}() are percentages, like: #fff 20%`);
    const vec = colorOf(color, value);
    if (positions.length === 0) stops.push({ color: vec, at: null });
    for (const p of positions)
      stops.push({
        color: vec,
        at: p.type === "DIMENSION" ? (p.value * TURN[p.unit]) / (2 * Math.PI) : (p as { value: number }).value / 100,
      });
  }
  if (stops.length < 2) throw errorAt(value, `${name}() needs at least two colors, like: ${example}`);
  // The first stop is at 0%, the last at 100%; a position never goes back; the others spread
  stops[0].at ??= 0;
  stops[stops.length - 1].at ??= 1;
  let largest = -Infinity;
  for (const stop of stops) {
    if (stop.at === null) continue;
    stop.at = Math.max(stop.at, largest);
    largest = stop.at;
  }
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].at !== null) continue;
    let end = i;
    while (stops[end].at === null) end++;
    const from = stops[i - 1].at!;
    const to = stops[end].at!;
    for (let k = i; k < end; k++) stops[k].at = from + ((to - from) * (k - i + 1)) / (end - i + 1);
    i = end;
  }
  return stops;
}

// An angle unit, in radians
const TURN: Record<string, number> = { deg: Math.PI / 180, rad: 1, grad: Math.PI / 200, turn: 2 * Math.PI };

// t around the center: 0 at the start angle, 1 a full turn later, clockwise from the top
// like CSS (CSS Images 4). "from <angle>" turns the start, "at <position>" moves the center.
function conicT(setup: Token[], value: Token[]): string[] {
  const error = (what: string) =>
    errorAt(value, `conic-gradient(): ${what}, like: conic-gradient(from 90deg at 30% 40%, …)`);
  const at = setup.findIndex((t) => isWord(t, "at"));
  const head = at >= 0 ? setup.slice(0, at) : setup;
  const where = at >= 0 ? setup.slice(at + 1) : [];
  let from = 0; // in turns
  if (head.length > 0) {
    const angle = head[1];
    if (!isWord(head[0], "from") || head.length !== 2 || angle.type !== "DIMENSION" || !(angle.unit in TURN))
      throw error("it starts with from <angle>, at <position>, or both");
    from = (angle.value * TURN[angle.unit]) / (2 * Math.PI);
  }
  const [cx, cy] = readPosition(where, at >= 0, error);
  return [
    `  vec2 c = vec2(${f(cx)}, ${f(1 - cy)}) * size;`, // y goes up in the shader
    "  vec2 p = at - c;",
    "  // atan(x, y): 0 straight up, a quarter turn to the right, like CSS",
    `  float t = fract((p.x == 0.0 && p.y == 0.0 ? 0.0 : atan(p.x, p.y)) / 6.2831853${from ? ` - ${f(+from.toFixed(6))}` : ""});`,
  ];
}

// t along the gradient line: 0 at its start, 1 at its end (CSS Images 3)
function linearT(setup: Token[], value: Token[]): string[] {
  const error = () =>
    errorAt(value, "linear-gradient() starts with an angle or a side, like: linear-gradient(to top right, …) or linear-gradient(45deg, …)");
  let dir = "vec2(0.0, -1.0)"; // to bottom, the default (y goes up in the shader)
  if (setup.length === 1 && setup[0].type === "DIMENSION") {
    const turn: Record<string, number> = { deg: Math.PI / 180, rad: 1, turn: 2 * Math.PI };
    const t = setup[0];
    if (!(t.unit in turn)) throw error();
    const a = t.value * turn[t.unit]; // 0deg points up, 90deg right
    dir = `vec2(${f(+Math.sin(a).toFixed(6))}, ${f(+Math.cos(a).toFixed(6))})`;
  } else if (setup.length > 0) {
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
    // A corner: the line is perpendicular to the diagonal between the two other corners
    dir = x && y ? `normalize(vec2(${f(x)} * size.y, ${f(y)} * size.x))` : `vec2(${f(x)}, ${f(y)})`;
  }
  return [
    `  vec2 dir = ${dir};`,
    "  vec2 p = at - 0.5 * size;",
    "  float t = dot(p, dir) / (abs(size.x * dir.x) + abs(size.y * dir.y)) + 0.5;",
  ];
}

// t from the center (0) to the ending shape (1): circle or ellipse, sized like CSS
function radialT(setup: Token[], value: Token[]): string[] {
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

  const [cx, cy] = readPosition(where, at >= 0, error);

  const lines = [
    `  vec2 c = vec2(${f(cx)}, ${f(1 - cy)}) * size;`, // y goes up in the shader
    "  vec2 p = at - c;",
    "  vec2 near = min(c, size - c);",
    "  vec2 far = max(c, size - c);",
  ];
  if (circle) {
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
): [number, number] {
  // The center, from the top left corner, as fractions of the canvas
  let cx = 0.5;
  let cy = 0.5;
  const fraction = (t: Token, axis: "x" | "y"): number => {
    if (t.type === "PERCENTAGE") return t.value / 100;
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
