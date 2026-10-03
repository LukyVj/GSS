// The noise of noise() (decision 111), in the order GLSL needs: each function after those
// it calls. Only what the scene uses goes in the shader, like the other tables (decision 53).
export const NOISE_LIBRARY: Record<string, string> = {
  noiseGradient: `// noise(): a random slope for each point of a grid, from -1 to 1 on each axis
vec3 noiseGradient(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0;
}`,

  gradientNoise: `// Smooth noise, about -1 to 1: a random slope at each point of a grid, blended
// between them (gradient noise, like Perlin's, which SVG feTurbulence uses)
float gradientNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(mix(dot(noiseGradient(i), f),
            dot(noiseGradient(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
        mix(dot(noiseGradient(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
            dot(noiseGradient(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(dot(noiseGradient(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
            dot(noiseGradient(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
        mix(dot(noiseGradient(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
            dot(noiseGradient(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x), u.y),
    u.z);
}`,

  fractalNoise: `// noise(): octaves of noise, each twice as fine and half as strong, from 0 to 1. The sum
// is divided by its spread, so more octaves add detail without washing out the colors
float fractalNoise(vec3 p, int octaves) {
  float sum = 0.0;
  float strength = 1.0;
  float norm = 0.0; // the strengths, squared: the spread of the sum
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += gradientNoise(p) * strength;
    norm += strength * strength;
    p = p * 2.0 + vec3(19.1, 33.4, 47.7);
    strength *= 0.5;
  }
  return clamp(0.5 + 1.25 * sum / sqrt(norm), 0.0, 1.0);
}`,

  turbulenceNoise: `// noise(turbulence …): the same octaves, each one folded at 0, so the noise makes
// sharp creases; from 0 to 1
float turbulenceNoise(vec3 p, int octaves) {
  float sum = 0.0;
  float strength = 1.0;
  float norm = 0.0; // the strengths, squared: the spread of the sum
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += abs(gradientNoise(p)) * strength;
    norm += strength * strength;
    p = p * 2.0 + vec3(19.1, 33.4, 47.7);
    strength *= 0.5;
  }
  return clamp(2.0 * sum / sqrt(norm), 0.0, 1.0);
}`,
};
