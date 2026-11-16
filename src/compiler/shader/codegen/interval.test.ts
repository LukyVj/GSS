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

// pow() (decision 230): a variable set from JS has no range, but its square has one floor, and
// the exp() of what is never positive stays in (0, 1]: the bump of the hero "Champ"
describe("rangeOf(): pow(), and what a variable set from JS cannot push past", () => {
  it("reads pow() of a whole exponent: an even one is never negative", () => {
    expect(rangeOf("pow(-3.0, 2.0)", false)).toEqual({ low: [9], high: [9] });
    expect(rangeOf("pow(clamp(iTime, 0.0, 2.0) - 1.0, 2.0)", false)).toEqual({ low: [0], high: [1] });
    expect(rangeOf("pow(clamp(iTime, 0.0, 2.0) - 1.0, 3.0)", false)).toEqual({ low: [-1], high: [1] });
    expect(rangeOf("pow(clamp(iTime, 0.0, 4.0), 0.5)", false)).toEqual({ low: [0], high: [2] });
  });

  it("bounds a bump around a point set from JS", () => {
    const bump = "exp(((-1.0 * (pow((-2.8 - uProperties[0].x), 2.0) + pow((-2.1 - uProperties[1].x), 2.0))) / 1.8))";
    expect(rangeOf(bump, false)).toEqual({ low: [0], high: [1] });
    expect(rangeOf(`vec3(-2.8, (-1.42 + (${bump} * 1.7)), -2.1)`, false)).toEqual({ low: [-2.8, -1.42, -2.1], high: [-2.8, -1.42 + 1.7, -2.1] });
  });

  it("has no range for pow() of a base that can be negative and an exponent that is not whole", () => {
    expect(rangeOf("pow(sin(iTime), 0.5)", false)).toBeNull();
    expect(rangeOf("pow(2.0, iTime)", false)).toBeNull();
    expect(rangeOf("pow(uProperties[0].x, 2.0)", false)).toBeNull(); // no end
  });
});
