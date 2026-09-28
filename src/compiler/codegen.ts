import type { Token } from "./tokenizer";
import { errorAt, locate } from "./errors";
import { tokenize } from "./tokenizer";
import type { StyledInstance, Styles } from "./resolve";
import type { Keyframes } from "./ast";
import { readFunction } from "./values";
import { readSvgPath } from "./svgpath";
import { pathFunction, type ViewBox } from "./path";

// Utility functions
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// The GLSL function behind each operation
const OPERATIONS: Record<string, string> = {
  union: "opU",
  subtract: "opS",
  intersect: "opI",
};

// The smooth version of each operation, used when blend > 0
const SMOOTH: Record<string, string> = {
  opU: "opSmoothU",
  opS: "opSmoothS",
  opI: "opSmoothI",
};

// Reads "union", "subtract" or "intersect" and returns the GLSL function name
function readOperation(value: Token[] | undefined): string {
  // 1. Nothing written → union
  if (!value) return "opU";

  // 2. Look the name up in the table (only for an IDENT)
  const [token] = value;
  const operation =
    token.type === "IDENT" && Object.hasOwn(OPERATIONS, token.value)
      ? OPERATIONS[token.value]
      : undefined;

  // 3. Not found, or not exactly one value → error
  if (value.length !== 1 || !operation) {
    throw errorAt(
      value,
      "operation expects union, subtract or intersect, like: operation: subtract;",
    );
  }

  return operation;
}

// Shapes that need their own GLSL function (like path) add it here.
// The same code is only written once, whatever the number of objects using it.
type ShapeContext = { functions: Map<string, string> }; // GLSL code → function name

// "code" names its function NAME; returns the real name, shared with identical code
function useFunction(context: ShapeContext, code: string): string {
  const known = context.functions.get(code);
  if (known) return known;
  const name = `sdShape${context.functions.size}`;
  context.functions.set(code, name);
  return name;
}

// Reads d: path("M0 0 L1 1") and returns the string token of the path
function readD(value: Token[] | undefined): Token & { type: "STRING" } {
  const example = 'd: path("M0 0 C0 1 1 1 1 0");';
  if (!value) throw new Error(`path needs a d, like: ${example}`);
  const call = readFunction(value);
  const [arg] = call?.args ?? [];
  if (
    call?.name !== "path" ||
    call.args.length !== 1 ||
    arg.length !== 1 ||
    arg[0].type !== "STRING"
  ) {
    throw errorAt(value, `d expects path("…"), like: ${example}`);
  }
  return arg[0];
}

// Reads "0 0 32 32": min-x, min-y, width, height, like the viewBox of an SVG
function readViewBox(value: Token[] | undefined): ViewBox | null {
  if (!value) return null;
  const numbers = value.map((token) =>
    token.type === "NUMBER" ? token.value : NaN,
  );
  if (
    numbers.length !== 4 ||
    numbers.some(Number.isNaN) ||
    numbers[2] <= 0 ||
    numbers[3] <= 0
  ) {
    throw errorAt(
      value,
      "view-box expects four numbers: x, y, width and height, like: view-box: 0 0 32 32;",
    );
  }
  const [x, y, width, height] = numbers;
  return { x, y, width, height };
}

// The GLSL shape of each type of object. "q" is the point, already moved.
// Each shape turns the object's styles into GLSL. "q" is the point, already moved.
const SHAPES: Record<
  string,
  (styles: Styles, context: ShapeContext) => string
> = {
  cube: (styles) => {
    const half = readSize(styles["size"]).map((n) => n / 2);
    const corner = Math.min(
      readNumber(styles["corner-radius"], "corner-radius", 0.08, true),
      ...half,
    );
    return `sdRoundBox(q, ${vec3(half)}, ${glslFloat(corner)})`;
  },
  sphere: (styles) =>
    `sdSphere(q, ${glslFloat(readNumber(styles["radius"], "radius", 0.5))})`,
  torus: (styles) => {
    const radius = readNumber(styles["radius"], "radius", 1);
    const thickness = readNumber(styles["thickness"], "thickness", 0.28);
    return `sdTorus(q, vec2(${glslFloat(radius)}, ${glslFloat(thickness)}))`;
  },
  cylinder: (styles) => {
    const radius = readNumber(styles["radius"], "radius", 0.5);
    const height = readNumber(styles["height"], "height", 1);
    return `sdCylinder(q, ${glslFloat(height / 2)}, ${glslFloat(radius)})`;
  },
  cone: (styles) => {
    const [bottom, top] = readRadii(styles["radius"]);
    const height = readNumber(styles["height"], "height", 1);
    return `sdCappedCone(q, ${glslFloat(height / 2)}, ${glslFloat(bottom)}, ${glslFloat(top)})`;
  },
  // A tube along an SVG path (decision 35)
  path: (styles, context) => {
    const d = readD(styles["d"]);
    const width = readNumber(styles["stroke-width"], "stroke-width", 1);
    // Curves become segments that stay within a hundredth of the tube's width: smooth enough for the light
    const lines = locate(d, () => readSvgPath(d.value, width / 100)); // errors point at the path
    const viewBox = readViewBox(styles["view-box"]);
    const code = locate(styles["d"], () =>
      pathFunction("NAME", lines, width, viewBox),
    );
    const name = useFunction(context, code);
    return `${name}(q)`;
  },
};

