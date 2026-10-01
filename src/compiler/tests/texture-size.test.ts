import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

// Step 6a of the textures: texture-size, like background-size. By default one
// image covers one face; texture-size sets the size of one image on the surface,
// in the object's units, and the image repeats (fract() in triplanar).
const dirt = 'texture: url("dirt.png")';

describe("texture-size", () => {
  it("sets the size of one image, instead of the size of the object", () => {
    const shader = compileGSS(
      `@scene { cube; } cube { size: 4 0.2 4; ${dirt}; texture-size: 0.5; }`,
    );
    expect(shader).toContain("vec3(0.5, 0.5, 0.5), color, false);");
    expect(shader).not.toContain("vec3(4.0, 0.2, 4.0), color");
  });

  it("works on every shape, not only the cube", () => {
    expect(
      compileGSS(`@scene { sphere; } sphere { radius: 2; ${dirt}; texture-size: 1; }`),
    ).toContain("vec3(1.0, 1.0, 1.0), color, false);");
  });

  it("repeats the image: triplanar() wraps st between 0 and 1", () => {
    expect(compileGSS(`@scene { cube; } cube { ${dirt}; }`)).toContain(
      "vec2 st = fract(uv + 0.5);",
    );
  });

  it("expects one positive number", () => {
    for (const value of ["0", "-1", "1 2", "big"]) {
      expect(
        () => compileGSS(`@scene { cube; } cube { ${dirt}; texture-size: ${value}; }`),
        value,
      ).toThrow(/texture-size expects one positive number/);
    }
  });
});
