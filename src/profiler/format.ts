import type { Report } from "./profiler";

// One line of the panel; missing: not measured (yet), shown dimmer
// warning: over budget, shown in signal
export type Row = {
  label: string;
  value: string;
  missing?: boolean;
  warning?: boolean;
};

const ms = (x: number) => x.toFixed(1); // 16.66 → "16.7"
const NONE: Omit<Row, "label"> = { value: "—", missing: true };

// The budgets of a 60 fps frame (16.7 ms)
const LOW_FPS = 55; // under: visibly not smooth (60 Hz wobbles between 59 and 60)
const SLOW_FRAME_P95_MS = 20; // over: 1 frame in 20 misses the screen
const HEAVY_GPU_MS = 12; // over: the GPU uses 3/4 of the frame, no room left
const SLOW_SHADER_MS = 500; // over: typing feels stuck
const BUSY_CPU_MS = 4; // over: the draw call waits for something (the GPU, most of the time)

export function reportRows(report: Report): Row[] {
  const { frame, fps, gpu, cpu, resolution, shaderMs } = report;
  const { width, height } = resolution;
  return [
    fps === null
      ? { label: "fps", ...NONE }
      : {
          label: "fps",
          value: String(Math.round(fps)),
          warning: fps < LOW_FPS,
        },

    frame === null
      ? { label: "frame", ...NONE }
      : {
          label: "frame",
          value: `${ms(frame.medianMs)} ms · p95 ${ms(frame.p95Ms)} · p99 ${ms(frame.p99Ms)}`,
          warning: frame.p95Ms > SLOW_FRAME_P95_MS,
        },

    gpu === "unavailable"
      ? { label: "gpu", value: "unavailable", missing: true }
      : gpu === null
        ? { label: "gpu", value: "waiting…", missing: true }
        : {
            label: "gpu",
            value: `${ms(gpu.medianMs)} ms · p95 ${ms(gpu.p95Ms)}`,
            warning: gpu.medianMs > HEAVY_GPU_MS,
          },

    cpu === null
      ? { label: "cpu", ...NONE }
      : {
          label: "cpu",
          value: `${ms(cpu.medianMs)} ms · p95 ${ms(cpu.p95Ms)}`,
          warning: cpu.medianMs > BUSY_CPU_MS,
        },

    {
      label: "pixels",
      value: `${width} × ${height} · ${((width * height) / 1_000_000).toFixed(1)} MP`,
    },

    shaderMs === null
      ? { label: "shader", ...NONE }
      : {
          label: "shader",
          value: `${Math.round(shaderMs)} ms`,
          warning: shaderMs > SLOW_SHADER_MS,
        },
  ];
}
