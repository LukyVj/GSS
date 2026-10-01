import { describe, it, expect } from "vitest";
import { compileScene } from "../index";
import { compileGSS } from "../index";

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

describe("var() in @keyframes", () => {
  it("animates a variable: what uses it moves with it", () => {
    const shader = compileGSS(
      "@scene { sphere } sphere { --y: 1; translate: 0 var(--y) 0; animation: up 2s; } @keyframes up { to { --y: 3; } }",
    );
    expect(shader).toContain("vec3(0.0, 1.0, 0.0)");
    expect(shader).toContain("vec3(0.0, 3.0, 0.0)");
  });

  it("follows a variable through another one, with the math", () => {
    const shader = compileGSS(
      "@scene { sphere } sphere { --h: 1; --top: calc(var(--h) * 2); translate: 0 var(--top) 0; animation: up 2s; } @keyframes up { to { --h: 3; } }",
    );
    expect(shader).toContain("vec3(0.0, 6.0, 0.0)");
  });

  it("reads the variables of each object in a shared @keyframes", () => {
    const shader = compileGSS(
      "@scene { sphere#a; sphere#b } #a { --top: 2; } #b { --top: 5; } sphere { animation: up 2s; } @keyframes up { to { translate: 0 var(--top) 0; } }",
    );
    expect(shader).toContain("vec3(0.0, 2.0, 0.0)");
    expect(shader).toContain("vec3(0.0, 5.0, 0.0)");
  });

  it("gives sibling-index() its meaning in a frame that uses variables", () => {
    const shader = compileGSS(
      "@scene { sphere * 2 } sphere { --k: 1; animation: up 2s; } @keyframes up { to { translate: 0 calc(var(--k) * sibling-index()) 0; } }",
    );
    expect(shader).toContain("vec3(0.0, 1.0, 0.0)");
    expect(shader).toContain("vec3(0.0, 2.0, 0.0)");
  });

  it("animates a variable on a group", () => {
    const shader = compileGSS(
      "@scene { group#g { sphere } } #g { --y: 0; translate: 0 var(--y) 0; animation: up 2s; } @keyframes up { to { --y: 4; } }",
    );
    expect(shader).toContain("vec3(0.0, 4.0, 0.0)");
  });

  it("rejects an animated variable used by a property that cannot be animated", () => {
    expect(() =>
      compileGSS(
        "@scene { sphere } sphere { --r: 1; radius: var(--r); animation: grow 2s; } @keyframes grow { to { --r: 2; } }",
      ),
    ).toThrow("radius cannot be animated, but it uses --r");
  });

  it("still reports a missing variable in a frame", () => {
    expect(() =>
      compileGSS(
        "@scene { sphere } sphere { animation: up 2s; } @keyframes up { to { translate: 0 var(--nope) 0; } }",
      ),
    ).toThrow("--nope is not defined");
  });
});

describe("dpr", () => {
  it("is auto in a scene that does not set it", () => {
    expect(compileScene("@scene { cube; }").dpr).toBe("auto");
  });

  it("gives the runtime the dpr of the scene", () => {
    expect(compileScene("@scene { cube; } scene { dpr: max; }").dpr).toBe(
      "max",
    );
    expect(compileScene("@scene { cube; } scene { dpr: 1.5; }").dpr).toBe(1.5);
  });

  it("reads a variable and the math, like every scene property", () => {
    expect(
      compileScene("@scene { cube; } scene { --d: 2; dpr: var(--d); }").dpr,
    ).toBe(2);
    expect(compileScene("@scene { cube; } scene { dpr: calc(1 / 2); }").dpr).toBe(
      0.5,
    );
  });

  it("points at the value when it is wrong", () => {
    expect(() => compileScene("@scene { cube; } scene { dpr: 8; }")).toThrow(
      "dpr expects",
    );
  });
});
