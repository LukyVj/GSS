import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// A material with its own color keeps it over a gradient in color (decision 166): brass on a
// striped object is brass. In a real Chromium.
const PAGE = `<html><body style="margin:0"><script type="module">
import { mountAsync } from "/src/embed/runtime.ts";
window.__mountAsync = mountAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "material-color-page",
    configureServer(server) {
      server.middlewares.use("/__material", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__material`);
  await page.waitForFunction(() => (window as any).__mountAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

// A sphere filling most of the picture, with a material and a color
const sceneOf = (rule: string) =>
  compileScene(
    `@scene { sphere; } scene { floor: none; background: #8a8a96; camera-distance: 3.2; camera-angle: 0deg 0deg; camera-target: 0 0 0; ambient: 0.4; } sphere { radius: 1; ${rule} }`,
  );

// How far apart two pictures are: the mean difference of their channels, from 0 to 255
async function difference(a: string, b: string): Promise<number> {
  return page.evaluate(async ({ scenes }) => {
    const pixels = async (compiled: unknown) => {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:160px;height:120px;display:block";
      document.body.append(canvas);
      const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
      const scene = await (window as any).__mountAsync(canvas, compiled, { backend: "webgl", adaptDpr: false, profile: () => probe });
      await new Promise((resolve) => { let left = 6; const tick = () => --left ? requestAnimationFrame(tick) : resolve(0); requestAnimationFrame(tick); });
      const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
      const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
      const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
      scene.destroy(); canvas.remove();
      return data;
    };
    const [first, second] = [await pixels(scenes[0]), await pixels(scenes[1])];
    let sum = 0;
    for (let i = 0; i < first.length; i++) if (i % 4 !== 3) sum += Math.abs(first[i] - second[i]);
    return sum / (first.length * 0.75);
  }, { scenes: [sceneOf(a), sceneOf(b)] });
}

describe("a material with its own color over a gradient in color", () => {
  it("draws brass on a striped object like brass", async () => {
    expect(await difference("material: brass; color: stripes(3, #ff5a36, white);", "material: brass;")).toBeLessThan(0.5);
    expect(await difference("material: silver; color: linear-gradient(#ff5a36, white);", "material: silver;")).toBeLessThan(0.5);
  }, 60000);

  it("still paints the stripes on a metal without a color of its own", async () => {
    expect(await difference("material: metal(0.2); color: stripes(3, #ff5a36, white);", "material: metal(0.2); color: #ff5a36;")).toBeGreaterThan(5);
  }, 60000);
});
