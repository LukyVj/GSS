// The motion path, like CSS: offset-path, offset-distance, offset-rotate (decision 97).
// The path is in the xy plane of the object, centered on itself and y up, like the path
// shape (decision 35): the same d draws a tube and the way an object follows it.
// Like CSS, the offset comes after translate, the rotations and scale.
import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import type { Styles } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { readFunction, readAngle } from "../../values/values";
import { readSvgPath, type Point } from "../../values/svgpath";
import { glslFloat, round, type Hover } from "./glsl";
import { hoverValue } from "./animation";
import { hoist, type Hoisted } from "./transforms";

type Segment = { a: Point; start: number; length: number; dx: number; dy: number };
export type OffsetPath =
  | { type: "path"; segments: Segment[]; length: number; closed: boolean; reach: number }
  | { type: "ray"; dx: number; dy: number };

const PROPERTIES = ["offset-distance", "offset-rotate"];

// none (or nothing): no motion path
export function readOffsetPath(value: Token[] | undefined): OffsetPath | null {
  if (!value || (value.length === 1 && value[0].type === "IDENT" && value[0].value === "none"))
    return null;
  const call = readFunction(value);
  if (call?.name === "ray") return readRay(call.args, value);
  const [arg] = call?.args ?? [];
  if (call?.name !== "path" || call.args.length !== 1 || arg.length !== 1 || arg[0].type !== "STRING")
    throw errorAt(
      value,
      'offset-path takes path() or ray(), like: offset-path: path("M0 0 C1 2 3 2 4 0");',
    );
  const d = arg[0].value;
  const rough = locate(value, () => readSvgPath(d, Infinity)).flat();
  const xs = rough.map((p) => p.x);
  const ys = rough.map((p) => p.y);
  const size = Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys);
  // Finer than a shape: the motion shows every corner the segments leave
  const lines = locate(value, () => readSvgPath(d, Math.max(size, 1e-6) / 2000));
  // Centered on itself, y up, like the path shape
  const all = lines.flat();
  const cx = (Math.min(...all.map((p) => p.x)) + Math.max(...all.map((p) => p.x))) / 2;
  const cy = (Math.min(...all.map((p) => p.y)) + Math.max(...all.map((p) => p.y))) / 2;
  const scene = (p: Point): Point => ({ x: p.x - cx, y: cy - p.y });

  const segments: Segment[] = [];
  let length = 0;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const [a, b] = [scene(line[i - 1]), scene(line[i])];
      const piece = Math.hypot(b.x - a.x, b.y - a.y);
      if (piece === 0) continue;
      segments.push({ a, start: length, length: piece, dx: (b.x - a.x) / piece, dy: (b.y - a.y) / piece });
      length += piece;
    }
  }
  if (length === 0)
    throw errorAt(value, "offset-path needs a path with a length, like: path(\"M0 0 L4 0\")");
  return {
    type: "path",
    segments,
    length,
    closed: /[zZ]\s*$/.test(d), // like CSS: a path that ends with Z goes round
    reach: Math.max(...all.map((p) => Math.hypot(p.x - cx, p.y - cy))),
  };
}

// ray(<angle>): a straight line from the object's place, 0deg up, clockwise, like CSS
function readRay(args: Token[][], value: Token[]): OffsetPath {
  const [angle] = args;
  if (args.length !== 1 || angle.length !== 1)
    throw errorAt(value, "ray() takes an angle only, like: offset-path: ray(45deg);");
  if (angle[0].type !== "DIMENSION")
    throw errorAt(value, "ray() takes an angle, like: offset-path: ray(45deg);");
  const a = readAngle(angle);
  return { type: "ray", dx: Math.sin(a), dy: Math.cos(a) };
}

function locate<T>(value: Token[], read: () => T): T {
  try {
    return read();
  } catch (error) {
    throw errorAt(value, (error as Error).message);
  }
}

// The point at a distance along the path, and the direction there
export function pointAt(path: OffsetPath, s: number): { x: number; y: number; dx: number; dy: number } {
  if (path.type === "ray") return { x: path.dx * s, y: path.dy * s, dx: path.dx, dy: path.dy };
  const { segments, length } = path;
  const at = path.closed ? ((s % length) + length) % length : Math.min(Math.max(s, 0), length);
  const segment =
    segments.find((piece) => at < piece.start + piece.length) ?? segments[segments.length - 1];
  const along = at - segment.start;
  return {
    x: segment.a.x + segment.dx * along,
    y: segment.a.y + segment.dy * along,
    dx: segment.dx,
    dy: segment.dy,
  };
}

