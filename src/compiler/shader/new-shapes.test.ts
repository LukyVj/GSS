import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";
import { shapeRadius } from "./codegen/shapes";
import { tokenize } from "../syntax/tokenizer";

// pyramid, octahedron and tube (decision 154): three shapes with exact distance functions
const radius = (tag: string, styles: Record<string, string>) =>
  shapeRadius(tag, Object.fromEntries(Object.entries(styles).map(([k, v]) => [k, tokenize(v)])));

describe("pyramid", () => {
  it("has a square base of 1 and a height of 1 by default, centered on its origin", () => {
    expect(compileGSS("@scene { pyramid; }")).toContain("sdPyramid(q, vec3(1.0, 1.0, 1.0))");
  });

  it("takes its width, height and depth from size, like a cube", () => {
    expect(compileGSS("@scene { pyramid; } pyramid { size: 2 3 1; }")).toContain("sdPyramid(q, vec3(2.0, 3.0, 1.0))");
    expect(compileGSS("@scene { pyramid; } pyramid { size: 2; }")).toContain("sdPyramid(q, vec3(2.0, 2.0, 2.0))");
  });

  it("is bounded by the sphere through its base corners and its apex", () => {
    expect(radius("pyramid", { size: "2 2 2" })).toBeCloseTo(Math.sqrt(3));
  });
});

describe("octahedron", () => {
  it("has a radius of 0.5 by default, from its center to each tip", () => {
    expect(compileGSS("@scene { octahedron; }")).toContain("sdOctahedron(q, 0.5)");
    expect(compileGSS("@scene { octahedron; } octahedron { radius: 1.2; }")).toContain("sdOctahedron(q, 1.2)");
    expect(radius("octahedron", { radius: "1.2" })).toBeCloseTo(1.2);
  });
});

describe("tube", () => {
  it("is a hollow cylinder: an outer radius, a height and the thickness of its wall", () => {
    expect(compileGSS("@scene { tube; }")).toContain("sdTube(q, 0.5, 0.5, 0.1)");
    expect(compileGSS("@scene { tube; } tube { radius: 1; height: 3; thickness: 0.2; }")).toContain("sdTube(q, 1.5, 1.0, 0.2)");
    expect(radius("tube", { radius: "1", height: "3" })).toBeCloseTo(Math.hypot(1, 1.5));
  });

  it("keeps its wall within its radius", () => {
    expect(() => compileGSS("@scene { tube; } tube { radius: 0.5; thickness: 0.8; }")).toThrow(
      "tube thickness must be at most its radius",
    );
  });
});

describe("the properties of the new shapes", () => {
  it("only take what applies to them", () => {
    expect(() => compileGSS("@scene { pyramid; } pyramid { radius: 1; }")).toThrow(/radius/);
    expect(() => compileGSS("@scene { octahedron; } octahedron { height: 1; }")).toThrow(/height/);
    expect(() => compileGSS("@scene { sphere; } sphere { thickness: 0.1; }")).toThrow(/thickness/);
  });

  it("adds only the distance functions the scene uses", () => {
    const shader = compileGSS("@scene { pyramid; }");
    expect(shader).toContain("float sdPyramid(");
    expect(shader).not.toContain("sdOctahedron");
    expect(shader).not.toContain("sdTube");
  });
});
