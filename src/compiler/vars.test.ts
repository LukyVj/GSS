import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import { resolveVars, usesVariables } from "./vars";

const vars = { "--size": tokenize("2"), "--pos": tokenize("0 1 0") };
const resolve = (source: string) => resolveVars(tokenize(source), vars);

describe("resolveVars", () => {
  it("replaces a variable by its value", () => {
    expect(resolve("var(--size)")).toEqual(tokenize("2"));
  });

  it("can replace several tokens, like translate: var(--pos)", () => {
    expect(resolve("var(--pos)")).toEqual(tokenize("0 1 0"));
  });

  it("works inside calc(), so the math sees a number", () => {
    expect(resolve("calc(var(--size) * 2)")).toEqual(tokenize("calc(2 * 2)"));
  });

  it("uses the fallback when the variable is missing", () => {
    expect(resolve("var(--gap, 0.5)")).toEqual(tokenize("0.5"));
  });

  it("ignores the fallback when the variable exists", () => {
    expect(resolve("var(--size, 9)")).toEqual(tokenize("2"));
  });

  it("throws on a missing variable without fallback", () => {
    expect(() => resolve("var(--gpa)")).toThrow("--gpa is not defined");
  });

  it("returns the same array when there is no var()", () => {
    const value = tokenize("1 2 3");
    expect(resolveVars(value, vars)).toBe(value);
  });

  it("rejects anything after the name that is not a comma", () => {
    expect(() => resolve("var(--size 2)")).toThrow(
      'expected "," or ")" after --size',
    );
  });

  it("resolves a var() inside the fallback", () => {
    expect(resolve("var(--gap, var(--size))")).toEqual(tokenize("2"));
    expect(resolve("var(--gap, var(--nope, 3))")).toEqual(tokenize("3"));
  });

  it("does not read the fallback when the variable exists", () => {
    expect(resolve("var(--size, var(--nope))")).toEqual(tokenize("2"));
  });
});

describe("variables that use variables", () => {
  it("resolves a variable that uses another", () => {
    const variables = {
      "--size": tokenize("2"),
      "--big": tokenize("calc(var(--size) * 2)"),
    };
    expect(resolveVars(tokenize("var(--big)"), variables)).toEqual(
      tokenize("calc(2 * 2)"),
    );
  });

  it("rejects a loop, and shows it", () => {
    const variables = { "--a": tokenize("var(--b)"), "--b": tokenize("var(--a)") };
    expect(() => resolveVars(tokenize("var(--a)"), variables)).toThrow(
      "--a uses itself: --a → --b → --a",
    );
  });

  it("rejects a variable that uses itself", () => {
    const variables = { "--a": tokenize("calc(var(--a) + 1)") };
    expect(() => resolveVars(tokenize("var(--a)"), variables)).toThrow(
      "--a uses itself",
    );
  });

  it("is not a loop to use the same variable twice", () => {
    expect(resolve("calc(var(--size) + var(--size))")).toEqual(
      tokenize("calc(2 + 2)"),
    );
  });
});

describe("usesVariables", () => {
  const variables = { "--h": tokenize("1"), "--top": tokenize("calc(var(--h) + 1)") };

  it("finds a variable used directly", () => {
    expect(usesVariables(tokenize("0 var(--h) 0"), new Set(["--h"]), variables)).toBe(true);
  });

  it("finds a variable used through another one", () => {
    expect(usesVariables(tokenize("0 var(--top) 0"), new Set(["--h"]), variables)).toBe(true);
  });

  it("says no when the value does not use it", () => {
    expect(usesVariables(tokenize("0 1 0"), new Set(["--h"]), variables)).toBe(false);
  });

  it("does not loop forever on a loop", () => {
    const loop = { "--a": tokenize("var(--b)"), "--b": tokenize("var(--a)") };
    expect(usesVariables(tokenize("var(--a)"), new Set(["--x"]), loop)).toBe(false);
  });
});
