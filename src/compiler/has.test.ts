import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import { parseSelector, specificity, needsHover } from "./resolve";
import { parse } from "./parser";

const selector = (text: string) => parseSelector(tokenize(text));

// Step 1: reading :has(…). A group matches when something inside it matches the
// selector in the parentheses, like CSS: #g:has(sphere:hover) cube

describe(":has(): the parser", () => {
  it("reads the selector inside the parentheses", () => {
    expect(selector("group:has(sphere) cube")).toMatchObject({
      tag: "cube",
      ancestors: [{ tag: "group", has: [{ tag: "sphere" }] }],
    });
  });

  it("does not cut the selector at the spaces inside the parentheses", () => {
    expect(selector("#g:has(#inner sphere:hover) cube")).toMatchObject({
      tag: "cube",
      ancestors: [
        {
          id: "g",
          has: [{ tag: "sphere", hover: true, ancestors: [{ id: "inner" }] }],
        },
      ],
    });
  });

  it("reads a list: one of them is enough", () => {
    expect(selector("#g:has(sphere, cube:hover)").has).toHaveLength(2);
  });

  it("can be the last part, to style the group itself", () => {
    expect(selector("#g:has(sphere)")).toMatchObject({
      id: "g",
      has: [{ tag: "sphere" }],
    });
  });

  it("goes on a group only: an object holds nothing", () => {
    expect(() => selector("cube:has(sphere)")).toThrow(
      ":has() goes on a group",
    );
    expect(() => selector("#g cube:has(sphere)")).toThrow(
      ":has() goes on a group",
    );
  });

  it("rejects an empty :has(), two :has() on one part, and a :has() inside a :has()", () => {
    expect(() => selector("#g:has()")).toThrow(":has() needs a selector");
    expect(() => selector("#g:has(sphere):has(cube)")).toThrow("one :has()");
    expect(() => selector("#g:has(#a:has(sphere))")).toThrow(
      "cannot hold another :has()",
    );
  });

  it("names :has() among the pseudo-classes GSS knows", () => {
    expect(() => selector("cube:focus")).toThrow(":hover and :has()");
  });
});

describe(":has(): the rule list", () => {
  it("does not cut a rule at a comma inside :has(…)", () => {
    const { rules } = parse(
      tokenize("#g:has(sphere, cube) cube, #b { scale: 2; }"),
    );
    expect(rules).toHaveLength(2);
    expect(rules[0].selector).toHaveLength(9); // # g : has ( sphere , cube ) cube
  });
});

// Step 2: what a :has() weighs, and when it needs the mouse
describe(":has(): specificity and hover", () => {
  it("weighs like its most specific selector, like CSS", () => {
    expect(specificity(selector("#g:has(sphere)"))).toBe(10_000 + 1);
    expect(specificity(selector("#g:has(sphere, #a.big)"))).toBe(
      10_000 + 10_100,
    );
    expect(specificity(selector("#g:has(#inner sphere:hover) cube"))).toBe(
      10_000 + (10_000 + 1 + 100) + 1,
    );
  });

  it("needs the mouse when the selector inside needs it", () => {
    expect(needsHover(selector("#g:has(sphere) cube"))).toBe(false);
    expect(needsHover(selector("#g:has(sphere:hover) cube"))).toBe(true);
    expect(needsHover(selector("#g:has(#inner:hover sphere) cube"))).toBe(true);
    expect(needsHover(selector("#g:has(sphere, cube:hover)"))).toBe(true);
  });
});
