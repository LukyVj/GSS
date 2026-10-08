import type { Styles } from "../cascade/resolve";
import { errorAt } from "../syntax/errors";

// How shape silhouettes are drawn. auto keeps the existing single-sample edge;
// geometricPrecision covers a near miss only after the ray has passed it without hitting.
export type ShapeRendering = "auto" | "geometricPrecision";

export function readShapeRendering(sceneStyles: Styles): ShapeRendering {
  const value = sceneStyles["shape-rendering"];
  if (!value) return "auto";
  const [token] = value;
  if (
    value.length === 1 &&
    token.type === "IDENT" &&
    (token.value === "auto" || token.value === "geometricPrecision")
  )
    return token.value;
  throw errorAt(
    value,
    "shape-rendering expects auto or geometricPrecision, like: shape-rendering: geometricPrecision;",
  );
}
