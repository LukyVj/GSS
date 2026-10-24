// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { createDensity } from "./dpr";
import { createDprPicker, savedDpr } from "./dpr-picker";
import { createGpu } from "./gpu";

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

// @gpu (slow) (decision 212): a second menu, next to the dpr, for a scene with a lighter version
describe("the gpu menu", () => {
  function withGpu() {
    const box = document.createElement("div");
    const canvas = document.createElement("canvas");
    box.append(canvas);
    const gpu = createGpu("auto", () => false);
    const ui = createDprPicker(canvas, createDensity("auto"), 2, gpu);
    const menu = () => box.querySelector<HTMLElement>(".gss-gpu")!;
    return { box, gpu, ui, menu };
  }

  it("shows only for a scene with a lighter version", () => {
    const { ui, menu } = withGpu();
    ui.update(1);
    expect(menu().hidden).toBe(true);
    ui.update(1, true);
    expect(menu().hidden).toBe(false);
    expect(options(menu())).toEqual(["auto", "slow"]);
  });

  it("forces the lighter version, and gives it back to the frames", () => {
    const { gpu, menu } = withGpu();
    const select = menu().querySelector("select")!;
    select.value = "slow";
    select.dispatchEvent(new Event("change"));
    expect(gpu.slow).toBe(true);
    select.value = "auto";
    select.dispatchEvent(new Event("change"));
    expect(gpu.slow).toBe(false);
  });

  it("says when auto found the GPU slow", () => {
    const { gpu, ui, menu } = withGpu();
    gpu.slowDown();
    ui.update(1, true);
    expect(options(menu())[0]).toBe("auto · slow");
  });

  it("is not there without a GPU state, and leaves with the render", () => {
    expect(picker(2).box.querySelector(".gss-gpu")).toBeNull();
    const { box, ui } = withGpu();
    ui.destroy();
    expect(box.querySelector(".gss-gpu")).toBeNull();
  });
});
