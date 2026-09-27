import { describe, it, expect } from "vitest";
import { compileGSS } from "./index";

// The getMaterial() line of the first object
function materialOf(css: string): string {
  const shader = compileGSS(`@scene { sphere; } ${css}`);
  return shader
    .split("\n")
    .find((line) => line.includes("if (id == 1.0)"))!
    .trim();
}

describe("material: matte()", () => {
  it("takes the color of color when it has none", () => {
    expect(materialOf("sphere { color: #ff0000; material: matte(); }")).toBe(
      "if (id == 1.0) return matte(vec3(1.0, 0.0, 0.0));  // sphere",
    );
  });

  it("uses its own color first", () => {
    expect(
      materialOf("sphere { color: #ff0000; material: matte(#0000ff); }"),
    ).toBe("if (id == 1.0) return matte(vec3(0.0, 0.0, 1.0));  // sphere");
  });

  it("lists the available materials for an unknown name", () => {
    expect(() =>
      compileGSS("@scene { sphere; } sphere { material: wood(); }"),
    ).toThrow('Unknown material "wood". Available: matte()');
  });

  describe("material: the shader", () => {
    it("knows the metal material", () => {
      const shader = compileGSS("@scene { sphere; }");
      expect(shader).toContain("Material metal(vec3 color, float roughness)");
    });
  });
});

describe("material: metal()", () => {
  it("writes the color and the roughness", () => {
    expect(materialOf("sphere { material: metal(#ffffff, 0.5); }")).toBe(
      "if (id == 1.0) return metal(vec3(1.0, 1.0, 1.0), 0.5);  // sphere",
    );
  });

  it("uses the color of color when it has none", () => {
    expect(materialOf("sphere { color: #ff0000; material: metal(0.5); }")).toBe(
      "if (id == 1.0) return metal(vec3(1.0, 0.0, 0.0), 0.5);  // sphere",
    );
  });

  it("has a default roughness of 0.2", () => {
    expect(materialOf("sphere { color: #ff0000; material: metal(); }")).toBe(
      "if (id == 1.0) return metal(vec3(1.0, 0.0, 0.0), 0.2);  // sphere",
    );
  });

  it("rejects a roughness outside [0, 1]", () => {
    expect(() =>
      compileGSS("@scene { sphere; } sphere { material: metal(1.5); }"),
    ).toThrow("roughness expects a number between 0 and 1");
  });

  it("rejects too many arguments", () => {
    expect(() =>
      compileGSS(
        "@scene { sphere; } sphere { material: metal(#fff, 0.2, 3); }",
      ),
    ).toThrow("metal() expects an optional color and a roughness");
  });
});

describe("material keywords", () => {
  it("gold is metal(#d4af37, 0.2)", () => {
    expect(materialOf("sphere { material: gold; }")).toBe(
      materialOf("sphere { material: metal(#d4af37, 0.2); }"),
    );
  });

  it("chrome is metal(#ffffff, 0.05)", () => {
    expect(materialOf("sphere { material: chrome; }")).toBe(
      materialOf("sphere { material: metal(#ffffff, 0.05); }"),
    );
  });

  it("lists every material for an unknown keyword", () => {
    expect(() =>
      compileGSS("@scene { sphere; } sphere { material: wood; }"),
    ).toThrow(
      'Unknown material "wood". Available: matte(), metal(), gold, chrome',
    );
  });

  describe("material: metal lighting", () => {
    it("has the functions that light a metal", () => {
      const shader = compileGSS("@scene { sphere; }");
      expect(shader).toContain("vec3 fresnel(vec3 f0, vec3 rd, vec3 n)");
      expect(shader).toContain(
        "vec3 shadeMetal(vec3 p, vec3 n, vec3 rd, Material m)",
      );
    });
  });

  it("lights metals with shadeMetal in main()", () => {
    expect(compileGSS("@scene { sphere; }")).toContain(
      "if (m.kind == METAL) col = shadeMetal(p, n, rd, m);",
    );
  });
});
