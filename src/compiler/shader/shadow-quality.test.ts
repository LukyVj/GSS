import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

const scene = (sceneRule: string, more = "@scene { sphere; } sphere { translate: 0 1 0; }") =>
  compileGSS(`${more} scene { ${sceneRule} }`);
const shadowOf = (shader: string) => {
  const start = shader.search(/(float|vec3) shadow\(vec3 ro/);
  return shader.slice(start, shader.indexOf("\n}\n", start));
};
const HOLES = "@scene { sphere; } sphere { translate: 0 1 0; mask-image: noise(4, black 50%, transparent 50%); }";
const GLASS = "@scene { sphere; } sphere { translate: 0 1 0; opacity: 0.5; }";

describe("shadow-softness, shadow-steps: the penumbra and the reach of the shadows", () => {
  it("keeps the shader as it was with the initial values", () => {
    for (const more of [undefined, HOLES, GLASS])
      for (const mode of ["soft", "hard"])
        expect(scene(`shadows: ${mode}; shadow-softness: 1; shadow-steps: auto;`, more)).toBe(scene(`shadows: ${mode};`, more));
  });

  it("widens the penumbra with a bigger softness, and narrows it with a smaller one", () => {
    expect(shadowOf(scene("shadows: soft; shadow-softness: 2;"))).toContain("lit = min(lit, 6.0 * h / t);");
    expect(shadowOf(scene("shadows: soft; shadow-softness: 0.5;"))).toContain("lit = min(lit, 24.0 * h / t);");
    expect(shadowOf(scene("shadows: soft; shadow-softness: 3;", HOLES))).toContain("lit = min(lit, 4.0 * h / t);");
    expect(shadowOf(scene("shadows: soft; shadow-softness: 3;", GLASS))).toContain("soft = min(soft, 4.0 * h / t);");
  });

  it("gives every shadow loop the steps of shadow-steps", () => {
    for (const more of [undefined, HOLES, GLASS])
      for (const mode of ["soft", "hard"]) {
        const shadow = shadowOf(scene(`shadows: ${mode}; shadow-steps: 160;`, more));
        expect(shadow).toContain("for (int i = 0; i < 160; i++) {");
      }
  });

  it("changes nothing without shadows", () => {
    expect(scene("shadow-softness: 2; shadow-steps: 32;")).toBe(scene(""));
  });

  it("lowers to WGSL", () => {
    const wgsl = compileGSS("@scene { sphere; } scene { shadows: soft; shadow-softness: 2; shadow-steps: 160; }", "wgsl");
    expect(wgsl).toContain("160");
    expect(wgsl).toContain("(6.0 * g_h) / g_t");
  });

  it("refuses values out of range", () => {
    expect(() => scene("shadow-softness: 0;")).toThrow("shadow-softness expects a number from 0.1 to 10, like: shadow-softness: 2;");
    expect(() => scene("shadow-softness: 20;")).toThrow("shadow-softness expects a number from 0.1 to 10");
    expect(() => scene("shadow-steps: 8;")).toThrow("shadow-steps expects auto or a whole number from 16 to 512, like: shadow-steps: 128;");
    expect(() => scene("shadow-steps: 64.5;")).toThrow("shadow-steps expects auto or a whole number");
  });
});
