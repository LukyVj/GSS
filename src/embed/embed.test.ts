import { describe, it, expect } from "vitest";
import { valueImports } from "../test/imports";
import { toCompiled } from "./index";
import { readControls, sourceUrl } from "./options";

// Decision 63: three ways to embed a scene. The GPU parts run in a browser;
// here, what decides what runs.

describe("gss-lang/runtime", () => {
  it("never imports the compiler: a precompiled scene ships without it", () => {
    const files = valueImports("embed/runtime.ts");
    expect(files).toContain("runtime/view.ts");
    expect(files.filter((file) => file.startsWith("compiler/"))).toEqual([]);
  });
});

describe("toCompiled", () => {
  it("compiles GSS text", () => {
    const compiled = toCompiled("@scene { sphere; }");
    expect(compiled.objects).toBe(1);
    expect(compiled.shader).toContain("void main");
  });

  it("keeps a scene compiled at build time as it is", () => {
    const compiled = toCompiled("@scene { cube; }");
    expect(toCompiled(compiled)).toBe(compiled);
  });

  it("throws the GSS error", () => {
    expect(() => toCompiled("@scene { teapot; }")).toThrow(/teapot/);
  });
});

describe("<gss-scene controls>", () => {
  it("is on by default, like the playground", () => {
    expect(readControls(null)).toBe(true);
    expect(readControls("")).toBe(true); // <gss-scene controls>
  });

  it("is off with none, false or off: only :hover", () => {
    expect(readControls("none")).toBe(false);
    expect(readControls("false")).toBe(false);
    expect(readControls("OFF")).toBe(false);
  });
});

describe("<gss-scene src>", () => {
  it("is read against the page, and becomes the base of the images", () => {
    const page = "https://example.com/blog/post.html";
    expect(sourceUrl("scenes/logo.gss", page)).toBe(
      "https://example.com/blog/scenes/logo.gss",
    );
    expect(sourceUrl("https://gss-lang.dev/logo.gss", page)).toBe(
      "https://gss-lang.dev/logo.gss",
    );
  });
});
