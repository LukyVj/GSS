// Turns a compiled scene into a shader to paste in Shadertoy (shadertoy.com/new).
// Shadertoy writes the header itself (#version, precision, iResolution, iTime…)
// and calls mainImage(fragColor, fragCoord) instead of main().
import type { CompiledScene } from ".";

// GLSL wants "1.0", not "1"
function float(n: number): string {
  const text = String(Math.round(n * 10000) / 10000);
  return text.includes(".") || text.includes("e") ? text : `${text}.0`;
}

export function toShadertoy({ shader, camera }: CompiledScene): string {
  const body = shader
    // 1. What Shadertoy already writes: the header, its uniforms, the output
    .replace(/^#version.*\n/m, "")
    .replace(/^precision .*\n/m, "")
    .replace(/^uniform .*\n/gm, "")
    .replace(/^out vec4 outColor;\n/m, "")
    // 2. Shadertoy calls mainImage, and gives the pixel as fragCoord
    .replace("void main() {", "void mainImage(out vec4 outColor, in vec2 fragCoord) {")
    .replaceAll("gl_FragCoord", "fragCoord")
    .trimStart();

  // 3. Our camera uniforms have no Shadertoy equivalent: the scene's settings become
  // constants, and the camera turns on its own like in the playground (camera-spin)
  return `// Made with GSS — GPU Style Sheets
// The camera of the scene, fixed at export time
#define uCamera vec2(${float(camera.yaw)} + iTime * ${float(camera.spin)}, ${float(camera.pitch)})
#define uDist ${float(camera.distance)}

${body}`;
}
