import { SHAPE_DOCS, type Figure } from "../compiler/registry/registry";
import { escapeHtml } from "./escape";
import { TILE, body, lines, onCube, path, playing, round, shapeSvg, shift, stage, svg, text, type ShapeName } from "./figure-kit";
import { colors } from "./figure-colors";
import { flows } from "./figure-flows";
import { lanes, offsetDistance, offsetRotate, range, scrollTimeline } from "./figure-lanes";
import { cornerRadius, d, measure as measured, viewBox } from "./figure-measures";
import { calc, plot } from "./figure-plots";
import { row } from "./figure-rows";
import { scenes } from "./figure-scenes";
import { tiles } from "./figure-tiles";
import { AXIS_REACH, REST_VIEW, ball, box, draw, floor, measure, moved, place, spinDrawing, together, type Axis, type Frame, type Vec3 } from "./hairline";

// The figures of the docs (decision 180): a drawing under the lead of a page, in thin lines,
// for what a picture says faster than a paragraph. A page asks for one by its name, in the
// registry. Some move (decision 181): the lines draw themselves when the page opens, a shape
// turns under the pointer (figure-motion.ts), a ball floats as its animation says.

// --- shapes: everything a scene can declare, each one a link to its page

const CELL: Frame = { width: 120, height: 120, scale: 62, x: 60, y: 60 };

function shapes(): string {
  const cells = SHAPE_DOCS.map(({ name }, i) => {
    const anchor = escapeHtml(`shape-${name}`);
    return `<li style="--i: ${i}"><a href="#${anchor}">${shapeSvg(name, CELL)}<code>${escapeHtml(name)}</code></a></li>`;
  });
  return `<ul class="figure-cells figure-shapes">
        ${cells.join("\n        ")}
      </ul>`;
}

// --- shape: the shape of the page, large, with the properties that size it

const STAGE: Frame = { width: 380, height: 250, scale: 130, x: 190, y: 128 };

const shape = (name: string) => `<div class="figure-stage">${shapeSvg(name as ShapeName, STAGE, true)}</div>`;

// --- first-scene: the scene of "Your first scene", one declaration at a time

const STEP: Frame = { width: 132, height: 132, scale: 34, x: 66, y: 102 };
const GROUND = () => floor(1.2, 0.6);
const BALL = (y: number) => moved(ball(REST_VIEW, 0.5), [0, y, 0]);
// How far up the screen one unit of height goes
const rise = (units: number) => +(place([0, 0, 0], STEP, REST_VIEW)[1] - place([0, units, 0], STEP, REST_VIEW)[1]).toFixed(1);

function firstScene(): string {
  const height = measure({ from: [0.95, 0, 0], to: [0.95, 1, 0], label: "1" }, STEP);
  const lifted = path("mark", height.d) + `<text class="mark-label" x="${height.x}" y="${height.y}">1</text>`;
  // A glint on the glass: an arc inside the outline, up on the left
  const [cx, cy] = place([0, 1, 0], STEP, REST_VIEW);
  const r = 0.5 * STEP.scale - 5;
  const glint = path("glint", `M${+(cx - r * 0.86).toFixed(1)} ${+(cy - r * 0.5).toFixed(1)}A${r} ${r} 0 0 1 ${+(cx - r * 0.26).toFixed(1)} ${+(cy - r * 0.96).toFixed(1)}`);
  const steps: [code: string, art: string][] = [
    // The sphere is centered on its origin: half of it is under the floor
    ["sphere#ball;", lines(together(GROUND(), BALL(0)), STEP)],
    ["translate: 0 1 0;", lines(together(GROUND(), BALL(1)), STEP) + lifted],
    ["color: #ff5a36;", `<g class="tinted">${lines(together(GROUND(), BALL(1)), STEP)}</g>`],
    // Glass: the floor shows through the ball
    ["material: glass(1.5, frosted 0.3);", lines(GROUND(), STEP) + `<g class="tinted">${lines(BALL(1), STEP)}${glint}</g>`],
    // Between the two frames of @keyframes float: 1 and 1.5, there and back in 2s
    [
      "animation: float 2s ease-in-out alternate;",
      lines(GROUND(), STEP) +
        path("ghost", draw(BALL(1.5), STEP).visible) +
        `<g class="tinted floats" style="--rise: ${-rise(0.5)}px">${lines(BALL(1), STEP)}${glint}</g>`,
    ],
  ];
  const cells = steps.map(([code, art], i) => `<li style="--i: ${i}">${svg(STEP, art)}<code>${escapeHtml(code)}</code></li>`);
  return `<ol class="figure-cells figure-steps">
        ${cells.join("\n        ")}
      </ol>`;
}

