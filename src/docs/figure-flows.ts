import { cells, lines, path, says, stage, text } from "./figure-kit";
import { REST_VIEW, ball, box, floor, moved, type Frame } from "./hairline";

// How things go from one place to another: from a file to the page, from a variable to an
// object, from a mixin to the rules that apply it.

const CELL: Frame = { width: 132, height: 132, scale: 30, x: 66, y: 92 };
const STAGE: Frame = { width: 380, height: 210, scale: 1, x: 0, y: 0 };
const flow = (items: [label: string, art: string][]) => cells("figure-flow", items, CELL);

// --- the pieces

// Lines of code as strokes: where each starts, how long it is, and whether it is the one to see
type Stroke = [indent: number, length: number, tinted?: boolean];
const code = (strokes: Stroke[], x = 30, y = 38, gap = 12) =>
  strokes.map(([indent, length, tinted], i) => path(tinted ? "tint" : "edge", `M${x + indent} ${y + i * gap}h${length}`)).join("");
const sheet = (strokes: Stroke[]) => `<rect class="guide" x="20" y="22" width="92" height="88" rx="4"/>` + code(strokes);
// A scene: a ball that floats over a floor
const scene = (frame: Frame = CELL, kind = "floats", rise = -8) =>
  lines(floor(1.1, 0.55), frame) + `<g class="${kind}" style="--rise: ${rise}px">${lines(moved(ball(REST_VIEW, 0.5), [0, 0.75, 0]), frame)}</g>`;
const terminal = `<rect class="guide" x="16" y="30" width="100" height="72" rx="4"/>` + path("edge", "M16 44H116M28 60l8 6l-8 6") + path("tint", "M44 72h38") + `<rect class="caret" x="86" y="60" width="1" height="13"/>`;
const file = path("edge", "M38 20H82L98 36V112H38ZM82 20V36H98") + code([[0, 34, true], [8, 28], [8, 22], [0, 10]], 48, 56, 12);
const tag = (inside: string) => path("edge", "M40 44L22 66L40 88M92 44L110 66L92 88") + inside;
const frameOf = (x: number, y: number, width: number, height: number) => `<rect class="edge" x="${x}" y="${y}" width="${width}" height="${height}" rx="4"/>` + path("guide", `M${x} ${y + 14}h${width}`);

// --- the guides: from a file to a page

const whyGss = () =>
  flow([
    ["scene.gss", sheet([[0, 36, true], [10, 44], [10, 30], [0, 8], [0, 28, true], [10, 50]])],
    ["one shader", sheet(Array.from({ length: 7 }, (_, i): Stroke => [(i % 3) * 6, 72 - ((i * 17) % 30) - (i % 3) * 6]))],
    ["the GPU draws it", scene()],
  ]);

function embedding(): string {
  const frame: Frame = { ...STAGE, scale: 34, x: 262, y: 150 };
  const page =
    frameOf(40, 24, 300, 166) +
    `<circle class="guide" cx="52" cy="31" r="2"/><circle class="guide" cx="60" cy="31" r="2"/><circle class="guide" cx="68" cy="31" r="2"/>` +
    code([[0, 90], [0, 110], [0, 70], [0, 100], [0, 50]], 60, 64, 16) +
    `<rect class="tint" x="196" y="54" width="130" height="120"/>`;
  return stage(frame, page + scene(frame, "floats", -10)) + says('<gss-scene src="scene.gss"></gss-scene>');
}

const installPackage = () =>
  flow([
    ["npm install gss-lang", terminal],
    ["mount(canvas, source)", sheet([[0, 60], [0, 0], [0, 54, true], [0, 40]])],
    ["a canvas of the page", scene()],
  ]);
const installVite = () =>
  flow([
    ["scene.gss", file],
    ["vite build", `<g class="turns" style="transform-origin: 66px 66px">${path("edge", "M66 36V96M36 66H96M45 45L87 87M87 45L45 87")}</g><circle class="tint" cx="66" cy="66" r="14"/>`],
    ["the scene, compiled", scene()],
  ]);
const installCdn = () =>
  flow([
    ['<script src="embed.js">', tag(path("tint", "M54 66h24"))],
    ["<gss-scene>", tag(`<circle class="tint" cx="66" cy="66" r="10"/>`)],
    ["the scene", scene()],
  ]);

function editorSupport(): string {
  const editor =
    frameOf(60, 22, 260, 168) +
    path("ground", "M92 36V190") +
    [0, 1, 2, 3, 4, 5, 6].map((i) => text(76, 56 + i * 18, String(i + 1), "lane-label middle")).join("") +
    // a rule, colored like the editor colors it: selector, property, value
    [
      ["selector", 104, 46, 0],
      ["property", 120, 60, 1],
      ["value", 186, 50, 1],
      ["property", 120, 44, 2],
      ["value", 170, 80, 2],
      ["selector", 104, 8, 3],
      ["selector", 104, 70, 5],
      ["property", 120, 76, 6],
    ]
      .map(([kind, x, width, line]) => `<path class="syntax ${kind}" d="M${x} ${56 + Number(line) * 18}h${width}"/>`)
      .join("") +
    `<rect class="caret" x="204" y="${56 + 6 * 18 - 7}" width="1" height="14"/>`;
  return stage(STAGE, editor) + says("scene.gss");
}

// --- a variable: one value, read by the scene, set by the page

