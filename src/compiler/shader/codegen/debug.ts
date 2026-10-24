// @debug-panel and view: steps (decision 204): what the playground draws over a scene to debug
// it. Both are added to the finished shader, after the filters of the scene: they are not part
// of the picture.

// The end of main(): every line added here goes just before it
const END_OF_MAIN = /\n  outColor = vec4\(col, [^;]+\);\n}\s*$/;

function beforeEndOfMain(shader: string, functions: string, call: string): string {
  const end = END_OF_MAIN.exec(shader);
  if (!end) throw new Error("GSS: the end of main() was not found");
  const main = shader.lastIndexOf("void main() {");
  return `${shader.slice(0, main)}${functions}\n\n${shader.slice(main, end.index)}\n${call}${shader.slice(end.index)}`;
}

// The axes, their letters and a grid at the origin. Each is drawn where it is in front of what the ray meets
// (t), and fainter behind it, like through glass. A pixel is an angle of the camera: 1 / (1.5 ×
// the height of the render), which gives lines of a steady width without derivatives.
export const DEBUG_OVERLAY = `// @debug-panel: the axes and a grid at the origin, over the scene
float debugLine(float gap, float width) {
  return 1.0 - smoothstep(0.5 * width, 1.5 * width, gap);
}

// An axis through the origin: the closest points of the ray and of the axis
vec3 debugAxis(vec3 col, vec3 ro, vec3 rd, float t, vec3 axis, vec3 color, float pixel) {
  float b = dot(rd, axis);
  float denom = max(1.0 - b * b, 1e-6);
  float d = dot(rd, ro);
  float e = dot(axis, ro);
  float s = (b * e - d) / denom; // along the ray
  float u = (e - b * d) / denom; // along the axis
  if (s <= 0.0 || abs(u) > 10.0) return col;
  float gap = length(ro + rd * s - axis * u);
  float line = debugLine(gap, 2.0 * s * pixel); // two pixels wide
  float seen = s <= t * 1.001 + 0.01 ? 1.0 : 0.3; // behind the scene: fainter
  float side = u >= 0.0 ? 1.0 : 0.4; // the negative half: dimmer
  return mix(col, color, line * seen * side);
}

float debugSegment(vec2 q, vec2 a, vec2 b) {
  vec2 qa = q - a;
  vec2 ba = b - a;
  return length(qa - ba * clamp(dot(qa, ba) / dot(ba, ba), 0.0, 1.0));
}

// The letter of an axis, in strokes: 0 x, 1 y, 2 z, in a box from -1 to 1
float debugLetter(vec2 q, int letter) {
  if (letter == 0)
    return min(debugSegment(q, vec2(-0.6, -1.0), vec2(0.6, 1.0)), debugSegment(q, vec2(-0.6, 1.0), vec2(0.6, -1.0)));
  if (letter == 1)
    return min(min(debugSegment(q, vec2(-0.6, 1.0), vec2(0.0, 0.0)), debugSegment(q, vec2(0.6, 1.0), vec2(0.0, 0.0))), debugSegment(q, vec2(0.0, 0.0), vec2(0.0, -1.0)));
  return min(min(debugSegment(q, vec2(-0.6, 1.0), vec2(0.6, 1.0)), debugSegment(q, vec2(0.6, 1.0), vec2(-0.6, -1.0))), debugSegment(q, vec2(-0.6, -1.0), vec2(0.6, -1.0)));
}

// The letter of an axis beside it, a little past one unit from the origin, on a dark halo.
// uv: the pixel, in the units of the camera (main()); forward, right, up: the camera.
vec3 debugLabel(vec3 col, vec3 ro, float t, vec2 uv, vec3 forward, vec3 right, vec3 up, vec3 at, int letter, vec3 color) {
  vec3 v = at - ro;
  float depth = dot(v, forward);
  if (depth <= 0.0) return col;
  float size = 7.0 / iResolution.y; // half the height of a letter, in the units of uv
  vec2 place = vec2(dot(v, right), dot(v, up)) * 1.5 / depth + vec2(1.8 * size);
  vec2 q = (uv - place) / size;
  if (max(abs(q.x), abs(q.y)) > 2.0) return col;
  float d = debugLetter(q, letter) * size * iResolution.y; // in pixels
  float seen = length(v) <= t * 1.001 + 0.01 ? 1.0 : 0.3;
  col = mix(col, vec3(0.04, 0.04, 0.05), 0.55 * seen * (1.0 - smoothstep(2.0, 3.5, d)));
  return mix(col, color, seen * (1.0 - smoothstep(0.6, 1.4, d)));
}

vec3 debugOverlay(vec3 col, vec3 ro, vec3 rd, float t, vec2 uv, vec3 forward, vec3 right, vec3 up) {
  float pixel = 1.0 / (1.5 * iResolution.y);
  // The grid on the plane y = 0: a line every unit, out to 10 from the origin
  float along = abs(rd.y) > 1e-4 ? -ro.y / rd.y : -1.0;
  if (along > 0.0) {
    vec3 p = ro + rd * along;
    // A pixel on the plane: stretched along the ray as it grazes the plane, then measured
    // along x and along z
    vec2 h = length(rd.xz) > 1e-4 ? normalize(rd.xz) : vec2(1.0, 0.0);
    float across = along * pixel;
    float stretched = across / max(abs(rd.y), 0.02);
    vec2 width = sqrt(stretched * stretched * h * h + across * across * h.yx * h.yx);
    vec2 gap = abs(fract(p.xz + 0.5) - 0.5); // to the nearest line, along x and along z
    vec2 lines = vec2(debugLine(gap.x, width.x), debugLine(gap.y, width.y));
    // Gone where its lines would be thinner than its cells, and past 10
    lines *= 1.0 - smoothstep(0.08, 0.25, width);
    float line = max(lines.x, lines.y);
    float fade = 1.0 - smoothstep(8.0, 10.0, max(abs(p.x), abs(p.z)));
    float seen = along <= t * 1.001 + 0.01 ? 1.0 : 0.25;
    // Light lines on a dark scene, dark lines on a light one
    vec3 ink = dot(col, vec3(0.2126, 0.7152, 0.0722)) > 0.5 ? vec3(0.04, 0.04, 0.05) : vec3(0.91, 0.9, 0.88);
    col = mix(col, ink, line * fade * seen * 0.22);
  }
  // x red, y green, z blue, like most 3D tools
  col = debugAxis(col, ro, rd, t, vec3(1.0, 0.0, 0.0), vec3(0.95, 0.27, 0.25), pixel);
  col = debugAxis(col, ro, rd, t, vec3(0.0, 1.0, 0.0), vec3(0.36, 0.8, 0.36), pixel);
  col = debugAxis(col, ro, rd, t, vec3(0.0, 0.0, 1.0), vec3(0.3, 0.55, 1.0), pixel);
  col = debugLabel(col, ro, t, uv, forward, right, up, vec3(1.25, 0.0, 0.0), 0, vec3(0.95, 0.27, 0.25));
  col = debugLabel(col, ro, t, uv, forward, right, up, vec3(0.0, 1.25, 0.0), 1, vec3(0.36, 0.8, 0.36));
  col = debugLabel(col, ro, t, uv, forward, right, up, vec3(0.0, 0.0, 1.25), 2, vec3(0.3, 0.55, 1.0));
  return col;
}`;

