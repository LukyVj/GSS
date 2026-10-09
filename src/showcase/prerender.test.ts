import { describe, it, expect } from "vitest";
import { prerenderShowcaseHtml, renderWaysHtml, renderArchiveHtml } from "./prerender";
import { STUDIES } from "./content";
import { ARCHIVE } from "./archive";

describe("prerenderShowcaseHtml", () => {
  const shell = `
    <div class="lab" id="lab"></div>
    <div class="grid" data-audience="designers"></div>
    <div class="grid" data-audience="creative coders"></div>
    <div class="grid" data-audience="developers"></div>
    <div class="grid ways" id="ways"></div>
    <div class="archive" id="scenes"></div>
  `;

  it("fills the audience grids, ways and the archive", async () => {
    const html = await prerenderShowcaseHtml(shell);
    expect(html).toContain('id="logo-3d"');
    expect(html).toContain("<gss-scene>");
    expect(html).toContain('id="ways">');
    expect(html).toContain("A tag");
    expect(html).toContain('id="scenes" data-view="grid">');
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

  it("lists every scene of the archive: its capture, name, words, version and features", () => {
    const html = renderArchiveHtml(ARCHIVE.map((entry) => ({ entry, href: `./playground.html#${entry.slug}` })), "0.0.6");
    expect(html.match(/<li class="entry"/g)).toHaveLength(ARCHIVE.length);
    expect(html).toContain('<button type="button" data-view="grid" aria-pressed="true">grid</button>');
    expect(html).toContain('<button type="button" data-view="list" aria-pressed="false">list</button>');
    expect(html).toContain(`${ARCHIVE.length} scenes`);
    expect(html).toContain('<img src="/showcase/teapot.jpg" alt="" loading="lazy" />');
    expect(html).toContain("<h3>Utah teapot</h3>");
    expect(html).toContain('<a href="./docs.html#shape-lathe"><code>lathe</code></a>');
    // The version a scene came with; those of the newest version say so
    expect(html).toContain('<span class="since new" title="New in GSS 0.0.6">v0.0.6</span>');
    expect(html).toContain('<span class="since" title="Since GSS 0.0.2">v0.0.2</span>');
    // A study opens in the viewer at the top of the page, the others in the playground
    expect(html).toContain('href="#circuit" data-open-study="circuit"');
    expect(html).toContain('href="./playground.html#teapot"');
  });

  it("says when a scene uses more features than a card shows", () => {
    const release = ARCHIVE.find((entry) => entry.slug === "release")!;
    const html = renderArchiveHtml([{ entry: release, href: "#release" }], "0.0.6");
    expect(release.features.length).toBeGreaterThan(6);
    expect(html).toContain(`<li class="more">+${release.features.length - 6}</li>`);
  });

  it("renders the three embed ways", () => {
    expect(renderWaysHtml()).toContain("A build step");
  });
});
