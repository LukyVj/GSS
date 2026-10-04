import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";
let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "gpu-test-page",
    configureServer(server) {
      server.middlewares.use("/__gpu", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end('<html><body style="margin:0"><script type="module">import { createViewAsync } from "/src/runtime/backend.ts"; import { mountAsync } from "/src/embed/runtime.ts"; import "/src/embed/element.ts"; window.__createViewAsync = createViewAsync; window.__mountAsync = mountAsync;</script></body></html>'); });
    },
  }] });
  await server.listen();
  // CanvasDrawElement: HTML-in-Canvas, for texture: element(#id) (decision 101)
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-blink-features=CanvasDrawElement"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  page.on("console", message => { if (message.type() === "error") console.error(message.text()); });
  await page.goto(`${server.resolvedUrls!.local[0]}__gpu`);
  await page.waitForFunction(() => (window as any).__createViewAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

async function render(source: string, hover = false, set?: [string, string], html = "") {
  return page.evaluate(async ({ compiled, hover, set, html }) => {
    const createViewAsync = (window as any).__createViewAsync;
    async function capture(backend: string) {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:96px;height:72px;display:block";
      canvas.innerHTML = html; // the HTML elements of element(#id)
      document.body.append(canvas);
      // A probe that measures: every frame is drawn, so the canvas can be read in the frame
      // that drew it (a resting scene draws nothing, decision 134, and its canvas reads empty)
      const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
      const view = await createViewAsync(canvas, { backend, profile: () => probe, profileWebGPU: () => probe });
      view.freeze(true);
      await view.show(compiled);
      if (set) view.setProperty(...set); // @property (decision 105)
      if (hover) {
        const box = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: box.left + 48, clientY: box.top + 36 }));
      }
      await new Promise<void>(resolve => {
        let left = hover ? 12 : 3;
        const tick = () => --left ? requestAnimationFrame(tick) : resolve();
        requestAnimationFrame(tick);
      });
      const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
      const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
      const pixels = [...ctx.getImageData(0, 0, copy.width, copy.height).data];
      view.destroy(); canvas.remove();
      return pixels;
    }
    return { gl: await capture("webgl"), gpu: await capture("webgpu") };
  }, { compiled: compileScene(source), hover, set, html });
}
const cases: [string, string, boolean?][] = [
  ["matte and camera", "@scene { sphere; } sphere { color: red; translate: 0 1 0; }"],
  ["rotations and smooth operations", "@scene { cube; sphere; } cube { rotate-y: 30deg; rotate-z: 20deg; translate: 0 1 0; } sphere { translate: 0.5 1 0; blend: 0.2; color: blue; }"],
  ["glass", "@scene { sphere; } sphere { translate: 0 1 0; material: glass(#badaff, 1.4, hammered 0.4); }"],
  ["gradient reflection", "@scene { sphere; } scene { background: repeating-linear-gradient(45deg, red 0%, blue 25%); } sphere { translate: 0 1 0; material: chrome; }"],
  ["scene blur and bloom", "@scene { sphere; } scene { filter: blur(1px) bloom(0.4, 2px); } sphere { translate: 0 1 0; color: red; }"],
  ["object blur", "@scene { sphere; cube; } sphere { translate: -0.4 1 0; filter: blur(2px); color: red; } cube { translate: 0.4 1 0; color: blue; }"],
  ["hover picking", "@scene { sphere; } scene { camera-angle: 0deg 0deg; camera-distance: 5; camera-target: 0 0 0; floor: none; } sphere { radius: 1; color: red; } sphere:hover { color: blue; }", true],
  ["animated transforms and negative delay", "@scene { cube; } cube { translate: 0 1 0; animation: turn 2s -0.7s ease-in-out alternate; } @keyframes turn { from { rotate-y: 0deg; scale: 0.5; } to { rotate-y: 120deg; scale: 1.2; } }"],
  ["texture orientation and pixelated faces", `@scene { cube; } cube { translate: 0 1 0; texture: url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><path fill="red" d="M0 0h8v4H0z"/><path fill="blue" d="M0 4h8v4H0z"/></svg>')}"); image-rendering: pixelated; rotate-y: 20deg; }`],
];
describe("WebGPU and WebGL2 render the same scenes", () => {
  for (const [name, source, hover] of cases) it(name, async () => {
    const { gl, gpu } = await render(source, hover);
    expect(gpu.length).toBe(gl.length);
    const differences = gl.map((v, i) => Math.abs(v - gpu[i]));
    const mean = differences.reduce((sum, n) => sum + n, 0) / differences.length;
    // Floating point roundoff can flip a few raymarch edge pixels. A vertical
    // inversion, missing effect or material differs over a substantial area.
    expect(mean).toBeLessThan(1.5);
    expect(gpu.some((v, i) => i % 4 !== 3 && v > 30)).toBe(true);
    if (hover) {
      const center = (36 * 96 + 48) * 4;
      expect(gpu[center + 2]).toBeGreaterThan(gpu[center]);
    }
  }, 60000);
});

// A variable set from JS reaches the uniform, after the hover slots, on both backends
it("setProperty() changes the scene without compiling again (decision 105)", async () => {
  const source = '@property --tint { syntax: "<color>"; inherits: false; initial-value: #ff0000; } @scene { sphere; } scene { camera-angle: 0deg 0deg; camera-distance: 5; camera-target: 0 0 0; floor: none; ambient: 1; } sphere { radius: 1; color: var(--tint); } sphere:hover { scale: 1.1; }';
  const center = (36 * 96 + 48) * 4;
  const before = await render(source);
  const after = await render(source, false, ["--tint", "rgb(0 0 255)"]);
  for (const pixels of [before.gl, before.gpu]) expect(pixels[center]).toBeGreaterThan(pixels[center + 2]);
  for (const pixels of [after.gl, after.gpu]) expect(pixels[center + 2]).toBeGreaterThan(pixels[center]);
}, 60000);

// A color computed on the GPU from a variable set from JS is the color the compiler
// computes from the same value (decision 105): same image, on both backends
describe("the color functions give the same color on the GPU as at compile time", () => {
  const VARS = '@property --h { syntax: "<number>"; inherits: false; initial-value: 40; } @property --p { syntax: "<percentage>"; inherits: false; initial-value: 30%; } @property --c { syntax: "<color>"; inherits: false; initial-value: #3a7bff; }';
  const front = "scene { floor: none; background: #000000; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 4; ambient: 1; } cube { size: 3; }";
  const colors: [string, string][] = [
    ["rgb(var(--h) 90 54)", "rgb(40 90 54)"],
    ["hsl(var(--h) 80% 60%)", "hsl(40 80% 60%)"],
    ["hwb(var(--h) 10% 20%)", "hwb(40 10% 20%)"],
    ["lab(60 var(--h) 30)", "lab(60 40 30)"],
    ["lch(60 50 var(--h))", "lch(60 50 40)"],
    ["oklab(0.7 0.1 calc(var(--h) / 400))", "oklab(0.7 0.1 0.1)"],
    ["oklch(70% 0.15 var(--h))", "oklch(70% 0.15 40)"],
    ["color(display-p3 1 var(--p) 0.2)", "color(display-p3 1 30% 0.2)"],
    ["color(xyz-d50 0.3 0.25 var(--p))", "color(xyz-d50 0.3 0.25 30%)"],
    ["contrast-color(var(--c))", "contrast-color(#3a7bff)"],
    ...["srgb", "srgb-linear", "oklab", "lab", "oklch", "lch", "hsl", "hwb"].map(
      (space): [string, string] => [`color-mix(in ${space}, var(--c), #ff5a36 var(--p))`, `color-mix(in ${space}, #3a7bff, #ff5a36 30%)`],
    ),
    ["color-mix(in oklch longer hue, var(--c), #ff5a36)", "color-mix(in oklch longer hue, #3a7bff, #ff5a36)"],
  ];
  for (const [live, still] of colors) it(still, async () => {
    const a = await render(`${VARS} @scene { cube; } ${front} cube { color: ${live}; }`);
    const b = await render(`@scene { cube; } ${front} cube { color: ${still}; }`);
    const center = (36 * 96 + 48) * 4;
    for (const [pixels, reference] of [[a.gl, b.gl], [a.gpu, b.gpu]])
      for (let c = 0; c < 3; c++) expect(Math.abs(pixels[center + c] - reference[center + c])).toBeLessThanOrEqual(2);
  }, 60000);
});

