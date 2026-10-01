import type { Token } from "../syntax/tokenizer";
import { type Easing, stepsShape } from "../values/easing";
import { backgroundFunction, gradientLines, gradientMean, isGradient } from "./gradient";
import { closingParen } from "../values/calc";
import { readAnimation, type AnimationSpec } from "../features/animation";
import { readTransition } from "../features/transition";
import { errorAt, locate } from "../syntax/errors";
import { tokenize } from "../syntax/tokenizer";
import { FACES, type Face, type StyledInstance, type Styles } from "../cascade/resolve";
import type { Keyframes } from "../syntax/ast";
import { readFunction, readPolygon } from "../values/values";
import { readSvgPath, type Point } from "../values/svgpath";
import {
  pathFunction,
  polygonFunction,
  pathRadius,
  polygonRadius,
  type ViewBox,
} from "./path";
import { readRendering, readTexture, sceneTextures } from "../features/textures";

// What an object looks like when hovered, and its number in uHover[]
type Hover = { styles: Styles; slot: number };

// Utility functions
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// The GLSL functions of the shapes. Only those map() calls go in the shader.
const SHAPE_FUNCTIONS: Record<string, string> = {
  sdSphere: `float sdSphere(vec3 p, float r) {
  return length(p) - r;
}`,

  sdRoundBox: `float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}`,

  sdTorus: `float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}`,

  sdCylinder: `float sdCylinder(vec3 p, float h, float r) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}`,

  sdCappedCone: `// r1 = radius at the bottom, r2 = radius at the top, h = half the height
float sdCappedCone(vec3 p, float h, float r1, float r2) {
  vec2 q = vec2(length(p.xz), p.y);
  vec2 k1 = vec2(r2, h);
  vec2 k2 = vec2(r2 - r1, 2.0 * h);
  vec2 ca = vec2(q.x - min(q.x, (q.y < 0.0) ? r1 : r2), abs(q.y) - h);
  vec2 cb = q - k1 + k2 * clamp(dot(k1 - q, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}`,

  sdCapsule: `// h = half of the straight part
float sdCapsule(vec3 p, float h, float r) {
  p.y -= clamp(p.y, -h, h);
  return length(p) - r;
}`,
};

// The 2D helpers of path and prism. Only those the generated shapes call go in the shader.
const PATH_HELPERS: Record<string, string> = {
  segment2: `// For path objects: squared distances to a segment and to a box, in 2D
float segment2(vec2 p, vec2 a, vec2 b) {
  vec2 ap = p - a, ab = b - a;
  vec2 v = ap - ab * clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
  return dot(v, v);
}`,

  crosses: `// For prism objects: does the horizontal line through p cross the side a-b?
// Each crossing flips inside and outside.
bool crosses(vec2 p, vec2 a, vec2 b) {
  vec2 e = b - a, w = p - a;
  bvec3 c = bvec3(p.y >= a.y, p.y < b.y, e.x * w.y > e.y * w.x);
  return all(c) || all(not(c));
}`,

  extrude: `// Gives a 2D distance a depth along z: h is half the depth
float extrude(float d, float z, float h) {
  vec2 w = vec2(d, abs(z) - h);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}`,

  box2: `float box2(vec2 p, vec2 center, vec2 halfSize) {
  vec2 v = max(abs(p - center) - halfSize, 0.0);
  return dot(v, v);
}`,
};

// The rotation and the operations other than union. Only those map() calls go in the shader.
// The easings of the @keyframes that need a function: only those the scene uses
const EASINGS: Record<string, string> = {
  cubicBezier: `// cubic-bezier(): the progress at the moment x, for the handles h = (x1, y1, x2, y2).
// x(s) only goes up, so a bisection finds s, then y(s) is the progress.
float bezierAt(float s, float a, float b) {
  return (((1.0 + 3.0 * a - 3.0 * b) * s + (3.0 * b - 6.0 * a)) * s + 3.0 * a) * s;
}
float cubicBezier(float x, vec4 h) {
  float low = 0.0, high = 1.0;
  for (int i = 0; i < 16; i++) {
    float s = 0.5 * (low + high);
    if (bezierAt(s, h.x, h.z) < x) low = s; else high = s;
  }
  return bezierAt(0.5 * (low + high), h.y, h.w);
}`,

  playhead: `// The progress of an animation in its iteration, like CSS. t: seconds since it
// started (after the delay), n: iterations, dir: 0 normal, 1 reverse, 2 alternate,
// 3 alternate-reverse. Before the start: the first frame; after the end: the last.
float playhead(float t, float duration, float n, int dir) {
  float c = clamp(t / duration, 0.0, n);
  float i = floor(c);
  if (i == c && c == n && n > 0.0) i -= 1.0; // the end of the last iteration
  float f = c - i;
  bool odd = mod(i, 2.0) == 1.0;
  bool back = dir == 1 || (dir == 2 && odd) || (dir == 3 && !odd);
  return back ? 1.0 - f : f;
}`,
};

const MAP_HELPERS: Record<string, string> = {
  rot: `mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}`,

  opS: `// Carves b out of a. The walls of the hole take b's material.
vec2 opS(vec2 a, vec2 b) {
  return (-b.x > a.x) ? vec2(-b.x, b.y) : a;
}`,

  opI: `// Keeps only what is inside both a and b
vec2 opI(vec2 a, vec2 b) {
  return (a.x > b.x) ? a : b;
}`,

  opSmoothU: `// Smooth versions (Inigo Quilez). k is the blend distance.
// h tells which side wins at this point: 0 → b (the new object), 1 → a (what was there).
vec2 opSmoothU(vec2 a, vec2 b, float k) {
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  float d = mix(b.x, a.x, h) - k * h * (1.0 - h);
  return vec2(d, h > 0.5 ? a.y : b.y);
}`,

  opSmoothS: `vec2 opSmoothS(vec2 a, vec2 b, float k) {
  float h = clamp(0.5 - 0.5 * (a.x + b.x) / k, 0.0, 1.0);
  float d = mix(a.x, -b.x, h) + k * h * (1.0 - h);
  return vec2(d, h > 0.5 ? b.y : a.y);
}`,

  opSmoothI: `vec2 opSmoothI(vec2 a, vec2 b, float k) {
  float h = clamp(0.5 - 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  float d = mix(b.x, a.x, h) + k * h * (1.0 - h);
  return vec2(d, h > 0.5 ? a.y : b.y);
}`,
};

// The materials other than matte. Only those getMaterial() uses go in the shader.
const MATERIALS: Record<string, string> = {
  metal: `const int METAL = 1;

Material metal(vec3 color, float roughness) {
  return Material(color, METAL, roughness, 0.0, 1.0, 0); // frostStyle: only glass reads it
}`,

  jelly: `const int JELLY = 2;

Material jelly(vec3 color, float density) {
  return Material(color, JELLY, 0.0, density, 1.0, 0); // frostStyle: only glass reads it
}`,

  glass: `const int GLASS = 3;

// The frost styles of glass
const int FROSTED = 0;
const int WAVY = 1;
const int HAMMERED = 2;
const int BLURRED = 3;

Material glass(vec3 color, float ior, float frost, int frostStyle) {
  return Material(color, GLASS, frost, 0.0, ior, frostStyle);
}`,
};

// The line of main() that lights each material
const SHADE_CALLS: Record<string, string> = {
  metal: "    if (m.kind == METAL) col = shadeMetal(p, n, rd, m);",
  jelly: "    if (m.kind == JELLY) col = shadeJelly(p, n, rd, m);",
  glass: "    if (m.kind == GLASS) col = shadeGlass(p, n, rd, m);",
};

