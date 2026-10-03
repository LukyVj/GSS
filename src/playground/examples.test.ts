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
