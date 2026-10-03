// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { dragTo, keyTo, limitsFor, defaultSize, mountSplitter, STORAGE_KEY } from "./splitter";

// The separator between the editor and the scene (decision 123): a window splitter, like
// the WAI-ARIA pattern. x: the editor on the left, its width; y (a phone): the editor
// under the scene, its height.

describe("limitsFor", () => {
  it("keeps room for the editor and for the scene", () => {
    expect(limitsFor("x", 1200)).toEqual({ min: 280, max: 880 });
    expect(limitsFor("y", 700)).toEqual({ min: 120, max: 540 });
  });
  it("never gives a max under the min, on a tiny window", () => {
    expect(limitsFor("x", 500)).toEqual({ min: 280, max: 280 });
  });
});

describe("defaultSize", () => {
  it("is about 480px for the editor, never more than 40% of the width", () => {
    expect(defaultSize("x", 1600)).toBe(480);
    expect(defaultSize("x", 1000)).toBe(400);
    expect(defaultSize("x", 600)).toBe(280);
  });
  it("is 45% of the height on a phone", () => {
    expect(defaultSize("y", 600)).toBe(270);
  });
});

describe("dragTo", () => {
  const limits = { min: 280, max: 880 };
  it("follows the pointer between the min and the max", () => {
    expect(dragTo(500, limits, 480)).toEqual({ size: 500, collapsed: false });
    expect(dragTo(2000, limits, 480)).toEqual({ size: 880, collapsed: false });
    expect(dragTo(200, limits, 480)).toEqual({ size: 280, collapsed: false });
  });
  it("folds the panel below half the min, and keeps its last size to reopen", () => {
    expect(dragTo(100, limits, 480)).toEqual({ size: 480, collapsed: true });
  });
});

describe("keyTo", () => {
  const limits = { min: 280, max: 880 };
  const open = { size: 480, collapsed: false };
  it("moves by 16px, by 64px with Shift, toward the scene or the editor", () => {
    expect(keyTo("ArrowRight", false, "x", open, limits)).toEqual({ size: 496, collapsed: false });
    expect(keyTo("ArrowLeft", true, "x", open, limits)).toEqual({ size: 416, collapsed: false });
    // on a phone the editor is under the scene: up makes it taller
    expect(keyTo("ArrowUp", false, "y", { size: 300, collapsed: false }, { min: 120, max: 540 })).toEqual({ size: 316, collapsed: false });
    expect(keyTo("ArrowLeft", false, "y", open, limits)).toBeNull();
  });
  it("stops at the min and the max, Home and End go there", () => {
    expect(keyTo("ArrowLeft", true, "x", { size: 300, collapsed: false }, limits)).toEqual({ size: 280, collapsed: false });
    expect(keyTo("Home", false, "x", open, limits)).toEqual({ size: 280, collapsed: false });
    expect(keyTo("End", false, "x", open, limits)).toEqual({ size: 880, collapsed: false });
  });
  it("folds and unfolds with Enter, and an arrow toward the scene reopens", () => {
    expect(keyTo("Enter", false, "x", open, limits)).toEqual({ size: 480, collapsed: true });
    expect(keyTo("Enter", false, "x", { size: 480, collapsed: true }, limits)).toEqual({ size: 480, collapsed: false });
    expect(keyTo("ArrowRight", false, "x", { size: 480, collapsed: true }, limits)).toEqual({ size: 480, collapsed: false });
    expect(keyTo("ArrowLeft", false, "x", { size: 480, collapsed: true }, limits)).toEqual({ size: 480, collapsed: true });
  });
});

