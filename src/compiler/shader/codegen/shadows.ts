import type { Token } from "../../syntax/tokenizer";
import { errorAt } from "../../syntax/errors";
import { clampComputed } from "../../values/calc";
import { glslFloat } from "./glsl";

// shadows (decision 115): scene { shadows: none | hard | soft }. Each point that main()
// shades sends a ray toward each light, the sun and the lights of @scene; an object on the
// way keeps that light from it. soft draws a penumbra that grows with the distance to the
// object that casts it (Inigo Quilez's soft shadows); hard cuts it sharp. The reflections
// and the refractions do without (diffuseOpen(), lights.ts).

export type Shadows = "hard" | "soft" | null;

export function readShadows(value: Token[] | undefined): Shadows {
  if (!value) return null;
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT" && ["none", "hard", "soft"].includes(token.value))
    return token.value === "none" ? null : (token.value as "hard" | "soft");
  throw errorAt(value, "shadows expects none, hard or soft, like: shadows: soft;");
}

// How sharp the penumbra of soft shadows is: higher is sharper. shadow-softness (decision 225)
// divides it: 2 draws a penumbra twice as wide.
const SHARPNESS = 12;

// shadow-softness and shadow-steps (decision 225): the width of the penumbra, and the steps of
// the ray toward a light (null, auto: 64, or 100 through holes and transparent objects)
export type ShadowQuality = { softness: number; steps: number | null };

export function readShadowQuality(softness: Token[] | undefined, steps: Token[] | undefined): ShadowQuality {
  const one = (value: Token[]) => (value.length === 1 && value[0].type === "NUMBER" ? clampComputed(value[0], -Infinity) : NaN);
  const quality: ShadowQuality = { softness: 1, steps: null };
  if (softness) {
    const n = one(softness);
    if (!(n >= 0.1 && n <= 10)) throw errorAt(softness, "shadow-softness expects a number from 0.1 to 10, like: shadow-softness: 2;");
    quality.softness = n;
  }
  if (steps && !(steps.length === 1 && steps[0].type === "IDENT" && steps[0].value === "auto")) {
    const n = one(steps);
    if (!(n >= 16 && n <= 512) || !Number.isInteger(n))
      throw errorAt(steps, "shadow-steps expects auto or a whole number from 16 to 512, like: shadow-steps: 128;");
    quality.steps = n;
  }
  return quality;
}

// shadow(): how much of a light reaches ro along rd, up to far, from 0 behind an object to 1.
// holes: the scene has holes (mask-image), which let the light through; the objects with
// holes are skins on the way (shell(), masks.ts). transparent: the scene has transparent
// objects (opacity, decision 116), which let the light through tinted: shadow() gives a color.
// seeThrough: the test of the objects the light goes through, which make no penumbra; with
// blended objects (mix-blend-mode, decision 173), the skins are not all of them.
// bound: the sphere around every object (decision 76), and whether there is a floor (y = 0).
// Once the rest of the ray cannot come near enough to an object or to the floor to darken it
// more, the ray stops: the light is what it would have been at the end (decision 233).
export type ShadowBound = { center: number[]; radius: number; floor: boolean };

export function shadowFunction(
  mode: "hard" | "soft",
  holes: boolean,
  transparent = false,
  seeThrough = "isSkin",
  quality: ShadowQuality = { softness: 1, steps: null },
  bound: ShadowBound | null = null,
): string {
  const soft = mode === "soft";
  const SOFTNESS = glslFloat(+(SHARPNESS / quality.softness).toFixed(4));
  const loop = (auto: number) => `  for (int i = 0; i < ${quality.steps ?? auto}; i++) {`;
  if (transparent) return tintedShadow(soft, holes, seeThrough, SOFTNESS, loop(100));
  const head = soft
    ? [
        "// shadows: soft: how much of a light reaches ro along rd, up to far, from 0 behind an",
        "// object to 1; the penumbra grows with the distance to the object that casts it",
      ]
    : ["// shadows: hard: whether a light reaches ro along rd, up to far: 0 behind an object, 1 if not"];
  if (!holes)
    return [
      ...head,
      "float shadow(vec3 ro, vec3 rd, float far) {",
      ...(soft ? ["  float lit = 1.0;"] : []),
      "  float t = 0.02;",
      ...(bound ? boundHead(bound, soft, SOFTNESS) : []),
      loop(64),
      "    float h = map(ro + rd * t).x;",
      ...(soft
        ? [`    lit = min(lit, ${SOFTNESS} * h / t);`, "    t += clamp(h, 0.01, 0.5);", "    if (lit < 0.001 || t > far) break;"]
        : ["    if (h < 0.001) return 0.0;", "    t += h;", "    if (t > far) break;"]),
      ...(bound ? boundStep(soft, SOFTNESS, bound.floor) : []),
      "  }",
      soft ? "  return clamp(lit, 0.0, 1.0);" : "  return 1.0;",
      "}",
    ].join("\n");
  // Through the holes, like march(): a surface stops the light if the mask covers it
  return [
    ...head,
    "// The holes of mask-image let the light through, and an object with holes casts a sharp",
    "// shadow: a ray through a hole passes right by its skin.",
    "float shadow(vec3 ro, vec3 rd, float far) {",
    "  float lit = 1.0;",
    "  float t = 0.02;",
    "  throughHoles = true;",
    loop(100),
    "    vec3 p = ro + rd * t;",
    "    vec2 res = map(p);",
    "    float h = abs(res.x);",
    "    if (h < 0.001) {",
    "      if (maskAlpha(res.y, p) >= 0.5) {  // the surface is there",
    "        lit = 0.0;",
    "        break;",
    "      }",
    "      h = 0.002;  // a hole: the light goes through",
    // A ray through a hole passes right by the skin: an object with holes casts a sharp shadow
    ...(soft ? ["    } else if (!hasHoles(res.y)) {", `      lit = min(lit, ${SOFTNESS} * h / t);`, "    }"] : ["    }"]),
    "    t += h;",
    "    if (lit < 0.001 || t > far) break;",
    "  }",
    "  throughHoles = false;",
    "  return clamp(lit, 0.0, 1.0);",
    "}",
  ].join("\n");
}

