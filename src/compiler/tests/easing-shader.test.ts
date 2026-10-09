import { describe, it, expect } from "vitest";
import { compileScene } from "../index";

// The easing of an @keyframes animation, computed in the shader
const shaderOf = (animation: string, property = "translate: 0 2 0;") =>
  compileScene(
    `@scene { sphere; } sphere { translate: 0 1 0; animation: move ${animation}; } @keyframes move { to { ${property} } }`,
  ).shader;

describe("easings in @keyframes", () => {
  it("keeps a constant speed without an easing, as before", () => {
    const shader = shaderOf("2s");
    expect(shader).not.toContain("smoothstep");
    expect(shader).not.toContain("cubicBezier");
  });

  it("keeps ease-in-out a smoothstep: the scenes that use it do not change", () => {
    const shader = shaderOf("2s ease-in-out alternate");
    expect(shader).toContain("smoothstep(0.0, 1.0, clamp(");
    expect(shader).not.toContain("cubicBezier");
  });

  it("solves the other keywords and cubic-bezier() with cubicBezier()", () => {
    expect(shaderOf("2s ease-out")).toContain(", vec4(0.0, 0.0, 0.58, 1.0))");
    expect(shaderOf("2s ease")).toContain(", vec4(0.25, 0.1, 0.25, 1.0))");
    expect(shaderOf("2s cubic-bezier(0.3, -0.5, 0.7, 1.5)")).toContain(
      ", vec4(0.3, -0.5, 0.7, 1.5))",
    );
  });

  it("writes cubicBezier() once, only when it is used", () => {
    const shader = shaderOf("2s ease-in");
    expect(shader.match(/float cubicBezier\(float x, vec4 h\)/g)).toHaveLength(
      1,
    );
  });

  it("defines cubicBezier() before getMaterial(), for an animated color", () => {
    const shader = shaderOf("2s ease-in", "color: #3a7bff;");
    expect(shader).toContain("cubicBezier(clamp(");
    expect(shader.indexOf("float cubicBezier(")).toBeLessThan(
      shader.indexOf("Material getMaterial("),
    );
  });

  it("writes linear() as segments, without a helper", () => {
    const shader = shaderOf("2s linear(0, 0.25 75%, 1)");
    expect(shader).not.toContain("cubicBezier");
    expect(shader).toContain("(0.0 + 0.25 * clamp((");
    expect(shader).toContain(" + 0.75 * clamp((");
  });

  it("jumps with step() where two points of linear() share a moment", () => {
    expect(shaderOf("2s linear(0, 0 50%, 1 50%, 1)")).toContain(
      "1.0 * step(0.5, ",
    );
  });

  it("reads the plain linear keyword as no easing at all", () => {
    expect(shaderOf("2s linear")).toBe(shaderOf("2s"));
  });

  it("snaps the progress with steps(), without any helper function", () => {
    const shader = shaderOf("2s steps(4)");
    expect(shader).toMatch(/\(min\(floor\(clamp\(.*\) \* 4\.0\), 4\.0\) \/ 4\.0\)/);
    expect(shader).not.toContain("cubicBezier");
    expect(shaderOf("2s steps(3, jump-both)")).toMatch(/\* 3\.0\) \+ 1\.0, 4\.0\) \/ 4\.0\)/);
  });

  it("waits for its segment when the easing is not 0 at its start (step-start, linear(0.5, 1))", () => {
    const blink = (easing: string) =>
      compileScene(
        `@scene { sphere; } sphere { animation: blink 1s ${easing}; } @keyframes blink { 50% { scale: 1.6; } }`,
      ).shader;
    expect(blink("step-start")).toContain("* step(0.5, ");
    expect(blink("linear(0.5, 1)")).toContain("* step(0.5, ");
    // The others do not change: 0 at the start of a segment is already "not started"
    expect(blink("step-end")).not.toContain("* step(0.5, ");
    expect(blink("ease-out")).not.toContain("* step(0.5, ");
  });

  it("gives exactly 0 and 1 at the ends of cubic-bezier(), like CSS", () => {
    // The search for the curve stops close to its ends, not on them: a segment of
    // visibility that had not started yet showed a hidden object
    expect(shaderOf("2s ease")).toContain("if (x <= 0.0 || x >= 1.0) return x;");
  });

  it("rejects two easings", () => {
    expect(() => shaderOf("2s ease-in linear")).toThrow("only one easing");
  });
});
