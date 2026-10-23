// @property: a variable the page sets from JS, without compiling again (decision 105).
//
//   @property --speed { syntax: "<number>"; inherits: false; initial-value: 4; }
//
// A registered variable is not replaced by its value like the others (decision 55): var()
// gives a token that reads the uniform uProperties[i], and the runtime fills it, from its
// initial value or from setProperty(). One value for the whole scene, like :root.
import type { PanelRule, PropertyRule } from "../syntax/ast";
import type { PropertySyntax, Token } from "../syntax/tokenizer";
import { errorAt } from "../syntax/errors";
import { hexToRgb } from "../shader/codegen/read";

export type RegisteredProperty = {
  name: string; // --speed
  syntax: PropertySyntax;
  initial: number[]; // the 4 floats of its uniform: a number, an angle in radians, a percentage as written, a color 0–1, a length in px
};

const SYNTAXES: Record<string, PropertySyntax> = {
  "<number>": "number",
  "<angle>": "angle",
  "<percentage>": "percentage",
  "<color>": "color",
  "<length>": "length", // in px: the radius of blur() and bloom()
};

// What a value of each syntax looks like, for the errors
const EXAMPLES: Record<PropertySyntax, string> = {
  number: "a number, like: 4",
  angle: "an angle, like: 90deg",
  percentage: "a percentage, like: 50%",
  color: "a color, like: #ff5a36",
  length: "a length in px, like: 4px",
};

// An angle unit, in radians
const RADIANS: Record<string, number> = { deg: Math.PI / 180, rad: 1, grad: Math.PI / 200, turn: 2 * Math.PI };

// The @property rules of the file: their name and syntax. The last one of a name wins, like CSS.
export function readPropertyRules(rules: PropertyRule[]): { name: string; syntax: PropertySyntax; initial: Token[] }[] {
  const found = new Map<string, { name: string; syntax: PropertySyntax; initial: Token[] }>();
  for (const rule of rules) {
    const name = rule.name;
    if (name.type !== "IDENT" || !name.value.startsWith("--"))
      throw errorAt(name, "@property names a variable, like: @property --speed { … }");
    const descriptor = (key: string) => rule.descriptors.findLast((d) => d.property === key);
    const syntax = descriptor("syntax");
    if (!syntax) throw errorAt(name, `@property ${name.value} needs a syntax, like: syntax: "<number>";`);
    const text = syntax.value.length === 1 && syntax.value[0].type === "STRING" ? syntax.value[0].value.trim() : null;
    if (text === null || !(text in SYNTAXES))
      throw errorAt(
        syntax.value,
        `GSS reads the syntaxes "<number>", "<angle>", "<percentage>", "<color>" and "<length>", written in quotes, like: syntax: "<number>";`,
      );
    const inherits = descriptor("inherits");
    const flag = inherits?.value[0];
    if (!inherits || inherits.value.length !== 1 || flag?.type !== "IDENT" || !["true", "false"].includes(flag.value))
      throw errorAt(inherits?.value ?? name, `@property ${name.value} needs inherits: true or false, like CSS`);
    const initial = descriptor("initial-value");
    if (!initial) throw errorAt(name, `@property ${name.value} needs an initial-value, like: initial-value: 4;`);
    for (const d of rule.descriptors)
      if (!["syntax", "inherits", "initial-value"].includes(d.property))
        throw errorAt(d, `@property takes syntax, inherits and initial-value, not ${d.property}`);
    found.set(name.value, { name: name.value, syntax: SYNTAXES[text], initial: initial.value });
  }
  return [...found.values()];
}

// @property-panel { display: open | folded | none; } (decision 128): a control per registered
// variable over the render of the playground and of Try it, open or folded at the start.
// display is open when it is not written; the last rule wins, like the cascade.
export type PropertyPanel = "open" | "folded";
const DISPLAYS = ["open", "folded", "none"];
const DESCRIPTORS = ["display", "range"];

export function readPropertyPanel(rules: PanelRule[]): PropertyPanel | undefined {
  let display = "none";
  for (const rule of rules) {
    display = "open";
    for (const d of rule.descriptors) {
      if (!DESCRIPTORS.includes(d.property)) throw errorAt(d, `@property-panel takes display and range, not ${d.property}`);
      if (d.property !== "display") continue;
      const [token] = d.value;
      const text = d.value.map((t) => String(t.value)).join(" ");
      if (d.value.length !== 1 || token.type !== "IDENT" || !DISPLAYS.includes(String(token.value)))
        throw errorAt(d.value, `display of @property-panel is open, folded or none, not ${text}`);
      display = String(token.value);
    }
  }
  return display === "none" ? undefined : (display as PropertyPanel);
}

