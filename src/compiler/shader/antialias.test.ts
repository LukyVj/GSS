import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "../index";

const scene = (sceneRule: string, more = "@scene { sphere; } sphere { translate: 0 1 0; }") =>
  compileGSS(`${more} scene { ${sceneRule} }`);
const mainOf = (shader: string) => shader.slice(shader.lastIndexOf("void main() {"));
const pixelOf = (shader: string) => shader.slice(shader.indexOf("vec4 gssPixel(vec2 fragCoord) {"), shader.lastIndexOf("void main() {"));

describe("antialias: several rays per pixel", () => {
  it("keeps the shader as it was with none", () => {
    expect(scene("antialias: none;")).toBe(scene(""));
    expect(scene("")).not.toContain("gssPixel");
  });

  it("draws the pixel as a function of where its ray starts, and main() takes the mean of 4", () => {
    const shader = scene("antialias: 4x;");
    expect(pixelOf(shader)).toContain("vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;");
    expect(pixelOf(shader)).toMatch(/return vec4\(col, 1\.0\);\n}/);
    expect(pixelOf(shader)).not.toContain("outColor");
    const main = mainOf(shader);
    expect(main.match(/sum \+= gssPixel\(gl_FragCoord\.xy \+ vec2\(/g)).toHaveLength(4);
    expect(main).toContain("outColor = sum / 4.0;");
  });

  it("takes 2 samples with 2x, on the diagonal of the rotated grid", () => {
    const main = mainOf(scene("antialias: 2x;"));
    expect(main.match(/sum \+= gssPixel/g)).toHaveLength(2);
    expect(main).toContain("vec2(0.125, 0.375)");
    expect(main).toContain("vec2(-0.125, -0.375)");
    expect(main).toContain("outColor = sum / 2.0;");
  });

  it("runs the animations once per pixel, before the samples", () => {
    const shader = scene("antialias: 4x;", "@scene { sphere; } sphere { animation: up 2s; } @keyframes up { to { translate: 0 1 0; } }");
    expect(mainOf(shader)).toMatch(/void main\(\) \{\n  animate\(\);/);
    expect(pixelOf(shader)).not.toContain("animate();");
  });

  it("picks the object under the mouse with one ray, the one of the pointer", () => {
    const shader = scene("antialias: 4x;", "@scene { sphere; } sphere:hover { color: red; }");
    expect(mainOf(shader)).toContain("if (uPicking) {\n    outColor = gssPixel(gl_FragCoord.xy);\n    return;\n  }");
    expect(pixelOf(shader)).toContain("vec2 pixel = uPicking ? uPick : fragCoord;");
    expect(pixelOf(shader)).toMatch(/return vec4\(mod\(picked, 256\.0\)/);
  });

  it("works with the debug panel, the views, geometricPrecision, opacity and the filters", () => {
    const sources = [
      compileScene("@scene { sphere; } scene { antialias: 4x; } @debug-panel { display: open; }", { debug: true }).shader,
      scene("antialias: 4x; view: distance;"),
      scene("antialias: 4x; view: steps;"),
      scene("antialias: 4x; shape-rendering: geometricPrecision;"),
      scene("antialias: 4x;", "@scene { sphere; cube; } sphere { opacity: 0.5; }"),
      scene("antialias: 4x; filter: grain(0.05) contrast(1.1);"),
      scene("antialias: 4x;", "@scene { sphere; } sphere { outline: 0.05 solid red; }"),
    ];
    for (const shader of sources) {
      expect(shader).toContain("vec4 gssPixel(vec2 fragCoord) {");
      expect(pixelOf(shader)).not.toContain("outColor");
      expect(pixelOf(shader)).not.toContain("gl_FragCoord");
    }
  });

  it("lowers to WGSL", () => {
    const wgsl = compileGSS("@scene { sphere; } scene { antialias: 4x; } sphere:hover { color: red; }", "wgsl");
    expect(wgsl).toContain("gssPixel");
  });

  it("refuses another value", () => {
    expect(() => scene("antialias: 8x;")).toThrow("antialias expects none, 2x or 4x, like: antialias: 4x;");
  });
});
