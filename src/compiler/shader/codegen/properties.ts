// The values that read a variable registered with @property (decision 105): the GLSL of
// its uniform takes the place of the number, the angle or the color written there.
import type { Token } from "../../syntax/tokenizer";
import { errorAt } from "../../syntax/errors";
import { glslFloat } from "./glsl";
import { readAngle } from "../../values/values";

const EXPECTS: Record<string, { syntax: string; what: string }> = {
  translate: { syntax: "number", what: "numbers" },
  scale: { syntax: "number", what: "a number" },
  "rotate-x": { syntax: "angle", what: "an angle" },
  "rotate-y": { syntax: "angle", what: "an angle" },
  "rotate-z": { syntax: "angle", what: "an angle" },
  color: { syntax: "color", what: "a color" },
  background: { syntax: "color", what: "a color" },
  floor: { syntax: "color", what: "a color" },
};

// A reader of a property that also reads the uniforms of registered variables
export function liveRead(
  property: string,
  read: (value: Token[] | undefined) => string,
): (value: Token[] | undefined) => string {
  const expects = EXPECTS[property];
  if (!expects) return read; // offset-distance reads them itself (offset.ts)
  return (value) => {
    if (!value?.some((token) => token.type === "EXPR")) return read(value);
    for (const token of value)
      if (token.type === "EXPR" && token.syntax !== expects.syntax)
        throw errorAt(value, `${property} expects ${expects.what}: ${token.value} is a <${token.syntax}>`);
    if (property !== "translate") {
      if (value.length !== 1) throw errorAt(value, `${property} expects ${expects.what}`);
      return (value[0] as Extract<Token, { type: "EXPR" }>).code;
    }
    const parts = value.map((token) => {
      if (token.type === "EXPR") return token.code;
      if (token.type === "NUMBER") return glslFloat(token.value);
      throw errorAt(value, "translate expects three numbers, like: translate: 0 1 0;");
    });
    if (parts.length !== 3) throw errorAt(value, "translate expects three numbers, like: translate: 0 1 0;");
    return `vec3(${parts.join(", ")})`;
  };
}

// light: azimuth elevation, either one set from JS: the direction of the sun, computed by
// lightDirection() like readLight() computes it. null when both are known.
export function liveLight(value: Token[] | undefined): string | null {
  if (!value?.some((token) => token.type === "EXPR")) return null;
  if (value.length !== 2) throw errorAt(value, "light expects two angles, like: light: 45deg 60deg;");
  const [azimuth, elevation] = value.map((token) => {
    if (token.type === "EXPR") {
      if (token.syntax !== "angle") throw errorAt(value, `light expects two angles: ${token.value} is a <${token.syntax}>`);
      return token.code;
    }
    return glslFloat(+readAngle([token]).toFixed(6));
  });
  return [
    "vec3 lightDirection() {",
    `  return vec3(cos(${elevation}) * sin(${azimuth}), sin(${elevation}), cos(${elevation}) * cos(${azimuth}));`,
    "}",
    "#define LIGHT_DIR lightDirection()",
  ].join("\n");
}
