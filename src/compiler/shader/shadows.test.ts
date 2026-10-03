import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

const scene = (sceneRule: string, more = "@scene { sphere; } sphere { translate: 0 1 0; }") =>
  compileGSS(`${more} scene { ${sceneRule} }`);
const mainOf = (shader: string) => shader.slice(shader.indexOf("void main() {"));
const traceOf = (shader: string) => shader.slice(shader.indexOf("vec3 trace("), shader.indexOf("}", shader.indexOf("vec3 trace(")));

describe("shadows: the objects keep the light from each other", () => {
  it("keeps the shader of a scene without shadows as it was", () => {
    for (const shader of [scene(""), scene("shadows: none;")]) {
      expect(shader).not.toContain("castShadows");
      expect(shader).toContain("vec3 diffuse(vec3 n, vec3 color) {");
    }
  });

  it("sends a ray toward the sun from each point main() shades", () => {
    const shader = scene("shadows: soft;");
    expect(shader).toContain("float shadow(vec3 ro, vec3 rd, float far) {");
    expect(shader).toContain("sunLit = shadow(from, LIGHT_DIR, MAX_DIST);");
    expect(mainOf(shader)).toMatch(/vec3 n = calcNormal\(p\);\n\s*castShadows\(p, n\);/);
    // The sun's light reaches a point only as much as the object on the way lets it
    expect(shader).toMatch(/light \+= (?:[\d.]+ \* )?SUN \* sunLit \* max\(dot\(n, LIGHT_DIR\), 0\.0\);/);
  });

  it("draws a penumbra with soft, and cuts it sharp with hard", () => {
    expect(scene("shadows: soft;")).toContain("lit = min(lit, 12.0 * h / t);");
    const hard = scene("shadows: hard;");
    expect(hard).toContain("if (h < 0.001) return 0.0;");
    expect(hard).not.toContain("lit = min(");
  });

  it("lets every light of @scene cast shadows, toward where it is", () => {
    const shader = compileGSS(
      "@scene { light; sphere; } scene { shadows: soft; light: none; } light { translate: 1 3 0; } sphere { translate: 0 1 0; }",
    );
    expect(shader).toContain("lit0 = shadow(from, normalize(light0 - from), length(light0 - from));");
    expect(shader).toContain("* lit0 * max(dot(n, l0.xyz), 0.0);");
    expect(shader).not.toContain("sunLit"); // light: none: no sun, no shadow of it
  });

  it("darkens the highlights in the shadow too, but leaves the reflections without shadows", () => {
    const shader = scene("shadows: soft;", "@scene { sphere; } sphere { translate: 0 1 0; material: chrome; }");
    expect(shader).toMatch(/vec3 lightShine\(vec3 p, vec3 r, float k\) \{[^}]*sunLit/);
    expect(traceOf(shader)).toContain("diffuseOpen(p, n, ");
    expect(shader).toContain("vec3 diffuseOpen(vec3 p, vec3 n, vec3 color) {");
  });

  it("lets the light through the holes of mask-image", () => {
    const shader = scene(
      "shadows: soft;",
      "@scene { sphere; } sphere { translate: 0 1 0; mask-image: noise(3, black 50%, transparent 52%); }",
    );
    const shadow = shader.slice(shader.indexOf("float shadow("));
    expect(shadow).toContain("throughHoles = true;");
    expect(shadow).toContain("if (maskAlpha(res.y, p) >= 0.5)");
    // A ray through a hole passes right by the skin: no penumbra from an object with holes
    expect(shadow).toContain("} else if (!hasHoles(res.y)) {");
  });

  it("is lowered to WGSL", () => {
    expect(() =>
      compileGSS(
        "@scene { light; sphere; } scene { shadows: soft; } light { translate: 1 3 0; } sphere { translate: 0 1 0; material: chrome; }",
        "wgsl",
      ),
    ).not.toThrow();
  });
});

describe("shadows: errors", () => {
  it("takes none, hard or soft", () => {
    expect(() => scene("shadows: blurry;")).toThrow("shadows expects none, hard or soft");
  });

  it("goes on the scene", () => {
    expect(() => compileGSS("@scene { sphere; } sphere { shadows: soft; }")).toThrow();
  });
});
