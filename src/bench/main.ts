import { createRenderer } from "../runtime/renderer";
import { createProfiler } from "../profiler/profiler";
import { createGpuTimer } from "../profiler/gpu-timer";
import { diffPixels } from "./compare";

// The bench page (bench.html), driven by scripts/bench.mjs through window.__bench.
//   ?scene=orrery&mode=still  time stands at 0: the same image every run, for the visual diff
//   ?scene=orrery&mode=run    the scene lives (animations, spin): for the timings
//   ?mode=diff                no scene: compares two PNGs (diffPixels) in the browser

// The scenes are in src/scenes/; the old folders are read too, so that a commit made
// before the move can still be benched (the bench is copied into its worktree)
const SOURCES = import.meta.glob<string>(
  [
    "../scene.gss",
    "../scenes/*.gss",
    "../playground/*.gss",
    "../showcase/scenes/*.gss",
  ],
  { query: "?raw", import: "default", eager: true },
);
// "../scenes/orrery.gss" → "orrery"
const SCENES: Record<string, string> = Object.fromEntries(
  Object.entries(SOURCES).map(([path, code]) => [
    path.split("/").pop()!.replace(/\.gss$/, ""),
    code,
  ]),
);

const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "run";

type Bench = Record<string, unknown> & { ready: boolean; error: string | null };
const bench: Bench = { ready: false, error: null, scenes: Object.keys(SCENES) };
(window as unknown as { __bench: Bench }).__bench = bench;

// n frames drawn from now
bench.frames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = () => (--n <= 0 ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });

if (mode === "diff") {
  bench.diff = diff;
  bench.ready = true;
} else {
  const name = params.get("scene") ?? "";
  const source = SCENES[name];
  let profiler: ReturnType<typeof createProfiler> | null = null;
  let renderer = "unknown";
  let view: ReturnType<typeof createRenderer> | null = null;
  const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
  try {
    if (source === undefined) throw new Error(`no scene "${name}"`);
    view = createRenderer(canvas, {
      profile: (gl) => {
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        renderer = String(
          gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
        );
        profiler = createProfiler(createGpuTimer(gl));
        return profiler;
      },
    });
    if (mode === "still") view.freeze(true); // before the first frame: time stays at 0
    view.load(source);
  } catch (error) {
    bench.error = error instanceof Error ? error.message : String(error);
  }
  bench.renderer = () => renderer;
  bench.report = () => profiler?.report() ?? null;
  bench.reset = () => profiler?.reset();
  // A screenshot needs a quiet page: paused, the last frame stays on the canvas
  bench.pause = () => view?.pause();
  bench.play = () => view?.play();
  bench.ready = true;
}

// Two PNGs (data URLs) of the same size → how many pixels changed, and an image of them
async function diff(before: string, after: string, tolerance = 2) {
  const [a, b] = await Promise.all([pixels(before), pixels(after)]);
  const canvas = document.createElement("canvas");
  canvas.width = a.width;
  canvas.height = a.height;
  const out = new ImageData(a.width, a.height);
  const result =
    a.width === b.width && a.height === b.height
      ? diffPixels(a.data, b.data, tolerance, out.data)
      : diffPixels(a.data, new Uint8ClampedArray(0));
  canvas.getContext("2d")!.putImageData(out, 0, 0);
  return { ...result, png: result.changed > 0 ? canvas.toDataURL("image/png") : null };
}

async function pixels(url: string): Promise<ImageData> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
