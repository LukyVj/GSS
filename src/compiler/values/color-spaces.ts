// The color spaces of CSS Color 4 and 5, for the color functions of colors.ts (decision 79).
// Every color goes through linear sRGB: rgb ↔ linear ↔ XYZ ↔ Lab / OKLab. The matrices
// are those of the sample code of CSS Color 4.

export type Rgb = [number, number, number]; // sRGB, 0 to 1 (outside means out of gamut)
type Vec = [number, number, number];

const multiply = (m: number[][], [x, y, z]: Vec): Vec => [
  m[0][0] * x + m[0][1] * y + m[0][2] * z,
  m[1][0] * x + m[1][1] * y + m[1][2] * z,
  m[2][0] * x + m[2][1] * y + m[2][2] * z,
];

// ----- sRGB and its linear light -----

export const toLinear = (rgb: Rgb): Vec =>
  rgb.map((c) => {
    const a = Math.abs(c);
    return a <= 0.04045 ? c / 12.92 : Math.sign(c) * ((a + 0.055) / 1.055) ** 2.4;
  }) as Vec;

export const fromLinear = (linear: Vec): Rgb =>
  linear.map((c) => {
    const a = Math.abs(c);
    return a <= 0.0031308 ? c * 12.92 : Math.sign(c) * (1.055 * a ** (1 / 2.4) - 0.055);
  }) as Rgb;

// ----- XYZ (D65), and D50 for Lab -----

export const LINEAR_TO_XYZ = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];
export const XYZ_TO_LINEAR = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
export const P3_TO_XYZ = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976],
];
export const D50_TO_D65 = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
export const D65_TO_D50 = [
  [1.0479297925449969, 0.022946870601609652, -0.05019226628920524],
  [0.02962780877005599, 0.9904344267538799, -0.017073799063418826],
  [-0.009243040646204504, 0.015055191490298152, 0.7518742814281371],
];
export const D50_WHITE: Vec = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

export const xyzToRgb = (xyz: Vec) => fromLinear(multiply(XYZ_TO_LINEAR, xyz));
export const xyzD50ToRgb = (xyz: Vec) => xyzToRgb(multiply(D50_TO_D65, xyz));
export const p3ToRgb = (p3: Rgb) => xyzToRgb(multiply(P3_TO_XYZ, toLinear(p3)));
const rgbToXyz = (rgb: Rgb) => multiply(LINEAR_TO_XYZ, toLinear(rgb));

// ----- Lab and LCH (CIE, D50) -----

export const EPSILON = 216 / 24389;
export const KAPPA = 24389 / 27;

export function labToRgb([l, a, b]: Vec): Rgb {
  const f1 = (l + 16) / 116;
  const f0 = a / 500 + f1;
  const f2 = f1 - b / 200;
  const x = f0 ** 3 > EPSILON ? f0 ** 3 : (116 * f0 - 16) / KAPPA;
  const y = l > KAPPA * EPSILON ? f1 ** 3 : l / KAPPA;
  const z = f2 ** 3 > EPSILON ? f2 ** 3 : (116 * f2 - 16) / KAPPA;
  return xyzD50ToRgb([x * D50_WHITE[0], y * D50_WHITE[1], z * D50_WHITE[2]]);
}

export function rgbToLab(rgb: Rgb): Vec {
  const xyz = multiply(D65_TO_D50, rgbToXyz(rgb));
  const [f0, f1, f2] = xyz.map((v, i) => {
    const r = v / D50_WHITE[i];
    return r > EPSILON ? Math.cbrt(r) : (KAPPA * r + 16) / 116;
  });
  return [116 * f1 - 16, 500 * (f0 - f1), 200 * (f1 - f2)];
}

// ----- OKLab and OKLCH -----

export function oklabToRgb([l, a, b]: Vec): Rgb {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return fromLinear([
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]);
}

export function rgbToOklab(rgb: Rgb): Vec {
  const [r, g, b] = toLinear(rgb);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

// ----- Polar forms: (lightness, chroma, hue in degrees) ↔ (lightness, a, b) -----

export const fromPolar = ([l, c, h]: Vec): Vec => [
  l,
  c * Math.cos((h * Math.PI) / 180),
  c * Math.sin((h * Math.PI) / 180),
];
// A color without chroma (a gray) has no hue: NaN, which color-mix() fills with the other's
export function toPolar([l, a, b]: Vec, gray: number): Vec {
  const c = Math.hypot(a, b);
  const h = (((Math.atan2(b, a) * 180) / Math.PI) + 360) % 360;
  return [l, c, c < gray ? NaN : h];
}

// ----- HSL and HWB -----

// h in degrees, s and l from 0 to 1 (CSS Color 4)
export function hslToRgb(h: number, s: number, l: number): Rgb {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

export function rgbToHsl([r, g, b]: Rgb): Vec {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [NaN, 0, l];
  const s = l === 0 || l === 1 ? 0 : (max - l) / Math.min(l, 1 - l);
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

// w and b from 0 to 1; when they reach 1 together, the color is a gray
export function hwbToRgb(h: number, w: number, b: number): Rgb {
  if (w + b >= 1) {
    const gray = w / (w + b);
    return [gray, gray, gray];
  }
  return hslToRgb(h, 1, 0.5).map((c) => c * (1 - w - b) + w) as Rgb;
}

export function rgbToHwb(rgb: Rgb): Vec {
  const [h] = rgbToHsl(rgb);
  return [h, Math.min(...rgb), 1 - Math.max(...rgb)];
}

// ----- Contrast (WCAG 2): the relative luminance of a color -----

export function luminance(rgb: Rgb): number {
  const [r, g, b] = toLinear(rgb);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
