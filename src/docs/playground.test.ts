// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { RegisteredProperty } from "../compiler/features/properties";

// "Try it" draws with WebGL, which happy-dom does not have: a renderer that records what
// the panel of variables asks of it, and an editor that "compiles" at once
const calls: string[] = [];
let registered: RegisteredProperty[] | undefined;
let display: "open" | "folded" | undefined;
let debugPanel: "open" | "folded" | undefined;
vi.mock("../runtime/renderer", () => ({
  createRenderer: () => ({
    setProperty: (name: string, value: string) => void calls.push(`set ${name} ${value}`),
    removeProperty: (name: string) => void calls.push(`remove ${name}`),
    setView: (view: string | null) => void calls.push(`view ${view}`),
    setDebug: (debug: boolean) => void calls.push(`debug ${debug}`),
    destroy: () => {},
  }),
}));
vi.mock("../runtime/editor", () => ({
  connectEditor: (_elements: unknown, _renderer: unknown, code: string) => ({
    onCompile: (listener: (code: string, compiled: object) => void) =>
      listener(code, { properties: registered, propertyPanel: display, debugPanel, objects: 1, textures: [] }),
    refresh: () => void calls.push("refresh"),
    destroy: () => {},
  }),
}));

const { enableTryIt, closePlayground } = await import("./playground");
enableTryIt(document.body); // once: the body stays from test to test

const LIFT = '@property --lift { syntax: "<number>"; inherits: false; initial-value: 1; } @property-panel { display: open; } @scene { sphere; }';

function example(code: string): HTMLElement {
  const element = document.createElement("div");
  element.className = "example";
  element.innerHTML = `<button type="button" class="try">Try it</button>`;
  element.querySelector("button")!.dataset.example = code;
  document.body.append(element);
  return element;
}

describe("Try it", () => {
  beforeEach(() => {
    closePlayground();
    document.body.innerHTML = "";
    calls.length = 0;
    registered = undefined;
    display = undefined;
    debugPanel = undefined;
  });

  it("shows the panel of variables over the render of a scene that asks for it", () => {
    registered = [{ name: "--lift", syntax: "number", initial: [1, 0, 0, 0] }];
    display = "open";
    example(LIFT).querySelector("button")!.click();
    const panel = document.querySelector<HTMLElement>(".playground-body .vars-panel")!;
    expect(panel.hidden).toBe(false);
    const slider = panel.querySelector<HTMLInputElement>('[data-variable="--lift"] input[type="range"]')!;
    slider.value = "1.5";
    slider.dispatchEvent(new Event("input"));
    expect(calls).toEqual(["debug true", "set --lift 1.5"]);
  });

  it("keeps it hidden for a scene without @property-panel", () => {
    registered = [{ name: "--lift", syntax: "number", initial: [1, 0, 0, 0] }];
    example('@property --lift { syntax: "<number>"; inherits: false; initial-value: 1; } @scene { sphere; }').querySelector("button")!.click();
    expect(document.querySelector<HTMLElement>(".vars-panel")!.hidden).toBe(true);
  });

  it("takes it away with the render when Try it closes", () => {
    registered = [{ name: "--lift", syntax: "number", initial: [1, 0, 0, 0] }];
    display = "open";
    const button = example(LIFT).querySelector("button")!;
    button.click();
    button.click();
    expect(document.querySelector(".vars-panel")).toBeNull();
  });

  it("shows the chips of the view over the render: they compile the scene again in the view chosen", () => {
    example("@scene { sphere; }").querySelector("button")!.click();
    const chips = [...document.querySelectorAll<HTMLButtonElement>(".playground-body .view-chip")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["view: shaded", "view: distance", "view: steps"]);
    calls.length = 0;
    chips[1].click();
    expect(calls).toEqual(["view distance", "refresh"]);
  });

  it("takes the chips away with the render when Try it closes", () => {
    const button = example("@scene { sphere; }").querySelector("button")!;
    button.click();
    button.click();
    expect(document.querySelector(".view-chips")).toBeNull();
  });

  it("draws the axes and the grid of @debug-panel, and shows its panel over the render (decision 204)", () => {
    debugPanel = "open";
    const button = example("@debug-panel { display: open; } @scene { sphere; }").querySelector("button")!;
    button.click();
    expect(calls).toContain("debug true");
    const panel = document.querySelector<HTMLElement>(".playground-body .debug-panel")!;
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain("objects1");
    button.click();
    expect(document.querySelector(".debug-panel")).toBeNull();
  });
});
