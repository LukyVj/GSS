import { describe, it, expect } from "vitest";
import { mixinSuggestions, propertySuggestions } from "./completion";

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

  it("a light of @scene: only what a light takes", () => {
    const names = suggest("light#bulb { |}")!.names;
    expect(names).toContain("intensity");
    expect(names).toContain("translate");
    expect(names).not.toContain("material");
  });

  it("a nested rule: the selector with the parent in place of &", () => {
    const hovered = suggest("cube { color: red; &:hover { |} }")!.names;
    expect(hovered).toContain("color");
    expect(hovered).not.toContain("material"); // like cube:hover
    expect(suggest("#g { sphere { ra| } }")!.names).toContain("radius");
    expect(suggest("scene { @media (max-width: 600px) { d| } }")!.names).toContain("dpr");
  });

  it("offers nothing inside the GLSL of a @paint, and offers again in the rule after it", () => {
    const paint = "@paint fill { out vec4 color; void main() { color = vec4(1.0); } }\n";
    const inside = "@paint fill { out vec4 color; void main() { col";
    expect(propertySuggestions(inside, inside.length)).toBeNull();
    const after = `${paint}sphere { rad`;
    expect(propertySuggestions(after, after.length)?.properties.map((p) => p.name)).toContain("radius");
  });
});

describe("mixins", () => {
  it("every property in the body of a @mixin, which any rule can apply, and in its nested blocks", () => {
    const names = suggest("@mixin --m(--a: 1) { |}")!.names;
    expect(names).toContain("translate");
    expect(names).toContain("background");
    expect(suggest("@mixin --m { &:hover { ra| } }")?.names).toContain("radius");
    expect(suggest("@mixin --m { @media (max-width: 600px) { |} }")?.names).toContain("color");
    expect(suggest("@mixin --m { @contents { |} }")?.names).toContain("color");
  });

  it("in the block of @apply: the properties of the rule, or of the frame", () => {
    const names = suggest("sphere { @apply --m { |} }")!.names;
    expect(names).toContain("radius");
    expect(names).not.toContain("background");
    const frame = suggest("@keyframes up { to { @apply --m { |} } }")!.names;
    expect(frame).toContain("translate");
    expect(frame).not.toContain("material");
  });

  it("never in the parameters of @mixin or the values of @apply", () => {
    expect(suggest("@mixin --m(--a: re|) { }")).toBeNull();
    expect(suggest("cube { @apply --m(re|); }")).toBeNull();
  });
});

describe("the names of the mixins, after @apply", () => {
  // The mixin names to offer at the "|"
  function names(text: string) {
    const pos = text.indexOf("|");
    const found = mixinSuggestions(text.replace("|", ""), pos);
    return found && { from: found.from, names: found.names };
  }

  it("every @mixin of the file, before or after, once each", () => {
    const text = "@mixin --ball { } cube { @apply --b| } @mixin --card(--a) { } @mixin --ball { }";
    expect(names(text)).toEqual({ from: text.indexOf("--b|"), names: ["--ball", "--card"] });
  });

  it("with nothing typed yet, or a dash", () => {
    expect(names("@mixin --ball { } cube { @apply | }")?.names).toEqual(["--ball"]);
    expect(names("@mixin --ball { } cube { @apply -| }")?.names).toEqual(["--ball"]);
  });

  it("only right after @apply", () => {
    expect(names("@mixin --ball { } cube { @apply| }")).toBeNull();
    expect(names("@mixin --ball { } cube { --b| }")).toBeNull();
    expect(names("@mixin --ball { } cube { @apply --ball(--b|) }")).toBeNull();
    expect(names("@mixin --ball { } cube { color: --b| }")).toBeNull();
  });
});
