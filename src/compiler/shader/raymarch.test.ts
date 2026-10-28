import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "../index";

const scene = (sceneRule: string, more = "@scene { sphere; } sphere { translate: 0 1 0; }") =>
  compileGSS(`${more} scene { ${sceneRule} }`);
const marchOf = (shader: string, head = "vec2 march(vec3 ro, vec3 rd) {") =>
  shader.slice(shader.indexOf(head), shader.indexOf("\n}\n", shader.indexOf(head)));

describe("raymarch-steps, max-distance, hit-precision: how far and how finely a ray looks", () => {
  it("keeps the shader as it was with the initial values", () => {
    const plain = scene("");
    expect(scene("raymarch-steps: 100; max-distance: 20; hit-precision: 0.001;")).toBe(plain);
    expect(plain).toContain("const float MAX_DIST = 20.0;");
    expect(marchOf(plain)).toContain("for (int i = 0; i < 100; i++) {");
  });

  it("gives the march of each pixel as many steps as raymarch-steps", () => {
    const shader = scene("raymarch-steps: 256;");
    expect(marchOf(shader)).toContain("for (int i = 0; i < 256; i++) {");
    expect(marchOf(shader)).not.toContain("i < 100;");
  });

  it("leaves the steps of the shadows to the shadows", () => {
    const shadowOf = (shader: string) => shader.slice(shader.indexOf("float shadow("), shader.indexOf("\n}\n", shader.indexOf("float shadow(")));
    const holes = "@scene { sphere; cube; } sphere { translate: 0 1 0; mask-image: noise(4, black 50%, transparent 50%); }";
    for (const shadows of ["shadows: hard;", "shadows: soft;"])
      for (const more of [undefined, holes])
        expect(shadowOf(scene(`raymarch-steps: 256; hit-precision: 0.0002; ${shadows}`, more))).toBe(shadowOf(scene(shadows, more)));
  });

  it("doubles the steps of a march that goes through holes or skins, as before", () => {
    const masked = scene("raymarch-steps: 64;", "@scene { sphere; } sphere { translate: 0 1 0; mask-image: noise(4, black 50%, transparent 50%); }");
    expect(marchOf(masked)).toContain("for (int i = 0; i < 128; i++) {");
    const skins = scene("raymarch-steps: 64;", "@scene { sphere; } sphere { translate: 0 1 0; opacity: 0.5; }");
    expect(marchOf(skins)).toContain("for (int i = 0; i < 128; i++) {");
  });

  it("moves the steps of geometricPrecision, and keeps its extra steps along silhouettes", () => {
    const head = "PrecisionHit marchPrecision(vec3 ro, vec3 rd) {";
    const shader = scene("raymarch-steps: 50; shape-rendering: geometricPrecision;");
    expect(marchOf(shader, head)).toContain("for (int i = 0; i < 250; i++) {");
    expect(marchOf(shader, head)).toContain("if (i >= 50 && id == 0.0) break;");
  });

  it("draws as far as max-distance", () => {
    const shader = scene("max-distance: 60;");
    expect(shader).toContain("const float MAX_DIST = 60.0;");
    expect(shader).not.toContain("MAX_DIST = 20.0");
  });

  it("starts the fog of none where the scene ends, so an animated fog never covers the far objects", () => {
    const shader = scene("max-distance: 60; animation: thick 2s;", "@scene { sphere; } @keyframes thick { to { fog: 4 12; } }");
    expect(shader).toContain("60.0");
    expect(shader).not.toMatch(/\b20\.0\b/);
  });

  it("stops a ray closer to a surface with a finer hit-precision, and measures the normal as finely", () => {
    const shader = scene("hit-precision: 0.0002;");
    expect(marchOf(shader)).toContain("if (res.x < 0.0002 || t > MAX_DIST) break;");
    expect(shader).toContain("vec2 e = vec2(0.0002, 0.0);");
    const masked = scene("hit-precision: 0.0002;", "@scene { sphere; } sphere { translate: 0 1 0; mask-image: noise(4, black 50%, transparent 50%); }");
    expect(marchOf(masked)).toContain("if (d < 0.0002) {");
    expect(marchOf(masked)).toContain("d = 0.0004;");
    const skins = scene("hit-precision: 0.0002;", "@scene { sphere; } sphere { translate: 0 1 0; opacity: 0.5; }");
    expect(marchOf(skins)).toContain("if (d < 0.0002) break;");
    expect(skins).toContain("if (abs(map(ro + rd * t).x) >= 0.0002) break;");
    expect(skins).toContain("t += 0.0004;");
  });

  it("lowers to WGSL like the rest of the shader", () => {
    const wgsl = compileGSS("@scene { sphere; } scene { raymarch-steps: 256; max-distance: 60; hit-precision: 0.0002; }", "wgsl");
    expect(wgsl).toContain("256");
    expect(wgsl).toContain("60.0");
    expect(wgsl).toContain("0.0002");
  });

  it("refuses values out of range, with the range in the message", () => {
    expect(() => scene("raymarch-steps: 8;")).toThrow("raymarch-steps expects a whole number from 16 to 1024, like: raymarch-steps: 200;");
    expect(() => scene("raymarch-steps: 100.5;")).toThrow("raymarch-steps expects a whole number");
    expect(() => scene("max-distance: 1000;")).toThrow("max-distance expects a number from 10 to 500, like: max-distance: 40;");
    expect(() => scene("hit-precision: 0.5;")).toThrow("hit-precision expects a number from 0.0001 to 0.01, like: hit-precision: 0.0005;");
  });

  it("refuses a variable set from JS: the steps and the distances are written in the shader", () => {
    expect(() =>
      compileGSS('@property --n { syntax: "<number>"; inherits: false; initial-value: 100; } @scene { sphere; } scene { raymarch-steps: var(--n); }'),
    ).toThrow("raymarch-steps is read when the scene compiles");
  });

  it("lets the camera go back 5 units short of max-distance", () => {
    expect(() => scene("camera-distance: 16;")).toThrow("camera-distance expects a number from 3 to 15, like: camera-distance: 8;");
    expect(compileScene("@scene { sphere; } scene { max-distance: 60; camera-distance: 40; }").camera.distance).toBe(40);
    expect(() => scene("max-distance: 30; camera-distance: 26;")).toThrow(
      "camera-distance expects a number from 3 to 25 (5 less than max-distance), like: camera-distance: 8;",
    );
  });

  it("tells the runtime how far the scene goes, only when it is not 20", () => {
    expect(compileScene("@scene { sphere; }").maxDistance).toBeUndefined();
    expect(compileScene("@scene { sphere; } scene { max-distance: 60; }").maxDistance).toBe(60);
  });

  it("takes a value per @media version", () => {
    const compiled = compileScene("@scene { sphere; } @media (max-width: 600px) { scene { raymarch-steps: 64; max-distance: 40; } }");
    const narrow = compiled.media!.variants.find((v) => v.maxDistance === 40)!;
    expect(narrow.shader).toContain("i < 64;");
    expect(compiled.shader).toContain("i < 100;");
  });
});
