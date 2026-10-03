// background-blend-mode (decision 112): the blend modes of CSS (Compositing and Blending 1),
// in the order GLSL needs, each one after those it calls. b is the color below (the
// backdrop), s the color of the layer (the source). Only the modes a scene uses go in the
// shader, like the other tables (decision 53).
export const BLEND_LIBRARY: Record<string, string> = {
  unpremultiply: `// A premultiplied color, back to its own color (black when it is fully transparent)
vec3 unpremultiply(vec4 c) {
  return c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
}`,
  blendMultiply: `vec3 blendMultiply(vec3 b, vec3 s) {
  return b * s;
}`,
  blendScreen: `vec3 blendScreen(vec3 b, vec3 s) {
  return b + s - b * s;
}`,
  blendHardLight: `vec3 blendHardLight(vec3 b, vec3 s) {
  vec3 t = 2.0 * s - 1.0;
  return mix(b * 2.0 * s, b + t - b * t, step(0.5, s));
}`,
  blendOverlay: `vec3 blendOverlay(vec3 b, vec3 s) {
  return blendHardLight(s, b);
}`,
  blendDarken: `vec3 blendDarken(vec3 b, vec3 s) {
  return min(b, s);
}`,
  blendLighten: `vec3 blendLighten(vec3 b, vec3 s) {
  return max(b, s);
}`,
  dodgeChannel: `float dodgeChannel(float b, float s) {
  if (b == 0.0) return 0.0;
  if (s >= 1.0) return 1.0;
  return min(1.0, b / (1.0 - s));
}`,
  blendColorDodge: `vec3 blendColorDodge(vec3 b, vec3 s) {
  return vec3(dodgeChannel(b.r, s.r), dodgeChannel(b.g, s.g), dodgeChannel(b.b, s.b));
}`,
  burnChannel: `float burnChannel(float b, float s) {
  if (b >= 1.0) return 1.0;
  if (s <= 0.0) return 0.0;
  return 1.0 - min(1.0, (1.0 - b) / s);
}`,
  blendColorBurn: `vec3 blendColorBurn(vec3 b, vec3 s) {
  return vec3(burnChannel(b.r, s.r), burnChannel(b.g, s.g), burnChannel(b.b, s.b));
}`,
  softChannel: `float softChannel(float b, float s) {
  if (s <= 0.5) return b - (1.0 - 2.0 * s) * b * (1.0 - b);
  float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
  return b + (2.0 * s - 1.0) * (d - b);
}`,
  blendSoftLight: `vec3 blendSoftLight(vec3 b, vec3 s) {
  return vec3(softChannel(b.r, s.r), softChannel(b.g, s.g), softChannel(b.b, s.b));
}`,
  blendDifference: `vec3 blendDifference(vec3 b, vec3 s) {
  return abs(b - s);
}`,
  blendExclusion: `vec3 blendExclusion(vec3 b, vec3 s) {
  return b + s - 2.0 * b * s;
}`,
  // The modes that are not channel by channel: hue, saturation, color, luminosity
  blendLum: `float blendLum(vec3 c) {
  return dot(c, vec3(0.3, 0.59, 0.11));
}`,
  blendClipColor: `vec3 blendClipColor(vec3 c) {
  float l = blendLum(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = l + (c - l) * l / (l - n);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / (x - l);
  return c;
}`,
  blendSetLum: `vec3 blendSetLum(vec3 c, float l) {
  return blendClipColor(c + (l - blendLum(c)));
}`,
  blendSat: `float blendSat(vec3 c) {
  return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
}`,
  blendSetSat: `vec3 blendSetSat(vec3 c, float s) {
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  return x > n ? (c - n) * s / (x - n) : vec3(0.0);
}`,
  blendHue: `vec3 blendHue(vec3 b, vec3 s) {
  return blendSetLum(blendSetSat(s, blendSat(b)), blendLum(b));
}`,
  blendSaturation: `vec3 blendSaturation(vec3 b, vec3 s) {
  return blendSetLum(blendSetSat(b, blendSat(s)), blendLum(b));
}`,
  blendColor: `vec3 blendColor(vec3 b, vec3 s) {
  return blendSetLum(s, blendLum(b));
}`,
  blendLuminosity: `vec3 blendLuminosity(vec3 b, vec3 s) {
  return blendSetLum(b, blendLum(s));
}`,
};

// The modes of CSS, and the function of each (normal: the layer goes over, no function)
export const BLEND_MODES: Record<string, string | null> = {
  normal: null,
  multiply: "blendMultiply",
  screen: "blendScreen",
  overlay: "blendOverlay",
  darken: "blendDarken",
  lighten: "blendLighten",
  "color-dodge": "blendColorDodge",
  "color-burn": "blendColorBurn",
  "hard-light": "blendHardLight",
  "soft-light": "blendSoftLight",
  difference: "blendDifference",
  exclusion: "blendExclusion",
  hue: "blendHue",
  saturation: "blendSaturation",
  color: "blendColor",
  luminosity: "blendLuminosity",
};
