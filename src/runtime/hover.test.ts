import { describe, it, expect } from "vitest";
import { pickPixel, decodeId, hoverValues } from "./hover";

// Step 4b of :hover, the part without the GPU: where the mouse is, which object
// the picking pass found, and what goes in uHover[].

describe("pickPixel", () => {
  // A canvas shown at 200 × 100 CSS pixels, at (10, 20) in the page,
  // drawn with twice as many pixels (a retina screen: devicePixelRatio 2)
  const rect = { left: 10, top: 20, width: 200, height: 100 };

  it("gives the center of the canvas pixel under the mouse, y up like WebGL", () => {
    // top-left corner of the canvas: the first column, the last row
    expect(pickPixel(10, 20, rect, 400, 200)).toEqual([0.5, 199.5]);
    // the middle of the canvas
    expect(pickPixel(110, 70, rect, 400, 200)).toEqual([200.5, 99.5]);
  });

  it("is null when the mouse is outside the canvas", () => {
    expect(pickPixel(5, 50, rect, 400, 200)).toBeNull(); // left
    expect(pickPixel(50, 120, rect, 400, 200)).toBeNull(); // below
    expect(pickPixel(210, 50, rect, 400, 200)).toBeNull(); // the right edge is outside
  });
});

describe("decodeId", () => {
  it("reads the id the picking pass wrote: red + 256 × green", () => {
    expect(decodeId(new Uint8Array([3, 0, 0, 255]))).toBe(3);
    expect(decodeId(new Uint8Array([4, 1, 0, 255]))).toBe(260);
  });

  it("is 0 for the floor and the background: no object", () => {
    expect(decodeId(new Uint8Array([0, 0, 0, 255]))).toBe(0);
  });
});

describe("hoverValues", () => {
  // slot 0: #a (id 1) with cube:hover; slot 1: an object of #g (ids 2 and 3) with #g:hover cube
  const hover = [[1], [2, 3]];

  it("sets a slot to 1 when the object under the mouse is one of its triggers", () => {
    expect([...hoverValues(hover, 1)]).toEqual([1, 0]);
    expect([...hoverValues(hover, 3)]).toEqual([0, 1]);
  });

  it("sets every slot to 0 when nothing is hovered", () => {
    expect([...hoverValues(hover, 0)]).toEqual([0, 0]);
  });

  it("is a Float32Array, what gl.uniform1fv takes", () => {
    expect(hoverValues(hover, 1)).toBeInstanceOf(Float32Array);
  });
});