// The image seen from the axis the surface faces most: y is the top and the bottom,
// x and z are the sides. q: the point in the object's space (centered on 0),
// n: the normal in that space, box: the full size of the object
const TRIPLANAR = `vec3 triplanar(sampler2D image, vec3 q, vec3 n, vec3 box, vec3 color, bool pixelated) {
  vec3 a = abs(n);
  vec2 uv;
  if (a.y >= a.x && a.y >= a.z) uv = q.xz / box.xz;  // top and bottom
  else if (a.x >= a.z) uv = q.zy / box.zy;           // left and right
  else uv = q.xy / box.xy;                           // front and back
  vec2 st = fract(uv + 0.5);                         // from 0 to 1, again at each image: the pattern repeats
  if (pixelated) {
    vec2 size = vec2(textureSize(image, 0));         // the image in pixels: 16×16
    st = (floor(st * size) + 0.5) / size;            // the center of the pixel st falls in
  }
  vec4 pixel = texture(image, st);
  return mix(color, pixel.rgb, pixel.a);
}`;

// Which face a normal points to, in the object's space: its number in FACE_NUMBERS.
// The same tests as triplanar(), so a face and its image always agree.
const FACE_OF = `int faceOf(vec3 n) {
  vec3 a = abs(n);
  if (a.y >= a.x && a.y >= a.z) return n.y > 0.0 ? 1 : 2;  // top, bottom
  if (a.x >= a.z) return n.x > 0.0 ? 5 : 6;                // right, left
  return n.z > 0.0 ? 3 : 4;                                // front, back
}`;

// The number faceOf() gives each face
const FACE_NUMBERS: Record<Face, number> = {
  top: 1,
  bottom: 2,
  front: 3,
  back: 4,
  right: 5,
  left: 6,
};

// The size one image covers: texture-size, or else the full size of the object (one image per face)
function textureBox(instance: StyledInstance): number[] {
  // texture-size: the size of one image on the surface; the pattern repeats (like background-size)
  const imageSize = instance.styles["texture-size"];
  if (imageSize) {
    const size = readNumber(imageSize, "texture-size", 1); // its error: "texture-size expects one positive number"
    return [size, size, size];
  }

  if (instance.tag === "cube") return readSize(instance.styles["size"]);
  if (instance.tag === "sphere") {
    const diameter = 2 * readNumber(instance.styles["radius"], "radius", 0.5); // same default as SHAPES.sphere
    return [diameter, diameter, diameter];
  }
  return [1, 1, 1];
}

// The GLSL of the textures: one uniform per image, one space function per textured
// object, triplanar() and textureColor(). Nothing at all when the scene has no texture.
function textureCode(
  instances: StyledInstance[],
  keyframes: Keyframes[],
  hoverOf: (instance: StyledInstance) => Hover | undefined,
) {
  const files = sceneTextures(instances);
  if (files.length === 0) return { uniforms: "", functions: "", call: "" };

  const uniforms = files
    .map((file, i) => `uniform sampler2D uTexture${i}; // ${file}`)
    .join("\n");

  const textured = instances.filter(
    (instance) =>
      instance.styles["texture"] ||
      FACES.some((face) => instance.faceStyles[face]["texture"]),
  );

  // The same moves as in map(): the groups from the outside in, then the object
  const spaces = textured.map((instance) => spaceFunction(instance, keyframes, hoverOf));

  const branches = textured.map((instance) => {
    const id = glslFloat(instance.index);
    const space = `space${instance.index}`;
    const box = vec3(textureBox(instance));
    const pixelated = readRendering(instance.styles["image-rendering"]); // one rendering for every face
    // The number of the image a texture value names, or null when there is none
    const imageOf = (value: Token[] | undefined): number | null =>
      value ? files.indexOf(readTexture(value)) : null;
    const read = (image: number, q: string, normal: string) =>
      `triplanar(uTexture${image}, ${q}, ${normal}, ${box}, color, ${pixelated})`;

    const side = imageOf(instance.styles["texture"]);
    // The faces with an image of their own, and that image
    const faces = FACES.map((face) => ({
      face,
      image: imageOf(instance.faceStyles[face]["texture"]),
    })).filter((entry) => entry.image !== null);

    // No face of its own: one line, like before
    if (faces.length === 0) {
      return `  if (id == ${id}) return ${read(side!, `${space}(p)`, `${space}(p + n * 0.01) - ${space}(p)`)};`;
    }
    return [
      `  if (id == ${id}) {  // ${label(instance)}`,
      `    vec3 q = ${space}(p);`,
      `    vec3 ln = ${space}(p + n * 0.01) - q; // the normal in the object's space`,
      `    int face = faceOf(ln);`,
      ...faces.map(
        ({ face, image }) =>
          `    if (face == ${FACE_NUMBERS[face]}) return ${read(image!, "q", "ln")}; // ${face}`,
      ),
      side !== null
        ? `    return ${read(side, "q", "ln")};`
        : "    return color;", // no side image: the color
      "  }",
    ].join("\n");
  });

  const textureColor = [
    "vec3 textureColor(float id, vec3 p, vec3 n, vec3 color) {",
    ...branches,
    "  return color;", // the objects without a texture keep their color
    "}",
  ].join("\n");

  return {
    uniforms,
    functions: [
      ...spaces,
      TRIPLANAR,
      ...(branches.join("\n").includes("faceOf(") ? [FACE_OF] : []),
      textureColor,
    ].join("\n\n"),
    call: "    m.color = textureColor(id, p, n, m.color);",
  };
}

// The lighting functions, in the order GLSL needs: each one after those it calls.
// Only those the shade calls need, directly or not, go in the shader.
const SHADING: Record<string, string> = {
  trace: `// What a ray sees, with diffuse lighting only.
// Reflections use it: one bounce, never more.
vec3 trace(vec3 ro, vec3 rd) {
  vec2 hit = march(ro, rd);
  if (hit.x > MAX_DIST) return BACKGROUND;  // the ray hit nothing

  vec3 p = ro + rd * hit.x;  // the point that was hit
  vec3 n = calcNormal(p);
  return diffuse(n, getMaterial(hit.y).color);  // its color, lit
}`,

  fresnel: `// Schlick's approximation of Fresnel: surfaces reflect more at grazing angles.
// f0 = the color of the reflection seen from the front.
vec3 fresnel(vec3 f0, vec3 rd, vec3 n) {
  float c = 1.0 - max(dot(-rd, n), 0.0); // 0 = seen from the front, 1 = grazing
  return f0 + (1.0 - f0) * pow(c, 5.0);
}`,

  shadeMetal: `// A metal reflects the scene, tinted by its color.
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
}`,

  thickness: `// How much matter is behind p? A few steps inside, along -n.
// Inside an object, map() is negative. 0 = thin edge, 1 = deep inside.
float thickness(vec3 p, vec3 n) {
  float inside = 0.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.1 * float(i);
    float d = map(p - n * h).x;
    inside += clamp(-d / h, 0.0, 1.0);
  }
  return inside / 5.0;
}`,

  shadeJelly: `// Jelly: light goes through its thin parts and glows.
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
}`,

  hash3: `// A pseudo-random vec3 between 0 and 1, from a position.
// The same position always gives the same result.
vec3 hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}`,

  noise: `// Smooth noise: random values on a grid, blended between the grid points.
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
}`,

  bump: `// A smooth random vector between -0.5 and 0.5, with two sizes of bumps
vec3 bump(vec3 p, float scale) { 
  vec3 q = p * scale;
    vec3 b = vec3(noise(q), noise(q + 17.0), noise(q + 41.0)) - 0.5;
    b += (vec3(noise(q * 2.7), noise(q * 2.7 + 5.0), noise(q * 2.7 + 9.0)) - 0.5) * 0.5;
    return b;
}`,

  frostSettings: `// The settings of each frost style:
// x = size of the bumps, y = their strength, z = how much white frosted layer
vec3 frostSettings(int style) {
  if (style == WAVY)     return vec3(7.0, 0.45, 0.0);
  if (style == HAMMERED) return vec3(20.0, 0.3, 0.0);
  if (style == BLURRED)  return vec3(9.0, 0.35, 0.0);
  return vec3(9.0, 0.6, 0.5);          // FROSTED, the default
}`,

  marchInside: `// Like march(), but inside an object, where map() is negative.
// Returns how far the ray goes before it comes out.
float marchInside(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < 64; i++) {
    float d = -map(ro + rd * t).x;                          // ← the distance to the edge, from inside
    t += max(d, 0.002);                     // always move a little, even at the edge
    if (d < 0.001 || t > MAX_DIST) break;   // reached the other side
  }
  return t;                               // ← how far the ray went
}`,

  shadeGlass: `// Glass: the ray bends in, crosses the object, bends out, and shows what's behind.
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
}`,
};

