import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "../index";
import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import { spaceBetween } from "./nesting";
import { GssError, GssErrors } from "./errors";
import type { Token } from "./tokenizer";

// Mixins, like the CSS draft: @mixin --name(--param: default) { … } and @apply --name(…);
// unfolded by the parser, so the shader is the one of the rules written out by hand.

const SCENE = "@scene { group#g { cube.a * 2; sphere; } cube.b; } ";

// The scene with mixins and the scene written out by hand give the same shaders
function same(withMixins: string, byHand: string) {
  expect(compileGSS(SCENE + withMixins)).toBe(compileGSS(SCENE + byHand));
  expect(compileGSS(SCENE + withMixins, "wgsl")).toBe(compileGSS(SCENE + byHand, "wgsl"));
}

// A selector as it would be written flat, with its spaces
const text = (tokens: Token[]) =>
  tokens
    .map((token, i) => {
      const space = i > 0 && spaceBetween(tokens[i - 1], token) ? " " : "";
      const word = token.type === "HASH" ? `#${token.value}` : String(token.value);
      return space + word;
    })
    .join("");

// The rules of a file: each selector, with its declarations as "property: value"
function rules(source: string) {
  return parse(tokenize(source)).rules.map((rule) => [
    text(rule.selector) + (rule.media ? ` @media ${rule.media}` : ""),
    rule.declarations.map((d) => `${d.property}: ${d.value.map((t) => tokenWord(t)).join(" ")}`),
  ]);
}
const tokenWord = (token: Token) =>
  token.type === "HASH" ? `#${token.value}` : token.type === "DIMENSION" ? `${token.value}${token.unit}` : String(token.value);

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

// Where the first error starts in the source
function startOf(source: string): number | undefined {
  try {
    compileScene(source);
  } catch (caught) {
    return (caught as GssError).start;
  }
  throw new Error("expected a compile error");
}

describe("@mixin and @apply: the rules they unfold into", () => {
  it("puts the declarations of the mixin where @apply is, and leaves no @mixin", () => {
    expect(rules("@mixin --red { color: red; size: 2; } cube { scale: 1; @apply --red; radius: 1; }")).toEqual([
      ["cube", ["scale: 1", "color: red", "size: 2", "radius: 1"]],
    ]);
  });

  it("reads the parentheses as optional, without parameters, like CSS", () => {
    expect(rules("@mixin --red() { color: red; } cube { @apply --red(); } sphere { @apply --red; }")).toEqual([
      ["cube", ["color: red"]],
      ["sphere", ["color: red"]],
    ]);
  });

  it("finds a mixin defined after the rules that apply it", () => {
    expect(rules("cube { @apply --red; } @mixin --red { color: red; }")).toEqual([["cube", ["color: red"]]]);
  });

  it("takes the last mixin of a name, like CSS", () => {
    expect(rules("@mixin --c { color: red; } @mixin --c { color: blue; } cube { @apply --c; }")).toEqual([
      ["cube", ["color: blue"]],
    ]);
  });

  it("closes the last declaration of a mixin written without ;", () => {
    expect(rules("@mixin --red { color: red } cube { @apply --red; size: 2; }")).toEqual([
      ["cube", ["color: red", "size: 2"]],
    ]);
  });

  it("takes @apply without ; before the } of the rule", () => {
    expect(rules("@mixin --red { color: red; } cube { size: 2; @apply --red }")).toEqual([
      ["cube", ["size: 2", "color: red"]],
    ]);
  });

  it("nests the rules of the mixin in the rule that applies it, & included", () => {
    expect(rules("@mixin --hot { color: red; &:hover { scale: 1.2; } sphere { size: 1; } } #g { @apply --hot; }")).toEqual([
      ["#g", ["color: red"]],
      ["#g:hover", ["scale: 1.2"]],
      ["#g sphere", ["size: 1"]],
    ]);
  });

  it("gives @media inside a mixin the selector of the rule", () => {
    expect(rules("@mixin --small { @media (max-width: 600px) { scale: 0.5; } } cube { @apply --small; }")).toEqual([
      ["cube @media (max-width: 600px)", ["scale: 0.5"]],
    ]);
  });

  it("applies a mixin inside @media, :hover and a nested rule", () => {
    expect(
      rules(
        "@mixin --red { color: red; } @media (max-width: 600px) { cube { @apply --red; } } cube:hover { @apply --red; } #g { .a { @apply --red; } }",
      ),
    ).toEqual([
      ["cube @media (max-width: 600px)", ["color: red"]],
      ["cube:hover", ["color: red"]],
      ["#g .a", ["color: red"]],
    ]);
  });

  it("applies a mixin inside a mixin", () => {
    expect(rules("@mixin --a { color: red; @apply --b; } @mixin --b { size: 2; } cube { @apply --a; }")).toEqual([
      ["cube", ["color: red", "size: 2"]],
    ]);
  });
});

