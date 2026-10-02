import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import { spaceBetween } from "./nesting";
import { ErrorSink } from "./errors";
import type { Token } from "./tokenizer";
import { compileGSS } from "../index";

const parseGSS = (source: string) => parse(tokenize(source));

// A selector as it would be written flat, with its spaces
const text = (tokens: Token[]) =>
  tokens
    .map((token, i) => {
      const space = i > 0 && spaceBetween(tokens[i - 1], token) ? " " : "";
      const word = token.type === "HASH" ? `#${token.value}` : String(token.value);
      return space + word;
    })
    .join("");
const selectors = (source: string) => parseGSS(source).rules.map((rule) => text(rule.selector));

// The nested and the flat stylesheet give the same shader
const same = (nested: string, flat: string) => {
  const scene = "@scene { group#g { cube.a * 2; sphere; } cube.b; } ";
  expect(compileGSS(scene + nested)).toBe(compileGSS(scene + flat));
};

describe("nesting: the selectors", () => {
  it("puts the parent where & is", () => {
    expect(selectors(".a { & cube { } &:hover { } #g & { } &.b { } }")).toEqual([
      ".a cube",
      ".a:hover",
      "#g .a",
      ".a.b",
    ]);
  });

  it("adds & and a space before a selector without &, like CSS", () => {
    expect(selectors("#g { cube { } > sphere { } + cube { } }")).toEqual(["#g cube", "#g > sphere", "#g + cube"]);
  });

  it("nests at any depth", () => {
    expect(selectors("#g { .a { &:hover { sphere { } } } }")).toEqual(["#g .a:hover sphere"]);
  });

  it("takes every pair of a parent list and a nested list", () => {
    expect(selectors(".a, .b { & cube, &:hover { } }")).toEqual([
      ".a cube",
      ".a:hover",
      ".b cube",
      ".b:hover",
    ]);
  });

  it("puts the parent inside :has() and :not() too, with no & added in front", () => {
    expect(selectors("cube { #g:has(&) { } sphere:not(&) { } }")).toEqual(["#g:has(cube)", "sphere:not(cube)"]);
  });

  it("keeps the order of the declarations: those after a nested rule come after it", () => {
    const { rules } = parseGSS("cube { color: red; & { color: blue; } color: green; }");
    expect(rules.map((rule) => [text(rule.selector), rule.declarations.map((d) => d.value[0])])).toEqual([
      ["cube", [{ type: "IDENT", value: "red" }]],
      ["cube", [{ type: "IDENT", value: "blue" }]],
      ["cube", [{ type: "IDENT", value: "green" }]],
    ]);
  });

  it("reads a rule that holds only nested rules", () => {
    expect(selectors("#g { cube { color: red; } }")).toEqual(["#g cube"]);
  });
});

describe("nesting: @media inside a rule", () => {
  it("gives the rule's declarations to the query", () => {
    const { rules } = parseGSS("cube { color: red; @media (max-width: 600px) { color: blue; &:hover { color: green; } } }");
    expect(rules.map((rule) => [text(rule.selector), rule.media])).toEqual([
      ["cube", undefined],
      ["cube", "(max-width: 600px)"],
      ["cube:hover", "(max-width: 600px)"],
    ]);
  });

  it("joins a query inside another with and", () => {
    const { rules } = parseGSS("@media (min-width: 400px) { cube { @media (prefers-color-scheme: dark) { color: blue; } } }");
    expect(rules.map((rule) => [text(rule.selector), rule.media])).toEqual([
      ["cube", "(min-width: 400px) and (prefers-color-scheme: dark)"],
    ]);
  });

  it("refuses to join a query list", () => {
    expect(() => parseGSS("@media (min-width: 400px), print { cube { @media (hover) { color: blue; } } }")).toThrow(
      "@media inside @media cannot join a list of queries",
    );
  });
});

describe("nesting: the scene is the same as with flat rules", () => {
  it("styles the same objects", () => {
    same(
      "#g { color: red; cube { color: blue; &:hover { color: white; } } > sphere { color: green; } } .b { & { size: 0.5; } }",
      "#g { color: red; } #g cube { color: blue; } #g cube:hover { color: white; } #g > sphere { color: green; } .b { size: 0.5; }",
    );
  });

  it("keeps the cascade of the declarations after a nested rule", () => {
    same("cube { color: red; & { color: blue; } color: green; }", "cube { color: red; } cube { color: blue; } cube { color: green; }");
  });

  it("works in a @media at the top", () => {
    same(
      "@media (max-width: 600px) { #g { cube { color: blue; } } }",
      "@media (max-width: 600px) { #g cube { color: blue; } }",
    );
  });
});

describe("nesting: errors", () => {
  it("refuses & outside a rule", () => {
    expect(() => parseGSS("& cube { color: red; }")).toThrow("& stands for the selector of the rule around it");
  });

  it("refuses @scene and @keyframes inside a rule", () => {
    expect(() => parseGSS("cube { @keyframes up { to { translate: 0 1 0; } } }")).toThrow(
      "@keyframes goes outside the rules",
    );
    expect(() => parseGSS("cube { @scene { sphere; } }")).toThrow("@scene goes outside the rules");
  });

  it("keeps reading after a broken nested rule", () => {
    const errors = new ErrorSink();
    const { rules } = parse(tokenize("cube { & sphere { color } &:hover { color: red; } }"), errors);
    expect(errors.size).toBe(1);
    expect(rules.map((rule) => text(rule.selector))).toEqual(["cube sphere", "cube:hover"]);
  });
});
