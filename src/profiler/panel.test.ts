// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
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
