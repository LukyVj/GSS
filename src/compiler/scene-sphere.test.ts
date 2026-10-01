import { describe, it, expect } from "vitest";
import { compileGSS } from "./index";

// march() starts with the sphere around the whole scene: a ray that passes by it
// meets no object, only the floor. The sphere must hold every object, at every
// moment of its animations, and hovered.
const sphereOf = (gss: string) => {
  const m = compileGSS(gss).match(
    /vec3 oc = ro - vec3\(([^;]*)\);\n {2}float b = dot\(oc, rd\);\n {2}float c = dot\(oc, oc\) - ([\d.e-]+);/,
  );
  if (!m) return null;
  const center = m[1].split(",").map(Number);
  return { center: center.length === 1 ? [center[0], center[0], center[0]] : center, radius: Math.sqrt(Number(m[2])) };
};
// Does the sphere hold a ball of radius r at this point?
const holds = (gss: string, point: number[], r: number) => {
  const sphere = sphereOf(gss)!;
  return Math.hypot(...point.map((p, i) => p - sphere.center[i])) + r <= sphere.radius;
};

describe("the sphere of the scene", () => {
  it("holds every object where it stands", () => {
    const gss = "@scene { sphere#a; sphere#b; } #a { translate: 2 0 0; } #b { translate: -2 1 0; radius: 0.3; }";
    expect(holds(gss, [2, 0, 0], 0.5)).toBe(true);
    expect(holds(gss, [-2, 1, 0], 0.3)).toBe(true);
  });

  it("holds an object at every keyframe of its animation", () => {
    const gss = `
      @scene { sphere; }
      sphere { animation: rise 2s ease-in-out alternate; }
      @keyframes rise { 50% { translate: 0 5 0; } to { translate: 3 0 0; } }
    `;
    expect(holds(gss, [0, 0, 0], 0.5)).toBe(true);
    expect(holds(gss, [0, 5, 0], 0.5)).toBe(true);
    expect(holds(gss, [3, 0, 0], 0.5)).toBe(true);
  });

  it("holds a hovered object where :hover takes it", () => {
    expect(holds("@scene { sphere; } sphere:hover { translate: 0 4 0; }", [0, 4, 0], 0.5)).toBe(true);
  });

  it("holds a child of a rotating group on its whole circle", () => {
    const gss = `
      @scene { group#g { sphere#s; } }
      #g { animation: spin 4s; } #s { translate: 3 0 0; }
      @keyframes spin { to { rotate-y: 1turn; } }
    `;
    for (const point of [[3, 0, 0], [-3, 0, 0], [0, 0, 3], [0, 0, -3]]) expect(holds(gss, point, 0.5)).toBe(true);
  });

  it("holds an object at its largest scale", () => {
    const gss = "@scene { sphere; } sphere { animation: grow 1s; } @keyframes grow { to { scale: 3; } }";
    expect(holds(gss, [0, 0, 0], 1.5)).toBe(true);
  });

  it("is widened by a blend: the fillet grows out of the objects", () => {
    const plain = sphereOf("@scene { sphere#a; sphere#b; } #b { translate: 1 0 0; }")!;
    const blended = sphereOf("@scene { sphere#a; sphere#b; } #b { translate: 1 0 0; blend: 0.4; }")!;
    expect(blended.radius).toBeGreaterThan(plain.radius + 0.399); // radii are rounded to 0.001
  });

  it("sends a ray that misses it to the floor, found without marching", () => {
    const shader = compileGSS("@scene { sphere; }");
    expect(shader).toContain("if (ro.y > 0.0 && c > 0.0 && (b > 0.0 || b * b < c * dot(rd, rd))) {");
    expect(shader).toContain("float floorT = rd.y < 0.0 ? -ro.y / rd.y : 1e10;");
  });

  it("sends it to nothing at all without a floor", () => {
    const shader = compileGSS("@scene { sphere; } scene { floor: none; }");
    expect(shader).not.toContain("floorT");
    expect(shader).toContain("return vec2(MAX_DIST + 1.0, 0.0);");
  });

  it("is not there for an empty scene", () => {
    expect(sphereOf("@scene { }")).toBeNull();
  });
});
