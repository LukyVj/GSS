import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

// texture-mapping (decision 185): box, the default, projects the image on each face of
// the box around the object (triplanar); sphere wraps it once around the object, like a
// map around a globe.
const earth = 'texture: url("earth.png")';

// The text of one generated GLSL function, from its signature to its closing brace
function glslFunction(shader: string, signature: string): string {
  const start = shader.indexOf(signature);
  if (start === -1) return "";
  return shader.slice(start, shader.indexOf("\n}", start) + 2);
}

describe("texture-mapping", () => {
  it("wraps the image around the object with sphere", () => {
    const shader = compileGSS(`@scene { sphere; } sphere { ${earth}; texture-mapping: sphere; }`);
    expect(glslFunction(shader, "vec3 textureColor(")).toContain(
      "if (id == 1.0) return spherical(uTexture0, space1(p), color, false);",
    );
    expect(shader).toContain("vec3 spherical(sampler2D image, vec3 q, vec3 color, bool pixelated)");
  });

  it("reads the longitude across and the latitude up, the middle of the image in front", () => {
    const spherical = glslFunction(
      compileGSS(`@scene { sphere; } sphere { ${earth}; texture-mapping: sphere; }`),
      "vec3 spherical(",
    );
    expect(spherical).toContain("vec3 d = normalize(q);");
    // atan(x, z): 0 in front (+z), a quarter turn on the right (+x)
    expect(spherical).toContain("0.5 + atan(d.x, d.z) / 6.2831853,");
    expect(spherical).toContain("0.5 + asin(clamp(d.y, -1.0, 1.0)) / 3.1415927);");
  });

  it("changes nothing with box, the default", () => {
    const plain = compileGSS(`@scene { sphere; } sphere { ${earth}; }`);
    expect(compileGSS(`@scene { sphere; } sphere { ${earth}; texture-mapping: box; }`)).toBe(plain);
    expect(plain).not.toContain("spherical");
  });

  it("leaves triplanar() out when no object projects on its faces", () => {
    const shader = compileGSS(`@scene { sphere; } sphere { ${earth}; texture-mapping: sphere; }`);
    expect(shader).not.toContain("triplanar");
  });

  it("is chosen per object", () => {
    const shader = compileGSS(`
      @scene { sphere; cube; }
      sphere { ${earth}; texture-mapping: sphere; }
      cube { ${earth}; }`);
    const textureColor = glslFunction(shader, "vec3 textureColor(");
    expect(textureColor).toContain("if (id == 1.0) return spherical(uTexture0, ");
    expect(textureColor).toContain("if (id == 2.0) return triplanar(uTexture0, ");
    expect(shader).not.toContain("uTexture1"); // one image, one texture
  });

  it("keeps image-rendering: pixelated", () => {
    const shader = compileGSS(
      `@scene { sphere; } sphere { ${earth}; texture-mapping: sphere; image-rendering: pixelated; }`,
    );
    expect(shader).toContain("spherical(uTexture0, space1(p), color, true);");
    expect(glslFunction(shader, "vec3 spherical(")).toContain("floor(st * size) + 0.5) / size");
  });

  it("wraps the image of each face, the face still chosen by faceOf()", () => {
    const shader = compileGSS(`
      @scene { sphere; }
      sphere { ${earth}; texture-mapping: sphere; }
      sphere::face(top) { texture: url("ice.png"); }`);
    const textureColor = glslFunction(shader, "vec3 textureColor(");
    expect(textureColor).toContain("if (face == 1) return spherical(uTexture1, q, color, false); // top");
    expect(textureColor).toContain("return spherical(uTexture0, q, color, false);");
  });

  it("wraps the image under the text of content, the text wrapped around the sphere too", () => {
    const textureColor = glslFunction(
      compileGSS(`@scene { sphere; } sphere { ${earth}; texture-mapping: sphere; content: "GSS"; }`),
      "vec3 textureColor(",
    );
    expect(textureColor).toContain("color = spherical(uTexture0, q, color, false);");
    expect(textureColor).toMatch(/return textLabel\(uTexture1, wrapped\(q, ln, /);
  });

  it("ignores texture-size, which only sizes the images of box, but still checks it", () => {
    const shader = compileGSS(
      `@scene { sphere; } sphere { ${earth}; texture-mapping: sphere; texture-size: 0.5; }`,
    );
    expect(shader).toContain("spherical(uTexture0, space1(p), color, false);");
    expect(() =>
      compileGSS(`@scene { sphere; } sphere { ${earth}; texture-mapping: sphere; texture-size: 0; }`),
    ).toThrow(/texture-size expects one positive number/);
  });

  it("explains a wrong value, even without a texture", () => {
    for (const value of ["globe", "sphere box", "2"]) {
      expect(() => compileGSS(`@scene { sphere; } sphere { texture-mapping: ${value}; }`), value).toThrow(
        /texture-mapping expects box or sphere, like: texture-mapping: sphere;/,
      );
    }
  });

  it("cannot change on :hover", () => {
    expect(() =>
      compileGSS(`@scene { sphere; } sphere { ${earth}; } sphere:hover { texture-mapping: sphere; }`),
    ).toThrow(/"texture-mapping" cannot change on :hover/);
  });

  it("is lowered to WGSL", () => {
    const wgsl = compileGSS(`@scene { sphere; } sphere { ${earth}; texture-mapping: sphere; }`, "wgsl");
    expect(wgsl).toContain("atan2(");
    expect(wgsl).toContain("asin(");
  });
});
