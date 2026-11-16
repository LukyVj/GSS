import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// antialias, drawn: a flat white cube turned on a black background, at dpr 1. With one ray per
// pixel, every pixel is the cube or the background; with 4, the pixels along its edges are
// grays between the two. In a real Chromium, WebGL2 and WebGPU.
const PAGE = `<html><body style="margin:0"><script type="module">
import { createViewAsync } from "/src/runtime/backend.ts";
window.__createViewAsync = createViewAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "antialias-page",
    configureServer(server) {
      server.middlewares.use("/__aa", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__aa`);
  await page.waitForFunction(() => (window as any).__createViewAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

const WIDTH = 160;
const HEIGHT = 120;
const SCENE = `@scene { cube; }
scene { AA floor: none; background: #000000; ambient: 1; light: none; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 5; dpr: 1; }
cube { size: 1.2; rotate-z: 17deg; color: #ffffff; }`;

// The pixels that are neither the background nor the cube: more than 12 away from both
async function partial(source: string, backend: "webgl" | "webgpu"): Promise<number> {
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
    const data = context.getImageData(0, 0, copy.width, copy.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 12 && data[i] < 243) count++;
    view.destroy();
    canvas.remove();
    return count;
  }, { compiled: compileScene(source), backend, width: WIDTH, height: HEIGHT });
}

const BACKENDS = [["webgl", "WebGL2"], ["webgpu", "WebGPU"]] as const;

describe("antialias on the GPU", () => {
  for (const [backend, name] of BACKENDS)
    it(`smooths the edges of a cube with 4 rays per pixel, with ${name}`, async () => {
      const one = await partial(SCENE.replace("AA", ""), backend);
      const four = await partial(SCENE.replace("AA", "antialias: 4x;"), backend);
      const two = await partial(SCENE.replace("AA", "antialias: 2x;"), backend);
      expect(one).toBeLessThan(5);
      expect(four).toBeGreaterThan(80); // about the outline of the cube, ~150 pixels
      expect(two).toBeGreaterThan(40);
    }, 60000);
});
