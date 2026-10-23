import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { parse } from "../syntax/parser";
import { expandScene } from "./expand";
import { parseSelector, resolveStyles, specificity } from "./resolve";
import { compileScene } from "../index";
import { formatGss } from "../../docs/format";

const selector = (text: string) => parseSelector(tokenize(text));
function styled(scene: string, rules: string) {
  const sheet = parse(tokenize(`@scene { ${scene} } ${rules}`));
  return resolveStyles(expandScene(sheet.scene), sheet.rules);
}
function selected(scene: string, query: string) {
  return styled(scene, `${query} { color: red; }`)
    .filter((o) => o.styles.color)
    .map((o) => o.id);
}

describe("attributes in @scene", () => {
  it("reads [name], [name=value] and [name=\"value\"]", () => {
    const [element] = parse(tokenize('@scene { cube#a.big[lit][data-col=2][data-name="top left"] * 2; }')).scene;
    expect(element.attributes).toEqual({ lit: "", "data-col": "2", "data-name": "top left" });
    expect(element.count).toBe(2);
  });

  it("gives them to every copy of a * n", () => {
    const scene = expandScene(parse(tokenize("@scene { cube#c[data-row=1] * 3; }")).scene);
    expect(scene.map((o) => o.attributes)).toEqual([{ "data-row": "1" }, { "data-row": "1" }, { "data-row": "1" }]);
  });

  it("refuses id and class, which have their own syntax", () => {
    expect(() => parse(tokenize('@scene { cube[id="a"]; }'))).toThrow(/#a/);
    expect(() => parse(tokenize('@scene { cube[class="a"]; }'))).toThrow(/\.a/);
  });

  it("refuses an attribute written twice, or an operator", () => {
    expect(() => parse(tokenize("@scene { cube[a=1][a=2]; }"))).toThrow(/already/);
    expect(() => parse(tokenize("@scene { cube[a^=1]; }"))).toThrow(/=/);
    expect(() => parse(tokenize("@scene { cube[a=1; }"))).toThrow(/]/);
  });
});

describe("attribute selectors", () => {
  const scene =
    'cube#a[data-col=1][lang=en-US]; cube#b[data-col=2][lang=fr]; sphere#c.red.big[data-tags="round shiny"]; torus#hero * 3;';

  it("[attr]: the attribute is there", () => {
    expect(selected(scene, "[data-col]")).toEqual(["a", "b"]);
    expect(selected(scene, "[id]")).toEqual(["a", "b", "c", "hero-1", "hero-2", "hero-3"]);
    expect(selected(scene, "[class]")).toEqual(["c"]);
  });

  it("[attr=value]: exactly", () => {
    expect(selected(scene, '[data-col="2"]')).toEqual(["b"]);
    expect(selected(scene, "cube[data-col=1]")).toEqual(["a"]);
    expect(selected(scene, "[id=hero-2]")).toEqual(["hero-2"]);
  });

  it("~= a word of a list, |= the value or its prefix with a dash", () => {
    expect(selected(scene, "[data-tags~=shiny]")).toEqual(["c"]);
    expect(selected(scene, "[data-tags~=shin]")).toEqual([]);
    expect(selected(scene, "[class~=big]")).toEqual(["c"]);
    expect(selected(scene, "[lang|=en]")).toEqual(["a"]);
    expect(selected(scene, "[lang|=fr]")).toEqual(["b"]);
  });

  it("^= starts, $= ends, *= contains", () => {
    expect(selected(scene, '[id^="hero-"]')).toEqual(["hero-1", "hero-2", "hero-3"]);
    expect(selected(scene, '[id$="-3"]')).toEqual(["hero-3"]);
    expect(selected(scene, "[data-tags*=nd]")).toEqual(["c"]);
  });

  it("an empty value never matches ~= ^= $= *=, like CSS", () => {
    expect(selected(scene, '[id^=""]')).toEqual([]);
    expect(selected(scene, '[id*=""]')).toEqual([]);
  });

  it("i ignores the case, s keeps it", () => {
    expect(selected(scene, '[lang="EN-us"]')).toEqual([]);
    expect(selected(scene, '[lang="EN-us" i]')).toEqual(["a"]);
    expect(selected(scene, '[lang="EN-us" s]')).toEqual([]);
  });

  it("works on groups, with combinators and inside :not()", () => {
    const groups = "group#g[data-side=left] { cube#d; } group#h { cube#e[data-col=1]; }";
    expect(selected(groups, "[data-side=left] cube")).toEqual(["d"]);
    expect(selected(groups, "#h > [data-col]")).toEqual(["e"]);
    expect(selected(groups, "cube:not([data-col])")).toEqual(["d"]);
  });

  it("allows spaces inside the brackets", () => {
    expect(selected(scene, '[ data-col = "2" ]')).toEqual(["b"]);
    expect(selected(scene, "cube [data-col]")).toEqual([]); // a space outside is a descendant
  });

  it("weighs like a class", () => {
    expect(specificity(selector("[data-col]"))).toBe(100);
    expect(specificity(selector("cube[a][b=1]"))).toBe(201);
    expect(specificity(selector("[id=a]"))).toBe(100); // not like #a
  });

  it("reports what it cannot read", () => {
    expect(() => selector("[]")).toThrow(/name/);
    expect(() => selector("[a=]")).toThrow(/value/);
    expect(() => selector("[a=1")).toThrow(/]/);
    expect(() => selector("[a b]")).toThrow();
    expect(() => selector('[a="x" q]')).toThrow(/i or s/);
  });

  it("compiles a scene", () => {
    const code = '@scene { cube[data-col=1]; cube[data-col=2]; } cube { size: 0.5; } [data-col="2"] { translate: 1 0 0; color: tomato; }';
    expect(() => compileScene(code)).not.toThrow();
  });

  it("is kept on one line by the formatter", () => {
    expect(formatGss('@scene { cube#a[data-col=1][lit] * 2; }\n[id^="a" i] { size: 1; }')).toBe(
      '@scene {\n  cube#a[data-col=1][lit] * 2;\n}\n\n[id^="a" i] {\n  size: 1;\n}\n',
    );
  });
});
