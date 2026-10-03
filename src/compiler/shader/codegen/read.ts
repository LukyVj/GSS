// Reads a GSS value and writes it in GLSL: a translate, a size, a color, an angle…
import type { Token } from "../../syntax/tokenizer";
import { errorAt, locate } from "../../syntax/errors";
import { readAngle, readNumber } from "../../values/values";
import { clampComputed } from "../../values/calc";
import { glslFloat, round } from "./glsl";

export function hexToRgb(hex: string): [number, number, number] {
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Invalid color: #${hex}`);
  const channel = (start: number) =>
    round(parseInt(full.slice(start, start + 2), 16) / 255);
  return [channel(0), channel(2), channel(4)];
}

export function readTranslate(value: Token[] | undefined): string {
  if (!value) return "vec3(0.0)";
  const numbers = value.map((token) => {
    if (token.type !== "NUMBER")
      throw errorAt(
        value,
        "translate expects three numbers, like: translate: 0 1 0;",
      );
    return token.value;
  });
  if (numbers.length !== 3)
    throw errorAt(
      value,
      "translate expects three numbers, like: translate: 0 1 0;",
    );
  return `vec3(${numbers.map(glslFloat).join(", ")})`;
}

// Reads "2" or "2 1 1" and returns the full size on x, y and z
export function readSize(value: Token[] | undefined): number[] {
  const errorMessage =
    "size expects one or three positive numbers, like: size: 2 1 1;";
  if (!value) return [1, 1, 1];
  const numbers = value.map((token) => {
    if (token.type !== "NUMBER" || token.value <= 0)
      throw errorAt(token, errorMessage);
    return token.value;
  });

  if (numbers.length === 1) return [numbers[0], numbers[0], numbers[0]];
  if (numbers.length === 3) return numbers;
  throw errorAt(value, errorMessage);
}

// Reads "0.5" or "0.5 0.2" and returns the bottom and top radii of a cone
export function readRadii(value: Token[] | undefined): number[] {
  const errorMessage =
    "radius expects one or two positive numbers, like: radius: 0.5 0.2;";
  if (!value) return [0.5, 0];
  const numbers = value.map((token) => {
    const n = token.type === "NUMBER" ? clampComputed(token, 0) : NaN; // a computed radius below 0 is 0
    if (!(n >= 0)) throw errorAt(token, `${errorMessage} (got ${token.value})`);
    return n;
  });

  if (numbers.length === 1) return [numbers[0], 0];
  if (numbers.length === 2) return numbers;
  throw errorAt(value, errorMessage);
}

// Reads "2" or "2 1" and returns the full width and depth of a plane
export function readFlatSize(value: Token[] | undefined): number[] {
  const errorMessage =
    "size expects one or two positive numbers on a plane, like: size: 2 1;";
  if (!value) return [1, 1];
  const numbers = value.map((token) => {
    if (token.type !== "NUMBER" || token.value <= 0)
      throw errorAt(token, errorMessage);
    return token.value;
  });

  if (numbers.length === 1) return [numbers[0], numbers[0]];
  if (numbers.length === 2) return numbers;
  throw errorAt(value, errorMessage);
}

export function readScale(value: Token[] | undefined): string {
  return glslFloat(readNumber(value, "scale", 1));
}

export function readColor(value: Token[] | undefined, fallback = "vec3(0.9)"): string {
  if (!value) return fallback;
  const [token] = value;
  // #ff000080, transparent: only the layers of background take a transparent color (decision 112)
  if (value.length === 1 && token.type === "HASH" && (token.value.length === 4 || token.value.length === 8))
    throw errorAt(value, "GSS has no transparency yet, except in the layers of background: write an opaque color here");
  if (value.length !== 1 || token.type !== "HASH") {
    throw errorAt(
      value,
      "color expects a hex, rgb(), hsl() or named color, like: color: #ff5a36; or color: rgb(255 0 0); or color: red;",
    );
  }
  const rgb = locate(token, () => hexToRgb(token.value));
  return `vec3(${rgb.map(glslFloat).join(", ")})`;
}

// Reads "azimuth elevation" and returns the direction toward the sun
export function readLight(value: Token[] | undefined): number[] {
  if (!value) return [-0.408, 0.816, 0.408];
  if (value.length !== 2) {
    throw errorAt(value, "light expects two angles, like: light: 45deg 60deg;");
  }
  const azimuth = readAngle([value[0]]);
  const elevation = readAngle([value[1]]);

  return [
    round(Math.cos(elevation) * Math.sin(azimuth)),
    round(Math.sin(elevation)),
    round(Math.cos(elevation) * Math.cos(azimuth)),
  ];
}

// rotate-x rotates y and z, rotate-y rotates x and z, rotate-z rotates x and y
export const ROTATIONS: [string, string][] = [
  ["rotate-x", "yz"],
  ["rotate-y", "xz"],
  ["rotate-z", "xy"],
];

// An angle in radians for GLSL, or "0.0" when there is no rotation
export function readRotation(value: Token[] | undefined): string {
  return value ? glslFloat(round(readAngle(value))) : "0.0";
}
