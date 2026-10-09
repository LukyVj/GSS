import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// @media in the render (decision 165): with viewport: elementMedia, the queries read the size
// of the canvas, like the result of CodePen; without it, the window. In a real Chromium.
const PAGE = `<html><body style="margin:0"><script type="module">
import { mountAsync } from "/src/embed/runtime.ts";
import { elementMedia } from "/src/runtime/media.ts";
window.__mountAsync = mountAsync;
window.__elementMedia = elementMedia;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "media-page",
    configureServer(server) {
      server.middlewares.use("/__media", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__media`);
  await page.waitForFunction(() => (window as any).__mountAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });
// A red sphere in the middle, left out when the queries say the screen is narrow
const SOURCE =
  "@scene { sphere; } scene { floor: none; background: #000000; ambient: 1; light: none; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 4; } sphere { radius: 1; color: #ff0000; } @media (max-width: 600px) { sphere { display: none; } }";

// The red at the center of a canvas of this width, in a window of 1280, then after the
// canvas is made wider
async function centers(backend: "webgl" | "webgpu", viewport: "canvas" | undefined): Promise<number[]> {
  await page.setViewportSize({ width: 1280, height: 720 });
  return page.evaluate(async ({ compiled, backend, viewport }) => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:300px;height:200px;display:block";
    document.body.append(canvas);
    const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
    const scene = await (window as any).__mountAsync(canvas, compiled, { backend, viewport: viewport === "canvas" ? (window as any).__elementMedia : undefined, adaptDpr: false, profile: () => probe, profileWebGPU: () => probe });
    const red = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await new Promise((resolve) => { let left = 6; const tick = () => --left ? requestAnimationFrame(tick) : resolve(0); requestAnimationFrame(tick); });
      const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
      const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
      return ctx.getImageData(copy.width >> 1, copy.height >> 1, 1, 1).data[0];
    };
    const narrow = await red();
    canvas.style.width = "800px";
    const wide = await red();
    scene.destroy(); canvas.remove();
    return [narrow, wide];
  }, { compiled: compileScene(SOURCE), backend, viewport });
}

describe("@media", () => {
  for (const backend of ["webgl", "webgpu"] as const) {
    it(`reads the size of the canvas with viewport: elementMedia, and follows it, with ${backend === "webgl" ? "WebGL2" : "WebGPU"}`, async () => {
      const [narrow, wide] = await centers(backend, "canvas");
      expect(narrow).toBeLessThan(60); // 300px: narrow, the sphere is left out
      expect(wide).toBeGreaterThan(200); // 800px: wide, it is drawn
    }, 60000);
  }

  it("reads the window without it, like CSS", async () => {
    const [narrow, wide] = await centers("webgl", undefined);
    expect(narrow).toBeGreaterThan(200); // the window is 1280px wide
    expect(wide).toBeGreaterThan(200);
  }, 60000);
});