// The end of a ray toward a light, past every object (decision 233). Each point the loop
// measures is at most far along the ray, and map() there is at least its distance to the
// sphere around every object (the tree of spheres rests on it too) or its height above the
// floor. soft: lit only goes down where SOFTNESS * h / t < lit; the rest of the ray comes no
// nearer to the center of the sphere than near, so h / t >= (near - radius) / far for the
// objects, and >= ro.y / far + rd.y for the floor (y = ro.y + rd.y * t). Once both bounds are
// above lit, with a margin for the rounding of 32-bit floats, nothing left can lower it: the
// loop stops with the value it would have ended with. hard: once the rest of the ray stays
// further than 0.001 from the objects and the floor, nothing can stop the light.
function boundHead(bound: ShadowBound, soft: boolean, SOFTNESS: string): string[] {
  const r = Math.ceil((bound.radius + 0.0001) * 10000) / 10000; // rounded up, and the center rounded: never smaller
  const lines = [
    "  // Past the sphere around every object, the rest of the ray cannot darken it more",
    `  vec3 shadowCenter = ${vec3Of(bound.center)};`,
    `  float shadowRadius = ${glslFloat(r)};`,
  ];
  if (soft)
    lines.push(
      bound.floor
        ? `  float floorLeft = ro.y >= 0.0 ? ${SOFTNESS} * (ro.y / far + rd.y) : -1.0;`
        : "  float floorLeft = 1e10;",
    );
  return lines;
}

function boundStep(soft: boolean, SOFTNESS: string, floor: boolean): string[] {
  return [
    "    vec3 fromCenter = ro + rd * t - shadowCenter;",
    "    float along = dot(fromCenter, rd);",
    "    float near = along >= 0.0 ? length(fromCenter) : sqrt(max(dot(fromCenter, fromCenter) - along * along, 0.0));",
    soft
      ? `    if (min(${SOFTNESS} * (near - shadowRadius) / far, floorLeft) * 0.999 - 0.00001 > lit) break;`
      : `    if (near - shadowRadius > 0.002${floor ? " && rd.y >= 0.0 && ro.y + rd.y * t > 0.002" : ""}) break;`,
  ];
}

const vec3Of = (v: number[]) => `vec3(${v.map((c) => glslFloat(Math.round(c * 10000) / 10000)).join(", ")})`;

// shadow() through transparent objects (decision 116), like stained glass: each surface the
// light crosses lets through what it does not cover, and tints what it covers with its color,
// mix(1, color, a): a red glass at 50% casts a pink light. Close to opaque, the last tenth,
// it lets less and less through, down to the black shadow of an opaque object. A surface is
// crossed once: the light goes on until it leaves it. The penumbra comes from the solid objects.
function tintedShadow(soft: boolean, holes: boolean, seeThrough: string, SOFTNESS: string, loop: string): string {
  return [
    soft
      ? "// shadows: soft: how much of a light reaches ro along rd, up to far, through the transparent\n// objects, which tint it; the penumbra grows with the distance to the object that casts it"
      : "// shadows: hard: how much of a light reaches ro along rd, up to far, through the transparent\n// objects, which tint it",
    "vec3 shadow(vec3 ro, vec3 rd, float far) {",
    "  vec3 lit = vec3(1.0);",
    ...(soft ? ["  float soft = 1.0;"] : []),
    "  float t = 0.02;",
    "  bool crossing = false;  // in a surface the light already went through",
    "  throughHoles = true;",
    loop,
    "    vec3 p = ro + rd * t;",
    "    vec2 res = map(p);",
    "    float h = abs(res.x);",
    "    if (h < 0.001) {",
    "      if (!crossing) {",
    "        crossing = true;",
    ...(holes ? ["        if (maskAlpha(res.y, p) >= 0.5) {  // not a hole"] : ["        {"]),
    "          float a = surfaceAlpha(res.y, p);",
    "          if (a > 0.999) {  // an opaque surface",
    "            lit = vec3(0.0);",
    "            break;",
    "          }",
    "          lit *= mix(vec3(1.0), surfaceColor(res.y, p), a) * min((1.0 - a) * 10.0, 1.0);",
    "        }",
    "      }",
    "      h = 0.002;",
    "    } else {",
    "      crossing = false;",
    // A ray through a skin passes right by it: only the solid objects make a penumbra
    ...(soft ? [`      if (!${seeThrough}(res.y)) soft = min(soft, ${SOFTNESS} * h / t);`] : []),
    "    }",
    "    t += h;",
    `    if (max(lit.r, max(lit.g, lit.b)) < 0.001${soft ? " || soft < 0.001" : ""} || t > far) break;`,
    "  }",
    "  throughHoles = false;",
    soft ? "  return lit * clamp(soft, 0.0, 1.0);" : "  return lit;",
    "}",
  ].join("\n");
}
