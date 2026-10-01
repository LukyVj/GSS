import type { Summary } from "../profiler/stats";

// The bench (npm run bench): what it measures, and how two runs are compared.
// Pure functions: the bench page runs diffPixels in the browser, scripts/bench.mjs the rest.

// One measure of a scene, read from the profiler after a few seconds
export type Measure = {
  fps: number | null;
  frame: Summary | null;
  gpu: Summary | null | "unavailable";
  cpu: Summary | null;
};

// One Measure per round: the bench measures each version several times, alternating
export type SceneResult = {
  shaderMs: number | null;
  hoverOff: Measure[]; // the mouse outside the scene
  hoverOn: Measure[]; // the mouse still, over the middle of the scene: :hover is picked every frame
  error?: string; // the scene did not compile or draw
};

export type BenchReport = {
  label: string;
  ref: string; // the commit, "+changes" when the working tree had some
  date: string;
  renderer: string; // the GPU, as WebGL names it
  userAgent: string;
  seconds: number; // how long each measure lasted
  dpr: number; // device pixel ratio of the page: 2 renders 4 times the pixels
  rounds: number; // how many times each version was measured
  scenes: Record<string, SceneResult>;
};

// ----- Performance -----

export type Verdict = "better" | "same" | "worse" | "n/a";

// A metric of a measure. Only the judged ones can make a regression: a p95 over a
// few seconds moves too much between two runs of the same code (shown, not judged).
type Metric = {
  name: string;
  read(measure: Measure): number | null;
  relative: number;
  absolute: number;
  judged: boolean;
};

const gpu = (m: Measure) => (m.gpu && m.gpu !== "unavailable" ? m.gpu : null);

export const METRICS: Metric[] = [
  { name: "gpu median", read: (m) => gpu(m)?.medianMs ?? null, relative: 0.1, absolute: 0.3, judged: true },
  { name: "cpu median", read: (m) => m.cpu?.medianMs ?? null, relative: 0.25, absolute: 0.3, judged: true },
  { name: "frame median", read: (m) => m.frame?.medianMs ?? null, relative: 0.1, absolute: 1, judged: true },
  { name: "gpu p95", read: (m) => gpu(m)?.p95Ms ?? null, relative: 0.15, absolute: 0.5, judged: false },
  { name: "cpu p95", read: (m) => m.cpu?.p95Ms ?? null, relative: 0.25, absolute: 0.5, judged: false },
  { name: "frame p95", read: (m) => m.frame?.p95Ms ?? null, relative: 0.15, absolute: 1, judged: false },
];

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Each side is the value of every round. A change is real when the medians differ
// by more than `relative` AND `absolute` (ms), and the rounds do not overlap: every
// round of one version beats every round of the other. Two versions of the same
// code never pass that test, whatever the noise of the machine.
export function verdict(
  before: number[],
  after: number[],
  relative: number,
  absolute: number,
): Verdict {
  if (before.length === 0 || after.length === 0) return "n/a";
  const b = median(before);
  const a = median(after);
  const floor = Math.max(absolute, b * relative);
  if (a - b > floor && Math.min(...after) > Math.max(...before)) return "worse";
  if (b - a > floor && Math.max(...after) < Math.min(...before)) return "better";
  return "same";
}

export type PerfRow = {
  scene: string;
  hover: "off" | "on";
  metric: string;
  before: number | null; // median of the rounds
  after: number | null;
  beforeRange: [number, number] | null; // the lowest and highest round
  afterRange: [number, number] | null;
  deltaPercent: number | null;
  verdict: Verdict;
  judged: boolean;
};

// Every metric of every scene measured in both runs
export function comparePerf(before: BenchReport, after: BenchReport): PerfRow[] {
  const rows: PerfRow[] = [];
  for (const scene of Object.keys(before.scenes)) {
    const a = before.scenes[scene];
    const b = after.scenes[scene];
    if (!b || a.error || b.error) continue;
    for (const hover of ["off", "on"] as const) {
      const ra = hover === "off" ? a.hoverOff : a.hoverOn;
      const rb = hover === "off" ? b.hoverOff : b.hoverOn;
      for (const metric of METRICS) {
        const xs = values(ra, metric);
        const ys = values(rb, metric);
        const x = xs.length > 0 ? median(xs) : null;
        const y = ys.length > 0 ? median(ys) : null;
        rows.push({
          scene,
          hover,
          metric: metric.name,
          before: x,
          after: y,
          beforeRange: range(xs),
          afterRange: range(ys),
          deltaPercent: x !== null && y !== null && x > 0 ? (100 * (y - x)) / x : null,
          verdict: verdict(xs, ys, metric.relative, metric.absolute),
          judged: metric.judged,
        });
      }
    }
  }
  return rows;
}

// The value of a metric in every round where it was measured
const values = (rounds: Measure[], metric: Metric) =>
  rounds.map((m) => metric.read(m)).filter((x): x is number => x !== null);
