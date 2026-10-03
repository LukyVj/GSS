import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

const scene = (rule: string, more = "") => compileGSS(`@scene { sphere; } sphere { translate: 0 1 0; ${rule} } ${more}`);
// The body of maskAlpha(): the mask of each masked object
const maskOf = (shader: string) => shader.slice(shader.indexOf("float maskAlpha("), shader.indexOf("vec2 march("));
const marchOf = (shader: string) => shader.slice(shader.indexOf("vec2 march("), shader.indexOf("vec3 calcNormal("));

describe("mask-image: holes in an object", () => {
  it("keeps the shader of a scene without mask-image as it was", () => {
    const shader = scene("color: #ff5a36;");
    expect(shader).not.toContain("maskAlpha");
    expect(marchOf(shader)).toContain("t += res.x;");
  });

  it("reads the mask in the object's own space, like a gradient in color", () => {
    const mask = maskOf(scene("mask-image: radial-gradient(circle, transparent 30%, black 31%);"));
    expect(mask).toContain("float maskAlpha(float id, vec3 p) {");
    expect(mask).toContain("if (id == 1.0) {  // sphere");
    expect(mask).toContain("vec3 q = space1(p);");
    expect(mask).toContain("vec4 col = ");
    expect(mask).toContain("return col.a;");
    expect(mask).toContain("return 1.0;"); // every other object, and the floor: no hole
  });

  it("lets the ray go through a hole, and on through the object", () => {
    const march = marchOf(scene("mask-image: noise(3, black 50%, transparent 52%);"));
    expect(march).toContain("float d = abs(res.x);");
    expect(march).toContain("if (maskAlpha(id, p) >= 0.5) break;");
  });

  it("is a skin while the ray looks for a surface, so what is inside it can be seen", () => {
    const shader = compileGSS(
      "@scene { cube; sphere; } cube { size: 2; mask-image: noise(3, black 50%, transparent 52%); } sphere { radius: 0.5; operation: subtract; mask-image: noise(4, black 50%, transparent 52%); }",
    );
    expect(shader).toContain("return throughHoles ? abs(d) : d;");
    expect(shader).toContain("res = opU(res, vec2(shell(");
    expect(shader).toContain("bool hasHoles(float id) {\n  return id == 1.0 || id == 2.0;\n}");
    // A subtracted object cuts the others: it stays solid
    expect(shader).not.toMatch(/opS\(res, vec2\(shell\(/);
    expect(marchOf(shader)).toContain("throughHoles = true;");
  });

  it("lights the inside of an object, seen through a hole, from inside", () => {
    // main() and the reflections of trace() turn the normal toward the viewer
    const shader = scene("mask-image: noise(3, black 50%, transparent 52%); material: metal(0.2);");
    expect(shader).toContain("return dot(n, rd) > 0.0 ? -n : n;");
    expect(shader).toContain("vec3 n = holeNormal(p, rd, id);");
    expect(shader).toContain("vec3 n = holeNormal(p, rd, hit.y);");
  });

  it("reads the luminance with mask-mode: luminance, like CSS", () => {
    const luminance = maskOf(scene("mask-image: linear-gradient(black, white); mask-mode: luminance;"));
    expect(luminance).toContain("return dot(col.rgb, vec3(0.2125, 0.7154, 0.0721));");
    for (const mode of ["alpha", "match-source"])
      expect(maskOf(scene(`mask-image: linear-gradient(black, transparent); mask-mode: ${mode};`)), mode).toContain(
        "return col.a;",
      );
  });

  it("takes transparent colors, and only in mask-image or background", () => {
    for (const color of ["transparent", "#0000", "#00000000", "rgb(0 0 0 / 0%)", "oklch(0% 0 0 / 0.2)", "color-mix(in srgb, black 30%, white 10%)"])
      expect(() => scene(`mask-image: linear-gradient(${color}, black);`), color).not.toThrow();
    expect(() => scene("color: linear-gradient(transparent, black);")).toThrow("GSS has no transparency yet");
  });

  it("writes the space of an object once, when it is painted or textured too", () => {
    const painted = scene("color: linear-gradient(red, blue); mask-image: noise(3, black 50%, transparent 52%);");
    expect(painted.match(/vec3 space1\(vec3 p\)/g)).toHaveLength(1);
    const textured = scene('texture: url("dirt.png"); mask-image: noise(3, black 50%, transparent 52%);');
    expect(textured.match(/vec3 space1\(vec3 p\)/g)).toHaveLength(1);
  });

  it("is lowered to WGSL", () => {
    const wgsl = compileGSS("@scene { sphere; } sphere { mask-image: noise(3, black 50%, transparent 52%); }", "wgsl");
    expect(wgsl).toContain("maskAlpha");
  });
});

describe("mask-image: moving", () => {
  it("moves like a gradient, with @keyframes", () => {
    const mask = maskOf(
      scene(
        "mask-image: noise(3, black 0%, transparent 2%); animation: dissolve 4s;",
        "@keyframes dissolve { to { mask-image: noise(3, black 100%, transparent 102%); } }",
      ),
    );
    expect(mask).toContain("iTime / 4.0");
  });

  it("changes on :hover", () => {
    const mask = maskOf(
      scene(
        "mask-image: radial-gradient(circle, transparent 0%, black 1%); transition: 0.4s;",
        "sphere:hover { mask-image: radial-gradient(circle, transparent 40%, black 41%); }",
      ),
    );
    expect(mask).toContain("uHover[");
  });

  it("follows a variable set from JS", () => {
    const mask = maskOf(
      compileGSS(
        '@property --open { syntax: "<percentage>"; inherits: false; initial-value: 30%; } @scene { sphere; } sphere { mask-image: radial-gradient(circle, transparent var(--open), black calc(var(--open) + 1%)); }',
      ),
    );
    expect(mask).toContain("uProperties[0]");
  });
});

describe("mask-image: errors", () => {
  it("takes an image, not a color", () => {
    expect(() => scene("mask-image: black;")).toThrow("mask-image expects none or an image");
  });

  it("takes one image", () => {
    expect(() => scene("mask-image: noise(3, black 50%, transparent 52%), linear-gradient(black, transparent);")).toThrow(
      "mask-image takes one image",
    );
  });

  it("keeps an image when it changes", () => {
    expect(() =>
      scene("mask-image: noise(3, black 50%, transparent 52%); animation: a 2s;", "@keyframes a { to { mask-image: none; } }"),
    ).toThrow("mask-image can only change into another noise()");
  });

  it("checks mask-mode", () => {
    expect(() => scene("mask-image: linear-gradient(black, transparent); mask-mode: brightness;")).toThrow(
      "mask-mode expects alpha, luminance or match-source",
    );
  });

  it("goes on objects only", () => {
    expect(() => compileGSS("@scene { sphere; } scene { mask-image: linear-gradient(black, transparent); }")).toThrow();
    expect(() =>
      compileGSS("@scene { light; sphere; } light { mask-image: linear-gradient(black, transparent); }"),
    ).toThrow("does not apply to a light");
  });
});
