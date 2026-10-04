import { describe, it, expect } from "vitest";
import { compileGSS } from "..";
import { shapeRadius } from "../shader/codegen/shapes";
import { tokenize } from "../syntax/tokenizer";

// A half profile, right of the axis: 1 wide at the top, 0.5 at the bottom, 2 high.
// y goes down, like SVG: (0 0) is the top of the axis.
const vase = "d: polygon(0 0, 1 0, 0.5 2, 0 2)";

describe("lathe objects", () => {
  it("become a GLSL function called from map()", () => {
    const shader = compileGSS(`@scene { lathe; } lathe { ${vase}; }`);
    expect(shader).toContain("float sdShape0(vec3 p)");
    expect(shader).toContain("sdShape0(q)");
  });

  it("turn their contour around the y axis", () => {
    const shader = compileGSS(`@scene { lathe; } lathe { ${vase}; }`);
    expect(shader).toContain("vec2 q = vec2(length(p.xz), p.y);");
    expect(shader).toContain("return s * sqrt(d);");
    expect(shader).not.toContain("extrude(");
  });

  it("keep x = 0 as their axis and center their height, y up", () => {
    const shader = compileGSS(`@scene { lathe; } lathe { ${vase}; }`);
    expect(shader).toContain("segment2(q, vec2(0.0, 1.0), vec2(1.0, 1.0))"); // the top
    expect(shader).toContain("segment2(q, vec2(1.0, 1.0), vec2(0.5, -1.0))"); // the side
    expect(shader).toContain("segment2(q, vec2(0.5, -1.0), vec2(0.0, -1.0))"); // the bottom
  });

  it("leave out the sides that lie on the axis: inside the solid, they are no surface", () => {
    const shader = compileGSS(`@scene { lathe; } lathe { ${vase}; }`);
    expect(shader.match(/segment2\(q, /g)).toHaveLength(3);
    expect(shader.match(/crosses\(q, /g)).toHaveLength(3);
    expect(shader).not.toContain("segment2(q, vec2(0.0, -1.0), vec2(0.0, 1.0))");
  });

  it("center their height on the view-box, and keep x as written", () => {
    const shader = compileGSS(
      "@scene { lathe; } lathe { d: polygon(0 0, 1 0, 1 2, 0 2); view-box: 0 0 4 4; }",
    );
    expect(shader).toContain("segment2(q, vec2(0.0, 2.0), vec2(1.0, 2.0))");
    expect(shader).toContain("segment2(q, vec2(1.0, 0.0), vec2(0.0, 0.0))");
  });

  it("make a ring of a contour away from the axis", () => {
    const shader = compileGSS("@scene { lathe; } lathe { d: polygon(1 0, 2 0, 2 1, 1 1); }");
    expect(shader.match(/segment2\(q, /g)).toHaveLength(4);
    expect(shader).toContain("segment2(q, vec2(1.0, -0.5), vec2(1.0, 0.5))"); // the inner wall
  });

  it("turn a path(), its curves and its holes", () => {
    // a half disc right of the axis: a sphere once turned
    const shader = compileGSS('@scene { lathe; } lathe { d: path("M0 -1 A1 1 0 0 1 0 1 Z"); }');
    expect(shader.match(/segment2\(q, /g)!.length).toBeGreaterThan(8);
    expect(shader).toContain("vec2 q = vec2(length(p.xz), p.y);");
  });

  it("cut their curves finer than a prism: the light would show each segment as a band", () => {
    const d = 'd: path("M0 -1 C0.3 -1 0.3 1 0 1 Z")';
    const count = (tag: string) =>
      compileGSS(`@scene { ${tag}; } ${tag} { ${d}; }`).match(/segment2\(q, /g)!.length;
    expect(count("prism")).toBeLessThan(32);
    expect(count("lathe")).toBe(64); // the most segments a curve is cut into
  });

  it("need a polygon or a path as d", () => {
    expect(() => compileGSS("@scene { lathe; }")).toThrow("lathe needs a d");
    expect(() => compileGSS('@scene { lathe; } lathe { d: "M0 0 L1 1"; }')).toThrow(
      'd expects polygon(…) or path("…") on a lathe',
    );
  });

  it("refuse a contour that goes left of the axis", () => {
    expect(() => compileGSS("@scene { lathe; } lathe { d: polygon(-1 0, 1 0, 0 2); }")).toThrow(
      "a lathe turns its contour around x = 0: every x must be 0 or more",
    );
  });

  it("refuse a contour that lies on the axis: it has no volume", () => {
    expect(() => compileGSS("@scene { lathe; } lathe { d: polygon(0 0, 0 1, 0 2); }")).toThrow(
      "the contour of a lathe must go right of its axis",
    );
  });

  it("take a depth only on a prism", () => {
    expect(() => compileGSS(`@scene { lathe; } lathe { ${vase}; depth: 1; }`)).toThrow("depth");
  });
});

describe("the bounding sphere of a lathe", () => {
  const radius = (styles: Record<string, string>) =>
    shapeRadius("lathe", Object.fromEntries(Object.entries(styles).map(([k, v]) => [k, tokenize(v)])));

  it("holds its widest point and its centered height", () => {
    // x up to 1, y from -1 to 1 once centered
    expect(radius({ d: "polygon(0 0, 1 0, 0.5 2, 0 2)" })).toBeCloseTo(Math.SQRT2);
  });

  it("is tested in map(), like a prism", () => {
    const shader = compileGSS(`@scene { lathe; } lathe { ${vase}; }`);
    expect(shader).toContain("its bounding sphere could be the nearest");
  });
});
