import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { parse } from "../syntax/parser";
import { compileScene } from "../index";

// @gpu (slow): rules for a computer that cannot draw the scene fast enough. Like @media,
// the compiler prepares a version of the scene with them and one without; the runtime
// shows the light one once the frames stay slow (or without a GPU).

describe("@gpu: the parser", () => {
  it("keeps the rules, each with its condition, in the order of the file", () => {
    const { rules } = parse(
      tokenize("cube { scale: 1; } @gpu (slow) { cube { scale: 2; } } @gpu not (slow) { sphere { scale: 3; } }"),
    );
    expect(rules.map((r) => r.media ?? null)).toEqual([null, "@gpu (slow)", "@gpu not (slow)"]);
  });

  it("reads a @gpu inside a rule, like a nested @media", () => {
    const { rules } = parse(tokenize("cube { scale: 1; @gpu (slow) { scale: 2; } }"));
    expect(rules.map((r) => r.media ?? null)).toEqual([null, "@gpu (slow)"]);
  });

  it("knows one condition, slow", () => {
    expect(() => parse(tokenize("@gpu { cube { scale: 2; } }"))).toThrow("@gpu needs a condition");
    expect(() => parse(tokenize("@gpu (fast) { cube { scale: 2; } }"))).toThrow("@gpu knows one condition");
    expect(() => parse(tokenize("@gpu slow { cube { scale: 2; } }"))).toThrow("@gpu knows one condition");
  });

  it("holds rules only, and does not mix with @media yet", () => {
    expect(() => parse(tokenize("@gpu (slow) { @keyframes a { to { scale: 2; } } }"))).toThrow("@gpu holds rules");
    expect(() => parse(tokenize("@gpu (slow) { @media (max-width: 600px) { cube { scale: 2; } } }"))).toThrow("@gpu holds rules");
    expect(() => parse(tokenize("cube { @media (max-width: 600px) { @gpu (slow) { scale: 2; } } }"))).toThrow(
      "@gpu and @media cannot be nested",
    );
    expect(() => parse(tokenize("cube { @gpu (slow) { @media (max-width: 600px) { scale: 2; } } }"))).toThrow(
      "@gpu and @media cannot be nested",
    );
  });
});

const SCENE = "@scene { sphere * 16; } scene { --r: 0.1; } sphere { radius: var(--r); translate: calc(sibling-index() * 0.3) 0.5 0; } ";

describe("@gpu: the compiled scene", () => {
  it("is a version of the scene, the lighter one where the condition is set", () => {
    const compiled = compileScene(SCENE + "@gpu (slow) { sphere:nth-child(n + 9) { display: none; } }");
    expect(compiled.media?.queries).toEqual(["@gpu (slow)"]);
    const [full, light] = compiled.media!.variants;
    expect(full.objects).toBe(16);
    expect(light.objects).toBe(8);
    // The scene itself is the full one, for Node, the tests and the exports
    expect(compiled.objects).toBe(16);
  });

  it("changes a variable, like scene { --n: 8; }", () => {
    const compiled = compileScene(SCENE + "@gpu (slow) { scene { --r: 0.05; } }");
    const [full, light] = compiled.media!.variants;
    expect(light.shader).not.toBe(full.shader);
    expect(compileScene(SCENE + "scene { --r: 0.05; }").shader).toBe(light.shader);
  });

  it("not (slow) applies on a computer that keeps up", () => {
    const compiled = compileScene(SCENE + "@gpu not (slow) { sphere:nth-child(n + 9) { display: none; } }");
    expect(compiled.media?.queries).toEqual(["@gpu not (slow)"]);
    expect(compiled.media!.variants.map((v) => v.objects)).toEqual([16, 8]);
  });

  it("counts among the 4 conditions of a scene, with @media", () => {
    const four = "@media (min-width: 1px) { sphere { color: red; } } @media (min-width: 2px) { sphere { color: red; } } @media (min-width: 3px) { sphere { color: red; } } ";
    expect(compileScene(SCENE + four + "@gpu (slow) { scene { --n: 8; } }").media?.variants.length).toBe(16);
    expect(() =>
      compileScene(SCENE + four + "@media (min-width: 4px) { sphere { color: red; } } @gpu (slow) { scene { --n: 8; } }"),
    ).toThrow("at most 4");
  });
});
