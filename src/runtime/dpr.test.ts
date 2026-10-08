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

// A density that has warmed up to the scene's ratio: 2 s of fast frames, then a new measure
// from 2 s, so that what a test draws next is measured alone
function warmed(ceiling = 2): Density {
  const density = createDensity("auto");
  draw(density, ceiling, 60, 0, 2000);
  density.resume(2000);
  return density;
}

describe("createDensity: the dpr the viewer picks (decision 120)", () => {
  it("a number is the viewer's, above the scene's dpr, never above the screen", () => {
    expect(createDensity(1.5).ratio(0.5, 2)).toBe(1.5);
    expect(createDensity(2).ratio(2, 1)).toBe(1);
  });

  it("auto keeps the scene's ratio while the frames are fast, never above it", () => {
    const density = warmed();
    expect(draw(density, 2, 60, 2000, 5000)).toBe(2);
    expect(draw(createDensity("auto"), 1, 60, 0, 5000)).toBe(1); // never above the scene's
  });

  it("auto drops at once when the frames are slow, as much as the frame rate lacks", () => {
    const density = warmed();
    // 2 × √(30 / 55) = 1.48: the pixels cost the square of the ratio, rounded down by 0.25
    expect(draw(density, 2, 30, 2000, 1200)).toBe(1.25);
  });

  it("auto never goes below 0.5, unless the scene asks for less", () => {
    expect(draw(createDensity("auto"), 2, 20, 0, 10000)).toBe(0.5);
    expect(draw(createDensity("auto"), 0.25, 20, 0, 10000)).toBe(0.25);
  });

  it("climbs back one step at a time, not at once to the ratio that was too slow", () => {
    const density = warmed();
    draw(density, 2, 30, 2000, 1200);
    expect(draw(density, 2, 60, 3200, 3000)).toBe(1.5);
    expect(draw(density, 2, 60, 6200, 4000)).toBe(1.75);
  });

  it("tries the ratio that was too slow again after 8 s: a hitch passes", () => {
    const density = warmed();
    draw(density, 2, 30, 2000, 1200);
    draw(density, 2, 60, 3200, 7000);
    expect(draw(density, 2, 60, 10200, 4000)).toBe(2);
  });

  it("waits twice as long after each try that fails", () => {
    const density = warmed();
    const gpu = (ratio: number) => (ratio > 1.75 ? 30 : 60); // 2 is too much for it
    const tries = (from: number, ms: number) => {
      const seen: number[] = [];
      draw(density, 2, gpu, from, ms, seen);
      return seen.filter((ratio, i) => i > 0 && ratio === 2 && seen[i - 1] !== 2).length;
    };
    expect(tries(2000, 10000)).toBe(1); // dropped at 2.5 s, tried again at 10.5 s
    expect(tries(12000, 16500)).toBe(1); // dropped again at 11 s, tried at 27 s
    expect(tries(28500, 30000)).toBe(0); // dropped at 27.5 s: not before 59.5 s
  });

  it("does not count a pause (a hidden tab, a compile) as a slow frame", () => {
    const density = warmed();
    draw(density, 2, 60, 2000, 2000);
    density.resume(7000);
    expect(draw(density, 2, 60, 7000, 2000)).toBe(2);
  });

  it("lets a new scene climb back to the scene's ratio", () => {
    const density = warmed();
    draw(density, 2, 30, 2000, 1200);
    draw(density, 2, 60, 3200, 10000);
    density.restart(13200);
    expect(draw(density, 2, 60, 13200, 6000)).toBe(2);
  });

  it("starts auto again low when chosen, and climbs to the scene's ratio", () => {
    const density = warmed();
    density.choose(1);
    expect(density.ratio(2, 2)).toBe(1);
    density.choose("auto");
    expect(density.choice).toBe("auto");
    expect(density.ratio(2, 2)).toBe(0.5);
    expect(draw(density, 2, 60, 2000, 2000)).toBe(2);
  });
});

