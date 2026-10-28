import type { Token } from "../../syntax/tokenizer";
import { errorAt } from "../../syntax/errors";

// antialias (decision 231): several rays per pixel, their colors averaged, so the edges of the
// objects, of the shadows and of the textures come out smooth. main() becomes gssPixel(), the
// color of a ray that starts at a point of the pixel; the new main() runs the animations once
// and takes the mean of 2 or 4 points of a rotated grid (RGSS), which spreads them over both
// axes. The picking pass keeps one ray, the one of the pointer. none, the default, writes
// nothing: the shader stays as it was.

export type Antialias = 1 | 2 | 4;

export function readAntialias(value: Token[] | undefined): Antialias {
  if (!value) return 1;
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT" && token.value === "none") return 1;
  if (value.length === 1 && token.type === "DIMENSION" && token.unit === "x" && (token.value === 2 || token.value === 4)) return token.value;
  throw errorAt(value, "antialias expects none, 2x or 4x, like: antialias: 4x;");
}

// The rotated grid of 4 points, in pixels from the center of the pixel; 2x takes the first and
// the last, on a diagonal
const GRID: [number, number][] = [[0.125, 0.375], [-0.375, 0.125], [0.375, -0.125], [-0.125, -0.375]];

export function withAntialias(shader: string, samples: Antialias): string {
  if (samples === 1) return shader;
  const start = shader.lastIndexOf("void main() {");
  const animated = shader.startsWith("void main() {\n  animate();", start);
  const head = animated ? "void main() {\n  animate();" : "void main() {";
  const pixel = shader
    .slice(start)
    .replace(head, "// antialias: the color of the ray that starts at fragCoord\nvec4 gssPixel(vec2 fragCoord) {")
    .replaceAll("gl_FragCoord.xy", "fragCoord")
    // The picking pass gives its id at once
    .replace(/outColor = (vec4\([^;]*\));\n(\s*)return;/g, "return $1;")
    .replace(/\n {2}outColor = (vec4\(col, [^;]+\));\n}\s*$/, "\n  return $1;\n}\n");
  if (pixel.includes("outColor") || pixel.includes("gl_FragCoord")) throw new Error("GSS: antialias could not turn main() into gssPixel()");
  const points = (samples === 4 ? GRID : [GRID[0], GRID[3]]).map(([x, y]) => `  sum += gssPixel(gl_FragCoord.xy + vec2(${x}, ${y}));`);
  const picks = pixel.includes("uPicking");
  const main = [
    `// antialias: ${samples} rays per pixel, on a rotated grid; their mean`,
    "void main() {",
    ...(animated ? ["  animate();"] : []),
    ...(picks ? ["  if (uPicking) {", "    outColor = gssPixel(gl_FragCoord.xy);", "    return;", "  }"] : []),
    "  vec4 sum = vec4(0.0);",
    ...points,
    `  outColor = sum / ${samples}.0;`,
    "}",
    "",
  ].join("\n");
  return `${shader.slice(0, start)}${pixel}\n${main}`;
}
