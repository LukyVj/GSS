import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// A WebGL2 scene compiles without blocking the page (decision 150): with
// KHR_parallel_shader_compile, the view links the program and asks whether it is ready
// once a frame, instead of waiting for the driver. The page below plays a slow driver: the
// program reads "not ready" (COMPLETION_STATUS_KHR) until the test says it is linked, and
// any question that would block on the link before that (LINK_STATUS, a uniform location)
// is written down.
const PAGE = `<html><body style="margin:0"><script type="module">
import { createView } from "/src/runtime/view.ts";
import "/src/embed/element.ts";
const COMPLETION = 0x91b1, LINK_STATUS = 0x8b82;
window.__linked = true;
window.__early = [];
const proto = WebGL2RenderingContext.prototype;
const getExtension = proto.getExtension;
proto.getExtension = function (name) {
  if (name === "KHR_parallel_shader_compile") return getExtension.call(this, name) ?? { COMPLETION_STATUS_KHR: COMPLETION };
  return getExtension.call(this, name);
};
const getProgramParameter = proto.getProgramParameter;
proto.getProgramParameter = function (program, name) {
  if (name === COMPLETION) return window.__linked && getProgramParameter.call(this, program, LINK_STATUS) !== null;
  if (name === LINK_STATUS && !window.__linked) window.__early.push("LINK_STATUS");
  return getProgramParameter.call(this, program, name);
};
const getUniformLocation = proto.getUniformLocation;
proto.getUniformLocation = function (program, name) {
  if (!window.__linked) window.__early.push(name);
  return getUniformLocation.call(this, program, name);
};
window.__createView = createView;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "parallel-compile-page",
    configureServer(server) {
      server.middlewares.use("/__parallel", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__parallel`);
  await page.waitForFunction(() => (window as any).__createView);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

const sphere = (color: string) =>
  compileScene(`@scene { sphere; } scene { floor: none; background: #000000; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 5; } sphere { radius: 1.5; color: ${color}; }`);

// In the page: a view in a small canvas, the pixel at its center after a few frames, and
// a switch that says when the slow driver has linked the program
const helpers = `
  window.__view = () => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:64px;height:48px;display:block";
    document.body.append(canvas);
    // A probe that measures: every frame is drawn, so the canvas can be read
    const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
    const view = window.__createView(canvas, { adaptDpr: false, profile: () => probe });
    view.freeze(true);
    return { canvas, view };
  };
  window.__center = async (canvas) => {
    await new Promise((resolve) => { let left = 4; const tick = () => --left ? requestAnimationFrame(tick) : resolve(); requestAnimationFrame(tick); });
    const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext("2d"); ctx.drawImage(canvas, 0, 0);
    return [...ctx.getImageData(copy.width >> 1, copy.height >> 1, 1, 1).data];
  };
`;
const red = ([r, g, b]: number[]) => r > 100 && g < 60 && b < 60;
const blue = ([r, g, b]: number[]) => b > 100 && r < 60 && g < 60;

describe("a WebGL2 scene compiles without blocking the page", () => {
  beforeAll(() => page.evaluate(helpers));

  it("draws the scene once the driver has linked it, without waiting for it before", async () => {
    const result = await page.evaluate(async (compiled) => {
      const w = window as any;
      w.__linked = false; w.__early = [];
      const { canvas, view } = w.__view();
      const shown = view.show(compiled);
      const before = await w.__center(canvas); // still compiling: nothing drawn
      w.__linked = true;
      await shown;
      const after = await w.__center(canvas);
      view.destroy(); canvas.remove();
      return { before, after, early: w.__early };
    }, sphere("red"));
    expect(result.early).toEqual([]);
    expect(red(result.before)).toBe(false);
    expect(red(result.after)).toBe(true);
  }, 60000);

  it("keeps the scene on screen until the next one is linked", async () => {
    const result = await page.evaluate(async ({ first, second }) => {
      const w = window as any;
      w.__linked = true;
      const { canvas, view } = w.__view();
      await view.show(first);
      w.__linked = false;
      const shown = view.show(second);
      const during = await w.__center(canvas);
      w.__linked = true;
      await shown;
      const after = await w.__center(canvas);
      view.destroy(); canvas.remove();
      return { during, after };
    }, { first: sphere("red"), second: sphere("blue") });
    expect(red(result.during)).toBe(true);
    expect(blue(result.after)).toBe(true);
  }, 60000);

  it("still throws a GLSL error at once, and keeps the scene on screen", async () => {
    const result = await page.evaluate(async (compiled) => {
      const w = window as any;
      w.__linked = true;
      const { canvas, view } = w.__view();
      await view.show(compiled);
      let message = "";
      try { view.show({ ...compiled, shader: compiled.shader.replace("void main() {", "void main() { nope;") }); }
      catch (error) { message = String(error); }
      const after = await w.__center(canvas);
      view.destroy(); canvas.remove();
      return { message, after };
    }, sphere("red"));
    expect(result.message).toMatch(/nope/);
    expect(red(result.after)).toBe(true);
  }, 60000);

  it("<gss-scene> keeps its poster, and fires load only once the scene is linked", async () => {
    const result = await page.evaluate(async () => {
      const w = window as any;
      w.__linked = false;
      const element = document.createElement("gss-scene");
      element.setAttribute("poster", "data:image/gif;base64,R0lGODlhAQABAAAAACw=");
      element.style.cssText = "display:block;width:64px;height:48px";
      element.innerHTML = '<script type="text/gss">@scene { sphere; } sphere { color: red; }</script>';
      let loaded = false;
      const load = new Promise<void>((resolve) => element.addEventListener("load", () => { loaded = true; resolve(); }));
      document.body.append(element);
      // SwiftShader draws on the processor: the scene waits for "Draw it anyway"
      await new Promise<void>((resolve) => {
        const look = () => {
          const play = element.shadowRoot?.querySelector<HTMLElement>("[part=play]");
          if (!play || play.closest("[hidden]")) return requestAnimationFrame(look);
          play.click(); resolve();
        };
        look();
      });
      const poster = () => !element.shadowRoot!.querySelector<HTMLElement>("[part=poster]")!.hidden;
      await new Promise((resolve) => setTimeout(resolve, 500)); // it compiled, the driver has not linked
      const waiting = { loaded, poster: poster() };
      w.__linked = true;
      await load;
      const done = { loaded, poster: poster() };
      element.remove();
      return { waiting, done };
    });
    expect(result.waiting).toEqual({ loaded: false, poster: true });
    expect(result.done).toEqual({ loaded: true, poster: false });
  }, 60000);
});
