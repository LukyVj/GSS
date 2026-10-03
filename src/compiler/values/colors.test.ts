import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { resolveColors, resolveNamedColors } from "./colors";
import { compileGSS, compileScene } from "..";

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

  it("rejects an alpha where a color must be opaque", () => {
    expect(() => resolve("rgb(255 0 0 / 50%)")).toThrow(
      "Only color, background and mask-image take a transparent color",
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
      "Only color, background and mask-image take a transparent color",
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

describe("the color functions of decision 79", () => {
  const hex = (source: string) => resolve(source).map((t) => `#${(t as { value: string }).value}`).join(" ");

  it("hwb(): whiteness and blackness, and a gray when they reach 100%", () => {
    expect(hex("hwb(120 20% 20%)")).toBe("#33cc33");
    expect(hex("hwb(0 60% 60%)")).toBe("#808080");
  });

  it("lab(), lch(), oklab() and oklch() give back sRGB red", () => {
    expect(hex("lab(54.29 80.82 69.91)")).toBe("#ff0000");
    expect(hex("lch(54.29 106.84 40.85)")).toBe("#ff0000");
    expect(hex("oklab(0.628 0.2249 0.1258)")).toBe("#ff0000");
    expect(hex("oklch(62.8% 0.2577 29.23)")).toBe("#ff0000");
    expect(hex("oklch(62.8% 64.4% 29.23deg)")).toBe("#ff0000"); // 100% of chroma is 0.4
  });

  it("clips a color outside sRGB", () => {
    expect(hex("oklch(70% 0.4 145)")).toMatch(/^#00[0-9a-f]{2}00$/); // red and blue below 0
    expect(hex("color(display-p3 1 0 0)")).toBe("#ff0000");
  });

  it("color(): srgb, srgb-linear, display-p3 and xyz", () => {
    expect(hex("color(srgb 1 0.5 0)")).toBe("#ff8000");
    expect(hex("color(srgb-linear 50% 50% 50%)")).toBe("#bcbcbc");
    expect(hex("color(display-p3 0.9175 0.2003 0.1387)")).toBe("#ff0000");
    expect(hex("color(xyz 0.9505 1 1.089)")).toBe("#ffffff");
  });

  it("color-mix(): 50% each by default, in the space it names", () => {
    expect(hex("color-mix(in srgb, red, blue)")).toBe("#800080");
    expect(hex("color-mix(in srgb-linear, white, black)")).toBe("#bcbcbc");
    expect(hex("color-mix(in srgb, red 25%, blue)")).toBe(hex("color-mix(in srgb, blue 75%, red)"));
    expect(hex("color-mix(in oklab, #ff0000 100%, blue)")).toBe("#ff0000");
  });

  it("color-mix(): the hue takes the shorter way round, or the longer one", () => {
    expect(hex("color-mix(in hsl, red 25%, blue)")).toBe("#8000ff");
    expect(hex("color-mix(in hsl longer hue, red 25%, blue)")).toBe("#00ffff");
  });

  it("color-mix(): a gray takes the hue of the other color", () => {
    expect(hex("color-mix(in oklch, white 0%, blue)")).toBe("#0000ff");
    expect(hex("color-mix(in hsl, white, red)")).toBe(hex("hsl(0 50% 75%)"));
  });

  it("color-mix(): mixes color functions, names and percentages that add up past 100%", () => {
    expect(hex("color-mix(in srgb, rgb(255 0 0) 60%, hsl(240 100% 50%) 60%)")).toBe("#800080");
    expect(hex("color-mix(in oklch, tomato, #3a7bff)")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("contrast-color(): white or black, whichever contrasts most", () => {
    expect(hex("contrast-color(navy)")).toBe("#ffffff");
    expect(hex("contrast-color(#ffd700)")).toBe("#000000");
    expect(hex("contrast-color(color-mix(in srgb, white 90%, black))")).toBe("#000000");
  });

  it("light-dark(): the first color in light mode, the second in dark mode", () => {
    expect(hex("light-dark(white, #111)")).toBe("#ffffff");
    expect(resolveColors(tokenize("light-dark(white, #111)"), "dark")).toEqual(tokenize("#111111"));
  });

  it("says what is wrong", () => {
    expect(() => resolve("color-mix(red, blue)")).toThrow('color-mix() starts with "in" and a color space');
    expect(() => resolve("color-mix(in srgb, red 20%, blue 20%)")).toThrow("Only color, background and mask-image take a transparent color");
    expect(() => resolve("color-mix(in srgb longer hue, red, blue)")).toThrow("in a space with a hue");
    expect(() => resolve("color-mix(in srgb, red, 2)")).toThrow("color-mix() expects colors");
    expect(() => resolve("color(rec2020 1 0 0)")).toThrow("color() starts with a color space");
    expect(() => resolve("oklch(70% 0.1 30 / 0.5)")).toThrow("Only color, background and mask-image take a transparent color");
    expect(() => resolve("lab(50 red 10)")).toThrow("lab() expects numbers or percentages");
    expect(() => resolve("light-dark(white)")).toThrow("light-dark() takes two colors");
  });
});

describe("light-dark() in a scene", () => {
  it("compiles a version per color scheme, like @media (prefers-color-scheme: dark)", () => {
    const scene = compileScene("@scene { sphere } scene { background: light-dark(#ffffff, #000000); }");
    expect(scene.media?.queries).toEqual(["(prefers-color-scheme: dark)"]);
    expect(scene.media?.variants[0].shader).toContain("vec3(1.0, 1.0, 1.0)");
    expect(scene.media?.variants[1].shader).toContain("vec3(0.0, 0.0, 0.0)");
  });

  it("shares the query with an @media of the same scheme", () => {
    const scene = compileScene(
      "@scene { sphere } sphere { color: light-dark(red, blue); } @media (prefers-color-scheme: dark) { sphere { radius: 0.4; } }",
    );
    expect(scene.media?.queries).toEqual(["(prefers-color-scheme: dark)"]);
  });

  it("changes nothing for a scene without it", () => {
    expect(compileScene("@scene { sphere }").media).toBeUndefined();
  });
});
