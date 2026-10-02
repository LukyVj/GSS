// Timing curves, as in CSS: the keywords, cubic-bezier(), linear() and steps().
// One reading here; the runtime (transitions) and the shader (@keyframes) compute them.
import type { Token } from "../syntax/tokenizer";
import { readFunction } from "./values";
import { clampComputed, closingParen } from "./calc";
import { errorAt } from "../syntax/errors";

// How a progress from 0 to 1 is bent over time
export type Easing =
  | { type: "cubic-bezier"; x1: number; y1: number; x2: number; y2: number }
  // input: the moment (0 to 1), output: the progress at that moment
  | { type: "linear"; points: { input: number; output: number }[] }
  // count equal jumps; where the jumps are: at the start, the end, both or neither
  | { type: "steps"; count: number; position: StepPosition };
export type StepPosition = "jump-start" | "jump-end" | "jump-none" | "jump-both";

// The CSS keywords (CSS Easing Functions, level 1)
const KEYWORDS: Record<string, Easing> = {
  ease: { type: "cubic-bezier", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  "ease-in": { type: "cubic-bezier", x1: 0.42, y1: 0, x2: 1, y2: 1 },
  "ease-out": { type: "cubic-bezier", x1: 0, y1: 0, x2: 0.58, y2: 1 },
  "ease-in-out": { type: "cubic-bezier", x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  linear: {
    type: "linear",
    points: [
      { input: 0, output: 0 },
      { input: 1, output: 1 },
    ],
  },
  "step-start": { type: "steps", count: 1, position: "jump-start" },
  "step-end": { type: "steps", count: 1, position: "jump-end" },
};

// The easing functions, documented in the registry
export const EASING_FUNCTIONS = ["cubic-bezier", "linear", "steps"];

const BEZIER_ERROR =
  "cubic-bezier() expects four numbers, x1 and x2 from 0 to 1, like: cubic-bezier(0.25, 0.1, 0.25, 1)";
const STEPS_ERROR =
  "steps() expects a whole number of steps, then jump-start, jump-end, jump-none, jump-both, start or end, like: steps(4, jump-end)";
const LINEAR_ERROR =
  "linear() expects at least two numbers, each with up to two percentages, like: linear(0, 0.8 60%, 1)";

// One easing: a keyword or a function. null when the value is not an easing.
export function readEasing(value: Token[]): Easing | null {
  // 1. A keyword
  const [first] = value;
  if (
    value.length === 1 &&
    first.type === "IDENT" &&
    Object.hasOwn(KEYWORDS, first.value)
  )
    return KEYWORDS[first.value];

  // 2. A function
  const call = readFunction(value);
  if (call?.name === "cubic-bezier") return readBezier(call.args, value);
  if (call?.name === "linear") return readLinear(call.args, value);
  if (call?.name === "steps") return readSteps(call.args, value);

  // 3. Anything else
  return null;
}

function readBezier(args: Token[][], value: Token[]): Easing {
  if (args.length !== 4) throw errorAt(value, BEZIER_ERROR);
  const [x1, y1, x2, y2] = args.map((arg, i) => {
    const [token] = arg;
    if (arg.length !== 1 || token.type !== "NUMBER")
      throw errorAt(value, BEZIER_ERROR);
    return i % 2 === 0 ? clampComputed(token, 0, 1) : token.value; // a computed x is clamped, like CSS
  });
  // x is time: it stays between 0 and 1. y can overshoot (a bounce).
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) throw errorAt(value, BEZIER_ERROR);
  return { type: "cubic-bezier", x1, y1, x2, y2 };
}

// steps(4) or steps(4, jump-start): start and end are the old names of jump-start and jump-end
function readSteps(args: Token[][], value: Token[]): Easing {
  if (args.length < 1 || args.length > 2) throw errorAt(value, STEPS_ERROR);
  const [count] = args[0];
  if (
    args[0].length !== 1 ||
    count.type !== "NUMBER" ||
    !Number.isInteger(count.value) ||
    count.value < 1
  )
    throw errorAt(value, STEPS_ERROR);
  let position: StepPosition = "jump-end";
  if (args[1]) {
    const [keyword] = args[1];
    const name =
      args[1].length === 1 && keyword.type === "IDENT" ? keyword.value : "";
    const names: Record<string, StepPosition> = {
      start: "jump-start",
      end: "jump-end",
      "jump-start": "jump-start",
      "jump-end": "jump-end",
      "jump-none": "jump-none",
      "jump-both": "jump-both",
    };
    if (!Object.hasOwn(names, name)) throw errorAt(value, STEPS_ERROR);
    position = names[name];
  }
  if (position === "jump-none" && count.value < 2)
    throw errorAt(value, "steps() with jump-none needs at least 2 steps, like: steps(2, jump-none)");
  return { type: "steps", count: count.value, position };
}

// How a steps() easing is computed, by the runtime and the shader: the progress x
// becomes min(floor(x · count) + offset, jumps) / jumps, like CSS
export function stepsShape(easing: { count: number; position: StepPosition }) {
  const { count, position } = easing;
  const jumps =
    position === "jump-both" ? count + 1 : position === "jump-none" ? count - 1 : count;
  const offset = position === "jump-start" || position === "jump-both" ? 1 : 0;
  return { jumps, offset };
}

// linear(0, 0.25 75%, 1): a stop is an output, then 0, 1 or 2 positions.
// The missing positions are filled like CSS does (CSS Easing Functions, level 2).
function readLinear(args: Token[][], value: Token[]): Easing {
  // 1. The points as written: an output, and its positions when there are some
  if (args.length < 2) throw errorAt(value, LINEAR_ERROR);
  const written: { input: number | null; output: number }[] = [];
  for (const arg of args) {
    const [output, ...positions] = arg;
    if (output.type !== "NUMBER" || positions.length > 2)
      throw errorAt(value, LINEAR_ERROR);
    if (positions.length === 0)
      written.push({ input: null, output: output.value });
    for (const position of positions) {
      if (position.type !== "PERCENTAGE") throw errorAt(value, LINEAR_ERROR);
      written.push({ input: position.value / 100, output: output.value });
    }
  }

  // 2. The first point starts at 0, the last ends at 1, unless written
  written[0].input ??= 0;
  written[written.length - 1].input ??= 1;

  // 3. A position never goes back: it takes the largest one before it
  let largest = -Infinity;
  for (const point of written) {
    if (point.input === null) continue;
    point.input = Math.max(point.input, largest);
    largest = point.input;
  }

  // 4. A run of points without a position is spread evenly between its neighbours
  for (let i = 1; i < written.length; i++) {
    if (written[i].input !== null) continue;
    let end = i;
    while (written[end].input === null) end++;
    const from = written[i - 1].input!;
    const to = written[end].input!;
    const steps = end - (i - 1);
    for (let k = i; k < end; k++)
      written[k].input = from + ((to - from) * (k - (i - 1))) / steps;
    i = end;
  }

  return {
    type: "linear",
    points: written.map((p) => ({ input: p.input!, output: p.output })),
  };
}

// The easing among the tokens of a shorthand (animation, transition), and the rest.
// null when there is none; two easings are an error.
export function findEasing(value: Token[]): {
  easing: Easing | null;
  rest: Token[];
} {
  let easing: Easing | null = null;
  const rest: Token[] = [];
  for (let i = 0; i < value.length; i++) {
    const token = value[i];
    const next = value[i + 1];
    let found: Easing | null = null;
    let end = i;
    if (
      token.type === "IDENT" &&
      next?.type === "PUNCT" &&
      next.value === "("
    ) {
      if (EASING_FUNCTIONS.includes(token.value)) {
        end = closingParen(value, i + 1);
        found = readEasing(value.slice(i, end + 1));
      }
    } else if (token.type === "IDENT" && Object.hasOwn(KEYWORDS, token.value)) {
      found = KEYWORDS[token.value];
    }
    if (!found) {
      rest.push(token);
      continue;
    }
    if (easing)
      throw errorAt(value.slice(i, end + 1), "only one easing is allowed here");
    easing = found;
    i = end;
  }
  return { easing, rest };
}
