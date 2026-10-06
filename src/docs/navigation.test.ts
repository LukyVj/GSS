// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { DOC_GROUPS, groupEntries, sortEntries } from "./navigation";
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";
import { GETTING_STARTED, INSTALLATION } from "./guide";
import { renderDocs } from "./render";
import { VERSION, CDN_URL } from "../version";

const anchors = [
  ...PROPERTIES.map((p) => p.name),
  ...AT_RULES.map((a) => `at-${a.name}`),
  ...SELECTORS.map((s) => s.anchor),
  ...SHAPE_DOCS.map((s) => `shape-${s.name}`),
  ...FUNCTIONS.map((f) => f.anchor),
  ...GETTING_STARTED.map((g) => g.anchor),
  ...INSTALLATION.map((g) => g.anchor),
];

describe("documentation navigation", () => {
  it("assigns every current article exactly once, without stale anchors", () => {
    const configured = DOC_GROUPS.flatMap((group) => group.anchors);
    expect(new Set(configured).size).toBe(configured.length);
    expect([...configured].sort()).toEqual([...anchors].sort());
  });
  it("sorts alphabetically by default and honors explicit priorities without mutating input", () => {
    const entries = ["zebra", "apple", "middle"].map((label) => ({ anchor: label, label, html: "" }));
    expect(sortEntries(entries).map((e) => e.label)).toEqual(["apple", "middle", "zebra"]);
    expect(sortEntries(entries.map((e) => e.label === "zebra" ? { ...e, order: -1 } : e)).map((e) => e.label)).toEqual(["zebra", "apple", "middle"]);
    expect(entries[0].label).toBe("zebra");
  });
  it("keeps new unclassified entries reachable", () => {
    expect(groupEntries([{ anchor: "future", label: "Future", html: "" }])[0].entries[0].anchor).toBe("future");
  });
  it("splits the colors: the properties, the color functions, then gradients and noise", () => {
    const anchorsOf = (id: string) => DOC_GROUPS.find((g) => g.id === id)!.anchors;
    expect(anchorsOf("colors")).toEqual(expect.arrayContaining(["color", "background", "floor"]));
    expect(anchorsOf("color-functions")).toEqual(expect.arrayContaining(["fn-rgb", "fn-oklab-oklch", "fn-color-mix", "fn-currentcolor"]));
    expect(anchorsOf("gradients")).toEqual(["fn-gradients", "fn-noise", "fn-displace"]);
    expect(DOC_GROUPS.find((g) => g.id === "values")!.anchors).toContain("fn-calc");
    expect(anchorsOf("color-functions")).not.toContain("fn-calc");
  });
  it("splits the selectors: the selectors, the combinators, the pseudo-classes", () => {
    const anchorsOf = (id: string) => DOC_GROUPS.find((g) => g.id === id)!.anchors;
    expect(anchorsOf("selectors")).toEqual(expect.arrayContaining(["selector-type", "selector-nesting", "selector-important"]));
    expect(anchorsOf("combinators")).toEqual(["selector-descendant", "selector-child", "selector-adjacent", "selector-sibling"]);
    expect(anchorsOf("pseudo-classes")).toEqual(expect.arrayContaining(["selector-hover", "selector-has", "selector-face"]));
  });
  it("never shows two entries under the same name, in the contents or as a page title", () => {
    const root = document.createElement("div");
    root.innerHTML = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
    const labels = [...root.querySelectorAll(".toc li a")].map((a) => a.textContent);
    expect(labels.filter((label, i) => labels.indexOf(label) !== i)).toEqual([]);
    const titles = [...root.querySelectorAll("article > h3")].map((h) => h.textContent);
    expect(titles.filter((title, i) => titles.indexOf(title) !== i)).toEqual([]);
    // The sun and a point light: the same name, in two pages that say which one they are
    expect(root.querySelector('.toc a[href="#light"]')!.textContent).toBe("light (sun)");
    expect(root.querySelector('.toc a[href="#shape-light"]')!.textContent).toBe("light (point)");
    expect(root.querySelector("#shape-light > h3")!.textContent).toBe("light (point)");
  });
  it("puts embedding first under Installation and includes versioned setup instructions", () => {
    const html = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
    const installation = html.slice(html.indexOf('<section id="installation"'), html.indexOf('<section id="at-rules"'));
    expect(installation).toContain('id="embedding"');
    expect(installation.indexOf('id="embedding"')).toBeLessThan(installation.indexOf('id="install-package"'));
    expect(installation).toContain(`gss-lang@${VERSION}`);
    expect(installation).toContain(CDN_URL);
    expect(installation).toContain("gss-lang/runtime");
    expect(installation).toContain("gss-lang/vite");
    // Set variables from JavaScript: last, after the three ways to install
    expect(installation.indexOf('id="set-variables"')).toBeGreaterThan(installation.indexOf('id="install-cdn"'));
    expect(html).not.toContain('id="other-reference"');
  });
  it("says at the top of Installation where the source code and the issues are", () => {
    const html = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
    const installation = html.slice(html.indexOf('<section id="installation"'), html.indexOf('<section id="at-rules"'));
    const embedding = installation.slice(0, installation.indexOf('id="install-package"'));
    expect(embedding).toContain('href="https://github.com/LukyVj/GSS"');
    expect(embedding).toContain('href="https://github.com/LukyVj/GSS/issues"');
  });
  it("ends Installation with the editor extension: where to get it, and how to install it", () => {
    const html = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
    const installation = html.slice(html.indexOf('<section id="installation"'), html.indexOf('<section id="at-rules"'));
    const editor = installation.slice(installation.indexOf('id="editor-support"'));
    expect(installation.indexOf('id="editor-support"')).toBeGreaterThan(installation.indexOf('id="set-variables"'));
    expect(editor).toContain("https://marketplace.visualstudio.com/items?itemName=lukyvj.gss-language");
    expect(editor).toContain("https://open-vsx.org/extension/lukyvj/gss-language");
    expect(editor).toContain("code --install-extension lukyvj.gss-language");
  });
});
