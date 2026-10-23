/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { turnTo, viewUnder } from "./figure-motion";
import { renderFigure } from "./figures";
import { REST, shapeDrawing, viewAt } from "./hairline";

// The shapes of the figures turn under the pointer (decision 181)
describe("a shape that turns", () => {
  const stage = (name: string) => {
    const holder = document.createElement("div");
    holder.innerHTML = renderFigure("shape", name);
    const svg = holder.querySelector<SVGSVGElement>("svg[data-turn]")!;
    // happy-dom does not read the viewBox: the page script does, in a browser
    Object.defineProperty(svg, "viewBox", { value: { baseVal: { width: 380, height: 250 } } });
    return svg;
  };
  const d = (svg: SVGSVGElement, kind: string) => svg.querySelector(`path.${kind}`)!.getAttribute("d");

  it("is drawn again from the side asked, by the same hand as the page", () => {
    const svg = stage("cube");
    const rest = d(svg, "line");
    turnTo(svg, { azimuth: 20, elevation: 40 });
    const drawing = shapeDrawing("cube", { width: 380, height: 250, scale: 130, x: 190, y: 128 }, viewAt(20, 40), true);
    expect(d(svg, "line")).toBe(drawing.visible);
    expect(d(svg, "line")).not.toBe(rest);
    expect(d(svg, "hidden")).toBe(drawing.hidden + drawing.guideHidden);
    turnTo(svg, REST);
    expect(d(svg, "line")).toBe(rest);
  });

  it("takes its measures with it", () => {
    const svg = stage("cylinder");
    const before = [...svg.querySelectorAll("path.mark")].map((mark) => mark.getAttribute("d"));
    turnTo(svg, { azimuth: 30, elevation: 45 });
    const after = [...svg.querySelectorAll("path.mark")].map((mark) => mark.getAttribute("d"));
    expect(after).toHaveLength(2);
    expect(after).not.toEqual(before);
    expect([...svg.querySelectorAll("text.mark-label")].map((label) => label.textContent)).toEqual(["radius", "height"]);
  });

  it("takes the box of a group with it", () => {
    const svg = stage("group");
    const rest = d(svg, "bound");
    turnTo(svg, { azimuth: 30, elevation: 45 });
    expect(d(svg, "bound")).toBe(shapeDrawing("group", { width: 380, height: 250, scale: 130, x: 190, y: 128 }, viewAt(30, 45), true).bound);
    expect(d(svg, "bound")).not.toBe(rest);
  });

  it("rests when the pointer is in the middle of its box, and turns toward the pointer", () => {
    expect(viewUnder(0, 0)).toEqual(REST);
    expect(viewUnder(1, 0).azimuth).toBeGreaterThan(REST.azimuth);
    expect(viewUnder(0, -1).elevation).toBeGreaterThan(REST.elevation);
  });

  it("keeps the eye above the floor, and never right over the shape", () => {
    for (const y of [-5, -1, 1, 5]) {
      expect(viewUnder(0, y).elevation).toBeGreaterThanOrEqual(6);
      expect(viewUnder(0, y).elevation).toBeLessThanOrEqual(60);
    }
  });
});

// On the page of a rotation, the cube turns around its axis (decision 181)
describe("a cube that spins", () => {
  it("is drawn again at the angle asked, with its axis", async () => {
    const { spinTo } = await import("./figure-motion");
    const { spinDrawing } = await import("./hairline");
    const holder = document.createElement("div");
    holder.innerHTML = renderFigure("rotate", "rotate-y");
    const svg = holder.querySelector<SVGSVGElement>("svg[data-spin]")!;
    Object.defineProperty(svg, "viewBox", { value: { baseVal: { width: 340, height: 230 } } });
    const drawn = svg.querySelector("path.line")!.getAttribute("d");
    spinTo(svg, 70);
    const { cube, axis } = spinDrawing("y", 70, { width: 340, height: 230, scale: 84, x: 170, y: 118 });
    expect(svg.querySelector("path.line")!.getAttribute("d")).toBe(cube.visible);
    expect(svg.querySelector("path.axis-front")!.getAttribute("d")).toBe(axis.visible);
    expect(cube.visible).not.toBe(drawn);
    spinTo(svg, 24);
    expect(svg.querySelector("path.line")!.getAttribute("d")).toBe(drawn);
  });
});
