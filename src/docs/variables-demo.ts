import type { GssSceneElement } from "../embed/element";

// The live demo of "Set variables from JavaScript" (src/docs/guide.ts): each slider sets a
// variable of the <gss-scene> beside it, the way the code shown on the page does.
export function enableVariableDemos(root: ParentNode): void {
  for (const demo of root.querySelectorAll<HTMLElement>(".variables-demo")) {
    const element = demo.querySelector<GssSceneElement>("gss-scene");
    if (!element) continue;
    const sliders = [...demo.querySelectorAll<HTMLInputElement>("input[data-property]")];
    const apply = (slider: HTMLInputElement) => {
      const output = slider.parentElement?.querySelector("output");
      if (output) output.textContent = slider.value;
      // null until the element fires "load": the scene starts when it comes near the screen
      element.scene?.setProperty(slider.dataset.property!, slider.value);
    };
    // A new scene starts from its start values: give it the sliders' values
    element.addEventListener("load", () => sliders.forEach(apply));
    for (const slider of sliders) slider.addEventListener("input", () => apply(slider));
    sliders.forEach(apply); // a value the browser restored shows at once
  }
}
