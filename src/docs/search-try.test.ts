// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRY, tryLayout, trySearchExample } from "./search-try";

describe("the room beside the search for a live example", () => {
  it("leaves the search as it is on a wide screen, the playground beside it, 16px apart", () => {
    const layout = tryLayout({ viewport: 1920, modal: 1120, results: 588 })!;
    expect(layout.modal).toBe(1120);
    expect(layout.panel).toBe(1920 - 2 * TRY.margin - TRY.gap - 1120);
    expect(layout.left + layout.modal + TRY.gap + layout.panel + layout.left).toBe(1920);
  });

  it("narrows only the results when it must, never under their smallest width", () => {
    const layout = tryLayout({ viewport: 1440, modal: 1120, results: 588 })!;
    expect(layout.modal).toBe(1120 - 588 + TRY.resultsMin);
    expect(layout.panel).toBeGreaterThanOrEqual(TRY.panelMin);
    expect(layout.left + layout.modal + TRY.gap + layout.panel).toBeLessThanOrEqual(1440 - TRY.margin);
  });

  it("does not grow the playground without end on a very wide screen", () => {
    const layout = tryLayout({ viewport: 3000, modal: 1120, results: 588 })!;
    expect(layout.panel).toBe(TRY.panelMax);
    expect(layout.left * 2 + layout.modal + TRY.gap + layout.panel).toBe(3000);
  });

  it("gives up when both cannot fit", () => {
    expect(tryLayout({ viewport: 1280, modal: 1120, results: 588 })).toBeNull();
    expect(tryLayout({ viewport: 900, modal: 836, results: 556 })).toBeNull();
  });
});

describe("Try it in the search", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="DocSearch-Container"><div class="DocSearch-Modal"></div></div>';
  });

  it("opens the playground in a new tab when the screen is too narrow, with the code and its HTML", async () => {
    const tab = { location: { href: "" }, opener: {} as unknown };
    const openWindow = vi.fn(() => tab as unknown as Window);
    const load = vi.fn();
    await trySearchExample(document.querySelector(".DocSearch-Modal")!, "@scene { sphere; }", "<p id=a>a</p>", { viewport: () => 1024, openWindow, load });
    expect(openWindow).toHaveBeenCalledOnce();
    expect(tab.location.href).toMatch(/^\.\/playground\.html#code=.+&html=.+/);
    expect(tab.opener).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("opens the live panel beside the search when there is room, and puts it back when it closes", async () => {
    let close = () => {};
    const openPanel = vi.fn((place: (panel: HTMLElement) => void, _code: string, _html?: string, onClose?: () => void) => {
      const panel = document.createElement("div");
      panel.className = "playground";
      panel.innerHTML = '<div class="playground-bar"></div>';
      place(panel);
      close = () => {
        panel.remove();
        onClose?.();
      };
      return panel;
    });
    const modal = document.querySelector<HTMLElement>(".DocSearch-Modal")!;
    const container = modal.parentElement!;
    await trySearchExample(modal, "@scene { sphere; }", "", {
      viewport: () => 1920,
      measure: () => ({ modal: 1120, results: 588, top: 60, height: 680 }),
      load: async () => ({ openPanel, closePlayground: () => close() }),
    });
    expect(openPanel).toHaveBeenCalledOnce();
    const panel = container.querySelector<HTMLElement>(".playground.gss-search-try-panel")!;
    expect(container.hasAttribute("data-gss-try")).toBe(true);
    expect(modal.style.getPropertyValue("--gss-try-modal")).toBe("1120px");
    expect(panel.style.width).toBe(`${1920 - 2 * TRY.margin - TRY.gap - 1120}px`);
    expect(panel.style.left).toBe(`${TRY.margin + 1120 + TRY.gap}px`);
    expect(panel.querySelector("button.gss-search-try-close")).not.toBeNull();

    panel.querySelector<HTMLButtonElement>("button.gss-search-try-close")!.click();
    expect(container.hasAttribute("data-gss-try")).toBe(false);
    expect(modal.style.getPropertyValue("--gss-try-modal")).toBe("");
    expect(container.querySelector(".playground")).toBeNull();
  });
});
