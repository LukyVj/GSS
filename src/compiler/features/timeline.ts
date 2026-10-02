// animation-timeline: scroll() and view(), like CSS scroll-driven animations (decision 96).
// The progress of the timeline, from 0 to 1, replaces the time of the animation; the
// runtime computes it from the page and sends it in uTimeline (one component each).
import type { Token } from "../syntax/tokenizer";
import { errorAt } from "../syntax/errors";
import { closingParen } from "../values/calc";
import type { Styles } from "../cascade/resolve";

export type Axis = "block" | "inline" | "x" | "y";
export type Timeline =
  // the scroll of a scroll container: the page (root), or the nearest one around the scene
  | { type: "scroll"; scroller: "root" | "nearest"; axis: Axis }
  // the scene's canvas crossing its scroll container, from entering to leaving
  | { type: "view"; axis: Axis };

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

// Every different timeline of the scene, in the order they appear: their index is
// their component of uTimeline
export function sceneTimelines(nodes: Styles[]): Timeline[] {
  const found = new Map<string, Timeline>();
  for (const styles of nodes) {
    const value = styles["animation-timeline"];
    if (!value || !styles["animation"]) continue;
    const timeline = readTimeline(value);
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
