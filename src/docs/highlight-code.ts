import { escapeHtml } from "./escape";
import { highlightGss } from "./highlight";

// Colors the code of the docs that is not GSS (decision 63): the syntax lines of the
// reference, and the HTML and JavaScript of "Embedding a scene" and the showcase.
// Same palette as GSS code (gss-code.css) and same meanings as the GLSL tab (glsl.ts):
// keywords in the at-rule color, functions in the property color, .fields in the
// selector color. Like highlightGss, the text never changes: only <span>s are added.

type Rule = [pattern: RegExp, kind: string | null]; // null: written as it is

const span = (kind: string | null, text: string) =>
  kind
    ? `<span class="gss-${kind}">${escapeHtml(text)}</span>`
    : escapeHtml(text);

// Reads the code from left to right: at each position, the first rule that matches wins.
// Every pattern is sticky (y): it must match right here, not further on.
function highlightWith(rules: Rule[], code: string): string {
  let html = "";
  let at = 0;
  while (at < code.length) {
    let matched = false;
    for (const [pattern, kind] of rules) {
      pattern.lastIndex = at;
      const found = pattern.exec(code);
      if (!found || found[0] === "") continue;
      html += span(kind, found[0]);
      at += found[0].length;
      matched = true;
      break;
    }
    if (!matched) html += escapeHtml(code[at++]); // anything else, one character
  }
  return html;
}

// The CSS value definition syntax of the registry: <number>{1,3} (cube) | none
const SYNTAX: Rule[] = [
  [/\s+/y, null],
  [/(?<=^|\s)\([^()]*\)/y, "comment"], // (cube), (plane: width depth): a note, not a call
  [/@[\w-]+/y, "at-rule"],
  [/<[^<>]+>/y, "id"], // a type: <number>, <svg path>
  [/\{\d+(?:,\d*)?\}/y, "number"], // {3}, {1,3}
  [/--/y, "variable"], // var(--<name>)
  [/"[^"]*"|'[^']*'/y, "string"],
  [/[a-z][\w-]*(?=\()/y, "function"],
  [/[a-z][\w-]*/y, "keyword"], // none, auto, linear…
  [/\d+(?:\.\d+)?%?/y, "number"],
  [/[|[\]*,{}()…;:#+?]/y, "punct"],
];

export function highlightSyntax(syntax: string): string {
  return highlightWith(SYNTAX, syntax);
}

// JavaScript, enough for the snippets of the docs
const JS: Rule[] = [
  [/\s+/y, null],
  [/\/\/[^\n]*|\/\*[\s\S]*?\*\//y, "comment"],
  [/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`]*`/y, "string"],
  [
    /\b(?:import|from|export|default|const|let|var|return|new|await|async|function|if|else)\b/y,
    "at-rule",
  ],
  [/\b(?:true|false|null|undefined)\b/y, "keyword"],
  [/\d+(?:\.\d+)?/y, "number"],
  [/(?<=\.)[A-Za-z_$][\w$]*/y, "selector"], // scene.destroy
  [/[A-Za-z_$][\w$]*(?=\s*\()/y, "property"], // mount(…)
  [/[A-Za-z_$][\w$]*/y, null],
  [/[{}()[\];,.=:<>+\-*/!?&|]/y, "punct"],
];

export function highlightJs(code: string): string {
  return highlightWith(JS, code);
}

// HTML, enough for the snippets of the docs. A <script type="text/gss"> holds GSS:
// it is colored by highlightGss.
export function highlightHtml(code: string): string {
  let html = "";
  let at = 0;
  const take = (pattern: RegExp): string | null => {
    pattern.lastIndex = at;
    const found = pattern.exec(code);
    if (!found) return null;
    at += found[0].length;
    return found[0];
  };

  while (at < code.length) {
    const comment = take(/<!--[\s\S]*?-->/y);
    if (comment) {
      html += span("comment", comment);
      continue;
    }
    const open = take(/<\/?(?=[a-zA-Z])/y);
    if (!open) {
      // text up to the next tag, as written
      const text = take(/[^<]+|</y)!;
      html += escapeHtml(text);
      continue;
    }
    const name = take(/[a-zA-Z][\w-]*/y)!;
    html += span("punct", open) + span("selector", name);
    let attributes = "";
    for (;;) {
      const space = take(/\s+/y);
      if (space) html += space;
      const close = take(/\/?>/y);
      if (close) {
        html += span("punct", close);
        break;
      }
      const attribute = take(/[^\s=>/]+/y);
      if (attribute) html += span("property", attribute);
      const equals = take(/=/y);
      if (equals) html += span("punct", equals);
      const value = take(/"[^"]*"|'[^']*'|[^\s>]+/y);
      if (value) {
        html += span("string", value);
        attributes += value;
      }
      if (!space && !attribute && !equals && !value) break; // the code ends inside a tag
    }
    // The GSS of a <script type="text/gss">, up to </script>
    if (open === "<" && name === "script" && attributes.includes("text/gss")) {
      const end = code.indexOf("</script", at);
      const inside = code.slice(at, end === -1 ? code.length : end);
      html += highlightGss(inside);
      at += inside.length;
    }
  }
  return html;
}

export function highlightCode(
  lang: "gss" | "html" | "js",
  code: string,
): string {
  if (lang === "gss") return highlightGss(code);
  return lang === "html" ? highlightHtml(code) : highlightJs(code);
}
