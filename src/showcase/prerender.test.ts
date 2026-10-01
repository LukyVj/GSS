import { describe, it, expect } from "vitest";
import { prerenderShowcaseHtml, renderWaysHtml } from "./prerender";

describe("prerenderShowcaseHtml", () => {
  it("fills the audience grids, ways and gallery", async () => {
    const shell = `
      <div class="grid" data-audience="designers"></div>
      <div class="grid" data-audience="creative coders"></div>
      <div class="grid" data-audience="developers"></div>
      <div class="grid ways" id="ways"></div>
      <div class="grid gallery" id="gallery"></div>
    `;
    const html = await prerenderShowcaseHtml(shell);
    expect(html).toContain('id="logo-3d"');
    expect(html).toContain("<gss-scene>");
    expect(html).toContain('id="ways">');
    expect(html).toContain("A tag");
    expect(html).toContain('id="gallery">');
    expect(html).toContain('href="./playground.html#code=');
    expect(html).toContain('class="fallback"');
  });

  it("renders the three embed ways", () => {
    expect(renderWaysHtml()).toContain("A build step");
  });
});
