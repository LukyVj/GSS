import { between, cells, lines, path, playing, round, says, stage, text } from "./figure-kit";
import { REST_VIEW, ball, type Frame } from "./hairline";

// The colors: the only figures with colors of their own, each one written the way the page
// writes it, so the browser shows the very color the function gives.

const STAGE: Frame = { width: 380, height: 200, scale: 1, x: 0, y: 0 };
const CELL: Frame = { width: 132, height: 132, scale: 62, x: 66, y: 66 };
const chip = (x: number, y: number, color: string, r = 9, kind = "") => `<circle class="chip${kind ? ` ${kind}` : ""}" cx="${round(x)}" cy="${round(y)}" r="${r}" style="--c: ${color}"/>`;
const around = (cx: number, cy: number, radius: number, degrees: number) => [cx + radius * Math.sin((degrees * Math.PI) / 180), cy - radius * Math.cos((degrees * Math.PI) / 180)];
const sphere = (frame: Frame) => lines(ball(REST_VIEW, 0.6), frame);

// color: one sphere, three ways to write a color
export const color = () =>
  stage({ ...STAGE, scale: 110, x: 190, y: 100 }, `<g class="hued">${sphere({ ...STAGE, scale: 110, x: 190, y: 100 })}</g>`) +
  playing(["color: #ff5a36;", "color: rgb(79 140 255);", "color: mediumseagreen;"]);

// currentColor: what follows the color of the object, whatever it is
export const currentColor = () => {
  const frame: Frame = { ...STAGE, scale: 100, x: 190, y: 100 };
  return stage(frame, `<g class="hued">${sphere(frame)}<circle class="shell" cx="190" cy="100" r="74"/></g>`) + says("outline-color: currentColor;");
};

// rgb(): three channels, from 0 to 255
export function rgb(): string {
  const [from, to] = [[255, 90, 54], [79, 140, 255]];
  const [start, width] = [110, 170];
  const lanes = ["red", "green", "blue"]
    .map((name, i) => {
      const y = 56 + i * 40;
      const [a, b] = [start + (from[i] / 255) * width, start + (to[i] / 255) * width];
      return (
        text(start - 16, y, name, "lane-label") +
        path("guide", `M${start} ${y}H${start + width}`) +
        path("mark", `M${start} ${y - 4}v8M${start + width} ${y - 4}v8`) +
        `<g class="shifts" style="--dx: ${round(b - a)}px"><circle class="dot" cx="${round(a)}" cy="${y}" r="5"/></g>`
      );
    })
    .join("");
  const result = `<circle class="chip blends" cx="326" cy="96" r="20" style="--a: rgb(${from.join(" ")}); --b: rgb(${to.join(" ")})"/>`;
  return stage(STAGE, lanes + result) + between(`rgb(${from.join(" ")})`, `rgb(${to.join(" ")})`);
}

// hsl(): the hue is an angle on the color wheel
export function hsl(): string {
  const [cx, cy, radius] = [190, 100, 70];
  const wheel = Array.from({ length: 24 }, (_, i) => {
    const [a, b] = [around(cx, cy, radius - 8, i * 15), around(cx, cy, radius, i * 15)];
    return `<path d="M${round(a[0])} ${round(a[1])}L${round(b[0])} ${round(b[1])}" style="stroke: hsl(${i * 15} 100% 60%)"/>`;
  }).join("");
  const hand = `<g class="turns" style="transform-origin: ${cx}px ${cy}px">${path("edge", `M${cx} ${cy}V${cy - radius + 14}`)}</g>`;
  return (
    stage(STAGE, wheel + hand + `<circle class="chip wheels" cx="${cx}" cy="${cy}" r="14"/>` + text(cx, cy - radius - 12, "0") + text(cx + radius + 16, cy, "90") + text(cx, cy + radius + 12, "180") + text(cx - radius - 18, cy, "270")) +
    says("hsl(<hue> 100% 60%)")
  );
}

// hwb(): a hue, then white, then black mixed into it
export function hwb(): string {
  const mixed = (white: number, black: number) =>
    chip(66, 56, `hwb(15 ${white}% ${black}%)`, 30) +
    text(30, 106, "white", "plot-label") +
    path("guide", "M66 106H116") +
    path("tint", `M66 106H${66 + white / 2}`) +
    text(30, 120, "black", "plot-label") +
    path("guide", "M66 120H116") +
    path("tint", `M66 120H${66 + black / 2}`);
  return cells("figure-steps", [["hwb(15 0% 0%)", mixed(0, 0)], ["hwb(15 50% 0%)", mixed(50, 0)], ["hwb(15 0% 50%)", mixed(0, 50)]], CELL);
}

