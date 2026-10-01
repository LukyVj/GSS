import { describe, it, expect } from "vitest";
import {
  highlightJs,
  highlightHtml,
  highlightSyntax,
  highlightCode,
} from "./highlight-code";
import { EMBED_SNIPPETS } from "../embed/snippets";
import { PROPERTIES, AT_RULES, FUNCTIONS } from "../compiler/registry/registry";

// The docs color more than GSS: the syntax lines of the reference, and the HTML and
// JavaScript of "Embedding a scene" (decision 63), with the palette of GSS code.

// Removing the tags must give the code back, exactly (like highlightGss)
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");

describe("highlightSyntax", () => {
  it("colors the types, the keywords and the separators", () => {
    const html = highlightSyntax("<time> | none");
    expect(html).toContain('<span class="gss-id">&lt;time&gt;</span>');
    expect(html).toContain('<span class="gss-punct">|</span>');
    expect(html).toContain('<span class="gss-keyword">none</span>');
  });

  it("colors functions, multipliers and at-rules", () => {
    expect(highlightSyntax("calc(<expression>)")).toContain(
      '<span class="gss-function">calc</span>',
    );
    expect(highlightSyntax("<number>{1,3}")).toContain(
      '<span class="gss-number">{1,3}</span>',
    );
    expect(highlightSyntax("@keyframes <name>")).toContain(
      '<span class="gss-at-rule">@keyframes</span>',
    );
    expect(highlightSyntax("var(--<name>)")).toContain(
      '<span class="gss-variable">--</span>',
    );
  });

  it("reads a note in parentheses as a comment, not as a function", () => {
    const html = highlightSyntax("<number>{1,2} (plane: width depth)");
    expect(html).toContain(
      '<span class="gss-comment">(plane: width depth)</span>',
    );
  });

  it("gives back every syntax of the registry, exactly", () => {
    for (const entry of [...PROPERTIES, ...AT_RULES, ...FUNCTIONS]) {
      expect(text(highlightSyntax(entry.syntax))).toBe(entry.syntax);
    }
  });
});

describe("highlightJs", () => {
  it("colors keywords, strings, functions and comments", () => {
    const html = highlightJs(
      'import { mount } from "gss-lang"; // here\nmount(canvas);',
    );
    expect(html).toContain('<span class="gss-at-rule">import</span>');
    expect(html).toContain(
      '<span class="gss-string">&quot;gss-lang&quot;</span>',
    );
    expect(html).toContain('<span class="gss-property">mount</span>');
    expect(html).toContain('<span class="gss-comment">// here</span>');
  });

  it("colors a property after a dot", () => {
    expect(highlightJs("scene.destroy();")).toContain(
      '<span class="gss-selector">destroy</span>',
    );
  });
});

describe("highlightHtml", () => {
  it("colors tags, attributes and values", () => {
    const html = highlightHtml('<gss-scene src="logo.gss"></gss-scene>');
    expect(html).toContain('<span class="gss-selector">gss-scene</span>');
    expect(html).toContain('<span class="gss-property">src</span>');
    expect(html).toContain(
      '<span class="gss-string">&quot;logo.gss&quot;</span>',
    );
  });

  it('colors the GSS inside a <script type="text/gss"> as GSS', () => {
    const html = highlightHtml(
      '<script type="text/gss"> @scene { sphere; } </script>',
    );
    expect(html).toContain('<span class="gss-at-rule">@scene</span>');
  });

  it("leaves the text between tags as it is", () => {
    expect(text(highlightHtml("<p>a &amp; b</p>"))).toBe("<p>a &amp; b</p>");
  });
});

describe("highlightCode", () => {
  it("gives back every embedding snippet, exactly", () => {
    for (const way of EMBED_SNIPPETS) {
      const html = highlightCode(way.lang, way.code);
      expect(html).toContain("<span");
      expect(text(html)).toBe(way.code);
    }
  });
});
