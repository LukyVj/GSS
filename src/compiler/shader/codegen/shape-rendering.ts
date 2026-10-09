// shape-rendering: geometricPrecision — antialias a silhouette from the ray already
// being marched. No larger render target, second ray or post-processing pass: remember a
// near miss only after the next sample proves the ray passed it without hitting.

// Far from a path, a prism or a lathe, its function returns the distance to its box: less
// than the distance to the shape. exactDistance turns that shortcut off.
const SHORTCUT = "if (far > 0.5) return far;";

export const EXACT_DISTANCE = `// geometricPrecision: true while the ray is closer than a pixel to something, so that the
// functions of the shapes give their distance, not the distance to their box
bool exactDistance = false;`;

// The functions of the shapes, with the shortcut that a second measure can turn off
export function exactShapes(functions: string): { functions: string; shortcuts: boolean } {
  return {
    functions: functions.replaceAll(SHORTCUT, "if (far > 0.5 && !exactDistance) return far;"),
    shortcuts: functions.includes(SHORTCUT),
  };
}

export function precisionMarch(
  sceneSphereCode: string,
  masked: boolean,
  transparent: boolean,
  shortcuts = false,
): string {
  // The scene-sphere fast path is already widened by one pixel for this mode.
  // It is generated as a four-value early return; add the saved edge-id slot here.
  const miss = sceneSphereCode.replace(
    /return vec4\(([^;]+)\);/g,
    "return PrecisionHit($1, 0.0);",
  );
  const abs = (value: string) => (masked || transparent ? `abs(${value})` : value);
  const visible = masked
    ? "maskAlpha(previousId, ro + rd * previousT) >= 0.5"
    : "true";

  // Approaching a surface is not an edge. A sample becomes a grazing edge only after
  // the following sample shows that the ray passed its local minimum without hitting
  // (or a different surface became nearest). The floor is id 0 and is never a shape edge.
  // A hit is closer than a quarter of a pixel, and a near miss blends in from there (all of
  // it) to a whole pixel (nothing): the same share of a pixel on any size of canvas.
  const edge = `    bool passed = previousT > 0.0 && previousId > 0.0 &&
      (d > previousD || id != previousId);
    if (passed) {
      float previousWidth = previousT * pixelSize;
      float previousHitDistance = max(0.25 * previousWidth, 0.0001);
      if (previousD >= previousHitDistance && previousD < previousWidth && ${visible}) {
        float here = (previousWidth - previousD) / (previousWidth - previousHitDistance);
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

  // The march of auto stops after 100 steps (200 with holes or opacity), and the ray counts as a
  // hit. Grazing a silhouette takes more, the more pixels it spans: past those steps, a ray
  // goes on while an object is the nearest, so that it can pass the silhouette and find what is
  // behind it. A ray near the floor stops there, as with auto.
  const loop = (steps: number, body: string) => `  for (int i = 0; i < ${steps + 200}; i++) {
    if (i >= ${steps} && id == 0.0) break;
${body}
    t += d;
    if (t > MAX_DIST) break;
  }`;
  // Near the box of a path, a prism or a lathe, its function gives the distance to the box:
  // shorter than the distance to the shape, and it grows at once when the ray reaches the box.
  // A sample closer than a pixel is measured again, at the same point, without that shortcut,
  // and so are the next ones while the ray stays that close: hits and edges are decided on the
  // distance to the shapes. map() is called once in the loop: a GPU copies it at every call.
  const exact = shortcuts
    ? `
    bool close = d < t * pixelSize;
    if (close != exactDistance) {
      exactDistance = close;
      if (close) continue;
    }`
    : "";
  const sample = (point: string) => `    vec2 res = map(${point});
    id = res.y;
    float d = ${abs("res.x")};${exact}
    float hitDistance = max(0.25 * t * pixelSize, 0.0001);
${edge}`;

  const march = masked
    ? `  throughHoles = true;
${loop(200, `    vec3 p = ro + rd * t;
${sample("p")}
    if (d < hitDistance) {
      if (maskAlpha(id, p) >= 0.5) break;
      d = 2.0 * hitDistance;
    }
${remember}`)}
  throughHoles = false;`
    : transparent
      ? `  throughHoles = true;
${loop(200, `${sample("ro + rd * t")}
    if (d < hitDistance) break;
${remember}`)}
  throughHoles = false;`
      : loop(100, `${sample("ro + rd * t")}
    if (d < hitDistance) break;
${remember}`);

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
${miss}${march}${shortcuts ? "\n  exactDistance = false;" : ""}
  return PrecisionHit(t, id, edgeT, edgeId, coverage);
}`;
}