// A size set from JS draws the shape the compiler would draw with the same value
describe("the sizes set from JS draw the same shapes", () => {
  const VAR = '@property --s { syntax: "<number>"; inherits: false; initial-value: 0.8; }';
  const front = "scene { floor: none; background: #000000; camera-target: 0 0 0; camera-angle: 20deg 20deg; camera-distance: 5; }";
  const shapes: [string, string, string][] = [
    ["sphere", "sphere { radius: var(--s); color: red; }", "sphere { radius: 0.8; color: red; }"],
    ["cube", "cube { size: var(--s) 1 0.5; color: red; }", "cube { size: 0.8 1 0.5; color: red; }"],
    ["torus", "torus { radius: var(--s); thickness: calc(var(--s) / 4); color: red; }", "torus { radius: 0.8; thickness: 0.2; color: red; }"],
    ["capsule", "capsule { height: calc(var(--s) * 2); color: red; }", "capsule { height: 1.6; color: red; }"],
    ["cone", "cone { radius: var(--s) 0.2; color: red; }", "cone { radius: 0.8 0.2; color: red; }"],
    ["path", 'path { d: path("M-1 0 L1 0"); stroke-width: var(--s); color: red; }', 'path { d: path("M-1 0 L1 0"); stroke-width: 0.8; color: red; }'],
    ["prism", "prism { d: polygon(0 1, 1 -1, -1 -1); depth: var(--s); color: red; }", "prism { d: polygon(0 1, 1 -1, -1 -1); depth: 0.8; color: red; }"],
  ];
  for (const [shape, live, still] of shapes) it(shape, async () => {
    const a = await render(`${VAR} @scene { ${shape}; } ${front} ${live}`);
    const b = await render(`@scene { ${shape}; } ${front} ${still}`);
    for (const [pixels, reference] of [[a.gl, b.gl], [a.gpu, b.gpu]]) {
      const differences = pixels.map((v, i) => Math.abs(v - reference[i]));
      expect(differences.reduce((sum, n) => sum + n, 0) / differences.length).toBeLessThan(1);
      expect(pixels.some((v, i) => i % 4 === 0 && v > 60)).toBe(true);
    }
  }, 60000);
});

// Gradients, materials, the light, the floor and blends set from JS: the same image as
// the same values written as is
describe("gradients, materials and lights set from JS render like the same values written", () => {
  const VARS = '@property --a { syntax: "<angle>"; inherits: false; initial-value: 30deg; } @property --p { syntax: "<percentage>"; inherits: false; initial-value: 40%; } @property --n { syntax: "<number>"; inherits: false; initial-value: 0.3; } @property --c { syntax: "<color>"; inherits: false; initial-value: #ff5a36; }';
  const view = "camera-target: 0 0.5 0; camera-angle: 20deg 25deg; camera-distance: 5;";
  const cases: [string, string, string][] = [
    ["a linear gradient", "@scene { cube; } cube { translate: 0 0.5 0; color: linear-gradient(var(--a), var(--c), #3a7bff var(--p)); }", "@scene { cube; } cube { translate: 0 0.5 0; color: linear-gradient(30deg, #ff5a36, #3a7bff 40%); }"],
    ["a conic gradient", "@scene { cube; } cube { translate: 0 0.5 0; color: conic-gradient(from var(--a) at var(--p) 50%, red, blue); }", "@scene { cube; } cube { translate: 0 0.5 0; color: conic-gradient(from 30deg at 40% 50%, red, blue); }"],
    ["a background gradient", `@scene { sphere; } scene { floor: none; background: radial-gradient(circle at var(--p) 30%, var(--c), #000000); }`, `@scene { sphere; } scene { floor: none; background: radial-gradient(circle at 40% 30%, #ff5a36, #000000); }`],
    ["a metal", "@scene { sphere; } sphere { translate: 0 1 0; material: metal(var(--c), var(--n)); }", "@scene { sphere; } sphere { translate: 0 1 0; material: metal(#ff5a36, 0.3); }"],
    ["a glass", "@scene { sphere; } sphere { translate: 0 1 0; material: glass(#cfeaff, calc(1.2 + var(--n)), hammered var(--n)); }", "@scene { sphere; } sphere { translate: 0 1 0; material: glass(#cfeaff, 1.5, hammered 0.3); }"],
    ["the floor, the ambient light and the sun", `@scene { cube; } scene { floor: var(--c); ambient: var(--n); light: var(--a) 40deg; } cube { translate: 0 0.5 0; }`, `@scene { cube; } scene { floor: #ff5a36; ambient: 0.3; light: 30deg 40deg; } cube { translate: 0 0.5 0; }`],
    ["a blend", "@scene { cube; sphere; } cube { translate: 0 0.5 0; } sphere { translate: 0.6 1 0; blend: var(--n); }", "@scene { cube; sphere; } cube { translate: 0 0.5 0; } sphere { translate: 0.6 1 0; blend: 0.3; }"],
  ];
  for (const [name, live, still] of cases) it(name, async () => {
    const a = await render(`${VARS} ${live.replace("} ", `} scene { ${view} } `)}`);
    const b = await render(still.replace("} ", `} scene { ${view} } `));
    for (const [pixels, reference] of [[a.gl, b.gl], [a.gpu, b.gpu]]) {
      const differences = pixels.map((v, i) => Math.abs(v - reference[i]));
      expect(differences.reduce((sum, n) => sum + n, 0) / differences.length).toBeLessThan(1);
    }
  }, 60000);
});

// Filters set from JS, in the scene's shader and in the passes: the same image as the
// same values written as is, on both backends
describe("filters set from JS render like the same values written", () => {
  const VARS = '@property --n { syntax: "<number>"; inherits: false; initial-value: 1.4; } @property --p { syntax: "<percentage>"; inherits: false; initial-value: 60%; } @property --a { syntax: "<angle>"; inherits: false; initial-value: 120deg; } @property --r { syntax: "<length>"; inherits: false; initial-value: 2px; }';
  const scene = "@scene { sphere#a; cube#b; } sphere { translate: -0.6 1 0; color: #ff5a36; } cube { translate: 0.6 0.5 0; color: #3a7bff; }";
  const cases: [string, string, string][] = [
    ["pixel filters of the scene", "scene { filter: contrast(var(--n)) saturate(var(--p)) hue-rotate(var(--a)); }", "scene { filter: contrast(1.4) saturate(60%) hue-rotate(120deg); }"],
    ["pixel filters of an object", "#a { filter: grayscale(var(--p)) sepia(var(--p)) invert(var(--p)) brightness(var(--n)); }", "#a { filter: grayscale(60%) sepia(60%) invert(60%) brightness(1.4); }"],
    ["a blur and the filter after it", "scene { filter: blur(var(--r)) brightness(var(--n)); }", "scene { filter: blur(2px) brightness(1.4); }"],
    ["a bloom on an object", "#a { filter: bloom(var(--p), var(--r)); }", "#a { filter: bloom(60%, 2px); }"],
  ];
  for (const [name, live, still] of cases) it(name, async () => {
    const a = await render(`${VARS} ${scene} ${live}`);
    const b = await render(`${scene} ${still}`);
    for (const [pixels, reference] of [[a.gl, b.gl], [a.gpu, b.gpu]]) {
      const differences = pixels.map((v, i) => Math.abs(v - reference[i]));
      expect(differences.reduce((sum, n) => sum + n, 0) / differences.length).toBeLessThan(1);
    }
  }, 60000);
});