// lab() and lch(): the same plane, read by its two axes or by an angle and a distance
export function lab(): string {
  const [cx, cy, radius] = [190, 100, 62];
  const axes =
    path("guide", `M${cx - radius - 14} ${cy}H${cx + radius + 14}M${cx} ${cy - radius - 14}V${cy + radius + 14}`) +
    chip(cx - radius - 24, cy, "lab(65 -70 0)", 6) +
    chip(cx + radius + 24, cy, "lab(65 70 0)", 6) +
    chip(cx, cy + radius + 24, "lab(65 0 -70)", 6) +
    chip(cx, cy - radius - 24, "lab(65 0 70)", 6) +
    text(cx + radius + 44, cy, "a") +
    text(cx + 12, cy - radius - 24, "b");
  const ring = Array.from({ length: 12 }, (_, i) => {
    // the hue of lch() turns from +a toward +b
    const [x, y] = [cx + radius * Math.cos((i * 30 * Math.PI) / 180), cy - radius * Math.sin((i * 30 * Math.PI) / 180)];
    return chip(x, y, `lch(65 60 ${i * 30})`, 5);
  }).join("");
  const hand = `<g class="turns back" style="transform-origin: ${cx}px ${cy}px">${path("tint", `M${cx} ${cy}H${cx + radius - 8}`)}</g>`;
  return stage(STAGE, axes + ring + hand + text(cx + 26, cy + 12, "chroma", "axis-label lit")) + `<figcaption><code class="lit">lab(65 a b)</code><code class="lit">lch(65 60 &lt;hue&gt;)</code></figcaption>`;
}

// oklch(): every hue as light as the others, where hsl() goes from dark blue to bright yellow
export function oklch(): string {
  const row = (y: number, name: string, each: (hue: number) => string) =>
    text(96, y, name, "lane-label") + Array.from({ length: 12 }, (_, i) => chip(118 + i * 21, y, each(i * 30), 8)).join("");
  return (
    stage({ ...STAGE, height: 130 }, row(44, "hsl()", (hue) => `hsl(${hue} 100% 50%)`) + row(86, "oklch()", (hue) => `oklch(72% 0.15 ${hue})`)) + says("oklch(72% 0.15 <hue>)")
  );
}

// color(): the same three numbers are another color in each space
export function colorSpace(): string {
  const chips = ["srgb", "srgb-linear", "display-p3", "xyz"]
    .map((space, i) => `<g style="--i: ${i * 3}">${chip(64 + i * 84, 50, `color(${space} 0.95 0.35 0.2)`, 20)}</g>` + text(64 + i * 84, 92, space))
    .join("");
  return stage({ ...STAGE, height: 120 }, chips) + says("color(<space> 0.95 0.35 0.2)");
}

// color-mix(): from all of one color to all of the other
export function colorMix(): string {
  const shares = [100, 75, 50, 25, 0];
  const chips = shares.map((share, i) => chip(70 + i * 60, 56, `color-mix(in oklab, #ff5a36 ${share}%, #4f8cff)`, 18) + text(70 + i * 60, 92, `${share}%`, share === 50 ? "axis-label lit" : "mark-label")).join("");
  return stage({ ...STAGE, height: 120 }, chips) + says("color-mix(in oklab, #ff5a36 50%, #4f8cff)");
}

// light-dark(): one declaration, the color of the mode the system is in
export function lightDark(): string {
  const sun = `<circle class="edge" cx="24" cy="24" r="6"/>` + path("edge", Array.from({ length: 8 }, (_, i) => `M${round(24 + 9 * Math.cos((i * Math.PI) / 4))} ${round(24 + 9 * Math.sin((i * Math.PI) / 4))}L${round(24 + 13 * Math.cos((i * Math.PI) / 4))} ${round(24 + 13 * Math.sin((i * Math.PI) / 4))}`).join(""));
  const moon = path("edge", "M30 14A11 11 0 1 0 34 32A9 9 0 0 1 30 14Z");
  const tinted = (stroke: string) => `<g class="stained" style="--c: ${stroke}">${sphere({ ...CELL, y: 74, scale: 56 })}</g>`;
  return cells("figure-steps", [["light mode", sun + tinted("#9fc4ff")], ["dark mode", moon + tinted("#ffb86b")]], CELL) + says("color: light-dark(#9fc4ff, #ffb86b);");
}

// contrast-color(): black on what is light, white on what is dark
export function contrastColor(): string {
  const on = (paper: string, ink: string) => chip(66, 66, paper, 40) + `<text class="ink" x="66" y="68" style="--c: ${ink}">Aa</text>`;
  return cells("figure-steps", [["contrast-color(#f2efe9)", on("#f2efe9", "black")], ["contrast-color(#1b2a4a)", on("#1b2a4a", "white")]], CELL);
}

const COLORS: Record<string, () => string> = {
  color,
  "fn-currentcolor": currentColor,
  "fn-rgb": rgb,
  "fn-hsl": hsl,
  "fn-hwb": hwb,
  "fn-lab-lch": lab,
  "fn-oklab-oklch": oklch,
  "fn-color": colorSpace,
  "fn-color-mix": colorMix,
  "fn-light-dark": lightDark,
  "fn-contrast-color": contrastColor,
};
export const colors = (subject: string) => COLORS[subject]();
export const COLOR_PAGES = Object.keys(COLORS);
