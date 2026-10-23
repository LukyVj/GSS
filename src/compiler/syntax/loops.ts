// Loops, like Sass, written the way CSS writes variables: a counter or a list, and a block
// written once for each of its values.
//
//   @for --i from 1 through 4 { .piece:nth-child(var(--i)) { translate: calc(var(--i) * 1.5) 0 0; } }
//   @scene { @each --shape in cube, sphere, cone { var(--shape).piece; } }
//
// Before anything else reads the tokens, unfoldLoops writes each block out once per value,
// with var(--i) replaced by that value, wherever it is: in @scene, around rules, in a rule,
// in a selector, in @keyframes, in a @mixin. What the parser reads next is what the author
// would have written by hand, so the rest of the compiler never sees a loop, and the shader
// is the same.
import type { Token } from "./tokenizer";
import { ErrorSink, errorAt, errorsOf, rememberSpan, spanAcross } from "./errors";
import { glue, spaceBetween } from "./nesting";

// A loop that never ends, or a typo in a bound (from 1 through 10000), stops here
export const MAX_STEPS = 1000;

type Loop = {
  at: Token; // @for, @each
  name: Token; // --i
  values: Token[][]; // one list of tokens per step
  body: Token[]; // between the braces
  end: number; // the index after the "}"
};

const isPunct = (token: Token | undefined, value: string): boolean =>
  token?.type === "PUNCT" && token.value === value;
const isWord = (token: Token | undefined, value: string): boolean =>
  token?.type === "IDENT" && token.value === value;
const isDashed = (token: Token | undefined): boolean =>
  token?.type === "IDENT" && token.value.startsWith("--");
const isLoop = (token: Token | undefined): boolean =>
  token?.type === "AT_KEYWORD" && (token.value === "for" || token.value === "each");

// The index of the "}" or ")" that closes the bracket at `open`, or -1 when it never closes
function closing(tokens: Token[], open: number): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    const token = tokens[i];
    if (isPunct(token, "(") || isPunct(token, "{")) depth++;
    if (isPunct(token, ")") || isPunct(token, "}")) depth--;
    if (depth === 0) return i;
  }
  return -1;
}

// Every @for and @each of the tokens, unfolded, inner loops included. A broken loop is
// reported, and left out with its block.
export function unfoldLoops(input: Token[], sink: ErrorSink, outer: string[] = []): Token[] {
  if (!input.some(isLoop)) return input;
  const out: Token[] = [];
  let i = 0;
  while (i < input.length) {
    if (!isLoop(input[i])) {
      out.push(input[i++]);
      continue;
    }
    let loop: Loop;
    try {
      loop = readLoop(input, i, outer);
    } catch (caught) {
      for (const error of errorsOf(caught)) sink.add(error);
      i = skipLoop(input, i);
      continue;
    }
    const name = String(loop.name.value);
    for (const value of loop.values)
      out.push(...unfoldLoops(substitute(loop.body, name, value), sink, [...outer, name]));
    i = loop.end;
  }
  return out;
}

// After a broken loop: up to the end of its block, or its ";"
function skipLoop(tokens: Token[], at: number): number {
  for (let i = at + 1; i < tokens.length; i++) {
    if (isPunct(tokens[i], ";")) return i + 1;
    if (isPunct(tokens[i], "}")) return i; // the block around it: left to it
    if (isPunct(tokens[i], "{")) {
      const end = closing(tokens, i);
      return end === -1 ? tokens.length : end + 1;
    }
  }
  return tokens.length;
}

