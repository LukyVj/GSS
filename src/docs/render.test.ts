import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  renderProperty,
  renderAtRule,
  renderDocs,
  renderSelector,
  renderShape,
  timelineName,
} from "./render";
import { highlightGss } from "./highlight";
import { FIRST_SCENE, GETTING_STARTED } from "./guide";
import { compileGSS } from "../compiler";
import {
  PROPERTIES,
  AT_RULES,
  type PropertyDef,
  type AtRuleDef,
  SELECTORS,
  SHAPE_DOCS,
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
  const html = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS);

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

  it("starts with Getting started, before the reference", () => {
    expect(html.indexOf('id="getting-started"')).toBeGreaterThan(-1);
    expect(html.indexOf('id="getting-started"')).toBeLessThan(
      html.indexOf('id="at-rules"'),
    );
    for (const entry of GETTING_STARTED) {
      expect(html, entry.anchor).toContain(`href="#${entry.anchor}"`);
      expect(html, entry.anchor).toContain(
        `#${entry.anchor} { view-timeline: `,
      );
    }
  });

  it("gives the first scene a Try it button, and it compiles", () => {
    expect(html).toContain(`data-example="${escapeHtml(FIRST_SCENE)}"`);
    expect(() => compileGSS(FIRST_SCENE)).not.toThrow();
  });

  it("lets every section, property and at-rule highlight its link while it is read", () => {
    const anchors = [
      "at-rules",
      "object-properties",
      "scene-properties",
      ...PROPERTIES.map((property) => property.name),
      ...AT_RULES.map((atRule) => `at-${atRule.name}`),
    ];
    for (const anchor of anchors) {
      const name = timelineName(anchor);
      expect(html, anchor).toContain(
        `#${anchor} { view-timeline: ${name} block; }`,
      );
      expect(html, anchor).toContain(
        `.toc a[href="#${anchor}"] { animation-timeline: ${name}; }`,
      );
      expect(html, anchor).toMatch(
        new RegExp(`timeline-scope:[^;]*${name}[,;]`),
      );
    }
  });

  it("links every property and at-rule from the table of contents", () => {
    const toc = html.slice(
      html.indexOf('<nav class="toc-nav">'),
      html.indexOf("</nav>"),
    );
    for (const property of PROPERTIES) {
      expect(toc, property.name).toContain(`href="#${property.name}"`);
    }
    for (const atRule of AT_RULES) {
      expect(toc, atRule.name).toContain(`href="#at-${atRule.name}"`);
    }
  });

  it("documents the selectors between the at-rules and the properties", () => {
    const selectors = html.indexOf('<section id="selectors">');
    expect(selectors).toBeGreaterThan(html.indexOf('<section id="at-rules">'));
    expect(selectors).toBeLessThan(
      html.indexOf('<section id="object-properties">'),
    );
  });
  it("documents the shapes between the selectors and the properties", () => {
    const shapes = html.indexOf('<section id="shapes">');
    expect(shapes).toBeGreaterThan(html.indexOf('<section id="selectors">'));
    expect(shapes).toBeLessThan(
      html.indexOf('<section id="object-properties">'),
    );
    for (const shape of SHAPE_DOCS) {
      expect(html, shape.name).toContain(`id="shape-${shape.name}"`);
    }
  });
});

describe("renderShape", () => {
  const cone = SHAPE_DOCS.find((shape) => shape.name === "cone")!;
  const html = renderShape(cone, PROPERTIES);

  it("links the properties of its own shape, found in the registry", () => {
    expect(html).toContain('id="shape-cone"');
    expect(html).toContain('href="#radius"');
    expect(html).toContain('href="#height"');
  });

  it("leaves out the properties of other shapes", () => {
    expect(html).not.toContain('href="#size"');
    expect(html).not.toContain('href="#d"');
  });
});

describe("renderSelector", () => {
  const universal = SELECTORS.find((selector) => selector.name === "*")!;
  const html = renderSelector(universal);

  it("uses the anchor as id, not the name", () => {
    expect(html).toContain('id="selector-universal"');
  });

  it("shows the name and its specificity", () => {
    expect(html).toContain("<code>*</code>");
    expect(html).toContain("<dt>Specificity</dt>");
    expect(html).toContain("<dd>0</dd>");
  });
});

// Decision 63: the guide entry "Embedding a scene" holds code blocks, and the
// syntax lines of the reference are colored
describe("a guide paragraph that is a code block", () => {
  it("is not wrapped in a <p>", () => {
    const html = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS);
    expect(html).toContain('id="embedding"');
    // colored like the rest of the code (highlight-code.ts)
    expect(html).toMatch(
      /<pre><code class="gss"><span class="gss-punct">&lt;<\/span><span class="gss-selector">script<\/span>/,
    );
    expect(html).not.toContain("<p><pre>");
  });
});

describe("a syntax line", () => {
  it("is colored", () => {
    const html = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS);
    expect(html).toContain(
      '<dd><code class="gss syntax"><span class="gss-id">&lt;number&gt;</span>',
    );
  });
});
