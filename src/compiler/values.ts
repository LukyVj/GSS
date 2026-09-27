// Reads values written as CSS functions: metal(#d4af37, 0.2), rgb(255 90 54)…
import type { Token } from "./tokenizer";

export type FunctionCall = {
  name: string; // "metal"
  args: Token[][]; // one list of tokens per argument
};

const isPunct = (token: Token | undefined, value: string): boolean =>
  token?.type === "PUNCT" && token.value === value;

// Returns null when the value is not a function (jelly, #ff5a36, 2…)
export function readFunction(value: Token[]): FunctionCall | null {
  // 1. Is it "name(" ?
  const [name, open] = value;
  if (name?.type !== "IDENT" || !isPunct(open, "(")) return null;

  // 2. It must end with ")"
  if (!isPunct(value[value.length - 1], ")")) {
    throw new Error(`${name.value}( is never closed`);
  }

  // 3. The tokens between the parentheses
  const inside = value.slice(2, -1);
  if (inside.length === 0) return { name: name.value, args: [] };

  // 4. No comma: each token is one argument, like rgb(255 90 54)
  if (!inside.some((token) => isPunct(token, ","))) {
    return { name: name.value, args: inside.map((token) => [token]) };
  }

  // 5. Commas: a new argument starts after each one
  const args: Token[][] = [[]];
  for (const token of inside) {
    if (isPunct(token, ",")) args.push([]);
    else args[args.length - 1].push(token);
  }
  if (args.some((arg) => arg.length === 0)) {
    throw new Error(`${name.value}( … ) has an empty argument`);
  }
  return { name: name.value, args };
}
