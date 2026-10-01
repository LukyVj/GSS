// calc() and the CSS math functions, computed at compile time (decision 52).
// "rotate-y: calc(sibling-index() * 30deg)" becomes "rotate-y: 90deg" for the third object:
// the rest of the compiler only ever sees plain numbers and dimensions.
import type { Token } from "../syntax/tokenizer";
import { errorAt, rememberSpan, spanAcross } from "../syntax/errors";

// Where the value is read: the position of the object among its siblings, if it is an object
export type CalcContext = { siblingIndex: number; siblingCount: number } | null;

// A computed quantity: 90 with unit "deg", 2 with unit "" (a plain number), 50 with "%"
type Quantity = { value: number; unit: string };

// The functions that compute something. Any other name( is left alone (metal(), path()…),
// but the math inside its arguments is still computed: metal(#fff, calc(0.1 * 2)).
export const MATH_FUNCTIONS = [
  "calc",
  "min",
  "max",
  "clamp",
  "abs",
  "sqrt",
  "pow",
  "sin",
  "cos",
  "tan",
  "sibling-index",
  "sibling-count",
] as const;
const isMathFunction = (name: string) =>
  (MATH_FUNCTIONS as readonly string[]).includes(name);

// Every unit is brought back to one per kind, so that 90deg + 0.25turn can be added
const ANGLES: Record<string, number> = {
  deg: 1,
  rad: 180 / Math.PI,
  turn: 360,
};
const TIMES: Record<string, number> = { s: 1, ms: 0.001 };

function normalize(quantity: Quantity): Quantity {
  if (quantity.unit in ANGLES)
    return { value: quantity.value * ANGLES[quantity.unit], unit: "deg" };
  if (quantity.unit in TIMES)
    return { value: quantity.value * TIMES[quantity.unit], unit: "s" };
  return quantity;
}

const describe = (q: Quantity) =>
  q.unit === ""
    ? "a number"
    : `a ${q.unit === "%" ? "percentage" : q.unit} value`;

// ----- The value: math functions are replaced by their result, the other tokens stay -----

export function resolveMath(value: Token[], context: CalcContext): Token[] {
  if (!value.some((_, i) => isMathCall(value, i))) return value; // nothing to compute: same array
  const out: Token[] = [];
  let i = 0;
  while (i < value.length) {
    if (!isMathCall(value, i)) {
      out.push(value[i]);
      i++;
      continue;
    }
    const end = closingParen(value, i + 1);
    const call = value.slice(i, end + 1);
    const reader = new Reader(call, context);
    const result = reader.expression();
    reader.finish();
    out.push(toToken(result, call));
    i = end + 1;
  }
  return out;
}

function isMathCall(value: Token[], i: number): boolean {
  const token = value[i];
  const next = value[i + 1];
  return (
    token?.type === "IDENT" &&
    isMathFunction(token.value) &&
    next?.type === "PUNCT" &&
    next.value === "("
  );
}

// The index of the ")" that closes the "(" at `open`
export function closingParen(tokens: Token[], open: number): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type !== "PUNCT") continue;
    if (token.value === "(") depth++;
    if (token.value === ")" && --depth === 0) return i;
  }
  throw errorAt(
    tokens.slice(open - 1),
    `${tokenText(tokens[open - 1])}( is never closed`,
  );
}

// The result, as a token the rest of the compiler already reads. It keeps the position
// of the whole call, so an error about it underlines "calc(…)".
function toToken(quantity: Quantity, call: Token[]): Token {
  const value = Math.round(quantity.value * 1e9) / 1e9; // cos(90deg) is 6e-17: that is 0
  const token: Token =
    quantity.unit === ""
      ? { type: "NUMBER", value }
      : quantity.unit === "%"
        ? { type: "PERCENTAGE", value }
        : { type: "DIMENSION", value, unit: quantity.unit };
  const span = spanAcross(call);
  if (span) rememberSpan(token, span);
  return token;
}

