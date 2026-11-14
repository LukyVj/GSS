import { describe, it, expect } from "vitest";
import { compileGSS } from "..";
import { shadowFunction } from "./codegen/shadows";

// The end of the rays toward the lights: once past every object, a ray stops, with the
// light it would have ended with. Checked two ways: the GLSL has the test, and the same loop,
// run here in 32-bit floats (Math.fround) on a scene of spheres and a floor, gives the same
// light at every point, with the test and without.
const f = Math.fround;
type V = [number, number, number];
const add = (a: V, b: V): V => [f(a[0] + b[0]), f(a[1] + b[1]), f(a[2] + b[2])];
const sub = (a: V, b: V): V => [f(a[0] - b[0]), f(a[1] - b[1]), f(a[2] - b[2])];
const mul = (a: V, k: number): V => [f(a[0] * k), f(a[1] * k), f(a[2] * k)];
const dot = (a: V, b: V) => f(f(f(a[0] * b[0]) + f(a[1] * b[1])) + f(a[2] * b[2]));
const length = (a: V) => f(Math.sqrt(dot(a, a)));
const normalize = (a: V) => mul(a, f(1 / length(a)));

describe("shadows past every object", () => {
  it("stop the ray once it is past the sphere of the scene", () => {
    const soft = shadowFunction("soft", false, false, "isSkin", { softness: 1, steps: null }, { center: [0, 1, 0], radius: 1.5, floor: true });
    expect(soft).toContain("vec3 shadowCenter = vec3(0.0, 1.0, 0.0);");
    expect(soft).toContain("float floorLeft = ro.y >= 0.0 ? 12.0 * (ro.y / far + rd.y) : -1.0;");
    expect(soft).toContain("if (min(12.0 * (near - shadowRadius) / far, floorLeft) * 0.999 - 0.00001 > lit) break;");
    const hard = shadowFunction("hard", false, false, "isSkin", { softness: 1, steps: null }, { center: [0, 1, 0], radius: 1.5, floor: false });
    expect(hard).toContain("if (near - shadowRadius > 0.002) break;");
    // Without a sphere, the loop is as it was
    expect(shadowFunction("soft", false)).not.toContain("shadowCenter");
  });

  it("is in a scene whose objects all have a sphere, not in one without", () => {
    expect(compileGSS("@scene { sphere; } scene { shadows: soft; } sphere { translate: 0 1 0; }")).toContain("shadowCenter");
    // A transition that undershoots can carry an object anywhere: no sphere
    expect(
      compileGSS("@scene { sphere; } scene { shadows: soft; } sphere { translate: 0 1 0; transition: 1s cubic-bezier(0.3, -0.4, 0.6, 1); } sphere:hover { translate: 0 2 0; }"),
    ).not.toContain("shadowCenter");
  });

  // The scene: spheres resting on a floor, and the sphere of the scene around them
  const spheres: { c: V; r: number }[] = [
    { c: [0, 0.5, 0], r: 0.5 },
    { c: [1.2, 0.3, 0.4], r: 0.3 },
    { c: [-0.8, 1.4, -0.6], r: 0.25 },
  ];
  const center: V = [0.2, 0.85, -0.1];
  const radius = 1.6; // holds the three, with a margin like the shader's
  const map = (p: V) => Math.min(...spheres.map((s) => f(length(sub(p, s.c)) - s.r)), p[1]);

  function shadow(ro: V, rd: V, far: number, bounded: boolean, softness = 12): number {
    let lit = 1;
    let t = f(0.02);
    const floorLeft = ro[1] >= 0 ? f(softness * f(f(ro[1] / far) + rd[1])) : -1;
    for (let i = 0; i < 64; i++) {
      const h = map(add(ro, mul(rd, t)));
      lit = Math.min(lit, f(f(softness * h) / t));
      t = f(t + Math.min(Math.max(h, 0.01), 0.5));
      if (lit < 0.001 || t > far) break;
      if (!bounded) continue;
      const fromCenter = sub(add(ro, mul(rd, t)), center);
      const along = dot(fromCenter, rd);
      const near = along >= 0 ? length(fromCenter) : f(Math.sqrt(Math.max(f(dot(fromCenter, fromCenter) - f(along * along)), 0)));
      // A negative bound (inside the sphere, or toward the floor) never passes: lit is at least 0.001 here
      if (f(f(Math.min(f(f(softness * f(near - radius)) / far), floorLeft) * f(0.999)) - f(0.00001)) > lit) break;
    }
    return Math.min(Math.max(lit, 0), 1);
  }

  it("gives the light it gave, on the floor and on the objects, for lights high and low", () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    let stopped = 0;
    // The sun high and low, and a lamp below the point (a ray that goes down to the floor)
    for (const light of [normalize([-0.4, 0.8, 0.4]), normalize([0.9, 0.12, 0.3]), normalize([0.2, 0.05, -1]), normalize([0.3, -0.2, 0.6])]) {
      for (let k = 0; k < 4000; k++) {
        // A point of the floor, near the objects or far from them, of a sphere, or inside one
        // (a ray that starts in an object: lit goes below 0)
        let p: V;
        if (k % 4 === 3) {
          const s = spheres[k % spheres.length];
          p = add(s.c, mul(normalize([random(), random(), random()]), s.r * 0.9));
        } else if (k % 4 === 0) {
          const s = spheres[k % spheres.length];
          p = add(s.c, mul(normalize([random(), random(), random()]), s.r + 0.01));
        } else {
          const reach = k % 3 === 1 ? 2 : 8;
          p = [f(random() * reach), 0.01, f(random() * reach)];
        }
        const exact = shadow(p, light, 20, false);
        const bounded = shadow(p, light, 20, true);
        expect(bounded).toBe(exact);
        if (exact > 0 && exact < 1) stopped++;
      }
    }
    expect(stopped).toBeGreaterThan(100); // penumbras were measured, not only full light
    // A ray that starts in an object, just under its surface, and goes deeper: lit is below 0,
    // and keeps falling while the ray is in it
    for (let k = 0; k < 2000; k++) {
      const s = spheres[k % spheres.length];
      const out = normalize([random(), random(), random()]);
      const p = add(s.c, mul(out, s.r * (0.95 + 0.05 * Math.abs(random()))));
      const rd = normalize(add(mul(out, -1), mul([random(), random(), random()], 0.3)));
      for (const far of [20, 3]) expect(shadow(p, rd, far, true)).toBe(shadow(p, rd, far, false));
    }
  });
});
