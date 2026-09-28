import { scan } from "../compiler/tokenizer";

// Rewrites GSS with one style (decision 33). It only moves whitespace and keeps comments.
export function formatGss(code: string): string {
  const parts = scan(code);
  let out = "";
  let depth = 0;
  let needBreak = false; // true after { ; } : the next token starts a new line

  parts.forEach(({ token, start, end }, index) => {
    const previous = parts[index - 1];
    const gap = previous ? code.slice(previous.end, start) : ""; // what the source had between the two tokens
    const newlines = gap.split("\n").length - 1;
    const text = code.slice(start, end); // the token exactly as written
    const is = (p: string) => token.type === "PUNCT" && token.value === p;
    const previousIs = (p: string) =>
      previous?.token.type === "PUNCT" && previous.token.value === p;

    // A "}" goes back one level, and always starts its own line
    if (is("}")) {
      depth = Math.max(0, depth - 1);
      needBreak = true;
    }
    // Code written on the line after a comment stays on the next line
    if (previous?.token.type === "COMMENT" && newlines > 0) needBreak = true;

    if (!previous) {
      // the very first token: nothing before it
    } else if (token.type === "COMMENT" && newlines === 0) {
      out += " "; // a comment at the end of a line stays on that line
    } else if (needBreak) {
      // A blank line when the source had one, or between two top-level blocks
      const blank =
        !is("}") && (newlines >= 2 || (depth === 0 && previousIs("}")));
      out += blank ? "\n\n" : "\n";
      out += "  ".repeat(depth);
      needBreak = false;
    } else if (is("{") || gap !== "") {
      out += " "; // one space where the source had some, always before {
    }

    out += text;

    if (is("{")) {
      depth = depth + 1;
      needBreak = true;
    }
    if (is(";") || is("}")) needBreak = true;
  });

  return out.trim() + "\n";
}
