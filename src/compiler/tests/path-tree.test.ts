import { describe, it, expect } from "vitest";
import { compileGSS } from "..";
import { boxLeaf, boxTree, rangeTree, type RangeLeaf } from "../shader/path";

// The trees of boxes over the segments of a path, a prism or a lathe: fewer tests, the same
// distance. The GLSL of a tree is run here in 32-bit floats (Math.fround), like a GPU,
// against the same groups one after the other, at many points: d and s must be equal.
const f = Math.fround;
type V = [number, number];
const V = (x: number, y: number): V => [f(x), f(y)];
const sub = (a: V, b: V): V => [f(a[0] - b[0]), f(a[1] - b[1])];
const dot = (a: V, b: V) => f(f(a[0] * b[0]) + f(a[1] * b[1]));
const box2 = (p: V, c: V, h: V) => {
  const v: V = [f(Math.max(f(Math.abs(f(p[0] - c[0])) - h[0]), 0)), f(Math.max(f(Math.abs(f(p[1] - c[1])) - h[1]), 0))];
  return dot(v, v);
};
const segment2 = (p: V, a: V, b: V) => {
  const ap = sub(p, a);
  const ab = sub(b, a);
  const k = f(Math.min(Math.max(f(dot(ap, ab) / dot(ab, ab)), 0), 1));
  const v = sub(ap, [f(ab[0] * k), f(ab[1] * k)]);
  return dot(v, v);
};
const crosses = (p: V, a: V, b: V) => {
  const e = sub(b, a);
  const w = sub(p, a);
  const c = [p[1] >= a[1], p[1] < b[1], f(e[0] * w[1]) > f(e[1] * w[0])];
  return c.every(Boolean) || c.every((x) => !x);
};

// The GLSL of the body (ifs, min, the calls above) is also JavaScript, with vec2 → V
function run(code: string): (q: V) => [number, number] {
  const body = code.replace(/vec2\(/g, "V(").replace(/q\.y/g, "q[1]");
  const fn = new Function("V", "box2", "segment2", "crosses", "min", "q", `let d = 1e10, s = 1;\n${body}\nreturn [d, s];`);
  return (q) => fn(V, box2, segment2, crosses, (a: number, b: number) => f(Math.min(a, b)), q);
}

// A wavy closed contour of n sides, like a detailed lathe or letter
function contour(n: number, scale: number): [{ x: number; y: number }, { x: number; y: number }][] {
  const points = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = scale * (1 + 0.3 * Math.sin(7 * a));
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  });
  return points.map((p, i) => [p, points[(i + 1) % n]]);
}

describe("trees of boxes over the segments of a shape", () => {
  for (const [n, scale] of [[150, 0.6], [700, 1], [3000, 40]] as const) {
    it(`give the same distance and inside test as the groups alone (${n} sides, size ${scale})`, () => {
      const sides = contour(n, scale);
      const leaves = [];
      const ranges: RangeLeaf[] = [];
      for (let i = 0; i < sides.length; i += 8) {
        const group = sides.slice(i, i + 8);
        leaves.push(boxLeaf(group.flat(), group.map(([a, b]) => `d = min(d, segment2(q, vec2(${a.x}, ${a.y}), vec2(${b.x}, ${b.y})));`)));
        const ys = group.flat().map((p) => Math.round(p.y * 10000) / 10000);
        ranges.push({
          low: Math.min(...ys),
          high: Math.max(...ys),
          lines: group.map(([a, b]) => `if (crosses(q, vec2(${a.x}, ${a.y}), vec2(${b.x}, ${b.y}))) s = -s;`),
        });
      }
      const tree = run(`${boxTree(leaves)}\n${rangeTree(ranges)}`);
      const flat = run(`${boxTree(leaves, Infinity)}\n${rangeTree(ranges, Infinity)}`);
      expect(boxTree(leaves)).not.toBe(boxTree(leaves, Infinity)); // there is a tree
      let seed = 1;
      const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
      for (let k = 0; k < 4000; k++) {
        // Near the contour (on it, inside, just outside) and far from it
        const a = random() * Math.PI;
        const r = scale * (1 + 0.3 * Math.sin(7 * a)) * (1 + random() * (k % 4 === 0 ? 1 : 0.02));
        const q = V(r * Math.cos(a), r * Math.sin(a));
        expect(tree(q)).toEqual(flat(q));
      }
    });
  }

  it("gather the groups of a big lathe, and leave a small one as it was", () => {
    const side = (i: number) => `L${(1 + 0.2 * Math.sin(i)).toFixed(4)} ${(i / 10).toFixed(2)}`;
    const big = compileGSS(`@scene { lathe; } lathe { d: path("M0 0 ${Array.from({ length: 200 }, (_, i) => side(i)).join(" ")} L0 20 Z"); }`);
    const small = compileGSS(`@scene { lathe; } lathe { d: path("M0 0 ${Array.from({ length: 20 }, (_, i) => side(i)).join(" ")} L0 2 Z"); }`);
    // 200 sides: 26 groups of 8 under 4 boxes, and 4 heights
    const fn = (shader: string) => shader.slice(shader.indexOf("float sdShape0"), shader.indexOf("\n}\n", shader.indexOf("float sdShape0")));
    expect(fn(big).match(/box2\(q, /g)).toHaveLength(26 + 4 + 1); // + the box of the whole shape
    // 20 sides, 3 groups: no tree, each group's tests one after the other
    expect(fn(small)).toMatch(/  if \(box2[^\n]*\n(    d = [^\n]*\n)+  \}\n  if \(q\.y >= /);
  });
});
