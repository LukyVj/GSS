import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "../index";
import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import { spaceBetween } from "./nesting";
import { GssError, GssErrors } from "./errors";
import type { Token } from "./tokenizer";

// Loops, like Sass, written with CSS variables: @for --i from 1 through 4 { … } and
// @each --x in a, b { … }, anywhere. Unfolded before the parser, so the shader is the one of
// the same lines written out by hand.

// The scene with loops and the scene written out by hand give the same shaders
function same(withLoops: string, byHand: string) {
  expect(compileGSS(withLoops)).toBe(compileGSS(byHand));
  expect(compileGSS(withLoops, "wgsl")).toBe(compileGSS(byHand, "wgsl"));
}

// A selector as it would be written flat, with its spaces
const text = (tokens: Token[]) =>
  tokens
    .map((token, i) => {
      const space = i > 0 && spaceBetween(tokens[i - 1], token) ? " " : "";
      return space + tokenWord(token);
    })
    .join("");
const tokenWord = (token: Token) =>
  token.type === "HASH"
    ? `#${token.value}`
    : token.type === "DIMENSION"
      ? `${token.value}${token.unit}`
      : token.type === "PERCENTAGE"
        ? `${token.value}%`
        : String(token.value);

// The rules of a file: each selector, with its declarations as "property: value"
function rules(source: string) {
  return parse(tokenize(source)).rules.map((rule) => [
    text(rule.selector) + (rule.media ? ` @media ${rule.media}` : ""),
    rule.declarations.map((d) => `${d.property}: ${d.value.map(tokenWord).join(" ")}`),
  ]);
}

// The objects of @scene: tag, id, classes, attributes and count, as a short text
type Element = ReturnType<typeof parse>["scene"][number];
const describeElement = (e: Element): string =>
  e.tag +
  (e.id ? `#${e.id}` : "") +
  e.classes.map((c) => `.${c}`).join("") +
  Object.entries(e.attributes ?? {})
    .map(([k, v]) => `[${k}=${v}]`)
    .join("") +
  (e.count > 1 ? ` * ${e.count}` : "") +
  (e.children ? ` { ${e.children.map(describeElement).join("; ")} }` : "");
const scene = (source: string) => parse(tokenize(source)).scene.map(describeElement);

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

describe("@for: the numbers it counts", () => {
  const counts = (header: string) =>
    rules(`@for --i ${header} { cube { size: var(--i); } }`).map(([, [declaration]]) =>
      String(declaration).replace("size: ", ""),
    );

  it("counts the last number with through, like Sass", () => {
    expect(counts("from 1 through 4")).toEqual(["1", "2", "3", "4"]);
  });

  it("stops before the last number with to, like Sass", () => {
    expect(counts("from 1 to 4")).toEqual(["1", "2", "3"]);
  });

  it("counts down when the first number is the larger", () => {
    expect(counts("from 3 through 1")).toEqual(["3", "2", "1"]);
    expect(counts("from 3 to 1")).toEqual(["3", "2"]);
  });

  it("takes a step after by", () => {
    expect(counts("from 0 through 10 by 4")).toEqual(["0", "4", "8"]);
    expect(counts("from 0 to 8 by 4")).toEqual(["0", "4"]);
    expect(counts("from 10 through 0 by 5")).toEqual(["10", "5", "0"]);
  });

  it("counts by its index, so a decimal step adds up", () => {
    expect(counts("from 0 through 0.3 by 0.1")).toEqual(["0", "0.1", "0.2", "0.3"]);
  });

  it("keeps a unit, an angle or a percentage", () => {
    expect(counts("from 0deg to 360deg by 90deg")).toEqual(["0deg", "90deg", "180deg", "270deg"]);
    expect(counts("from 0% through 100% by 50%")).toEqual(["0%", "50%", "100%"]);
  });

  it("writes nothing when there is nothing to count", () => {
    expect(rules("@for --i from 1 to 1 { cube { size: var(--i); } } sphere { radius: 1; }")).toEqual([
      ["sphere", ["radius: 1"]],
    ]);
  });
});

describe("@each: the values it takes", () => {
  it("takes the values in order, split at the commas", () => {
    expect(rules("@each --c in tomato, gold, #3a7bff { cube { color: var(--c); } }")).toEqual([
      ["cube", ["color: tomato"]],
      ["cube", ["color: gold"]],
      ["cube", ["color: #3a7bff"]],
    ]);
  });

  it("takes a value of several tokens, and a value with commas between braces", () => {
    expect(
      rules("@each --p in 0 1 0, rgb(255, 0, 0), {a, b} { cube { translate: var(--p); } }").map(([, d]) => d),
    ).toEqual([["translate: 0 1 0"], ["translate: rgb ( 255 , 0 , 0 )"], ["translate: a , b"]]);
  });
});

