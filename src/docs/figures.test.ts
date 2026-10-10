import { describe, it, expect } from "vitest";
import { renderFigure, FIGURES } from "./figures";
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";

// A drawing under the lead of a page (decision 180)
describe("the figures of the docs", () => {
  const entries = [...PROPERTIES, ...AT_RULES, ...SELECTORS, ...SHAPE_DOCS, ...FUNCTIONS];

  it("are all used by a page of the registry", () => {
    const used = new Set(entries.flatMap((entry) => (entry.figure ? [entry.figure] : [])));
    expect([...used].sort()).toEqual(Object.keys(FIGURES).sort());
  });

  it("show nothing for a page without a figure", () => {
    expect(renderFigure(undefined)).toBe("");
  });

  describe("shapes", () => {
    const html = renderFigure("shapes");

    it("is a list of everything a scene can declare, each one a link to its page", () => {
      const links = [...html.matchAll(/<li><a href="#shape-([\w-]+)">.*?<code>([\w-]+)<\/code><\/a><\/li>/gs)];
      expect(links.map(([, anchor]) => anchor)).toEqual(SHAPE_DOCS.map((shape) => shape.name));
      expect(links.every(([, anchor, label]) => anchor === label)).toBe(true);
    });

    it("draws each one as lines only, for the eye: the name says it to a screen reader", () => {
      expect((html.match(/<svg viewBox="0 0 120 120" aria-hidden="true">/g) ?? []).length).toBe(SHAPE_DOCS.length);
      expect(html).not.toContain("fill=");
      expect(html).toMatch(/^\s*<figure class="figure" aria-label="[^"]+">/);
    });

    it("is the same string each time: the page and its prerender agree", () => {
      expect(renderFigure("shapes")).toBe(html);
    });
  });
});
