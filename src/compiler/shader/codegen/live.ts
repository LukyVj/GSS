// Numbers known at compile time, or GLSL that reads a variable set from JS (decision 105).
// The shapes, materials and lights compute with them: two numbers give a number, written
// as before, so a scene without @property keeps its exact shader; a variable gives GLSL.
import type { Token } from "../../syntax/tokenizer";
import { errorAt } from "../../syntax/errors";
import { readNumber } from "../../values/values";
import { glslFloat } from "./glsl";
import { readFlatSize, readRadii, readSize } from "./read";

export type Num = number | string;

export const isLive = (n: Num): n is string => typeof n === "string";
export const anyLive = (list: Num[]) => list.some(isLive);
// A Num in GLSL
export const g = (n: Num) => (typeof n === "number" ? glslFloat(n) : n);

export const add = (a: Num, b: Num): Num => (isLive(a) || isLive(b) ? `(${g(a)} + ${g(b)})` : a + b);
export const sub = (a: Num, b: Num): Num => (isLive(a) || isLive(b) ? `(${g(a)} - ${g(b)})` : a - b);
export const mul = (a: Num, b: Num): Num => (isLive(a) || isLive(b) ? `(${g(a)} * ${g(b)})` : a * b);
export const div = (a: Num, b: Num): Num => (isLive(a) || isLive(b) ? `(${g(a)} / ${g(b)})` : a / b);
export const hypot = (...list: Num[]): Num =>
  anyLive(list) ? `length(vec${list.length}(${list.map(g).join(", ")}))` : Math.hypot(...(list as number[]));
// The smallest or the largest: the numbers folded into one, then each GLSL value
export const smallest = (...list: Num[]): Num => fold(list, "min", Math.min);
export const largest = (...list: Num[]): Num => fold(list, "max", Math.max);
function fold(list: Num[], name: string, pick: (...n: number[]) => number): Num {
  const known = list.filter((n): n is number => !isLive(n));
  const live = list.filter(isLive);
  if (live.length === 0) return pick(...known);
  const start = known.length > 0 ? g(pick(...known)) : live.shift()!;
  return live.reduce((acc: string, x) => `${name}(${acc}, ${x})`, start);
}

// The GLSL of a value that is a number set from JS, alone; null for any other value
export function liveCode(value: Token[] | undefined, what = "a size"): string | null {
  const token = value?.length === 1 ? value[0] : undefined;
  if (token?.type !== "EXPR") return null;
  if (token.syntax !== "number") throw errorAt(token, `${token.value} is a <${token.syntax}>: ${what} is a number`);
  return token.code;
}

// The GLSL of a registered variable that sizes something: never below 0
function liveSize(token: Token): string | null {
  const code = liveCode([token]);
  return code === null ? null : `max(${code}, 0.0)`;
}

// readNumber(), or the GLSL of a variable set from JS
export function liveNumber(value: Token[] | undefined, property: string, fallback: number, allowZero = false): Num {
  if (value?.length === 1) {
    const live = liveSize(value[0]);
    if (live) return live;
  }
  return readNumber(value, property, fallback, allowZero);
}

// readSize(), readFlatSize(), readRadii(): each number can be a variable set from JS
const liveList = (read: (value: Token[] | undefined) => number[]) => (value: Token[] | undefined): Num[] => {
  if (!value?.some((t) => t.type === "EXPR")) return read(value);
  // Each variable stands in as a number of its own while the reader checks the rest and
  // repeats what it repeats (size: 2 is 2 2 2), then takes its place
  const stand = (i: number) => 1e6 + i;
  const numbers: Num[] = read(value.map((t, i) => (t.type === "EXPR" ? { type: "NUMBER", value: stand(i) } : t)));
  return numbers.map((n) => {
    const i = typeof n === "number" ? n - 1e6 : -1;
    return i >= 0 && i < value.length && value[i].type === "EXPR" ? liveSize(value[i])! : n;
  });
};
export const liveSize3 = liveList(readSize);
export const liveFlatSize = liveList(readFlatSize);
export const liveRadii = liveList(readRadii);
