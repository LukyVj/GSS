// Moving q into the space of a group or an object, and animate()
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance, Styles } from "../../cascade/resolve";
import { glslFloat, label, type Hover } from "./glsl";
import { ROTATIONS, readRotation, readScale, readTranslate } from "./read";
import { groupHover, hoverValue } from "./animation";
import { offsetForwardLines, offsetLines } from "./offset";
import { objectBox, readOrigin, type Box } from "./origin";

// ----- Animations, computed once per pixel -----
// An animated value (or one :hover changes) depends on the time, not on the point.
// map() runs about 150 times per pixel (the march, the normal, the reflection):
// such a value is computed once, in animate() at the start of main(), and map()
// reads it from a global. Same arithmetic, moved: the image does not change.
// atRest: a view for the places of hover-distance() (decision 215): a value that measures from
// the pointer is written in place, the others are shared with map()
export type Hoisted = { names: Map<string, string>; values: { type: string; name: string; expr: string }[]; atRest?: boolean };

export function createHoisted(): Hoisted {
  return { names: new Map(), values: [] };
}

// The expression as it is when it is constant; otherwise the name of its global
// (two objects with the same animation share it)
export function hoist(hoisted: Hoisted | undefined, type: "float" | "vec3" | "vec4" | "mat2", expr: string): string {
  if (!hoisted || !/\b(iTime|uHover|uTimeline|uProperties|hoverDist\d+|hoverDir\d+)\b/.test(expr)) return expr;
  if (hoisted.atRest && MEASURES.test(expr)) return expr;
  const key = `${type} ${expr}`;
  let name = hoisted.names.get(key);
  if (!name) {
    name = `anim${hoisted.values.length}`;
    hoisted.names.set(key, name);
    hoisted.values.push({ type, name, expr });
  }
  return name;
}

