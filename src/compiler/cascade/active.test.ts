import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { parse } from "../syntax/parser";
import { expandScene } from "./expand";
import { parseSelector, resolveStyles, specificity } from "./resolve";
import { compileScene } from "../index";
import { formatGss } from "../../docs/format";

const selector = (text: string) => parseSelector(tokenize(text));
function styled(source: string) {
  const sheet = parse(tokenize(source));
  return resolveStyles(expandScene(sheet.scene), sheet.rules);
}
const value = (text: string) => tokenize(text);

describe(":active in a selector", () => {
  it("is read on a compound and weighs like a class, like CSS", () => {
    expect(selector("cube:active")).toMatchObject({ tag: "cube", active: true });
    expect(selector("#g:active cube").ancestors).toMatchObject([{ id: "g", active: true }]);
    expect(specificity(selector("cube:active"))).toBe(101);
    expect(specificity(selector("cube:hover:active"))).toBe(201);
  });

  it("is refused where :hover is refused", () => {
    expect(() => selector("cube:not(:active)")).toThrow(/cannot hold :hover or :active/);
    expect(() => selector(":nth-child(1 of :active)")).toThrow(/cannot hold :hover or :active/);
  });
});

describe(":active in the cascade", () => {
  it("has its own triggers and styles, apart from :hover", () => {
    const [a, b] = styled(
      "@scene { cube#a; cube#b; } cube { scale: 1; } #a:active { scale: 0.9; } #b:hover { scale: 1.1; }",
    );
    expect(a.activeTriggers).toEqual([1]);
    expect(a.hoverTriggers).toEqual([]);
    expect(a.activeStyles.scale).toEqual(value("0.9"));
    expect(b.activeTriggers).toEqual([]);
    expect(b.hoverTriggers).toEqual([2]);
  });

  it("keeps the :hover rules in the pressed state: a pressed object is under the pointer", () => {
    const [a] = styled(
      "@scene { cube#a; } cube:hover { color: red; scale: 1.1; } cube:active { scale: 0.9; }",
    );
    expect(a.hoverStyles.scale).toEqual(value("1.1"));
    expect(a.activeStyles.scale).toEqual(value("0.9"));
    expect(a.activeStyles.color).toEqual(value("red"));
    expect(a.styles.scale).toBeUndefined();
  });

  it("works on a group, through combinators and inside :has()", () => {
    const objects = styled(
      "@scene { group#g { cube#a; cube#b; } sphere#s; cube#c; } #g:active cube { scale: 0.9; } sphere:active + cube { scale: 1.2; } #g:has(#b:active) #a { color: red; }",
    );
    const by = (id: string) => objects.find((o) => o.id === id)!;
    expect(by("a").activeTriggers).toEqual([1, 2]);
    expect(by("b").activeTriggers).toEqual([1, 2]);
    expect(by("c").activeTriggers).toEqual([3]);
  });

  it("refuses to style a group itself, like :hover", () => {
    expect(() => compileScene("@scene { group#g { cube; } } #g:active { scale: 0.9; }")).toThrow(
      /:active rule cannot style a group/,
    );
  });

  it("changes only the animatable properties", () => {
    expect(() => compileScene("@scene { cube; } cube:active { size: 2; }")).toThrow(
      /"size" cannot change on :active/,
    );
  });
});

describe(":active in the compiled scene", () => {
  it("adds nothing to a scene without :active", () => {
    const compiled = compileScene("@scene { cube; } cube:hover { scale: 1.2; }");
    expect(compiled.active).toBeUndefined();
    expect(compiled.transitions).toHaveLength(1);
  });

  it("gives :active its own slots, after the :hover slots, in the same uHover[]", () => {
    const compiled = compileScene(
      "@scene { cube#a; cube#b; } cube { transition: 0.3s; } cube:hover { scale: 1.1; } #b:active { scale: 0.9; transition: 0.1s; }",
    );
    expect(compiled.hover).toEqual([[1], [2]]);
    expect(compiled.active).toEqual([[2]]);
    expect(compiled.shader).toContain("uniform float uHover[3];");
    expect(compiled.shader).toContain("uHover[2]");
    // the pressed state mixes over the hovered one
    expect(compiled.shader).toMatch(/mix\(mix\([^;]*uHover\[1\]\)[^;]*uHover\[2\]\)/);
    // pressing goes with the :active transition, releasing with the hovered one
    expect(compiled.transitions).toHaveLength(3);
    expect(compiled.transitions[2].enter?.duration).toBe(0.1);
    expect(compiled.transitions[2].leave?.duration).toBe(0.3);
  });

  it("needs no :hover", () => {
    const compiled = compileScene("@scene { cube; } cube:active { color: #ff5a36; }");
    expect(compiled.hover).toEqual([]);
    expect(compiled.active).toEqual([[1]]);
    expect(compiled.shader).toContain("uniform float uHover[1];");
    expect(compiled.shader).toContain("uPicking");
  });

  it("skips the pressed layer when :active changes nothing more than :hover", () => {
    const compiled = compileScene(
      "@scene { cube; } cube:hover { color: #ff5a36; } cube:active { scale: 0.9; }",
    );
    expect(compiled.shader).not.toMatch(/mix\(mix\([^;]*uHover\[0\]\)[^;]*uHover\[1\]\)/);
  });

  it("validates as WGSL like :hover", () => {
    const compiled = compileScene("@scene { cube; sphere; } cube:hover { scale: 1.1; } cube:active { scale: 0.9; }");
    expect(compiled.wgsl).toContain("gss.hover");
  });

  it("survives the formatter", () => {
    const source = "@scene { cube; } cube:active { scale: 0.9; } #x:active cube, cube:hover:active { color: red; }";
    expect(compileScene(formatGss(source)).shader).toBe(compileScene(source).shader);
  });
});
