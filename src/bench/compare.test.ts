import { describe, it, expect } from "vitest";
import {
  verdict,
  median,
  comparePerf,
  diffPixels,
  visualVerdict,
  hasRegression,
  toMarkdown,
  type BenchReport,
  type Measure,
} from "./compare";

const summary = (medianMs: number, p95Ms = medianMs, p99Ms = p95Ms) => ({
  count: 200,
  meanMs: medianMs,
  medianMs,
  p95Ms,
  p99Ms,
});
const measure = (gpu: number, cpu: number, gpuP95 = gpu * 1.2): Measure => ({
  fps: 120,
  frame: summary(8.3, 9.2),
  gpu: summary(gpu, gpuP95),
  cpu: summary(cpu, cpu * 1.2),
});
// One scene, measured in several rounds: gpu and cpu medians of each round
const report = (label: string, rounds: [gpu: number, cpu: number][], dpr = 1): BenchReport => ({
  label,
  ref: label,
  date: "2026-10-01",
  renderer: "Apple M4 Pro",
  userAgent: "test",
  seconds: 4,
  dpr,
  rounds: rounds.length,
  scenes: {
    orrery: {
      shaderMs: 120,
      hoverOff: rounds.map(([gpu]) => measure(gpu, 0.1)),
      hoverOn: rounds.map(([gpu, cpu]) => measure(gpu, cpu)),
    },
  },
});
const row = (rows: ReturnType<typeof comparePerf>, hover: string, metric: string) =>
  rows.find((r) => r.hover === hover && r.metric === metric);

