// The color spaces of CSS in GLSL, for the colors a variable set from JS changes
// (decision 105): hsl(var(--hue) 80% 60%) cannot be computed at compile time. The same
// formulas and matrices as color-spaces.ts, which computes every other color.
// Only the functions the scene calls go in the shader (used() in glsl.ts).
import {
  D50_TO_D65,
  D50_WHITE,
  D65_TO_D50,
  EPSILON,
  KAPPA,
  LINEAR_TO_XYZ,
  P3_TO_XYZ,
  XYZ_TO_LINEAR,
} from "../../values/color-spaces";

const n = (x: number) => {
  const text = String(+x.toPrecision(12));
  return text.includes(".") || text.includes("e") ? text : `${text}.0`;
};
// A 3×3 matrix (rows) times a vec3, as three dot products: GLSL's mat3 is column-major
const times = (m: number[][], v: string) =>
  `vec3(${m.map((row) => `dot(vec3(${row.map(n).join(", ")}), ${v})`).join(", ")})`;
const white = `vec3(${D50_WHITE.map(n).join(", ")})`;

// A hue mixed between two colors, like color-mix(): a gray (gray = 1.0) takes the other's
// hue; the shorter or the longer way around (longer = 1.0)
const MIX_HUE = `float colorMixHue(float a, float b, float grayA, float grayB, float t, float longer) {
  if (grayA > 0.5 && grayB > 0.5) return 0.0;
  if (grayA > 0.5) a = b;
  if (grayB > 0.5) b = a;
  float d = b - a;
  if (longer > 0.5) {
    if (d > 0.0 && d < 180.0) d -= 360.0;
    else if (d > -180.0 && d <= 0.0) d += 360.0;
  } else if (d > 180.0) d -= 360.0;
  else if (d < -180.0) d += 360.0;
  return mod(a + d * t, 360.0);
}`;

