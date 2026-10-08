import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "../index";

const mapOf = (shader: string) => shader.slice(shader.indexOf("vec2 map(vec3 p) {"), shader.indexOf("\n}\n", shader.indexOf("vec2 map(vec3 p) {")));

describe("display: none, like CSS: the object is not drawn at all", () => {
  it("leaves an object out of the scene", () => {
    const scene = compileScene("@scene { cube; sphere; } sphere { display: none; }", { target: "glsl" });
    expect(mapOf(scene.shader)).toContain("// cube");
    expect(mapOf(scene.shader)).not.toContain("// sphere");
    expect(scene.objects).toBe(1);
  });

  it("leaves out every object of a group", () => {
    const map = mapOf(compileGSS("@scene { group#g { cube; torus; } sphere; } #g { display: none; }"));
    expect(map).not.toContain("// cube");
    expect(map).not.toContain("// torus");
    expect(map).toContain("// sphere");
  });

  it("still counts the object among its siblings, like an element of the DOM", () => {
    const map = mapOf(compileGSS("@scene { cube * 3; } cube:nth-child(1) { display: none; } cube:nth-child(3) { translate: 5 0 0; }"));
    expect(map).toContain("vec3(5.0, 0.0, 0.0)");
  });

  it("follows @media", () => {
    const scene = compileScene("@scene { cube; sphere; } @media (max-width: 600px) { sphere { display: none; } }", { target: "glsl" });
    expect(mapOf(scene.shader)).toContain("// sphere");
    expect(mapOf(scene.media!.variants[1].shader)).not.toContain("// sphere");
  });

  it("turns a light off", () => {
    expect(compileGSS("@scene { light; cube; } light { translate: 0 2 0; display: none; }")).not.toContain("lightPosition0");
  });

  it("takes block, which draws the object", () => {
    expect(mapOf(compileGSS("@scene { sphere; } sphere { display: block; }"))).toContain("// sphere");
  });

  it("refuses another value, :hover and @keyframes", () => {
    expect(() => compileGSS("@scene { sphere; } sphere { display: flex; }")).toThrow(/display expects none or block/);
    expect(() => compileGSS("@scene { sphere; } sphere:hover { display: none; }")).toThrow(/cannot change on :hover/);
    expect(() => compileGSS("@scene { sphere; } sphere { animation: a 1s; } @keyframes a { to { display: none; } }")).toThrow(/display/);
  });
});

describe("visibility: hidden, like CSS: the object is not seen, and cannot be pointed at", () => {
  it("leaves a hidden object out of map()", () => {
    const map = mapOf(compileGSS("@scene { cube; sphere; } sphere { visibility: hidden; }"));
    expect(map).toContain("// cube");
    expect(map).not.toContain("// sphere");
  });

  it("keeps the shader of a visible object as it was", () => {
    expect(compileGSS("@scene { sphere; } sphere { visibility: visible; }")).toBe(compileGSS("@scene { sphere; }"));
  });

  it("takes collapse as hidden, like CSS outside tables", () => {
    expect(mapOf(compileGSS("@scene { sphere; } sphere { visibility: collapse; }"))).not.toContain("// sphere");
  });

  it("is inherited from a group, and a child can be visible inside a hidden group", () => {
    const map = mapOf(compileGSS("@scene { group#g { cube; sphere; } } #g { visibility: hidden; } sphere { visibility: visible; }"));
    expect(map).not.toContain("// cube");
    expect(map).toContain("// sphere");
  });

  it("changes on :hover and in @keyframes: the object is there while the value is above hidden", () => {
    const hovered = mapOf(compileGSS("@scene { sphere; } sphere:hover { visibility: hidden; }"));
    expect(hovered).toMatch(/if \(anim\d+ > 0\.0\) \{/);
    const animated = compileGSS("@scene { sphere; } sphere { animation: blink 1s; } @keyframes blink { 50% { visibility: hidden; } }");
    expect(animated).toContain("iTime");
    expect(mapOf(animated)).toMatch(/if \(anim\d+ > 0\.0\) \{/);
  });

  it("refuses another value", () => {
    expect(() => compileGSS("@scene { sphere; } sphere { visibility: none; }")).toThrow(/visibility expects visible, hidden or collapse/);
  });
});