// A part of the shader under its comment, or nothing at all when the part is empty
function section(comment: string, code: string): string {
  return code ? `${comment}\n${code}` : "";
}

// Lines added at the end of a line of the template: nothing when there are none,
// so no blank line is left behind (getMaterial(), main())
function moreLines(code: string): string {
  return code ? `\n${code}` : "";
}

// The functions of "table" that "code" calls, ready to paste in the shader.
// Also those they call themselves: shadeGlass() calls noise(), which calls hash3().
// They come out in the order of the table, so each one after those it calls.
function used(table: Record<string, string>, code: string): string {
  const picked = new Set<string>();
  let searched = code; // the code, then every function picked so far
  let found = true;
  while (found) {
    found = false;
    for (const [name, fn] of Object.entries(table)) {
      if (picked.has(name) || !searched.includes(name + "(")) continue;
      picked.add(name);
      searched += "\n" + fn;
      found = true;
    }
  }
  return Object.entries(table)
    .filter(([name]) => picked.has(name))
    .map(([, fn]) => fn)
    .join("\n\n");
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

// Reads the contours of a prism: d: polygon(0 1, 1 -1, -1 -1), one contour,
// or d: path("…"), one contour per subpath (the holes of a letter are subpaths)
function readPrismD(value: Token[] | undefined): Point[][] {
  const example =
    'd: polygon(0 -1, 1 1, -1 1); or d: path("M0 0 L1 0 L1 1 Z");';
  if (!value) throw new Error(`prism needs a d, like: ${example}`);
  const points = readPolygon(value);
  if (points) return [points];

  const call = readFunction(value);
  const [arg] = call?.args ?? [];
  if (
    call?.name === "path" &&
    call.args.length === 1 &&
    arg.length === 1 &&
    arg[0].type === "STRING"
  ) {
    const d = arg[0];
    // The precision follows the size of the shape: a logo 400 units wide
    // is cut as finely, relative to its size, as a shape 2 units wide
    const rough = locate(d, () => readSvgPath(d.value, Infinity)).flat();
    const size =
      Math.max(...rough.map((p) => p.x)) -
      Math.min(...rough.map((p) => p.x)) +
      Math.max(...rough.map((p) => p.y)) -
      Math.min(...rough.map((p) => p.y));
    return locate(d, () => readSvgPath(d.value, Math.max(size, 1e-6) / 1000));
  }
  throw errorAt(
    value,
    `d expects polygon(…) or path("…") on a prism, like: ${example}`,
  );
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
// Each shape turns the object's styles into GLSL, and gives the radius of a sphere,
// centered on its origin, that holds the whole shape: map() skips the object when
// even that sphere is further than the nearest object found so far (null: no sphere,
// the object is always drawn). Every shape below is an exact distance, so the
// distance to the shape is never less than the distance to its sphere.
type Shape = { code: string; radius: number | null };

const SHAPES: Record<
  string,
  (styles: Styles, context: ShapeContext) => Shape
> = {
  cube: (styles) => {
    const half = readSize(styles["size"]).map((n) => n / 2);
    const corner = Math.min(
      readNumber(styles["corner-radius"], "corner-radius", 0.08, true),
      ...half,
    );
    return {
      code: `sdRoundBox(q, ${vec3(half)}, ${glslFloat(corner)})`,
      radius: Math.hypot(...half), // the corner of the box
    };
  },
  sphere: (styles) => {
    const radius = readNumber(styles["radius"], "radius", 0.5);
    return { code: `sdSphere(q, ${glslFloat(radius)})`, radius };
  },
  torus: (styles) => {
    const radius = readNumber(styles["radius"], "radius", 1);
    const thickness = readNumber(styles["thickness"], "thickness", 0.28);
    return {
      code: `sdTorus(q, vec2(${glslFloat(radius)}, ${glslFloat(thickness)}))`,
      radius: radius + thickness,
    };
  },
  cylinder: (styles) => {
    const radius = readNumber(styles["radius"], "radius", 0.5);
    const height = readNumber(styles["height"], "height", 1);
    return {
      code: `sdCylinder(q, ${glslFloat(height / 2)}, ${glslFloat(radius)})`,
      radius: Math.hypot(radius, height / 2), // the rim of a cap
    };
  },
  cone: (styles) => {
    const [bottom, top] = readRadii(styles["radius"]);
    const height = readNumber(styles["height"], "height", 1);
    return {
      code: `sdCappedCone(q, ${glslFloat(height / 2)}, ${glslFloat(bottom)}, ${glslFloat(top)})`,
      radius: Math.hypot(Math.max(bottom, top), height / 2), // the rim of the wider cap
    };
  },
  capsule: (styles) => {
    const radius = readNumber(styles["radius"], "radius", 0.25);
    const height = readNumber(styles["height"], "height", 1);
    const half = height / 2 - radius; // half of the straight part
    if (half < 0) {
      throw errorAt(
        styles["height"],
        `capsule height must be at least twice its radius (${glslFloat(radius * 2)}), like: height: ${radius * 2};`,
      );
    }
    return {
      code: `sdCapsule(q, ${glslFloat(half)}, ${glslFloat(radius)})`,
      radius: height / 2, // the tip of a cap
    };
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
    return { code: `${name}(q)`, radius: pathRadius(lines, width, viewBox) };
  },
  // A polygon, filled, then given a depth
  prism: (styles, context) => {
    const contours = readPrismD(styles["d"]);
    const depth = readNumber(styles["depth"], "depth", 0.2);
    const viewBox = readViewBox(styles["view-box"]);
    const code = locate(styles["d"], () =>
      polygonFunction("NAME", contours, depth, viewBox),
    );
    return {
      code: `${useFunction(context, code)}(q)`,
      radius: polygonRadius(contours, depth, viewBox),
    };
  },
  // A thin box: the ray could jump over a surface with no thickness
  plane: (styles) => {
    const [width, depth] = readFlatSize(styles["size"]);
    const half = [width / 2, 0.01, depth / 2];
    return {
      code: `sdRoundBox(q, ${vec3(half)}, 0.0)`,
      radius: Math.hypot(...half),
    };
  },
};

// The shapes worth a bounding test: their distance walks dozens of segments.
// Measured (npm run bench, dpr 2, M4 Pro): bounding every object made the scenes of
// simple shapes slower (spiral +44 %, todal +21 %): for a sphere, the test costs as
// much as the shape, and one branch per object breaks the straight-line code GPUs
// run best. Bounding only path and prism keeps what orrery and macropad gained.
const BOUNDED = new Set(["path", "prism"]);

// The radius of an object's bounding sphere, for the tests
export function shapeRadius(tag: string, styles: Styles): number | null {
  return SHAPES[tag](styles, { functions: new Map() }).radius;
}

// The names of the shapes the compiler can draw: the docs must list them all
export function shapeNames(): string[] {
  return Object.keys(SHAPES);
}

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
      throw errorAt(token, `${errorMessage} (got ${token.value})`);
    return token.value;
  });

  if (numbers.length === 1) return [numbers[0], 0];
  if (numbers.length === 2) return numbers;
  throw errorAt(value, errorMessage);
}

