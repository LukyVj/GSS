// currentColor, like CSS: the object's own color, wherever a color is expected (decision 94).
// Read after var(), before the math and the colors, like a variable: the rest of the
// compiler never sees it.
import type { Token } from "../syntax/tokenizer";
import { errorAt, rememberSpan, spanAcross } from "../syntax/errors";
import { GRADIENT_FUNCTIONS } from "../shader/gradient";
import { MATERIAL_FUNCTIONS } from "./colors";
import type { Styles } from "../cascade/resolve";

// The color of an object without color: the initial value of color
const INITIAL: Token = { type: "HASH", value: "e6e6e6" };

const isCurrent = (token: Token | undefined): boolean =>
  token?.type === "IDENT" && token.value.toLowerCase() === "currentcolor";

export function usesCurrentColor(value: Token[]): boolean {
  return value.some(isCurrent);
}

// color: currentColor would read itself: GSS does not inherit color from a group
export function refuseInColor(property: string, value: Token[]): void {
  if (property === "color" && usesCurrentColor(value))
    throw errorAt(
      value.find(isCurrent)!,
      "color: currentColor refers to itself: currentColor is the object's color, for the other properties, like material: metal(currentColor)",
    );
}

// Every currentColor of a set of styles replaced by its color (after var())
export function resolveCurrentColor(styles: Styles, owner: "object" | "scene"): Styles {
  const color = styles["color"];
  const computed: Styles = {};
  for (const [property, value] of Object.entries(styles)) {
    if (!usesCurrentColor(value)) {
      computed[property] = value;
      continue;
    }
    if (owner === "scene")
      throw errorAt(
        value.find(isCurrent)!,
        "The scene has no color: currentColor is the color of an object",
      );
    refuseInColor(property, value);
    computed[property] = replace(value, color);
  }
  return computed;
}

function replace(value: Token[], color: Token[] | undefined): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < value.length; i++) {
    const token = value[i];
    if (!isCurrent(token)) {
      out.push(token);
      continue;
    }
    // metal(currentColor, 0.2) is metal(0.2): the material takes the color, which stays
    // animated, changes on :hover and can be a gradient
    const fn = value[i - 2];
    const open = value[i - 1];
    if (
      fn?.type === "IDENT" &&
      MATERIAL_FUNCTIONS.includes(fn.value) &&
      open?.type === "PUNCT" &&
      open.value === "("
    ) {
      const comma = value[i + 1];
      if (comma?.type === "PUNCT" && comma.value === ",") i++;
      continue;
    }
    const first = color?.[0];
    if (first?.type === "IDENT" && GRADIENT_FUNCTIONS.includes(first.value))
      throw errorAt(
        token,
        "currentColor is a gradient here: it can only be a material's color, like material: metal(currentColor)",
      );
    for (const part of color ?? [INITIAL]) {
      const copy = { ...part };
      const span = spanAcross(token);
      if (span) rememberSpan(copy, span); // an error underlines currentColor
      out.push(copy);
    }
  }
  return out;
}
