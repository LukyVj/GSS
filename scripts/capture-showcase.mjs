// npm run captures: renders every scene of the showcase and writes public/showcase/<slug>.jpg:
// the inspiration grid (src/showcase/content.ts, INSPIRATION) at the size of a card, and
// the studies (STUDIES, by their key) at the size of the viewer, where they are the poster
// shown until the reader presses play. Run it after adding a scene; the grid shows the
// code of a scene without a capture.
//
// Vite serves the site (so the scenes are read by the real modules, ?raw included), and
// Playwright opens the Chrome of this computer, headless, on its graphics card: on
// SwiftShader, a scene now waits for a click (decision 137). GSS_CHROMIUM=/path/to/chrome
// picks another browser.
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const only = process.argv.slice(2); // npm run captures -- icons spiral circuit
const server = await createServer({
  logLevel: "error",
  server: { port: 5199 },
});
await server.listen();
const url = server.resolvedUrls.local[0];
const { INSPIRATION, STUDIES } = await server.ssrLoadModule("/src/showcase/content.ts");

const browser = await chromium.launch(
  process.env.GSS_CHROMIUM
    ? { executablePath: process.env.GSS_CHROMIUM, args: ["--ignore-gpu-blocklist"] }
    : { channel: "chrome", args: ["--ignore-gpu-blocklist"] },
);
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on("pageerror", (error) => console.error(error.message));
await page.goto(`${url}showcase.html`);
await mkdir("public/showcase", { recursive: true });

// One scene alone on the page, without controls: a card is 800 × 600 (4 / 3); a study is
// larger, the viewer is wide, and it has longer to settle (its film, its lights)
const scenes = [
  ...INSPIRATION.map(({ slug, code }) => ({ slug, code, width: 800, height: 600, wait: 1500 })),
  ...STUDIES.map(({ key, scene, webgl, capture }) => ({
    slug: key,
    code: scene,
    width: 1200,
    height: 900,
    wait: capture ?? 3000,
    backend: webgl ? "webgl" : undefined,
  })),
];

for (const { slug, code, width, height, wait, backend } of scenes) {
  if (only.length > 0 && !only.includes(slug)) continue;
  const error = await page.evaluate(
    async ({ source, width, height, wait, backend }) => {
      document.body.innerHTML = "";
      document.body.style.margin = "0";
      const scene = document.createElement("gss-scene");
      scene.setAttribute("controls", "none");
      if (backend) scene.setAttribute("backend", backend);
      scene.style.display = "block";
      scene.style.width = `${width}px`;
      scene.style.height = `${height}px`;
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
      await new Promise((resolve) => setTimeout(resolve, wait)); // images, a moment of animation
      scene.scene?.pause(); // the last frame stays on the canvas
      return result;
    },
    { source: code, width, height, wait, backend },
  );
  if (error) {
    console.error(`${slug}: ${error}`);
    process.exitCode = 1;
    continue;
  }
  // The page is the scene: a clip, not locator.screenshot(), which waits for a still element
  const image = await page.screenshot({
    type: "jpeg",
    quality: 85,
    clip: { x: 0, y: 0, width, height },
    timeout: 120_000,
  });
  await writeFile(`public/showcase/${slug}.jpg`, image);
  console.log(`public/showcase/${slug}.jpg`);
}

await browser.close();
await server.close();