describe("mountSplitter", () => {
  let handle: HTMLElement;
  let axis: "x" | "y";
  const track = () => (axis === "x" ? { start: 0, end: 1200, length: 1200 } : { start: 52, end: 752, length: 700 });
  const pointer = (type: string, at: number, extra: PointerEventInit = {}) =>
    handle.dispatchEvent(
      new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX: at, clientY: at, ...extra }),
    );
  const width = () => document.body.style.getPropertyValue("--editor-width");
  const height = () => document.body.style.getPropertyValue("--editor-height");

  beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
    document.body.removeAttribute("style");
    document.body.innerHTML = '<aside id="editor"></aside><div class="splitter"></div>';
    handle = document.querySelector(".splitter")!;
    axis = "x";
  });

  it("is a focusable separator that controls the editor, at its default size", () => {
    mountSplitter({ root: document.body, handle, track, axis: () => axis });
    expect(handle.getAttribute("role")).toBe("separator");
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("aria-controls")).toBe("editor");
    expect(handle.tabIndex).toBe(0);
    expect(width()).toBe("480px");
    expect(handle.getAttribute("aria-valuenow")).toBe("40"); // 480 of 1200
  });

  it("follows a drag, and keeps the size the visitor chose", () => {
    mountSplitter({ root: document.body, handle, track, axis: () => axis });
    pointer("pointerdown", 480);
    expect(document.body.classList.contains("resizing")).toBe(true);
    pointer("pointermove", 600);
    expect(width()).toBe("600px");
    pointer("pointerup", 600);
    expect(document.body.classList.contains("resizing")).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).x).toEqual({ size: 600, collapsed: false });
  });

  it("folds the editor when dragged to the edge, and a click on the handle reopens it", () => {
    mountSplitter({ root: document.body, handle, track, axis: () => axis });
    pointer("pointerdown", 480);
    pointer("pointermove", 40);
    pointer("pointerup", 40);
    expect(document.body.classList.contains("editor-collapsed")).toBe(true);
    expect(handle.getAttribute("aria-valuenow")).toBe("0");
    expect(handle.getAttribute("aria-expanded")).toBe("false");
    pointer("pointerdown", 0);
    pointer("pointerup", 1); // a click, not a drag
    expect(document.body.classList.contains("editor-collapsed")).toBe(false);
    expect(width()).toBe("480px");
  });

  it("goes back to the default size on a double click, and forgets the choice", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: { size: 700, collapsed: false } }));
    mountSplitter({ root: document.body, handle, track, axis: () => axis });
    expect(width()).toBe("700px");
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(width()).toBe("480px");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).x).toBeUndefined();
  });

  it("answers the keyboard", () => {
    mountSplitter({ root: document.body, handle, track, axis: () => axis });
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true, bubbles: true }));
    expect(width()).toBe("416px");
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(document.body.classList.contains("editor-collapsed")).toBe(true);
  });

  it("keeps a stored size inside the window, without forgetting it", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: { size: 1100, collapsed: false } }));
    mountSplitter({ root: document.body, handle, track, axis: () => axis });
    expect(width()).toBe("880px"); // the scene keeps its 320px
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).x.size).toBe(1100);
  });

  it("sets the height of the editor on a phone, where it sits under the scene", () => {
    axis = "y";
    mountSplitter({ root: document.body, handle, track, axis: () => axis });
    expect(handle.getAttribute("aria-orientation")).toBe("horizontal");
    expect(height()).toBe("315px"); // 45% of 700
    pointer("pointerdown", 437);
    pointer("pointermove", 352); // 85px higher: the editor grows by 85px
    pointer("pointerup", 352);
    expect(height()).toBe("400px");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).y).toEqual({ size: 400, collapsed: false });
  });

  // A pointer the browser does not track (a synthetic event, a pointer already gone)
  // cannot be captured: the drag still follows its moves over the handle
  it("still drags when the pointer cannot be captured", () => {
    handle.setPointerCapture = () => {
      throw new DOMException("No active pointer with the given id is found.", "NotFoundError");
    };
    mountSplitter({ root: document.body, handle, track, axis: () => axis });
    pointer("pointerdown", 480);
    pointer("pointermove", 560);
    pointer("pointerup", 560);
    expect(width()).toBe("560px");
  });

  it("works when storage is blocked", () => {
    const get = localStorage.getItem;
    localStorage.getItem = () => {
      throw new Error("blocked");
    };
    expect(() => mountSplitter({ root: document.body, handle, track, axis: () => axis })).not.toThrow();
    localStorage.getItem = get;
  });
});
