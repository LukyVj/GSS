import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { parse } from "../syntax/parser";
import { compileScene } from "../index";

// @media, like CSS: rules that apply when the screen matches a media query.
// The compiler prepares one scene for every combination of the queries; the
// runtime asks the browser which queries match, and shows that one.

describe("@media: the parser", () => {
  it("keeps the rules, each with its query, in the order of the file", () => {
    const { rules } = parse(
      tokenize(
        "cube { scale: 1; } @media (max-width: 600px) { cube { scale: 2; } sphere { scale: 3; } } #a { scale: 4; }",
      ),
    );
    expect(rules.map((r) => r.media ?? null)).toEqual([
      null,
      "(max-width: 600px)",
      "(max-width: 600px)",
      null,
    ]);
  });

  it("writes the query back as text, for the browser", () => {
    const { rules } = parse(
      tokenize(
        "@media (prefers-reduced-motion) and (min-width: 40em) { cube { scale: 2; } }",
      ),
    );
    expect(rules[0].media).toBe(
      "(prefers-reduced-motion) and (min-width: 40em)",
    );
  });

  it("rejects an empty query, and anything but rules inside", () => {
    expect(() => parse(tokenize("@media { cube { scale: 2; } }"))).toThrow(
      "@media needs a query",
    );
    expect(() =>
      parse(
        tokenize(
          "@media (min-width: 1px) { @keyframes a { to { scale: 2; } } }",
        ),
      ),
    ).toThrow("@media holds rules");
    expect(() =>
      parse(tokenize("@media (min-width: 1px) { cube { scale: 2; }")),
    ).toThrow("never closed");
  });
});

const SCENE =
  "@scene { sphere; } sphere { translate: 0 1 0; color: #ff0000; } ";

describe("@media: the compiled scene", () => {
  it("adds nothing to a scene without @media", () => {
    expect(compileScene(SCENE).media).toBeUndefined();
  });

  it("prepares one scene per combination of the queries", () => {
    const compiled = compileScene(
      SCENE +
        "@media (max-width: 600px) { scene { dpr: 1; } } @media (prefers-color-scheme: dark) { sphere { color: #0000ff; } }",
    );
    expect(compiled.media?.queries).toEqual([
      "(max-width: 600px)",
      "(prefers-color-scheme: dark)",
    ]);
    const variants = compiled.media!.variants;
    expect(variants).toHaveLength(4); // bit 0: the first query, bit 1: the second
    expect(variants.map((v) => v.dpr)).toEqual(["auto", 1, "auto", 1]);
    expect(variants[2].shader).toContain("vec3(0.0, 0.0, 1.0)");
    expect(variants[1].shader).not.toContain("vec3(0.0, 0.0, 1.0)");
  });

  it("is the scene with no query matching, at the top level", () => {
    const compiled = compileScene(
      SCENE + "@media (max-width: 600px) { scene { dpr: 1; } }",
    );
    expect(compiled.dpr).toBe("auto");
    expect(compiled.shader).toBe(compiled.media!.variants[0].shader);
  });

  it("joins the cascade where it is written, like CSS", () => {
    const later = compileScene(
      SCENE + "@media (min-width: 1px) { sphere { color: #0000ff; } }",
    );
    expect(later.media!.variants[1].shader).toContain("vec3(0.0, 0.0, 1.0)");
    const earlier = compileScene(
      "@scene { sphere; } @media (min-width: 1px) { sphere { color: #0000ff; } } sphere { color: #ff0000; }",
    );
    expect(earlier.media!.variants[1].shader).not.toContain(
      "vec3(0.0, 0.0, 1.0)",
    );
  });

  it("counts a query written twice once", () => {
    const compiled = compileScene(
      SCENE +
        "@media (min-width: 1px) { sphere { scale: 2; } } @media (min-width: 1px) { scene { dpr: 1; } }",
    );
    expect(compiled.media?.queries).toHaveLength(1);
  });

  it("stops an animation with animation: none, for prefers-reduced-motion", () => {
    const compiled = compileScene(
      "@scene { sphere; } sphere { animation: up 2s; } @keyframes up { to { translate: 0 2 0; } } @media (prefers-reduced-motion) { * { animation: none !important; } }",
    );
    expect(compiled.media!.variants[0].shader).toContain("iTime / 2.0");
    expect(compiled.media!.variants[1].shader).not.toContain("iTime / 2.0");
  });

  it("finds an error in any combination", () => {
    expect(() =>
      compileScene(
        SCENE + "@media (min-width: 1px) { sphere { scale: big; } }",
      ),
    ).toThrow();
  });

  it("takes at most 4 different queries: 16 scenes", () => {
    const blocks = [1, 2, 3, 4, 5]
      .map((n) => `@media (min-width: ${n}px) { sphere { scale: ${n}; } }`)
      .join(" ");
    expect(() => compileScene(SCENE + blocks)).toThrow(
      "at most 4 different @media queries",
    );
  });
});
