import { describe, it, expect } from "vitest";
import { compileScene } from "./index";
import { compileGSS } from "./index";

describe("compileScene", () => {
  it("counts the objects of the scene, multiplied ones included", () => {
    expect(
      compileScene("@scene { cube.corner * 4; sphere#dot; }").objects,
    ).toBe(5);
  });
  it("counts no object in an empty scene", () => {
    expect(compileScene("@scene { }").objects).toBe(0);
  });
});

describe("var()", () => {
  it("reads a variable of the scene, like :root", () => {
    expect(
      compileGSS(
        "@scene { sphere } scene { --r: 2; } sphere { radius: var(--r); }",
      ),
    ).toContain("sdSphere(q, 2.0)");
  });

  it("inherits a variable from a group", () => {
    expect(
      compileGSS(
        "@scene { group#g { sphere } } #g { --r: 3; } sphere { radius: var(--r); }",
      ),
    ).toContain("sdSphere(q, 3.0)");
  });

  it("lets the closest level win: object > group > scene", () => {
    const source = `
      @scene { group#g { sphere#a; sphere#b } }
      scene { --r: 1; }
      #g { --r: 2; }
      #b { --r: 4; }
      sphere { radius: var(--r); }`;
    const shader = compileGSS(source);
    expect(shader).toContain("sdSphere(q, 2.0)"); // #a gets the group's value
    expect(shader).toContain("sdSphere(q, 4.0)"); // #b overrides it
  });

  it("does not leak a variable to a sibling", () => {
    expect(() =>
      compileGSS(
        "@scene { sphere#a; sphere#b } #a { --r: 2; } sphere { radius: var(--r); }",
      ),
    ).toThrow("--r is not defined");
  });

  it("computes the math after the variables", () => {
    expect(
      compileGSS(
        "@scene { sphere } scene { --r: 2; } sphere { radius: calc(var(--r) * 2); }",
      ),
    ).toContain("sdSphere(q, 4.0)");
  });
  it("resolves a variable that uses another", () => {
    expect(
      compileGSS(
        "@scene { sphere } scene { --size: 2; --big: calc(var(--size) * 2); } sphere { radius: var(--big); }",
      ),
    ).toContain("sdSphere(q, 4.0)");
  });
});
