import { describe, it, expect } from "vitest";
import { compileGSS } from "../index";

const scene = (rule: string, more = "") => compileGSS(`@scene { sphere; } sphere { translate: 0 1 0; ${rule} } ${more}`);
const alphaOf = (shader: string) => shader.slice(shader.indexOf("float surfaceAlpha("), shader.indexOf("}\n", shader.indexOf("float surfaceAlpha(")));
const mainOf = (shader: string) => shader.slice(shader.indexOf("void main() {"));

describe("opacity: an object over what is behind it, like CSS", () => {
  it("keeps the shader of an opaque scene as it was", () => {
    for (const shader of [scene(""), scene("opacity: 1;"), scene("opacity: 100%;")]) {
      expect(shader).not.toContain("surfaceAlpha");
      expect(mainOf(shader)).toContain("vec3 col = BACKGROUND;");
    }
  });

  it("covers what is behind an object as much as its opacity", () => {
    const shader = scene("opacity: 0.5;");
    expect(alphaOf(shader)).toContain("if (id == 1.0) return 0.5;  // sphere");
    expect(alphaOf(shader)).toContain("return 1.0;");
    expect(scene("opacity: 25%;")).toContain("if (id == 1.0) return 0.25;  // sphere");
  });

  it("draws the surfaces along the ray from the front, each over what is behind it", () => {
    const main = mainOf(scene("opacity: 0.5;"));
    expect(main).toContain("vec3 c = shadeSurface(ro, rd, lt, lid);");
    expect(main).toContain("col += (1.0 - cover) * a * c;");
    expect(main).toContain("cover += (1.0 - cover) * a;");
    expect(main).toContain("float behind = pastSurface(ro, rd, lt);");
    // The surface is lit in a function of its own, with its fog
    expect(scene("opacity: 0.5;")).toContain("vec3 shadeSurface(vec3 ro, vec3 rd, float t, float id) {");
  });

  it("makes a transparent object a skin, so that its back face and what is inside it show", () => {
    const shader = scene("opacity: 0.5;");
    expect(shader).toContain("res = opU(res, vec2(shell(");
    expect(shader).toContain("float d = abs(res.x);");
    expect(shader).toContain("vec3 n = holeNormal(p, rd, id);");
    expect(shader).toContain("bool isSkin(float id) {\n  return id == 1.0;\n}");
  });

  it("clamps an opacity outside 0 to 1, like CSS", () => {
    expect(scene("opacity: 2;")).not.toContain("surfaceAlpha");
    expect(scene("opacity: -1;")).toContain("if (id == 1.0) return 0.0;  // sphere");
  });

  it("multiplies the opacity of the groups into each object", () => {
    const shader = compileGSS("@scene { group#g { sphere; cube; } } #g { opacity: 0.5; } sphere { opacity: 0.5; }");
    expect(alphaOf(shader)).toContain("return 0.25;  // sphere");
    expect(alphaOf(shader)).toContain("return 0.5;  // cube");
  });

  it("moves with @keyframes, :hover and a variable set from JS", () => {
    expect(alphaOf(scene("opacity: 1; animation: fade 2s;", "@keyframes fade { to { opacity: 0.2; } }"))).toContain("iTime / 2.0");
    expect(alphaOf(scene("transition: 0.3s;", "sphere:hover { opacity: 0.3; }"))).toContain("uHover[");
    expect(
      alphaOf(
        compileGSS(
          '@property --fade { syntax: "<number>"; inherits: false; initial-value: 0.5; } @scene { sphere; } sphere { opacity: var(--fade); }',
        ),
      ),
    ).toContain("uProperties[0]");
  });

  it("is lowered to WGSL", () => {
    expect(() => compileGSS("@scene { sphere; cube; } sphere { opacity: 0.4; } cube { translate: 0 0 -2; }", "wgsl")).not.toThrow();
  });
});

describe("opacity and the shadows", () => {
  it("lets the light through, tinted by the color, as much as the object is transparent", () => {
    const shader = scene("opacity: 0.5; color: #ff0000;", "scene { shadows: soft; }");
    expect(shader).toContain("vec3 shadow(vec3 ro, vec3 rd, float far) {");
    expect(shader).toContain("lit *= mix(vec3(1.0), surfaceColor(res.y, p), a) * min((1.0 - a) * 10.0, 1.0);");
    expect(shader).toMatch(/vec3 sunLit = vec3\(1\.0\);/);
  });
});

describe("opacity: errors", () => {
  it("takes a number or a percentage", () => {
    expect(() => scene("opacity: half;")).toThrow("opacity expects a number from 0 to 1 or a percentage");
  });

  it("goes on objects and groups, not on the scene", () => {
    expect(() => compileGSS("@scene { sphere; } scene { opacity: 0.5; }")).toThrow();
  });
});
