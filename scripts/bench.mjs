// The GSS bench: is a change faster, slower, or does it draw something else?
//
//   npm run bench:compare -- main      bench main and the working tree, then compare
//   npm run bench                      bench the working tree only (bench-results/current)
//   npm run bench -- --ref main        bench another commit (bench-results/main)
//   node scripts/bench.mjs diff a b    compare two runs already in bench-results/
//
// Options: --scenes orrery,macropad   --seconds 4   --headless   --swiftshader
//
// For each scene, in a real Chromium:
//   - two images with time stopped at 0: mouse outside, then mouse over the middle (:hover)
//   - the profiler for --seconds, mouse outside then mouse over the middle
// Another commit is benched in a git worktree (.bench-worktrees/), with today's bench
// and profiler copied in: the same measuring tool on the old engine.
// The comparison goes to bench-results/compare.md (and the terminal); exit code 1 when
// a metric got worse beyond the noise, or one pixel changed.
//
// Timings only mean something on a real GPU, in a visible window (the default):
// keep the window in view while it runs, and the machine quiet.
import { createServer } from "vite";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import {
  mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, cpSync, symlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(".");
const RESULTS = join(REPO, "bench-results");
const DEFAULT_SCENES = ["orrery", "macropad", "todal", "scene", "spiral", "logo"];
const VIEW = { width: 960, height: 540, left: 40, top: 40 }; // the canvas in bench.html
const OUTSIDE = { x: 10, y: 10 }; // a point of the page outside the canvas
const MIDDLE = { x: VIEW.left + VIEW.width / 2, y: VIEW.top + VIEW.height / 2 };

// ----- Arguments -----
const argv = process.argv.slice(2);
const command = ["run", "compare", "diff"].includes(argv[0]) ? argv.shift() : "run";
const option = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const [value] = argv.splice(i, 2).slice(1);
  return value;
};
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return false;
  argv.splice(i, 1);
  return true;
};
const options = {
  scenes: option("scenes", DEFAULT_SCENES.join(",")).split(","),
  seconds: Number(option("seconds", "4")),
  ref: option("ref", null),
  swiftshader: flag("swiftshader"),
  headless: false,
};
options.headless = flag("headless") || options.swiftshader;

const git = (...args) => execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();
const safe = (ref) => ref.replace(/[^\w.-]+/g, "_");

