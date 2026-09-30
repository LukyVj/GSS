// Turns a compiled scene into a shader to paste in Shadertoy (shadertoy.com/new).
// Shadertoy writes the header itself (#version, precision, iResolution, iTime…)
// and calls mainImage(fragColor, fragCoord) instead of main().
import type { CompiledScene } from ".";

// GLSL wants "1.0", not "1"
function float(n: number): string {
  const text = String(Math.round(n * 10000) / 10000);
  return text.includes(".") || text.includes("e") ? text : `${text}.0`;
}

// Shadertoy gives 4 image channels, filled by hand in its editor
const SHADERTOY_CHANNELS = 4;

// Our images become Shadertoy's channels: uTexture0 → iChannel0…
// An empty channel reads as transparent, so triplanar() falls back to the object's color.
function channelDefines(shader: string): string {
  const textures = [
    ...shader.matchAll(/^uniform sampler2D (uTexture(\d+));/gm),
  ];
  if (textures.length > SHADERTOY_CHANNELS) {
    throw new Error(
      `Shadertoy has ${SHADERTOY_CHANNELS} image channels, this scene uses ${textures.length} images`,
    );
  }
  if (textures.length === 0) return "";
  const lines = textures.map(([, name, i]) => `#define ${name} iChannel${i}`);
  return `// The images of the scene: put them in these channels (empty: the object keeps its color)
${lines.join("\n")}
`;
}

export function toShadertoy({ shader, camera }: CompiledScene): string {
  const channels = channelDefines(shader);
  const body = shader
    // 0. No picking in Shadertoy: every object stays at rest. Before step 1,
    // which removes every uniform line
    .replace(/^uniform float uHover\[(\d+)\];.*\n/m, (_, n) => {
      const zeros = Array(Number(n)).fill("0.0").join(", ");
      return `const float uHover[${n}] = float[${n}](${zeros}); // :hover needs the GSS runtime\n`;
    })
    .replace(/^uniform bool uPicking;.*\n/m, "const bool uPicking = false;\n")
    .replace(/^uniform vec2 uPick;.*\n/m, "const vec2 uPick = vec2(0.0);\n")
    // 1. What Shadertoy already writes: the header, its uniforms, the output
    .replace(/^#version.*\n/m, "")
    .replace(/^precision .*\n/m, "")
    .replace(/^uniform .*\n/gm, "")
    .replace(/^out vec4 outColor;\n/m, "")
    // 2. Shadertoy calls mainImage, and gives the pixel as fragCoord
    .replace(
      "void main() {",
      "void mainImage(out vec4 outColor, in vec2 fragCoord) {",
    )
    .replaceAll("gl_FragCoord", "fragCoord")
    .trimStart();

  // 3. Our camera uniforms have no Shadertoy equivalent: the scene's settings become
  // constants, and the camera turns on its own like in the playground (camera-spin)
  return `// Made with GSS — GPU Style Sheets
// The camera of the scene, fixed at export time
#define uCamera vec2(${float(camera.yaw)} + iTime * ${float(camera.spin)}, ${float(camera.pitch)})
#define uDist ${float(camera.distance)}
${channels}
${body}`;
}
