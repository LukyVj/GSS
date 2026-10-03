import { describe, it, expect } from "vitest";
import { renderProse, plainText } from "./prose";
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";

// The texts of the registry mark their code between backticks, like Markdown
describe("renderProse", () => {
  it("shows the code between backticks as code", () => {
    expect(renderProse("none turns the sun off", new Set())).toBe("none turns the sun off");
    expect(renderProse("`none` turns the sun off", new Set())).toBe("<code>none</code> turns the sun off");
  });

  it("escapes the text and the code", () => {
    expect(renderProse("a <b> & `<color>`", new Set())).toBe("a &lt;b&gt; &amp; <code>&lt;color&gt;</code>");
  });

  it("gives a property name its syntax colour", () => {
    expect(renderProse("like `opacity` does", new Set(["opacity"]))).toBe(
      'like <code><span class="gss-property">opacity</span></code> does',
    );
    expect(renderProse("`opacity: 0.5`", new Set(["opacity"]))).toBe("<code>opacity: 0.5</code>");
  });
});

describe("plainText", () => {
  it("drops the backticks, for the tooltip of the editor", () => {
    expect(plainText("Sets `opacity`, like `filter: opacity()`.")).toBe("Sets opacity, like filter: opacity().");
  });
});

// A backtick left open would show the rest of the sentence as code
describe("the texts of the registry", () => {
  const entries = [...PROPERTIES, ...AT_RULES, ...SELECTORS, ...SHAPE_DOCS, ...FUNCTIONS];
  const texts = entries.flatMap((entry) => [
    [entry.name, entry.description],
    ...("note" in entry && entry.note ? [[entry.name, entry.note.text]] : []),
    ...(entry.details ? [[entry.name, entry.details]] : []),
    ...(entry.values ?? []).map(([, text]) => [entry.name, text]),
    ...entry.examples.flatMap((example) => (example.text ? [[entry.name, example.text]] : [])),
  ]);

  it("close every backtick they open", () => {
    for (const [name, text] of texts) {
      expect((text.match(/`/g) ?? []).length % 2, `${name}: ${text}`).toBe(0);
    }
  });
});
