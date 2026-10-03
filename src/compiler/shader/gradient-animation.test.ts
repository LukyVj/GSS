import { describe, it, expect } from "vitest";
import { compileScene } from "../index";

const objectShader = (rule: string, more = "") =>
  compileScene(`@scene { cube } cube { ${rule} } ${more}`).shader;

// The body of gradientColor(): the gradient of the painted object
const gradientOf = (shader: string) => shader.slice(shader.indexOf("vec3 gradientColor("));

describe("animated gradients (decision 102)", () => {
  it("animates a gradient through a variable, like a registered @property in CSS", () => {
    const shader = objectShader(
      "--angle: 0deg; color: linear-gradient(var(--angle), red, blue); animation: spin 4s;",
      "@keyframes spin { to { --angle: 360deg; } }",
    );
    const body = gradientOf(shader);
    // The angle turns with the time: 0 to a full turn, in radians
    expect(body).toContain("vec2 dir = vec2(sin(mix(0.0, 6.283185, ");
    expect(body).toContain("iTime / 4.0");
    // The colors do not change: they stay constants
    expect(body).toContain("vec3 col = vec3(1.0, 0.0, 0.0);");
  });

  it("interpolates a gradient written in @keyframes into another of the same kind", () => {
    const body = gradientOf(
      objectShader(
        "color: linear-gradient(red, blue); animation: swap 2s alternate;",
        "@keyframes swap { to { color: linear-gradient(blue, red); } }",
      ),
    );
    expect(body).toContain("vec3 col = mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), ");
    expect(body).toContain("col = mix(col, mix(vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), ");
    // The direction does not change: the line of a still gradient
    expect(body).toContain("vec2 dir = vec2(0.0, -1.0);");
  });

  it("moves the stops: a segment never divides by zero", () => {
    const body = gradientOf(
      objectShader(
        "color: linear-gradient(red 0%, blue 20%); animation: open 2s;",
        "@keyframes open { to { color: linear-gradient(red 0%, blue 100%); } }",
      ),
    );
    expect(body).toContain("clamp((t - 0.0) / max(mix(0.2, 1.0, ");
  });

  it("moves the repeated pattern of a repeating gradient", () => {
    const body = gradientOf(
      objectShader(
        "color: repeating-linear-gradient(red 0%, blue 10%); animation: grow 2s;",
        "@keyframes grow { to { color: repeating-linear-gradient(red 0%, blue 30%); } }",
      ),
    );
    expect(body).toContain("t = 0.0 + mod(t - 0.0, max(mix(0.1, 0.3, ");
  });

  it("turns from a side or a corner to an angle", () => {
    const body = gradientOf(
      objectShader(
        "color: linear-gradient(to top right, red, blue); animation: a 2s;",
        "@keyframes a { to { color: linear-gradient(to left, red, blue); } }",
      ),
    );
    // A corner depends on the size of the box; to left is 270deg, like CSS
    expect(body).toContain("vec2 dir = vec2(sin(mix(atan(1.0 * size.y, 1.0 * size.x), 4.712389, ");
  });

  it("moves the center of a radial gradient and turns a conic one", () => {
    const radial = gradientOf(
      objectShader(
        "color: radial-gradient(circle at 0% 50%, red, blue); animation: a 2s;",
        "@keyframes a { to { color: radial-gradient(circle at 100% 50%, red, blue); } }",
      ),
    );
    expect(radial).toContain("vec2 c = vec2(mix(0.0, 1.0, ");
    const conic = gradientOf(
      objectShader(
        "color: conic-gradient(red, blue); animation: a 2s;",
        "@keyframes a { to { color: conic-gradient(from 180deg, red, blue); } }",
      ),
    );
    expect(conic).toContain(" / 6.2831853 - mix(0.0, 0.5, ");
  });

  it("changes a gradient on :hover, and glides with transition", () => {
    const scene = compileScene(
      "@scene { cube } cube { color: linear-gradient(red, blue); transition: 0.3s; } cube:hover { color: linear-gradient(blue, red); }",
    );
    expect(gradientOf(scene.shader)).toContain(
      "vec3 col = mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), uHover[0]);",
    );
    expect(scene.transitions[0].enter).not.toBeNull();
  });

  it("keeps the line of a still gradient when the animation does not touch it", () => {
    const still = objectShader("color: linear-gradient(90deg, red, blue);");
    const moving = objectShader(
      "color: linear-gradient(90deg, red, blue); animation: up 2s;",
      "@keyframes up { to { translate: 0 2 0; } }",
    );
    const lines = (shader: string) => gradientOf(shader).split("return col;")[0];
    expect(lines(moving)).toBe(lines(still));
  });

  it("only interpolates gradients of the same kind, with as many colors", () => {
    const play = (from: string, to: string) => () =>
      objectShader(`color: ${from}; animation: a 2s;`, `@keyframes a { to { color: ${to}; } }`);
    expect(play("linear-gradient(red, blue)", "radial-gradient(red, blue)")).toThrow(
      "a linear-gradient() can only change into another linear-gradient()",
    );
    expect(play("linear-gradient(red, blue)", "repeating-linear-gradient(red, blue)")).toThrow(
      "a linear-gradient() can only change into another linear-gradient()",
    );
    expect(play("linear-gradient(red, blue)", "linear-gradient(red, lime, blue)")).toThrow(
      "with as many colors: 2 here, 3 there",
    );
    expect(play("radial-gradient(circle, red, blue)", "radial-gradient(ellipse, red, blue)")).toThrow(
      "the same shape and size",
    );
    expect(play("linear-gradient(red, blue)", "red")).toThrow(
      "a gradient can only change into another gradient",
    );
    expect(() =>
      compileScene("@scene { cube } cube { color: linear-gradient(red, blue); } cube:hover { color: red; }"),
    ).toThrow("a gradient can only change into another gradient");
  });

  it("is still a gradient for reflections and getMaterial(): the mean of its first frame", () => {
    const shader = objectShader(
      "color: linear-gradient(red, blue); animation: a 2s;",
      "@keyframes a { to { color: linear-gradient(blue, red); } }",
    );
    expect(shader).toMatch(/if \(id == 1\.0\) return matte\(vec3\([\d., ]+\)\);/);
  });
});

