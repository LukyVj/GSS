import { describe, it, expect } from "vitest";
import { featuresOf, NOTABLE } from "./features";
import { ARCHIVE } from "./archive";
import { PROPERTIES, SELECTORS, FUNCTIONS, AT_RULES, SHAPE_DOCS } from "../compiler/registry/registry";

// The archive of the showcase says which features of GSS each scene uses (decision 172):
// read from its code, among a chosen list, each linked to its page of the docs.

const labels = (code: string) => featuresOf(code).map((feature) => feature.label);

describe("featuresOf", () => {
  it("finds the lights, the paints and the materials of a scene", () => {
    const code = `
      @paint rings { out vec4 color; void main() { color = vec4(1.0); } }
      @scene { light#key; sphere; cube; }
      sphere { material: glass(1.5); }
      cube { texture: paint(rings); material: gold; }`;
    expect(labels(code)).toEqual(["@paint", "light", "glass", "metal"]);
  });

  it("finds selectors, functions and at-rules, inside @media and nesting too", () => {
    const code = `
      @scene { group#g { path#p; sphere.dot * 3; } }
      #g:has(sphere:hover) .dot { scale: 1.2; }
      .dot { translate: calc(sibling-index() * 0.5) 0 0; animation: rise 2s; animation-timeline: scroll(); }
      @keyframes rise { to { translate: 0 1 0; } }
      @media (max-width: 600px) { #p { & { color: oklch(70% 0.1 30); } } }`;
    expect(labels(code)).toEqual([
      "scroll()", "path", ":hover", ":has()", "@media", "sibling-index()", "@keyframes", "oklch()",
    ]);
  });

  it("leaves the basics out: shapes, colors and transforms every scene has", () => {
    expect(labels("@scene { cube; sphere; } cube { translate: 0 1 0; color: #ff5a36; rotate-y: 30deg; }")).toEqual([]);
  });

  it("reads a material through a variable, and an element() texture", () => {
    const code = "@scene { cube; } scene { --finish: jelly(0.6); } cube { material: var(--finish); texture: element(#card); }";
    expect(labels(code)).toEqual(["element()", "jelly", "var()"]);
  });
});

describe("the notable features", () => {
  const anchors = new Set([
    ...PROPERTIES.map((p) => p.name),
    ...SELECTORS.map((s) => s.anchor),
    ...FUNCTIONS.map((f) => f.anchor),
    ...AT_RULES.map((a) => `at-${a.name}`),
    ...SHAPE_DOCS.map((s) => `shape-${s.name}`),
  ]);

  it("each lead to a page of the docs, once", () => {
    expect(NOTABLE.filter((feature) => !anchors.has(feature.anchor)).map((f) => f.label)).toEqual([]);
    const names = NOTABLE.map((feature) => feature.label);
    expect(new Set(names).size).toBe(names.length);
  });

  it("are found in the scenes of the archive", () => {
    const found = new Set(ARCHIVE.flatMap((entry) => entry.features.map((feature) => feature.label)));
    for (const label of ["light", ":hover", ":active", "glass", "path", "prism", "lathe", "scroll()", "offset-path"]) {
      expect(found).toContain(label);
    }
  });
});
