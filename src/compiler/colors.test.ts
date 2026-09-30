import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import { resolveColors, resolveNamedColors } from "./colors";
import { compileGSS } from ".";

const resolve = (source: string) => resolveColors(tokenize(source));

describe("rgb()", () => {
  it("turns rgb() into a hex color", () => {
    expect(resolve("rgb(255 90 54)")).toEqual(tokenize("#ff5a36"));
  });

  it("accepts the old syntax with commas", () => {
    expect(resolve("rgb(255, 90, 54)")).toEqual(tokenize("#ff5a36"));
  });

  it("accepts rgba() without alpha, like CSS", () => {
    expect(resolve("rgba(255 90 54)")).toEqual(tokenize("#ff5a36"));
  });

  it("reads percentages: 100% is 255", () => {
    expect(resolve("rgb(100% 0% 50%)")).toEqual(tokenize("#ff0080"));
  });

  it("clamps the channels between 0 and 255, like CSS", () => {
    expect(resolve("rgb(300 -10 0)")).toEqual(tokenize("#ff0000"));
  });

  it("works inside another function", () => {
    expect(resolve("metal(rgb(255 255 255), 0.2)")).toEqual(
      tokenize("metal(#ffffff, 0.2)"),
    );
  });

  it("rejects an alpha: GSS has no transparency", () => {
    expect(() => resolve("rgb(255 0 0 / 50%)")).toThrow(
      "GSS has no transparency yet",
    );
  });

  it("rejects a wrong number of channels", () => {
    expect(() => resolve("rgb(255 0)")).toThrow(
      "rgb() expects three channels, like: rgb(255 90 54)",
    );
  });

  it("returns the same array when there is no color function", () => {
    const value = tokenize("0 1 0");
    expect(resolveColors(value)).toBe(value);
  });

  it("leaves a lone rgb keyword alone", () => {
    const value = tokenize("rgb");
    expect(resolveColors(value)).toBe(value);
  });
});

describe("hsl()", () => {
  it("turns hsl() into a hex color", () => {
    expect(resolve("hsl(0 100% 50%)")).toEqual(tokenize("#ff0000"));
    expect(resolve("hsl(120deg 100% 50%)")).toEqual(tokenize("#00ff00"));
  });

  it("accepts the old syntax with commas, and hsla()", () => {
    expect(resolve("hsl(240, 100%, 50%)")).toEqual(tokenize("#0000ff"));
    expect(resolve("hsla(30 100% 50%)")).toEqual(tokenize("#ff8000"));
  });

  it("reads the hue in turn, and goes round the circle", () => {
    expect(resolve("hsl(0.5turn 100% 50%)")).toEqual(tokenize("#00ffff"));
    expect(resolve("hsl(-120 100% 50%)")).toEqual(tokenize("#0000ff")); // -120 = 240
  });

  it("gives a gray without saturation", () => {
    expect(resolve("hsl(0 0% 50%)")).toEqual(tokenize("#808080"));
  });

  it("rejects an alpha and a wrong number of values", () => {
    expect(() => resolve("hsl(0 100% 50% / 0.5)")).toThrow(
      "GSS has no transparency yet",
    );
    expect(() => resolve("hsl(0 100%)")).toThrow(
      "hsl() expects three channels, like: hsl(20 100% 60%)",
    );
  });

  it("rejects a hue that is not an angle", () => {
    expect(() => resolve("hsl(50% 100% 50%)")).toThrow(
      "hsl() expects a hue in deg, rad, turn or a number",
    );
  });

  it("rejects a saturation or a lightness that is not a percentage or a number", () => {
    expect(() => resolve("hsl(0 red 50%)")).toThrow(
      "hsl() expects percentages for the saturation and the lightness",
    );
    expect(resolve("hsl(0 100 50)")).toEqual(tokenize("#ff0000"));
  });
});

describe("named colors", () => {
  const named = (property: string, source: string) =>
    resolveNamedColors(property, tokenize(source));

  it("turns a name into a hex color where a color is expected", () => {
    expect(named("color", "tomato")).toEqual(tokenize("#ff6347"));
    expect(named("floor", "navy")).toEqual(tokenize("#000080"));
    expect(named("background", "black")).toEqual(tokenize("#000000"));
  });

  it("ignores the case, like CSS", () => {
    expect(named("color", "Tomato")).toEqual(tokenize("#ff6347"));
  });

  it("keeps material: gold as the material", () => {
    expect(named("material", "gold")).toEqual(tokenize("gold"));
  });

  it("reads a name as the first argument of a material", () => {
    expect(named("material", "metal(tomato, 0.2)")).toEqual(
      tokenize("metal(#ff6347, 0.2)"),
    );
    expect(named("material", "glass(lightblue)")).toEqual(
      tokenize("glass(#add8e6)"),
    );
  });

  it("leaves the other properties alone", () => {
    expect(named("animation", "red 2s")).toEqual(tokenize("red 2s")); // an animation called red
  });

  it("leaves an unknown name alone: readColor will report it", () => {
    expect(named("color", "tomatoe")).toEqual(tokenize("tomatoe"));
  });
});

describe("colors", () => {
  it("reads rgb(), hsl() and names on objects and on the scene", () => {
    const shader = compileGSS(
      "@scene { sphere } scene { background: navy; } sphere { color: rgb(255 0 0); }",
    );
    expect(shader).toContain("vec3(1.0, 0.0, 0.0)");
    expect(shader).toContain("vec3(0.0, 0.0, 0.502)"); // navy = #000080, 128 / 255
  });

  it("computes a color per object with sibling-index() and var()", () => {
    const shader = compileGSS(
      "@scene { sphere * 2 } sphere { --s: 100%; color: hsl(calc(sibling-index() * 120) var(--s) 50%); }",
    );
    expect(shader).toContain("vec3(0.0, 1.0, 0.0)"); // 120° = green
    expect(shader).toContain("vec3(0.0, 0.0, 1.0)"); // 240° = blue
  });

  it("keeps material: gold as the material", () => {
    expect(
      compileGSS("@scene { sphere } sphere { material: gold; }"),
    ).toContain("metal");
  });

  it("animates to a named color", () => {
    expect(
      compileGSS(
        "@scene { sphere } sphere { color: red; animation: a 2s; } @keyframes a { to { color: blue; } }",
      ),
    ).toContain("vec3(0.0, 0.0, 1.0)");
  });
});
