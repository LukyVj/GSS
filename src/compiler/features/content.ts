import type { Token } from "../syntax/tokenizer";
import type { Styles } from "../cascade/resolve";
import { errorAt } from "../syntax/errors";

// The color of the text: the name of the property
export const TEXT_COLOR = "text-color";

// content: "hello" → "hello"; several strings are joined, like CSS. null: no text
// (none, normal, an empty string, or no value). A number joins them too (decision 203):
// content: "item: " var(--i) → "item: 3"
export function readContent(value: Token[] | undefined): string | null {
  if (!value) return null;
  const [word] = value;
  if (value.length === 1 && word.type === "IDENT" && (word.value === "none" || word.value === "normal")) return null;
  const number = contentNumber(value);
  if (number) return number.before + number.number + number.after;
  return value.map((token) => String(token.value)).join("") || null;
}

// The characters a number of content is written with, in the order of the image of the
// digits: the shader reads character i in the cell i of that image
export const DIGITS = "0123456789-.";

// The longest number content shows: two times six characters of four bits each, which a
// 32-bit float holds exactly
const LONGEST = 12;

// A number as CSS writes it: at most six decimals, no zeros at the end, 0 for -0
export function writeNumber(n: number): string {
  const rounded = Math.round(n * 1e6) / 1e6;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

// content with a number: the strings before and after it, and the number as it is shown.
// null: only strings. Checks the value: strings and at most one number, on one line
export type ContentNumber = { before: string; number: string; after: string };
export function contentNumber(value: Token[]): ContentNumber | null {
  if (value.length === 0 || value.some((token) => token.type !== "STRING" && token.type !== "NUMBER")) {
    const dimension = value.find((token) => token.type === "DIMENSION");
    if (dimension) throw errorAt(value, `content shows a number without a unit, like: content: "item: " 3; (not ${dimension.value}${dimension.unit})`);
    throw errorAt(value, 'content expects a string, like: content: "hello";');
  }
  const numbers = value.filter((token) => token.type === "NUMBER");
  if (numbers.length === 0) return null;
  if (numbers.length > 1) throw errorAt(value, 'content shows one number at most, like: content: "item " var(--i);');
  const at = value.indexOf(numbers[0]);
  const join = (tokens: Token[]) => tokens.map((token) => String(token.value)).join("");
  const text = { before: join(value.slice(0, at)), number: writeNumber(Number(numbers[0].value)), after: join(value.slice(at + 1)) };
  if ((text.before + text.after).includes("\n"))
    throw errorAt(value, "content with a number holds on one line: no line break in its strings");
  if (text.number.length > LONGEST || text.number.includes("e"))
    throw errorAt(value, `content shows a number of ${LONGEST} characters at most, like 1234.5 (not ${text.number})`);
  return text;
}

const WEIGHTS: Record<string, number> = { normal: 400, bold: 700 };

// font-weight: bold → 700
function readWeight(value: Token[] | undefined): number {
  if (!value) return WEIGHTS.normal;
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT" && token.value in WEIGHTS) return WEIGHTS[token.value];
  if (value.length === 1 && token.type === "NUMBER" && Number(token.value) >= 1 && Number(token.value) <= 1000) return Number(token.value);
  throw errorAt(value, "font-weight expects normal, bold or a number from 1 to 1000, like: font-weight: bold;");
}

const FONT_STYLES = ["normal", "italic", "oblique"];

function readStyle(value: Token[] | undefined): string {
  if (!value) return "normal";
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT" && FONT_STYLES.includes(token.value)) return token.value;
  throw errorAt(value, "font-style expects normal, italic or oblique, like: font-style: italic;");
}

// font-family: "Helvetica Neue", Arial, sans-serif → the same list, as CSS reads it:
// each font is a string or a name of one or more words
function readFamily(value: Token[] | undefined): string {
  if (!value) return "sans-serif";
  const error = () => errorAt(value, 'font-family expects one or more fonts, like: font-family: "Helvetica Neue", sans-serif;');
  const fonts: string[] = [];
  let words: Token[] = [];
  const close = () => {
    const quoted = words.length === 1 && words[0].type === "STRING";
    if (words.length === 0 || (!quoted && words.some((word) => word.type !== "IDENT"))) throw error();
    fonts.push(quoted ? JSON.stringify(words[0].value) : words.map((word) => word.value).join(" "));
    words = [];
  };
  for (const token of value) {
    if (token.type === "PUNCT" && token.value === ",") close();
    else words.push(token);
  }
  close();
  return fonts.join(", ");
}

// The font of the text of an object, as the font shorthand of CSS without its size:
// "italic 700 Georgia, serif". Checked on every object, even without content.
export function readFont(styles: Styles): string {
  return `${readStyle(styles["font-style"])} ${readWeight(styles["font-weight"])} ${readFamily(styles["font-family"])}`;
}

// font-size: 0.3 → 0.3, the height of the letters in the units of the scene. null: the text
// is as large as the face lets it be
export function readFontSize(value: Token[] | undefined): number | null {
  if (!value) return null;
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT" && token.value === "auto") return null;
  if (value.length === 1 && token.type === "NUMBER" && token.value > 0) return token.value;
  throw errorAt(value, "font-size expects auto or a positive number, like: font-size: 0.3;");
}

export type Align = "left" | "center" | "right";
const ALIGNS: Record<string, Align> = { left: "left", center: "center", right: "right", start: "left", end: "right" };

// text-align: center → "center"; start and end are left and right, the text being read from left to right
export function readAlign(value: Token[] | undefined): Align {
  if (!value) return "left"; // start, like CSS
  const [token] = value;
  if (value.length === 1 && token.type === "IDENT" && token.value in ALIGNS) return ALIGNS[token.value];
  throw errorAt(value, "text-align expects left, center, right, start or end, like: text-align: center;");
}

// The name of a text among the images of the scene: the runtime draws it in a canvas
// and gives it to the shader like an image. width: the length of a line, in letters of
// font-size (null: no line is broken but where the text says); align: where each line goes
export function textSource(text: string, font: string, width: number | null = null, align: Align = "left"): string {
  return `content(${JSON.stringify(width === null && align === "left" ? [text, font] : [text, font, width, align])})`;
}

// The strings around the number of a content (decision 203): drawn on one line, without
// room around them, to be put end to end with the digits
export function pieceSource(text: string, font: string): string {
  return `content(${JSON.stringify([text, font, null, "left", "piece"])})`;
}

// The digits of a font, 0123456789-. in twelve cells of one width: one image for every
// number of the scene written in that font
export function digitsSource(font: string): string {
  return `content(${JSON.stringify([DIGITS, font, null, "left", "digits"])})`;
}

// The height of the letters in the images of the texts, in pixels: SIZE in the runtime's
// text.ts. The digits are always drawn at this size, so a line of font-size is this many
// of their pixels per letter
export const LETTER_PIXELS = 160;
