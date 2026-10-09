import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "../index";

const scene = (rule: string, more = "") => compileGSS(`@scene { sphere; } sphere { translate: 0 1 0; color: #3a7bff; ${rule} } ${more}`);
const mapOf = (shader: string) => shader.slice(shader.indexOf("vec2 map(vec3 p) {"), shader.indexOf("\n}\n", shader.indexOf("vec2 map(vec3 p) {")));
const fn = (shader: string, head: string) => shader.slice(shader.indexOf(head), shader.indexOf("\n}\n", shader.indexOf(head)));

describe("outline: a line around the silhouette of an object, in the units of the scene", () => {
  it("keeps the shader as it was without an outline, or with the style none of CSS", () => {
    const plain = scene("");
    for (const rule of ["outline: none;", "outline: 0.05;", "outline: 0.05 red;", "outline-width: 0.1;", "outline-style: none;"])
      expect(scene(rule)).toBe(plain);
  });

  it("measures each outlined object in map(), in widths of its outline past its offset", () => {
    const map = mapOf(scene("outline: 0.05 solid red;"));
    expect(map).toContain("float dOutline = ");
    expect(map).toContain("outlineAt(dOutline, 0.0, 0.05, 1.0);");
    expect(mapOf(scene("outline: 0.05 solid red; outline-offset: 0.1;"))).toContain("outlineAt(dOutline, 0.1, 0.05, 1.0);");
  });

  it("keeps a passed closest point in march(), and draws the line where the ray did not hit that object", () => {
    const shader = scene("outline: 0.05 solid red;");
    expect(fn(shader, "vec2 march(vec3 ro, vec3 rd) {")).toContain("lineLastM >= 0.0 && lineLastM < 1.0");
    expect(shader).toContain("float outlineT = lineT;");
    expect(shader).toContain("col = outlineColor(outlineHit);");
    expect(fn(shader, "vec3 outlineColor(float id) {")).toContain("if (id == 1.0) return vec3(1.0, 0.0, 0.0);");
  });

  it("takes the color of the object by default, like currentColor", () => {
    expect(fn(scene("outline: 0.05 solid;"), "vec3 outlineColor(float id) {")).toContain(
      fn(compileGSS("@scene { sphere; } sphere { color: #3a7bff; outline: 0.05 solid #3a7bff; }"), "vec3 outlineColor(float id) {").split("\n")[1],
    );
  });

  it("reads the keywords of the width, auto as solid, and the longhands, which win over the shorthand", () => {
    expect(mapOf(scene("outline: thin solid;"))).toContain("0.01, 1.0);");
    expect(mapOf(scene("outline: medium auto;"))).toContain("0.02, 1.0);");
    expect(mapOf(scene("outline: thick solid;"))).toContain("0.04, 1.0);");
    expect(mapOf(scene("outline-width: 0.2; outline-style: solid; outline: 0.05 solid;"))).toContain("0.2, 1.0);");
    expect(fn(scene("outline-style: solid; outline-color: black;"), "vec3 outlineColor(float id) {")).toContain("vec3(0.0, 0.0, 0.0)");
  });

  it("follows :hover and @keyframes", () => {
    expect(scene("outline: 0.05 solid red; transition: 0.2s;", "sphere:hover { outline-color: white; outline-width: 0.1; }")).toMatch(/uHover\[0\]/);
    expect(scene("outline: 0.05 solid red; animation: glow 1s;", "@keyframes glow { to { outline-offset: 0.2; } }")).toContain("iTime");
  });

  it("follows the fog, at the distance of the line", () => {
    expect(scene("outline: 0.05 solid red;", "scene { fog: 4 12; }")).toContain("fogAmount(outlineT)");
  });

  it("works with geometricPrecision, opacity and mask-image, and lowers to WGSL", () => {
    const precise = scene("outline: 0.05 solid red;", "scene { shape-rendering: geometricPrecision; }");
    expect(fn(precise, "PrecisionHit marchPrecision(vec3 ro, vec3 rd) {")).toContain("lineLastM");
    expect(scene("outline: 0.05 solid red; opacity: 0.5;")).toContain("float outlineT = lineT;");
    expect(scene("outline: 0.05 solid red; mask-image: linear-gradient(black, transparent);")).toContain("float outlineT = lineT;");
    expect(compileScene("@scene { sphere; } sphere { outline: 0.05 solid red; }").wgsl).toContain("outlineColor");
  });

  it("refuses a negative width, and too many values", () => {
    expect(() => scene("outline-width: -1; outline-style: solid;")).toThrow(/outline-width/);
    expect(() => scene("outline: 0.05 solid red 2;")).toThrow(/outline expects/);
  });
});

describe("outline-style: the styles of CSS", () => {
  const styleOf = (shader: string) => fn(shader, "float outlineStyle(float id) {");

  it("keeps solid and auto plain, with no code for the styles", () => {
    expect(scene("outline: 0.05 solid red;")).not.toContain("outlineStyle");
    expect(scene("outline: 0.05 auto red;")).toBe(scene("outline: 0.05 solid red;"));
  });

  it("numbers each style for main(): dashed, dotted, double, groove, ridge, inset, outset", () => {
    const styles = ["dashed", "dotted", "double", "groove", "ridge", "inset", "outset"];
    styles.forEach((style, i) => {
      const shader = scene(`outline: 0.05 ${style} red;`);
      expect(styleOf(shader)).toContain(`if (id == 1.0) return ${i + 1}.0;`);
      expect(shader).toContain("float outlineAcross = lineM;");
    });
  });

  it("places dashes and dots by the angle around the object, as many as fit around it", () => {
    const shader = scene("outline: 0.05 dashed red;");
    expect(fn(shader, "vec4 outlineCenter(float id) {")).toContain("if (id == 1.0) return vec4(vec3(0.0, 1.0, 0.0), ");
    expect(shader).toContain("atan(around.y, around.x)");
  });

  it("takes the style of :hover when the object has none at rest", () => {
    expect(styleOf(scene("outline: 0 none red; transition: 0.2s;", "sphere:hover { outline: 0.05 dotted red; }"))).toContain("return 2.0;");
  });

  it("refuses what is not a style of CSS", () => {
    expect(() => scene("outline: 0.05 wavy red;")).toThrow(/outline expects/);
    expect(() => scene("outline-style: wavy;")).toThrow(/outline-style expects/);
  });
});
