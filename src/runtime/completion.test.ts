import { describe, it, expect } from "vitest";
import { propertySuggestions } from "./completion";

// Autocompletion of property names in the editor: the cursor is the "|"
function suggest(text: string) {
  const pos = text.indexOf("|");
  const found = propertySuggestions(text.replace("|", ""), pos);
  return found && { from: found.from, names: found.properties.map((p) => p.name) };
}

describe("where a property name is expected", () => {
  it("at the start of a declaration, with what is typed so far", () => {
    const found = suggest("@scene { cube; } cube { pa| }");
    expect(found?.from).toBe("@scene { cube; } cube { ".length);
    expect(found?.names).toContain("translate");
  });

  it("right after { or ;, with nothing typed yet", () => {
    expect(suggest("cube {|}")?.names).toContain("color");
    expect(suggest("cube { color: red; |}")?.names).toContain("material");
  });

  it("never in a value, in a selector, in @scene or outside any rule", () => {
    expect(suggest("cube { color: re| }")).toBeNull();
    expect(suggest("cu|")).toBeNull();
    expect(suggest("cube.a| { }")).toBeNull();
    expect(suggest("@scene { cu| }")).toBeNull();
    expect(suggest("@scene { group#g { cu| } }")).toBeNull();
  });

  it("not for a custom property", () => {
    expect(suggest("cube { --g| }")).toBeNull();
  });

  it("after a comment, and in a rule after a closed one", () => {
    expect(suggest("cube { /* note */ |}")?.names).toContain("color");
    expect(suggest("cube { color: red; } sphere { ra| }")?.names).toContain("radius");
  });
});

describe("only the properties the rule can take", () => {
  it("the scene: its own properties", () => {
    const names = suggest("scene { |}")!.names;
    expect(names).toContain("background");
    expect(names).toContain("filter"); // everywhere
    expect(names).not.toContain("translate");
  });

  it("a shape: the object properties and its own, not another shape's", () => {
    const names = suggest("sphere { |}")!.names;
    expect(names).toContain("radius");
    expect(names).toContain("translate");
    expect(names).not.toContain("background");
    expect(names).not.toContain("corner-radius"); // a cube's
  });

  it("a class or an id: every object property, whatever its shape", () => {
    const names = suggest(".a { |}")!.names;
    expect(names).toContain("corner-radius");
    expect(names).toContain("radius");
    expect(names).not.toContain("background");
  });

  it("a group: what a group takes", () => {
    const names = suggest("group#g { |}")!.names;
    expect(names).toContain("translate");
    expect(names).not.toContain("color");
  });

  it(":hover: what can change on hover", () => {
    const names = suggest("cube:hover { |}")!.names;
    expect(names).toContain("scale");
    expect(names).toContain("transition");
    expect(names).not.toContain("material");
  });

  it("a face: only texture", () => {
    expect(suggest("cube::top { |}")!.names).toEqual(["texture"]);
  });

  it("a frame of @keyframes: what can be animated", () => {
    const names = suggest("@keyframes up { to { |} }")!.names;
    expect(names).toContain("translate");
    expect(names).not.toContain("material");
  });

  it("a rule inside @media", () => {
    expect(suggest("@media (max-width: 600px) { scene { d| } }")!.names).toContain("dpr");
  });
});
