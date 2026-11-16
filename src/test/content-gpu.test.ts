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

type Backend = "webgl" | "webgpu";

// The colors of the canvas at a few points, given from its center in pixels (y up)
// atRest: no profiler, which draws every frame: the scene is drawn once more at a new size, then rests
async function pixels(source: string, points: [number, number][], backend: Backend = "webgl", atRest = false): Promise<number[][]> {
  return page.evaluate(async ({ compiled, points, backend, atRest }) => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:256px;height:192px;display:block";
    document.body.append(canvas);
    const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
    const profiler = atRest ? {} : { profile: () => probe, profileWebGPU: () => probe };
    if (atRest) {
      // The image drawn once stays on the canvas, to be read frames later
      const getContext = canvas.getContext.bind(canvas) as (type: string, options?: object) => unknown;
      (canvas as any).getContext = (type: string, options?: object) => getContext(type, { ...options, preserveDrawingBuffer: true });
    }
    const view = await (window as any).__createViewAsync(canvas, { backend, adaptDpr: false, ...profiler });
    if (view.backend !== backend) throw new Error(`drawn with ${view.backend}, not ${backend}`);
    view.freeze(true);
    await view.show(compiled);
    const frames = () => new Promise((resolve) => { let left = 6; const tick = () => --left ? requestAnimationFrame(tick) : resolve(0); requestAnimationFrame(tick); });
    await frames();
    if (atRest) {
      // A new size, once the text is drawn: the filter makes new images, in the one frame drawn
      canvas.style.width = "260px";
      await frames();
    }
    const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
    const scale = canvas.width / canvas.clientWidth;
    const read = points.map(([x, y]) => [...ctx.getImageData(Math.round((canvas.clientWidth / 2 + x) * scale), Math.round((96 - y) * scale), 1, 1).data]);
    view.destroy(); canvas.remove();
    return read;
  }, { compiled: compileScene(source), points, backend, atRest });
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

  // A face of an octahedron, and a slope of a pyramid, seen straight: the text reads from left to right
  it.each([
    ["an octahedron", "octahedron { radius: 1.6; }", "45deg 35.26deg", "0.533 0.533 0.533"],
    ["a pyramid", "pyramid { size: 2.4 1.6 2.4; }", "0deg 37deg", "0 -0.267 0.8"],
  ])("writes flat on each face of %s", async (_shape, rules, angle, middle) => {
    const tag = rules.split(" ")[0];
    const source = `@scene { ${tag}; } scene { floor: none; background: #000000; ambient: 1; light: none; camera-target: ${middle}; camera-angle: ${angle}; camera-distance: 4; } ${rules} ${tag} { color: #000000; font-family: monospace; content: "▌"; }`;
    const [left, right] = await pixels(source, [[-5, 0], [5, 0]]);
    expect(lit(left)).toBe(true);
    expect(dark(right)).toBe(true);
  }, 60000);

  // ::face(1) of an octahedron is its front-right top triangle: seen straight, it has the text; ::face(2) does not
  it("writes on the face of the number ::face() gives", async () => {
    const source = (pick: string) =>
      `@scene { octahedron; } scene { floor: none; background: #000000; ambient: 1; light: none; camera-target: 0.533 0.533 0.533; camera-angle: 45deg 35.26deg; camera-distance: 4; } octahedron { radius: 1.6; color: #000000; font-family: monospace; } octahedron::face(${pick}) { content: "█"; }`;
    expect(lit((await pixels(source("1"), [[0, 0]]))[0])).toBe(true);
    expect(dark((await pixels(source("2"), [[0, 0]]))[0])).toBe(true);
    expect(lit((await pixels(source("odd"), [[0, 0]]))[0])).toBe(true);
  }, 60000);

  // bloom() on the scene makes its images after the text is bound, on its texture unit:
  // a scene at rest, drawn once at a new size, must still read its text
  it("is painted under a filter of the scene, on a scene at rest", async () => {
    const source = scene('content: "█";').replace("camera-distance: 4;", "camera-distance: 4; filter: bloom(0.5, 4px);");
    expect(lit((await pixels(source, [[0, 0]], "webgl", true))[0])).toBe(true);
  }, 60000);

  it("is drawn by WebGPU too", async () => {
    const [left, right] = await pixels(scene('content: "▌";'), [[-8, 0], [8, 0]], "webgpu");
    expect(lit(left)).toBe(true);
    expect(dark(right)).toBe(true);
  }, 60000);
});

// content with a number (decision 203): its strings and its digits, each an image, put end
// to end by the shader. In monospace, every digit is as wide as its cell: the text reads as
// the same text written as one string
describe("content with a number", () => {
  // A grid of points over the middle of the front face: lit or not
  const grid: [number, number][] = [];
  for (let x = -60; x <= 60; x += 4) for (let y = -12; y <= 12; y += 4) grid.push([x, y]);
  const ink = async (rules: string, backend: Backend = "webgl") => (await pixels(scene(rules), grid, backend)).map((pixel) => pixel[0]);
  // the points lit in one and dark in the other: the edges of the letters, half lit, do not count
  const differ = (a: number[], b: number[]) => a.filter((red, i) => (red > 150 && b[i] < 60) || (red < 60 && b[i] > 150)).length;

  it.each<[Backend]>([["webgl"], ["webgpu"]])("writes the number as its string, with %s", async (backend) => {
    const string = await ink('content: "a12";', backend);
    expect(string.filter((red) => red > 150).length).toBeGreaterThan(10); // there is a text to compare
    const run = await ink('content: "a" 12;', backend);
    expect(differ(run, string)).toBeLessThan(3);
    // another number is another text
    expect(differ(await ink('content: "a" 47;', backend), string)).toBeGreaterThan(15);
  }, 60000);

  it("keeps the space at the end of the string before the number", async () => {
    const string = await ink('content: "a 1";');
    expect(differ(await ink('content: "a " 1;'), string)).toBeLessThan(3);
  }, 60000);

  it("puts the string after the number", async () => {
    const string = await ink('content: "7 m";');
    expect(differ(await ink('content: 7 " m";'), string)).toBeLessThan(3);
  }, 60000);

  it("gives each copy its own number", async () => {
    const copies = (pick: string) =>
      `@scene { cube * 3; } scene { floor: none; background: #000000; ambient: 1; light: none; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 4; } cube { size: 2; color: #000000; font-family: monospace; content: "n" sibling-index(); display: none; } cube:nth-child(${pick}) { display: block; }`;
    const third = (await pixels(copies("3"), grid)).map((pixel) => pixel[0]);
    expect(differ(third, await ink('content: "n3";'))).toBeLessThan(3);
    expect(differ((await pixels(copies("1"), grid)).map((pixel) => pixel[0]), third)).toBeGreaterThan(6);
  }, 60000);
});
