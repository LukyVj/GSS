import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { parse } from "../syntax/parser";
import { expandScene } from "./expand";
import { parseSelector, resolveStyles, specificity } from "./resolve";
import { compileScene } from "../index";
import { formatGss } from "../../docs/format";
import { toShadertoy } from "../shader/shadertoy";

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

// :not() holding :hover: its triggers are every object but the ones that would hover the
// selector inside, and 0, nothing under the mouse (decision 214)
describe(":not() with :hover inside", () => {
  const states = (scene: string, rules: string) =>
    Object.fromEntries(styled(scene, rules).map((o) => [o.id, o.hoverStates.map((state) => state.triggers)]));

  it("is on while the object is not hovered, nothing hovered included", () => {
    expect(states("cube#a; sphere#b;", "cube:not(:hover) { color: red; }")).toEqual({ a: [[0, 2]], b: [] });
  });

  it("reads :has() inside, from the group down", () => {
    expect(
      states("group#wrap { sphere#p1.point; sphere#p2.point; } cube#c;", "#wrap:not(:has(.point:hover)) .point { scale: 0.5; }"),
    ).toEqual({ p1: [[0, 3]], p2: [[0, 3]], c: [] });
  });

  it("composes with :hover outside it: hovered, but not a given object", () => {
    expect(
      states("group#g { cube#a; sphere#b; }", "#g:hover cube:not(:hover) { color: red; }"),
    ).toEqual({ a: [[2]], b: [] });
  });

  it("puts no condition when the selector inside cannot match the object", () => {
    expect(states("cube#a; sphere#b;", "cube:not(.red:hover) { color: red; }")).toEqual({ a: [[0, 1, 2]], b: [] });
  });
});


// :not() holding :active: a state of its own, on while nothing, or something else, is pressed
describe(":not() with :active inside", () => {
  const states = (scene: string, rules: string) =>
    Object.fromEntries(styled(scene, rules).map((o) => [o.id, o.hoverStates.map((state) => [state.press ?? false, state.triggers])]));

  it("is a state that follows the press, on while the object is not pressed", () => {
    expect(states("cube#a; sphere#b;", "cube:not(:active) { color: red; }")).toEqual({ a: [[true, [0, 2]]], b: [] });
  });

  it("reads :has() inside, from the group down", () => {
    expect(states("group#g { cube#a; sphere#b; } cone#c;", "#g:not(:has(:active)) cube { scale: 0.9; }")).toEqual({
      a: [[true, [0, 3]]],
      b: [],
      c: [],
    });
  });

  it("stays out of the pressed state", () => {
    const [a] = styled("cube#a;", "cube { color: blue; } cube:not(:active) { color: red; } cube:active { scale: 0.9; }");
    expect(a.activeStyles.color).toEqual(tokenize("blue"));
    expect(a.activeTriggers).toEqual([1]);
  });

  it("cannot wait for :hover at the same time yet", () => {
    expect(() => compileScene("@scene { cube; } cube:hover:not(:active) { color: red; }")).toThrow(
      "A rule cannot wait for :hover and for :not(:active) at once yet: write cube:hover, and cube:active after it",
    );
  });

  it("gives its state a slot among the pressed ones, on in the Shadertoy export", () => {
    const compiled = compileScene("@scene { cube; sphere; } cube:not(:active) { color: #ff0000; } sphere:hover { color: #0000ff; }");
    expect(compiled.hover).toEqual([[2]]);
    expect(compiled.active).toEqual([[0, 2]]);
    expect(compiled.shader).toContain("mix(vec3(0.9), vec3(1.0, 0.0, 0.0), uHover[1])");
    expect(toShadertoy(compiled)).toContain("const float uHover[2] = float[2](0.0, 1.0);");
  });
});
