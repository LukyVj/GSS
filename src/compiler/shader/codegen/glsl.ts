// Small helpers shared by every part of the code generator: GLSL numbers and
// vectors, the parts of the template, and the label of an object in comments
import type { StyledInstance, Styles } from "../../cascade/resolve";

// What an object looks like when hovered (or pressed), and its number in uHover[]
// start: the index in uStart[] when the state starts an animation (decision 141)
export type HoverLayer = { styles: Styles; slot: number; state: ":hover" | ":active"; start?: number };
// The layers mixed over the rest state: hovered, then pressed (decision 95)
export type Hover = HoverLayer[];

// Rounds to 3 decimals: the numbers GSS writes stay short
export function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// GLSL requires "1.0" and rejects "1" where it expects a float
export function glslFloat(n: number): string {
  const text = String(n);
  return text.includes(".") || text.includes("e") ? text : `${text}.0`;
}

export function vec3(values: number[]): string {
  return `vec3(${values.map(glslFloat).join(", ")})`;
}

export function label(instance: StyledInstance): string {
  const id = instance.id ? `#${instance.id}` : "";
  const classes = instance.classes.map((c) => `.${c}`).join("");
  return `${instance.tag}${id}${classes}`;
}

// A part of the shader under its comment, or nothing at all when the part is empty
export function section(comment: string, code: string): string {
  return code ? `${comment}\n${code}` : "";
}

// Lines added at the end of a line of the template: nothing when there are none,
// so no blank line is left behind (getMaterial(), main())
export function moreLines(code: string): string {
  return code ? `\n${code}` : "";
}

// The functions of "table" that "code" calls, ready to paste in the shader.
// Also those they call themselves: shadeGlass() calls noise(), which calls hash3().
// They come out in the order of the table, so each one after those it calls.
export function used(table: Record<string, string>, code: string): string {
  const picked = new Set<string>();
  let searched = code; // the code, then every function picked so far
  let found = true;
  while (found) {
    found = false;
    for (const [name, fn] of Object.entries(table)) {
      if (picked.has(name) || !searched.includes(name + "(")) continue;
      picked.add(name);
      searched += "\n" + fn;
      found = true;
    }
  }
  return Object.entries(table)
    .filter(([name]) => picked.has(name))
    .map(([, fn]) => fn)
    .join("\n\n");
}
