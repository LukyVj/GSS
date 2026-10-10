import { describe, it, expect } from "vitest";
import { SHAPES, draw } from "./hairline";
import { SHAPE_DOCS } from "../compiler/registry/registry";

// A drawing in a box of 120, where one unit of the scene is 62
const drawing = (name: keyof typeof SHAPES) => draw(SHAPES[name](), 120, 62);
const lines = (path: string) => (path.match(/M/g) ?? []).length;
const points = (path: string) => [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => [+x, +y]);

describe("the line drawings of the shapes", () => {
  it("draw everything a scene can declare: every shape, a group, a light", () => {
    expect(Object.keys(SHAPES)).toEqual(SHAPE_DOCS.map((shape) => shape.name));
  });

  it("show the nine edges of a cube the eye sees, and dash the three behind it", () => {
    const cube = drawing("cube");
    expect(lines(cube.visible)).toBe(9);
    expect(lines(cube.hidden)).toBe(3);
    // the three hidden edges meet at the corner the cube hides
    const ends = points(cube.hidden).map(([x, y]) => `${x} ${y}`);
    expect(ends.filter((end) => ends.filter((other) => other === end).length === 3).length).toBe(3);
  });

  it("close the outline of a sphere: a circle of its radius, with no gap at the top", () => {
    const { visible, hidden } = drawing("sphere");
    const outline = points(visible);
    for (const [x, y] of outline) expect(Math.hypot(x - 60, y - 60)).toBeCloseTo(0.6 * 62, 0);
    expect(Math.min(...outline.map(([, y]) => y))).toBeCloseTo(60 - 0.6 * 62, 0);
    expect(Math.max(...outline.map(([, y]) => y))).toBeCloseTo(60 + 0.6 * 62, 0);
    expect(hidden).toBe("");
  });

  it("keep the rim of a cylinder whole: a closed line is not one point", () => {
    const top = points(drawing("cylinder").visible).filter(([, y]) => y < 30);
    expect(Math.max(...top.map(([x]) => x)) - Math.min(...top.map(([x]) => x))).toBeCloseTo(2 * 0.42 * 62, 0);
  });

  it("hide what one solid of a group puts behind another", () => {
    expect(drawing("group").hidden).not.toBe("");
    expect(lines(drawing("group").visible)).toBeGreaterThan(9); // the cube, and what shows of the sphere
  });

  it("stay inside their box, and give the same drawing each time", () => {
    for (const name of Object.keys(SHAPES) as (keyof typeof SHAPES)[]) {
      const { visible, hidden, guide, guideHidden } = drawing(name);
      for (const [x, y] of points(visible + hidden + guide + guideHidden)) {
        expect(x, name).toBeGreaterThanOrEqual(0);
        expect(x, name).toBeLessThanOrEqual(120);
        expect(y, name).toBeGreaterThanOrEqual(0);
        expect(y, name).toBeLessThanOrEqual(120);
      }
      expect(visible, name).not.toBe("");
      expect(drawing(name), name).toEqual({ visible, hidden, guide, guideHidden });
    }
  });
});