// In the order of the shader: each function after those it calls
export const COLOR_LIBRARY: Record<string, string> = {
  colorToLinear: `vec3 colorToLinear(vec3 c) {
  vec3 a = abs(c);
  return mix(c / 12.92, sign(c) * pow((a + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), a));
}`,
  colorFromLinear: `vec3 colorFromLinear(vec3 c) {
  vec3 a = abs(c);
  return mix(c * 12.92, sign(c) * (1.055 * pow(a, vec3(1.0 / 2.4)) - 0.055), step(vec3(0.0031308), a));
}`,
  colorCbrt: `float colorCbrt(float x) {
  return sign(x) * pow(abs(x), 1.0 / 3.0);
}`,
  colorXyz: `vec3 colorXyz(vec3 xyz) {
  return colorFromLinear(${times(XYZ_TO_LINEAR, "xyz")});
}`,
  colorXyzD50: `vec3 colorXyzD50(vec3 xyz) {
  return colorXyz(${times(D50_TO_D65, "xyz")});
}`,
  colorP3: `vec3 colorP3(vec3 p3) {
  return colorXyz(${times(P3_TO_XYZ, "colorToLinear(p3)")});
}`,
  colorHsl: `vec3 colorHsl(float h, float s, float l) {
  float a = s * min(l, 1.0 - l);
  vec3 k = mod(vec3(0.0, 8.0, 4.0) + h / 30.0, 12.0);
  return l - a * max(vec3(-1.0), min(min(k - 3.0, 9.0 - k), vec3(1.0)));
}`,
  colorHwb: `vec3 colorHwb(float h, float w, float b) {
  if (w + b >= 1.0) return vec3(w / (w + b));
  return colorHsl(h, 1.0, 0.5) * (1.0 - w - b) + w;
}`,
  colorLab: `vec3 colorLab(vec3 lab) {
  float f1 = (lab.x + 16.0) / 116.0;
  float f0 = lab.y / 500.0 + f1;
  float f2 = f1 - lab.z / 200.0;
  float x = f0 * f0 * f0 > ${n(EPSILON)} ? f0 * f0 * f0 : (116.0 * f0 - 16.0) / ${n(KAPPA)};
  float y = lab.x > ${n(KAPPA * EPSILON)} ? f1 * f1 * f1 : lab.x / ${n(KAPPA)};
  float z = f2 * f2 * f2 > ${n(EPSILON)} ? f2 * f2 * f2 : (116.0 * f2 - 16.0) / ${n(KAPPA)};
  return colorXyzD50(vec3(x, y, z) * ${white});
}`,
  colorOklab: `vec3 colorOklab(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.291485548 * c.z;
  vec3 lms = vec3(l * l * l, m * m * m, s * s * s);
  return colorFromLinear(vec3(
    dot(vec3(4.0767416621, -3.3077115913, 0.2309699292), lms),
    dot(vec3(-1.2684380046, 2.6097574011, -0.3413193965), lms),
    dot(vec3(-0.0041960863, -0.7034186147, 1.707614701), lms)));
}`,
  colorFromPolar: `vec3 colorFromPolar(vec3 c) {
  float h = radians(c.z);
  return vec3(c.x, c.y * cos(h), c.y * sin(h));
}`,
  colorToPolar: `vec3 colorToPolar(vec3 c) {
  return vec3(c.x, length(c.yz), mod(degrees(atan(c.z, c.y)) + 360.0, 360.0));
}`,
  colorLabF: `float colorLabF(float r) {
  return r > ${n(EPSILON)} ? colorCbrt(r) : (${n(KAPPA)} * r + 16.0) / 116.0;
}`,
  colorToLab: `vec3 colorToLab(vec3 rgb) {
  vec3 r = ${times(D65_TO_D50, times(LINEAR_TO_XYZ, "colorToLinear(rgb)"))} / ${white};
  vec3 f = vec3(colorLabF(r.x), colorLabF(r.y), colorLabF(r.z));
  return vec3(116.0 * f.y - 16.0, 500.0 * (f.x - f.y), 200.0 * (f.y - f.z));
}`,
  colorToOklab: `vec3 colorToOklab(vec3 rgb) {
  vec3 c = colorToLinear(rgb);
  float l = colorCbrt(dot(vec3(0.4122214708, 0.5363325363, 0.0514459929), c));
  float m = colorCbrt(dot(vec3(0.2119034982, 0.6806995451, 0.1073969566), c));
  float s = colorCbrt(dot(vec3(0.0883024619, 0.2817188376, 0.6299787005), c));
  return vec3(
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s);
}`,
  // h in degrees, s and l; a gray has no hue (s = 0)
  colorToHsl: `vec3 colorToHsl(vec3 c) {
  float hi = max(c.x, max(c.y, c.z));
  float lo = min(c.x, min(c.y, c.z));
  float l = (hi + lo) / 2.0;
  float d = hi - lo;
  if (d == 0.0) return vec3(0.0, 0.0, l);
  float s = l == 0.0 || l == 1.0 ? 0.0 : (hi - l) / min(l, 1.0 - l);
  float h = hi == c.x ? (c.y - c.z) / d + (c.y < c.z ? 6.0 : 0.0) : hi == c.y ? (c.z - c.x) / d + 2.0 : (c.x - c.y) / d + 4.0;
  return vec3(h * 60.0, s, l);
}`,
  colorMixHue: MIX_HUE,
  colorMixHsl: `vec3 colorMixHsl(vec3 a, vec3 b, float t, float longer) {
  vec3 p = colorToHsl(a);
  vec3 q = colorToHsl(b);
  float h = colorMixHue(p.x, q.x, p.y == 0.0 ? 1.0 : 0.0, q.y == 0.0 ? 1.0 : 0.0, t, longer);
  return colorHsl(h, mix(p.y, q.y, t), mix(p.z, q.z, t));
}`,
  colorMixHwb: `vec3 colorMixHwb(vec3 a, vec3 b, float t, float longer) {
  vec3 p = vec3(colorToHsl(a).x, min(a.x, min(a.y, a.z)), 1.0 - max(a.x, max(a.y, a.z)));
  vec3 q = vec3(colorToHsl(b).x, min(b.x, min(b.y, b.z)), 1.0 - max(b.x, max(b.y, b.z)));
  float h = colorMixHue(p.x, q.x, p.y + p.z >= 1.0 ? 1.0 : 0.0, q.y + q.z >= 1.0 ? 1.0 : 0.0, t, longer);
  return colorHwb(h, mix(p.y, q.y, t), mix(p.z, q.z, t));
}`,
  colorMixOklch: `vec3 colorMixOklch(vec3 a, vec3 b, float t, float longer) {
  vec3 p = colorToPolar(colorToOklab(a));
  vec3 q = colorToPolar(colorToOklab(b));
  float h = colorMixHue(p.z, q.z, p.y < 0.0001 ? 1.0 : 0.0, q.y < 0.0001 ? 1.0 : 0.0, t, longer);
  return colorOklab(colorFromPolar(vec3(mix(p.x, q.x, t), mix(p.y, q.y, t), h)));
}`,
  colorMixLch: `vec3 colorMixLch(vec3 a, vec3 b, float t, float longer) {
  vec3 p = colorToPolar(colorToLab(a));
  vec3 q = colorToPolar(colorToLab(b));
  float h = colorMixHue(p.z, q.z, p.y < 0.01 ? 1.0 : 0.0, q.y < 0.01 ? 1.0 : 0.0, t, longer);
  return colorLab(colorFromPolar(vec3(mix(p.x, q.x, t), mix(p.y, q.y, t), h)));
}`,
  // White or black, whichever contrasts most (WCAG 2), like contrast-color()
  colorContrast: `vec3 colorContrast(vec3 c) {
  float y = dot(vec3(0.2126, 0.7152, 0.0722), colorToLinear(c));
  return 1.05 / (y + 0.05) >= (y + 0.05) / 0.05 ? vec3(1.0) : vec3(0.0);
}`,
};
