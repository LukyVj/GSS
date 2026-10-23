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

// The styles of CSS outline-style, numbered for main(): auto is the browser's own line, solid in GSS
const STYLES = ["none", "solid", "auto", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"];
const STYLE_NUMBERS: Record<string, number> = { solid: 0, auto: 0, dashed: 1, dotted: 2, double: 3, groove: 4, ridge: 5, inset: 6, outset: 7 };
const STYLE_ERROR =
  "outline-style expects none, auto, solid, dashed, dotted, double, groove, ridge, inset or outset, like: outline-style: dashed;";
// CSS measures thin, medium and thick in pixels; GSS in units of the scene
const WIDTHS: Record<string, number> = { thin: 0.01, medium: 0.02, thick: 0.04 };
const SHORTHAND_ERROR =
  "outline expects a width, a style (solid, dashed, dotted…) and a color, in any order, like: outline: 0.05 solid #ff5a36;";
// The widths and colors the shader reads: the band is the width, or 0 when the style is none
const BAND = "outline-band";
const COLOR = "outline-paint";
const KIND = "outline-kind"; // the style drawn, a number of STYLE_NUMBERS; absent: none

const isColor = (token: Token) => token.type === "HASH" || (token.type === "EXPR" && token.syntax === "color");

function checkStyle(token: Token, value: Token[]): string {
  if (token.type === "IDENT" && STYLES.includes(token.value)) return token.value;
  throw errorAt(value, STYLE_ERROR);
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
    else if (token.type === "IDENT" && STYLES.includes(token.value) && !parts.style)
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
  if (styleValue && styleValue.length !== 1) throw errorAt(styleValue, STYLE_ERROR);
  const style = styleValue ? checkStyle(styleValue[0], styleValue) : shorthand.style ?? "none";
  const width = styles["outline-width"] ? checkWidth(styles["outline-width"], "outline-width") : shorthand.width ?? [{ type: "NUMBER", value: WIDTHS.medium }];
  const color = styles["outline-color"] ?? shorthand.color ?? ownColor(styles["color"]);
  return {
    ...styles,
    [BAND]: style === "none" ? [{ type: "NUMBER", value: 0 }] : width,
    ...(color ? { [COLOR]: color } : {}),
    ...(style === "none" ? {} : { [KIND]: [{ type: "NUMBER", value: STYLE_NUMBERS[style] }] }),
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

// style: a number of STYLE_NUMBERS (0: a plain line). center and size: where the object is,
// and how far around it, for the dashes and dots, filled by the code generator
export type Outlined = { width: string; offset: string; color: string; reach: number | null; style: number; center?: string; size?: number };

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
  // The style at rest, or the one of :hover, then :active, when there is none at rest
  const kind = [instance.styles, instance.hoverStyles, instance.activeStyles].find((styles) => styles[KIND])?.[KIND]?.[0];
  return {
    style: kind?.type === "NUMBER" ? kind.value : 0,
    width: hoist(hoisted, "float", width),
    offset: hoist(hoisted, "float", offset),
    color,
    reach: known ? Math.max(0, Number(width) + Number(offset)) : null,
  };
}

// Far from its segments, a path, a prism or a lathe returns the distance to their box: shorter
// than the distance to the shape, it put the box in the line. An outlined one measures its shape
// closer than twice the reach of its line (outlineFar, in the units of its shape: twice, so that
// a rounded distance to the box never falls in the line)
// (the start of the condition of that shortcut: anything after it stays)
const SHORTCUT = "if (far > 0.5";
export const BOXED = new Set(["path", "prism", "lathe"]);

export function withOutlineShapes(functions: string): string {
  return `// outline: twice the reach of the line of the object map() measures, in the units of its
// shape; closer than that, a path, a prism or a lathe measures its shape, not its box
float outlineFar = 0.0;

${functions.replaceAll(SHORTCUT, "if (far > max(0.5, outlineFar)")}`;
}

// outlineFar for an object: its reach, divided by its scales and those of its groups
export function outlineFarCode(outline: Outlined, scales: string[]): string {
  const product = scales.every((scale) => Number.isFinite(Number(scale))) ? scales.reduce((all, scale) => all * Number(scale), 1) : null;
  if (outline.reach !== null && product !== null && product > 0) return glslFloat(Number(((2 * outline.reach) / product).toPrecision(6)));
  return `2.0 * max(${outline.offset} + ${outline.width}, 0.0) / max(${product !== null ? glslFloat(product) : scales.join(" * ")}, 0.000001)`;
}

// outlineAt(), called by map(), and outlineColor(), outlineReach(), called by main()
export function outlineFunctions(outlines: { instance: StyledInstance; outline: Outlined }[]): string {
  const styled = outlines.some(({ outline }) => outline.style > 0);
  const branch = (code: (o: Outlined) => string) =>
    outlines.map(({ instance, outline }) => `  if (id == ${glslFloat(instance.index)}) return ${code(outline)};  // ${label(instance)}`).join("\n");
  return `// outline: the outlined object the point is closest to, in widths of its line past its
// offset (0 to 1: in the line), written by map()
float outlineM;
float outlineId;
// The closest point within a line that the primary ray passed, written by march()
float lineT;
float lineId;${styled ? "\nfloat lineM; // and how far across the line" : ""}

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
}${styled ? `

// outline-style: 0 solid, 1 dashed, 2 dotted, 3 double, 4 groove, 5 ridge, 6 inset, 7 outset
float outlineStyle(float id) {
${branch((o) => glslFloat(o.style))}
  return 0.0;
}

// Where each object is, and how many dashes or dots go around it: a dash and its gap are 6
// widths long, a dot and its gap 2
vec4 outlineCenter(float id) {
${branch((o) => `vec4(${o.center ?? "vec3(0.0)"}, max(floor(6.2831853 * ${glslFloat(o.size ?? 1)} / (${o.style === 2 ? "2.0" : "6.0"} * ${o.width}) + 0.5), 1.0))`)}
  return vec4(0.0);
}` : ""}`;
}

// The march of the primary ray keeps the first closest point it passed within a line: one
// where the measure grows again, or where another object becomes the closest
export function withOutlineMarch(shader: string, head: string, styled: boolean): string {
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
${indent}    lineId = lineLastId;${styled ? `\n${indent}    lineM = lineLastM;` : ""}
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
export function outlineBlend(fogLine: string | undefined, styled: boolean): string {
  const fog = fogLine ? fogLine.replace("fogAmount(t)", "fogAmount(outlineT)") : "";
  const hit = "outlineHit > 0.0 && (outlineHit != id || t - outlineT > 2.0 * outlineReach(outlineHit))";
  if (!styled)
    return `  if (${hit}) {
    col = outlineColor(outlineHit);${fog}
  }
`;
  // across: 0 at the side of the object, 1 outside; along: in dashes or dots around the object,
  // by the angle seen from the camera; lit: the side toward the top left, like the borders of CSS
  return `  if (${hit}) {
    float style = outlineStyle(outlineHit);
    vec3 lineColor = outlineColor(outlineHit);
    vec4 center = outlineCenter(outlineHit);
    vec3 v = ro + rd * outlineT - center.xyz;
    vec2 around = vec2(dot(v, right), dot(v, up));
    float along = (atan(around.y, around.x) / 6.2831853 + 0.5) * center.w;
    float across = clamp(outlineAcross, 0.0, 1.0);
    bool drawn = true;
    if (style == 1.0) drawn = fract(along) < 0.5;
    else if (style == 2.0) {
      vec2 dot2 = vec2((fract(along) - 0.5) * 4.0, (across - 0.5) * 2.0);
      drawn = dot(dot2, dot2) < 1.0;
    } else if (style == 3.0) drawn = across < 1.0 / 3.0 || across > 2.0 / 3.0;
    else if (style >= 4.0) {
      bool topLeft = dot(around, vec2(-1.0, 1.0)) > 0.0;
      bool outer = across > 0.5;
      // inset: the top left darker; outset: the bottom right; groove: inset outside, outset
      // inside; ridge: the other way
      bool flip = style == 7.0 || (style == 4.0 && !outer) || (style == 5.0 && outer);
      if (topLeft != flip) lineColor *= 0.5;
    }
    if (drawn) {
      col = lineColor;${fog}
    }
  }
`;
}
