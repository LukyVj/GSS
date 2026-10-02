// filter: post-processing, like CSS filter, on the whole canvas (scene { filter }) or on
// objects and groups (decisions 83 and 84).
// Filters that only read their own pixel (brightness(), contrast(), saturate(), grayscale(),
// sepia(), hue-rotate(), invert(), and grain()) are a few lines at the end of the scene's
// shader: no extra pass. blur() and bloom() read the pixels around: the scene is then drawn
// into an image, and each of them adds passes that read the images before them.
import type { Token } from "../syntax/tokenizer";
import { errorAt } from "../syntax/errors";
import { readFunction } from "../values/values";
import { clampComputed } from "../values/calc";
import { isLive, sub, type Num } from "../shader/codegen/live";

// One pass after the scene: its fragment shader, and the images it reads
// (0 = the scene, n = what pass n - 1 drew). Each pass draws the next image; the last one,
// the screen.
export type Pass = { shader: string; wgsl?: string; inputs: number[] };

export const FILTER_FUNCTIONS = [
  "blur",
  "bloom",
  "brightness",
  "contrast",
  "grain",
  "grayscale",
  "hue-rotate",
  "invert",
  "saturate",
  "sepia",
];

const EXAMPLE = "filter: contrast(1.1) saturate(1.2) bloom(0.6);";
// A number in GLSL; a value set from JS (decision 105) is already GLSL
const f = (n: Num) => (isLive(n) ? n : Number.isInteger(n) ? `${n}.0` : `${+n.toFixed(6)}`);
const clamp01 = (expr: string) => `clamp(${expr}, 0.0, 1.0)`;

// A color matrix of CSS Filter Effects, written as three dot products (rows)
const matrix = (m: Num[]) =>
  clamp01(
    `vec3(${[0, 3, 6].map((r) => `dot(vec3(${m.slice(r, r + 3).map(f).join(", ")}), c)`).join(", ")})`,
  );
// a + b × x: a number when x is a number, GLSL when x is set from JS
const line = (a: number, b: number, x: Num): Num => (isLive(x) ? `(${f(a)} + ${f(b)} * ${x})` : a + b * x);

// The GLSL of the grain: a different noise at each pixel and each frame
export const GRAIN = `// grain(): a film-like noise, new at every frame
float grain(vec2 pixel, float time) {
  vec2 p = pixel + fract(time * 7.13) * vec2(91.7, 37.3);
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}`;

export type Step =
  | { kind: "pixel"; line: string }
  | { kind: "blur"; sigma: Num }
  | { kind: "bloom"; amount: Num; sigma: Num };

// filter: a list of functions, or none
export function readSteps(value: Token[]): Step[] {
  if (value.length === 1 && value[0].type === "IDENT" && value[0].value === "none") return [];
  const steps: Step[] = [];
  let i = 0;
  while (i < value.length) {
    const name = value[i];
    if (name.type !== "IDENT" || value[i + 1]?.type !== "PUNCT" || value[i + 1].value !== "(")
      throw errorAt(value, `filter expects a list of functions, like: ${EXAMPLE}`);
    let depth = 0;
    let end = i + 1;
    for (; end < value.length; end++) {
      const t = value[end];
      if (t.type === "PUNCT" && t.value === "(") depth++;
      if (t.type === "PUNCT" && t.value === ")" && --depth === 0) break;
    }
    const call = value.slice(i, end + 1);
    const step = readStep(name.value, call);
    if (step) steps.push(step);
    i = end + 1;
  }
  return steps;
}

