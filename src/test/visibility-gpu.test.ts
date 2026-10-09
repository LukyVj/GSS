import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// The end of an animation is its last keyframe, exactly, like CSS: an object whose
// animation ends on visibility: hidden stays hidden, and steps() reach their last step.
// In a real Chromium, with WebGL2 and WebGPU.
const PAGE = `<html><body style="margin:0"><script type="module">
import { mountAsync } from "/src/embed/runtime.ts";
window.__mountAsync = mountAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "visibility-page",
    configureServer(server) {
      server.middlewares.use("/__visibility", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__visibility`);
  await page.waitForFunction(() => (window as any).__mountAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

// A red sphere of radius 1 on black, seen from the front, filling the center of the canvas
const scene = (rules: string) =>
  `@scene { sphere; } scene { floor: none; background: #000000; ambient: 1; light: none; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 4; } sphere { radius: 1; color: #ff0000; } ${rules}`;

// The pixel at the center of the canvas
async function center(source: string, backend: "webgl" | "webgpu" = "webgl"): Promise<number[]> {
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
const shown = (pixel: number[]) => pixel[0] > 100;

// A negative delay longer than the animation: it is over from the first frame
describe("visibility at the end of an animation", () => {
  for (const backend of ["webgl", "webgpu"] as const) {
    it(`stays hidden when the last keyframe, right after a visible one, is hidden, with ${backend === "webgl" ? "WebGL2" : "WebGPU"}`, async () => {
      const keyframes = "@keyframes k { 0% { visibility: visible; } 99% { visibility: visible; } 100% { visibility: hidden; } }";
      expect(shown(await center(scene(`sphere { animation: k 1s linear -2s 1 both; } ${keyframes}`), backend))).toBe(false);
      expect(shown(await center(scene(`sphere { animation: k 1s cubic-bezier(0.5, 0, 0.5, 0.5) -2s 1 both; } ${keyframes}`), backend))).toBe(false);
      // The same animation without a fill mode: the object's own value afterwards
      expect(shown(await center(scene(`sphere { animation: k 1s linear -2s 1; } ${keyframes}`), backend))).toBe(true);
    }, 60000);
  }

  it("holds the last keyframe with forwards, and after a hidden one, a visible one", async () => {
    expect(shown(await center(scene("sphere { animation: k 1s linear -2s 1 forwards; } @keyframes k { 0% { visibility: visible; } 80% { visibility: visible; } 100% { visibility: hidden; } }")))).toBe(false);
    expect(shown(await center(scene("sphere { animation: k 1s linear -2s 1 both; } @keyframes k { 0% { visibility: visible; } 98% { visibility: visible; } 99% { visibility: hidden; } 100% { visibility: hidden; } }")))).toBe(false);
    expect(shown(await center(scene("sphere { animation: k 1s linear -2s 1 both; } @keyframes k { 0% { visibility: hidden; } 99% { visibility: hidden; } 100% { visibility: visible; } }")))).toBe(true);
  }, 60000);

  it("holds the last keyframe during the delay of an animation played backwards", async () => {
    const keyframes = "@keyframes k { 0% { visibility: visible; } 80% { visibility: visible; } 100% { visibility: hidden; } }";
    expect(shown(await center(scene(`sphere { animation: k 1s linear 60s reverse backwards; } ${keyframes}`)))).toBe(false);
    expect(shown(await center(scene(`sphere { animation: k 1s linear 60s reverse; } ${keyframes}`)))).toBe(true);
  }, 60000);

  it("ends on the first keyframe when reversed, with any easing", async () => {
    const keyframes = "@keyframes k { 0% { visibility: hidden; } 1% { visibility: visible; } 100% { visibility: visible; } }";
    for (const easing of ["linear", "ease", "ease-in", "step-end"])
      expect(shown(await center(scene(`sphere { animation: k 1s ${easing} -2s 1 reverse both; } ${keyframes}`))), easing).toBe(false);
  }, 60000);

  it("ends on the last keyframe with any easing", async () => {
    const keyframes = "@keyframes k { 0% { visibility: visible; } 80% { visibility: visible; } 100% { visibility: hidden; } }";
    for (const easing of ["ease", "ease-out", "cubic-bezier(0.5, 0, 0.5, 0.5)", "step-end", "steps(3)", "steps(3, jump-none)"])
      expect(shown(await center(scene(`sphere { animation: k 1s ${easing} -2s 1 both; } ${keyframes}`))), easing).toBe(false);
  }, 60000);
});

describe("an eased animation of visibility", () => {
  it("keeps the object hidden until the keyframe that shows it starts", async () => {
    // A quarter of the way: in the hidden half, long before the one that turns visible
    const keyframes = "@keyframes k { 0% { visibility: hidden; } 50% { visibility: hidden; } 100% { visibility: visible; } }";
    for (const easing of ["linear", "ease", "ease-in", "ease-out", "cubic-bezier(0.1, 0.8, 0.2, 1)"])
      expect(shown(await center(scene(`sphere { animation: k 40s ${easing} -10s; } ${keyframes}`))), easing).toBe(false);
  }, 60000);
});

describe("steps() at the end of an animation", () => {
  it("reach the last keyframe, like CSS", async () => {
    const keyframes = "@keyframes k { 0% { color: #ff0000; } 80% { color: #ff0000; } 100% { color: #0000ff; } }";
    for (const easing of ["step-end", "steps(4)"]) {
      const [r, , b] = await center(scene(`sphere { animation: k 1s ${easing} -2s 1 forwards; } ${keyframes}`));
      expect(b, easing).toBeGreaterThan(r);
    }
  }, 60000);
});