describe("@mixin and @apply: parameters", () => {
  it("gives each parameter its argument, in order, read with var()", () => {
    expect(rules("@mixin --m(--a, --b) { size: var(--a); color: var(--b); } cube { @apply --m(2, red); }")).toEqual([
      ["cube", ["size: 2", "color: red"]],
    ]);
  });

  it("takes the default of a parameter left out, like CSS", () => {
    expect(rules("@mixin --m(--a: 1, --b: blue) { size: var(--a); color: var(--b); } cube { @apply --m(2); }")).toEqual([
      ["cube", ["size: 2", "color: blue"]],
    ]);
  });

  it("reads the fallback of var() for a parameter with no value", () => {
    expect(rules("@mixin --m(--a) { size: var(--a, 3); } cube { @apply --m; }")).toEqual([["cube", ["size: 3"]]]);
  });

  it("hides a variable of the same name, and leaves the others to the rule", () => {
    expect(
      rules("@mixin --m(--c) { color: var(--c); size: var(--s); } cube { --c: blue; --s: 2; @apply --m(red); }"),
    ).toEqual([["cube", ["--c: blue", "--s: 2", "color: red", "size: var ( --s )"]]]);
  });

  it("lets a default read another parameter", () => {
    expect(rules("@mixin --m(--a, --b: var(--a)) { size: var(--a) var(--b); } cube { @apply --m(2); }")).toEqual([
      ["cube", ["size: 2 2"]],
    ]);
  });

  it("takes an argument that holds a comma between braces, like CSS", () => {
    expect(rules("@mixin --m(--t) { transition: var(--t); } cube { @apply --m({color 1s, scale 2s}); }")).toEqual([
      ["cube", ["transition: color 1s , scale 2s"]],
    ]);
  });

  it("passes the parameters of a mixin to the mixins it applies", () => {
    expect(
      rules("@mixin --outer(--x) { @apply --inner(var(--x)); } @mixin --inner(--y) { size: var(--y); } cube { @apply --outer(4); }"),
    ).toEqual([["cube", ["size: 4"]]]);
  });

  it("lets a mixin applied inside another read the parameters of the outer one, unless it has its own", () => {
    expect(
      rules("@mixin --outer(--x, --y) { @apply --inner(5); } @mixin --inner(--y) { size: var(--x) var(--y); } cube { @apply --outer(3, 4); }"),
    ).toEqual([["cube", ["size: 3 5"]]]);
  });

  it("reads a type, like CSS", () => {
    expect(rules("@mixin --m(--c <color>: red, --n *) { color: var(--c); size: var(--n); } cube { @apply --m(blue, 2); }")).toEqual([
      ["cube", ["color: blue", "size: 2"]],
    ]);
  });
});

describe("@contents: the block @apply gives", () => {
  it("goes where the mixin writes @contents", () => {
    expect(
      rules("@mixin --small { @media (max-width: 600px) { @contents; } } cube { color: red; @apply --small { color: blue; } }"),
    ).toEqual([
      ["cube", ["color: red"]],
      ["cube @media (max-width: 600px)", ["color: blue"]],
    ]);
  });

  it("is replaced by the fallback of @contents when @apply gives no block", () => {
    expect(rules("@mixin --m { @contents { color: red; } } cube { @apply --m; } sphere { @apply --m { color: blue; } }")).toEqual([
      ["cube", ["color: red"]],
      ["sphere", ["color: blue"]],
    ]);
  });

  it("is empty with an empty block, and with no fallback", () => {
    expect(rules("@mixin --m { size: 1; @contents { color: red; } } cube { @apply --m {}; } sphere { @apply --m { } }")).toEqual([
      ["cube", ["size: 1"]],
      ["sphere", ["size: 1"]],
    ]);
  });

  it("can apply a mixin itself, in a rule and in a frame of @keyframes", () => {
    const source = "@mixin --wrap { @contents; } @mixin --big { scale: 2; } cube { @apply --wrap { @apply --big; } }";
    expect(rules(source)).toEqual([["cube", ["scale: 2"]]]);
    const frame = parse(tokenize(`${source} @keyframes k { to { @apply --wrap { @apply --big; } } }`)).keyframes[0];
    expect(frame.frames[0].declarations.map((d) => d.property)).toEqual(["scale"]);
    expect(errorsIn("@mixin --a { @apply --b { @apply --a; } } @mixin --b { @contents; } @scene { cube; } cube { @apply --a; }")).toEqual([
      ["--a", "--a applies itself: --a → --a"],
    ]);
  });

  it("does not see the parameters of the mixin: it belongs to the rule that applies it", () => {
    expect(rules("@mixin --m(--c: red) { color: var(--c); @contents; } cube { --c: blue; @apply --m { size: var(--c); } }")).toEqual([
      ["cube", ["--c: blue", "color: red", "size: var ( --c )"]],
    ]);
  });
});

