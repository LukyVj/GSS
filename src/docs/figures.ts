import { SHAPE_DOCS, type Figure, type ShapeDef } from "../compiler/registry/registry";
import { escapeHtml } from "./escape";
import { REST_VIEW, ball, box, draw, floor, measure, moved, place, shapeDrawing, together, type Frame, type Solid } from "./hairline";

// The figures of the docs (decision 180): a drawing under the lead of a page, in thin lines,
// for what a picture says faster than a paragraph. A page asks for one by its name, in the
// registry. Some move (decision 181): the lines draw themselves when the page opens, a shape
// turns under the pointer (figure-motion.ts), a ball floats as its animation says.

type ShapeName = ShapeDef["name"];

const path = (kind: string, d: string, more = "") => `<path class="${kind}"${more} d="${d}"/>`;
const svg = ({ width, height }: Frame, content: string, more = "") =>
  `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"${more}>${content}</svg>`;

// The lines of a solid: what is behind first, so the lines in front cross over it. The lines
// in front are the ones that draw themselves: their length counts as 1.
const lines = (solid: Solid, frame: Frame) => {
  const { ground, hidden, guideHidden, guide, visible } = draw(solid, frame);
  return (ground ? path("ground", ground) : "") + path("hidden", hidden + guideHidden) + path("guide", guide) + path("line", visible, ' pathLength="1"');
};

// A shape the page script can turn: it finds the shape and its frame here, and rewrites the
// same three paths (and the measures, when the shape has them)
function shapeSvg(name: ShapeName, frame: Frame, measured = false): string {
  const { hidden, guideHidden, guide, visible, marks } = shapeDrawing(name, frame, REST_VIEW, measured);
  const measures = marks
    .map(({ label, d, x, y }) => `${path("mark", d)}<text class="mark-label" x="${x}" y="${y}">${escapeHtml(label)}</text>`)
    .join("");
  return svg(
    frame,
    path("hidden", hidden + guideHidden) + path("guide", guide) + path("line", visible, ' pathLength="1"') + measures,
    ` data-turn="${escapeHtml(name)}" data-frame="${frame.scale} ${frame.x} ${frame.y}"${measured ? " data-measured" : ""}`,
  );
}

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

const TILE = 72; // the texture, in the units of its own drawing
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
  // The same texture on the three faces the eye sees: each face is the square, sheared
  const corner = (x: number, y: number, z: number) => place([x, y, z], frame, REST_VIEW);
  const face = (origin: number[], across: number[], down: number[]) => {
    const m = [across[0] - origin[0], across[1] - origin[1], down[0] - origin[0], down[1] - origin[1]].map((n) => +(n / TILE).toFixed(4));
    return `<g transform="matrix(${m.join(" ")} ${+origin[0].toFixed(1)} ${+origin[1].toFixed(1)})">${rings}</g>`;
  };
  const cube =
    face(corner(-0.5, 0.5, 0.5), corner(0.5, 0.5, 0.5), corner(-0.5, -0.5, 0.5)) + // front
    face(corner(-0.5, 0.5, -0.5), corner(-0.5, 0.5, 0.5), corner(-0.5, -0.5, -0.5)) + // left
    face(corner(-0.5, 0.5, -0.5), corner(0.5, 0.5, -0.5), corner(-0.5, 0.5, 0.5)) + // top
    lines(box(0.5, 0.5, 0.5), frame);
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

// The label says the figure to a screen reader, and to "copy page"
export const FIGURES: Record<Figure, { label: string; art: (subject: string) => string }> = {
  shapes: { label: "What a scene can declare", art: shapes },
  shape: { label: "The shape, and the properties that size it", art: shape },
  "first-scene": { label: "The first scene, one declaration at a time", art: firstScene },
  paint: { label: "From the shader to the faces of the object", art: paint },
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
