import { describe, it, expect } from "vitest";
import { compileScene } from "../index";

const shader = (source: string) => compileScene(source).shader;
const cube = (rules: string) => shader(`@scene { cube; } cube { ${rules} }`);

describe("currentColor", () => {
  it("is the object's own color inside a color function", () => {
    expect(
      cube("color: #ff5a36; material: metal(color-mix(in srgb, currentColor 50%, white), 0.2);"),
    ).toBe(cube("color: #ff5a36; material: metal(color-mix(in srgb, #ff5a36 50%, white), 0.2);"));
  });

  it("is case-insensitive, like CSS", () => {
    const expected = cube("color: tomato; material: metal(color-mix(in oklab, tomato, black));");
    expect(cube("color: tomato; material: metal(color-mix(in oklab, currentcolor, black));")).toBe(
      expected,
    );
    expect(cube("color: tomato; material: metal(color-mix(in oklab, CURRENTCOLOR, black));")).toBe(
      expected,
    );
  });

  it("as a material's color, is the same as leaving the color out: color stays animated", () => {
    const rest = "color: #ff5a36; animation: glow 2s alternate;";
    const frames = "@keyframes glow { to { color: #3a7bff; } }";
    expect(shader(`@scene { cube; } cube { ${rest} material: metal(currentColor, 0.2); } ${frames}`)).toBe(
      shader(`@scene { cube; } cube { ${rest} material: metal(0.2); } ${frames}`),
    );
    expect(cube("color: #ff5a36; material: jelly(currentColor);")).toBe(
      cube("color: #ff5a36; material: jelly();"),
    );
  });

  it("follows the color of :hover through the material", () => {
    const hover = "cube:hover { color: #3a7bff; }";
    expect(
      shader(`@scene { cube; } cube { color: #ff5a36; material: metal(currentColor); } ${hover}`),
    ).toBe(shader(`@scene { cube; } cube { color: #ff5a36; material: metal(); } ${hover}`));
  });

  it("is the default color when the object sets none", () => {
    expect(cube("material: metal(color-mix(in srgb, currentColor, black));")).toBe(
      cube("material: metal(color-mix(in srgb, #e6e6e6, black));"),
    );
  });

  it("goes in a gradient's stops", () => {
    expect(cube("color: red; material: metal(linear-gradient(currentColor, blue));")).toBe(
      cube("color: red; material: metal(linear-gradient(red, blue));"),
    );
  });

  it("is read where the variable is used, with that object's color", () => {
    const expected = shader(
      "@scene { group#g { cube#a; cube#b; } } #a { color: red; material: metal(color-mix(in srgb, red, white)); } #b { color: blue; material: metal(color-mix(in srgb, blue, white)); }",
    );
    expect(
      shader(
        "@scene { group#g { cube#a; cube#b; } } #g { --tint: color-mix(in srgb, currentColor, white); } #a { color: red; } #b { color: blue; } cube { material: metal(var(--tint)); }",
      ),
    ).toBe(expected);
  });

  it("uses the computed color: var(), calc() and color functions", () => {
    expect(
      shader(
        "@scene { cube * 2; } cube { color: hsl(calc(sibling-index() * 90) 80% 50%); material: metal(color-mix(in srgb, currentColor, white)); }",
      ),
    ).toBe(
      shader(
        "@scene { cube * 2; } cube { --c: hsl(calc(sibling-index() * 90) 80% 50%); color: var(--c); material: metal(color-mix(in srgb, var(--c), white)); }",
      ),
    );
  });

  it("refuses color: currentColor, which would refer to itself", () => {
    expect(() => cube("color: currentColor;")).toThrow(/currentColor.*itself/);
    expect(() => cube("color: color-mix(in srgb, currentColor, red);")).toThrow(/itself/);
    expect(() => cube("--c: currentColor; color: var(--c);")).toThrow(/itself/);
    expect(() =>
      shader("@scene { cube; } cube { animation: a 1s; } @keyframes a { to { color: currentColor; } }"),
    ).toThrow(/itself/);
  });

  it("refuses the scene, which has no color", () => {
    expect(() => shader("@scene { cube; } scene { floor: currentColor; }")).toThrow(
      /scene has no color/,
    );
  });

  it("cannot mix a gradient", () => {
    expect(() =>
      cube("color: linear-gradient(red, blue); material: metal(color-mix(in srgb, currentColor, white));"),
    ).toThrow(/gradient/);
    // the material's own color can still be the gradient
    expect(cube("color: linear-gradient(red, blue); material: metal(currentColor);")).toBe(
      cube("color: linear-gradient(red, blue); material: metal();"),
    );
  });
});
