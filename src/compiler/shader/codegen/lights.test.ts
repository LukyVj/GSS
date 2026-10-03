import { describe, it, expect } from "vitest";
import { compileGSS, compileScene } from "../../index";

const lamp = "light#bulb { translate: 0 2 0; color: #ffd27a; intensity: 3; }";

describe("lights: the elements of @scene", () => {
  it("leaves a scene without lights as it was: the sun and the ambient light", () => {
    const shader = compileGSS("@scene { sphere; } scene { light: -120deg 30deg; ambient: 0.3; }");
    expect(shader).toContain("const vec3 LIGHT_DIR = ");
    expect(shader).toContain("vec3 diffuse(vec3 n, vec3 color) {");
    expect(shader).not.toContain("lighting(");
  });

  it("draws nothing for a light, and lights the surfaces from where it is", () => {
    const scene = compileScene(`@scene { sphere; light#bulb; } ${lamp}`);
    expect(scene.objects).toBe(1); // the light is not an object of the scene
    const shader = scene.shader;
    expect(shader).toContain("vec3 diffuse(vec3 p, vec3 n, vec3 color) {");
    expect(shader).toContain("vec3 lightPosition0() {  // light#bulb");
    expect(shader).toContain("light0 = lightPosition0();"); // once per pixel, in animate()
    expect(shader).toContain("lamp(light0, p)");
    expect(shader).not.toMatch(/if \(id == 2\.0\)/); // no material for it
  });

  it("is white, with an intensity of 1, by default", () => {
    expect(compileGSS("@scene { sphere; light; } light { translate: 0 2 0; }")).toContain("vec3(1.0) * l0.w");
  });

  it("follows its groups: turned, moved and scaled, from the inside out", () => {
    const shader = compileGSS(
      "@scene { group#arm { light#tip; } sphere; } #arm { translate: 1 0 0; rotate-y: 90deg; scale: 2; } #tip { translate: 0 1 0.5; }",
    );
    const body = shader.slice(shader.indexOf("vec3 lightPosition0()"), shader.indexOf("return v;", shader.indexOf("vec3 lightPosition0()")));
    const order = ["v += vec3(0.0, 1.0, 0.5);", "v *= 2.0;", "v.xz *= rot(-1.571);", "v += vec3(1.0, 0.0, 0.0);"].map((line) =>
      body.indexOf(line),
    );
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("lights metal, jelly and glass too: their highlights come from every light", () => {
    const shader = compileGSS(
      `@scene { sphere#a; sphere#b; sphere#c; light#bulb; } #a { material: gold; } #b { material: jelly; } #c { material: glass(#ffffff, 1.5, blurred 0.4); } ${lamp} scene { light: none; }`,
    );
    for (const call of ["lightShine(p, r, ", "lightWrap(p, n)", "lightBump(p, bump(p, fs.x))", "diffuse(p, n, "])
      expect(shader, call).toContain(call);
    expect(shader).not.toContain("LIGHT_DIR"); // no sun: nothing reads its direction
  });

  it("changes on :hover through its group, and plays an animation", () => {
    const scene = compileScene(
      "@scene { group#lamp { sphere; light#bulb; } } #bulb { translate: 0 1.5 0; intensity: 0; transition: 0.3s; animation: flicker 2s infinite alternate; } #lamp:hover #bulb { intensity: 3; } @keyframes flicker { to { color: #ffb36b; } }",
    );
    expect(scene.hover).toHaveLength(1);
    expect(scene.shader).toContain("uHover[0]");
    expect(scene.shader).toMatch(/light0|anim\d+/);
    expect(scene.shader).toContain("iTime");
  });

  it("reads variables set from JS", () => {
    const shader = compileGSS(
      '@property --i { syntax: "<number>"; inherits: false; initial-value: 2; } @property --c { syntax: "<color>"; inherits: false; initial-value: #ffd27a; } @scene { sphere; light; } light { translate: 0 2 0; intensity: var(--i); color: var(--c); }',
    );
    expect(shader).toContain("uProperties[0]");
    expect(shader).toContain("uProperties[1]");
  });

  it("is lowered to WGSL", () => {
    expect(compileGSS(`@scene { sphere; light#bulb; } ${lamp}`, "wgsl")).toContain("g_lightPosition0");
  });
});

describe("lights: the sun and the ambient light", () => {
  it("gives the sun a color and an intensity", () => {
    const shader = compileGSS("@scene { sphere; } scene { light: -45deg 54.7deg #ff8a5c 0.5; }");
    expect(shader).toMatch(/const vec3 SUN = vec3\(0\.5, 0\.27\d?, 0\.18\d?\);/);
    expect(shader).toContain("vec3 diffuse(vec3 p, vec3 n, vec3 color) {");
  });

  it("turns the sun off with none", () => {
    const shader = compileGSS(`@scene { sphere; light#bulb; } ${lamp} scene { light: none; }`);
    expect(shader).not.toContain("LIGHT_DIR");
    expect(shader).not.toContain("SUN");
  });

  it("gives the ambient light a color", () => {
    expect(compileGSS("@scene { sphere; } scene { ambient: 0.2 #9db4ff; }")).toContain(
      "const vec3 AMBIENT_LIGHT = vec3(0.123, 0.141, 0.2);",
    );
  });

  it("animates the sun with the scene, and from none", () => {
    for (const frames of [
      "to { light: 90deg 10deg #ff8a5c; }",
      "from { light: none; } to { light: 0deg 60deg; }",
    ]) {
      const shader = compileGSS(`@scene { sphere; } scene { animation: day 8s infinite alternate; } @keyframes day { ${frames} }`);
      expect(shader, frames).toContain("iTime");
      expect(shader, frames).toContain("normalize(mix(");
    }
  });
});

describe("lights: errors", () => {
  it("says what a light takes", () => {
    expect(() => compileGSS("@scene { light; } light { material: gold; }")).toThrow('"material" does not apply to a light');
    expect(() => compileGSS("@scene { light; } light { radius: 1; }")).toThrow('"radius" only applies to');
    expect(() => compileGSS("@scene { cube; } cube { intensity: 2; }")).toThrow('"intensity" only applies to light');
    expect(() => compileGSS("@scene { light; } light { color: linear-gradient(red, blue); }")).toThrow("A light takes a color");
  });

  it("cannot hover or press a light, which is never drawn", () => {
    expect(() => compileGSS("@scene { light; } light:hover { intensity: 2; }")).toThrow("A light is never drawn");
    expect(() => compileGSS("@scene { light; } light:active { intensity: 2; }")).toThrow("A light is never drawn");
  });

  it("takes 8 lights at most", () => {
    expect(() => compileGSS("@scene { light * 8; }")).not.toThrow();
    expect(() => compileGSS("@scene { light * 9; }")).toThrow("A scene has 8 lights at most");
  });

  it("checks the values", () => {
    expect(() => compileGSS("@scene { light; } light { intensity: -1; }")).toThrow("intensity expects");
    expect(compileGSS("@scene { light; } light { intensity: calc(-1); }")).toBe(compileGSS("@scene { light; } light { intensity: 0; }"));
    expect(() => compileGSS("@scene { sphere; } scene { light: 45deg; }")).toThrow("light expects");
    expect(() => compileGSS("@scene { sphere; } scene { light: 45deg 60deg 2 3; }")).toThrow("light expects");
    expect(() => compileGSS("@scene { sphere; } scene { ambient: 0.2 #fff #000; }")).toThrow("ambient expects");
  });
});
