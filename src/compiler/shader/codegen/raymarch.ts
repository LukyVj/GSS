import { RAYMARCH, type Raymarch } from "../../features/raymarch";
import { glslFloat } from "./glsl";

// raymarch-steps, max-distance and hit-precision (decision 224). The shader is written with
// the initial values (100 steps, 20 units, 0.001); another value replaces them in the finished
// shader, so a scene that sets none compiles to the same shader as before.
// - The steps: the march of each pixel, march() or marchPrecision(), takes steps in place of
//   100. A march through holes or skins takes twice as many, as it did (200), and the march
//   of geometricPrecision keeps its 200 more along the silhouettes. The shadows, the inside of
//   glass and the layers of opacity keep their own loops.
// - The distance: MAX_DIST, and the fog of none, which starts and ends there.
// - The precision: where a march stops at a surface, the step through a hole or a skin
//   (twice the precision, as 0.002 was), and the step of the normals. geometricPrecision
//   measures its hits in pixels: only its normals follow.
const MARCHES = ["vec2 march(vec3 ro, vec3 rd) {", "PrecisionHit marchPrecision(vec3 ro, vec3 rd) {"];

export function withRaymarch(shader: string, raymarch: Raymarch): string {
  const { steps, maxDistance, precision } = raymarch;
  let out = shader;
  if (steps !== RAYMARCH.steps || precision !== RAYMARCH.precision) {
    for (const head of MARCHES) {
      const start = out.indexOf(head);
      if (start < 0) continue;
      const end = out.indexOf("\n}\n", start);
      out = out.slice(0, start) + marchWith(out.slice(start, end), steps, precision) + out.slice(end);
    }
  }
  if (precision !== RAYMARCH.precision) {
    const eps = glslFloat(precision);
    out = out
      .replace("vec2 e = vec2(0.001, 0.0);", `vec2 e = vec2(${eps}, 0.0);`)
      .replace(
        "    t += 0.002;\n    if (abs(map(ro + rd * t).x) >= 0.001) break;",
        `    t += ${glslFloat(2 * precision)};\n    if (abs(map(ro + rd * t).x) >= ${eps}) break;`,
      );
  }
  if (maxDistance !== RAYMARCH.maxDistance)
    out = out.replace("const float MAX_DIST = 20.0;", `const float MAX_DIST = ${glslFloat(maxDistance)};`);
  return out;
}

// The loop of one march, its steps and its hits
function marchWith(body: string, steps: number, precision: number): string {
  const eps = glslFloat(precision);
  return body
    .replace(/for \(int i = 0; i < (\d+); i\+\+\) \{/, (_, n: string) => `for (int i = 0; i < ${loopSteps(Number(n), steps)}; i++) {`)
    .replace(/if \(i >= (\d+) && id == 0\.0\) break;/, (_, n: string) => `if (i >= ${(Number(n) / 100) * steps} && id == 0.0) break;`)
    .replace("if (res.x < 0.001 || t > MAX_DIST) break;", `if (res.x < ${eps} || t > MAX_DIST) break;`)
    .replace("if (d < 0.001) {", `if (d < ${eps}) {`)
    .replace("d = 0.002;", `d = ${glslFloat(2 * precision)};`)
    .replace("if (d < 0.001) break;", `if (d < ${eps}) break;`);
}

// 100 → steps, 200 → twice; geometricPrecision: those, and 200 more
function loopSteps(n: number, steps: number): number {
  if (n === 100 || n === 200) return (n / 100) * steps;
  return ((n - 200) / 100) * steps + 200;
}
