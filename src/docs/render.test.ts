import { describe, it, expect } from "vitest";
import { escapeHtml, renderProperty, renderAtRule, renderDocs } from "./render";
import { highlightGss } from "./highlight";
import {
  PROPERTIES,
  AT_RULES,
  type PropertyDef,
  type AtRuleDef,
} from "../compiler/registry";

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

  it("says whether the property is animatable", () => {
    expect(html).toContain("<dt>Animatable</dt>");
    expect(html).toContain("<dd>no</dd>");
    expect(renderProperty({ ...rotateX, animatable: true })).toContain(
      "<dd>yes</dd>",
    );
  });

  it("shows each example in a code block", () => {
    expect(html).toContain(
      `<pre><code class="gss">${highlightGss("@scene {\n  cube;\n}\n\ncube {\n  rotate-x: 45deg;\n}\n")}</code></pre>`,
    );
  });

  it("gives each example a Try it button that carries its code", () => {
    expect(html).toContain(
      '<button type="button" class="try" data-example="@scene { cube; } cube { rotate-x: 45deg; }">Try it</button>',
    );
  });
});

const keyframes: AtRuleDef = {
  name: "keyframes",
  syntax: "@keyframes <name> { <offset> { <declaration>* } }",
  description: "Defines the steps of an animation.",
  examples: ["@keyframes k { to { scale: 2; } }"],
};

describe("renderAtRule", () => {
  const html = renderAtRule(keyframes);

  it("gives the at-rule an anchor that cannot clash with a property", () => {
    expect(html).toContain('id="at-keyframes"');
  });

  it("shows the name with its @", () => {
    expect(html).toContain("<code>@keyframes</code>");
  });

  it("escapes the syntax", () => {
    expect(html).toContain("&lt;name&gt;");
  });

  it("shows each example in a code block", () => {
    expect(html).toContain(
      `<pre><code class="gss">${highlightGss("@keyframes k {\n  to {\n    scale: 2;\n  }\n}\n")}</code></pre>`,
    );
  });
});

describe("renderDocs", () => {
  const html = renderDocs(PROPERTIES, AT_RULES);

  it("documents every registered property", () => {
    for (const property of PROPERTIES) {
      expect(html, property.name).toContain(`id="${property.name}"`);
    }
  });

  it("documents every at-rule", () => {
    for (const atRule of AT_RULES) {
      expect(html, atRule.name).toContain(`id="at-${atRule.name}"`);
    }
  });

  it("links every property and at-rule from the table of contents", () => {
    const toc = html.slice(html.indexOf('<nav class="toc">'), html.indexOf("</nav>"));
    for (const property of PROPERTIES) {
      expect(toc, property.name).toContain(`href="#${property.name}"`);
    }
    for (const atRule of AT_RULES) {
      expect(toc, atRule.name).toContain(`href="#at-${atRule.name}"`);
    }
  });
});
