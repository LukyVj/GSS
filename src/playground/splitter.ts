// The separator between the editor and the scene of the playground (decision 123), like the
// window splitter of WAI-ARIA: drag it, double-click it for the default size, move it with
// the arrows (Shift: farther), fold the editor with Enter or by dragging it to the edge.
// x: the editor on the left, its width. y (a phone): the editor under the scene, its height.

export type Axis = "x" | "y";
export type Limits = { min: number; max: number };
export type Split = { size: number; collapsed: boolean }; // size: the open size, kept while folded

// Where only a choice of the visitor is kept, one per axis, never the default
export const STORAGE_KEY = "gss-playground-split";

const MIN = { x: 280, y: 120 }; // the editor stays usable
const SCENE = { x: 320, y: 160 }; // and so does the scene
const STEP = 16;
const BIG_STEP = 64;

export function limitsFor(axis: Axis, track: number): Limits {
  const min = MIN[axis];
  return { min, max: Math.max(min, track - SCENE[axis]) };
}

// About 480px for the editor (DESIGN.md), never more than 40% of the width; 45% of the
// height on a phone
export function defaultSize(axis: Axis, track: number): number {
  const size = axis === "x" ? Math.min(480, track * 0.4) : track * 0.45;
  return Math.round(Math.max(MIN[axis], size));
}

const clamp = (size: number, { min, max }: Limits) => Math.min(max, Math.max(min, size));

// The size a drag asks for. Below half the minimum, the editor folds and keeps its last size
export function dragTo(raw: number, limits: Limits, open: number): Split {
  if (raw < limits.min / 2) return { size: open, collapsed: true };
  return { size: clamp(raw, limits), collapsed: false };
}

// A key on the focused separator; null for a key it does not use
export function keyTo(key: string, shift: boolean, axis: Axis, split: Split, limits: Limits): Split | null {
  const grow = axis === "x" ? "ArrowRight" : "ArrowUp"; // toward the scene
  const shrink = axis === "x" ? "ArrowLeft" : "ArrowDown";
  const step = shift ? BIG_STEP : STEP;
  switch (key) {
    case "Enter":
      return { size: split.size, collapsed: !split.collapsed };
    case "Home":
      return { size: limits.min, collapsed: false };
    case "End":
      return { size: limits.max, collapsed: false };
    case grow:
      return split.collapsed
        ? { size: clamp(split.size, limits), collapsed: false }
        : { size: clamp(split.size + step, limits), collapsed: false };
    case shrink:
      return split.collapsed ? split : { size: clamp(split.size - step, limits), collapsed: false };
    default:
      return null;
  }
}

// The track the editor and the scene share: start and end on the axis of the drag.
// On x, the editor starts at `start`; on y, it ends at `end`.
export type Track = { start: number; end: number; length: number };

type Stored = Partial<Record<Axis, Split>>;

function load(): Stored {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {}; // private window, blocked storage or a broken value: the defaults
  }
}

function save(stored: Stored): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {} // just not remembered
}

export function mountSplitter({
  root,
  handle,
  track,
  axis,
}: {
  root: HTMLElement; // gets --editor-width or --editor-height, and the classes
  handle: HTMLElement;
  track: () => Track;
  axis: () => Axis;
}): { update: () => void } {
  const stored = load();
  // The current split, per axis: the stored one, or the default of the window
  const splitOf = (on: Axis): Split =>
    stored[on] ?? { size: defaultSize(on, track().length), collapsed: false };

  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-controls", "editor");
  handle.setAttribute("aria-label", "Resize the editor");
  handle.tabIndex = 0;

  // Shows a split, kept inside the window as it is now, without changing what is stored
  function apply(split: Split): void {
    const on = axis();
    const { length } = track();
    const limits = limitsFor(on, length);
    const size = clamp(split.size, limits);
    root.style.setProperty(on === "x" ? "--editor-width" : "--editor-height", `${size}px`);
    root.classList.toggle("editor-collapsed", split.collapsed);
    handle.setAttribute("aria-orientation", on === "x" ? "vertical" : "horizontal"); // the line it draws
    handle.setAttribute("aria-expanded", String(!split.collapsed));
    const percent = (value: number) => String(Math.round((value / length) * 100));
    handle.setAttribute("aria-valuenow", split.collapsed ? "0" : percent(size));
    handle.setAttribute("aria-valuemin", "0");
    handle.setAttribute("aria-valuemax", percent(limits.max));
    handle.title = split.collapsed ? "Show the editor" : "Drag to resize, double-click to reset";
  }

  function choose(split: Split): void {
    stored[axis()] = split;
    save(stored);
    apply(split);
  }

  // ----- Drag, and a click on the folded editor -----
  // start: the split before the drag, whose open size a fold keeps
  let drag: { id: number; from: number; moved: boolean; start: Split; split: Split } | null = null;
  const at = (event: PointerEvent) => (axis() === "x" ? event.clientX : event.clientY);
  const sizeAt = (point: number) => {
    const { start, end } = track();
    return axis() === "x" ? point - start : end - point;
  };

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault(); // no text selection, no focus jump
    try {
      handle.setPointerCapture(event.pointerId); // the moves keep coming, even off the handle
    } catch {} // a pointer the browser no longer tracks: the moves over the handle still count
    const start = splitOf(axis());
    drag = { id: event.pointerId, from: at(event), moved: false, start, split: start };
    root.classList.add("resizing");
  });
  handle.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved && Math.abs(at(event) - drag.from) < 3) return; // still a click
    drag.moved = true;
    const limits = limitsFor(axis(), track().length);
    drag.split = dragTo(sizeAt(at(event)), limits, drag.start.size);
    apply(drag.split);
  });
  const end = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    root.classList.remove("resizing");
    const { moved, split } = drag;
    drag = null;
    if (moved) choose(split);
    else if (split.collapsed) choose({ size: split.size, collapsed: false }); // a click reopens
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
  handle.addEventListener("lostpointercapture", (event) => end(event as PointerEvent));

  handle.addEventListener("dblclick", () => {
    delete stored[axis()]; // back to the default, which follows the window again
    save(stored);
    apply(splitOf(axis()));
  });

  handle.addEventListener("keydown", (event) => {
    const next = keyTo(event.key, event.shiftKey, axis(), splitOf(axis()), limitsFor(axis(), track().length));
    if (!next) return;
    event.preventDefault();
    choose(next);
  });

  // The window changes (a resize, a phone turned): the same choice, kept inside it
  const update = () => apply(splitOf(axis()));
  update();
  return { update };
}
