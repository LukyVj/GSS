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

  it("names the mixin of @mixin and of @apply", () => {
    expect(new RegExp(grammar.repository["at-mixin"].begin!).exec("@mixin --card(--size: 1) {")?.[3]).toBe("--card");
    expect(new RegExp(grammar.repository["at-apply"].begin!).exec("@apply --card(2);")?.[3]).toBe("--card");
  });

  it("reads @apply and @contents in a block before a nested rule, which would take them for a selector", () => {
    const block = grammar.repository["rule-block"].patterns!.map((pattern) => pattern.include);
    expect(block.indexOf("#at-apply")).toBeGreaterThan(-1);
    expect(block.indexOf("#at-apply")).toBeLessThan(block.indexOf("#nested-rule"));
    expect(block.indexOf("#at-contents")).toBeLessThan(block.indexOf("#nested-rule"));
  });

  it("reads @for and @each in @scene, in a rule and in @keyframes, and names the loop variable", () => {
    const loop = new RegExp(grammar.repository["at-loop"].begin!);
    expect(loop.exec("@for --i from 1 through 4 {")?.[3]).toBe("--i");
    expect(loop.exec("@each --shape in cube, sphere {")?.[3]).toBe("--shape");
    const includes = (patterns: Pattern[] | undefined) => (patterns ?? []).map((pattern) => pattern.include);
    expect(includes(grammar.repository["scene-contents"].patterns)).toContain("#at-loop");
    const block = includes(grammar.repository["rule-block"].patterns);
    expect(block.indexOf("#at-loop")).toBeGreaterThan(-1);
    expect(block.indexOf("#at-loop")).toBeLessThan(block.indexOf("#nested-rule"));
  });

  it("colors the GSS of a <script type=\"text/gss\"> in an HTML page, and only that script", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../editors/vscode/package.json", import.meta.url), "utf8"));
    const entry = manifest.contributes.grammars.find((g: { injectTo?: string[] }) => g.injectTo);
    expect(entry.injectTo).toContain("text.html.basic");
    expect(entry.embeddedLanguages["meta.embedded.block.gss"]).toBe("gss");
    const injection = JSON.parse(readFileSync(new URL(`../../editors/vscode/${entry.path}`, import.meta.url), "utf8"));
    expect(injection.scopeName).toBe(entry.scopeName);
    const script = injection.repository["gss-script"];
    // JavaScript has no (?i:…) group: the test writes the tag name in lowercase
    const opens = (tag: string) => new RegExp(script.begin.replace("(?i:script)", "script"), "y").test(tag);
    expect(opens('<script type="text/gss">')).toBe(true);
    expect(opens("<script type='text/gss'>")).toBe(true);
    expect(opens('<script id="s" type="text/gss" defer>')).toBe(true);
    expect(opens('<script type="module">')).toBe(false);
    expect(opens('<script type="text/gss-like">')).toBe(false);
    expect(opens("<script>")).toBe(false);
    expect(script.patterns[1].patterns[0].include).toBe("source.gss");
  });
});
