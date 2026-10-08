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
