import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";

describe("tokenize", () => {
  it("découpe une règle simple", () => {
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

  it("ignore les commentaires", () => {
    expect(tokenize("/* hello */ cube")).toEqual([
      { type: "IDENT", value: "cube" },
    ]);
  });

  it("reconnaît les at-rules", () => {
    expect(tokenize("@scene {")).toEqual([
      { type: "AT_KEYWORD", value: "scene" },
      { type: "PUNCT", value: "{" },
    ]);
  });

  it("reconnaît les variables CSS", () => {
    expect(tokenize("var(--gap)")).toEqual([
      { type: "IDENT", value: "var" },
      { type: "PUNCT", value: "(" },
      { type: "IDENT", value: "--gap" },
      { type: "PUNCT", value: ")" },
    ]);
  });

  it("lit les nombres négatifs", () => {
    expect(tokenize("-2.5")).toEqual([{ type: "NUMBER", value: -2.5 }]);
  });

  // ⬇️ TA MISSION : ce test échoue pour l'instant
  it("lit les dimensions (nombre + unité)", () => {
    expect(tokenize("70deg 24s")).toEqual([
      { type: "DIMENSION", value: 70, unit: "deg" },
      { type: "DIMENSION", value: 24, unit: "s" },
    ]);
  });
});
