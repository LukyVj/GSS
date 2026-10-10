import { describe, it, expect } from "vitest";
import { renderFigure, FIGURES } from "./figures";
import { GETTING_STARTED, INSTALLATION } from "./guide";
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";

// A drawing under the lead of a page (decision 180), some of them moving (decision 181)
describe("the figures of the docs", () => {
  const entries = [...PROPERTIES, ...AT_RULES, ...SELECTORS, ...SHAPE_DOCS, ...FUNCTIONS, ...GETTING_STARTED, ...INSTALLATION];

  it("are all used by a page", () => {
    const used = new Set(entries.flatMap((entry) => (entry.figure ? [entry.figure] : [])));
    expect([...used].sort()).toEqual(Object.keys(FIGURES).sort());
  });

  it("show nothing for a page without a figure", () => {
    expect(renderFigure(undefined)).toBe("");
  });

  it("are lines only, for the eye, under a label for a screen reader", () => {
    for (const name of Object.keys(FIGURES) as (keyof typeof FIGURES)[]) {
      const html = renderFigure(name, "cube");
      expect(html, name).toMatch(/^\s*<figure class="figure" aria-label="[^"]+">/);
      expect(html, name).not.toContain("fill=");
      const drawings = html.match(/<svg [^>]*>/g) ?? [];
      expect(drawings.length, name).toBeGreaterThan(0);
      for (const drawing of drawings) expect(drawing, name).toContain('aria-hidden="true"');
    }
  });

  it("are the same string each time: the page and its prerender agree", () => {
    for (const name of Object.keys(FIGURES) as (keyof typeof FIGURES)[]) {
      expect(renderFigure(name, "torus"), name).toBe(renderFigure(name, "torus"));
    }
  });

  describe("shapes", () => {
    const html = renderFigure("shapes");

    it("is a list of everything a scene can declare, each one a link to its page", () => {
      const links = [...html.matchAll(/<li[^>]*><a href="#shape-([\w-]+)">.*?<code>([\w-]+)<\/code><\/a><\/li>/gs)];
      expect(links.map(([, anchor]) => anchor)).toEqual(SHAPE_DOCS.map((shape) => shape.name));
      expect(links.every(([, anchor, label]) => anchor === label)).toBe(true);
    });

    it("says which shape each drawing is, for the script that turns it", () => {
      const turned = [...html.matchAll(/<svg viewBox="0 0 120 120"[^>]* data-turn="([\w-]+)" data-frame="62 60 60">/g)];
      expect(turned.map(([, name]) => name)).toEqual(SHAPE_DOCS.map((shape) => shape.name));
    });
  });

  describe("shape", () => {
    it("draws the shape of its page, with a line for each property that sizes it", () => {
      const html = renderFigure("shape", "cylinder");
      expect(html).toContain('data-turn="cylinder"');
      expect(html).toContain("data-measured");
      expect([...html.matchAll(/<text class="mark-label"[^>]*>(\w[\w-]*)<\/text>/g)].map(([, label]) => label)).toEqual(["radius", "height"]);
    });

    it("draws every page of a shape, a group and a light too", () => {
      for (const { name, figure } of SHAPE_DOCS) {
        expect(figure, name).toBe("shape");
        expect(renderFigure("shape", name), name).toContain(`data-turn="${name}"`);
      }
    });

    it("names only properties the shape takes", () => {
      for (const { name } of SHAPE_DOCS) {
        const labels = [...renderFigure("shape", name).matchAll(/<text class="mark-label"[^>]*>([\w-]+)<\/text>/g)].map(([, label]) => label);
        for (const label of labels) {
          const property = PROPERTIES.find((candidate) => candidate.name === label);
          expect(Array.isArray(property?.appliesTo) && (property.appliesTo as string[]).includes(name), `${name}: ${label}`).toBe(true);
        }
      }
    });
  });

  describe("first-scene", () => {
    const html = renderFigure("first-scene");

    it("shows the declarations of the first scene, in the order of its code", () => {
      const steps = [...html.matchAll(/<code>([^<]+)<\/code>/g)].map(([, code]) => code);
      expect(steps).toEqual([
        "sphere#ball;",
        "translate: 0 1 0;",
        "color: #ff5a36;",
        "material: glass(1.5, frosted 0.3);",
        "animation: float 2s ease-in-out alternate;",
      ]);
      const scene = GETTING_STARTED.find((entry) => entry.anchor === "first-scene")!.example!;
      for (const step of steps) expect(scene, step).toContain(step);
    });

    it("makes the ball float by half a unit, the way of its two frames", () => {
      expect(html).toMatch(/<g class="tinted floats" style="--rise: -\d+(\.\d)?px">/);
    });
  });
});
