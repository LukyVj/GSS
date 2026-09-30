import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import { expandScene } from "./expand";
import { parseSelector, resolveStyles, specificity } from "./resolve";
import { readTexture } from "./textures";

// Step 5a of the textures: the ::top and ::bottom pseudo-elements, in the selectors
// and in the cascade. The shader comes at step 5b.
const selector = (text: string) => parseSelector(tokenize(text));

function styled(source: string) {
  const stylesheet = parse(tokenize(source));
  return resolveStyles(expandScene(stylesheet.scene), stylesheet.rules);
}

describe("::top and ::bottom in a selector", () => {
  it("are read at the end of a compound, like CSS", () => {
    expect(selector("cube::top")).toMatchObject({ tag: "cube", face: "top" });
    expect(selector("cube.grass::bottom")).toMatchObject({
      tag: "cube",
      classes: ["grass"],
      face: "bottom",
    });
    expect(selector("#g cube::top")).toMatchObject({
      tag: "cube",
      face: "top",
      ancestors: [{ id: "g" }],
    });
  });

  it("are absent from a plain selector", () => {
    expect(selector("cube.grass").face).toBeUndefined();
  });

  it("explain an unknown face", () => {
    expect(() => selector("cube::left")).toThrow(/::top or ::bottom/);
  });

  it("must be the last thing of the selector, like CSS", () => {
    expect(() => selector("cube::top.grass")).toThrow(/at the end/);
    expect(() => selector("#g::top cube")).toThrow(/at the end/);
  });

  it("count like a tag in the specificity, like CSS", () => {
    expect(specificity(selector("cube::top"))).toBe(2);
    expect(specificity(selector(".grass::top"))).toBe(101);
  });
});

describe("the cascade of the faces", () => {
  it("gives each face its own styles, apart from the object's", () => {
    const [cube] = styled(`
      @scene { cube.grass; }
      .grass { texture: url("side.png"); }
      .grass::top { texture: url("top.png"); }`);
    expect(readTexture(cube.styles["texture"])).toBe("side.png");
    expect(readTexture(cube.faceStyles.top["texture"])).toBe("top.png");
    expect(cube.faceStyles.bottom).toEqual({});
  });

  it("only applies a face rule to the objects it matches", () => {
    const [grass, dirt] = styled(`
      @scene { cube.grass; cube.dirt; }
      .grass::top { texture: url("top.png"); }`);
    expect(grass.faceStyles.top["texture"]).toBeDefined();
    expect(dirt.faceStyles.top).toEqual({});
  });

  it("follows the specificity: .grass::top beats cube::top", () => {
    const [cube] = styled(`
      @scene { cube.grass; }
      .grass::top { texture: url("grass.png"); }
      cube::top { texture: url("stone.png"); }`);
    expect(readTexture(cube.faceStyles.top["texture"])).toBe("grass.png");
  });

  it("only takes texture on a face", () => {
    expect(() =>
      styled("@scene { cube; } cube::top { color: #ff0000; }"),
    ).toThrow(/::top only takes texture/);
  });
});
