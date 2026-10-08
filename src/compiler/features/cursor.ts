import type { StyledInstance, Styles } from "../cascade/resolve";
import type { Token } from "../syntax/tokenizer";
import { errorAt } from "../syntax/errors";

// The keywords of CSS cursor (decision 161)
export const CURSORS = [
  "auto", "default", "none", "context-menu", "help", "pointer", "progress", "wait", "cell",
  "crosshair", "text", "vertical-text", "alias", "copy", "move", "no-drop", "not-allowed",
  "grab", "grabbing", "all-scroll", "col-resize", "row-resize", "n-resize", "e-resize",
  "s-resize", "w-resize", "ne-resize", "nw-resize", "se-resize", "sw-resize", "ew-resize",
  "ns-resize", "nesw-resize", "nwse-resize", "zoom-in", "zoom-out",
];

// The cursor over one object: under the mouse, and pressed (:active)
export type ObjectCursor = { id: number; hover: string; active: string };

function readCursor(value: Token[] | undefined): string | null {
  if (!value) return null;
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT" && CURSORS.includes(token.value)) return token.value;
  throw errorAt(value, `cursor expects a keyword of CSS, like: cursor: pointer; (${CURSORS.join(", ")})`);
}

// cursor (decision 161): what the page shows over each object that sets one. Like CSS, it
// is inherited from the groups; the hovered and pressed rules can change it.
export function sceneCursors(drawn: StyledInstance[]): ObjectCursor[] {
  return drawn.flatMap((instance) => {
    const inherited = instance.groupStyles.reduce<string | null>((found, styles) => readCursor(styles["cursor"]) ?? found, null);
    const cursorOf = (styles: Styles) => readCursor(styles["cursor"]) ?? inherited ?? "auto";
    readCursor(instance.styles["cursor"]);
    const hover = cursorOf(instance.hoverStyles);
    const active = cursorOf(instance.activeStyles);
    return hover === "auto" && active === "auto" ? [] : [{ id: instance.index, hover, active }];
  });
}
