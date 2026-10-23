import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "../index";

const compile = (source: string) => compileScene(source, { target: "glsl" });

describe("controls: the gestures that move the camera", () => {
  it("is absent by default: a drag turns the camera, the wheel zooms", () => {
    expect(compile("@scene { sphere; }").controls).toBeUndefined();
    expect(compile("@scene { sphere; } scene { controls: auto; }").controls).toBeUndefined();
    expect(compile("@scene { sphere; } scene { controls: orbit zoom; }").controls).toBeUndefined();
  });

  it("turns both gestures off with none", () => {
    expect(compile("@scene { sphere; } scene { controls: none; }").controls).toEqual({ orbit: false, zoom: false });
  });

  it("keeps the gestures it names, in any order", () => {
    expect(compile("@scene { sphere; } scene { controls: orbit; }").controls).toEqual({ orbit: true, zoom: false });
    expect(compile("@scene { sphere; } scene { controls: zoom; }").controls).toEqual({ orbit: false, zoom: true });
    expect(compile("@scene { sphere; } scene { controls: zoom orbit; }").controls).toBeUndefined();
  });

  it("follows @media, like any property of the scene", () => {
    const scene = compile("@scene { sphere; } @media (max-width: 600px) { scene { controls: none; } }");
    const [narrow, wide] = scene.media!.variants;
    expect([narrow.controls, wide.controls]).toContainEqual({ orbit: false, zoom: false });
    expect([narrow.controls, wide.controls]).toContainEqual(undefined);
  });

  it("on an object, keeps a gesture from starting over it", () => {
    const scene = compile("@scene { cube; sphere; } sphere { controls: none; }");
    expect(scene.controls).toEqual({ orbit: true, zoom: true, objects: [{ id: 2, orbit: false, zoom: false }] });
    expect(compile("@scene { cube; } cube { controls: zoom; }").controls).toEqual({
      orbit: true,
      zoom: true,
      objects: [{ id: 1, orbit: false, zoom: true }],
    });
  });

  it("is inherited from a group, like cursor, and an object can say auto again", () => {
    const scene = compile("@scene { group#g { cube; sphere; } torus; } #g { controls: none; } sphere { controls: auto; }");
    expect(scene.controls?.objects).toEqual([{ id: 1, orbit: false, zoom: false }]);
  });

  it("asks the shader for the picking pass only for the objects", () => {
    const shader = compileGSS("@scene { sphere; } sphere { controls: none; }");
    expect(shader).toContain("uniform bool uPicking;");
    expect(compileScene("@scene { sphere; } sphere { controls: none; }").wgsl).toContain("gss.pick");
    // On the scene alone, the runtime decides: the shader is the same as without it
    expect(compileGSS("@scene { sphere; } scene { controls: none; }")).toBe(compileGSS("@scene { sphere; }"));
  });

  it("refuses what is not a gesture", () => {
    const error = /controls expects auto, none, or orbit and zoom, like: controls: orbit;/;
    expect(() => compile("@scene { sphere; } scene { controls: pan; }")).toThrow(error);
    expect(() => compile("@scene { sphere; } scene { controls: none orbit; }")).toThrow(error);
    expect(() => compile("@scene { sphere; } scene { controls: orbit orbit; }")).toThrow(error);
    expect(() => compile("@scene { sphere; } scene { controls: 1; }")).toThrow(error);
  });

  it("is not a state: :hover cannot set it, nor a light take it", () => {
    expect(() => compile("@scene { sphere; } sphere:hover { controls: none; }")).toThrow();
    expect(() => compile("@scene { light; } light { controls: none; }")).toThrow();
  });
});
