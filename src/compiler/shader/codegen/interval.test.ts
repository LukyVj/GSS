import { describe, it, expect } from "vitest";
import { rangeOf } from "./interval";

describe("rangeOf(): the range of a value of the shader (decision 219)", () => {
  it("reads constants, vectors and arithmetic", () => {
    expect(rangeOf("vec3(1.0, -2.0, 0.5)", false)).toEqual({ low: [1, -2, 0.5], high: [1, -2, 0.5] });
    expect(rangeOf("(2.0 * 3.0 - 1.0) / 2.0", false)).toEqual({ low: [2.5], high: [2.5] });
  });

  it("keeps a mix with a weight in [0, 1] between its ends, and either side of a ternary", () => {
    expect(rangeOf("mix(-1.0, 3.0, smoothstep(0.0, 1.0, clamp(iTime / 2.0, 0.0, 1.0)))", false)).toEqual({ low: [-1], high: [3] });
    expect(rangeOf("(uTimeline[0].x >= 0.0 && uTimeline[0].x <= 1.0) ? vec3(1.0) : vec3(-2.0, 0.0, 4.0)", false)).toEqual({
      low: [-2, 0, 1],
      high: [1, 1, 4],
    });
  });

  it("bounds a push by hover-distance() and hover-direction()", () => {
    const range = rangeOf("vec3((hoverDir3.x * (0.18 * exp((-6.0 * hoverDist3)))), 0.0, 0.0)", false)!;
    expect(range.low[0]).toBeCloseTo(-0.18);
    expect(range.high[0]).toBeCloseTo(0.18);
  });

  it("bounds a cubic-bezier() by its handles", () => {
    expect(rangeOf("cubicBezier(clamp(iTime, 0.0, 1.0), vec4(0.3, -0.6, 0.2, 1.6))", false)).toEqual({ low: [-0.6], high: [1.6] });
  });

  it("reads uHover[] in [0, 1] only when its transitions never overshoot", () => {
    expect(rangeOf("mix(0.0, 2.0, uHover[1])", true)).toEqual({ low: [0], high: [2] });
    expect(rangeOf("mix(0.0, 2.0, uHover[1])", false)).toBeNull();
  });

  it("has no range for what it does not know, or what has no end", () => {
    expect(rangeOf("uProperties[0].x", false)).toBeNull();
    expect(rangeOf("iTime * 2.0", false)).toBeNull();
    expect(rangeOf("someFunction(1.0)", false)).toBeNull();
    expect(rangeOf("1.0 / (iTime - 1.0)", false)).toBeNull();
  });
});