// The screen is seen like a CSS page: x to the right, y up, z toward the viewer
// transform-origin: an object turned and scaled around a point draws what a group moved
// to that point draws, the bounding spheres of the object and of the scene included
describe("transform-origin turns around its point, like a group moved there", () => {
  const front = "scene { floor: none; background: #000000; camera-target: 1.5 1 0; camera-angle: 10deg 15deg; camera-distance: 6; }";
  const cases: [string, string, string][] = [
    [
      "a cube around its left side",
      "@scene { cube; } cube { size: 1.6 0.4 0.4; translate: 0 1 0; transform-origin: left; rotate-z: 50deg; scale: 1.3; color: red; }",
      "@scene { group#g { cube; } } #g { translate: -0.8 1 0; rotate-z: 50deg; scale: 1.3; } cube { size: 1.6 0.4 0.4; translate: 0.8 0 0; color: red; }",
    ],
    [
      // A sphere just in front of the prism, and before it in map(): a bounding sphere
      // too small would let it hide the prism from the march
      "a prism around a far point, with its bounding sphere",
      "@scene { sphere; prism; } prism { d: polygon(0 1, 1 -1, -1 -1); depth: 0.4; translate: 0 1 0; transform-origin: 1.5 0 0; rotate-z: 180deg; color: red; } sphere { radius: 0.3; translate: 3.6 1 0.7; color: blue; }",
      "@scene { sphere; group#g { prism; } } #g { translate: 1.5 1 0; rotate-z: 180deg; } prism { d: polygon(0 1, 1 -1, -1 -1); depth: 0.4; translate: -1.5 0 0; color: red; } sphere { radius: 0.3; translate: 3.6 1 0.7; color: blue; }",
    ],
  ];
  cases.push([
    "an origin set from JS",
    '@property --o { syntax: "<number>"; inherits: false; initial-value: 1.5; } @scene { sphere; prism; } prism { d: polygon(0 1, 1 -1, -1 -1); depth: 0.4; translate: 0 1 0; transform-origin: var(--o) 0 0; rotate-z: 180deg; color: red; } sphere { radius: 0.3; translate: 3.6 1 0.7; color: blue; }',
    cases[1][2],
  ]);
  for (const [name, around, group] of cases) it(name, async () => {
    const a = await render(`${around} ${front}`);
    const b = await render(`${group} ${front}`);
    for (const [pixels, reference] of [[a.gl, b.gl], [a.gpu, b.gpu]]) {
      // Not a pixel apart: an object a little off would change a few hundred
      const apart = pixels.filter((v, i) => Math.abs(v - reference[i]) > 40).length;
      expect(apart / pixels.length).toBeLessThan(0.002);
      expect(pixels.some((v, i) => i % 4 === 0 && v > 60)).toBe(true);
    }
  }, 60000);
});

// The fog: at its end, only the fog is seen; without a color, only the background
describe("the fog covers the scene, on both backends", () => {
  const objects = "@scene { cube; sphere; } cube { translate: -0.6 0.5 0; color: red; } sphere { translate: 0.7 0.6 0.3; color: blue; material: chrome; }";
  const sky = "background: linear-gradient(#ffffff, #3a7bff);";
  const same = (pixels: number[], reference: number[]) =>
    pixels.filter((v, i) => Math.abs(v - reference[i]) > 40).length / pixels.length;

  it("with a color, a full fog leaves only its color, the background too", async () => {
    const { gl, gpu } = await render(`${objects} scene { ${sky} fog: #00ff00 0 0.001; }`);
    for (const pixels of [gl, gpu])
      for (let i = 0; i < pixels.length; i += 4) expect([pixels[i], pixels[i + 1], pixels[i + 2]]).toEqual([0, 255, 0]);
  }, 60000);

  it("without a color, a full fog leaves only the background", async () => {
    const a = await render(`${objects} scene { ${sky} fog: 0 0.001; }`);
    const b = await render(`@scene { } scene { ${sky} floor: none; }`);
    expect(same(a.gl, b.gl)).toBe(0);
    expect(same(a.gpu, b.gpu)).toBe(0);
  }, 60000);

  it("set from JS, like the same fog written", async () => {
    const vars = '@property --c { syntax: "<color>"; inherits: false; initial-value: #dfe7ef; } @property --far { syntax: "<number>"; inherits: false; initial-value: 6; }';
    const a = await render(`${vars} ${objects} scene { fog: var(--c) 3 var(--far); }`);
    const b = await render(`${objects} scene { fog: #dfe7ef 3 6; }`);
    expect(same(a.gl, b.gl)).toBeLessThan(0.002);
    expect(same(a.gpu, b.gpu)).toBeLessThan(0.002);
    // and the fog is there: the background takes its color
    expect(a.gl.slice(0, 3)).toEqual([223, 231, 239]);
  }, 60000);

  it("past the end of the scene, the background is the fog, even when the fog ends farther", async () => {
    const { gl, gpu } = await render(`${objects} scene { ${sky} floor: none; fog: #00ff00 25 30; }`);
    for (const pixels of [gl, gpu]) {
      expect(pixels.slice(0, 3)).toEqual([0, 255, 0]); // the background
      expect(pixels.some((v, i) => i % 4 === 0 && v > 150 && pixels[i + 1] < 60)).toBe(true); // the red cube, clear
    }
  }, 60000);
});

// Several lights: the white sun written in full gives the image of always, and a light of
// @scene lights from where its groups, its motion path and :hover put it
describe("the lights of the scene, on both backends", () => {
  const apart = (pixels: number[], reference: number[]) =>
    pixels.filter((v, i) => Math.abs(v - reference[i]) > 40).length / pixels.length;
  const same = (a: { gl: number[]; gpu: number[] }, b: { gl: number[]; gpu: number[] }) => {
    expect(apart(a.gl, b.gl)).toBeLessThan(0.002);
    expect(apart(a.gpu, b.gpu)).toBeLessThan(0.002);
  };
  const lit = (pixels: number[]) => expect(pixels.some((v, i) => i % 4 === 0 && v > 60)).toBe(true);
  const view = "scene { floor: #888888; background: #000000; camera-target: 0 0.6 0; camera-angle: 20deg 20deg; camera-distance: 5; }";
  const night = "scene { light: none; ambient: 0.02; }";

  it("a white sun written in full gives the image of always, with every material", async () => {
    const materials =
      "@scene { sphere#a; sphere#b; sphere#c; cube#d; } #a { translate: -1.2 0.5 0; radius: 0.45; material: chrome; } #b { translate: 0 0.5 0; radius: 0.45; material: jelly; color: #ff5a36; } #c { translate: 1.2 0.5 0; radius: 0.45; material: glass(#ffffff, 1.5, blurred 0.4); } #d { translate: 0 0.3 -1.2; size: 0.6; color: #3a7bff; }";
    // ambient 0.5: the sun gives the other half, so a sun that forgot it would show
    const always = await render(`${materials} ${view} scene { ambient: 0.5; }`);
    const full = await render(`${materials} ${view} scene { light: -45deg 54.7deg #ffffff 1; ambient: 0.5 #ffffff; }`);
    same(full, always);
    lit(always.gl);
  }, 60000);

  it("a light in a turned and scaled group is where the group puts it", async () => {
    const lamp = "intensity: 3; color: #ffd27a;";
    const grouped = await render(
      `@scene { group#arm { light#tip; } sphere; } sphere { translate: 0 0.6 0; } #arm { translate: 1 0 0; rotate-y: 90deg; scale: 2; } #tip { translate: 0 0.8 0.5; ${lamp} } ${view} ${night}`,
    );
    const placed = await render(`@scene { light#tip; sphere; } sphere { translate: 0 0.6 0; } #tip { translate: 2 1.6 0; ${lamp} } ${view} ${night}`);
    same(grouped, placed);
    lit(placed.gl);
  }, 60000);

  it("a light on a motion path is at its point", async () => {
    const lamp = "intensity: 2.5; color: #b6ff6b;";
    const along = await render(
      `@scene { light#l; sphere; } sphere { translate: 0 0.6 0; } #l { translate: 0 1.2 1; offset-path: path("M0 0 L2 0"); offset-distance: 1.5; ${lamp} } ${view} ${night}`,
    );
    const placed = await render(`@scene { light#l; sphere; } sphere { translate: 0 0.6 0; } #l { translate: 0.5 1.2 1; ${lamp} } ${view} ${night}`);
    same(along, placed);
    lit(placed.gl);
  }, 60000);

  it("a light changes on :hover through its group", async () => {
    const pick = "scene { camera-angle: 0deg 0deg; camera-distance: 5; camera-target: 0 0 0; floor: none; light: none; ambient: 0.02; }";
    const hovered = await render(
      `@scene { group#g { sphere; } light#l; } sphere { radius: 1; } #l { translate: 1 1.5 1.5; intensity: 0.1; } #g:hover ~ #l { intensity: 3; } ${pick}`,
      true,
    );
    const bright = await render(`@scene { group#g { sphere; } light#l; } sphere { radius: 1; } #l { translate: 1 1.5 1.5; intensity: 3; } ${pick}`);
    same(hovered, bright);
    lit(bright.gl);
  }, 60000);
});

