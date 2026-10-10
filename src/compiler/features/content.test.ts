import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { readContent, readFont, textSource } from "./content";
import { compileGSS, compileScene } from "../index";

// The text of one generated GLSL function, from its signature to its closing brace
function glslFunction(shader: string, signature: string): string {
  const start = shader.indexOf(signature);
  if (start === -1) return "";
  return shader.slice(start, shader.indexOf("\n}", start) + 2);
}

describe("readContent", () => {
  it("reads a string", () => {
    expect(readContent(tokenize('"hello"'))).toBe("hello");
    expect(readContent(tokenize("'hello'"))).toBe("hello");
  });

  it("joins several strings, like CSS", () => {
    expect(readContent(tokenize('"hello" " " "world"'))).toBe("hello world");
  });

  it("is no text for none, normal, an empty string or no value", () => {
    expect(readContent(tokenize("none"))).toBeNull();
    expect(readContent(tokenize("normal"))).toBeNull();
    expect(readContent(tokenize('""'))).toBeNull();
    expect(readContent(undefined)).toBeNull();
  });

  it("explains a value that is not a string", () => {
    expect(() => readContent(tokenize("hello"))).toThrow(/content expects a string, like: content: "hello";/);
    expect(() => readContent(tokenize("12"))).toThrow(/content expects a string/);
    expect(() => readContent(tokenize('"a", "b"'))).toThrow(/content expects a string/);
  });
});

describe("readFont", () => {
  it("is the font of CSS by default: normal, 400, sans-serif", () => {
    expect(readFont({})).toBe("normal 400 sans-serif");
  });

  it("reads font-family as CSS writes it: names, strings, a list", () => {
    expect(readFont({ "font-family": tokenize("monospace") })).toBe("normal 400 monospace");
    expect(readFont({ "font-family": tokenize('"Helvetica Neue", Arial, sans-serif') })).toBe(
      'normal 400 "Helvetica Neue", Arial, sans-serif',
    );
    expect(readFont({ "font-family": tokenize("Times New Roman, serif") })).toBe("normal 400 Times New Roman, serif");
  });

  it("reads font-weight: normal, bold or a number from 1 to 1000", () => {
    expect(readFont({ "font-weight": tokenize("bold") })).toBe("normal 700 sans-serif");
    expect(readFont({ "font-weight": tokenize("normal") })).toBe("normal 400 sans-serif");
    expect(readFont({ "font-weight": tokenize("650") })).toBe("normal 650 sans-serif");
  });

  it("reads font-style: normal, italic or oblique", () => {
    expect(readFont({ "font-style": tokenize("italic") })).toBe("italic 400 sans-serif");
    expect(readFont({ "font-style": tokenize("oblique") })).toBe("oblique 400 sans-serif");
  });

  it("explains a wrong value", () => {
    expect(() => readFont({ "font-family": tokenize("12") })).toThrow(/font-family expects/);
    expect(() => readFont({ "font-family": tokenize("Arial,") })).toThrow(/font-family expects/);
    expect(() => readFont({ "font-weight": tokenize("heavy") })).toThrow(/font-weight expects normal, bold or a number from 1 to 1000/);
    expect(() => readFont({ "font-weight": tokenize("0") })).toThrow(/font-weight expects/);
    expect(() => readFont({ "font-weight": tokenize("1200") })).toThrow(/font-weight expects/);
    expect(() => readFont({ "font-style": tokenize("slanted") })).toThrow(/font-style expects normal, italic or oblique/);
  });
});

describe("the texts of a scene", () => {
  const hello = textSource("hello", "normal 400 sans-serif");

  it("are named by their text and their font", () => {
    expect(hello).toBe('content(["hello","normal 400 sans-serif"])');
  });

  it("are listed with the images of the scene, once each", () => {
    const scene = compileScene(`
      @scene { cube#a; sphere; cube#b; }
      #a, #b { content: "hello"; }
      sphere { content: "hello"; font-weight: bold; texture: url("stone.png"); }`);
    expect(scene.textures).toEqual([hello, "stone.png", textSource("hello", "normal 700 sans-serif")]);
  });

  it("are none for content: none, and for a scene without content", () => {
    expect(compileScene('@scene { cube; } cube { content: "hello"; } cube { content: none; }').textures).toEqual([]);
    expect(compileScene("@scene { cube; }").textures).toEqual([]);
  });

  it("read a variable, like any value", () => {
    const scene = compileScene('@scene { cube; } scene { --word: "hello"; } cube { content: var(--word); }');
    expect(scene.textures).toEqual([hello]);
  });

  it("go on one face, with the font of the object", () => {
    const scene = compileScene(`
      @scene { cube; }
      cube { font-style: italic; }
      cube::face(front) { content: "A"; }
      cube::top { content: "B"; }`);
    expect(scene.textures).toEqual([textSource("B", "italic 400 sans-serif"), textSource("A", "italic 400 sans-serif")]);
  });

  it("report a wrong value where it is written", () => {
    expect(() => compileScene("@scene { cube; } cube { content: hello; }")).toThrow(/content expects a string/);
    expect(() => compileScene('@scene { cube; } cube { content: "a"; font-weight: heavy; }')).toThrow(/font-weight expects/);
    // checked even without content, like image-rendering without a texture
    expect(() => compileScene("@scene { cube; } cube { font-style: slanted; }")).toThrow(/font-style expects/);
  });

  it("cannot be animated, or change on :hover", () => {
    expect(() => compileScene('@scene { cube; } cube:hover { content: "a"; }')).toThrow(/"content" cannot change on :hover/);
    expect(() =>
      compileScene('@scene { cube; } cube { animation: a 1s; } @keyframes a { to { content: "a"; } }'),
    ).toThrow(/"content" cannot be animated/);
  });

  it("only apply to objects", () => {
    expect(() => compileScene('@scene { cube; } scene { content: "a"; }')).toThrow(/"content" only applies to objects/);
  });
});

