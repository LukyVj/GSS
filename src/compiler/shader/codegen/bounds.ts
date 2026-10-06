// Bounding spheres: the sphere of the scene (decision 76) and the tree of spheres (decisions 77, 132)
import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance } from "../../cascade/resolve";
import type { Easing } from "../../values/easing";
import { readTransition } from "../../features/transition";
import { glslFloat, vec3, type Hover } from "./glsl";
import { ROTATIONS, readRotation, readScale, readTranslate } from "./read";
import { hoverValue } from "./animation";
import { offsetReach } from "./offset";
import { objectBox, readOrigin } from "./origin";

// ----- The sphere around the whole scene -----
// A ray that passes by it meets no object: march() then only has the floor left,
// found without marching (most of the sky and of the floor, in most scenes).
// It must hold every object at every moment of its animations, and hovered.

// Every value an animated (or hovered) expression can take, read from the GLSL
// itself: a constant, or mix(a, b, w) with a weight w in [0, 1] (a keyframe segment:
// clamp(…, 0.0, 1.0), eased or not; :hover: uHover[i]). Such a value always stays in
// the box of its constants. null: anything else (then the scene gets no sphere).
function splitArguments(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(" || text[i] === "[") depth++;
    else if (text[i] === ")" || text[i] === "]") depth--;
    else if (text[i] === "," && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts;
}

// The arguments of `name(…)` when the whole text is that one call, else null
function callOf(text: string, name: string): string[] | null {
  if (!text.startsWith(`${name}(`) || !text.endsWith(")")) return null;
  let depth = 0;
  for (let i = name.length; i < text.length - 1; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return null; // closes before the end
  }
  return splitArguments(text.slice(name.length + 1, -1));
}

// A weight that always stays in [0, 1]: smoothstep(0.0, 1.0, …) whatever is inside,
// clamp(…, 0.0, 1.0), and uHover[i] when the transitions of that object never
// overshoot (stays01)
function isWeight(text: string, steadyHover: boolean): boolean {
  const smooth = callOf(text, "smoothstep");
  if (smooth) return smooth.length === 3 && smooth[0] === "0.0" && smooth[1] === "1.0";
  const clamped = callOf(text, "clamp");
  if (clamped) return clamped.length === 3 && clamped[1] === "0.0" && clamped[2] === "1.0";
  return steadyHover && /^uHover\[\d+\]$/.test(text);
}

// An easing whose progress never leaves [0, 1]: a cubic-bezier() stays in the hull of
// its points (0, y1, y2, 1), a linear() between its outputs. A transition with such
// easings keeps uHover[] in [0, 1]; one that overshoots (back-out…) can push it out.
export function stays01(easing: Easing): boolean {
  if (easing.type === "steps") return true; // from 0 to 1 by jumps
  const outputs =
    easing.type === "cubic-bezier" ? [easing.y1, easing.y2] : easing.points.map((p) => p.output);
  return outputs.every((y) => y >= 0 && y <= 1);
}

function anchors(expr: string, steadyHover: boolean): number[][] | null {
  const text = expr.trim();
  const parts = callOf(text, "mix");
  if (parts) {
    if (parts.length !== 3 || !isWeight(parts[2], steadyHover)) return null;
    const [a, b] = [anchors(parts[0], steadyHover), anchors(parts[1], steadyHover)];
    return a && b ? [...a, ...b] : null;
  }
  const inside = text.match(/^vec3\((.*)\)$/)?.[1] ?? text;
  const numbers = splitArguments(inside).map(Number);
  if (numbers.length !== 1 && numbers.length !== 3) return null;
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  return [numbers.length === 1 ? [numbers[0], numbers[0], numbers[0]] : numbers];
}

export type Sphere = { center: number[]; radius: number };

const length3 = (v: number[]) => Math.hypot(v[0], v[1], v[2]);

// The box of some points: its lowest and highest corners
function boundsOf(points: number[][]): { low: number[]; high: number[] } {
  return {
    low: [0, 1, 2].map((i) => Math.min(...points.map((p) => p[i]))),
    high: [0, 1, 2].map((i) => Math.max(...points.map((p) => p[i]))),
  };
}

// The box of some points: its middle, and half its diagonal
function boxOfPoints(points: number[][]): { middle: number[]; reach: number } {
  const { low, high } = boundsOf(points);
  return {
    middle: low.map((l, i) => (l + high[i]) / 2),
    reach: length3(low.map((l, i) => (high[i] - l) / 2)),
  };
}

// uHover[] of this object stays in [0, 1]: its transitions (rest, hovered and pressed)
// never overshoot
function steadyTransitions(instance: StyledInstance): boolean {
  return [instance.styles, instance.hoverStyles, instance.activeStyles].every((styles) => {
    const transition = readTransition(styles["transition"]);
    return !transition || stays01(transition.easing);
  });
}

// One object's sphere in the scene, through its own transforms and its groups', from
// the inside out. A node maps its child's space to its parent's: scale, rotate,
// then translate, the first two around its transform-origin. null when a value is not
// known at compile time.
export function objectSphere(
  radius: number,
  instance: StyledInstance,
  keyframes: Keyframes[],
  hover: Hover | undefined,
): Sphere | null {
  let sphere: Sphere = { center: [0, 0, 0], radius };
  const nodes = [...instance.groupStyles, instance.styles];
  for (let n = nodes.length - 1; n >= 0; n--) {
    const nodeHover = n === nodes.length - 1 ? hover : undefined;
    const value = (property: string, read: (value: Token[] | undefined) => string) =>
      hoverValue(nodes[n], keyframes, property, read, nodeHover);
    const steady = !nodeHover || steadyTransitions(instance);
    // A motion path, inside the node's scale: anywhere within its reach (decision 97)
    const reach = offsetReach(nodes[n], keyframes, nodeHover);
    if (reach === null) return null;
    if (reach > 0) sphere = { center: [0, 0, 0], radius: length3(sphere.center) + sphere.radius + reach };
    const scales = anchors(value("scale", readScale), steady);
    const translates = anchors(value("translate", readTranslate), steady);
    const size = n === nodes.length - 1 ? () => objectBox(instance) : undefined; // a group has no box
    const origins = anchors(value("transform-origin", readOrigin(size)), steady);
    if (!scales || !translates || !origins) return null;
    // transform-origin (decision 107): to the origin, scale and rotate, then back
    const around = boxOfPoints(origins);
    const toOrigin = (sign: number) =>
      (sphere = {
        center: sphere.center.map((c, i) => c + sign * around.middle[i]),
        radius: sphere.radius + around.reach,
      });
    toOrigin(-1);
    // Scale: anywhere between the smallest and the largest
    const factors = scales.map((s) => Math.abs(s[0]));
    const [low, high] = [Math.min(...factors), Math.max(...factors)];
    const middle = (low + high) / 2;
    sphere = {
      center: sphere.center.map((c) => c * middle),
      radius: sphere.radius * high + (length3(sphere.center) * (high - low)) / 2,
    };
    // Rotation, at any angle: the sphere is centered on the node's origin
    const rotated = ROTATIONS.some(([property]) => value(property, readRotation) !== "0.0");
    if (rotated) sphere = { center: [0, 0, 0], radius: length3(sphere.center) + sphere.radius };
    toOrigin(1);
    // Translate: anywhere in the box of its values
    const box = boxOfPoints(translates);
    sphere = {
      center: sphere.center.map((c, i) => c + box.middle[i]),
      radius: sphere.radius + box.reach,
    };
  }
  return sphere;
}

// The first lines of march(): a ray that passes by the sphere of the scene meets
// no object. With a floor, it meets the floor (y = 0) or nothing; without, nothing.
// What main() does with a floor hit only depends on the floor's normal and color,
// so the pixel is the one the march would have found.
export function sceneMiss(
  center: number[],
  radius: number,
  floor: boolean,
  geometricPrecision = false,
): string {
  const r = Math.ceil(radius * 1000) / 1000; // rounded up: never smaller

  // auto keeps the generated shader byte-for-byte as it was before shape-rendering.
  if (!geometricPrecision) {
    const hit = floor
      ? [
          "    float floorT = rd.y < 0.0 ? -ro.y / rd.y : 1e10;",
          "    return vec2(floorT < MAX_DIST ? floorT : MAX_DIST + 1.0, 0.0);",
        ]
      : ["    return vec2(MAX_DIST + 1.0, 0.0);"];
    return [
      "  // A ray that passes by the sphere around every object, at every moment of",
      "  // their animations, meets no object: only the floor is left, found at once",
      `  vec3 oc = ro - ${vec3(center.map((c) => Math.round(c * 10000) / 10000))};`,
      "  float b = dot(oc, rd);",
      `  float c = dot(oc, oc) - ${glslFloat(Math.round(r * r * 10000) / 10000 + 0.001)};`,
      `  if (${floor ? "ro.y > 0.0 && " : ""}c > 0.0 && (b > 0.0 || b * b < c * dot(rd, rd))) {`,
      ...hit,
      "  }",
      "",
    ].join("\n");
  }

  const hit = floor
    ? [
        "    float floorT = rd.y < 0.0 ? -ro.y / rd.y : 1e10;",
        "    return vec4(floorT < MAX_DIST ? floorT : MAX_DIST + 1.0, 0.0, 0.0, 0.0);",
      ]
    : ["    return vec4(MAX_DIST + 1.0, 0.0, 0.0, 0.0);"];
  return [
    "  // A ray farther than one pixel from the sphere around every object cannot",
    "  // graze a silhouette: only the floor is left, found at once.",
    `  vec3 oc = ro - ${vec3(center.map((c) => Math.round(c * 10000) / 10000))};`,
    "  float b = dot(oc, rd);",
    `  float c = dot(oc, oc) - ${glslFloat(Math.round(r * r * 10000) / 10000 + 0.001)};`,
    "  float boundWidth = max(-b, 0.0) * pixelSize;",
    `  bool misses = b > 0.0 || c - b * b > 2.0 * ${glslFloat(r)} * boundWidth + boundWidth * boundWidth;`,
    `  if (${floor ? "ro.y > 0.0 && " : ""}c > 0.0 && misses) {`,
    ...hit,
    "  }",
    "",
  ].join("\n");
}

// The sphere that holds all the others
export function enclosing(spheres: Sphere[]): Sphere {
  const box = boxOfPoints(
    spheres.flatMap(({ center, radius }) => [
      center.map((c) => c - radius),
      center.map((c) => c + radius),
    ]),
  );
  const radius = Math.max(
    ...spheres.map((s) => length3(s.center.map((c, i) => c - box.middle[i])) + s.radius),
  );
  return { center: box.middle, radius };
}

// ----- A tree of spheres around the objects (decision 132) -----
// The objects map() can skip are grouped by where they are, whatever the groups of the GSS:
// each group gets one test around all its objects, and the groups inside it their own
// tests. When the point is further from a group's sphere than the nearest object so far,
// none of its objects can be nearer, and map() skips them all (their transforms and their
// shapes). Only plain unions can be skipped, and only when the object's sphere is known
// (the same spheres as the sphere of the scene: every moment of the animations, hovered).
// The value of map() stays the same: a skipped object is never the nearest.
const GROUP_MIN = 3; // fewer objects: the test costs about what it saves

type Item = { object: number } | { sphere: Sphere; items: Item[] };

// The objects, grouped two by two by where they are: of every way to cut them in two along
// x, y or z, the one where the two boxes around them, their size squared times their number
// of objects (the chance that a point comes close enough to test what is inside), cost the
// least; down to fewer than GROUP_MIN. A big object then ends up alone, rather than make a
// small group big; between equal cuts, the most even one.
function grouped(members: number[], spheres: Sphere[], parent = Infinity): Item[] {
  if (members.length < GROUP_MIN) return members.map((object) => ({ object }));
  const sphere = enclosing(members.map((m) => spheres[m]));
  const n = members.length;
  let best = { cost: Infinity, uneven: Infinity, parts: [members] };
  for (const axis of [0, 1, 2]) {
    const sorted = [...members].sort((a, b) => spheres[a].center[axis] - spheres[b].center[axis] || a - b);
    // The size of the box of the first k objects, and of the last n - k
    const sizes = (order: number[]) => {
      const low = [Infinity, Infinity, Infinity];
      const high = [-Infinity, -Infinity, -Infinity];
      return order.map((m) => {
        const { center, radius } = spheres[m];
        for (let i = 0; i < 3; i++) {
          low[i] = Math.min(low[i], center[i] - radius);
          high[i] = Math.max(high[i], center[i] + radius);
        }
        return length3(high.map((h, i) => (h - low[i]) / 2)) ** 2;
      });
    };
    const before = sizes(sorted);
    const after = sizes([...sorted].reverse()).reverse();
    for (let cut = 1; cut < n; cut++) {
      const cost = before[cut - 1] * cut + after[cut] * (n - cut);
      const uneven = Math.abs(n - 2 * cut);
      if (cost < best.cost * (1 - 1e-9) || (cost <= best.cost * (1 + 1e-9) && uneven < best.uneven))
        best = { cost, uneven, parts: [sorted.slice(0, cut), sorted.slice(cut)] };
    }
  }
  const items = best.parts.flatMap((part) => grouped(part, spheres, sphere.radius));
  // Inside its parent, a group's test passes about as often as its sphere covers the
  // parent's, (radius / parent)²; it costs about one object, and saves all of them when it
  // fails. Too close to its parent's size, it would cost more than it saves.
  return (sphere.radius / parent) ** 2 < 1 - 1 / n ? [{ sphere, items }] : items;
}

// The sphere of a group, in GLSL: a little bigger, rounded up, since the GPU computes in
// 32-bit floats; the center is rounded to 0.0001, so the radius grows by as much as it may move
function sphereCode(sphere: Sphere): { center: string; radius: string } {
  const r = Math.ceil((sphere.radius + 0.001) * 10000) / 10000;
  return {
    center: vec3(sphere.center.map((c) => Math.round(c * 10000) / 10000)),
    radius: glslFloat(Math.ceil((r + 0.0001) * 10000) / 10000),
  };
}

// map(): the objects in their order, except that between two operations that are not plain
// unions (a subtraction cuts what comes before it), the objects are free to move: those
// with no known sphere first, then the tree of the others
export function boundedMap(
  instances: StyledInstance[],
  codes: string[],
  spheres: (Sphere | null)[],
  plainUnion: (instance: StyledInstance) => boolean,
  nearest: string,
): string {
  const indent = (code: string) => code.replace(/^/gm, "  ");
  const emit = (item: Item): string => {
    if ("object" in item) return codes[item.object];
    const { center, radius } = sphereCode(item.sphere);
    const count = (i: Item): number => ("object" in i ? 1 : i.items.reduce((n, inner) => n + count(inner), 0));
    return [
      ` // ${count(item)} objects close together: one test for all`,
      `  if (length(p - ${center}) - ${radius} <= ${nearest}) {`,
      indent(item.items.map(emit).join("\n\n")),
      "  }",
    ].join("\n");
  };
  const out: string[] = [];
  let run: number[] = [];
  const flush = () => {
    const known = run.filter((m) => spheres[m] !== null);
    if (known.length < GROUP_MIN) out.push(...run.map((m) => codes[m]));
    else {
      out.push(...run.filter((m) => spheres[m] === null).map((m) => codes[m]));
      out.push(...grouped(known, spheres as Sphere[]).map(emit));
    }
    run = [];
  };
  instances.forEach((instance, i) => {
    if (plainUnion(instance)) return run.push(i);
    flush();
    out.push(codes[i]);
  });
  flush();
  return out.join("\n\n");
}