// GLSL requires "1.0" and rejects "1" where it expects a float
function glslFloat(n: number): string {
  const text = String(n);
  return text.includes(".") || text.includes("e") ? text : `${text}.0`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Invalid color: #${hex}`);
  const channel = (start: number) =>
    round(parseInt(full.slice(start, start + 2), 16) / 255);
  return [channel(0), channel(2), channel(4)];
}

export function readTranslate(value: Token[] | undefined): string {
  if (!value) return "vec3(0.0)";
  const numbers = value.map((token) => {
    if (token.type !== "NUMBER")
      throw errorAt(
        value,
        "translate expects three numbers, like: translate: 0 1 0;",
      );
    return token.value;
  });
  if (numbers.length !== 3)
    throw errorAt(
      value,
      "translate expects three numbers, like: translate: 0 1 0;",
    );
  return `vec3(${numbers.map(glslFloat).join(", ")})`;
}
// Reads one number, or returns the fallback when the property is not set
export function readNumber(
  value: Token[] | undefined,
  property: string,
  fallback: number,
  allowZero = false,
): number {
  if (!value) return fallback;
  const [token] = value;
  if (
    value.length !== 1 ||
    token.type !== "NUMBER" ||
    token.value < 0 ||
    (token.value === 0 && !allowZero)
  ) {
    throw errorAt(
      value,
      `${property} expects one positive number, like: ${property}: 2;`,
    );
  }
  return token.value;
}

// Reads "2" or "2 1 1" and returns the full size on x, y and z
function readSize(value: Token[] | undefined): number[] {
  const errorMessage =
    "size expects one or three positive numbers, like: size: 2 1 1;";
  if (!value) return [1, 1, 1];
  const numbers = value.map((token) => {
    if (token.type !== "NUMBER" || token.value <= 0)
      throw errorAt(token, errorMessage);
    return token.value;
  });

  if (numbers.length === 1) return [numbers[0], numbers[0], numbers[0]];
  if (numbers.length === 3) return numbers;
  throw errorAt(value, errorMessage);
}

// Reads "0.5" or "0.5 0.2" and returns the bottom and top radii of a cone
function readRadii(value: Token[] | undefined): number[] {
  const errorMessage =
    "radius expects one or two positive numbers, like: radius: 0.5 0.2;";
  if (!value) return [0.5, 0];
  const numbers = value.map((token) => {
    if (token.type !== "NUMBER" || token.value < 0)
      throw errorAt(token, errorMessage);
    return token.value;
  });

  if (numbers.length === 1) return [numbers[0], 0];
  if (numbers.length === 2) return numbers;
  throw errorAt(value, errorMessage);
}

function readScale(value: Token[] | undefined): string {
  return glslFloat(readNumber(value, "scale", 1));
}

function vec3(values: number[]): string {
  return `vec3(${values.map(glslFloat).join(", ")})`;
}

function readColor(value: Token[] | undefined, fallback = "vec3(0.9)"): string {
  if (!value) return fallback;
  const [token] = value;
  if (value.length !== 1 || token.type !== "HASH") {
    throw errorAt(
      value,
      "color expects a hexadecimal color, like: color: #ff5a36;",
    );
  }
  const rgb = locate(token, () => hexToRgb(token.value));
  return `vec3(${rgb.map(glslFloat).join(", ")})`;
}

// Material keywords: shortcuts written in GSS
const MATERIAL_KEYWORDS: Record<string, string> = {
  gold: "metal(#d4af37, 0.2)",
  chrome: "metal(#ffffff, 0.05)",
  jelly: "jelly()",
  glass: "glass()",
  ice: "glass(#cfeaff, 1.31, frosted 0.25)",
};

// "matte(), metal(), jelly(), gold, chrome, jelly"
function availableMaterials(): string {
  return [
    "matte()",
    "metal()",
    "jelly()",
    "glass()",
    ...Object.keys(MATERIAL_KEYWORDS),
  ].join(", ");
}

// The frost styles of glass(). Each one is a GLSL constant: HAMMERED…
const FROST_STYLES = ["frosted", "wavy", "hammered", "blurred"];

