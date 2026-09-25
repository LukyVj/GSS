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
  it("applique une règle par classe", () => {
    expect(
      colorOf("@scene { cube.corner; } .corner { color: #ff0000; }", 0),
    ).toEqual([{ type: "HASH", value: "ff0000" }]);
  });

  it("ignore une règle qui ne cible pas l'objet", () => {
    expect(
      colorOf("@scene { cube; } .corner { color: #ff0000; }", 0),
    ).toBeUndefined();
  });

  it("à spécificité égale, la dernière règle gagne", () => {
    expect(
      colorOf(
        "@scene { cube.corner; } .corner { color: #111; } .corner { color: #222; }",
        0,
      ),
    ).toEqual([{ type: "HASH", value: "222" }]);
  });

  it("un id bat une classe, même placé avant", () => {
    expect(
      colorOf(
        "@scene { cube#a.corner; } #a { color: #111; } .corner { color: #222; }",
        0,
      ),
    ).toEqual([{ type: "HASH", value: "111" }]);
  });
});

describe("specificity", () => {
  it("classe les sélecteurs du plus faible au plus fort", () => {
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

  it("un id avec une classe bat un id seul", () => {
    const idOnly = specificity({ tag: null, id: "hero", classes: [] });
    const idAndClass = specificity({ tag: null, id: "hero", classes: ["big"] });
    expect(idOnly).toBeLessThan(idAndClass);
  });
});
