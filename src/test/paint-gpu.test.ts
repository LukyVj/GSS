import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import { compileScene } from "../compiler";

// texture: paint(name) (decision 151): the fragment shader of a @paint is drawn into a
// texture, and the object samples it like an image. In a real Chromium.
const PAGE = `<html><body style="margin:0"><script type="module">
import { createView } from "/src/runtime/view.ts";
import { mountAsync } from "/src/embed/runtime.ts";
window.__createView = createView;
window.__mountAsync = mountAsync;
</script></body></html>`;

let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "paint-page",
    configureServer(server) {
      server.middlewares.use("/__paint", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.end(PAGE); });
    },
  }] });
  await server.listen();
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__paint`);
  await page.waitForFunction(() => (window as any).__createView);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

// A cube seen from the front, lit evenly: the pixel at the center is the color of its texture
const scene = (paint: string) =>
  `${paint} @scene { cube; } scene { floor: none; background: #000000; ambient: 1; light: none; camera-target: 0 0 0; camera-angle: 0deg 0deg; camera-distance: 4; } cube { size: 2; texture: paint(fill); }`;

// The color at the center of the canvas, a few frames after show()
async function center(source: string): Promise<number[]> {
  return page.evaluate(async (compiled) => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:64px;height:48px;display:block";
    document.body.append(canvas);
    const probe = { frameStart() {}, drawStart() {}, drawEnd() {}, shaderBuilt() {} };
    const view = (window as any).__createView(canvas, { adaptDpr: false, profile: () => probe });
    view.freeze(true);
    await view.show(compiled);
    await new Promise((resolve) => { let left = 4; const tick = () => --left ? requestAnimationFrame(tick) : resolve(0); requestAnimationFrame(tick); });
    const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
    const pixel = [...ctx.getImageData(copy.width >> 1, copy.height >> 1, 1, 1).data];
    view.destroy(); canvas.remove();
    return pixel;
  }, compileScene(source));
}

describe("texture: paint(name)", () => {
  it("draws a GLSL ES 3.00 shader on the object", async () => {
    const [r, g, b] = await center(scene("@paint fill { out vec4 color; void main() { color = vec4(1.0, 0.0, 0.0, 1.0); } }"));
    expect(r).toBeGreaterThan(150);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
  }, 60000);

  it("draws a GLSL ES 1.00 shader, with gl_FragColor, as written for WebGL1", async () => {
    const [r, g, b] = await center(scene("@paint fill { void main() { gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0); } }"));
    expect(b).toBeGreaterThan(150);
    expect(r).toBeLessThan(60);
    expect(g).toBeLessThan(60);
  }, 60000);

  it("fills resolution, and its u_ alias, with the size of the texture", async () => {
    const code = `@paint fill {
      precision highp float;
      uniform vec2 resolution;
      uniform vec2 u_resolution;
      out vec4 color;
      void main() { color = vec4(resolution.x == 512.0 ? 1.0 : 0.0, 0.0, u_resolution.y == 512.0 ? 1.0 : 0.0, 1.0); }
    }`;
    const [r, g, b] = await center(scene(code));
    expect(r).toBeGreaterThan(150);
    expect(g).toBeLessThan(60);
    expect(b).toBeGreaterThan(150);
  }, 60000);

  it("draws a shader that reads time again as the time goes on", async () => {
    const [first, second] = await page.evaluate(async (compiled) => {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:64px;height:48px;display:block";
      document.body.append(canvas);
      const view = (window as any).__createView(canvas, { adaptDpr: false });
      await view.show(compiled);
      // Read in the frame that draws: a moving scene draws at every frame
      const read = () => new Promise<number>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
        const ctx = copy.getContext("2d")!; ctx.drawImage(canvas, 0, 0);
        resolve(ctx.getImageData(copy.width >> 1, copy.height >> 1, 1, 1).data[0]);
      })));
      const first = await read();
      await new Promise((resolve) => setTimeout(resolve, 700));
      const second = await read();
      view.destroy(); canvas.remove();
      return [first, second];
    }, compileScene(scene("@paint fill { uniform float time; out vec4 color; void main() { color = vec4(fract(time), 0.0, 0.0, 1.0); } }")));
    expect(Math.abs(first - second)).toBeGreaterThan(20);
  }, 60000);

  it("throws the error of its GLSL at once, with the name of the @paint and its line in the file", async () => {
    const source = `@scene { cube; }\ncube { texture: paint(fill); }\n@paint fill {\n  out vec4 color;\n  void main() { color = nope; }\n}`;
    const message = await page.evaluate(async (compiled) => {
      const canvas = document.createElement("canvas");
      document.body.append(canvas);
      const view = (window as any).__createView(canvas, { adaptDpr: false });
      try { view.show(compiled); return "no error"; }
      catch (error) { return String(error); }
      finally { view.destroy(); canvas.remove(); }
    }, compileScene(source));
    expect(message).toMatch(/@paint fill/);
    expect(message).toMatch(/nope/);
    expect(message).toMatch(/line 5\b/); // "void main() { color = nope; }" is line 5 of the file
  }, 60000);

  it("is drawn with WebGL2 when the backend is auto, like element()", async () => {
    const backend = await page.evaluate(async (compiled) => {
      const canvas = document.createElement("canvas");
      document.body.append(canvas);
      const scene = await (window as any).__mountAsync(canvas, compiled, { adaptDpr: false });
      const used = scene.backend;
      scene.destroy(); canvas.remove();
      return used;
    }, compileScene(scene("@paint fill { out vec4 color; void main() { color = vec4(1.0); } }"), { target: "dual" }));
    expect(backend).toBe("webgl");
  }, 60000);
});
