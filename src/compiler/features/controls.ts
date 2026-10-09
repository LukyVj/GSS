import type { StyledInstance, Styles } from "../cascade/resolve";
import type { Token } from "../syntax/tokenizer";
import { errorAt } from "../syntax/errors";

// The gestures that move the camera (decision 176): orbit, a drag turns it; zoom, the wheel
export type Gestures = { orbit: boolean; zoom: boolean };
// The camera of the scene, and the objects over which some gestures cannot start. Absent
// when the scene takes both and no object refuses one: the runtime does what it always did.
export type SceneControls = Gestures & { objects?: ({ id: number } & Gestures)[] };

const ERROR = "controls expects auto, none, or orbit and zoom, like: controls: orbit;";

function readControls(value: Token[] | undefined): Gestures | null {
  if (!value) return null;
  const words = value.map((token) => (token.type === "IDENT" ? token.value : ""));
  if (words.length === 1 && words[0] === "auto") return { orbit: true, zoom: true };
  if (words.length === 1 && words[0] === "none") return { orbit: false, zoom: false };
  const orbit = words.includes("orbit");
  const zoom = words.includes("zoom");
  const named = words.every((word) => word === "orbit" || word === "zoom");
  if (!named || words.length !== Number(orbit) + Number(zoom)) throw errorAt(value, ERROR);
  return { orbit, zoom };
}

const all = (gestures: Gestures) => gestures.orbit && gestures.zoom;

// On the scene, which gestures move the camera; on an object, inherited from its groups like
// cursor, which gestures can start over it
export function sceneControls(sceneStyles: Styles, drawn: StyledInstance[]): SceneControls | undefined {
  const scene = readControls(sceneStyles["controls"]) ?? { orbit: true, zoom: true };
  const objects = drawn.flatMap((instance) => {
    const inherited = instance.groupStyles.reduce<Gestures | null>((found, styles) => readControls(styles["controls"]) ?? found, null);
    const own = readControls(instance.styles["controls"]) ?? inherited;
    return own && !all(own) ? [{ id: instance.index, ...own }] : [];
  });
  if (objects.length > 0) return { ...scene, objects };
  return all(scene) ? undefined : scene;
}
