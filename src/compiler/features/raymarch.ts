import type { Styles } from "../cascade/resolve";
import { errorAt } from "../syntax/errors";
import type { Token } from "../syntax/tokenizer";
import { clampComputed } from "../values/calc";

// How far and how finely the rays look (decision 224): the steps of the march of each
// pixel, the distance past which a ray sees the background, and how close to a surface
// counts as a hit. Written in the shader, so read when the scene compiles.
export type Raymarch = { steps: number; maxDistance: number; precision: number };

export const RAYMARCH: Raymarch = { steps: 100, maxDistance: 20, precision: 0.001 };

// One number in [min, max], computed or written; a whole number when asked
function readOne(value: Token[] | undefined, fallback: number, min: number, max: number, whole: boolean, error: string): number {
  if (!value) return fallback;
  const [token] = value;
  const n = value.length === 1 && token.type === "NUMBER" ? clampComputed(token, -Infinity) : NaN;
  if (!(n >= min && n <= max) || (whole && !Number.isInteger(n))) throw errorAt(value, error);
  return n;
}

export function readRaymarch(sceneStyles: Styles): Raymarch {
  return {
    steps: readOne(
      sceneStyles["raymarch-steps"],
      RAYMARCH.steps,
      16,
      1024,
      true,
      "raymarch-steps expects a whole number from 16 to 1024, like: raymarch-steps: 200;",
    ),
    maxDistance: readOne(
      sceneStyles["max-distance"],
      RAYMARCH.maxDistance,
      10,
      500,
      false,
      "max-distance expects a number from 10 to 500, like: max-distance: 40;",
    ),
    precision: readOne(
      sceneStyles["hit-precision"],
      RAYMARCH.precision,
      0.0001,
      0.01,
      false,
      "hit-precision expects a number from 0.0001 to 0.01, like: hit-precision: 0.0005;",
    ),
  };
}
