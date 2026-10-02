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
    expect(() => compileScene(`${NUMBER} @scene { cube } cube { rotate-y: var(--h); }`)).toThrow(
      "rotate-y expects an angle: --h is a <number>",
    );
  });
});

describe("a variable set from JS inside math (decision 105)", () => {
  const shaderOf = (rules: string, scene = "cube") => compileScene(`${NUMBER} ${ANGLE} @scene { ${scene} } ${rules}`).shader;

  it("writes calc() in GLSL around the uniform", () => {
    expect(shaderOf("cube { translate: 0 calc(var(--h) * 2 + 1) 0; }")).toContain(
      "vec3(0.0, ((uProperties[0].x * 2.0) + 1.0), 0.0)",
    );
  });

  it("still computes what does not depend on it: sibling-index()", () => {
    const shader = shaderOf("cube { translate: calc(sibling-index() * var(--h)) 0 0; }", "cube * 2");
    expect(shader).toContain("vec3((1.0 * uProperties[0].x), 0.0, 0.0)");
    expect(shader).toContain("vec3((2.0 * uProperties[0].x), 0.0, 0.0)");
  });

  it("adds angles in degrees, and gives the rotation radians", () => {
    expect(shaderOf("cube { rotate-y: calc(var(--turn) + 45deg); }")).toContain(
      "radians((degrees(uProperties[1].x) + 45.0))",
    );
    expect(shaderOf("cube { rotate-y: calc(var(--turn) * 2); }")).toContain("radians((degrees(uProperties[1].x) * 2.0))");
  });

  it("calls the math functions on the GPU", () => {
    expect(shaderOf("cube { translate: 0 max(var(--h), 1, 0.5) 0; }")).toContain(
      "max(max(uProperties[0].x, 1.0), 0.5)",
    );
    expect(shaderOf("cube { scale: clamp(0.5, var(--h), 2); }")).toContain("min(max(uProperties[0].x, 0.5), 2.0)");
    expect(shaderOf("cube { translate: 0 calc(sin(var(--turn)) + 1) 0; }")).toContain(
      "(sin(uProperties[1].x) + 1.0)",
    );
    // atan2() gives degrees; the rotation takes radians: the two conversions cancel
    expect(shaderOf("cube { rotate-z: atan2(var(--h), 1); }")).toContain("atan(uProperties[0].x, 1.0)");
    expect(shaderOf("cube { rotate-z: atan2(var(--h), 1); }")).not.toContain("degrees(atan(");
    expect(shaderOf("cube { translate: 0 round(down, var(--h), 0.5) 0; }")).toContain(
      "(floor((uProperties[0].x / 0.5)) * 0.5)",
    );
    expect(shaderOf("cube { translate: 0 rem(var(--h), 2) 0; }")).toContain(
      "(uProperties[0].x - 2.0 * trunc((uProperties[0].x / 2.0)))",
    );
    expect(shaderOf("cube { translate: 0 hypot(var(--h), 3) 0; }")).toContain(
      "sqrt(uProperties[0].x * uProperties[0].x + 3.0 * 3.0)",
    );
  });

  it("still checks the units, and refuses random() and colors", () => {
    expect(() => shaderOf("cube { translate: 0 calc(var(--h) + 10deg) 0; }")).toThrow("Cannot add a number and a deg value");
    expect(() => shaderOf("cube { translate: 0 random(var(--h), 2) 0; }")).toThrow(
      "random() cannot use --h: a random value is chosen once, when the scene compiles",
    );
    expect(() =>
      compileScene(`${COLOR} @scene { cube } cube { translate: 0 calc(var(--tint) * 2) 0; }`),
    ).toThrow("--tint is a color: math works on numbers, angles and percentages");
  });
});

