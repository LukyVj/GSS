import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";

// A machine without a GPU: SwiftShader draws WebGL on the CPU, like Chrome does when it
// finds no graphics card. A scene would freeze the page there, so <gss-scene> waits for a click.
let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "software-test-page",
    configureServer(server) {
      server.middlewares.use("/__software", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end('<html><body style="margin:0"><script type="module">import { softwareRendering } from "/src/embed/runtime.ts"; import { softwareGate } from "/src/runtime/software-gate.ts"; import "/src/embed/element.ts"; window.__softwareRendering = softwareRendering; window.__softwareGate = softwareGate;</script></body></html>'); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__software`);
  await page.waitForFunction(() => (window as any).__softwareRendering);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

const POSTER = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

describe("a machine without a GPU", () => {
  it("is detected", async () => {
    expect(await page.evaluate(() => (window as any).__softwareRendering())).toBe(true);
  });

  it("<gss-scene> shows its poster and a button instead of drawing", async () => {
    const state = await page.evaluate(async poster => {
      document.body.innerHTML = `<gss-scene poster="${poster}" style="width:160px"><script type="text/gss">@scene { sphere; }</script></gss-scene>`;
      const element = document.querySelector("gss-scene")! as HTMLElement & { scene: unknown };
      await new Promise(resolve => setTimeout(resolve, 300));
      const root = element.shadowRoot!;
      const img = root.querySelector<HTMLImageElement>("[part=poster]")!;
      const button = root.querySelector<HTMLButtonElement>("[part=play]")!;
      return { scene: element.scene, poster: img.getAttribute("src"), posterShown: !img.hidden, button: !button.closest("[hidden]") && button.textContent };
    }, POSTER);
    expect(state).toEqual({ scene: null, poster: POSTER, posterShown: true, button: expect.stringMatching(/\S/) });
  });

  it("draws the scene after a click, and hides the poster", async () => {
    const state = await page.evaluate(async () => {
      const element = document.querySelector("gss-scene")! as HTMLElement & { scene: unknown };
      const root = element.shadowRoot!;
      const loaded = new Promise(resolve => element.addEventListener("load", resolve, { once: true }));
      root.querySelector<HTMLButtonElement>("[part=play]")!.click();
      await loaded;
      return { scene: element.scene !== null, posterShown: !root.querySelector<HTMLImageElement>("[part=poster]")!.hidden, gate: !!root.querySelector("[part=play]")!.closest("[hidden]") };
    });
    expect(state).toEqual({ scene: true, posterShown: false, gate: true });
  });

  // The pages of the site: the renderer is made and paused, a notice lies over its canvas
  it("the site pauses a render until the click, with a notice over its canvas", async () => {
    const state = await page.evaluate(async () => {
      document.body.innerHTML = '<link rel="stylesheet" href="/src/styles/site.css"><div style="position:relative;padding:20px"><canvas style="width:120px;height:80px;display:block"></canvas></div>';
      await new Promise(resolve => document.querySelector("link")!.addEventListener("load", resolve, { once: true }));
      const canvas = document.querySelector("canvas")!;
      const calls: string[] = [];
      (window as any).__softwareGate(canvas, { pause: () => calls.push("pause"), play: () => calls.push("play") });
      const gate = document.querySelector<HTMLElement>(".software-gate")!;
      const box = (element: Element) => { const r = element.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
      const before = { calls: [...calls], over: JSON.stringify(box(gate)) === JSON.stringify(box(canvas)) };
      gate.querySelector("button")!.click();
      return { before, after: { calls, gate: document.querySelector(".software-gate") === null } };
    });
    expect(state).toEqual({ before: { calls: ["pause"], over: true }, after: { calls: ["pause", "play"], gate: true } });
  });
});
