import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

const on = (value: string, more = "") =>
  compileGSS(`@scene { cube; } cube { translate: 0 0.5 0; } scene { floor: ${value}; } ${more}`);

describe("floor: an image on the floor", () => {
  it("places the colors of a noise() at the point of the floor, in the units of the scene", () => {
    const shader = on("noise(3 4, #1a1d2b, #3a7bff 55%, #ffffff)");
    expect(shader).toContain("vec3 gradientColor(float id, vec3 p, vec3 color)");
    expect(shader).toContain("  if (id == 0.0) {  // the floor\n    vec3 q = p;");
    expect(shader).toContain("    float t = fractalNoise((q + vec3(0.0)) * 3.0, 4);");
    expect(shader).toContain("float fractalNoise(vec3 p, int octaves)");
    // main() reads it at the point that was hit
    expect(shader).toContain("m.color = gradientColor(id, p, m.color);");
  });

  it("spreads a gradient over a square of 40 under the scene, seen from above like a plane", () => {
    const shader = on("radial-gradient(#2a2e40, #0b1020 25%)");
    expect(shader).toContain("    vec2 size = vec2(40.0, 40.0);");
    expect(shader).toContain("    vec2 at = vec2(q.x, -q.z) + 0.5 * size;");
  });

  it("keeps the mean of its colors in getMaterial()", () => {
    expect(on("linear-gradient(#000000, #ffffff)")).toContain("return matte(vec3(0.502, 0.502, 0.502));  // the floor");
  });

  it("takes every gradient, and displace()", () => {
    for (const image of [
      "linear-gradient(to right, #000000, #ffffff)",
      "repeating-linear-gradient(45deg, #000000 0% 1%, #ffffff 1% 2%)",
      "radial-gradient(circle closest-side, #ffffff, #000000)",
      "repeating-radial-gradient(#000000 0% 2%, #ffffff 4%)",
      "conic-gradient(from 45deg, #ff5a36, #3a7bff, #ff5a36)",
      "repeating-conic-gradient(#000000 0deg 15deg, #ffffff 15deg 30deg)",
      "displace(noise(2, #000000, #ffffff), noise(turbulence 1 3, black, white), 0.02)",
    ])
      expect(() => on(image), image).not.toThrow();
  });

  it("takes named colors and the color functions", () => {
    expect(on("noise(2, black, rgb(255 255 255))")).toContain("vec3(1.0, 1.0, 1.0)");
  });

  it("paints the floor next to the objects painted with a gradient", () => {
    const shader = compileGSS(
      "@scene { cube; } cube { translate: 0 0.5 0; color: linear-gradient(#ff0000, #0000ff); } scene { floor: noise(2, #000000, #ffffff); }",
    );
    expect(shader).toContain("  if (id == 1.0) {  // cube");
    expect(shader).toContain("  if (id == 0.0) {  // the floor");
  });

  it("is seen by the reflections", () => {
    const shader = compileGSS(
      "@scene { sphere; } sphere { translate: 0 1 0; material: chrome; } scene { floor: noise(2, #000000, #ffffff); }",
    );
    expect(shader).toContain("return diffuse(n, gradientColor(hit.y, p, getMaterial(hit.y).color));");
  });

  it("reads variables set from JS", () => {
    const shader = compileGSS(
      '@property --s { syntax: "<number>"; inherits: false; initial-value: 4; } @scene { cube; } scene { floor: noise(var(--s), #000000, #ffffff); }',
    );
    expect(shader).toContain("uProperties[0]");
  });

  it("is lowered to WGSL", () => {
    expect(compileGSS("@scene { cube; } scene { floor: noise(3 2, #000000, #ffffff); }", "wgsl")).toContain("g_fractalNoise");
  });

  it("leaves a floor of one color as it was", () => {
    const shader = on("#1a1a1f");
    expect(shader).not.toContain("gradientColor");
    expect(shader).toContain("return matte(vec3(0.102, 0.102, 0.122));  // the floor");
  });
});

describe("floor: errors", () => {
  it("takes opaque colors", () => {
    expect(() => on("noise(3, #ffffff00, #ffffff)")).toThrow("Only color, background and mask-image take a transparent color");
  });

  it("takes one image, not layers", () => {
    expect(() => on("noise(3, #000000, #ffffff), #102040")).toThrow("floor takes one image, not layers");
  });

  it("names floor when the value is not a color, an image or none", () => {
    expect(() => on("12")).toThrow("floor expects a color, a gradient, a noise() or none");
  });
});
