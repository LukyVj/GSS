// The range of a value of the shader, read from its GLSL (decision 219): for each component,
// the lowest and the highest value it can take, at any moment and in any state of :hover.
// Interval arithmetic over the expressions GSS writes: + - * /, the functions of a keyframe
// (mix, clamp, smoothstep, cubicBezier…), a ternary (either side), and the uniforms of known
// range. Anything else has no range: then the object keeps no bounding sphere.

export type Range = { low: number[]; high: number[] };

type Uniforms = { steadyHover: boolean };

const constant = (values: number[]): Range => ({ low: values, high: [...values] });
const unknown = (size: number): Range => ({ low: Array(size).fill(-Infinity), high: Array(size).fill(Infinity) });
const size = (r: Range) => r.low.length;

// The same size for both sides: a scalar spreads to the size of the vector
function widen(a: Range, n: number): Range {
  if (size(a) === n) return a;
  if (size(a) !== 1) throw new Bail();
  return { low: Array(n).fill(a.low[0]), high: Array(n).fill(a.high[0]) };
}
function each(a: Range, b: Range, f: (al: number, ah: number, bl: number, bh: number) => [number, number]): Range {
  const n = Math.max(size(a), size(b));
  const [x, y] = [widen(a, n), widen(b, n)];
  const low: number[] = [], high: number[] = [];
  for (let i = 0; i < n; i++) {
    const [l, h] = f(x.low[i], x.high[i], y.low[i], y.high[i]);
    low.push(Number.isNaN(l) ? -Infinity : l);
    high.push(Number.isNaN(h) ? Infinity : h);
  }
  return { low, high };
}
const products = (al: number, ah: number, bl: number, bh: number): [number, number] => {
  const p = [al * bl, al * bh, ah * bl, ah * bh].map((v) => (Number.isNaN(v) ? 0 : v)); // 0 × ∞: 0 (a finite 0)
  return [Math.min(...p), Math.max(...p)];
};
const OPERATORS: Record<string, (a: Range, b: Range) => Range> = {
  "+": (a, b) => each(a, b, (al, ah, bl, bh) => [al + bl, ah + bh]),
  "-": (a, b) => each(a, b, (al, ah, bl, bh) => [al - bh, ah - bl]),
  "*": (a, b) => each(a, b, products),
  "/": (a, b) =>
    each(a, b, (al, ah, bl, bh) => (bl > 0 || bh < 0 ? products(al, ah, 1 / bh, 1 / bl) : [-Infinity, Infinity])),
};
const monotone = (f: (x: number) => number) => (a: Range): Range => ({ low: a.low.map(f), high: a.high.map(f) });
const within = (a: Range, low: number, high: number) => a.low.every((l) => l >= low) && a.high.every((h) => h <= high);
const hull = (a: Range, b: Range): Range => each(a, b, (al, ah, bl, bh) => [Math.min(al, bl), Math.max(ah, bh)]);

class Bail extends Error {}

// The functions GSS writes in an animated value, by their range
function call(name: string, args: Range[]): Range {
  const scalar = (n: number) => args.length === n;
  switch (name) {
    case "vec2": case "vec3": case "vec4": {
      const n = Number(name[3]);
      if (args.length === 1) return widen(args[0], n);
      const low = args.flatMap((a) => a.low), high = args.flatMap((a) => a.high);
      if (low.length !== n) throw new Bail();
      return { low, high };
    }
    case "float": return args[0];
    case "mix": {
      if (!scalar(3)) throw new Bail();
      const [a, b, w] = args;
      // within [0, 1], the value stays between its two ends; else a + (b - a) w
      return within(w, 0, 1) ? hull(a, b) : OPERATORS["+"](a, OPERATORS["*"](OPERATORS["-"](b, a), w));
    }
    case "clamp": {
      const [x, l, h] = args;
      return each(each(x, l, (xl, xh, ll, lh) => [Math.max(xl, ll), Math.max(xh, lh)]), h, (xl, xh, hl, hh) => [Math.min(xl, hl), Math.min(xh, hh)]);
    }
    case "smoothstep": return { low: args[2].low.map(() => 0), high: args[2].high.map(() => 1) };
    case "min": return each(args[0], args[1], (al, ah, bl, bh) => [Math.min(al, bl), Math.min(ah, bh)]);
    case "max": return each(args[0], args[1], (al, ah, bl, bh) => [Math.max(al, bl), Math.max(ah, bh)]);
    case "abs":
      return { low: args[0].low.map((l, i) => (l >= 0 ? l : args[0].high[i] <= 0 ? -args[0].high[i] : 0)), high: args[0].high.map((h, i) => Math.max(Math.abs(h), Math.abs(args[0].low[i]))) };
    case "exp": return monotone(Math.exp)(args[0]);
    case "sqrt": return args[0].low.every((l) => l >= 0) ? monotone(Math.sqrt)(args[0]) : unknown(size(args[0]));
    case "floor": return monotone(Math.floor)(args[0]);
    case "ceil": return monotone(Math.ceil)(args[0]);
    case "fract": return { low: args[0].low.map(() => 0), high: args[0].high.map(() => 1) };
    case "sin": case "cos": return { low: args[0].low.map(() => -1), high: args[0].high.map(() => 1) };
    case "mod": {
      // GLSL's mod() of a positive divisor: in [0, divisor)
      const [, d] = args;
      if (size(d) !== 1 || d.low[0] <= 0) throw new Bail();
      return { low: args[0].low.map(() => 0), high: args[0].high.map(() => d.high[0]) };
    }
    // cubic-bezier(): x itself outside (0, 1); inside, the hull of its handles (0, y1, y2, 1)
    case "cubicBezier": {
      const [x, h] = args;
      const ys = [h.low[1], h.high[1], h.low[3], h.high[3]];
      if (!ys.every(Number.isFinite)) throw new Bail();
      return { low: [Math.min(0, x.low[0], ...ys)], high: [Math.max(1, x.high[0], ...ys)] };
    }
    case "playhead": return { low: [0], high: [1] };
  }
  throw new Bail();
}

