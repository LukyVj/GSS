import { describe, it, expect } from "vitest";
import { compileScene } from ".";
import { GssError } from "./errors";

// Compiles, and returns the piece of source the error points at
function pointedAt(source: string): string {
  try {
    compileScene(source);
  } catch (error) {
    expect(error).toBeInstanceOf(GssError);
    const { start, end } = error as GssError;
    expect(start, (error as Error).message).toBeTypeOf("number");
    return source.slice(start, end);
  }
  throw new Error("expected a compile error");
}

describe("errors point at the code they are about", () => {
  it("an unexpected character", () => {
    expect(pointedAt("@scene { cube; } cube { scale: 2 ~ }")).toBe("~");
  });

  it("a block never closed: its {", () => {
    expect(pointedAt("@scene { cube; } cube { scale: 2;")).toBe("{");
  });

  it("a missing punctuation: what was found instead", () => {
    expect(pointedAt("@scene { cube } cube { size 1; }")).toBe("1");
  });

  it("an unknown property: the whole declaration", () => {
    expect(pointedAt("@scene { cube; } cube { colour: #fff; }")).toBe(
      "colour: #fff",
    );
  });

  it("a wrong value: the value", () => {
    expect(pointedAt("@scene { cube; } cube { translate: 0 1; }")).toBe("0 1");
    expect(pointedAt("@scene { cube; } cube { color: tomatoe; }")).toBe("tomatoe"); // red is a color since decision 56
  });

  it("a wrong argument inside a function: the argument", () => {
    expect(
      pointedAt("@scene { cube; } cube { material: glass(1.5, bumpy 0.3); }"),
    ).toBe("bumpy");
  });

  it("a wrong value inside @keyframes: that value, not the object's", () => {
    const source =
      "@scene { cube; } cube { scale: 1; animation: a 1s; } @keyframes a { to { scale: big; } }";
    expect(pointedAt(source)).toBe("big");
  });

  it("a wrong path: the text of the path", () => {
    expect(
      pointedAt('@scene { path; } path { d: path("M0 0 X1 1"); }'),
    ).toBe('"M0 0 X1 1"');
  });

  it("a scene setting", () => {
    expect(pointedAt("@scene { cube; } scene { camera-distance: 30; }")).toBe(
      "30",
    );
  });
  it("children on something that is not a group: the object's name", () => {
    expect(pointedAt("@scene { cube#a { sphere } }")).toBe("cube");
  });
});
