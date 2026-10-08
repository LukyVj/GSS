// outline (decision 163): a line around the silhouette of an object, like CSS outline, its
// width and offset in the units of the scene. map() measures how far each point is from the
// outlined objects, in widths of their outline past their offset (outlineAt); the primary
// ray keeps the first closest point it passed within a line, and main() draws the line there
// when the ray did not hit that object, or hit it again much further (a torus seen through
// its hole). Nothing of this is in a shader without an outline.
import type { Token } from "../../syntax/tokenizer";
import type { Keyframes, Declaration } from "../../syntax/ast";
import type { StyledInstance, Styles } from "../../cascade/resolve";
import { errorAt } from "../../syntax/errors";
import { clampComputed } from "../../values/calc";
import { gradientMean } from "../gradient";
import { glslFloat, label, type Hover } from "./glsl";
import { hoverValue } from "./animation";
import { readSurfaceColor } from "./read";
import { hoist, type Hoisted } from "./transforms";

const STYLES = ["none", "solid", "auto"];
const UNDRAWN = ["dotted", "dashed", "double", "groove", "ridge", "inset", "outset", "hidden"];
// CSS measures thin, medium and thick in pixels; GSS in units of the scene
const WIDTHS: Record<string, number> = { thin: 0.01, medium: 0.02, thick: 0.04 };
const SHORTHAND_ERROR =
  "outline expects a width, a style (solid) and a color, in any order, like: outline: 0.05 solid #ff5a36;";
// The widths and colors the shader reads: the band is the width, or 0 when the style is none
const BAND = "outline-band";
const COLOR = "outline-paint";

const isColor = (token: Token) => token.type === "HASH" || (token.type === "EXPR" && token.syntax === "color");

function checkStyle(token: Token, value: Token[]): string {
  if (token.type === "IDENT" && STYLES.includes(token.value)) return token.value;
  if (token.type === "IDENT" && UNDRAWN.includes(token.value))
    throw errorAt(value, `GSS draws solid outlines: ${token.value} is not drawn yet. Write outline-style: solid;`);
  throw errorAt(value, "outline-style expects none, solid or auto, like: outline-style: solid;");
}

function checkWidth(value: Token[], property: string): Token[] {
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT" && token.value in WIDTHS)
    return [{ type: "NUMBER", value: WIDTHS[token.value] }];
  if (value.length === 1 && token.type === "NUMBER" && clampComputed(token, -Infinity) >= 0) return value;
  if (value.length === 1 && token.type === "EXPR" && token.syntax === "number") return value;
  throw errorAt(value, `${property} expects a number of units of the scene, 0 or more, or thin, medium or thick, like: ${property}: 0.05;`);
}

// The shorthand into its parts
function splitShorthand(value: Token[]): { width?: Token[]; style?: string; color?: Token[] } {
  const parts: { width?: Token[]; style?: string; color?: Token[] } = {};
  for (const token of value) {
    if (isColor(token) && !parts.color) parts.color = [token];
    else if ((token.type === "NUMBER" || token.type === "EXPR" || (token.type === "IDENT" && token.value in WIDTHS)) && !parts.width)
      parts.width = checkWidth([token], "outline");
    else if (token.type === "IDENT" && (STYLES.includes(token.value) || UNDRAWN.includes(token.value)) && !parts.style)
      parts.style = checkStyle(token, value);
    else throw errorAt(value, SHORTHAND_ERROR);
  }
  return parts;
}

const OUTLINE_PROPERTIES = ["outline", "outline-width", "outline-style", "outline-color", "outline-offset"];
const touches = (styles: Styles) => OUTLINE_PROPERTIES.some((property) => styles[property]);

// The width the shader draws (0: no line) and its color, from the shorthand and the
// longhands, which win over it like the other longhands of GSS. The color is the object's
// own by default, like currentColor in CSS.
function withBand(styles: Styles): Styles {
  if (!touches(styles)) return styles;
  const shorthand = styles["outline"] ? splitShorthand(styles["outline"]) : {};
  const styleValue = styles["outline-style"];
  if (styleValue && styleValue.length !== 1) throw errorAt(styleValue, "outline-style expects none, solid or auto, like: outline-style: solid;");
  const style = styleValue ? checkStyle(styleValue[0], styleValue) : shorthand.style ?? "none";
  const width = styles["outline-width"] ? checkWidth(styles["outline-width"], "outline-width") : shorthand.width ?? [{ type: "NUMBER", value: WIDTHS.medium }];
  const color = styles["outline-color"] ?? shorthand.color ?? ownColor(styles["color"]);
  return {
    ...styles,
    [BAND]: style === "none" ? [{ type: "NUMBER", value: 0 }] : width,
    ...(color ? { [COLOR]: color } : {}),
  };
}

// currentColor: the color of the object, the mean of a gradient
function ownColor(color: Token[] | undefined): Token[] | undefined {
  if (!color || (color.length === 1 && isColor(color[0]))) return color;
  return [{ type: "HASH", value: gradientMean(color) }];
}

export function withOutlineBand(instance: StyledInstance): StyledInstance {
  const styles = [instance.styles, instance.hoverStyles, instance.activeStyles];
  if (!styles.some(touches)) return instance;
  return { ...instance, styles: withBand(instance.styles), hoverStyles: withBand(instance.hoverStyles), activeStyles: withBand(instance.activeStyles) };
}

