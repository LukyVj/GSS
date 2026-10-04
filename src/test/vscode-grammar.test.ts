import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { AT_RULES } from "../compiler/registry/registry";

// The TextMate grammar of the VS Code extension. Its regexes are Oniguruma's, but the ones
// that start the at-rules are plain enough for JavaScript: like VS Code, try the patterns
// in order and keep the first that matches where the at-rule starts.
type Pattern = { include?: string; begin?: string; match?: string; patterns?: Pattern[] };
const grammar: { patterns: Pattern[]; repository: Record<string, Pattern> } = JSON.parse(
  readFileSync(new URL("../../editors/vscode/syntaxes/gss.tmLanguage.json", import.meta.url), "utf8"),
);

// The patterns of the top level, each include replaced by what it names
function topLevel(patterns: Pattern[]): Pattern[] {
  return patterns.flatMap((pattern) => {
    if (!pattern.include) return [pattern];
    const named = grammar.repository[pattern.include.slice(1)];
    return named.begin || named.match ? [named] : topLevel(named.patterns ?? []);
  });
}

// The at-rule keyword the first matching pattern sees at the start of the text
function keywordAt(text: string): string | undefined {
  for (const pattern of topLevel(grammar.patterns)) {
    const source = pattern.begin ?? pattern.match;
    if (!source) continue;
    const found = new RegExp(source, "y").exec(text);
    if (found) return found[1] === "@" ? found[2] : undefined;
  }
  return undefined;
}

describe("the VS Code grammar", () => {
  it("colors every at-rule of the reference as itself", () => {
    for (const { name } of AT_RULES) expect(keywordAt(`@${name} { }`), `@${name}`).toBe(name);
  });

  it("does not read @property-panel as @property", () => {
    expect(keywordAt("@property-panel { display: open; }")).toBe("property-panel");
    expect(keywordAt('@property --lift { syntax: "<number>"; }')).toBe("property");
  });

  it("names the variable @property registers", () => {
    const pattern = grammar.repository["at-property"];
    expect(new RegExp(pattern.begin!).exec("@property --lift {")?.[3]).toBe("--lift");
  });
});
