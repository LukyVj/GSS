// animation-timeline: scroll() and view(), like CSS scroll-driven animations (decision 96).
// The progress of the timeline, from 0 to 1, replaces the time of the animation; the
// runtime computes it from the page and sends it in uTimeline (one component each).
import type { Token } from "../syntax/tokenizer";
import { errorAt } from "../syntax/errors";
import { closingParen } from "../values/calc";
import type { Styles } from "../cascade/resolve";

export type Axis = "block" | "inline" | "x" | "y";
// animation-range (decision 162): the named ranges of view(), like CSS
export const RANGE_NAMES = ["cover", "contain", "entry", "exit", "entry-crossing", "exit-crossing"] as const;
export type RangeName = (typeof RANGE_NAMES)[number];
// A point of the timeline: a share of a named range, or pixels from its start
export type RangeEdge = { name: RangeName; offset: number; unit: "%" | "px" };
// The part of the timeline the animation plays on; absent: all of it (normal)
export type Range = { start: RangeEdge; end: RangeEdge };
export type Timeline =
  // the scroll of a scroll container: the page (root), or the nearest one around the scene
  | { type: "scroll"; scroller: "root" | "nearest"; axis: Axis; range?: Range }
  // the scene's canvas crossing its scroll container, from entering to leaving
  | { type: "view"; axis: Axis; range?: Range };

const AXES: Axis[] = ["block", "inline", "x", "y"];
const SCROLLERS = ["root", "nearest"];
// The components of uTimeline: a scene uses up to 4 different timelines
export const TIMELINE_COMPONENTS = ["x", "y", "z", "w"];

const isIdent = (token: Token | undefined, value: string) =>
  token?.type === "IDENT" && token.value === value;

// null: auto, the time (the default, like CSS)
export function readTimeline(value: Token[]): Timeline | null {
  if (value.length === 1 && isIdent(value[0], "auto")) return null;
  const name = value[0];
  const isCall =
    name?.type === "IDENT" &&
    (name.value === "scroll" || name.value === "view") &&
    value[1]?.type === "PUNCT" &&
    value[1].value === "(";
  if (!isCall)
    throw errorAt(
      value,
      "animation-timeline takes auto, scroll() or view(), like: animation-timeline: scroll();",
    );
  const close = closingParen(value, 1);
  if (close !== value.length - 1)
    throw errorAt(value, "animation-timeline takes one timeline: scroll() or view()");
  const args = value.slice(2, close);
  const type = name.value as "scroll" | "view";

  let axis: Axis | null = null;
  let scroller: string | null = null;
  for (const token of args) {
    if (token.type === "IDENT" && (AXES as string[]).includes(token.value)) {
      if (axis) throw errorAt(token, `${type}() takes one axis: block, inline, x or y`);
      axis = token.value as Axis;
    } else if (type === "scroll") {
      if (token.type !== "IDENT" || !SCROLLERS.includes(token.value))
        throw errorAt(
          token,
          "scroll() takes a scroller, root or nearest, and an axis, block, inline, x or y, like: scroll(root block)",
        );
      if (scroller) throw errorAt(token, "scroll() takes one scroller: root or nearest");
      scroller = token.value;
    } else if (token.type === "IDENT") {
      throw errorAt(token, "view() takes an axis: block, inline, x or y, like: view(block)");
    } else {
      throw errorAt(token, "view() takes an axis only: an inset is not supported yet");
    }
  }
  return type === "scroll"
    ? { type, scroller: (scroller ?? "nearest") as "root" | "nearest", axis: axis ?? "block" }
    : { type, axis: axis ?? "block" };
}

const keyOf = (timeline: Timeline) => JSON.stringify(timeline);

const RANGE_ERROR =
  "animation-range expects normal, a named range (cover, contain, entry, exit, entry-crossing, exit-crossing), a percentage or pixels, for the start then the end, like: animation-range: entry 10% exit 90%;";