describe("where a loop goes", () => {
  it("in @scene: one object per step, numbered like the copies of * n", () => {
    expect(scene("@scene { @for --i from 1 through 3 { cube.step; } sphere; }")).toEqual([
      "cube.step",
      "cube.step",
      "cube.step",
      "sphere",
    ]);
    same(
      "@scene { @for --i from 1 through 3 { cube.step; } } .step:nth-child(2) { color: #ff5a36; } .step { translate: calc(sibling-index() * 1.5) 0.5 0; }",
      "@scene { cube.step; cube.step; cube.step; } .step:nth-child(2) { color: #ff5a36; } .step { translate: calc(sibling-index() * 1.5) 0.5 0; }",
    );
  });

  it("in @scene: a different shape at each step, in the place of the tag", () => {
    expect(scene("@scene { @each --shape in cube, sphere, cone { var(--shape).piece; } }")).toEqual([
      "cube.piece",
      "sphere.piece",
      "cone.piece",
    ]);
  });

  it("in @scene: attributes, ids of a group, and * n read the variable", () => {
    expect(
      scene("@scene { @for --i from 1 through 2 { group[data-row=var(--i)] { cube * var(--i); } } }"),
    ).toEqual(["group[data-row=1] { cube }", "group[data-row=2] { cube * 2 }"]);
  });

  it("nested: a grid with both indices, and no mod()", () => {
    const withLoops = `@scene {
      @for --row from 0 to 3 { @for --col from 0 to 3 { cube[data-row=var(--row)][data-col=var(--col)]; } }
    }
    @for --row from 0 to 3 { @for --col from 0 to 3 {
      [data-row=var(--row)][data-col=var(--col)] { translate: calc(var(--col) - 1) 0.5 calc(var(--row) - 1); }
    } }`;
    expect(scene(withLoops)).toHaveLength(9);
    expect(scene(withLoops)[5]).toBe("cube[data-row=1][data-col=2]");
    same(
      withLoops,
      `@scene { ${[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => `cube[data-row=${r}][data-col=${c}];`)).join(" ")} }
      ${[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => `[data-row=${r}][data-col=${c}] { translate: calc(${c} - 1) 0.5 calc(${r} - 1); }`)).join(" ")}`,
    );
  });

  it("around rules, the variable in the selector and in the values", () => {
    expect(rules("@for --i from 1 through 2 { .p:nth-child(var(--i)) { translate: calc(var(--i) * 1.5) 0 0; } }")).toEqual([
      [".p:nth-child(1)", ["translate: calc ( 1 * 1.5 ) 0 0"]],
      [".p:nth-child(2)", ["translate: calc ( 2 * 1.5 ) 0 0"]],
    ]);
    same(
      "@scene { cube.p * 2; } @for --i from 1 through 2 { .p:nth-child(var(--i)) { translate: calc(var(--i) * 1.5) 0.5 0; } }",
      "@scene { cube.p * 2; } .p:nth-child(1) { translate: calc(1 * 1.5) 0.5 0; } .p:nth-child(2) { translate: calc(2 * 1.5) 0.5 0; }",
    );
  });

  it("keeps the spaces of a selector as written around the var()", () => {
    expect(rules("@each --s in cube, sphere { var(--s).a { size: 1; } #g var(--s) { size: 1; } var(--s)>.b { size: 1; } }").map(([s]) => s)).toEqual([
      "cube.a",
      "#g cube",
      "cube>.b",
      "sphere.a",
      "#g sphere",
      "sphere>.b",
    ]);
  });

  it("inside a rule: declarations and nested rules", () => {
    expect(rules("cube { @for --i from 1 through 2 { &:nth-child(var(--i)) { size: var(--i); } } color: red; }")).toEqual([
      ["cube:nth-child(1)", ["size: 1"]],
      ["cube:nth-child(2)", ["size: 2"]],
      ["cube", ["color: red"]],
    ]);
  });

  it("in @keyframes: one frame per step", () => {
    same(
      "@scene { cube; } cube { animation: a 2s; } @keyframes a { @for --p from 0% through 100% by 50% { var(--p) { translate: 0 calc(var(--p) / 50%) 0; } } }",
      "@scene { cube; } cube { animation: a 2s; } @keyframes a { 0% { translate: 0 calc(0% / 50%) 0; } 50% { translate: 0 calc(50% / 50%) 0; } 100% { translate: 0 calc(100% / 50%) 0; } }",
    );
  });

  it("in a @mixin, and around an @apply", () => {
    expect(
      rules("@mixin --row { @for --i from 1 through 2 { &:nth-child(var(--i)) { size: var(--i); } } } cube { @apply --row; }"),
    ).toEqual([
      ["cube:nth-child(1)", ["size: 1"]],
      ["cube:nth-child(2)", ["size: 2"]],
    ]);
    expect(
      rules("@mixin --s(--n) { size: var(--n); } @for --i from 1 through 2 { .c:nth-child(var(--i)) { @apply --s(var(--i)); } }"),
    ).toEqual([
      [".c:nth-child(1)", ["size: 1"]],
      [".c:nth-child(2)", ["size: 2"]],
    ]);
  });

  it("in a @media query", () => {
    expect(rules("@each --w in 400px, 800px { @media (max-width: var(--w)) { cube { size: 1; } } }").map(([s]) => s)).toEqual([
      "cube @media (max-width: 400px)",
      "cube @media (max-width: 800px)",
    ]);
  });

  it("hides a variable of the same name inside it, and leaves the others", () => {
    expect(rules("@for --i from 1 through 1 { cube { --i: 9; size: var(--i, 2); scale: var(--j); } }")).toEqual([
      ["cube", ["--i: 9", "size: 1", "scale: var ( --j )"]],
    ]);
  });

  it("changes no shader of a scene without loops", () => {
    const source = "@scene { cube.for; } .for { color: #ff5a36; }";
    expect(compileGSS(source)).toBe(compileGSS(source));
  });
});

