import type { Token } from "../../syntax/tokenizer";
import type { Keyframes } from "../../syntax/ast";
import type { StyledInstance, Styles } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { closingParen } from "../../values/calc";
import { readAnimation } from "../../features/animation";
import {
  BACKGROUND_CAMERA,
  BACKGROUND_CANVAS,
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
import { BLEND_MODES } from "./blend-library";
import { NAMED_COLORS } from "../../values/named-colors";
import { readColor } from "./read";
import { add, g, largest, liveFlatSize, liveNumber, liveRadii, liveSize3, mul, type Num } from "./live";
import { shapeRadius } from "./shapes";
import { spaceFunction } from "./transforms";

// The background: a constant color, or a gradient drawn over the canvas. An animation of
// the scene changes either one (decision 103): the color is then computed at every pixel.
export function backgroundCode(styles: Styles, keyframes: Keyframes[]): string {
  const value = styles["background"];
  // Several layers, or transparent colors: composited like CSS (decision 112)
  if (usesLayers(value)) return layeredBackground(styles, keyframes);
  if (isGradient(value)) {
    const { gradient, moving } = movingGradient(styles, keyframes, "background", undefined);
    return backgroundFunction(gradient, moving);
  }
  refuseGradients(styles, keyframes, "background", undefined);
  // A variable set from JS is read at every pixel too (decision 105)
  const still = styles["background"]?.some((token) => token.type === "EXPR") ? "" : readColor(value, "vec3(0.03)");
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

// ----- The layers of background (decision 112) -----

// background: noise(…), linear-gradient(…), #102040 → each layer, the first on top
export function layersOf(value: Token[]): Token[][] {
  const layers: Token[][] = [[]];
  let depth = 0;
  for (const token of value) {
    if (token.type === "PUNCT" && token.value === "(") depth++;
    if (token.type === "PUNCT" && token.value === ")") depth--;
    if (depth === 0 && token.type === "PUNCT" && token.value === ",") layers.push([]);
    else layers[layers.length - 1].push(token);
  }
  return layers;
}

const transparent = (token: Token) =>
  (token.type === "HASH" && (token.value.length === 4 || token.value.length === 8)) ||
  (token.type === "IDENT" && token.value.toLowerCase() === "transparent");

// Several layers, or a transparent color in one: the layered background
export function usesLayers(value: Token[] | undefined): boolean {
  return !!value && (layersOf(value).length > 1 || value.some(transparent));
}

// Does the background need the camera at the start of main()? A gradient or layers do
export function backgroundNeedsCamera(value: Token[] | undefined): boolean {
  return isGradient(value) || usesLayers(value);
}

// The color under the layers: the last layer when it is a color, composited over the
// default background when it is transparent; the default background otherwise
const DEFAULT_BACKGROUND = [0.03, 0.03, 0.03];
function baseColor(layer: Token[] | undefined): string {
  const image: boolean = isGradient(layer); // a boolean: layer stays a list of tokens after it
  if (!layer || image) return "vec3(0.03)";
  const [token] = layer;
  if (layer.length === 1 && token.type === "EXPR") return token.code; // set from JS (decision 105)
  const word = token?.type === "IDENT" ? token.value.toLowerCase() : "";
  const hex = token?.type === "HASH" ? token.value : word === "transparent" ? "00000000" : NAMED_COLORS[word];
  const full = hex && (hex.length === 3 || hex.length === 4) ? [...hex].map((c) => c + c).join("") : hex;
  if (layer.length !== 1 || !full || !/^([0-9a-f]{6}|[0-9a-f]{8})$/i.test(full))
    throw errorAt(layer, "the last layer of background is a color or an image, like: background: noise(3, #ffffff00, #ffffff), #102040;");
  const a = full.length === 8 ? parseInt(full.slice(6), 16) / 255 : 1;
  const rgb = [0, 2, 4].map((i, k) => (parseInt(full.slice(i, i + 2), 16) / 255) * a + DEFAULT_BACKGROUND[k] * (1 - a));
  return `vec3(${rgb.map((c) => glslFloat(+c.toFixed(3))).join(", ")})`;
}

// background-blend-mode: one mode per layer, the list repeated over the layers, like CSS
function blendModes(value: Token[] | undefined, count: number): string[] {
  if (!value) return Array(count).fill("normal");
  const modes = layersOf(value).map((part) => {
    const [word] = part;
    if (part.length !== 1 || word.type !== "IDENT" || !(word.value in BLEND_MODES))
      throw errorAt(
        value,
        `background-blend-mode expects ${Object.keys(BLEND_MODES).join(", ")}, one per layer, like: background-blend-mode: multiply;`,
      );
    return word.value;
  });
  return Array.from({ length: count }, (_, i) => modes[i % modes.length]);
}

// The background in layers: each image in its own function, giving a premultiplied vec4;
// background() puts them over the base, from the bottom up, each with its blend mode
function layeredBackground(styles: Styles, keyframes: Keyframes[]): string {
  const value = styles["background"];
  const layers = layersOf(value);
  for (const layer of layers.slice(0, -1))
    if (!isGradient(layer))
      throw errorAt(layer, "only the last layer of background can be a color, like CSS: background: noise(3, #ffffff00, #ffffff), #102040;");
  for (const other of valuesOf(styles, keyframes, "background", undefined))
    if (layersOf(other).length !== layers.length)
      throw errorAt(
        other,
        `a background keeps its number of layers when it changes: ${layers.length} here, ${layersOf(other).length} there`,
      );
  const images = isGradient(layers[layers.length - 1]) ? layers : layers.slice(0, -1);
  const modes = blendModes(styles["background-blend-mode"], images.length);
  const base =
    images.length === layers.length
      ? "vec3(0.03)"
      : animatedValue(styles, keyframes, "background", (v) => baseColor(v ? layersOf(v)[layers.length - 1] : undefined));

  const functions = images.map((_, i) => {
    const { gradient, moving } = movingGradient(styles, keyframes, "background", undefined, { layer: i, alpha: true });
    return [
      `// Layer ${i + 1} of the background, from the top: a premultiplied color`,
      `vec4 backgroundLayer${i}(vec3 rd, vec2 at, vec2 size) {`,
      ...linesOf(gradient, moving, "rd"),
      "  return col;",
      "}",
    ].join("\n");
  });
  const blends = images
    .map((_, i) => i)
    .reverse() // from the bottom up
    .flatMap((i) => {
      const blend = BLEND_MODES[modes[i]];
      return [
        `  vec4 layer${i} = backgroundLayer${i}(rd, at, size);`,
        blend
          ? `  col = mix(col, ${blend}(col, unpremultiply(layer${i})), layer${i}.a); // ${modes[i]}`
          : `  col = col * (1.0 - layer${i}.a) + layer${i}.rgb; // over`,
      ];
    });
  return [
    ...BACKGROUND_CAMERA,
    "",
    ...functions.flatMap((code) => [code, ""]),
    "// The background: its layers over the last one, from the bottom up, like CSS",
    "vec3 background(vec3 rd) {",
    ...BACKGROUND_CANVAS,
    `  vec3 col = ${base};`,
    ...blends,
    "  return col;",
    "}",
    "#define BACKGROUND background(rd)",
  ].join("\n");
}

// ----- Animated gradients (decision 102) -----

// Every value a property takes: at rest, in the frames of its animation, and in each
// :hover or :active layer with the frames of theirs
export function valuesOf(styles: Styles, keyframes: Keyframes[], property: string, hover: Hover | undefined): Token[][] {
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
function sameKind(gradient: Gradient, value: Token[], alpha = false): Gradient {
  if (!isGradient(value))
    throw errorAt(value, `a gradient can only change into another gradient, not a color: write a ${gradient.name}() here too`);
  const other = readGradient(value, alpha);
  if (other.name !== gradient.name)
    throw errorAt(value, `a ${gradient.name}() can only change into another ${gradient.name}(), not a ${other.name}()`);
  if (other.shape !== gradient.shape)
    throw errorAt(
      value,
      gradient.noise
        ? `a noise() keeps its kind, its octaves and its seed when it changes: ${gradient.shape} here, ${other.shape} there`
        : `a radial-gradient() keeps the same shape and size when it changes: ${gradient.shape} here, ${other.shape} there`,
    );
  // displace() (decision 114): its map changes like a gradient, into one of the same kind
  if (!!other.displace !== !!gradient.displace)
    throw errorAt(
      value,
      gradient.displace
        ? "a displace() can only change into another displace(): write a displace() here too"
        : `a ${gradient.name}() can only change into another ${gradient.name}(), not a displace()`,
    );
  if (gradient.displace && other.displace) {
    const [map, next] = [gradient.displace.map, other.displace.map];
    if (next.name !== map.name || next.shape !== map.shape || next.stops.length !== map.stops.length)
      throw errorAt(value, `the map of a displace() can only change into another ${map.name}() of the same kind, with as many colors`);
  }
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
// options.layer: one layer of a background, options.alpha: its colors can be transparent (decision 112)
export function movingGradient(
  styles: Styles,
  keyframes: Keyframes[],
  property: string,
  hover: Hover | undefined,
  options: { layer?: number; alpha?: boolean } = {},
): { gradient: Gradient; moving: Map<string, string> } {
  const pick = (value: Token[]) => (options.layer === undefined ? value : layersOf(value)[options.layer]);
  const gradient = readGradient(pick(styles[property]), options.alpha);
  const others = valuesOf(styles, keyframes, property, hover).map((value) => sameKind(gradient, pick(value), options.alpha));
  const moving = new Map<string, string>();
  for (const key of channels(gradient)) {
    const still = channel(gradient, key);
    if (others.every((other) => channel(other, key) === still)) continue;
    moving.set(key, hoverValue(styles, keyframes, property, (value) => channel(readGradient(pick(value!), options.alpha), key), hover));
  }
  return { gradient, moving };
}

// ----- Gradients on objects (decision 82) -----

// alpha: the gradient has transparent stops (decision 117): its lines give a premultiplied vec4
export type Painted = { instance: StyledInstance; gradient: Gradient; moving: Map<string, string>; alpha?: boolean };

// Whether the color of an object is a gradient with transparent stops, at rest, in its
// frames or on :hover (decision 117)
export function paintsTransparent(styles: Styles, keyframes: Keyframes[], hover: Hover | undefined): boolean {
  return valuesOf(styles, keyframes, "color", hover).some(
    (value) => isGradient(value) && readGradient(value, true).stops.some((stop) => stop.color.startsWith("vec4(")),
  );
}

// The gradient an object is painted with, from its color or the first argument of its
// material (which wins, like a material's own color), and its styles where that gradient
// is replaced by its mean color: what getMaterial() and the reflections see.
// A gradient in color can be animated and changed by :hover (decision 102).
// transparent: the gradient has transparent stops (paintsTransparent(), decision 117)
export function objectGradient(
  instance: StyledInstance,
  keyframes: Keyframes[],
  hover: Hover | undefined,
  transparent = false,
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
  // Transparent stops make the object transparent where they are (decision 117)
  const alpha = transparent;
  const { gradient, moving } = movingGradient(styles, keyframes, "color", hover, { alpha });
  return { painted: { instance, gradient, moving, ...(alpha ? { alpha } : {}) }, styles: { ...styles, color: [hash(color)] } };
}

// The rectangle a gradient covers: the object seen from the front, x right and y up
// (seen from above for a plane, the top of the picture away from the camera).
// A size set from JS (decision 105) makes the rectangle follow it.
export function gradientBox(instance: StyledInstance): { size: Num[]; at: string } {
  const styles = instance.styles;
  const front = (w: Num, h: Num) => ({ size: [w, h], at: "q.xy" });
  switch (instance.tag) {
    case "cube": {
      const [x, y] = liveSize3(styles["size"]);
      return front(x, y);
    }
    case "sphere": {
      const d = mul(2, liveNumber(styles["radius"], "radius", 0.5));
      return front(d, d);
    }
    case "torus": {
      const r = liveNumber(styles["radius"], "radius", 1);
      const t = liveNumber(styles["thickness"], "thickness", 0.28);
      return front(mul(2, add(r, t)), mul(2, t));
    }
    case "cylinder":
    case "capsule":
      return front(
        mul(2, liveNumber(styles["radius"], "radius", instance.tag === "capsule" ? 0.25 : 0.5)),
        liveNumber(styles["height"], "height", 1),
      );
    case "cone":
      return front(mul(2, largest(...liveRadii(styles["radius"]))), liveNumber(styles["height"], "height", 1));
    case "plane": {
      const [w, d] = liveFlatSize(styles["size"]);
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
  // ret: what the branch gives back from col
  const branch = ({ instance, gradient, moving }: Painted, ret: string) => {
    const { size, at } = gradientBox(instance);
    return [
      `  if (id == ${glslFloat(instance.index)}) {  // ${label(instance)}`,
      `    vec3 q = space${instance.index}(p);`,
      `    vec2 size = vec2(${size.map(g).join(", ")});`,
      `    vec2 at = ${at} + 0.5 * size;`,
      ...linesOf(gradient, moving).map((line) => `  ${line}`),
      `    return ${ret};`,
      "  }",
    ].join("\n");
  };
  // A transparent gradient gives its color without its alpha, and paintAlpha() its alpha
  // (decision 117): its stops are premultiplied
  const branches = painted.map((p) => branch(p, p.alpha ? "col.a > 0.0 ? col.rgb / col.a : col.rgb" : "col"));
  const transparent = painted.filter((p) => p.alpha);
  return {
    functions: [
      ...spaces,
      ["vec3 gradientColor(float id, vec3 p, vec3 color) {", ...branches, "  return color;", "}"].join("\n"),
      ...(transparent.length > 0
        ? [
            [
              "// The transparent stops of a gradient: how much it covers at a point",
              "float paintAlpha(float id, vec3 p) {",
              ...transparent.map((p) => branch(p, "col.a")),
              "  return 1.0;",
              "}",
            ].join("\n"),
          ]
        : []),
    ].join("\n\n"),
    call: "    m.color = gradientColor(id, p, m.color);",
  };
}
