import { describe, it, expect } from "vitest";
import { pixelRatio, createDensity, type Density } from "./dpr";

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

// Frames drawn like the view does, the ratio then the frame: at a steady rate, or at a
// rate that depends on the ratio (a GPU that keeps up below some ratio). `seen` collects
// every ratio drawn.
function draw(
  density: Density,
  ceiling: number,
  fps: number | ((ratio: number) => number),
  from: number,
  ms: number,
  seen: number[] = [],
) {
  let ratio = density.ratio(ceiling, 2);
  for (let t = from; t < from + ms; t += 1000 / (typeof fps === "number" ? fps : fps(ratio))) {
    ratio = density.ratio(ceiling, 2);
    seen.push(ratio);
    density.frame(t);
  }
  return ratio;
}

describe("createDensity: the dpr the viewer picks (decision 120)", () => {
  it("a number is the viewer's, above the scene's dpr, never above the screen", () => {
    expect(createDensity(1.5).ratio(0.5, 2)).toBe(1.5);
    expect(createDensity(2).ratio(2, 1)).toBe(1);
  });

  it("auto starts at the scene's ratio, and keeps it while the frames are fast", () => {
    const density = createDensity("auto");
    expect(density.ratio(2, 2)).toBe(2);
    expect(draw(density, 2, 60, 0, 5000)).toBe(2);
    expect(draw(createDensity("auto"), 1, 60, 0, 5000)).toBe(1); // never above the scene's
  });

  it("auto drops at once when the frames are slow, as much as the frame rate lacks", () => {
    const density = createDensity("auto");
    // 2 × √(30 / 55) = 1.48: the pixels cost the square of the ratio, rounded down by 0.25
    expect(draw(density, 2, 30, 0, 1200)).toBe(1.25);
  });

  it("auto never goes below 0.5, unless the scene asks for less", () => {
    expect(draw(createDensity("auto"), 2, 5, 0, 10000)).toBe(0.5);
    expect(draw(createDensity("auto"), 0.25, 5, 0, 10000)).toBe(0.25);
  });

  it("climbs back one step at a time, not at once to the ratio that was too slow", () => {
    const density = createDensity("auto");
    draw(density, 2, 30, 0, 1200);
    expect(draw(density, 2, 60, 1200, 3000)).toBe(1.5);
    expect(draw(density, 2, 60, 4200, 4000)).toBe(1.75);
  });

  it("tries the ratio that was too slow again after 8 s: a hitch passes", () => {
    const density = createDensity("auto");
    draw(density, 2, 30, 0, 1200);
    draw(density, 2, 60, 1200, 7000);
    expect(draw(density, 2, 60, 8200, 4000)).toBe(2);
  });

  it("waits twice as long after each try that fails", () => {
    const density = createDensity("auto");
    const gpu = (ratio: number) => (ratio > 1.75 ? 30 : 60); // 2 is too much for it
    const tries = (from: number, ms: number) => {
      const seen: number[] = [];
      draw(density, 2, gpu, from, ms, seen);
      return seen.filter((ratio, i) => i > 0 && ratio === 2 && seen[i - 1] !== 2).length;
    };
    expect(tries(0, 10000)).toBe(1); // dropped at 1 s, tried again at 9 s
    expect(tries(10000, 16500)).toBe(1); // dropped again at 10 s, tried at 26 s
    expect(tries(26500, 30000)).toBe(0); // dropped at 27 s: not before 59 s
  });

  it("does not count a pause (a hidden tab, a compile) as a slow frame", () => {
    const density = createDensity("auto");
    draw(density, 2, 60, 0, 2000);
    expect(draw(density, 2, 60, 5000, 2000)).toBe(2);
  });

  it("lets a new scene climb back to the scene's ratio", () => {
    const density = createDensity("auto");
    draw(density, 2, 30, 0, 1200);
    draw(density, 2, 60, 1200, 10000);
    density.restart(11200);
    expect(draw(density, 2, 60, 11200, 6000)).toBe(2);
  });

  it("starts auto again from the scene's ratio when chosen", () => {
    const density = createDensity("auto");
    draw(density, 2, 30, 0, 1200);
    density.choose(1);
    expect(density.ratio(2, 2)).toBe(1);
    density.choose("auto");
    expect(density.choice).toBe("auto");
    expect(density.ratio(2, 2)).toBe(2);
  });
});
