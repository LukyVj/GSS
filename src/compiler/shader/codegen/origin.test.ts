import { describe, it, expect } from "vitest";
import { tokenize } from "../../syntax/tokenizer";
import { readOrigin } from "./origin";
import { compileGSS } from "../../index";

// A box 2 wide, 1 high and 4 deep: left is -1, top is 0.5
const box = [2, 1, 4];
const origin = (value: string) => readOrigin(box)(tokenize(value));
const onGroup = (value: string) => readOrigin()(tokenize(value));

describe("transform-origin: the values, like CSS", () => {
  it("is the center by default, and for center or 50% 50%", () => {
    expect(readOrigin(box)(undefined)).toBe("vec3(0.0)");
    expect(origin("center")).toBe("vec3(0.0)");
    expect(origin("50% 50% 0")).toBe("vec3(0.0)");
  });

  it("reads the keywords on the box of the object, top up", () => {
    expect(origin("left")).toBe("vec3(-1.0, 0.0, 0.0)");
    expect(origin("bottom")).toBe("vec3(0.0, -0.5, 0.0)");
    expect(origin("right top")).toBe("vec3(1.0, 0.5, 0.0)");
    expect(origin("top right")).toBe("vec3(1.0, 0.5, 0.0)");
    expect(origin("center left")).toBe("vec3(-1.0, 0.0, 0.0)");
  });

  it("reads percentages from the left and the top, like CSS", () => {
    expect(origin("0% 100%")).toBe("vec3(-1.0, -0.5, 0.0)");
    expect(origin("75%")).toBe("vec3(0.5, 0.0, 0.0)");
    expect(origin("left 25%")).toBe("vec3(-1.0, 0.25, 0.0)");
  });

  it("reads numbers from the center, y up, like translate, and z as a number", () => {
    expect(origin("0.5 1 0")).toBe("vec3(0.5, 1.0, 0.0)");
    expect(origin("-0.25")).toBe("vec3(-0.25, 0.0, 0.0)");
    expect(origin("25% 0 0.5")).toBe("vec3(-0.5, 0.0, 0.5)");
    expect(origin("right bottom -2")).toBe("vec3(1.0, -0.5, -2.0)");
  });

  it("takes numbers and center on a group, which has no box", () => {
    expect(onGroup("0 1 0")).toBe("vec3(0.0, 1.0, 0.0)");
    expect(onGroup("center")).toBe("vec3(0.0)");
    expect(() => onGroup("left")).toThrow("A group has no box");
    expect(() => onGroup("50% 0")).toThrow("A group has no box");
  });

  it("says what is wrong", () => {
    for (const value of ["left right", "top bottom", "top 50%", "1 2 3 4", "0 0 10%", "0 0 left", "2deg", "red"])
      expect(() => origin(value), value).toThrow("transform-origin expects");
  });
});

describe("transform-origin in the shader", () => {
  const scene = (rule: string) => compileGSS(`@scene { cube; } cube { translate: 0 1 0; rotate-z: 30deg; ${rule} }`);

  it("changes nothing at the center", () => {
    expect(scene("transform-origin: center;")).toBe(scene(""));
    expect(scene("transform-origin: 0 0 0;")).toBe(scene(""));
  });

  it("goes to the point before the rotations and scale, and comes back after them", () => {
    const shader = scene("transform-origin: left; scale: 2;");
    const order = [
      "q -= vec3(0.0, 1.0, 0.0);",
      "q -= vec3(-0.5, 0.0, 0.0);",
      "q.xy *= rot(",
      "q /= 2.0;",
      "q += vec3(-0.5, 0.0, 0.0);",
    ].map((line) => shader.indexOf(line));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("tests the bounding sphere of an object around its origin", () => {
    const shader = compileGSS(
      "@scene { prism; } prism { d: polygon(0 1, 1 -1, -1 -1); translate: 0 1 0; transform-origin: 1.5 0 0; rotate-z: 120deg; }",
    );
    expect(shader).toContain("length(q - vec3(1.5, 0.0, 0.0))");
  });

  it("reads a number or a percentage set from JS, and then gives up the object's own sphere", () => {
    const shader = compileGSS(
      '@property --o { syntax: "<number>"; inherits: false; initial-value: 0.5; } @property --p { syntax: "<percentage>"; inherits: false; initial-value: 0%; } @scene { cube; prism; } cube { transform-origin: var(--o) 0 0; rotate-z: 30deg; } prism { d: polygon(0 1, 1 -1, -1 -1); transform-origin: var(--p) top; rotate-z: 30deg; }',
    );
    expect(shader).toMatch(/vec3\(uProperties\[0\]\.x, 0\.0, 0\.0\)/);
    expect(shader).toMatch(/uProperties\[1\]\.x \/ 100\.0/);
    expect(shader).not.toContain("length(q - ");
  });

  it("moves on a group, and can be animated and changed by :hover", () => {
    expect(() =>
      compileGSS(
        "@scene { group#g { cube; } } #g { transform-origin: 0 1 0; rotate-z: 30deg; } cube { transform-origin: right; animation: swing 2s infinite alternate; } cube:hover { transform-origin: left; } @keyframes swing { to { transform-origin: top; rotate-z: 40deg; } }",
      ),
    ).not.toThrow();
  });
});
