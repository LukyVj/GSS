import { describe, it, expect } from "vitest";
import { compileScene } from ".";
import { toShadertoy } from "./shadertoy";

const exported = toShadertoy(
  compileScene("@scene { sphere; } scene { camera-distance: 5; camera-spin: none; }"),
);

describe("toShadertoy", () => {
  it("leaves out what Shadertoy writes itself", () => {
    expect(exported).not.toContain("#version");
    expect(exported).not.toContain("precision highp");
    expect(exported).not.toMatch(/^uniform /m);
    expect(exported).not.toContain("out vec4 outColor;");
  });

  it("has a mainImage, and no main() or gl_FragCoord", () => {
    expect(exported).toContain("void mainImage(out vec4 outColor, in vec2 fragCoord) {");
    expect(exported).not.toContain("void main()");
    expect(exported).not.toContain("gl_FragCoord");
  });

  it("keeps the camera of the scene", () => {
    expect(exported).toContain("#define uDist 5.0");
    expect(exported).toContain("iTime * 0.0"); // camera-spin: none
  });

  it("plugs each image into a Shadertoy channel", () => {
    const textured = toShadertoy(
      compileScene(
        `@scene { cube#a; cube#b; } #a { texture: url("/a.png"); } #b { texture: url("/b.png"); }`,
      ),
    );
    expect(textured).toContain("#define uTexture0 iChannel0");
    expect(textured).toContain("#define uTexture1 iChannel1");
  });

  it("has no channel lines when the scene has no image", () => {
    expect(exported).not.toContain("iChannel");
  });

  it("refuses more images than Shadertoy has channels", () => {
    const five = [0, 1, 2, 3, 4];
    const source = `@scene { ${five.map((i) => `cube#c${i};`).join(" ")} } ${five
      .map((i) => `#c${i} { texture: url("/${i}.png"); }`)
      .join(" ")}`;
    expect(() => toShadertoy(compileScene(source))).toThrow("4 image channels");
  });
});
