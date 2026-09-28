import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import { validateProperties } from "./validate";
import { compileGSS } from "./index";

const validate = (source: string) =>
  validateProperties(parse(tokenize(source)).rules);

describe("validateProperties", () => {
  it("accepts registered properties in the right place", () => {
    expect(() =>
      validate("cube { color: #fff; } scene { floor: #111; }"),
    ).not.toThrow();
  });

  it("rejects an unknown property", () => {
    expect(() => validate("cube { colr: #fff; }")).toThrow(
      'Unknown property "colr"',
    );
  });

  it("rejects a scene property on an object", () => {
    expect(() => validate("cube { floor: #111; }")).toThrow(
      '"floor" only applies to the scene',
    );
  });

  it("rejects an object property on the scene", () => {
    expect(() => validate("scene { color: #fff; }")).toThrow(
      '"color" only applies to objects',
    );
  });

  it("is called by compileGSS", () => {
    expect(() => compileGSS("@scene { cube; } cube { colr: #fff; }")).toThrow(
      "colr",
    );
  });

  it("rejects a shape property on another shape", () => {
    expect(() => validate("sphere { size: 2; }")).toThrow(
      '"size" only applies to cube',
    );
  });

  it("lists every compatible shape in the error", () => {
    expect(() => validate("cube { radius: 1; }")).toThrow(
      '"radius" only applies to sphere, torus',
    );
  });

  it("rejects height on a sphere", () => {
    expect(() => validate("sphere { height: 2; }")).toThrow(
      '"height" only applies to cylinder',
    );
  });

  it("accepts a shape property through a class", () => {
    expect(() => validate(".big { size: 2; }")).not.toThrow();
  });

  it("rejects a shape property on the scene", () => {
    expect(() => validate("scene { radius: 1; }")).toThrow(
      '"radius" only applies to objects',
    );
  });
});

describe("validateKeyframes", () => {
  it("accepts animatable properties", () => {
    expect(() =>
      compileGSS(
        "@scene { cube; } cube { animation: k 1s; } @keyframes k { to { translate: 0 1 0; color: #fff; } }",
      ),
    ).not.toThrow();
  });

  it("rejects an unknown property in a frame", () => {
    expect(() =>
      compileGSS("@scene { cube; } @keyframes k { to { colr: #fff; } }"),
    ).toThrow('Unknown property "colr" in @keyframes k');
  });

  it("rejects a property that cannot be animated", () => {
    expect(() =>
      compileGSS("@scene { cube; } @keyframes k { to { size: 2; } }"),
    ).toThrow('"size" cannot be animated (in @keyframes k)');
  });

  it("lists the animatable properties in the error", () => {
    expect(() =>
      compileGSS("@scene { cube; } @keyframes k { to { size: 2; } }"),
    ).toThrow("translate, color, rotate-x, rotate-y, rotate-z, scale");
  });
});
