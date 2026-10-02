import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance, Styles } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { closingParen } from "../../values/calc";
import { readNumber } from "../../values/values";
import { readAnimation } from "../../features/animation";
import {
  backgroundFunction,
  channel,
  channels,
  gradientMean,
  isGradient,
  linesOf,
  readGradient,
  type Gradient,
} from "../gradient";
import { animatedValue, hoverValue } from "./animation";
import { glslFloat, label, type Hover } from "./glsl";
import { readColor, readFlatSize, readRadii, readSize } from "./read";
import { shapeRadius } from "./shapes";
import { spaceFunction } from "./transforms";

// The background: a constant color, or a gradient drawn over the canvas. An animation of
// the scene changes either one (decision 103): the color is then computed at every pixel.
export function backgroundCode(styles: Styles, keyframes: Keyframes[]): string {
  const value = styles["background"];
  if (isGradient(value)) {
    const { gradient, moving } = movingGradient(styles, keyframes, "background", undefined);
    return backgroundFunction(gradient, moving);
  }
  refuseGradients(styles, keyframes, "background", undefined);
  const still = readColor(value, "vec3(0.03)");
  const color = animatedValue(styles, keyframes, "background", (v) => readColor(v, "vec3(0.03)"));
  if (color === still) return `const vec3 BACKGROUND = ${still};`;
  return [
    "// The background: a color that changes with the animation of the scene",
    "vec3 background(vec3 rd) {",
    `  return ${color};`,
    "}",
    "#define BACKGROUND background(rd)",
  ].join("\n");
}

// ----- Animated gradients (decision 102) -----

// Every value a property takes: at rest, in the frames of its animation, and in each
// :hover or :active layer with the frames of theirs
function valuesOf(styles: Styles, keyframes: Keyframes[], property: string, hover: Hover | undefined): Token[][] {
  const values: Token[][] = [];
  for (const state of [styles, ...(hover ?? []).map((layer) => layer.styles)]) {
    if (state[property]) values.push(state[property]);
    const animation = readAnimation(state);
    // Like in CSS, if two @keyframes have the same name, the last one wins
    const played = animation && keyframes.findLast((k) => k.name === animation.name.value);
    for (const frame of played ? played.frames : [])
      for (const declaration of frame.declarations)
        if (declaration.property === property) values.push(declaration.value);
  }
  return values;
}

// A gradient changes into another of the same kind, with as many colors: each number
// moves from one to the other, like CSS interpolates a list of numbers
function sameKind(gradient: Gradient, value: Token[]): Gradient {
  if (!isGradient(value))
    throw errorAt(value, `a gradient can only change into another gradient, not a color: write a ${gradient.name}() here too`);
  const other = readGradient(value);
  if (other.name !== gradient.name)
    throw errorAt(value, `a ${gradient.name}() can only change into another ${gradient.name}(), not a ${other.name}()`);
  if (other.shape !== gradient.shape)
    throw errorAt(value, `a radial-gradient() keeps the same shape and size when it changes: ${gradient.shape} here, ${other.shape} there`);
  if (other.stops.length !== gradient.stops.length)
    throw errorAt(
      value,
      `a gradient can only change into a gradient with as many colors: ${gradient.stops.length} here, ${other.stops.length} there (a color with two positions counts twice)`,
    );
  return other;
}

// A color at rest cannot change into a gradient: say so rather than a vague color error
function refuseGradients(styles: Styles, keyframes: Keyframes[], property: string, hover: Hover | undefined) {
  const gradient = valuesOf(styles, keyframes, property, hover).find(isGradient);
  if (gradient)
    throw errorAt(gradient, `a color can only change into another color, not a gradient: write the gradient in ${property} at rest too`);
}

// The gradient of a property, and the GLSL of each of its numbers that an animation or a
// :hover changes. A number that never changes stays a constant: a still gradient keeps
// the lines it always had.
export function movingGradient(
  styles: Styles,
  keyframes: Keyframes[],
  property: string,
  hover: Hover | undefined,
): { gradient: Gradient; moving: Map<string, string> } {
  const gradient = readGradient(styles[property]);
  const others = valuesOf(styles, keyframes, property, hover).map((value) => sameKind(gradient, value));
  const moving = new Map<string, string>();
  for (const key of channels(gradient)) {
    const still = channel(gradient, key);
    if (others.every((other) => channel(other, key) === still)) continue;
    moving.set(key, hoverValue(styles, keyframes, property, (value) => channel(readGradient(value!), key), hover));
  }
  return { gradient, moving };
}

// ----- Gradients on objects (decision 82) -----

export type Painted = { instance: StyledInstance; gradient: Gradient; moving: Map<string, string> };

