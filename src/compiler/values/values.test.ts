import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { readFunction, readPolygon } from "./values";

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

describe("readPolygon", () => {
  it("reads one point per argument", () => {
    expect(readPolygon(tokenize("polygon(0 1, 1 0, -1 0)"))).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
    ]);
  });

  it("returns null when the value is not a polygon", () => {
    expect(readPolygon(tokenize('path("M0 0 L1 1")'))).toBeNull();
    expect(readPolygon(tokenize("2"))).toBeNull();
  });

  it("rejects a point that is not two numbers", () => {
    expect(() => readPolygon(tokenize("polygon(0 1, 1, -1 0)"))).toThrow(
      "each point of polygon() needs two numbers",
    );
  });

  it("rejects points written without commas", () => {
    expect(() => readPolygon(tokenize("polygon(0 1 1 0 -1 0)"))).toThrow(
      "each point of polygon() needs two numbers",
    );
  });

  it("needs at least three points", () => {
    expect(() => readPolygon(tokenize("polygon(0 1, 1 0)"))).toThrow(
      "polygon() needs at least 3 points",
    );
  });
});
