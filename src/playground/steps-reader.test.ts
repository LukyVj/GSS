import { describe, it, expect } from "vitest";
import { stepsColor, readSteps, STEPS_MAX } from "./steps-reader";

// view: steps (decision 204): the debug panel reads the colors of the render back into numbers

// A row of pixels, RGBA, from step counts; null: a pixel that is not a color of the ramp
const pixels = (steps: (number | null)[]) =>
  new Uint8ClampedArray(
    steps.flatMap((n) => (n === null ? [242, 69, 64, 255] : [...stepsColor(n).map((c) => Math.round(c * 255)), 255])),
  );

describe("stepsColor", () => {
  it("is the ramp of the shader: dark, blue, green, yellow, red", () => {
    expect(stepsColor(0)).toEqual([0.04, 0.05, 0.1]);
    expect(stepsColor(STEPS_MAX)).toEqual([1, 0.35, 0.21]);
    expect(stepsColor(500)).toEqual(stepsColor(STEPS_MAX));
  });
});

describe("readSteps", () => {
  it("gives the mean, the max and the share of pixels at the top of the scale", () => {
    expect(readSteps(pixels([10, 20, 30, 150]))).toEqual({ mean: 52.5, max: 150, hot: 0.25, pixels: 4 });
  });

  it("leaves out the pixels that are not on the ramp: the axes, the grid, the panel", () => {
    expect(readSteps(pixels([40, null, 60]))).toEqual({ mean: 50, max: 60, hot: 0, pixels: 2 });
  });

  it("leaves out the transparent pixels", () => {
    const data = pixels([40, 60]);
    data[7] = 0;
    expect(readSteps(data)).toEqual({ mean: 40, max: 40, hot: 0, pixels: 1 });
  });

  it("is null without a pixel on the ramp", () => {
    expect(readSteps(pixels([null]))).toBeNull();
  });
});
