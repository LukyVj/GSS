import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import { readFunction } from "./values";

describe("readFunction", () => {
  it("reads a function without arguments", () => {
    expect(readFunction(tokenize("matte()"))).toEqual({
      name: "matte",
      args: [],
    });
  });

  it("splits the arguments on commas", () => {
    expect(readFunction(tokenize("metal(#d4af37, 0.2)"))).toEqual({
      name: "metal",
      args: [
        [{ type: "HASH", value: "d4af37" }],
        [{ type: "NUMBER", value: 0.2 }],
      ],
    });
  });

  it("splits on spaces when there is no comma, like rgb(255 90 54)", () => {
    expect(readFunction(tokenize("rgb(255 90 54)"))?.args).toHaveLength(3);
  });

  it("returns null when the value is not a function", () => {
    expect(readFunction(tokenize("jelly"))).toBeNull();
    expect(readFunction(tokenize("#ff5a36"))).toBeNull();
  });

  it("rejects a parenthesis that is never closed", () => {
    expect(() => readFunction(tokenize("metal(#fff, 0.2"))).toThrow(
      "metal( is never closed",
    );
  });

  it("rejects an empty argument", () => {
    expect(() => readFunction(tokenize("metal(#fff, , 0.2)"))).toThrow(
      "has an empty argument",
    );
  });
});
