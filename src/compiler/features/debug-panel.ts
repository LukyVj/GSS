import type { PanelRule } from "../syntax/ast";
import { errorAt } from "../syntax/errors";

// @debug-panel { display: open | folded | none; } (decision 204): over the render of the
// playground and of Try it, the axes and a grid at the origin, and a panel with the numbers of
// the scene. display is open when it is not written; the last rule wins, like the cascade.
export type DebugPanel = "open" | "folded";
const DISPLAYS = ["open", "folded", "none"];

export function readDebugPanel(rules: PanelRule[]): DebugPanel | undefined {
  let display = "none";
  for (const rule of rules) {
    display = "open";
    for (const d of rule.descriptors) {
      if (d.property !== "display") throw errorAt(d, `@debug-panel takes display, not ${d.property}`);
      const [token] = d.value;
      const text = d.value.map((t) => String(t.value)).join(" ");
      if (d.value.length !== 1 || token.type !== "IDENT" || !DISPLAYS.includes(String(token.value)))
        throw errorAt(d.value, `display of @debug-panel is open, folded or none, not ${text}`);
      display = String(token.value);
    }
  }
  return display === "none" ? undefined : (display as DebugPanel);
}