const range = (xs: number[]): [number, number] | null =>
  xs.length > 0 ? [Math.min(...xs), Math.max(...xs)] : null;

// ----- Rendering -----

export type PixelDiff = { changed: number; total: number; maxDelta: number };

// Two RGBA images of the same size, pixel by pixel. A pixel has changed when one of
// its channels moved by more than `tolerance` (0-255). `out`, if given, receives an
// image of the differences: changed pixels in red, the others as a dim grey of `a`.
export function diffPixels(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  tolerance = 2,
  out?: Uint8ClampedArray,
): PixelDiff {
  const total = a.length / 4;
  if (a.length !== b.length) return { changed: total, total, maxDelta: 255 };
  let changed = 0;
  let maxDelta = 0;
  for (let i = 0; i < a.length; i += 4) {
    const delta = Math.max(
      Math.abs(a[i] - b[i]),
      Math.abs(a[i + 1] - b[i + 1]),
      Math.abs(a[i + 2] - b[i + 2]),
      Math.abs(a[i + 3] - b[i + 3]),
    );
    if (delta > maxDelta) maxDelta = delta;
    const isChanged = delta > tolerance;
    if (isChanged) changed++;
    if (out) {
      const grey = (a[i] + a[i + 1] + a[i + 2]) / 12; // a quarter of the brightness
      out[i] = isChanged ? 255 : grey;
      out[i + 1] = isChanged ? 0 : grey;
      out[i + 2] = isChanged ? 0 : grey;
      out[i + 3] = 255;
    }
  }
  return { changed, total, maxDelta };
}

export type VisualRow = PixelDiff & {
  image: string;
  verdict: "identical" | "changed" | "missing";
};

export function visualVerdict(image: string, diff: PixelDiff | null): VisualRow {
  if (!diff) return { image, changed: 0, total: 0, maxDelta: 0, verdict: "missing" };
  return { image, ...diff, verdict: diff.changed === 0 ? "identical" : "changed" };
}

// ----- The report -----

export function hasRegression(perf: PerfRow[], visual: VisualRow[]): boolean {
  return (
    perf.some((row) => row.judged && row.verdict === "worse") ||
    visual.some((row) => row.verdict !== "identical")
  );
}

const num = (x: number | null) => (x === null ? "—" : x.toFixed(2));
const spread = (r: [number, number] | null) =>
  r === null || r[0] === r[1] ? "" : ` <sub>${r[0].toFixed(2)}–${r[1].toFixed(2)}</sub>`;
const pct = (x: number | null) => (x === null ? "—" : `${x > 0 ? "+" : ""}${x.toFixed(1)} %`);
const MARK: Record<Verdict, string> = { better: "✅ better", same: "same", worse: "❌ worse", "n/a": "n/a" };

export function toMarkdown(
  before: BenchReport,
  after: BenchReport,
  perf: PerfRow[],
  visual: VisualRow[],
): string {
  const lines = [
    `# Bench: ${before.label} → ${after.label}`,
    "",
    `- before: \`${before.ref}\` (${before.date})`,
    `- after: \`${after.ref}\` (${after.date})`,
    `- GPU: ${after.renderer}`,
    `- ${after.rounds} round(s) per version, alternating; ${after.seconds} s per measure; dpr ${after.dpr}; times in ms`,
    "- before / after: the median of the rounds, then the lowest and highest round",
    "- only the medians are judged; the p95 are shown for information",
    ...(before.dpr !== after.dpr
      ? [`- ⚠️ not comparable: dpr ${before.dpr} before, ${after.dpr} after`]
      : []),
    "",
    `**${hasRegression(perf, visual) ? "❌ regression" : "✅ no regression"}**`,
    "",
    "## Performance",
    "",
    "| scene | hover | metric | before | after | Δ | verdict |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...perf.map(
      (r) =>
        `| ${r.scene} | ${r.hover} | ${r.metric} | ${num(r.before)}${spread(r.beforeRange)} | ${num(r.after)}${spread(r.afterRange)} | ${pct(r.deltaPercent)} | ${r.judged ? MARK[r.verdict] : `info: ${r.verdict}`} |`,
    ),
    "",
    "## Rendering",
    "",
    "| image | changed pixels | max Δ | verdict |",
    "| --- | --- | --- | --- |",
    ...visual.map(
      (r) =>
        `| ${r.image} | ${r.changed} / ${r.total} | ${r.maxDelta} | ${r.verdict === "identical" ? "✅ identical" : `❌ ${r.verdict}`} |`,
    ),
  ];
  const errors = Object.entries(after.scenes).filter(([, s]) => s.error);
  if (errors.length > 0) {
    lines.push("", "## Errors", "", ...errors.map(([name, s]) => `- ${name}: ${s.error}`));
  }
  return lines.join("\n") + "\n";
}
