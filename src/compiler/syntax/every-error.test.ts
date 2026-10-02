import { describe, it, expect } from "vitest";
import { compileScene } from "..";
import { describeErrors, GssError, GssErrors } from "./errors";

// Decision 86: a compile reports every error it finds, not only the first one.

// Compiles, and returns each error as [the code it points at, its message]
function errorsIn(source: string): [string | null, string][] {
  try {
    compileScene(source);
  } catch (caught) {
    const list = caught instanceof GssErrors ? caught.errors : [caught as GssError];
    return list.map((error) => [
      error.start === undefined ? null : source.slice(error.start, error.end),
      error.message,
    ]);
  }
  throw new Error("expected a compile error");
}

const pointed = (source: string) => errorsIn(source).map(([code]) => code);

describe("one error", () => {
  it("is thrown as it is, like before", () => {
    let caught: unknown;
    try {
      compileScene("@scene { cube; } cube { size: -1; }");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(GssError);
    expect(caught).not.toBeInstanceOf(GssErrors);
  });
});

describe("errors in the text: every one of them", () => {
  it("two broken declarations in one block", () => {
    expect(pointed("@scene { cube; } cube { color red; radius: ; size: 2; }")).toEqual([
      "red",
      "radius",
    ]);
  });

  it("an unexpected character, and a broken declaration after it", () => {
    expect(pointed("@scene { cube; } $ cube { color red; }")).toEqual(["$", "red"]);
  });

  it("a missing \":\" before the \"}\" of each block", () => {
    expect(errorsIn("@scene { cube; } cube { color } sphere { radius }")).toHaveLength(2);
  });

  it("three broken elements of @scene, inside a group too", () => {
    expect(pointed("@scene { group#g { cube.; sphere } torus#a#b; cone * 0; }")).toEqual([
      ";",
      "#b",
      "0",
    ]);
  });

  it("an at-rule GSS does not know is skipped, block included", () => {
    expect(pointed("@scene { cube; } @foo bar { x: 1; } cube { color red }")).toEqual([
      "@foo",
      "red",
    ]);
  });

  it('a "}" that closes nothing, then the next rule', () => {
    expect(errorsIn("@scene { cube; } } cube { color red; }")).toEqual([
      ["}", '"}" closes no block'],
      ["red", '":" expected, but found "red"'],
    ]);
  });

  it("an empty selector, and an error in the next rule", () => {
    expect(pointed("@scene { cube; } , cube { color: red; } cube { size 2; }")).toEqual([
      ",",
      "2",
    ]);
  });

  it("a block never closed: one error, at its {", () => {
    expect(pointed("@scene { cube; } cube { color: red;")).toEqual(["{"]);
  });

  it("an error in the text hides the errors of the values: they may only be its consequences", () => {
    expect(pointed("@scene { cube; sphere; } cube { color red; } sphere { radius: abc; }")).toEqual([
      "red",
    ]);
  });
});

describe("errors in the values: every one of them, once the text reads", () => {
  it("two unknown properties", () => {
    expect(errorsIn("@scene { cube; sphere; } cube { colr: red; } sphere { radus: 1; }")).toEqual([
      ["colr: red", 'Unknown property "colr"'],
      ["radus: 1", 'Unknown property "radus"'],
    ]);
  });

  it("a wrong value on two objects", () => {
    expect(pointed("@scene { cube; sphere; } cube { size: -1; } sphere { radius: -2; }")).toEqual([
      "-1",
      "-2",
    ]);
  });

  it("two undefined variables", () => {
    expect(pointed("@scene { cube; sphere; } cube { size: var(--a); } sphere { radius: var(--b); }")).toEqual([
      "var(--a)",
      "var(--b)",
    ]);
  });

  it("@keyframes and objects", () => {
    expect(
      pointed(
        "@scene { cube; } @keyframes k { from { radiuss: 1; } to { colr: red; } } cube { animation: k 1s; size: -3; }",
      ),
    ).toEqual(["radiuss: 1", "colr: red", "-3"]);
  });

  it("an unknown property and a wrong value", () => {
    expect(pointed("@scene { cube; sphere; } cube { colr: red; } sphere { radius: -2; }")).toEqual([
      "colr: red",
      "-2",
    ]);
  });

  it("the same error in every @media version of the scene is reported once", () => {
    expect(
      pointed(
        "@scene { cube; sphere; } @media (max-width: 600px) { cube { color: red; } } sphere { radius: -2; } cube { size: -1; }",
      ),
    ).toEqual(["-2", "-1"]);
  });

  it("the errors come in the order of the text", () => {
    expect(pointed("@scene { cube; sphere; } sphere { radius: -2; } cube { size: -1; }")).toEqual([
      "-2",
      "-1",
    ]);
  });
});

describe("describeErrors", () => {
  it("writes each error with its line and column", () => {
    const source = "@scene { cube; sphere; }\ncube { size: -1; }\nsphere { radius: -2; }";
    let caught: unknown;
    try {
      compileScene(source);
    } catch (error) {
      caught = error;
    }
    expect(describeErrors(source, caught).split("\n")).toEqual([
      "2:14  size expects one or three positive numbers, like: size: 2 1 1;",
      "3:18  radius expects one positive number, like: radius: 2;",
    ]);
  });
});