// @for --i from 1 through 4 by 1 { … } or @each --x in a, b, c { … }, from the at-rule at `at`
function readLoop(tokens: Token[], at: number, outer: string[]): Loop {
  const keyword = tokens[at];
  const kind = String(keyword.value);
  const example = kind === "for" ? "@for --i from 1 through 4 { … }" : "@each --x in a, b, c { … }";
  const name = tokens[at + 1];
  if (!isDashed(name))
    throw errorAt(name ?? keyword, `@${kind} takes a name that starts with --, like: ${example}`);
  if (outer.includes(String(name.value)))
    throw errorAt(name, `${name.value} already counts the loop around this one: give this one another name`);
  // The header runs to the "{" of the block
  let open = at + 2;
  let depth = 0;
  while (open < tokens.length) {
    const token = tokens[open];
    // A value of @each between braces, {a, b}: after "in" or a comma, and before a comma
    // or the block
    const before = tokens[open - 1];
    if (kind === "each" && depth === 0 && isPunct(token, "{") && (isWord(before, "in") || isPunct(before, ","))) {
      const end = closing(tokens, open);
      if (end !== -1 && (isPunct(tokens[end + 1], ",") || isPunct(tokens[end + 1], "{"))) {
        open = end + 1;
        continue;
      }
    }
    if (depth === 0 && (isPunct(token, "{") || isPunct(token, ";") || isPunct(token, "}"))) break;
    if (isPunct(token, "(")) depth++;
    if (isPunct(token, ")")) depth--;
    open++;
  }
  if (!isPunct(tokens[open], "{"))
    throw errorAt(tokens.slice(at, Math.max(open, at + 2)), `@${kind} ${name.value} takes a block, like: ${example}`);
  const end = closing(tokens, open);
  if (end === -1) throw errorAt(tokens[open], `@${kind} ${name.value} never closed: "}" missing`);
  const header = tokens.slice(at + 2, open);
  const values = kind === "for" ? countFor(header, keyword, name) : listEach(header, name);
  if (values.length > MAX_STEPS)
    throw errorAt([keyword, ...header], `@each ${name.value} takes ${values.length} steps: ${MAX_STEPS} at most`);
  return { at: keyword, name, values, body: tokens.slice(open + 1, end), end: end + 1 };
}

// from <number> through|to <number> [by <number>]: the numbers it counts, each as a token.
// through counts the last one, to stops before it, like Sass; from 4 through 1 counts down.
function countFor(header: Token[], at: Token, name: Token): Token[][] {
  const shape = `@for ${name.value} from 1 through 4 { … }, or from 1 to 5 to leave the last one out`;
  const [fromWord, from, endWord, to, byWord, by, ...rest] = header;
  if (!isWord(fromWord, "from"))
    throw errorAt(fromWord ?? name, `"from" expected after @for ${name.value}, like: ${shape}`);
  const start = bound(from, fromWord, "from");
  if (!isWord(endWord, "through") && !isWord(endWord, "to"))
    throw errorAt(endWord ?? from, `"through" or "to" expected after the first number, like: ${shape}`);
  const stop = bound(to, endWord, String(endWord.value));
  let step = { value: 1, unit: start.unit };
  if (byWord !== undefined) {
    if (!isWord(byWord, "by"))
      throw errorAt(header.slice(5), `"by" and a step, or the block, expected after the last number`);
    step = bound(by, byWord, "by");
    if (step.value <= 0)
      throw errorAt(by, `The step after "by" is more than 0: the loop counts down by itself when the first number is the larger`);
  }
  if (rest.length > 0) throw errorAt(rest, `The block of @for ${name.value} expected after the step`);
  const units = [start, stop, ...(byWord ? [step] : [])].map((n) => n.unit);
  if (units.some((unit) => unit !== units[0]))
    throw errorAt(header, `The numbers of @for take the same unit: ${units.map((u) => u || "no unit").join(", ")}`);
  const down = stop.value < start.value;
  const inclusive = endWord.value === "through";
  let count = Math.floor(Math.abs(stop.value - start.value) / step.value + 1e-9) + 1;
  const last = Number((start.value + (down ? -1 : 1) * (count - 1) * step.value).toFixed(10));
  if (!inclusive && last === stop.value) count--;
  if (count > MAX_STEPS)
    throw errorAt([at, ...header], `@for ${name.value} takes ${count} steps: ${MAX_STEPS} at most`);
  // Counted by its index, so 0.1 + 0.1 + 0.1 gives 0.3, not 0.30000000000000004
  return Array.from({ length: count }, (_, k) => [
    numberToken(Number((start.value + (down ? -k : k) * step.value).toFixed(10)), start.unit),
  ]);
}

