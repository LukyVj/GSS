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

  // Lucas, Oct. 10: "j'aimerais une illustration dans chaque page de la doc"
  it("are on every page of the docs", () => {
    const every = [
      ...PROPERTIES.map((entry) => [entry.figure, entry.name] as const),
      ...AT_RULES.map((entry) => [entry.figure, `at-${entry.name}`] as const),
      ...SELECTORS.map((entry) => [entry.figure, entry.anchor] as const),
      ...FUNCTIONS.map((entry) => [entry.figure, entry.anchor] as const),
      ...SHAPE_DOCS.map((entry) => [entry.figure, `shape-${entry.name}`] as const),
      ...[...GETTING_STARTED, ...INSTALLATION].map((entry) => [entry.figure, entry.anchor] as const),
    ];
    expect(every.length).toBeGreaterThan(150);
    expect(every.filter(([figure]) => !figure).map(([, id]) => id)).toEqual([]);
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

    // A light is not a shape to look at from every side: its page shows what it lights
    it("draws every page of a shape, and of a group", () => {
      for (const { name, figure } of SHAPE_DOCS) {
        expect(figure, name).toBe(name === "light" ? "point-light" : "shape");
        expect(renderFigure("shape", name), name).toContain(`data-turn="${name}"`);
      }
    });

    it("draws a group as a dashed box around its objects, and no shape with one", () => {
      expect(renderFigure("shape", "group")).toMatch(/<path class="bound" d="M[^"]+"\/>/);
      expect(renderFigure("shape", "cube")).not.toContain('class="bound"');
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

  // Lucas, Oct. 10, on the first figures of @mixin and @apply, code drawn as strokes: "je la
  // comprends pas". The code is written, and the cubes show what it gives.
  const written = (html: string) => [...html.matchAll(/<text class="code[^"]*"[^>]*>(.*?)<\/text>/g)].map(([, inside]) => inside.replace(/<[^>]+>/g, ""));

  describe("@mixin", () => {
    const html = renderFigure("flow", "at-mixin");
    const example = AT_RULES.find((atRule) => atRule.name === "mixin")!.examples[0].code;

    it("writes the mixin of its page, in words", () => {
      const mixin = written(html).slice(0, 4);
      expect(mixin).toEqual(["@mixin --polished {", "material: metal(0.15);", "corner-radius: 0.12;", "}"]);
      for (const line of mixin) expect(example).toContain(line);
    });

    it("gives it to two rules, each under the cube it styles", () => {
      expect(written(html).slice(4)).toEqual(["#a { @apply --polished; }", "#b { @apply --polished; }"]);
      expect(example).toContain("cube#a; cube#b;");
      expect(html.split('<g class="tinted">').length - 1).toBe(2);
    });

    it("puts in signal what comes from the mixin: its declarations, and where they are applied", () => {
      const lit = [...html.matchAll(/class="(?:code )?lit"[^>]*>([^<]+)</g)].map(([, words]) => words);
      expect(lit).toEqual(["material: metal(0.15);", "corner-radius: 0.12;", "@apply --polished;", "@apply --polished;"]);
    });

    it("rounds the corners of both cubes: no corner of the outline is sharp", () => {
      const outlines = [...html.matchAll(/<path class="line" pathLength="1" d="([^"]+)"/g)].map(([, d]) => d);
      expect(outlines).toHaveLength(2);
      for (const d of outlines) expect((d.match(/A/g) ?? []).length).toBe(6); // the six corners of the outline of a cube
    });
  });

  describe("@apply", () => {
    const html = renderFigure("flow", "at-apply");
    const example = AT_RULES.find((atRule) => atRule.name === "apply")!.examples[0].code;

    it("writes the two rules of its page: one applies the mixin last, the other first", () => {
      const rules = written(html).filter((line) => line.startsWith("#"));
      expect(rules).toEqual(["#a { color: #3a7bff; @apply --warm; }", "#b { @apply --warm; color: #3a7bff; }"]);
      for (const rule of rules) expect(example).toContain(rule.slice(5));
      expect(html).toContain('<code class="lit">@mixin --warm { color: #ff5a36; }</code>');
      expect(example).toContain("@mixin --warm { color: #ff5a36; }");
    });

    it("writes under each @apply what the mixin puts there", () => {
      const put = [...html.matchAll(/<tspan class="put[^"]*">([^<]+)<\/tspan>/g)].map(([, words]) => words);
      expect(put).toEqual(["color: #ff5a36;", "color: #ff5a36;"]);
    });

    it("strikes the declaration that loses, and gives each cube the color written last", () => {
      const struck = [...html.matchAll(/<tspan class="[^"]*struck[^"]*"[^>]*>([^<]+)<\/tspan>/g)].map(([, words]) => words);
      expect(struck).toEqual(["color: #3a7bff;", "color: #ff5a36;"]);
      const cubes = [...html.matchAll(/<g class="cascades" style="--first: (#\w+); --last: (#\w+)">/g)].map(([, first, last]) => [first, last]);
      expect(cubes).toEqual([
        ["#3a7bff", "#ff5a36"],
        ["#ff5a36", "#3a7bff"],
      ]);
    });
  });

  // Lucas, Oct. 10, on two triangles, one in the other: "c'est pas clair du tout". The rows
  // of chips of oklch() were: so color() is chips too.
  describe("color()", () => {
    it("gives the same three numbers to each space of its page: one chip per space, under its name", () => {
      const html = renderFigure("color", "fn-color");
      const chips = [...html.matchAll(/style="--c: color\(([\w-]+) 0\.95 0\.35 0\.2\)"/g)].map(([, space]) => space);
      const spaces = FUNCTIONS.find((fn) => fn.anchor === "fn-color")!.values!.map(([name]) => name.split(",")[0]);
      expect(chips).toEqual(spaces);
      expect([...html.matchAll(/<text[^>]*>([\w-]+)<\/text>/g)].map(([, name]) => name)).toEqual(spaces);
      expect(html).toContain('<code class="lit">color(&lt;space&gt; 0.95 0.35 0.2)</code>');
    });
  });

  // Lucas, Oct. 10: "on voit des lignes à la place de voir des carrés". A pattern of two colors
  // is filled with them.
  describe("checker() and stripes()", () => {
    type Cell = { x: number; y: number; color: string };
    const cells = (html: string): Cell[] =>
      [...html.matchAll(/<rect class="chip" x="(\d+)" y="(\d+)" width="\d+" height="\d+" style="--c: (#\w+)"\/>/g)].map(([, x, y, color]) => ({ x: +x, y: +y, color }));
    const faces = (html: string) => [...html.matchAll(/<g class="face"[^>]*>(.*?)<\/g>/g)].map(([, inside]) => cells(inside));
    const at = (face: Cell[], x: number, y: number) => face.find((cell) => cell.x === x && cell.y === y)!.color;

    it("fills the cells of a checkerboard with the two colors of its code, half each", () => {
      const html = renderFigure("tile", "fn-checker");
      expect(html).toContain("checker(4, #111, #eee)");
      const flat = cells(html).slice(0, 16);
      expect(flat.filter((cell) => cell.color === "#111")).toHaveLength(8);
      expect(flat.filter((cell) => cell.color === "#eee")).toHaveLength(8);
      // no cell has the color of the one beside it, nor of the one under it
      for (const { x, y, color } of flat) {
        if (x < 54) expect(at(flat, x + 18, y)).not.toBe(color);
        if (y < 54) expect(at(flat, x, y + 18)).not.toBe(color);
      }
    });

    // The grid is cut in the cube: a cell on an edge is one cell, seen on two faces
    it("gives a cell on an edge of the cube the same color on both faces", () => {
      const [front, left, top] = faces(renderFigure("tile", "fn-checker"));
      for (const n of [0, 18, 36, 54]) {
        expect(at(front, 0, n)).toBe(at(left, 54, n)); // the edge between the front and the left
        expect(at(front, n, 0)).toBe(at(top, n, 54)); // between the front and the top
        expect(at(left, n, 0)).toBe(at(top, 0, n)); // between the left and the top
      }
    });

    it("fills the bands of stripes(): four pairs in the height of the cube, one color on its top", () => {
      const html = renderFigure("tile", "fn-stripes");
      expect(html).toContain("stripes(4, #111, #eee)");
      const [front, left, top] = faces(html);
      for (const side of [cells(html).slice(0, 8), front, left]) {
        expect(side.map((band) => band.color)).toEqual(["#eee", "#111", "#eee", "#111", "#eee", "#111", "#eee", "#111"]);
      }
      expect(top.map((band) => band.color)).toEqual(["#111"]);
    });
  });

  // Lucas, Oct. 10: "glass, je comprends pas. Jelly, je comprends pas."
  describe("material", () => {
    const cell = (name: string) => renderFigure("tile", "material").split("<li").find((part) => part.includes(`<code>${name}()</code>`))!;

    it("shows through the glass what stands behind it, bent", () => {
      expect(cell("glass")).toMatch(/<path class="guide" d="M[^"]+"\/>/); // behind the ball, straight
      expect(cell("glass")).toMatch(/<path class="guide bent" d="M[^"]*Q[^"]+"\/>/); // through it, curved
    });

    // Lucas, Oct. 11, on rays through the ball: "c'est pas trop ça". His idea: the ball in its
    // color at 20 or 30% of opacity, shaded with small points.
    it("fills the jelly with its color, see-through, and shades it with points: more of them away from the light", () => {
      const [, cx, cy, r] = cell("jelly").match(/<circle class="jelly" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"\/>/)!.map(Number);
      const points = [...cell("jelly").match(/<path class="stipple" d="([^"]+)"\/>/)![1].matchAll(/M([\d.]+) ([\d.]+)/g)].map(([, x, y]) => [+x - cx, +y - cy]);
      expect(points.length).toBeGreaterThan(40);
      for (const [x, y] of points) expect(Math.hypot(x, y)).toBeLessThan(r - 1);
      // the light comes from the upper left
      const lit = points.filter(([x, y]) => x + y < 0).length;
      expect(points.length - lit).toBeGreaterThan(lit * 3);
      expect(cell("jelly")).not.toContain("flows");
    });
  });

  // Lucas, Oct. 10: two objects on one path, one over the other, could not be told apart
  describe("offset-rotate", () => {
    const cells = renderFigure("offset-rotate", "offset-rotate").split("<li").slice(1);

    it("gives each turn its own path: an object that turns with it, one that keeps its angle", () => {
      expect(cells.map((cell) => cell.match(/<code>([^<]+)<\/code>/)![1])).toEqual(["offset-rotate: auto;", "offset-rotate: 0deg;"]);
      const [along, upright] = cells;
      expect(along).not.toContain("fixed");
      expect(upright.split('class="placed fixed"').length - 1).toBe(5);
      expect(upright.split('class="travels fixed"').length - 1).toBe(1);
    });

    it("shows the object at five places of its path, and once more, moving", () => {
      for (const cell of cells) {
        expect([...cell.matchAll(/offset-distance: (\d+)%/g)].map(([, at]) => +at)).toEqual([0, 25, 50, 75, 100]);
        expect(cell.split('class="travels').length - 1).toBe(1);
      }
    });
  });

  // Lucas, Oct. 10: "les trois se ressemblent". Each says which parts of the way it plays on,
  // and which end of the range its property sets.
  describe("animation-range", () => {
    const lit = (id: string) => {
      const html = renderFigure("range", id);
      return {
        parts: [...html.matchAll(/<text class="lane-label middle( lit)?"[^>]*>(entry|contain|exit)<\/text>/g)].map(([, on, name]) => (on ? name.toUpperCase() : name)),
        ends: [...html.matchAll(/<text class="axis-label lit"[^>]*>(start|end)<\/text>/g)].map(([, name]) => name),
        code: html.match(/<code class="lit">([^<]+)<\/code>/)![1],
      };
    };

    it("plays on the entry, between a start and an end, both set by animation-range", () => {
      expect(lit("animation-range")).toEqual({ parts: ["ENTRY", "contain", "exit"], ends: ["start", "end"], code: "animation-range: entry;" });
    });

    it("starts where animation-range-start says, and plays to the end of the way", () => {
      expect(lit("animation-range-start")).toEqual({ parts: ["entry", "CONTAIN", "EXIT"], ends: ["start"], code: "animation-range-start: contain;" });
    });

    it("plays from the start of the way, and ends where animation-range-end says", () => {
      expect(lit("animation-range-end")).toEqual({ parts: ["ENTRY", "CONTAIN", "exit"], ends: ["end"], code: "animation-range-end: contain;" });
    });

    it("shows the scene at each part of its way across the page: coming in, all in, going out", () => {
      const html = renderFigure("range", "animation-range");
      expect(html.split('class="window"').length - 1).toBe(3);
    });
  });

  const codes = (cells: string[]) => cells.map((cell) => cell.match(/<code>([^<]+)<\/code>/)![1]);
  const count = (html: string, piece: string) => html.split(piece).length - 1;

  // Lucas, Oct. 10, on a bulb with rays: "c'est juste un petit soleil", with no motion, that
  // says nothing of what a light does. A point light is a point, its light all around it, and
  // the side of an object that light reaches.
  describe("a point light", () => {
    const html = renderFigure("point-light", "light");

    it("is a point, with its light around it, between two balls it lights on the side that faces it", () => {
      expect(count(html, 'class="dot"')).toBe(1);
      expect(count(html, 'class="ripples"')).toBe(4);
      expect(count(html, 'class="reached')).toBe(2);
    });

    it("moves, and the ball it comes near takes more of its light", () => {
      expect(html).toMatch(/<g class="sways-xy" style="--sx: -?[\d.]+px; --sy: -?[\d.]+px; --beat: 3\.6s">/);
      expect(html).toContain('<g class="reached fades reverse" style="--beat: 3.6s">');
      expect(html).toContain('<g class="reached fades" style="--beat: 3.6s">');
    });

    it("is not the figure of the sun of the scene, whose page has the same name", () => {
      expect(renderFigure("scene", "light")).not.toBe(html);
      expect(renderFigure("scene", "light")).toContain("light: -45deg 54.7deg;");
    });
  });

  describe("intensity", () => {
    it("shows three lights, each stronger: its light goes farther, and the ball takes more of it", () => {
      const cells = renderFigure("scene", "intensity").split("<li").slice(1);
      expect(codes(cells)).toEqual(["intensity: 0.5;", "intensity: 1;", "intensity: 4;"]);
      expect(cells.map((cell) => count(cell, 'class="ripples"'))).toEqual([1, 2, 4]);
      expect(cells.map((cell) => (cell.match(/<path class="tint reached" d="([^"]+)"/)![1].match(/M/g) ?? []).length)).toEqual([1, 2, 3]);
    });
  });

  // Lucas, Oct. 10: white rings on the floor do not read as a shadow. A shadow is dark, on a
  // floor in the light.
  describe("shadows", () => {
    it("draws the shadow dark on a floor in the light: none, a sharp one, a soft one", () => {
      const cells = renderFigure("scene", "shadows").split("<li").slice(1);
      expect(codes(cells)).toEqual(["shadows: none;", "shadows: hard;", "shadows: soft;"]);
      for (const cell of cells) expect(count(cell, 'class="lit-floor"')).toBe(1);
      expect(cells.map((cell) => count(cell, 'class="shade'))).toEqual([0, 1, 3]);
    });
  });

  // Lucas, Oct. 10, on a ring around a cube with two words: "elle veut rien dire"
  describe("controls", () => {
    const cells = renderFigure("scene", "controls").split("<li").slice(1);

    it("pairs each gesture with what it does to the view", () => {
      expect(codes(cells)).toEqual(["controls: orbit;", "controls: zoom;"]);
      expect(cells[0]).toContain(">drag</text>");
      expect(cells[1]).toContain(">wheel</text>");
    });

    it("turns the cube of orbit under the pointer of the reader, and brings the cube of zoom closer and farther", () => {
      expect(cells[0]).toContain('data-turn="cube"');
      expect(cells[0]).not.toContain('class="mark-label">size<');
      expect(cells[1]).toContain('<g class="pulses"');
      expect(cells[1]).not.toContain("data-turn");
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