// noise(): a gradient whose position comes from a 3D noise, cut in the object's own space
describe("noise() paints the scene, on both backends", () => {
  const apart = (pixels: number[], reference: number[]) =>
    pixels.filter((v, i) => Math.abs(v - reference[i]) > 40).length / pixels.length;
  const view = (target: string) =>
    `scene { floor: none; background: #000000; camera-target: ${target}; camera-angle: 20deg 15deg; camera-distance: 4; }`;

  it("with one color twice, is that color", async () => {
    const a = await render(`@scene { sphere; } sphere { translate: 0 1 0; color: noise(4 3, #ff5a36, #ff5a36); } scene { background: noise(2, #3a7bff, #3a7bff); }`);
    const b = await render(`@scene { sphere; } sphere { translate: 0 1 0; color: #ff5a36; } scene { background: #3a7bff; }`);
    expect(apart(a.gl, b.gl)).toBe(0);
    expect(apart(a.gpu, b.gpu)).toBe(0);
  }, 60000);

  it("varies from one color to the other, the same on WebGL2 and WebGPU", async () => {
    const { gl, gpu } = await render(`@scene { sphere; } sphere { translate: 0 1 0; radius: 1; color: noise(3 4, #000000, #ffffff); } ${view("0 1 0")}`);
    const reds = gl.filter((_, i) => i % 4 === 0);
    expect(Math.min(...reds)).toBeLessThan(40);
    expect(Math.max(...reds)).toBeGreaterThan(150);
    expect(apart(gl, gpu)).toBeLessThan(0.01);
  }, 60000);

  it("is cut in the object's own space: moved with the camera, the object keeps its pattern", async () => {
    const paint = "color: noise(3 4, #000000, #ffffff); radius: 1;";
    const here = await render(`@scene { sphere; } sphere { translate: 0 1 0; ${paint} } ${view("0 1 0")}`);
    const there = await render(`@scene { sphere; } sphere { translate: 2.3 1.7 -1.1; ${paint} } ${view("2.3 1.7 -1.1")}`);
    expect(apart(here.gl, there.gl)).toBeLessThan(0.002);
    expect(apart(here.gpu, there.gpu)).toBeLessThan(0.002);
  }, 60000);
});

// The floor painted with an image (decision 122): a noise() read at its point, a gradient
// spread over a square of 40 under the scene
describe("noise() and the gradients paint the floor, on both backends", () => {
  const apart = (pixels: number[], reference: number[]) =>
    pixels.filter((v, i) => Math.abs(v - reference[i]) > 40).length / pixels.length;
  // Seen from above, the floor fills the view; ambient: 1 gives each pixel its own color
  const floor = (value: string) =>
    `@scene { } scene { floor: ${value}; ambient: 1; background: #000000; camera-target: 0 0 0; camera-angle: 0deg 60deg; camera-distance: 4; }`;
  const red = (pixels: number[], x: number, y = 36) => pixels[(y * 96 + x) * 4];

  it("with one color twice, is that color", async () => {
    const a = await render(floor("noise(3 4, #ff5a36, #ff5a36)"));
    const b = await render(floor("#ff5a36"));
    expect(apart(a.gl, b.gl)).toBe(0);
    expect(apart(a.gpu, b.gpu)).toBe(0);
  }, 60000);

  it("varies from one color to the other, the same on WebGL2 and WebGPU", async () => {
    const { gl, gpu } = await render(floor("noise(3 4, #000000, #ffffff)"));
    const reds = gl.filter((_, i) => i % 4 === 0);
    expect(Math.min(...reds)).toBeLessThan(40);
    expect(Math.max(...reds)).toBeGreaterThan(150);
    expect(apart(gl, gpu)).toBeLessThan(0.01);
  }, 60000);

  it("spreads a gradient over a square of 40 under the scene", async () => {
    // The view is 3.5 units wide at the target: 9 % of the square, from about 116 to 139
    const { gl, gpu } = await render(floor("linear-gradient(to right, #000000, #ffffff)"));
    for (const pixels of [gl, gpu]) {
      expect(Math.abs(red(pixels, 48) - 128)).toBeLessThan(5);
      expect(red(pixels, 95) - red(pixels, 0)).toBeGreaterThan(15);
      expect(red(pixels, 95) - red(pixels, 0)).toBeLessThan(30);
    }
  }, 60000);
});

// texture: element(#id): the browser draws the element (HTML-in-Canvas, behind a flag here),
// and the scene shows it on the object; WebGPU cannot copy an element yet
describe("element() shows an HTML element on an object", () => {
  const card = '<div id="card" style="width:96px;height:96px;background:#ff0000"></div>';
  const scene =
    "@scene { cube; } cube { size: 1.6 1.6 0.2; texture: element(#card); } scene { floor: none; background: #000000; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 3; }";
  const center = (pixels: number[]) => {
    const i = (36 * 96 + 48) * 4;
    return pixels.slice(i, i + 3);
  };

  it("with WebGL2, from the element inside the canvas", async () => {
    const { gl } = await render(scene, false, undefined, card);
    const [r, g, b] = center(gl);
    expect(r).toBeGreaterThan(90); // a red face, lit at 47% by the default sun
    expect(r).toBeGreaterThan(g * 2 + 20);
    expect(r).toBeGreaterThan(b * 2 + 20);
  }, 60000);

  it("keeps the object's color without the element, and on WebGPU", async () => {
    const without = await render(scene);
    const { gpu } = await render(scene, false, undefined, card);
    for (const [r, g] of [center(without.gl), center(gpu)]) expect(Math.abs(r - g)).toBeLessThan(30);
  }, 60000);

  it("draws a scene with an element with WebGL2 when the backend is auto", async () => {
    const backend = await page.evaluate(async ({ compiled, card }) => {
      const canvas = document.createElement("canvas");
      canvas.innerHTML = card;
      document.body.append(canvas);
      const scene = await (window as any).__mountAsync(canvas, compiled);
      const which = scene.backend;
      scene.destroy();
      canvas.remove();
      return which;
    }, { compiled: compileScene(scene), card });
    expect(backend).toBe("webgl");
  }, 60000);

  it("in <gss-scene>, from its HTML children", async () => {
    const [r, g] = await page.evaluate(async ({ card, scene }) => {
      const element = document.createElement("gss-scene");
      element.style.cssText = "width:96px;height:72px;display:block";
      element.innerHTML = `${card}<script type="text/gss">${scene}</script>`;
      // A resting scene draws nothing (decision 134) and its canvas then reads empty: the
      // center is read right after each frame the scene draws
      let pixel: number[] = [];
      const proto = WebGL2RenderingContext.prototype;
      const drawArrays = proto.drawArrays;
      proto.drawArrays = function (...args: Parameters<typeof drawArrays>) {
        drawArrays.apply(this, args);
        if (this.getParameter(this.FRAMEBUFFER_BINDING) !== null || (this.canvas as HTMLCanvasElement).getRootNode() !== element.shadowRoot) return;
        const data = new Uint8Array(4);
        this.readPixels(Math.floor(this.drawingBufferWidth / 2), Math.floor(this.drawingBufferHeight / 2), 1, 1, this.RGBA, this.UNSIGNED_BYTE, data);
        pixel = [...data];
      };
      try {
        document.body.append(element);
        await new Promise((resolve) => element.addEventListener("load", resolve, { once: true }));
        await new Promise<void>((resolve) => { let left = 6; const tick = () => (--left ? requestAnimationFrame(tick) : resolve()); requestAnimationFrame(tick); });
      } finally {
        proto.drawArrays = drawArrays;
      }
      element.remove();
      return pixel;
    }, { card, scene });
    expect(r).toBeGreaterThan(g * 2 + 20);
  }, 60000);
});

