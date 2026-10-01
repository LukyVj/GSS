import { describe, it, expect } from "vitest";
import { compileGSS } from "./index";
import { pathRadius, polygonRadius } from "./path";

// map() skips an object when even its bounding sphere is further than the nearest
// object found so far. These tests read the GLSL of map().
const mapOf = (gss: string) => {
  const shader = compileGSS(gss);
  return shader.slice(shader.indexOf("vec2 map(vec3 p)"), shader.indexOf("Material getMaterial"));
};
// The block of one object in map(), from its comment to the next one
const blockOf = (map: string, name: string) => {
  const start = map.indexOf(`// ${name}`);
  const next = map.indexOf("\n // ", start); // the comment of the next object
  return map.slice(start, next === -1 ? undefined : next);
};
const BOUND = "its bounding sphere could be the nearest";

describe("bounding spheres in map()", () => {
  it("tests the sphere after the translate, before the rotations and the shape", () => {
    const block = blockOf(mapOf("@scene { cube#a; } #a { translate: 1 0 0; rotate-y: 45deg; }"), "cube#a");
    const test = block.indexOf(BOUND);
    expect(test).toBeGreaterThan(block.indexOf("q -= vec3(1.0, 0.0, 0.0)"));
    expect(test).toBeLessThan(block.indexOf("rot("));
    expect(test).toBeLessThan(block.indexOf("sdRoundBox"));
  });

  it("gives each shape a sphere that holds it, a little bigger to be safe", () => {
    const radius = (gss: string) => {
      const match = mapOf(gss).match(/\(length\(q\) - ([\d.]+) \*/);
      return Number(match?.[1]);
    };
    expect(radius("@scene { sphere; } sphere { radius: 0.5; }")).toBe(0.501);
    expect(radius("@scene { cube; } cube { size: 2; }")).toBeCloseTo(Math.sqrt(3) + 0.001, 3);
    expect(radius("@scene { torus; } torus { radius: 1; thickness: 0.25; }")).toBe(1.251);
    expect(radius("@scene { capsule; } capsule { radius: 0.25; height: 2; }")).toBe(1.001);
    expect(radius("@scene { cylinder; } cylinder { radius: 0.3; height: 0.8; }")).toBe(0.501);
    expect(radius("@scene { cone; } cone { radius: 0.3 0.1; height: 0.8; }")).toBe(0.501);
    expect(radius("@scene { plane; } plane { size: 6 8; }")).toBeGreaterThanOrEqual(5);
  });

  it("grows the sphere with the object's scale, and its distance with the groups' scales", () => {
    const block = blockOf(
      mapOf("@scene { group#g { sphere#s; } } #g { scale: 2; } #s { scale: 3; }"),
      "sphere#s",
    );
    expect(block).toMatch(/\(length\(q\) - 0\.501 \* 3\.0\) \* 2\.0 <=/);
  });

  it("never skips a subtraction, an intersection or a blend: far away, they still change the result", () => {
    const map = mapOf(
      "@scene { cube#a; sphere#b; sphere#c; sphere#d; } #b { operation: subtract; } #c { operation: intersect; } #d { blend: 0.2; }",
    );
    expect(blockOf(map, "cube#a")).toContain(BOUND);
    expect(blockOf(map, "sphere#b")).not.toContain(BOUND);
    expect(blockOf(map, "sphere#c")).not.toContain(BOUND);
    expect(blockOf(map, "sphere#d")).not.toContain(BOUND);
  });

  it("lets the floor count from the start when map() is a plain min()", () => {
    expect(mapOf("@scene { cube; sphere; }")).toContain("<= min(res.x, p.y)");
  });

  it("only counts the objects already combined when the order matters", () => {
    const map = mapOf("@scene { cube; sphere#hole; } #hole { operation: subtract; }");
    expect(map).toContain("<= res.x)");
    expect(map).not.toContain("min(res.x, p.y)");
  });

  it("does not count a floor that is not there", () => {
    expect(mapOf("@scene { cube; } scene { floor: none; }")).not.toContain("min(res.x, p.y)");
  });

  it("keeps :hover and animations in the translate it tests", () => {
    const block = blockOf(
      mapOf("@scene { sphere#s; } #s:hover { translate: 0 1 0; }"),
      "sphere#s",
    );
    expect(block.slice(0, block.indexOf(BOUND))).toContain("uHover[0]");
  });
});

describe("pathRadius and polygonRadius", () => {
  it("hold the points, centered on the view-box, plus half the stroke", () => {
    // (0,0)–(10,0) in a 10 × 10 view-box: (-5, 5) and (5, 5) once centered, y up
    const line = [[{ x: 0, y: 0 }, { x: 10, y: 0 }]];
    expect(pathRadius(line, 1, { x: 0, y: 0, width: 10, height: 10 })).toBeCloseTo(Math.hypot(5, 5) + 0.5);
  });
  it("hold the contours and half the depth", () => {
    const square = [[{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }]];
    expect(polygonRadius(square, 2, null)).toBeCloseTo(Math.hypot(Math.SQRT2, 1));
  });
  it("give no sphere for a shape with no point", () => {
    expect(pathRadius([], 1, null)).toBeNull();
  });
});