// Reads "2" or "2 1" and returns the full width and depth of a plane
function readFlatSize(value: Token[] | undefined): number[] {
  const errorMessage =
    "size expects one or two positive numbers on a plane, like: size: 2 1;";
  if (!value) return [1, 1];
  const numbers = value.map((token) => {
    if (token.type !== "NUMBER" || token.value <= 0)
      throw errorAt(token, errorMessage);
    return token.value;
  });

  if (numbers.length === 1) return [numbers[0], numbers[0]];
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
      "color expects a hex, rgb(), hsl() or named color, like: color: #ff5a36; or color: rgb(255 0 0); or color: red;",
    );
  }
  const rgb = locate(token, () => hexToRgb(token.value));
  return `vec3(${rgb.map(glslFloat).join(", ")})`;
}

// The background: a constant color, or a gradient drawn over the canvas
function backgroundCode(value: Token[] | undefined): string {
  if (isGradient(value)) return backgroundFunction(value);
  return `const vec3 BACKGROUND = ${readColor(value, "vec3(0.03)")};`;
}

// ----- Gradients on objects (decision 82) -----

// The gradient an object is painted with, from its color or the first argument of its
// material (which wins, like a material's own color), and its styles where that gradient
// is replaced by its mean color: what getMaterial() and the reflections see.
function objectGradient(
  instance: StyledInstance,
  keyframes: Keyframes[],
  hover: Hover | undefined,
): { gradient: Token[] | null; styles: Styles } {
  const styles = instance.styles;
  const hash = (value: Token[]): Token => ({ type: "HASH", value: gradientMean(value) });
  let gradient: Token[] | null = null;
  let changed: Styles = styles;

  const color = styles["color"];
  if (isGradient(color)) {
    gradient = color;
    changed = { ...changed, color: [hash(color)] };
  }
  const material = styles["material"];
  // material: metal(linear-gradient(…), 0.2): a gradient as the first argument
  const opensGradient =
    material?.[1]?.type === "PUNCT" &&
    material[1].value === "(" &&
    material[2]?.type === "IDENT" &&
    material[3]?.type === "PUNCT" &&
    material[3].value === "(" &&
    isGradient(material.slice(2, closingParen(material, 3) + 1));
  if (material && opensGradient) {
    const end = closingParen(material, 3);
    gradient = material.slice(2, end + 1);
    changed = { ...changed, material: [material[0], material[1], hash(gradient), ...material.slice(end + 1)] };
  }
  if (!gradient) return { gradient: null, styles };

  // A gradient is not animated: say so rather than ignore a color that would never show
  const name = styles["animation"]?.[0];
  const played = name?.type === "IDENT" ? keyframes.findLast((k) => k.name === name.value) : undefined;
  if (played?.frames.some((f) => f.declarations.some((d) => d.property === "color")))
    throw errorAt(styles["animation"], `${label(instance)} is painted with a gradient: its color cannot be animated`);
  if (hover && JSON.stringify(hover.styles["color"]) !== JSON.stringify(color))
    throw errorAt(hover.styles["color"] ?? gradient, `${label(instance)} is painted with a gradient: :hover cannot change its color`);
  return { gradient, styles: changed };
}

// The rectangle a gradient covers: the object seen from the front, x right and y up
// (seen from above for a plane, the top of the picture away from the camera)
function gradientBox(instance: StyledInstance): { size: number[]; at: string } {
  const styles = instance.styles;
  const front = (w: number, h: number) => ({ size: [w, h], at: "q.xy" });
  switch (instance.tag) {
    case "cube": {
      const [x, y] = readSize(styles["size"]);
      return front(x, y);
    }
    case "sphere": {
      const d = 2 * readNumber(styles["radius"], "radius", 0.5);
      return front(d, d);
    }
    case "torus": {
      const r = readNumber(styles["radius"], "radius", 1);
      const t = readNumber(styles["thickness"], "thickness", 0.28);
      return front(2 * (r + t), 2 * t);
    }
    case "cylinder":
    case "capsule":
      return front(
        2 * readNumber(styles["radius"], "radius", instance.tag === "capsule" ? 0.25 : 0.5),
        readNumber(styles["height"], "height", 1),
      );
    case "cone":
      return front(2 * Math.max(...readRadii(styles["radius"])), readNumber(styles["height"], "height", 1));
    case "plane": {
      const [w, d] = readFlatSize(styles["size"]);
      return { size: [w, d], at: "vec2(q.x, -q.z)" };
    }
  }
  const r = shapeRadius(instance.tag, styles) ?? 1; // path, prism: their bounding sphere
  return front(2 * r, 2 * r);
}

// The space of an object: the same moves as in map(), groups from the outside in, then the object
function spaceFunction(
  instance: StyledInstance,
  keyframes: Keyframes[],
  hoverOf: (instance: StyledInstance) => Hover | undefined,
): string {
  const nodes = [...instance.groupStyles, instance.styles];
  return [
    `vec3 space${instance.index}(vec3 p) {  // ${label(instance)}`,
    "  vec3 q = p;",
    ...nodes.flatMap((styles, n) =>
      transformLines(styles, keyframes, n === nodes.length - 1 ? hoverOf(instance) : undefined),
    ),
    "  return q;",
    "}",
  ].join("\n");
}

