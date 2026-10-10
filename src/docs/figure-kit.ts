import type { ShapeDef } from "../compiler/registry/registry";
import { escapeHtml } from "./escape";
import { REST_VIEW, box, draw, place, shapeDrawing, type Frame, type Solid, type Vec3 } from "./hairline";

// What every figure of the docs is made with (decisions 180, 181): the strokes of a drawing,
// a stage for one drawing, cells for several, and the code a figure plays, under it.

export type ShapeName = ShapeDef["name"];

export const path = (kind: string, d: string, more = "") => `<path class="${kind}"${more} d="${d}"/>`;
export const svg = ({ width, height }: Frame, content: string, more = "") =>
  `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"${more}>${content}</svg>`;

// The lines of a solid: what is behind first, so the lines in front cross over it. The lines
// in front are the ones that draw themselves: their length counts as 1.
export const lines = (solid: Solid, frame: Frame) => {
  const { ground, hidden, guideHidden, guide, visible } = draw(solid, frame);
  return (ground ? path("ground", ground) : "") + path("hidden", hidden + guideHidden) + path("guide", guide) + path("line", visible, ' pathLength="1"');
};

// A shape the page script can turn: it finds the shape and its frame here, and rewrites the
// same three paths (and the measures, when the shape has them)
export function shapeSvg(name: ShapeName, frame: Frame, measured: boolean | string = false): string {
  const { hidden, guideHidden, guide, visible, marks } = shapeDrawing(name, frame, REST_VIEW, measured);
  const measures = marks
    .map(({ label, d, x, y }) => `${path("mark", d)}<text class="mark-label" x="${x}" y="${y}">${escapeHtml(label)}</text>`)
    .join("");
  return svg(
    frame,
    path("hidden", hidden + guideHidden) + path("guide", guide) + path("line", visible, ' pathLength="1"') + measures,
    ` data-turn="${escapeHtml(name)}" data-frame="${frame.scale} ${frame.x} ${frame.y}"${measured ? ` data-measured="${measured === true ? "" : escapeHtml(measured)}"` : ""}`,
  );
}

// --- one drawing on a stage, and the code it plays under it

export const round = (n: number) => +n.toFixed(1);
export const text = (x: number, y: number, words: string, kind = "mark-label") => `<text class="${kind}" x="${round(x)}" y="${round(y)}">${escapeHtml(words)}</text>`;
export const stage = (frame: Frame, content: string, more = "") => `<div class="figure-stage">${svg(frame, content, more)}</div>`;
// The declarations a figure plays, under it: each one lights up while the figure plays it
export const playing = (codes: string[]) =>
  `<figcaption>${codes.map((code, i) => `<code style="--phase: ${i}">${escapeHtml(code)}</code>`).join("")}</figcaption>`;
// How far on the screen a move in the scene goes, in the pixels of a frame
export const shift = (frame: Frame, by: Vec3) => {
  const [from, to] = [place([0, 0, 0], frame, REST_VIEW), place(by, frame, REST_VIEW)];
  return [round(to[0] - from[0]), round(to[1] - from[1])];
};
// The edges of a solid that moves as a whole: no line draws itself, and a sheet in the color
// of the page hides what the solid passes over
export function body(solid: Solid, frame: Frame): string {
  const { visible, hidden } = draw(solid, frame);
  const points = solid.mesh.flat().map((p) => place(p, frame, REST_VIEW));
  // The outline of the sheet: the hull of every point of the solid, on the screen
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: number[][]) => {
    const kept: number[][] = [];
    for (const p of list) {
      while (kept.length > 1 && turn(kept[kept.length - 2], kept[kept.length - 1], p) <= 0) kept.pop();
      kept.push(p);
    }
    return kept.slice(0, -1);
  };
  const hull = [...half(sorted), ...half([...sorted].reverse())];
  return path("sheet", `M${hull.map((p) => `${round(p[0])} ${round(p[1])}`).join("L")}Z`) + path("hidden", hidden) + path("edge", visible);
}

// The code a figure shows, under it
export const says = (code: string) => `<figcaption><code class="lit">${escapeHtml(code)}</code></figcaption>`;
// Two declarations a figure goes between: each lights up at its end of the way
export const between = (a: string, b: string, beat = "") =>
  `<figcaption class="beats"${beat ? ` style="--beat: ${beat}"` : ""}><code>${escapeHtml(a)}</code><code>${escapeHtml(b)}</code></figcaption>`;

// Cells: several drawings side by side, each over its name
export const cells = (kind: string, items: [label: string, art: string][], frame: Frame) =>
  `<ol class="figure-cells ${kind}">
        ${items.map(([label, art], i) => `<li style="--i: ${i}">${svg(frame, art)}<code>${escapeHtml(label)}</code></li>`).join("\n        ")}
      </ol>`;

// An image on the faces of a cube the eye sees: the square of the image, sheared onto each.
// The image is drawn in a square of TILE units.
export const TILE = 72;
export type Face = "front" | "left" | "top";
export function onCube(frame: Frame, art: string, faces: Face[] = ["front", "left", "top"], half = 0.5): string {
  const corner = (x: number, y: number, z: number) => place([x * half * 2, y * half * 2, z * half * 2], frame, REST_VIEW);
  const face = (origin: number[], across: number[], down: number[]) => {
    const m = [across[0] - origin[0], across[1] - origin[1], down[0] - origin[0], down[1] - origin[1]].map((n) => +(n / TILE).toFixed(4));
    return `<g transform="matrix(${m.join(" ")} ${round(origin[0])} ${round(origin[1])})">${art}</g>`;
  };
  const sides: Record<Face, string> = {
    front: face(corner(-0.5, 0.5, 0.5), corner(0.5, 0.5, 0.5), corner(-0.5, -0.5, 0.5)),
    left: face(corner(-0.5, 0.5, -0.5), corner(-0.5, 0.5, 0.5), corner(-0.5, -0.5, -0.5)),
    top: face(corner(-0.5, 0.5, -0.5), corner(0.5, 0.5, -0.5), corner(-0.5, 0.5, 0.5)),
  };
  return faces.map((name) => sides[name]).join("") + lines(box(half, half, half), frame);
}
