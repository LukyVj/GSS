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
    expect(() => readSvgPath("M0 0 A5 5 0 0 1 10 0")).toThrow(
      "Arcs (A) are not supported",
    );
    expect(() => readSvgPath("M0 0 L1 1 ~")).toThrow('Unexpected "~"');
    expect(() => readSvgPath("M0 0")).toThrow("draws nothing");
  });
});