// The layers of background: composited like CSS, premultiplied, with the blend modes of CSS
describe("background layers composite like CSS, on both backends", () => {
  const flat = (background: string, more = "") => `@scene { } scene { floor: none; background: ${background}; ${more} }`;
  const center = (pixels: number[]) => {
    const i = (36 * 96 + 48) * 4;
    return pixels.slice(i, i + 3);
  };
  const cases: [string, string, string, number[]][] = [
    ["half a red over blue", "linear-gradient(rgb(255 0 0 / 50%), rgb(255 0 0 / 50%)), #0000ff", "", [128, 0, 128]],
    ["multiply", "linear-gradient(#808080, #808080), #ff0000", "background-blend-mode: multiply;", [128, 0, 0]],
    ["screen", "linear-gradient(#808080, #808080), #ff0000", "background-blend-mode: screen;", [255, 128, 128]],
    ["difference", "linear-gradient(#ff0000, #ff0000), #ff0000", "background-blend-mode: difference;", [0, 0, 0]],
    ["color", "linear-gradient(#ff0000, #ff0000), #808080", "background-blend-mode: color;", [255, 73, 73]],
    ["luminosity", "linear-gradient(#ffffff, #ffffff), #ff0000", "background-blend-mode: luminosity;", [255, 255, 255]],
  ];
  for (const [name, background, more, expected] of cases)
    it(name, async () => {
      const { gl, gpu } = await render(flat(background, more));
      for (const pixels of [gl, gpu])
        center(pixels).forEach((c, k) => expect(Math.abs(c - expected[k]), `${name} channel ${k}: ${c}`).toBeLessThanOrEqual(3));
    }, 60000);

  it("a transparent layer leaves the image of what is below", async () => {
    const a = await render(flat("linear-gradient(transparent, transparent), noise(3 2, #000000, #3a7bff)"));
    const b = await render(flat("noise(3 2, #000000, #3a7bff)"));
    const apart = (p: number[], q: number[]) => p.filter((v, i) => Math.abs(v - q[i]) > 6).length / p.length;
    expect(apart(a.gl, b.gl)).toBe(0);
    expect(apart(a.gpu, b.gpu)).toBe(0);
  }, 60000);
});

// mask-image (decision 113): the ray goes through the holes, and so does the mouse
describe("mask-image cuts holes, on both backends", () => {
  const front = (ambient: number) =>
    `scene { floor: none; background: #0000ff; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 5; light: 0deg 0deg; ambient: ${ambient}; }`;
  // The pixel x to the right of the center and y below it
  const at = (pixels: number[], x = 0, y = 0) => {
    const i = ((36 + y) * 96 + 48 + x) * 4;
    return pixels.slice(i, i + 3);
  };
  const is = (pixel: number[], channel: number) => pixel[channel] > 200 && pixel.every((c, k) => k === channel || c < 60);
  const hole = "mask-image: radial-gradient(circle, transparent 30%, black 31%);";

  it("shows what is behind the object through a hole", async () => {
    const { gl, gpu } = await render(`@scene { cube; } ${front(1)} cube { size: 2; color: #ff0000; ${hole} }`);
    for (const pixels of [gl, gpu]) {
      expect(is(at(pixels), 2), `center ${at(pixels)}`).toBe(true); // through the front face and the back one
      expect(is(at(pixels, 20), 0), `face ${at(pixels, 20)}`).toBe(true);
    }
  }, 60000);

  it("lights the inside of the object, seen through the hole, from inside", async () => {
    // No ambient light: only the light from the camera, which the inside of the back face turns to
    const { gl, gpu } = await render(`@scene { cube; } ${front(0)} cube { size: 2; color: #ff0000; ${hole} }`);
    for (const pixels of [gl, gpu]) expect(is(at(pixels, 10), 0), `inside ${at(pixels, 10)}`).toBe(true);
  }, 60000);

  it("shows an object inside the one with holes, lit as if it were alone", async () => {
    // No ambient light: the sphere looks the same only with its own normals, not the cube's
    const sphere = "sphere { radius: 0.3; color: #00ff00; }";
    const inside = await render(`@scene { cube; sphere; } ${front(0)} cube { size: 2; color: #ff0000; ${hole} } ${sphere}`);
    const alone = await render(`@scene { sphere; } ${front(0)} ${sphere}`);
    for (const [a, b] of [[inside.gl, alone.gl], [inside.gpu, alone.gpu]])
      for (let y = -5; y <= 5; y++)
        for (let x = -5; x <= 5; x++)
          if (x * x + y * y <= 25)
            at(a, x, y).forEach((c, k) => expect(Math.abs(c - at(b, x, y)[k]), `${x} ${y}: ${at(a, x, y)} / ${at(b, x, y)}`).toBeLessThanOrEqual(8));
  }, 60000);

  it("reads the brightness of the mask with mask-mode: luminance", async () => {
    const mask = "mask-image: linear-gradient(white, black);";
    const luminance = await render(`@scene { cube; } ${front(1)} cube { size: 2; color: #ff0000; ${mask} mask-mode: luminance; }`);
    const alpha = await render(`@scene { cube; } ${front(1)} cube { size: 2; color: #ff0000; ${mask} }`);
    for (const pixels of [luminance.gl, luminance.gpu]) {
      expect(is(at(pixels, 0, -15), 0), `white ${at(pixels, 0, -15)}`).toBe(true); // white: there
      expect(is(at(pixels, 0, 15), 2), `black ${at(pixels, 0, 15)}`).toBe(true); // black: a hole
    }
    // By their alpha, black and white are both there
    for (const pixels of [alpha.gl, alpha.gpu]) expect(is(at(pixels, 0, 15), 0), `alpha ${at(pixels, 0, 15)}`).toBe(true);
  }, 60000);

  it("lets the mouse through a hole, to the object behind it", async () => {
    const { gl, gpu } = await render(
      `@scene { cube; sphere; } ${front(1)} cube { size: 2; translate: 0 0 1; color: #ff0000; ${hole} } cube:hover { color: #ffff00; } sphere { translate: 0 0 -1; radius: 0.5; color: #000000; } sphere:hover { color: #00ff00; }`,
      true,
    );
    for (const pixels of [gl, gpu]) {
      expect(is(at(pixels), 1), `sphere ${at(pixels)}`).toBe(true); // hovered, through the hole
      expect(is(at(pixels, 20), 0), `cube ${at(pixels, 20)}`).toBe(true); // not hovered
    }
  }, 60000);
});

