import { describe, it, expect } from "vitest";
import { pickPixel, decodeId, hoverValues, pointerValues, createPress, cursorAt, controlsAllow } from "./hover";

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

describe("pointerValues", () => {
  // hover slots: #a (id 1), then #b (id 2); one :active slot after them: #b pressed
  const hover = [[1], [2]];
  const active = [[2]];

  it("puts the :active slots after the :hover slots", () => {
    expect([...pointerValues(hover, active, 2, 0)]).toEqual([0, 1, 0]);
    expect([...pointerValues(hover, active, 2, 2)]).toEqual([0, 1, 1]);
  });

  it("presses the object pressed, even when the pointer has left it, like CSS", () => {
    expect([...pointerValues(hover, active, 1, 2)]).toEqual([1, 0, 1]);
  });

  it("is hoverValues without :active", () => {
    expect([...pointerValues(hover, undefined, 1, 0)]).toEqual([...hoverValues(hover, 1)]);
  });
});

describe("createPress", () => {
  it("presses the object under the pointer when the button goes down", () => {
    const press = createPress();
    press.down(3);
    expect(press.id).toBe(3);
    press.up();
    expect(press.id).toBe(0);
  });

  it("waits for the picking pass when nothing was under the pointer yet (a touch)", () => {
    const press = createPress();
    press.down(0);
    expect(press.id).toBe(0);
    press.picked(4); // the first answer of the picking pass, one or two frames later
    expect(press.id).toBe(4);
    press.picked(5); // moving while pressed keeps the pressed object
    expect(press.id).toBe(4);
  });

  it("ignores the picking pass when nothing is pressed", () => {
    const press = createPress();
    press.picked(2);
    expect(press.id).toBe(0);
  });

  it("forgets the press when the scene changes", () => {
    const press = createPress();
    press.down(2);
    press.reset();
    expect(press.id).toBe(0);
    press.picked(2);
    expect(press.id).toBe(0);
  });
});

describe("cursorAt", () => {
  const cursors = [
    { id: 2, hover: "grab", active: "grabbing" },
    { id: 3, hover: "auto", active: "pointer" },
  ];

  it("gives the cursor of the object under the pointer, and leaves the page's own elsewhere", () => {
    expect(cursorAt(cursors, 2, 0)).toBe("grab");
    expect(cursorAt(cursors, 1, 0)).toBe("");
    expect(cursorAt(cursors, 0, 0)).toBe("");
    expect(cursorAt(undefined, 2, 0)).toBe("");
  });

  it("gives the cursor of :active over the pressed object only, and auto as the page's", () => {
    expect(cursorAt(cursors, 2, 2)).toBe("grabbing");
    expect(cursorAt(cursors, 2, 3)).toBe("grab");
    expect(cursorAt(cursors, 3, 0)).toBe("");
    expect(cursorAt(cursors, 3, 3)).toBe("pointer");
  });
});

describe("controlsAllow (decision 176)", () => {
  const pieces = { orbit: true, zoom: true, objects: [{ id: 2, orbit: false, zoom: true }] };

  it("lets every gesture move the camera without controls in the scene", () => {
    expect(controlsAllow(undefined, "orbit", 0)).toBe(true);
    expect(controlsAllow(undefined, "zoom", 3)).toBe(true);
  });

  it("follows the scene, whatever is under the pointer", () => {
    expect(controlsAllow({ orbit: false, zoom: true }, "orbit", 0)).toBe(false);
    expect(controlsAllow({ orbit: false, zoom: true }, "zoom", 0)).toBe(true);
    expect(controlsAllow({ orbit: false, zoom: false }, "zoom", 5)).toBe(false);
  });

  it("keeps a gesture from starting over an object that refuses it", () => {
    expect(controlsAllow(pieces, "orbit", 2)).toBe(false);
    expect(controlsAllow(pieces, "zoom", 2)).toBe(true);
    expect(controlsAllow(pieces, "orbit", 1)).toBe(true); // another object
    expect(controlsAllow(pieces, "orbit", 0)).toBe(true); // the floor or the background
  });
});
