import { describe, it, expect } from "vitest";
import { resolveMath, type CalcContext } from "./calc";
import { tokenize } from "./tokenizer";
import { compileGSS } from "./index";
import { GssError } from "./errors";

// "calc(2 * 3)" → the tokens left once the math is computed
const compute = (value: string, context: CalcContext = null) => resolveMath(tokenize(value), context);
const third: CalcContext = { siblingIndex: 3, siblingCount: 12 };

describe("resolveMath: calc()", () => {
  it("computes with numbers, and follows the order of operations", () => {
    expect(compute("calc(1 + 2 * 3)")).toEqual([{ type: "NUMBER", value: 7 }]);
    expect(compute("calc((1 + 2) * 3)")).toEqual([{ type: "NUMBER", value: 9 }]);
    expect(compute("calc(1 / 4)")).toEqual([{ type: "NUMBER", value: 0.25 }]);
  });

  it("keeps the unit: a number times an angle is an angle", () => {
    expect(compute("calc(3 * 30deg)")).toEqual([{ type: "DIMENSION", value: 90, unit: "deg" }]);
    expect(compute("calc(90deg / 3)")).toEqual([{ type: "DIMENSION", value: 30, unit: "deg" }]);
  });

  it("brings angles and durations back to deg and s, so they can be added", () => {
    expect(compute("calc(90deg + 0.25turn)")).toEqual([{ type: "DIMENSION", value: 180, unit: "deg" }]);
    expect(compute("calc(1s + 500ms)")).toEqual([{ type: "DIMENSION", value: 1.5, unit: "s" }]);
  });

  it("dividing two angles gives a number", () => {
    expect(compute("calc(90deg / 30deg)")).toEqual([{ type: "NUMBER", value: 3 }]);
  });

  it("only replaces the math: the other tokens of the value stay", () => {
    expect(compute("calc(1 + 1) 0.5 calc(2 * 2)")).toEqual([
      { type: "NUMBER", value: 2 },
      { type: "NUMBER", value: 0.5 },
      { type: "NUMBER", value: 4 },
    ]);
  });

  it("computes math inside another function: metal(#fff, calc(0.1 * 2))", () => {
    expect(compute("metal(#fff, calc(0.1 * 2))")).toEqual(tokenize("metal(#fff, 0.2)"));
  });

  it("returns the same array when there is nothing to compute", () => {
    const value = tokenize("0 1 0");
    expect(resolveMath(value, null)).toBe(value);
  });
});

describe("resolveMath: sibling-index() and sibling-count()", () => {
  it("gives the position of the object, and the number of siblings", () => {
    expect(compute("sibling-index()", third)).toEqual([{ type: "NUMBER", value: 3 }]);
    expect(compute("calc(sibling-index() * 360deg / sibling-count())", third)).toEqual([
      { type: "DIMENSION", value: 90, unit: "deg" },
    ]);
  });

  it("has no meaning outside an object: the scene, @keyframes", () => {
    expect(() => compute("calc(sibling-index() * 2)")).toThrow(/only works in a rule that styles objects/);
  });
});

describe("resolveMath: the other functions", () => {
  it("sin(), cos() and tan() take an angle, or radians", () => {
    expect(compute("cos(90deg)")).toEqual([{ type: "NUMBER", value: 0 }]);
    expect(compute("sin(0.25turn)")).toEqual([{ type: "NUMBER", value: 1 }]);
    expect(compute("calc(cos(pi) * 2)")).toEqual([{ type: "NUMBER", value: -2 }]);
  });

  it("min(), max(), clamp(), abs(), sqrt(), pow()", () => {
    expect(compute("min(3, 1, 2)")).toEqual([{ type: "NUMBER", value: 1 }]);
    expect(compute("max(10deg, 20deg)")).toEqual([{ type: "DIMENSION", value: 20, unit: "deg" }]);
    expect(compute("clamp(0, 1.5, 1)")).toEqual([{ type: "NUMBER", value: 1 }]);
    expect(compute("abs(-2)")).toEqual([{ type: "NUMBER", value: 2 }]);
    expect(compute("sqrt(16)")).toEqual([{ type: "NUMBER", value: 4 }]);
    expect(compute("pow(2, 3)")).toEqual([{ type: "NUMBER", value: 8 }]);
  });
});

describe("resolveMath: errors that say what to do", () => {
  const message = (value: string) => {
    try {
      compute(value, third);
    } catch (error) {
      return (error as Error).message;
    }
    return "no error";
  };

  it("refuses to add a number and an angle", () => {
    expect(message("calc(1 + 30deg)")).toBe("Cannot add a number and a deg value");
  });
  it("refuses to multiply two angles", () => {
    expect(message("calc(30deg * 2deg)")).toMatch(/one of them must be a number/);
  });
  it("asks for spaces around a minus, like CSS", () => {
    expect(message("calc(2 -1)")).toMatch(/Put spaces around "-"/);
  });
  it("refuses a division by zero", () => {
    expect(message("calc(1 / 0)")).toBe("Division by zero");
  });
  it("points at the whole call", () => {
    const source = "translate: calc(1 + 30deg) 0 0";
    try {
      resolveMath(tokenize(source), null);
    } catch (error) {
      expect(error).toBeInstanceOf(GssError);
      expect(source.slice((error as GssError).start, (error as GssError).end)).toBe("calc(1 + 30deg)");
    }
  });
});

describe("calc() in a scene", () => {
  it("gives each copy of a multiplied object its own value", () => {
    const shader = compileGSS(
      "@scene { cube.step * 3; } .step { translate: calc(sibling-index() * 1.5) 0.5 0; }",
    );
    expect(shader).toContain("vec3(1.5, 0.5, 0.0)");
    expect(shader).toContain("vec3(3.0, 0.5, 0.0)");
    expect(shader).toContain("vec3(4.5, 0.5, 0.0)");
  });

  it("works in the scene and in @keyframes, without sibling-index()", () => {
    expect(() =>
      compileGSS(
        "@scene { sphere; } scene { camera-distance: calc(2 * 4); } sphere { animation: up 2s; } @keyframes up { to { translate: 0 calc(1 + 1) 0; } }",
      ),
    ).not.toThrow();
  });

  it("refuses sibling-index() in @keyframes, where every object shares the same frames", () => {
    expect(() =>
      compileGSS("@scene { sphere; } sphere { animation: up 2s; } @keyframes up { to { translate: 0 sibling-index() 0; } }"),
    ).toThrow(/only works in a rule that styles objects/);
  });
});
