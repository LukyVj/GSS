import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import { resolveSceneStyles } from "./resolve";
import { readDpr } from "./dpr";

const dprOf = (source: string) =>
  readDpr(resolveSceneStyles(parse(tokenize(source)).rules));

describe("readDpr", () => {
  it("is auto when nothing is written", () => {
    expect(dprOf("")).toBe("auto");
  });

  it("reads the keywords", () => {
    expect(dprOf("scene { dpr: auto; }")).toBe("auto");
    expect(dprOf("scene { dpr: max; }")).toBe("max");
  });

  it("reads a number, decimals included", () => {
    expect(dprOf("scene { dpr: 2; }")).toBe(2);
    expect(dprOf("scene { dpr: 1.5; }")).toBe(1.5);
  });

  it("accepts the bounds, 0.25 and 4", () => {
    expect(dprOf("scene { dpr: 0.25; }")).toBe(0.25);
    expect(dprOf("scene { dpr: 4; }")).toBe(4);
  });

  it("rejects a number out of range", () => {
    expect(() => dprOf("scene { dpr: 5; }")).toThrow("dpr expects");
    expect(() => dprOf("scene { dpr: 0.1; }")).toThrow("dpr expects");
  });

  it("rejects anything else", () => {
    expect(() => dprOf("scene { dpr: big; }")).toThrow("dpr expects");
    expect(() => dprOf("scene { dpr: 2px; }")).toThrow("dpr expects");
    expect(() => dprOf("scene { dpr: 2 2; }")).toThrow("dpr expects");
  });
});
