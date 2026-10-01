import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { parse } from "../syntax/parser";
import { expandScene } from "./expand";
import { parseSelector, resolveStyles, specificity } from "./resolve";
import { compileScene } from "../index";
import { formatGss } from "../../docs/format";
import { classifyGss } from "../../docs/highlight";

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

describe("combinators", () => {
  it.each([">", "+", "~"])(
    "reads %s with or without whitespace and comments",
    (op) => {
      const compact = selector(`group${op}cube`);
      expect(selector(`group ${op} cube`)).toEqual(compact);
      expect(selector(`group/* before */${op}/* after */cube`)).toEqual(
        compact,
      );
      expect(specificity(compact)).toBe(2);
      expect(specificity(selector(`#a${op}.b`))).toBe(10_100);
    },
  );

  it.each([
    "> cube",
    "+ cube",
    "~ cube",
    "cube >",
    "cube +",
    "cube ~",
    "cube >> sphere",
    "cube > + sphere",
    "group:has(>)",
    "group:has(,cube)",
    "group:has(cube,)",
  ])("rejects an incomplete selector: %s", (text) => {
    expect(() => selector(text)).toThrow(/selector/i);
  });

  it("selects only direct children", () => {
    expect(
      selected(
        "cube#out; group#g { cube#direct; group { cube#deep; } }",
        "#g > cube",
      ),
    ).toEqual(["direct"]);
  });

  it("uses sibling order, the same parent and only preceding siblings", () => {
    const scene =
      "cube#before; sphere; cube#a; torus; cube#b; group { cube#nested; }";
    expect(selected(scene, "sphere + cube")).toEqual(["a"]);
    expect(selected(scene, "sphere ~ cube")).toEqual(["a", "b"]);
  });

  it("includes empty groups and populated groups in sibling order", () => {
    const scene =
      "sphere; group#empty {} cube#a; group#full { sphere#inside; } cube#b;";
    expect(selected(scene, "sphere + cube")).toEqual([]);
    expect(selected(scene, "group + cube")).toEqual(["a", "b"]);
    expect(selected(scene, "#empty ~ cube")).toEqual(["a", "b"]);
    expect(selected(scene, "#full > sphere")).toEqual(["inside"]);
  });

  it("counts multiplied objects and keeps multiplied groups separate", () => {
    expect(selected("cube#c * 3;", "cube + cube")).toEqual(["c-2", "c-3"]);
    expect(
      selected("group#g * 2 { sphere; cube#c; }", "#g-1 > sphere + cube"),
    ).toEqual(["c"]);
    expect(selected("group#g * 2 { cube#c; }", "#g-1 + #g-2 > cube")).toEqual([
      "c",
    ]);
  });

  it("backtracks across mixed descendant, child and sibling chains", () => {
    expect(
      selected("group#a { group.x { group.x { cube#c; } } }", "#a > .x cube"),
    ).toEqual(["c"]);
    expect(
      selected(
        "sphere; torus.x; torus; torus.x; cube#c;",
        "sphere + .x ~ cube",
      ),
    ).toEqual(["c"]);
  });

  it("styles groups and keeps specificity, order, lists and !important", () => {
    const objects = styled(
      "group#empty {} group#g { cube#c; } sphere#s;",
      `
      group + group { scale: 2; }
      cube { color: blue; }
      #g > cube, group + sphere { color: red; }
      cube { color: green !important; }
    `,
    );
    expect(objects[0].groupStyles[0].scale[0].value).toBe(2);
    expect(objects.map((o) => o.styles.color[0].value)).toEqual([
      "green",
      "red",
    ]);
    expect(
      styled(
        "sphere; cube#c;",
        "sphere + cube { color: blue; } sphere ~ cube { color: red; }",
      )[1].styles.color[0].value,
    ).toBe("red");
  });

  it("allows faces only on the final compound", () => {
    const [, cube] = styled(
      "sphere; cube;",
      'sphere + cube::top { texture: url("top.png"); }',
    );
    expect(cube.faceStyles.top.texture).toBeDefined();
    expect(() => selector("cube::top + sphere")).toThrow(/at the end/);
  });

  it("survives formatting and is highlighted as punctuation", () => {
    const source =
      "@scene { sphere; cube; } sphere+cube { scale: calc(1 + 2); }";
    expect(compileScene(formatGss(source)).shader).toBe(
      compileScene(source).shader,
    );
    const source2 = "group>sphere~cube+torus";
    expect(
      classifyGss(source2)
        .filter((p) => [">", "+", "~"].includes(source2.slice(p.start, p.end)))
        .map((p) => p.kind),
    ).toEqual(["punct", "punct", "punct"]);
  });
});

