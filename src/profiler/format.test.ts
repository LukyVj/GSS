import { describe, it, expect } from "vitest";
import { reportRows } from "./format.ts";
import type { Report } from "./profiler";

const summary = (medianMs: number, p95Ms: number, p99Ms: number) => ({
  count: 100,
  meanMs: medianMs,
  medianMs,
  p95Ms,
  p99Ms,
  warning: false,
});
const report: Report = {
  frame: summary(16.66, 18.21, 25.08),
  fps: 59.6,
  gpu: summary(4.24, 5.12, 7.9),
  cpu: summary(0.31, 0.52, 0.9),
  resolution: { width: 2400, height: 1350 },
  shaderMs: 142.4,
};
const value = (r: Report, label: string) =>
  reportRows(r).find((row) => row.label === label);

describe("reportRows", () => {
  it("lists fps, frame, gpu, cpu, pixels and shader, in that order", () => {
    expect(reportRows(report).map((row) => row.label)).toEqual([
      "fps",
      "frame",
      "gpu",
      "cpu",
      "pixels",
      "shader",
    ]);
  });
  it("rounds the fps", () => {
    expect(value(report, "fps")?.value).toBe("60");
  });
  it("gives the frame time as median, p95 and p99, one decimal", () => {
    expect(value(report, "frame")?.value).toBe("16.7 ms · p95 18.2 · p99 25.1");
  });
  it("gives the CPU time of the draw as median and p95", () => {
    expect(value(report, "cpu")?.value).toBe("0.3 ms · p95 0.5");
  });
  it("warns when the draw keeps the CPU more than 4 ms: it is waiting for something", () => {
    expect(value({ ...report, cpu: summary(6, 8, 9) }, "cpu")?.warning).toBe(true);
    expect(value(report, "cpu")?.warning).toBe(false);
  });
  it("gives the GPU time as median and p95", () => {
    expect(value(report, "gpu")?.value).toBe("4.2 ms · p95 5.1");
  });
  it("says unavailable without the extension, and marks it missing", () => {
    expect(value({ ...report, gpu: "unavailable" }, "gpu")).toEqual({
      label: "gpu",
      value: "unavailable",
      missing: true,
    });
  });
  it("says waiting before the first GPU result", () => {
    expect(value({ ...report, gpu: null }, "gpu")).toEqual({
      label: "gpu",
      value: "waiting…",
      missing: true,
    });
  });
  it("gives the real pixels, and how many millions", () => {
    expect(value(report, "pixels")?.value).toBe("2400 × 1350 · 3.2 MP");
  });
  it("gives the shader build time, rounded", () => {
    expect(value(report, "shader")?.value).toBe("142 ms");
  });
  it("shows a dash for what is not measured yet", () => {
    const empty: Report = { ...report, frame: null, fps: null, shaderMs: null };
    expect(value(empty, "fps")).toEqual({
      label: "fps",
      value: "—",
      missing: true,
    });
    expect(value(empty, "frame")?.value).toBe("—");
    expect(value(empty, "shader")?.value).toBe("—");
  });
});

describe("reportRows warnings", () => {
  const warns = (r: Report, label: string) => value(r, label)?.warning === true;

  it("warns under 55 fps, not at 59: a 60 Hz screen wobbles", () => {
    expect(warns({ ...report, fps: 50 }, "fps")).toBe(true);
    expect(warns({ ...report, fps: 59 }, "fps")).toBe(false);
  });
  it("warns when 5% of the frames take more than 20 ms", () => {
    expect(warns({ ...report, frame: summary(16.7, 21, 30) }, "frame")).toBe(
      true,
    );
    expect(warns(report, "frame")).toBe(false); // 16.7 ms is a normal 60 fps frame
  });
  it("warns when the GPU needs more than 12 ms: three quarters of a 60 fps frame", () => {
    expect(warns({ ...report, gpu: summary(12.5, 14, 15) }, "gpu")).toBe(true);
    expect(warns(report, "gpu")).toBe(false);
  });
  it("warns when a shader takes more than 500 ms to build", () => {
    expect(warns({ ...report, shaderMs: 600 }, "shader")).toBe(true);
    expect(warns(report, "shader")).toBe(false);
  });
  it("never warns about what is not measured", () => {
    expect(warns({ ...report, gpu: "unavailable" }, "gpu")).toBe(false);
    expect(warns({ ...report, fps: null }, "fps")).toBe(false);
  });
});