// offset-rotate, like CSS: auto (the default: along the path), reverse, an angle, or both.
// The angle turns like rotate-z.
export function readOffsetRotate(value: Token[] | undefined): {
  auto: boolean;
  reverse: boolean;
  angle: number | string; // degrees, or GLSL in radians when set from JS (decision 105)
} {
  const rotate: { auto: boolean; reverse: boolean; angle: number | string } = { auto: true, reverse: false, angle: 0 };
  if (!value) return rotate;
  let keyword = false;
  let angle = false;
  for (const token of value) {
    if (token.type === "IDENT" && (token.value === "auto" || token.value === "reverse") && !keyword) {
      keyword = true;
      rotate.reverse = token.value === "reverse";
    } else if (token.type === "EXPR" && token.syntax === "angle" && !angle) {
      angle = true;
      rotate.angle = token.code;
    } else if ((token.type === "DIMENSION" || (token.type === "NUMBER" && token.value === 0)) && !angle) {
      angle = true;
      rotate.angle = round((readAngle([token]) * 180) / Math.PI);
    } else
      throw errorAt(
        value,
        "offset-rotate takes auto, reverse, an angle, or auto with an angle, like: offset-rotate: auto 90deg;",
      );
  }
  rotate.auto = keyword || !angle;
  return rotate;
}

// A distance along the path: a number (units, like the path), or a percentage of its length
function readDistance(path: OffsetPath, value: Token[] | undefined): string {
  if (!value) return "0.0";
  const [token] = value;
  if (value.length === 1 && token.type === "NUMBER") return glslFloat(round(token.value));
  // A variable set from JS (decision 105): a number, or a share of the path's length
  if (value.length === 1 && token.type === "EXPR" && token.syntax === "number") return token.code;
  if (value.length === 1 && token.type === "EXPR" && token.syntax === "percentage") {
    if (path.type === "ray")
      throw errorAt(value, "A ray has no length: give offset-distance in units, like: offset-distance: 2;");
    return `(${token.code} / 100.0 * ${glslFloat(round(path.length))})`;
  }
  if (value.length === 1 && token.type === "PERCENTAGE") {
    if (path.type === "ray")
      throw errorAt(value, "A ray has no length: give offset-distance in units, like: offset-distance: 2;");
    return glslFloat(round((token.value / 100) * path.length));
  }
  throw errorAt(value, "offset-distance takes a number or a percentage, like: offset-distance: 50%;");
}

// The GLSL functions of the paths a scene animates along, one per path
let functions = new Map<string, string>();
export function useOffsetFunctions(): Map<string, string> {
  functions = new Map();
  return functions;
}

const f = (n: number) => glslFloat(Math.round(n * 10000) / 10000);
const vec2 = (x: number, y: number) => `vec2(${f(x)}, ${f(y)})`;

// vec4(point, direction) at a distance s along the path
function pathFunction(path: Extract<OffsetPath, { type: "path" }>): string {
  const lines = path.segments.map((segment, i) => {
    const point = `${vec2(segment.a.x, segment.a.y)} + ${vec2(segment.dx, segment.dy)} * (s - ${f(segment.start)})`;
    const direction = vec2(segment.dx, segment.dy);
    return i === path.segments.length - 1
      ? `  return vec4(${point}, ${direction});`
      : `  if (s < ${f(segment.start + segment.length)}) return vec4(${point}, ${direction});`;
  });
  const wrap = path.closed
    ? `  s = mod(s, ${f(path.length)}); // a closed path goes round`
    : `  s = clamp(s, 0.0, ${f(path.length)});`;
  return [`vec4 NAME(float s) {`, wrap, ...lines, "}"].join("\n");
}

function functionName(path: Extract<OffsetPath, { type: "path" }>): string {
  const code = pathFunction(path);
  let name = functions.get(code);
  if (!name) {
    name = `offsetPath${functions.size}`;
    functions.set(code, name);
  }
  return name;
}

