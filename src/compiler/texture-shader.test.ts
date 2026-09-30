import { describe, it, expect } from "vitest";
import { compileGSS } from "./index";

const dirt = 'texture: url("dirt.png")';

// The text of one generated GLSL function, from its signature to its closing brace
function glslFunction(shader: string, signature: string): string {
  const start = shader.indexOf(signature);
  if (start === -1) return "";
  return shader.slice(start, shader.indexOf("\n}", start) + 2);
}

describe("textures in the shader", () => {
  it("add nothing to a scene without texture", () => {
    const shader = compileGSS("@scene { cube; }");
    expect(shader).not.toContain("sampler2D");
    expect(shader).not.toContain("textureColor");
    expect(shader).not.toContain("triplanar");
  });

  it("give each image one sampler2D uniform, in the order of scene.textures", () => {
    const shader = compileGSS(`
      @scene { cube#a; cube#b; sphere; }
      #a, #b { ${dirt}; }
      sphere { texture: url("stone.png"); }`);
    expect(shader).toContain("uniform sampler2D uTexture0; // dirt.png");
    expect(shader).toContain("uniform sampler2D uTexture1; // stone.png");
    expect(shader).not.toContain("uTexture2");
  });

  it("let main() replace the base color of the material", () => {
    expect(compileGSS(`@scene { cube; } cube { ${dirt}; }`)).toContain(
      "m.color = textureColor(id, p, n, m.color);",
    );
  });

  it("pick the image of each object by its id; the others keep their color", () => {
    const shader = compileGSS(`
      @scene { cube; sphere; torus; }
      sphere { ${dirt}; }
      torus { texture: url("stone.png"); }`);
    const textureColor = glslFunction(shader, "vec3 textureColor(");
    expect(textureColor).toContain(
      "if (id == 2.0) return triplanar(uTexture0, ",
    );
    expect(textureColor).toContain(
      "if (id == 3.0) return triplanar(uTexture1, ",
    );
    expect(textureColor).not.toContain("id == 1.0");
    expect(textureColor).toContain("return color;");
  });

  it("move the point into the object's space, groups first, like map()", () => {
    const shader = compileGSS(`
      @scene { group#g { cube } }
      #g { translate: 0 1 0; }
      cube { translate: 2 0 0; rotate-y: 90deg; ${dirt}; }`);
    const space = glslFunction(shader, "vec3 space1(vec3 p)");
    const group = space.indexOf("q -= vec3(0.0, 1.0, 0.0);");
    const cube = space.indexOf("q -= vec3(2.0, 0.0, 0.0);");
    expect(group).toBeGreaterThan(-1);
    expect(cube).toBeGreaterThan(group);
    expect(space).toContain("q.xz *= rot(");
    expect(space).toContain("return q;");
  });

  it("fit one image per face of a cube, whatever its size", () => {
    expect(compileGSS(`@scene { cube; } cube { size: 2; ${dirt}; }`)).toContain(
      "vec3(2.0, 2.0, 2.0))",
    );
    expect(
      compileGSS(`@scene { cube; } cube { size: 1 2 3; ${dirt}; }`),
    ).toContain("vec3(1.0, 2.0, 3.0))");
  });

  it("fit the image to the diameter of a sphere", () => {
    expect(
      compileGSS(`@scene { sphere; } sphere { radius: 0.8; ${dirt}; }`),
    ).toContain("vec3(1.6, 1.6, 1.6))");
  });
});
