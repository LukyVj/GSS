// scroll() and view() at run time (decision 96): the progress of each timeline of the
// scene, from the page, sent in uTimeline. Read every frame: no scroll listener to keep.
import type { Range, RangeEdge, Timeline } from "../compiler/features/timeline";

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

// scroll(): where the scroll is, from 0 at the start to 1 at the end
export function scrollProgress(position: number, scrollSize: number, clientSize: number): number {
  const range = scrollSize - clientSize;
  return range > 0 ? clamp01(position / range) : 0;
}

// view(): 0 when the scene's start edge enters the end of its scroll container
// (the bottom), 1 when its end edge leaves at the start (the top), like CSS
export function viewProgress(
  start: number,
  size: number,
  portStart: number,
  portSize: number,
): number {
  return clamp01((portStart + portSize - start) / (portSize + size));
}

// animation-range (decision 162): the progress inside a part of the timeline, like CSS.
// position: how far along the whole timeline, in pixels, out of length; subject: the size
// of the scene, port: the size of its scroll container (view(); 0 for scroll()).
export function rangeProgress(position: number, length: number, subject: number, port: number, range: Range): number {
  const inside = Math.min(subject, port);
  const outside = Math.max(subject, port);
  const at = (edge: RangeEdge): number => {
    const [from, to] = {
      cover: [0, length],
      contain: [inside, outside],
      entry: [0, inside],
      exit: [outside, length],
      "entry-crossing": [0, subject],
      "exit-crossing": [port, length],
    }[edge.name];
    return from + (edge.unit === "px" ? edge.offset : ((to - from) * edge.offset) / 100);
  };
  const start = at(range.start);
  const end = at(range.end);
  if (end <= start) return position >= end ? 1 : 0;
  return clamp01((position - start) / (end - start));
}

// The closest ancestor that scrolls on this axis, or null for the page, like
// scroll(nearest). Each frame, so a container that starts scrolling is found.
export function findScroller(
  element: Element,
  vertical: boolean,
  styleOf: (element: Element) => CSSStyleDeclaration = getComputedStyle,
): Element | null {
  // the parent, or the host of a shadow root: <gss-scene> keeps its canvas in one
  const up = (node: Element): Element | null =>
    node.parentElement ?? ((node.getRootNode?.() as ShadowRoot | undefined)?.host ?? null);
  for (let node = up(element); node; node = up(node)) {
    const page = typeof document !== "undefined" ? document : null;
    if (page && (node === page.scrollingElement || node === page.body)) return null;
    const overflow = vertical ? styleOf(node).overflowY : styleOf(node).overflowX;
    const room = vertical
      ? node.scrollHeight > node.clientHeight
      : node.scrollWidth > node.clientWidth;
    if (/auto|scroll|overlay/.test(overflow) && room) return node;
  }
  return null;
}

// GSS writes horizontally: block is the vertical axis, inline the horizontal one
const isVertical = (timeline: Timeline) =>
  timeline.axis === "block" || timeline.axis === "y";

function progressOf(timeline: Timeline, canvas: HTMLCanvasElement, override: number | null): number {
  if (override !== null && !timeline.range) return override;
  const vertical = isVertical(timeline);
  const nearest =
    timeline.type === "view" || timeline.scroller === "nearest"
      ? findScroller(canvas, vertical)
      : null;
  const root = document.scrollingElement ?? document.documentElement;
  if (timeline.type === "scroll") {
    const scroller = nearest ?? root;
    if (timeline.range) {
      const length = vertical ? scroller.scrollHeight - scroller.clientHeight : scroller.scrollWidth - scroller.clientWidth;
      const position = override !== null ? override * length : vertical ? scroller.scrollTop : scroller.scrollLeft;
      return rangeProgress(position, Math.max(length, 0), 0, 0, timeline.range);
    }
    return vertical
      ? scrollProgress(scroller.scrollTop, scroller.scrollHeight, scroller.clientHeight)
      : scrollProgress(scroller.scrollLeft, scroller.scrollWidth, scroller.clientWidth);
  }
  const box = canvas.getBoundingClientRect();
  const port = nearest
    ? nearest.getBoundingClientRect()
    : { top: 0, left: 0, height: window.innerHeight, width: window.innerWidth };
  if (timeline.range) {
    // The slider of the playground stands in for the place of the scene along the timeline
    const [start, subject, portStart, portSize] = vertical
      ? [box.top, box.height, port.top, port.height]
      : [box.left, box.width, port.left, port.width];
    const length = subject + portSize;
    const position = override !== null ? override * length : portStart + portSize - start;
    return rangeProgress(position, length, subject, portSize, timeline.range);
  }
  return vertical
    ? viewProgress(box.top, box.height, port.top, port.height)
    : viewProgress(box.left, box.width, port.left, port.width);
}

// uTimeline: one component per timeline; override: one progress for all (the slider)
export function timelineValues(
  timelines: Timeline[],
  canvas: HTMLCanvasElement,
  override: number | null,
): Float32Array {
  const values = new Float32Array(4);
  timelines.forEach((timeline, i) => {
    values[i] = progressOf(timeline, canvas, override);
  });
  return values;
}

// In the playground and the docs, which do not scroll: a slider over the scene stands
// in for the scroll. It shows only while the scene has a timeline.
export function createScrollSlider(canvas: HTMLCanvasElement) {
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "1";
  input.step = "0.001";
  input.value = "0";
  input.className = "gss-scroll-slider";
  input.setAttribute("aria-label", "Scroll progress");
  input.title = "Stands in for the scroll of the page";
  Object.assign(input.style, {
    position: "absolute",
    width: "min(240px, 60%)",
    transform: "translate(-50%, -100%)",
    margin: "0",
    accentColor: "#ff5a36",
    zIndex: "2",
  });
  // the camera must not turn while the slider is dragged
  input.addEventListener("pointerdown", (event) => event.stopPropagation());
  let shown = false;
  // A sibling of the canvas, so both are placed from the same box: at the bottom of
  // the scene, wherever the canvas is in the page
  const place = () => {
    input.style.left = `${canvas.offsetLeft + canvas.offsetWidth / 2}px`;
    input.style.top = `${canvas.offsetTop + canvas.offsetHeight - 12}px`;
  };
  return {
    // null: no timeline in the scene, nothing to stand in for. Read every frame.
    value(): number | null {
      if (!shown) return null;
      place();
      return Number(input.value);
    },
    show(visible: boolean): void {
      if (visible === shown) return;
      shown = visible;
      if (visible) {
        canvas.after(input);
        place();
      } else input.remove();
    },
    destroy(): void {
      input.remove();
    },
  };
}
