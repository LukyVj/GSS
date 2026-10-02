// calc() and the CSS math functions, computed at compile time (decision 52).
// "rotate-y: calc(sibling-index() * 30deg)" becomes "rotate-y: 90deg" for the third object:
// the rest of the compiler only ever sees plain numbers and dimensions.
import type { Token } from "../syntax/tokenizer";
import { errorAt, rememberSpan, spanAcross } from "../syntax/errors";
import { glslFloat } from "../shader/codegen/glsl";

// Where the value is read: the position of the object among its siblings, if it is an object.
// tag, id and groups (when known) give random() a seed of its own for each object.
type Node = { tag: string; id: string | null; siblingIndex: number };
export type CalcContext = {
  siblingIndex: number;
  siblingCount: number;
  tag?: string;
  id?: string | null;
  groups?: Node[];
} | null;

// A computed quantity: 90 with unit "deg", 2 with unit "" (a plain number), 50 with "%".
// A quantity that depends on a variable set from JS (@property, decision 105) is not known
// at compile time: code is its GLSL (angles in degrees, like value), name the variable.
type Quantity = { value: number; unit: string; code?: string; name?: string };

const isLive = (q: Quantity) => q.code !== undefined;
// A quantity in GLSL: its code, or its value as a float
const glsl = (q: Quantity) => q.code ?? glslFloat(Math.round(q.value * 1e6) / 1e6);
// A quantity computed on the GPU, from these quantities (the first variable names it)
const live = (code: string, unit: string, from: Quantity[]): Quantity => ({
  value: NaN,
  unit,
  code,
  name: from.find(isLive)?.name,
});
// GLSL in radians from GLSL in degrees: degrees(x) gives x back, without the round trip
function toRadians(code: string): string {
  const inner = code.match(/^degrees\((.*)\)$/)?.[1];
  if (inner !== undefined) {
    let depth = 0;
    const closesLast = [...inner].every((c) => (depth += c === "(" ? 1 : c === ")" ? -1 : 0) >= 0);
    if (closesLast && depth === 0) return inner;
  }
  return `radians(${code})`;
}

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
  "asin",
  "acos",
  "atan",
  "atan2",
  "sign",
  "round",
  "mod",
  "rem",
  "hypot",
  "log",
  "exp",
  "progress",
  "random",
  "sibling-index",
  "sibling-count",
] as const;
const isMathFunction = (name: string) =>
  (MATH_FUNCTIONS as readonly string[]).includes(name);

// The math function a misspelled name was meant to be: slibling-index → sibling-index.
// At most 2 letters added, removed or changed (Levenshtein distance), else null.
export function closestMathFunction(name: string): string | null {
  let best: string | null = null;
  let bestDistance = 3;
  for (const candidate of MATH_FUNCTIONS) {
    const distance = editDistance(name, candidate);
    if (distance < bestDistance) [best, bestDistance] = [candidate, distance];
  }
  return best;
}

function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

// Every unit is brought back to one per kind, so that 90deg + 0.25turn can be added
const ANGLES: Record<string, number> = {
  deg: 1,
  rad: 180 / Math.PI,
  turn: 360,
};
const TIMES: Record<string, number> = { s: 1, ms: 0.001 };
// The first argument of round(), like CSS: round(down, 2.7) is 2
const ROUNDING = ["nearest", "up", "down", "to-zero"];
const degrees = (radians: number): Quantity => ({ value: (radians * 180) / Math.PI, unit: "deg" });

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