// Reads the frost argument of glass(): "0.4", "hammered 0.4", "0.4 hammered" or "hammered".
// Returns the GLSL for the last two values of glass(): "0.4, HAMMERED"
function readFrost(arg: Token[] | undefined): string {
  // 1. No frost written → clear glass
  if (!arg) return "0.0, FROSTED";

  // 2. Read the tokens, in any order: at most one style and one amount
  let style = "frosted";
  let amount: number | null = null; // null = not written yet
  for (const token of arg) {
    if (token.type === "IDENT") {
      if (!FROST_STYLES.includes(token.value)) {
        throw errorAt(
          token,
          `Unknown frost style "${token.value}". Available: ${FROST_STYLES.join(", ")}`,
        );
      }
      style = token.value;
    } else if (
      token.type === "NUMBER" &&
      token.value >= 0 &&
      token.value <= 1
    ) {
      amount = token.value;
    } else {
      throw errorAt(
        token,
        "glass(): frost expects a number between 0 and 1 and an optional style, like: material: glass(#ffffff, 1.5, hammered 0.4);",
      );
    }
  }

  // 3. A style without an amount → 0.5
  if (amount === null) amount = 0.5;

  return `${glslFloat(amount)}, ${style.toUpperCase()}`; // "frosted" → "FROSTED"
}

type Setting = { name: string; min: number; max: number; fallback: number };

// Reads the settings of a material, in order. A missing setting takes its fallback.
// args: what's left once the color is taken out.
function readSettings(
  args: Token[][],
  material: string,
  settings: Setting[],
): number[] {
  // 1. The example for the error messages, computed once
  const fallbacks = settings.map((setting) => setting.fallback).join(", ");
  const example = `material: ${material}(#ff5a36, ${fallbacks});`;

  // 2. Too many arguments
  if (args.length > settings.length) {
    const names = settings.map((setting) => `a ${setting.name}`).join(" and ");
    throw errorAt(
      args.flat(),
      `${material}() expects an optional color and ${names}, like: ${example}`,
    );
  }

  // 3. Each setting: its argument, or its fallback when it's missing
  return settings.map((setting, i) => {
    if (!args[i]) return setting.fallback;

    const token = args[i][0];
    if (
      token.type !== "NUMBER" ||
      token.value < setting.min ||
      token.value > setting.max
    ) {
      throw errorAt(
        args[i],
        `${material}(): ${setting.name} expects a number between ${setting.min} and ${setting.max}, like: ${example}`,
      );
    }
    return token.value;
  });
}
// Turns the material value into GLSL.
// "color" is the object's GLSL color: a material without its own color uses it,
// like currentColor in CSS.
function readMaterial(value: Token[] | undefined, color: string): string {
  // 1. Nothing written → matte, with the color of color
  if (!value) return `matte(${color})`;

  // 1b. A keyword: replace it with its function, then read that
  if (value.length === 1 && value[0].type === "IDENT") {
    const name = value[0].value;
    if (!Object.hasOwn(MATERIAL_KEYWORDS, name)) {
      throw errorAt(
        value,
        `Unknown material "${name}". Available: ${availableMaterials()}`,
      );
    }
    return readMaterial(tokenize(MATERIAL_KEYWORDS[name]), color);
  }

  // 2. It must be a function
  const call = readFunction(value);
  if (!call) {
    throw errorAt(
      value,
      "material expects a function, like: material: matte();",
    );
  }

  // 3. Known names
  if (
    call.name !== "matte" &&
    call.name !== "metal" &&
    call.name !== "jelly" &&
    call.name !== "glass"
  ) {
    throw errorAt(
      value,
      `Unknown material "${call.name}". Available: ${availableMaterials()}`,
    );
  }

  // 4. The optional color comes first: if it's there, take it out of the list
  const args = [...call.args]; // a copy, so shift() does not touch call.args
  let ownColor = color;
  if (args.length > 0 && args[0][0].type === "HASH") {
    ownColor = readColor(args.shift());
  }

  // 5. matte: nothing may be left
  if (call.name === "matte") {
    if (args.length > 0) {
      throw errorAt(
        value,
        "matte() expects only an optional color, like: material: matte(#ff5a36);",
      );
    }
    return `matte(${ownColor})`;
  }

  // 6. metal: what's left is the roughness, 0.2 when missing
  if (call.name === "metal") {
    const roughness = readSettings(args, "metal", [
      { name: "roughness", min: 0, max: 1, fallback: 0.2 },
    ]);
    return `metal(${ownColor}, ${glslFloat(roughness[0])})`;
  }

  if (call.name === "jelly") {
    // 7. jelly: what's left is the density, 0.5 when missing
    const density = readSettings(args, "jelly", [
      { name: "density", min: 0, max: 1, fallback: 0.5 },
    ]);
    return `jelly(${ownColor}, ${glslFloat(density[0])})`;
  }

  if (call.name === "glass") {
    if (args.length > 2) {
      throw errorAt(
        value,
        "glass() expects an optional color and a refraction index and a frost, like: material: glass(#ffffff, 1.5, hammered 0.4);",
      );
    }
    const [ior] = readSettings(args.slice(0, 1), "glass", [
      { name: "refraction index", min: 1, max: 3, fallback: 1.5 },
    ]);
    const frost = readFrost(args[1]);
    return `glass(${ownColor}, ${glslFloat(ior)}, ${frost})`;
  }

  return `matte(${ownColor})`;
}

