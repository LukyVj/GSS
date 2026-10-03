// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { createDensity } from "./dpr";
import { createDprPicker, savedDpr } from "./dpr-picker";

// The dpr picker over the docs' and the playground's renders (decision 120)

function picker(screen: number) {
  const box = document.createElement("div");
  const canvas = document.createElement("canvas");
  box.append(canvas);
  const density = createDensity(savedDpr());
  return { box, density, ui: createDprPicker(canvas, density, screen) };
}
const options = (box: HTMLElement) =>
  [...box.querySelectorAll("option")].map((option) => option.textContent);

describe("the dpr picker", () => {
  beforeEach(() => localStorage.clear());

  it("sits next to the render, and offers auto and the ratios the screen can show", () => {
    const { box } = picker(2);
    expect(box.querySelector("canvas + .gss-dpr select")).not.toBeNull();
    expect(options(box)).toEqual(["auto", "0.5", "1", "1.5", "2"]);
    expect(options(picker(1).box)).toEqual(["auto", "0.5", "1"]);
    expect(options(picker(1.25).box)).toEqual(["auto", "0.5", "1", "1.25"]);
  });

  it("shows the ratio auto draws at", () => {
    const { box, ui } = picker(2);
    ui.update(1.25);
    expect(options(box)[0]).toBe("auto · 1.25");
  });

  it("gives the choice to the density, and remembers it for the next render", () => {
    const { box, density } = picker(2);
    const select = box.querySelector("select")!;
    select.value = "1";
    select.dispatchEvent(new Event("change"));
    expect(density.choice).toBe(1);
    expect(savedDpr()).toBe(1);
    expect(picker(2).box.querySelector("select")!.value).toBe("1");
  });

  it("draws auto on a screen that cannot show the choice made on another one", () => {
    localStorage.setItem("gss-dpr", "2");
    const { box, density } = picker(1);
    expect(box.querySelector("select")!.value).toBe("auto");
    expect(density.choice).toBe("auto");
  });

  it("falls back to auto on a value it does not know", () => {
    localStorage.setItem("gss-dpr", "fast");
    expect(savedDpr()).toBe("auto");
  });

  it("leaves with the render", () => {
    const { box, ui } = picker(2);
    ui.destroy();
    expect(box.querySelector(".gss-dpr")).toBeNull();
  });
});
