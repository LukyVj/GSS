// content (the text of an object): drawn in a canvas, and given to the shader like an image.
// Only the alpha of the image is read: it is the ink, the shader gives it its color.

// content: "hello" reaches the runtime as content(["hello","normal 400 sans-serif"]): the
// text and its font (style, weight, families), or null for an image, an element or a @paint
export function textOf(source: string): { text: string; font: string } | null {
  const inside = /^content\((\[.*\])\)$/s.exec(source)?.[1];
  if (inside === undefined) return null;
  try {
    const [text, font] = JSON.parse(inside);
    return typeof text === "string" && typeof font === "string" ? { text, font } : null;
  } catch {
    return null;
  }
}

const SIZE = 160; // the height of the letters in the image, in pixels
const WIDEST = 4096; // a longer text is drawn smaller: every GPU takes an image this wide

// "italic 700 Georgia, serif" → "italic 700 160px Georgia, serif", the font shorthand of CSS
function cssFont(font: string, size: number): string {
  return font.replace(/^(\S+ \S+) /, `$1 ${size}px `);
}

// The text on one line, in white on nothing, with a little room around it
export function drawText(text: string, font: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const measure = (size: number) => {
    context.font = cssFont(font, size);
    const box = context.measureText(text);
    const margin = size * 0.15;
    const left = Math.max(box.actualBoundingBoxLeft, 0);
    // The line of the font, not of these letters: "a" and "A" are written at the same size
    const ascent = box.fontBoundingBoxAscent ?? size * 0.9;
    const descent = box.fontBoundingBoxDescent ?? size * 0.25;
    return {
      size,
      x: margin + left,
      y: margin + ascent,
      width: Math.ceil(left + Math.max(box.width, box.actualBoundingBoxRight) + 2 * margin),
      height: Math.ceil(ascent + descent + 2 * margin),
    };
  };
  let line = measure(SIZE);
  if (line.width > WIDEST) line = measure(Math.floor((SIZE * WIDEST) / line.width));
  canvas.width = Math.max(1, Math.min(line.width, WIDEST));
  canvas.height = Math.max(1, line.height);
  context.font = cssFont(font, line.size); // a canvas that changes size forgets its font
  context.fillStyle = "#ffffff";
  context.fillText(text, line.x, line.y);
  return canvas;
}

// A font of the page that is not there yet: calls again once it has arrived, to draw
// the text with it
export function whenFontArrives(text: string, font: string, again: () => void): void {
  const css = cssFont(font, SIZE);
  if (typeof document === "undefined" || !document.fonts || document.fonts.check(css, text)) return;
  document.fonts.load(css, text).then((loaded) => { if (loaded.length > 0) again(); }, () => {});
}