export function readAngle(value: Token[]): number {
  const [token] = value;

  // One token expected
  if (value.length !== 1) {
    throw errorAt(value, "An angle is expected, like: 70deg");
  }

  // Special case: 0 without unit is accepted, like in CSS
  if (token.type === "NUMBER" && token.value === 0) {
    return 0;
  }

  // Everything else must have a unit
  if (token.type !== "DIMENSION") {
    throw errorAt(value, "An angle must have a unit, like: 70deg");
  }

  // The units
  if (token.unit === "deg") return (token.value * Math.PI) / 180;
  if (token.unit === "rad") return token.value;
  if (token.unit === "turn") return token.value * 2 * Math.PI;

  throw errorAt(
    value,
    `Unknown angle unit: "${token.unit}". Use deg, rad or turn.`,
  );
}

// Reads "azimuth elevation" and returns the direction toward the sun
function readLight(value: Token[] | undefined): number[] {
  if (!value) return [0.408, 0.816, 0.408];
  if (value.length !== 2) {
    throw errorAt(value, "light expects two angles, like: light: 45deg 60deg;");
  }
  const azimuth = readAngle([value[0]]);
  const elevation = readAngle([value[1]]);

  return [
    round(Math.cos(elevation) * Math.sin(azimuth)),
    round(Math.sin(elevation)),
    round(Math.cos(elevation) * Math.cos(azimuth)),
  ];
}

// rotate-x rotates y and z, rotate-y rotates x and z, rotate-z rotates x and y
const ROTATIONS: [string, string][] = [
  ["rotate-x", "yz"],
  ["rotate-y", "xz"],
  ["rotate-z", "xy"],
];

// An angle in radians for GLSL, or "0.0" when there is no rotation
function readRotation(value: Token[] | undefined): string {
  return value ? glslFloat(round(readAngle(value))) : "0.0";
}

function rotationLines(
  instance: StyledInstance,
  keyframes: Keyframes[],
): string[] {
  const lines: string[] = [];
  for (const [property, axes] of ROTATIONS) {
    const angle = animatedValue(
      instance.styles,
      keyframes,
      property,
      readRotation,
    );
    if (angle === "0.0") continue; // no rotation on this axis
    lines.push(`  q.${axes} *= rot(${angle});`);
  }
  return lines;
}

function label(instance: StyledInstance): string {
  const id = instance.id ? `#${instance.id}` : "";
  const classes = instance.classes.map((c) => `.${c}`).join("");
  return `${instance.tag}${id}${classes}`;
}

// "2s" or "500ms" → seconds
function readDuration(value: Token[]): number {
  for (const token of value) {
    if (token.type === "DIMENSION" && token.unit === "s") return token.value;
    if (token.type === "DIMENSION" && token.unit === "ms")
      return token.value / 1000;
  }
  throw errorAt(
    value,
    "animation needs a duration, like: animation: float 2s;",
  );
}

function hasKeyword(value: Token[], word: string): boolean {
  return value.some((token) => token.type === "IDENT" && token.value === word);
}

// A GLSL expression that goes from 0 to 1 over time
// A GLSL expression that goes from 0 to 1 over time, at constant speed
function animationProgress(value: Token[]): string {
  const time = `iTime / ${glslFloat(readDuration(value))}`;
  return hasKeyword(value, "alternate")
    ? `(1.0 - abs(mod(${time}, 2.0) - 1.0))` // 0 → 1 → 0 → 1 …
    : `fract(${time})`; // 0 → 1, 0 → 1 …
}
// Applies the timing curve to a progress between 0 and 1
function easing(value: Token[], progress: string): string {
  if (hasKeyword(value, "ease-in-out"))
    return `smoothstep(0.0, 1.0, ${progress})`;
  return progress; // linear
}

// from → 0, to → 1, 50% → 0.5
function readOffset(token: Token, name: string): number {
  if (token.type === "IDENT" && token.value === "from") return 0;
  if (token.type === "IDENT" && token.value === "to") return 1;
  if (token.type === "PERCENTAGE" && token.value >= 0 && token.value <= 100) {
    return token.value / 100;
  }
  throw errorAt(
    token,
    `@keyframes ${name}: expected from, to or a percentage between 0% and 100%`,
  );
}

