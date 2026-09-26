import { describe, it, expect } from "vitest";
import { escapeHtml, renderProperty, renderDocs } from "./render";
import { PROPERTIES, type PropertyDef } from "../compiler/registry";

const rotateX: PropertyDef = {
  name: "rotate-x",
  appliesTo: "object",
  syntax: "<angle>",
  initial: "0deg",
  description: "Rotates the object around the x axis.",
  examples: ["@scene { cube; } cube { rotate-x: 45deg; }"],
};

describe("escapeHtml", () => {
  it("escapes the characters HTML would interpret", () => {
    expect(escapeHtml('<a> & "b"')).toBe("&lt;a&gt; &amp; &quot;b&quot;");
  });
});

describe("renderProperty", () => {
  const html = renderProperty(rotateX);

  it("gives the property an anchor", () => {
    expect(html).toContain('id="rotate-x"');
  });

  it("shows the description", () => {
    expect(html).toContain("Rotates the object around the x axis.");
  });

  it("escapes the syntax", () => {
    expect(html).toContain("&lt;angle&gt;");
    expect(html).not.toContain("<angle>");
  });

  it("shows the initial value", () => {
    expect(html).toContain("<code>0deg</code>");
  });

  it("shows each example in a code block", () => {
    expect(html).toContain(
      "<pre><code>@scene { cube; } cube { rotate-x: 45deg; }</code></pre>",
    );
  });
});

describe("renderDocs", () => {
  it("documents every registered property", () => {
    const html = renderDocs(PROPERTIES);
    for (const property of PROPERTIES) {
      expect(html, property.name).toContain(`id="${property.name}"`);
    }
  });
});
