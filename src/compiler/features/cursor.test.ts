import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "../index";

const compile = (source: string) => compileScene(source, { target: "glsl" });

describe("cursor, like CSS: the mouse pointer over an object", () => {
  it("gives the runtime the cursor of each object that sets one", () => {
    const scene = compile("@scene { cube; sphere; } sphere { cursor: pointer; }");
    expect(scene.cursors).toEqual([{ id: 2, hover: "pointer", active: "pointer" }]);
  });

  it("is absent, and the shader is the same, without a cursor", () => {
    expect(compile("@scene { sphere; }").cursors).toBeUndefined();
    expect(compileGSS("@scene { sphere; } sphere { cursor: auto; }")).toBe(compileGSS("@scene { sphere; }"));
  });

  it("asks the shader for the picking pass, even without :hover", () => {
    const shader = compileGSS("@scene { sphere; } sphere { cursor: pointer; }");
    expect(shader).toContain("uniform bool uPicking;");
    expect(shader).toContain("uniform float uHover[1];");
    expect(shader).toContain("if (uPicking) {");
    expect(compileScene("@scene { sphere; } sphere { cursor: pointer; }").wgsl).toContain("gss.pick");
  });

  it("takes the cursor of :hover and :active, like grab and grabbing", () => {
    const scene = compile("@scene { cube; } cube { cursor: grab; } cube:active { cursor: grabbing; }");
    expect(scene.cursors).toEqual([{ id: 1, hover: "grab", active: "grabbing" }]);
    expect(compile("@scene { cube; } cube:hover { cursor: pointer; }").cursors).toEqual([{ id: 1, hover: "pointer", active: "pointer" }]);
  });

  it("is inherited from a group, like CSS", () => {
    const scene = compile("@scene { group#g { cube; sphere; } torus; } #g { cursor: pointer; } sphere { cursor: help; }");
    expect(scene.cursors).toEqual([
      { id: 1, hover: "pointer", active: "pointer" },
      { id: 2, hover: "help", active: "help" },
    ]);
  });

  it("refuses what is not a cursor of CSS", () => {
    expect(() => compile("@scene { sphere; } sphere { cursor: hand; }")).toThrow(/cursor expects a keyword of CSS/);
  });
});
