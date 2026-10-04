// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountPanel, STORAGE_KEY } from "./panel";

// Decision 87: the panel is public, and closed until the visitor opens it

function mount() {
  document.body.innerHTML = '<div class="statusbar"></div>';
  mountPanel(document.querySelector<HTMLElement>(".statusbar")!);
  return {
    panel: document.querySelector<HTMLElement>(".perf-panel")!,
    toggle: document.querySelector<HTMLButtonElement>(".perf-toggle")!,
  };
}

describe("the performance panel", () => {
  beforeEach(() => localStorage.clear());

  it("is closed by default, and the default is not saved", () => {
    const { panel, toggle } = mount();
    expect(panel.hidden).toBe(true);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("opens with its button, and stays open on the next visit", () => {
    mount().toggle.click();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
    expect(mount().panel.hidden).toBe(false);
  });

  it("opens and closes with Alt+P", () => {
    const { panel } = mount();
    window.dispatchEvent(new KeyboardEvent("keydown", { altKey: true, code: "KeyP" }));
    expect(panel.hidden).toBe(false);
  });

  it('ignores the old "gss-perf" key, saved by every visit while it was open by default', () => {
    localStorage.setItem("gss-perf", "1");
    expect(mount().panel.hidden).toBe(true);
  });
});

// A fresh panel module for each test: its profiler lives at the module level
async function freshPanel() {
  vi.resetModules();
  return import("./panel");
}

// A WebGL context that counts what the GPU timer asks of it
function fakeGl() {
  const gl = { getExtension: vi.fn(() => null) };
  return gl as unknown as WebGL2RenderingContext & typeof gl;
}

describe("the profiler behind the panel", () => {
  beforeEach(() => localStorage.clear());

  it("measures nothing until the panel is first opened", async () => {
    const { profile, mountPanel } = await freshPanel();
    document.body.innerHTML = '<div class="statusbar"></div>';
    const gl = fakeGl();
    const probe = profile(gl);
    mountPanel(document.querySelector<HTMLElement>(".statusbar")!);
    probe.frameStart(0, 800, 600);
    probe.drawStart();
    probe.drawEnd();
    expect(gl.getExtension).not.toHaveBeenCalled(); // no GPU timer yet

    document.querySelector<HTMLButtonElement>(".perf-toggle")!.click();
    expect(gl.getExtension).toHaveBeenCalledTimes(1);
  });

  it("shows the shader build that happened before it opened", async () => {
    const { profile, mountPanel } = await freshPanel();
    document.body.innerHTML = '<div class="statusbar"></div>';
    profile(fakeGl()).shaderBuilt(42);
    mountPanel(document.querySelector<HTMLElement>(".statusbar")!);
    document.querySelector<HTMLButtonElement>(".perf-toggle")!.click();
    expect(document.querySelector(".perf-panel")!.textContent).toContain("42");
  });

  it("asks the scene to draw every frame only while the panel is open (decision 134)", async () => {
    const { profile, mountPanel } = await freshPanel();
    document.body.innerHTML = '<div class="statusbar"></div>';
    const probe = profile(fakeGl());
    mountPanel(document.querySelector<HTMLElement>(".statusbar")!);
    expect(probe.measuring?.()).toBe(false);
    const toggle = document.querySelector<HTMLButtonElement>(".perf-toggle")!;
    toggle.click();
    expect(probe.measuring?.()).toBe(true);
    toggle.click();
    expect(probe.measuring?.()).toBe(false);
  });

  it("starts at once when the panel was left open on the last visit", async () => {
    localStorage.setItem("gss-perf-panel", "1");
    const { profile, mountPanel } = await freshPanel();
    document.body.innerHTML = '<div class="statusbar"></div>';
    mountPanel(document.querySelector<HTMLElement>(".statusbar")!); // before the scene's context
    const gl = fakeGl();
    profile(gl);
    expect(gl.getExtension).toHaveBeenCalledTimes(1);
  });
});

