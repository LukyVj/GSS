import { SHAPE_DOCS, type Figure } from "../compiler/registry/registry";
import { escapeHtml } from "./escape";
import { SHAPES, draw } from "./hairline";

// The figures of the docs (decision 180): a drawing under the lead of a page, in thin lines,
// for what a picture says faster than a paragraph. A page asks for one by its name, in the
// registry.

const SIZE = 120; // the box of one shape
const SCALE = 62; // one unit of the scene, in that box

// A shape as lines: what is behind first, so the lines in front cross over it
function shapeSvg(name: keyof typeof SHAPES): string {
  const { visible, hidden, guide, guideHidden } = draw(SHAPES[name](), SIZE, SCALE);
  const path = (kind: string, d: string) => (d ? `<path class="${kind}" d="${d}"/>` : "");
  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true">${path("hidden", hidden + guideHidden)}${path("guide", guide)}${path("line", visible)}</svg>`;
}

// Everything a scene can declare: the shapes, a group, a light. Each one opens its page.
function shapes(): string {
  const cells = SHAPE_DOCS.map(({ name }) => {
    const anchor = escapeHtml(`shape-${name}`);
    return `<li><a href="#${anchor}">${shapeSvg(name)}<code>${escapeHtml(name)}</code></a></li>`;
  });
  return `<ul class="figure-shapes">
        ${cells.join("\n        ")}
      </ul>`;
}

// The label says the figure to a screen reader, and to "copy page"
export const FIGURES: Record<Figure, { label: string; art: () => string }> = {
  shapes: { label: "What a scene can declare", art: shapes },
};

// A figure is drawn once: the page is rendered when the site is built, and again at each
// reload of the dev server. The reader gets the SVG, never this code.
const drawn = new Map<Figure, string>();

export function renderFigure(name: Figure | undefined): string {
  if (!name) return "";
  let html = drawn.get(name);
  if (!html) {
    const { label, art } = FIGURES[name];
    html = `
      <figure class="figure" aria-label="${escapeHtml(label)}">
      ${art()}
      </figure>`;
    drawn.set(name, html);
  }
  return html;
}
