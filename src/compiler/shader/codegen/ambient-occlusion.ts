import type { Token } from "../../syntax/tokenizer";
import { errorAt } from "../../syntax/errors";
import { clampComputed } from "../../values/calc";
import { glslFloat } from "./glsl";

// ambient-occlusion (decision 227): less ambient light where the objects close in, in the
// corners, under an object, between two close ones. At the point main() shades, a few points
// along its normal measure how much of the scene is closer than they are (Inigo Quilez's
// ambient occlusion); the ambient light is multiplied by what is left. The sun and the lights
// keep their shadows: ambient-occlusion never touches them. A reflection or a refraction is
// lit without it, as without shadows. none, the default, writes nothing.

export type AmbientOcclusion = { strength: number; radius: number; samples: number } | null;

const ERROR =
  "ambient-occlusion expects none, or a strength from 0 to 2, then a radius from 0.05 to 5 and a number of samples from 2 to 16 if needed, like: ambient-occlusion: 0.8 0.5 5;";

export function readAmbientOcclusion(value: Token[] | undefined): AmbientOcclusion {
  if (!value || (value.length === 1 && value[0].type === "IDENT" && value[0].value === "none")) return null;
  const numbers = value.filter((token) => token.type === "NUMBER");
  if (value.length > 3 || numbers.length !== value.length) throw errorAt(value, ERROR);
  const [strength, radius = 0.5, samples = 5] = numbers.map((token) => clampComputed(token, -Infinity));
  if (!(strength >= 0 && strength <= 2) || !(radius >= 0.05 && radius <= 5) || !(samples >= 2 && samples <= 16) || !Number.isInteger(samples))
    throw errorAt(value, ERROR);
  return { strength, radius, samples };
}

// The ambient light of the template's diffuse(), darkened where the objects close in
export function occludedAmbient(ambient: string, ao: AmbientOcclusion): string {
  if (!ao) return ambient;
  return /^[\w.[\]]+$/.test(ambient) ? `${ambient} * ao` : `(${ambient}) * ao`;
}

// calcAO(), called at the point main() shades; the lights' diffuse() reads it; trace() keeps
// the reflections without it
export function withAmbientOcclusion(shader: string, ao: AmbientOcclusion): string {
  if (!ao) return shader;
  const { strength, radius, samples } = ao;
  const R = glslFloat(radius);
  const N = glslFloat(samples);
  const code = `
// ambient-occlusion: how much of the ambient light reaches p, from 0 in a closed corner to 1
// in the open: points along the normal, each closer to the scene than its own height darkens
float ao = 1.0;

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < ${samples}; i++) {
    float h = 0.01 + ${R} * float(i) / ${glslFloat(samples - 1)};
    float d = map(p + n * h).x;
    occ += (h - d) * sca;
    sca *= 0.95;
  }
  return clamp(1.0 - ${glslFloat(strength)} * 1.8 * occ / (${R} * ${N}), 0.0, 1.0);
}`;
  // After calcNormal(): map() is there, and everything that shades comes after
  const head = shader.indexOf("vec3 calcNormal(vec3 p) {");
  const end = shader.indexOf("\n}\n", head) + 2;
  let out = shader.slice(0, end) + code + "\n" + shader.slice(end);
  out = out
    // The point main() shades, each surface along the ray with opacity
    .replace(/^( {4}vec3 n = (?:calcNormal\(p\)|holeNormal\(p, rd, id\));)$/m, "$1\n    ao = calcAO(p, n);")
    // The lights of the scene: their ambient light
    .replace("  return color * (AMBIENT_LIGHT + lighting(p, n));", "  return color * (AMBIENT_LIGHT * ao + lighting(p, n));");
  // A reflection is lit without it, and the surface that reflects gets its own back
  if (out.includes("vec3 trace(vec3 ro, vec3 rd) {")) {
    const start = out.indexOf("vec3 trace(vec3 ro, vec3 rd) {");
    const close = out.indexOf("\n}\n", start) + 2;
    out =
      out.slice(0, close).replace("vec3 trace(vec3 ro, vec3 rd) {", "vec3 traceSeen(vec3 ro, vec3 rd) {") +
      `
// ambient-occlusion: what a ray sees is lit without it
vec3 trace(vec3 ro, vec3 rd) {
  float kept = ao;
  ao = 1.0;
  vec3 seen = traceSeen(ro, rd);
  ao = kept;
  return seen;
}
` +
      out.slice(close);
  }
  return out;
}
