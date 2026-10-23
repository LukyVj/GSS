/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { githubDocs } from "./github-docs";

// The docs on GitHub (docs/*.md) are generated from the reference of the site.
// `npm run docs:github` writes them again.
const committed = import.meta.glob<string>("../../docs/*.md", { query: "?raw", import: "default", eager: true });
const readme = import.meta.glob<string>("../../README.md", { query: "?raw", import: "default", eager: true })["../../README.md"] ?? "";
const docs = githubDocs();
const pages = [...docs.keys()];

// The links of a page: [text](target), outside the blocks of code
function links(markdown: string): string[] {
  const prose = markdown.replace(/^```[\s\S]*?^```/gm, "");
  return [...prose.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
}
const anchors = (markdown: string) => new Set([...markdown.matchAll(/<a name="([^"]+)"><\/a>/g)].map((m) => m[1]));

describe("the docs on GitHub", () => {
  it("has an index and one page per section of the reference", () => {
    expect(pages[0]).toBe("README.md");
    expect(pages).toContain("getting-started.md");
    expect(pages).toContain("installation.md");
    expect(pages).toContain("selectors.md");
    expect(pages).toContain("materials.md");
    for (const page of pages.slice(1)) expect(docs.get("README.md")).toContain(`](${page})`);
  });

  it("is up to date: `npm run docs:github` writes it again", async () => {
    for (const [page, markdown] of docs) await expect(markdown).toMatchFileSnapshot(`../../docs/${page}`);
  });

  it("keeps no page the reference no longer has", () => {
    for (const path of Object.keys(committed)) expect(pages).toContain(path.replace("../../docs/", ""));
  });

  it("starts with the first scene, then the three ways to put it on a page", () => {
    const start = docs.get("getting-started.md") ?? "";
    expect(start).toMatch(/^# Getting started/m);
    expect(start).toContain("## Your first scene");
    expect(start).toContain("@scene");
    const install = docs.get("installation.md") ?? "";
    expect(install).toContain("<gss-scene");
    expect(install).toContain("npm install gss-lang");
    expect(install).toContain("gss-lang/vite");
  });

  it("puts each entry under its own title, with the anchor of the site", () => {
    const materials = docs.get("materials.md") ?? "";
    expect(materials).toContain('<a name="material"></a>');
    expect(materials).toMatch(/^## `material`$/m);
    expect(docs.get("at-rules.md")).toContain('<a name="at-scene"></a>');
  });

  it("links each page to an anchor that exists, and the rest to the site", () => {
    for (const [page, markdown] of docs) {
      for (const target of links(markdown)) {
        if (/^https:\/\//.test(target)) continue;
        const [file, anchor] = target.split("#");
        const other = file ? docs.get(file) : markdown;
        expect(other, `${page}: ${target}`).toBeDefined();
        if (anchor) expect(anchors(other!).has(anchor), `${page}: ${target}`).toBe(true);
      }
    }
  });

  it("shows the code in blocks GitHub colours, formatted, without the buttons of the site", () => {
    for (const markdown of docs.values()) {
      expect(markdown).not.toContain("```gss");
      expect(markdown).not.toMatch(/^Try it$/m);
    }
    // The first scene is written on one line in the source: the page shows it formatted
    expect(docs.get("getting-started.md")).toMatch(/```css\n@scene \{\n/);
  });

  it("never mentions how we work: decisions, roadmap, design notes, paths of the repo", () => {
    for (const markdown of docs.values()) {
      for (const internal of ["DECISIONS", "ROADMAP", "DESIGN.md", "decision ", "src/", "editors/"]) {
        expect(markdown).not.toContain(internal);
      }
    }
  });

  it("is where the README sends a reader who starts", () => {
    expect(readme).toContain("docs/getting-started.md");
    expect(readme).toContain("docs/installation.md");
    expect(readme).toContain("docs/README.md");
  });
});
