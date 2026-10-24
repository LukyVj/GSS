import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "..";

// @debug-panel (decision 204): the playground and Try it show the axes, the grid and the numbers
// of the scene. The shader draws the axes and the grid only when the playground asks for them.
const SPHERE = "@scene { sphere; } sphere { translate: 0 1 0; }";
const scene = (rules: string, options = {}) => compileScene(`${rules} ${SPHERE}`, options);

describe("@debug-panel: the debug panel of the playground", () => {
  it("is absent without the rule", () => {
    expect(scene("").debugPanel).toBeUndefined();
  });

  it("is open or folded, open when display is not written", () => {
    expect(scene("@debug-panel { display: open; }").debugPanel).toBe("open");
    expect(scene("@debug-panel { display: folded; }").debugPanel).toBe("folded");
    expect(scene("@debug-panel { }").debugPanel).toBe("open");
  });

  it("is absent with display: none, and the last rule wins", () => {
    expect(scene("@debug-panel { display: none; }").debugPanel).toBeUndefined();
    expect(scene("@debug-panel { display: open; } @debug-panel { display: folded; }").debugPanel).toBe("folded");
    expect(scene("@debug-panel { display: open; } @debug-panel { display: none; }").debugPanel).toBeUndefined();
  });

  it("leaves the shader of a page that embeds the scene as it was", () => {
    expect(scene("@debug-panel { display: open; }").shader).toBe(scene("").shader);
  });

  it("reports what it cannot read", () => {
    expect(() => scene("@debug-panel { display: shown; }")).toThrow(
      "display of @debug-panel is open, folded or none, not shown",
    );
    expect(() => scene("@debug-panel { range: --a 0 1; }")).toThrow("@debug-panel takes display, not range");
    expect(() => scene("@debug-panel axes { display: open; }")).toThrow(
      "@debug-panel takes a block, like: @debug-panel { display: open; }",
    );
  });

  it("goes outside the rules", () => {
    expect(() => scene("cube { @debug-panel { display: open; } }")).toThrow("@debug-panel goes outside the rules");
    expect(() => scene("@media (min-width: 600px) { @debug-panel { display: open; } }")).toThrow(
      "@debug-panel goes outside the rules",
    );
  });
});

describe("the axes and the grid of @debug-panel", () => {
  it("are drawn when the playground asks for them, after the filters", () => {
    const { shader } = scene("@debug-panel { display: open; }", { debug: true });
    expect(shader).toContain("vec3 debugOverlay(vec3 col, vec3 ro, vec3 rd, float t, vec2 uv, vec3 forward, vec3 right, vec3 up) {");
    expect(shader).toMatch(/  col = debugOverlay\(col, ro, rd, t, uv, forward, right, up\);\n  outColor = vec4\(col, [^;]+\);\n}\s*$/);
  });

  it("name each axis with its letter, at one unit and a bit from the origin", () => {
    const { shader } = scene("@debug-panel { display: open; }", { debug: true });
    expect(shader).toContain("float debugLetter(vec2 q, int letter) {");
    expect(shader).toContain("vec3(1.25, 0.0, 0.0), 0, ");
    expect(shader).toContain("vec3(0.0, 1.25, 0.0), 1, ");
    expect(shader).toContain("vec3(0.0, 0.0, 1.25), 2, ");
  });

  it("are drawn folded too, never without the rule or with display: none", () => {
    expect(scene("@debug-panel { display: folded; }", { debug: true }).shader).toContain("debugOverlay(");
    expect(scene("", { debug: true }).shader).toBe(scene("").shader);
    expect(scene("@debug-panel { display: none; }", { debug: true }).shader).toBe(scene("").shader);
  });

  it("are lowered to WGSL too", () => {
    const { wgsl } = scene("@debug-panel { display: open; }", { debug: true, target: "dual" });
    expect(wgsl).toContain("fn g_debugOverlay(");
  });

  it("apply to every @media version of the scene", () => {
    const compiled = compileScene(
      `@debug-panel { display: open; } ${SPHERE} @media (max-width: 600px) { sphere { color: red; } }`,
      { debug: true },
    );
    expect(compiled.media!.variants.every((variant) => variant.shader.includes("debugOverlay("))).toBe(true);
  });

  it("are drawn with the other views and the other ways a scene is drawn", () => {
    const debug = "@debug-panel { display: open; }";
    for (const rules of [
      "scene { view: distance; }",
      "scene { view: steps; }",
      "scene { shape-rendering: geometricPrecision; }",
      "sphere { opacity: 0.5; }",
      "sphere:hover { color: red; }",
    ]) {
      const { shader } = compileScene(`${debug} ${SPHERE} ${rules}`, { debug: true });
      expect(shader, rules).toContain("  col = debugOverlay(col, ro, rd, t, uv, forward, right, up);\n");
    }
  });
});

describe("view: steps", () => {
  it("colors each pixel by how many times its rays measured the distance", () => {
    const compiled = compileScene(`${SPHERE} scene { view: steps; }`);
    expect(compiled.view).toBe("steps");
    expect(compiled.shader).toContain("float gssSteps = 0.0;");
    expect(compiled.shader).toMatch(/vec2 map\(vec3 p\) \{\n  gssSteps \+= 1\.0;/);
    expect(compiled.shader).toMatch(/  col = stepsColor\(gssSteps\);\n  outColor = vec4\(col, [^;]+\);\n}\s*$/);
  });

  it("is not in the shader of the other views", () => {
    expect(compileGSS(SPHERE)).not.toContain("gssSteps");
    expect(compileGSS(`${SPHERE} scene { view: distance; }`)).not.toContain("gssSteps");
  });

  it("is a view option of compileScene, like distance", () => {
    expect(compileScene(SPHERE, { view: "steps" }).shader).toContain("stepsColor(");
    expect(compileScene(SPHERE, { view: "steps" }).view).toBeUndefined();
  });

  it("is lowered to WGSL too", () => {
    const { wgsl } = compileScene(`${SPHERE} scene { view: steps; }`, { target: "dual" });
    expect(wgsl).toContain("var<private> g_gssSteps: f32 = 0.0;");
    expect(wgsl).toContain("fn g_stepsColor(");
  });

  it("is written on the scene, and named in the error of view", () => {
    expect(() => compileGSS(`${SPHERE} scene { view: wireframe; }`)).toThrow(
      "view expects shaded, distance or steps, like: view: distance;",
    );
  });
});

describe("the numbers @debug-panel shows", () => {
  it("count the point lights of the scene apart from the objects", () => {
    expect(compileScene(SPHERE).lights).toBeUndefined();
    const lit = compileScene("@scene { sphere; light#a; light#b; } #a { translate: 1 1 0; } #b { translate: -1 1 0; }");
    expect(lit.lights).toBe(2);
    expect(lit.objects).toBe(1);
  });
});
