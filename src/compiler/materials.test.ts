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
});
