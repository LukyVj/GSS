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

describe(":not()", () => {
  const scene = "cube#a.red; cube#b; sphere#c.red; group#g { cube#d; torus#e; }";

  it("matches what its selectors do not", () => {
    expect(selected(scene, "cube:not(.red)")).toEqual(["b", "d"]);
    expect(selected(scene, ":not(cube)")).toEqual(["c", "e"]);
    expect(selected(scene, ":not(.red):not(torus)")).toEqual(["b", "d"]);
  });

  it("takes a list: none of them may match", () => {
    expect(selected(scene, ":not(.red, torus)")).toEqual(["b", "d"]);
  });

  it("takes complex selectors, read from the object", () => {
    expect(selected(scene, "cube:not(#g cube)")).toEqual(["a", "b"]);
    expect(selected(scene, ":not(#g > *)")).toEqual(["a", "b", "c"]);
    expect(selected(scene, "#g :not(cube)")).toEqual(["e"]);
  });

  it("works with the structural pseudo-classes and :has()", () => {
    expect(selected("cube#c * 4;", "cube:not(:first-child, :last-child)")).toEqual([
      "c-2",
      "c-3",
    ]);
    expect(
      selected(
        "group#g { sphere; cube#x; } group#h { cube#y; }",
        "group:not(:has(sphere)) cube",
      ),
    ).toEqual(["y"]);
    expect(selected("cube#a; cube#b; sphere;", "cube:not(:has(+ sphere))")).toEqual([
      "a",
    ]);
  });

  it("weighs like its most specific selector, like CSS", () => {
    expect(specificity(selector(":not(.a)"))).toBe(100);
    expect(specificity(selector("cube:not(#a, .b)"))).toBe(10_001);
    expect(specificity(selector(":not(cube)"))).toBe(1);
    expect(specificity(selector(":not(*)"))).toBe(0);
    expect(specificity(selector(":not(.a):not(.b)"))).toBe(200);
  });

  it("beats a less specific rule like CSS", () => {
    const [a, b] = styled(
      "cube#a.red; cube#b;",
      "cube:not(.red) { color: #00ff00; } .x, cube { color: #0000ff; }",
    );
    expect(a.styles.color).toEqual(tokenize("#0000ff"));
    expect(b.styles.color).toEqual(tokenize("#00ff00"));
  });

  it("refuses :hover inside for now", () => {
    expect(() => selector("cube:not(:hover)")).toThrow(/:not\(\).*:hover/);
    expect(() => selector("cube:not(#g:hover cube)")).toThrow(/:hover/);
    expect(() => selector("cube:not(:has(sphere:hover))")).toThrow(/:hover/);
  });

  it("refuses an empty :not(), a face, a leading combinator", () => {
    expect(() => selector("cube:not()")).toThrow(/:not\(\) needs a selector/);
    expect(() => selector("cube:not(cube::top)")).toThrow(/face/);
    expect(() => selector("cube:not(> sphere)")).toThrow(/combinator/);
  });

  it("cannot carry a :has() into another :has()", () => {
    expect(() => selector("group:has(group:not(:has(cube)))")).toThrow(
      /cannot hold another :has\(\)/,
    );
  });

  it("composes with :hover outside it", () => {
    const triggers = styled("cube#a.red; cube#b;", "cube:not(.red):hover { color: red; }").map(
      (o) => o.hoverTriggers,
    );
    expect(triggers).toEqual([[], [2]]);
  });

  it("survives the formatter", () => {
    const source =
      "@scene { cube.a * 3; sphere; } :not(.a, sphere) { color: #ff5a36; } cube:not(:first-child) { scale: 0.8; }";
    expect(compileScene(formatGss(source)).shader).toBe(compileScene(source).shader);
  });
});
