import { describe, it, expect } from "vitest";
import { prerenderHomeHtml } from "./prerender";
import { PROPERTIES, SELECTORS, SHAPE_DOCS } from "../compiler/registry/registry";

describe("prerenderHomeHtml", () => {
  it("highlights data-gss pillars and fills the counts", () => {
    const html = prerenderHomeHtml(`
      <code data-gss>#dot { material: jelly(0.6); }</code>
      <strong id="count-shapes">–</strong>
      <strong id="count-properties">–</strong>
      <strong id="count-selectors">–</strong>
    `);
    expect(html).toContain('<code data-gss class="gss">');
    expect(html).toContain("gss-"); // highlighted token class
    expect(html).toContain(`id="count-shapes">${SHAPE_DOCS.length}`);
    expect(html).toContain(`id="count-properties">${PROPERTIES.length}`);
    expect(html).toContain(`id="count-selectors">${SELECTORS.length}`);
  });

  // The three install snippets: a shell line, a JS import, an HTML tag (written escaped)
  it("highlights the install snippets by their language", () => {
    const html = prerenderHomeHtml(`
      <pre><code data-lang="sh">npm install gss-lang@0.0.6</code></pre>
      <pre><code data-lang="js">import gss from "gss-lang/vite";</code></pre>
      <pre><code data-lang="html">&lt;script type="module" src="embed.js"&gt;&lt;/script&gt;</code></pre>
    `);
    expect(html).toContain('<code data-lang="sh" class="gss"><span class="gss-at-rule">npm</span> install');
    expect(html).toContain('<code data-lang="js" class="gss"><span class="gss-at-rule">import</span>');
    expect(html).toContain(
      '<code data-lang="html" class="gss"><span class="gss-punct">&lt;</span><span class="gss-selector">script</span>',
    );
    expect(html).not.toContain("&amp;lt;");
  });
});
