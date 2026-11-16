import { describe, expect, it } from "vitest";
import { compileScene } from "..";
import { scan, tokenize } from "../syntax/tokenizer";

// @paint (decision 151): a texture drawn by a fragment shader, like paint() in CSS draws
// a background from code. The block holds GLSL, read as it is.
const RINGS = `@paint rings {
  // a comment that says it's GLSL, with { braces } and a quote
  uniform float time;
  uniform vec2 resolution;
  out vec4 color;
  /* a block comment } */
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    color = vec4(0.5 + 0.5 * cos(time + uv.xyx * 6.0 + vec3(0, 2, 4)), 1.0);
  }
}`;

describe("@paint", () => {
  it("reads its block as GLSL, braces and comments included", () => {
    const tokens = tokenize(`${RINGS} @scene { cube; }`);
    expect(tokens[0]).toEqual({ type: "AT_KEYWORD", value: "paint" });
    expect(tokens[1]).toEqual({ type: "IDENT", value: "rings" });
    expect(tokens[2].type).toBe("GLSL");
    expect(tokens[2].value).toContain("it's GLSL, with { braces }");
    expect(tokens[2].value).toContain("color = vec4(");
    expect(tokens[3]).toEqual({ type: "AT_KEYWORD", value: "scene" });
  });

  it("keeps the block where it is written, for the formatter and the editor", () => {
    const located = scan(RINGS);
    const glsl = located.find((l) => l.token.type === "GLSL")!;
    expect(RINGS.slice(glsl.start, glsl.end)).toBe(RINGS.slice(RINGS.indexOf("{")));
  });

  it("gives the scene the shaders its objects paint with, by name", () => {
    const compiled = compileScene(`${RINGS} @scene { cube; } cube { texture: paint(rings); }`);
    expect(compiled.textures).toEqual(["paint(rings)"]);
    expect(compiled.paints).toHaveLength(1);
    expect(compiled.paints![0].name).toBe("rings");
    expect(compiled.paints![0].code).toContain("uniform float time;");
    expect(compiled.paints![0].line).toBe(1); // the line of its "{", where the GLSL starts
  });

  it("leaves out a @paint no object uses, like an unused @keyframes", () => {
    const compiled = compileScene(`${RINGS} @scene { cube; }`);
    expect(compiled.paints).toBeUndefined();
    expect(compiled.textures).toEqual([]);
  });

  it("says when no @paint has that name", () => {
    expect(() => compileScene("@scene { cube; } cube { texture: paint(waves); }")).toThrow(
      'No @paint named "waves"',
    );
  });

  it("says how to write it when the block is missing or never closed", () => {
    expect(() => compileScene("@paint rings; @scene { cube; }")).toThrow(
      "@paint rings takes a block of GLSL",
    );
    expect(() => compileScene("@scene { cube; } @paint rings { void main() {")).toThrow(
      "@paint never closed",
    );
    expect(() => compileScene("@paint { void main() {} } @scene { cube; }")).toThrow(
      "@paint takes a name",
    );
  });

  it("takes a name in paint()", () => {
    expect(() => compileScene(`${RINGS} @scene { cube; } cube { texture: paint(); }`)).toThrow(
      "paint() takes the name of a @paint, like: texture: paint(rings);",
    );
  });
});

// size and filter (decision 228): written before the GLSL of the block, like the descriptors
// of an at-rule of CSS
describe("@paint size and filter", () => {
  const paintOf = (head: string) =>
    compileScene(`@paint fill {${head}
  out vec4 color;
  void main() { color = vec4(1.0); }
} @scene { cube; } cube { texture: paint(fill); }`).paints![0];

  it("keeps a paint without them as it was", () => {
    const paint = paintOf("");
    expect(paint).not.toHaveProperty("size");
    expect(paint).not.toHaveProperty("mipmap");
  });

  it("reads a square size, or a width and a height, in pixels", () => {
    expect(paintOf("\n  size: 2048px;").size).toEqual([2048, 2048]);
    expect(paintOf("\n  size: 1024px 512px;").size).toEqual([1024, 512]);
  });

  it("reads filter: mipmap, and linear as the default", () => {
    expect(paintOf("\n  filter: mipmap;").mipmap).toBe(true);
    expect(paintOf("\n  filter: linear;")).not.toHaveProperty("mipmap");
  });

  it("hands the GLSL on without them, on the same lines, so its errors keep their line", () => {
    const paint = paintOf("\n  size: 2048px;\n  filter: mipmap;");
    expect(paint.code).not.toContain("size");
    expect(paint.code).not.toContain("mipmap");
    expect(paint.code.split("\n").length).toBe(paintOf("\n\n").code.split("\n").length);
    expect(paint.code).toContain("out vec4 color;");
  });

  it("refuses a size out of range, without px, or another descriptor", () => {
    expect(() => paintOf("\n  size: 32px;")).toThrow("@paint fill: size expects one or two lengths from 64px to 4096px, like: size: 1024px;");
    expect(() => paintOf("\n  size: 8192px;")).toThrow("size expects one or two lengths");
    expect(() => paintOf("\n  size: 1024;")).toThrow("size expects one or two lengths");
    expect(() => paintOf("\n  filter: nearest;")).toThrow("@paint fill: filter expects linear or mipmap, like: filter: mipmap;");
    expect(() => paintOf("\n  wrap: repeat;")).toThrow("@paint fill takes size and filter before its GLSL, like: @paint fill { size: 1024px; void main() { … } }");
  });
});
