// Bounding spheres: the sphere of the scene (decision 76) and bounds on groups (decision 77)
import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance } from "../../cascade/resolve";
import type { Easing } from "../../values/easing";
import { readTransition } from "../../features/transition";
import { glslFloat, label, vec3, type Hover } from "./glsl";
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

// The box of some points: its middle, and half its diagonal
function boxOfPoints(points: number[][]): { middle: number[]; reach: number } {
  const low = [0, 1, 2].map((i) => Math.min(...points.map((p) => p[i])));
  const high = [0, 1, 2].map((i) => Math.max(...points.map((p) => p[i])));
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
export function sceneMiss(center: number[], radius: number, floor: boolean): string {
  const r = Math.ceil(radius * 1000) / 1000; // rounded up: never smaller
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

// ----- Bounds on whole groups -----
// A group of several objects gets one test around all of them: when the point is
// further from the group's sphere than the nearest object so far, none of its objects
// can be nearer, and map() skips them all (their transforms and their shapes). Only
// plain unions can be skipped, and only when every object's sphere is known (the
// same spheres as the sphere of the scene: every moment of the animations, hovered).
// Nested groups get their own test inside their parent's.
const GROUP_MIN = 3; // fewer objects: the test costs about what it saves

export function groupBounds(
  instances: StyledInstance[],
  codes: string[],
  spheres: (Sphere | null)[],
  plainUnion: (instance: StyledInstance) => boolean,
  nearest: string,
): string {
  const indent = (code: string) => code.replace(/^/gm, "  ");
  const emit = (members: number[], depth: number): string[] => {
    const out: string[] = [];
    let i = 0;
    while (i < members.length) {
      const group = instances[members[i]].groups[depth];
      let j = i + 1;
      while (group && j < members.length && instances[members[j]].groups[depth] === group) j++;
      const run = members.slice(i, j);
      const bounded =
        group &&
        run.length >= GROUP_MIN &&
        run.every((m) => spheres[m] !== null && plainUnion(instances[m]));
      if (!group) out.push(codes[members[i]]);
      else if (!bounded) out.push(...emit(run, depth + 1));
      else {
        const sphere = enclosing(run.map((m) => spheres[m]!));
        // A little bigger, rounded up: the GPU computes in 32-bit floats
        const r = Math.ceil((sphere.radius + 0.001) * 10000) / 10000;
        const center = vec3(sphere.center.map((c) => Math.round(c * 10000) / 10000));
        // the center is rounded to 0.0001: the radius grows by as much as it may move
        const safe = Math.ceil((r + 0.0001) * 10000) / 10000;
        out.push(
          [
            ` // ${label(group as StyledInstance)}: ${run.length} objects, one test for all`,
            `  if (length(p - ${center}) - ${glslFloat(safe)} <= ${nearest}) {`,
            indent(emit(run, depth + 1).join("\n\n")),
            "  }",
          ].join("\n"),
        );
      }
      i = j;
    }
    return out;
  };
  return emit(instances.map((_, i) => i), 0).join("\n\n");
}
