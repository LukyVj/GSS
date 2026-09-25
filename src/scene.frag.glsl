#version 300 es
precision highp float;

// Ce que Shadertoy fournissait tout seul, c'est maintenant TypeScript qui l'envoie
uniform vec3 iResolution;
uniform float iTime;
uniform vec2 uCamera;   // x = yaw (autour), y = pitch (hauteur)
uniform float uDist;

out vec4 outColor;

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

vec2 opU(vec2 a, vec2 b) {
  return (a.x < b.x) ? a : b;
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

vec2 map(vec3 p) {
  vec3 q = p - vec3(0.0, 1.5, 0.0);
  q.yz *= rot(iTime);
  vec2 res = vec2(sdTorus(q, vec2(1.0, 0.28)), 1.0);

  res = opU(res, vec2(sdRoundBox(p - vec3( 2.5, 0.5,  0.0), vec3(0.5), 0.08), 2.0));
  res = opU(res, vec2(sdRoundBox(p - vec3( 0.0, 0.5,  2.5), vec3(0.5), 0.08), 4.0));
  res = opU(res, vec2(sdRoundBox(p - vec3(-2.5, 0.5,  0.0), vec3(0.5), 0.08), 4.0));
  res = opU(res, vec2(sdRoundBox(p - vec3( 0.0, 0.5, -2.5), vec3(0.5), 0.08), 5.0));

  res = opU(res, vec2(p.y, 6.0));
  return res;
}

vec3 getColor(float id) {
  if (id == 1.0) return vec3(1.0, 0.35, 0.21);
  if (id == 2.0) return vec3(0.91, 0.79, 0.36);
  if (id == 4.0) return vec3(1.0, 0.39, 0.26);
  if (id == 5.0) return vec3(0.61, 0.89, 0.86);
  return vec3(0.91, 0.89, 0.86);   // 6 : le sol
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.001, 0.0);
  return normalize(vec3(
    map(p + e.xyy).x - map(p - e.xyy).x,
    map(p + e.yxy).x - map(p - e.yxy).x,
    map(p + e.yyx).x - map(p - e.yyx).x
  ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

  vec3 target = vec3(0.0, 0.5, 0.0);
  float dist = uDist;
  float yaw = uCamera.x;     // plus de iMouse : TypeScript nous donne les angles
  float pitch = uCamera.y;

  vec3 ro = target + dist * vec3(
    cos(pitch) * sin(yaw),
    sin(pitch),
    cos(pitch) * cos(yaw)
  );
  vec3 forward = normalize(target - ro);
  vec3 right   = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up      = cross(forward, right);
  vec3 rd = normalize(uv.x * right + uv.y * up + 1.5 * forward);

  float t = 0.0;
  float id = 0.0;
  for (int i = 0; i < 100; i++) {
    vec2 res = map(ro + rd * t);
    id = res.y;
    t += res.x;
    if (res.x < 0.001 || t > 20.0) break;
  }

  vec3 col = vec3(0.03);
  if (t < 20.0) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 lightDir = normalize(vec3(1.0, 2.0, 1.0));
    float diff = max(dot(n, lightDir), 0.0);
    col = getColor(id) * (0.1 + 0.9 * diff);
  }

  fragColor = vec4(col, 1.0);
}

// Le point d'entrée de WebGL : on appelle simplement ton mainImage
void main() {
  mainImage(outColor, gl_FragCoord.xy);
}
