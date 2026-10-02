// @property: a variable the page sets from JS, without compiling again (decision 105).
//
//   @property --speed { syntax: "<number>"; inherits: false; initial-value: 4; }
//
// A registered variable is not replaced by its value like the others (decision 55): var()
// gives a token that reads the uniform uProperties[i], and the runtime fills it, from its
// initial value or from setProperty(). One value for the whole scene, like :root.
import type { PropertyRule } from "../syntax/ast";
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