function variable(code: string, panel = false): (subject: string) => string {
  return () => {
    const frame: Frame = { ...STAGE, scale: 40, x: 290, y: 160 };
    const [start, width, y] = [44, 110, panel ? 78 : 104];
    const slider =
      path("guide", `M${start} ${y}H${start + width}`) +
      `<g class="shifts" style="--dx: ${width - 30}px"><circle class="dot" cx="${start + 14}" cy="${y}" r="6"/></g>` +
      text(start + width / 2, y - 22, panel ? "variables · 1" : "--lift", "axis-label lit");
    const box = panel ? `<rect class="edge" x="28" y="36" width="142" height="68" rx="5"/>` + path("guide", "M28 66H170") : "";
    const link = panel ? "" : path("mark", "M176 104H214M208 99l6 5l-6 5");
    const render = panel ? `<rect class="guide" x="16" y="20" width="348" height="172"/>` : "";
    return stage(frame, render + box + slider + link + scene(frame, "rises", -44)) + says(code);
  };
}

function varFigure(): string {
  const frame: Frame = { ...STAGE, scale: 56, x: 0, y: 150 };
  const chip = `<rect class="tint" x="150" y="22" width="80" height="26" rx="13"/>` + text(190, 35, "--size", "axis-label lit");
  const one = `<g class="grows soft" style="transform-origin: 110px 142px">${lines(ball(REST_VIEW, 0.5), { ...frame, x: 110, y: 142 })}</g>`;
  const two = `<g class="grows soft" style="transform-origin: 270px 142px">${lines(box(0.42, 0.42, 0.42), { ...frame, x: 270, y: 142 })}</g>`;
  return stage(frame, chip + path("mark", "M170 50L124 92M210 50L256 92") + one + two) + says("sphere { radius: var(--size); }  cube { size: var(--size); }");
}

function ifFigure(): string {
  const branch = (y: number, when: string, value: string, back: boolean) =>
    `<g class="fades${back ? " reverse" : ""}">${path("tint", `M150 105L206 ${y}H236`)}${text(290, y, value, "axis-label lit")}</g>` + path("ghost", `M150 105L206 ${y}H236`) + text(196, y - 14, when, "plot-label");
  return (
    stage(STAGE, path("edge", "M90 105L120 79L150 105L120 131Z") + text(120, 105, "?") + branch(66, "width < 600px", "scale: 0.6", true) + branch(144, "else", "scale: 1", false)) +
    says("scale: if(media(width < 600px): 0.6; else: 1);")
  );
}

// --- the at-rules

function media(): string {
  const wide: Frame = { ...CELL, scale: 26, x: 66, y: 92 };
  const narrow: Frame = { ...CELL, scale: 22, x: 66, y: 96 };
  return (
    cells(
      "figure-steps",
      [
        ["900px wide", frameOf(12, 28, 108, 84) + scene(wide, "floats", -6)],
        ["480px wide", frameOf(38, 20, 56, 96) + `<g class="tinted">${scene(narrow, "floats", -6)}</g>`],
      ],
      CELL,
    ) + says("@media (max-width: 600px) { sphere { color: #ff5a36; } }")
  );
}

const rule = (x: number, y: number, width: number, strokes: Stroke[]) =>
  `<rect class="guide" x="${x}" y="${y}" width="${width}" height="${16 + strokes.length * 11}" rx="4"/>` + code(strokes, x + 8, y + 14, 11);

const mixin = () =>
  flow([
    ["@mixin --polished", rule(20, 40, 92, [[0, 50], [8, 56, true], [8, 40, true], [0, 8]])],
    ["#a, #b", rule(20, 16, 92, [[0, 20], [8, 56, true], [8, 40, true], [0, 8]]) + rule(20, 74, 92, [[0, 20], [8, 56, true], [8, 40, true], [0, 8]])],
  ]) + says("@mixin --polished { material: metal; color: #ccc; }");

const apply = () =>
  flow([
    ["what the rule says", rule(20, 36, 92, [[0, 20], [8, 64, true], [8, 34], [0, 8]])],
    ["what the scene compiles", rule(20, 30, 92, [[0, 20], [8, 56, true], [8, 40, true], [8, 34], [0, 8]])],
  ]) + says("#a { @apply --polished; translate: 0 1 0; }");

// !important: the declaration that wins, whatever the selectors
function important(): string {
  const frame: Frame = { ...STAGE, height: 170, scale: 60, x: 300, y: 84 };
  const rules = `<text class="code struck" x="24" y="66">#a { color: blue; }</text><text class="code lit" x="24" y="104">cube { color: red !important; }</text>`;
  return stage(frame, rules + `<g class="tinted">${lines(box(0.4, 0.4, 0.4), frame)}</g>`);
}

const FLOWS: Record<string, (subject: string) => string> = {
  "why-gss": whyGss,
  embedding,
  "install-package": installPackage,
  "install-vite": installVite,
  "install-cdn": installCdn,
  "editor-support": editorSupport,
  "set-variables": variable('scene.setProperty("--lift", "1.5");'),
  "at-property": variable('@property --lift { syntax: "<number>"; inherits: false; initial-value: 1; }'),
  "at-property-panel": variable("@property-panel { display: open; }", true),
  "fn-var": varFigure,
  "fn-if": ifFigure,
  "at-media": media,
  "at-mixin": mixin,
  "at-apply": apply,
  "selector-important": important,
};
export const flows = (subject: string) => FLOWS[subject](subject);
export const FLOW_PAGES = Object.keys(FLOWS);
