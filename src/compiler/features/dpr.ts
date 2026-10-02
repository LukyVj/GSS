import type { Styles } from "../cascade/resolve";
import { errorAt } from "../syntax/errors";
import { clampComputed } from "../values/calc";

// The pixel density of the render, chosen by the author.
// auto: the screen, up to 2 · max: the screen · a number: never more than the screen
export type Dpr = "auto" | "max" | number;

export function readDpr(sceneStyles: Styles): Dpr {
  const value = sceneStyles["dpr"];
  const error =
    "dpr expects auto, max or a number from 0.25 to 4, like: dpr: 2;";

  // Case 1: nothing written → the default
  if (!value) return "auto";

  // Only one value is allowed
  if (value.length !== 1) throw errorAt(value, error);
  const [token] = value;

  // Case 2: a keyword
  if (
    token.type === "IDENT" &&
    (token.value === "auto" || token.value === "max")
  )
    return token.value;

  // Case 3: a number in range
  if (token.type === "NUMBER") {
    const dpr = clampComputed(token, 0.25, 4);
    if (dpr >= 0.25 && dpr <= 4) return dpr;
  }

  // Case 4: anything else
  throw errorAt(value, error);
}
