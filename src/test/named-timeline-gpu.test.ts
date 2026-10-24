import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { chromium, type Browser, type Page } from "playwright";

// animation-timeline: --name in a real browser: the runtime finds the element of the page
// that declares the name in its style sheet, and follows it like CSS
let server: ViteDevServer;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  server = await createServer({ configFile: false, server: { host: "127.0.0.1", port: 0 }, logLevel: "error", plugins: [{
    name: "named-timeline-test-page",
    configureServer(server) {
      server.middlewares.use("/__named", (_req, res) => {
        res.setHeader("Content-Type", "text/html");
        res.end(`<html><head><style>
          body { margin: 0; }
          #part { height: 400px; margin-top: 2000px; view-timeline-name: --part; }
          #inset { height: 400px; view-timeline: --inset block; view-timeline-inset: 100px; }
          #box { height: 200px; overflow: auto; scroll-timeline: --box; }
          canvas { position: fixed; top: 0; width: 10px; height: 10px; }
        </style></head><body style="height:6000px">
          <canvas></canvas><div id="box"><div style="height:1200px"></div></div>
          <section id="part"></section><section id="inset"></section>
          <script type="module">import { timelineValues } from "/src/runtime/timeline.ts"; window.__timelineValues = timelineValues;</script>
        </body></html>`);
      });
    },
  }] });
  await server.listen();
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 400, height: 800 } });
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`${server.resolvedUrls!.local[0]}__named`);
  await page.waitForFunction(() => (window as any).__timelineValues);
}, 60000);
afterAll(async () => { await browser?.close(); await server?.close(); });

const progress = (timelines: unknown[], scroll: number, box = 0) =>
  page.evaluate(({ timelines, scroll, box }) => {
    window.scrollTo(0, scroll);
    document.querySelector("#box")!.scrollTop = box;
    const values = (window as any).__timelineValues(timelines, document.querySelector("canvas"), null);
    return [...values].slice(0, timelines.length).map((value: number) => Math.round(value * 1000) / 1000);
  }, { timelines, scroll, box });

describe("animation-timeline: --name", () => {
  it("follows the element of view-timeline-name across the page, not the scene", async () => {
    // #part starts at 2200px (the box is 200px high): it enters the 800px window at a
    // scroll of 1400px and has left at 2600px
    const part = [{ type: "named", name: "--part" }];
    expect(await progress(part, 1400)).toEqual([0]);
    expect(await progress(part, 2000)).toEqual([0.5]);
    expect(await progress(part, 2600)).toEqual([1]);
  });

  it("takes the named ranges on it", async () => {
    // contain: from 1800px (all of it in) to 2200px (it starts to leave)
    const part = [{ type: "named", name: "--part", range: { start: { name: "contain", offset: 0, unit: "%" }, end: { name: "contain", offset: 100, unit: "%" } } }];
    expect(await progress(part, 1800)).toEqual([0]);
    expect(await progress(part, 2000)).toEqual([0.5]);
  });

  it("reads view-timeline-inset", async () => {
    // #inset starts at 2600px; 100px off each side of the window: it enters at 1900px,
    // leaves at 2900px
    const inset = [{ type: "named", name: "--inset" }];
    expect(await progress(inset, 1900)).toEqual([0]);
    expect(await progress(inset, 2400)).toEqual([0.5]);
  });

  it("follows the scroll of the element of scroll-timeline-name", async () => {
    expect(await progress([{ type: "named", name: "--box" }], 0, 500)).toEqual([0.5]);
  });

  it("is before the timeline while no element declares the name: the animation does not apply, like CSS", async () => {
    expect(await progress([{ type: "named", name: "--nowhere" }], 2000)).toEqual([-1]);
  });
});