function tokenText(token: Token | undefined): string {
  if (!token) return "";
  if (token.type === "DIMENSION") return `${token.value}${token.unit}`;
  if (token.type === "PERCENTAGE") return `${token.value}%`;
  if (token.type === "HASH") return `#${token.value}`;
  if (token.type === "AT_KEYWORD") return `@${token.value}`;
  return String(token.value);
}

// ----- The expression: a small recursive descent, like the parser -----
//   sum     = product (("+" | "-") product)*
//   product = factor (("*" | "/") factor)*
//   factor  = number | dimension | percentage | pi | e | "(" sum ")" | function "(" arguments ")"

class Reader {
  private i = 0;
  private readonly tokens: Token[];
  private readonly context: CalcContext;

  constructor(tokens: Token[], context: CalcContext) {
    this.tokens = tokens;
    this.context = context;
  }

  private peek(): Token | undefined {
    return this.tokens[this.i];
  }
  private isPunct(value: string): boolean {
    const token = this.peek();
    return token?.type === "PUNCT" && token.value === value;
  }
  private expect(value: string, what: string): void {
    if (!this.isPunct(value)) throw this.error(`${what}: expected "${value}"`);
    this.i++;
  }
  private error(message: string): Error {
    return errorAt(this.tokens, message);
  }

  // Nothing may be left after the value
  finish(): void {
    if (this.i < this.tokens.length) {
      throw this.error(
        `Unexpected "${tokenText(this.peek())}" in ${tokenText(this.tokens[0])}()`,
      );
    }
  }

  // The whole call: calc(…), sin(…), sibling-index()…
  expression(): Quantity {
    return this.factor();
  }

  private sum(): Quantity {
    let left = this.product();
    while (this.isPunct("+") || this.isPunct("-")) {
      const operator = (this.peek() as { value: string }).value;
      this.i++;
      const right = this.product();
      left = this.add(left, right, operator);
    }
    // "2 -1": the tokenizer reads "-1" as a number, so the operator is missing
    const next = this.peek();
    if (
      (next?.type === "NUMBER" || next?.type === "DIMENSION") &&
      next.value < 0
    ) {
      throw this.error(`Put spaces around "-" in math, like CSS: calc(a - b)`);
    }
    return left;
  }

  private product(): Quantity {
    let left = this.factor();
    while (this.isPunct("*") || this.isPunct("/")) {
      const operator = (this.peek() as { value: string }).value;
      this.i++;
      const right = this.factor();
      left =
        operator === "*"
          ? this.multiply(left, right)
          : this.divide(left, right);
    }
    return left;
  }

  private factor(): Quantity {
    const token = this.peek();
    if (!token)
      throw this.error(`${tokenText(this.tokens[0])}() is missing a value`);

    if (token.type === "NUMBER")
      return this.take({ value: token.value, unit: "" });
    if (token.type === "PERCENTAGE")
      return this.take({ value: token.value, unit: "%" });
    if (token.type === "DIMENSION") {
      if (!(token.unit in ANGLES) && !(token.unit in TIMES)) {
        throw this.error(
          `Unknown unit "${token.unit}" in math. Use deg, rad, turn, s or ms.`,
        );
      }
      return this.take(normalize({ value: token.value, unit: token.unit }));
    }
    if (token.type === "PUNCT" && token.value === "(") {
      this.i++;
      const inside = this.sum();
      this.expect(")", "Parentheses");
      return inside;
    }
    if (token.type === "IDENT") {
      const next = this.tokens[this.i + 1];
      if (next?.type === "PUNCT" && next.value === "(")
        return this.call(token.value);
      if (token.value === "pi") return this.take({ value: Math.PI, unit: "" });
      if (token.value === "e") return this.take({ value: Math.E, unit: "" });
      throw this.error(`"${token.value}" is not a value math can use`);
    }
    throw this.error(
      `Unexpected "${tokenText(token)}" in ${tokenText(this.tokens[0])}()`,
    );
  }

  private take(quantity: Quantity): Quantity {
    this.i++;
    return quantity;
  }

