import { describe, it, expect } from "vitest";
import { ease } from "./easing";
import type { Easing } from "../compiler/values/easing";

const bezier = (x1: number, y1: number, x2: number, y2: number): Easing => ({
  type: "cubic-bezier",
  x1,
  y1,
  x2,
  y2,
});
const linear = (...points: [number, number][]): Easing => ({
  type: "linear",
  points: points.map(([input, output]) => ({ input, output })),
});

// Reference values: the same curves solved by bisection, 100 steps
describe("ease: cubic-bezier()", () => {
  it("matches the CSS keywords", () => {
    expect(ease(bezier(0.25, 0.1, 0.25, 1), 0.5)).toBeCloseTo(0.8024034, 5); // ease
    expect(ease(bezier(0.42, 0, 0.58, 1), 0.25)).toBeCloseTo(0.1291619, 5); // ease-in-out
    expect(ease(bezier(0.42, 0, 0.58, 1), 0.5)).toBeCloseTo(0.5, 5);
    expect(ease(bezier(0.42, 0, 1, 1), 0.5)).toBeCloseTo(0.3153568, 5); // ease-in
    expect(ease(bezier(0, 0, 0.58, 1), 0.5)).toBeCloseTo(0.6846432, 5); // ease-out
  });

  it("solves a steep curve too, where Newton alone can stall", () => {
    expect(ease(bezier(0.2, 0, 0, 1), 0.3)).toBeCloseTo(0.6880668, 5);
    expect(ease(bezier(1, 0, 0, 1), 0.5)).toBeCloseTo(0.5, 5);
  });

  it("can overshoot below 0 or above 1", () => {
    expect(ease(bezier(0.3, -0.5, 0.7, 1.5), 0.1)).toBeCloseTo(-0.0807916, 5);
  });

  it("starts at 0, ends at 1, and holds outside 0–1", () => {
    const curve = bezier(0.25, 0.1, 0.25, 1);
    expect(ease(curve, 0)).toBe(0);
    expect(ease(curve, 1)).toBe(1);
    expect(ease(curve, -0.5)).toBe(0);
    expect(ease(curve, 2)).toBe(1);
  });
});

describe("ease: linear()", () => {
  it("is the progress itself for linear", () => {
    expect(ease(linear([0, 0], [1, 1]), 0.3)).toBeCloseTo(0.3);
  });

  it("follows the segments between the points", () => {
    const curve = linear([0, 0], [0.75, 0.25], [1, 1]);
    expect(ease(curve, 0.375)).toBeCloseTo(0.125);
    expect(ease(curve, 0.875)).toBeCloseTo(0.625);
  });

  it("stays flat on a step, and jumps where two points share a moment", () => {
    expect(ease(linear([0, 0], [0.25, 0.5], [0.75, 0.5], [1, 1]), 0.5)).toBe(
      0.5,
    );
    const jump = linear([0, 0], [0.5, 0], [0.5, 1], [1, 1]);
    expect(ease(jump, 0.49)).toBe(0);
    expect(ease(jump, 0.5)).toBe(1); // like CSS: the last point at that moment
    expect(ease(jump, 0.51)).toBe(1);
  });

  it("holds the first and the last output outside the points", () => {
    const curve = linear([0.2, 0.1], [0.6, 0.9]);
    expect(ease(curve, 0)).toBe(0.1);
    expect(ease(curve, 1)).toBe(0.9);
  });
});

describe("ease: steps()", () => {
  const steps = (count: number, position: string): Easing =>
    ({ type: "steps", count, position }) as Easing;
  const at = (easing: Easing) => [0, 0.2, 0.25, 0.5, 0.99, 1].map((t) => ease(easing, t));

  it("jumps like CSS, wherever the jumps are", () => {
    expect(at(steps(4, "jump-end"))).toEqual([0, 0, 0.25, 0.5, 0.75, 1]);
    expect(at(steps(4, "jump-start"))).toEqual([0.25, 0.25, 0.5, 0.75, 1, 1]);
    expect(at(steps(3, "jump-both"))).toEqual([0.25, 0.25, 0.25, 0.5, 0.75, 1]);
    expect(at(steps(3, "jump-none"))).toEqual([0, 0, 0, 0.5, 1, 1]);
  });
});
