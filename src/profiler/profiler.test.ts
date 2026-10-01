import { describe, it, expect } from "vitest";
import { createProfiler } from "./profiler";
import type { GpuTimer } from "./gpu-timer";

// A fake GPU timer: the test decides what collect() returns
function fakeTimer(available = true) {
  const calls: string[] = [];
  let ready: number[] = [];
  const timer: GpuTimer = {
    available,
    begin: () => void calls.push("begin"),
    end: () => void calls.push("end"),
    collect: () => {
      const out = ready;
      ready = [];
      return out;
    },
    destroy: () => {},
  };
  return { timer, calls, gpuReturns: (ms: number[]) => (ready = ms) };
}

const frames = (p: ReturnType<typeof createProfiler>, times: number[]) =>
  times.forEach((now) => p.frameStart(now, 1600, 900));

describe("createProfiler", () => {
  it("measures the time between two frames, not the first one", () => {
    const profiler = createProfiler(fakeTimer().timer);
    frames(profiler, [0, 16, 32, 50]);
    const { frame } = profiler.report();
    expect(frame?.count).toBe(3);
    expect(frame?.medianMs).toBe(16);
  });

  it("gives the fps from the mean frame time", () => {
    const profiler = createProfiler(fakeTimer().timer);
    frames(profiler, [0, 20, 40]);
    expect(profiler.report().fps).toBe(50);
  });

  it("has no fps before two frames", () => {
    const profiler = createProfiler(fakeTimer().timer);
    frames(profiler, [0]);
    expect(profiler.report().fps).toBeNull();
  });

  it("times the draw on the GPU, and keeps what comes back", () => {
    const fake = fakeTimer();
    const profiler = createProfiler(fake.timer);
    profiler.drawStart();
    fake.gpuReturns([4, 6]);
    profiler.drawEnd();
    expect(fake.calls).toEqual(["begin", "end"]);
    expect(profiler.report().gpu).toMatchObject({ count: 2, medianMs: 4 });
  });

  it('says "unavailable" without the extension, never 0 ms', () => {
    const profiler = createProfiler(fakeTimer(false).timer);
    expect(profiler.report().gpu).toBe("unavailable");
  });

  it("gives the real resolution, in canvas pixels", () => {
    const profiler = createProfiler(fakeTimer().timer);
    profiler.frameStart(0, 2400, 1350);
    expect(profiler.report().resolution).toEqual({ width: 2400, height: 1350 });
  });

  it("starts over on a new shader, without counting the frame the compile froze", () => {
    const fake = fakeTimer();
    const profiler = createProfiler(fake.timer);
    frames(profiler, [0, 16]);
    profiler.drawStart();
    fake.gpuReturns([5]);
    profiler.drawEnd();
    profiler.shaderBuilt(120);
    frames(profiler, [400, 416]); // 400 - 16 would be a fake 384 ms frame
    const report = profiler.report();
    expect(report.frame?.count).toBe(1);
    expect(report.frame?.medianMs).toBe(16);
    expect(report.gpu).toBeNull(); // no GPU sample yet for this shader
    expect(report.shaderMs).toBe(120);
  });

  it("keeps only the last 300 frames", () => {
    const profiler = createProfiler(fakeTimer().timer);
    frames(
      profiler,
      Array.from({ length: 400 }, (_, i) => i * 16),
    );
    expect(profiler.report().frame?.count).toBe(300);
  });
});
