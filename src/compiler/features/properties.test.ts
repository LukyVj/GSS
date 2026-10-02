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
    expect(compile('@property --h { syntax: "<time>"; inherits: false; initial-value: 1s; }')).toThrow(
      'GSS reads the syntaxes "<number>", "<angle>", "<percentage>", "<color>" and "<length>"',
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
    expect(() =>
      compileScene(`${NUMBER} @scene { path } path { d: path("M0 0 L1 0"); view-box: 0 0 var(--h) 1; }`),
    ).toThrow("--h is set from JS, and view-box is read when the scene compiles. A variable set from JS can go in translate,");
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

describe("a variable set from JS in the size of a shape (decision 105)", () => {
  const SIZE = '@property --s { syntax: "<number>"; inherits: false; initial-value: 1; }';
  const shaderOf = (scene: string, rules: string) => compileScene(`${SIZE} @scene { ${scene} } ${rules}`).shader;

  it("sizes the shapes on the GPU, never below 0", () => {
    expect(shaderOf("sphere", "sphere { radius: var(--s); }")).toContain("sdSphere(q, max(uProperties[0].x, 0.0))");
    expect(shaderOf("cube", "cube { size: var(--s) 1 2; corner-radius: 0; }")).toContain(
      "sdRoundBox(q, vec3((max(uProperties[0].x, 0.0) / 2.0), 0.5, 1.0), min(0.0, (max(uProperties[0].x, 0.0) / 2.0)))",
    );
    expect(shaderOf("torus", "torus { radius: var(--s); thickness: calc(var(--s) / 4); }")).toContain(
      "sdTorus(q, vec2(max(uProperties[0].x, 0.0), max((uProperties[0].x / 4.0), 0.0)))",
    );
    expect(shaderOf("capsule", "capsule { height: var(--s); radius: 0.25; }")).toContain(
      "sdCapsule(q, max(((max(uProperties[0].x, 0.0) / 2.0) - 0.25), 0.0), 0.25)",
    );
    expect(shaderOf("cone", "cone { radius: var(--s) 0.1; }")).toContain("sdCappedCone(q, 0.5, max(uProperties[0].x, 0.0), 0.1)");
    expect(shaderOf("plane", "plane { size: 4 var(--s); }")).toContain(
      "sdRoundBox(q, vec3(2.0, 0.01, (max(uProperties[0].x, 0.0) / 2.0)), 0.0)",
    );
  });

  it("thickens a path and deepens a prism", () => {
    expect(shaderOf("path", 'path { d: path("M0 0 L1 0"); stroke-width: var(--s); }')).toContain(
      "(max(uProperties[0].x, 0.0) / 2.0)",
    );
    expect(shaderOf("prism", "prism { d: polygon(0 1, 1 -1, -1 -1); depth: var(--s); }")).toContain(
      "(max(uProperties[0].x, 0.0) / 2.0)",
    );
  });

  it("gives up the spheres around the object and the scene: its size is not known", () => {
    const still = shaderOf("sphere", "sphere { radius: 1; }");
    expect(still).toContain("float b = dot(oc, rd);");
    expect(shaderOf("sphere", "sphere { radius: var(--s); }")).not.toContain("float b = dot(oc, rd);");
    expect(shaderOf("path", 'path { d: path("M0 0 L1 0"); stroke-width: var(--s); }')).not.toContain(
      "its bounding sphere could be the nearest",
    );
  });

  it("paints a gradient and a texture over the size of the moment", () => {
    expect(shaderOf("cube", "cube { size: var(--s); color: linear-gradient(red, blue); }")).toContain(
      "vec2 size = vec2(max(uProperties[0].x, 0.0), max(uProperties[0].x, 0.0));",
    );
  });
});

describe("a variable set from JS in gradients, materials, the light and the floor (decision 105)", () => {
  const VARS = [
    '@property --a { syntax: "<angle>"; inherits: false; initial-value: 30deg; }',
    '@property --p { syntax: "<percentage>"; inherits: false; initial-value: 40%; }',
    '@property --n { syntax: "<number>"; inherits: false; initial-value: 0.3; }',
    '@property --c { syntax: "<color>"; inherits: false; initial-value: #ff5a36; }',
  ].join(" ");
  const compile = (rules: string, scene = "cube") => compileScene(`${VARS} @scene { ${scene} } ${rules}`);
  const shaderOf = (rules: string, scene?: string) => compile(rules, scene).shader;
  const gradient = (shader: string) => shader.slice(shader.indexOf("vec3 gradientColor("));

  it("turns, moves and colors a gradient", () => {
    const linear = gradient(shaderOf("cube { color: linear-gradient(var(--a), var(--c), #000000 var(--p)); }"));
    expect(linear).toContain("vec2 dir = vec2(sin(uProperties[0].x), cos(uProperties[0].x));");
    expect(linear).toContain("vec3 col = uProperties[3].rgb;");
    expect(linear).toContain("clamp((t - 0.0) / max(max(0.0, (uProperties[1].x / 100.0)) - 0.0, 0.00001), 0.0, 1.0)");
    const radial = gradient(shaderOf("cube { color: radial-gradient(circle at var(--p) 50%, red, blue); }"));
    expect(radial).toContain("vec2 c = vec2((uProperties[1].x / 100.0), 0.5) * size;");
    const conic = gradient(shaderOf("cube { color: conic-gradient(from var(--a), red, blue); }"));
    expect(conic).toContain(" / 6.2831853 - (uProperties[0].x / 6.2831853));");
  });

  it("drives the background gradient", () => {
    const shader = shaderOf("scene { background: linear-gradient(var(--a), #000000, var(--c)); }");
    expect(shader.slice(shader.indexOf("vec3 background(vec3 rd)"))).toContain("vec2 dir = vec2(sin(uProperties[0].x), cos(uProperties[0].x));");
  });

  it("sets the color and the settings of a material, kept in their range", () => {
    expect(shaderOf("cube { material: metal(var(--c), var(--n)); }")).toContain(
      "return metal(uProperties[3].rgb, clamp(uProperties[2].x, 0.0, 1.0));",
    );
    expect(shaderOf("cube { material: jelly(var(--n)); }")).toContain("jelly(vec3(0.9), clamp(uProperties[2].x, 0.0, 1.0))");
    expect(shaderOf("cube { material: glass(#ffffff, calc(1 + var(--n)), hammered var(--n)); }")).toContain(
      "glass(vec3(1.0, 1.0, 1.0), clamp((1.0 + uProperties[2].x), 1.0, 3.0), clamp(uProperties[2].x, 0.0, 1.0), HAMMERED)",
    );
  });

  it("lights the scene: the floor, the ambient light, the direction of the sun", () => {
    const shader = shaderOf("scene { floor: var(--c); ambient: var(--n); light: var(--a) 45deg; }");
    expect(shader).toContain("return matte(uProperties[3].rgb);  // the floor");
    expect(shader).toContain("color * (clamp(uProperties[2].x, 0.0, 1.0) + (1.0 - clamp(uProperties[2].x, 0.0, 1.0)) * diff)");
    expect(shader).toContain("vec3 lightDirection() {\n  return vec3(cos(0.785398) * sin(uProperties[0].x), sin(0.785398), cos(0.785398) * cos(uProperties[0].x));\n}");
    expect(shader).toContain("#define LIGHT_DIR lightDirection()");
    expect(compile("scene { light: var(--a) 45deg; }").wgsl).toContain("g_lightDirection()");
  });

  it("smooths a blend by a width set from JS, never 0", () => {
    const shader = shaderOf("sphere { blend: var(--n); }", "cube; sphere");
    expect(shader).toContain("opSmoothU(res, vec2(sdSphere(q, 0.5) * 1.0, 2.0), max(uProperties[2].x, 0.00001))");
    expect(shader).not.toContain("float b = dot(oc, rd);"); // the reach of the blend is not known
  });
});

describe("a variable set from JS in a filter (decision 105)", () => {
  const VARS = [
    '@property --n { syntax: "<number>"; inherits: false; initial-value: 1.2; }',
    '@property --p { syntax: "<percentage>"; inherits: false; initial-value: 50%; }',
    '@property --a { syntax: "<angle>"; inherits: false; initial-value: 90deg; }',
    '@property --r { syntax: "<length>"; inherits: false; initial-value: 4px; }',
  ].join(" ");
  const compile = (rules: string) => compileScene(`${VARS} @scene { sphere#a; sphere#b } ${rules}`);

  it("reads a <length> in px, like CSS", () => {
    expect(compile("").properties!.find((p) => p.name === "--r")).toEqual({ name: "--r", syntax: "length", initial: [4, 0, 0, 0] });
  });

  it("computes the pixel filters of the scene and of objects on the GPU", () => {
    const scene = compile("scene { filter: contrast(var(--n)) grayscale(var(--p)) hue-rotate(var(--a)); } #a { filter: brightness(var(--n)); }");
    expect(scene.shader).toContain("c = clamp((c - 0.5) * max(uProperties[0].x, 0.0) + 0.5, 0.0, 1.0);");
    expect(scene.shader).toContain("(0.2126 + 0.7874 * (1.0 - clamp(uProperties[1].x / 100.0, 0.0, 1.0)))");
    expect(scene.shader).toContain("cos(uProperties[2].x)");
    expect(scene.shader).toContain("c = clamp(c * max(uProperties[0].x, 0.0), 0.0, 1.0);");
  });

  it("blurs by a length set from JS, and its passes read the variables too", () => {
    const scene = compile("scene { filter: blur(var(--r)) brightness(var(--n)); } #b { filter: bloom(var(--n), var(--r)); }");
    const shaders = scene.passes!.map((pass) => pass.shader);
    expect(shaders.some((s) => s.includes("float sigma = max(uProperties[3].x, 0.0) * uRatio;"))).toBe(true);
    expect(shaders.some((s) => s.includes("vec3 c = clamp(here0.rgb + max(uProperties[0].x, 0.0) * texture(uInput1, uv).rgb, 0.0, 1.0);"))).toBe(true);
    // The pass after the blur ends with the brightness, and declares what the scene declares
    const last = shaders[shaders.length - 1];
    expect(last).toContain("c = clamp(c * max(uProperties[0].x, 0.0), 0.0, 1.0);");
    expect(last).toContain("uniform vec4 uProperties[4];");
    expect(scene.passes![shaders.length - 1].wgsl).toContain("properties: array<vec4<f32>, 4>,");
  });
});

describe("a variable set from JS turns along a motion path and aims the camera (decision 105)", () => {
  const VARS = '@property --a { syntax: "<angle>"; inherits: false; initial-value: 30deg; } @property --n { syntax: "<number>"; inherits: false; initial-value: 1; }';
  it("turns an object on its path", () => {
    const shader = compileScene(`${VARS} @scene { cube } cube { offset-path: path("M0 0 L4 0"); offset-rotate: auto var(--a); }`).shader;
    expect(shader).toContain("q.xy *= rot(uProperties[0].x);");
  });
  it("moves the point the camera looks at", () => {
    const shader = compileScene(`${VARS} @scene { cube } scene { camera-target: 0 var(--n) 0; }`).shader;
    expect(shader).toContain("vec3 target = vec3(0.0, uProperties[1].x, 0.0);");
  });
});

describe("a variable set from JS in a frame of @keyframes (decision 105)", () => {
  it("is read by the frame, and the animation mixes it like any value", () => {
    const shader = compileScene(
      `${NUMBER} @scene { cube } cube { translate: 0 0 0; animation: up 2s alternate; } @keyframes up { to { translate: 0 var(--h) 0; } }`,
    ).shader;
    expect(shader).toContain("mix(vec3(0.0, 0.0, 0.0), vec3(0.0, uProperties[0].x, 0.0), ");
  });
});
