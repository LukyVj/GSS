import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

// A sphere in front of a cube: the sphere blends with the cube, the floor and the background
const scene = (rule: string, more = "", target: "glsl" | "wgsl" = "glsl") =>
  compileGSS(`@scene { sphere; cube; } sphere { translate: 0 1 0; ${rule} } cube { translate: 0 1 -2; } ${more}`, target);
const functionOf = (shader: string, head: string) => shader.slice(shader.indexOf(head), shader.indexOf("\n}\n", shader.indexOf(head)));
const modesOf = (shader: string) => functionOf(shader, "float blendMode(float id) {");
const overOf = (shader: string) => functionOf(shader, "vec3 blendOver(float mode, vec3 b, vec3 s, float a) {");
const mainOf = (shader: string) => shader.slice(shader.indexOf("void main() {"));

const MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
  "plus-lighter",
];

describe("mix-blend-mode: an object blended with what is behind it, like CSS", () => {
  it("keeps the shader of a scene where nothing blends", () => {
    const plain = scene("");
    expect(scene("mix-blend-mode: normal;")).toBe(plain);
    expect(plain).not.toContain("blendMode(");
    expect(plain).not.toContain("blendOver(");
  });

  it("gives each object the number of its mode, and blends it with the function of that mode", () => {
    const shader = scene("mix-blend-mode: multiply;");
    expect(modesOf(shader)).toContain("if (id == 1.0) return 1.0;  // sphere: multiply");
    expect(modesOf(shader)).toContain("return 0.0;");
    expect(shader).toContain("vec3 blendMultiply(vec3 b, vec3 s)");
    expect(overOf(shader)).toContain("if (mode == 1.0) return mix(b, blendMultiply(b, s), a);  // multiply");
    // Only the modes the scene uses
    expect(shader).not.toContain("blendScreen");
    expect(overOf(scene("mix-blend-mode: difference;"))).toContain("if (mode == 10.0) return mix(b, blendDifference(b, s), a);  // difference");
  });

  it("blends the colors as they show, between 0 and 1", () => {
    expect(overOf(scene("mix-blend-mode: screen;"))).toContain("b = clamp(b, 0.0, 1.0);\n  s = clamp(s, 0.0, 1.0);");
  });

  it("finds the surfaces from the front, then draws each over what is behind it from the back", () => {
    const main = mainOf(scene("mix-blend-mode: multiply;"));
    expect(main).toContain("float behind = pastSurface(ro, rd, lt);");
    expect(main).toContain("vec3 c = shadeSurface(ro, rd, st, sid);");
    expect(main).toContain("col = blendOver(blendMode(sid), col, c, surfaceAlpha(sid, ro + rd * st));");
    // Not the front-to-back sum of opacity: a blend needs what is behind it first
    expect(main).not.toContain("col += (1.0 - cover) * a * c;");
  });

  it("makes a blended object a skin, seen once: the ray goes past the rest of it", () => {
    const shader = scene("mix-blend-mode: screen;");
    expect(shader).toContain("res = opU(res, vec2(shell(");
    expect(shader).toContain("bool isSkin(float id) {\n  return id == 1.0;\n}");
    expect(shader).toContain("bool blendedAgain(float id, vec4 ids, vec4 moreIds, int n) {");
    expect(mainOf(shader)).toContain("if (lt >= MAX_DIST || !blendedAgain(lid, ids, moreIds, count)) {");
  });

  it("takes the 16 modes of background-blend-mode, and plus-lighter", () => {
    for (const mode of MODES) {
      expect(() => scene(`mix-blend-mode: ${mode};`), mode).not.toThrow();
      expect(() => scene(`mix-blend-mode: ${mode};`, "", "wgsl"), mode).not.toThrow();
    }
    expect(overOf(scene("mix-blend-mode: plus-lighter;"))).toContain("if (mode == 16.0) return min(b + a * s, vec3(1.0));  // plus-lighter");
    expect(scene("mix-blend-mode: luminosity;")).toContain("vec3 blendSetLum(vec3 c, float l)");
  });

  it("multiplies with opacity: a blended object at 50% blends half of it", () => {
    const shader = scene("mix-blend-mode: multiply; opacity: 0.5;");
    expect(modesOf(shader)).toContain("if (id == 1.0) return 1.0;  // sphere: multiply");
    expect(functionOf(shader, "float surfaceAlpha(float id, vec3 p) {")).toContain("if (id == 1.0) return 0.5;  // sphere");
  });

  it("goes into each object of a group that has none of its own", () => {
    const shader = compileGSS("@scene { group#g { sphere; cube; } torus; } #g { mix-blend-mode: screen; } cube { mix-blend-mode: difference; }");
    expect(modesOf(shader)).toContain("if (id == 1.0) return 2.0;  // sphere: screen");
    expect(modesOf(shader)).toContain("if (id == 2.0) return 10.0;  // cube: difference");
    expect(modesOf(shader)).not.toContain("torus");
  });

  it("changes on :hover and in @keyframes from one mode to the other halfway, like a discrete property of CSS", () => {
    const hovered = modesOf(scene("transition: 0.4s;", "sphere:hover { mix-blend-mode: difference; }"));
    expect(hovered).toContain("if (id == 1.0) {  // sphere: normal, difference");
    expect(hovered).toContain("uHover[0]");
    expect(hovered).toContain("if (w >= most) {");
    const animated = modesOf(scene("animation: swap 2s;", "@keyframes swap { to { mix-blend-mode: screen; } }"));
    expect(animated).toContain("iTime / 2.0");
    expect(animated).toContain("mode = 2.0;");
  });

  it("is lowered to WGSL", () => {
    const wgsl = scene("mix-blend-mode: multiply;", "", "wgsl");
    expect(wgsl).toContain("fn g_blendOver(");
    expect(wgsl).toContain("g_depths[g_count] = g_lt;");
  });
});