// displace(): the colors of the map move the point where the image is read, like feDisplacementMap
describe("displace() moves an image by a map, on both backends", () => {
  const flat = (background: string) => `@scene { } scene { floor: none; background: ${background}; }`;
  const center = (pixels: number[]) => pixels.slice((36 * 96 + 48) * 4, (36 * 96 + 48) * 4 + 3);
  const near = (pixel: number[], value: number) => pixel.every((c) => Math.abs(c - value) <= 4);

  it("moves it to the right by red and down by green, like SVG", async () => {
    // Red at 100%: read 20% of the width further right, on a gradient from black to white
    const right = await render(flat("displace(linear-gradient(to right, #000000, #ffffff), linear-gradient(#ff8080, #ff8080), 0.4)"));
    // Green at 100%: read 20% of the height lower, on a gradient from black at the top to white
    const down = await render(flat("displace(linear-gradient(#000000, #ffffff), linear-gradient(#80ff80, #80ff80), 0.4)"));
    for (const pixels of [right.gl, right.gpu, down.gl, down.gpu]) expect(near(center(pixels), 179), `${center(pixels)}`).toBe(true);
  }, 60000);

  it("moves stripes in every direction with a gray noise, each channel being a noise of its own", async () => {
    // A gray map read once would move along a diagonal only, along these stripes: nothing would change
    const stripes = "repeating-linear-gradient(45deg, #000000 0% 5%, #ffffff 5% 10%)";
    const moved = await render(flat(`displace(${stripes}, noise(3 3, black, white), 0.3)`));
    const still = await render(flat(stripes));
    const apart = (p: number[], q: number[]) => p.filter((v, i) => Math.abs(v - q[i]) > 60).length / p.length;
    expect(apart(moved.gl, still.gl)).toBeGreaterThan(0.2);
    expect(apart(moved.gpu, still.gpu)).toBeGreaterThan(0.2);
    expect(apart(moved.gl, moved.gpu)).toBeLessThan(0.01);
  }, 60000);
});

// shadows: each point looks toward each light, and an object on the way keeps it from it
describe("shadows, on both backends", () => {
  const view = (shadows: string, light = "light: 90deg 45deg;") =>
    `scene { shadows: ${shadows}; ${light} background: #000000; camera-target: 0 0 0; camera-angle: 0deg 50deg; camera-distance: 5; }`;
  const sphere = "sphere { translate: 0 0.8 0; radius: 0.5; }";
  const red = (pixels: number[]) => pixels.filter((_, i) => i % 4 === 0);
  // The pixels the shadows darken by more than 30, and those they light up by more than 6
  const darker = (shaded: number[], plain: number[]) => {
    const [a, b] = [red(shaded), red(plain)];
    return a.map((v, i) => b[i] - v > 30);
  };
  const brighter = (shaded: number[], plain: number[]) => red(shaded).filter((v, i) => v - red(plain)[i] > 6).length;
  const share = (flags: boolean[]) => flags.filter(Boolean).length / flags.length;

  it("darkens the floor where an object keeps the sun from it, and nothing else", async () => {
    const shaded = await render(`@scene { sphere; } ${view("soft")} ${sphere}`);
    const plain = await render(`@scene { sphere; } ${view("none")} ${sphere}`);
    for (const [s, p] of [[shaded.gl, plain.gl], [shaded.gpu, plain.gpu]]) {
      expect(share(darker(s, p))).toBeGreaterThan(0.02);
      expect(brighter(s, p)).toBe(0);
    }
    expect(red(shaded.gl).filter((v, i) => Math.abs(v - red(shaded.gpu)[i]) > 8).length / red(shaded.gl).length).toBeLessThan(0.01);
  }, 60000);

  it("draws a penumbra with soft, not with hard", async () => {
    const plain = await render(`@scene { sphere; } ${view("none")} ${sphere}`);
    const soft = await render(`@scene { sphere; } ${view("soft")} ${sphere}`);
    const hard = await render(`@scene { sphere; } ${view("hard")} ${sphere}`);
    // The half-dark pixels of the edge of the shadow
    const half = (shaded: number[], unshaded: number[]) =>
      red(shaded).filter((v, i) => red(unshaded)[i] - v > 12 && red(unshaded)[i] - v < 60).length;
    for (const [s, h, p] of [[soft.gl, hard.gl, plain.gl], [soft.gpu, hard.gpu, plain.gpu]]) {
      expect(half(s, p)).toBeGreaterThan(20);
      expect(half(h, p)).toBeLessThan(5);
    }
  }, 60000);

  it("lets a light of @scene cast a shadow too", async () => {
    const lamp = "light: none; ambient: 0.2;";
    const scene = (shadows: string) => `@scene { light; sphere; } ${view(shadows, lamp)} light { translate: 1.6 2.2 0; intensity: 5; } ${sphere}`;
    const shaded = await render(scene("hard"));
    const plain = await render(scene("none"));
    expect(share(darker(shaded.gl, plain.gl))).toBeGreaterThan(0.02);
    expect(share(darker(shaded.gpu, plain.gpu))).toBeGreaterThan(0.02);
  }, 60000);

  it("lets the light through the holes of mask-image", async () => {
    const holes = "sphere { translate: 0 0.8 0; radius: 0.5; mask-image: noise(5 2, black 48%, transparent 52%); }";
    const solidShaded = await render(`@scene { sphere; } ${view("hard")} ${sphere}`);
    const solidPlain = await render(`@scene { sphere; } ${view("none")} ${sphere}`);
    const holed = await render(`@scene { sphere; } ${view("hard")} ${holes}`);
    for (const [s, p, h] of [[solidShaded.gl, solidPlain.gl, holed.gl], [solidShaded.gpu, solidPlain.gpu, holed.gpu]]) {
      // Where the solid sphere casts its shadow, light comes through the holes
      const shadow = darker(s, p);
      const lit = red(h).filter((v, i) => shadow[i] && Math.abs(v - red(p)[i]) < 20).length;
      expect(lit / shadow.filter(Boolean).length).toBeGreaterThan(0.15);
    }
  }, 60000);
});

