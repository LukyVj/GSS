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
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  page.on("console", message => { if (message.type() === "error") console.error(message.text()); });
  await page.goto(`${server.resolvedUrls!.local[0]}__gpu`);
  await page.waitForFunction(() => (window as any).__createViewAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

async function render(source: string, hover = false, set?: [string, string]) {
  return page.evaluate(async ({ compiled, hover, set }) => {
    const createViewAsync = (window as any).__createViewAsync;
    async function capture(backend: string) {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:96px;height:72px;display:block";
      document.body.append(canvas);
      const view = await createViewAsync(canvas, { backend });
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
  }, { compiled: compileScene(source), hover, set });
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
    const view = await (window as any).__createViewAsync(canvas, { backend: "webgpu" });
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

