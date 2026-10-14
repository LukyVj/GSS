import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// texture-mapping: sphere (decision 185), drawn by WebGL2 and WebGPU in a real Chromium:
// the image wraps the sphere like a map around a globe, its middle in front, its top up,
// east on the right, its left and right edges meeting at the back.
const PAGE = `<html><body style="margin:0"><script type="module">
import { createViewAsync } from "/src/runtime/backend.ts";
window.__createViewAsync = createViewAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "mapping-page",
    configureServer(server) {
      server.middlewares.use("/__mapping", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__mapping`);
  await page.waitForFunction(() => (window as any).__createViewAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

// An image of four bands, twice as wide as it is tall, like a map of the Earth
const svg = (bands: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">${bands}</svg>`)}`;
const COLUMNS = svg('<path fill="red" d="M0 0h100v200H0z"/><path fill="lime" d="M100 0h100v200H100z"/><path fill="blue" d="M200 0h100v200H200z"/><path fill="yellow" d="M300 0h100v200H300z"/>');
const ROWS = svg('<path fill="red" d="M0 0h400v50H0z"/><path fill="lime" d="M0 50h400v50H0z"/><path fill="blue" d="M0 100h400v50H0z"/><path fill="yellow" d="M0 150h400v50H0z"/>');

// A sphere of radius 1 seen from the front (x on the right, y up), lit evenly, on gray.
// It is black until its image has arrived.
const scene = (image: string, more = "") =>
  `@scene { sphere; } scene { floor: none; background: #808080; light: none; ambient: 1; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 5; } sphere { radius: 1; color: #000000; texture: url("${image}"); texture-mapping: sphere; ${more} }`;

// The colors at 7/10 of the radius of the sphere on the screen, left, right, up and down,
// and the radius it was measured with
type Sides = { left: number[]; right: number[]; up: number[]; down: number[]; radius: number };
async function sides(source: string): Promise<{ gl: Sides; gpu: Sides }> {
  return page.evaluate(async ({ compiled }) => {
    const createViewAsync = (window as any).__createViewAsync;
    async function capture(backend: string): Promise<Sides> {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:160px;height:160px;display:block";
      document.body.append(canvas);
      // Every frame is drawn, so the canvas can be read in the frame that drew it
      const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
      const view = await createViewAsync(canvas, { backend, adaptDpr: false, profile: () => probe, profileWebGPU: () => probe });
      view.freeze(true);
      await view.show(compiled);
      const copy = document.createElement("canvas");
      const read = () => {
        copy.width = canvas.width; copy.height = canvas.height;
        const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
        return ctx.getImageData(0, 0, copy.width, copy.height).data;
      };
      // Until the canvas has its size and the image has arrived (the middle of the sphere
      // is no longer black), then two more frames
      let data = read();
      let more = 2;
      for (let frame = 0; frame < 120 && more > 0; frame++) {
        await new Promise(requestAnimationFrame);
        data = read();
        const i = 4 * ((canvas.height >> 1) * canvas.width + (canvas.width >> 1));
        if (more < 2 || (canvas.width === 160 && data[i] + data[i + 1] + data[i + 2] > 60)) more--;
      }
      const { width, height } = canvas;
      const cx = width >> 1, cy = height >> 1;
      const at = (x: number, y: number) => [...data.slice(4 * (y * width + x), 4 * (y * width + x) + 3)];
      const gray = (x: number) => at(x, cy).every((v) => Math.abs(v - 128) < 12);
      // The radius of the sphere on the screen, along the middle row
      let left = cx, right = cx;
      while (left > 0 && !gray(left - 1)) left--;
      while (right < width - 1 && !gray(right + 1)) right++;
      // The sphere must not touch the edges, or its radius is not measured
      const radius = left > 0 && right < width - 1 ? (right - left) / 2 : 0;
      const r = Math.round(0.7 * radius);
      view.destroy(); canvas.remove();
      return { left: at(cx - r, cy), right: at(cx + r, cy), up: at(cx, cy - r), down: at(cx, cy + r), radius };
    }
    return { gl: await capture("webgl"), gpu: await capture("webgpu") };
  }, { compiled: compileScene(source) });
}

// The name of a color, by the share of each channel: a lit or a shaded red is still red
function band([r, g, b]: number[]): string {
  const top = Math.max(r, g, b, 1);
  const [R, G, B] = [r / top > 0.6, g / top > 0.6, b / top > 0.6];
  if (R && G && !B) return "yellow";
  if (R && !G && !B) return "red";
  if (!R && G && !B) return "lime";
  if (!R && !G && B) return "blue";
  return `rgb(${r} ${g} ${b})`;
}

describe("texture-mapping: sphere on the GPU", () => {
  // From the front, the visible half of the globe holds the middle half of the image: the
  // projection on the faces of a box would show its outer bands there instead
  it("shows the middle of the image in front, east on the right", async () => {
    const { gl, gpu } = await sides(scene(COLUMNS));
    for (const drawn of [gl, gpu]) {
      expect(drawn.radius).toBeGreaterThan(20);
      expect(band(drawn.left)).toBe("lime");
      expect(band(drawn.right)).toBe("blue");
    }
  }, 60000);

  it("puts the top of the image at the top of the sphere", async () => {
    const { gl, gpu } = await sides(scene(ROWS));
    for (const drawn of [gl, gpu]) {
      expect(drawn.radius).toBeGreaterThan(20);
      expect(band(drawn.up)).toBe("lime");
      expect(band(drawn.down)).toBe("blue");
    }
  }, 60000);

  // Half a turn shows the back: the right edge of the image on the left, its left edge on the right
  it("joins the edges of the image at the back", async () => {
    const { gl, gpu } = await sides(scene(COLUMNS, "rotate-y: 180deg;"));
    for (const drawn of [gl, gpu]) {
      expect(drawn.radius).toBeGreaterThan(20);
      expect(band(drawn.left)).toBe("yellow");
      expect(band(drawn.right)).toBe("red");
    }
  }, 60000);
});
