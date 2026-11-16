import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// ambient-occlusion, drawn: a cube on the floor seen from above, without shadows. With the
// occlusion, the floor along the foot of the cube gets darker; the floor far from it and the
// top of the cube, open to the sky, keep their color. In a real Chromium, WebGL2 and WebGPU.
const PAGE = `<html><body style="margin:0"><script type="module">
import { createViewAsync } from "/src/runtime/backend.ts";
window.__createViewAsync = createViewAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "ambient-occlusion-page",
    configureServer(server) {
      server.middlewares.use("/__ao", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__ao`);
  await page.waitForFunction(() => (window as any).__createViewAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

const WIDTH = 240;
const HEIGHT = 135;
const SCENE = `@scene { cube; }
scene { AO background: #000000; floor: #c0c0c0; ambient: 0.6; light: 0deg 90deg; camera-angle: 0deg 80deg; camera-distance: 6; camera-target: 0 0 0; dpr: 1; }
cube { size: 1; translate: 0 0.5 0; color: #c0c0c0; }`;

// The red channel of a few pixels: the floor at the foot of the cube (right of it), the floor
// far from it (a corner), the middle of the top of the cube
async function sample(source: string, backend: "webgl" | "webgpu"): Promise<{ foot: number; far: number; top: number }> {
  return page.evaluate(async ({ compiled, backend, width, height }) => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;display:block`;
    document.body.append(canvas);
    const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
    const view = await (window as any).__createViewAsync(canvas, { backend, adaptDpr: false, profile: () => probe, profileWebGPU: () => probe });
    view.freeze(true);
    await view.show(compiled);
    await new Promise<void>((resolve) => { let left = 3; const tick = () => (--left ? requestAnimationFrame(tick) : resolve()); requestAnimationFrame(tick); });
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext("2d")!;
    context.drawImage(canvas, 0, 0);
    const red = (x: number, y: number) => context.getImageData(x, y, 1, 1).data[0];
    // The cube spans about 34 pixels around the middle: its foot is just past its right edge
    const [cx, cy] = [Math.round(width / 2), Math.round(height / 2)];
    const foot = Math.min(...[2, 3, 4].map((dx) => red(cx + 19 + dx, cy)));
    const result = { foot, far: red(6, 6), top: red(cx, cy) };
    view.destroy();
    canvas.remove();
    return result;
  }, { compiled: compileScene(source), backend, width: WIDTH, height: HEIGHT });
}

const BACKENDS = [["webgl", "WebGL2"], ["webgpu", "WebGPU"]] as const;

describe("ambient-occlusion on the GPU", () => {
  for (const [backend, name] of BACKENDS)
    it(`darkens the floor at the foot of a cube, and nothing in the open, with ${name}`, async () => {
      const plain = await sample(SCENE.replace("AO", ""), backend);
      const occluded = await sample(SCENE.replace("AO", "ambient-occlusion: 1;"), backend);
      expect(occluded.foot).toBeLessThan(plain.foot - 20);
      expect(Math.abs(occluded.far - plain.far)).toBeLessThanOrEqual(1);
      expect(Math.abs(occluded.top - plain.top)).toBeLessThanOrEqual(2);
    }, 60000);
});
