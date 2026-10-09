import { describe, expect, it } from "vitest";
import { compileGSS, compileScene } from "..";

const SPHERE =
  "@scene { sphere; } scene { floor: none; } sphere { translate: 0 1 0; radius: 1; }";

// The function marchPrecision() of a shader
function march(shader: string): string {
  const start = shader.indexOf("PrecisionHit marchPrecision(");
  return shader.slice(start, shader.indexOf("\n}\n", start));
}

describe("shape-rendering", () => {
  it("is auto by default and leaves the shader byte-for-byte unchanged", () => {
    const plain = compileGSS(SPHERE);
    expect(plain).not.toContain("marchPrecision");
    expect(compileGSS(`${SPHERE} scene { shape-rendering: auto; }`)).toBe(plain);
  });

  it("promotes only a passed near miss, not a ray still approaching a surface", () => {
    const shader = compileGSS(
      `${SPHERE} scene { shape-rendering: geometricPrecision; }`,
    );
    expect(shader).toContain("PrecisionHit marchPrecision(vec3 ro, vec3 rd)");
    expect(shader).toContain("float previousD = 1e10;");
    expect(shader).toContain("float previousT = 0.0;");
    expect(shader).toContain("float previousId = 0.0;");
    expect(shader).toContain("(d > previousD || id != previousId)");
    expect(shader).toContain("previousId > 0.0");
    expect(shader).toContain("previousD >= previousHitDistance && previousD < previousWidth");
    expect(shader).toContain("edgeT = previousT;");
    expect(shader).toContain("edgeId = previousId;");
    expect(shader).toContain("float boundWidth = max(-b, 0.0) * pixelSize;");
    expect(shader).toContain("c - b * b >");
    expect(shader).toContain("return PrecisionHit(");
    expect(shader).toContain("vec3 edgeColor = shadeSurface(ro, rd, edgeT, edgeId);");
    expect(shader).toContain("col = mix(col, edgeColor, edgeCoverage);");
  });

  it("measures a hit and the blended band in pixels, so a large canvas blends as much", () => {
    const shader = march(compileGSS(
      `${SPHERE} scene { shape-rendering: geometricPrecision; }`,
    ));
    expect(shader).toContain("float hitDistance = max(0.25 * t * pixelSize, 0.0001);");
    expect(shader).toContain("if (d < hitDistance) break;");
    expect(shader).not.toContain("0.001");
    // From closer than a quarter of a pixel (a hit) to a whole pixel (nothing)
    expect(shader).toContain(
      "float here = (previousWidth - previousD) / (previousWidth - previousHitDistance);",
    );
  });

  it("gives a ray near an object more steps than auto, and a ray near the floor none", () => {
    const plain = march(compileGSS(`${SPHERE} scene { shape-rendering: geometricPrecision; }`));
    expect(plain).toContain("for (int i = 0; i < 300; i++) {");
    expect(plain).toContain("if (i >= 100 && id == 0.0) break;");
    // With holes or opacity, the march of auto already takes 200 steps
    const holes = march(compileGSS(
      `${SPHERE} scene { shape-rendering: geometricPrecision; } sphere { mask-image: linear-gradient(red, transparent); }`,
    ));
    expect(holes).toContain("for (int i = 0; i < 400; i++) {");
    expect(holes).toContain("if (i >= 200 && id == 0.0) break;");
  });

  it("measures a sample closer than a pixel to a path, a prism or a lathe again, without the shortcut of its box", () => {
    const shapes = [
      'path { d: path("M-1 0 L1 0"); stroke-width: 0.2; }',
      "prism { d: polygon(0 1, 1 -1, -1 -1); depth: 0.5; }",
      "lathe { d: polygon(0 1, 1 -1, 0 -1); }",
    ];
    for (const shape of shapes) {
      const name = shape.split(" ")[0];
      const source = `@scene { ${name}; } scene { floor: none; } ${shape}`;
      const plain = compileGSS(source);
      expect(plain).toContain("if (far > 0.5) return far;");
      expect(plain).not.toContain("exactDistance");
      const precise = compileGSS(`${source} scene { shape-rendering: geometricPrecision; }`);
      expect(precise).toContain("bool exactDistance = false;");
      expect(precise).toContain("if (far > 0.5 && !exactDistance) return far;");
      expect(precise).not.toContain("if (far > 0.5) return far;");
      const loop = march(precise);
      expect(loop).toContain("bool close = d < t * pixelSize;");
      expect(loop).toContain("exactDistance = close;\n      if (close) continue;");
      // map() once in the loop: a GPU copies it at every call
      expect(loop.split("map(").length - 1).toBe(1);
    }
    // Shapes without a shortcut: no second measure
    const sphere = compileGSS(`${SPHERE} scene { shape-rendering: geometricPrecision; }`);
    expect(sphere).not.toContain("exactDistance");
  });

  it("lowers the same passed-near-miss path to WGSL", () => {
    const { wgsl } = compileScene(
      `${SPHERE} scene { shape-rendering: geometricPrecision; }`,
      { target: "dual" },
    );
    expect(wgsl).toContain("struct g_PrecisionHit");
    expect(wgsl).toContain("fn g_marchPrecision(");
    expect(wgsl).toContain("g_previousD");
    expect(wgsl).toContain("g_previousId");
    expect(wgsl).toContain("g_edgeId");
    expect(wgsl).toContain("g_edgeCoverage");
  });

  it("follows @media like every scene property", () => {
    const compiled = compileScene(
      `${SPHERE} @media (max-width: 600px) { scene { shape-rendering: geometricPrecision; } }`,
    );
    expect(compiled.shader).not.toContain("marchPrecision");
    expect(compiled.media!.variants[1].shader).toContain("marchPrecision");
  });

  it("takes only auto or geometricPrecision, on the scene only", () => {
    expect(() =>
      compileGSS(`${SPHERE} scene { shape-rendering: smooth; }`),
    ).toThrow(
      "shape-rendering expects auto or geometricPrecision, like: shape-rendering: geometricPrecision;",
    );
    expect(() =>
      compileGSS(`${SPHERE} sphere { shape-rendering: geometricPrecision; }`),
    ).toThrow('"shape-rendering" only applies to the scene');
  });
});
