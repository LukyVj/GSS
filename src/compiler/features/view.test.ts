import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "..";

// view (decision 131): shaded draws the scene; distance adds the isolines of its distance field
const SPHERE = "@scene { sphere; } sphere { translate: 0 1 0; }";

describe("view", () => {
  it("is shaded by default: the shader has no isolines", () => {
    const compiled = compileScene(SPHERE);
    expect(compiled.view).toBeUndefined();
    expect(compiled.shader).not.toContain("isolines(");
    expect(compiled.shader).not.toContain("mapObjects");
  });

  it("shaded draws the same shader as no view at all", () => {
    expect(compileGSS(`${SPHERE} scene { view: shaded; }`)).toBe(compileGSS(SPHERE));
  });

  it("distance draws the isolines over the scene, after its filters", () => {
    const compiled = compileScene(`${SPHERE} scene { view: distance; }`);
    expect(compiled.view).toBe("distance");
    expect(compiled.shader).toContain("vec3 isolines(vec3 col, vec3 ro, vec3 rd, vec3 target, vec3 forward, float t)");
    expect(compiled.shader).toContain("  col = isolines(col, ro, rd, target, forward, t);\n  outColor = vec4(col, ");
  });

  it("measures the distance to the objects, not to the floor", () => {
    const shader = compileGSS(`${SPHERE} scene { view: distance; }`);
    expect(shader).toContain("vec2 mapObjects(vec3 p) {");
    expect(shader).toContain("return opU(mapObjects(p), vec2(p.y, 0.0)); // the floor: id 0");
    expect(shader).toMatch(/float d = mapObjects\(ro \+ rd \* along\)\.x;/);
  });

  it("keeps the floor out of the bounding tests of the objects", () => {
    const prism = "@scene { prism; sphere; } prism { d: polygon(-1 -1, 1 -1, 0 1); }";
    expect(compileGSS(prism)).toContain("<= min(res.x, p.y)");
    const distance = compileGSS(`${prism} scene { view: distance; }`);
    expect(distance).not.toContain("min(res.x, p.y)");
    expect(distance).toContain("<= res.x) { // its bounding sphere could be the nearest");
  });

  it("without a floor, the scene adds nothing to the objects", () => {
    expect(compileGSS(`${SPHERE} scene { view: distance; floor: none; }`)).toContain(
      "return opU(mapObjects(p), vec2(1e10, 0.0)); // the floor: id 0",
    );
  });

  it("is lowered to WGSL too", () => {
    const { wgsl } = compileScene(`${SPHERE} scene { view: distance; }`, { target: "dual" });
    expect(wgsl).toContain("fn g_isolines(");
    expect(wgsl).toContain("fn g_mapObjects(");
  });

  it("follows @media, like every property of the scene", () => {
    const compiled = compileScene(`${SPHERE} @media (max-width: 600px) { scene { view: distance; } }`);
    expect(compiled.view).toBeUndefined();
    expect(compiled.media!.variants[1].view).toBe("distance");
    expect(compiled.media!.variants[1].shader).toContain("isolines(");
  });

  it("takes shaded or distance only, on the scene only", () => {
    expect(() => compileGSS(`${SPHERE} scene { view: wireframe; }`)).toThrow(
      "view expects shaded or distance, like: view: distance;",
    );
    expect(() => compileGSS(`${SPHERE} sphere { view: distance; }`)).toThrow('"view" only applies to the scene');
  });
});

describe("the view option of compileScene", () => {
  it("replaces the view of the scene in the shader", () => {
    expect(compileScene(SPHERE, { view: "distance" }).shader).toContain("isolines(");
    expect(compileScene(`${SPHERE} scene { view: distance; }`, { view: "shaded" }).shader).not.toContain(
      "isolines(",
    );
  });

  it("leaves the view the code asks for in the result", () => {
    expect(compileScene(SPHERE, { view: "distance" }).view).toBeUndefined();
    expect(compileScene(`${SPHERE} scene { view: distance; }`, { view: "shaded" }).view).toBe("distance");
  });

  it("applies to every @media version of the scene", () => {
    const compiled = compileScene(`${SPHERE} @media (max-width: 600px) { sphere { color: red; } }`, {
      view: "distance",
    });
    expect(compiled.media!.variants.every((variant) => variant.shader.includes("isolines("))).toBe(true);
  });
});
