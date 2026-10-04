// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { controlFor, widen, cssValue, mountVariablesPanel, STORAGE_KEY } from "./variables-panel";
import { compileScene } from "../compiler";
import { AT_RULES } from "../compiler/registry/registry";
import type { RegisteredProperty } from "../compiler/features/properties";

// The panel of the playground: one control per variable of @property, over the render, that
// calls setProperty() as it moves, without compiling again. @property has no min or max:
// the range comes from the start value, and a number typed outside it widens it.

const number = (name: string, value: number): RegisteredProperty => ({ name, syntax: "number", initial: [value, 0, 0, 0] });

describe("controlFor", () => {
  it("gives a number a range from 0 to twice its start value, at least 0 to 1", () => {
    expect(controlFor(number("--lift", 1))).toMatchObject({ kind: "range", unit: "", value: 1, min: 0, max: 2, step: 0.01 });
    expect(controlFor(number("--hue", 20))).toMatchObject({ value: 20, min: 0, max: 40, step: 0.1 });
    expect(controlFor(number("--zero", 0))).toMatchObject({ value: 0, min: 0, max: 1 });
    expect(controlFor(number("--small", 0.2))).toMatchObject({ value: 0.2, min: 0, max: 1 });
  });
  it("centers the range on 0 for a negative start value", () => {
    expect(controlFor(number("--down", -3))).toMatchObject({ value: -3, min: -6, max: 6, step: 0.1 });
  });
  it("turns an angle through the whole circle, in degrees", () => {
    const turn: RegisteredProperty = { name: "--turn", syntax: "angle", initial: [Math.PI / 6, 0, 0, 0] };
    expect(controlFor(turn)).toMatchObject({ kind: "range", unit: "deg", value: 30, min: 0, max: 360, step: 1 });
  });
  it("reads an angle the compiler kept to six digits of radians as a round number", () => {
    const turn: RegisteredProperty = { name: "--turn", syntax: "angle", initial: [0.523599, 0, 0, 0] };
    expect(controlFor(turn)).toMatchObject({ value: 30 });
  });
  it("widens the circle for an angle outside it", () => {
    const spin: RegisteredProperty = { name: "--spin", syntax: "angle", initial: [4 * Math.PI, 0, 0, 0] };
    expect(controlFor(spin)).toMatchObject({ value: 720, min: 0, max: 1440 });
  });
  it("gives a percentage 0% to 100%, and a length a range in px", () => {
    expect(controlFor({ name: "--p", syntax: "percentage", initial: [50, 0, 0, 0] })).toMatchObject({ unit: "%", value: 50, min: 0, max: 100, step: 1 });
    expect(controlFor({ name: "--r", syntax: "length", initial: [4, 0, 0, 0] })).toMatchObject({ unit: "px", value: 4, min: 0, max: 8 });
  });
  it("gives a color a color picker, in hex", () => {
    const tint: RegisteredProperty = { name: "--tint", syntax: "color", initial: [1, 0.353, 0.212, 0] };
    expect(controlFor(tint)).toEqual({ kind: "color", value: "#ff5a36" });
  });
});

describe("widen", () => {
  it("doubles the end a value goes past, and the step follows the span", () => {
    const control = controlFor(number("--lift", 1));
    expect(widen(control, 5)).toMatchObject({ min: 0, max: 10, step: 0.1 });
    expect(widen(control, -1)).toMatchObject({ min: -2, max: 2, step: 0.01 });
  });
  it("keeps a range that already holds the value", () => {
    const control = controlFor(number("--lift", 1));
    expect(widen(control, 1.5)).toEqual(control);
  });
});

describe("cssValue", () => {
  it("writes the value with the unit of its syntax, without float noise", () => {
    expect(cssValue("", 0.1 + 0.2)).toBe("0.3");
    expect(cssValue("deg", 90)).toBe("90deg");
    expect(cssValue("%", 50)).toBe("50%");
    expect(cssValue("px", 4)).toBe("4px");
  });
});

describe("every @property example of the reference", () => {
  it("gets a control for each of its variables", () => {
    const entry = AT_RULES.find((rule) => rule.name === "property")!;
    for (const example of entry.examples) {
      const properties = compileScene(example.code).properties ?? [];
      expect(properties.length).toBeGreaterThan(0);
      for (const property of properties) expect(() => controlFor(property)).not.toThrow();
    }
  });
});

// A scene that records what the panel asks of it
function fakeScene() {
  const calls: string[] = [];
  return {
    calls,
    setProperty: (name: string, value: string | number) => void calls.push(`set ${name} ${value}`),
    removeProperty: (name: string) => void calls.push(`remove ${name}`),
  };
}

