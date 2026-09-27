// Turns a one-line GSS example into indented code, easier to edit.
// It only moves whitespace: the meaning never changes (a test checks it on every example).
export function formatGss(code: string): string {
  let out = "";
  let depth = 0;
  const newline = () => "\n" + "  ".repeat(depth);

  for (const char of code) {
    if (char === "{") {
      depth++;
      out = out.trimEnd() + " {" + newline();
    } else if (char === "}") {
      depth = Math.max(0, depth - 1);
      out = out.trimEnd() + newline() + "}" + newline();
      if (depth === 0) out += "\n"; // a blank line between top-level blocks
    } else if (char === ";") {
      out = out.trimEnd() + ";" + newline();
    } else if (/\s/.test(char)) {
      if (!/\s$/.test(out)) out += " "; // several spaces become one
    } else {
      out += char;
    }
  }

  const lines = out.split("\n").map((line) => line.trimEnd());
  return lines.join("\n").trim() + "\n";
}
