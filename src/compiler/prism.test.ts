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

  it("need a polygon as d", () => {
    expect(() => compileGSS("@scene { prism; }")).toThrow("prism needs a d");
    expect(() =>
      compileGSS('@scene { prism; } prism { d: path("M0 0 L1 1"); }'),
    ).toThrow("d expects polygon(…) on a prism");
  });
});
