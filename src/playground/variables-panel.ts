import "./variables-panel.css";
import type { RegisteredProperty } from "../compiler/features/properties";

// The panel of variables (decision 127): over the top-left corner of the playground scene,
// one control per variable the scene registers with @property, that calls setProperty() as
// it moves, without compiling again. Nothing goes into the code: the share link carries the
// code, and the code its start values. @property has no min or max: the range of a slider
// comes from the start value, and a number typed outside it widens it.

export const STORAGE_KEY = "gss-variables";

type Unit = "" | "deg" | "%" | "px";
export type Control =
  | { kind: "range"; unit: Unit; value: number; min: number; max: number; step: number }
  | { kind: "color"; value: string };

const UNITS: Record<Exclude<RegisteredProperty["syntax"], "color">, Unit> = {
  number: "",
  angle: "deg",
  percentage: "%",
  length: "px",
};

// Six digits, like getPropertyValue(): 0.1 + 0.2 is 0.3
const short = (n: number) => +n.toFixed(6);

// About a hundred steps along the range, a round number: 0.01 from 0 to 2, 1 from 0 to 360
const stepFor = (min: number, max: number) => 10 ** (Math.floor(Math.log10(max - min)) - 2);

function range(unit: Unit, value: number, min: number, max: number): Control {
  return widen({ kind: "range", unit, value, min, max, step: stepFor(min, max) }, value);
}

// The control of a variable, at its start value (the 4 floats of its uniform)
export function controlFor(property: RegisteredProperty): Control {
  const [x, g, b] = property.initial;
  if (property.syntax === "color") {
    const hex = [x, g, b].map((c) => Math.round(Math.min(Math.max(c, 0), 1) * 255).toString(16).padStart(2, "0"));
    return { kind: "color", value: `#${hex.join("")}` };
  }
  const unit = UNITS[property.syntax];
  // The compiler keeps six digits of radians, a thousandth of a degree: 30deg, not 30.00001
  if (property.syntax === "angle") return range(unit, +((x * 180) / Math.PI).toFixed(3), 0, 360);
  if (property.syntax === "percentage") return range(unit, x, 0, 100);
  // A number or a length: from 0 to twice the value, centered on 0 when it is negative
  const reach = Math.max(1, 2 * Math.abs(x));
  return range(unit, x, x < 0 ? -reach : 0, reach);
}

// A value past an end of the range moves that end to twice the value (the ranges always
// hold 0, so twice the value is further out); the step follows the new span
export function widen<C extends Control>(control: C, value: number): C {
  if (control.kind !== "range" || (value >= control.min && value <= control.max)) return control;
  const min = Math.min(control.min, 2 * value);
  const max = Math.max(control.max, 2 * value);
  return { ...control, min, max, step: stepFor(min, max) };
}

// What setProperty() receives: the number with the unit of its syntax
export const cssValue = (unit: Unit, value: number) => `${short(value)}${unit}`;

type Scene = {
  setProperty(name: string, value: string | number): void;
  removeProperty(name: string): void;
};

type Row = {
  element: HTMLElement;
  start: string; // the syntax and the start value: a change in the code makes a new row
};

function readFolded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "folded";
  } catch {
    return false; // private mode, blocked storage: open
  }
}

function saveFolded(folded: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, folded ? "folded" : "open");
  } catch {
    // folded for this page only
  }
}

function input(type: string, label: string): HTMLInputElement {
  const element = document.createElement("input");
  element.type = type;
  element.setAttribute("aria-label", label);
  return element;
}

// One row: the name, the control, a reset button once the value has moved
function createRow(property: RegisteredProperty, scene: Scene): HTMLElement {
  const row = document.createElement("div");
  row.className = "vars-row";
  row.dataset.variable = property.name;
  const name = document.createElement("span");
  name.className = "vars-name";
  name.textContent = property.name;
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "vars-reset";
  reset.textContent = "↺";
  reset.title = "Back to the start value";
  reset.setAttribute("aria-label", `Reset ${property.name}`);
  reset.hidden = true;

  const start = controlFor(property);
  if (start.kind === "color") {
    const picker = input("color", property.name);
    const text = document.createElement("output");
    picker.value = text.textContent = start.value;
    picker.addEventListener("input", () => {
      text.textContent = picker.value;
      reset.hidden = picker.value === start.value;
      scene.setProperty(property.name, picker.value);
    });
    reset.addEventListener("click", () => {
      picker.value = text.textContent = start.value;
      reset.hidden = true;
      scene.removeProperty(property.name);
    });
    row.append(name, picker, text, reset);
    return row;
  }

  const slider = input("range", property.name);
  const field = input("number", `${property.name}, ${start.unit === "" ? "a number" : `in ${start.unit}`}`);
  field.step = "any";
  let control = start;
  let value = start.value;
  const show = () => {
    slider.min = String(control.min);
    slider.max = String(control.max);
    slider.step = String(control.step);
    slider.value = field.value = String(short(value));
    reset.hidden = value === start.value;
  };
  const set = (next: number) => {
    value = next;
    show();
    scene.setProperty(property.name, cssValue(start.unit, value));
  };
  slider.addEventListener("input", () => set(Number(slider.value)));
  // Enter or leaving the field: a value outside the range widens it; an empty field or
  // one that is not a number shows the last value again
  field.addEventListener("change", () => {
    const typed = field.value.trim() === "" ? NaN : Number(field.value);
    if (!Number.isFinite(typed)) return show();
    control = widen(control, typed);
    set(typed);
  });
  reset.addEventListener("click", () => {
    control = start;
    value = start.value;
    show();
    scene.removeProperty(property.name);
  });
  show();
  const unit = document.createElement("span");
  unit.className = "vars-unit";
  unit.textContent = start.unit;
  row.append(name, slider, field, unit, reset);
  return row;
}

export function mountVariablesPanel(parent: HTMLElement, scene: Scene) {
  const panel = document.createElement("section");
  panel.className = "vars-panel";
  panel.hidden = true;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "vars-toggle";
  const list = document.createElement("div");
  list.className = "vars-list";
  list.id = "vars-list";
  toggle.setAttribute("aria-controls", list.id);
  panel.append(toggle, list);
  parent.append(panel); // a grid item of <body>: the CSS puts it in the scene cell

  let folded = readFolded();
  const fold = () => {
    toggle.setAttribute("aria-expanded", String(!folded));
    list.hidden = folded;
  };
  toggle.addEventListener("click", () => {
    folded = !folded;
    saveFolded(folded);
    fold();
  });
  fold();

  const rows = new Map<string, Row>();
  return {
    // After each compile: the variables of the scene now on screen. A row whose syntax and
    // start value did not change keeps its value; otherwise the code's start value wins.
    update(properties: RegisteredProperty[] | undefined): void {
      const next = properties ?? [];
      for (const [name, row] of rows) {
        const property = next.find((p) => p.name === name);
        if (property && `${property.syntax} ${property.initial}` === row.start) continue;
        rows.delete(name);
        scene.removeProperty(name);
      }
      for (const property of next) {
        if (!rows.has(property.name))
          rows.set(property.name, { element: createRow(property, scene), start: `${property.syntax} ${property.initial}` });
      }
      list.replaceChildren(...next.map((property) => rows.get(property.name)!.element));
      toggle.textContent = `variables · ${next.length}`;
      panel.hidden = next.length === 0;
    },
  };
}
