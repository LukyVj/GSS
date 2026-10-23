import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { readAlign, readContent, readFont, readFontSize, textSource } from "./content";
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

describe("readFontSize and readAlign", () => {
  it("read font-size in the units of the scene; none fits the text to the face", () => {
    expect(readFontSize(tokenize("0.3"))).toBe(0.3);
    expect(readFontSize(undefined)).toBeNull();
    expect(readFontSize(tokenize("auto"))).toBeNull();
    expect(() => readFontSize(tokenize("0"))).toThrow(/font-size expects auto or a positive number, like: font-size: 0.3;/);
    expect(() => readFontSize(tokenize("big"))).toThrow(/font-size expects/);
    expect(() => readFontSize(tokenize("12px"))).toThrow(/font-size expects/);
  });

  it("read text-align: start and end are left and right", () => {
    expect(readAlign(undefined)).toBe("left");
    expect(readAlign(tokenize("center"))).toBe("center");
    expect(readAlign(tokenize("start"))).toBe("left");
    expect(readAlign(tokenize("end"))).toBe("right");
    expect(readAlign(tokenize("right"))).toBe("right");
    expect(() => readAlign(tokenize("justify"))).toThrow(/text-align expects left, center, right, start or end/);
  });
});

describe("the layout of a text", () => {
  const font = "normal 400 sans-serif";

  it("is named with the width of a line, in letters of font-size, and the alignment", () => {
    expect(textSource("hi", font, 4, "center")).toBe('content(["hi","normal 400 sans-serif",4,"center"])');
    expect(textSource("hi", font, null, "right")).toBe('content(["hi","normal 400 sans-serif",null,"right"])');
  });

  it("wraps at the width of each face: the top, the front and the back, then the sides", () => {
    const scene = compileScene('@scene { cube; } cube { size: 2 1 0.5; content: "hi"; font-size: 0.5; }');
    expect(scene.textures).toEqual([textSource("hi", font, 4, "left"), textSource("hi", font, 1, "left")]);
  });

  it("keeps the alignment of text-align, with or without font-size", () => {
    expect(compileScene('@scene { cube; } cube { content: "hi"; text-align: center; }').textures).toEqual([textSource("hi", font, null, "center")]);
  });

  it("breaks the lines where the text says, like \\A in CSS", () => {
    expect(compileScene('@scene { cube; } cube { content: "one\\A two"; }').textures).toEqual([textSource("one\ntwo", font)]);
  });

  it("reports a wrong font-size or text-align, even without content", () => {
    expect(() => compileScene("@scene { cube; } cube { font-size: -1; }")).toThrow(/font-size expects/);
    expect(() => compileScene("@scene { cube; } cube { text-align: justify; }")).toThrow(/text-align expects/);
  });

  it("gives the sides their own text when they are narrower, in the shader", () => {
    const textureColor = glslFunction(compileGSS('@scene { cube; } cube { size: 2 1 0.5; content: "hi"; font-size: 0.5; }'), "vec3 textureColor(");
    expect(textureColor).toContain("int face = faceOf(ln);");
    expect(textureColor).toContain("if (face == 5) return textLabel(uTexture1, q, ln, vec3(2.0, 1.0, 0.5), color, textInk(color), 1.0); // right");
    expect(textureColor).toContain("return textLabel(uTexture0, q, ln, vec3(2.0, 1.0, 0.5), color, textInk(color), 1.0);");
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

  it("are each text an object shows, hovered or in its animation", () => {
    const font = "normal 400 sans-serif";
    expect(compileScene('@scene { cube; } cube { content: "a"; } cube:hover { content: "b"; }').textures).toEqual([textSource("a", font), textSource("b", font)]);
    expect(
      compileScene('@scene { cube; } cube { content: "a"; animation: t 2s; } @keyframes t { 50% { font-weight: bold; } to { content: "b"; } }').textures,
    ).toEqual([textSource("a", font), textSource("a", "normal 700 sans-serif"), textSource("b", font)]);
  });

  it("only apply to objects", () => {
    expect(() => compileScene('@scene { cube; } scene { content: "a"; }')).toThrow(/"content" only applies to objects/);
  });
});

describe("content that changes", () => {
  it("swaps the text halfway through :hover, like a value of CSS that does not interpolate", () => {
    const textureColor = glslFunction(compileGSS('@scene { cube; } cube { content: "a"; } cube:hover { content: "b"; }'), "vec3 textureColor(");
    expect(textureColor).toContain("float text0 = mix(1.0, 0.0, uHover[0]);");
    expect(textureColor).toContain("if (text0 > 0.5) {");
    expect(textureColor).toContain("return textLabel(uTexture0, q, ln, vec3(1.0, 1.0, 1.0), color, textInk(color), 0.0);");
    expect(textureColor).toContain("return textLabel(uTexture1, q, ln, vec3(1.0, 1.0, 1.0), color, textInk(color), 0.0);");
  });

  it("swaps it in @keyframes, at each frame that sets content or a font", () => {
    const textureColor = glslFunction(
      compileGSS('@scene { cube; } cube { content: "a"; animation: t 2s; } @keyframes t { to { content: "b"; } }'),
      "vec3 textureColor(",
    );
    expect(textureColor).toMatch(/float text0 = mix\(1\.0, 0\.0, /);
  });

  it("mixes text-color, on :hover and in @keyframes", () => {
    const hovered = glslFunction(compileGSS('@scene { cube; } cube { content: "a"; text-color: red; } cube:hover { text-color: blue; }'), "vec3 textureColor(");
    expect(hovered).toContain("color, mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), uHover[0]), 0.0);");
    const unset = glslFunction(compileGSS('@scene { cube; } cube { content: "a"; } cube:hover { text-color: blue; }'), "vec3 textureColor(");
    expect(unset).toContain("color, mix(textInk(color), vec3(0.0, 0.0, 1.0), uHover[0]), 0.0);");
  });

  it("zooms the text with font-size, its lines broken at the size at rest", () => {
    const scene = compileScene('@scene { cube; } cube { content: "a"; font-size: 0.2; animation: g 1s; } @keyframes g { to { font-size: 0.4; } }');
    expect(scene.textures).toEqual([textSource("a", "normal 400 sans-serif", 5, "left")]);
    expect(glslFunction(scene.shader, "vec3 textureColor(")).toMatch(/textInk\(color\), mix\(1\.0, 2\.0, /);
  });

  it("needs a font-size at rest to change it", () => {
    expect(() => compileScene('@scene { cube; } cube { content: "a"; } cube:hover { font-size: 0.4; }')).toThrow(
      /font-size can change on :hover or in @keyframes only from a number: write one at rest, like: font-size: 0.3;/,
    );
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
    expect(textureColor).toContain("return textLabel(uTexture0, q, ln, vec3(1.0, 1.0, 1.0), color, textInk(color), 0.0);");
    expect(textureColor).not.toContain("id == 1.0");
    expect(glslFunction(shader, "vec3 textLabel(")).toContain("return textAt(image, uv, face, color, ink, zoom);");
    expect(glslFunction(shader, "vec3 textAt(")).toContain("textureSize(image, 0)");
  });

  it("reads the two copies of the text: the letters take the ink, an emoji keeps its colors", () => {
    const label = glslFunction(compileGSS('@scene { cube; } cube { content: "hi"; }'), "vec3 textAt(");
    expect(label).toContain("vec4 light = texture(image, vec2(st.x, 0.5 + 0.5 * st.y));");
    expect(label).toContain("vec4 dark = texture(image, vec2(st.x, 0.5 * st.y));");
    expect(label).toContain("mix(dark.rgb, ink, plain)");
  });

  it("paints the text over the image of the object", () => {
    const shader = compileGSS('@scene { cube; } cube { texture: url("dirt.png"); content: "hello"; }');
    const textureColor = glslFunction(shader, "vec3 textureColor(");
    expect(textureColor).toContain("color = triplanar(uTexture0, q, ln, vec3(1.0, 1.0, 1.0), color, false);");
    expect(textureColor).toContain("return textLabel(uTexture1, q, ln, vec3(1.0, 1.0, 1.0), color, textInk(color), 0.0);");
  });

  it("follows the size of the object, not texture-size", () => {
    const shader = compileGSS('@scene { cube; } cube { size: 3 1 0.2; texture-size: 0.5; content: "hello"; }');
    expect(glslFunction(shader, "vec3 textureColor(")).toContain("textLabel(uTexture0, q, ln, vec3(3.0, 1.0, 0.2), color, textInk(color), 0.0);");
  });

  it("wraps the text around a round shape, like a label: four sides, then the top and the bottom", () => {
    const cylinder = glslFunction(compileGSS('@scene { cylinder; } cylinder { content: "hi"; }'), "vec3 textureColor(");
    expect(cylinder).toContain("return textLabel(uTexture0, wrapped(q, ln, 0.5, 1.111), ln, vec3(0.785, 1.0, 0.785), color, textInk(color), 0.0);");
    const sphere = glslFunction(compileGSS('@scene { sphere; } sphere { radius: 1; content: "hi"; }'), "vec3 textureColor(");
    expect(sphere).toContain("wrapped(q, ln, 1.0, 1.361), ln, vec3(1.571, 1.414, 1.571)");
    const torus = glslFunction(compileGSS('@scene { torus; } torus { content: "hi"; }'), "vec3 textureColor(");
    expect(torus).toContain("wrapped(q, ln, 1.28, 1.0), ln, vec3(2.011, 0.56, 2.011)");
    expect(compileGSS('@scene { cylinder; } cylinder { content: "hi"; }')).toContain("vec3 wrapped(vec3 q, vec3 n, float r, float spread) {");
  });

  it("writes on each face of an octahedron, flat on its triangle", () => {
    const shader = compileGSS('@scene { octahedron; } octahedron { radius: 1; content: "8"; }');
    expect(glslFunction(shader, "vec3 textureColor(")).toContain(
      "return textFacet(uTexture0, q, normalize(sign(ln)), sign(ln) * 0.333, vec2(0.707, 0.408), color, textInk(color), 0.0);",
    );
    expect(shader).toContain("vec3 textFacet(sampler2D image, vec3 q, vec3 normal, vec3 middle, vec2 room, vec3 color, vec3 ink, float zoom) {");
  });

  it("writes on each face of a pyramid: its four slopes and its base", () => {
    const shader = compileGSS('@scene { pyramid; } pyramid { size: 2 1 2; content: "A"; }');
    expect(glslFunction(shader, "vec3 textureColor(")).toContain("return textPyramid(uTexture0, q, vec3(2.0, 1.0, 2.0), color, textInk(color), 0.0);");
    expect(shader).toContain("vec3 textPyramid(sampler2D image, vec3 q, vec3 s, vec3 color, vec3 ink, float zoom) {");
  });

  it("projects the text on another shape from each side, like a sticker, at the size of the shape", () => {
    const tube = glslFunction(compileGSS('@scene { prism; } prism { d: path("M0 0 L1 0 L0.5 1 Z"); content: "hi"; }'), "vec3 textureColor(");
    expect(tube).toMatch(/return textSticker\(uTexture0, q, ln, vec3\(([\d.]+), \1, \1\), color, textInk\(color\), 0\.0\);/);
    // a cube keeps its faces: no sticker, no wrap
    const cube = compileGSS('@scene { cube; } cube { content: "hi"; }');
    expect(cube).not.toContain("textSticker(");
    expect(cube).not.toContain("wrapped(");
  });

  it("paints the text in the color of text-color", () => {
    const shader = compileGSS('@scene { cube; } cube { content: "hello"; text-color: red; }');
    expect(glslFunction(shader, "vec3 textureColor(")).toContain("color, vec3(1.0, 0.0, 0.0), 0.0);");
    expect(shader).not.toContain("textInk(");
  });

  it("knows no -webkit-text-fill-color", () => {
    expect(() => compileScene('@scene { cube; } cube { content: "a"; -webkit-text-fill-color: red; }')).toThrow(/Unknown property "-webkit-text-fill-color"/);
  });

  it("paints the text of a face on that face only", () => {
    const shader = compileGSS('@scene { cube; } cube { content: "side"; } cube::face(front) { content: "front"; }');
    const textureColor = glslFunction(shader, "vec3 textureColor(");
    expect(textureColor).toContain("int face = faceOf(ln);");
    expect(textureColor).toContain("if (face == 3) return textLabel(uTexture1, q, ln, vec3(1.0, 1.0, 1.0), color, textInk(color), 0.0); // front");
    expect(textureColor).toContain("return textLabel(uTexture0, q, ln, vec3(1.0, 1.0, 1.0), color, textInk(color), 0.0);");
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
