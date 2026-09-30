// npm run captures: renders every scene of the showcase's inspiration grid
// (src/showcase/content.ts, INSPIRATION) and writes public/showcase/<slug>.jpg.
// Run it after adding a scene; the grid shows the code of a scene without a capture.
//
// Vite serves the site (so the scenes are read by the real modules, ?raw included),
// Playwright opens a headless Chromium (SwiftShader, like the GPU tests) and
// photographs one <gss-scene> per scene. GSS_CHROMIUM=/path/to/chrome picks another browser.
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const only = process.argv.slice(2); // npm run captures -- icons spiral
const server = await createServer({
  logLevel: "error",
  server: { port: 5199 },
});
await server.listen();
const url = server.resolvedUrls.local[0];
const { INSPIRATION } = await server.ssrLoadModule("/src/showcase/content.ts");

const browser = await chromium.launch({
  executablePath: process.env.GSS_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on("pageerror", (error) => console.error(error.message));
await page.goto(`${url}showcase.html`);
await mkdir("public/showcase", { recursive: true });

for (const { slug, code } of INSPIRATION) {
  if (only.length > 0 && !only.includes(slug)) continue;
  // One scene alone on the page, the size of a card (4 / 3), without controls
  const error = await page.evaluate(async (source) => {
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    const scene = document.createElement("gss-scene");
    scene.setAttribute("controls", "none");
    scene.style.width = "800px";
    scene.style.height = "600px";
    const script = document.createElement("script");
    script.type = "text/gss";
    script.textContent = source;
    scene.append(script);
    const ready = new Promise((resolve) => {
      scene.addEventListener("load", () => resolve(""));
      scene.addEventListener("error", (event) => resolve(event.detail));
    });
    document.body.append(scene);
    const result = await ready;
    await new Promise((resolve) => setTimeout(resolve, 1500)); // images, a moment of animation
    scene.scene?.pause(); // the last frame stays on the canvas
    return result;
  }, code);
  if (error) {
    console.error(`${slug}: ${error}`);
    process.exitCode = 1;
    continue;
  }
  // The page is the scene: a clip, not locator.screenshot(), which waits for a still element
  const clip = { x: 0, y: 0, width: 800, height: 600 };
  const image = await page.screenshot({
    type: "jpeg",
    quality: 85,
    clip,
    timeout: 120_000,
  });
  await writeFile(`public/showcase/${slug}.jpg`, image);
  console.log(`public/showcase/${slug}.jpg`);
}

await browser.close();
await server.close();
