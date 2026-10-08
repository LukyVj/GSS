import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  renderFunction,
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
  FUNCTIONS,
} from "../compiler/registry/registry";

const rotateX: PropertyDef = {
  name: "rotate-x",
  appliesTo: "object",
  syntax: "<angle>",
  initial: "0deg",
  description: "Rotates the object around the x axis.",
  examples: [{ code: "@scene { cube; } cube { rotate-x: 45deg; }" }],
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
  examples: [{ code: "@keyframes k { to { scale: 2; } }" }],
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
    const selectors = html.indexOf('<section id="selectors"');
    expect(selectors).toBeGreaterThan(html.indexOf('<section id="at-rules"'));
    expect(selectors).toBeLessThan(
      html.indexOf('<section id="object-properties"'),
    );
  });
  it("documents the shapes between the selectors and the properties", () => {
    const shapes = html.indexOf('<section id="shapes"');
    expect(shapes).toBeGreaterThan(html.indexOf('<section id="selectors"'));
    expect(shapes).toBeLessThan(
      html.indexOf('<section id="object-properties"'),
    );
    for (const shape of SHAPE_DOCS) {
      expect(html, shape.name).toContain(`id="shape-${shape.name}"`);
    }
  });
});

// The JavaScript API is not in the registry: the reference links to its guide page
describe("an at-rule's See also row", () => {
  const html = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);

  it("links @property to the page on setting variables from JavaScript", () => {
    const property = renderAtRule(AT_RULES.find((atRule) => atRule.name === "property")!);
    expect(property).toContain("<dt>See also</dt>");
    expect(property).toContain('<a href="#set-variables">Set variables from JavaScript</a>');
  });

  it("only links to pages that exist", () => {
    for (const atRule of AT_RULES) {
      for (const { anchor } of atRule.see ?? []) {
        expect(html, anchor).toContain(`id="${anchor}"`);
      }
    }
  });

  it("is left out when there is nothing to see", () => {
    expect(renderAtRule(keyframes)).not.toContain("See also");
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

// A note: a callout under the description, what a reader must know before trying
describe("a note", () => {
  it("is a callout under the description", () => {
    const html = renderProperty({ ...rotateX, note: { title: "Behind a flag for now.", text: "Turn it on to see it." } });
    expect(html).toContain('<aside class="callout">');
    expect(html.indexOf("Rotates the object")).toBeLessThan(html.indexOf('class="callout"'));
    expect(html).toContain("<strong>Behind a flag for now.</strong> Turn it on to see it.");
    // Like the notes of DESIGN.md: a mono keyword in signal
    expect(html).toContain('<span class="keyword">note</span>');
  });

  it("is left out without one", () => {
    expect(renderProperty(rotateX)).not.toContain("callout");
  });

  it("tells how to see element() today, on its page and on texture", () => {
    const fn = FUNCTIONS.find((f) => f.name === "element()")!;
    const texture = PROPERTIES.find((p) => p.name === "texture")!;
    for (const note of [fn.note, texture.note]) {
      expect(note?.text).toContain("chrome://flags/#canvas-draw-element");
      expect(note?.text).toContain("origin trial");
    }
    expect(renderFunction(fn)).toContain('<aside class="callout">');
  });

  // The dpr menu over the examples and the playground (decision 120) can draw an example
  // at another density than its own scene { dpr }: the dpr page says so
  it("tells, on dpr, that the menu over a render picks the density for the viewer", () => {
    const dpr = PROPERTIES.find((p) => p.name === "dpr")!;
    expect(dpr.note?.text).toMatch(/menu/);
    expect(dpr.note?.text).toMatch(/auto/);
    expect(renderProperty(dpr)).toContain('<aside class="callout">');
  });
});

// texture: element(#id) (decision 101): an example can carry the HTML its scene shows
describe("an example with HTML", () => {
  it("shows the HTML beside the code, and gives it to Try it", () => {
    const html = renderProperty({
      name: "texture",
      appliesTo: "object",
      syntax: "element(<id>)",
      initial: "none",
      description: "…",
      examples: [{ code: "@scene { cube; } cube { texture: element(#card); }", html: '<div id="card">Hi</div>' }],
    });
    expect(html).toContain('<code class="html">');
    expect(html).toContain('data-html="&lt;div id=&quot;card&quot;&gt;Hi&lt;/div&gt;"');
  });

  it("documents element() on its own page, with a live example", () => {
    const fn = FUNCTIONS.find((f) => f.name === "element()")!;
    expect(fn.anchor).toBe("fn-element");
    expect(fn.examples.every((example) => example.html?.includes('id="card"'))).toBe(true);
  });
});

// The parts of a page under its table, like the docs of a popular language (decision 121):
// the code of the prose, a table of the values, a paragraph, then titled examples
describe("the parts of a page", () => {
  const material: PropertyDef = {
    name: "material",
    appliesTo: "object",
    syntax: "matte() | metal()",
    initial: "matte()",
    description: "Sets how the surface reacts to light, like `currentColor` follows `color`.",
    values: [
      ["matte()", "Scatters the light only."],
      ["metal()", "Reflects the scene: `metal(0.2)`."],
    ],
    details: "A material can take a gradient.",
    examples: [
      { name: "a mirror", text: "A `chrome` sphere.", code: "@scene { sphere; } sphere { material: chrome; }" },
      { code: "@scene { sphere; }" },
    ],
  };
  const html = renderProperty(material);

  it("shows the code of the prose as code, a property name in its colour", () => {
    expect(html).toContain("like <code>currentColor</code> follows <code><span class=\"gss-property\">color</span></code>.");
    expect(html).not.toContain("`");
  });

  it("puts the values in a table under a heading, then the paragraph, before the examples", () => {
    expect(html).toContain('<h4 id="material--values">Values</h4>');
    expect(html).toContain('<dl class="values">');
    expect(html).toMatch(/<dt><code class="gss syntax"><span class="gss-function">matte<\/span>/);
    expect(html).toContain("<dd>Reflects the scene: <code>metal(0.2)</code>.</dd>");
    const order = ["<dt>Syntax</dt>", '<h4 id="material--values">Values</h4>', "<p>A material can take a gradient.</p>", 'class="example-part"'];
    expect(order.map((part) => html.indexOf(part))).toEqual(order.map((part) => html.indexOf(part)).sort((a, b) => a - b));
  });

  it("names the heading of the table when the entry does", () => {
    expect(renderProperty({ ...material, valuesTitle: "Functions" })).toContain('<h4 id="material--functions">Functions</h4>');
    expect(renderProperty({ ...material, values: undefined, details: undefined })).not.toMatch(/<h4 id=/);
  });

  it("titles each example and says what it shows, above its code", () => {
    expect(html).toMatch(
      /<h4 class="example-name">a mirror<\/h4>\s*<p class="example-text">A <code>chrome<\/code> sphere.<\/p>\s*<div class="example">/,
    );
    // an example without a name has no heading
    expect(html.match(/class="example-name"/g)).toHaveLength(1);
  });

  it("titles the two light pages apart", () => {
    const sun = renderProperty(PROPERTIES.find((p) => p.name === "light")!);
    expect(sun).toContain("<h3><code>light</code> <small>(sun)</small></h3>");
  });
});

// Every page of the reference keeps its examples apart by their names, and its prose short:
// the rest goes in the table of its values and in one paragraph
describe("the texts of the reference", () => {
  const entries = [...PROPERTIES, ...AT_RULES, ...SELECTORS, ...SHAPE_DOCS, ...FUNCTIONS];

  it("name every example, once per page, and never like the page", () => {
    for (const entry of entries) {
      const names = entry.examples.map((example) => example.name);
      expect(names.every(Boolean), entry.name).toBe(true);
      expect(new Set(names).size, entry.name).toBe(names.length);
      if (names.length > 1) expect(names, entry.name).not.toContain(entry.name);
    }
  });

  it("keep the description to a lead of three sentences at most", () => {
    for (const entry of entries) {
      const sentences = entry.description.replace(/`[^`]*`/g, "code").split(/[.!?](?:\s|$)/).filter((s) => s.trim());
      expect(sentences.length, `${entry.name}: ${entry.description}`).toBeLessThanOrEqual(3);
    }
  });
});
