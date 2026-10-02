import type { Token } from "../../syntax/tokenizer";
import { errorAt } from "../../syntax/errors";

// The GLSL function behind each operation
export const OPERATIONS: Record<string, string> = {
  union: "opU",
  subtract: "opS",
  intersect: "opI",
};

// The smooth version of each operation, used when blend > 0
export const SMOOTH: Record<string, string> = {
  opU: "opSmoothU",
  opS: "opSmoothS",
  opI: "opSmoothI",
};

// Reads "union", "subtract" or "intersect" and returns the GLSL function name
export function readOperation(value: Token[] | undefined): string {
  // 1. Nothing written → union
  if (!value) return "opU";

  // 2. Look the name up in the table (only for an IDENT)
  const [token] = value;
  const operation =
    token.type === "IDENT" && Object.hasOwn(OPERATIONS, token.value)
      ? OPERATIONS[token.value]
      : undefined;

  // 3. Not found, or not exactly one value → error
  if (value.length !== 1 || !operation) {
    throw errorAt(
      value,
      "operation expects union, subtract or intersect, like: operation: subtract;",
    );
  }

  return operation;
}
