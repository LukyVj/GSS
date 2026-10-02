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

describe(":nth-child()", () => {
  // The settled example: the copies of a * n are siblings, like sibling-index()
  const row = "cube#c * 4; sphere#s;";

  it("counts the copies of * n as siblings", () => {
    expect(selected(row, "cube:nth-child(odd)")).toEqual(["c-1", "c-3"]);
    expect(selected(row, ":nth-child(5)")).toEqual(["s"]);
    expect(selected(row, ":nth-child(even)")).toEqual(["c-2", "c-4"]);
  });

  it.each([
    ["odd", ["c-1", "c-3", "s"]],
    ["even", ["c-2", "c-4"]],
    ["3", ["c-3"]],
    ["n", ["c-1", "c-2", "c-3", "c-4", "s"]],
    ["2n+1", ["c-1", "c-3", "s"]],
    ["2n + 1", ["c-1", "c-3", "s"]],
    ["2n-1", ["c-1", "c-3", "s"]],
    ["2n - 1", ["c-1", "c-3", "s"]],
    ["-n+3", ["c-1", "c-2", "c-3"]],
    ["-n + 2", ["c-1", "c-2"]],
    ["+n", ["c-1", "c-2", "c-3", "c-4", "s"]],
    ["3n", ["c-3"]],
    ["-2n+5", ["c-1", "c-3", "s"]],
    ["0n+2", ["c-2"]],
    ["n+4", ["c-4", "s"]],
    ["ODD", ["c-1", "c-3", "s"]],
  ])("reads An+B like CSS: %s", (formula, ids) => {
    expect(selected(row, `:nth-child(${formula})`)).toEqual(ids);
  });

  it.each(["", "x", "2.5n", "n+", "2n+1.5", "odd 2", "1 2"])(
    "rejects a formula that is not An+B: '%s'",
    (formula) => {
      expect(() => selector(`cube:nth-child(${formula})`)).toThrow(
        /An\+B|odd|even/,
      );
    },
  );

  it("counts within each group, and a group counts as a sibling", () => {
    const scene = "cube#a; group#g { cube#b; cube#c; } cube#d;";
    expect(selected(scene, "cube:nth-child(2)")).toEqual(["c"]);
    expect(selected(scene, ":nth-child(3)")).toEqual(["d"]);
    expect(selected(scene, ":nth-child(2) cube")).toEqual(["b", "c"]);
  });

  it("counts from the end with :nth-last-child()", () => {
    expect(selected(row, ":nth-last-child(1)")).toEqual(["s"]);
    expect(selected(row, ":nth-last-child(-n+2)")).toEqual(["c-4", "s"]);
  });

  it("counts only the siblings that match S with of S", () => {
    const scene = "cube#a.red; cube#b; cube#c.red; sphere#d.red; cube#e.red;";
    expect(selected(scene, ":nth-child(2 of .red)")).toEqual(["c"]);
    expect(selected(scene, ":nth-child(odd of .red)")).toEqual(["a", "d"]);
    expect(selected(scene, ":nth-last-child(1 of cube.red)")).toEqual(["e"]);
    expect(selected(scene, ":nth-child(1 of sphere, .red)")).toEqual(["a"]);
    // the element itself must match S
    expect(selected(scene, "#b:nth-child(1 of .red)")).toEqual([]);
  });

  it("agrees with sibling-index()", () => {
    const sheet = compileScene(
      "@scene { cube * 6; } cube { --i: sibling-index(); } cube:nth-child(3n) { --i: 0; }",
    );
    expect(sheet).toBeDefined();
    expect(
      styled("cube * 6", "cube:nth-child(3n) { color: red; }").map(
        (o) => o.styles.color !== undefined && o.siblingIndex % 3 === 0,
      ),
    ).toEqual([false, false, true, false, false, true]);
  });

  it("weighs like a class, plus the most specific selector of S", () => {
    expect(specificity(selector("cube:nth-child(odd)"))).toBe(101);
    expect(specificity(selector(":nth-last-child(2)"))).toBe(100);
    expect(specificity(selector(":nth-child(odd of #a, .b)"))).toBe(10_100);
  });

  it("refuses :hover in S for now", () => {
    expect(() => selector(":nth-child(odd of cube:hover)")).toThrow(
      /:hover/,
    );
  });
});

describe(":nth-of-type()", () => {
  const scene = "cube#a * 2; sphere#s; cube#b; group#g { sphere#t; }";

  it("counts the siblings of the same shape", () => {
    expect(selected(scene, "cube:nth-of-type(3)")).toEqual(["b"]);
    expect(selected(scene, ":nth-of-type(1)")).toEqual(["a-1", "s", "t"]);
    expect(selected(scene, "sphere:nth-of-type(2)")).toEqual([]);
    expect(selected(scene, "cube:nth-last-of-type(1)")).toEqual(["b"]);
    expect(selected(scene, "cube:nth-of-type(even)")).toEqual(["a-2"]);
  });

  it("refuses of S, like CSS", () => {
    expect(() => selector("cube:nth-of-type(1 of .a)")).toThrow(/of/);
  });
});

describe(":first-child and the shortcuts", () => {
  const scene = "cube#a; sphere#b; cube#c; group#g { torus#only; }";

  it.each([
    [":first-child", ["a", "only"]],
    [":last-child", ["only"]],
    [":only-child", ["only"]],
    ["cube:first-of-type", ["a"]],
    ["cube:last-of-type", ["c"]],
    [":only-of-type", ["b", "only"]],
    ["#g:last-child torus", ["only"]],
  ])("%s", (query, ids) => {
    expect(selected(scene, query)).toEqual(ids);
  });

  it("weighs like a class", () => {
    expect(specificity(selector("cube:first-child"))).toBe(101);
    expect(specificity(selector(":only-child"))).toBe(100);
    expect(specificity(selector(":only-of-type"))).toBe(100);
  });

  it("takes no argument", () => {
    expect(() => selector("cube:first-child(1)")).toThrow(/first-child/);
  });
});

describe("structural pseudo-classes with the rest", () => {
  it("combines with :hover, combinators and :has()", () => {
    const hovered = styled(
      "cube#a * 3;",
      "cube:nth-child(2):hover { color: red; }",
    ).map((o) => o.hoverTriggers);
    expect(hovered).toEqual([[], [2], []]);
    expect(
      selected("cube#a; sphere#b; cube#c;", ":first-child ~ cube"),
    ).toEqual(["c"]);
    expect(
      selected(
        "group#g { cube; sphere; } group#h { sphere; cube; } cube#x;",
        "group:has(> sphere:last-child) ~ cube",
      ),
    ).toEqual(["x"]);
  });

  it("lists the structural pseudo-classes in the unknown pseudo-class error", () => {
    expect(() => selector("cube:focus")).toThrow(/:nth-child\(\)/);
  });

  it("survives the formatter", () => {
    const source =
      "@scene { cube * 4; } cube:nth-child(2n + 1) { color: #ff5a36; } cube:nth-last-child(-n+2 of .a) { scale: 1.2; } cube:first-child { translate: 0 1 0; }";
    expect(compileScene(formatGss(source)).shader).toBe(
      compileScene(source).shader,
    );
  });
});
