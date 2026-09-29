// var(--name) and var(--name, fallback), replaced by their value (decision 55)
// Like calc.ts: the rest of the compiler never sees a var().
import type { Token } from "./tokenizer";
import { errorAt } from "./errors";
import { closingParen } from "./calc";

export type Variables = Record<string, Token[]>;

// chain = the variables being resolved, to find loops: --a → --b → --a
export function resolveVars(
  value: Token[],
  variables: Variables,
  chain: string[] = [],
): Token[] {
  if (!value.some((_, i) => isVarCall(value, i))) return value; // nothing to replace: same array
  const out: Token[] = [];
  let i = 0;
  while (i < value.length) {
    if (!isVarCall(value, i)) {
      out.push(value[i]);
      i++;
      continue;
    }
    const end = closingParen(value, i + 1);
    const name = value[i + 2]; // var ( --name …

    if (name.type !== "IDENT" || !name.value.startsWith("--")) {
      throw errorAt(
        value.slice(i, end + 1),
        "var() expects a name that starts with --, like: var(--size)",
      );
    }

    const after = value[i + 3];
    if (!(i + 3 === end || (after.type === "PUNCT" && after.value === ","))) {
      throw errorAt(
        value.slice(i, end + 1),
        `expected "," or ")" after ${name.value}`,
      );
    }

    const fallback = value.slice(i + 4, end);

    if (name.value in variables) {
      if (chain.includes(name.value)) {
        throw errorAt(
          value.slice(i, end + 1),
          `${name.value} uses itself: ${[...chain, name.value].join(" → ")}`,
        );
      }
      // The value of a variable can use other variables: resolve them too.
      // A new array, not chain.push(): var(--x) + var(--x) is not a loop.
      out.push(
        ...resolveVars(variables[name.value], variables, [...chain, name.value]),
      );
    } else if (fallback.length > 0) {
      out.push(...resolveVars(fallback, variables, chain)); // read only when needed
    } else {
      throw errorAt(value.slice(i, end + 1), `${name.value} is not defined`);
    }

    i = end + 1;
  }
  return out;
}

function isVarCall(value: Token[], i: number): boolean {
  // Look at isMathCall in calc.ts: same idea, with a single name
  const token = value[i];
  const next = value[i + 1];
  return (
    token?.type === "IDENT" &&
    token.value === "var" &&
    next?.type === "PUNCT" &&
    next.value === "("
  );
}

// Does this value use one of these variables, directly or through another variable?
// translate: 0 var(--top) 0 with --top: calc(var(--h) + 1) uses --h.
export function usesVariables(
  value: Token[],
  names: Set<string>,
  variables: Variables,
  seen: Set<string> = new Set(),
): boolean {
  for (let i = 0; i < value.length; i++) {
    if (!isVarCall(value, i)) continue;
    const name = value[i + 2];
    if (name?.type !== "IDENT") continue;
    if (names.has(name.value)) return true;
    if (name.value in variables && !seen.has(name.value)) {
      seen.add(name.value); // a loop is reported by resolveVars, not here
      if (usesVariables(variables[name.value], names, variables, seen)) return true;
    }
  }
  return false;
}

// Does this list of tokens contain a var() call?
export function hasVar(value: Token[]): boolean {
  return value.some((_, i) => isVarCall(value, i));
}