// A property's value: fixed, or changing over time with the animation.
// "read" turns the GSS value into GLSL (readTranslate, readScale, readColor…)
function animatedValue(
  styles: Styles,
  keyframes: Keyframes[],
  property: string,
  read: (value: Token[] | undefined) => string,
): string {
  const own = read(styles[property]);
  const animation = styles["animation"];
  if (!animation) return own;

  const [name] = animation;
  // Like in CSS, if two @keyframes have the same name, the last one wins
  const found = keyframes.findLast((k) => k.name === name.value);
  if (!found) throw errorAt(name, `No @keyframes named "${name.value}"`);

  // Every moment where the animation sets this property
  const byOffset = new Map<number, string>();
  for (const frame of found.frames) {
    const declaration = frame.declarations.find((d) => d.property === property);
    if (!declaration) continue; // this frame animates something else
    for (const token of frame.offsets) {
      // Same offset twice: the last one wins, like in CSS
      byOffset.set(readOffset(token, found.name), read(declaration.value));
    }
  }
  if (byOffset.size === 0) return own; // this animation does not touch this property

  // Like in CSS, a missing 0% or 100% uses the object's own value
  if (!byOffset.has(0)) byOffset.set(0, own);
  if (!byOffset.has(1)) byOffset.set(1, own);
  const stops = [...byOffset]
    .map(([offset, value]) => ({ offset, value }))
    .sort((a, b) => a.offset - b.offset);

  // Chain of mix: each segment takes over when the previous one is done
  const progress = animationProgress(animation);
  let result = stops[0].value;
  for (let i = 1; i < stops.length; i++) {
    const start = stops[i - 1].offset;
    const length = round(stops[i].offset - start);
    const local = `clamp((${progress} - ${glslFloat(start)}) / ${glslFloat(length)}, 0.0, 1.0)`;
    result = `mix(${result}, ${stops[i].value}, ${easing(animation, local)})`;
  }
  return result;
}

export function generateShader(
  instances: StyledInstance[],
  sceneStyles: Styles = {},
  keyframes: Keyframes[] = [],
): string {
  const context: ShapeContext = { functions: new Map() };
  const mapLines = instances.map((instance) => {
    const shape = SHAPES[instance.tag];
    if (!shape) {
      throw new Error(
        `Unknown object: "${instance.tag}". Available: ${Object.keys(SHAPES).join(", ")}`,
      );
    }
    const shapeCode = shape(instance.styles, context);
    const scale = animatedValue(instance.styles, keyframes, "scale", readScale);

    const operation = readOperation(instance.styles["operation"]);
    const blend = readNumber(instance.styles["blend"], "blend", 0, true);
    const shapeValue = `vec2(${shapeCode} * ${scale}, ${glslFloat(instance.index)})`;

    const combine =
      blend > 0
        ? `${SMOOTH[operation]}(res, ${shapeValue}, ${glslFloat(blend)})`
        : `${operation}(res, ${shapeValue})`;

    return [
      ` // ${label(instance)}`,
      ` q = p - ${animatedValue(instance.styles, keyframes, "translate", readTranslate)};`,
      ...rotationLines(instance, keyframes),
      ` q /= ${scale};`,
      ` res = ${combine};`,
    ].join("\n");
  });

  const materialLines = instances.map((instance) => {
    const color = animatedValue(instance.styles, keyframes, "color", readColor);
    const material = readMaterial(instance.styles["material"], color);
    return `  if (id == ${glslFloat(instance.index)}) return ${material};  // ${label(instance)}`;
  });

  // floor: none moves the floor infinitely far away
  const floor = sceneStyles["floor"];
  const noFloor =
    floor?.length === 1 &&
    floor[0].type === "IDENT" &&
    floor[0].value === "none";

  // ambient: the share of light received in the shadow; the sun gives the rest
  const ambient = readNumber(sceneStyles["ambient"], "ambient", 0.1, true);
  if (ambient > 1) {
    throw errorAt(
      sceneStyles["ambient"],
      "ambient expects a number between 0 and 1, like: ambient: 0.3;",
    );
  }
  const direct = round(1 - ambient);

  // The functions of the shapes, each with its own name
  const functions = [...context.functions]
    .map(([code, name]) => code.replaceAll("NAME", name))
    .join("\n\n");

  return TEMPLATE.replace("/*@SHAPES*/", functions)
    .replace("/*@MAP*/", mapLines.join("\n\n"))
    .replace("/*@MATERIALS*/", materialLines.join("\n"))
    .replace(
      "/*@FLOOR*/",
      noFloor ? "vec3(0.0)" : readColor(floor, "vec3(0.91, 0.89, 0.86)"),
    )
    .replace("/*@FLOOR_DISTANCE*/", noFloor ? "1e10" : "p.y")
    .replace("/*@LIGHT*/", vec3(readLight(sceneStyles["light"])))
    .replace("/*@AMBIENT*/", glslFloat(ambient))
    .replace("/*@DIRECT*/", glslFloat(direct))
    .replace(
      "/*@CAMERA_TARGET*/",
      sceneStyles["camera-target"]
        ? readTranslate(sceneStyles["camera-target"])
        : "vec3(0.0, 0.5, 0.0)",
    )
    .replace(
      "/*@BACKGROUND*/",
      readColor(sceneStyles["background"], "vec3(0.03)"),
    );
}

// The shader skeleton. Only the /*@...*/ parts change from one scene to the next.
const TEMPLATE = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec2 uCamera;
uniform float uDist;

