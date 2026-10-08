import { describe, expect, it } from "vitest";
import { compileGSS, compileScene } from "..";

const SPHERE =
  "@scene { sphere; } scene { floor: none; } sphere { translate: 0 1 0; radius: 1; }";

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
    expect(shader).toContain("previousD >= 0.001 && previousD < width");
    expect(shader).toContain("edgeT = previousT;");
    expect(shader).toContain("edgeId = previousId;");
    expect(shader).toContain("float boundWidth = max(-b, 0.0) * pixelSize;");
    expect(shader).toContain("c - b * b >");
    expect(shader).toContain("return PrecisionHit(");
    expect(shader).toContain("vec3 edgeColor = shadeSurface(ro, rd, edgeT, edgeId);");
    expect(shader).toContain("col = mix(col, edgeColor, edgeCoverage);");
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
