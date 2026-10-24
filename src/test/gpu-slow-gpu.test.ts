import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// @gpu (slow) in the render (decision 212), in a real Chromium. SwiftShader draws WebGL on
// the CPU, which GSS reads as a machine without a GPU, slow from the start. The page /__gpu
// hides it, so GSS sees a GPU and waits for the frames: on a large canvas, a heavy scene takes
// about 400 ms a frame there, like a weak GPU on a big screen.
const page = (gpu: boolean) => `<html><body style="margin:0"><script type="module">
${gpu ? `const getContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, options) {
  return getContext.call(this, type, options && { ...options, failIfMajorPerformanceCaveat: false });
};
const getParameter = WebGL2RenderingContext.prototype.getParameter;
WebGL2RenderingContext.prototype.getParameter = function (name) {
  return name === 0x9246 ? "Test GPU" : getParameter.call(this, name);
};` : ""}
import { mountAsync } from "/src/embed/runtime.ts";
window.__mountAsync = mountAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let withGpu: Page;
let withoutGpu: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "gpu-slow-page",
    configureServer(server) {
      server.middlewares.use("/__gpu", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(page(true)); });
      server.middlewares.use("/__software", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(page(false)); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const open = async (path: string) => {
    const tab = await browser.newPage();
    tab.on("pageerror", error => console.error(error.message));
    await tab.goto(`${server.resolvedUrls!.local[0]}${path}`);
    await tab.waitForFunction(() => (window as any).__mountAsync);
    return tab;
  };
  withGpu = await open("__gpu");
  withoutGpu = await open("__software");
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

// The lighter version paints the background red, at the corner of the render
const LIGHTER = "@gpu (slow) { scene { background: #ff0000; } sphere { display: none; } }";
const simple = compileScene(`@scene { sphere; } scene { floor: none; background: #000000; } ${LIGHTER}`);
// Cheap to compile, slow to draw (the scene of the heavy test): glass on glass in soft shadows
const heavy = (lighter: string) => compileScene(`@scene { sphere * 40; }
scene { shadows: soft; floor: #333; background: #000000; camera-spin: 20s; }
sphere { material: glass(1.5, frosted 0.3); radius: 0.3;
  translate: calc(sin(sibling-index() * 1.7) * 2) calc(cos(sibling-index() * 2.3) * 1 + 1) calc(sin(sibling-index() * 3.1) * 2); } ${lighter}`);

// Mounts the scene on a canvas of this size, then reads the red of the corner every 250 ms
// over `ms`, and whether the scene said it was too heavy
async function run(tab: Page, compiled: unknown, options: Record<string, unknown>, size: [number, number], ms: number) {
  return tab.evaluate(async ({ compiled, options, size, ms }) => {
    document.body.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `width:${size[0]}px;height:${size[1]}px;display:block`;
    document.body.append(canvas);
    let tooHeavy = false;
    canvas.addEventListener("gss-too-heavy", () => (tooHeavy = true));
    // A profiler draws every frame: the canvas is read while it is drawn
    const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
    const scene = await (window as any).__mountAsync(canvas, compiled, { ...options, profile: () => probe, profileWebGPU: () => probe });
    const reds: number[] = [];
    for (let t = 0; t < ms; t += 250) {
      await new Promise(resolve => setTimeout(resolve, 250));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
      const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
      reds.push(ctx.getImageData(1, 1, 1, 1).data[0]);
    }
    scene.destroy(); canvas.remove();
    return { reds, tooHeavy };
  }, { compiled, options, size, ms });
}

describe("@gpu (slow)", () => {
  for (const backend of ["webgl", "webgpu"] as const) {
    it(`shows the lighter version when the page asks for it, with ${backend === "webgl" ? "WebGL2" : "WebGPU"}`, async () => {
      const forced = await run(withGpu, simple, { backend, gpu: "slow", adaptDpr: false }, [200, 120], 500);
      expect(forced.reds.at(-1)).toBeGreaterThan(200);
      const full = await run(withGpu, simple, { backend, adaptDpr: false }, [200, 120], 500);
      expect(full.reds.at(-1)).toBeLessThan(40);
    }, 60000);
  }

  it("shows the lighter version from the start without a GPU", async () => {
    const { reds } = await run(withoutGpu, simple, { backend: "webgl", adaptDpr: false }, [200, 120], 500);
    expect(reds[0]).toBeGreaterThan(200);
  }, 60000);

  it("goes to the lighter version once the frames stay slow, instead of stopping", async () => {
    const { reds, tooHeavy } = await run(withGpu, heavy(LIGHTER), { backend: "webgl" }, [1600, 1000], 6000);
    expect(reds[0]).toBeLessThan(40); // the full scene first
    expect(reds.at(-1)).toBeGreaterThan(200);
    expect(tooHeavy).toBe(false);
  }, 60000);

  it("a scene without it keeps its full version, slow frames or not", async () => {
    const { reds } = await run(withGpu, heavy(""), { backend: "webgl" }, [1600, 1000], 6000);
    expect(reds.at(-1)).toBeLessThan(40);
  }, 60000);
});
