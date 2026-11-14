import { afterAll, beforeAll, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";
let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "gpu-test-page",
    configureServer(server) {
      server.middlewares.use("/__gpu", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end('<html><body style="margin:0"><script type="module">import { createViewAsync } from "/src/runtime/backend.ts"; import { mountAsync } from "/src/embed/runtime.ts"; import "/src/embed/element.ts"; window.__createViewAsync = createViewAsync; window.__mountAsync = mountAsync; window.__drawAnyway = (element) => new Promise((resolve) => { const look = () => { const play = element.shadowRoot.querySelector("[part=play]"); if (play.closest("[hidden]")) return requestAnimationFrame(look); play.click(); resolve(); }; look(); });</script></body></html>'); });
    },
  }] });
  await server.listen();
    browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  page.on("console", message => { if (message.type() === "error") console.error(message.text()); });
  await page.goto(`${server.resolvedUrls!.local[0]}__gpu`);
  await page.waitForFunction(() => (window as any).__createViewAsync);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

async function render(source: string, hover = false) {
  return page.evaluate(async ({ compiled, hover }) => {
    const createViewAsync = (window as any).__createViewAsync;
    async function capture(backend: string) {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:96px;height:72px;display:block";
      document.body.append(canvas);
      // A probe that measures: every frame is drawn, so the canvas can be read in the frame
      // that drew it (a resting scene draws nothing, decision 134, and its canvas reads empty)
      const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
      const view = await createViewAsync(canvas, { backend, adaptDpr: false, profile: () => probe, profileWebGPU: () => probe });
      // not frozen: the transitions glide (frozen, every change is instant)
      await view.show(compiled);
      if (hover) {
        const box = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: box.left + 48, clientY: box.top + 36 }));
      }
      await new Promise<void>(resolve => {
        let left = hover ? 12 : 3;
        const tick = () => --left ? requestAnimationFrame(tick) : resolve();
        requestAnimationFrame(tick);
      });
      const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
      const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
      const pixels = [...ctx.getImageData(0, 0, copy.width, copy.height).data];
      view.destroy(); canvas.remove();
      return pixels;
    }
    return { gl: await capture("webgl"), gpu: await capture("webgpu") };
  }, { compiled: compileScene(source), hover });
}

// A transition per property: under the mouse, the sphere grows at once while its color
// takes 100 s, on both backends. Its color reads a @property, after the numbers of uHover[]
// in the uniforms: a wrong place there would not draw it red.
it("each property glides with its own transition", async () => {
  const source = `@property --tint { syntax: "<color>"; inherits: false; initial-value: #ff0000; }
    @scene { sphere; } scene { camera-angle: 0deg 0deg; camera-distance: 5; camera-target: 0 0 0; floor: none; ambient: 1; }
    sphere { radius: 0.5; color: var(--tint); transition: color 100s linear, scale 0s; } sphere:hover { scale: 2; color: #00ff00; }`;
  const red = (pixels: number[]) => pixels.filter((_, i) => i % 4 === 0 && pixels[i] > pixels[i + 1] + 60).length;
  const rest = await render(source);
  const hovered = await render(source, true);
  for (const backend of ["gl", "gpu"] as const) {
    expect(red(rest[backend]), `${backend} at rest`).toBeGreaterThan(50);
    expect(red(hovered[backend]), `${backend} hovered`).toBeGreaterThan(red(rest[backend]) * 2.5);
  }
}, 60000);