// One edge as written: normal, a name with or without its offset, or an offset alone (of cover).
// null for normal. Returns the edges and whether each had an offset.
function readEdges(value: Token[], property: string): { edge: RangeEdge | null; offset: boolean }[] {
  const edges: { edge: RangeEdge | null; offset: boolean }[] = [];
  const offsetOf = (token: Token | undefined): Pick<RangeEdge, "offset" | "unit"> | null => {
    if (token?.type === "PERCENTAGE") return { offset: token.value, unit: "%" };
    if (token?.type === "DIMENSION" && token.unit === "px") return { offset: token.value, unit: "px" };
    if (token?.type === "NUMBER" && token.value === 0) return { offset: 0, unit: "%" };
    return null;
  };
  for (let i = 0; i < value.length; i++) {
    const token = value[i];
    const message = RANGE_ERROR.replace("animation-range", property);
    if (token.type === "IDENT" && token.value === "normal") edges.push({ edge: null, offset: false });
    else if (token.type === "IDENT" && (RANGE_NAMES as readonly string[]).includes(token.value)) {
      const offset = offsetOf(value[i + 1]);
      if (offset) i++;
      edges.push({ edge: { name: token.value as RangeName, offset: offset?.offset ?? 0, unit: offset?.unit ?? "%" }, offset: offset !== null });
    } else {
      const offset = offsetOf(token);
      if (!offset) throw errorAt(value, message);
      edges.push({ edge: { name: "cover", ...offset }, offset: true });
    }
  }
  return edges;
}

const START: RangeEdge = { name: "cover", offset: 0, unit: "%" };
const END: RangeEdge = { name: "cover", offset: 100, unit: "%" };
// A name alone is its start at the start, its end at the end, like CSS
const atEnd = ({ edge, offset }: { edge: RangeEdge | null; offset: boolean }): RangeEdge =>
  !edge ? END : offset ? edge : { ...edge, offset: 100 };

// animation-range and its longhands (decision 162). The longhands win over the shorthand,
// like the other longhands of animation in GSS. null: normal, the whole timeline.
export function readRange(styles: Styles): Range | null {
  let start = START;
  let end = END;
  const shorthand = styles["animation-range"];
  if (shorthand) {
    const edges = readEdges(shorthand, "animation-range");
    if (edges.length === 0 || edges.length > 2) throw errorAt(shorthand, RANGE_ERROR);
    start = edges[0].edge ?? START;
    // One name alone covers that range; one offset alone leaves the end at normal
    end = edges.length === 2 ? atEnd(edges[1]) : edges[0].edge && !edges[0].offset ? atEnd(edges[0]) : END;
  }
  const startValue = styles["animation-range-start"];
  if (startValue) {
    const edges = readEdges(startValue, "animation-range-start");
    if (edges.length !== 1) throw errorAt(startValue, RANGE_ERROR.replace("animation-range", "animation-range-start"));
    start = edges[0].edge ?? START;
  }
  const endValue = styles["animation-range-end"];
  if (endValue) {
    const edges = readEdges(endValue, "animation-range-end");
    if (edges.length !== 1) throw errorAt(endValue, RANGE_ERROR.replace("animation-range", "animation-range-end"));
    end = atEnd(edges[0]);
  }
  const same = (a: RangeEdge, b: RangeEdge) => a.name === b.name && a.offset === b.offset && a.unit === b.unit;
  return same(start, START) && same(end, END) ? null : { start, end };
}

// The timeline of a node with its range: the key of its component of uTimeline
export function timelineOf(styles: Styles): Timeline | null {
  const value = styles["animation-timeline"];
  const timeline = value ? readTimeline(value) : null;
  const range = readRange(styles);
  if (!range) return timeline;
  const at = styles["animation-range"] ?? styles["animation-range-start"] ?? styles["animation-range-end"];
  if (!timeline)
    throw errorAt(at, "animation-range needs animation-timeline: scroll() or view(), like CSS, where a range only counts on a scroll-driven animation");
  if (timeline.type === "scroll" && [range.start, range.end].some((edge) => edge.name !== "cover"))
    throw errorAt(at, "scroll() takes percentages or pixels in animation-range: entry, exit, contain and the crossings belong to view()");
  return { ...timeline, range };
}

// Every different timeline of the scene, in the order they appear: their index is
// their component of uTimeline
export function sceneTimelines(nodes: Styles[]): Timeline[] {
  const found = new Map<string, Timeline>();
  for (const styles of nodes) {
    const value = styles["animation-timeline"] ?? styles["animation-range"] ?? styles["animation-range-start"] ?? styles["animation-range-end"];
    if (!value || !styles["animation"]) continue;
    const timeline = timelineOf(styles);
    if (!timeline || found.has(keyOf(timeline))) continue;
    if (found.size === TIMELINE_COMPONENTS.length)
      throw errorAt(
        value,
        `A scene takes up to ${TIMELINE_COMPONENTS.length} timelines: scroll() and view() with their scroller and axis`,
      );
    found.set(keyOf(timeline), timeline);
  }
  return [...found.values()];
}

// The GLSL of a timeline's progress: uTimeline.x, .y…
export function timelineCode(timeline: Timeline, timelines: Timeline[]): string {
  const index = timelines.findIndex((t) => keyOf(t) === keyOf(timeline));
  return `uTimeline.${TIMELINE_COMPONENTS[index]}`;
}
