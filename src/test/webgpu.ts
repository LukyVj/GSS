import { chromium, type Browser, type Page } from "playwright";
let browser: Browser | null = null;
let page: Page | null = null;
async function getPage() {
  if (page) return page;
  browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  page = await browser.newPage();
  await page.route("http://localhost/**", route => route.fulfill({ contentType: "text/html", body: "<canvas></canvas>" }));
  await page.goto("http://localhost/");
  await page.evaluate(async () => {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) throw new Error("WebGPU adapter unavailable in test browser");
    (window as any).__gpu = await adapter.requestDevice();
  });
  return page;
}
export async function compileOnWebGPU(source: string): Promise<string> {
  const p = await getPage();
  return p.evaluate(async code => {
    const device: GPUDevice = (window as any).__gpu;
    device.pushErrorScope("validation");
    const module = device.createShaderModule({ code });
    const info = await module.getCompilationInfo();
    const messages = info.messages.filter(m => m.type === "error").map(m => `${m.lineNum}:${m.linePos} ${m.message}`);
    if (!messages.length) {
      try {
        await device.createRenderPipelineAsync({ layout: "auto", vertex: { module, entryPoint: "vertexMain" }, fragment: { module, entryPoint: "fragmentMain", targets: [{ format: "rgba8unorm" }] } });
      } catch (error) { messages.push(String(error)); }
    }
    const scoped = await device.popErrorScope();
    if (scoped && !messages.length) messages.push(scoped.message);
    return messages.join("\n");
  }, source);
}
export async function closeWebGPU() { await browser?.close(); browser = null; page = null; }