describe("@mixin and @apply: the same shader as the rules written out", () => {
  it("declarations", () => {
    same(
      "@mixin --shiny { color: #ff5a36; material: metal(0.2); } .b { translate: 1 0.5 0; @apply --shiny; }",
      ".b { translate: 1 0.5 0; color: #ff5a36; material: metal(0.2); }",
    );
  });

  it("parameters, their defaults and the variables of the rule", () => {
    same(
      "@mixin --ball(--x, --size: 0.4, --tint: #3a7bff) { translate: var(--x) var(--size) 0; radius: var(--size); color: var(--tint); } sphere { --lift: 2; @apply --ball(calc(var(--lift) - 3)); } .b { @apply --ball(1.5, 0.6, #ff5a36); }",
      "sphere { --lift: 2; translate: calc(var(--lift) - 3) 0.4 0; radius: 0.4; color: #3a7bff; } .b { translate: 1.5 0.6 0; radius: 0.6; color: #ff5a36; }",
    );
  });

  it("nested rules, :hover and @media", () => {
    same(
      "@mixin --lively { color: #3a7bff; transition: 0.3s; &:hover { color: #ff5a36; scale: 1.2; } @media (max-width: 600px) { scale: 0.8; } } #g { translate: 0 1 0; } #g .a { @apply --lively; } .b { @apply --lively; translate: 2 0.5 0; }",
      "#g { translate: 0 1 0; } #g .a { color: #3a7bff; transition: 0.3s; } #g .a:hover { color: #ff5a36; scale: 1.2; } @media (max-width: 600px) { #g .a { scale: 0.8; } } .b { color: #3a7bff; transition: 0.3s; } .b:hover { color: #ff5a36; scale: 1.2; } @media (max-width: 600px) { .b { scale: 0.8; } } .b { translate: 2 0.5 0; }",
    );
  });

  it("in @media and in a frame of @keyframes", () => {
    same(
      "@mixin --up(--h: 2) { translate: 0 var(--h) 0; scale: 1.1; } @media (max-width: 600px) { .b { @apply --up(3); } } .a { animation: hop 2s infinite; } @keyframes hop { from { translate: 0 0.5 0; } 50% { @apply --up; } to { translate: 0 0.5 0; } }",
      "@media (max-width: 600px) { .b { translate: 0 3 0; scale: 1.1; } } .a { animation: hop 2s infinite; } @keyframes hop { from { translate: 0 0.5 0; } 50% { translate: 0 2 0; scale: 1.1; } to { translate: 0 0.5 0; } }",
    );
  });

  it("@contents, and a mixin that applies another", () => {
    same(
      "@mixin --small { @media (max-width: 600px) { @contents; } } @mixin --card(--tint) { color: var(--tint); @apply --small { color: #ffffff; scale: 0.5; } } .b { @apply --card(#ff5a36); }",
      ".b { color: #ff5a36; } @media (max-width: 600px) { .b { color: #ffffff; scale: 0.5; } }",
    );
  });

  it("a scene without mixins compiles as before: a mixin never applied changes nothing", () => {
    same("@mixin --unused(--a: 1) { size: var(--a); &:hover { color: red; } } .b { color: #ff5a36; }", ".b { color: #ff5a36; }");
  });
});

