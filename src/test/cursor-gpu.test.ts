import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// cursor (decision 161): the picking pass finds the object under the pointer, and the
// canvas takes its cursor. In a real Chromium, with WebGL2 and WebGPU.
const PAGE = `<html><body style="margin:0"><script type="module">
import { mountAsync } from "/src/embed/runtime.ts";
window.__mountAsync = mountAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "cursor-page",
    configureServer(server) {
      server.middlewares.use("/__cursor", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__cursor`);
  await page.waitForFunction(() => (window as any).__mountAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

// A big cube in the middle of the canvas: its cursor over it, grabbing while pressed,
// the page's own (none set) over the background
const SOURCE =
  "@scene { cube; } scene { floor: none; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 4; } cube { size: 1.6; cursor: grab; } cube:active { cursor: grabbing; }";

async function cursors(backend: "webgl" | "webgpu"): Promise<string[]> {
  return page.evaluate(async ({ compiled, backend }) => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;left:0;top:0;width:200px;height:150px;display:block";
    document.body.append(canvas);
    const scene = await (window as any).__mountAsync(canvas, compiled, { backend, adaptDpr: false });
    const at = (type: string, x: number, y: number) =>
      canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true }));
    // The answer of the picking pass comes a few frames later
    const settle = (want: string) =>
      new Promise<string>((resolve) => {
        const end = performance.now() + 5000;
        const tick = () => {
          if (canvas.style.cursor === want || performance.now() > end) resolve(canvas.style.cursor);
          else requestAnimationFrame(tick);
        };
        tick();
      });
    const seen: string[] = [];
    at("pointermove", 100, 75);
    seen.push(await settle("grab"));
    at("pointerdown", 100, 75);
    seen.push(await settle("grabbing"));
    window.dispatchEvent(new PointerEvent("pointerup"));
    at("pointermove", 3, 3);
    seen.push(await settle(""));
    scene.destroy();
    canvas.remove();
    return seen;
  }, { compiled: compileScene(SOURCE), backend });
}

describe("cursor", () => {
  it("shows the cursor of the object under the pointer, and of :active while it is pressed, with WebGL2", async () => {
    expect(await cursors("webgl")).toEqual(["grab", "grabbing", ""]);
  }, 60000);

  it("does the same with WebGPU", async () => {
    expect(await cursors("webgpu")).toEqual(["grab", "grabbing", ""]);
  }, 60000);
});
