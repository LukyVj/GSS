// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { NAV_ICONS, NAV_ICON_MOTION, navIcon, navIconFile, navIconMotion } from "./nav-icons";
import { DOC_GROUPS } from "./navigation";
import { renderDocs } from "./render";
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";

describe("the icons of the docs sidebar", () => {
  it("gives every group an icon, and no icon without its group", () => {
    expect(Object.keys(NAV_ICONS).sort()).toEqual(DOC_GROUPS.map((group) => group.id).sort());
  });

  it("draws in currentColor only, with no id, so a page can hold them all", () => {
    for (const [id, body] of Object.entries(NAV_ICONS)) {
      expect(body, id).not.toMatch(/\bid=|#[0-9a-f]{3,8}\b|rgba?\(|url\(/i);
      expect(body, id).toMatch(/^<(path|circle|rect|ellipse|g)\b/);
    }
  });

  it("puts a decorative icon before the title of each group", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
    for (const group of DOC_GROUPS) {
      const summary = root.querySelector(`.toc-group[data-group="${group.id}"] > summary`)!;
      const icon = summary.firstElementChild!;
      expect(icon.tagName.toLowerCase(), group.id).toBe("svg");
      expect(icon.getAttribute("class"), group.id).toBe("toc-icon");
      expect(icon.getAttribute("aria-hidden"), group.id).toBe("true");
      expect(icon.children.length, group.id).toBeGreaterThan(0);
      expect(icon.nextElementSibling!.textContent, group.id).toBe(group.title);
    }
  });

  it("gives every icon a motion of its own", () => {
    expect(Object.keys(NAV_ICON_MOTION).sort()).toEqual(Object.keys(NAV_ICONS).sort());
    const motions = Object.values(NAV_ICON_MOTION).map((parts) => JSON.stringify(parts.map((part) => part.frames)));
    expect(new Set(motions).size).toBe(motions.length);
  });

  it("moves only parts the icon has", () => {
    for (const [id, parts] of Object.entries(NAV_ICON_MOTION)) {
      for (const part of parts) {
        const name = part.part?.match(/^\.(\w+)$/)?.[1];
        if (name) expect(NAV_ICONS[id], `${id} ${part.part}`).toContain(`class="${name}"`);
      }
    }
  });

  it("plays the motions on hover, only for people who accept motion", () => {
    const css = navIconMotion(".row:hover");
    expect(css).toMatch(/^@media \(prefers-reduced-motion: no-preference\) \{/);
    expect(css).toContain('.row:hover [data-icon="installation"] .m { animation: nav-installation-0 ');
    expect(css).toContain("@keyframes nav-installation-0 {");
    const root = document.createElement("div");
    root.innerHTML = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
    expect(root.innerHTML).toContain(navIconMotion(".toc-group > summary:is(:hover, :focus-visible)"));
    expect(root.querySelector(".toc-icon")!.getAttribute("data-icon")).toBe("getting-started");
  });

  it("lays a glint over the strokes of an icon, in the docs nav only", () => {
    const root = document.createElement("div");
    root.innerHTML = navIcon("colors", "toc-icon", true);
    const svg = root.querySelector("svg")!;
    const mask = svg.querySelector("mask#nav-glint-colors")!;
    expect(mask.querySelector(".glint-band")!.getAttribute("fill")).toBe("url(#nav-glint-colors-band)");
    expect(svg.querySelector("linearGradient#nav-glint-colors-band")).not.toBeNull();
    expect(navIcon("colors", "toc-icon", true)).toContain(`<g class="glint" mask="url(#nav-glint-colors)">${NAV_ICONS.colors}</g>`);
    expect(navIcon("colors")).not.toContain("glint");
    const docs = document.createElement("div");
    docs.innerHTML = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
    expect(docs.querySelector(".toc-icon g.glint")).not.toBeNull();
  });

  it("gives nothing for a group without an icon", () => {
    expect(navIcon("other-reference")).toBe("");
  });

  it("makes each icon a file of its own", () => {
    const file = navIconFile("materials");
    expect(file).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 16 16"/);
    expect(file).toContain(NAV_ICONS.materials);
    expect(file).not.toContain("aria-hidden");
  });
});
