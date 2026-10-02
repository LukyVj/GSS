import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance, Styles } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { closingParen } from "../../values/calc";
import { readNumber } from "../../values/values";
import { backgroundFunction, gradientLines, gradientMean, isGradient } from "../gradient";
import { glslFloat, label, type Hover } from "./glsl";
import { readColor, readFlatSize, readRadii, readSize } from "./read";
import { shapeRadius } from "./shapes";
import { spaceFunction } from "./transforms";

// The background: a constant color, or a gradient drawn over the canvas
export function backgroundCode(value: Token[] | undefined): string {
  if (isGradient(value)) return backgroundFunction(value);
  return `const vec3 BACKGROUND = ${readColor(value, "vec3(0.03)")};`;
}

// ----- Gradients on objects (decision 82) -----

// The gradient an object is painted with, from its color or the first argument of its
// material (which wins, like a material's own color), and its styles where that gradient
// is replaced by its mean color: what getMaterial() and the reflections see.
export function objectGradient(
  instance: StyledInstance,
  keyframes: Keyframes[],
  hover: Hover | undefined,
): { gradient: Token[] | null; styles: Styles } {
  const styles = instance.styles;
  const hash = (value: Token[]): Token => ({ type: "HASH", value: gradientMean(value) });
  let gradient: Token[] | null = null;
  let changed: Styles = styles;

  const color = styles["color"];
  if (isGradient(color)) {
    gradient = color;
    changed = { ...changed, color: [hash(color)] };
  }
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
    gradient = material.slice(2, end + 1);
    changed = { ...changed, material: [material[0], material[1], hash(gradient), ...material.slice(end + 1)] };
  }
  if (!gradient) return { gradient: null, styles };

  // A gradient is not animated: say so rather than ignore a color that would never show
  const name = styles["animation"]?.[0];
  const played = name?.type === "IDENT" ? keyframes.findLast((k) => k.name === name.value) : undefined;
  if (played?.frames.some((f) => f.declarations.some((d) => d.property === "color")))
    throw errorAt(styles["animation"], `${label(instance)} is painted with a gradient: its color cannot be animated`);
  if (hover && JSON.stringify(hover.styles["color"]) !== JSON.stringify(color))
    throw errorAt(hover.styles["color"] ?? gradient, `${label(instance)} is painted with a gradient: :hover cannot change its color`);
  return { gradient, styles: changed };
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
  painted: { instance: StyledInstance; gradient: Token[] }[],
  textured: Set<StyledInstance>,
  keyframes: Keyframes[],
  hoverOf: (instance: StyledInstance) => Hover | undefined,
) {
  if (painted.length === 0) return { functions: "", call: "" };
  const spaces = painted
    .filter(({ instance }) => !textured.has(instance)) // a textured object has its space already
    .map(({ instance }) => spaceFunction(instance, keyframes, hoverOf));
  const branches = painted.map(({ instance, gradient }) => {
    const { size, at } = gradientBox(instance);
    return [
      `  if (id == ${glslFloat(instance.index)}) {  // ${label(instance)}`,
      `    vec3 q = space${instance.index}(p);`,
      `    vec2 size = vec2(${size.map(glslFloat).join(", ")});`,
      `    vec2 at = ${at} + 0.5 * size;`,
      ...gradientLines(gradient).map((line) => `  ${line}`),
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