export function withDebugOverlay(shader: string): string {
  return beforeEndOfMain(shader, DEBUG_OVERLAY, "  col = debugOverlay(col, ro, rd, t, uv, forward, right, up);");
}

// view: steps: each pixel colored by how many times its rays measured the distance to the scene,
// the calls of map(): the march, the normals, the shadows, the reflections, all of them. Dark
// under 10, then blue, green and yellow, and red at STEPS_MAX and over. The debug panel reads
// the colors back into numbers with the same ramp (src/playground/steps-reader.ts).
export const STEPS_MAX = 150;
export const STEPS_RAMP: [number, number, number][] = [
  [0.04, 0.05, 0.1],
  [0.13, 0.33, 0.85],
  [0.2, 0.75, 0.45],
  [0.98, 0.85, 0.25],
  [1, 0.35, 0.21],
];
const float = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const vec3 = (c: number[]) => `vec3(${c.map(float).join(", ")})`;

export const STEPS_COLOR = `// view: steps: the color of the number of times the rays of a pixel measured the scene
vec3 stepsColor(float steps) {
  float x = clamp(steps / ${float(STEPS_MAX)}, 0.0, 1.0);
  vec3 c = mix(${vec3(STEPS_RAMP[0])}, ${vec3(STEPS_RAMP[1])}, smoothstep(0.0, 0.25, x));
  c = mix(c, ${vec3(STEPS_RAMP[2])}, smoothstep(0.25, 0.5, x));
  c = mix(c, ${vec3(STEPS_RAMP[3])}, smoothstep(0.5, 0.75, x));
  return mix(c, ${vec3(STEPS_RAMP[4])}, smoothstep(0.75, 1.0, x));
}`;

const MAP = "vec2 map(vec3 p) {\n";

export function withStepsView(shader: string): string {
  const counted = shader.replace(
    MAP,
    `// view: steps: the calls of map() for this pixel\nfloat gssSteps = 0.0;\n\n${MAP}  gssSteps += 1.0;\n`,
  );
  return beforeEndOfMain(counted, STEPS_COLOR, "  col = stepsColor(gssSteps);");
}