describe("mix-blend-mode, the shadows and the edges", () => {
  it("casts the shadow of an opaque object", () => {
    const shader = scene("mix-blend-mode: multiply;", "scene { shadows: soft; }");
    expect(shader).toContain("float shadow(vec3 ro, vec3 rd, float far) {");
  });

  it("keeps the penumbra of an opaque blended object among transparent ones", () => {
    const shader = compileGSS(
      "@scene { sphere; cube; } scene { shadows: soft; } sphere { translate: 0 1 0; mix-blend-mode: multiply; } cube { translate: 1 1 -2; opacity: 0.5; }",
    );
    expect(shader).toContain("bool seeThrough(float id) {\n  return id == 2.0;\n}");
    expect(shader).toContain("if (!seeThrough(res.y)) soft = min(soft, 12.0 * h / t);");
  });

  it("blends the smoothed edge of geometricPrecision with its mode", () => {
    const shader = scene("mix-blend-mode: screen;", "scene { shape-rendering: geometricPrecision; }");
    expect(shader).toContain("col = blendOver(blendMode(edgeId), col, edgeColor, edgeCoverage * surfaceAlpha(edgeId, edgePoint));");
  });
});

describe("mix-blend-mode: errors", () => {
  it("takes the keywords of CSS", () => {
    expect(() => scene("mix-blend-mode: blend;")).toThrow("mix-blend-mode expects normal, multiply, screen");
    expect(() => scene("mix-blend-mode: multiply screen;")).toThrow("mix-blend-mode expects normal, multiply, screen");
  });

  it("goes on objects and groups, not on the scene", () => {
    expect(() => compileGSS("@scene { sphere; } scene { mix-blend-mode: multiply; }")).toThrow("only applies to objects");
  });

  it("has no isolation yet", () => {
    expect(() => compileGSS("@scene { group#g { sphere; } } #g { isolation: isolate; }")).toThrow('Unknown property "isolation"');
  });
});
