// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { connectArchiveView } from "./archive-view";
import { renderArchiveHtml } from "./prerender";
import { ARCHIVE } from "./archive";

// The archive shows its scenes as a grid or a list (decision 172); the reader's choice is
// kept for the next visit, and a missing capture gives way to the code.

function mountArchive(): HTMLElement {
  document.body.innerHTML = `<div class="archive" id="scenes" data-view="grid">${renderArchiveHtml(
    ARCHIVE.slice(0, 3).map((entry) => ({ entry, href: "#" })),
  )}</div>`;
  const root = document.querySelector<HTMLElement>("#scenes")!;
  connectArchiveView(root);
  return root;
}
const button = (view: string) => document.querySelector<HTMLButtonElement>(`.views [data-view="${view}"]`)!;

describe("the archive view", () => {
  beforeEach(() => localStorage.clear());

  it("switches between the grid and the list, and says which is on", () => {
    const root = mountArchive();
    button("list").click();
    expect(root.dataset.view).toBe("list");
    expect(button("list").getAttribute("aria-pressed")).toBe("true");
    expect(button("grid").getAttribute("aria-pressed")).toBe("false");
    button("grid").click();
    expect(root.dataset.view).toBe("grid");
  });

  it("keeps the choice for the next visit", () => {
    mountArchive();
    button("list").click();
    const root = mountArchive();
    expect(root.dataset.view).toBe("list");
    expect(button("list").getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the code of a scene without a capture", () => {
    const root = mountArchive();
    const img = root.querySelector("img")!;
    img.dispatchEvent(new Event("error"));
    expect(img.isConnected).toBe(false);
    expect(root.querySelector<HTMLElement>(".fallback")!.hidden).toBe(false);
  });
});
