import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";
import { shapeRadius } from "./codegen";
import { tokenize } from "../syntax/tokenizer";
import { pathRadius, polygonRadius } from "./path";

// map() skips a path or a prism when even its bounding sphere is further than the
// nearest object found so far. These tests read the GLSL of map().
const mapOf = (gss: string) => {
  const shader = compileGSS(gss);
  return shader.slice(shader.indexOf("vec2 map(vec3 p)"), shader.indexOf("Material getMaterial"));
};
// The block of one object in map(), from its comment to the next object's
const blockOf = (map: string, name: string) => {
  const start = map.indexOf(`// ${name}`);
  const next = map.indexOf("\n // ", start);
  return map.slice(start, next === -1 ? undefined : next);
};
const BOUND = "its bounding sphere could be the nearest";
const TRIANGLE = "d: polygon(-1 -1, 1 -1, 0 1);";

describe("bounding spheres in map()", () => {
  it("tests the sphere after the translate, before the rotations and the shape", () => {
    const block = blockOf(
      mapOf(`@scene { prism#a; } #a { ${TRIANGLE} translate: 1 0 0; rotate-y: 45deg; }`),
      "prism#a",
    );
    const test = block.indexOf(BOUND);
    expect(test).toBeGreaterThan(block.indexOf("q -= vec3(1.0, 0.0, 0.0)"));
    expect(test).toBeLessThan(block.indexOf("rot("));
    expect(test).toBeLessThan(block.search(/\w+\(q\) \*/)); // the call of the prism's function
  });

  it("bounds path and prism, never the simple shapes: there the test costs as much as the shape", () => {
    const map = mapOf(
      `@scene { prism#a; path#b; sphere#c; cube#d; torus#e; } #a { ${TRIANGLE} } #b { d: path("M0 0 L10 0"); view-box: 0 0 10 10; }`,
    );
    expect(blockOf(map, "prism#a")).toContain(BOUND);
    expect(blockOf(map, "path#b")).toContain(BOUND);
    for (const name of ["sphere#c", "cube#d", "torus#e"]) expect(blockOf(map, name)).not.toContain(BOUND);
  });

  it("grows the sphere with the object's scale, and its distance with the groups' scales", () => {
    const block = blockOf(
      mapOf(`@scene { group#g { prism#s; } } #g { scale: 2; } #s { ${TRIANGLE} scale: 3; }`),
      "prism#s",
    );
    expect(block).toMatch(/\(length\(q\) - [\d.]+ \* 3\.0\) \* 2\.0 <=/);
  });

  it("never skips a subtraction, an intersection or a blend: far away, they still change the result", () => {
    const map = mapOf(
      `@scene { prism#a; prism#b; prism#c; prism#d; } prism { ${TRIANGLE} } #b { operation: subtract; } #c { operation: intersect; } #d { blend: 0.2; }`,
    );
    expect(blockOf(map, "prism#a")).toContain(BOUND);
    expect(blockOf(map, "prism#b")).not.toContain(BOUND);
    expect(blockOf(map, "prism#c")).not.toContain(BOUND);
    expect(blockOf(map, "prism#d")).not.toContain(BOUND);
  });

  it("lets the floor count from the start when map() is a plain min()", () => {
    expect(mapOf(`@scene { prism; sphere; } prism { ${TRIANGLE} }`)).toContain("<= min(res.x, p.y)");
  });

  it("only counts the objects already combined when the order matters", () => {
    const map = mapOf(`@scene { prism; sphere#hole; } prism { ${TRIANGLE} } #hole { operation: subtract; }`);
    expect(map).toContain("<= res.x)");
    expect(map).not.toContain("min(res.x, p.y)");
  });

  it("does not count a floor that is not there", () => {
    expect(mapOf(`@scene { prism; } prism { ${TRIANGLE} } scene { floor: none; }`)).not.toContain("min(res.x, p.y)");
  });

  it("keeps :hover and animations in the translate it tests", () => {
    const block = blockOf(
      mapOf(`@scene { prism#s; } #s { ${TRIANGLE} } #s:hover { translate: 0 1 0; }`),
      "prism#s",
    );
    expect(block.slice(0, block.indexOf(BOUND))).toContain("uHover[0]");
  });

  it("rounds the radius up, with a margin for 32-bit floats", () => {
    const match = mapOf(`@scene { prism; } prism { ${TRIANGLE} }`).match(/\(length\(q\) - ([\d.]+) \*/);
    const exact = Math.hypot(Math.SQRT2, 0.1); // the corner (1, 1), half the default depth
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(exact + 0.001);
    expect(Number(match?.[1])).toBeLessThan(exact + 0.0012);
  });
});

describe("the bounding sphere of each shape holds it", () => {
  const radius = (tag: string, styles: Record<string, string>) =>
    shapeRadius(tag, Object.fromEntries(Object.entries(styles).map(([k, v]) => [k, tokenize(v)])));

  it("for the simple shapes (kept for later: bounds on groups)", () => {
    expect(radius("sphere", { radius: "0.5" })).toBe(0.5);
    expect(radius("cube", { size: "2" })).toBeCloseTo(Math.sqrt(3));
    expect(radius("torus", { radius: "1", thickness: "0.25" })).toBe(1.25);
    expect(radius("capsule", { radius: "0.25", height: "2" })).toBe(1);
    expect(radius("cylinder", { radius: "0.3", height: "0.8" })).toBeCloseTo(0.5);
    expect(radius("cone", { radius: "0.3 0.1", height: "0.8" })).toBeCloseTo(0.5);
    expect(radius("plane", { size: "6 8" })).toBeGreaterThanOrEqual(5);
  });
  it("for a path: its points, centered on the view-box, plus half the stroke", () => {
    // (0,0)–(10,0) in a 10 × 10 view-box: (-5, 5) and (5, 5) once centered, y up
    const line = [[{ x: 0, y: 0 }, { x: 10, y: 0 }]];
    expect(pathRadius(line, 1, { x: 0, y: 0, width: 10, height: 10 })).toBeCloseTo(Math.hypot(5, 5) + 0.5);
  });
  it("for a prism: its contours and half its depth", () => {
    const square = [[{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }]];
    expect(polygonRadius(square, 2, null)).toBeCloseTo(Math.hypot(Math.SQRT2, 1));
  });
  it("is null for a shape with no point", () => {
    expect(pathRadius([], 1, null)).toBeNull();
  });
});
