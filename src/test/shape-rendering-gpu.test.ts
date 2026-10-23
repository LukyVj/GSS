import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// shape-rendering: geometricPrecision, measured on the silhouettes. The same scene is drawn
// with auto and with geometricPrecision, and the pixels that differ are sorted by where they
// are: on the ring just outside the silhouette of auto (blended, as they should be), or
// farther from every object (a ghost). In a real Chromium, with WebGL2 and WebGPU.
const PAGE = `<html><body style="margin:0"><script type="module">
import { createViewAsync } from "/src/runtime/backend.ts";
window.__createViewAsync = createViewAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "shape-rendering-page",
    configureServer(server) {
      server.middlewares.use("/__edges", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  // Room for a canvas of 3840 × 2160 (a 4K screen, or a Retina screen at dpr 2)
  page = await browser.newPage({ viewport: { width: 3840, height: 2160 } });
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__edges`);
  await page.waitForFunction(() => (window as any).__createViewAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

type Edges = {
  ring: number; // pixels of the background that touch an object, with auto
  blended: number; // pixels of the background, at most 2 pixels from an object, that geometricPrecision changed
  ghosts: number; // pixels of the background, farther from every object, that geometricPrecision changed
  partial: number; // pixels of geometricPrecision that are neither the background nor the object
};

// Draws the scene (shape-rendering: SHAPE) with auto, then with geometricPrecision, on a
// canvas of width × height at dpr 1, and counts. A pixel changed when one of its channels
// moved by more than 12; the background is the color of the scene, within 2. A pixel is
// partial when it is more than 12 away from both the background and the color of the object
// (a scene of one flat color on its background).
async function edges(
  source: string,
  backend: "webgl" | "webgpu",
  width: number,
  height: number,
  background: [number, number, number],
  color: [number, number, number] = [255, 255, 255],
): Promise<Edges> {
  return page.evaluate(async ({ plain, precise, backend, width, height, background, color }) => {
    async function draw(compiled: unknown): Promise<Uint8ClampedArray> {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;display:block`;
      document.body.append(canvas);
      // A profiler draws every frame: the canvas holds an image when it is read
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
      const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
      view.destroy();
      canvas.remove();
      return pixels;
    }
    const a = await draw(plain);
    const b = await draw(precise);
    const n = width * height;
    // The objects of auto, then grown by 1 pixel and by 2 pixels (the 8 neighbours)
    const object = new Uint8Array(n);
    for (let i = 0; i < n; i++)
      object[i] = [0, 1, 2].some((c) => Math.abs(a[i * 4 + c] - background[c]) > 2) ? 1 : 0;
    const grow = (mask: Uint8Array) => {
      const out = new Uint8Array(n);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          let on = 0;
          for (let dy = -1; dy <= 1 && !on; dy++)
            for (let dx = -1; dx <= 1 && !on; dx++) {
              const xx = x + dx, yy = y + dy;
              if (xx >= 0 && yy >= 0 && xx < width && yy < height && mask[yy * width + xx]) on = 1;
            }
          out[y * width + x] = on;
        }
      return out;
    };
    const one = grow(object);
    const two = grow(one);
    let ring = 0, blended = 0, ghosts = 0, partial = 0;
    const away = (pixels: Uint8ClampedArray, i: number, rgb: number[]) =>
      [0, 1, 2].some((c) => Math.abs(pixels[i * 4 + c] - rgb[c]) > 12);
    for (let i = 0; i < n; i++) {
      if (away(b, i, background) && away(b, i, color)) partial++;
      if (object[i]) continue;
      if (one[i]) ring++;
      const changed = [0, 1, 2].some((c) => Math.abs(a[i * 4 + c] - b[i * 4 + c]) > 12);
      if (!changed) continue;
      if (two[i]) blended++;
      else ghosts++;
    }
    return { ring, blended, ghosts, partial };
  }, {
    plain: compileScene(source.replace("SHAPE", "auto")),
    precise: compileScene(source.replace("SHAPE", "geometricPrecision")),
    backend, width, height, background, color,
  });
}

const BACKENDS = [["webgl", "WebGL2"], ["webgpu", "WebGPU"]] as const;

// A path is a tube around segments; far from them, its distance is the distance to their box,
// which is less than the distance to the tube. A ray that passed near the box, or came into
// it, must not take it for the edge of the tube.
describe("geometricPrecision around a path", () => {
  const brace = `@scene { path#brace; sphere; prism#heart; }
scene { floor: none; background: #111111; camera-distance: 6; camera-angle: 0deg 0deg; camera-target: 0 0 0; dpr: 1; shape-rendering: SHAPE; }
#brace { view-box: 0 0 600 600; stroke-width: 18; scale: 0.008; translate: -1.6 0 0; color: #e8e6e1;
  d: path("M170 140 C120 140 112 165 112 205 v55 c0 32 -16 40 -55 40 c39 0 55 8 55 40 v55 c0 40 8 65 58 65"); }
sphere { radius: 0.6; color: #ff5a36; }
#heart { view-box: 0 0 32 32; d: path("M16 28 C7 21 3 15.5 3 10.5 C3 6.5 6 4 9.5 4 C12.5 4 14.6 6 16 8.3 C17.4 6 19.5 4 22.5 4 C26 4 29 6.5 29 10.5 C29 15.5 25 21 16 28 Z"); depth: 6; scale: 0.04; translate: 1.6 0 0; color: #3a7bff; }`;

  for (const [backend, name] of BACKENDS)
    it(`blends only the silhouettes, with no ghost around the path, with ${name}`, async () => {
      const { ring, blended, ghosts } = await edges(brace, backend, 240, 135, [17, 17, 17]);
      expect(ghosts).toBe(0);
      expect(blended).toBeGreaterThan(ring / 4);
    }, 60000);
});

// A pixel is t × pixelSize wide: on a canvas of 3840 × 2160 (a 4K screen, or dpr 2 on a
// Retina screen), four times less than at 960 × 540, and a ray that grazes the sphere takes
// twice as many steps to pass it. The share of the silhouette that is blended must not fall
// with the size of the canvas. (The silhouette of auto is no reference there: a ray that runs
// out of steps beside the sphere counts as a hit, and makes it a pixel wider.)
describe("geometricPrecision on a large canvas", () => {
  const ball = `@scene { sphere; }
scene { floor: none; background: #000000; ambient: 1; light: none; camera-distance: 8; camera-angle: 0deg 0deg; camera-target: 0 0 0; dpr: 1; shape-rendering: SHAPE; }
sphere { radius: 1.1; color: #ffffff; }`;

  for (const [backend, name] of BACKENDS)
    it(`blends as much of the silhouette at 3840 × 2160 as at 960 × 540, with ${name}`, async () => {
      const small = await edges(ball, backend, 960, 540, [0, 0, 0]);
      const large = await edges(ball, backend, 3840, 2160, [0, 0, 0]);
      expect(small.ghosts).toBe(0);
      expect(large.ghosts).toBe(0);
      expect(small.partial / small.ring).toBeGreaterThan(0.4);
      expect(large.partial / large.ring).toBeGreaterThan(0.9 * (small.partial / small.ring));
    }, 120000);
});

// Small objects on a bigger one (the eyes of a face) do not take blended pixels from its
// own silhouette
describe("geometricPrecision with small objects on a sphere", () => {
  const face = (eyes: string) => `@scene { group#g { sphere#big; ${eyes} } }
scene { floor: none; background: #000000; ambient: 1; light: none; camera-distance: 8; camera-angle: 0deg 0deg; camera-target: 0 0 0; dpr: 1; shape-rendering: SHAPE; }
#g { scale: 2.2; }
#big { radius: 0.5; color: #ffffff; }
capsule { radius: 0.055; height: 0.2; color: #ff0000; }
#a { translate: -0.15 0.08 0.475; }
#b { translate: 0.15 0.08 0.475; }`;

  for (const [backend, name] of BACKENDS)
    it(`blends the silhouette of the sphere as much with them as without, with ${name}`, async () => {
      const alone = await edges(face(""), backend, 480, 270, [0, 0, 0]);
      const withEyes = await edges(face("capsule#a; capsule#b;"), backend, 480, 270, [0, 0, 0]);
      expect(alone.blended).toBeGreaterThan(alone.ring / 2);
      expect(withEyes.blended).toBeGreaterThanOrEqual(alone.blended - 4);
    }, 60000);
});