describe("content in the shader", () => {
  it("adds nothing to a scene without content", () => {
    const shader = compileGSS('@scene { cube; } cube { texture: url("dirt.png"); }');
    expect(shader).not.toContain("textLabel");
  });

  it("gives the text a sampler2D uniform, like an image", () => {
    const shader = compileGSS('@scene { cube; } cube { content: "hello"; }');
    expect(shader).toContain('uniform sampler2D uTexture0; // content(["hello","normal 400 sans-serif"])');
    expect(shader).toContain("m.color = textureColor(id, p, n, m.color);");
  });

  it("paints the text over the color of the object, fitted to the face", () => {
    const shader = compileGSS('@scene { cube#a; cube#b; } #b { content: "hello"; }');
    const textureColor = glslFunction(shader, "vec3 textureColor(");
    expect(textureColor).toContain("if (id == 2.0) {");
    expect(textureColor).toContain("return textLabel(uTexture0, q, ln, vec3(1.0, 1.0, 1.0), color, textInk(color));");
    expect(textureColor).not.toContain("id == 1.0");
    const label = glslFunction(shader, "vec3 textLabel(");
    expect(label).toContain("textureSize(image, 0)");
  });

  it("paints the text over the image of the object", () => {
    const shader = compileGSS('@scene { cube; } cube { texture: url("dirt.png"); content: "hello"; }');
    const textureColor = glslFunction(shader, "vec3 textureColor(");
    expect(textureColor).toContain("color = triplanar(uTexture0, q, ln, vec3(1.0, 1.0, 1.0), color, false);");
    expect(textureColor).toContain("return textLabel(uTexture1, q, ln, vec3(1.0, 1.0, 1.0), color, textInk(color));");
  });

  it("follows the size of the object, not texture-size", () => {
    const shader = compileGSS('@scene { cube; } cube { size: 3 1 0.2; texture-size: 0.5; content: "hello"; }');
    expect(glslFunction(shader, "vec3 textureColor(")).toContain("textLabel(uTexture0, q, ln, vec3(3.0, 1.0, 0.2), color, textInk(color));");
  });

  it("gives the text of a sphere the square that fits in a sixth of it", () => {
    const shader = compileGSS('@scene { sphere; } sphere { radius: 1; content: "hello"; }');
    expect(glslFunction(shader, "vec3 textureColor(")).toContain("textLabel(uTexture0, q, ln, vec3(1.154, 1.154, 1.154), color, textInk(color));");
  });

  it("paints the text of a face on that face only", () => {
    const shader = compileGSS('@scene { cube; } cube { content: "side"; } cube::face(front) { content: "front"; }');
    const textureColor = glslFunction(shader, "vec3 textureColor(");
    expect(textureColor).toContain("int face = faceOf(ln);");
    expect(textureColor).toContain("if (face == 3) return textLabel(uTexture1, q, ln, vec3(1.0, 1.0, 1.0), color, textInk(color)); // front");
    expect(textureColor).toContain("return textLabel(uTexture0, q, ln, vec3(1.0, 1.0, 1.0), color, textInk(color));");
  });

  it("leaves the shader of a textured scene as it was", () => {
    const shader = compileGSS('@scene { cube; } cube { texture: url("dirt.png"); }');
    expect(glslFunction(shader, "vec3 textureColor(")).toContain("if (id == 1.0) return triplanar(uTexture0, space1(p), space1(p + n * 0.01) - space1(p), vec3(1.0, 1.0, 1.0), color, false);");
  });

  it("compiles to WGSL", () => {
    const scene = compileScene('@scene { cube; } cube { content: "hello"; }');
    expect(scene.wgsl).toContain("fn g_textLabel(");
    expect(scene.wgsl).toContain("textureDimensions(");
  });
});