describe("combinators in :has()", () => {
  const scene =
    "group#a { cube#direct; group { sphere; } } group#b { sphere; cube#other; }";
  it("anchors a leading child combinator to the subject", () => {
    expect(selected(scene, "group:has(> sphere) > cube")).toEqual(["other"]);
    expect(selected(scene, "#a:has(> group > sphere) > cube")).toEqual([
      "direct",
    ]);
    expect(selected(scene, "#a:has(#a > cube) cube")).toEqual([]);
  });

  it("finds empty groups inside :has()", () => {
    expect(
      selected("group#g { group {} cube#c; }", "#g:has(> group) > cube"),
    ).toEqual(["c"]);
  });

  it("supports sibling relatives on objects and groups", () => {
    expect(
      selected(
        "cube#a; sphere; cube#b; group { sphere; }",
        "cube:has(+ sphere)",
      ),
    ).toEqual(["a"]);
    expect(
      selected("cube#a; torus; sphere; cube#b;", "cube:has(~ sphere)"),
    ).toEqual(["a"]);
    expect(
      selected("cube#a; group { sphere; }", "cube:has(+ group > sphere)"),
    ).toEqual(["a"]);
    expect(selected(scene, "group:has(+ group > sphere) > cube")).toEqual([
      "direct",
    ]);
  });

  it("preserves the scoped descendant semantics and selector lists", () => {
    expect(selected(scene, "#a:has(sphere + cube) cube")).toEqual([]);
    expect(selected(scene, "#a:has(> sphere, > cube) > cube")).toEqual([
      "direct",
    ]);
    expect(specificity(selector("group:has(> #a, + sphere)"))).toBe(10_001);
    expect(() => selector("group:has(> group:has(cube))")).toThrow(
      /cannot hold another/,
    );
  });
});

describe("combinator hover paths", () => {
  it("uses the adjacent object and all matching preceding siblings", () => {
    const scene = "sphere; cube#a; sphere; cube#b;";
    const adjacent = styled(scene, "sphere:hover + cube { scale: 2; }");
    expect(adjacent.map((o) => o.hoverTriggers)).toEqual([[], [1], [], [3]]);
    const general = styled(scene, "sphere:hover ~ cube { scale: 2; }");
    expect(general.map((o) => o.hoverTriggers)).toEqual([[], [1], [], [1, 3]]);
    expect(adjacent[1].styles.scale).toBeUndefined();
    expect(adjacent[1].hoverStyles.scale[0].value).toBe(2);
  });

  it("uses the objects of a hovered sibling group", () => {
    expect(
      styled(
        "group { sphere; torus; } cube;",
        "group:hover + cube { scale: 2; }",
      )[2].hoverTriggers,
    ).toEqual([1, 2]);
    expect(
      styled("group {} cube;", "group:hover + cube { scale: 2; }")[0]
        .hoverTriggers,
    ).toEqual([]);
  });

  it("excludes an ancestor that matches alone but not the complete chain", () => {
    const scene = "group#a { group.x { sphere; group.x { cube; } } }";
    const result = styled(scene, "#a > .x:hover cube { scale: 2; }");
    expect(result[1].hoverTriggers).toEqual([1, 2]);
    const result2 = styled(scene, "#a > .x > .x:hover cube { scale: 2; }");
    expect(result2[1].hoverTriggers).toEqual([2]);
  });

  it("intersects hover requirements along the same matching path", () => {
    expect(
      styled("sphere; cube;", "sphere:hover + cube:hover { scale: 2; }")[1]
        .hoverTriggers,
    ).toEqual([]);
  });

  it("follows relative :has() hover paths and compiles them into hover slots", () => {
    expect(
      styled("cube; sphere;", "cube:has(+ sphere:hover) { scale: 2; }")[0]
        .hoverTriggers,
    ).toEqual([2]);
    const compiled = compileScene(
      "@scene { group#g { sphere; cube; group { sphere; } } } #g:has(> sphere:hover + cube) > cube { scale: 2; }",
    );
    expect(compiled.hover).toEqual([[1]]);
    expect(compiled.shader).toContain("uHover[0]");
  });

  it("works in media variants with the same selector cascade", () => {
    const compiled = compileScene(
      "@scene { sphere; cube; } @media (min-width: 600px) { sphere:hover + cube { scale: 2; } }",
    );
    expect(compiled.media?.variants[0].hover).toEqual([]);
    expect(compiled.media?.variants[1].hover).toEqual([[1]]);
  });
});