describe("median", () => {
  it("is the middle value, or the mean of the two middle ones", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("verdict", () => {
  it("is worse when the medians differ enough AND every round agrees", () => {
    expect(verdict([4, 4.1, 4.2], [5, 5.1, 5.3], 0.1, 0.3)).toBe("worse");
  });
  it("is the same when the rounds overlap, however far the medians", () => {
    // the noise of one machine: an after round is as good as a before round
    expect(verdict([4, 4.1, 6], [5, 5.1, 3.9], 0.1, 0.3)).toBe("same");
  });
  it("needs a change bigger than the absolute floor", () => {
    expect(verdict([0.1, 0.1, 0.1], [0.2, 0.2, 0.2], 0.1, 0.3)).toBe("same"); // +100 %, +0.1 ms
  });
  it("sees an improvement the same way", () => {
    expect(verdict([5.2, 5.0, 5.9], [0.3, 0.4, 0.3], 0.25, 0.3)).toBe("better");
  });
  it("says n/a when a side was never measured", () => {
    expect(verdict([], [4], 0.1, 0.3)).toBe("n/a");
  });
});

describe("comparePerf", () => {
  const before = report("main", [[6.3, 4.1], [6.1, 4.3], [6.5, 3.9]]);
  const after = report("branch", [[3.4, 0.4], [3.5, 0.3], [3.3, 0.4]]);

  it("compares the medians of the rounds, mouse off and on", () => {
    const cpu = row(comparePerf(before, after), "on", "cpu median");
    expect(cpu).toMatchObject({ before: 4.1, after: 0.4, verdict: "better", judged: true });
    expect(cpu?.beforeRange).toEqual([3.9, 4.3]);
  });
  it("shows the p95 without judging them", () => {
    expect(row(comparePerf(before, after), "on", "gpu p95")?.judged).toBe(false);
  });
  it("skips a scene that failed in either run", () => {
    const broken = report("b", [[6, 4]]);
    broken.scenes.orrery.error = "WebGL lost";
    expect(comparePerf(before, broken)).toEqual([]);
  });
});

describe("diffPixels", () => {
  const image = (...pixels: number[][]) => Uint8ClampedArray.from(pixels.flat());

  it("finds nothing between two identical images", () => {
    const a = image([10, 20, 30, 255], [0, 0, 0, 255]);
    expect(diffPixels(a, a.slice())).toEqual({ changed: 0, total: 2, maxDelta: 0, edges: 0 });
  });
  it("forgives tiny differences (GPU rounding), not real ones", () => {
    const a = image([100, 100, 100, 255], [100, 100, 100, 255]);
    const b = image([102, 100, 99, 255], [140, 100, 100, 255]);
    expect(diffPixels(a, b, 2)).toEqual({ changed: 1, total: 2, maxDelta: 40, edges: 0 });
  });
  it("paints the changed pixels red in the diff image", () => {
    const a = image([100, 100, 100, 255], [100, 100, 100, 255]);
    const b = image([100, 100, 100, 255], [0, 100, 100, 255]);
    const out = new Uint8ClampedArray(8);
    diffPixels(a, b, 2, out);
    expect([...out.slice(4)]).toEqual([255, 0, 0, 255]);
    expect(out[0]).toBe(25); // unchanged: a dim grey
  });
  // 3 × 3 images: a dark object (D) on a light background (L)
  const D = [20, 20, 20, 255];
  const L = [200, 200, 200, 255];
  const N = [20, 200, 20, 255]; // a color found nowhere else
  it("calls a silhouette moved by one pixel an edge flip", () => {
    const a = image(D, D, L, D, D, L, L, L, L);
    const b = image(D, D, L, D, D, D, L, L, L); // the middle-right pixel joined the object
    expect(diffPixels(a, b, 2, undefined, 3)).toEqual({ changed: 1, total: 9, maxDelta: 180, edges: 1 });
  });
  it("never calls a new color an edge flip", () => {
    const a = image(D, D, L, D, D, L, L, L, L);
    const b = image(D, D, L, D, D, N, L, L, L);
    expect(diffPixels(a, b, 2, undefined, 3).edges).toBe(0);
  });
  it("needs the old color still around the pixel", () => {
    const a = image(L, L, L, L, D, L, L, L, L); // a one-pixel object
    const b = image(L, L, L, L, L, L, L, L, L); // gone: not an edge flip
    expect(diffPixels(a, b, 2, undefined, 3).edges).toBe(0);
  });
  it("paints the edge flips yellow", () => {
    const a = image(D, D, L, D, D, L, L, L, L);
    const b = image(D, D, L, D, D, D, L, L, L);
    const out = new Uint8ClampedArray(36);
    diffPixels(a, b, 2, out, 3);
    expect([...out.slice(20, 24)]).toEqual([255, 220, 0, 255]);
  });
  it("calls images of different sizes entirely changed", () => {
    expect(diffPixels(new Uint8ClampedArray(8), new Uint8ClampedArray(4)).changed).toBe(2);
  });
});

describe("the verdict of a whole comparison", () => {
  const same = visualVerdict("orrery.png", { changed: 0, total: 4, maxDelta: 1, edges: 0 });
  const steady = report("a", [[4, 1], [4.1, 1], [4, 1.1]]);

  it("is clean when no judged metric got worse and every image is identical", () => {
    expect(hasRegression(comparePerf(steady, report("b", [[4.1, 1], [4, 1], [4.1, 1]])), [same])).toBe(false);
  });
  it("is a regression when a median got worse in every round", () => {
    const slower = report("b", [[5, 1], [5.2, 1], [5.1, 1]]);
    expect(hasRegression(comparePerf(steady, slower), [same])).toBe(true);
  });
  it("is not a regression when only a p95 moved", () => {
    const jumpy = report("b", [[4, 1], [4.1, 1], [4, 1]]);
    jumpy.scenes.orrery.hoverOff = [1, 2, 3].map(() => measure(4, 0.1, 9)); // p95 ×2
    expect(hasRegression(comparePerf(steady, jumpy), [same])).toBe(false);
  });
  it("is a regression when one pixel changed, or an image is missing", () => {
    expect(hasRegression([], [visualVerdict("a.png", { changed: 1, total: 4, maxDelta: 30, edges: 0 })])).toBe(true);
    expect(hasRegression([], [visualVerdict("a.png", null)])).toBe(true);
  });
  it("accepts a few edge flips, not a whole shifted outline", () => {
    const few = visualVerdict("a.png", { changed: 17, total: 2_000_000, maxDelta: 120, edges: 17 });
    expect(few.verdict).toBe("edges");
    expect(hasRegression([], [few])).toBe(false);
    const many = visualVerdict("a.png", { changed: 5000, total: 2_000_000, maxDelta: 120, edges: 5000 });
    expect(many.verdict).toBe("changed");
    const mixed = visualVerdict("a.png", { changed: 18, total: 2_000_000, maxDelta: 120, edges: 17 });
    expect(mixed.verdict).toBe("changed");
  });
  it("writes it all as a markdown report, with the range of the rounds", () => {
    const before = report("main", [[6.3, 4.1], [6.1, 4.3], [6.5, 3.9]]);
    const after = report("branch", [[3.4, 0.4], [3.5, 0.3], [3.3, 0.4]]);
    const md = toMarkdown(before, after, comparePerf(before, after), [same]);
    expect(md).toContain("✅ no regression");
    expect(md).toContain("3 round(s) per version");
    expect(md).toContain(
      "| orrery | on | cpu median | 4.10 <sub>3.90–4.30</sub> | 0.40 <sub>0.30–0.40</sub> | -90.2 % | ✅ better |",
    );
    expect(md).toContain("info: ");
    expect(md).toContain("| orrery.png | 0 / 4 | 0 | 1 | ✅ identical |");
  });
  it("warns when the two runs were not rendered at the same dpr", () => {
    const md = toMarkdown(steady, report("b", [[4, 1]], 2), [], [same]);
    expect(md).toContain("not comparable: dpr 1 before, 2 after");
  });
});