// gradientColor(): the color of a painted object at the point that was hit
function gradientCode(
  painted: { instance: StyledInstance; gradient: Token[] }[],
  textured: Set<StyledInstance>,
  keyframes: Keyframes[],
  hoverOf: (instance: StyledInstance) => Hover | undefined,
) {
  if (painted.length === 0) return { functions: "", call: "" };
  const spaces = painted
    .filter(({ instance }) => !textured.has(instance)) // a textured object has its space already
    .map(({ instance }) => spaceFunction(instance, keyframes, hoverOf));
  const branches = painted.map(({ instance, gradient }) => {
    const { size, at } = gradientBox(instance);
    return [
      `  if (id == ${glslFloat(instance.index)}) {  // ${label(instance)}`,
      `    vec3 q = space${instance.index}(p);`,
      `    vec2 size = vec2(${size.map(glslFloat).join(", ")});`,
      `    vec2 at = ${at} + 0.5 * size;`,
      ...gradientLines(gradient).map((line) => `  ${line}`),
      "    return col;",
      "  }",
    ].join("\n");
  });
  return {
    functions: [
      ...spaces,
      ["vec3 gradientColor(float id, vec3 p, vec3 color) {", ...branches, "  return color;", "}"].join("\n"),
    ].join("\n\n"),
    call: "    m.color = gradientColor(id, p, m.color);",
  };
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

// ----- Animations, computed once per pixel -----
// An animated value (or one :hover changes) depends on the time, not on the point.
// map() runs about 150 times per pixel (the march, the normal, the reflection):
// such a value is computed once, in animate() at the start of main(), and map()
// reads it from a global. Same arithmetic, moved: the image does not change.
type Hoisted = { names: Map<string, string>; values: { type: string; name: string; expr: string }[] };

function createHoisted(): Hoisted {
  return { names: new Map(), values: [] };
}

// The expression as it is when it is constant; otherwise the name of its global
// (two objects with the same animation share it)
function hoist(hoisted: Hoisted | undefined, type: "float" | "vec3" | "mat2", expr: string): string {
  if (!hoisted || !/\b(iTime|uHover)\b/.test(expr)) return expr;
  const key = `${type} ${expr}`;
  let name = hoisted.names.get(key);
  if (!name) {
    name = `anim${hoisted.values.length}`;
    hoisted.names.set(key, name);
    hoisted.values.push({ type, name, expr });
  }
  return name;
}

// The globals and animate(), or "" when nothing moves
function animateCode(hoisted: Hoisted): string {
  if (hoisted.values.length === 0) return "";
  return [
    "// Animations and :hover: they depend on the time, not on the point, so",
    "// animate() computes them once per pixel, and map() reads them",
    ...hoisted.values.map(({ type, name }) => `${type} ${name};`),
    "",
    "void animate() {",
    ...hoisted.values.map(({ name, expr }) => `  ${name} = ${expr};`),
    "}",
  ].join("\n");
}

function rotationLines(
  styles: Styles,
  keyframes: Keyframes[],
  hover?: Hover,
  hoisted?: Hoisted,
): string[] {
  const lines: string[] = [];
  for (const [property, axes] of ROTATIONS) {
    const angle = hoverValue(styles, keyframes, property, readRotation, hover);
    if (angle === "0.0") continue; // no rotation on this axis
    lines.push(`  q.${axes} *= ${hoist(hoisted, "mat2", `rot(${angle})`)};`);
  }
  return lines;
}

// The lines that move q into the space of one node (a group or an object)
// hover: only for the object itself, never for its groups
function transformLines(
  styles: Styles,
  keyframes: Keyframes[],
  hover?: Hover,
  hoisted?: Hoisted,
): string[] {
  return [
    `  q -= ${hoist(hoisted, "vec3", hoverValue(styles, keyframes, "translate", readTranslate, hover))};`,
    ...rotationLines(styles, keyframes, hover, hoisted),
    `  q /= ${hoist(hoisted, "float", hoverValue(styles, keyframes, "scale", readScale, hover))};`,
  ];
}

// The objects that can be hovered, in scene order: each one gets a slot in uHover[]
export function hoverSlots(instances: StyledInstance[]): StyledInstance[] {
  return instances.filter((instance) => instance.hoverTriggers.length > 0);
}

// A property at rest, or mixed with its hovered value when :hover changes it
function hoverValue(
  styles: Styles,
  keyframes: Keyframes[],
  property: string,
  read: (value: Token[] | undefined) => string,
  hover?: Hover,
): string {
  const rest = animatedValue(styles, keyframes, property, read);
  if (!hover) return rest; // this object cannot be hovered
  const hovered = animatedValue(hover.styles, keyframes, property, read);
  if (hovered === rest) return rest; // :hover does not change this property
  return `mix(${rest}, ${hovered}, uHover[${hover.slot}])`;
}

function label(instance: StyledInstance): string {
  const id = instance.id ? `#${instance.id}` : "";
  const classes = instance.classes.map((c) => `.${c}`).join("");
  return `${instance.tag}${id}${classes}`;
}

const DIRECTION_NUMBERS = {
  normal: 0,
  reverse: 1,
  alternate: 2,
  "alternate-reverse": 3,
};
// Infinity in GLSL: more iterations than any scene will ever play
const FOREVER = 1e9;

// How the shader plays an animation: the progress (0 to 1) in the current iteration,
// and when the animation shows at all (null: always). Without a delay, a count or a
// direction other than alternate, the expressions are the ones GSS always wrote.
function playback(spec: AnimationSpec): {
  progress: string;
  active: string | null;
} {
  const { duration, delay, iterations, direction, fill } = spec;
  const plain = delay === 0 && iterations === Infinity;
  const time = `iTime / ${glslFloat(duration)}`;
  if (plain && direction === "normal")
    return { progress: `fract(${time})`, active: null }; // 0 → 1, 0 → 1 …
  if (plain && direction === "alternate")
    return { progress: `(1.0 - abs(mod(${time}, 2.0) - 1.0))`, active: null }; // 0 → 1 → 0 …

  const t =
    delay === 0
      ? "iTime"
      : delay > 0
        ? `iTime - ${glslFloat(delay)}`
        : `iTime + ${glslFloat(-delay)}`;
  const n = iterations === Infinity ? FOREVER : iterations;
  const progress = `playhead(${t}, ${glslFloat(duration)}, ${glslFloat(n)}, ${DIRECTION_NUMBERS[direction]})`;

  // Like CSS: outside the animation, the object's own value, unless the fill mode
  // holds the first frame (backwards) during the delay or the last one (forwards) after
  const conditions: string[] = [];
  const holdsBefore = delay <= 0 || fill === "backwards" || fill === "both";
  const holdsAfter =
    iterations === Infinity || fill === "forwards" || fill === "both";
  if (!holdsBefore) conditions.push(`iTime >= ${glslFloat(delay)}`);
  if (!holdsAfter)
    conditions.push(`iTime < ${glslFloat(round(delay + iterations * duration))}`);
  return {
    progress,
    active: conditions.length > 0 ? conditions.join(" && ") : null,
  };
}

// An easing in GLSL. No easing, or a straight line: the progress itself.
export function easingCode(easing: Easing | null, progress: string): string {
  if (!easing) return progress;
  if (easing.type === "cubic-bezier") {
    const { x1, y1, x2, y2 } = easing;
    // ease-in-out stays a smoothstep, close to the CSS curve and much cheaper:
    // the scenes written before cubic-bezier() keep their exact motion
    if (x1 === 0.42 && y1 === 0 && x2 === 0.58 && y2 === 1)
      return `smoothstep(0.0, 1.0, ${progress})`;
    const handles = [x1, y1, x2, y2].map(glslFloat).join(", ");
    return `cubicBezier(${progress}, vec4(${handles}))`;
  }
  // steps(): the progress snapped to its jumps
  if (easing.type === "steps") {
    const { jumps, offset } = stepsShape(easing);
    const n = glslFloat(easing.count);
    const floor = offset ? `floor(${progress} * ${n}) + 1.0` : `floor(${progress} * ${n})`;
    return `(min(${floor}, ${glslFloat(jumps)}) / ${glslFloat(jumps)})`;
  }
  // linear(): the first output, plus what each segment adds once it has started
  const { points } = easing;
  const straight =
    points.length === 2 &&
    points[0].input === 0 &&
    points[0].output === 0 &&
    points[1].input === 1 &&
    points[1].output === 1;
  if (straight) return progress;
  let code = glslFloat(points[0].output);
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const rise = to.output - from.output;
    if (rise === 0) continue; // a flat segment adds nothing
    const along =
      to.input === from.input
        ? `step(${glslFloat(from.input)}, ${progress})` // a jump
        : `clamp((${progress} - ${glslFloat(from.input)}) / ${glslFloat(to.input - from.input)}, 0.0, 1.0)`;
    code += ` + ${glslFloat(rise)} * ${along}`;
  }
  return `(${code})`;
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
  const animation = readAnimation(styles);
  if (!animation) return own;

  const { name } = animation;
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
  const { progress, active } = playback(animation);
  let result = stops[0].value;
  for (let i = 1; i < stops.length; i++) {
    const start = stops[i - 1].offset;
    const length = round(stops[i].offset - start);
    const local = `clamp((${progress} - ${glslFloat(start)}) / ${glslFloat(length)}, 0.0, 1.0)`;
    let weight = easingCode(animation.easing, local);
    // Before its segment starts, local is 0: an easing that is not 0 there (steps() with
    // jump-start, linear(0.5, 1)…) must wait for its segment, or it covers the ones before
    if (i > 1 && animation.easing && !startsAtZero(animation.easing))
      weight = `${weight} * step(${glslFloat(start)}, ${progress})`;
    result = `mix(${result}, ${stops[i].value}, ${weight})`;
  }
  return active ? `((${active}) ? ${result} : ${own})` : result;
}