// ----- Run the bench on a folder (the repo, or a worktree) -----
async function bench(root, label, ref) {
  const out = join(RESULTS, label);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const server = await createServer({ root, configFile: join(root, "vite.config.ts"), logLevel: "error", server: { port: 5210 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  const browser = await chromium.launch({
    headless: options.headless,
    executablePath: process.env.GSS_CHROMIUM || undefined,
    args: options.swiftshader
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
      : ["--ignore-gpu-blocklist", "--enable-privileged-webgl-extensions"],
  });
  const page = await browser.newPage({ viewport: { width: 1040, height: 620 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const open = async (query) => {
    await page.mouse.move(OUTSIDE.x, OUTSIDE.y);
    await page.goto(`${url}bench.html?${query}`);
    await page.waitForFunction(() => window.__bench?.ready);
    await page.waitForLoadState("networkidle"); // the images of the textures
    return page.evaluate(() => window.__bench.error);
  };
  const frames = (n) => page.evaluate((n) => window.__bench.frames(n), n);
  const measure = async (point) => {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(1000); // the hover settles, the GPU warms up
    await page.evaluate(() => window.__bench.reset());
    await page.waitForTimeout(options.seconds * 1000);
    return page.evaluate(() => window.__bench.report());
  };

  const report = { label, ref, date: new Date().toISOString(), renderer: "", userAgent: "", seconds: options.seconds, scenes: {} };
  for (const scene of options.scenes) {
    process.stdout.write(`  ${label}: ${scene} `);
    errors.length = 0;
    // 1. The images, time stopped
    let error = await open(`scene=${scene}&mode=still`);
    if (!error) {
      // A fixed clip, not the element: no wait for it to be "stable" between frames
      const shot = async () => {
        await page.evaluate(() => window.__bench.pause()); // the last frame stays on the canvas
        const png = await page.screenshot({ clip: { x: VIEW.left, y: VIEW.top, width: VIEW.width, height: VIEW.height } });
        await page.evaluate(() => window.__bench.play());
        return png;
      };
      await frames(30);
      writeFileSync(join(out, `${scene}.png`), await shot());
      await page.mouse.move(MIDDLE.x, MIDDLE.y);
      await frames(30); // the picked id comes back a frame or two later
      writeFileSync(join(out, `${scene}-hover.png`), await shot());
      process.stdout.write("· images ");
    }
    // 2. The timings, the scene alive
    error ||= await open(`scene=${scene}&mode=run`);
    if (error || errors.length > 0) {
      report.scenes[scene] = { error: error || errors.join("; ") };
      console.log(`· error: ${report.scenes[scene].error}`);
      continue;
    }
    const hoverOff = await measure(OUTSIDE);
    const hoverOn = await measure(MIDDLE);
    report.renderer = await page.evaluate(() => window.__bench.renderer());
    report.userAgent = await page.evaluate(() => navigator.userAgent);
    report.scenes[scene] = { shaderMs: hoverOn?.shaderMs ?? null, hoverOff: pick(hoverOff), hoverOn: pick(hoverOn) };
    console.log(`· timings`);
  }
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await server.close();
  return out;
}
const pick = (r) => ({ fps: r?.fps ?? null, frame: r?.frame ?? null, gpu: r?.gpu ?? null, cpu: r?.cpu ?? null });

// ----- Another commit, in a worktree, measured with today's bench -----
function worktree(ref) {
  const dir = join(REPO, ".bench-worktrees", safe(ref));
  if (existsSync(dir)) git("worktree", "remove", "--force", dir);
  git("worktree", "add", "--detach", dir, ref);
  symlinkSync(join(REPO, "node_modules"), join(dir, "node_modules"), "dir");
  for (const path of ["bench.html", "src/bench", "src/profiler"]) {
    cpSync(join(REPO, path), join(dir, path), { recursive: true, force: true });
  }
  return dir;
}

function currentRef() {
  const head = git("rev-parse", "--short", "HEAD");
  const dirty = git("status", "--porcelain", "--untracked-files=no") !== "";
  return dirty ? `${head}+changes` : head;
}

// ----- Compare two runs -----
async function compare(beforeLabel, afterLabel) {
  const server = await createServer({ root: REPO, logLevel: "error", server: { port: 5211 } });
  await server.listen();
  const lib = await server.ssrLoadModule("/src/bench/compare.ts");
  const read = (label) => JSON.parse(readFileSync(join(RESULTS, label, "report.json"), "utf8"));
  const before = read(beforeLabel);
  const after = read(afterLabel);
  const perf = lib.comparePerf(before, after);

  const browser = await chromium.launch({ headless: true, executablePath: process.env.GSS_CHROMIUM || undefined });
  const page = await browser.newPage();
  await page.goto(`${server.resolvedUrls.local[0]}bench.html?mode=diff`);
  await page.waitForFunction(() => window.__bench?.ready);
  const diffs = join(RESULTS, "diff");
  rmSync(diffs, { recursive: true, force: true });
  mkdirSync(diffs, { recursive: true });
  const dataUrl = (file) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;
  const visual = [];
  for (const image of readdirSync(join(RESULTS, beforeLabel)).filter((f) => f.endsWith(".png")).sort()) {
    const afterFile = join(RESULTS, afterLabel, image);
    if (!existsSync(afterFile)) {
      visual.push(lib.visualVerdict(image, null));
      continue;
    }
    const result = await page.evaluate(
      ([a, b]) => window.__bench.diff(a, b),
      [dataUrl(join(RESULTS, beforeLabel, image)), dataUrl(afterFile)],
    );
    if (result.png) writeFileSync(join(diffs, image), Buffer.from(result.png.split(",")[1], "base64"));
    visual.push(lib.visualVerdict(image, result));
  }
  await browser.close();
  await server.close();

  const markdown = lib.toMarkdown(before, after, perf, visual);
  writeFileSync(join(RESULTS, "compare.md"), markdown);
  console.log("\n" + markdown);
  console.log(`Images: bench-results/${beforeLabel}/ and bench-results/${afterLabel}/, differences in bench-results/diff/`);
  if (lib.hasRegression(perf, visual)) process.exitCode = 1;
}

// ----- Main -----
if (command === "diff") {
  await compare(argv[0], argv[1]);
} else if (command === "compare") {
  const ref = argv[0] ?? "main";
  console.log(`Bench ${ref} (worktree), then the working tree (${currentRef()})`);
  const dir = worktree(ref);
  try {
    await bench(dir, safe(ref), git("rev-parse", "--short", ref));
  } finally {
    git("worktree", "remove", "--force", dir);
  }
  await bench(REPO, "current", currentRef());
  await compare(safe(ref), "current");
} else if (options.ref) {
  const dir = worktree(options.ref);
  try {
    await bench(dir, safe(options.ref), git("rev-parse", "--short", options.ref));
  } finally {
    git("worktree", "remove", "--force", dir);
  }
} else {
  await bench(REPO, "current", currentRef());
}
