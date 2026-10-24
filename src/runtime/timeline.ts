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

// scroll() with animation-range: the progress inside the range, from the scroll of the page
// (scrolled, in pixels, out of length), or from the slider of the playground (override). Where
// the page cannot scroll, like the playground, the slider stands for one screen of scroll
// (clientSize): with no length, every range was over (decision 177).
export function scrollRangeProgress(scrolled: number, length: number, clientSize: number, override: number | null, range: Range): number {
  const span = override !== null && length <= 0 ? clientSize : Math.max(length, 0);
  const position = override !== null ? override * span : scrolled;
  return rangeProgress(position, span, 0, 0, range);
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

// animation-timeline: --name: the element of the page that declares the name, like CSS,
// with view-timeline-name (its way across its scroll container) or scroll-timeline-name
// (its own scroll). The axis and the inset are the ones of the same place in their lists.
export type NamedTimeline = { element: Element; kind: "view" | "scroll"; axis: string; inset: string[] };

const listOf = (value: string) => value.split(",").map((item) => item.trim());

// The properties of the timelines of an element: from its computed style, or, in a
// browser that does not know them (and drops them from its style sheets), from its
// style attribute
function timelineProperty(element: Element, property: string, style: CSSStyleDeclaration | null): string {
  if (style) return style.getPropertyValue(property);
  const attribute = element.getAttribute("style") ?? "";
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(attribute);
  return match ? match[1].trim() : "";
}

export function findNamedTimeline(
  name: string,
  elements: Iterable<Element>,
  styleOf: (element: Element) => CSSStyleDeclaration = getComputedStyle,
  supported = typeof CSS !== "undefined" && CSS.supports?.("view-timeline-name", "--a"),
): NamedTimeline | null {
  for (const element of elements) {
    const style = supported ? styleOf(element) : null;
    for (const kind of ["view", "scroll"] as const) {
      const names = listOf(timelineProperty(element, `${kind}-timeline-name`, style));
      const at = names.indexOf(name);
      if (at < 0) continue;
      const axes = listOf(timelineProperty(element, `${kind}-timeline-axis`, style) || "block");
      const insets = listOf(timelineProperty(element, "view-timeline-inset", style) || "auto");
      return {
        element,
        kind,
        axis: axes[at] ?? axes[axes.length - 1] ?? "block",
        inset: (insets[at] ?? insets[insets.length - 1] ?? "auto").split(/\s+/),
      };
    }
  }
  return null;
}

// view-timeline-inset in pixels, start then end: auto is 0, a percentage is of the scroll
// container, one value is both sides, like CSS
export function insetOf(inset: string[], portSize: number): [number, number] {
  const pixels = (value: string) =>
    value.endsWith("%") ? (parseFloat(value) / 100) * portSize : value.endsWith("px") ? parseFloat(value) : 0;
  return [pixels(inset[0] ?? "auto"), pixels(inset[1] ?? inset[0] ?? "auto")];
}

// The elements found for each name, checked again every frame; a name not found is
// looked for again at most twice a second (the page may add its element later)
const found = new Map<string, NamedTimeline>();
const missed = new Map<string, number>();
function namedTimeline(name: string): NamedTimeline | null {
  const known = found.get(name);
  if (known?.element.isConnected && findNamedTimeline(name, [known.element])) return known;
  found.delete(name);
  const now = performance.now();
  if (now - (missed.get(name) ?? -Infinity) < 500) return null;
  const result = findNamedTimeline(name, document.querySelectorAll("*"));
  if (result) {
    found.set(name, result);
    missed.delete(name);
  } else missed.set(name, now);
  return result;
}

// GSS writes horizontally: block is the vertical axis, inline the horizontal one
const isVertical = (timeline: { axis: string }) =>
  timeline.axis === "block" || timeline.axis === "y";

// The progress of a scroll container (scroll()), with its range
function scrollOf(scroller: Element, vertical: boolean, range: Range | undefined, override: number | null): number {
  if (range) {
    const length = vertical ? scroller.scrollHeight - scroller.clientHeight : scroller.scrollWidth - scroller.clientWidth;
    const scrolled = vertical ? scroller.scrollTop : scroller.scrollLeft;
    return scrollRangeProgress(scrolled, length, vertical ? scroller.clientHeight : scroller.clientWidth, override, range);
  }
  return vertical
    ? scrollProgress(scroller.scrollTop, scroller.scrollHeight, scroller.clientHeight)
    : scrollProgress(scroller.scrollLeft, scroller.scrollWidth, scroller.clientWidth);
}

// The progress of a subject crossing its scroll container (view()), with its range;
// inset: the pixels taken off the start and the end of the container
function viewOf(
  subject: Element,
  vertical: boolean,
  range: Range | undefined,
  override: number | null,
  inset: string[] = ["auto"],
): number {
  const nearest = findScroller(subject, vertical);
  const box = subject.getBoundingClientRect();
  const port = nearest
    ? nearest.getBoundingClientRect()
    : { top: 0, left: 0, height: window.innerHeight, width: window.innerWidth };
  const [start, size, outerStart, outerSize] = vertical
    ? [box.top, box.height, port.top, port.height]
    : [box.left, box.width, port.left, port.width];
  const [insetStart, insetEnd] = insetOf(inset, outerSize);
  const portStart = outerStart + insetStart;
  const portSize = Math.max(outerSize - insetStart - insetEnd, 0);
  if (range) {
    // The slider of the playground stands in for the place of the scene along the timeline
    const length = size + portSize;
    const position = override !== null ? override * length : portStart + portSize - start;
    return rangeProgress(position, length, size, portSize, range);
  }
  return viewProgress(start, size, portStart, portSize);
}

function progressOf(timeline: Timeline, canvas: HTMLCanvasElement, override: number | null): number {
  if (override !== null && !timeline.range) return override;
  if (timeline.type === "named") {
    const named = namedTimeline(timeline.name);
    // No element of the page declares it: the slider stands in for the scroll, as for
    // view() of the scene; on a page, the animation shows its first frame
    if (!named) return override !== null ? viewOf(canvas, true, timeline.range, override) : 0;
    const vertical = isVertical(named);
    return named.kind === "scroll"
      ? scrollOf(named.element, vertical, timeline.range, override)
      : viewOf(named.element, vertical, timeline.range, override, named.inset);
  }
  const vertical = isVertical(timeline);
  if (timeline.type === "scroll") {
    const nearest = timeline.scroller === "nearest" ? findScroller(canvas, vertical) : null;
    return scrollOf(nearest ?? document.scrollingElement ?? document.documentElement, vertical, timeline.range, override);
  }
  return viewOf(canvas, vertical, timeline.range, override);
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
