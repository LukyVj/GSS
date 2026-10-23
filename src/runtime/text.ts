// content (the text of an object): drawn in a canvas, and given to the shader like an image.
// The text is drawn twice, in white above and in black below: the shader gives the ink to
// what differs (the letters) and keeps the colors of what does not (an emoji).

// content: "hello" reaches the runtime as content(["hello","normal 400 sans-serif"]): the
// text and its font (style, weight, families), then the length of a line in letters of
// font-size and the side the lines lean to; null for an image, an element or a @paint
export type Label = { text: string; font: string; width: number | null; align: "left" | "center" | "right" };
export function textOf(source: string): Label | null {
  const inside = /^content\((\[.*\])\)$/s.exec(source)?.[1];
  if (inside === undefined) return null;
  try {
    const [text, font, width = null, align = "left"] = JSON.parse(inside);
    const ok = typeof text === "string" && typeof font === "string" && (width === null || typeof width === "number") && ["left", "center", "right"].includes(align);
    return ok ? { text, font, width, align } : null;
  } catch {
    return null;
  }
}

const SIZE = 160; // the height of the letters in the image, in pixels
const WIDEST = 4096; // a longer line is drawn smaller: every GPU takes an image this wide

// "italic 700 Georgia, serif" → "italic 700 160px Georgia, serif", the font shorthand of CSS
function cssFont(font: string, size: number): string {
  return font.replace(/^(\S+ \S+) /, `$1 ${size}px `);
}

// The lines of the text: broken where it says, then, with a width, between its words
// where a line would be longer, like CSS. A word longer than the line stays whole.
function breakLines(context: CanvasRenderingContext2D, text: string, room: number | null): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (room === null) {
      lines.push(paragraph);
      continue;
    }
    let line = "";
    for (const word of paragraph.split(" ")) {
      const longer = line === "" ? word : `${line} ${word}`;
      if (line !== "" && context.measureText(longer).width > room) {
        lines.push(line);
        line = word;
      } else line = longer;
    }
    lines.push(line);
  }
  return lines;
}

// The text, with a little room around it when it fits the face (as wide as a line when
// font-size sets it): in white, and below in black
export function drawText({ text, font, width, align }: Label): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const layout = (size: number) => {
    context.font = cssFont(font, size);
    const room = width === null ? null : width * size;
    const lines = breakLines(context, text, room);
    const boxes = lines.map((line) => context.measureText(line));
    // The line of the font, not of these letters: "a" and "A" are written at the same size
    const ascent = boxes[0].fontBoundingBoxAscent ?? size * 0.9;
    const descent = boxes[0].fontBoundingBoxDescent ?? size * 0.25;
    const margin = width === null ? size * 0.15 : 0;
    const longest = Math.max(...boxes.map((box) => Math.max(box.width, box.actualBoundingBoxRight + Math.max(box.actualBoundingBoxLeft, 0))));
    const inner = room ?? longest;
    return { size, lines, boxes, ascent, margin, inner, width: Math.ceil(inner + 2 * margin), line: ascent + descent, height: Math.ceil(lines.length * (ascent + descent) + 2 * margin) };
  };
  let page = layout(SIZE);
  if (page.width > WIDEST) page = layout(Math.floor((SIZE * WIDEST) / page.width));
  canvas.width = Math.max(1, Math.min(page.width, WIDEST));
  canvas.height = Math.max(2, 2 * page.height);
  context.font = cssFont(font, page.size); // a canvas that changes size forgets its font
  for (const [copy, ink] of ["#ffffff", "#000000"].entries()) {
    context.fillStyle = ink;
    page.lines.forEach((line, i) => {
      const box = page.boxes[i];
      const left = Math.max(box.actualBoundingBoxLeft, 0);
      const free = page.inner - box.width;
      const x = page.margin + left + (align === "center" ? free / 2 : align === "right" ? free : 0);
      context.fillText(line, x, copy * page.height + page.margin + page.ascent + i * page.line);
    });
  }
  return canvas;
}

// A font of the page that is not there yet: calls again once it has arrived, to draw
// the text with it
export function whenFontArrives(text: string, font: string, again: () => void): void {
  const css = cssFont(font, SIZE);
  if (typeof document === "undefined" || !document.fonts || document.fonts.check(css, text)) return;
  document.fonts.load(css, text).then((loaded) => { if (loaded.length > 0) again(); }, () => {});
}
