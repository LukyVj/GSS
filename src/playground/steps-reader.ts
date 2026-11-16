import { STEPS_MAX, STEPS_RAMP } from "../compiler/shader/codegen/debug";

// view: steps (decision 204): the debug panel reads the render back into numbers. The shader
// colors each pixel by its calls of map() along a ramp; the panel samples the canvas just after
// a frame is drawn, and gives each pixel the count whose color is nearest to it.

export { STEPS_MAX };

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k);

// The color of a count, as stepsColor() of the shader computes it
export function stepsColor(steps: number): number[] {
  const x = Math.min(Math.max(steps / STEPS_MAX, 0), 1);
  let c = mix(STEPS_RAMP[0], STEPS_RAMP[1], smoothstep(0, 0.25, x));
  c = mix(c, STEPS_RAMP[2], smoothstep(0.25, 0.5, x));
  c = mix(c, STEPS_RAMP[3], smoothstep(0.5, 0.75, x));
  return mix(c, STEPS_RAMP[4], smoothstep(0.75, 1, x)).map((v) => +v.toFixed(6));
}

// Every count as it lands in a canvas, 0 to 255
const COLORS = Array.from({ length: STEPS_MAX + 1 }, (_, n) => stepsColor(n).map((c) => Math.round(c * 255)));
// Further than this from every color of the ramp, a pixel is something else: an axis, a line of
// the grid, a letter
const NEAR = 12 * 12;

export type Steps = { mean: number; max: number; hot: number; pixels: number }; // hot: the share at STEPS_MAX

// RGBA pixels → the counts of those on the ramp
export function readSteps(data: Uint8ClampedArray): Steps | null {
  let sum = 0;
  let max = 0;
  let hot = 0;
  let pixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 255) continue;
    let best = -1;
    let nearest = NEAR + 1;
    for (let n = 0; n <= STEPS_MAX; n++) {
      const [r, g, b] = COLORS[n];
      const d = (data[i] - r) ** 2 + (data[i + 1] - g) ** 2 + (data[i + 2] - b) ** 2;
      if (d <= nearest) { // the last of equal colors: the top of the ramp reads as its top
        nearest = d;
        best = n;
      }
    }
    if (best < 0) continue;
    sum += best;
    max = Math.max(max, best);
    if (best === STEPS_MAX) hot++;
    pixels++;
  }
  return pixels === 0 ? null : { mean: sum / pixels, max, hot: hot / pixels, pixels };
}

// The canvas of the scene, sampled at most twice a second, just after a frame (drawn() is
// called then: a canvas reads empty outside the frame that drew it)
const WIDTH = 160;

export function createStepsReader(canvas: HTMLCanvasElement) {
  const copy = document.createElement("canvas");
  const context = copy.getContext("2d", { willReadFrequently: true });
  let last = 0;
  let steps: Steps | null = null;
  return {
    drawn(now = performance.now()): void {
      if (!context || now - last < 500 || canvas.width === 0) return;
      last = now;
      copy.width = WIDTH;
      copy.height = Math.max(1, Math.round((WIDTH * canvas.height) / canvas.width));
      context.imageSmoothingEnabled = false; // a pixel of the render, never a blend of several
      context.drawImage(canvas, 0, 0, copy.width, copy.height);
      steps = readSteps(context.getImageData(0, 0, copy.width, copy.height).data);
    },
    steps: () => steps,
  };
}
