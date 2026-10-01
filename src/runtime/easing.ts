// Computes an easing in JavaScript, for the transitions. The @keyframes compute
// the same curves in the shader (codegen.ts). Only the type comes from the compiler.
import type { Easing } from "../compiler/values/easing";

// The eased progress at the moment t (0 to 1; held outside)
export function ease(easing: Easing, t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  if (easing.type === "steps") {
    // The same as stepsShape() in the compiler, which the runtime does not import
    const { count, position } = easing;
    const jumps =
      position === "jump-both" ? count + 1 : position === "jump-none" ? count - 1 : count;
    const offset = position === "jump-start" || position === "jump-both" ? 1 : 0;
    return Math.min(Math.floor(x * count) + offset, jumps) / jumps;
  }
  return easing.type === "cubic-bezier"
    ? bezierAt(easing, x)
    : linearAt(easing.points, x);
}

// One coordinate of the curve from (0, 0) to (1, 1) pulled by the handles a and b,
// at the parameter s: 3(1-s)²s·a + 3(1-s)s²·b + s³, written as a polynomial
function polynomial(a: number, b: number) {
  const c = 3 * a;
  const bb = 3 * (b - a) - c;
  const aa = 1 - c - bb;
  return {
    at: (s: number) => ((aa * s + bb) * s + c) * s,
    slope: (s: number) => (3 * aa * s + 2 * bb) * s + c,
  };
}

// x is time, y is progress: find the s where x(s) = x, then read y(s)
function bezierAt(
  { x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number },
  x: number,
): number {
  if (x === 0 || x === 1) return x;
  const curveX = polynomial(x1, x2);
  const curveY = polynomial(y1, y2);

  // 1. Newton: fast, from s = x
  let s = x;
  for (let i = 0; i < 8; i++) {
    const error = curveX.at(s) - x;
    if (Math.abs(error) < 1e-7) return curveY.at(s);
    const slope = curveX.slope(s);
    if (Math.abs(slope) < 1e-6) break; // flat: Newton would jump away
    s -= error / slope;
    if (s < 0 || s > 1) break;
  }

  // 2. Bisection: slower, always right, since x(s) only goes up when x1, x2 are in 0–1
  let low = 0;
  let high = 1;
  s = x;
  for (let i = 0; i < 40; i++) {
    if (curveX.at(s) < x) low = s;
    else high = s;
    s = (low + high) / 2;
  }
  return curveY.at(s);
}

// Between the two points around x; the last point wins at a shared moment, like CSS
function linearAt(
  points: { input: number; output: number }[],
  x: number,
): number {
  if (x < points[0].input) return points[0].output;
  const i = points.findLastIndex((point) => point.input <= x);
  if (i === points.length - 1) return points[i].output;
  const from = points[i];
  const to = points[i + 1];
  return (
    from.output +
    ((to.output - from.output) * (x - from.input)) / (to.input - from.input)
  );
}
