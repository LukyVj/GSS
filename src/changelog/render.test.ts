import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderChangelog, prerenderChangelogHtml } from "./render";

describe("the changelog page", () => {
  it("gives each version its title, its date and an anchor to link to", () => {
    const html = renderChangelog("## [0.0.7] — 2026-10-23\n\n### Added\n\n- One.\n\n## Unreleased\n");
    expect(html).toContain('<section class="release" id="0.0.7">');
    expect(html).toContain('<h2><a href="#0.0.7">0.0.7</a> <time datetime="2026-10-23">2026-10-23</time></h2>');
    expect(html).toContain("<h3>Added</h3>");
    expect(html).toContain("<ul>\n<li>One.</li>\n</ul>");
  });

  it("leaves out an empty Unreleased, and keeps one with changes", () => {
    expect(renderChangelog("## Unreleased\n\n## [0.0.7] — 2026-10-23\n")).not.toContain("Unreleased");
    expect(renderChangelog("## Unreleased\n\n### Added\n\n- Soon.\n")).toContain('<section class="release" id="unreleased">');
  });

  it("writes the inline Markdown of the changelog: code, links, bold, italic", () => {
    const html = renderChangelog("## [0.0.1] — 2026-10-01\n\n- `a < b` **strong** _soft_ [link](https://example.com/x_y).\n");
    expect(html).toContain("<code>a &lt; b</code> <strong>strong</strong> <em>soft</em> <a href=\"https://example.com/x_y\">link</a>.");
  });

  // Less to read: each change shows its first sentence; the rest unfolds on a click
  it("shows the first sentence of a change, and folds the rest", () => {
    const html = renderChangelog("## [0.0.7] — 2026-10-23\n\n- `content`: a text on an object. `a. b` stays whole. More here.\n- Short one.\n");
    expect(html).toContain(
      "<li><details><summary><code>content</code>: a text on an object.</summary><p><code>a. b</code> stays whole. More here.</p></details></li>",
    );
    expect(html).toContain("<li>Short one.</li>");
  });

  // Like Vite: each change starts with the element it is about, shown as a label
  it("shows the element of a change as a label at the start of its line", () => {
    const html = renderChangelog("## [0.0.7] — 2026-10-23\n\n- **`content`**: text on any object. `cube { content: \"hi\"; }` writes it.\n- **Playground**: a slider.\n");
    expect(html).toContain(
      '<li><details><summary><span class="scope"><code>content</code></span> text on any object.</summary><p><code>cube { content: &quot;hi&quot;; }</code> writes it.</p></details></li>',
    );
    expect(html).toContain('<li><span class="scope">Playground</span> a slider.</li>');
  });

  it("gives every change of CHANGELOG.md its element", () => {
    const html = prerenderChangelogHtml('<div class="changelog" id="changelog"></div>');
    expect(html.match(/<li>/g)!.length).toBe(html.match(/<li><(details><summary><)?span class="scope">/g)!.length);
  });

  it("drops the title, the introduction and the link definitions of the file", () => {
    const html = renderChangelog("# Changelog\n\nNotable changes.\n\n## [0.0.1] — 2026-10-01\n\nFirst release.\n\n[0.0.1]: https://github.com/LukyVj/GSS/tree/v0.0.1\n");
    expect(html).not.toContain("Changelog");
    expect(html).not.toContain("Notable changes");
    expect(html).toContain("<p>First release.</p>");
    expect(html).not.toContain("tree/v0.0.1");
  });

  it("fills the page with every version of CHANGELOG.md", () => {
    const html = prerenderChangelogHtml('<div class="changelog" id="changelog"></div>');
    expect(html).toContain('id="0.0.7"');
    expect(html).toContain('id="0.0.1"');
    const versions = [...readFileSync("CHANGELOG.md", "utf8").matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((m) => m[1]);
    expect(versions.length).toBeGreaterThan(6);
    for (const version of versions) expect(html).toContain(`id="${version}"`);
  });
});
