import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { prerenderBrandHtml, iconFileName } from "./prerender";
import { DOC_GROUPS } from "../docs/navigation";
import { navIconFile, navIconMotion } from "../docs/nav-icons";

describe("prerenderBrandHtml", () => {
  const html = prerenderBrandHtml(readFileSync("brand.html", "utf8"));

  it("shows every icon of the docs sidebar, under its name", () => {
    expect(html.match(/<figure class="tile doc-icon"/g)).toHaveLength(DOC_GROUPS.length);
    for (const group of DOC_GROUPS) expect(html).toContain(`<span class="name">${group.title}</span>`);
  });

  it("offers each icon as a file to download, named after its group", () => {
    for (const group of DOC_GROUPS) {
      const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(navIconFile(group.id))}`;
      expect(html).toContain(`href="${href}" download="${iconFileName(group.title)}"`);
    }
    expect(iconFileName("Variables and conditions")).toBe("docs-variables-and-conditions.svg");
    expect(iconFileName("At-rules")).toBe("docs-at-rules.svg");
  });

  it("plays the motion of an icon when the pointer is over its tile", () => {
    expect(html).toContain(`<style>${navIconMotion(".doc-icon:hover")}</style>`);
  });

  it("needs the place of the icons in the page", () => {
    expect(() => prerenderBrandHtml("<main></main>")).toThrow(/doc-icons/);
  });
});
