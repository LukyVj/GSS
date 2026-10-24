// transition, like CSS: a list of [<property> | all] <duration> [<easing>] [<delay>], and its
// longhands. The runtime glides each :hover with it (runtime/transitions.ts).
import type { Token } from "../syntax/tokenizer";
import type { Styles } from "../cascade/resolve";
import { findEasing, readEasing, type Easing } from "../values/easing";
import { errorAt } from "../syntax/errors";
import { clampComputed } from "../values/calc";
import { PROPERTIES } from "../registry/core";
import { splitList } from "./animation";

export type Transition = {
  duration: number; // in seconds
  delay: number; // in seconds; negative starts partway, like CSS
  easing: Easing;
};

// One item of the list: the property it glides ("all": every one), and how (null: instant)
export type TransitionEntry = { property: string; transition: Transition | null };

export const TRANSITION_LONGHANDS = [
  "transition-property",
  "transition-duration",
  "transition-timing-function",
  "transition-delay",
];

// The default easing of CSS transitions
const EASE: Easing = {
  type: "cubic-bezier",
  x1: 0.25,
  y1: 0.1,
  x2: 0.25,
  y2: 1,
};

// What a shorthand property sets: a transition of the shorthand glides them, like CSS
const SHORTHANDS: Record<string, string[]> = {
  outline: ["outline-width", "outline-style", "outline-color"],
};

const ERROR =
  "transition expects a property if needed, a duration, then an easing and a delay if needed, like: transition: scale 0.3s ease-out;";

// "0.3s" → 0.3, "300ms" → 0.3, anything else → null. A computed time is clamped at `min`, like CSS.
function seconds(token: Token, min = -Infinity): number | null {
  if (token.type !== "DIMENSION") return null;
  if (token.unit === "s") return clampComputed(token, min);
  if (token.unit === "ms") return clampComputed(token, min * 1000) / 1000;
  return null;
}

const isNone = (value: Token[]) => value.length === 1 && value[0].type === "IDENT" && value[0].value === "none";

// A property name of a transition: all, or a property GSS knows
function propertyName(token: Token): string {
  if (token.type !== "IDENT") throw errorAt(token, ERROR);
  if (token.value !== "all" && !token.value.startsWith("--") && !PROPERTIES.some((p) => p.name === token.value))
    throw errorAt(token, `Unknown property "${token.value}" in transition`);
  return token.value;
}

// One item of the shorthand
function readItem(item: Token[]): { property: string; duration: number; delay: number; easing: Easing | null } {
  const { easing, rest } = findEasing(item);
  let property: string | null = null;
  const times: number[] = [];
  for (const token of rest) {
    if (token.type === "IDENT") {
      if (property !== null) throw errorAt(item, ERROR);
      property = propertyName(token);
      continue;
    }
    const time = seconds(token, times.length === 0 ? 0 : -Infinity); // the duration is never negative
    if (time === null) throw errorAt(item, ERROR);
    times.push(time);
  }
  // The first time is the duration, the second the delay, like CSS
  const [duration, delay = 0] = times;
  if (duration === undefined || times.length > 2 || duration < 0) throw errorAt(item, ERROR);
  return { property: property ?? "all", duration, delay, easing };
}

// One value of a longhand, which takes one token (an easing: a few)
function one(styles: Styles, property: string, item: Token[], example: string): Token {
  if (item.length !== 1) throw errorAt(styles[property], `${property} expects a list of values, like: ${property}: ${example};`);
  return item[0];
}

// The transitions of an object or a state, in the order of the list: the shorthand, then
// each longhand at the same place, repeated when its list is shorter, like CSS. The
// longhands win over the shorthand. []: no transition, every change is instant.
export function readTransitions(styles: Styles): TransitionEntry[] {
  const shorthand = styles["transition"];
  const items = shorthand && !isNone(shorthand) ? splitList(shorthand) : [];
  if (shorthand && !isNone(shorthand) && items.length > 1 && items.some((item) => isNone(item)))
    throw errorAt(shorthand, "transition: none stands alone, like CSS");
  const parsed = items.map(readItem);

  const longhand = (property: string): Token[][] | null => {
    const value = styles[property];
    return value ? splitList(value) : null;
  };
  const properties = longhand("transition-property");
  if (properties && properties.length === 1 && isNone(properties[0])) return [];
  const durations = longhand("transition-duration");
  const easings = longhand("transition-timing-function");
  const delays = longhand("transition-delay");
  if (parsed.length === 0 && !properties && !durations && !easings && !delays) return [];

  // How many: the properties of transition-property, else the items of the shorthand, like CSS
  const count = properties?.length ?? Math.max(parsed.length, 1);
  const entries: TransitionEntry[] = [];
  for (let i = 0; i < count; i++) {
    const base = parsed.length > 0 ? parsed[i % parsed.length] : { property: "all", duration: 0, delay: 0, easing: null };
    let { property, duration, delay, easing } = base;
    if (properties) property = propertyName(one(styles, "transition-property", properties[i], "scale, color"));
    if (durations) {
      const time = seconds(one(styles, "transition-duration", durations[i % durations.length], "0.3s, 1s"), 0);
      if (time === null || time < 0)
        throw errorAt(styles["transition-duration"], "transition-duration expects durations, like: transition-duration: 0.3s, 1s;");
      duration = time;
    }
    if (delays) {
      const time = seconds(one(styles, "transition-delay", delays[i % delays.length], "0s, 0.2s"));
      if (time === null) throw errorAt(styles["transition-delay"], "transition-delay expects times, like: transition-delay: 0s, 0.2s;");
      delay = time;
    }
    if (easings) {
      const item = easings[i % easings.length];
      const read = findEasing(item);
      if (!read.easing || read.rest.length > 0)
        throw errorAt(
          styles["transition-timing-function"],
          "transition-timing-function expects easings, like: transition-timing-function: ease-out, linear;",
        );
      easing = read.easing ?? readEasing(item);
    }
    // 0 s without a delay: nothing to glide, the change is instant
    const transition = duration === 0 && delay <= 0 ? null : { duration, delay, easing: easing ?? EASE };
    entries.push({ property, transition });
  }
  return entries;
}

// Whether an item of the list names a property: itself, all, or its shorthand
function names(item: string, property: string): boolean {
  return item === "all" || item === property || (SHORTHANDS[item]?.includes(property) ?? false);
}

// The transition of one property: the last item of the list that names it, like CSS.
// null: none names it, the change is instant.
export function transitionOf(entries: TransitionEntry[], property: string): Transition | null {
  for (let i = entries.length - 1; i >= 0; i--) if (names(entries[i].property, property)) return entries[i].transition;
  return null;
}

// The different transitions of a list, the first first: the ones a state glides with
export function distinctTransitions(entries: TransitionEntry[]): (Transition | null)[] {
  const found: (Transition | null)[] = [];
  for (const { transition } of entries) if (!found.some((t) => sameTransition(t, transition))) found.push(transition);
  return found;
}

export function sameTransition(a: Transition | null, b: Transition | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// The transition of every property, until each property reads its own
export function readTransition(value: Token[] | undefined): Transition | null {
  return value ? transitionOf(readTransitions({ transition: value }), "all") : null;
}
