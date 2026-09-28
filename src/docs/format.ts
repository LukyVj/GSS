import { scan } from "../compiler/tokenizer";

// Rewrites GSS with one style (decision 33). It only moves whitespace and keeps comments.
export function formatGss(code: string): string {
  const parts = scan(code);
  let out = "";
  let depth = 0;
  let needBreak = false; // true after { ; } : the next token starts a new line

  // To tell "radius: 1" (a declaration) from "cube:nth-child" (a selector in @scene)
  const blocks: ("scene" | "rules")[] = []; // the kind of each open block
  let startsWithScene = false; // does the current rule head start with @scene?
  let headLength = 0; // how many tokens the current head has, comments aside
  let afterColon = false; // the previous token was the ":" of a declaration

  parts.forEach(({ token, start, end }, index) => {
    const previous = parts[index - 1];
    const gap = previous ? code.slice(previous.end, start) : ""; // what the source had between the two tokens
    const newlines = gap.split("\n").length - 1;
    const text = code.slice(start, end); // the token exactly as written
    const is = (p: string) => token.type === "PUNCT" && token.value === p;
    const previousIs = (p: string) =>
      previous?.token.type === "PUNCT" && previous.token.value === p;

    // A ":" right after a name, in a block that holds declarations
    const isDeclarationColon =
      is(":") &&
      previous?.token.type === "IDENT" &&
      blocks.length > 0 &&
      blocks[blocks.length - 1] !== "scene";

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
    } else if (isDeclarationColon) {
      // "radius : 1" → "radius: 1": nothing before the colon
    } else if (is("{") || afterColon || gap !== "") {
      out += " "; // one space where the source had some, always before { and after a declaration's ":"
    }

    out += text;

    if (token.type !== "COMMENT") {
      afterColon = isDeclarationColon;
      if (headLength === 0)
        startsWithScene =
          token.type === "AT_KEYWORD" && token.value === "scene";
      headLength++;
    }

    if (is("{")) {
      depth++;
      needBreak = true;
      blocks.push(startsWithScene ? "scene" : "rules");
    }
    if (is("}")) blocks.pop();
    if (is(";") || is("}") || is("{")) headLength = 0;
    if (is(";") || is("}")) needBreak = true;
    if (is(",") && depth === 0) needBreak = true;
  });

  return out.trim() + "\n";
}