describe("createDensity: a scene starts light, and stops when too heavy (decision 142)", () => {
  it("draws its first frames at 0.5, then climbs to the scene's ratio in about a second", () => {
    const density = createDensity("auto");
    expect(density.ratio(2, 2)).toBe(0.5);
    const seen: number[] = [];
    expect(draw(density, 2, 60, 0, 1200, seen)).toBe(2);
    expect(seen).toContain(1);
  });

  it("starts at the scene's ratio when the scene asks for less than 0.5", () => {
    expect(createDensity("auto").ratio(0.25, 2)).toBe(0.25);
  });

  it("stays light on a GPU that cannot keep up, without a frame at the scene's ratio", () => {
    const seen: number[] = [];
    draw(createDensity("auto"), 2, (ratio) => (ratio > 0.5 ? 30 : 60), 0, 5000, seen);
    expect(Math.max(...seen)).toBeLessThan(2);
  });

  it("is too heavy after more than a second and a half of very slow frames at its lowest ratio", () => {
    const density = createDensity("auto");
    let heavy = -1;
    for (let t = 0; t < 5000 && heavy < 0; t += 250) {
      density.ratio(2, 2);
      if (density.frame(t)) heavy = t;
    }
    expect(heavy).toBeGreaterThanOrEqual(1500);
    expect(heavy).toBeLessThanOrEqual(2500);
  });

  it("is not too heavy for one slow moment, a page busy elsewhere", () => {
    const density = warmed();
    let heavy = false;
    density.ratio(2, 2);
    heavy ||= density.frame(2000);
    heavy ||= density.frame(3200); // one frame of 1.2 s
    for (let t = 3200; t < 10000; t += 1000 / 60) {
      density.ratio(2, 2);
      heavy ||= density.frame(t);
    }
    expect(heavy).toBe(false);
  });

  it("is too heavy at once after one frame of 3 s at its lowest ratio: a freeze", () => {
    const density = createDensity("auto");
    density.ratio(2, 2);
    density.frame(0);
    expect(density.frame(3000)).toBe(true);
  });

  it("is not too heavy for one slow moment at its lowest ratio either", () => {
    const density = createDensity("auto");
    let heavy = false;
    for (const t of [0, 1200, 1216, 1232]) {
      density.ratio(1, 2);
      heavy ||= density.frame(t);
    }
    for (let t = 1250; t < 8000; t += 1000 / 60) {
      density.ratio(1, 2);
      heavy ||= density.frame(t);
    }
    expect(heavy).toBe(false);
  });

  it("does not measure the first frame of a new scene, which may wait for its compile", () => {
    const density = warmed();
    density.restart(2000);
    let heavy = false;
    for (const t of [2000, 6000]) heavy ||= density.frame(t); // a compile of 4 s
    for (let t = 6000; t < 9000; t += 1000 / 60) heavy ||= density.frame(t);
    expect(heavy).toBe(false);
    expect(density.ratio(2, 2)).toBe(2);
  });

  it("is not too heavy while it can still lower its ratio", () => {
    const density = warmed();
    let heavy = false;
    for (let t = 2000; t < 3000; t += 300) {
      density.ratio(2, 2);
      heavy ||= density.frame(t);
    }
    expect(heavy).toBe(false);
    expect(density.ratio(2, 2)).toBe(0.5);
  });

  it("says so once, and never again once the reader asked to draw anyway", () => {
    const density = createDensity("auto");
    let times = 0;
    for (let t = 0; t < 4000; t += 250) {
      density.ratio(2, 2);
      if (density.frame(t)) {
        times++;
        density.insist();
      }
    }
    expect(times).toBe(1);
    for (let t = 4000; t < 20000; t += 250) {
      density.ratio(2, 2);
      expect(density.frame(t)).toBe(false);
    }
  });

  it("watches a number the viewer chose too, at that number", () => {
    const density = createDensity(2);
    let heavy = false;
    for (let t = 0; t < 4000 && !heavy; t += 250) {
      expect(density.ratio(2, 2)).toBe(2);
      heavy = density.frame(t);
    }
    expect(heavy).toBe(true);
  });
});
