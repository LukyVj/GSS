import { describe, it, expect } from "vitest";
import { tokenize, scan } from "./tokenizer";

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

  it("tokenizes a percentage", () => {
    expect(tokenize("50%")[0]).toMatchObject({ type: "PERCENTAGE", value: 50 });
  });

  it("rejects a percent sign separated from its number", () => {
    expect(() => tokenize("50 %")).toThrow('Unexpected character "%"');
  });

  it("tokenizes decimal and negative percentages", () => {
    expect(tokenize("12.5%")[0]).toMatchObject({
      type: "PERCENTAGE",
      value: 12.5,
    });
    expect(tokenize("-25%")[0]).toMatchObject({
      type: "PERCENTAGE",
      value: -25,
    });
  });
});

describe("scan", () => {
  it("gives the position of each token", () => {
    expect(scan("cube { }")).toEqual([
      { token: { type: "IDENT", value: "cube" }, start: 0, end: 4 },
      { token: { type: "PUNCT", value: "{" }, start: 5, end: 6 },
      { token: { type: "PUNCT", value: "}" }, start: 7, end: 8 },
    ]);
  });

  it("keeps comments, with their full text", () => {
    expect(scan("/* hi */ cube")).toEqual([
      { token: { type: "COMMENT", value: "/* hi */" }, start: 0, end: 8 },
      { token: { type: "IDENT", value: "cube" }, start: 9, end: 13 },
    ]);
  });

  it("start/end cut out exactly each token's text", () => {
    const source =
      "#hero { rotate-x: 70deg; translate: -2.5 50% 0; } /* end */";
    const texts = scan(source).map(
      ({ start, end }: { start: number; end: number }) =>
        source.slice(start, end),
    );
    expect(texts).toEqual([
      "#hero",
      "{",
      "rotate-x",
      ":",
      "70deg",
      ";",
      "translate",
      ":",
      "-2.5",
      "50%",
      "0",
      ";",
      "}",
      "/* end */",
    ]);
  });
});

describe("scan with recover", () => {
  it("never throws, and marks what is not GSS", () => {
    expect(scan("cube ~ { /* open", { recover: true })).toEqual([
      { token: { type: "IDENT", value: "cube" }, start: 0, end: 4 },
      { token: { type: "INVALID", value: "~" }, start: 5, end: 6 },
      { token: { type: "PUNCT", value: "{" }, start: 7, end: 8 },
      { token: { type: "COMMENT", value: "/* open" }, start: 9, end: 16 },
    ]);
  });

  it("still throws without it", () => {
    expect(() => scan("/* open")).toThrow("Comment never closed");
  });
});

describe("strings", () => {
  it("reads double and single quotes, without the quotes", () => {
    expect(tokenize(`d: path("M0 0 L1 1") 'a'`)).toEqual([
      { type: "IDENT", value: "d" },
      { type: "PUNCT", value: ":" },
      { type: "IDENT", value: "path" },
      { type: "PUNCT", value: "(" },
      { type: "STRING", value: "M0 0 L1 1" },
      { type: "PUNCT", value: ")" },
      { type: "STRING", value: "a" },
    ]);
  });

  it("keeps an escaped quote", () => {
    expect(tokenize(`"a\\"b"`)).toEqual([{ type: "STRING", value: 'a"b' }]);
  });

  it("says when a string is never closed, and where", () => {
    expect(() => tokenize(`path("M0 0`)).toThrow("String never closed");
  });

  it("recovering, runs an unclosed string to the end of the line", () => {
    const parts = scan(`"M0 0\ncube`, { recover: true });
    expect(parts[0]).toEqual({
      token: { type: "STRING", value: "M0 0" },
      start: 0,
      end: 5,
    });
    expect(parts[1].token).toEqual({ type: "IDENT", value: "cube" });
  });
});
