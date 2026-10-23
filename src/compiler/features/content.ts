import type { Token } from "../syntax/tokenizer";
import type { Styles } from "../cascade/resolve";
import { errorAt } from "../syntax/errors";

// The color of the text: the name of the property
export const TEXT_COLOR = "text-color";

// content: "hello" → "hello"; several strings are joined, like CSS. null: no text
// (none, normal, an empty string, or no value)
export function readContent(value: Token[] | undefined): string | null {
  if (!value) return null;
  const [word] = value;
  if (value.length === 1 && word.type === "IDENT" && (word.value === "none" || word.value === "normal")) return null;
  if (value.length === 0 || value.some((token) => token.type !== "STRING"))
    throw errorAt(value, 'content expects a string, like: content: "hello";');
  return value.map((token) => String(token.value)).join("") || null;
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