// ----- The sphere around the whole scene -----
// A ray that passes by it meets no object: march() then only has the floor left,
// found without marching (most of the sky and of the floor, in most scenes).
// It must hold every object at every moment of its animations, and hovered.

// Every value an animated (or hovered) expression can take, read from the GLSL
// itself: a constant, or mix(a, b, w) with a weight w in [0, 1] (a keyframe segment:
// clamp(…, 0.0, 1.0), eased or not; :hover: uHover[i]). Such a value always stays in
// the box of its constants. null: anything else (then the scene gets no sphere).
function splitArguments(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(" || text[i] === "[") depth++;
    else if (text[i] === ")" || text[i] === "]") depth--;
    else if (text[i] === "," && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts;
}

// The arguments of `name(…)` when the whole text is that one call, else null
function callOf(text: string, name: string): string[] | null {
  if (!text.startsWith(`${name}(`) || !text.endsWith(")")) return null;
  let depth = 0;
  for (let i = name.length; i < text.length - 1; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return null; // closes before the end
  }
  return splitArguments(text.slice(name.length + 1, -1));
}

// A weight that always stays in [0, 1]: smoothstep(0.0, 1.0, …) whatever is inside,
// clamp(…, 0.0, 1.0), and uHover[i] when the transitions of that object never
// overshoot (stays01)
function isWeight(text: string, steadyHover: boolean): boolean {
  const smooth = callOf(text, "smoothstep");
  if (smooth) return smooth.length === 3 && smooth[0] === "0.0" && smooth[1] === "1.0";
  const clamped = callOf(text, "clamp");
  if (clamped) return clamped.length === 3 && clamped[1] === "0.0" && clamped[2] === "1.0";
  return steadyHover && /^uHover\[\d+\]$/.test(text);
}

// An easing whose progress is 0 at the start of its segment
function startsAtZero(easing: Easing): boolean {
  if (easing.type === "steps") return stepsShape(easing).offset === 0;
  if (easing.type === "linear") return easing.points[0].output === 0;
  return true; // a cubic-bezier() always starts at (0, 0)
}

// An easing whose progress never leaves [0, 1]: a cubic-bezier() stays in the hull of
// its points (0, y1, y2, 1), a linear() between its outputs. A transition with such
// easings keeps uHover[] in [0, 1]; one that overshoots (back-out…) can push it out.
function stays01(easing: Easing): boolean {
  if (easing.type === "steps") return true; // from 0 to 1 by jumps
  const outputs =
    easing.type === "cubic-bezier" ? [easing.y1, easing.y2] : easing.points.map((p) => p.output);
  return outputs.every((y) => y >= 0 && y <= 1);
}

function anchors(expr: string, steadyHover: boolean): number[][] | null {
  const text = expr.trim();
  const parts = callOf(text, "mix");
  if (parts) {
    if (parts.length !== 3 || !isWeight(parts[2], steadyHover)) return null;
    const [a, b] = [anchors(parts[0], steadyHover), anchors(parts[1], steadyHover)];
    return a && b ? [...a, ...b] : null;
  }
  const inside = text.match(/^vec3\((.*)\)$/)?.[1] ?? text;
  const numbers = splitArguments(inside).map(Number);
  if (numbers.length !== 1 && numbers.length !== 3) return null;
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  return [numbers.length === 1 ? [numbers[0], numbers[0], numbers[0]] : numbers];
}

type Sphere = { center: number[]; radius: number };

const length3 = (v: number[]) => Math.hypot(v[0], v[1], v[2]);

// The box of some points: its middle, and half its diagonal
function boxOfPoints(points: number[][]): { middle: number[]; reach: number } {
  const low = [0, 1, 2].map((i) => Math.min(...points.map((p) => p[i])));
  const high = [0, 1, 2].map((i) => Math.max(...points.map((p) => p[i])));
  return {
    middle: low.map((l, i) => (l + high[i]) / 2),
    reach: length3(low.map((l, i) => (high[i] - l) / 2)),
  };
}

// uHover[] of this object stays in [0, 1]: its transitions (rest and hovered) never overshoot
function steadyTransitions(instance: StyledInstance): boolean {
  return [instance.styles, instance.hoverStyles].every((styles) => {
    const transition = readTransition(styles["transition"]);
    return !transition || stays01(transition.easing);
  });
}

// One object's sphere in the scene, through its own transforms and its groups', from
// the inside out. A node maps its child's space to its parent's: scale, rotate,
// then translate. null when a value is not known at compile time.
function objectSphere(
  radius: number,
  instance: StyledInstance,
  keyframes: Keyframes[],
  hover: Hover | undefined,
): Sphere | null {
  let sphere: Sphere = { center: [0, 0, 0], radius };
  const nodes = [...instance.groupStyles, instance.styles];
  for (let n = nodes.length - 1; n >= 0; n--) {
    const nodeHover = n === nodes.length - 1 ? hover : undefined;
    const value = (property: string, read: (value: Token[] | undefined) => string) =>
      hoverValue(nodes[n], keyframes, property, read, nodeHover);
    const steady = !nodeHover || steadyTransitions(instance);
    const scales = anchors(value("scale", readScale), steady);
    const translates = anchors(value("translate", readTranslate), steady);
    if (!scales || !translates) return null;
    // Scale: anywhere between the smallest and the largest
    const factors = scales.map((s) => Math.abs(s[0]));
    const [low, high] = [Math.min(...factors), Math.max(...factors)];
    const middle = (low + high) / 2;
    sphere = {
      center: sphere.center.map((c) => c * middle),
      radius: sphere.radius * high + (length3(sphere.center) * (high - low)) / 2,
    };
    // Rotation, at any angle: the sphere is centered on the node's origin
    const rotated = ROTATIONS.some(([property]) => value(property, readRotation) !== "0.0");
    if (rotated) sphere = { center: [0, 0, 0], radius: length3(sphere.center) + sphere.radius };
    // Translate: anywhere in the box of its values
    const box = boxOfPoints(translates);
    sphere = {
      center: sphere.center.map((c, i) => c + box.middle[i]),
      radius: sphere.radius + box.reach,
    };
  }
  return sphere;
}

// The first lines of march(): a ray that passes by the sphere of the scene meets
// no object. With a floor, it meets the floor (y = 0) or nothing; without, nothing.
// What main() does with a floor hit only depends on the floor's normal and color,
// so the pixel is the one the march would have found.
function sceneMiss(center: number[], radius: number, floor: boolean): string {
  const r = Math.ceil(radius * 1000) / 1000; // rounded up: never smaller
  const hit = floor
    ? [
        "    float floorT = rd.y < 0.0 ? -ro.y / rd.y : 1e10;",
        "    return vec2(floorT < MAX_DIST ? floorT : MAX_DIST + 1.0, 0.0);",
      ]
    : ["    return vec2(MAX_DIST + 1.0, 0.0);"];
  return [
    "  // A ray that passes by the sphere around every object, at every moment of",
    "  // their animations, meets no object: only the floor is left, found at once",
    `  vec3 oc = ro - ${vec3(center.map((c) => Math.round(c * 10000) / 10000))};`,
    "  float b = dot(oc, rd);",
    `  float c = dot(oc, oc) - ${glslFloat(Math.round(r * r * 10000) / 10000 + 0.001)};`,
    `  if (${floor ? "ro.y > 0.0 && " : ""}c > 0.0 && (b > 0.0 || b * b < c * dot(rd, rd))) {`,
    ...hit,
    "  }",
    "",
  ].join("\n");
}

// The sphere that holds all the others
function enclosing(spheres: Sphere[]): Sphere {
  const box = boxOfPoints(
    spheres.flatMap(({ center, radius }) => [
      center.map((c) => c - radius),
      center.map((c) => c + radius),
    ]),
  );
  const radius = Math.max(
    ...spheres.map((s) => length3(s.center.map((c, i) => c - box.middle[i])) + s.radius),
  );
  return { center: box.middle, radius };
}

// ----- Bounds on whole groups -----
// A group of several objects gets one test around all of them: when the point is
// further from the group's sphere than the nearest object so far, none of its objects
// can be nearer, and map() skips them all (their transforms and their shapes). Only
// plain unions can be skipped, and only when every object's sphere is known (the
// same spheres as the sphere of the scene: every moment of the animations, hovered).
// Nested groups get their own test inside their parent's.
const GROUP_MIN = 3; // fewer objects: the test costs about what it saves

function groupBounds(
  instances: StyledInstance[],
  codes: string[],
  spheres: (Sphere | null)[],
  plainUnion: (instance: StyledInstance) => boolean,
  nearest: string,
): string {
  const indent = (code: string) => code.replace(/^/gm, "  ");
  const emit = (members: number[], depth: number): string[] => {
    const out: string[] = [];
    let i = 0;
    while (i < members.length) {
      const group = instances[members[i]].groups[depth];
      let j = i + 1;
      while (group && j < members.length && instances[members[j]].groups[depth] === group) j++;
      const run = members.slice(i, j);
      const bounded =
        group &&
        run.length >= GROUP_MIN &&
        run.every((m) => spheres[m] !== null && plainUnion(instances[m]));
      if (!group) out.push(codes[members[i]]);
      else if (!bounded) out.push(...emit(run, depth + 1));
      else {
        const sphere = enclosing(run.map((m) => spheres[m]!));
        // A little bigger, rounded up: the GPU computes in 32-bit floats
        const r = Math.ceil((sphere.radius + 0.001) * 10000) / 10000;
        const center = vec3(sphere.center.map((c) => Math.round(c * 10000) / 10000));
        // the center is rounded to 0.0001: the radius grows by as much as it may move
        const safe = Math.ceil((r + 0.0001) * 10000) / 10000;
        out.push(
          [
            ` // ${label(group as StyledInstance)}: ${run.length} objects, one test for all`,
            `  if (length(p - ${center}) - ${glslFloat(safe)} <= ${nearest}) {`,
            indent(emit(run, depth + 1).join("\n\n")),
            "  }",
          ].join("\n"),
        );
      }
      i = j;
    }
    return out;
  };
  return emit(instances.map((_, i) => i), 0).join("\n\n");
}

export function generateShader(
  instances: StyledInstance[],
  sceneStyles: Styles = {},
  keyframes: Keyframes[] = [],
): string {
  const slots = hoverSlots(instances);
  // The hover state of one object, or undefined when it cannot be hovered
  const hoverOf = (instance: StyledInstance): Hover | undefined => {
    const slot = slots.indexOf(instance);
    return slot === -1 ? undefined : { styles: instance.hoverStyles, slot };
  };
  const context: ShapeContext = { functions: new Map() };
  const hoisted = createHoisted(); // the animated values of map(): computed by animate()
  const spheres: (Sphere | null)[] = []; // each object's, for the sphere of the scene

  // What an object must beat to matter. With only plain unions, map() is a plain min():
  // an object further than the floor can never be the nearest, so the floor counts
  // from the start. Otherwise the order of the operations matters, and only the
  // objects already combined count (res.x).
  const plainUnion = (instance: StyledInstance) =>
    readOperation(instance.styles["operation"]) === "opU" &&
    readNumber(instance.styles["blend"], "blend", 0, true) === 0;
  const floorStyle = sceneStyles["floor"];
  const hasFloor = !(
    floorStyle?.length === 1 &&
    floorStyle[0].type === "IDENT" &&
    floorStyle[0].value === "none"
  );
  const nearest =
    hasFloor && instances.every(plainUnion) ? "min(res.x, p.y)" : "res.x";

  const mapLines = instances.map((instance) => {
    const shape = SHAPES[instance.tag];
    if (!shape) {
      throw new Error(
        `Unknown object: "${instance.tag}". Available: ${Object.keys(SHAPES).join(", ")}`,
      );
    }
    const { code: shapeCode, radius } = shape(instance.styles, context);
    spheres.push(radius === null ? null : objectSphere(radius, instance, keyframes, hoverOf(instance)));
    // Every node from the outside in: the groups, then the object itself
    const nodes = [...instance.groupStyles, instance.styles];
    // q was divided by every scale, so the distance is multiplied back by all of them
    // :hover moves the object itself, the last node, never its groups
    const hover = hoverOf(instance);
    const last = nodes.length - 1;
    const scales = nodes.map((styles, n) =>
      hoist(
        hoisted,
        "float",
        hoverValue(
          styles,
          keyframes,
          "scale",
          readScale,
          n === last ? hover : undefined,
        ),
      ),
    );

    const operation = readOperation(instance.styles["operation"]);
    const blend = readNumber(instance.styles["blend"], "blend", 0, true);
    const shapeValue = `vec2(${shapeCode} * ${scales.join(" * ")}, ${glslFloat(instance.index)})`;

    const combine =
      blend > 0
        ? `${SMOOTH[operation]}(res, ${shapeValue}, ${glslFloat(blend)})`
        : `${operation}(res, ${shapeValue})`;

    const groupLines = instance.groupStyles.flatMap((styles) =>
      transformLines(styles, keyframes, undefined, hoisted),
    );

    // Only a costly shape is worth the test, and only a plain union can be skipped:
    // a subtraction, an intersection or a blend changes the result even when far
    if (radius === null || !BOUNDED.has(instance.tag) || !plainUnion(instance)) {
      return [
        ` // ${label(instance)}`,
        `  q = p;`,
        ...groupLines,
        ...transformLines(instance.styles, keyframes, hover, hoisted),
        ` res = ${combine};`,
      ].join("\n");
    }

    // The bounding sphere: tested after the object's own translate and before its
    // rotations (a sphere looks the same from every side), so a skipped object costs
    // neither its rotations nor its shape. Its distance, back in scene units: the
    // object's own scale grows the sphere, the groups' scales grow everything.
    const ownScale = scales[last];
    const groupScales = scales.slice(0, last);
    // A little bigger, rounded up: the GPU computes in 32-bit floats, and a sphere
    // smaller than the shape would skip an object that touches the ray
    const safeRadius = Math.ceil((radius + 0.001) * 10000) / 10000;
    const sphere = `(length(q) - ${glslFloat(safeRadius)} * ${ownScale})${groupScales.map((scale) => ` * ${scale}`).join("")}`;
    return [
      ` // ${label(instance)}`,
      `  q = p;`,
      ...groupLines,
      `  q -= ${hoist(hoisted, "vec3", hoverValue(instance.styles, keyframes, "translate", readTranslate, hover))};`,
      `  if (${sphere} <= ${nearest}) { // its bounding sphere could be the nearest`,
      ...rotationLines(instance.styles, keyframes, hover, hoisted).map((line) => `  ${line}`),
      `    q /= ${ownScale};`,
      `   res = ${combine};`,
      `  }`,
    ].join("\n");
  });

  // The objects painted with a gradient (decision 82)
  const painted: { instance: StyledInstance; gradient: Token[] }[] = [];
  const materialLines = instances.map((instance) => {
    const { gradient, styles } = objectGradient(instance, keyframes, hoverOf(instance));
    if (gradient) painted.push({ instance, gradient });
    instance = gradient ? { ...instance, styles } : instance;
    const color = hoverValue(
      instance.styles,
      keyframes,
      "color",
      readColor,
      gradient ? undefined : hoverOf(instance), // a gradient's color does not change on :hover
    );
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

  const map = groupBounds(instances, mapLines, spheres, plainUnion, nearest);
  // A blend adds a fillet up to its distance around the objects it joins
  const maxBlend = Math.max(0, ...instances.map((i) => readNumber(i.styles["blend"], "blend", 0, true)));
  const known = spheres.every((s): s is Sphere => s !== null) && spheres.length > 0;
  const scene = known ? enclosing(spheres as Sphere[]) : null;
  const sceneSphereCode = scene
    ? sceneMiss(scene.center, scene.radius + maxBlend + 0.01, hasFloor)
    : "";
  const animate = animateCode(hoisted);
  const textures = textureCode(instances, keyframes, hoverOf);
  const textured = new Set(
    instances.filter(
      (instance) =>
        sceneTextures([instance]).length > 0,
    ),
  );
  const gradients = gradientCode(painted, textured, keyframes, hoverOf);
  const materials = materialLines.join("\n");
  // One line in main() for each material the scene uses
  const shadeCalls = Object.entries(SHADE_CALLS)
    .filter(([kind]) => materials.includes(kind + "("))
    .map(([, line]) => line)
    .join("\n");

  return (
    TEMPLATE.replace(
      "/*@EASINGS*/",
      section(
        "// The easings of the animations: only those the scene uses",
        used(
          EASINGS,
          [map, animate, textures.functions, gradients.functions, textures.call, materials].join("\n"),
        ),
      ),
    )
      .replace("/*@SHAPE_FUNCTIONS*/", used(SHAPE_FUNCTIONS, map))
      .replace("/*@PATH_HELPERS*/", used(PATH_HELPERS, functions)) // called by the path and prism functions, not by map()
      .replace(
        "/*@MAP_HELPERS*/",
        section(
          "// Rotations and the other operations: only those map() calls",
          used(MAP_HELPERS, map + animate),
        ) + (animate ? `\n\n${animate}` : ""),
      )
      .replace(
        "/*@SHAPES*/",
        section("// Shapes written by GSS (path…)", functions),
      )
      .replace("/*@MAP*/", map)
      .replace("/*@TEXTURE_UNIFORMS*/", textures.uniforms)
      .replace(
        "/*@HOVER_UNIFORM*/",
        slots.length > 0
          ? `uniform float uHover[${slots.length}]; // 0 at rest, 1 hovered
uniform bool uPicking; // true: draw the id of the object under uPick, not its color
uniform vec2 uPick;`
          : "",
      )
      .replace("/*@PICK_PIXEL*/", slots.length > 0 ? PICK_PIXEL : "")
      .replace("/*@PIXEL*/", slots.length > 0 ? "pixel" : "gl_FragCoord.xy")
      .replace("/*@PICK_OUTPUT*/", slots.length > 0 ? PICK_OUTPUT : "")
      .replace(
        "/*@TEXTURES*/",
        section(
          "// Textures: each image seen from the axis the surface faces most",
          textures.functions,
        ) +
          (gradients.functions
            ? `\n\n// Gradients on objects: the color at the point that was hit\n${gradients.functions}`
            : ""),
      )
      .replace(
        "/*@TEXTURE_CALL*/",
        moreLines([gradients.call, textures.call].filter(Boolean).join("\n")),
      )
      .replace(
        "/*@MATERIALS_USED*/",
        section(
          "// The metal, jelly and glass materials: only those getMaterial() uses",
          used(MATERIALS, materials),
        ),
      )
      .replace("/*@MATERIALS*/", moreLines(materials))
      .replace(
        "/*@SHADING*/",
        section(
          "// The lighting of metal, jelly and glass, and what it calls: only what the scene uses",
          used(SHADING, shadeCalls),
        ),
      )
      .replace("/*@SHADE_CALLS*/", moreLines(shadeCalls))
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
      // A color is a constant; a gradient a function of the pixel (decision 81)
      .replace(
        "const vec3 BACKGROUND = /*@BACKGROUND*/;",
        backgroundCode(sceneStyles["background"]),
      )
      // The background gradient needs the camera, and the reflections the gradients of objects
      .replace(
        "  vec3 up = cross(forward, right);\n",
        isGradient(sceneStyles["background"])
          ? "  vec3 up = cross(forward, right);\n  camForward = forward;\n  camRight = right;\n  camUp = up;\n"
          : "  vec3 up = cross(forward, right);\n",
      )
      .replace(
        "return diffuse(n, getMaterial(hit.y).color);",
        painted.length > 0
          ? "return diffuse(n, gradientColor(hit.y, p, getMaterial(hit.y).color));"
          : "return diffuse(n, getMaterial(hit.y).color);",
      )
      .replace(
        "vec2 march(vec3 ro, vec3 rd) {\n",
        `vec2 march(vec3 ro, vec3 rd) {\n${sceneSphereCode}`,
      )
      // The animations of this pixel, computed once before anything calls map()
      .replace(
        "void main() {",
        animate ? "void main() {\n  animate();" : "void main() {",
      )
      // The parts left out leave blank lines behind: never more than one in a row
      .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n")
  );
}

// The picking pass (:hover): the same shader, drawn on one pixel, aims at the mouse
const PICK_PIXEL = `
  vec2 pixel = uPicking ? uPick : gl_FragCoord.xy;`;

// ...and writes the id of the object it hits, before any lighting: red + 256 × green
const PICK_OUTPUT = `
  if (uPicking) {
    float picked = t < MAX_DIST ? id : 0.0; // 0: the background
    outColor = vec4(mod(picked, 256.0) / 255.0, floor(picked / 256.0) / 255.0, 0.0, 1.0);
    return;
  }`;

// The shader skeleton. Only the /*@...*/ parts change from one scene to the next.
const TEMPLATE = `#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec2 uCamera;
uniform float uDist;
/*@TEXTURE_UNIFORMS*/
/*@HOVER_UNIFORM*/

out vec4 outColor;

/*@EASINGS*/

/*@SHAPE_FUNCTIONS*/

/*@PATH_HELPERS*/

/*@SHAPES*/

// ----- Materials -----
// Which lighting main() uses for the surface
const int MATTE = 0;

struct Material {
  vec3 color;
  int kind;        // MATTE or METAL or JELLY or GLASS
  float roughness;
  float density;
  float ior;
  int frostStyle;
};

Material matte(vec3 color) {
  return Material(color, MATTE, 0.0, 0.0, 1.0, 0); // frostStyle: only glass reads it
}

/*@MATERIALS_USED*/


// The union: always there, the floor uses it
vec2 opU(vec2 a, vec2 b) {
  return (a.x < b.x) ? a : b;
}

/*@MAP_HELPERS*/

// ----- Generated by GSS -----
vec2 map(vec3 p) {
  vec2 res = vec2(1e10, 0.0); // nothing yet
  vec3 q;

/*@MAP*/

  res = opU(res, vec2(/*@FLOOR_DISTANCE*/, 0.0)); // the floor: id 0
  return res;
}

Material getMaterial(float id) {/*@MATERIALS*/
  return matte(/*@FLOOR*/);  // the floor
}

/*@TEXTURES*/
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

/*@SHADING*/

void main() {/*@PICK_PIXEL*/
  vec2 uv = (/*@PIXEL*/ - 0.5 * iResolution.xy) / iResolution.y;

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
  float id = hit.y;/*@PICK_OUTPUT*/

  vec3 col = BACKGROUND;
  if (t < MAX_DIST) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    Material m = getMaterial(id);/*@TEXTURE_CALL*/
    col = diffuse(n, m.color);/*@SHADE_CALLS*/
  }

  outColor = vec4(col, 1.0);
}
`;