// range of @property-panel (decision 187): the ends of the slider of a variable, and its step,
// written like its values (an angle in deg, a percentage in %, a length in px).
//   @property-panel { range: --col 0 3 1, --row 0 3 1; }
// A number typed past an end is held there, where a slider without a range widens.
export type PropertyRange = { min: number; max: number; step?: number };

const RANGE_EXAMPLE = "like: range: --col 0 3, --row 0 3 1;";

export function readPropertyRanges(
  rules: PanelRule[],
  registered: { name: string; syntax: PropertySyntax }[],
): Record<string, PropertyRange> | undefined {
  const ranges: Record<string, PropertyRange> = {};
  for (const rule of rules) {
    for (const d of rule.descriptors) {
      if (d.property !== "range") continue;
      // One range per comma, like the layers of transition
      const items: Token[][] = [[]];
      for (const token of d.value) {
        if (token.type === "PUNCT" && token.value === ",") items.push([]);
        else items[items.length - 1].push(token);
      }
      for (const item of items) {
        const [name, ...ends] = item;
        if (name?.type !== "IDENT" || !name.value.startsWith("--") || ends.length < 2 || ends.length > 3)
          throw errorAt(item.length > 0 ? item : d, `range of @property-panel is a variable, its min and its max, and a step if you like, ${RANGE_EXAMPLE}`);
        const property = registered.find((p) => p.name === name.value);
        if (!property) throw errorAt(name, `range of @property-panel: ${name.value} is not registered by @property`);
        if (property.syntax === "color")
          throw errorAt(name, `range of @property-panel: ${name.value} is a color, it has a color picker and no range`);
        // In the unit of the slider: an angle in deg, not in the radians of the uniform
        const [min, max, step] = ends.map((end) => {
          const [x] = propertyFloats(property.syntax, [end], `an end of the range of ${name.value}`);
          return property.syntax === "angle" ? +((x * 180) / Math.PI).toFixed(3) : x;
        });
        if (min >= max)
          throw errorAt(ends, `range of @property-panel: the min of ${name.value} must be below its max, like: ${name.value} 0 3`);
        if (step !== undefined && step <= 0)
          throw errorAt(ends[2], `range of @property-panel: the step of ${name.value} must be above 0, like: ${name.value} 0 3 1`);
        ranges[name.value] = step === undefined ? { min, max } : { min, max, step }; // the last one wins
      }
    }
  }
  return Object.keys(ranges).length > 0 ? ranges : undefined;
}

// A value of a registered variable, its colors and math already computed: the 4 floats of
// its uniform. what: where it is written, for the error.
export function propertyFloats(syntax: PropertySyntax, value: Token[], what: string): number[] {
  const [token] = value;
  const wrong = () => errorAt(value, `${what} is ${EXAMPLES[syntax]}`);
  if (value.length !== 1) throw wrong();
  if (syntax === "number" && token.type === "NUMBER") return [token.value, 0, 0, 0];
  if (syntax === "percentage" && token.type === "PERCENTAGE") return [token.value, 0, 0, 0];
  if (syntax === "angle" && token.type === "DIMENSION" && token.unit in RADIANS)
    return [+(token.value * RADIANS[token.unit]).toFixed(6), 0, 0, 0];
  if (syntax === "angle" && token.type === "NUMBER" && token.value === 0) return [0, 0, 0, 0];
  if (syntax === "color" && token.type === "HASH") return [...hexToRgb(token.value), 0];
  if (syntax === "length" && token.type === "DIMENSION" && token.unit === "px") return [token.value, 0, 0, 0];
  if (syntax === "length" && token.type === "NUMBER" && token.value === 0) return [0, 0, 0, 0];
  throw wrong();
}

// The token var() gives for the variable at this index of uProperties
export function propertyToken(property: RegisteredProperty, index: number): Token {
  const field = property.syntax === "color" ? "rgb" : "x";
  return { type: "EXPR", value: property.name, code: `uProperties[${index}].${field}`, syntax: property.syntax };
}