function readStep(name: string, call: Token[]): Step | null {
  if (name === "opacity" || name === "drop-shadow")
    throw errorAt(call, `${name}() needs transparency, which GSS does not have: use ${name === "opacity" ? "brightness()" : "bloom()"} instead`);
  const args = readFunction(call)?.args ?? [];
  if (args.length > 2 || args.some((a) => a.length !== 1))
    throw errorAt(call, `${name}() takes at most two values`);
  const [first, second] = args.map((a) => a[0]);

  // An amount: a number or a percentage (50% is 0.5), never negative, like CSS
  const amount = (token: Token | undefined, initial: number, max = Infinity): Num => {
    if (!token) return initial;
    // Set from JS (decision 105): never negative, kept below max, on the GPU
    if (token.type === "EXPR" && (token.syntax === "number" || token.syntax === "percentage")) {
      const n = token.syntax === "percentage" ? `${token.code} / 100.0` : token.code;
      return max === Infinity ? `max(${n}, 0.0)` : `clamp(${n}, 0.0, ${f(max)})`;
    }
    const n =
      token.type === "NUMBER" ? clampComputed(token, 0) : token.type === "PERCENTAGE" ? clampComputed(token, 0) / 100 : NaN;
    if (!(n >= 0)) throw errorAt(call, `${name}() expects a positive number or a percentage, like: ${name}(0.5)`);
    return Math.min(n, max) as Num;
  };
  // A length in px, like CSS
  const length = (token: Token | undefined, initial: number): Num => {
    if (!token) return initial;
    if (token.type === "EXPR" && token.syntax === "length") return `max(${token.code}, 0.0)`; // set from JS (decision 105)
    if (token.type === "NUMBER" && token.value === 0) return 0;
    if (token.type !== "DIMENSION" || token.unit !== "px" || token.value < 0)
      throw errorAt(call, `${name}() expects a length in px, like: ${name === "bloom" ? "bloom(0.6, 16px)" : "blur(4px)"}`);
    return token.value;
  };
  const one = (n: Num) => {
    if (second) throw errorAt(call, `${name}() takes one value`);
    return n;
  };

  switch (name) {
    case "blur": {
      const sigma = one(length(first, 0));
      return isLive(sigma) || sigma > 0 ? { kind: "blur", sigma } : null; // blur(0): nothing to do
    }
    case "bloom":
      return { kind: "bloom", amount: amount(first, 0.6), sigma: length(second, 16) };
    case "brightness":
      return { kind: "pixel", line: `c = ${clamp01(`c * ${f(one(amount(first, 1)))}`)};` };
    case "contrast":
      return { kind: "pixel", line: `c = ${clamp01(`(c - 0.5) * ${f(one(amount(first, 1)))} + 0.5`)};` };
    case "invert":
      return { kind: "pixel", line: `c = mix(c, 1.0 - c, ${f(one(amount(first, 1, 1)))});` };
    case "grain":
      return { kind: "pixel", line: `c = ${clamp01(`c + (grain(gl_FragCoord.xy, iTime) - 0.5) * ${f(one(amount(first, 0.1)))}`)};` };
    case "saturate": {
      const s = one(amount(first, 1));
      return {
        kind: "pixel",
        line: `c = ${matrix([
          line(0.213, 0.787, s), line(0.715, -0.715, s), line(0.072, -0.072, s),
          line(0.213, -0.213, s), line(0.715, 0.285, s), line(0.072, -0.072, s),
          line(0.213, -0.213, s), line(0.715, -0.715, s), line(0.072, 0.928, s),
        ])};`,
      };
    }
    case "grayscale": {
      const a = sub(1, one(amount(first, 1, 1)));
      return {
        kind: "pixel",
        line: `c = ${matrix([
          line(0.2126, 0.7874, a), line(0.7152, -0.7152, a), line(0.0722, -0.0722, a),
          line(0.2126, -0.2126, a), line(0.7152, 0.2848, a), line(0.0722, -0.0722, a),
          line(0.2126, -0.2126, a), line(0.7152, -0.7152, a), line(0.0722, 0.9278, a),
        ])};`,
      };
    }
    case "sepia": {
      const a = sub(1, one(amount(first, 1, 1)));
      return {
        kind: "pixel",
        line: `c = ${matrix([
          line(0.393, 0.607, a), line(0.769, -0.769, a), line(0.189, -0.189, a),
          line(0.349, -0.349, a), line(0.686, 0.314, a), line(0.168, -0.168, a),
          line(0.272, -0.272, a), line(0.534, -0.534, a), line(0.131, 0.869, a),
        ])};`,
      };
    }
    case "hue-rotate": {
      const turn: Record<string, number> = { deg: Math.PI / 180, rad: 1, turn: 2 * Math.PI };
      let angle = 0;
      if (first?.type === "EXPR" && first.syntax === "angle") {
        // Set from JS (decision 105): the same matrix, its cosine and sine computed on the GPU
        one(0);
        const [cos, sin] = [`cos(${first.code})`, `sin(${first.code})`];
        const entry = (a: number, b: number, c: number) => `(${f(a)} + ${cos} * ${f(b)} + ${sin} * ${f(c)})`;
        return {
          kind: "pixel",
          line: `c = ${matrix([
            entry(0.213, 0.787, -0.213), entry(0.715, -0.715, -0.715), entry(0.072, -0.072, 0.928),
            entry(0.213, -0.213, 0.143), entry(0.715, 0.285, 0.14), entry(0.072, -0.072, -0.283),
            entry(0.213, -0.213, -0.787), entry(0.715, -0.715, 0.715), entry(0.072, 0.928, 0.072),
          ])};`,
        };
      }
      if (first) {
        if (first.type === "NUMBER" && first.value === 0) angle = 0;
        else if (first.type === "DIMENSION" && first.unit in turn) angle = first.value * turn[first.unit];
        else throw errorAt(call, "hue-rotate() expects an angle, like: hue-rotate(90deg)");
      }
      one(0);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        kind: "pixel",
        line: `c = ${matrix([
          0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
          0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283,
          0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
        ])};`,
      };
    }
  }
  throw errorAt(call, `Unknown filter "${name}()". Available: ${FILTER_FUNCTIONS.map((n) => `${n}()`).join(", ")}`);
}

