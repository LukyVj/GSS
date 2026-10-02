// The lighting functions, in the order GLSL needs: each one after those it calls.
// Only those the shade calls need, directly or not, go in the shader.
export const SHADING: Record<string, string> = {
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
