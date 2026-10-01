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
});
