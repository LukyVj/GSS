import { describe, it, expect } from "vitest";
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "./registry";
import { MATH_FUNCTIONS } from "./calc";
import { shapeNames } from "./codegen";
import { compileGSS } from "./index";

describe("registry", () => {
  it("has no duplicate property names", () => {
    const names = PROPERTIES.map((property) => property.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every property a description and at least one example", () => {
    for (const property of PROPERTIES) {
      expect(property.description, property.name).not.toBe("");
      expect(property.examples.length, property.name).toBeGreaterThan(0);
    }
  });

  it("uses the property in each of its examples", () => {
    for (const property of PROPERTIES) {
      for (const example of property.examples) {
        expect(example, property.name).toContain(`${property.name}:`);
      }
    }
  });

  describe("every documented example compiles", () => {
    for (const property of PROPERTIES) {
      for (const example of property.examples) {
        it(`${property.name}: ${example}`, () => {
          expect(() => compileGSS(example)).not.toThrow();
        });
      }
    }
  });

  describe("animatable properties", () => {
    const animatable = PROPERTIES.filter((property) => property.animatable);

    it("marks the properties the compiler can animate", () => {
      expect(animatable.map((property) => property.name)).toEqual([
        "translate",
        "color",
        "rotate-x",
        "rotate-y",
        "rotate-z",
        "scale",
      ]);
    });

    // If a property is marked animatable, the compiler must really animate it
    for (const property of animatable) {
      it(`animates ${property.name}`, () => {
        const shader = compileGSS(
          `@scene { cube; } cube { animation: k 1s; } @keyframes k { to { ${property.name}: ${property.initial}; } }`,
        );
        expect(shader).toContain("mix(");
      });
    }
  });
});

describe("at-rules", () => {
  it("has no duplicate at-rule names", () => {
    const names = AT_RULES.map((atRule) => atRule.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("documents @scene and @keyframes", () => {
    expect(AT_RULES.map((atRule) => atRule.name)).toEqual([
      "scene",
      "keyframes",
    ]);
  });

  it("gives every at-rule a description and at least one example", () => {
    for (const atRule of AT_RULES) {
      expect(atRule.description, atRule.name).not.toBe("");
      expect(atRule.examples.length, atRule.name).toBeGreaterThan(0);
    }
  });

  it("uses the at-rule in each of its examples", () => {
    for (const atRule of AT_RULES) {
      for (const example of atRule.examples) {
        expect(example, atRule.name).toContain(`@${atRule.name}`);
      }
    }
  });

  describe("every documented example compiles", () => {
    for (const atRule of AT_RULES) {
      for (const example of atRule.examples) {
        it(`@${atRule.name}: ${example}`, () => {
          expect(() => compileGSS(example)).not.toThrow();
        });
      }
    }
  });
});

describe("selectors", () => {
  it("has no duplicate anchors", () => {
    const anchors = SELECTORS.map((selector) => selector.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("gives every selector a description and at least one example", () => {
    for (const selector of SELECTORS) {
      expect(selector.description, selector.name).not.toBe("");
      expect(selector.examples.length, selector.name).toBeGreaterThan(0);
    }
  });

  describe("every documented example compiles", () => {
    for (const selector of SELECTORS) {
      for (const example of selector.examples) {
        it(`${selector.name}: ${example}`, () => {
          expect(() => compileGSS(example)).not.toThrow();
        });
      }
    }
  });
});

describe("shapes", () => {
  it("documents every shape the compiler can draw, and only those (plus group)", () => {
    const documented = SHAPE_DOCS.map((shape) => shape.name).sort();
    expect(documented).toEqual([...shapeNames(), "group"].sort());
  });

  it("lists only real properties in takes", () => {
    const names = PROPERTIES.map((property) => property.name);
    for (const shape of SHAPE_DOCS) {
      for (const name of shape.takes ?? []) expect(names, shape.name).toContain(name);
    }
  });

  it("gives every shape a description and at least one example", () => {
    for (const shape of SHAPE_DOCS) {
      expect(shape.description, shape.name).not.toBe("");
      expect(shape.examples.length, shape.name).toBeGreaterThan(0);
    }
  });

  it("uses the shape in each of its examples", () => {
    for (const shape of SHAPE_DOCS) {
      for (const example of shape.examples) {
        expect(example, shape.name).toContain(`@scene { ${shape.name}`);
      }
    }
  });

  describe("every documented example compiles", () => {
    for (const shape of SHAPE_DOCS) {
      for (const example of shape.examples) {
        it(`${shape.name}: ${example}`, () => {
          expect(() => compileGSS(example)).not.toThrow();
        });
      }
    }
  });
});

describe("functions", () => {
  it("documents every math function the compiler computes, and only those", () => {
    const documented = FUNCTIONS.flatMap((fn) => fn.covers).sort();
    expect(documented).toEqual([...MATH_FUNCTIONS].sort());
  });

  it("has no duplicate anchors", () => {
    const anchors = FUNCTIONS.map((fn) => fn.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("gives every function a description and at least one example", () => {
    for (const fn of FUNCTIONS) {
      expect(fn.description, fn.name).not.toBe("");
      expect(fn.examples.length, fn.name).toBeGreaterThan(0);
    }
  });

  describe("every documented example compiles", () => {
    for (const fn of FUNCTIONS) {
      for (const example of fn.examples) {
        it(`${fn.name}: ${example}`, () => {
          expect(() => compileGSS(example)).not.toThrow();
        });
      }
    }
  });
});
