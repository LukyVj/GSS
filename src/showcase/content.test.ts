import { describe, it, expect } from "vitest";
import { USE_CASES, INSPIRATION, EMBED_SNIPPETS } from "./content";
import { compileScene } from "../compiler";
import {
  PROPERTIES,
  SELECTORS,
  FUNCTIONS,
  AT_RULES,
  SHAPE_DOCS,
} from "../compiler/registry";

// Decision 63: every scene of the showcase compiles (gpu.test.ts compiles its shader too),
// and every link to the docs lands on a real entry.

const DOCS_ANCHORS = new Set([
  ...PROPERTIES.map((p) => p.name),
  ...SELECTORS.map((s) => s.anchor),
  ...FUNCTIONS.map((f) => f.anchor),
  ...AT_RULES.map((a) => `at-${a.name}`),
  ...SHAPE_DOCS.map((s) => `shape-${s.name}`),
]);

describe("the showcase", () => {
  it("speaks to the three audiences, two use cases each", () => {
    for (const audience of ["designers", "creative coders", "developers"]) {
      expect(USE_CASES.filter((c) => c.audience === audience)).toHaveLength(2);
    }
  });

  it.each(INSPIRATION.map((entry) => [entry.slug, entry.code]))(
    "%s compiles",
    (_slug, code) => {
      expect(() => compileScene(code)).not.toThrow();
    },
  );

  it("has one slug per scene (the name of its capture)", () => {
    const slugs = INSPIRATION.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("links every feature to a real docs entry", () => {
    const missing = USE_CASES.flatMap((c) => c.features)
      .map(([, anchor]) => anchor)
      .filter((anchor) => !DOCS_ANCHORS.has(anchor));
    expect(missing).toEqual([]);
  });

  it("shows the three ways to embed", () => {
    expect(EMBED_SNIPPETS.map((s) => s.code).join("\n")).toMatch(
      /<gss-scene[\s\S]*gss-lang"[\s\S]*gss-lang\/vite/,
    );
  });
});
