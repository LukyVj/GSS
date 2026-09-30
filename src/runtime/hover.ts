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