out vec4 outColor;

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdCylinder(vec3 p, float h, float r) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// r1 = radius at the bottom, r2 = radius at the top, h = half the height
float sdCappedCone(vec3 p, float h, float r1, float r2) {
  vec2 q = vec2(length(p.xz), p.y);
  vec2 k1 = vec2(r2, h);
  vec2 k2 = vec2(r2 - r1, 2.0 * h);
  vec2 ca = vec2(q.x - min(q.x, (q.y < 0.0) ? r1 : r2), abs(q.y) - h);
  vec2 cb = q - k1 + k2 * clamp(dot(k1 - q, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}

// For path objects: squared distances to a segment and to a box, in 2D
float segment2(vec2 p, vec2 a, vec2 b) {
  vec2 ap = p - a, ab = b - a;
  vec2 v = ap - ab * clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
  return dot(v, v);
}

float box2(vec2 p, vec2 center, vec2 halfSize) {
  vec2 v = max(abs(p - center) - halfSize, 0.0);
  return dot(v, v);
}

// Shapes written by GSS (path…)
/*@SHAPES*/

// ----- Materials -----
// Which lighting main() uses for the surface
const int MATTE = 0;
const int METAL = 1;
const int JELLY = 2;
const int GLASS = 3;

// The frost styles of glass
const int FROSTED = 0;
const int WAVY = 1;
const int HAMMERED = 2;
const int BLURRED = 3;

struct Material {
  vec3 color;
  int kind;        // MATTE or METAL or JELLY or GLASS
  float roughness;
  float density;
  float ior;
  int frostStyle;
};

Material matte(vec3 color) {
  return Material(color, MATTE, 0.0, 0.0, 1.0, FROSTED);
}

Material metal(vec3 color, float roughness) {
  return Material(color, METAL, roughness, 0.0, 1.0, FROSTED);
}

Material jelly(vec3 color, float density) {
  return Material(color, JELLY, 0.0, density, 1.0, FROSTED);
}

Material glass(vec3 color, float ior, float frost, int frostStyle) {
  return Material(color, GLASS, frost, 0.0, ior, frostStyle);
}

// ----- Rotations -----
mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

vec2 opU(vec2 a, vec2 b) {
  return (a.x < b.x) ? a : b;
}

// Carves b out of a. The walls of the hole take b's material.
vec2 opS(vec2 a, vec2 b) {
  return (-b.x > a.x) ? vec2(-b.x, b.y) : a;
}

// Keeps only what is inside both a and b
vec2 opI(vec2 a, vec2 b) {
  return (a.x > b.x) ? a : b;
}

// Smooth versions (Inigo Quilez). k is the blend distance.
// h tells which side wins at this point: 0 → b (the new object), 1 → a (what was there).
vec2 opSmoothU(vec2 a, vec2 b, float k) {
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  float d = mix(b.x, a.x, h) - k * h * (1.0 - h);
  return vec2(d, h > 0.5 ? a.y : b.y);
}

vec2 opSmoothS(vec2 a, vec2 b, float k) {
  float h = clamp(0.5 - 0.5 * (a.x + b.x) / k, 0.0, 1.0);
  float d = mix(a.x, -b.x, h) + k * h * (1.0 - h);
  return vec2(d, h > 0.5 ? b.y : a.y);
}

vec2 opSmoothI(vec2 a, vec2 b, float k) {
  float h = clamp(0.5 - 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  float d = mix(b.x, a.x, h) + k * h * (1.0 - h);
  return vec2(d, h > 0.5 ? a.y : b.y);
}

// ----- Generated by GSS -----
vec2 map(vec3 p) {
  vec2 res = vec2(1e10, 0.0); // nothing yet
  vec3 q;

/*@MAP*/

  res = opU(res, vec2(/*@FLOOR_DISTANCE*/, 0.0)); // the floor: id 0
  return res;
}

Material getMaterial(float id) {
  /*@MATERIALS*/
  return matte(/*@FLOOR*/);  // the floor
}
// ----- End of generated code -----
const float MAX_DIST = 20.0;
const vec3 BACKGROUND = /*@BACKGROUND*/;
const vec3 LIGHT_DIR = /*@LIGHT*/;

vec2 march(vec3 ro, vec3 rd) {
  float t = 0.0;
  float id = 0.0;
  for (int i = 0; i < 100; i++) {
    vec2 res = map(ro + rd * t);
    id = res.y;
    t += res.x;
    if (res.x < 0.001 || t > MAX_DIST) break;
  }

  return vec2(t,id);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    map(p + e.xyy).x - map(p - e.xyy).x,
    map(p + e.yxy).x - map(p - e.yxy).x,
    map(p + e.yyx).x - map(p - e.yyx).x
  ));
}

// The sun and the ambient light on a surface
vec3 diffuse(vec3 n, vec3 color) {
  float diff = max(dot(n, LIGHT_DIR), 0.0);
  return color * (/*@AMBIENT*/ + /*@DIRECT*/ * diff);
}

// What a ray sees, with diffuse lighting only.
// Reflections use it: one bounce, never more.
vec3 trace(vec3 ro, vec3 rd) {
  vec2 hit = march(ro, rd);
  if (hit.x > MAX_DIST) return BACKGROUND;  // the ray hit nothing

  vec3 p = ro + rd * hit.x;  // the point that was hit
  vec3 n = calcNormal(p);
  return diffuse(n, getMaterial(hit.y).color);  // its color, lit
}

// Schlick's approximation of Fresnel: surfaces reflect more at grazing angles.
// f0 = the color of the reflection seen from the front.
vec3 fresnel(vec3 f0, vec3 rd, vec3 n) {
  float c = 1.0 - max(dot(-rd, n), 0.0); // 0 = seen from the front, 1 = grazing
  return f0 + (1.0 - f0) * pow(c, 5.0);
}

// A metal reflects the scene, tinted by its color.
// Roughness mixes the sharp reflection with diffuse light: a cheap blur.
vec3 shadeMetal(vec3 p, vec3 n, vec3 rd, Material m) {
  // 1. The reflection
  vec3 r = reflect(rd, n);
  vec3 reflected = trace(p + n * 0.01, r);

  // 2. Roughness: from sharp (0) to blurry (1)
  vec3 blurry = diffuse(n, vec3(0.6));
  vec3 env = mix(reflected, blurry, m.roughness);

  // 3. The sun's highlight: small when smooth, wide when rough
  float shine = pow(max(dot(r, LIGHT_DIR), 0.0), mix(200.0, 8.0, m.roughness));

  // 4. Everything together
  return env * fresnel(m.color, rd, n) + diffuse(n, m.color) * 0.3 + shine * (1.0 - m.roughness);
}

// How much matter is behind p? A few steps inside, along -n.
// Inside an object, map() is negative. 0 = thin edge, 1 = deep inside.
float thickness(vec3 p, vec3 n) {
  float inside = 0.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.1 * float(i);
    float d = map(p - n * h).x;
    inside += clamp(-d / h, 0.0, 1.0);
  }
  return inside / 5.0;
}

