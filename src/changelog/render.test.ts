import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderChangelog, prerenderChangelogHtml } from "./render";

describe("the changelog page", () => {
  it("gives each version its title, its date and an anchor to link to", () => {
    const html = renderChangelog("## [0.0.7] — 2026-10-23\n\n### Added\n\n- One.\n\n## Unreleased\n");
    expect(html).toContain('<section class="release" id="0.0.7">');
    expect(html).toContain('<h2><a href="#0.0.7">0.0.7</a> <time datetime="2026-10-23">2026-10-23</time></h2>');
    expect(html).toContain("<h3>Added</h3>");
    expect(html).toContain('<ul>\n<li><div class="row"><span class="scope"></span><span class="what">One.</span></div></li>\n</ul>');
  });

  it("leaves out an empty Unreleased, and keeps one with changes", () => {
    expect(renderChangelog("## Unreleased\n\n## [0.0.7] — 2026-10-23\n")).not.toContain("Unreleased");
    expect(renderChangelog("## Unreleased\n\n### Added\n\n- Soon.\n")).toContain('<section class="release" id="unreleased">');
  });

  it("writes the inline Markdown of the changelog: code, links, bold, italic", () => {
    const html = renderChangelog("## [0.0.1] — 2026-10-01\n\n- `a < b` **strong** _soft_ [link](https://example.com/x_y).\n");
    expect(html).toContain("<code>a &lt; b</code> <strong>strong</strong> <em>soft</em> <a href=\"https://example.com/x_y\">link</a>.");
  });

  // Like the changelogs of Vite or Tailwind: one short line per change, no paragraph under
  // it; when its element has a page in the docs, the line leads there
  it("shows each change as one line: its element and its first sentence", () => {
    const html = renderChangelog("## [0.0.7] — 2026-10-23\n\n- **Playground**: a slider. It moves the scroll.\n- Short one.\n");
    expect(html).toContain('<li><div class="row"><span class="scope">Playground</span><span class="what">a slider.</span></div></li>');
    expect(html).not.toContain("It moves the scroll");
    expect(html).toContain('<li><div class="row"><span class="scope"></span><span class="what">Short one.</span></div></li>');
  });

  it("links a change to the page of its element in the docs", () => {
    const html = renderChangelog(
      "## [0.0.7] — 2026-10-23\n\n- **`content`**: text on any object.\n- **`@property-panel`**: a range.\n- **`::face()`**: a number.\n- **`noise()`**: colors.\n- **`@mixin`, `@apply`**: mixins.\n",
    );
    expect(html).toContain('<li><a class="row" href="./docs.html#content"><span class="scope"><code>content</code></span><span class="what">text on any object.</span><span class="go" aria-hidden="true">→</span></a></li>');
    expect(html).toContain('href="./docs.html#at-property-panel"');
    expect(html).toContain('href="./docs.html#selector-face"');
    expect(html).toContain('href="./docs.html#fn-noise"');
    expect(html).toContain('href="./docs.html#at-mixin"');
    expect(renderChangelog("## [0.0.7] — 2026-10-23\n\n- **`<gss-scene>`**: a poster.\n")).toContain('href="./docs.html#embedding"');
  });

  it("gives every change of CHANGELOG.md its element, and links most of the language", () => {
    const html = prerenderChangelogHtml('<div class="changelog" id="changelog"></div><aside class="cloud" aria-hidden="true"></aside>');
    expect(html.match(/<li>/g)!.length).toBeGreaterThan(150);
    expect(html).not.toContain('<span class="scope"></span>');
    expect(html.match(/<a class="row" href="\.\/docs\.html#/g)!.length).toBeGreaterThan(60);
  });

  it("drops the title, the introduction and the link definitions of the file", () => {
    const html = renderChangelog("# Changelog\n\nNotable changes.\n\n## [0.0.1] — 2026-10-01\n\nFirst release.\n\n[0.0.1]: https://github.com/LukyVj/GSS/tree/v0.0.1\n");
    expect(html).not.toContain("Changelog");
    expect(html).not.toContain("Notable changes");
    expect(html).toContain("<p>First release.</p>");
    expect(html).not.toContain("tree/v0.0.1");
  });

  it("fills the page with every version of CHANGELOG.md", () => {
    const html = prerenderChangelogHtml('<div class="changelog" id="changelog"></div><aside class="cloud" aria-hidden="true"></aside>');
    expect(html).toContain('id="0.0.7"');
    expect(html).toContain('id="0.0.1"');
    const versions = [...readFileSync("CHANGELOG.md", "utf8").matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((m) => m[1]);
    expect(versions.length).toBeGreaterThan(6);
    for (const version of versions) expect(html).toContain(`id="${version}"`);
  });
});
