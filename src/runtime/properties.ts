// setProperty(), getPropertyValue(), removeProperty(): the variables a scene registers
// with @property, set from the page without compiling again (decision 105).
// The compiler gives each one a vec4 of uProperties[] and its initial value; this keeps
// the values the page sets, and fills uProperties[] at every frame. No compiler import.
import type { RegisteredProperty } from "../compiler/features/properties";

type Syntax = RegisteredProperty["syntax"];

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i;
const RADIANS: Record<string, number> = { deg: Math.PI / 180, rad: 1, grad: Math.PI / 200, turn: 2 * Math.PI };
const EXAMPLES: Record<Syntax, string> = {
  number: 'a <number>, like "4"',
  angle: 'an <angle>, like "90deg"',
  percentage: 'a <percentage>, like "50%"',
  color: 'a <color>, like "#ff5a36"',
};

// A value written by the page → the 4 floats of its uniform, like the compiler writes them
export function parsePropertyValue(name: string, syntax: Syntax, value: string | number): number[] {
  const wrong = () => new Error(`${name} is ${EXAMPLES[syntax]}`);
  if (typeof value === "number") {
    if (syntax !== "number" || !Number.isFinite(value)) throw wrong();
    return [value, 0, 0, 0];
  }
  const text = value.trim();
  if (syntax === "color") {
    const rgb = parseColor(text);
    if (!rgb) throw wrong();
    return [...rgb, 0];
  }
  const match = text.match(NUMBER);
  if (!match) throw wrong();
  const n = Number(match[0]);
  const unit = text.slice(match[0].length);
  if (syntax === "number" && unit === "") return [n, 0, 0, 0];
  if (syntax === "percentage" && unit === "%") return [n, 0, 0, 0];
  if (syntax === "angle" && unit.toLowerCase() in RADIANS) return [n * RADIANS[unit.toLowerCase()], 0, 0, 0];
  throw wrong();
}

// The value of a uniform, written back like CSS writes a computed value
function formatValue(syntax: Syntax, floats: number[]): string {
  const short = (n: number) => String(+n.toFixed(6));
  if (syntax === "number") return short(floats[0]);
  if (syntax === "percentage") return `${short(floats[0])}%`;
  if (syntax === "angle") return `${short((floats[0] * 180) / Math.PI)}deg`;
  return `#${floats
    .slice(0, 3)
    .map((c) => Math.round(Math.min(Math.max(c, 0), 1) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

// #rgb and #rrggbb here; any other CSS color is read by the browser itself, through a
// 2D canvas: named colors, rgb(), hsl(), oklch(), color-mix()…, in sRGB like the compiler
let painter: CanvasRenderingContext2D | null | undefined;
function parseColor(text: string): [number, number, number] | null {
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    return [0, 2, 4].map((i) => +(parseInt(full.slice(i, i + 2), 16) / 255).toFixed(3)) as [number, number, number];
  }
  if (typeof document === "undefined" || typeof CSS === "undefined" || !CSS.supports("color", text)) return null;
  painter ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!painter) return null;
  painter.clearRect(0, 0, 1, 1);
  painter.fillStyle = "#000";
  painter.fillStyle = text;
  painter.fillRect(0, 0, 1, 1);
  const [r, g, b] = painter.getImageData(0, 0, 1, 1).data;
  return [r, g, b].map((c) => +(c / 255).toFixed(3)) as [number, number, number];
}

export type Properties = {
  // The variables of the scene now on screen (from its CompiledScene)
  use(registered: RegisteredProperty[] | undefined): void;
  set(name: string, value: string | number): void;
  get(name: string): string; // "" when the scene does not register it, like CSS
  remove(name: string): void;
  // uProperties[], 4 floats per variable; null when the scene registers none
  values(): Float32Array | null;
};

export function createProperties(): Properties {
  let registered: RegisteredProperty[] = [];
  // What the page set: kept when the scene changes, used while the syntax stays the same
  const set = new Map<string, { syntax: Syntax; floats: number[] }>();
  const find = (name: string) => registered.find((p) => p.name === name);
  const current = (property: RegisteredProperty) => {
    const value = set.get(property.name);
    return value && value.syntax === property.syntax ? value.floats : property.initial;
  };
  return {
    use(next) {
      registered = next ?? [];
    },
    set(name, value) {
      const property = find(name);
      if (!property) throw new Error(`${name} is not registered with @property in this scene`);
      set.set(name, { syntax: property.syntax, floats: parsePropertyValue(name, property.syntax, value) });
    },
    get(name) {
      const property = find(name);
      return property ? formatValue(property.syntax, current(property)) : "";
    },
    remove(name) {
      set.delete(name);
    },
    values() {
      if (registered.length === 0) return null;
      return new Float32Array(registered.flatMap(current));
    },
  };
}
