import { describe, it, expect } from "vitest";
import { PROPERTIES } from "./registry";
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
});
