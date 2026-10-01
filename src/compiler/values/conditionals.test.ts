import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { resolveIf, mediaQueriesOf } from "./conditionals";
import { compileScene } from "../index";

const pick = (source: string, variables: Record<string, string> = {}, media: string[] = []) =>
  resolveIf(
    tokenize(source),
    Object.fromEntries(Object.entries(variables).map(([k, v]) => [k, tokenize(v)])),
    new Set(media),
  );

describe("if(): the first true branch, like CSS", () => {
  it("reads style() with and without a value", () => {
    expect(pick("if(style(--theme: night): 1; else: 2)", { "--theme": "night" })).toEqual(tokenize("1"));
    expect(pick("if(style(--theme: night): 1; else: 2)", { "--theme": "day" })).toEqual(tokenize("2"));
    expect(pick("if(style(--big): 2; else: 1)", { "--big": "yes" })).toEqual(tokenize("2"));
    expect(pick("if(style(--big): 2; else: 1)")).toEqual(tokenize("1"));
  });

  it("compares a variable through var() and several tokens", () => {
    expect(pick("if(style(--pos: 0 1 0): a; else: b)", { "--pos": "var(--y)", "--y": "0 1 0" })).toEqual(tokenize("a"));
  });

  it("reads media() from the queries of the version being compiled", () => {
    expect(pick("if(media(width < 600px): 0.6; else: 1)", {}, ["(width < 600px)"])).toEqual(tokenize("0.6"));
    expect(pick("if(media(width < 600px): 0.6; else: 1)")).toEqual(tokenize("1"));
    expect(mediaQueriesOf(tokenize("if(media(width < 600px): 1; media(print): 2; media((orientation: portrait)): 3)"))).toEqual([
      "(width < 600px)",
      "print",
      "(orientation: portrait)",
    ]);
  });

  it("knows not, and, or, and nests", () => {
    const vars = { "--a": "1", "--b": "1" };
    expect(pick("if(not style(--c): x; else: y)", vars)).toEqual(tokenize("x"));
    expect(pick("if(style(--a) and style(--b): x; else: y)", vars)).toEqual(tokenize("x"));
    expect(pick("if(style(--a) and style(--c): x; else: y)", vars)).toEqual(tokenize("y"));
    expect(pick("if(style(--c) or style(--b): x; else: y)", vars)).toEqual(tokenize("x"));
    expect(pick("0 if(style(--a): if(style(--c): 1; else: 2); else: 3) 0", vars)).toEqual(tokenize("0 2 0"));
  });

  it("says what is wrong", () => {
    expect(() => pick("if(style(--c): 1)")).toThrow("No condition of if() is true");
    expect(() => pick("if(supports(display: grid): 1; else: 2)")).toThrow("not supports()");
    expect(() => pick("if(1)")).toThrow("Each branch of if() is a condition");
    expect(() => pick("if(style(--a) and style(--b) or style(--c): 1; else: 2)")).toThrow('cannot mix "and" and "or"');
  });
});

describe("if() in a scene", () => {
  it("keeps the ; of if() inside the declaration", () => {
    const { shader } = compileScene(
      "@scene { sphere } sphere { --night: 1; color: if(style(--night: 1): #000000; else: #ffffff); }",
    );
    expect(shader).toContain("vec3(0.0, 0.0, 0.0)");
  });

  it("makes a version of the scene per media() query, shared with @media", () => {
    const scene = compileScene(
      "@scene { sphere } sphere { radius: if(media(max-width: 600px): 0.3; else: 0.6); } @media (max-width: 600px) { sphere { color: red; } }",
    );
    expect(scene.media?.queries).toEqual(["(max-width: 600px)"]);
    expect(scene.media?.variants[0].shader).toContain("0.6");
    expect(scene.media?.variants[1].shader).toContain("0.3");
  });

  it("works with an inherited variable, in @keyframes and on the scene", () => {
    const { shader } = compileScene(
      "@scene { group#g { sphere } } scene { --mode: dark; background: if(style(--mode: dark): #000000; else: #ffffff); } #g { --s: 2; } sphere { animation: a 1s; } @keyframes a { to { scale: if(style(--s: 2): 1.5; else: 1); } }",
    );
    expect(shader).toContain("const vec3 BACKGROUND = vec3(0.0, 0.0, 0.0);");
    expect(shader).toContain("1.5");
  });
});
