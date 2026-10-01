import { describe, it, expect } from "vitest";
import { pixelRatio } from "./dpr";

// pixelRatio(the dpr of the scene, window.devicePixelRatio) → the ratio the canvas uses

describe("pixelRatio", () => {
  it("auto follows the screen up to 2, like before dpr existed", () => {
    expect(pixelRatio("auto", 1)).toBe(1);
    expect(pixelRatio("auto", 2)).toBe(2);
    expect(pixelRatio("auto", 3)).toBe(2);
  });

  it("max follows the screen, however dense", () => {
    expect(pixelRatio("max", 1)).toBe(1);
    expect(pixelRatio("max", 3)).toBe(3);
  });

  it("a number is never above the screen", () => {
    expect(pixelRatio(2, 3)).toBe(2);
    expect(pixelRatio(2, 1)).toBe(1);
    expect(pixelRatio(4, 2)).toBe(2);
  });

  it("a number below 1 renders coarser on every screen", () => {
    expect(pixelRatio(0.5, 1)).toBe(0.5);
    expect(pixelRatio(0.5, 2)).toBe(0.5);
  });
});
