import type { Token } from "./tokenizer";
import type { StyledInstance, Styles } from "./resolve";
import type { Keyframes } from "./ast";

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
    throw new Error(
      "operation expects union, subtract or intersect, like: operation: subtract;",
    );
  }

  return operation;
}

// The GLSL shape of each type of object. "q" is the point, already moved.
// Each shape turns the object's styles into GLSL. "q" is the point, already moved.
const SHAPES: Record<string, (styles: Styles) => string> = {
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
      throw new Error(
        "translate expects three numbers, like: translate: 0 1 0;",
      );
    return token.value;
  });
  if (numbers.length !== 3)
    throw new Error("translate expects three numbers, like: translate: 0 1 0;");
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
    throw new Error(
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
      throw new Error(errorMessage);
    return token.value;
  });

  if (numbers.length === 1) return [numbers[0], numbers[0], numbers[0]];
  if (numbers.length === 3) return numbers;
  throw new Error(errorMessage);
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
    throw new Error("color expects a hexadecimal color, like: color: #ff5a36;");
  }
  return `vec3(${hexToRgb(token.value).map(glslFloat).join(", ")})`;
}

// ⬇️ TA MISSION : convert a GSS angle to radians
export function readAngle(value: Token[]): number {
  const [token] = value;

  // One token expected
  if (value.length !== 1) {
    throw new Error("An angle is expected, like: 70deg");
  }

  // Special case: 0 without unit is accepted, like in CSS
  if (token.type === "NUMBER" && token.value === 0) {
    return 0;
  }

  // Everything else must have a unit
  if (token.type !== "DIMENSION") {
    throw new Error("An angle must have a unit, like: 70deg");
  }

  // The units
  if (token.unit === "deg") return (token.value * Math.PI) / 180;
  if (token.unit === "rad") return token.value;
  if (token.unit === "turn") return token.value * 2 * Math.PI;

  throw new Error(`Unknown angle unit: "${token.unit}". Use deg, rad or turn.`);
}

// Reads "azimuth elevation" and returns the direction toward the sun
function readLight(value: Token[] | undefined): number[] {
  if (!value) return [0.408, 0.816, 0.408];
  if (value.length !== 2) {
    throw new Error("light expects two angles, like: light: 45deg 60deg;");
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
  throw new Error("animation needs a duration, like: animation: float 2s;");
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
  throw new Error(
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
  if (!found) throw new Error(`No @keyframes named "${name.value}"`);

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
  const mapLines = instances.map((instance) => {
    const shape = SHAPES[instance.tag];
    if (!shape) {
      throw new Error(
        `Unknown object: "${instance.tag}". Available: ${Object.keys(SHAPES).join(", ")}`,
      );
    }
    const shapeCode = shape(instance.styles);
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

  const colorLines = instances.map(
    (instance) =>
      `  if (id == ${glslFloat(instance.index)}) return matte(${animatedValue(instance.styles, keyframes, "color", readColor)});  // ${label(instance)}`,
  );

  // floor: none moves the floor infinitely far away
  const floor = sceneStyles["floor"];
  const noFloor =
    floor?.length === 1 &&
    floor[0].type === "IDENT" &&
    floor[0].value === "none";

  // ambient: the share of light received in the shadow; the sun gives the rest
  const ambient = readNumber(sceneStyles["ambient"], "ambient", 0.1, true);
  if (ambient > 1) {
    throw new Error(
      "ambient expects a number between 0 and 1, like: ambient: 0.3;",
    );
  }
  const direct = round(1 - ambient);

  return TEMPLATE.replace("/*@MAP*/", mapLines.join("\n\n"))
    .replace("/*@MATERIALS*/", colorLines.join("\n"))
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

// ----- Materials -----
struct Material {
  vec3 color;
};

Material matte(vec3 color) {
  return Material(color);
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

vec2 march(vec3 ro, vec3 rd) {
  float t = 0.0;
  float id = 0.0;
  for (int i = 0; i < 100; i++) {
    vec2 res = map(ro + rd * t);
    id = res.y;
    t += res.x;
    if (res.x < 0.001 || t > 20.0) break;
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
  vec3 lightDir = /*@LIGHT*/;
  float diff = max(dot(n, lightDir), 0.0);
  return color * (/*@AMBIENT*/ + /*@DIRECT*/ * diff);
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

  vec3 col = /*@BACKGROUND*/;
    if (t < 20.0) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    col = diffuse(n, getMaterial(id).color);
  }

  outColor = vec4(col, 1.0);
}
`;