// opacity: the surfaces along the ray, each over what is behind it, from the front
describe("opacity, on both backends", () => {
  const front = (more = "") =>
    `scene { floor: none; background: #000000; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 5; light: 0deg 0deg; ambient: 1; ${more} }`;
  const center = (pixels: number[]) => pixels.slice((36 * 96 + 48) * 4, (36 * 96 + 48) * 4 + 3);
  const near = (pixel: number[], expected: number[]) => pixel.every((c, k) => Math.abs(c - expected[k]) <= 4);

  it("puts a transparent object over what is behind it, its back face included", async () => {
    // Front face, back face, then blue: 0.5 red + 0.5 × (0.5 red + 0.5 blue)
    const { gl, gpu } = await render(`@scene { cube; } ${front("background: #0000ff;")} cube { size: 2; color: #ff0000; opacity: 0.5; }`);
    for (const pixels of [gl, gpu]) expect(near(center(pixels), [191, 0, 64]), `${center(pixels)}`).toBe(true);
  }, 60000);

  it("shows what is inside a transparent object", async () => {
    // The front face over the red sphere inside: 0.5 white + 0.5 red
    const { gl, gpu } = await render(`@scene { cube; sphere; } ${front()} cube { size: 2; color: #ffffff; opacity: 0.5; } sphere { radius: 0.4; color: #ff0000; }`);
    for (const pixels of [gl, gpu]) expect(near(center(pixels), [255, 128, 128]), `${center(pixels)}`).toBe(true);
  }, 60000);

  it("hides an object of opacity 0", async () => {
    const { gl, gpu } = await render(`@scene { cube; } ${front("background: #0000ff;")} cube { size: 2; color: #ff0000; opacity: 0; }`);
    for (const pixels of [gl, gpu]) expect(near(center(pixels), [0, 0, 255]), `${center(pixels)}`).toBe(true);
  }, 60000);

  it("lets the light through, tinted by the color of the object, in its shadow", async () => {
    const view = (shadows: string) =>
      `scene { shadows: ${shadows}; light: 90deg 45deg; ambient: 0.3; background: #000000; camera-target: -0.8 0 0; camera-angle: 0deg 80deg; camera-distance: 4; }`;
    const plate = (color: string) => `cube { translate: 0 1 0; size: 1.2 0.05 1.2; color: ${color}; opacity: 0.5; }`;
    const red = await render(`@scene { cube; } ${view("hard")} ${plate("#ff0000")}`);
    const plain = await render(`@scene { cube; } ${view("none")} ${plate("#ff0000")}`);
    for (const [s, p] of [[red.gl, plain.gl], [red.gpu, plain.gpu]]) {
      // The pixels of the floor in the shadow: green and blue go down, red much less
      const shade = (k: number) => s.map((v, i) => (i % 4 === k ? p[i] - v : 0)).filter((_, i) => i % 4 === k);
      const [dr, dg] = [shade(0), shade(1)];
      const shadowed = dg.map((d) => d > 25);
      const mean = (ds: number[]) => ds.filter((_, i) => shadowed[i]).reduce((a, b) => a + b, 0) / shadowed.filter(Boolean).length;
      expect(shadowed.filter(Boolean).length).toBeGreaterThan(100);
      expect(mean(dr)).toBeLessThan(0.6 * mean(dg));
    }
  }, 60000);
});

// transparent colors and opacity() on objects
describe("transparent colors and opacity() on objects, on both backends", () => {
  const front = "scene { floor: none; background: #0000ff; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 5; light: 0deg 0deg; ambient: 1; }";
  const at = (pixels: number[], x = 0) => pixels.slice((36 * 96 + 48 + x) * 4, (36 * 96 + 48 + x) * 4 + 3);
  const near = (pixel: number[], expected: number[]) => pixel.every((c, k) => Math.abs(c - expected[k]) <= 4);

  it("covers what is behind an object as much as the alpha of its color", async () => {
    // 128 / 255 of red, front and back, over blue
    const { gl, gpu } = await render(`@scene { cube; } ${front} cube { size: 2; color: rgb(255 0 0 / 50%); }`);
    for (const pixels of [gl, gpu]) expect(near(at(pixels), [192, 0, 63]), `${at(pixels)}`).toBe(true);
  }, 60000);

  it("is as transparent as its gradient at each point", async () => {
    const { gl, gpu } = await render(`@scene { cube; } ${front} cube { size: 2; color: linear-gradient(to right, transparent, #ff0000); }`);
    for (const pixels of [gl, gpu]) {
      const [left, right] = [at(pixels, -20), at(pixels, 20)];
      expect(left[2] > 180 && left[0] < 80, `left ${left}`).toBe(true);
      expect(right[0] > 200 && right[2] < 60, `right ${right}`).toBe(true);
    }
  }, 60000);

  it("takes opacity() in filter like opacity", async () => {
    const { gl, gpu } = await render(`@scene { cube; } ${front} cube { size: 2; color: #ff0000; filter: opacity(0.5); }`);
    for (const pixels of [gl, gpu]) expect(near(at(pixels), [191, 0, 64]), `${at(pixels)}`).toBe(true);
  }, 60000);
});

describe("the default camera does not mirror the scene", () => {
  const front = "scene { floor: none; background: #000000; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 5; light: 0deg 0deg; ambient: 1; }";
  // The mean column and row of the pixels where `channel` wins, per backend
  const where = (pixels: number[], channel: 0 | 2) => {
    let x = 0, y = 0, n = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + channel] > 80 && pixels[i + channel] > 2 * pixels[i + 2 - channel]) {
        x += (i / 4) % 96; y += Math.floor(i / 4 / 96); n++;
      }
    }
    return { x: x / n, y: y / n, n };
  };

  it("puts +x on the right", async () => {
    const { gl, gpu } = await render(`@scene { cube; } ${front} cube { translate: 1 0 0; size: 0.6; color: #ff0000; }`);
    for (const pixels of [gl, gpu]) expect(where(pixels, 0).x).toBeGreaterThan(55);
  }, 60000);

  it("paints linear-gradient(to right) from left to right", async () => {
    const { gl, gpu } = await render(`@scene { cube; } ${front} cube { size: 2 1 0.1; color: linear-gradient(to right, #ff0000, #0000ff); }`);
    for (const pixels of [gl, gpu]) expect(where(pixels, 0).x).toBeLessThan(where(pixels, 2).x);
  }, 60000);

  it("turns rotate-z clockwise, like CSS rotate", async () => {
    const { gl, gpu } = await render(`@scene { group#arm { cube#bar; cube#tip; } } ${front} cube { color: #0000ff; } #arm { rotate-z: 30deg; } #bar { size: 2 0.15 0.1; } #tip { size: 0.3; translate: 0.9 0 0.1; color: #ff0000; }`);
    // the red end of the bar: on the right, and down
    for (const pixels of [gl, gpu]) {
      const tip = where(pixels, 0);
      expect(tip.n).toBeGreaterThan(0);
      expect(tip.x).toBeGreaterThan(48);
      expect(tip.y).toBeGreaterThan(36);
    }
  }, 60000);
});

it("invalid updates preserve the displayed scene; resizing and destruction remain usable", async () => {
  const result = await page.evaluate(async compiled => {
    const canvas = document.createElement("canvas"); canvas.style.cssText = "width:96px;height:72px"; document.body.append(canvas);
    // A probe that measures: every frame is drawn and can be read (decision 134)
    const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
    const view = await (window as any).__createViewAsync(canvas, { backend: "webgpu", profileWebGPU: () => probe });
    view.freeze(true); await view.show(compiled);
    const capture = () => new Promise<number[]>(resolve => requestAnimationFrame(() => {
      const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
      const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0); resolve([...ctx.getImageData(0, 0, copy.width, copy.height).data]);
    }));
    const before = await capture(); let error = "";
    try { await view.show({ ...compiled, wgsl: "invalid wgsl" }); } catch (caught) { error = String(caught); }
    const after = await capture();
    canvas.style.width = "120px"; await capture();
    const width = canvas.width;
    view.pause(); view.play(); view.destroy(); view.destroy(); canvas.remove();
    return { before, after, error, width };
  }, compileScene("@scene { sphere; } sphere { translate: 0 1 0; color: red; }"));
  expect(result.error).toContain("WGSL"); expect(result.before).toEqual(result.after); expect(result.width).toBe(120);
});

it("auto falls back before acquiring a canvas context; forced WebGPU fails", async () => {
  const result = await page.evaluate(async compiled => {
    const createViewAsync = (window as any).__createViewAsync;
    const original = Object.getOwnPropertyDescriptor(navigator, "gpu");
    Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined });
    try {
      const canvas = document.createElement("canvas"); document.body.append(canvas);
      const view = await createViewAsync(canvas); await view.show(compiled);
      const backend = view.backend; view.destroy(); canvas.remove();
      let failure = "";
      try { await createViewAsync(document.createElement("canvas"), { backend: "webgpu" }); }
      catch (error) { failure = String(error); }
      return { backend, failure };
    } finally {
      if (original) Object.defineProperty(navigator, "gpu", original); else delete (navigator as any).gpu;
    }
  }, compileScene("@scene { sphere; }"));
  expect(result.backend).toBe("webgl"); expect(result.failure).toContain("WebGPU is not available");
});

