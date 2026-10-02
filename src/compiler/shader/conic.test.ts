import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { gradientLines, isGradient, gradientMean } from "./gradient";
import { compileScene } from "../index";

const lines = (text: string) => gradientLines(tokenize(text)).join("\n");

describe("conic-gradient()", () => {
  it("is a gradient, with its repeating form", () => {
    expect(isGradient(tokenize("conic-gradient(red, blue)"))).toBe(true);
    expect(isGradient(tokenize("repeating-conic-gradient(red, blue 10%)"))).toBe(true);
  });

  it("turns clockwise from the top, around the center, like CSS", () => {
    const code = lines("conic-gradient(red, blue)");
    expect(code).toContain("vec2 c = vec2(0.5, 0.5) * size;");
    // atan(x, y): 0 straight up, a quarter turn to the right
    expect(code).toContain("atan(p.x, p.y)");
    expect(code).toContain("float t = fract(");
  });

  it("starts from an angle, around a position", () => {
    const code = lines("conic-gradient(from 90deg at 25% 75%, red, blue)");
    expect(code).toContain("vec2 c = vec2(0.25, 0.25) * size;");
    expect(code).toContain("- 0.25");
    expect(lines("conic-gradient(from 0.5turn, red, blue)")).toContain("- 0.5");
    expect(lines("conic-gradient(at left top, red, blue)")).toContain("vec2 c = vec2(0.0, 1.0) * size;");
  });

  it("places its stops with angles or percentages", () => {
    const code = lines("conic-gradient(red 0deg 90deg, blue 90deg 50%, green 0.75turn)");
    expect(code).toContain("step(0.25, t)"); // a hard edge at a quarter turn
    expect(code).toContain("clamp((t - 0.5) / 0.25, 0.0, 1.0)");
  });

  it("repeats with repeating-conic-gradient()", () => {
    expect(lines("repeating-conic-gradient(red 0deg, blue 30deg)")).toContain(
      "t = 0.0 + mod(t - 0.0, 0.083333);",
    );
  });

  it("gives a mean color to the reflections", () => {
    expect(gradientMean(tokenize("conic-gradient(from 10deg, #000000, #ffffff)"))).toBe("808080");
  });

  it.each([
    ["conic-gradient(from red, blue)", /from <angle>/],
    ["conic-gradient(from 90deg at 10px, red, blue)", /position/],
    ["conic-gradient(red 2, blue)", /angles or percentages/],
    ["linear-gradient(red 90deg, blue)", /percentages/],
  ])("refuses %s", (text, message) => {
    expect(() => lines(text)).toThrow(message);
  });

  it("paints the background, an object and a material, in GLSL and WGSL", () => {
    const compiled = compileScene(
      "@scene { cube; sphere; } scene { background: conic-gradient(#1c1c24, #3a3a4a, #1c1c24); } cube { color: conic-gradient(from 45deg, #ff5a36, #3a7bff, #ff5a36); } sphere { material: metal(repeating-conic-gradient(#ffd27a 0deg 15deg, #ff5a36 15deg 30deg), 0.2); }",
    );
    expect(compiled.shader.match(/atan\(p\.x, p\.y\)/g)?.length).toBe(3);
    expect(compiled.wgsl).toContain("atan2(");
  });

  it("takes currentColor in its stops", () => {
    const shader = (stops: string) =>
      compileScene(`@scene { cube; } cube { color: #ff5a36; material: metal(conic-gradient(${stops})); }`).shader;
    expect(shader("currentColor, white, currentColor")).toBe(shader("#ff5a36, white, #ff5a36"));
  });
});
