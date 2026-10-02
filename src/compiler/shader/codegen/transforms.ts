// Moving q into the space of a group or an object, and animate()
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance, Styles } from "../../cascade/resolve";
import { label, type Hover } from "./glsl";
import { ROTATIONS, readRotation, readScale, readTranslate } from "./read";
import { hoverValue } from "./animation";

// ----- Animations, computed once per pixel -----
// An animated value (or one :hover changes) depends on the time, not on the point.
// map() runs about 150 times per pixel (the march, the normal, the reflection):
// such a value is computed once, in animate() at the start of main(), and map()
// reads it from a global. Same arithmetic, moved: the image does not change.
export type Hoisted = { names: Map<string, string>; values: { type: string; name: string; expr: string }[] };

export function createHoisted(): Hoisted {
  return { names: new Map(), values: [] };
}

// The expression as it is when it is constant; otherwise the name of its global
// (two objects with the same animation share it)
export function hoist(hoisted: Hoisted | undefined, type: "float" | "vec3" | "mat2", expr: string): string {
  if (!hoisted || !/\b(iTime|uHover)\b/.test(expr)) return expr;
  const key = `${type} ${expr}`;
  let name = hoisted.names.get(key);
  if (!name) {
    name = `anim${hoisted.values.length}`;
    hoisted.names.set(key, name);
    hoisted.values.push({ type, name, expr });
  }
  return name;
}

// The globals and animate(), or "" when nothing moves
export function animateCode(hoisted: Hoisted): string {
  if (hoisted.values.length === 0) return "";
  return [
    "// Animations and :hover: they depend on the time, not on the point, so",
    "// animate() computes them once per pixel, and map() reads them",
    ...hoisted.values.map(({ type, name }) => `${type} ${name};`),
    "",
    "void animate() {",
    ...hoisted.values.map(({ name, expr }) => `  ${name} = ${expr};`),
    "}",
  ].join("\n");
}

export function rotationLines(
  styles: Styles,
  keyframes: Keyframes[],
  hover?: Hover,
  hoisted?: Hoisted,
): string[] {
  const lines: string[] = [];
  for (const [property, axes] of ROTATIONS) {
    const angle = hoverValue(styles, keyframes, property, readRotation, hover);
    if (angle === "0.0") continue; // no rotation on this axis
    lines.push(`  q.${axes} *= ${hoist(hoisted, "mat2", `rot(${angle})`)};`);
  }
  return lines;
}

// The lines that move q into the space of one node (a group or an object)
// hover: only for the object itself, never for its groups
export function transformLines(
  styles: Styles,
  keyframes: Keyframes[],
  hover?: Hover,
  hoisted?: Hoisted,
): string[] {
  return [
    `  q -= ${hoist(hoisted, "vec3", hoverValue(styles, keyframes, "translate", readTranslate, hover))};`,
    ...rotationLines(styles, keyframes, hover, hoisted),
    `  q /= ${hoist(hoisted, "float", hoverValue(styles, keyframes, "scale", readScale, hover))};`,
  ];
}

// The space of an object: the same moves as in map(), groups from the outside in, then the object
export function spaceFunction(
  instance: StyledInstance,
  keyframes: Keyframes[],
  hoverOf: (instance: StyledInstance) => Hover | undefined,
): string {
  const nodes = [...instance.groupStyles, instance.styles];
  return [
    `vec3 space${instance.index}(vec3 p) {  // ${label(instance)}`,
    "  vec3 q = p;",
    ...nodes.flatMap((styles, n) =>
      transformLines(styles, keyframes, n === nodes.length - 1 ? hoverOf(instance) : undefined),
    ),
    "  return q;",
    "}",
  ].join("\n");
}
