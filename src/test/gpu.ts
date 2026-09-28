// Compiles shaders in a real browser, for the tests.
// Node has no GPU: Playwright opens a headless Chromium and we ask it.
import { chromium, type Browser, type Page } from "playwright";

let browser: Browser | null = null;
let page: Page | null = null;

// Opens the browser the first time, then always gives the same page back.
// Opening Chromium takes about a second: once for all the tests is enough.
async function getPage(): Promise<Page> {
  if (page) return page;
  // SwiftShader: WebGL computed on the CPU. Slower, but the same on every
  // machine, so the tests never depend on your graphics card.
  browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  page = await browser.newPage();
  await page.setContent("<canvas></canvas>");
  return page;
}

// Compiles a fragment shader on the GPU.
// Returns the error log, or "" when the shader compiles.
export async function compileOnGpu(source: string): Promise<string> {
  const p = await getPage();
  // Everything inside evaluate() runs IN THE BROWSER, not in Node:
  // it only sees what we pass to it (here: source, received as src).
  return p.evaluate((src) => {
    const gl = document.querySelector("canvas")!.getContext("webgl2")!;
    const shader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS); // ← did it compile?
    const log = ok ? "" : (gl.getShaderInfoLog(shader) ?? "Unknown error");
    gl.deleteShader(shader);
    return log;
  }, source); // ← what we send to the browser
}

// Closes the browser at the end of the tests
export async function closeGpu(): Promise<void> {
  await browser?.close();
  browser = null;
  page = null;
}
