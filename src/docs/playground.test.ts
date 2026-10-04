// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { RegisteredProperty } from "../compiler/features/properties";

// "Try it" draws with WebGL, which happy-dom does not have: a renderer that records what
// the panel of variables asks of it, and an editor that "compiles" at once
const calls: string[] = [];
let registered: RegisteredProperty[] | undefined;
vi.mock("../runtime/renderer", () => ({
  createRenderer: () => ({
    setProperty: (name: string, value: string) => void calls.push(`set ${name} ${value}`),
    removeProperty: (name: string) => void calls.push(`remove ${name}`),
    destroy: () => {},
  }),
}));
vi.mock("../runtime/editor", () => ({
  connectEditor: (_elements: unknown, _renderer: unknown, code: string) => ({
    onCompile: (listener: (code: string, compiled: { properties?: RegisteredProperty[] }) => void) =>
      listener(code, { properties: registered }),
    destroy: () => {},
  }),
}));

const { enableTryIt, closePlayground } = await import("./playground");
enableTryIt(document.body); // once: the body stays from test to test

const LIFT = '@property --lift { syntax: "<number>"; inherits: false; initial-value: 1; } @scene { sphere; }';

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
    localStorage.clear();
    calls.length = 0;
    registered = undefined;
  });

  it("shows the panel of variables over the render of a scene that registers some", () => {
    registered = [{ name: "--lift", syntax: "number", initial: [1, 0, 0, 0] }];
    example(LIFT).querySelector("button")!.click();
    const panel = document.querySelector<HTMLElement>(".playground-body .vars-panel")!;
    expect(panel.hidden).toBe(false);
    const slider = panel.querySelector<HTMLInputElement>('[data-variable="--lift"] input[type="range"]')!;
    slider.value = "1.5";
    slider.dispatchEvent(new Event("input"));
    expect(calls).toEqual(["set --lift 1.5"]);
  });

  it("keeps it hidden for a scene without variables", () => {
    example("@scene { cube; }").querySelector("button")!.click();
    expect(document.querySelector<HTMLElement>(".vars-panel")!.hidden).toBe(true);
  });

  it("takes it away with the render when Try it closes", () => {
    registered = [{ name: "--lift", syntax: "number", initial: [1, 0, 0, 0] }];
    const button = example(LIFT).querySelector("button")!;
    button.click();
    button.click();
    expect(document.querySelector(".vars-panel")).toBeNull();
  });
});
