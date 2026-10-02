import { describe, it, expect } from "vitest";
import { compileGSS } from "../../index";

const scene = (rules: string) => compileGSS(`@scene { sphere; } sphere { translate: 0 1 0; } ${rules}`);
const fog = (value: string, more = "") => scene(`scene { fog: ${value}; ${more} }`);

describe("fog: the values", () => {
  it("is off by default, and with none", () => {
    expect(fog("none")).toBe(scene(""));
    expect(scene("")).not.toContain("fogAmount");
  });

  it("fades the objects into the background behind them, from the start to the end", () => {
    const shader = fog("6 18");
    expect(shader).toContain("col = mix(col, BACKGROUND, fogAmount(t));");
    expect(shader).toContain("clamp((t - 6.0) / 12.0, 0.0, 1.0)");
  });

  it("takes a color, first or last, a name or a color function", () => {
    const shader = fog("#ff6347 4 16");
    expect(shader).toContain("col = mix(col, vec3(1.0, 0.388, 0.278), fogAmount(t));");
    expect(fog("tomato 4 16")).toBe(shader);
    expect(fog("4 16 tomato")).toBe(shader);
    expect(fog("rgb(255 99 71) 4 16")).toBe(shader);
  });

  it("covers the background too when it has a color: past the end, only the fog is seen", () => {
    expect(fog("#ff6347 4 16")).toMatch(/t < MAX_DIST \? .* : 1\.0/);
  });

  it("can start and end at the same distance: a sharp edge", () => {
    expect(() => fog("8 8")).not.toThrow();
  });

  it("clamps a computed start below 0, like CSS", () => {
    expect(fog("calc(-2) 6")).toBe(fog("0 6"));
  });

  it("says what is wrong", () => {
    for (const value of ["6", "red", "18 6", "-1 6", "red 1 2 3", "red blue 1 2", "6 18 20", "1deg 2"])
      expect(() => fog(value), value).toThrow("fog expects");
    expect(() => scene("sphere { fog: 6 18; }")).toThrow();
  });
});

describe("fog: moving", () => {
  it("follows the animation of the scene", () => {
    // An animation of the scene that leaves the fog alone writes none
    expect(scene("scene { animation: glow 4s; } @keyframes glow { to { background: #222222; } }")).not.toContain("fogAmount");
    const moving = compileGSS(
      "@scene { sphere; } scene { fog: 18 20; animation: mist 4s infinite alternate; } @keyframes mist { to { fog: #dfe7ef 2 8; } }",
    );
    expect(moving).toContain("fogAmount");
    expect(moving).toMatch(/fogAmount[\s\S]*iTime|iTime[\s\S]*fogAmount/);
  });

  it("moves from none to a fog", () => {
    expect(() =>
      compileGSS("@scene { sphere; } scene { animation: mist 4s; } @keyframes mist { from { fog: none; } to { fog: 2 8; } }"),
    ).not.toThrow();
  });

  it("follows a variable the scene animates", () => {
    expect(() =>
      compileGSS(
        "@scene { sphere; } scene { --far: 18; fog: 4 var(--far); animation: close 3s infinite alternate; } @keyframes close { to { --far: 6; } }",
      ),
    ).not.toThrow();
  });

  it("reads variables set from JS", () => {
    const shader = compileGSS(
      '@property --c { syntax: "<color>"; inherits: false; initial-value: #dfe7ef; } @property --far { syntax: "<number>"; inherits: false; initial-value: 16; } @scene { sphere; } scene { fog: var(--c) 4 var(--far); }',
    );
    expect(shader).toContain("uProperties");
    expect(shader).toContain("fogAmount");
  });

  it("is lowered to WGSL", () => {
    expect(compileGSS("@scene { sphere; } scene { fog: #dfe7ef 4 16; }", "wgsl")).toContain("fogAmount");
  });
});
