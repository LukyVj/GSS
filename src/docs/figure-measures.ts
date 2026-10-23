import { PROPERTIES } from "../compiler/registry/registry";
import { escapeHtml } from "./escape";
import { cells, path, says, shapeSvg, stage, text, type ShapeName } from "./figure-kit";
import type { Frame } from "./hairline";

// The properties that size a shape: each shape that takes the property, with the line the
// property sets drawn on it. And the three that are not a length on a solid: the rounding of
// a cube, the line of a path, its drawing area.

const CELL: Frame = { width: 132, height: 132, scale: 62, x: 60, y: 66 };

// Every shape the property applies to, turned like the others under the pointer
export function measure(property: string): string {
  const { appliesTo } = PROPERTIES.find((candidate) => candidate.name === property)!;
  const shapes = appliesTo as ShapeName[];
  const items = shapes.map((shape, i) => `<li style="--i: ${i}">${shapeSvg(shape, CELL, property)}<code>${escapeHtml(shape)}</code></li>`);
  return (
    `<ol class="figure-cells figure-measures" style="--columns: ${Math.min(shapes.length, 4)}">
        ${items.join("\n        ")}
      </ol>` + says(`${property}: …;`)
  );
}

// corner-radius: the corner of a cube, sharp, then more and more round
export function cornerRadius(): string {
  const frame: Frame = { width: 132, height: 132, scale: 1, x: 0, y: 0 };
  const corner = (radius: number) => {
    const r = radius * 80; // a square of 80 stands for a cube of 1
    const square = `<rect class="edge" x="26" y="26" width="80" height="80" rx="${r}"/>`;
    const mark = r ? path("mark", `M${26 + r} ${26 + r}L${26 + r * 0.293} ${26 + r * 0.293}`) + `<circle class="dot" cx="${26 + r}" cy="${26 + r}" r="1.5"/>` : "";
    return square + mark;
  };
  return cells("figure-steps", [["corner-radius: 0;", corner(0)], ["corner-radius: 0.08;", corner(0.08)], ["corner-radius: 0.25;", corner(0.25)]], frame);
}

// d: the commands of a path, each at the point it goes to
export function d(): string {
  const frame: Frame = { width: 380, height: 190, scale: 1, x: 0, y: 0 };
  const line = "M50 140L130 140C190 140 170 50 240 50L330 50";
  const points: [number, number, string][] = [
    [50, 140, "M"],
    [130, 140, "L"],
    [240, 50, "C"],
    [330, 50, "L"],
  ];
  const drawing =
    path("guide", "M130 140L190 140M240 50L170 50") +
    `<circle class="guide" cx="190" cy="140" r="2.5"/><circle class="guide" cx="170" cy="50" r="2.5"/>` +
    path("line", line, ' pathLength="1"') +
    points.map(([x, y, command]) => `<circle class="dot" cx="${x}" cy="${y}" r="3"/>` + text(x, y + (y > 100 ? 18 : -16), command, "axis-label lit")).join("") +
    `<g class="travels slow" style="offset-path: path('${line}')"><circle class="tint" r="5"/></g>`;
  return stage(frame, drawing) + says('d: path("M 0 0 L 2 0 C 3.5 0 3 2 5 2 L 7 2");');
}

// view-box: the drawing area of a path, and the origin of the object at its center
export function viewBox(): string {
  const frame: Frame = { width: 380, height: 200, scale: 1, x: 0, y: 0 };
  const [x, y, width, height] = [110, 30, 160, 140];
  const drawing =
    `<rect class="ghost" x="${x}" y="${y}" width="${width}" height="${height}"/>` +
    path("line", "M140 140C150 60 200 150 240 70", ' pathLength="1"') +
    path("mark", `M${x + width / 2 - 6} ${y + height / 2}h12M${x + width / 2} ${y + height / 2 - 6}v12`) +
    text(x - 4, y - 10, "x y") +
    text(x + width / 2, y + height + 16, "width") +
    text(x + width + 26, y + height / 2, "height") +
    text(x + width / 2 + 26, y + height / 2 - 10, "origin", "axis-label lit");
  return stage(frame, drawing) + says("view-box: 0 0 24 24;");
}