// A frame that changes the outline changes the width and the color the shader reads
export function withOutlineFrames(keyframes: Keyframes[]): Keyframes[] {
  if (!keyframes.some((k) => k.frames.some((f) => f.declarations.some((d) => OUTLINE_PROPERTIES.includes(d.property))))) return keyframes;
  return keyframes.map((animation) => ({
    ...animation,
    frames: animation.frames.map((frame) => {
      const own = (property: string) => frame.declarations.find((d) => d.property === property);
      const shorthand = own("outline") ? splitShorthand(own("outline")!.value) : {};
      const width = own("outline-width") ? checkWidth(own("outline-width")!.value, "outline-width") : shorthand.width;
      const color = own("outline-color")?.value ?? shorthand.color;
      const added: Declaration[] = [
        ...(width ? [{ ...own("outline-width") ?? own("outline")!, property: BAND, value: width }] : []),
        ...(color ? [{ ...own("outline-color") ?? own("outline")!, property: COLOR, value: color }] : []),
      ];
      return added.length ? { ...frame, declarations: [...frame.declarations, ...added] } : frame;
    }),
  }));
}

const readBand = (value: Token[] | undefined) =>
  !value ? "0.0" : value[0].type === "EXPR" ? `max(${value[0].code}, 0.0)` : value[0].type === "NUMBER" ? glslFloat(clampComputed(value[0], 0)) : "0.0";
const readOffset = (value: Token[] | undefined) => {
  if (!value) return "0.0";
  if (value.length === 1 && value[0].type === "NUMBER") return glslFloat(clampComputed(value[0], -Infinity));
  if (value.length === 1 && value[0].type === "EXPR" && value[0].syntax === "number") return value[0].code;
  throw errorAt(value, "outline-offset expects a number of units of the scene, like: outline-offset: 0.05;");
};

export type Outlined = { width: string; offset: string; color: string; reach: number | null };

// The outline of each object that draws one, in GLSL. reach: how far its line goes past its
// surface, when it is known at compile time (for the bounding spheres)
export function objectOutline(
  instance: StyledInstance,
  keyframes: Keyframes[],
  hover: Hover | undefined,
  hoisted: Hoisted,
): Outlined | null {
  if (![instance.styles, instance.hoverStyles, instance.activeStyles].some((styles) => styles[BAND])) return null;
  const width = hoverValue(instance.styles, keyframes, BAND, readBand, hover);
  if (width === "0.0") return null;
  const offset = hoverValue(instance.styles, keyframes, "outline-offset", readOffset, hover);
  const color = hoverValue(instance.styles, keyframes, COLOR, (value) => readSurfaceColor(value ?? [{ type: "HASH", value: "000000" }]), hover);
  const known = [width, offset].every((value) => /^-?\d+(\.\d+)?$/.test(value));
  return {
    width: hoist(hoisted, "float", width),
    offset: hoist(hoisted, "float", offset),
    color,
    reach: known ? Math.max(0, Number(width) + Number(offset)) : null,
  };
}

// outlineAt(), called by map(), and outlineColor(), outlineReach(), called by main()
export function outlineFunctions(outlines: { instance: StyledInstance; outline: Outlined }[]): string {
  const branch = (code: (o: Outlined) => string) =>
    outlines.map(({ instance, outline }) => `  if (id == ${glslFloat(instance.index)}) return ${code(outline)};  // ${label(instance)}`).join("\n");
  return `// outline: the outlined object the point is closest to, in widths of its line past its
// offset (0 to 1: in the line), written by map()
float outlineM;
float outlineId;
// The closest point within a line that the primary ray passed, written by march()
float lineT;
float lineId;

void outlineAt(float d, float offset, float width, float id) {
  if (width <= 0.0) return;
  float m = (d - offset) / width;
  if (m < outlineM) {
    outlineM = m;
    outlineId = id;
  }
}

vec3 outlineColor(float id) {
${branch((o) => o.color)}
  return vec3(0.0);
}

float outlineReach(float id) {
${branch((o) => `max(${o.offset} + ${o.width}, 0.0)`)}
  return 0.0;
}`;
}

// The march of the primary ray keeps the first closest point it passed within a line: one
// where the measure grows again, or where another object becomes the closest
export function withOutlineMarch(shader: string, head: string): string {
  const start = shader.indexOf(head);
  const end = shader.indexOf("\n}\n", start);
  const body = shader
    .slice(start + head.length, end)
    .replace(
      /\n(\s*)vec2 res = map\(([^;]*)\);/,
      (line, indent: string) =>
        `${line}
${indent}if (outlineId != lineLastId || outlineM > lineLastM) { // passed the closest point to the last one
${indent}  if (lineId == 0.0 && lineLastId > 0.0 && lineLastM >= 0.0 && lineLastM < 1.0) {
${indent}    lineT = lineLastT;
${indent}    lineId = lineLastId;
${indent}  }
${indent}}
${indent}lineLastM = outlineM;
${indent}lineLastId = outlineId;
${indent}lineLastT = t;`,
    );
  const reset = `
  lineT = 0.0;
  lineId = 0.0;
  float lineLastM = 1e10;
  float lineLastId = 0.0;
  float lineLastT = 0.0;`;
  return shader.slice(0, start) + head + reset + body + shader.slice(end);
}

// main(): the line over what the ray hit, in the fog at its own distance
export function outlineBlend(fogLine: string | undefined): string {
  return `  if (outlineHit > 0.0 && (outlineHit != id || t - outlineT > 2.0 * outlineReach(outlineHit))) {
    col = outlineColor(outlineHit);${fogLine ? fogLine.replace("fogAmount(t)", "fogAmount(outlineT)") : ""}
  }
`;
}
