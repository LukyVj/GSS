import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// content: the text of an object is drawn in an image and painted on its faces, readable
// on each of them. In a real Chromium, with WebGL2 and with WebGPU.
const PAGE = `<html><body style="margin:0"><script type="module">
import { createViewAsync } from "/src/runtime/backend.ts";
window.__createViewAsync = createViewAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "content-page",
    configureServer(server) {
      server.middlewares.use("/__content", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__content`);
  await page.waitForFunction(() => (window as any).__createViewAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

// A black cube lit evenly, seen straight from one side: yaw and pitch of the camera
const scene = (rules: string, yaw = 0, pitch = 0) =>
  `@scene { cube; } scene { floor: none; background: #000000; ambient: 1; light: none; camera-target: 0 0 0; camera-angle: ${yaw}deg ${pitch}deg; camera-distance: 4; } cube { size: 2; color: #000000; font-family: monospace; ${rules} }`;

type Backend = "webgl2" | "webgpu";

// The colors of the canvas at a few points, given from its center in pixels (y up)
async function pixels(source: string, points: [number, number][], backend: Backend = "webgl2"): Promise<number[][]> {
  return page.evaluate(async ({ compiled, points, backend }) => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:256px;height:192px;display:block";
    document.body.append(canvas);
    const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
    const view = await (window as any).__createViewAsync(canvas, { backend, adaptDpr: false, profile: () => probe, profileWebGPU: () => probe });
    view.freeze(true);
    await view.show(compiled);
    await new Promise((resolve) => { let left = 6; const tick = () => --left ? requestAnimationFrame(tick) : resolve(0); requestAnimationFrame(tick); });
    const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
    const scale = canvas.width / 256;
    const read = points.map(([x, y]) => [...ctx.getImageData(Math.round((128 + x) * scale), Math.round((96 - y) * scale), 1, 1).data]);
    view.destroy(); canvas.remove();
    return read;
  }, { compiled: compileScene(source), points, backend });
}

const lit = (pixel: number[]) => pixel[0] > 150;
const dark = (pixel: number[]) => pixel[0] < 60;

describe("content", () => {
  it("paints the text on the object: white on a dark one", async () => {
    const [without] = await pixels(scene(""), [[0, 0]]);
    expect(dark(without)).toBe(true);
    const [r, g, b] = (await pixels(scene('content: "█";'), [[0, 0]]))[0];
    expect(r).toBeGreaterThan(150);
    expect(g).toBeGreaterThan(150);
    expect(b).toBeGreaterThan(150);
  }, 60000);

  it("paints it black on a light object", async () => {
    const [[r, g, b]] = await pixels(scene('color: #ffffff; content: "█";'), [[0, 0]]);
    expect(r).toBeLessThan(60);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
  }, 60000);

  it("paints it in the color of text-color", async () => {
    const [[r, g, b]] = await pixels(scene('content: "█"; text-color: #ff0000;'), [[0, 0]]);
    expect(r).toBeGreaterThan(150);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
  }, 60000);

  // "▌": the left half of the letter is ink. Read from left to right on every side
  it.each([["front", 0], ["right", 90], ["back", 180], ["left", -90]])("reads from left to right on the %s face", async (_face, yaw) => {
    const [left, right] = await pixels(scene('content: "▌";', yaw as number), [[-8, 0], [8, 0]]);
    expect(lit(left)).toBe(true);
    expect(dark(right)).toBe(true);
  }, 60000);

  // "▀": the upper half of the letter is ink
  it("is the right way up on the sides, and reads from the front on the top", async () => {
    const [top, bottom] = await pixels(scene('content: "▀";'), [[0, 20], [0, -20]]);
    expect(lit(top)).toBe(true);
    expect(dark(bottom)).toBe(true);
    const [far, near] = await pixels(scene('content: "▀";', 0, 80), [[0, 20], [0, -20]]);
    expect(lit(far)).toBe(true);
    expect(dark(near)).toBe(true);
  }, 60000);

  it("keeps the proportions of the text: nothing is painted beside it", async () => {
    const [center, beside] = await pixels(scene('content: "█";'), [[0, 0], [70, 0]]);
    expect(lit(center)).toBe(true);
    expect(dark(beside)).toBe(true);
  }, 60000);

  it("gives a face its own text", async () => {
    const rules = 'content: "█"; } cube::face(front) { content: none;';
    expect(dark((await pixels(scene(rules), [[0, 0]]))[0])).toBe(true);
    expect(lit((await pixels(scene(rules, 90), [[0, 0]]))[0])).toBe(true);
  }, 60000);

  // "🟥": an emoji keeps its own colors, where a letter takes the ink
  it("draws an emoji in its own colors", async () => {
    const [[r, g, b]] = await pixels(scene('color: #ffffff; content: "🟥"; text-color: #0000ff;'), [[0, 0]]);
    expect(r).toBeGreaterThan(150);
    expect(g).toBeLessThan(90);
    expect(b).toBeLessThan(90);
  }, 60000);

  // font-size: a line is as wide as the face, and text-align sets the side of the letter
  it("puts the text at the size of font-size, on the side of text-align", async () => {
    const [left, middle] = await pixels(scene('content: "█"; font-size: 0.4;'), [[-85, 0], [0, 0]]);
    expect(lit(left)).toBe(true);
    expect(dark(middle)).toBe(true);
    const [start, end] = await pixels(scene('content: "█"; font-size: 0.4; text-align: right;'), [[-85, 0], [85, 0]]);
    expect(dark(start)).toBe(true);
    expect(lit(end)).toBe(true);
  }, 60000);

  // "█\A ": two lines, the first one inked, the second one empty
  it("breaks a line where the text says \\A", async () => {
    const [top, bottom] = await pixels(scene('content: "█\\A ▁"; font-size: 0.6; text-align: center;'), [[0, 20], [0, -24]]);
    expect(lit(top)).toBe(true);
    expect(dark(bottom)).toBe(true);
  }, 60000);

  // A cylinder: the text wraps around it, and still reads from left to right on each side
  it.each([["front", 0], ["back", 180], ["right", 90]])("wraps around a cylinder, readable on its %s", async (_side, yaw) => {
    const cylinder = `@scene { cylinder; } scene { floor: none; background: #000000; ambient: 1; light: none; camera-target: 0 0 0; camera-angle: ${yaw}deg 0deg; camera-distance: 4; } cylinder { radius: 1; height: 2; color: #000000; font-family: monospace; content: "▌"; }`;
    const [left, right] = await pixels(cylinder, [[-6, 0], [6, 0]]);
    expect(lit(left)).toBe(true);
    expect(dark(right)).toBe(true);
  }, 60000);

  it("is drawn by WebGPU too", async () => {
    const [left, right] = await pixels(scene('content: "▌";'), [[-8, 0], [8, 0]], "webgpu");
    expect(lit(left)).toBe(true);
    expect(dark(right)).toBe(true);
  }, 60000);
});
