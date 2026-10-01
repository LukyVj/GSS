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
    expect(diffPixels(a, a.slice())).toEqual({ changed: 0, total: 2, maxDelta: 0 });
  });
  it("forgives tiny differences (GPU rounding), not real ones", () => {
    const a = image([100, 100, 100, 255], [100, 100, 100, 255]);
    const b = image([102, 100, 99, 255], [140, 100, 100, 255]);
    expect(diffPixels(a, b, 2)).toEqual({ changed: 1, total: 2, maxDelta: 40 });
  });
  it("paints the changed pixels red in the diff image", () => {
    const a = image([100, 100, 100, 255], [100, 100, 100, 255]);
    const b = image([100, 100, 100, 255], [0, 100, 100, 255]);
    const out = new Uint8ClampedArray(8);
    diffPixels(a, b, 2, out);
    expect([...out.slice(4)]).toEqual([255, 0, 0, 255]);
    expect(out[0]).toBe(25); // unchanged: a dim grey
  });
  it("calls images of different sizes entirely changed", () => {
    expect(diffPixels(new Uint8ClampedArray(8), new Uint8ClampedArray(4)).changed).toBe(2);
  });
});

describe("the verdict of a whole comparison", () => {
  const same = visualVerdict("orrery.png", { changed: 0, total: 4, maxDelta: 1 });
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
    expect(hasRegression([], [visualVerdict("a.png", { changed: 1, total: 4, maxDelta: 30 })])).toBe(true);
    expect(hasRegression([], [visualVerdict("a.png", null)])).toBe(true);
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
    expect(md).toContain("| orrery.png | 0 / 4 | 1 | ✅ identical |");
  });
  it("warns when the two runs were not rendered at the same dpr", () => {
    const md = toMarkdown(steady, report("b", [[4, 1]], 2), [], [same]);
    expect(md).toContain("not comparable: dpr 1 before, 2 after");
  });
});
