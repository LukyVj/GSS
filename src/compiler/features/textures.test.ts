import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { readTexture } from "./textures";
import { compileScene } from "../index";

describe("readTexture", () => {
  it('reads the file of url("…")', () => {
    expect(readTexture(tokenize('url("dirt.png")'))).toBe("dirt.png");
  });

  it("keeps a path or a full URL as written", () => {
    expect(readTexture(tokenize('url("/textures/grass-top.png")'))).toBe(
      "/textures/grass-top.png",
    );
    expect(readTexture(tokenize('url("https://example.com/a.png")'))).toBe(
      "https://example.com/a.png",
    );
  });

  it('explains a value that is not url("…")', () => {
    expect(() => readTexture(tokenize("dirt"))).toThrow(/url\("…"\)/);
    expect(() => readTexture(tokenize("url(12)"))).toThrow(/url\("…"\)/);
    expect(() => readTexture(tokenize('path("a.png")'))).toThrow(/url\("…"\)/);
    expect(() => readTexture(tokenize('url("a.png", "b.png")'))).toThrow(
      /url\("…"\)/,
    );
  });
});

describe("the textures of a scene", () => {
  it("are listed by compileScene, once each, in the order of the objects", () => {
    const scene = compileScene(`
      @scene { cube#a; sphere; cube#b; }
      #a, #b { texture: url("dirt.png"); }
      sphere { texture: url("stone.png"); }`);
    expect(scene.textures).toEqual(["dirt.png", "stone.png"]);
  });

  it("are an empty list when no object has one", () => {
    expect(compileScene("@scene { cube; }").textures).toEqual([]);
  });

  it("go through the cascade and var(), like any value", () => {
    const scene = compileScene(`
      @scene { cube; }
      scene { --dirt: url("dirt.png"); }
      cube { texture: url("stone.png"); }
      cube { texture: var(--dirt); }`);
    expect(scene.textures).toEqual(["dirt.png"]);
  });

  it("are checked: a wrong value is an error", () => {
    expect(() => compileScene("@scene { cube; } cube { texture: dirt; }")).toThrow(
      /url\("…"\)/,
    );
  });
});

describe("texture: element(#id), an HTML element as a live texture", () => {
  it("is a texture slot of its own, filled by the page at run time", () => {
    expect(readTexture(tokenize("element(#card)"))).toBe("element(#card)");
    const scene = compileScene(
      '@scene { cube#a; cube#b; } #a { texture: element(#card); } #b { texture: url("dirt.png"); } #b::face(front) { texture: element(#card); }',
    );
    expect(scene.textures).toEqual(["element(#card)", "dirt.png"]);
    expect(scene.shader).toContain("uniform sampler2D uTexture0;");
  });

  it("goes on one face, and counts in the 16 images of a scene", () => {
    expect(() => compileScene("@scene { cube; } cube::face(front) { texture: element(#card); }")).not.toThrow();
    const many = Array.from({ length: 17 }, (_, i) => `cube#c${i}`).join("; ");
    const rules = Array.from({ length: 17 }, (_, i) => `#c${i} { texture: element(#e${i}); }`).join(" ");
    expect(() => compileScene(`@scene { ${many}; } ${rules}`)).toThrow("at most 16 images");
  });

  it("says what is wrong", () => {
    expect(() => readTexture(tokenize("element(card)"))).toThrow("element() takes the id of an element of the page, like: element(#card)");
    expect(() => readTexture(tokenize("element(#a, #b)"))).toThrow("element() takes the id");
    expect(() => readTexture(tokenize("dirt"))).toThrow('texture expects url("…") or element(#id)');
  });

  it("leaves its Shadertoy channel empty: the object keeps its color", async () => {
    const { toShadertoy } = await import("../shader/shadertoy");
    const scene = compileScene("@scene { cube; } cube { texture: element(#card); }");
    expect(toShadertoy(scene)).toContain("#define uTexture0 iChannel0");
  });
});
