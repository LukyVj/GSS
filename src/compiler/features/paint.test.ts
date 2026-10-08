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
