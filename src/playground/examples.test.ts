import { describe, it, expect } from "vitest";
import { EXAMPLES, renderExampleOptions } from "./examples";
import { compileGSS } from "../compiler";
import { STUDIES } from "../showcase/content";

describe("playground examples", () => {
  // The studies are heavy scenes: more than the 5 s default while other runs share the machine
  it("all compile", () => {
    for (const example of EXAMPLES) {
      expect(() => compileGSS(example.code), example.name).not.toThrow();
    }
  }, 30000);

  it("have unique names", () => {
    const names = EXAMPLES.map((example) => example.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("carry the HTML of an example that shows an element (decision 101)", () => {
    const card = EXAMPLES.find((example) => example.name.startsWith("element()"));
    expect(card?.html).toContain('id="card"');
  });

  it("carry the canvas of the element() example that shows one (decision 168)", () => {
    const canvas = EXAMPLES.find((example) => example.name === "element(): a canvas, live");
    expect(canvas?.html).toContain("<canvas");
    expect(canvas?.html).toContain("onerror"); // innerHTML runs no <script>: the shader starts from an attribute
  });

  it("carry, for every element(#id) they show, an element with that id", () => {
    for (const example of EXAMPLES) {
      for (const [, id] of example.code.matchAll(/\belement\(#([\w-]+)\)/g)) {
        expect(example.html ?? "", example.name).toContain(`id="${id}"`);
      }
    }
  });

  it("show the newest features in a group of their own, between Start here and the studies", () => {
    const names = EXAMPLES.filter((example) => example.group === "New features").map((example) => example.name);
    expect(names).toContain("Astral Greenhouse (the ten latest features)");
    expect(names).toContain("Property Control Room (@property and its panel)");
    const options = renderExampleOptions();
    expect(options.indexOf('label="New features"')).toBeLessThan(options.indexOf('label="Studies"'));
  });

  it("start with the first scene", () => {
    expect(EXAMPLES[0].name).toBe("First scene");
    expect(renderExampleOptions()).toContain('<optgroup label="Start here"><option value="0">First scene</option>');
  });

  it("keep the studies of the showcase in a group of their own, after Start here", () => {
    const studies = EXAMPLES.filter((example) => example.group === "Studies");
    expect(studies.map((example) => example.code)).toEqual(STUDIES.map((study) => study.scene));
    const options = renderExampleOptions();
    expect(options.indexOf('label="Studies"')).toBeGreaterThan(options.indexOf('label="Start here"'));
  });
});
