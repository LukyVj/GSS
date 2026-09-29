// var(--name) and var(--name, fallback), replaced by their value (decision __)
// Like calc.ts: the rest of the compiler never sees a var().
import type { Token } from "./tokenizer";
import { errorAt } from "./errors";
import { closingParen } from "./calc";

export type Variables = Record<string, Token[]>;

export function resolveVars(value: Token[], variables: Variables): Token[] {
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

    if (name.value in variables) out.push(...variables[name.value]);
    else if (fallback.length > 0) out.push(...resolveVars(fallback, variables));
    else throw errorAt(value.slice(i, end + 1), `${name.value} is not defined`);

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