// --- paint: from the shader of @paint to the faces of an object

// Rings that grow from the middle of the texture, one after the other
const rings = `<g class="rings">${[0, 1, 2, 3].map((i) => `<circle cx="${TILE / 2}" cy="${TILE / 2}" r="${TILE / 2}" style="--i: ${i}"/>`).join("")}</g>`;

function paint(): string {
  const frame: Frame = { width: 132, height: 132, scale: 62, x: 66, y: 68 };
  // The code: a few lines, the one that sets the color in signal, and a caret
  const code =
    path("line", "M34 40H74M34 52H92M44 64H98M44 88H70M34 100H42", ' pathLength="1"') +
    path("tint", "M44 76H86") +
    `<rect class="caret" x="89" y="71" width="1" height="10"/>`;
  const tile = `<rect class="tile" x="30" y="30" width="${TILE}" height="${TILE}"/><g transform="translate(30 30)">${rings}</g>`;
  // The same texture on the three faces the eye sees
  const cube = onCube(frame, rings);
  const steps: [code: string, art: string][] = [
    ["@paint rings { … }", code],
    ["512 × 512 px", tile],
    ["texture: paint(rings);", cube],
  ];
  const cells = steps.map(([label, art], i) => `<li style="--i: ${i}">${svg(frame, art)}<code>${escapeHtml(label)}</code></li>`);
  return `<ol class="figure-cells figure-flow">
        ${cells.join("\n        ")}
      </ol>`;
}

// --- translate: a cube along x, then y, then z

function translate(): string {
  const frame: Frame = { width: 340, height: 230, scale: 60, x: 105, y: 150 };
  const moves: [axis: string, by: Vec3, end: Vec3][] = [
    ["x", [1.5, 0, 0], [2.1, 0, 0]],
    ["y", [0, 1.1, 0], [0, 1.6, 0]],
    ["z", [0, 0, 1.5], [0, 0, 2.05]],
  ];
  const origin = place([0, 0, 0], frame, REST_VIEW);
  const axes = moves
    .map(([axis, , end], i) => {
      const tip = place(end, frame, REST_VIEW);
      const [dx, dy] = [tip[0] - origin[0], tip[1] - origin[1]];
      const length = Math.hypot(dx, dy);
      return (
        `<g class="phase" style="--phase: ${i}">` +
        path("axis", `M${round(origin[0])} ${round(origin[1])}L${round(tip[0])} ${round(tip[1])}`) +
        text(tip[0] + (dx / length) * 10, tip[1] + (dy / length) * 10, axis, "axis-label") +
        `</g>`
      );
    })
    .join("");
  const cube = box(0.3, 0.3, 0.3);
  const [[ax, ay], [bx, by], [cx, cy]] = moves.map(([, by]) => shift(frame, by));
  const slides = `<g class="slides" style="--ax: ${ax}px; --ay: ${ay}px; --bx: ${bx}px; --by: ${by}px; --cx: ${cx}px; --cy: ${cy}px">${body(cube, frame)}</g>`;
  return (
    stage(frame, axes + path("ghost", draw(cube, frame).visible) + slides) +
    playing(["translate: 1.5 0 0;", "translate: 0 1.1 0;", "translate: 0 0 1.5;"])
  );
}

