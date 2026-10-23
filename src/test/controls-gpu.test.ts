import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// controls (decision 176): the gestures that move the camera, on the scene and on each
// object. A real mouse in a real Chromium, with WebGL2 and WebGPU: a drag that turns the
// camera moves the red sphere on the canvas; one that does not leaves every pixel.
const PAGE = `<html><body style="margin:0"><script type="module">
import { mountAsync } from "/src/embed/runtime.ts";
window.__mountAsync = mountAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "controls-page",
    configureServer(server) {
      server.middlewares.use("/__controls", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__controls`);
  await page.waitForFunction(() => (window as any).__mountAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

// A green cube in the middle of a canvas of 300 × 200 at the top left of the page, a red
// sphere on its right: a turn of the camera moves the sphere
const STAGE =
  "@scene { cube; sphere; } scene { floor: none; background: #000000; ambient: 1; light: none; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 5; } cube { size: 1.4; color: #00ff00; } sphere { radius: 0.4; translate: 1.6 0 0; color: #ff0000; }";

async function mount(source: string, backend: "webgl" | "webgpu"): Promise<void> {
  await page.evaluate(async ({ compiled, backend }) => {
    (window as any).__scene?.destroy();
    document.body.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;left:0;top:0;width:300px;height:200px;display:block";
    document.body.append(canvas);
    (window as any).__canvas = canvas;
    (window as any).__scene = await (window as any).__mountAsync(canvas, compiled, { backend, adaptDpr: false });
  }, { compiled: compileScene(source), backend });
  await frames(20);
}

// Some frames, for the picking pass to answer and the camera to be drawn
const frames = (count: number) =>
  page.evaluate((count) => new Promise((resolve) => {
    const tick = () => (--count > 0 ? requestAnimationFrame(tick) : resolve(0));
    requestAnimationFrame(tick);
  }), count);

// What the page shows of the canvas: the composited image, whatever the drawing buffer keeps
const snap = () => page.screenshot({ clip: { x: 0, y: 0, width: 300, height: 200 } });
const moved = (before: Buffer, after: Buffer) => !before.equals(after);

// The mouse rests over a point until the picking pass has answered (the canvas shows the
// cursor of what is there), then drags 60px to the right from there: did the camera turn?
async function drag(x: number, y: number, cursor = ""): Promise<boolean> {
  const before = await snap();
  await page.mouse.move(x, y);
  await page.waitForFunction((cursor) => (window as any).__canvas.style.cursor === cursor, cursor, { timeout: 10000 });
  await frames(4);
  await page.mouse.down();
  await page.mouse.move(x + 60, y, { steps: 6 });
  await page.mouse.up();
  await frames(10);
  return moved(before, await snap());
}

// A turn of the wheel over a point: did the camera move, and did the scene keep the wheel
// from the page?
async function wheel(x: number, y: number): Promise<{ moved: boolean; prevented: boolean }> {
  const before = await snap();
  const prevented = await page.evaluate(({ x, y }) => {
    const event = new WheelEvent("wheel", { clientX: x, clientY: y, deltaY: 300, bubbles: true, cancelable: true });
    (window as any).__canvas.dispatchEvent(event);
    return event.defaultPrevented;
  }, { x, y });
  await frames(10);
  return { moved: moved(before, await snap()), prevented };
}

for (const backend of ["webgl", "webgpu"] as const) {
  const name = backend === "webgl" ? "WebGL2" : "WebGPU";
  describe(`controls, with ${name}`, () => {
    it("turns the camera on a drag by default", async () => {
      await mount(STAGE, backend);
      expect(await drag(20, 20)).toBe(true);
    }, 60000);

    it("leaves the camera still with scene { controls: none }", async () => {
      await mount(`${STAGE} scene { controls: none; }`, backend);
      expect(await drag(20, 20)).toBe(false);
      expect(await wheel(20, 20)).toEqual({ moved: false, prevented: false }); // the page scrolls
    }, 60000);

    it("zooms, but does not turn, with controls: zoom", async () => {
      await mount(`${STAGE} scene { controls: zoom; }`, backend);
      expect(await drag(20, 20)).toBe(false);
      expect(await wheel(20, 20)).toEqual({ moved: true, prevented: true });
    }, 60000);

    it("does not turn the camera from an object that says none, and does from the background", async () => {
      await mount(`${STAGE} cube { controls: none; cursor: pointer; }`, backend);
      expect(await drag(150, 100, "pointer")).toBe(false); // starts on the cube
      expect(await drag(20, 20)).toBe(true); // starts on the background
    }, 60000);
  });
}
