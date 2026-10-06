import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// A GPU too slow for the scene (decision 142). SwiftShader draws WebGL on the CPU: a large
// canvas of a heavy scene takes about 400 ms a frame there, like a weak GPU on a big screen.
let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "heavy-test-page",
    configureServer(server) {
      server.middlewares.use("/__heavy", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end('<html><body style="margin:0"><script type="module">import { createView } from "/src/runtime/view.ts"; import { sleepOffscreen } from "/src/runtime/offscreen.ts"; window.__createView = createView; window.__sleepOffscreen = sleepOffscreen;</script></body></html>'); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__heavy`);
  await page.waitForFunction(() => (window as any).__createView);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

// Cheap to compile, slow to draw: glass on glass in soft shadows, on a large canvas, turning
// (a still scene draws only when something changes)
const heavy = compileScene(`@scene { sphere * 40; }
scene { shadows: soft; floor: #333; camera-spin: 20s; }
sphere { material: glass(1.5, frosted 0.3); radius: 0.3;
  translate: calc(sin(sibling-index() * 1.7) * 2) calc(cos(sibling-index() * 2.3) * 1 + 1) calc(sin(sibling-index() * 3.1) * 2); }`);
const light = compileScene("@scene { sphere; } scene { background: #000; }");
const moving = compileScene("@scene { sphere; } scene { background: #000; camera-spin: 10s; }");

// Mounts a view on a canvas of this CSS size, then reports what happened over `ms`
// Stops early once it is too heavy, or once it draws at `full` pixels wide
async function watch(compiled: unknown, width: number, height: number, ms: number, full = Infinity) {
  return page.evaluate(async ({ compiled, width, height, ms, full }) => {
    document.body.innerHTML = "";
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `display:block;width:${width}px;height:${height}px`;
    document.body.append(canvas);
    const view = (window as any).__createView(canvas, { controls: false });
    const widths: number[] = [];
    let heavyAt = -1;
    const start = performance.now();
    canvas.addEventListener("gss-too-heavy", () => { heavyAt = performance.now() - start; });
    view.show(compiled);
    while (performance.now() - start < ms && heavyAt < 0 && widths.at(-1) !== full) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (widths.at(-1) !== canvas.width) widths.push(canvas.width);
    }
    const gl = canvas.getContext("webgl2")!;
    let draws = 0;
    const draw = gl.drawArrays.bind(gl);
    gl.drawArrays = (...args: Parameters<typeof draw>) => { draws++; draw(...args); };
    await new Promise(resolve => setTimeout(resolve, 600));
    view.destroy();
    return { widths, heavyAt, drawsAfter: draws };
  }, { compiled, width, height, ms, full });
}

describe("a scene on a GPU too slow for it (decision 142)", () => {
  it("has no dpr menu: only the docs and the playground ask for one", async () => {
    const menus = await page.evaluate(() => {
      document.body.innerHTML = "<div><canvas></canvas></div>";
      const view = (window as any).__createView(document.querySelector("canvas"), { controls: false });
      const count = document.querySelectorAll(".gss-dpr").length;
      view.destroy();
      return count;
    });
    expect(menus).toBe(0);
  });

  it("starts at half its ratio, and climbs to it when the GPU keeps up", async () => {
    const { widths, heavyAt } = await watch(light, 40, 30, 15000, 40);
    expect(widths[0]).toBe(20);
    expect(widths.at(-1)).toBe(40);
    expect(heavyAt).toBe(-1);
  }, 30000);

  it("stops, says so with gss-too-heavy, and draws nothing more", async () => {
    const { widths, heavyAt, drawsAfter } = await watch(heavy, 3200, 2000, 50000);
    expect(widths).toEqual([1600]); // never a frame at its full ratio
    expect(heavyAt).toBeGreaterThan(0);
    expect(drawsAfter).toBe(0);
  }, 90000);
});

// The live demo of the home page and the Try it of the docs scroll with their page
describe("a scene scrolled away (sleepOffscreen)", () => {
  it("draws on screen, nothing off screen, and again back on screen", async () => {
    const draws = await page.evaluate(async (compiled) => {
      document.body.innerHTML = '<canvas style="display:block;width:80px;height:60px"></canvas><div style="height:3000px"></div>';
      const canvas = document.querySelector("canvas")!;
      const view = (window as any).__createView(canvas, { controls: false, adaptDpr: false });
      (window as any).__sleepOffscreen(canvas, view);
      view.show(compiled);
      const gl = canvas.getContext("webgl2")!;
      let count = 0;
      const draw = gl.drawArrays.bind(gl);
      gl.drawArrays = (...args: Parameters<typeof draw>) => { count++; draw(...args); };
      const over = async (ms: number) => {
        const before = count;
        await new Promise(resolve => setTimeout(resolve, ms));
        return count - before;
      };
      await over(1500); // the first frame, the compile
      const on = await over(500);
      window.scrollTo(0, 2000);
      await over(300); // the observer answers
      const off = await over(500);
      window.scrollTo(0, 0);
      await over(300);
      const back = await over(500);
      view.destroy();
      return { on, off, back };
    }, moving);
    expect(draws.on).toBeGreaterThan(3);
    expect(draws.off).toBe(0);
    expect(draws.back).toBeGreaterThan(3);
  }, 30000);
});
