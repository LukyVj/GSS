import { describe, it, expect } from "vitest";
import { prerenderShowcaseHtml, renderWaysHtml } from "./prerender";
import { STUDIES } from "./content";

describe("prerenderShowcaseHtml", () => {
  const shell = `
    <div class="lab" id="lab"></div>
    <div class="grid" data-audience="designers"></div>
    <div class="grid" data-audience="creative coders"></div>
    <div class="grid" data-audience="developers"></div>
    <div class="grid ways" id="ways"></div>
    <div class="grid gallery" id="gallery"></div>
  `;

  it("fills the audience grids, ways and gallery", async () => {
    const html = await prerenderShowcaseHtml(shell);
    expect(html).toContain('id="logo-3d"');
    expect(html).toContain("<gss-scene>");
    expect(html).toContain('id="ways">');
    expect(html).toContain("A tag");
    expect(html).toContain('id="gallery">');
    expect(html).toContain('href="./playground.html#code=');
    expect(html).toContain('class="fallback"');
  });

  it("fills the studies viewer: the list, and the first study ready to open", async () => {
    const html = await prerenderShowcaseHtml(shell);
    for (const study of STUDIES) expect(html).toContain(`data-study="${study.key}"`);
    expect(html).toContain('data-study="circuit" aria-pressed="true"');
    expect(html).toContain('data-study="camera" aria-pressed="false"');
    expect(html).toContain('id="study-title">Glass\nCircuit.</h3>');
    expect(html).toContain('id="study-edit" href="./playground.html#code=');
    expect(html).toContain("<canvas");
    expect(html).toContain('id="study-poster" src="/showcase/circuit.jpg"');
    expect(html).toContain('id="study-play" aria-label="Play glass circuit"');
  });

  it("renders the three embed ways", () => {
    expect(renderWaysHtml()).toContain("A build step");
  });
});
