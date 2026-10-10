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

  // Every page that asks for a figure, with the name its figure knows it by
  const pages = [
    ...PROPERTIES.map((entry) => [entry.figure, entry.name] as const),
    ...AT_RULES.map((entry) => [entry.figure, `at-${entry.name}`] as const),
    ...SELECTORS.map((entry) => [entry.figure, entry.anchor] as const),
    ...FUNCTIONS.map((entry) => [entry.figure, entry.anchor] as const),
    ...SHAPE_DOCS.map((entry) => [entry.figure, entry.name] as const),
    ...[...GETTING_STARTED, ...INSTALLATION].map((entry) => [entry.figure, entry.anchor] as const),
  ].filter(([figure]) => figure);

  // Lucas, Oct. 10: "j'aimerais une illustration dans chaque page de la doc". The pages still
  // without one are listed here, and the list only shrinks.
  const WITHOUT_YET: string[] = [
    "opacity",
    "mix-blend-mode",
    "cursor",
    "controls",
    "outline",
    "outline-width",
    "outline-style",
    "outline-color",
    "outline-offset",
    "transform-origin",
    "operation",
    "blend",
    "light",
    "intensity",
    "ambient",
    "camera-target",
    "camera-distance",
    "camera-angle",
    "camera-spin",
    "floor",
    "filter",
    "background",
    "background-blend-mode",
    "fog",
    "shadows",
    "dpr",
    "shape-rendering",
    "view",
    "at-property",
    "at-property-panel",
    "at-media",
    "at-mixin",
    "at-apply",
    "selector-important",
    "fn-var",
    "fn-if",
    "why-gss",
    "embedding",
    "install-package",
    "install-vite",
    "install-cdn",
    "set-variables",
    "editor-support",
  ];

  it("are on every page of the docs", () => {
    const every = [
      ...PROPERTIES.map((entry) => [entry.figure, entry.name] as const),
      ...AT_RULES.map((entry) => [entry.figure, `at-${entry.name}`] as const),
      ...SELECTORS.map((entry) => [entry.figure, entry.anchor] as const),
      ...FUNCTIONS.map((entry) => [entry.figure, entry.anchor] as const),
      ...SHAPE_DOCS.map((entry) => [entry.figure, `shape-${entry.name}`] as const),
      ...[...GETTING_STARTED, ...INSTALLATION].map((entry) => [entry.figure, entry.anchor] as const),
    ];
    expect(every.filter(([figure]) => !figure).map(([, id]) => id)).toEqual(WITHOUT_YET);
  });

  it("draw something for every page that asks, with no number gone wrong", () => {
    expect(pages.length).toBeGreaterThan(30);
    for (const [figure, id] of pages) {
      const html = renderFigure(figure, id);
      expect(html, id).toMatch(/<(path|circle|rect|text) /);
      expect(html, id).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  // Every id of the docs is an anchor a link or the search can land on: a figure has none
  it("hold no id", () => {
    for (const [figure, id] of pages) expect(renderFigure(figure, id), id).not.toMatch(/\sid="/);
  });

  it("are lines only, for the eye, under a label for a screen reader", () => {
    for (const [figure, id] of pages) {
      const html = renderFigure(figure, id);
      expect(html, id).toMatch(/^\s*<figure class="figure" aria-label="[^"]+">/);
      expect(html, id).not.toContain("fill=");
      const drawings = html.match(/<svg [^>]*>/g) ?? [];
      expect(drawings.length, id).toBeGreaterThan(0);
      for (const drawing of drawings) expect(drawing, id).toContain('aria-hidden="true"');
    }
  });

  it("are the same string each time: the page and its prerender agree", () => {
    for (const [figure, id] of pages) expect(renderFigure(figure, id), id).toBe(renderFigure(figure, id));
  });

  describe("rotate", () => {
    it("turns a cube around the axis of its property, drawn through it", () => {
      for (const axis of ["x", "y", "z"]) {
        const html = renderFigure("rotate", `rotate-${axis}`);
        expect(html, axis).toContain(`data-spin="${axis}"`);
        expect(html, axis).toMatch(/<path class="axis-behind" d="M[^"]+"\/>/); // the part inside the cube
        expect(html, axis).toMatch(/<path class="axis-front" d="M[^"]+"\/>/);
        expect(html, axis).toContain(`<code class="lit">rotate-${axis}: 0deg → 360deg;</code>`);
      }
    });
  });

  describe("easing", () => {
    it("plays an easing its page writes, on the point and on the ball", () => {
      for (const anchor of ["fn-cubic-bezier", "fn-linear", "fn-steps"]) {
        const html = renderFigure("easing", anchor);
        const [, css] = html.match(/animation-timing-function: ([^"]+?)"/)!;
        const { description, examples } = FUNCTIONS.find((fn) => fn.anchor === anchor)!;
        expect(`${description} ${examples.map((example) => example.code).join(" ")}`, anchor).toContain(css);
        expect(html.split(`animation-timing-function: ${css}"`).length - 1, anchor).toBe(2);
      }
    });
  });

  describe("hover", () => {
    it("shows one cube to hover, and two on the page of transition: one jumps, one glides", () => {
      expect(renderFigure("hover", "selector-hover").split('class="tries').length - 1).toBe(1);
      const transition = renderFigure("hover", "transition");
      expect(transition.split('class="tries').length - 1).toBe(2);
      expect(transition.split('class="tries glides').length - 1).toBe(1);
      expect(renderFigure("hover", "selector-active")).toContain('class="tries glides presses"');
    });
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
