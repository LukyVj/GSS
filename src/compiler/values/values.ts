// Reads values written as CSS functions: metal(#d4af37, 0.2), rgb(255 90 54)…
import type { Token } from "../syntax/tokenizer";
import type { Point } from "./svgpath";
import { errorAt } from "../syntax/errors";

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

  // The commas of this call, not those of a call inside it: metal(linear-gradient(a, b), 0.2)
  let depth = 0;
  const topComma = inside.map((token) => {
    if (isPunct(token, "(")) depth++;
    if (isPunct(token, ")")) depth--;
    return depth === 0 && isPunct(token, ",");
  });

  // 4. No comma: each token is one argument, like rgb(255 90 54)
  if (!topComma.includes(true)) {
    return { name: name.value, args: inside.map((token) => [token]) };
  }

  // 5. Commas: a new argument starts after each one
  const args: Token[][] = [[]];
  inside.forEach((token, i) => {
    if (topComma[i]) args.push([]);
    else args[args.length - 1].push(token);
  });
  if (args.some((arg) => arg.length === 0)) {
    throw new Error(`${name.value}( … ) has an empty argument`);
  }
  return { name: name.value, args };
}

// Reads polygon(0 1, 1 0, -1 0), like CSS clip-path: one point per argument.
// Returns null when the value is not a polygon.
export function readPolygon(value: Token[]): Point[] | null {
  const example = "like: polygon(0 1, 1 0, -1 0)";
  const call = readFunction(value);
  if (call?.name !== "polygon") return null;

  const points = call.args.map((arg) => {
    const [x, y] = arg;
    if (arg.length !== 2 || x.type !== "NUMBER" || y.type !== "NUMBER") {
      throw errorAt(
        arg,
        `each point of polygon() needs two numbers, ${example}`,
      );
    }
    return { x: x.value, y: y.value };
  });

  if (points.length < 3) {
    throw errorAt(value, `polygon() needs at least 3 points, ${example}`);
  }
  return points;
}


// Reads one number, or returns the fallback when the property is not set
export function readNumber(
  value: Token[] | undefined,
  property: string,
  fallback: number,
  allowZero = false,
): number {
  if (!value) return fallback;
  const [token] = value;
  if (
    value.length !== 1 ||
    token.type !== "NUMBER" ||
    token.value < 0 ||
    (token.value === 0 && !allowZero)
  ) {
    throw errorAt(
      value,
      `${property} expects one positive number, like: ${property}: 2;`,
    );
  }
  return token.value;
}

// Reads an angle (deg, rad, turn; 0 alone) and returns radians
export function readAngle(value: Token[]): number {
  const [token] = value;

  // One token expected
  if (value.length !== 1) {
    throw errorAt(value, "An angle is expected, like: 70deg");
  }

  // Special case: 0 without unit is accepted, like in CSS
  if (token.type === "NUMBER" && token.value === 0) {
    return 0;
  }

  // Everything else must have a unit
  if (token.type !== "DIMENSION") {
    throw errorAt(value, "An angle must have a unit, like: 70deg");
  }

  // The units
  if (token.unit === "deg") return (token.value * Math.PI) / 180;
  if (token.unit === "rad") return token.value;
  if (token.unit === "turn") return token.value * 2 * Math.PI;

  throw errorAt(
    value,
    `Unknown angle unit: "${token.unit}". Use deg, rad or turn.`,
  );
}
