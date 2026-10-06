// shape-rendering: geometricPrecision — antialias a silhouette from the ray already
// being marched. No larger render target, second ray or post-processing pass: remember a
// near miss only after the next sample proves the ray passed it without hitting.
export function precisionMarch(
  sceneSphereCode: string,
  masked: boolean,
  transparent: boolean,
): string {
  // The scene-sphere fast path is already widened by one pixel for this mode.
  // It is generated as a four-value early return; add the saved edge-id slot here.
  const miss = sceneSphereCode.replace(
    /return vec4\(([^;]+)\);/g,
    "return PrecisionHit($1, 0.0);",
  );
  const distance = masked || transparent ? "abs(res.x)" : "res.x";
  const visiblePrevious = masked
    ? "maskAlpha(previousId, ro + rd * previousT) >= 0.5"
    : "true";

  // Approaching a surface is not an edge. A sample becomes a grazing edge only after
  // the following sample shows that the ray passed its local minimum without hitting
  // (or a different surface became nearest). The floor is id 0 and is never a shape edge.
  const edge = `    bool passed = previousT > 0.0 && previousId > 0.0 &&
      (d > previousD || id != previousId);
    if (passed) {
      float width = previousT * pixelSize;
      if (previousD >= 0.001 && previousD < width && ${visiblePrevious}) {
        float here = 1.0 - previousD / width;
        if (here > coverage) {
          edgeT = previousT;
          edgeId = previousId;
          coverage = here;
        }
      }
    }`;

  const remember = `    previousD = d;
    previousT = t;
    previousId = id;`;

  const loop = masked
    ? `  throughHoles = true;
  for (int i = 0; i < 200; i++) {
    vec3 p = ro + rd * t;
    vec2 res = map(p);
    id = res.y;
    float d = ${distance};
${edge}
    if (d < 0.001) {
      if (maskAlpha(id, p) >= 0.5) break;
      d = 0.002;
    }
${remember}
    t += d;
    if (t > MAX_DIST) break;
  }
  throughHoles = false;`
    : transparent
      ? `  throughHoles = true;
  for (int i = 0; i < 200; i++) {
    vec2 res = map(ro + rd * t);
    id = res.y;
    float d = ${distance};
${edge}
    if (d < 0.001) break;
${remember}
    t += d;
    if (t > MAX_DIST) break;
  }
  throughHoles = false;`
      : `  for (int i = 0; i < 100; i++) {
    vec2 res = map(ro + rd * t);
    id = res.y;
    float d = res.x;
${edge}
    if (d < 0.001) break;
${remember}
    t += d;
    if (t > MAX_DIST) break;
  }`;

  return `// shape-rendering: geometricPrecision — the primary ray keeps a passed near miss
struct PrecisionHit {
  float t;
  float id;
  float edgeT;
  float edgeId;
  float coverage;
};

PrecisionHit marchPrecision(vec3 ro, vec3 rd) {
  float t = 0.0;
  float id = 0.0;
  float edgeT = 0.0;
  float edgeId = 0.0;
  float coverage = 0.0;
  float previousD = 1e10;
  float previousT = 0.0;
  float previousId = 0.0;
  float pixelSize = 1.0 / (1.5 * iResolution.y);
${miss}${loop}
  return PrecisionHit(t, id, edgeT, edgeId, coverage);
}`;
}
