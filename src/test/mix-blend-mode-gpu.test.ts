import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";
import { compileOnGpu, closeGpu } from "./gpu";
import { compileOnWebGPU, closeWebGPU } from "./webgpu";

// mix-blend-mode (decision 173): an object blends its color with what is behind it, like CSS.
// In a real Chromium, with WebGL2 and WebGPU. The scenes are lit flat (ambient: 1, no sun),
// so a surface shows its color as written and the blends can be computed by hand.
const PAGE = `<html><body style="margin:0"><script type="module">
import { mountAsync } from "/src/embed/runtime.ts";
window.__mountAsync = mountAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "mix-blend-page",
    configureServer(server) {
      server.middlewares.use("/__mix-blend", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__mix-blend`);
  await page.waitForFunction(() => (window as any).__mountAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); await closeGpu(); await closeWebGPU(); });

// A sphere of radius 1 seen from the front, filling the center of the canvas, over a
// background, and a cube behind it when asked
const FLAT = "floor: none; ambient: 1; light: none; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 4;";
const overBackground = (background: string, sphere: string) =>
  `@scene { sphere; } scene { ${FLAT} background: ${background}; } sphere { radius: 1; ${sphere} }`;
const overCube = (cube: string, sphere: string) =>
  `@scene { sphere; cube; } scene { ${FLAT} background: #000000; } sphere { radius: 1; ${sphere} } cube { translate: 0 0 -2.5; size: 3 3 0.2; ${cube} }`;

// The pixel at the center of the canvas
async function center(source: string, backend: "webgl" | "webgpu"): Promise<number[]> {
  return page.evaluate(async ({ compiled, backend }) => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:64px;height:48px;display:block";
    document.body.append(canvas);
    // A profiler draws every frame: the canvas holds an image when it is read
    const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
    const scene = await (window as any).__mountAsync(canvas, compiled, { backend, adaptDpr: false, profile: () => probe, profileWebGPU: () => probe });
    await new Promise((resolve) => { let left = 6; const tick = () => --left ? requestAnimationFrame(tick) : resolve(0); requestAnimationFrame(tick); });
    const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
    const pixel = [...ctx.getImageData(copy.width >> 1, copy.height >> 1, 1, 1).data].slice(0, 3);
    scene.destroy(); canvas.remove();
    return pixel;
  }, { compiled: compileScene(source), backend });
}

// Within 3 levels of 255 on each channel
const near = (pixel: number[], expected: number[]) => {
  expect(pixel.map((value, i) => Math.abs(value - expected[i]) <= 3), `${pixel} is not ${expected}`).toEqual([true, true, true]);
};

describe("mix-blend-mode in a real GPU", () => {
  for (const backend of ["webgl", "webgpu"] as const) {
    const name = backend === "webgl" ? "WebGL2" : "WebGPU";

    it(`blends a sphere with the background by its mode, with ${name}`, async () => {
      // #ff8000 over #4080ff: multiply, screen, difference, plus-lighter, worked out by hand
      near(await center(overBackground("#4080ff", "color: #ff8000; mix-blend-mode: multiply;"), backend), [64, 64, 0]);
      near(await center(overBackground("#4080ff", "color: #ff8000; mix-blend-mode: screen;"), backend), [255, 192, 255]);
      near(await center(overBackground("#4080ff", "color: #ff8000; mix-blend-mode: difference;"), backend), [191, 0, 255]);
      near(await center(overBackground("#4080ff", "color: #ff8000; mix-blend-mode: plus-lighter;"), backend), [255, 255, 255]);
      // normal covers what is behind, like before
      near(await center(overBackground("#4080ff", "color: #ff8000; mix-blend-mode: normal;"), backend), [255, 128, 0]);
    }, 120000);

    it(`blends with the object behind it, and never with its own back face, with ${name}`, async () => {
      // Yellow times cyan: green
      near(await center(overCube("color: #ffff00;", "color: #00ffff; mix-blend-mode: multiply;"), backend), [0, 255, 0]);
      // A gray screened over black stays that gray: its back face is not behind it
      near(await center(overBackground("#000000", "color: #404040; mix-blend-mode: screen;"), backend), [64, 64, 64]);
    }, 120000);

    it(`blends as much as its opacity, with ${name}`, async () => {
      // Half of black (red times green) over red
      near(await center(overBackground("#ff0000", "color: #00ff00; mix-blend-mode: multiply; opacity: 0.5;"), backend), [128, 0, 0]);
    }, 120000);
  }

  it("blends by the luminosity of the object, a mode that is not channel by channel", async () => {
    // The luminosity of white over red: the red, lifted to a luminosity of 1, clipped to white
    near(await center(overBackground("#ff0000", "color: #ffffff; mix-blend-mode: luminosity;"), "webgl"), [255, 255, 255]);
    // The color of green over gray: a green as light as the gray
    near(await center(overBackground("#808080", "color: #00ff00; mix-blend-mode: color;"), "webgl"), [0, 217, 0]);
  }, 120000);

  it("switches its mode halfway through an animation, like CSS", async () => {
    const keyframes = "@keyframes swap { from { mix-blend-mode: multiply; } to { mix-blend-mode: screen; } }";
    // 100 s from multiply to screen, started 40 s or 60 s ago
    near(await center(overBackground("#4080ff", `color: #ff8000; animation: swap 100s linear -40s 1; } ${keyframes} sphere {`), "webgl"), [64, 64, 0]);
    near(await center(overBackground("#4080ff", `color: #ff8000; animation: swap 100s linear -60s 1; } ${keyframes} sphere {`), "webgl"), [255, 192, 255]);
  }, 120000);
});

// Blended objects with everything they meet: holes, transparent objects, shadows through them,
// geometricPrecision, an outline, :hover and :active, a group animated with an easing, glass
describe("mix-blend-mode with the other features compiles on WebGL2 and WebGPU", () => {
  const scenes = [
    "@scene { sphere; cube; torus; } scene { shadows: soft; } sphere { translate: 0 1 0; mix-blend-mode: multiply; mask-image: noise(3, black 45%, transparent 55%); } cube { translate: 1 1 -2; opacity: 0.5; } torus { mix-blend-mode: screen; opacity: 0.7; }",
    "@scene { sphere; cube; } scene { shadows: hard; shape-rendering: geometricPrecision; } sphere { translate: 0 1 0; mix-blend-mode: difference; outline: 0.03 dashed red; transition: 0.3s; } sphere:hover { mix-blend-mode: luminosity; } sphere:active { mix-blend-mode: plus-lighter; } cube { translate: 1 1 -2; material: chrome; }",
    "@scene { group#g { sphere * 3; } cube; light; } #g { mix-blend-mode: color-dodge; animation: k 3s cubic-bezier(0.2, 0.1, 0.3, 1) -1s 2 alternate; } @keyframes k { 50% { mix-blend-mode: color-burn; } to { mix-blend-mode: soft-light; } } sphere { translate: calc(sibling-index() - 2) 1 0; radius: 0.4; material: glass; } cube { translate: 0 0.5 -1.5; material: jelly(#3a7bff); } light { translate: 0 3 1; }",
  ];
  for (const [i, source] of scenes.entries()) {
    it(`scene ${i + 1}`, async () => {
      const scene = compileScene(source);
      expect(await compileOnGpu(scene.shader)).toBe("");
      expect(await compileOnWebGPU(scene.wgsl!)).toBe("");
    }, 180000);
  }
});