// The uniforms and the globals a value reads, by their range. uHover[] stays in [0, 1] when
// the transitions of the object never overshoot; hover-distance() is a distance, and
// hover-direction() a unit vector or nothing.
function variable(name: string): Range {
  if (name === "iTime") return { low: [0], high: [Infinity] };
  if (/^hoverDist\d+$/.test(name)) return { low: [0], high: [Infinity] };
  if (/^hoverDir\d+$/.test(name)) return { low: [-1, -1, -1], high: [1, 1, 1] };
  if (name === "uHover" || name === "uStart") return unknown(1); // indexed: see below
  if (name === "uTimeline" || name === "uProperties" || name === "uPointer") return unknown(4);
  if (name === "true" || name === "false") return unknown(1);
  throw new Bail();
}

// A small reader of GLSL expressions: the precedence of C
class Reader {
  private at = 0;
  private tokens: string[];
  private uniforms: Uniforms;
  constructor(text: string, uniforms: Uniforms) {
    this.uniforms = uniforms;
    this.tokens = text.match(/(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_]\w*|&&|\|\||[<>=!]=|[-+*/(),.?:<>[\]!]/g) ?? [];
  }
  private peek() { return this.tokens[this.at]; }
  private take() { return this.tokens[this.at++]; }
  private expect(token: string) { if (this.take() !== token) throw new Bail(); }
  read(): Range {
    const value = this.ternary();
    if (this.at !== this.tokens.length) throw new Bail();
    return value;
  }
  // c ? a : b: either side, whatever the condition
  private ternary(): Range {
    const condition = this.logical();
    if (this.peek() !== "?") return condition;
    this.take();
    const yes = this.ternary();
    this.expect(":");
    const no = this.ternary();
    return hull(yes, no);
  }
  private logical(): Range {
    let left = this.comparison();
    while (this.peek() === "&&" || this.peek() === "||") { this.take(); this.comparison(); left = unknown(1); }
    return left;
  }
  private comparison(): Range {
    const left = this.sum();
    if (!["<", ">", "<=", ">=", "==", "!="].includes(this.peek())) return left;
    this.take();
    this.sum();
    return unknown(1); // a bool: only a condition reads it
  }
  private sum(): Range {
    let left = this.product();
    while (this.peek() === "+" || this.peek() === "-") left = OPERATORS[this.take()](left, this.product());
    return left;
  }
  private product(): Range {
    let left = this.unary();
    while (this.peek() === "*" || this.peek() === "/") left = OPERATORS[this.take()](left, this.unary());
    return left;
  }
  private unary(): Range {
    if (this.peek() === "-") { this.take(); const v = this.unary(); return { low: v.high.map((h) => -h), high: v.low.map((l) => -l) }; }
    if (this.peek() === "!") { this.take(); this.unary(); return unknown(1); }
    return this.postfix(this.primary());
  }
  private primary(): Range {
    const token = this.take();
    if (token === undefined) throw new Bail();
    if (token === "(") { const v = this.ternary(); this.expect(")"); return v; }
    if (/^(\d|\.)/.test(token)) return constant([Number(token)]);
    if (this.peek() === "(") {
      this.take();
      const args: Range[] = [];
      if (this.peek() !== ")") do args.push(this.ternary()); while (this.peek() === "," && this.take());
      this.expect(")");
      return call(token, args);
    }
    if (token === "uHover" && this.peek() === "[") {
      this.take(); this.take(); this.expect("]");
      return this.uniforms.steadyHover ? { low: [0], high: [1] } : unknown(1);
    }
    return variable(token);
  }
  private postfix(value: Range): Range {
    while (this.peek() === "." || this.peek() === "[") {
      if (this.take() === "[") {
        this.ternary(); this.expect("]");
        value = unknown(4); // uTimeline[i], uProperties[i]: a vec4 of any value
        continue;
      }
      const fields = this.take();
      if (!/^[xyzw]{1,4}$/.test(fields)) throw new Bail();
      const index = [...fields].map((c) => "xyzw".indexOf(c));
      if (index.some((i) => i >= size(value))) throw new Bail();
      value = { low: index.map((i) => value.low[i]), high: index.map((i) => value.high[i]) };
    }
    return value;
  }
}

// The range of a value, or null when it is not known: some component unbounded, or GLSL
// this reader does not know
export function rangeOf(expr: string, steadyHover: boolean): Range | null {
  try {
    const range = new Reader(expr, { steadyHover }).read();
    return [...range.low, ...range.high].every(Number.isFinite) ? range : null;
  } catch (error) {
    if (error instanceof Bail) return null;
    throw error;
  }
}
