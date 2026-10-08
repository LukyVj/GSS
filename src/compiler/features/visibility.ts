import type { StyledInstance, Styles } from "../cascade/resolve";
import type { Token } from "../syntax/tokenizer";
import { errorAt } from "../syntax/errors";

// display: none (decision 160): the object, or every object of a group, is left out of
// the scene when it compiles. It still counts among its siblings, like the DOM.
export function isDisplayed(instance: StyledInstance): boolean {
  return [instance.styles, ...instance.groupStyles].every((styles) => readDisplay(styles["display"]) === "block");
}

function readDisplay(value: Token[] | undefined): "none" | "block" {
  if (!value) return "block";
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT" && (token.value === "none" || token.value === "block")) return token.value;
  throw errorAt(value, "display expects none or block, like: display: none;");
}

// visibility (decision 160): 1.0 visible, 0.0 hidden or collapse. Between the two, an
// animation or a transition keeps the object there until it reaches hidden, like CSS.
export function readVisibility(value: Token[] | undefined): string {
  if (!value) return "1.0";
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT") {
    if (token.value === "visible") return "1.0";
    if (token.value === "hidden" || token.value === "collapse") return "0.0";
  }
  throw errorAt(value, "visibility expects visible, hidden or collapse, like: visibility: hidden;");
}

// Like CSS, visibility is inherited: an object that does not set it takes the one of its
// closest group that does
export function withInheritedVisibility(instance: StyledInstance): StyledInstance {
  const inherited = instance.groupStyles.findLast((styles) => styles["visibility"])?.["visibility"];
  if (!inherited) return instance;
  const inherit = (styles: Styles): Styles => (styles["visibility"] ? styles : { ...styles, visibility: inherited });
  readVisibility(inherited);
  return {
    ...instance,
    styles: inherit(instance.styles),
    hoverStyles: inherit(instance.hoverStyles),
    activeStyles: inherit(instance.activeStyles),
  };
}
