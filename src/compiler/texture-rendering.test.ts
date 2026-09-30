import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import { readRendering } from "./textures";
import { compileGSS } from "./index";

const dirt = 'texture: url("dirt.png")';

// Step 4: image-rendering, per object like in CSS. The texture stays smooth (LINEAR)
// on the GPU; for a pixelated object, triplanar() reads the center of the nearest
// pixel, which gives exactly that pixel: the NEAREST look, without a second texture.
describe("readRendering", () => {
  it("is pixelated for pixelated and crisp-edges", () => {
    expect(readRendering(tokenize("pixelated"))).toBe(true);
    expect(readRendering(tokenize("crisp-edges"))).toBe(true);
  });

  it("is smooth for auto and smooth, and when the property is not set", () => {
    expect(readRendering(tokenize("auto"))).toBe(false);
    expect(readRendering(tokenize("smooth"))).toBe(false);
    expect(readRendering(undefined)).toBe(false);
  });

  it("explains an unknown value", () => {
    expect(() => readRendering(tokenize("blurry"))).toThrow(
      /auto, smooth, pixelated or crisp-edges/,
    );
    expect(() => readRendering(tokenize("pixelated smooth"))).toThrow(
      /auto, smooth, pixelated or crisp-edges/,
    );
  });
});

describe("image-rendering in the shader", () => {
  it("lets triplanar() snap uv to the center of the nearest pixel", () => {
    const shader = compileGSS(`@scene { cube; } cube { ${dirt}; }`);
    expect(shader).toContain(
      "vec3 triplanar(sampler2D image, vec3 q, vec3 n, vec3 box, vec3 color, bool pixelated)",
    );
    expect(shader).toContain("vec2 size = vec2(textureSize(image, 0));");
    expect(shader).toContain("floor(st * size) + 0.5) / size");
  });

  it("passes true for a pixelated object, false otherwise", () => {
    const shader = compileGSS(`
      @scene { cube#a; cube#b; }
      #a { ${dirt}; image-rendering: pixelated; }
      #b { ${dirt}; }`);
    expect(shader).toContain("vec3(1.0, 1.0, 1.0), color, true);");
    expect(shader).toContain("vec3(1.0, 1.0, 1.0), color, false);");
    // one image, one texture: the rendering is chosen per object, in the shader
    expect(shader).not.toContain("uTexture1");
  });

  it("is an error on a wrong value, even without a texture", () => {
    expect(() =>
      compileGSS("@scene { cube; } cube { image-rendering: blurry; }"),
    ).toThrow(/image-rendering/);
  });
});
