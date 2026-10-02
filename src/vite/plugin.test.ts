import { describe, it, expect } from "vitest";
import gss, { isGssModule, gssModule } from "./plugin";

// Decision 63: import scene from "./logo.gss" compiles at build time.

describe("isGssModule", () => {
  it("takes .gss files", () => {
    expect(isGssModule("/app/src/logo.gss")).toBe(true);
  });

  it("leaves ?raw (and any other query) to Vite: the site imports scene.gss?raw", () => {
    expect(isGssModule("/app/src/scene.gss?raw")).toBe(false);
    expect(isGssModule("/app/src/main.ts")).toBe(false);
  });
});

describe("gssModule", () => {
  it("exports the compiled scene", () => {
    const code = gssModule("@scene { sphere; }");
    expect(code).toMatch(/^export default /m);
    expect(code).toContain('"objects": 1');
    expect(code).toContain("void main");
  });

  it("turns relative images into Vite assets, next to the .gss file", () => {
    const code = gssModule(`@scene { cube.a; cube.b; }
      .a { texture: url("dirt.png"); }
      .b { texture: url("/textures/grass-top.png"); }`);
    expect(code).toContain('new URL("./dirt.png", import.meta.url).href');
    expect(code).toContain('"/textures/grass-top.png"'); // absolute: served as it is
  });

  it("turns the images of every @media version into assets too", () => {
    const code = gssModule(`@scene { cube; }
      @media (max-width: 600px) { cube { texture: url("small.png"); } }`);
    expect(code).toContain(
      'scene.media.variants[1].textures = [new URL("./small.png", import.meta.url).href];',
    );
    expect(code).not.toContain('"small.png"'); // never left as a bare relative path
  });

  it("throws the GSS error", () => {
    expect(() => gssModule("@scene { teapot; }")).toThrow(/teapot/);
  });
});

describe("the plugin", () => {
  it("is named, and only transforms .gss files", () => {
    const plugin = gss();
    expect(plugin.name).toBe("gss-lang");
    const transform = plugin.transform as (code: string, id: string) => unknown;
    expect(transform.call({}, "export default 1", "/app/main.ts")).toBeNull();
  });
});

describe("the errors of a .gss file", () => {
  it("are all written in Vite's terminal, each with its line and column (decision 86)", () => {
    const plugin = gss();
    let message = "";
    const context = { error: (text: string) => { message = text; throw new Error(text); } };
    const transform = plugin.transform as (this: unknown, source: string, id: string) => unknown;
    expect(() =>
      transform.call(context, "@scene { cube; sphere; }\ncube { size: -1; }\nsphere { radius: -2; }", "/app/a.gss"),
    ).toThrow();
    expect(message).toBe(
      [
        "2 GSS errors in /app/a.gss",
        "  2:14  size expects one or three positive numbers, like: size: 2 1 1;",
        "  3:18  radius expects one positive number, like: radius: 2;",
      ].join("\n"),
    );
  });
});
