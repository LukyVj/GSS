import { describe, it, expect } from "vitest";
import { resolveMath, type CalcContext } from "./calc";
import { tokenize } from "../syntax/tokenizer";
import { compileGSS } from "../index";
import { GssError } from "../syntax/errors";

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

describe("resolveMath: the functions added with decision 78", () => {
  const n = (value: string) => (compute(value, third)[0] as { value: number }).value;
  const unit = (value: string) => (compute(value, third)[0] as { unit?: string }).unit;

  it("asin(), acos(), atan() and atan2() return an angle in deg", () => {
    expect(compute("asin(1)")).toEqual([{ type: "DIMENSION", value: 90, unit: "deg" }]);
    expect(n("acos(0.5)")).toBe(60);
    expect(n("atan(1)")).toBe(45);
    expect(n("atan2(1, -1)")).toBe(135);
    expect(unit("atan2(1deg, -1deg)")).toBe("deg");
  });

  it("sign() gives -1, 0 or 1", () => {
    expect(n("sign(-3deg)")).toBe(-1);
    expect(n("sign(0)")).toBe(0);
    expect(n("calc(sign(sibling-index() - 2) * 5)")).toBe(5);
  });

  it("round(): nearest by default, halfway goes up, a step, and the four strategies", () => {
    expect(n("round(2.5)")).toBe(3);
    expect(n("round(-2.5)")).toBe(-2);
    expect(n("round(2.6, 0.5)")).toBe(2.5);
    expect(n("round(up, 2.1)")).toBe(3);
    expect(n("round(down, 2.9)")).toBe(2);
    expect(n("round(to-zero, -2.9)")).toBe(-2);
    expect(compute("round(37deg, 15deg)")).toEqual([{ type: "DIMENSION", value: 30, unit: "deg" }]);
  });

  it("mod() takes the sign of the divisor, rem() the sign of the value", () => {
    expect(n("mod(7, 3)")).toBe(1);
    expect(n("mod(-7, 3)")).toBe(2);
    expect(n("rem(-7, 3)")).toBe(-1);
    expect(n("mod(400deg, 1turn)")).toBe(40);
  });

  it("hypot(), log() and exp()", () => {
    expect(n("hypot(3, 4)")).toBe(5);
    expect(n("log(8, 2)")).toBe(3);
    expect(n("log(e)")).toBe(1);
    expect(n("exp(0)")).toBe(1);
  });

  it("progress() goes from 0 to 1 between a start and an end, clamped like CSS", () => {
    expect(n("progress(sibling-index(), 1, 5)")).toBe(0.5);
    expect(n("progress(15, 0, 10)")).toBe(1);
    expect(n("progress(-5, 0, 10)")).toBe(0);
  });

  it("says what is wrong", () => {
    const message = (value: string) => {
      try {
        compute(value);
      } catch (error) {
        return (error as Error).message;
      }
      return "no error";
    };
    expect(message("mod(7deg, 3)")).toBe("mod() mixes a deg value and a number");
    expect(message("mod(7, 0)")).toBe("mod() cannot divide by 0");
    expect(message("round(sideways, 2)")).toMatch(/is not a value math can use/);
    expect(message("asin(30deg)")).toBe("asin() expects a number, not a deg value");
    expect(message("progress(1, 2, 2)")).toMatch(/start and an end that differ/);
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
