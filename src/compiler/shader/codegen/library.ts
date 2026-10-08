// The GLSL functions the shader may need: shapes, path helpers, easings, the
// operations of map(), the materials. generateShader() pastes only those the
// scene calls (see used() in glsl.ts).

// The GLSL functions of the shapes. Only those map() calls go in the shader.
export const SHAPE_FUNCTIONS: Record<string, string> = {
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
export const PATH_HELPERS: Record<string, string> = {
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

// The easings of the @keyframes that need a function: only those the scene uses
export const EASINGS: Record<string, string> = {
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

// The rotation and the operations other than union. Only those map() calls go in the shader.
export const MAP_HELPERS: Record<string, string> = {
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
export const MATERIALS: Record<string, string> = {
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

  emissive: `const int EMISSIVE = 4;

// A surface that gives its own light (decision 153): the strength goes in density
Material emissive(vec3 color, float strength) {
  return Material(color, EMISSIVE, 0.0, strength, 1.0, 0); // frostStyle: only glass reads it
}`,
};

// The line of main() that lights each material
export const SHADE_CALLS: Record<string, string> = {
  metal: "    if (m.kind == METAL) col = shadeMetal(p, n, rd, m);",
  jelly: "    if (m.kind == JELLY) col = shadeJelly(p, n, rd, m);",
  glass: "    if (m.kind == GLASS) col = shadeGlass(p, n, rd, m);",
  emissive: "    if (m.kind == EMISSIVE) col += m.color * m.density;",
};