  // name( argument, argument… )
  private call(name: string): Quantity {
    if (!isMathFunction(name))
      throw this.error(`${name}() cannot be used inside math`);
    this.i += 2; // the name and "("
    const args: Quantity[] = [];
    if (!this.isPunct(")")) {
      args.push(this.sum());
      while (this.isPunct(",")) {
        this.i++;
        args.push(this.sum());
      }
    }
    this.expect(")", `${name}()`);
    return this.apply(name, args);
  }

  private apply(name: string, args: Quantity[]): Quantity {
    const count = (n: number, example: string) => {
      if (args.length !== n)
        throw this.error(
          `${name}() takes ${n === 0 ? "no" : n} argument${n === 1 ? "" : "s"}, like: ${example}`,
        );
    };
    const plain = (q: Quantity) => {
      if (q.unit !== "")
        throw this.error(`${name}() expects a number, not ${describe(q)}`);
      return q.value;
    };
    // An angle, or a number of radians, like CSS
    const radians = (q: Quantity) => {
      if (q.unit === "deg") return (q.value * Math.PI) / 180;
      return plain(q);
    };

    switch (name) {
      case "calc":
        count(1, "calc(2 * 30deg)");
        return args[0];
      case "sibling-index":
      case "sibling-count": {
        count(0, `${name}()`);
        if (!this.context) {
          throw this.error(
            `${name}() only works in a rule that styles objects: the scene and @keyframes have no siblings`,
          );
        }
        const value =
          name === "sibling-index"
            ? this.context.siblingIndex
            : this.context.siblingCount;
        return { value, unit: "" };
      }
      case "min":
      case "max": {
        if (args.length === 0)
          throw this.error(
            `${name}() needs at least one value, like: ${name}(1, 2)`,
          );
        const unit = this.sameUnit(args, name);
        const pick = name === "min" ? Math.min : Math.max;
        return { value: pick(...args.map((a) => a.value)), unit };
      }
      case "clamp": {
        count(3, "clamp(0, calc(sibling-index() * 0.2), 1)");
        const unit = this.sameUnit(args, name);
        const [low, value, high] = args.map((a) => a.value);
        return { value: Math.min(Math.max(value, low), high), unit };
      }
      case "abs":
        count(1, "abs(-2)");
        return { value: Math.abs(args[0].value), unit: args[0].unit };
      case "sqrt":
        count(1, "sqrt(2)");
        return { value: Math.sqrt(plain(args[0])), unit: "" };
      case "pow":
        count(2, "pow(2, 3)");
        return { value: Math.pow(plain(args[0]), plain(args[1])), unit: "" };
      case "sin":
      case "cos":
      case "tan": {
        count(1, `${name}(30deg)`);
        const angle = radians(args[0]);
        return { value: Math[name](angle), unit: "" };
      }
    }
    throw this.error(`${name}() cannot be used inside math`);
  }

  private sameUnit(args: Quantity[], name: string): string {
    const unit = args[0].unit;
    const other = args.find((a) => a.unit !== unit);
    if (other)
      throw this.error(
        `${name}() mixes ${describe(args[0])} and ${describe(other)}`,
      );
    return unit;
  }

  private add(a: Quantity, b: Quantity, operator: string): Quantity {
    if (a.unit !== b.unit) {
      throw this.error(
        `Cannot ${operator === "+" ? "add" : "subtract"} ${describe(a)} and ${describe(b)}`,
      );
    }
    return {
      value: operator === "+" ? a.value + b.value : a.value - b.value,
      unit: a.unit,
    };
  }

  private multiply(a: Quantity, b: Quantity): Quantity {
    if (a.unit !== "" && b.unit !== "") {
      throw this.error(
        `Cannot multiply ${describe(a)} by ${describe(b)}: one of them must be a number`,
      );
    }
    return { value: a.value * b.value, unit: a.unit || b.unit };
  }

  private divide(a: Quantity, b: Quantity): Quantity {
    if (b.value === 0) throw this.error("Division by zero");
    if (b.unit === "") return { value: a.value / b.value, unit: a.unit };
    if (b.unit === a.unit) return { value: a.value / b.value, unit: "" }; // 90deg / 30deg = 3
    throw this.error(`Cannot divide ${describe(a)} by ${describe(b)}`);
  }
}