// --- scale: a cube that grows and shrinks around its center

function scale(): string {
  const frame: Frame = { width: 340, height: 220, scale: 78, x: 170, y: 114 };
  const cube = box(0.5, 0.5, 0.5);
  const grows = `<g class="grows" style="transform-origin: ${frame.x}px ${frame.y}px">${body(cube, frame)}</g>`;
  return stage(frame, grows + path("ghost", draw(cube, frame).visible)) + `<figcaption class="beats">${["scale: 0.55;", "scale: 1.35;"].map((code) => `<code>${code}</code>`).join("")}</figcaption>`;
}

// --- rotate: a cube turning around the axis of its property

function rotate(property: string): string {
  const axis = property.slice(-1) as Axis; // rotate-x, rotate-y, rotate-z
  const frame: Frame = { width: 340, height: 230, scale: 84, x: 170, y: 118 };
  const { cube, axis: line } = spinDrawing(axis, 24, frame);
  const end: Vec3 = [0, 0, 0];
  end["xyz".indexOf(axis)] = AXIS_REACH;
  const tip = place(end, frame, REST_VIEW);
  const away = [tip[0] - frame.x, tip[1] - frame.y];
  const length = Math.hypot(away[0], away[1]);
  const drawing =
    path("hidden", cube.hidden) +
    path("line", cube.visible, ' pathLength="1"') +
    path("axis-behind", line.hidden) +
    path("axis-front", line.visible) +
    text(tip[0] + (away[0] / length) * 10, tip[1] + (away[1] / length) * 10, axis, "axis-label lit");
  return stage(frame, drawing, ` data-spin="${axis}" data-frame="${frame.scale} ${frame.x} ${frame.y}"`) + `<figcaption><code class="lit">${escapeHtml(property)}: 0deg → 360deg;</code></figcaption>`;
}

// --- keyframes: a ball between two frames, and the time that passes

function keyframes(): string {
  const frame: Frame = { width: 380, height: 190, scale: 1, x: 0, y: 0 };
  const [x, low, high, r] = [70, 140, 56, 15];
  // A ball in two strokes: its outline, and its equator, dashed behind
  const sphere = (cy: number) =>
    `<circle cx="${x}" cy="${cy}" r="${r}"/>` + path("guide", `M${x - r} ${cy}A${r} 5 0 0 0 ${x + r} ${cy}`) + path("hidden", `M${x - r} ${cy}A${r} 5 0 0 1 ${x + r} ${cy}`);
  const [start, end, line] = [160, 340, 98];
  const diamond = (at: number) => path("mark", `M${at} ${line - 5}L${at + 5} ${line}L${at} ${line + 5}L${at - 5} ${line}Z`);
  const track =
    path("guide", `M${start} ${line}H${end}`) +
    diamond(start) +
    diamond(end) +
    text(start, line + 22, "from") +
    text(end, line + 22, "to") +
    text(start, line - 18, "0%") +
    text(end, line - 18, "100%") +
    `<g class="plays" style="--run: ${end - start}px">${path("tint", `M${start} ${line - 11}V${line + 11}`)}</g>`;
  const balls =
    `<circle class="ghost" cx="${x}" cy="${low}" r="${r}"/><circle class="ghost" cx="${x}" cy="${high}" r="${r}"/>` +
    `<g class="tinted floats" style="--rise: ${high - low}px">${sphere(low)}</g>`;
  return stage(frame, balls + track) + `<figcaption><code class="lit">animation: float 2s ease-in-out alternate;</code></figcaption>`;
}

// --- easing: the curve of an easing, a point that follows it, and a ball that moves by it