describe("@mixin and @apply: errors, where they are", () => {
  it("an unknown mixin", () => {
    expect(errorsIn("@scene { cube; } cube { @apply --nope; }")).toEqual([
      ["--nope", "The mixin --nope is not defined: write @mixin --nope { … } outside the rules"],
    ]);
  });

  it("a mixin that applies itself, directly or through another: at the @apply that closes the loop", () => {
    const direct = "@mixin --a { size: 1; @apply --a; } @scene { cube; } cube { @apply --a; }";
    expect(errorsIn(direct)).toEqual([["--a", "--a applies itself: --a → --a"]]);
    expect(startOf(direct)).toBe(direct.indexOf("@apply --a") + "@apply ".length);
    const loop = "@mixin --a { @apply --b; } @mixin --b { @apply --a; } @scene { cube; } cube { @apply --a; }";
    expect(errorsIn(loop)).toEqual([["--a", "--a applies itself: --a → --b → --a"]]);
    expect(startOf(loop)).toBe(loop.indexOf("{ @apply --a") + "{ @apply ".length); // inside --b
  });

  it("more arguments than parameters", () => {
    expect(errorsIn("@mixin --m(--a) { size: var(--a); } @scene { cube; } cube { @apply --m(1, 2, 3); }")).toEqual([
      ["2, 3", "--m takes 1 argument (--a), not 3"],
    ]);
    expect(errorsIn("@mixin --m { size: 1; } @scene { cube; } cube { @apply --m(1); }")).toEqual([
      ["1", "--m takes no argument, not 1"],
    ]);
  });

  it("a parameter read without a value", () => {
    expect(errorsIn("@mixin --m(--a) { size: var(--a); } @scene { cube; } cube { @apply --m; }")).toEqual([
      ["@apply --m", "@apply --m gives no value to --a, which has no default: write @apply --m(<value>), or @mixin --m(--a: <value>)"],
    ]);
  });

  it("a wrong argument, where it is written", () => {
    expect(errorsIn("@mixin --m(--s) { size: var(--s); } @scene { cube; } cube { @apply --m(-1); }")).toEqual([
      ["-1", "size expects one or three positive numbers, like: size: 2 1 1;"],
    ]);
  });

  it("an empty argument", () => {
    expect(errorsIn("@mixin --m(--a, --b) { size: 1; } @scene { cube; } cube { @apply --m(1, ); }")).toEqual([
      [",", "An argument of @apply --m is empty"],
    ]);
  });

  it("@apply outside a rule, @mixin and @contents in the wrong place", () => {
    expect(errorsIn("@apply --m; @mixin --m { size: 1; } @scene { cube; } cube { @mixin --n { } @contents; }")).toEqual([
      ["@apply", "@apply goes inside a rule, like: cube { @apply --name; }"],
      ["@mixin", "@mixin goes outside the rules"],
      ["@contents", "@contents goes inside a @mixin: it is where @apply puts its block"],
    ]);
  });

  it("a mixin with rules in a frame of @keyframes", () => {
    expect(
      errorsIn("@mixin --m { scale: 2; &:hover { scale: 3; } } @scene { cube; } @keyframes k { to { @apply --m; } } cube { animation: k 1s; }"),
    ).toEqual([["--m", "A frame of @keyframes takes declarations only, and --m holds a rule"]]);
  });

  it("a broken @mixin", () => {
    expect(errorsIn("@mixin red { size: 1; } @scene { cube; }")).toEqual([
      ["red", "@mixin takes a name that starts with --, like: @mixin --name { … }"],
    ]);
    expect(errorsIn("@mixin --m(--a, --a) { size: 1; } @scene { cube; }")).toEqual([
      ["--a", "--a is twice a parameter of --m"],
    ]);
    expect(errorsIn("@mixin --m(a: 1) { size: 1; } @scene { cube; }")).toEqual([
      ["a", "A parameter of @mixin is a name that starts with --, like: @mixin --m(--size: 1) { … }"],
    ]);
    expect(errorsIn("@mixin --m(--a) { --a: 2; } @scene { cube; }")).toEqual([
      ["--a", "--a is a parameter of --m: it cannot be declared inside it"],
    ]);
    expect(errorsIn("@mixin --m; @scene { cube; }")).toEqual([
      [";", "@mixin --m takes a block, like: @mixin --m { color: red; }"],
    ]);
  });

  it("every error of the file, with the rules after them", () => {
    expect(
      errorsIn("@scene { cube; sphere; } cube { @apply --nope; color: red; } sphere { @apply --gone(1); radius: -2; }").map(
        ([code]) => code,
      ),
    ).toEqual(["--nope", "--gone"]);
  });
});
