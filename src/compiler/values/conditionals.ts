// if(), like CSS: if(media(width < 600px): 1; style(--theme: night): 2; else: 3).
// Resolved at compile time, after var() (decision 81): media() reads the @media version
// being compiled, style() reads the custom properties of the object.
import type { Token } from "../syntax/tokenizer";
import { errorAt } from "../syntax/errors";
import { textOf } from "../syntax/parser";
import { closingParen } from "./calc";
import { resolveVars, type Variables } from "../cascade/vars";

const EXAMPLE = "if(media(width < 600px): 0.6; else: 1)";

const isCall = (tokens: Token[], i: number, name: string) =>
  tokens[i]?.type === "IDENT" &&
  (tokens[i] as { value: string }).value === name &&
  tokens[i + 1]?.type === "PUNCT" &&
  tokens[i + 1].value === "(";
const isPunct = (token: Token | undefined, value: string) =>
  token?.type === "PUNCT" && token.value === value;

// The media queries of the if() of a stylesheet: each becomes an @media version of the scene.
// media(width < 600px) is the query (width < 600px), media(print) stays print.
export function mediaQueriesOf(tokens: Token[]): string[] {
  const queries: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (isCall(tokens, i, "media")) queries.push(queryOf(tokens, i));
  }
  return queries;
}

function queryOf(tokens: Token[], i: number): string {
  const end = closingParen(tokens, i + 1);
  const inside = tokens.slice(i + 2, end);
  const text = textOf(inside);
  if (inside.length === 0) throw errorAt(tokens.slice(i, end + 1), `media() needs a query, like: ${EXAMPLE}`);
  return isPunct(inside[0], "(") || inside.length === 1 ? text : `(${text})`;
}

// Splits tokens at a separator that is outside any parentheses
function splitTop(tokens: Token[], separator: (t: Token) => boolean): Token[][] {
  const parts: Token[][] = [[]];
  let depth = 0;
  for (const token of tokens) {
    if (isPunct(token, "(")) depth++;
    if (isPunct(token, ")")) depth--;
    if (depth === 0 && separator(token)) parts.push([]);
    else parts[parts.length - 1].push(token);
  }
  return parts;
}

export function resolveIf(
  value: Token[],
  variables: Variables,
  media: Set<string>,
): Token[] {
  if (!value.some((_, i) => isCall(value, i, "if"))) return value;
  const out: Token[] = [];
  let i = 0;
  while (i < value.length) {
    if (!isCall(value, i, "if")) {
      out.push(value[i]);
      i++;
      continue;
    }
    const end = closingParen(value, i + 1);
    const call = value.slice(i, end + 1);
    out.push(...pick(value.slice(i + 2, end), call, variables, media));
    i = end + 1;
  }
  // A branch can hold another if()
  return resolveIf(out, variables, media);
}

// The value of the first branch whose condition is true
function pick(
  inside: Token[],
  call: Token[],
  variables: Variables,
  media: Set<string>,
): Token[] {
  const branches = splitTop(inside, (t) => isPunct(t, ";")).filter((b) => b.length > 0);
  for (const branch of branches) {
    const [condition, ...rest] = splitTop(branch, (t) => isPunct(t, ":"));
    // The value can hold ":" itself only inside parentheses; a second one at the top is a mistake
    if (rest.length !== 1 || condition.length === 0)
      throw errorAt(call, `Each branch of if() is a condition, ":" and a value, like: ${EXAMPLE}`);
    if (test(condition, call, variables, media)) {
      if (rest[0].length === 0) throw errorAt(call, "A branch of if() has no value");
      return rest[0];
    }
  }
  throw errorAt(call, `No condition of if() is true: add a last branch, like: else: 1`);
}

// else | [not] test | test and test … | test or test … (no mixing, like CSS)
function test(
  condition: Token[],
  call: Token[],
  variables: Variables,
  media: Set<string>,
): boolean {
  const word = (t: Token, w: string) => t.type === "IDENT" && t.value === w;
  if (condition.length === 1 && word(condition[0], "else")) return true;
  const ands = splitTop(condition, (t) => word(t, "and"));
  const ors = splitTop(condition, (t) => word(t, "or"));
  if (ands.length > 1 && ors.length > 1)
    throw errorAt(call, 'if() cannot mix "and" and "or" without parentheses');
  if (ands.length > 1) return ands.every((c) => test(c, call, variables, media));
  if (ors.length > 1) return ors.some((c) => test(c, call, variables, media));
  if (word(condition[0], "not")) return !test(condition.slice(1), call, variables, media);
  // (test): parentheses around a test
  if (isPunct(condition[0], "(") && closingParen(condition, 0) === condition.length - 1)
    return test(condition.slice(1, -1), call, variables, media);

  const end = condition.length - 1;
  if (isCall(condition, 0, "media") && closingParen(condition, 1) === end)
    return media.has(queryOf(condition, 0));
  if (isCall(condition, 0, "style") && closingParen(condition, 1) === end)
    return styleTest(condition.slice(2, end), call, variables);
  if (isCall(condition, 0, "supports"))
    throw errorAt(call, "if() in GSS knows media() and style(), not supports()");
  throw errorAt(call, `if() expects media(), style() or else as a condition, like: ${EXAMPLE}`);
}

// style(--x): the variable is set; style(--x: value): it is set to that value
function styleTest(inside: Token[], call: Token[], variables: Variables): boolean {
  const [name, colon, ...expected] = inside;
  if (name?.type !== "IDENT" || !name.value.startsWith("--"))
    throw errorAt(call, "style() tests a custom property, like: style(--theme: night)");
  if (!Object.hasOwn(variables, name.value)) return false;
  if (!colon) return true;
  if (!isPunct(colon, ":") || expected.length === 0)
    throw errorAt(call, "style() tests a custom property, like: style(--theme: night)");
  // Token by token: the type, the value and the unit, not the spaces
  const key = (tokens: Token[]) =>
    JSON.stringify(tokens.map((t) => [t.type, t.value, (t as { unit?: string }).unit]));
  return key(resolveVars(variables[name.value], variables)) === key(resolveVars(expected, variables));
}
