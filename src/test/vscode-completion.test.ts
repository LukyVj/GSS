import { describe, it, expect } from "vitest";
import { gssScriptAt, suggestAt } from "../../editors/vscode/src/suggest";

// The autocompletion of the VS Code extension: the cursor is the "|"
function suggest(text: string, language: "gss" | "html", explicit = false) {
  const offset = text.indexOf("|");
  return suggestAt(text.replace("|", ""), offset, language, explicit);
}

describe("the autocompletion of the VS Code extension", () => {
  it("offers the properties the rule can take in a .gss file, as the playground does", () => {
    const found = suggest("@scene { sphere; } sphere { ra| }", "gss");
    expect(found?.from).toBe("@scene { sphere; } sphere { ".length);
    const radius = found?.items.find((item) => item.label === "radius");
    expect(radius?.kind).toBe("property");
    expect(radius?.insertText).toBe("radius: ");
    expect(radius?.detail).toBeTruthy();
    expect(found?.items.some((item) => item.label === "background")).toBe(false); // a scene property
  });

  it("writes only the name when a colon already follows", () => {
    const found = suggest("cube { colo|: red; }", "gss");
    expect(found?.items.find((item) => item.label === "color")?.insertText).toBe("color");
  });

  it("offers nothing where nothing is typed, unless asked", () => {
    expect(suggest("cube { |}", "gss")).toBeNull();
    expect(suggest("cube { |}", "gss", true)?.items.length).toBeGreaterThan(0);
  });

  it("offers the mixins of the file after @apply", () => {
    const found = suggest("@mixin --card() { color: red; } cube { @apply --c| }", "gss");
    expect(found?.items.map((item) => item.label)).toEqual(["--card"]);
    expect(found?.items[0].kind).toBe("mixin");
  });

  it("offers the same inside a <script type=\"text/gss\"> of an HTML page, at the offsets of the page", () => {
    const page = '<p>cube { co }</p>\n<gss-scene>\n  <script type="text/gss">\n    sphere { ra| }\n  </script>\n</gss-scene>';
    const found = suggest(page, "html");
    expect(found?.from).toBe(page.indexOf("ra|"));
    expect(found?.items.some((item) => item.label === "radius")).toBe(true);
  });

  it("offers nothing elsewhere in the page, nor in another script", () => {
    expect(suggest("<p>cube { co| }</p>", "html", true)).toBeNull();
    expect(suggest('<script type="module">cube { co| }</script>', "html", true)).toBeNull();
    expect(suggest('<script type="text/gss">cube { color: red; }</script><p>cube { co| }</p>', "html", true)).toBeNull();
  });

  it("finds the GSS of a script, quoted or not, until its closing tag", () => {
    const page = "<SCRIPT type=text/gss defer>cube { }</SCRIPT>";
    expect(gssScriptAt(page, page.indexOf("{"))).toEqual({ start: page.indexOf("cube"), end: page.indexOf("</SCRIPT>") });
    expect(gssScriptAt('<script type="text/gss">cube {', 30)).toEqual({ start: 24, end: 30 }); // not closed yet
    expect(gssScriptAt('<script type="text/gss-like">cube { }</script>', 31)).toBeNull();
  });
});
