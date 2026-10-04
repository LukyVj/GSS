import type { Styles } from "../cascade/resolve";
import { errorAt } from "../syntax/errors";

// How the scene is drawn (decision 131): shaded, its surfaces lit; distance, the same with
// the isolines of its distance field over it, the field the shader marches through
export type View = "shaded" | "distance";

export function readView(sceneStyles: Styles): View {
  const value = sceneStyles["view"];
  if (!value) return "shaded";
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT" && (token.value === "shaded" || token.value === "distance"))
    return token.value;
  throw errorAt(value, "view expects shaded or distance, like: view: distance;");
}