describe("a variable set from JS inside a color function (decision 105)", () => {
  const HUE = '@property --hue { syntax: "<number>"; inherits: false; initial-value: 20; }';
  const PART = '@property --part { syntax: "<percentage>"; inherits: false; initial-value: 30%; }';
  const compile = (rules: string) => compileScene(`${HUE} ${ANGLE} ${COLOR} ${PART} @scene { cube } ${rules}`);
  const shaderOf = (rules: string) => compile(rules).shader;

  it("computes hsl() on the GPU, with the hue in degrees", () => {
    const shader = shaderOf("cube { color: hsl(var(--hue) 80% 60%); }");
    expect(shader).toContain("matte(clamp(colorHsl(mod(uProperties[0].x, 360.0), 0.8, 0.6), 0.0, 1.0))");
    expect(shader).toContain("vec3 colorHsl(float h, float s, float l) {");
    expect(shaderOf("cube { color: hsl(var(--turn) 80% 60%); }")).toContain("colorHsl(mod(degrees(uProperties[1].x), 360.0), 0.8, 0.6)");
  });

  it("computes rgb(), hwb(), oklch() and color() the same way", () => {
    expect(shaderOf("cube { color: rgb(var(--hue) 0 0); }")).toContain(
      "clamp(vec3(clamp(uProperties[0].x, 0.0, 255.0) / 255.0, 0.0, 0.0), 0.0, 1.0)",
    );
    expect(shaderOf("cube { color: hwb(var(--hue) 10% 20%); }")).toContain("colorHwb(mod(uProperties[0].x, 360.0), 0.1, 0.2)");
    expect(shaderOf("cube { color: oklch(70% 0.15 var(--hue)); }")).toContain(
      "colorOklab(colorFromPolar(vec3(0.7, 0.15, mod(uProperties[0].x, 360.0))))",
    );
    expect(shaderOf("cube { color: color(display-p3 1 var(--part) 0); }")).toContain(
      "colorP3(vec3(1.0, (uProperties[3].x / 100.0), 0.0))",
    );
  });

  it("mixes in any space with color-mix(), its percentages too", () => {
    expect(shaderOf("cube { color: color-mix(in oklab, var(--tint), #ffffff); }")).toContain(
      "colorOklab(mix(colorToOklab(uProperties[2].rgb), colorToOklab(vec3(1.0, 1.0, 1.0)), 0.5))",
    );
    expect(shaderOf("cube { color: color-mix(in srgb, #000000, #ffffff var(--part)); }")).toContain(
      "mix(vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0), (clamp(uProperties[3].x, 0.0, 100.0) / ((100.0 - clamp(uProperties[3].x, 0.0, 100.0)) + clamp(uProperties[3].x, 0.0, 100.0))))",
    );
    expect(shaderOf("cube { color: color-mix(in oklch longer hue, var(--tint), blue); }")).toContain(
      "colorMixOklch(uProperties[2].rgb, vec3(0.0, 0.0, 1.0), 0.5, 1.0)",
    );
  });

  it("nests: a color function inside color-mix(), light-dark(), contrast-color()", () => {
    expect(shaderOf("cube { color: color-mix(in srgb, hsl(var(--hue) 50% 50%), black); }")).toContain(
      "mix(clamp(colorHsl(mod(uProperties[0].x, 360.0), 0.5, 0.5), 0.0, 1.0), vec3(0.0, 0.0, 0.0), 0.5)",
    );
    expect(shaderOf("cube { color: light-dark(var(--tint), #000000); }")).toContain("matte(uProperties[2].rgb)");
    expect(shaderOf("cube { color: contrast-color(var(--tint)); }")).toContain("colorContrast(uProperties[2].rgb)");
  });

  it("drives the background and a hovered color", () => {
    const shader = shaderOf("cube { color: #ff0000; } cube:hover { color: hsl(var(--hue) 80% 60%); } scene { background: oklch(30% 0.1 var(--hue)); }");
    expect(shader).toContain("mix(vec3(1.0, 0.0, 0.0), clamp(colorHsl(");
    expect(shader).toContain("return clamp(colorOklab(colorFromPolar(vec3(0.3, 0.1, mod(uProperties[0].x, 360.0)))), 0.0, 1.0);");
  });

  it("lowers the color functions to WGSL", () => {
    const scene = compile("cube { color: color-mix(in lch, lab(50 var(--hue) 0), hwb(var(--hue) 0% 0%)); }");
    expect(scene.wgsl).toContain("fn g_colorMixLch(");
    expect(scene.wgsl).toContain("fn g_colorLab(");
  });
});
