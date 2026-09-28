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
    expect(() => parseGSS("cube { size: 1;")).toThrow("Block never closed");
  });

  it("parses a @keyframes block", () => {
    const { keyframes } = parseGSS(`
      @keyframes float {
        from { translate: 0 1 0; }
        50%  { translate: 0 2 0; }
        to   { translate: 0 1.4 0; }
      }
    `);
    expect(keyframes).toHaveLength(1);
    expect(keyframes[0].name).toBe("float");
    expect(keyframes[0].frames).toHaveLength(3);
    expect(keyframes[0].frames[1].offsets).toEqual([
      { type: "PERCENTAGE", value: 50 },
    ]);
    expect(keyframes[0].frames[1].declarations[0].property).toBe("translate");
  });

  it("splits comma-separated offsets", () => {
    const { keyframes } = parseGSS(
      "@keyframes pulse { 0%, 100% { scale: 1; } }",
    );
    expect(keyframes[0].frames[0].offsets).toEqual([
      { type: "PERCENTAGE", value: 0 },
      { type: "PERCENTAGE", value: 100 },
    ]);
  });

  it("rejects @keyframes without a name", () => {
    expect(() => parseGSS("@keyframes { from {} }")).toThrow();
  });

  it("splits a selector list into one rule per selector, sharing the declarations", () => {
    const { rules } = parseGSS("#a, #b { color: #fff; }");
    expect(rules.map((rule) => rule.selector)).toEqual([
      [{ type: "HASH", value: "a" }],
      [{ type: "HASH", value: "b" }],
    ]);
    expect(rules[0].declarations).toBe(rules[1].declarations); // the same array, not a copy
  });

  it("refuses an empty selector in a list", () => {
    expect(() => parseGSS("#a, { color: #fff; }")).toThrow("Selector expected");
    expect(() => parseGSS(", #a { color: #fff; }")).toThrow(
      "Selector expected",
    );
  });
});
