import { scan, type Located } from "../compiler/tokenizer";
import { escapeHtml } from "./escape";

// Turns GSS code into HTML where each token is a <span class="gss-…">.
// The text itself never changes: remove the tags and you get the code back, exactly.
// This is what lets the editor lay the colors under a transparent textarea.
export function highlightGss(code: string): string {
  const parts = scan(code);
  let html = "";
  let depth = 0;
  let inValue = false; // between the ":" and the ";" of a declaration
  let last = 0; // where the previous token ended

  parts.forEach((part, index) => {
    const { token, start, end } = part;
    html += escapeHtml(code.slice(last, start)); // the spaces, as written
    last = end;
    const text = code.slice(start, end);
    const next = parts[index + 1]?.token;
    const nextIs = (p: string) => next?.type === "PUNCT" && next.value === p;

    if (token.type === "PUNCT") {
      if (token.value === "{") depth++;
      if (token.value === "}") depth = Math.max(0, depth - 1);
      if (token.value === "{" || token.value === "}" || token.value === ";") inValue = false;
      if (token.value === ":" && isProperty(parts[index - 1], depth)) inValue = true;
      html += span("punct", text);
      return;
    }

    if (token.type === "DIMENSION") {
      const number = text.slice(0, text.length - token.unit.length);
      html += span("number", number) + span("unit", token.unit);
      return;
    }

    html += span(kindOf(part, depth, inValue, nextIs), text);
  });

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
    case "AT_KEYWORD":
      return "at-rule";
    case "NUMBER":
    case "PERCENTAGE":
      return "number";
    case "HASH":
      return inValue ? "color" : "id"; // #ff5a36 in a value, #hero in a selector
    case "IDENT":
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
