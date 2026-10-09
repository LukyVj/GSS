import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// checker() on the floor (decision 155): its cells are flat, without the flicker of a point
// hit a hair under the plane y = 0. In a real Chromium.
const PAGE = `<html><body style="margin:0"><script type="module">
import { mountAsync } from "/src/embed/runtime.ts";
window.__mountAsync = mountAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "floor-page",
    configureServer(server) {
      server.middlewares.use("/__floor", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__floor`);
  await page.waitForFunction(() => (window as any).__mountAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });
// The checkered floor of the docs, seen from the default camera
const SOURCE =
  "@scene { sphere; } scene { light: none; ambient: 1; floor: checker(1, #000000, #ffffff); } sphere { translate: 0 0.6 0; radius: 0.6; }";

describe("checker() on the floor", () => {
  it("draws each cell in one color, without flicker", async () => {
    // A pixel unlike both its neighbours, along the rows of the floor: a few at the edges of
    // the cells, thousands when the floor flickers
    const lone = await page.evaluate(async ({ compiled }) => {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:320px;height:240px;display:block";
      document.body.append(canvas);
      const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
      const scene = await (window as any).__mountAsync(canvas, compiled, { backend: "webgl", adaptDpr: false, profile: () => probe });
      await new Promise((resolve) => { let left = 6; const tick = () => --left ? requestAnimationFrame(tick) : resolve(0); requestAnimationFrame(tick); });
      const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
      const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
      const { width, height } = copy;
      const data = ctx.getImageData(0, 0, width, height).data;
      const red = (x: number, y: number) => data[4 * (y * width + x)];
      let count = 0;
      // The lower half: the floor in front of the sphere
      for (let y = height >> 1; y < height; y++)
        for (let x = 1; x < width - 1; x++)
          if (Math.abs(red(x, y) - red(x - 1, y)) > 100 && Math.abs(red(x, y) - red(x + 1, y)) > 100) count++;
      scene.destroy(); canvas.remove();
      return count;
    }, { compiled: compileScene(SOURCE) });
    expect(lone).toBeLessThan(50);
  }, 60000);
});
