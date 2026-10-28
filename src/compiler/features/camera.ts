import type { Styles } from "../cascade/resolve";
import { errorAt } from "../syntax/errors";
import type { Token } from "../syntax/tokenizer";
import { readAngle, readNumber } from "../values/values";

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
  if (!value) return 0;

  // Only one value is allowed
  if (value.length !== 1) throw errorAt(value, error);
  const [token] = value;

  // Case 2: "none" → no rotation
  if (token.type === "IDENT" && token.value === "none") return 0;

  // Case 3: anything that is not a duration → error
  if (token.type !== "DIMENSION" || token.value <= 0)
    throw errorAt(value, error);

  // Case 4: a duration → convert it to seconds, then to a speed
  let seconds: number;
  if (token.unit === "s") seconds = token.value;
  else if (token.unit === "ms") seconds = token.value / 1000;
  else throw errorAt(value, error);

  return (2 * Math.PI) / seconds;
}

// The farthest the camera goes: 5 units short of the end of the scene, so the target and
// what is around it are drawn (decision 224); 15 with the max-distance of 20
export const farthestCamera = (maxDistance = 20) => maxDistance - 5;

export function readCamera(sceneStyles: Styles, maxDistance = 20): CameraSettings {
  // 1. The distance
  const distance = readNumber(
    sceneStyles["camera-distance"],
    "camera-distance",
    8,
    true,
  );
  const farthest = farthestCamera(maxDistance);
  if (distance < 3 || distance > farthest) {
    throw errorAt(
      sceneStyles["camera-distance"],
      `camera-distance expects a number from 3 to ${farthest}${maxDistance === 20 ? "" : " (5 less than max-distance)"}, like: camera-distance: 8;`,
    );
  }

  // 2. The angle
  let yaw = 0;
  let pitch = 0.4;
  const angle = sceneStyles["camera-angle"];
  if (angle) {
    if (angle.length !== 2) {
      throw errorAt(
        angle,
        "camera-angle expects two angles, like: camera-angle: 45deg 60deg;",
      );
    }
    yaw = readAngle([angle[0]]);
    pitch = readAngle([angle[1]]);
  }

  if (pitch < 0 || pitch > 1.4) {
    throw errorAt(
      sceneStyles["camera-angle"],
      "camera-angle expects a height from 0deg to 80deg.",
    );
  }

  // 3. The spin
  const spin = readSpin(sceneStyles["camera-spin"]);

  return { distance, yaw, pitch, spin };
}

// camera-fov (decision 226): the angle the camera sees from the top to the bottom of the
// canvas, as the focal length of its rays, rounded to 4 decimals. 1.5 since the first version,
// about 36.87deg: an angle that rounds to it keeps the shader as it was.
export const FOCAL = 1.5;

export function readFocal(sceneStyles: Styles): number {
  const value = sceneStyles["camera-fov"];
  if (!value) return FOCAL;
  const error = "camera-fov expects an angle from 10deg to 120deg, like: camera-fov: 50deg;";
  if (value.length !== 1 || value[0].type !== "DIMENSION") throw errorAt(value, error);
  const angle = readAngle(value);
  if (!(angle >= (10 * Math.PI) / 180 - 1e-9 && angle <= (120 * Math.PI) / 180 + 1e-9)) throw errorAt(value, error);
  return +(0.5 / Math.tan(angle / 2)).toFixed(4);
}

