import { describe, it, expect } from "vitest";
import { SHAPES, REST_VIEW, draw, shapeDrawing, spinDrawing, spun, viewAt, type Frame, type Vec3 } from "./hairline";
import { SHAPE_DOCS } from "../compiler/registry/registry";

// A drawing in a box of 120, where one unit of the scene is 62
const FRAME: Frame = { width: 120, height: 120, scale: 62, x: 60, y: 60 };
const drawing = (name: keyof typeof SHAPES) => draw(SHAPES[name](REST_VIEW), FRAME);
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
      const { visible, hidden, guide, guideHidden, ground } = drawing(name);
      expect(ground, name).toBe("");
      for (const [x, y] of points(visible + hidden + guide + guideHidden)) {
        expect(x, name).toBeGreaterThanOrEqual(0);
        expect(x, name).toBeLessThanOrEqual(120);
        expect(y, name).toBeGreaterThanOrEqual(0);
        expect(y, name).toBeLessThanOrEqual(120);
      }
      expect(visible, name).not.toBe("");
      expect(drawing(name), name).toEqual({ visible, hidden, guide, guideHidden, ground });
    }
  });

  // The page script turns a shape under the pointer: the same shape, from another side
  it("draw a shape from any side: a cube seen from its corner, above, shows nine edges again", () => {
    const turned = draw(SHAPES.cube(viewAt(20, 40)), FRAME, viewAt(20, 40));
    expect(turned.visible).not.toBe(drawing("cube").visible);
    expect(lines(turned.visible)).toBe(9);
    expect(lines(turned.hidden)).toBe(3);
  });

  it("keep the outline of a round shape closed from any side", () => {
    for (const elevation of [8, 28, 55]) {
      const view = viewAt(-70, elevation);
      const { visible } = draw(SHAPES.sphere(view), FRAME, view);
      const tops = points(visible).map(([, y]) => y);
      expect(Math.min(...tops), `${elevation}`).toBeCloseTo(60 - 0.6 * 62, 0);
    }
  });

  it("measure a shape by the properties that set it, each with a line and a place for its name", () => {
    const { marks } = shapeDrawing("cylinder", FRAME, REST_VIEW, true);
    expect(marks.map((mark) => mark.label)).toEqual(["radius", "height"]);
    for (const mark of marks) expect(lines(mark.d)).toBe(3); // the line and a tick at each end
    expect(shapeDrawing("cylinder", FRAME).marks).toEqual([]);
    expect(shapeDrawing("lathe", FRAME, REST_VIEW, true).marks).toEqual([]);
  });

  // The rotations of GSS, like those of CSS: rotate-x turns the top away from the viewer,
  // rotate-y the right side away, rotate-z turns clockwise
  it("turn a solid the way rotate-x, rotate-y and rotate-z do", () => {
    const turned = (axis: "x" | "y" | "z", point: Vec3) => spun({ lines: [{ points: [point] }], mesh: [] }, axis, 90).lines[0].points[0];
    const [, , topAway] = turned("x", [0, 1, 0]);
    const [, , rightAway] = turned("y", [1, 0, 0]);
    const [topRight] = turned("z", [0, 1, 0]);
    expect(topAway).toBeCloseTo(-1);
    expect(rightAway).toBeCloseTo(-1);
    expect(topRight).toBeCloseTo(1);
  });

  it("draw a cube the same after a quarter turn, and its axis dashed inside it", () => {
    for (const axis of ["x", "y", "z"] as const) {
      const [at, later] = [spinDrawing(axis, 24, FRAME), spinDrawing(axis, 114, FRAME)];
      expect(later.cube.visible.length, axis).toBe(at.cube.visible.length);
      expect(lines(at.cube.visible) + lines(at.cube.hidden), axis).toBe(12);
      expect(at.axis.hidden, axis).not.toBe("");
      expect(at.axis.visible, axis).not.toBe("");
    }
  });
});