describe("an animation on the scene (decision 103)", () => {
  it("animates the color of the background", () => {
    const shader = compileScene(
      "@scene { sphere } scene { background: #000000; animation: glow 2s alternate; } @keyframes glow { to { background: #ffffff; } }",
    ).shader;
    expect(shader).toContain("vec3 background(vec3 rd) {");
    expect(shader).toContain("return mix(vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0), ");
    expect(shader).toContain("#define BACKGROUND background(rd)");
    expect(shader).not.toContain("const vec3 BACKGROUND");
  });

  it("animates a background gradient through a variable of the scene", () => {
    const shader = compileScene(
      "@scene { } scene { --angle: 0deg; floor: none; background: linear-gradient(var(--angle), #ff6540, #722cff); animation: spin 12s; } @keyframes spin { to { --angle: 1turn; } }",
    ).shader;
    const body = shader.slice(shader.indexOf("vec3 background(vec3 rd)"));
    expect(body).toContain("vec2 dir = vec2(sin(mix(0.0, 6.283185, ");
    expect(body).toContain("iTime / 12.0");
  });

  it("follows a scroll() timeline", () => {
    const scene = compileScene(
      "@scene { sphere } scene { background: #000000; animation: glow 1s; animation-timeline: scroll(); } @keyframes glow { to { background: #ffffff; } }",
    );
    expect(scene.timelines).toHaveLength(1);
    expect(scene.shader).toContain("uTimeline");
  });

  it("only changes the background", () => {
    expect(() =>
      compileScene("@scene { sphere } scene { animation: a 2s; } @keyframes a { to { translate: 0 1 0; } }"),
    ).toThrow("On the scene, an animation only changes background");
    // The sun moves too since decision 110, through a variable of the scene as well
    expect(
      compileScene(
        "@scene { sphere } scene { --l: 0deg 45deg; light: var(--l); animation: a 2s; } @keyframes a { to { --l: 90deg 45deg; } }",
      ).shader,
    ).toContain("normalize(mix(");
  });

  it("leaves a scene without animation as it was", () => {
    const shader = compileScene("@scene { sphere } scene { background: #000000; }").shader;
    expect(shader).toContain("const vec3 BACKGROUND = vec3(0.0, 0.0, 0.0);");
  });
});
