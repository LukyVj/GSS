import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "../index";

// Step 5b of the textures: the images of ::top and ::bottom reach the list of
// images and the shader. faceOf() tells, from the normal in the object's space,
// which face a point is on; the sides use the object's own image.
const grass = `
  @scene { cube.grass; }
  .grass { texture: url("grass-side.png"); image-rendering: pixelated; }
  .grass::top { texture: url("grass-top.png"); }
  .grass::bottom { texture: url("dirt.png"); }`;

// The text of one generated GLSL function, from its signature to its closing brace
function glslFunction(shader: string, signature: string): string {
  const start = shader.indexOf(signature);
  if (start === -1) return "";
  return shader.slice(start, shader.indexOf("\n}", start) + 2);
}

describe("the images of the faces", () => {
  it("are listed after the object's own image", () => {
    expect(compileScene(grass).textures).toEqual([
      "grass-side.png",
      "grass-top.png",
      "dirt.png",
    ]);
  });

  it("count once, like any image", () => {
    const scene = compileScene(`
      @scene { cube; }
      cube { texture: url("dirt.png"); }
      cube::bottom { texture: url("dirt.png"); }`);
    expect(scene.textures).toEqual(["dirt.png"]);
  });

  it("go through var(), with the object's variables", () => {
    const scene = compileScene(`
      @scene { cube; }
      scene { --top: url("grass-top.png"); }
      cube::top { texture: var(--top); }`);
    expect(scene.textures).toEqual(["grass-top.png"]);
  });
});

describe("the faces in the shader", () => {
  it("pick the image of the face the point is on", () => {
    const shader = compileGSS(grass);
    expect(shader).toContain("int faceOf(vec3 n)");
    const textureColor = glslFunction(shader, "vec3 textureColor(");
    expect(textureColor).toContain("int face = faceOf(");
    expect(textureColor).toContain(
      "if (face == 1) return triplanar(uTexture1, ",
    );
    expect(textureColor).toContain(
      "if (face == 2) return triplanar(uTexture2, ",
    );
    expect(textureColor).toContain("return triplanar(uTexture0, ");
  });

  it("use the object's image-rendering on every face", () => {
    const textureColor = glslFunction(compileGSS(grass), "vec3 textureColor(");
    expect(textureColor.match(/color, true\);/g)).toHaveLength(3);
  });

  it("keep the color on the sides when only the top has an image", () => {
    const shader = compileGSS(`
      @scene { cube; }
      cube::top { texture: url("grass-top.png"); }`);
    const textureColor = glslFunction(shader, "vec3 textureColor(");
    expect(textureColor).toContain(
      "if (face == 1) return triplanar(uTexture0, ",
    );
    expect(textureColor).not.toContain("face == 2");
    expect(textureColor).not.toContain("uTexture1");
  });

  it("number the six faces like faceOf(): front 3, back 4, right 5, left 6", () => {
    const shader = compileGSS(`
      @scene { cube.furnace; }
      .furnace { texture: url("stone.png"); }
      .furnace::face(front) { texture: url("door.png"); }
      .furnace::face(back) { texture: url("b.png"); }
      .furnace::face(right) { texture: url("r.png"); }
      .furnace::face(left) { texture: url("l.png"); }`);
    const textureColor = glslFunction(shader, "vec3 textureColor(");
    expect(textureColor).toContain(
      "if (face == 3) return triplanar(uTexture1, ",
    );
    expect(textureColor).toContain(
      "if (face == 4) return triplanar(uTexture2, ",
    );
    expect(textureColor).toContain(
      "if (face == 5) return triplanar(uTexture4, ",
    );
    expect(textureColor).toContain(
      "if (face == 6) return triplanar(uTexture3, ",
    );
    expect(textureColor).toContain("return triplanar(uTexture0, "); // top and bottom: the stone
    expect(glslFunction(shader, "int faceOf(vec3 n)")).toContain(
      "return n.z > 0.0 ? 3 : 4;",
    );
  });

  it("add nothing when no face has its own image", () => {
    const shader = compileGSS(
      '@scene { cube; } cube { texture: url("dirt.png"); }',
    );
    expect(shader).not.toContain("faceOf");
    expect(shader).toContain("if (id == 1.0) return triplanar(uTexture0, ");
  });
});
