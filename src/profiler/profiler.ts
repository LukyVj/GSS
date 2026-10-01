import { summarize, createSamples, type Summary } from "./stats";
import type { GpuTimer } from "./gpu-timer";

// What view.ts tells the profiler (wired in step 4)
export type FrameProbe = {
  frameStart(now: number, width: number, height: number): void;
  drawStart(): void;
  drawEnd(): void;
  shaderBuilt(ms: number): void; // GLSL compile + link, in ms
};

export type Report = {
  frame: Summary | null; // time between two frames
  fps: number | null;
  gpu: Summary | null | "unavailable";
  resolution: { width: number; height: number };
  shaderMs: number | null;
};

const CAPACITY = 300; // about 5 s at 60 fps

export function createProfiler(
  timer: GpuTimer,
): FrameProbe & { report(): Report } {
  const intervals = createSamples(CAPACITY);
  const gpu = createSamples(CAPACITY);
  let last: number | null = null; // the start of the previous frame
  let resolution = { width: 0, height: 0 };
  let shaderMs: number | null = null;

  return {
    frameStart(now, width, height) {
      if (last !== null) intervals.push(now - last);
      last = now;
      resolution = { width, height };
    },

    drawStart() {
      timer.begin();
    },

    drawEnd() {
      timer.end();
      timer.collect().forEach((ms) => gpu.push(ms));
    },

    shaderBuilt(ms) {
      shaderMs = ms;
      intervals.clear();
      gpu.clear();
      last = null; // the next frame starts a new count
    },

    report() {
      const frame = summarize(intervals.values());
      return {
        frame,
        fps: frame ? 1000 / frame.meanMs : null,
        gpu: timer.available ? summarize(gpu.values()) : "unavailable",
        resolution,
        shaderMs,
      };
    },
  };
}
