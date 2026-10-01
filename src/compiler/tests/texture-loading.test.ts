import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "../index";

const dirt = 'texture: url("dirt.png")';

// Step 3: until its image is loaded, a texture is one transparent pixel.
// The image is painted over the color, like background-image over background-color:
// where the image is transparent (or not loaded yet), the object keeps its color.
describe("an image over the color", () => {
  it("lets triplanar() mix the color and the image by its alpha", () => {
    const shader = compileGSS(`@scene { cube; } cube { ${dirt}; }`);
    expect(shader).toContain(
      "vec3 triplanar(sampler2D image, vec3 q, vec3 n, vec3 box, vec3 color, bool pixelated)",
    );
    expect(shader).toContain("return mix(color, ");
  });

  it("passes the object's color to triplanar()", () => {
    const shader = compileGSS(`@scene { cube; } cube { ${dirt}; }`);
    expect(shader).toContain(", vec3(1.0, 1.0, 1.0), color, false);");
  });
});

// WebGL2 guarantees 16 texture units: beyond, some GPUs could not draw the scene
describe("the number of images", () => {
  // n cubes, each with its own image: #c0 { texture: url("0.png"); } …
  const scene = (n: number) => {
    const ids = Array.from({ length: n }, (_, i) => `c${i}`);
    return (
      `@scene { ${ids.map((id) => `cube#${id}`).join("; ")} } ` +
      ids.map((id, i) => `#${id} { texture: url("${i}.png"); }`).join(" ")
    );
  };

  it("goes up to 16 in a scene", () => {
    expect(compileScene(scene(16)).textures).toHaveLength(16);
  });

  it("is an error beyond 16, on the first image too many", () => {
    expect(() => compileScene(scene(17))).toThrow(/at most 16 images/);
  });

  it("counts an image once, however many objects use it", () => {
    expect(
      compileScene(`@scene { cube * 40; } cube { ${dirt}; }`).textures,
    ).toEqual(["dirt.png"]);
  });
});
