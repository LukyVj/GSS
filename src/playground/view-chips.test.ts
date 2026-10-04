// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { mountViewChips } from "./view-chips";
import type { View } from "../compiler/features/view";

// The chips over the render (decision 131): view: shaded and view: distance switch the view
// without touching the code; when the code changes its view, the code wins again.

let host: HTMLElement;
let calls: string[];
const target = {
  setView: (view: View | null) => calls.push(`setView ${view}`),
  refresh: () => calls.push("refresh"),
};
const chips = () => [...host.querySelectorAll<HTMLButtonElement>(".view-chip")];
const pressed = () => chips().find((chip) => chip.getAttribute("aria-pressed") === "true")?.textContent;

beforeEach(() => {
  document.body.innerHTML = "";
  host = document.body;
  calls = [];
});

describe("the view chips", () => {
  it("show both views, the one of the code pressed", () => {
    const view = mountViewChips(host, target);
    expect(chips().map((chip) => chip.textContent)).toEqual(["view: shaded", "view: distance"]);
    expect(pressed()).toBe("view: shaded");
    view.update({ view: "distance" });
    expect(pressed()).toBe("view: distance");
    expect(calls).toEqual([]);
  });

  it("compile the scene again with the view chosen, the code untouched", () => {
    const view = mountViewChips(host, target);
    view.update({});
    chips()[1].click();
    expect(calls).toEqual(["setView distance", "refresh"]);
    expect(pressed()).toBe("view: distance");
  });

  it("give the view back to the code when its own view is chosen", () => {
    const view = mountViewChips(host, target);
    view.update({});
    chips()[1].click();
    chips()[0].click();
    expect(calls).toEqual(["setView distance", "refresh", "setView null", "refresh"]);
    expect(pressed()).toBe("view: shaded");
  });

  it("do nothing for the view already shown", () => {
    const view = mountViewChips(host, target);
    view.update({});
    chips()[0].click();
    expect(calls).toEqual([]);
  });

  it("let the code win when it changes its view", () => {
    const view = mountViewChips(host, target);
    view.update({});
    chips()[1].click(); // the viewer chooses distance
    calls = [];
    view.update({ view: "distance" }); // then the code asks for it: the shader is already right
    expect(calls).toEqual(["setView null"]);
    expect(pressed()).toBe("view: distance");
    chips()[0].click(); // shaded, over the code's distance
    calls = [];
    view.update({}); // the code goes back to shaded
    expect(calls).toEqual(["setView null"]);
    expect(pressed()).toBe("view: shaded");
  });

  it("keep the choice while the code compiles again with the same view", () => {
    const view = mountViewChips(host, target);
    view.update({});
    chips()[1].click();
    calls = [];
    view.update({});
    expect(calls).toEqual([]);
    expect(pressed()).toBe("view: distance");
  });

  it("go under the row of the dpr menu when the render is too narrow for both", () => {
    let measure = () => {};
    globalThis.ResizeObserver = class {
      constructor(callback: () => void) {
        measure = callback;
      }
      observe() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    const canvas = document.createElement("canvas");
    let width = 600;
    Object.defineProperty(canvas, "clientWidth", { get: () => width });
    mountViewChips(host, target, canvas);
    const box = host.querySelector(".view-chips")!;
    measure();
    expect(box.classList.contains("is-narrow")).toBe(false);
    width = 240;
    measure();
    expect(box.classList.contains("is-narrow")).toBe(true);
  });
});
