import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

// checker() and stripes() (decision 155): images like noise(), placed in the object's own
// space, whose colors switch at the edges of their cells or bands
const on = (color: string, more = "") => compileGSS(`@scene { sphere; } sphere { translate: 0 1 0; color: ${color}; } ${more}`);

describe("checker()", () => {
  it("alternates its two colors in cubes of 1 / scale, in the object's space", () => {
    const shader = on("checker(4, #111111, #eeeeee)");
    expect(shader).toContain("float t = checkerPattern((q + vec3(0.0)) * 4.0);");
    expect(shader).toContain("float checkerPattern(vec3 p)");
    expect(shader).not.toContain("float fractalNoise(");
  });

  it("moves with at", () => {
    expect(on("checker(2 at 0.5 0 0, #000000, #ffffff)")).toContain("(q + vec3(0.5, 0.0, 0.0)) * 2.0");
  });

  it("says how to write it", () => {
    expect(() => on("checker(#000000, #ffffff)")).toThrow("checker() starts with a scale");
    expect(() => on("checker(0, #000000, #ffffff)")).toThrow("checker() starts with a scale");
  });
});

describe("stripes()", () => {
  it("draws bands across y by default, half of each color", () => {
    expect(on("stripes(4, #ff5a36, #ffffff)")).toContain("float t = stripesPattern((q + vec3(0.0)) * 4.0, 1);");
  });

  it("takes its axis: x, y or z", () => {
    expect(on("stripes(4 x, #ff5a36, #ffffff)")).toContain("stripesPattern((q + vec3(0.0)) * 4.0, 0);");
    expect(on("stripes(4 z at 0 0 1, #ff5a36, #ffffff)")).toContain("stripesPattern((q + vec3(0.0, 0.0, 1.0)) * 4.0, 2);");
  });

  it("says how to write it", () => {
    expect(() => on("stripes(4 w, #000000, #ffffff)")).toThrow("stripes() starts with a scale");
  });
});

describe("checker() and stripes() go wherever a gradient goes", () => {
  it("in the background, the floor and a material", () => {
    expect(compileGSS("@scene { sphere; } scene { background: checker(6, #0b1020, #1a2440); }")).toContain("checkerPattern(");
    expect(compileGSS("@scene { sphere; } scene { floor: checker(1, #202020, #e0e0e0); }")).toContain("checkerPattern(");
    expect(on("#ff5a36", "sphere { material: metal(stripes(6, #d4af37, #8a6b1f), 0.2); }")).toContain("stripesPattern(");
  });

  it("as the map of displace()", () => {
    expect(on("displace(linear-gradient(#000000, #ffffff), stripes(8, black, white), 0.1)")).toContain("stripesPattern(");
  });
});
