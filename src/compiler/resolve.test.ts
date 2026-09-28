import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import { expandScene } from "./expand";
import { resolveStyles, specificity } from "./resolve";

// La couleur finale de l'instance n° index
const colorOf = (source: string, index: number) => {
  const sheet = parse(tokenize(source));
  return resolveStyles(expandScene(sheet.scene), sheet.rules)[index].styles
    .color;
};

describe("resolveStyles", () => {
  it("applies a rule by class", () => {
    expect(
      colorOf("@scene { cube.corner; } .corner { color: #ff0000; }", 0),
    ).toEqual([{ type: "HASH", value: "ff0000" }]);
  });

  it("ignores a rule that does not target the object", () => {
    expect(
      colorOf("@scene { cube; } .corner { color: #ff0000; }", 0),
    ).toBeUndefined();
  });

  it("the last rule with equal specificity wins", () => {
    expect(
      colorOf(
        "@scene { cube.corner; } .corner { color: #111; } .corner { color: #222; }",
        0,
      ),
    ).toEqual([{ type: "HASH", value: "222" }]);
  });

  it("an id beats a class, even if placed before", () => {
    expect(
      colorOf(
        "@scene { cube#a.corner; } #a { color: #111; } .corner { color: #222; }",
        0,
      ),
    ).toEqual([{ type: "HASH", value: "111" }]);
  });

  it("a selector list styles every object it names", () => {
    const source = "@scene { cube#a; cube#b; } #a, #b { color: #111; }";
    expect(colorOf(source, 0)).toEqual([{ type: "HASH", value: "111" }]);
    expect(colorOf(source, 1)).toEqual([{ type: "HASH", value: "111" }]);
  });

  it("each selector of a list keeps its own specificity", () => {
    // #a (id) beats .c, even though the .c rule comes later
    const source =
      "@scene { cube#a.c; } .c, #a { color: #111; } .c { color: #222; }";
    expect(colorOf(source, 0)).toEqual([{ type: "HASH", value: "111" }]);
  });

  it("* styles every object", () => {
    const source = "@scene { cube; sphere#b; } * { color: #111; }";
    expect(colorOf(source, 0)).toEqual([{ type: "HASH", value: "111" }]);
    expect(colorOf(source, 1)).toEqual([{ type: "HASH", value: "111" }]);
  });

  it("* loses against a tag, even placed after", () => {
    const source = "@scene { cube; } cube { color: #111; } * { color: #222; }";
    expect(colorOf(source, 0)).toEqual([{ type: "HASH", value: "111" }]);
  });

  it("*.big is the same as .big", () => {
    const source = "@scene { cube.big; cube; } *.big { color: #111; }";
    expect(colorOf(source, 0)).toEqual([{ type: "HASH", value: "111" }]);
    expect(colorOf(source, 1)).toBeUndefined();
  });
});

describe("specificity", () => {
  it("sorts selectors from weakest to strongest", () => {
    const tag = specificity({ tag: "cube", id: null, classes: [] });
    const oneClass = specificity({ tag: null, id: null, classes: ["corner"] });
    const twoClasses = specificity({
      tag: null,
      id: null,
      classes: ["a", "b"],
    });
    const id = specificity({ tag: null, id: "hero", classes: [] });

    expect(tag).toBeLessThan(oneClass);
    expect(oneClass).toBeLessThan(twoClasses);
    expect(twoClasses).toBeLessThan(id);
  });

  it("an id with a class beats an id alone", () => {
    const idOnly = specificity({ tag: null, id: "hero", classes: [] });
    const idAndClass = specificity({ tag: null, id: "hero", classes: ["big"] });
    expect(idOnly).toBeLessThan(idAndClass);
  });
});