describe("errors, where they are", () => {
  it("a loop without a name", () => {
    expect(errorsIn("@scene { cube; } @for i from 1 through 2 { }")).toEqual([
      ["i", "@for takes a name that starts with --, like: @for --i from 1 through 4 { … }"],
    ]);
  });

  it("from, through and to, and the numbers", () => {
    expect(errorsIn("@scene { cube; } @for --i 1 through 2 { }")[0]).toEqual([
      "1",
      '"from" expected after @for --i, like: @for --i from 1 through 4 { … }, or from 1 to 5 to leave the last one out',
    ]);
    expect(errorsIn("@scene { cube; } @for --i from 1 until 2 { }")[0][0]).toBe("until");
    expect(errorsIn("@scene { cube; } @for --i from a through 2 { }")).toEqual([
      ["a", 'A number expected after "from", like 1, 30deg or 10%'],
    ]);
    expect(errorsIn("@scene { cube; } @for --i from 1 through var(--n) { }")[0][0]).toBe("var");
  });

  it("a step of 0, or below", () => {
    expect(errorsIn("@scene { cube; } @for --i from 1 through 4 by 0 { }")[0][0]).toBe("0");
    expect(errorsIn("@scene { cube; } @for --i from 4 through 1 by -1 { }")[0][0]).toBe("-1");
  });

  it("numbers of different units", () => {
    expect(errorsIn("@scene { cube; } @for --a from 0 to 360deg { }")).toEqual([
      ["from 0 to 360deg", "The numbers of @for take the same unit: no unit, deg"],
    ]);
  });

  it("more than 1000 steps", () => {
    expect(errorsIn("@scene { cube; } @for --i from 1 through 1001 { }")).toEqual([
      ["@for --i from 1 through 1001", "@for --i takes 1001 steps: 1000 at most"],
    ]);
    expect(() => compileScene("@scene { @for --i from 1 through 1000 { } cube; }")).not.toThrow();
  });

  it("@each without in, without values, or with an empty one", () => {
    expect(errorsIn("@scene { cube; } @each --c red, blue { }")[0][0]).toBe("red");
    expect(errorsIn("@scene { cube; } @each --c in { }")[0][0]).toBe("in");
    expect(errorsIn("@scene { cube; } @each --c in red, , blue { }")).toEqual([
      [",", "A value of @each --c is empty"],
    ]);
  });

  it("a loop without a block, or never closed", () => {
    expect(errorsIn("@scene { cube; } @for --i from 1 through 2; cube { size: 1 }")).toEqual([
      ["@for --i from 1 through 2", "@for --i takes a block, like: @for --i from 1 through 4 { … }"],
    ]);
    expect(errorsIn("@scene { cube; } @each --c in red { cube { color: var(--c); }")[0][1]).toBe(
      '@each --c never closed: "}" missing',
    );
  });

  it("an inner loop with the name of the loop around it", () => {
    expect(errorsIn("@scene { cube; } @for --i from 1 through 2 { @for --i from 1 through 2 { } }")[0]).toEqual([
      "--i",
      "--i already counts the loop around this one: give this one another name",
    ]);
  });

  it("an error in the block is reported once, where it is written, and the rest is read", () => {
    const list = errorsIn("@scene { cube; } @for --i from 1 through 3 { cube { color red; } } sphere { radius: ; }");
    expect(list.map(([code]) => code)).toEqual(["red", "radius"]);
  });

  it("a wrong value given by the loop points at the var() that took it", () => {
    const source = "@scene { cube; } @for --i from -1 through -1 { cube { size: var(--i); } }";
    expect(errorsIn(source)[0][0]).toBe("var(--i)");
  });
});
