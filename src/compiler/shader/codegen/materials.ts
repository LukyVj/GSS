// material: matte(), metal(), jelly(), glass() and their keywords, in GLSL
import type { Token } from "../../syntax/tokenizer";
import { tokenize } from "../../syntax/tokenizer";
import { errorAt } from "../../syntax/errors";
import { readFunction } from "../../values/values";
import { glslFloat } from "./glsl";
import { readColor } from "./read";

// Material keywords: shortcuts written in GSS
const MATERIAL_KEYWORDS: Record<string, string> = {
  gold: "metal(#d4af37, 0.2)",
  chrome: "metal(#ffffff, 0.05)",
  jelly: "jelly()",
  glass: "glass()",
  ice: "glass(#cfeaff, 1.31, frosted 0.25)",
};

// "matte(), metal(), jelly(), gold, chrome, jelly"
function availableMaterials(): string {
  return [
    "matte()",
    "metal()",
    "jelly()",
    "glass()",
    ...Object.keys(MATERIAL_KEYWORDS),
  ].join(", ");
}

// The frost styles of glass(). Each one is a GLSL constant: HAMMERED…
const FROST_STYLES = ["frosted", "wavy", "hammered", "blurred"];

// Reads the frost argument of glass(): "0.4", "hammered 0.4", "0.4 hammered" or "hammered".
// Returns the GLSL for the last two values of glass(): "0.4, HAMMERED"
function readFrost(arg: Token[] | undefined): string {
  // 1. No frost written → clear glass
  if (!arg) return "0.0, FROSTED";

  // 2. Read the tokens, in any order: at most one style and one amount
  let style = "frosted";
  let amount: number | null = null; // null = not written yet
  for (const token of arg) {
    if (token.type === "IDENT") {
      if (!FROST_STYLES.includes(token.value)) {
        throw errorAt(
          token,
          `Unknown frost style "${token.value}". Available: ${FROST_STYLES.join(", ")}`,
        );
      }
      style = token.value;
    } else if (
      token.type === "NUMBER" &&
      token.value >= 0 &&
      token.value <= 1
    ) {
      amount = token.value;
    } else {
      throw errorAt(
        token,
        "glass(): frost expects a number between 0 and 1 and an optional style, like: material: glass(#ffffff, 1.5, hammered 0.4);",
      );
    }
  }

  // 3. A style without an amount → 0.5
  if (amount === null) amount = 0.5;

  return `${glslFloat(amount)}, ${style.toUpperCase()}`; // "frosted" → "FROSTED"
}

type Setting = { name: string; min: number; max: number; fallback: number };

// Reads the settings of a material, in order. A missing setting takes its fallback.
// args: what's left once the color is taken out.
function readSettings(
  args: Token[][],
  material: string,
  settings: Setting[],
): number[] {
  // 1. The example for the error messages, computed once
  const fallbacks = settings.map((setting) => setting.fallback).join(", ");
  const example = `material: ${material}(#ff5a36, ${fallbacks});`;

  // 2. Too many arguments
  if (args.length > settings.length) {
    const names = settings.map((setting) => `a ${setting.name}`).join(" and ");
    throw errorAt(
      args.flat(),
      `${material}() expects an optional color and ${names}, like: ${example}`,
    );
  }

  // 3. Each setting: its argument, or its fallback when it's missing
  return settings.map((setting, i) => {
    if (!args[i]) return setting.fallback;

    const token = args[i][0];
    if (
      token.type !== "NUMBER" ||
      token.value < setting.min ||
      token.value > setting.max
    ) {
      throw errorAt(
        args[i],
        `${material}(): ${setting.name} expects a number between ${setting.min} and ${setting.max}, like: ${example}`,
      );
    }
    return token.value;
  });
}
// Turns the material value into GLSL.
// "color" is the object's GLSL color: a material without its own color uses it,
// like currentColor in CSS.
export function readMaterial(value: Token[] | undefined, color: string): string {
  // 1. Nothing written → matte, with the color of color
  if (!value) return `matte(${color})`;

  // 1b. A keyword: replace it with its function, then read that
  if (value.length === 1 && value[0].type === "IDENT") {
    const name = value[0].value;
    if (!Object.hasOwn(MATERIAL_KEYWORDS, name)) {
      throw errorAt(
        value,
        `Unknown material "${name}". Available: ${availableMaterials()}`,
      );
    }
    return readMaterial(tokenize(MATERIAL_KEYWORDS[name]), color);
  }

  // 2. It must be a function
  const call = readFunction(value);
  if (!call) {
    throw errorAt(
      value,
      "material expects a function, like: material: matte();",
    );
  }

  // 3. Known names
  if (
    call.name !== "matte" &&
    call.name !== "metal" &&
    call.name !== "jelly" &&
    call.name !== "glass"
  ) {
    throw errorAt(
      value,
      `Unknown material "${call.name}". Available: ${availableMaterials()}`,
    );
  }

  // 4. The optional color comes first: if it's there, take it out of the list
  const args = [...call.args]; // a copy, so shift() does not touch call.args
  let ownColor = color;
  if (args.length > 0 && args[0][0].type === "HASH") {
    ownColor = readColor(args.shift());
  }

  // 5. matte: nothing may be left
  if (call.name === "matte") {
    if (args.length > 0) {
      throw errorAt(
        value,
        "matte() expects only an optional color, like: material: matte(#ff5a36);",
      );
    }
    return `matte(${ownColor})`;
  }

  // 6. metal: what's left is the roughness, 0.2 when missing
  if (call.name === "metal") {
    const roughness = readSettings(args, "metal", [
      { name: "roughness", min: 0, max: 1, fallback: 0.2 },
    ]);
    return `metal(${ownColor}, ${glslFloat(roughness[0])})`;
  }

  if (call.name === "jelly") {
    // 7. jelly: what's left is the density, 0.5 when missing
    const density = readSettings(args, "jelly", [
      { name: "density", min: 0, max: 1, fallback: 0.5 },
    ]);
    return `jelly(${ownColor}, ${glslFloat(density[0])})`;
  }

  if (call.name === "glass") {
    if (args.length > 2) {
      throw errorAt(
        value,
        "glass() expects an optional color and a refraction index and a frost, like: material: glass(#ffffff, 1.5, hammered 0.4);",
      );
    }
    const [ior] = readSettings(args.slice(0, 1), "glass", [
      { name: "refraction index", min: 1, max: 3, fallback: 1.5 },
    ]);
    const frost = readFrost(args[1]);
    return `glass(${ownColor}, ${glslFloat(ior)}, ${frost})`;
  }

  return `matte(${ownColor})`;
}
