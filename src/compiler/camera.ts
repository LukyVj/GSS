import type { Styles } from "./resolve";
import type { Token } from "./tokenizer";
import { readAngle, readNumber } from "./codegen";

// The camera settings the runtime needs. They are not written in the shader:
// main.ts starts from them, then the mouse changes them.
export type CameraSettings = {
  distance: number; // distance from the target
  yaw: number; // angle around the target, in radians
  pitch: number; // height above the horizon, in radians
  spin: number; // automatic rotation, in radians per second
};

// Reads "20s", "500ms" or "none" and returns a speed in radians per second
function readSpin(value: Token[] | undefined): number {
  const error =
    "camera-spin expects a duration or none, like: camera-spin: 20s;";

  // Case 1: nothing written → the default speed
  if (!value) return 0.3;

  // Only one value is allowed
  if (value.length !== 1) throw new Error(error);
  const [token] = value;

  // Case 2: "none" → no rotation
  if (token.type === "IDENT" && token.value === "none") return 0;

  // Case 3: anything that is not a duration → error
  if (token.type !== "DIMENSION" || token.value <= 0) throw new Error(error);

  // Case 4: a duration → convert it to seconds, then to a speed
  let seconds: number;
  if (token.unit === "s") seconds = token.value;
  else if (token.unit === "ms") seconds = token.value / 1000;
  else throw new Error(error);

  return (2 * Math.PI) / seconds;
}

export function readCamera(sceneStyles: Styles): CameraSettings {
  // 1. The distance
  const distance = readNumber(
    sceneStyles["camera-distance"],
    "camera-distance",
    8,
    true,
  );
  if (distance < 3 || distance > 15) {
    throw new Error(
      "camera-distance expects a number from 3 to 15, like: camera-distance: 8;",
    );
  }

  // 2. The angle
  let yaw = 0;
  let pitch = 0.4;
  const angle = sceneStyles["camera-angle"];
  if (angle) {
    if (angle.length !== 2) {
      throw new Error(
        "camera-angle expects two angles, like: camera-angle: 45deg 60deg;",
      );
    }
    yaw = readAngle([angle[0]]);
    pitch = readAngle([angle[1]]);
  }

  if (pitch < 0 || pitch > 1.4) {
    throw new Error("camera-angle expects a height from 0deg to 80deg.");
  }

  // 3. The spin
  const spin = readSpin(sceneStyles["camera-spin"]);

  return { distance, yaw, pitch, spin };
}
