import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import { parse } from "./parser";

const parseGSS = (source: string) => parse(tokenize(source));

describe("parse", () => {
  it("parses the content of @scene", () => {
    expect(parseGSS("@scene { cube.corner * 4; torus#hero; }").scene).toEqual([
      { tag: "cube", id: null, classes: ["corner"], count: 4 },
      { tag: "torus", id: "hero", classes: [], count: 1 },
    ]);
  });

  it("parses a rule and its declarations", () => {
    const { rules } = parseGSS(
      "torus#hero { radius: 1 0.28; rotate-x: 70deg; }",
    );
    expect(rules).toHaveLength(1);
    expect(rules[0].selector).toEqual([
      { type: "IDENT", value: "torus" },
      { type: "HASH", value: "hero" },
    ]);
    expect(rules[0].declarations).toEqual([
      {
        property: "radius",
        value: [
          { type: "NUMBER", value: 1 },
          { type: "NUMBER", value: 0.28 },
        ],
      },
      {
        property: "rotate-x",
        value: [{ type: "DIMENSION", value: 70, unit: "deg" }],
      },
    ]);
  });

  it("accepts a last declaration without semicolon", () => {
    expect(parseGSS("cube { size: 1 }").rules[0].declarations).toEqual([
      { property: "size", value: [{ type: "NUMBER", value: 1 }] },
    ]);
  });

  it("signals a missing brace", () => {
    expect(() => parseGSS("cube { size: 1;")).toThrow("Rule never closed");
  });
});