// The gradient an object is painted with, from its color or the first argument of its
// material (which wins, like a material's own color), and its styles where that gradient
// is replaced by its mean color: what getMaterial() and the reflections see.
// A gradient in color can be animated and changed by :hover (decision 102).
export function objectGradient(
  instance: StyledInstance,
  keyframes: Keyframes[],
  hover: Hover | undefined,
): { painted: Painted | null; styles: Styles } {
  const styles = instance.styles;
  const hash = (value: Token[]): Token => ({ type: "HASH", value: gradientMean(value) });

  const material = styles["material"];
  // material: metal(linear-gradient(…), 0.2): a gradient as the first argument
  const opensGradient =
    material?.[1]?.type === "PUNCT" &&
    material[1].value === "(" &&
    material[2]?.type === "IDENT" &&
    material[3]?.type === "PUNCT" &&
    material[3].value === "(" &&
    isGradient(material.slice(2, closingParen(material, 3) + 1));
  if (material && opensGradient) {
    const end = closingParen(material, 3);
    const gradient = material.slice(2, end + 1);
    // material is not animated: its gradient stays still, and hides the color
    const changed = valuesOf(styles, keyframes, "color", hover).find(
      (value) => JSON.stringify(value) !== JSON.stringify(styles["color"]),
    );
    if (changed)
      throw errorAt(
        changed,
        `${label(instance)} is painted with the gradient of its material: its color cannot change. Write the gradient in color, and the material without a color, like: metal(0.2)`,
      );
    return {
      painted: { instance, gradient: readGradient(gradient), moving: new Map() },
      styles: { ...styles, material: [material[0], material[1], hash(gradient), ...material.slice(end + 1)] },
    };
  }

  const color = styles["color"];
  if (!isGradient(color)) {
    refuseGradients(styles, keyframes, "color", hover);
    return { painted: null, styles };
  }
  const { gradient, moving } = movingGradient(styles, keyframes, "color", hover);
  return { painted: { instance, gradient, moving }, styles: { ...styles, color: [hash(color)] } };
}

// The rectangle a gradient covers: the object seen from the front, x right and y up
// (seen from above for a plane, the top of the picture away from the camera)
function gradientBox(instance: StyledInstance): { size: number[]; at: string } {
  const styles = instance.styles;
  const front = (w: number, h: number) => ({ size: [w, h], at: "q.xy" });
  switch (instance.tag) {
    case "cube": {
      const [x, y] = readSize(styles["size"]);
      return front(x, y);
    }
    case "sphere": {
      const d = 2 * readNumber(styles["radius"], "radius", 0.5);
      return front(d, d);
    }
    case "torus": {
      const r = readNumber(styles["radius"], "radius", 1);
      const t = readNumber(styles["thickness"], "thickness", 0.28);
      return front(2 * (r + t), 2 * t);
    }
    case "cylinder":
    case "capsule":
      return front(
        2 * readNumber(styles["radius"], "radius", instance.tag === "capsule" ? 0.25 : 0.5),
        readNumber(styles["height"], "height", 1),
      );
    case "cone":
      return front(2 * Math.max(...readRadii(styles["radius"])), readNumber(styles["height"], "height", 1));
    case "plane": {
      const [w, d] = readFlatSize(styles["size"]);
      return { size: [w, d], at: "vec2(q.x, -q.z)" };
    }
  }
  const r = shapeRadius(instance.tag, styles) ?? 1; // path, prism: their bounding sphere
  return front(2 * r, 2 * r);
}

// gradientColor(): the color of a painted object at the point that was hit
export function gradientCode(
  painted: Painted[],
  textured: Set<StyledInstance>,
  keyframes: Keyframes[],
  hoverOf: (instance: StyledInstance) => Hover | undefined,
) {
  if (painted.length === 0) return { functions: "", call: "" };
  const spaces = painted
    .filter(({ instance }) => !textured.has(instance)) // a textured object has its space already
    .map(({ instance }) => spaceFunction(instance, keyframes, hoverOf));
  const branches = painted.map(({ instance, gradient, moving }) => {
    const { size, at } = gradientBox(instance);
    return [
      `  if (id == ${glslFloat(instance.index)}) {  // ${label(instance)}`,
      `    vec3 q = space${instance.index}(p);`,
      `    vec2 size = vec2(${size.map(glslFloat).join(", ")});`,
      `    vec2 at = ${at} + 0.5 * size;`,
      ...linesOf(gradient, moving).map((line) => `  ${line}`),
      "    return col;",
      "  }",
    ].join("\n");
  });
  return {
    functions: [
      ...spaces,
      ["vec3 gradientColor(float id, vec3 p, vec3 color) {", ...branches, "  return color;", "}"].join("\n"),
    ].join("\n\n"),
    call: "    m.color = gradientColor(id, p, m.color);",
  };
}
