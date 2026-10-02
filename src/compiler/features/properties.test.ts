import { describe, it, expect } from "vitest";
import { compileScene } from "../index";
import { toShadertoy } from "../shader/shadertoy";

const NUMBER = '@property --h { syntax: "<number>"; inherits: false; initial-value: 1; }';
const ANGLE = '@property --turn { syntax: "<angle>"; inherits: false; initial-value: 90deg; }';
const COLOR = '@property --tint { syntax: "<color>"; inherits: false; initial-value: tomato; }';
const PERCENT = '@property --along { syntax: "<percentage>"; inherits: false; initial-value: 25%; }';

describe("@property: a variable set from JS (decision 105)", () => {
  it("becomes a uniform of the shader, with its initial value for the runtime", () => {
    const scene = compileScene(`${NUMBER} @scene { cube } cube { translate: 0 var(--h) 0; }`);
    expect(scene.shader).toContain("uniform vec4 uProperties[1];");
    expect(scene.shader).toContain("vec3(0.0, uProperties[0].x, 0.0)");
    expect(scene.properties).toEqual([{ name: "--h", syntax: "number", initial: [1, 0, 0, 0] }]);
  });

  it("reads an angle in radians, a percentage as written, a color in 0–1", () => {
    const scene = compileScene(
      `${ANGLE} ${COLOR} ${PERCENT} @scene { cube } cube { rotate-y: var(--turn); color: var(--tint); offset-path: path("M0 0 L4 0"); offset-distance: var(--along); }`,
    );
    expect(scene.properties).toEqual([
      { name: "--turn", syntax: "angle", initial: [1.570796, 0, 0, 0] },
      { name: "--tint", syntax: "color", initial: [1, 0.388, 0.278, 0] },
      { name: "--along", syntax: "percentage", initial: [25, 0, 0, 0] },
    ]);
    expect(scene.shader).toContain("uProperties[0].x");
    expect(scene.shader).toContain("uProperties[1].rgb");
    expect(scene.shader).toContain("(uProperties[2].x / 100.0 * 4.0)"); // a share of the path's length
  });

  it("starts from the value the scene gives it, like :root", () => {
    const scene = compileScene(`${NUMBER} @scene { cube } scene { --h: 2; } cube { translate: 0 var(--h) 0; }`);
    expect(scene.properties![0].initial).toEqual([2, 0, 0, 0]);
  });

  it("drives the background of the scene", () => {
    const shader = compileScene(`${COLOR} @scene { sphere } scene { background: var(--tint); }`).shader;
    expect(shader).toContain("vec3 background(vec3 rd) {\n  return uProperties[0].rgb;\n}");
  });

  it("mixes with :hover like any value", () => {
    const shader = compileScene(
      `${NUMBER} @scene { cube } cube { translate: 0 var(--h) 0; } cube:hover { translate: 0 2 0; }`,
    ).shader;
    expect(shader).toContain("mix(vec3(0.0, uProperties[0].x, 0.0), vec3(0.0, 2.0, 0.0), uHover[0])");
  });

  it("gives up the bounding sphere of an object it moves: its place is not known", () => {
    const scene = compileScene(`${NUMBER} @scene { torus } torus { translate: 0 var(--h) 0; }`);
    expect(scene.shader).not.toContain("its bounding sphere could be the nearest");
  });

  it("goes into the WGSL uniforms and the Shadertoy export", () => {
    const scene = compileScene(`${NUMBER} @scene { cube } cube { translate: 0 var(--h) 0; }`);
    expect(scene.wgsl).toContain("properties: array<vec4<f32>, 1>,");
    expect(scene.wgsl).toContain("gss.properties[0].x");
    expect(toShadertoy(scene)).toContain(
      "const vec4 uProperties[1] = vec4[1](vec4(1.0, 0.0, 0.0, 0.0)); // set from JS with the GSS runtime: the initial values",
    );
  });

  it("leaves a scene without @property as it was", () => {
    const scene = compileScene("@scene { cube } cube { translate: 0 1 0; }");
    expect(scene.shader).not.toContain("uProperties");
    expect(scene.properties).toBeUndefined();
  });

  it("needs syntax, inherits and an initial value that matches the syntax, like CSS", () => {
    const compile = (rule: string) => () => compileScene(`${rule} @scene { cube }`);
    expect(compile('@property --h { inherits: false; initial-value: 1; }')).toThrow(
      "@property --h needs a syntax",
    );
    expect(compile('@property --h { syntax: "<number>"; initial-value: 1; }')).toThrow(
      "@property --h needs inherits: true or false",
    );
    expect(compile('@property --h { syntax: "<number>"; inherits: false; }')).toThrow(
      "@property --h needs an initial-value",
    );
    expect(compile('@property --h { syntax: "<length>"; inherits: false; initial-value: 1px; }')).toThrow(
      'GSS reads the syntaxes "<number>", "<angle>", "<percentage>" and "<color>"',
    );
    expect(compile('@property --h { syntax: "<angle>"; inherits: false; initial-value: 2; }')).toThrow(
      "the initial-value of --h is an angle, like: 90deg",
    );
    expect(compile('@property h { syntax: "<number>"; inherits: false; initial-value: 1; }')).toThrow(
      "@property names a variable, like: @property --speed { … }",
    );
  });

  it("has one value for the whole scene: not on an object, a group, :hover or @keyframes", () => {
    expect(() => compileScene(`${NUMBER} @scene { cube } cube { --h: 2; }`)).toThrow(
      "--h is registered with @property: it has one value for the whole scene, set on scene or from JS",
    );
    expect(() =>
      compileScene(`${NUMBER} @scene { cube } cube { translate: 0 var(--h) 0; animation: a 1s; } @keyframes a { to { --h: 2; } }`),
    ).toThrow("--h is registered with @property: it has one value for the whole scene, set on scene or from JS");
  });

  it("says where it cannot go yet", () => {
    expect(() => compileScene(`${NUMBER} @scene { sphere } sphere { radius: var(--h); }`)).toThrow(
      "--h is set from JS: it can go in translate, rotate-x, rotate-y, rotate-z, scale, color, offset-distance and background, for now",
    );
    expect(() => compileScene(`${NUMBER} @scene { cube } cube { translate: 0 calc(var(--h) * 2) 0; }`)).toThrow(
      "--h is set from JS: it cannot go inside calc() or another function yet",
    );
    expect(() => compileScene(`${NUMBER} @scene { cube } cube { rotate-y: var(--h); }`)).toThrow(
      "rotate-y expects an angle: --h is a <number>",
    );
  });
});
