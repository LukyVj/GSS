import type { Styles } from "../cascade/resolve";
import { errorAt } from "../syntax/errors";

// How the scene is drawn (decision 131): shaded, its surfaces lit; distance, the same with
// the isolines of its distance field over it, the field the shader marches through; steps, each
// pixel colored by how many times its rays measured that field (decision 204)
export type View = "shaded" | "distance" | "steps";

export function readView(sceneStyles: Styles): View {
  const value = sceneStyles["view"];
  if (!value) return "shaded";
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT" && (token.value === "shaded" || token.value === "distance" || token.value === "steps"))
    return token.value;
  throw errorAt(value, "view expects shaded, distance or steps, like: view: distance;");
}