function slide(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("mountVariablesPanel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  const panel = () => document.querySelector<HTMLElement>(".vars-panel")!;
  const row = (name: string) => panel().querySelector<HTMLElement>(`[data-variable="${name}"]`)!;
  const slider = (name: string) => row(name).querySelector<HTMLInputElement>('input[type="range"]')!;
  const field = (name: string) => row(name).querySelector<HTMLInputElement>('input[type="number"]')!;
  const reset = (name: string) => row(name).querySelector<HTMLButtonElement>("button")!;

  it("stays hidden while the scene registers no variable", () => {
    const vars = mountVariablesPanel(document.body, fakeScene());
    vars.update(undefined);
    expect(panel().hidden).toBe(true);
    vars.update([number("--lift", 1)]);
    expect(panel().hidden).toBe(false);
    vars.update([]);
    expect(panel().hidden).toBe(true);
  });

  it("shows one row per variable, in the order of the scene, at its start value", () => {
    const vars = mountVariablesPanel(document.body, fakeScene());
    vars.update([number("--lift", 1), number("--hue", 20)]);
    const names = [...panel().querySelectorAll<HTMLElement>("[data-variable]")].map((r) => r.dataset.variable);
    expect(names).toEqual(["--lift", "--hue"]);
    expect(slider("--hue").min).toBe("0");
    expect(slider("--hue").max).toBe("40");
    expect(slider("--hue").value).toBe("20");
    expect(field("--hue").value).toBe("20");
    expect(slider("--hue").getAttribute("aria-label")).toBe("--hue");
  });

  it("sets the variable as the slider moves, and shows the number", () => {
    const scene = fakeScene();
    const vars = mountVariablesPanel(document.body, scene);
    vars.update([{ name: "--turn", syntax: "angle", initial: [0, 0, 0, 0] }]);
    slide(slider("--turn"), "90");
    expect(scene.calls).toEqual(["set --turn 90deg"]);
    expect(field("--turn").value).toBe("90");
  });

  it("widens the slider for a number typed outside its range", () => {
    const scene = fakeScene();
    const vars = mountVariablesPanel(document.body, scene);
    vars.update([number("--lift", 1)]);
    type(field("--lift"), "5");
    expect(slider("--lift").max).toBe("10");
    expect(slider("--lift").value).toBe("5");
    expect(scene.calls).toEqual(["set --lift 5"]);
  });

  it("puts back the last value for a field left empty", () => {
    const scene = fakeScene();
    const vars = mountVariablesPanel(document.body, scene);
    vars.update([number("--lift", 1)]);
    type(field("--lift"), "");
    expect(field("--lift").value).toBe("1");
    expect(scene.calls).toEqual([]);
  });

  it("sets a color from the color picker", () => {
    const scene = fakeScene();
    const vars = mountVariablesPanel(document.body, scene);
    vars.update([{ name: "--tint", syntax: "color", initial: [1, 0.353, 0.212, 0] }]);
    const picker = row("--tint").querySelector<HTMLInputElement>('input[type="color"]')!;
    expect(picker.value).toBe("#ff5a36");
    slide(picker, "#3a7bff");
    expect(scene.calls).toEqual(["set --tint #3a7bff"]);
  });

  it("keeps a moved value when the code compiles again with the same start value", () => {
    const scene = fakeScene();
    const vars = mountVariablesPanel(document.body, scene);
    vars.update([number("--lift", 1)]);
    slide(slider("--lift"), "1.5");
    vars.update([number("--lift", 1), number("--hue", 20)]);
    expect(slider("--lift").value).toBe("1.5");
    expect(scene.calls).toEqual(["set --lift 1.5"]);
  });

  it("gives the code back its say when the start value changes there", () => {
    const scene = fakeScene();
    const vars = mountVariablesPanel(document.body, scene);
    vars.update([number("--lift", 1)]);
    slide(slider("--lift"), "1.5");
    vars.update([number("--lift", 3)]);
    expect(slider("--lift").value).toBe("3");
    expect(slider("--lift").max).toBe("6");
    expect(scene.calls).toEqual(["set --lift 1.5", "remove --lift"]);
  });

  it("forgets a variable the code no longer registers", () => {
    const scene = fakeScene();
    const vars = mountVariablesPanel(document.body, scene);
    vars.update([number("--lift", 1), number("--hue", 20)]);
    slide(slider("--lift"), "1.5");
    vars.update([number("--hue", 20)]);
    expect(row("--lift")).toBeNull();
    expect(scene.calls).toEqual(["set --lift 1.5", "remove --lift"]);
  });

  it("resets a moved variable to its start value", () => {
    const scene = fakeScene();
    const vars = mountVariablesPanel(document.body, scene);
    vars.update([number("--lift", 1)]);
    expect(reset("--lift").hidden).toBe(true);
    slide(slider("--lift"), "1.5");
    expect(reset("--lift").hidden).toBe(false);
    reset("--lift").click();
    expect(slider("--lift").value).toBe("1");
    expect(field("--lift").value).toBe("1");
    expect(reset("--lift").hidden).toBe(true);
    expect(scene.calls).toEqual(["set --lift 1.5", "remove --lift"]);
  });

  it("folds, and the next playground opens folded", () => {
    const vars = mountVariablesPanel(document.body, fakeScene());
    vars.update([number("--lift", 1)]);
    const toggle = panel().querySelector<HTMLButtonElement>(".vars-toggle")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(panel().querySelector<HTMLElement>(".vars-list")!.hidden).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("folded");

    document.body.innerHTML = "";
    mountVariablesPanel(document.body, fakeScene()).update([number("--lift", 1)]);
    expect(panel().querySelector(".vars-toggle")!.getAttribute("aria-expanded")).toBe("false");
  });

  it("names its count in the toggle", () => {
    const vars = mountVariablesPanel(document.body, fakeScene());
    vars.update([number("--lift", 1), number("--hue", 20)]);
    expect(panel().querySelector(".vars-toggle")!.textContent).toBe("variables · 2");
  });
});