// A number of the header of @for, with its unit
function bound(token: Token | undefined, after: Token, word: string): { value: number; unit: string } {
  if (token?.type === "NUMBER") return { value: token.value, unit: "" };
  if (token?.type === "DIMENSION") return { value: token.value, unit: token.unit };
  if (token?.type === "PERCENTAGE") return { value: token.value, unit: "%" };
  throw errorAt(token ?? after, `A number expected after "${word}", like 1, 30deg or 10%`);
}

function numberToken(value: number, unit: string): Token {
  const token: Token =
    unit === "" ? { type: "NUMBER", value } : unit === "%" ? { type: "PERCENTAGE", value } : { type: "DIMENSION", value, unit };
  counted.add(token);
  return token;
}

// in a, b, {c, d}: the values of @each, split at the commas outside any bracket. A value
// with a comma of its own goes between braces, like an argument of @apply.
function listEach(header: Token[], name: Token): Token[][] {
  const [inWord, ...list] = header;
  if (!isWord(inWord, "in"))
    throw errorAt(inWord ?? name, `"in" expected after @each ${name.value}, like: @each ${name.value} in red, gold, teal { … }`);
  if (list.length === 0) throw errorAt(inWord, `@each ${name.value} has no value after "in"`);
  const values: Token[][] = [[]];
  const commas: Token[] = [];
  let depth = 0;
  for (const token of list) {
    if (isPunct(token, "(") || isPunct(token, "{")) depth++;
    if (isPunct(token, ")") || isPunct(token, "}")) depth--;
    if (depth === 0 && isPunct(token, ",")) {
      values.push([]);
      commas.push(token);
    } else values[values.length - 1].push(token);
  }
  values.forEach((value, n) => {
    if (value.length === 0) throw errorAt(commas[n - 1] ?? commas[n], `A value of @each ${name.value} is empty`);
  });
  return values.map((value) => {
    const last = value.length - 1;
    return isPunct(value[0], "{") && closing(value, 0) === last ? value.slice(1, last) : value;
  });
}

// The numbers @for counts were never written: each var() they replace gets a copy that
// points at it
const counted = new WeakSet<Token>();

// var(--i) and var(--i, fallback), replaced by the value of this step, wherever they are.
// Where a space was written stays written: "var(--shape).piece" is one compound selector,
// "#board var(--shape)" two.
function substitute(tokens: Token[], name: string, value: Token[]): Token[] {
  const out: Token[] = [];
  let space: boolean | undefined; // after a var(): was there a space before the next token?
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const read =
      token.type === "IDENT" && token.value === "var" && isPunct(tokens[i + 1], "(") && tokens[i + 2]?.value === name;
    const end = read ? closing(tokens, i + 1) : -1;
    if (end === -1) {
      out.push(space === undefined ? token : glue(token, space));
      space = undefined;
      i++;
      continue;
    }
    const before = tokens[i - 1];
    const first = space ?? (before !== undefined && spaceBetween(before, token));
    const call = spanAcross([token, tokens[end]]);
    value.forEach((part, n) => {
      let written = part;
      if (counted.has(part)) {
        written = { ...part };
        if (call) rememberSpan(written, call);
      }
      out.push(glue(written, n === 0 ? first : spaceBetween(value[n - 1], part)));
    });
    space = tokens[end + 1] ? spaceBetween(tokens[end], tokens[end + 1]) : undefined;
    i = end + 1;
  }
  return out;
}