export function resolveMath(
  value: Token[],
  context: CalcContext,
  property = "",
): Token[] {
  if (!value.some((_, i) => isMathCall(value, i))) return value; // nothing to compute: same array
  const out: Token[] = [];
  const randoms = { count: 0 }; // the random() calls of this value, numbered in order
  let i = 0;
  while (i < value.length) {
    if (!isMathCall(value, i)) {
      out.push(value[i]);
      i++;
      continue;
    }
    const end = closingParen(value, i + 1);
    const call = value.slice(i, end + 1);
    const reader = new Reader(call, context, property, randoms);
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

// The tokens a math function gave. A WeakSet, like the spans: no field is added to the tokens.
const computed = new WeakSet<Token>();

// A value is checked against the range its property allows. Like CSS, a value written as is
// that falls outside is an error, but a computed one is clamped to the range:
// calc(4 * 40% - 20%) is 100% in color-mix(). The caller still refuses what is out of range.
export function clampComputed(token: Token & { value: number }, min: number, max = Infinity): number {
  return computed.has(token) ? Math.min(Math.max(token.value, min), max) : token.value;
}

// The result, as a token the rest of the compiler already reads. It keeps the position
// of the whole call, so an error about it underlines "calc(…)".
function toToken(quantity: Quantity, call: Token[]): Token {
  if (isLive(quantity)) return liveToken(quantity, call);
  const value = Math.round(quantity.value * 1e9) / 1e9; // cos(90deg) is 6e-17: that is 0
  const token: Token =
    quantity.unit === ""
      ? { type: "NUMBER", value }
      : quantity.unit === "%"
        ? { type: "PERCENTAGE", value }
        : { type: "DIMENSION", value, unit: quantity.unit };
  computed.add(token);
  const span = spanAcross(call);
  if (span) rememberSpan(token, span);
  return token;
}

// A result computed on the GPU: the token var() gives for a registered variable, with
// the GLSL of the whole math. An angle goes back to radians, like the uniforms.
function liveToken(quantity: Quantity, call: Token[]): Token {
  const syntax = quantity.unit === "" ? "number" : quantity.unit === "%" ? "percentage" : quantity.unit === "deg" ? "angle" : null;
  if (!syntax)
    throw errorAt(call, `${quantity.name} is set from JS: a ${quantity.unit} value cannot come from it yet`);
  const code = syntax === "angle" ? toRadians(quantity.code!) : quantity.code!;
  const token: Token = { type: "EXPR", value: quantity.name!, code, syntax };
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
  private readonly property: string;
  private readonly randoms: { count: number };

  constructor(
    tokens: Token[],
    context: CalcContext,
    property = "",
    randoms = { count: 0 },
  ) {
    this.tokens = tokens;
    this.context = context;
    this.property = property;
    this.randoms = randoms;
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
    // A variable set from JS (decision 105): its uniform, an angle in degrees like the others
    if (token.type === "EXPR") {
      if (token.syntax === "color" || token.syntax === "length")
        throw this.error(`${token.value} is a ${token.syntax}: math works on numbers, angles and percentages`);
      const unit = token.syntax === "angle" ? "deg" : token.syntax === "percentage" ? "%" : "";
      const code = token.syntax === "angle" ? `degrees(${token.code})` : token.code;
      return this.take({ value: NaN, unit, code, name: token.value });
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
    if (!isMathFunction(name)) {
      const meant = closestMathFunction(name);
      throw this.error(
        meant
          ? `Unknown function ${name}(): did you mean ${meant}()?`
          : `${name}() cannot be used inside math`,
      );
    }
    this.i += 2; // the name and "("
    const args: Quantity[] = [];
    if (name === "random") return this.random();
    // round(up, 2.5, 1): the rounding strategy comes first, as a keyword
    let strategy = "nearest";
    const first = this.peek();
    if (name === "round" && first?.type === "IDENT" && ROUNDING.includes(first.value)) {
      strategy = first.value;
      this.i++;
      this.expect(",", "round()");
    }
    if (!this.isPunct(")")) {
      args.push(this.sum());
      while (this.isPunct(",")) {
        this.i++;
        args.push(this.sum());
      }
    }
    this.expect(")", `${name}()`);
    return this.apply(name, args, strategy);
  }

  private apply(name: string, args: Quantity[], strategy = "nearest"): Quantity {
    if (args.some(isLive)) return this.applyLive(name, args, strategy);
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
      // The inverse functions return an angle, in deg
      case "asin":
      case "acos":
      case "atan":
        count(1, `${name}(0.5)`);
        return degrees(Math[name](plain(args[0])));
      case "atan2": {
        count(2, "atan2(1, -1)");
        this.sameUnit(args, name);
        return degrees(Math.atan2(args[0].value, args[1].value));
      }
      case "sign":
        count(1, "sign(-2)");
        return { value: Math.sign(args[0].value), unit: "" };
      case "round": {
        if (args.length !== 1 && args.length !== 2)
          throw this.error("round() takes a value and a step, like: round(2.6, 0.5) or round(down, 2.6, 0.5)");
        const step = args[1] ?? { value: 1, unit: args[0].unit };
        const unit = this.sameUnit([args[0], step], name);
        if (step.value === 0) throw this.error("round() cannot round to a step of 0");
        const ratio = args[0].value / step.value;
        const rounded =
          strategy === "up" ? Math.ceil(ratio)
          : strategy === "down" ? Math.floor(ratio)
          : strategy === "to-zero" ? Math.trunc(ratio)
          : Math.floor(ratio + 0.5); // halfway goes up, like CSS
        return { value: rounded * step.value, unit };
      }
      // mod() takes the sign of the divisor, rem() the sign of the value, like CSS
      case "mod":
      case "rem": {
        count(2, `${name}(7, 3)`);
        const unit = this.sameUnit(args, name);
        const [a, b] = args.map((q) => q.value);
        if (b === 0) throw this.error(`${name}() cannot divide by 0`);
        const value = name === "mod" ? a - b * Math.floor(a / b) : a % b;
        return { value, unit };
      }
      case "hypot": {
        if (args.length === 0) throw this.error("hypot() needs at least one value, like: hypot(3, 4)");
        const unit = this.sameUnit(args, name);
        return { value: Math.hypot(...args.map((q) => q.value)), unit };
      }
      case "log": {
        if (args.length !== 1 && args.length !== 2)
          throw this.error("log() takes a number and an optional base, like: log(8, 2)");
        const value = Math.log(plain(args[0]));
        return { value: args[1] ? value / Math.log(plain(args[1])) : value, unit: "" };
      }
      case "exp":
        count(1, "exp(1)");
        return { value: Math.exp(plain(args[0])), unit: "" };
      // Where a value sits between a start and an end, from 0 to 1, like CSS
      case "progress": {
        count(3, "progress(sibling-index(), 1, sibling-count())");
        this.sameUnit(args, name);
        const [value, start, end] = args.map((q) => q.value);
        if (start === end) throw this.error("progress() needs a start and an end that differ");
        return { value: Math.min(Math.max((value - start) / (end - start), 0), 1), unit: "" };
      }
    }
    throw this.error(`${name}() cannot be used inside math`);
  }

  // The same functions with an argument known only on the GPU (decision 105): the units
  // are checked as above, the value is written in GLSL
  private applyLive(name: string, args: Quantity[], strategy: string): Quantity {
    const count = (n: number, example: string) => {
      if (args.length !== n)
        throw this.error(`${name}() takes ${n} argument${n === 1 ? "" : "s"}, like: ${example}`);
    };
    const plain = (q: Quantity) => {
      if (q.unit !== "") throw this.error(`${name}() expects a number, not ${describe(q)}`);
      return glsl(q);
    };
    const radians = (q: Quantity) => (q.unit === "deg" ? toRadians(glsl(q)) : plain(q));
    const [a, b] = args.map(glsl);
    const out = (code: string, unit = "") => live(code, unit, args);
    switch (name) {
      case "calc":
        count(1, "calc(2 * 30deg)");
        return args[0];
      case "min":
      case "max": {
        const unit = this.sameUnit(args, name);
        return out(args.map(glsl).reduce((acc, x) => `${name}(${acc}, ${x})`), unit);
      }
      case "clamp": {
        count(3, "clamp(0, calc(sibling-index() * 0.2), 1)");
        const unit = this.sameUnit(args, name);
        const [low, value, high] = args.map(glsl);
        return out(`min(max(${value}, ${low}), ${high})`, unit);
      }
      case "abs":
      case "sign":
        count(1, `${name}(-2)`);
        return out(`${name}(${a})`, name === "abs" ? args[0].unit : "");
      case "sqrt":
      case "exp":
        count(1, `${name}(2)`);
        return out(`${name}(${plain(args[0])})`);
      case "pow":
        count(2, "pow(2, 3)");
        return out(`pow(${plain(args[0])}, ${plain(args[1])})`);
      case "sin":
      case "cos":
      case "tan":
        count(1, `${name}(30deg)`);
        return out(`${name}(${radians(args[0])})`);
      case "asin":
      case "acos":
      case "atan":
        count(1, `${name}(0.5)`);
        return out(`degrees(${name}(${plain(args[0])}))`, "deg");
      case "atan2":
        count(2, "atan2(1, -1)");
        this.sameUnit(args, name);
        return out(`degrees(atan(${a}, ${b}))`, "deg");
      case "round": {
        if (args.length !== 1 && args.length !== 2)
          throw this.error("round() takes a value and a step, like: round(2.6, 0.5) or round(down, 2.6, 0.5)");
        const step = args[1] ?? { value: 1, unit: args[0].unit };
        const unit = this.sameUnit([args[0], step], name);
        const ratio = `(${a} / ${glsl(step)})`;
        const rounded =
          strategy === "up" ? `ceil(${ratio})`
          : strategy === "down" ? `floor(${ratio})`
          : strategy === "to-zero" ? `trunc(${ratio})`
          : `floor(${ratio} + 0.5)`; // halfway goes up, like CSS
        return out(`(${rounded} * ${glsl(step)})`, unit);
      }
      case "mod":
      case "rem": {
        count(2, `${name}(7, 3)`);
        const unit = this.sameUnit(args, name);
        // mod() takes the sign of the divisor, like GLSL's mod(); rem() the sign of the value
        return out(name === "mod" ? `mod(${a}, ${b})` : `(${a} - ${b} * trunc((${a} / ${b})))`, unit);
      }
      case "hypot": {
        const unit = this.sameUnit(args, name);
        return out(`sqrt(${args.map(glsl).map((x) => `${x} * ${x}`).join(" + ")})`, unit);
      }
      case "log": {
        if (args.length !== 1 && args.length !== 2)
          throw this.error("log() takes a number and an optional base, like: log(8, 2)");
        const value = `log(${plain(args[0])})`;
        return out(args[1] ? `(${value} / log(${plain(args[1])}))` : value);
      }
      case "progress": {
        count(3, "progress(sibling-index(), 1, sibling-count())");
        this.sameUnit(args, name);
        const [value, start, end] = args.map(glsl);
        return out(`clamp((${value} - ${start}) / (${end} - ${start}), 0.0, 1.0)`);
      }
    }
    throw this.error(`${name}() cannot be used inside math`);
  }

  // random([--name || element-shared | fixed <number>,]? min, max, step?), like CSS.
  // Computed once, at compile time: the same value at every reload. By default each
  // object, property and call gets its own value; --name shares one between the calls
  // of an object that use it, element-shared between objects, fixed gives the value.
  private random(): Quantity {
    let name = "";
    let shared = false;
    let fixed: number | null = null;
    const example = "random(0.2, 1.4) or random(0deg, 360deg, 45deg)";
    // The options, before the first comma
    while (this.peek()?.type === "IDENT") {
      const word = (this.peek() as { value: string }).value;
      if (word.startsWith("--") && !name) name = word;
      else if (word === "element-shared" && !shared) shared = true;
      else if (word === "fixed" && fixed === null && !name && !shared) {
        this.i++;
        const n = this.peek();
        if (n?.type !== "NUMBER" || n.value < 0 || n.value >= 1)
          throw this.error("random(fixed …) expects a number from 0 to just below 1, like: random(fixed 0.5, 0, 10)");
        fixed = n.value;
      } else break;
      this.i++;
      if (this.isPunct(",")) {
        this.i++;
        break;
      }
    }
    const args: Quantity[] = [this.sum()];
    while (this.isPunct(",")) {
      this.i++;
      args.push(this.sum());
    }
    this.expect(")", "random()");
    if (args.length !== 2 && args.length !== 3)
      throw this.error(`random() takes a minimum, a maximum and an optional step, like: ${example}`);
    const fromJs = args.find(isLive);
    if (fromJs)
      throw this.error(`random() cannot use ${fromJs.name}: a random value is chosen once, when the scene compiles`);
    const unit = this.sameUnit(args, "random");
    const [min, max, step] = args.map((q) => q.value);

    // The seed: what makes this call different from the others
    const call = ++this.randoms.count;
    const where = name || `${this.property}#${call}`;
    const who = shared ? "*" : elementKey(this.context);
    const r = fixed ?? unitRandom(`${who}|${where}|${min}|${max}|${step ?? ""}`);

    if (step === undefined || step <= 0 || max < min)
      return { value: min + r * (max - min), unit };
    // With a step: one of min, min + step, … up to max
    const choices = Math.floor((max - min) / step + 1e-9) + 1;
    return { value: min + Math.floor(r * choices) * step, unit };
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
    if (isLive(a) || isLive(b)) return live(`(${glsl(a)} ${operator} ${glsl(b)})`, a.unit, [a, b]);
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
    if (isLive(a) || isLive(b)) return live(`(${glsl(a)} * ${glsl(b)})`, a.unit || b.unit, [a, b]);
    return { value: a.value * b.value, unit: a.unit || b.unit };
  }

  private divide(a: Quantity, b: Quantity): Quantity {
    if (isLive(a) || isLive(b)) {
      const unit = b.unit === "" ? a.unit : b.unit === a.unit ? "" : null;
      if (unit === null) throw this.error(`Cannot divide ${describe(a)} by ${describe(b)}`);
      return live(`(${glsl(a)} / ${glsl(b)})`, unit, [a, b]);
    }
    if (b.value === 0) throw this.error("Division by zero");
    if (b.unit === "") return { value: a.value / b.value, unit: a.unit };
    if (b.unit === a.unit) return { value: a.value / b.value, unit: "" }; // 90deg / 30deg = 3
    throw this.error(`Cannot divide ${describe(a)} by ${describe(b)}`);
  }
}

// The place of an object in @scene, which stays the same when objects are added after it:
// "group#ring:2 > sphere:3"
function elementKey(context: CalcContext): string {
  if (!context) return "scene";
  const name = (n: { tag?: string; id?: string | null; siblingIndex: number }) =>
    `${n.tag ?? ""}${n.id ? `#${n.id}` : ""}:${n.siblingIndex}`;
  return [...(context.groups ?? []), context].map(name).join(" > ");
}

// A number from 0 to just below 1, always the same for the same text:
// the text is hashed (FNV-1a), then mixed (mulberry32)
function unitRandom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let t = (h + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
