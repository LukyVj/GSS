import { describe, it, expect } from "vitest";
import { readSvgPath } from "./svgpath";

const round = (lines: { x: number; y: number }[][]) =>
  lines.map((line) =>
    line.map(({ x, y }) => [
      Math.round(x * 1000) / 1000,
      Math.round(y * 1000) / 1000,
    ]),
  );

describe("readSvgPath", () => {
  it("reads lines, absolute and relative", () => {
    expect(round(readSvgPath("M0 0 L10 0 l0 5"))).toEqual([
      [
        [0, 0],
        [10, 0],
        [10, 5],
      ],
    ]);
  });

  it("reads H and V", () => {
    expect(round(readSvgPath("M1 1 H5 v2 h-1 V0"))).toEqual([
      [
        [1, 1],
        [5, 1],
        [5, 3],
        [4, 3],
        [4, 0],
      ],
    ]);
  });

  it("repeats the last command, and turns extra M pairs into lines", () => {
    expect(round(readSvgPath("M0 0 1 1 2 0"))).toEqual([
      [
        [0, 0],
        [1, 1],
        [2, 0],
      ],
    ]);
    expect(round(readSvgPath("m1 1 1 0 0 1"))).toEqual([
      [
        [1, 1],
        [2, 1],
        [2, 2],
      ],
    ]);
  });

  it("closes a subpath with Z, and starts a new one with M", () => {
    expect(round(readSvgPath("M0 0 H2 V2 Z M5 5 L6 5"))).toEqual([
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 0],
      ],
      [
        [5, 5],
        [6, 5],
      ],
    ]);
  });

  it("cuts a cubic curve into segments that start and end at the right place", () => {
    const [line] = readSvgPath("M0 0 C0 10 10 10 10 0", 0.05);
    expect(round([line])[0].at(-1)).toEqual([10, 0]);
    const top = line.reduce((best, point) => (point.y > best.y ? point : best));
    expect(top.y).toBeCloseTo(7.5, 1); // the top of the arch
  });

  it("uses more segments when asked to stay closer to the curve", () => {
    const coarse = readSvgPath("M0 0 C0 10 10 10 10 0", 0.5)[0].length;
    const fine = readSvgPath("M0 0 C0 10 10 10 10 0", 0.01)[0].length;
    expect(fine).toBeGreaterThan(coarse);
    expect(readSvgPath("M0 0 C1 0 2 0 3 0", 0.05)[0].length).toBe(2); // a straight "curve": one segment
  });

  it("mirrors the control point for S and T", () => {
    const withS = round(readSvgPath("M0 0 C0 10 10 10 10 0 S20 -10 20 0"));
    const withC = round(
      readSvgPath("M0 0 C0 10 10 10 10 0 C10 -10 20 -10 20 0"),
    );
    expect(withS).toEqual(withC);
    const withT = round(readSvgPath("M0 0 Q5 10 10 0 T20 0"));
    const withQ = round(readSvgPath("M0 0 Q5 10 10 0 Q15 -10 20 0"));
    expect(withT).toEqual(withQ);
  });

  it("reads numbers written without spaces", () => {
    expect(round(readSvgPath("M0,0L1-2l.5.5"))).toEqual([
      [
        [0, 0],
        [1, -2],
        [1.5, -1.5],
      ],
    ]);
  });

  it("explains what is wrong", () => {
    expect(() => readSvgPath("L0 0")).toThrow('A path starts with "M"');
    expect(() => readSvgPath("M0 0 L1")).toThrow('"L" expects 2 numbers');
    expect(() => readSvgPath("M0 0 X1 1")).toThrow('Unknown path command "X"');
    expect(() => readSvgPath("M0 0 A5 5 0 2 1 10 0")).toThrow("flags of an arc are 0 or 1");
    expect(() => readSvgPath("M0 0 L1 1 ~")).toThrow('Unexpected "~"');
    expect(() => readSvgPath("M0 0")).toThrow("draws nothing");
  });
});

describe("arcs (A)", () => {
  const onCircle = (points: { x: number; y: number }[], r: number) =>
    points.every((p) => Math.abs(Math.hypot(p.x, p.y) - r) < 1e-6);

  it("draws a half circle, ending exactly on its end point", () => {
    const [line] = readSvgPath("M-1 0 A1 1 0 0 1 1 0");
    expect(line.length).toBeGreaterThan(4);
    expect(onCircle(line, 1)).toBe(true);
    expect(line[line.length - 1]).toEqual({ x: 1, y: 0 });
  });

  it("sweep picks the side: 1 goes through y = -1 (up in SVG)", () => {
    const [up] = readSvgPath("M-1 0 A1 1 0 0 1 1 0");
    const [down] = readSvgPath("M-1 0 A1 1 0 0 0 1 0");
    // the segments cut the corners a little: the points come close to ±1, not on it
    expect(Math.min(...up.map((p) => p.y))).toBeLessThan(-0.9);
    expect(Math.max(...up.map((p) => p.y))).toBeCloseTo(0);
    expect(Math.max(...down.map((p) => p.y))).toBeGreaterThan(0.9);
  });

  it("large-arc picks the long way around", () => {
    // a quarter of circle, or three quarters, between the same two points
    const [small] = readSvgPath("M1 0 A1 1 0 0 1 0 1");
    const [large] = readSvgPath("M1 0 A1 1 0 1 0 0 1");
    expect(onCircle(small, 1) && onCircle(large, 1)).toBe(true);
    expect(Math.min(...large.map((p) => p.x))).toBeLessThan(-0.9);
    expect(Math.min(...small.map((p) => p.x))).toBeGreaterThan(-0.01);
  });

  it("a relative arc (a) starts from the current point", () => {
    const relative = readSvgPath("M-1 0 a1 1 0 0 1 2 0")[0];
    const absolute = readSvgPath("M-1 0 A1 1 0 0 1 1 0")[0];
    relative.forEach((p, i) => {
      expect(p.x).toBeCloseTo(absolute[i].x);
      expect(p.y).toBeCloseTo(absolute[i].y);
    });
  });

  it("radii too small to reach the end point are scaled up, like SVG", () => {
    expect(onCircle(readSvgPath("M-1 0 A0.1 0.1 0 0 1 1 0")[0], 1)).toBe(true);
  });

  it("a rotated ellipse keeps its radii along its own axes", () => {
    // an ellipse 2 × 1 turned 90°: it is 1 wide and 2 tall
    const [line] = readSvgPath("M0 -2 A2 1 90 0 1 0 2");
    expect(Math.max(...line.map((p) => p.x))).toBeCloseTo(1);
  });

  it("a radius of 0 draws a straight line, like SVG", () => {
    expect(readSvgPath("M0 0 A0 1 0 0 1 2 0")).toEqual([[{ x: 0, y: 0 }, { x: 2, y: 0 }]]);
  });

  it("an arc to its own start draws nothing", () => {
    expect(readSvgPath("M0 0 L1 0 A1 1 0 0 1 1 0")).toEqual([[{ x: 0, y: 0 }, { x: 1, y: 0 }]]);
  });

  it("reads flags glued together, like minified SVG", () => {
    expect(readSvgPath("M-1 0a1 1 0 012 0")).toEqual(readSvgPath("M-1 0 a1 1 0 0 1 2 0"));
  });

  it("draws a full circle with two arcs, like SVG icons do", () => {
    const [line] = readSvgPath("M-1 0 A1 1 0 1 1 1 0 A1 1 0 1 1 -1 0");
    expect(onCircle(line, 1)).toBe(true);
    expect(line[line.length - 1]).toEqual({ x: -1, y: 0 });
  });
});
