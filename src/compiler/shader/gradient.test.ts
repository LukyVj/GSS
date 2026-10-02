import { describe, it, expect } from "vitest";
import { compileScene } from "../index";

const shaderOf = (background: string) =>
  compileScene(`@scene { sphere } scene { background: ${background}; }`).shader;

describe("gradients in the background (decisions 81, 82)", () => {
  it("keeps a plain color a constant: the shaders of existing scenes do not change", () => {
    expect(shaderOf("#000000")).toContain("const vec3 BACKGROUND = vec3(0.0, 0.0, 0.0);");
    expect(shaderOf("#000000")).not.toContain("background()");
  });

  it("draws linear-gradient() over the canvas, to bottom by default", () => {
    const shader = shaderOf("linear-gradient(#1c1c24, #07070a)");
    expect(shader).toContain("#define BACKGROUND background(rd)");
    expect(shader).toContain("vec2 dir = vec2(0.0, -1.0);");
    expect(shader).toContain("col = mix(col, vec3(0.027, 0.027, 0.039), clamp((t - 0.0) / 1.0, 0.0, 1.0));");
  });

  it("reads an angle, a side and a corner", () => {
    expect(shaderOf("linear-gradient(90deg, red, blue)")).toContain("vec2 dir = vec2(1.0, 0.0);");
    expect(shaderOf("linear-gradient(to left, red, blue)")).toContain("vec2 dir = vec2(-1.0, 0.0);");
    expect(shaderOf("linear-gradient(to top right, red, blue)")).toContain(
      "vec2 dir = normalize(vec2(1.0 * size.y, 1.0 * size.x));",
    );
  });

  it("completes the stops like CSS: spread evenly, never going back, two positions hold a color", () => {
    const shader = shaderOf("linear-gradient(red, lime, blue 80%, white 50%)");
    expect(shader).toContain("clamp((t - 0.0) / 0.4, 0.0, 1.0)"); // lime at 40%
    expect(shader).toContain("step(0.8, t)"); // white at 50% goes back: it sits at 80%
    expect(shaderOf("linear-gradient(red 0% 50%, blue 50%)")).toContain("step(0.5, t)");
  });

  it("draws radial-gradient(): ellipse farthest-corner at the center by default", () => {
    const shader = shaderOf("radial-gradient(#1c1c24, #07070a)");
    expect(shader).toContain("vec2 c = vec2(0.5, 0.5) * size;");
    expect(shader).toContain("float t = length(p / max(far * 1.41421356, vec2(0.0001)));");
    const circle = shaderOf("radial-gradient(circle closest-side at 30% top, red, blue)");
    expect(circle).toContain("vec2 c = vec2(0.3, 1.0) * size;");
    expect(circle).toContain("float t = length(p) / max(min(near.x, near.y), 0.0001);");
  });

  it("repeats with repeating-*", () => {
    expect(shaderOf("repeating-linear-gradient(red, blue 10%)")).toContain("t = 0.0 + mod(t - 0.0, 0.1);");
  });

  it("works with var(), color functions and @media", () => {
    const scene = compileScene(
      "@scene { sphere } scene { --top: oklch(30% 0.05 270); background: linear-gradient(var(--top), black); } @media (max-width: 600px) { scene { background: #111111; } }",
    );
    expect(scene.media?.variants[0].shader).toContain("background(rd)");
    expect(scene.media?.variants[1].shader).toContain("const vec3 BACKGROUND = vec3(0.067, 0.067, 0.067);");
  });

  it("says what is wrong", () => {
    expect(() => shaderOf("linear-gradient(red)")).toThrow("needs at least two colors");
    expect(() => shaderOf("linear-gradient(to middle, red, blue)")).toThrow("starts with an angle or a side");
    expect(() => shaderOf("radial-gradient(square, red, blue)")).toThrow("the shape is circle or ellipse");
    expect(() => shaderOf("linear-gradient(red, 2, blue)")).toThrow("expects colors");
  });

  it("reads the background from the direction of the ray, so reflections see where they point", () => {
    const shader = shaderOf("linear-gradient(red, blue)");
    expect(shader).toContain("vec3 background(vec3 rd) {");
    expect(shader).toContain("vec2 at = z > 0.001 ? 1.5 * d / z * size.y + 0.5 * size");
    expect(shader).toContain("at = clamp(at, vec2(0.0), size);");
    expect(shader).toContain("  camForward = forward;\n  camRight = right;\n  camUp = up;");
    expect(shaderOf("#000000")).not.toContain("camForward");
  });
});

describe("gradients on objects (decision 82)", () => {
  const sceneOf = (rule: string, shape = "cube") => compileScene(`@scene { ${shape} } ${shape} { ${rule} }`).shader;

  it("paints an object through its color, with any material", () => {
    const shader = sceneOf("size: 1 2 1; color: linear-gradient(#ff0000, #0000ff); material: metal(0.2);");
    expect(shader).toContain("vec3 gradientColor(float id, vec3 p, vec3 color) {");
    expect(shader).toContain("vec2 size = vec2(1.0, 2.0);");
    expect(shader).toContain("vec2 at = q.xy + 0.5 * size;");
    expect(shader).toContain("m.color = gradientColor(id, p, m.color);");
    expect(shader).toContain("metal(vec3(0.502, 0.0, 0.502)"); // the mean color, for getMaterial()
  });

  it("takes a gradient as the color of a material, which wins over color", () => {
    const shader = sceneOf("color: #ffffff; material: metal(radial-gradient(#ffd27a, #ff5a36), 0.3);", "sphere");
    expect(shader).toContain("float t = length(p / max(far * 1.41421356, vec2(0.0001)));");
    expect(shader).toContain("metal(vec3(1.0, 0.588, 0.345), 0.3)");
  });

  it("lets reflections see the gradient of an object", () => {
    const shader = compileScene(
      "@scene { sphere#m; cube } #m { translate: 1 1 0; material: chrome; } cube { color: linear-gradient(red, blue); }",
    ).shader;
    expect(shader).toContain("return diffuse(n, gradientColor(hit.y, p, getMaterial(hit.y).color));");
  });

  it("draws a plane from above, and keeps a texture painted over the gradient", () => {
    expect(sceneOf("size: 4 2; color: linear-gradient(red, blue);", "plane")).toContain("vec2 at = vec2(q.x, -q.z) + 0.5 * size;");
    const shader = sceneOf('color: linear-gradient(red, blue); texture: url("a.png");');
    expect(shader.indexOf("m.color = gradientColor(")).toBeLessThan(shader.indexOf("m.color = textureColor("));
    expect(shader.match(/vec3 space1\(/g)).toHaveLength(1); // one space function, shared
  });

  it("leaves the shaders of objects without a gradient as they were", () => {
    expect(sceneOf("color: #ff0000;")).not.toContain("gradientColor");
  });

  it("keeps the gradient of a material still: its color cannot change (decision 102)", () => {
    expect(() =>
      compileScene("@scene { cube } cube { material: metal(linear-gradient(red, blue)); animation: a 1s; } @keyframes a { to { color: red; } }"),
    ).toThrow("is painted with the gradient of its material: its color cannot change");
    expect(() =>
      compileScene("@scene { cube } cube { material: metal(linear-gradient(red, blue)); } cube:hover { color: red; }"),
    ).toThrow("is painted with the gradient of its material: its color cannot change");
  });
});
