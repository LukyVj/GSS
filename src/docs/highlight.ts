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

  parts.forEach((part, index) => {
    const { token, start, end } = part;
    const next = parts[index + 1]?.token;
    const nextIs = (p: string) => next?.type === "PUNCT" && next.value === p;

    if (token.type === "PUNCT") {
      if (token.value === "{") depth++;
      if (token.value === "}") depth = Math.max(0, depth - 1);
      if (token.value === "{" || token.value === "}" || token.value === ";") inValue = false;
      if (token.value === ":" && isProperty(parts[index - 1], depth)) inValue = true;
      pieces.push({ start, end, kind: "punct" });
      return;
    }

    if (token.type === "DIMENSION") {
      const split = end - token.unit.length; // 70deg → "70" and "deg"
      pieces.push({ start, end: split, kind: "number" }, { start: split, end, kind: "unit" });
      return;
    }

    pieces.push({ start, end, kind: kindOf(part, depth, inValue, nextIs) });
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
