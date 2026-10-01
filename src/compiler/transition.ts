// transition: [all] <duration> [<easing>] [<delay>], one per object, like CSS.
// The runtime glides the :hover of the object with it (runtime/transitions.ts).
import type { Token } from "./tokenizer";
import { findEasing, type Easing } from "./easing";
import { errorAt } from "./errors";

export type Transition = {
  duration: number; // in seconds
  delay: number; // in seconds; negative starts partway, like CSS
  easing: Easing;
};

// The default easing of CSS transitions
const EASE: Easing = {
  type: "cubic-bezier",
  x1: 0.25,
  y1: 0.1,
  x2: 0.25,
  y2: 1,
};

const ERROR =
  "transition expects a duration, then an easing and a delay if needed, like: transition: 0.3s ease-out;";

// "0.3s" → 0.3, "300ms" → 0.3, anything else → null
function seconds(token: Token): number | null {
  if (token.type !== "DIMENSION") return null;
  if (token.unit === "s") return token.value;
  if (token.unit === "ms") return token.value / 1000;
  return null;
}

// null: no transition, the change is instant
export function readTransition(value: Token[] | undefined): Transition | null {
  if (!value) return null;
  if (
    value.length === 1 &&
    value[0].type === "IDENT" &&
    value[0].value === "none"
  )
    return null;

  const { easing, rest } = findEasing(value);

  // One transition for the whole object (a list per property comes later)
  if (rest.some((token) => token.type === "PUNCT" && token.value === ","))
    throw errorAt(
      value,
      "GSS takes one transition per object, for every property :hover changes, like: transition: 0.3s ease-out;",
    );

  const times: number[] = [];
  for (const token of rest) {
    // "all": every property, which is what a GSS transition does anyway
    if (token.type === "IDENT" && token.value === "all") continue;
    if (token.type === "IDENT")
      throw errorAt(
        token,
        `transition applies to every property :hover changes: write transition: 0.3s, without "${token.value}"`,
      );
    const time = seconds(token);
    if (time === null) throw errorAt(value, ERROR);
    times.push(time);
  }

  // The first time is the duration, the second the delay, like CSS
  const [duration, delay = 0] = times;
  if (duration === undefined || times.length > 2 || duration < 0)
    throw errorAt(value, ERROR);
  if (duration === 0 && delay <= 0) return null; // nothing to glide
  return { duration, delay, easing: easing ?? EASE };
}
