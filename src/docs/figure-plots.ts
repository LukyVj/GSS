import { path, round, says, stage, text } from "./figure-kit";
import type { Frame } from "./hairline";

// The math functions as curves: what comes out for what goes in, the first curve in signal
// with a point that runs along it.

type Curve = { f: (x: number) => number; label: string; from?: number; to?: number };
type Plot = { code: string; curves: Curve[]; x: [number, number, string, string]; y: [number, number, string, string] };

const { PI } = Math;
const degrees = (radians: number) => (radians * 180) / PI;

const PLOTS: Record<string, Plot> = {
  "fn-trig": {
    code: "translate: cos(<angle>) sin(<angle>) 0;",
    curves: [
      { f: Math.sin, label: "sin()" },
      { f: Math.cos, label: "cos()" },
    ],
    x: [0, 2 * PI, "0", "1turn"],
    y: [-1, 1, "-1", "1"],
  },
  "fn-inverse-trig": {
    code: "rotate-z: atan2(<y>, <x>);",
    curves: [
      { f: (x) => degrees(Math.asin(x)), label: "asin()" },
      { f: (x) => degrees(Math.acos(x)), label: "acos()" },
      { f: (x) => degrees(Math.atan(x)), label: "atan()" },
    ],
    x: [-1, 1, "-1", "1"],
    y: [-90, 180, "-90deg", "180deg"],
  },
  "fn-min-max-clamp": {
    code: "scale: clamp(0.25, var(--size), 0.75);",
    curves: [
      { f: (x) => Math.min(0.75, Math.max(0.25, x)), label: "clamp()" },
      { f: (x) => x, label: "the value" },
    ],
    x: [0, 1, "0", "1"],
    y: [0, 1, "0", "1"],
  },
  "fn-abs-sqrt-pow": {
    code: "scale: pow(2, sibling-index());",
    curves: [
      { f: Math.abs, label: "abs()" },
      { f: (x) => x * x, label: "pow(x, 2)" },
      { f: Math.sqrt, label: "sqrt()", from: 0 },
    ],
    x: [-1, 1, "-1", "1"],
    y: [0, 1, "0", "1"],
  },
  "fn-stepped": {
    code: "rotate-y: round(var(--angle), 15deg);",
    curves: [
      { f: (x) => Math.round(x / 0.25) * 0.25, label: "round(x, 0.25)" },
      { f: (x) => x % 0.5, label: "mod(x, 0.5)" },
    ],
    x: [0, 1, "0", "1"],
    y: [0, 1, "0", "1"],
  },
  "fn-exponential": {
    code: "scale: exp(sibling-index() / 4);",
    curves: [
      { f: Math.exp, label: "exp()" },
      { f: Math.log, label: "log()", from: 0.4 },
    ],
    x: [0, 2, "0", "2"],
    y: [-1, 7.4, "-1", "e²"],
  },
};

export function plot(subject: string): string {
  const { code, curves, x, y } = PLOTS[subject];
  const frame: Frame = { width: 380, height: 210, scale: 1, x: 0, y: 0 };
  const [left, top, width, height] = [70, 26, 200, 140];
  const at = (px: number, py: number) => `${round(left + ((px - x[0]) / (x[1] - x[0])) * width)} ${round(top + height - ((py - y[0]) / (y[1] - y[0])) * height)}`;
  const kinds = ["tint", "edge", "guide"];
  const drawn = curves.map(({ f, label, from = x[0], to = x[1] }, i) => {
    // A step is drawn as a step: no slope between two samples that jump
    const samples = Array.from({ length: 161 }, (_, k) => from + ((to - from) * k) / 160).map((px) => [px, f(px)] as const);
    let line = "";
    samples.forEach(([px, py], k) => {
      const jump = k > 0 && Math.abs(py - samples[k - 1][1]) > (y[1] - y[0]) * 0.12;
      line += `${k === 0 || jump ? "M" : "L"}${at(px, py)}`;
    });
    const [endX, endY] = samples[samples.length - 1];
    const [nameX, nameY] = at(endX, endY).split(" ").map(Number);
    return { line, label, kind: kinds[i], nameX, nameY };
  });
  // The names of two curves that end at the same place go one under the other
  const named = [...drawn].sort((a, b) => a.nameY - b.nameY);
  named.forEach((curve, i) => {
    if (i > 0) curve.nameY = Math.max(curve.nameY, named[i - 1].nameY + 13);
  });
  const curvesMarkup = drawn
    .map(({ line, label, kind, nameX, nameY }, i) => path(kind, line) + text(nameX + 8, nameY, label, `plot-label${i === 0 ? " lit" : ""}`))
    .join("");
  const zero = y[0] < 0 && y[1] > 0 ? path("ground", `M${at(x[0], 0)}L${at(x[1], 0)}`) : "";
  const box =
    path("ground", `M${left} ${top}V${top + height}H${left + width}V${top}Z`) +
    zero +
    text(left, top + height + 14, x[2]) +
    text(left + width, top + height + 14, x[3]) +
    text(left - 20, top + height, y[2]) +
    text(left - 20, top, y[3]);
  const rider = `<g class="travels rides" style="offset-path: path('${drawn[0].line}')"><circle class="dot" r="3.5"/></g>`;
  return stage(frame, box + curvesMarkup + rider) + says(code);
}
export const PLOT_PAGES = Object.keys(PLOTS);

// calc(): a full turn divided by five, and the angle it gives
export function calc(): string {
  const frame: Frame = { width: 380, height: 200, scale: 1, x: 0, y: 0 };
  const [cx, cy, r] = [190, 100, 70];
  const spoke = (i: number) => {
    const angle = (i / 5) * 2 * PI - PI / 2;
    return [round(cx + Math.cos(angle) * r), round(cy + Math.sin(angle) * r)];
  };
  const spokes = [0, 1, 2, 3, 4].map((i) => `M${cx} ${cy}L${spoke(i).join(" ")}`).join("");
  const [a, b] = [spoke(0), spoke(1)];
  const drawing =
    `<circle class="guide" cx="${cx}" cy="${cy}" r="${r}"/>` +
    path("guide", spokes) +
    `<g class="sweeps" style="transform-origin: ${cx}px ${cy}px">${path("tint", `M${cx} ${cy}L${a.join(" ")}A${r} ${r} 0 0 1 ${b.join(" ")}Z`)}</g>` +
    [0, 1, 2, 3, 4].map((i) => `<circle class="dot" cx="${spoke(i)[0]}" cy="${spoke(i)[1]}" r="3"/>`).join("") +
    text(cx + 44, cy - 34, "72deg", "axis-label lit");
  return stage(frame, drawing) + says("rotate-y: calc(360deg / 5 * sibling-index());");
}
