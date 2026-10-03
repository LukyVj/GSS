import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

const scene = (background: string, more = "") =>
  compileGSS(`@scene { sphere; } sphere { translate: 0 1 0; } scene { background: ${background}; ${more} }`);

describe("background: layers, like CSS", () => {
  it("keeps a background of one layer as it was", () => {
    const shader = scene("linear-gradient(#102040, #3a7bff)");
    expect(shader).toContain("vec3 background(vec3 rd)");
    expect(shader).not.toContain("backgroundLayer");
    expect(scene("#102040")).toContain("const vec3 BACKGROUND = vec3(0.063, 0.125, 0.251);");
  });

  it("draws each layer in its own function, the first on top, over the last when it is a color", () => {
    const shader = scene("noise(3 2, #000000, #ffffff), linear-gradient(#102040, #3a7bff), #000000");
    expect(shader).toContain("vec4 backgroundLayer0(vec3 rd, vec2 at, vec2 size)");
    expect(shader).toContain("vec4 backgroundLayer1(vec3 rd, vec2 at, vec2 size)");
    expect(shader).toContain("vec3 col = vec3(0.0, 0.0, 0.0);"); // the last layer, a color: the base
    // From the bottom up: layer 1, then layer 0
    expect(shader.indexOf("backgroundLayer1(rd, at, size)")).toBeLessThan(shader.indexOf("backgroundLayer0(rd, at, size)"));
  });

  it("puts the layers over the default background when the last one is an image", () => {
    expect(scene("linear-gradient(#ff000080, #0000ff80), noise(2, #000000, #ffffff)")).toContain("vec3 col = vec3(0.03);");
  });
});

describe("background: transparent colors, in its layers only", () => {
  it("reads transparent, #rrggbbaa, an alpha after / and color-mix() under 100%", () => {
    for (const color of ["transparent", "#ff000080", "#f008", "rgb(255 0 0 / 50%)", "hsl(0 100% 50% / 0.5)", "oklch(60% 0.2 30 / 40%)", "color-mix(in srgb, red 30%, blue 20%)"])
      expect(() => scene(`linear-gradient(${color}, #3a7bff), #000000`), color).not.toThrow();
  });

  it("mixes the stops of a gradient with their alpha, premultiplied like CSS", () => {
    const shader = scene("linear-gradient(transparent, #ff0000), #000000");
    expect(shader).toContain("vec4 col = vec4(0.0, 0.0, 0.0, 0.0);");
    expect(shader).toContain("vec4(1.0, 0.0, 0.0, 1.0)");
  });

  it("is an error where a color must be opaque", () => {
    expect(() => compileGSS("@scene { sphere; } scene { floor: rgb(255 0 0 / 50%); }")).toThrow(
      "Only color, background and mask-image take a transparent color",
    );
    expect(() => compileGSS("@scene { sphere; } sphere { material: metal(linear-gradient(transparent, red)); }")).toThrow(
      "Only color, background and mask-image take a transparent color",
    );
  });
});

describe("background-blend-mode", () => {
  it("blends each layer with what is below it, with the modes of CSS", () => {
    const shader = scene("linear-gradient(#808080, #808080), #ff0000", "background-blend-mode: multiply;");
    expect(shader).toContain("vec3 blendMultiply(vec3 b, vec3 s)");
    expect(shader).toContain("blendMultiply(col, ");
  });

  it("repeats its list over the layers, like CSS", () => {
    const shader = scene(
      "noise(2, #000000, #ffffff), noise(3, #000000, #ffffff), noise(4, #000000, #ffffff)",
      "background-blend-mode: screen, multiply;",
    );
    expect(shader).toContain("vec4 layer0 = backgroundLayer0(rd, at, size);");
    expect(shader).toContain("col = mix(col, blendScreen(col, unpremultiply(layer0)), layer0.a);");
    expect(shader).toContain("col = mix(col, blendMultiply(col, unpremultiply(layer1)), layer1.a);");
    expect(shader).toContain("col = mix(col, blendScreen(col, unpremultiply(layer2)), layer2.a);");
  });

  it("takes every mode of CSS", () => {
    const modes = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
    for (const mode of modes)
      expect(() => scene("noise(2, #000000, #ffffff), #3a7bff", `background-blend-mode: ${mode};`), mode).not.toThrow();
  });
});

describe("background layers: moving and errors", () => {
  it("moves each layer like a gradient", () => {
    const shader = compileGSS(
      "@scene { sphere; } scene { background: noise(2 4, #ffffff00 40%, #ffffff 75%), linear-gradient(#2f6bd8, #9fc4ff); animation: wind 20s linear infinite; } @keyframes wind { to { background: noise(2 4 at 1 0 0, #ffffff00 40%, #ffffff 75%), linear-gradient(#2f6bd8, #9fc4ff); } }",
    );
    expect(shader).toContain("iTime");
    expect(shader).toContain("vec4 backgroundLayer0(");
  });

  it("says what is wrong", () => {
    expect(() => scene("#ff0000, linear-gradient(#000000, #ffffff)")).toThrow("only the last layer of background can be a color");
    expect(() => scene("noise(2, #000000, #ffffff), #3a7bff", "background-blend-mode: glow;")).toThrow("background-blend-mode expects");
    expect(() =>
      compileGSS(
        "@scene { sphere; } scene { background: noise(2, #000000, #ffffff), #3a7bff; animation: a 2s; } @keyframes a { to { background: noise(2, #000000, #ffffff), noise(3, #000000, #ffffff), #3a7bff; } }",
      ),
    ).toThrow("a background keeps its number of layers when it changes");
  });

  it("is lowered to WGSL", () => {
    expect(
      compileGSS("@scene { sphere; } scene { background: noise(2, #00000000, #ffffff), #3a7bff; background-blend-mode: soft-light; }", "wgsl"),
    ).toContain("g_backgroundLayer0");
  });
});