// The lines that move q along the motion path of a node, after its scale
export function offsetLines(
  styles: Styles,
  keyframes: Keyframes[],
  hover?: Hover,
  hoisted?: Hoisted,
): string[] {
  const path = readOffsetPath(styles["offset-path"]);
  if (!path) {
    const alone = PROPERTIES.find((property) => styles[property]);
    if (alone)
      throw errorAt(
        styles[alone],
        `${alone} moves an object along its motion path: write offset-path first, like: offset-path: path("M0 0 L4 0");`,
      );
    return [];
  }
  const rotate = readOffsetRotate(styles["offset-rotate"]);
  const distance = hoverValue(styles, keyframes, "offset-distance", (v) => readDistance(path, v), hover);
  const lines: string[] = [];
  const sign = rotate.reverse ? "-" : "";
  const constant = Number(distance);
  if (!Number.isNaN(constant)) {
    // A fixed place: computed now, the shader only moves q
    const at = pointAt(path, constant);
    lines.push(`  q.xy -= ${vec2(at.x, at.y)};`);
    const straight = at.dx === 1 && at.dy === 0 && !rotate.reverse; // already along x
    if (rotate.auto && !straight)
      lines.push(
        `  q.xy = ${sign}vec2(dot(q.xy, ${vec2(at.dx, at.dy)}), dot(q.xy, ${vec2(-at.dy, at.dx)}));`,
      );
  } else if (path.type === "ray") {
    lines.push(`  q.xy -= ${vec2(path.dx, path.dy)} * ${hoist(hoisted, "float", distance)};`);
    if (rotate.auto && !(path.dx === 1 && path.dy === 0 && !rotate.reverse))
      lines.push(
        `  q.xy = ${sign}vec2(dot(q.xy, ${vec2(path.dx, path.dy)}), dot(q.xy, ${vec2(-path.dy, path.dx)}));`,
      );
  } else {
    // Moving: the point and the direction, once per pixel in animate()
    const o = hoist(hoisted, "vec4", `${functionName(path)}(${distance})`);
    lines.push(`  q.xy -= ${o}.xy;`);
    if (rotate.auto)
      lines.push(`  q.xy = ${sign}vec2(dot(q.xy, ${o}.zw), dot(q.xy, vec2(-${o}.w, ${o}.z)));`);
  }
  if (typeof rotate.angle === "string") lines.push(`  q.xy *= rot(${rotate.angle});`);
  else if (rotate.angle !== 0) lines.push(`  q.xy *= rot(${glslFloat(round((rotate.angle * Math.PI) / 180))});`);
  return lines;
}

// The motion path the other way, on v: from the space of a node to the space around it.
// A light of @scene is placed this way (decision 110): the lines of offsetLines(), undone
// in the reverse order.
export function offsetForwardLines(
  styles: Styles,
  keyframes: Keyframes[],
  hover?: Hover,
  hoisted?: Hoisted,
): string[] {
  const path = readOffsetPath(styles["offset-path"]);
  if (!path) return [];
  const rotate = readOffsetRotate(styles["offset-rotate"]);
  const distance = hoverValue(styles, keyframes, "offset-distance", (v) => readDistance(path, v), hover);
  const lines: string[] = [];
  const sign = rotate.reverse ? "-" : "";
  if (typeof rotate.angle === "string") lines.push(`  v.xy *= rot(-(${rotate.angle}));`);
  else if (rotate.angle !== 0) lines.push(`  v.xy *= rot(${glslFloat(-round((rotate.angle * Math.PI) / 180))});`);
  // The direction of the path turned v into (along, across): back into x and y
  const unturn = (d: string, across: string) => `  v.xy = ${sign}(v.x * ${d} + v.y * ${across});`;
  const constant = Number(distance);
  if (!Number.isNaN(constant)) {
    const at = pointAt(path, constant);
    const straight = at.dx === 1 && at.dy === 0 && !rotate.reverse;
    if (rotate.auto && !straight) lines.push(unturn(vec2(at.dx, at.dy), vec2(-at.dy, at.dx)));
    lines.push(`  v.xy += ${vec2(at.x, at.y)};`);
  } else if (path.type === "ray") {
    if (rotate.auto && !(path.dx === 1 && path.dy === 0 && !rotate.reverse))
      lines.push(unturn(vec2(path.dx, path.dy), vec2(-path.dy, path.dx)));
    lines.push(`  v.xy += ${vec2(path.dx, path.dy)} * ${hoist(hoisted, "float", distance)};`);
  } else {
    const o = hoist(hoisted, "vec4", `${functionName(path)}(${distance})`);
    if (rotate.auto) lines.push(unturn(`${o}.zw`, `vec2(-${o}.w, ${o}.z)`));
    lines.push(`  v.xy += ${o}.xy;`);
  }
  return lines;
}

// How far the motion path can take a node's content from its origin, for the bounding
// spheres: the farthest point of a path; a ray, only when its distance is known
export function offsetReach(styles: Styles, keyframes: Keyframes[], hover?: Hover): number | null {
  const path = readOffsetPath(styles["offset-path"]);
  if (!path) return 0;
  if (path.type === "path") return path.reach;
  const distance = Number(
    hoverValue(styles, keyframes, "offset-distance", (v) => readDistance(path, v), hover),
  );
  return Number.isNaN(distance) ? null : Math.abs(distance);
}
