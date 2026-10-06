// animation, like CSS: the shorthand and its longhands, read into one description.
// The shader plays it from iTime (codegen.ts); nothing is kept in JavaScript.
import type { Token } from "../syntax/tokenizer";
import type { Styles } from "../cascade/resolve";
import { findEasing, readEasing, type Easing } from "../values/easing";
import { errorAt } from "../syntax/errors";
import { clampComputed } from "../values/calc";
import { readTimeline, type Timeline } from "./timeline";

export type Direction =
  "normal" | "reverse" | "alternate" | "alternate-reverse";
export type Fill = "none" | "forwards" | "backwards" | "both";

export type AnimationSpec = {
  name: Token; // the @keyframes, as written (for the errors)
  duration: number; // seconds, > 0
  delay: number; // seconds; negative starts partway, like CSS
  iterations: number; // Infinity by default: GSS animations loop (CSS plays once)
  direction: Direction;
  fill: Fill;
  easing: Easing | null; // null: linear, the GSS default
  timeline?: Timeline; // scroll() or view(): its progress replaces the time (decision 96)
};

const DIRECTIONS: Direction[] = [
  "normal",
  "reverse",
  "alternate",
  "alternate-reverse",
];
const FILLS: Fill[] = ["none", "forwards", "backwards", "both"];

export const ANIMATION_LONGHANDS = [
  "animation-duration",
  "animation-delay",
  "animation-iteration-count",
  "animation-direction",
  "animation-fill-mode",
  "animation-timing-function",
  "animation-timeline",
];

const SHORTHAND_ERROR =
  "animation expects a @keyframes name, a duration, then if needed an easing, a delay, a number of iterations (or infinite), a direction and a fill mode, like: animation: float 2s ease-out 0.5s 3 alternate forwards;";

// "2s" → 2, "500ms" → 0.5, anything else → null
function seconds(token: Token): number | null {
  if (token.type !== "DIMENSION") return null;
  if (token.unit === "s") return token.value;
  if (token.unit === "ms") return token.value / 1000;
  return null;
}

// 3, 1.5 or infinite → a number of iterations; anything else → null
function iterationsOf(token: Token): number | null {
  if (token.type === "IDENT" && token.value === "infinite") return Infinity;
  if (token.type === "NUMBER" && clampComputed(token, 0) >= 0) return clampComputed(token, 0); // calc(-2) is 0, like CSS
  return null;
}

const isOneOf = <T extends string>(
  list: T[],
  token: Token,
): token is Token & { value: T } =>
  token.type === "IDENT" && (list as string[]).includes(token.value);

// Whether the styles say how many times the animation plays: a count or infinite in
// the shorthand, or animation-iteration-count. Without it, an animation started by a
// state plays once (decision 141), while an animation of the rest loops (decision 70).
export function countsIterations(styles: Styles): boolean {
  if (styles["animation-iteration-count"]) return true;
  return (styles["animation"] ?? []).slice(1).some((token) => iterationsOf(token) !== null);
}

// The animation of an object or a group, or null when it has none
export function readAnimation(styles: Styles): AnimationSpec | null {
  const value = styles["animation"];
  if (!value) {
    const longhand = ANIMATION_LONGHANDS.find((p) => styles[p]);
    if (longhand)
      throw errorAt(
        styles[longhand],
        `${longhand} changes an animation: write animation first, like: animation: float 2s;`,
      );
    return null;
  }

  // animation: none, like CSS: no animation (in @media (prefers-reduced-motion))
  if (
    value.length === 1 &&
    value[0].type === "IDENT" &&
    value[0].value === "none"
  )
    return null;

  // 1. The shorthand: the name first, then the easing anywhere, then the rest
  const [name, ...others] = value;
  const { easing, rest } = findEasing(others);
  const spec: AnimationSpec = {
    name,
    duration: 0,
    delay: 0,
    iterations: Infinity,
    direction: "normal",
    fill: "none",
    easing,
  };
  const times: number[] = [];
  let iterations: number | null = null;
  let direction: Direction | null = null;
  let fill: Fill | null = null;
  for (const token of rest) {
    const time = seconds(token);
    const count = iterationsOf(token);
    if (time !== null && times.length < 2) times.push(time);
    else if (count !== null && iterations === null) iterations = count;
    else if (isOneOf(DIRECTIONS, token) && direction === null)
      direction = token.value;
    else if (isOneOf(FILLS, token) && fill === null) fill = token.value;
    else throw errorAt(token, SHORTHAND_ERROR);
  }
  // The first time is the duration, the second the delay, like CSS
  if (times.length === 0 || times[0] <= 0)
    throw errorAt(
      value,
      "animation needs a duration, like: animation: float 2s;",
    );
  spec.duration = times[0];
  spec.delay = times[1] ?? 0;
  spec.iterations = iterations ?? Infinity;
  spec.direction = direction ?? "normal";
  spec.fill = fill ?? "none";

  // 2. The longhands win over the shorthand
  const one = (property: string, example: string): Token | null => {
    const tokens = styles[property];
    if (!tokens) return null;
    if (tokens.length !== 1)
      throw errorAt(
        tokens,
        `${property} expects one value, like: ${property}: ${example};`,
      );
    return tokens[0];
  };
  const wrong = (property: string, expected: string) =>
    errorAt(styles[property], `${property} expects ${expected}`);

  const duration = one("animation-duration", "2s");
  if (duration) {
    const time = seconds(duration);
    if (time === null || time <= 0)
      throw wrong(
        "animation-duration",
        "a duration, like: animation-duration: 2s;",
      );
    spec.duration = time;
  }
  const delay = one("animation-delay", "0.5s");
  if (delay) {
    const time = seconds(delay);
    if (time === null)
      throw wrong("animation-delay", "a time, like: animation-delay: 0.5s;");
    spec.delay = time;
  }
  const count = one("animation-iteration-count", "3");
  if (count) {
    const n = iterationsOf(count);
    if (n === null)
      throw wrong(
        "animation-iteration-count",
        "a number or infinite, like: animation-iteration-count: 3;",
      );
    spec.iterations = n;
  }
  const dir = one("animation-direction", "alternate");
  if (dir) {
    if (!isOneOf(DIRECTIONS, dir))
      throw wrong(
        "animation-direction",
        `${DIRECTIONS.join(", ")}, like: animation-direction: alternate;`,
      );
    spec.direction = dir.value;
  }
  const fillMode = one("animation-fill-mode", "forwards");
  if (fillMode) {
    if (!isOneOf(FILLS, fillMode))
      throw wrong(
        "animation-fill-mode",
        `${FILLS.join(", ")}, like: animation-fill-mode: forwards;`,
      );
    spec.fill = fillMode.value;
  }
  const timing = styles["animation-timing-function"];
  if (timing) {
    const read = readEasing(timing);
    if (!read)
      throw wrong(
        "animation-timing-function",
        "an easing, like: animation-timing-function: ease-out;",
      );
    spec.easing = read;
  }
  const timeline = styles["animation-timeline"];
  const read = timeline ? readTimeline(timeline) : null;
  if (read) spec.timeline = read;
  return spec;
}
