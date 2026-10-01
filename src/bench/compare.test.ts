import { describe, it, expect } from "vitest";
import {
  verdict,
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
const measure = (gpu: number, cpu: number, frameP95 = 17): Measure => ({
  fps: 60,
  frame: summary(16.7, frameP95),
  gpu: summary(gpu, gpu * 1.2),
  cpu: summary(cpu, cpu * 1.2),
});
const report = (label: string, gpu: number, cpu: number): BenchReport => ({
  label,
  ref: label,
  date: "2026-10-01",
  renderer: "Apple M2",
  userAgent: "test",
  seconds: 4,
  scenes: { orrery: { shaderMs: 120, hoverOff: measure(gpu, 0.3), hoverOn: measure(gpu, cpu) } },
});

describe("verdict", () => {
  it("calls the noise of two runs the same", () => {
    expect(verdict(8, 8.4, 0.1, 0.3)).toBe("same"); // +5 %: noise
  });
  it("needs both a relative and an absolute change", () => {
    expect(verdict(0.5, 0.9, 0.1, 0.3)).toBe("worse"); // +80 % and +0.4 ms
    expect(verdict(0.1, 0.3, 0.1, 0.3)).toBe("same"); // +200 %, but only +0.2 ms
  });
  it("sees an improvement too", () => {
    expect(verdict(6, 0.4, 0.25, 0.3)).toBe("better");
  });
  it("says n/a when one side was not measured", () => {
    expect(verdict(null, 4, 0.1, 0.3)).toBe("n/a");
  });
});

describe("comparePerf", () => {
  it("compares every metric, mouse off and on", () => {
    const rows = comparePerf(report("main", 8, 6), report("branch", 8, 0.4));
    const cpuOn = rows.find((r) => r.hover === "on" && r.metric === "cpu median");
    expect(cpuOn).toMatchObject({ before: 6, after: 0.4, verdict: "better" });
    expect(rows.filter((r) => r.verdict === "worse")).toEqual([]);
  });
  it("gives the change in percent", () => {
    const rows = comparePerf(report("a", 10, 1), report("b", 12, 1));
    expect(rows.find((r) => r.hover === "off" && r.metric === "gpu median")?.deltaPercent).toBeCloseTo(20);
  });
  it("skips a scene that failed in either run", () => {
    const broken = report("b", 8, 1);
    broken.scenes.orrery.error = "WebGL lost";
    expect(comparePerf(report("a", 8, 1), broken)).toEqual([]);
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

  it("is clean when nothing got worse and every image is identical", () => {
    expect(hasRegression(comparePerf(report("a", 8, 6), report("b", 8, 0.4)), [same])).toBe(false);
  });
  it("is a regression when a metric got worse", () => {
    expect(hasRegression(comparePerf(report("a", 8, 1), report("b", 12, 1)), [same])).toBe(true);
  });
  it("is a regression when one pixel changed, or an image is missing", () => {
    expect(hasRegression([], [visualVerdict("a.png", { changed: 1, total: 4, maxDelta: 30 })])).toBe(true);
    expect(hasRegression([], [visualVerdict("a.png", null)])).toBe(true);
  });
  it("writes it all as a markdown report", () => {
    const before = report("main", 8, 6);
    const after = report("branch", 8, 0.4);
    const md = toMarkdown(before, after, comparePerf(before, after), [same]);
    expect(md).toContain("✅ no regression");
    expect(md).toContain("| orrery | on | cpu median | 6.00 | 0.40 | -93.3 % | ✅ better |");
    expect(md).toContain("| orrery.png | 0 / 4 | 1 | ✅ identical |");
  });
});