const EASINGS: Record<string, { css: string; points?: [number, number][]; handles?: [number, number, number, number] }> = {
  "fn-cubic-bezier": { css: "cubic-bezier(0.3, -0.4, 0.7, 1.4)", handles: [0.3, -0.4, 0.7, 1.4] },
  "fn-linear": { css: "linear(0, 1 40%, 0.75 55%, 1 70%, 0.95 80%, 1)", points: [[0, 0], [0.4, 1], [0.55, 0.75], [0.7, 1], [0.8, 0.95], [1, 1]] },
  "fn-steps": { css: "steps(4)", points: [[0, 0], [0.25, 0], [0.25, 0.25], [0.5, 0.25], [0.5, 0.5], [0.75, 0.5], [0.75, 0.75], [1, 0.75], [1, 1]] },
  "animation-timing-function": { css: "cubic-bezier(0.42, 0, 0.58, 1)", handles: [0.42, 0, 0.58, 1] },
};

function easing(subject: string): string {
  const { css, points, handles } = EASINGS[subject] ?? EASINGS["animation-timing-function"];
  const frame: Frame = { width: 380, height: 236, scale: 1, x: 0, y: 0 };
  const [left, bottom, size] = [56, 172, 120];
  const at = (time: number, progress: number) => `${round(left + time * size)} ${round(bottom - progress * size)}`;
  const curve = handles
    ? `M${at(0, 0)}C${at(handles[0], handles[1])} ${at(handles[2], handles[3])} ${at(1, 1)}`
    : `M${points!.map(([time, progress]) => at(time, progress)).join("L")}`;
  const pulls = handles
    ? path("guide", `M${at(0, 0)}L${at(handles[0], handles[1])}M${at(1, 1)}L${at(handles[2], handles[3])}`) +
      [0, 2].map((i) => `<circle class="guide" cx="${at(handles[i], handles[i + 1]).split(" ")[0]}" cy="${at(handles[i], handles[i + 1]).split(" ")[1]}" r="2.5"/>`).join("")
    : "";
  const graph =
    path("ground", `M${left} ${bottom - size}V${bottom}H${left + size}M${left} ${bottom - size}H${left + size}V${bottom}`) +
    text(left + size / 2, bottom + 16, "time") +
    text(left - 26, bottom - size / 2, "progress") +
    pulls +
    path("tint", curve) +
    `<g class="eases-time" style="--run: ${size}px"><g class="eases" style="--rise: ${-size}px; animation-timing-function: ${css}"><circle class="dot" cx="${left}" cy="${bottom}" r="3.5"/></g></g>`;
  // The same easing, on a ball that goes up
  const x = 286;
  const riser =
    path("ghost", `M${x} ${bottom}V${bottom - size}`) +
    `<circle class="ghost" cx="${x}" cy="${bottom}" r="12"/><circle class="ghost" cx="${x}" cy="${bottom - size}" r="12"/>` +
    `<g class="eases" style="--rise: ${-size}px; animation-timing-function: ${css}"><circle class="tint" cx="${x}" cy="${bottom}" r="12"/></g>`;
  return stage(frame, graph + riser) + `<figcaption><code class="lit">animation-timing-function: ${escapeHtml(css)};</code></figcaption>`;
}

// --- hover: a cube to hover and to press, on the pages of :hover, :active and transition

function hover(subject: string): string {
  const frame: Frame = { width: 380, height: 190, scale: 70, x: 190, y: 96 };
  const cube = box(0.34, 0.34, 0.34);
  // A cube that hears the pointer over its whole cell, with what to do written under it
  const cell = (x: number, kind: string, hint: string) =>
    `<g class="tries ${kind}"><rect class="hit" x="${x - 75}" y="12" width="150" height="166"/><g class="lifts">${body(cube, { ...frame, x })}</g>${text(x, 164, hint)}</g>`;
  const cells: Record<string, string> = {
    "selector-hover": cell(190, "", "hover"),
    "selector-active": cell(190, "glides presses", "hover, then press"),
    transition: cell(115, "", "no transition") + cell(265, "glides", "transition: 0.4s"),
  };
  const codes: Record<string, string> = {
    "selector-hover": "cube:hover { translate: 0 0.25 0; color: #ff5a36; }",
    "selector-active": "cube:active { translate: 0 -0.1 0; }",
    transition: "cube { transition: 0.4s ease-out; }",
  };
  return stage(frame, cells[subject] ?? cells["selector-hover"]) + `<figcaption><code class="lit">${escapeHtml(codes[subject] ?? codes["selector-hover"])}</code></figcaption>`;
}

