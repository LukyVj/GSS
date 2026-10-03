import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

const on = (color: string, more = "") => compileGSS(`@scene { sphere; } sphere { translate: 0 1 0; color: ${color}; } ${more}`);

describe("noise(): the values", () => {
  it("paints an object with colors placed like a gradient, by a noise in the object's space", () => {
    const shader = on("noise(4 3, #1a1d2b, #3a7bff 60%, #ffffff)");
    expect(shader).toContain("vec3 gradientColor(float id, vec3 p, vec3 color)");
    expect(shader).toContain("float t = fractalNoise((q + vec3(0.0)) * 4.0, 3);");
    expect(shader).toContain("float fractalNoise(vec3 p, int octaves)");
  });

  it("has one octave by default, and makes sharp creases with turbulence", () => {
    expect(on("noise(2, #000000, #ffffff)")).toContain("fractalNoise((q + vec3(0.0)) * 2.0, 1);");
    const shader = on("noise(turbulence 2 4, #000000, #ffffff)");
    expect(shader).toContain("turbulenceNoise((q + vec3(0.0)) * 2.0, 4);");
    expect(shader).not.toContain("float fractalNoise(");
  });

  it("moves the pattern with at, and draws another one with seed", () => {
    expect(on("noise(2 at 0 1.5 0, #000000, #ffffff)")).toContain("(q + vec3(0.0, 1.5, 0.0)) * 2.0");
    const one = on("noise(2 seed 1, #000000, #ffffff)");
    const two = on("noise(2 seed 2, #000000, #ffffff)");
    expect(one).not.toBe(two);
    expect(one).toMatch(/\* 2\.0 \+ vec3\(/);
  });

  it("follows the direction of the ray in the background", () => {
    const shader = compileGSS("@scene { sphere; } scene { background: noise(3 2, #0b1020, #6b8cff); }");
    expect(shader).toContain("vec3 background(vec3 rd)");
    expect(shader).toContain("fractalNoise((rd + vec3(0.0)) * 3.0, 2)");
  });

  it("goes in a material, like a gradient", () => {
    expect(() =>
      compileGSS("@scene { sphere; } sphere { translate: 0 1 0; material: metal(noise(6, #888888, #ffffff), 0.3); }"),
    ).not.toThrow();
  });

  it("reads variables set from JS", () => {
    const shader = compileGSS(
      '@property --s { syntax: "<number>"; inherits: false; initial-value: 4; } @scene { sphere; } sphere { color: noise(var(--s), #000000, #ffffff); }',
    );
    expect(shader).toContain("uProperties[0]");
  });

  it("is lowered to WGSL", () => {
    expect(compileGSS("@scene { sphere; } sphere { color: noise(turbulence 3 2, #000000, #ffffff); }", "wgsl")).toContain(
      "g_turbulenceNoise",
    );
  });
});

describe("noise(): moving", () => {
  it("drifts with an animation of at, like the numbers of a gradient", () => {
    const shader = on(
      "noise(3 2, #000000, #ffffff)",
      "sphere { animation: drift 4s linear infinite; } @keyframes drift { to { color: noise(3 2 at 0 2 0, #000000, #ffffff); } }",
    );
    expect(shader).toContain("iTime");
    expect(shader).toMatch(/fractalNoise\(\(q \+ vec3\([^;]*iTime/);
  });

  it("keeps its kind, octaves and seed when it changes", () => {
    expect(() =>
      on("noise(3 2, #000000, #ffffff)", "sphere:hover { color: noise(3 4, #000000, #ffffff); }"),
    ).toThrow("a noise() keeps its kind, its octaves and its seed when it changes");
    expect(() =>
      on("noise(3, #000000, #ffffff)", "sphere:hover { color: linear-gradient(#000000, #ffffff); }"),
    ).toThrow("a noise() can only change into another noise()");
  });
});

describe("noise(): errors", () => {
  it("says what is wrong", () => {
    expect(() => on("noise(#000000, #ffffff)")).toThrow("noise() starts with a scale");
    expect(() => on("noise(0, #000000, #ffffff)")).toThrow("noise() starts with a scale");
    expect(() => on("noise(4 9, #000000, #ffffff)")).toThrow("octaves from 1 to 8");
    expect(() => on("noise(4 2 sparkly, #000000, #ffffff)")).toThrow("noise() starts with a scale");
    expect(() => on("noise(4 at 1 2, #000000, #ffffff)")).toThrow("at needs three numbers");
    expect(() => on("noise(4, #000000)")).toThrow("noise() needs at least two colors");
  });
});
