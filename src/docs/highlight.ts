import { scan, type Located } from "../compiler/syntax/tokenizer";
import { escapeHtml } from "./escape";

// One colored piece of code: [start, end) in the text, and what it is
export type Piece = { start: number; end: number; kind: string };

// What each piece of GSS code is: selector, property, number, color…
// Used by highlightGss (the docs) and by the editor (CodeMirror decorations).
// It never throws: code being typed is often unfinished.
export function classifyGss(code: string): Piece[] {
  const parts = scan(code, { recover: true });
  const pieces: Piece[] = [];
  let depth = 0;
  let inValue = false; // between the ":" and the ";" of a declaration
  // The parentheses after @mixin --name or @apply --name: parameters and values, colored as
  // values (decision 174). 0 outside them.
  let mixinHead = false;
  let args = 0;

  parts.forEach((part, index) => {
    const { token, start, end } = part;
    const next = parts[index + 1]?.token;
    const nextIs = (p: string) => next?.type === "PUNCT" && next.value === p;

    if (token.type === "PUNCT") {
      if (token.value === "(" && args > 0) args++;
      else if (token.value === "(" && mixinHead && parts[index - 1]?.token.type === "IDENT") args = 1;
      if (token.value === ")" && args > 0) args--;
      if (token.value === "{" || token.value === "}" || token.value === ";") mixinHead = false;
      if (token.value === "{") depth++;
      if (token.value === "}") depth = Math.max(0, depth - 1);
      if (token.value === "{" || token.value === "}" || token.value === ";") inValue = false;
      if (token.value === ":" && isProperty(parts[index - 1], depth)) inValue = true;
      pieces.push({ start, end, kind: "punct" });
      return;
    }
    if (token.type === "AT_KEYWORD") mixinHead = token.value === "mixin" || token.value === "apply";

    // The block of a @paint: GLSL, colored as GLSL (decision 151)
    if (token.type === "GLSL") {
      const closed = end - start - 1 > token.value.length;
      pieces.push({ start, end: start + 1, kind: "punct" });
      pieces.push(...glslPieces(token.value, start + 1));
      if (closed) pieces.push({ start: end - 1, end, kind: "punct" });
      return;
    }

    if (token.type === "DIMENSION") {
      const split = end - token.unit.length; // 70deg → "70" and "deg"
      pieces.push({ start, end: split, kind: "number" }, { start: split, end, kind: "unit" });
      return;
    }

    pieces.push({ start, end, kind: kindOf(part, depth, inValue || args > 0, nextIs) });
  });

  return pieces;
}

// Turns GSS code into HTML where each token is a <span class="gss-…">.
// The text itself never changes: remove the tags and you get the code back, exactly.
export function highlightGss(code: string): string {
  let html = "";
  let last = 0; // where the previous piece ended
  for (const { start, end, kind } of classifyGss(code)) {
    html += escapeHtml(code.slice(last, start)); // the spaces, as written
    html += span(kind, code.slice(start, end));
    last = end;
  }
  return html + escapeHtml(code.slice(last));
}

// A property is a name written just before ":" inside a block
function isProperty(part: Located | undefined, depth: number): boolean {
  return part?.token.type === "IDENT" && depth > 0;
}

function kindOf(
  { token }: Located,
  depth: number,
  inValue: boolean,
  nextIs: (p: string) => boolean,
): string {
  switch (token.type) {
    case "COMMENT":
      return "comment";
    case "INVALID":
      return "invalid";
    case "STRING":
      return "string";
    case "AT_KEYWORD":
      return "at-rule";
    case "NUMBER":
    case "PERCENTAGE":
      return "number";
    case "HASH":
      return inValue ? "color" : "id"; // #ff5a36 in a value, #hero in a selector
    case "IDENT":
      if (token.value.startsWith("--")) return "variable"; // --size: 2; and var(--size)
      if (inValue) return nextIs("(") ? "function" : "keyword"; // glass(…) / gold, ease-in-out
      if (depth > 0 && nextIs(":")) return "property";
      return "selector"; // cube, scene, from, to, and the name after a "."
    default:
      return "punct";
  }
}

function span(kind: string, text: string): string {
  return `<span class="gss-${kind}">${escapeHtml(text)}</span>`;
}

// GLSL, with the meanings of the GLSL tab (glsl.ts): keywords and types in the at-rule color,
// functions in the function color, gl_ names as variables. Sticky patterns, first match wins.
const GLSL: [RegExp, string | null][] = [
  [/\/\/[^\n]*/y, "comment"],
  [/\/\*[\s\S]*?(?:\*\/|$)/y, "comment"],
  [/#\s*\w+/y, "at-rule"],
  [/(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?[fu]?\b/y, "number"],
  [/(?:void|bool|int|uint|float|[biu]?vec[234]|mat[234](?:x[234])?|sampler[23]D|samplerCube|struct|uniform|in|out|inout|const|attribute|varying|precision|highp|mediump|lowp|if|else|for|while|do|return|break|continue|discard|true|false)\b/y, "at-rule"],
  [/gl_\w+/y, "variable"],
  [/[A-Za-z_]\w*(?=\s*\()/y, "function"],
  [/[A-Za-z_]\w*/y, null],
  [/\s+/y, null],
];

function glslPieces(code: string, offset: number): Piece[] {
  const pieces: Piece[] = [];
  let at = 0;
  while (at < code.length) {
    let length = 1;
    for (const [pattern, kind] of GLSL) {
      pattern.lastIndex = at;
      const found = pattern.exec(code);
      if (!found || found[0] === "") continue;
      length = found[0].length;
      if (kind) pieces.push({ start: offset + at, end: offset + at + length, kind });
      break;
    }
    at += length;
  }
  return pieces;
}