// --- offset-path: an object that travels along a line

function offsetPath(): string {
  const frame: Frame = { width: 380, height: 200, scale: 1, x: 0, y: 0 };
  const line = "M44 150C110 20 200 220 336 60";
  const drawing =
    path("ghost", line) +
    text(44, 172, "0%") +
    text(336, 40, "100%") +
    `<circle class="guide" cx="44" cy="150" r="2.5"/><circle class="guide" cx="336" cy="60" r="2.5"/>` +
    `<g class="travels" style="offset-path: path('${line}')">${path("tint", "M-9 -7L9 0L-9 7Z")}</g>`;
  return stage(frame, drawing) + `<figcaption class="beats" style="--beat: 3.6s">${["offset-distance: 0%;", "offset-distance: 100%;"].map((code) => `<code>${code}</code>`).join("")}</figcaption>`;
}

// The label says the figure to a screen reader, and to "copy page"
export const FIGURES: Record<Figure, { label: string; art: (subject: string) => string }> = {
  shapes: { label: "What a scene can declare", art: shapes },
  shape: { label: "The shape, and the properties that size it", art: shape },
  "first-scene": { label: "The first scene, one declaration at a time", art: firstScene },
  paint: { label: "From the shader to the faces of the object", art: paint },
  translate: { label: "A cube moved along x, then y, then z", art: translate },
  scale: { label: "A cube that grows and shrinks around its center", art: scale },
  rotate: { label: "A cube turning around the axis", art: rotate },
  keyframes: { label: "A ball between its two frames, and the time that passes", art: keyframes },
  easing: { label: "The curve of the easing, and a ball that moves by it", art: easing },
  hover: { label: "A cube that answers the pointer", art: hover },
  "offset-path": { label: "An object that travels along its path", art: offsetPath },
  row: { label: "A scene as a row of objects: the ones the code targets are in signal", art: row },
  measure: { label: "The shapes that take the property, with the line it sets", art: measured },
  "corner-radius": { label: "The corner of a cube, sharp, then more and more round", art: cornerRadius },
  d: { label: "The commands of a path, each at the point it goes to", art: d },
  "view-box": { label: "The drawing area of a path, with the origin at its center", art: viewBox },
  plot: { label: "The functions as curves, with a point that runs along the first", art: plot },
  calc: { label: "A full turn divided by five", art: calc },
  lanes: { label: "One point per value of the property, each moved by it", art: lanes },
  "scroll-timeline": { label: "A page that scrolls, and the animation where the scroll is", art: scrollTimeline },
  range: { label: "The scene crossing the window, and the part of the way the animation plays on", art: range },
  "offset-distance": { label: "Three places on one path", art: offsetDistance },
  "offset-rotate": { label: "Two objects along a path: one turns with it, one keeps its angle", art: offsetRotate },
  tile: { label: "What covers the surface, flat, then on an object", art: tiles },
  color: { label: "The colors the function gives", art: colors },
  scene: { label: "What the property changes in the scene", art: scenes },
  flow: { label: "How it goes, from where it is written to what the scene shows", art: flows },
};

// A figure is drawn once: the page is rendered when the site is built, and again at each
// reload of the dev server. The reader gets the SVG, never the code that draws it.
const drawn = new Map<string, string>();

// The subject is the entry of the page, for a figure that depends on it: the shape to draw
export function renderFigure(name: Figure | undefined, subject = ""): string {
  if (!name) return "";
  const key = `${name} ${subject}`;
  let html = drawn.get(key);
  if (!html) {
    const { label, art } = FIGURES[name];
    html = `
      <figure class="figure" aria-label="${escapeHtml(label)}">
      ${art(subject)}
      </figure>`;
    drawn.set(key, html);
  }
  return html;
}
