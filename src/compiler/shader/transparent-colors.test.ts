import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

const scene = (rule: string, more = "") => compileGSS(`@scene { sphere; } sphere { translate: 0 1 0; ${rule} } ${more}`);
const alphaOf = (shader: string) => shader.slice(shader.indexOf("float surfaceAlpha("), shader.indexOf("}\n", shader.indexOf("float surfaceAlpha(")));

describe("transparent colors on objects, like CSS", () => {
  it("covers what is behind an object as much as the alpha of its color", () => {
    for (const color of ["#ff000080", "rgb(255 0 0 / 50%)", "hsl(0 100% 50% / 0.5)", "color-mix(in srgb, red 25%, blue 25%)"]) {
      const shader = scene(`color: ${color};`);
      expect(alphaOf(shader), color).toContain("if (id == 1.0) return 0.502;  // sphere");
    }
    // The color itself is the color without its alpha
    expect(scene("color: #ff000080;")).toContain("if (id == 1.0) return matte(vec3(1.0, 0.0, 0.0));");
  });

  it("hides an object whose color is transparent", () => {
    expect(alphaOf(scene("color: transparent;"))).toContain("if (id == 1.0) return 0.0;  // sphere");
  });

  it("moves the alpha with the color", () => {
    const alpha = alphaOf(scene("color: #ff000080; animation: a 2s;", "@keyframes a { to { color: #ff0000; } }"));
    expect(alpha).toContain("mix(0.502, 1.0, ");
    expect(alpha).toContain("iTime / 2.0");
  });

  it("reads the transparent stops of a gradient at each point", () => {
    const shader = scene("color: linear-gradient(transparent, #ff0000);");
    expect(alphaOf(shader)).toContain("return paintAlpha(id, p);  // sphere");
    expect(shader).toContain("float paintAlpha(float id, vec3 p) {");
    // The color of the gradient without its alpha: the stops are premultiplied
    expect(shader).toContain("return col.a > 0.0 ? col.rgb / col.a : col.rgb;");
  });

  it("multiplies opacity, the alpha of the color and opacity() in filter", () => {
    // 0.4 × 0.502 × 0.5
    expect(alphaOf(scene("opacity: 0.4; color: #ff000080; filter: opacity(0.5);"))).toContain("return 0.1;  // sphere");
    const group = compileGSS("@scene { group#g { sphere; } } #g { filter: opacity(50%); }");
    expect(alphaOf(group)).toContain("return 0.5;  // sphere");
  });

  it("is lowered to WGSL", () => {
    expect(() => compileGSS("@scene { sphere; } sphere { color: linear-gradient(transparent, red); filter: opacity(0.8); }", "wgsl")).not.toThrow();
  });
});

describe("transparent colors: where they go", () => {
  it("leaves the floor, the fog, the lights and the materials opaque", () => {
    expect(() => compileGSS("@scene { sphere; } scene { floor: rgb(0 0 0 / 50%); }")).toThrow(
      "Only color, background and mask-image take a transparent color",
    );
    expect(() => compileGSS("@scene { light; sphere; } light { color: #ffd27a80; }")).toThrow("A light takes an opaque color");
    expect(() => scene("material: metal(#ff000080, 0.2);")).toThrow("A material takes an opaque color");
  });

  it("keeps the scene opaque: opacity() goes on objects and groups", () => {
    expect(() => compileGSS("@scene { sphere; } scene { filter: opacity(0.5); }")).toThrow("opacity() goes on objects and groups");
  });
});
