import { describe, it, expect } from "vitest";
import { compileGSS } from ".";

// A right triangle in a 2 × 2 box: its center is (1, 1)
const triangle = "d: polygon(0 0, 2 0, 2 2)";

describe("prism objects", () => {
  it("become a GLSL function called from map()", () => {
    const shader = compileGSS(`@scene { prism; } prism { ${triangle}; }`);
    expect(shader).toContain("float sdShape0(vec3 p)");
    expect(shader).toContain("sdShape0(q)");
  });

  it("measure every side, the last one included", () => {
    const shader = compileGSS(`@scene { prism; } prism { ${triangle}; }`);
    expect(shader.match(/segment2\(q, /g)).toHaveLength(3);
    expect(shader.match(/crosses\(q, /g)).toHaveLength(3);
  });

  it("center on the polygon, y up", () => {
    const shader = compileGSS(`@scene { prism; } prism { ${triangle}; }`);
    expect(shader).toContain("segment2(q, vec2(-1.0, 1.0), vec2(1.0, 1.0))");
    expect(shader).toContain("segment2(q, vec2(1.0, -1.0), vec2(-1.0, 1.0))");
  });

  it("extrude by half the depth, 0.2 by default", () => {
    expect(compileGSS(`@scene { prism; } prism { ${triangle}; }`)).toContain(
      "extrude(s * sqrt(d), p.z, 0.1)",
    );
    expect(
      compileGSS(`@scene { prism; } prism { ${triangle}; depth: 0.6; }`),
    ).toContain("extrude(s * sqrt(d), p.z, 0.3)");
  });

  it("need a polygon or a path as d", () => {
    expect(() => compileGSS("@scene { prism; }")).toThrow("prism needs a d");
    expect(() =>
      compileGSS('@scene { prism; } prism { d: "M0 0 L1 1"; }'),
    ).toThrow('d expects polygon(…) or path("…") on a prism');
  });
});

describe("prism with a path()", () => {
  // A 2 × 2 square with a 1 × 1 square hole, like the inside of an "o"
  const ring = 'd: path("M0 0 H2 V2 H0 Z M0.5 0.5 H1.5 V1.5 H0.5 Z")';

  it("fills every subpath, each one closed", () => {
    const shader = compileGSS(`@scene { prism; } prism { ${ring}; }`);
    // 4 sides for each square: Z closes them, no side of length 0
    expect(shader.match(/segment2\(q, /g)).toHaveLength(8);
    expect(shader.match(/crosses\(q, /g)).toHaveLength(8);
  });

  it("closes a subpath that has no Z", () => {
    const shader = compileGSS('@scene { prism; } prism { d: path("M0 0 H2 V2"); }');
    expect(shader).toContain("segment2(q, vec2(1.0, -1.0), vec2(-1.0, 1.0))");
  });

  it("is centered and y up, like a polygon", () => {
    const fromPath = compileGSS('@scene { prism; } prism { d: path("M0 0 L2 0 L2 2 Z"); }');
    const fromPolygon = compileGSS(`@scene { prism; } prism { ${triangle}; }`);
    expect(fromPath).toContain("segment2(q, vec2(-1.0, 1.0), vec2(1.0, 1.0))");
    expect(fromPolygon).toContain("segment2(q, vec2(-1.0, 1.0), vec2(1.0, 1.0))");
  });

  it("cuts curves relative to the size of the shape", () => {
    // the same circle, 100 times bigger: about as many sides
    const count = (r: number) =>
      compileGSS(
        `@scene { prism; } prism { d: path("M-${r} 0 A${r} ${r} 0 1 1 ${r} 0 A${r} ${r} 0 1 1 -${r} 0"); }`,
      ).match(/segment2\(q, /g)!.length;
    expect(count(100)).toBe(count(1));
    expect(count(1)).toBeGreaterThan(16);
  });

  it("points at the path when it is wrong", () => {
    expect(() =>
      compileGSS('@scene { prism; } prism { d: path("M0 0 X1 1"); }'),
    ).toThrow('Unknown path command "X"');
  });
});
