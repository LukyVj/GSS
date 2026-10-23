import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// outline (decision 163): a line around the silhouette, past the edge of the object, over
// what is behind it. In a real Chromium, with WebGL2 and WebGPU.
const PAGE = `<html><body style="margin:0"><script type="module">
import { mountAsync } from "/src/embed/runtime.ts";
window.__mountAsync = mountAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "outline-page",
    configureServer(server) {
      server.middlewares.use("/__outline", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__outline`);
  await page.waitForFunction(() => (window as any).__mountAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

// A white sphere of radius 1 on black, seen from the front at 4: on a canvas of 128 × 96,
// its edge is 37 pixels from the center, the end of a line of 0.15 at 43
const scene = (outline: string) =>
  `@scene { sphere; } scene { floor: none; background: #000000; ambient: 1; light: none; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 4; } sphere { radius: 1; color: #2040ff; ${outline} }`;

// The pixels of the middle row, from the center to the right
async function row(source: string, backend: "webgl" | "webgpu"): Promise<number[][]> {
  return page.evaluate(async ({ compiled, backend }) => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:128px;height:96px;display:block";
    document.body.append(canvas);
    // A profiler draws every frame: the canvas holds an image when it is read
    const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
    const scene = await (window as any).__mountAsync(canvas, compiled, { backend, adaptDpr: false, profile: () => probe, profileWebGPU: () => probe });
    await new Promise((resolve) => { let left = 6; const tick = () => --left ? requestAnimationFrame(tick) : resolve(0); requestAnimationFrame(tick); });
    const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
    const y = copy.height >> 1;
    const pixels = Array.from({ length: copy.width >> 1 }, (_, x) => [...ctx.getImageData((copy.width >> 1) + x, y, 1, 1).data].slice(0, 3));
    scene.destroy(); canvas.remove();
    return pixels;
  }, { compiled: compileScene(source), backend });
}

describe("outline", () => {
  for (const backend of ["webgl", "webgpu"] as const) {
    it(`draws a line just past the silhouette, of its own width, with ${backend === "webgl" ? "WebGL2" : "WebGPU"}`, async () => {
      const plain = await row(scene(""), backend);
      const lined = await row(scene("outline: 0.15 solid #ff0000;"), backend);
      // The sphere itself is the same, blue at the center
      expect(lined[0]).toEqual(plain[0]);
      expect(plain[0][2]).toBeGreaterThan(150);
      // Just past its edge: black without the line, red with it
      expect(plain[40]).toEqual([0, 0, 0]);
      expect(lined[40][0]).toBeGreaterThan(200);
      expect(lined[40][2]).toBeLessThan(60);
      // Past the line: black again
      expect(lined[50]).toEqual([0, 0, 0]);
    }, 60000);
  }
});

// The share of the ring of the line, 40 pixels from the center, that is red
async function ring(source: string): Promise<number> {
  return page.evaluate(async ({ compiled }) => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:128px;height:96px;display:block";
    document.body.append(canvas);
    const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
    const scene = await (window as any).__mountAsync(canvas, compiled, { backend: "webgl", adaptDpr: false, profile: () => probe });
    await new Promise((resolve) => { let left = 6; const tick = () => --left ? requestAnimationFrame(tick) : resolve(0); requestAnimationFrame(tick); });
    const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
    let red = 0;
    const steps = 180;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const [r, , b] = ctx.getImageData(Math.round(64 + 40 * Math.cos(angle)), Math.round(48 + 40 * Math.sin(angle)), 1, 1).data;
      if (r > 200 && b < 60) red++;
    }
    scene.destroy(); canvas.remove();
    return red / steps;
  }, { compiled: compileScene(source) });
}

describe("outline-style", () => {
  it("draws the whole ring when solid, and about half of it in dashes when dashed", async () => {
    expect(await ring(scene("outline: 0.15 solid #ff0000;"))).toBeGreaterThan(0.95);
    const dashed = await ring(scene("outline: 0.15 dashed #ff0000;"));
    expect(dashed).toBeGreaterThan(0.3);
    expect(dashed).toBeLessThan(0.7);
  }, 60000);
});

// A brace drawn small (scale: 0.008) on a canvas of 480 × 270: a pixel is about 0.015 wide
// there, the line of 0.01 less than one. Far from its segments, a path measures the distance to
// their box: the line was drawn over that box, in lines, rings and a filled rectangle.
const brace = (outline: string, rendering = "auto") =>
  `@scene { path#brace; } scene { shape-rendering: ${rendering}; floor: none; background: #111111; camera-distance: 6; camera-angle: 0deg 0deg; camera-target: 0 0 0; dpr: 1; } #brace { view-box: 0 0 600 600; stroke-width: 18; scale: 0.008; translate: 0.6 0 0; color: #e8e6e1; ${outline} d: path("M170 140 C120 140 112 165 112 205 v55 c0 32 -16 40 -55 40 c39 0 55 8 55 40 v55 c0 40 8 65 58 65"); }`;

// The pixels of a canvas of 480 × 270, as [r, g, b] by row
async function image(source: string, backend: "webgl" | "webgpu"): Promise<number[][][]> {
  return page.evaluate(async ({ compiled, backend }) => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:480px;height:270px;display:block";
    document.body.append(canvas);
    const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
    const scene = await (window as any).__mountAsync(canvas, compiled, { backend, adaptDpr: false, profile: () => probe, profileWebGPU: () => probe });
    await new Promise((resolve) => { let left = 6; const tick = () => --left ? requestAnimationFrame(tick) : resolve(0); requestAnimationFrame(tick); });
    const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
    const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
    const rows = Array.from({ length: copy.height }, (_, y) => Array.from({ length: copy.width }, (_, x) => [...data.slice((y * copy.width + x) * 4, (y * copy.width + x) * 4 + 3)]));
    scene.destroy(); canvas.remove();
    return rows;
  }, { compiled: compileScene(source), backend });
}

describe("outline of a path drawn small", () => {
  for (const [backend, rendering] of [["webgl", "auto"], ["webgpu", "auto"], ["webgl", "geometricPrecision"]] as const) {
    it(`stays beside the path, not over its box, with ${backend === "webgl" ? "WebGL2" : "WebGPU"} and ${rendering}`, async () => {
      const plain = await image(brace("", rendering), backend);
      const lined = await image(brace("outline: 0.01 solid #ff0000;", rendering), backend);
      // Every pixel but the background (#111111): the side of the tube in the shade is barely lighter
      const isPath = (pixel: number[]) => pixel.some((value) => Math.abs(value - 17) > 2);
      const isRed = ([r, g, b]: number[]) => r > 150 && g < 80 && b < 80;
      // The red pixels farther than 2 pixels from every pixel of the path
      const near = (x: number, y: number) => {
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) if (plain[y + dy]?.[x + dx] && isPath(plain[y + dy][x + dx])) return true;
        return false;
      };
      let stray = 0;
      let red = 0;
      lined.forEach((row, y) => row.forEach((pixel, x) => {
        if (!isRed(pixel)) return;
        red++;
        if (!near(x, y)) stray++;
      }));
      // The path is there, and so is its line, only beside it
      expect(plain.flat().filter(isPath).length).toBeGreaterThan(500);
      expect(red).toBeGreaterThan(0);
      expect(stray).toBe(0);
    }, 120000);
  }
});