// Jelly: light goes through its thin parts and glows.
vec3 shadeJelly(vec3 p, vec3 n, vec3 rd, Material m) {
  // 1. Light that goes through: strong where it's thin, weak where it's deep.
  //    density makes the jelly darker faster.
  float thick = thickness(p, n);
  float through = exp(-thick * mix(0.5, 4.0, m.density));

  // 2. Soft light that wraps around the object: no hard shadow side
  float wrap = dot(n, LIGHT_DIR) * 0.5 + 0.5;
  vec3 body = m.color * (0.2 + 0.5 * wrap);

  // 3. The glow of the light scattered inside
  vec3 glow = m.color * through * 1.1;

  // 4. A soft highlight, and a bright rim on the edges
  vec3 r = reflect(rd, n);
  float shine = pow(max(dot(r, LIGHT_DIR), 0.0), 30.0) * 0.5;
  float rim = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);

  return body + glow + shine + mix(m.color, vec3(1.0), 0.5) * rim * 0.4;
}

// A pseudo-random vec3 between 0 and 1, from a position.
// The same position always gives the same result.
vec3 hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

// Smooth noise: random values on a grid, blended between the grid points.
// Unlike hash3(), two points close together get close values.
float noise(vec3 p) { 
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i).x,                 hash3(i + vec3(1, 0, 0)).x, f.x),
        mix(hash3(i + vec3(0, 1, 0)).x, hash3(i + vec3(1, 1, 0)).x, f.x), f.y),
    mix(mix(hash3(i + vec3(0, 0, 1)).x, hash3(i + vec3(1, 0, 1)).x, f.x),
        mix(hash3(i + vec3(0, 1, 1)).x, hash3(i + vec3(1, 1, 1)).x, f.x), f.y),
    f.z);
}

// A smooth random vector between -0.5 and 0.5, with two sizes of bumps
vec3 bump(vec3 p, float scale) { 
  vec3 q = p * scale;
    vec3 b = vec3(noise(q), noise(q + 17.0), noise(q + 41.0)) - 0.5;
    b += (vec3(noise(q * 2.7), noise(q * 2.7 + 5.0), noise(q * 2.7 + 9.0)) - 0.5) * 0.5;
    return b;
}

// The settings of each frost style:
// x = size of the bumps, y = their strength, z = how much white frosted layer
vec3 frostSettings(int style) {
  if (style == WAVY)     return vec3(7.0, 0.45, 0.0);
  if (style == HAMMERED) return vec3(20.0, 0.3, 0.0);
  if (style == BLURRED)  return vec3(9.0, 0.35, 0.0);
  return vec3(9.0, 0.6, 0.5);          // FROSTED, the default
}