it("public asynchronous mounting and custom elements select either backend", async () => {
  const result = await page.evaluate(async compiled => {
    const canvas = document.createElement("canvas"); canvas.style.cssText = "width:96px;height:72px"; document.body.append(canvas);
    const scene = await (window as any).__mountAsync(canvas, compiled, { backend: "webgpu" });
    await scene.update(compiled); const mounted = scene.backend; scene.pause(); scene.play(); scene.destroy(); canvas.remove();
    const element = document.createElement("gss-scene"); element.style.cssText = "width:96px;height:72px";
    element.setAttribute("backend", "webgpu"); element.innerHTML = '<script type="text/gss">@scene { sphere; }</script>';
    const loaded = () => new Promise<void>((resolve, reject) => {
      element.addEventListener("load", () => resolve(), { once: true });
      element.addEventListener("error", (e: any) => reject(new Error(e.detail)), { once: true });
    });
    let pending = loaded(); document.body.append(element); await pending;
    const first = (element as any).scene.backend;
    pending = loaded(); element.setAttribute("backend", "webgl"); await pending;
    const second = (element as any).scene.backend; element.remove();
    return { mounted, first, second };
  }, compileScene("@scene { sphere; }"));
  expect(result).toEqual({ mounted: "webgpu", first: "webgpu", second: "webgl" });
}, 60000);

it("the playground renders with WebGPU and displays WGSL", async () => {
  await page.setViewportSize({ width: 1040, height: 700 });
  await page.goto(`${server.resolvedUrls!.local[0]}playground.html?backend=webgpu`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#stats")?.textContent?.includes("ok"));
  expect(await page.locator("#stats").innerText()).toContain("wgsl");
  await page.locator(".perf-toggle").click();
  await page.waitForFunction(() => {
    const panel = document.querySelector(".perf-panel");
    const rows = panel?.querySelectorAll("dd");
    return rows?.length === 6 && rows[0].textContent !== "—" && rows[3].textContent?.includes("ms") && rows[2].textContent !== "waiting…";
  });
  expect(await page.locator(".perf-panel h2").textContent()).toContain("WebGPU");
  expect(await page.locator(".perf-panel").innerText()).toContain("p95");
  const timestamps = await page.evaluate(async () => (await navigator.gpu.requestAdapter())?.features.has("timestamp-query"));
  if (timestamps) expect(await page.locator(".perf-panel dd").nth(2).innerText()).toContain("ms");
  await page.locator('[data-tab="wgsl"]').click();
  expect(await page.locator('[data-tab="wgsl"]').getAttribute("aria-selected")).toBe("true");
  expect(await page.locator('[data-tab="gss"]').getAttribute("aria-selected")).toBe("false");
  // CodeMirror renders only the visible lines; the fragment entry is below them.
  expect(await page.locator("#glsl").innerText()).toContain("struct GssUniforms");
  await page.screenshot({ path: "/private/tmp/gss-webgpu-playground.png" });
  await page.locator("#backend").selectOption("webgl");
  await page.waitForURL("**/playground.html?backend=webgl*");
  await page.waitForFunction(() => document.querySelector("#stats")?.textContent?.includes("ok"));
  expect(await page.locator("#stats").innerText()).toContain("glsl");
  expect(await page.locator(".perf-panel h2").textContent()).toContain("WebGL2");
}, 60000);


// view: distance (decision 131): the isolines of the distance to the objects, over the scene
describe("view: distance draws the isolines over the scene, on both backends", () => {
  // The test of the playground above leaves the page of these tests: back to it
  beforeAll(async () => {
    await page.goto(`${server.resolvedUrls!.local[0]}__gpu`);
    await page.waitForFunction(() => (window as any).__createViewAsync);
  }, 60000);
  // A sphere of radius 1 on the target, seen from the front. On the plane through the target a
  // pixel is 5 / (1.5 × 72) wide: the line d = 0.25 (r = 1.25) crosses the pixel 27 to the right
  // of the center, and the pixel 30 lies between the first two lines
  const scene = (view: string) =>
    `@scene { sphere; } scene { view: ${view}; floor: none; background: #000000; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 5; } sphere { radius: 1; color: #ff0000; }`;
  const at = (pixels: number[], x: number) => {
    const i = (36 * 96 + 48 + x) * 4;
    return pixels.slice(i, i + 3);
  };

  it("draws a light line a quarter of a unit from the sphere, and leaves the sphere and the rest", async () => {
    const shaded = await render(scene("shaded"));
    const distance = await render(scene("distance"));
    for (const [lines, plain] of [[distance.gl, shaded.gl], [distance.gpu, shaded.gpu]]) {
      at(lines, 0).forEach((c, k) => expect(Math.abs(c - at(plain, 0)[k]), `sphere ${at(lines, 0)}`).toBeLessThanOrEqual(2));
      expect(at(plain, 27)).toEqual([0, 0, 0]);
      expect(Math.min(...at(lines, 27)), `line ${at(lines, 27)}`).toBeGreaterThan(40);
      expect(Math.max(...at(lines, 30)), `between ${at(lines, 30)}`).toBeLessThanOrEqual(4);
    }
  }, 60000);
});

// Render on demand (decision 134): a still scene draws its first frame, then rests until
// something changes (a variable, the mouse over an object with :hover); a scene that moves
// draws every frame. Counted on both backends: the draws of WebGL2, the submits of WebGPU.
it("a still scene draws once, then only when something changes (decision 134)", async () => {
  const still = compileScene('@property --tint { syntax: "<color>"; inherits: false; initial-value: #ff0000; } @scene { sphere; } scene { camera-angle: 0deg 0deg; camera-distance: 5; camera-target: 0 0 0; floor: none; } sphere { radius: 1; color: var(--tint); } sphere:hover { scale: 1.1; }');
  const moving = compileScene("@scene { sphere; } sphere { animation: rise 2s infinite alternate; } @keyframes rise { to { translate: 0 1 0; } }");
  const counts = await page.evaluate(async ({ still, moving }) => {
    const createViewAsync = (window as any).__createViewAsync;
    const frames = (n: number) => new Promise<void>(resolve => {
      const tick = () => --n ? requestAnimationFrame(tick) : resolve();
      requestAnimationFrame(tick);
    });
    let draws = 0;
    const gl = WebGL2RenderingContext.prototype;
    const drawArrays = gl.drawArrays;
    gl.drawArrays = function (...args: Parameters<typeof drawArrays>) { draws++; return drawArrays.apply(this, args); };
    const queue = GPUQueue.prototype;
    const submit = queue.submit;
    queue.submit = function (...args: Parameters<typeof submit>) { draws++; return submit.apply(this, args); };
    const result: Record<string, number[]> = {};
    for (const backend of ["webgl", "webgpu"]) {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:96px;height:72px;display:block";
      document.body.append(canvas);
      const view = await createViewAsync(canvas, { backend });
      await view.show(still);
      await frames(5);
      draws = 0;
      await frames(10);
      const resting = draws;
      view.setProperty("--tint", "rgb(0 0 255)");
      await frames(3);
      const changed = draws - resting;
      await frames(5);
      draws = 0;
      const box = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: box.left + 48, clientY: box.top + 36 }));
      await frames(12);
      const hovered = draws;
      await view.show(moving);
      await frames(3);
      draws = 0;
      await frames(10);
      result[backend] = [resting, changed, hovered, draws];
      view.destroy();
      canvas.remove();
    }
    gl.drawArrays = drawArrays;
    queue.submit = submit;
    return result;
  }, { still, moving });
  for (const [resting, changed, hovered, movingDraws] of Object.values(counts)) {
    expect(resting).toBe(0);
    expect(changed).toBeGreaterThan(0);
    expect(hovered).toBeGreaterThan(0);
    expect(movingDraws).toBeGreaterThanOrEqual(8);
  }
}, 60000);
