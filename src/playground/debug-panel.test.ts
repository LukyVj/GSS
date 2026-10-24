// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mountDebugPanel, debugRows, cameraRows, stepsRows } from "./debug-panel";
import { compileScene } from "../compiler";
import type { Row } from "../profiler/format";

// The debug panel (decision 204): over the render of the playground and of Try it, when the
// scene asks for it with @debug-panel, the colors of the axes and the numbers of the scene, and
// in the playground the rows of the performance panel.

const SCENE = "@scene { cube; sphere; } cube { texture: url(\"a.png\"); } sphere { texture: url(\"b.png\"); }";
const compiled = (rules: string) => compileScene(`${rules} ${SCENE}`);

let watched: boolean[];
const perfRows: Row[] = [{ label: "fps", value: "60" }, { label: "gpu", value: "unavailable", missing: true }];
const perf = { rows: () => perfRows, watch: (on: boolean) => watched.push(on) };
const sources = { perf, backend: "webgl" as const, camera: () => ({ yaw: 0, pitch: 0.4, distance: 8 }), steps: () => null };
const panel = () => document.querySelector<HTMLElement>(".debug-panel")!;
const toggle = () => document.querySelector<HTMLButtonElement>(".debug-toggle")!;
const labels = () => [...document.querySelectorAll(".debug-panel dt")].map((dt) => dt.textContent);
const values = () => [...document.querySelectorAll(".debug-panel dd")].map((dd) => dd.textContent);

beforeEach(() => {
  document.body.innerHTML = "";
  watched = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("debugRows", () => {
  it("counts what the scene holds: objects, lights, images out of 16, and the size of its shader", () => {
    expect(debugRows(compiled(""), "webgl")).toEqual([
      { label: "objects", value: "2" },
      { label: "lights", value: "0" },
      { label: "images", value: "2 / 16" },
      { label: "glsl", value: `${compiled("").shader.split("\n").length} lines` },
    ]);
  });

  it("counts the lines of the WGSL on WebGPU", () => {
    const scene = compileScene(SCENE, { target: "dual" });
    expect(debugRows(scene, "webgpu").at(-1)).toEqual({ label: "wgsl", value: `${scene.wgsl!.split("\n").length} lines` });
  });

  it("names what only some scenes use, when they use it", () => {
    const rich = compileScene(
      '@property --a { syntax: "<number>"; inherits: false; initial-value: 1; } @scene { cube; light; } ' +
        "cube:hover { color: red; } cube:active { color: blue; } scene { filter: blur(1px); } " +
        "cube { animation: spin 1s linear infinite; animation-timeline: scroll(); } @keyframes spin { to { rotate-y: 1turn; } } " +
        "@media (max-width: 600px) { cube { color: green; } }",
    );
    const rows = Object.fromEntries(debugRows(rich, "webgl").map((row) => [row.label, row.value]));
    expect(rows).toMatchObject({ lights: "1", variables: "1", states: "hover 1 · active 1", timelines: "1", filters: "2 passes", media: "1 query" });
  });
});

describe("debugRows with @gpu", () => {
  it("says the scene has a lighter version, apart from its @media queries", () => {
    const rows = (code: string) => Object.fromEntries(debugRows(compileScene(code), "webgl").map((row) => [row.label, row.value]));
    const gpu = "@scene { cube; } @gpu (slow) { cube { color: green; } }";
    expect(rows(gpu)).toMatchObject({ gpu: "lighter version" });
    expect(rows(gpu).media).toBeUndefined();
    expect(rows(gpu + " @media (max-width: 600px) { cube { color: red; } }")).toMatchObject({ gpu: "lighter version", media: "1 query" });
  });
});

describe("cameraRows", () => {
  it("writes where the camera is as the GSS that puts it there", () => {
    expect(cameraRows({ yaw: Math.PI / 4, pitch: 0.4, distance: 8 })).toEqual([
      { label: "camera-angle", value: "45deg 22.9deg" },
      { label: "camera-distance", value: "8" },
    ]);
  });
});

describe("stepsRows", () => {
  it("gives the mean and the max of the steps, and the share at the top of the scale", () => {
    expect(stepsRows({ mean: 42.4, max: 150, hot: 0.031, pixels: 100 })).toEqual([
      { label: "steps", value: "mean 42 · max 150+" },
      { label: "150+", value: "3.1 % of pixels", warning: true },
    ]);
    expect(stepsRows({ mean: 12, max: 40, hot: 0, pixels: 100 })).toEqual([
      { label: "steps", value: "mean 12 · max 40" },
      { label: "150+", value: "0 % of pixels" },
    ]);
  });

  it("says where to read them before the view shows them", () => {
    expect(stepsRows(null)).toEqual([{ label: "steps", value: "view: steps", missing: true }]);
  });
});

describe("the debug panel", () => {
  it("is hidden without @debug-panel, or with display: none", () => {
    const debug = mountDebugPanel(document.body, sources);
    debug.update(compiled(""));
    expect(panel().hidden).toBe(true);
    debug.update(compiled("@debug-panel { display: none; }"));
    expect(panel().hidden).toBe(true);
    expect(watched).not.toContain(true);
  });

  it("shows the axes, the numbers of the scene, then the rows of the performance panel", () => {
    const debug = mountDebugPanel(document.body, sources);
    debug.update(compiled("@debug-panel { display: open; }"));
    expect(panel().hidden).toBe(false);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(labels()).toEqual(["axes", "backend", "camera-angle", "camera-distance", "objects", "lights", "images", "glsl", "steps", "fps", "gpu"]);
    expect(values().slice(0, 3)).toEqual(["x y z", "WebGL2", "0deg 22.9deg"]);
    expect(values().slice(-2)).toEqual(["60", "unavailable"]);
    expect([...document.querySelectorAll(".debug-panel dd.missing")].map((dd) => dd.textContent)).toEqual(["view: steps", "unavailable"]);
  });

  it("measures while it is open, and not while it is folded or hidden", () => {
    const debug = mountDebugPanel(document.body, sources);
    debug.update(compiled("@debug-panel { display: open; }"));
    expect(watched).toEqual([true]);
    toggle().click();
    expect(watched).toEqual([true, false]);
    toggle().click();
    debug.update(compiled(""));
    expect(watched).toEqual([true, false, true, false]);
  });

  it("starts folded with display: folded, and the click holds until the code changes it", () => {
    const debug = mountDebugPanel(document.body, sources);
    debug.update(compiled("@debug-panel { display: folded; }"));
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().textContent).toBe("debug");
    toggle().click();
    debug.update(compiled("@debug-panel { display: folded; }"));
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    debug.update(compiled("@debug-panel { display: open; }"));
    debug.update(compiled("@debug-panel { display: folded; }"));
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("refreshes the rows of the performance panel twice a second", () => {
    let fps = "60";
    const debug = mountDebugPanel(document.body, { perf: { rows: () => [{ label: "fps", value: fps }], watch: () => {} } });
    debug.update(compiled("@debug-panel { display: open; }"));
    fps = "30";
    vi.advanceTimersByTime(500);
    expect(values().at(-1)).toBe("30");
    debug.destroy();
    expect(panel()).toBeNull();
  });

  it("shows the numbers of the scene alone where there is no performance panel, like in the docs", () => {
    const debug = mountDebugPanel(document.body);
    debug.update(compiled("@debug-panel { display: open; }"));
    expect(labels()).toEqual(["axes", "objects", "lights", "images", "glsl"]);
  });
});
