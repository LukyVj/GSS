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
});
