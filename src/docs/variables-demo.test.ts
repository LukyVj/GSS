// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { renderDocs } from "./render";
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";
import { compileScene } from "../compiler";
import { parsePropertyValue } from "../runtime/properties";
import { enableVariableDemos } from "./variables-demo";

// "Set variables from JavaScript": the page of the docs on setProperty(), and its live demo

function page(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
  return root.querySelector<HTMLElement>("#set-variables")!;
}

describe("Set variables from JavaScript", () => {
  it("documents the three methods, on every way to get a scene", () => {
    const text = page().textContent!;
    for (const word of [
      "setProperty(",
      "getPropertyValue(",
      "removeProperty(",
      "mount(",
      "mountAsync(",
      "gss-lang/runtime",
      "<gss-scene>",
      '"load"',
      "update(",
    ]) {
      expect(text, word).toContain(word);
    }
  });

  it("has a live demo whose sliders set variables the scene registers", () => {
    const demo = page().querySelector(".variables-demo")!;
    const source = demo.querySelector('gss-scene script[type="text/gss"]')!.textContent!;
    const { properties = [] } = compileScene(source);
    const inputs = [...demo.querySelectorAll<HTMLInputElement>('input[type="range"][data-property]')];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      const registered = properties.find((property) => property.name === input.dataset.property);
      expect(registered, input.dataset.property).toBeDefined();
      for (const value of [input.min, input.max, input.value]) {
        expect(() => parsePropertyValue(registered!.name, registered!.syntax, value)).not.toThrow();
      }
    }
  });

  it("shows the scene the demo runs", () => {
    const article = page();
    const source = article.querySelector('.variables-demo script[type="text/gss"]')!.textContent!;
    const shown = [...article.querySelectorAll(":scope > pre")].map((pre) => pre.textContent).join("\n");
    for (const line of source.trim().split("\n")) expect(shown, line).toContain(line.trim());
  });
});

describe("enableVariableDemos", () => {
  function demo() {
    const root = document.createElement("div");
    root.innerHTML =
      '<div class="variables-demo"><gss-scene></gss-scene>' +
      '<label><input type="range" data-property="--lift" min="0" max="2" step="0.01" value="1"><output>1</output></label></div>';
    enableVariableDemos(root);
    return {
      element: root.querySelector("gss-scene")!,
      input: root.querySelector("input")!,
      output: root.querySelector("output")!,
    };
  }
  const slide = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event("input"));
  };

  it("waits for the scene: before load, the slider only shows its value", () => {
    const { input, output } = demo();
    expect(() => slide(input, "0.5")).not.toThrow();
    expect(output.textContent).toBe("0.5");
  });

  it("shows a value the browser restored, from the start", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<div class="variables-demo"><gss-scene></gss-scene>' +
      '<label><input type="range" data-property="--lift" min="0" max="2" step="0.01" value="1.25"><output>1</output></label></div>';
    enableVariableDemos(root);
    expect(root.querySelector("output")!.textContent).toBe("1.25");
  });

  it("gives the scene the slider's value when it loads, then follows the slider", () => {
    const { element, input, output } = demo();
    slide(input, "0.5");
    const setProperty = vi.fn();
    Object.defineProperty(element, "scene", { value: { setProperty } });
    element.dispatchEvent(new Event("load"));
    expect(setProperty).toHaveBeenCalledWith("--lift", "0.5");
    slide(input, "1.5");
    expect(setProperty).toHaveBeenLastCalledWith("--lift", "1.5");
    expect(output.textContent).toBe("1.5");
  });
});
