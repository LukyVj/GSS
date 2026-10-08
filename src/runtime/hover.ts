// :hover at run time, without the GPU: where the mouse is, which object the
// picking pass found, and what goes in uHover[]

type Rect = { left: number; top: number; width: number; height: number };

// The center of the canvas pixel under the mouse, y up like WebGL, or null outside.
// rect is the canvas on the page (CSS pixels), width × height its own pixels.
export function pickPixel(
  clientX: number,
  clientY: number,
  rect: Rect,
  width: number,
  height: number,
): [number, number] | null {
  const x = ((clientX - rect.left) / rect.width) * width;
  const y = ((clientY - rect.top) / rect.height) * height;
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  return [Math.floor(x) + 0.5, height - Math.floor(y) - 0.5];
}

// The id the picking pass wrote: red + 256 × green, 0 when it hit no object
export function decodeId(pixel: Uint8Array): number {
  return pixel[0] + pixel[1] * 256;
}

// uHover[]: 1 for each slot whose triggers include the object under the mouse
export function hoverValues(hover: number[][], id: number): Float32Array {
  return Float32Array.from(hover, (triggers) =>
    triggers.includes(id) ? 1 : 0,
  );
}

// uHover[] with :active (decision 95): the hover slots, then the pressed slots, which
// are 1 while their trigger is pressed (pressed: the id of the pressed object, 0: none)
export function pointerValues(
  hover: number[][],
  active: number[][] | undefined,
  hovered: number,
  pressed: number,
): Float32Array {
  if (!active) return hoverValues(hover, hovered);
  return Float32Array.from([
    ...hoverValues(hover, hovered),
    ...active.map((triggers) => (pressed !== 0 && triggers.includes(pressed) ? 1 : 0)),
  ]);
}

// The pressed object, like CSS: the one under the pointer when the button goes down,
// until it goes up, even if the pointer leaves it. A touch has no hover before it:
// the first answer of the picking pass after the press decides then.
export function createPress() {
  let id = 0;
  let waiting = false; // pressed over nothing known yet: the next pick decides
  return {
    get id() {
      return id;
    },
    down(hovered: number) {
      id = hovered;
      waiting = hovered === 0;
    },
    picked(found: number) {
      if (!waiting) return;
      id = found;
      waiting = false;
    },
    up() {
      id = 0;
      waiting = false;
    },
    reset() {
      id = 0;
      waiting = false;
    },
  };
}

// cursor (decision 161): the cursor of the object under the pointer, the one of :active when
// that object is the pressed one; "" leaves the page's own cursor (auto, or nothing set)
export function cursorAt(
  cursors: { id: number; hover: string; active: string }[] | undefined,
  hovered: number,
  pressed: number,
): string {
  const found = cursors?.find((cursor) => cursor.id === hovered);
  if (!found || hovered === 0) return "";
  const cursor = hovered === pressed ? found.active : found.hover;
  return cursor === "auto" ? "" : cursor;
}