// The globals and animate(), or "" when nothing moves. functions: GLSL that reads the
// globals and that animate() calls, written between them (the place of each light of
// @scene, decision 110).
export function animateCode(hoisted: Hoisted, functions = ""): string {
  if (hoisted.values.length === 0) return "";
  // what does not measure from the pointer first: the places of hover-distance() read it
  // (decision 215); a scene without it keeps its order
  const order = [...hoisted.values.filter((v) => !MEASURES.test(v.expr) && !POINTED.test(v.expr)), ...hoisted.values.filter((v) => MEASURES.test(v.expr) || POINTED.test(v.expr))];
  return [
    "// Animations and :hover: they depend on the time, not on the point, so",
    "// animate() computes them once per pixel, and map() reads them",
    ...hoisted.values.map(({ type, name }) => `${type} ${name};`),
    "",
    ...(functions ? [functions, ""] : []),
    "void animate() {",
    ...order.map(({ name, expr }) => `  ${name} = ${expr};`),
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

// transform-origin in GLSL, or null at the center: then no line is written (decision 107).
// box: the size of the object; none for a group.
export function originOf(
  styles: Styles,
  keyframes: Keyframes[],
  hover?: Hover,
  hoisted?: Hoisted,
  box?: Box,
): string | null {
  const origin = hoverValue(styles, keyframes, "transform-origin", readOrigin(box), hover);
  return origin === "vec3(0.0)" ? null : hoist(hoisted, "vec3", origin);
}

// The lines that move q into the space of one node (a group or an object)
// hover: the states of this node, an object or a group (decision 211). box: the size of the object.
export function transformLines(
  styles: Styles,
  keyframes: Keyframes[],
  hover?: Hover,
  hoisted?: Hoisted,
  box?: Box,
): string[] {
  // Like CSS, transform-origin goes around everything else: to the point, then back
  const origin = originOf(styles, keyframes, hover, hoisted, box);
  return [
    `  q -= ${hoist(hoisted, "vec3", hoverValue(styles, keyframes, "translate", readTranslate, hover))};`,
    ...(origin ? [`  q -= ${origin};`] : []),
    ...rotationLines(styles, keyframes, hover, hoisted),
    `  q /= ${hoist(hoisted, "float", hoverValue(styles, keyframes, "scale", readScale, hover))};`,
    ...offsetLines(styles, keyframes, hover, hoisted), // the motion path, after scale like CSS
    ...(origin ? [`  q += ${origin};`] : []),
  ];
}

// The other way, on v: from the space of a node to the space around it, the lines of
// transformLines() undone in the reverse order. A light of @scene is placed this way
// (decision 110); a value that changes nothing writes no line.
export function forwardLines(
  styles: Styles,
  keyframes: Keyframes[],
  hover?: Hover,
  hoisted?: Hoisted,
  box?: Box,
): string[] {
  const origin = originOf(styles, keyframes, hover, hoisted, box);
  const scale = hoist(hoisted, "float", hoverValue(styles, keyframes, "scale", readScale, hover));
  const translate = hoist(hoisted, "vec3", hoverValue(styles, keyframes, "translate", readTranslate, hover));
  const turns: string[] = [];
  for (const [property, axes] of ROTATIONS) {
    const angle = hoverValue(styles, keyframes, property, readRotation, hover);
    if (angle === "0.0") continue;
    const back = /^-?[\d.]+$/.test(angle) ? glslFloat(-Number(angle)) : `-(${angle})`;
    turns.unshift(`  v.${axes} *= ${hoist(hoisted, "mat2", `rot(${back})`)};`); // z, then y, then x
  }
  return [
    ...(origin ? [`  v -= ${origin};`] : []),
    ...offsetForwardLines(styles, keyframes, hover, hoisted),
    ...(scale === "1.0" ? [] : [`  v *= ${scale};`]),
    ...turns,
    ...(origin ? [`  v += ${origin};`] : []),
    ...(translate === "vec3(0.0)" ? [] : [`  v += ${translate};`]),
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
      n === nodes.length - 1
        ? transformLines(styles, keyframes, hoverOf(instance), undefined, () => objectBox(instance))
        : transformLines(styles, keyframes, groupHover(instance, n)),
    ),
    "  return q;",
    "}",
  ].join("\n");
}

// hover-distance(), hover-direction() (decision 215): the objects that measure from the object
// under the pointer, by their number: hoverDist3, hoverDir3 in a value. In the styles, or in
// the frames of an animation, which read it through the variables of the object that plays them
const POINTER = /\bhoverDi(?:st|r)(\d+)\b/g;
const MEASURES = /\bhoverDi(?:st|r)\d+\b/;
const POINTED = /\b(hoverAt|hoverDistance|hoverDirection)\(/;
export function pointerReaders(instances: StyledInstance[], keyframes: Keyframes[] = []): Set<number> {
  const values = [
    ...instances.flatMap((instance) =>
      [instance.styles, instance.hoverStyles, instance.activeStyles, ...instance.hoverStates.map((state) => state.styles), ...instance.groupStyles].flatMap(
        (styles) => Object.values(styles),
      ),
    ),
    ...keyframes.flatMap((animation) => animation.frames.flatMap((frame) => frame.declarations.map((d) => d.value))),
  ];
  const found = new Set<number>();
  for (const value of values)
    for (const token of value)
      if (token.type === "EXPR") for (const [, index] of token.code.matchAll(POINTER)) found.add(Number(index));
  return found;
}

// Where each object is with nothing under the pointer: its moves and its groups', from
// the inside out, with what measures from the pointer left out (far away, no direction);
// then the point under the pointer, and the two measures
export function pointerCode(
  instances: StyledInstance[],
  keyframes: Keyframes[],
  hoverOf: (instance: StyledInstance) => Hover | undefined,
  hoisted: Hoisted,
  cameraTarget: string,
): string {
  const shared: Hoisted = { ...hoisted, atRest: true }; // the same names and values
  const atRest = (line: string) => line.replace(/\bhoverDist\d+\b/g, "1000000.0").replace(/\bhoverDir\d+\b/g, "vec3(0.0)");
  const centers = instances.map((instance) =>
    [
      `vec3 restCenter${instance.index}() {  // ${label(instance)}`,
      "  vec3 v = vec3(0.0);",
      ...[
        ...forwardLines(instance.styles, keyframes, hoverOf(instance), shared, () => objectBox(instance)),
        ...instance.groupStyles.map((group, g) => forwardLines(group, keyframes, groupHover(instance, g), shared)).reverse().flat(),
      ].map(atRest),
      "  return v;",
      "}",
    ].join("\n"),
  );
  return [
    "// hover-distance(), hover-direction(): where each object is with nothing under the pointer",
    ...centers,
    // uPointer (decision 217): the pixel under the pointer (xy) and how far along its ray (z),
    // through the camera of main(); the distance grows to nothing as the presence (w) fades
    "vec3 pointerPoint() {",
    "  vec2 uv = (uPointer.xy - 0.5 * iResolution.xy) / iResolution.y;",
    `  vec3 target = ${cameraTarget};`,
    "  vec3 ro = target + uDist * vec3(cos(uCamera.y) * sin(uCamera.x), sin(uCamera.y), cos(uCamera.y) * cos(uCamera.x));",
    "  vec3 forward = normalize(target - ro);",
    "  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));",
    "  vec3 rd = normalize(uv.x * right + uv.y * cross(right, forward) + 1.5 * forward);",
    "  return ro + rd * uPointer.z;",
    "}",
    "float hoverDistance(vec3 c) {",
    "  return uPointer.w > 0.0 ? length(c - hoverPoint) / uPointer.w : 1000000.0;",
    "}",
    "vec3 hoverDirection(vec3 c) {",
    "  vec3 d = c - hoverPoint;",
    "  return uPointer.w > 0.0 && dot(d, d) > 0.000001 ? normalize(d) : vec3(0.0);",
    "}",
  ].join("\n");
}