// Like march(), but inside an object, where map() is negative.
// Returns how far the ray goes before it comes out.
float marchInside(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < 64; i++) {
    float d = -map(ro + rd * t).x;                          // ← the distance to the edge, from inside
    t += max(d, 0.002);                     // always move a little, even at the edge
    if (d < 0.001 || t > MAX_DIST) break;   // reached the other side
  }
  return t;                               // ← how far the ray went
}

// Glass: the ray bends in, crosses the object, bends out, and shows what's behind.
// Frost bumps the normals with smooth noise: what's behind gets distorted.
vec3 shadeGlass(vec3 p, vec3 n, vec3 rd, Material m) {
  float frost = m.roughness;
  vec3 fs = frostSettings(m.frostStyle);

  // 1. In: air → glass, through a bumped surface
  vec3 fn = normalize(n + bump(p, fs.x) * frost * fs.y);
  vec3 inDir = refract(rd, fn, 1.0 / m.ior);

  // 2. Through: start just inside, march to the other side
  vec3 start = p - n * 0.01;
  float t = marchInside(start, inDir);
  vec3 exitP = start + inDir * t;
  vec3 exitN = calcNormal(exitP);

  // 3. Out: glass → air, through the bumped surface on the other side
  vec3 exitFn = normalize(exitN + bump(exitP, fs.x) * frost * fs.y);
  vec3 outDir = refract(inDir, -exitFn, m.ior);
  // Total internal reflection: with bumped normals, bouncing back makes
  // black spots, so the ray just goes on straight
  if (outDir == vec3(0.0)) outDir = inDir;

  // 4. Behind: what the ray sees once it's out, tinted by the glass
  vec3 behind = trace(exitP + exitN * 0.01, outDir);
  vec3 through = behind * m.color;

  // 5a. frosted: a white, patchy layer over what's behind
  if (fs.z > 0.0) {
    float patches = noise(p * 6.0) * 0.6 + noise(p * 18.0) * 0.4;
    vec3 frostLayer = diffuse(n, mix(m.color, vec3(1.0), 0.6)) * (0.7 + 0.6 * patches);
    through = mix(through, frostLayer, frost * fs.z);
  }

  // 5b. blurred: 3 more rays in a fixed cross, a tint, light on the bumps, speckles
  if (m.frostStyle == BLURRED && frost > 0.0) {
    // Blur: the first ray plus 3 more, bent a little around outDir.
    // Fixed offsets, not random: a smooth blur, no grain.
    vec3 tangent = normalize(cross(outDir, vec3(0.0, 1.0, 0.0)) + vec3(1e-4));
    vec3 bitangent = cross(outDir, tangent);
    float spread = frost * 0.12;
    vec3 sum = through;
    sum += trace(exitP + exitN * 0.01, normalize(outDir + tangent * spread)) * m.color;
    sum += trace(exitP + exitN * 0.01, normalize(outDir - tangent * spread + bitangent * spread)) * m.color;
    sum += trace(exitP + exitN * 0.01, normalize(outDir - bitangent * spread)) * m.color;
    through = sum / 4.0;
    // Tint: a bit of light grey, like milky glass
    through = mix(through, vec3(0.85, 0.88, 0.92), frost * 0.35);
    // Light on the bumps (the "diff" of the Godot shader)
    through += max(dot(bump(p, fs.x), LIGHT_DIR), 0.0) * frost * 0.6;
    // Speckles, stuck to the surface
    through += hash3(floor(p * 160.0)).x * frost * 0.12;
  }

  // 6. The reflection on the surface: weak from the front, strong at grazing angles
  vec3 r = reflect(rd, n);
  vec3 reflected = trace(p + n * 0.01, r);
  float f = fresnel(vec3(0.04), rd, n).x;
  vec3 col = mix(through, reflected, f);

  // 7. Frosted glass glows a little, like jelly, and a sharp highlight
  col += m.color * exp(-thickness(p, n) * 2.0) * frost * 0.5;
  col += pow(max(dot(r, LIGHT_DIR), 0.0), 120.0);
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

  vec3 target = /*@CAMERA_TARGET*/;
  float yaw = uCamera.x;
  float pitch = uCamera.y;
  vec3 ro = target + uDist * vec3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw));
  vec3 forward = normalize(target - ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);
  vec3 rd = normalize(uv.x * right + uv.y * up + 1.5 * forward);

  vec2 hit = march(ro, rd);
  float t = hit.x;
  float id = hit.y;

  vec3 col = BACKGROUND;
    if (t < MAX_DIST) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    Material m = getMaterial(id);
    col = diffuse(n, m.color);
    if (m.kind == METAL) col = shadeMetal(p, n, rd, m);
    if (m.kind == JELLY) col = shadeJelly(p, n, rd, m);
    if (m.kind == GLASS) col = shadeGlass(p, n, rd, m);
  }

  outColor = vec4(col, 1.0);
}
`;
