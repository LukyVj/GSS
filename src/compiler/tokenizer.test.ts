import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";

describe("tokenize", () => {
  it("splits a simple rule", () => {
    expect(tokenize("torus#hero { radius: 1 0.28; }")).toEqual([
      { type: "IDENT", value: "torus" },
      { type: "HASH", value: "hero" },
      { type: "PUNCT", value: "{" },
      { type: "IDENT", value: "radius" },
      { type: "PUNCT", value: ":" },
      { type: "NUMBER", value: 1 },
      { type: "NUMBER", value: 0.28 },
      { type: "PUNCT", value: ";" },
      { type: "PUNCT", value: "}" },
    ]);
  });

  it("ignores comments", () => {
    expect(tokenize("/* hello */ cube")).toEqual([
      { type: "IDENT", value: "cube" },
    ]);
  });

  it("recognizes at-rules", () => {
    expect(tokenize("@scene {")).toEqual([
      { type: "AT_KEYWORD", value: "scene" },
      { type: "PUNCT", value: "{" },
    ]);
  });

  it("recognizes CSS variables", () => {
    expect(tokenize("var(--gap)")).toEqual([
      { type: "IDENT", value: "var" },
      { type: "PUNCT", value: "(" },
      { type: "IDENT", value: "--gap" },
      { type: "PUNCT", value: ")" },
    ]);
  });

  it("recognizes negative numbers", () => {
    expect(tokenize("-2.5")).toEqual([{ type: "NUMBER", value: -2.5 }]);
  });

  it("recognizes dimensions (number + unit)", () => {
    expect(tokenize("70deg 24s")).toEqual([
      { type: "DIMENSION", value: 70, unit: "deg" },
      { type: "DIMENSION", value: 24, unit: "s" },
    ]);
  });
});