// The lines of the filters that read only their own pixel, in order: they change `c`
export function pixelLines(steps: Step[]): string[] {
  return steps.flatMap((step) => (step.kind === "pixel" ? [step.line] : []));
}

// ----- The passes -----

const PASS_HEADER = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform float uRatio; // canvas pixels per CSS pixel: blur(4px) is 4 CSS pixels
uniform sampler2D uInput0;
uniform sampler2D uInput1;
uniform sampler2D uInput2;
out vec4 outColor;`;

// A gaussian blur along one direction, of standard deviation sigma CSS pixels (like CSS):
// 65 samples, spread wider when the blur is large. `sample` reads s (a vec4) into what is
// summed; `layer`, when given, keeps only the pixels of that layer (decision 84), or with
// `outside`, only the pixels around it.
function blurCode(sigma: Num, direction: string, sample: string, layer?: number, outside = false): string[] {
  const inside =
    layer === undefined
      ? "1.0"
      : `(abs(s.a * 255.0 - ${f(layer)}) < 0.5 ? ${outside ? "0.0 : 1.0" : "1.0 : 0.0"})`;
  return [
    "  vec4 sum = vec4(0.0);",
    "  float total = 0.0;",
    `  float sigma = ${f(sigma)} * uRatio;`,
    "  float spacing = max(1.0, 3.0 * sigma / 32.0);",
    "  ivec2 here = ivec2(gl_FragCoord.xy);",
    "  ivec2 last = ivec2(iResolution.xy) - 1;",
    "  for (int i = -32; i <= 32; i++) {",
    "    float x = float(i) * spacing;",
    "    float w = exp(-0.5 * x * x / (sigma * sigma));",
    `    vec4 s = texelFetch(uInput0, clamp(here + ivec2(round(${direction} * x)), ivec2(0), last), 0);`,
    `    sum += w * ${inside} * ${sample};`,
    "    total += w;",
    "  }",
    "  sum /= total;",
    "  vec3 c = sum.rgb;",
    "  float a = sum.a;",
  ];
}

// The bright parts of a pixel, for bloom()
const BRIGHT = "vec4(s.rgb * smoothstep(0.35, 0.9, dot(s.rgb, vec3(0.2126, 0.7152, 0.0722))), 1.0)";
// Keeps the alpha of the image: the layers of the objects (decision 84)
const KEEP = ["  vec4 here0 = texture(uInput0, uv);"];

type Draft = { code: string[]; inputs: number[]; tail: string[] };

function passShader(draft: Draft, last: boolean): string {
  const body = [...draft.code, ...draft.tail.map((line) => `  ${line}`)];
  const usesGrain = body.some((line) => line.includes("grain("));
  return [
    PASS_HEADER,
    ...(usesGrain ? ["", GRAIN] : []),
    "",
    "void main() {",
    "  vec2 uv = gl_FragCoord.xy / iResolution.xy;",
    ...body,
    // The screen is opaque; an image in between keeps its alpha for the passes after it
    last ? "  outColor = vec4(c, 1.0);" : "  outColor = vec4(c, a);",
    "}",
    "",
  ].join("\n");
}

// The filters of a layer of objects (decision 84): the number its pixels carry in the alpha
// of the scene's image, and its blur() and bloom()
export type Layer = { layer: number; steps: Step[] };

// The passes: first each layer of objects, then the filter of the scene. Returns the lines
// for the end of the scene's shader (they change `col` through `c`), and the passes.
export function buildPasses(layers: Layer[], sceneSteps: Step[]): { sceneLines: string[]; passes: Pass[] } {
  const sceneLines: string[] = [];
  const drafts: Draft[] = [];
  let current = 0; // the image the next filter reads: 0 is the scene
  // Where the next pixel filter goes: the end of the scene's shader, or of the last pass
  const tail = () => (drafts.length > 0 ? drafts[drafts.length - 1].tail : sceneLines);
  const add = (code: string[], inputs: number[]) => {
    drafts.push({ code, inputs, tail: [] });
    return drafts.length; // the image this pass draws
  };

  // 1. Each layer: its own pixels, blurred (color and coverage), laid back over the image
  for (const { layer, steps } of layers) {
    for (const step of steps) {
      if (step.kind === "pixel") continue; // done in the scene's shader, on its own pixels
      if (step.kind === "blur") {
        // The layer, blurred: its color (premultiplied) and how much of it covers each pixel
        const across = add(blurCode(step.sigma, "vec2(1.0, 0.0)", "vec4(s.rgb, 1.0)", layer), [current]);
        const down = add(blurCode(step.sigma, "vec2(0.0, 1.0)", "s"), [across]);
        // What is around it, blurred the same way: an estimate of what it hides
        const aroundAcross = add(blurCode(step.sigma, "vec2(1.0, 0.0)", "vec4(s.rgb, 1.0)", layer, true), [current]);
        const around = add(blurCode(step.sigma, "vec2(0.0, 1.0)", "s"), [aroundAcross]);
        current = add(
          [
            ...KEEP,
            "  vec4 layer = texture(uInput1, uv);",
            "  vec4 around = texture(uInput2, uv);",
            `  bool mine = abs(here0.a * 255.0 - ${f(layer)}) < 0.5;`,
            "  // Under the layer, what it hid; elsewhere, the image",
            "  vec3 behind = mine ? around.rgb / max(around.a, 0.0001) : here0.rgb;",
            "  vec3 c = behind * (1.0 - layer.a) + layer.rgb;",
            "  float a = here0.a;",
          ],
          [current, down, around],
        );
      } else {
        const across = add(blurCode(step.sigma, "vec2(1.0, 0.0)", BRIGHT, layer), [current]);
        const down = add(blurCode(step.sigma, "vec2(0.0, 1.0)", "s"), [across]);
        current = add(
          [...KEEP, `  vec3 c = clamp(here0.rgb + ${f(step.amount)} * texture(uInput1, uv).rgb, 0.0, 1.0);`, "  float a = here0.a;"],
          [current, down],
        );
      }
    }
  }

  // 2. The scene: its pixel filters, its blur() and bloom(), in order
  for (const step of sceneSteps) {
    if (step.kind === "pixel") {
      tail().push(step.line);
      continue;
    }
    if (step.kind === "blur") {
      const across = add(blurCode(step.sigma, "vec2(1.0, 0.0)", "s"), [current]);
      current = add(blurCode(step.sigma, "vec2(0.0, 1.0)", "s"), [across]);
    } else {
      // bloom(): the bright parts, blurred, added back on top of the image
      const across = add(blurCode(step.sigma, "vec2(1.0, 0.0)", BRIGHT), [current]);
      const glow = add(blurCode(step.sigma, "vec2(0.0, 1.0)", "s"), [across]);
      current = add(
        [...KEEP, `  vec3 c = clamp(here0.rgb + ${f(step.amount)} * texture(uInput1, uv).rgb, 0.0, 1.0);`, "  float a = here0.a;"],
        [current, glow],
      );
    }
  }
  return {
    sceneLines,
    passes: drafts.map((d, n) => ({ shader: passShader(d, n === drafts.length - 1), inputs: d.inputs })),
  };
}

// The filter of the scene alone
export function compileFilter(value: Token[] | undefined): { sceneLines: string[]; passes: Pass[] } {
  return buildPasses([], value ? readSteps(value) : []);
}

// ----- Filters on objects and groups (decision 84) -----

// What the objects of the scene need: the pixel filters of each object (its own, then those
// of its groups from the inside out, like CSS applies a child's filter before its parent's),
// and the layers: an object, or a group, with a blur() or a bloom() is a layer, whose pixels
// carry its number in the alpha of the scene's image.
export function objectFilters(
  instances: {
    index: number;
    tag: string;
    id: string | null;
    siblingIndex: number;
    styles: Record<string, Token[]>;
    groupStyles: Record<string, Token[]>[];
    groups: { tag: string; id: string | null; siblingIndex: number }[];
  }[],
): { pixel: Map<number, string[]>; layerOf: Map<number, number>; layers: Layer[] } {
  const pixel = new Map<number, string[]>();
  const layerOf = new Map<number, number>();
  const layers: Layer[] = [];
  const byNode = new Map<string, number>(); // a group's layer, shared by its objects
  const spread = (steps: Step[]) => steps.some((s) => s.kind !== "pixel");

  for (const instance of instances) {
    const own = instance.styles["filter"] ? readSteps(instance.styles["filter"]) : [];
    // The groups from the inside out
    const groups = instance.groupStyles
      .map((styles, g) => ({ styles, g }))
      .reverse()
      .map(({ styles, g }) => ({
        steps: styles["filter"] ? readSteps(styles["filter"]) : [],
        key: instance.groups
          .slice(0, g + 1)
          .map((n) => `${n.tag}#${n.id ?? ""}:${n.siblingIndex}`)
          .join(" > "),
      }));
    const lines = [own, ...groups.map((g) => g.steps)].flatMap(pixelLines);
    if (lines.length > 0) pixel.set(instance.index, lines);

    // At most one blur() or bloom() level: the object's own, or one of its groups'
    const levels = [
      ...(spread(own) ? [{ steps: own, key: `object ${instance.index}` }] : []),
      ...groups.filter((g) => spread(g.steps)),
    ];
    const where = instance.styles["filter"] ?? instance.groupStyles.find((s) => s["filter"])?.["filter"] ?? [];
    if (levels.length > 1)
      throw errorAt(where, "blur() and bloom() can be on an object or on one of its groups, not both");
    if (levels.length === 0) continue;
    const { steps, key } = levels[0];
    let layer = byNode.get(key);
    if (layer === undefined) {
      layer = layers.length + 1;
      if (layer > 255) throw errorAt(where, "At most 255 objects or groups can have a blur() or a bloom()");
      byNode.set(key, layer);
      layers.push({ layer, steps });
    }
    layerOf.set(instance.index, layer);
  }
  return { pixel, layerOf, layers };
}
