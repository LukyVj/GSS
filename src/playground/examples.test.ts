import { describe, it, expect } from "vitest";
import { EXAMPLES, renderExampleOptions } from "./examples";
import { compileGSS } from "../compiler";

describe("playground examples", () => {
  it("all compile", () => {
    for (const example of EXAMPLES) {
      expect(() => compileGSS(example.code), example.name).not.toThrow();
    }
  });

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
});
