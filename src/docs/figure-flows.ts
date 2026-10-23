import { escapeHtml } from "./escape";
import { cells, hull, lines, path, round, says, stage, text } from "./figure-kit";
import { REST_VIEW, ball, box, floor, moved, place, type Frame, type Vec3 } from "./hairline";

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

// --- @mixin and @apply: the code is written, a cube shows what it gives

// A line of code, written: its words are the code of the page
const written = (x: number, y: number, words: string, kind = "code") => `<text class="${kind}" x="${x}" y="${y}">${words}</text>`;
const word = (words: string, kind = "", more = "") => (kind ? `<tspan class="${kind}"${more}>${escapeHtml(words)}</tspan>` : escapeHtml(words));

// A cube with round corners, from where every figure rests. Its outline is the outline of the
// cube inside it, pushed out by the radius; a line runs along the middle of each round edge,
// the three behind dashed.
function roundCube(frame: Frame, half: number, radius: number): string {
  const inner = half - radius;
  const reach = radius * frame.scale;
  const at = (p: Vec3) => place(p, frame, REST_VIEW);
  const point = (p: number[]) => `${round(p[0])} ${round(p[1])}`;
  const signs = [-1, 1];
  const corners = hull(signs.flatMap((x) => signs.flatMap((y) => signs.map((z) => at([x * inner, y * inner, z * inner])))));
  const middle = [frame.x, frame.y];
  const sides = corners.map((a, i) => {
    const b = corners[(i + 1) % corners.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let out = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
    if (out[0] * (a[0] - middle[0]) + out[1] * (a[1] - middle[1]) < 0) out = [-out[0], -out[1]];
    return { from: [a[0] + out[0] * reach, a[1] + out[1] * reach], to: [b[0] + out[0] * reach, b[1] + out[1] * reach], along: [b[0] - a[0], b[1] - a[1]] };
  });
  // Which way the outline goes round, for the arcs of its corners
  const [first, second] = sides;
  const clockwise = first.along[0] * second.along[1] - first.along[1] * second.along[0] > 0 ? 1 : 0;
  const outline = `M${point(sides[0].from)}${sides.map((side, i) => `L${point(side.to)}A${round(reach)} ${round(reach)} 0 0 ${clockwise} ${point(sides[(i + 1) % sides.length].from)}`).join("")}`;
  // The three round edges that meet at a corner: the one nearest the eye, or the one behind
  const { eye } = REST_VIEW;
  const ridges = (toward: number) => {
    const corner: Vec3 = [Math.sign(eye[0]) * toward, Math.sign(eye[1]) * toward, Math.sign(eye[2]) * toward];
    const tip = at(corner.map((sign) => sign * (inner + radius / Math.sqrt(3))) as Vec3);
    return [0, 1, 2]
      .map((axis) => {
        const push = corner.map((sign, i) => (i === axis ? 0 : (sign * radius) / Math.SQRT2));
        const along = (sign: number) => corner.map((own, i) => (i === axis ? sign * own : own) * inner + push[i]) as Vec3;
        const far = at(corner.map((own, i) => (i === axis ? -own : own) * inner) as Vec3);
        // the far end of the line lands on the outline, at the corner it goes to
        const end = at(along(-1));
        const length = Math.hypot(end[0] - far[0], end[1] - far[1]) || 1;
        const landed = [far[0] + ((end[0] - far[0]) / length) * reach, far[1] + ((end[1] - far[1]) / length) * reach];
        return `M${point(tip)}L${point(at(along(1)))}L${point(landed)}`;
      })
      .join("");
  };
  return path("hidden", ridges(-1)) + path("line", outline + ridges(1), ' pathLength="1"');
}

// @mixin: a block written once, and the two rules that apply it: both cubes take its round
// corners and its metal
function mixin(): string {
  const frame: Frame = { width: 400, height: 254, scale: 52, x: 0, y: 0 };
  const block =
    `<rect class="guide" x="100" y="16" width="200" height="88" rx="4"/>` +
    written(114, 34, word("@mixin --polished {")) +
    written(128, 52, word("material: metal(0.15);"), "code lit") +
    written(128, 70, word("corner-radius: 0.12;"), "code lit") +
    written(114, 88, word("}"));
  const applied = (x: number, id: string, from: number) => {
    const cube: Frame = { ...frame, x, y: 184 };
    const turn = from < x ? 6 : -6;
    const way = `M${from} 104V114Q${from} 120 ${from + turn} 120H${x - turn}Q${x} 120 ${x} 126V136`;
    // The light on the metal: two strokes on the face in front
    const shine = [
      [-0.27, -0.02, -0.07, 0.28],
      [-0.12, -0.02, 0.03, 0.205],
    ]
      .map(([x0, y0, x1, y1]) => `M${place([x0, y0, 0.5], cube, REST_VIEW).slice(0, 2).map(round).join(" ")}L${place([x1, y1, 0.5], cube, REST_VIEW).slice(0, 2).map(round).join(" ")}`)
      .join("");
    return (
      path("mark", way) +
      `<g class="travels rides" style="offset-path: path('${way}'); animation-duration: 2.4s"><circle class="dot" r="2.5"/></g>` +
      `<g class="tinted">${roundCube(cube, 0.5, 0.12)}<g class="glows">${path("glint", shine)}</g></g>` +
      written(x, 240, `${word(`#${id} { `)}${word("@apply --polished;", "lit")}${word(" }")}`, "code middle")
    );
  };
  return stage(frame, block + applied(100, "a", 150) + applied(300, "b", 250));
}

// @apply: the mixin stands where @apply is written. Two rules of the page, read from left to
// right: the color written last wins, and the cube takes it.
function apply(): string {
  const frame: Frame = { width: 400, height: 176, scale: 34, x: 0, y: 0 };
  const [warm, blue] = ["#ff5a36", "#3a7bff"];
  const row = (y: number, id: string, mixinLast: boolean) => {
    const [own, applied] = [`color: ${blue};`, "@apply --warm;"];
    const [first, last] = mixinLast ? [warm, blue].reverse() : [warm, blue];
    const inked = (turn: string, lost: boolean) => word(own, `inked ${turn}${lost ? " struck" : ""}`, ` style="--c: ${blue}"`);
    const rule = mixinLast
      ? `${word(`#${id} { `)}${inked("first", true)} ${word(applied, "lit last")}${word(" }")}`
      : `${word(`#${id} { `)}${word(applied, "lit first")} ${inked("last", false)}${word(" }")}`;
    // Under @apply, what the mixin puts there: the words before it take their place, unseen
    const before = mixinLast ? `#${id} { ${own} ` : `#${id} { `;
    const put = `${word(before, "blank")}${word("└ ", "elbow")}${word(`color: ${warm};`, mixinLast ? "put last" : "put first struck")}`;
    const cube: Frame = { ...frame, x: 348, y: y + 12 };
    return written(20, y, rule) + written(20, y + 20, put, "under code") + `<g class="cascades" style="--first: ${first}; --last: ${last}">${lines(box(0.5, 0.5, 0.5), cube)}</g>`;
  };
  return stage(frame, row(42, "a", true) + path("ground", "M20 88H380") + row(122, "b", false)) + says(`@mixin --warm { color: ${warm}; }`);
}

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
