import { describe, it, expect } from "vitest";
import { compileFilter } from "./filter";
import { tokenize } from "../syntax/tokenizer";
import { compileScene } from "../index";

const filter = (value: string) => compileFilter(tokenize(value));
const sceneWith = (value: string) => compileScene(`@scene { sphere } scene { filter: ${value}; }`);

describe("filter: the pixel filters, at the end of the scene's shader (decision 83)", () => {
  it("adds nothing without a filter, or with none", () => {
    expect(compileScene("@scene { sphere }").passes).toBeUndefined();
    expect(sceneWith("none").shader).toBe(compileScene("@scene { sphere }").shader);
  });

  it("writes brightness(), contrast() and invert() in order, without a pass", () => {
    const scene = sceneWith("brightness(1.2) contrast(50%) invert(0.25)");
    expect(scene.passes).toBeUndefined();
    const lines = scene.shader.split("\n");
    const at = (text: string) => lines.findIndex((l) => l.includes(text));
    expect(at("c = clamp(c * 1.2, 0.0, 1.0);")).toBeGreaterThan(0);
    expect(at("c = clamp((c - 0.5) * 0.5 + 0.5, 0.0, 1.0);")).toBeGreaterThan(at("c * 1.2"));
    expect(at("c = mix(c, 1.0 - c, 0.25);")).toBeGreaterThan(at("(c - 0.5)"));
    expect(scene.shader).toContain("  col = c;\n  outColor = vec4(col, 1.0);");
  });

  it("uses the color matrices of CSS: grayscale(1) gives the luminance, hue-rotate(0) changes nothing", () => {
    expect(filter("grayscale(1)").sceneLines[0]).toContain("dot(vec3(0.2126, 0.7152, 0.0722), c)");
    expect(filter("hue-rotate(0deg)").sceneLines[0]).toContain("dot(vec3(1.0, 0.0, 0.0), c)");
    expect(filter("saturate(1)").sceneLines[0]).toContain("dot(vec3(1.0, 0.0, 0.0), c)");
    expect(filter("sepia(0)").sceneLines[0]).toContain("dot(vec3(1.0, 0.0, 0.0), c)");
  });

  it("adds grain() and its noise function only when it is used", () => {
    expect(sceneWith("grain(0.08)").shader).toContain("float grain(vec2 pixel, float time)");
    expect(sceneWith("contrast(1.1)").shader).not.toContain("float grain(");
  });
});

describe("filter: blur() and bloom() add passes", () => {
  it("blurs in two passes, across then down, reading the image before", () => {
    const { sceneLines, passes } = filter("contrast(1.2) blur(4px) sepia(0.5)");
    expect(sceneLines).toHaveLength(1); // contrast() before the blur: in the scene's shader
    expect(passes.map((p) => p.inputs)).toEqual([[0], [1]]);
    expect(passes[0].shader).toContain("round(vec2(1.0, 0.0) * x)");
    expect(passes[1].shader).toContain("round(vec2(0.0, 1.0) * x)");
    expect(passes[1].shader).toContain("outColor = vec4(c, 1.0);"); // the last pass: opaque
    expect(passes[1].shader).toContain("float sigma = 4.0 * uRatio;");
    expect(passes[1].shader).toContain("dot(vec3(0.6965"); // sepia() after the blur: in its last pass
  });

  it("blooms in three passes: the bright parts across, down, then added to the image", () => {
    const { passes } = filter("bloom(0.8, 12px)");
    expect(passes.map((p) => p.inputs)).toEqual([[0], [1], [0, 2]]);
    expect(passes[0].shader).toContain("smoothstep(0.35, 0.9, dot(s.rgb, vec3(0.2126, 0.7152, 0.0722)))");
    expect(passes[2].shader).toContain("here0.rgb + 0.8 * texture(uInput1, uv).rgb");
  });

  it("chains several of them", () => {
    expect(filter("blur(2px) bloom()").passes.map((p) => p.inputs)).toEqual([[0], [1], [2], [3], [2, 4]]);
    expect(filter("blur(0)").passes).toEqual([]);
  });

  it("says what is wrong", () => {
    expect(() => filter("opacity(0.5)")).toThrow("opacity() goes on objects and groups: the scene itself stays opaque");
    expect(() => filter("drop-shadow(2px 2px 4px black)")).toThrow("drop-shadow() is not there yet");
    expect(() => filter("glow(1)")).toThrow('Unknown filter "glow()"');
    expect(() => filter("blur(4)")).toThrow("blur() expects a length in px");
    expect(() => filter("contrast(-1)")).toThrow("contrast() expects a positive number");
    expect(() => filter("sepia")).toThrow("filter expects a list of functions");
  });
});

describe("filter on objects and groups (decision 84)", () => {
  it("applies the pixel filters of an object to its own pixels, and in the reflections", () => {
    const { shader, passes } = compileScene(
      "@scene { sphere#a; sphere#b; } #a { translate: -1 1 0; filter: grayscale(1) brightness(1.5); } #b { translate: 1 1 0; material: chrome; }",
    );
    expect(passes).toBeUndefined();
    expect(shader).toContain("vec3 objectFilter(float id, vec3 c) {");
    expect(shader).toContain("if (t < MAX_DIST) col = objectFilter(id, col);");
    expect(shader).toContain("return objectFilter(hit.y, diffuse(n, getMaterial(hit.y).color));");
    expect(shader).toContain("outColor = vec4(col, 1.0);");
  });

  it("applies the object's filters, then its groups', from the inside out", () => {
    const { shader } = compileScene("@scene { group#g { cube } } #g { filter: invert(1); } cube { filter: contrast(2); }");
    const body = shader.slice(shader.indexOf("vec3 objectFilter"));
    expect(body.indexOf("(c - 0.5) * 2.0")).toBeLessThan(body.indexOf("mix(c, 1.0 - c, 1.0)"));
  });

  it("makes a layer of an object with a blur(): its number in the alpha, then five passes", () => {
    const { shader, passes } = compileScene("@scene { sphere; cube; } sphere { filter: blur(6px); }");
    expect(shader).toContain("if (id == 1.0) return 1.0 / 255.0;");
    expect(shader).toContain("outColor = vec4(col, t < MAX_DIST ? objectLayer(id) : 0.0);");
    expect(passes?.map((p) => p.inputs)).toEqual([[0], [1], [0], [3], [0, 2, 4]]);
    expect(passes?.[0].shader).toContain("abs(s.a * 255.0 - 1.0) < 0.5 ? 1.0 : 0.0");
    expect(passes?.[2].shader).toContain("abs(s.a * 255.0 - 1.0) < 0.5 ? 0.0 : 1.0"); // what is around
    expect(passes?.[4].shader).toContain("vec3 c = behind * (1.0 - layer.a) + layer.rgb;");
  });

  it("shares one layer between the objects of a group, and runs the scene's filter after the layers", () => {
    const { shader, passes } = compileScene(
      "@scene { group#g { cube * 3 } sphere } #g { filter: bloom(); } scene { filter: sepia(1); }",
    );
    expect(shader.match(/return 1\.0 \/ 255\.0;/g)).toHaveLength(3);
    expect(passes).toHaveLength(3);
    expect(passes?.[2].shader).toContain("dot(vec3(0.393"); // sepia(), after the bloom of the group
    expect(shader).not.toContain("dot(vec3(0.393"); // not in the scene's shader, which comes first
  });

  it("refuses a blur() on an object and on its group", () => {
    expect(() =>
      compileScene("@scene { group#g { cube } } #g { filter: blur(2px); } cube { filter: bloom(); }"),
    ).toThrow("not both");
  });
});
