// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mountDebugPanel, debugRows } from "./debug-panel";
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
  it("counts the objects and the images, out of the 16 a scene takes", () => {
    expect(debugRows(compiled(""))).toEqual([
      { label: "objects", value: "2" },
      { label: "images", value: "2 / 16" },
    ]);
  });
});

describe("the debug panel", () => {
  it("is hidden without @debug-panel, or with display: none", () => {
    const debug = mountDebugPanel(document.body, perf);
    debug.update(compiled(""));
    expect(panel().hidden).toBe(true);
    debug.update(compiled("@debug-panel { display: none; }"));
    expect(panel().hidden).toBe(true);
    expect(watched).not.toContain(true);
  });

  it("shows the axes, the numbers of the scene, then the rows of the performance panel", () => {
    const debug = mountDebugPanel(document.body, perf);
    debug.update(compiled("@debug-panel { display: open; }"));
    expect(panel().hidden).toBe(false);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(labels()).toEqual(["axes", "objects", "images", "fps", "gpu"]);
    expect(values()).toEqual(["x y z", "2", "2 / 16", "60", "unavailable"]);
    expect(document.querySelector(".debug-panel dd.missing")?.textContent).toBe("unavailable");
  });

  it("measures while it is open, and not while it is folded or hidden", () => {
    const debug = mountDebugPanel(document.body, perf);
    debug.update(compiled("@debug-panel { display: open; }"));
    expect(watched).toEqual([true]);
    toggle().click();
    expect(watched).toEqual([true, false]);
    toggle().click();
    debug.update(compiled(""));
    expect(watched).toEqual([true, false, true, false]);
  });

  it("starts folded with display: folded, and the click holds until the code changes it", () => {
    const debug = mountDebugPanel(document.body, perf);
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
    const debug = mountDebugPanel(document.body, { rows: () => [{ label: "fps", value: fps }], watch: () => {} });
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
    expect(labels()).toEqual(["axes", "objects", "images"]);
  });
});
