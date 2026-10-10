/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { articleToMarkdown } from "./to-markdown";

function article(html: string): HTMLElement {
  const el = document.createElement("article");
  el.className = "property";
  el.innerHTML = html;
  return el;
}

describe("articleToMarkdown", () => {
  it("leaves out a live demo: the page shows its code too", () => {
    const md = articleToMarkdown(
      article(`
        <h3>Set variables from JavaScript</h3>
        <div class="variables-demo"><gss-scene><script type="text/gss">@scene { sphere; }</script></gss-scene>
          <label><code>--lift</code><input type="range"><output>1</output></label></div>
        <p>The demo is this code.</p>
      `),
    );
    expect(md).toBe("# Set variables from JavaScript\n\nThe demo is this code.\n");
  });

  it("turns a property page into Markdown", () => {
    const md = articleToMarkdown(
      article(`
        <div class="page-bar"><div class="crumbs">object properties / <span>material</span></div></div>
        <h3><code>material</code></h3>
        <p>The surface look of an object.</p>
        <dl>
          <dt>Syntax</dt>
          <dd><code>glass(&lt;ior&gt;)</code></dd>
          <dt>Initial value</dt>
          <dd><code>plastic</code></dd>
          <dt>Applies to</dt>
          <dd>objects</dd>
          <dt>Animatable</dt>
          <dd>yes</dd>
        </dl>
        <div class="example">
          <pre><code class="gss">#ball { material: glass(1.5); }</code></pre>
          <button type="button" class="try" data-example="#ball { material: glass(1.5); }">Try it</button>
        </div>
        <nav class="pager"></nav>
      `),
    );
    expect(md).toBe(`# material

The surface look of an object.

- **Syntax:** \`glass(<ior>)\`
- **Initial value:** \`plastic\`
- **Applies to:** objects
- **Animatable:** yes

\`\`\`gss
#ball { material: glass(1.5); }
\`\`\`
`);
  });

  it("unfolds what a page folds: the text, without the label of the fold", () => {
    const md = articleToMarkdown(
      article(`
        <h3><code>opacity</code></h3>
        <p>A group does not fade as one picture.</p>
        <details class="more">
          <summary>More details</summary>
          <p>The reflections show it <code>opaque</code>.</p>
        </details>
      `),
    );
    expect(md).toBe("# opacity\n\nA group does not fade as one picture.\n\nThe reflections show it `opaque`.\n");
  });

  it("keeps inline markup in a guide page", () => {
    const md = articleToMarkdown(
      article(`
        <h3>Why GSS</h3>
        <p>If you can write CSS, you can already read <code>GSS</code>.</p>
        <p>See the <a href="./showcase.html">showcase</a>.</p>
      `),
    );
    expect(md).toBe(`# Why GSS

If you can write CSS, you can already read \`GSS\`.

See the [showcase](./showcase.html).
`);
  });

  it("prefers the Try-it raw code over highlighted spans", () => {
    const md = articleToMarkdown(
      article(`
        <h3>x</h3>
        <div class="example">
          <pre><code class="gss"><span class="tok">sphere</span></code></pre>
          <button type="button" class="try" data-example="sphere;"></button>
        </div>
      `),
    );
    expect(md).toContain("```gss\nsphere;\n```");
  });

  it("turns the chapters and the titled examples into headings, without a live playground", () => {
    const md = articleToMarkdown(
      article(`
        <h3><code>animation</code></h3>
        <h4>Values</h4>
        <dl class="values"><dt><code>alternate</code></dt><dd>forward, then backward</dd></dl>
        <div class="example-part">
          <h4 class="example-name">a bounce</h4>
          <p class="example-text">It goes <code>up</code>.</p>
          <div class="example">
            <pre><code class="gss">cube;</code></pre>
            <button type="button" class="try" data-example="cube;"></button>
          </div>
          <div class="playground"><p>live</p></div>
        </div>
      `),
    );
    expect(md).toBe(`# animation

## Values

- **alternate:** forward, then backward

## a bounce

It goes \`up\`.

\`\`\`gss
cube;
\`\`\`
`);
  });
});
