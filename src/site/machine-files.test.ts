import { describe, it, expect } from "vitest";
import { machineFiles, SITE_PAGES } from "./machine-files";
import { PROPERTIES, SELECTORS, SHAPE_DOCS } from "../compiler/registry/registry";
import { VERSION } from "../version";

// The files the site serves to crawlers and language models, written at build
const files = machineFiles();
const indexHtml = import.meta.glob<string>("../../index.html", { query: "?raw", import: "default", eager: true })[
  "../../index.html"
] ?? "";
const githubDocs = import.meta.glob<string>("../../docs/*.md", { query: "?raw", import: "default", eager: true });

const text = (html: string) =>
  html
    .replace(/<br\s*\/?>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

describe("the sitemap", () => {
  const sitemap = files.get("sitemap.xml") ?? "";

  it("lists every page of the site by its canonical URL", () => {
    expect(sitemap).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    for (const page of SITE_PAGES) expect(sitemap).toContain(`<loc>https://www.gss-lang.dev${page}</loc>`);
  });

  it("uses the canonical URL each page declares", async () => {
    const pages = import.meta.glob<string>("../../*.html", { query: "?raw", import: "default", eager: true });
    const canonicals = Object.values(pages)
      .map((html) => html.match(/<link rel="canonical" href="https:\/\/www\.gss-lang\.dev([^"]*)"/)?.[1])
      .filter((path): path is string => path !== undefined);
    expect(canonicals.length).toBeGreaterThan(0);
    for (const path of canonicals) expect(SITE_PAGES).toContain(path);
  });
});

describe("llms.txt", () => {
  const llms = files.get("llms.txt") ?? "";

  it("follows the llms.txt layout: a title, a summary, then sections of links", () => {
    expect(llms).toMatch(/^# GSS \(GPU Style Sheets\)\n\n> /);
    expect(llms).toContain("\n## Start here\n");
    expect(llms).toContain("\n## Optional\n");
  });

  it("links every page of the docs as Markdown on the site", () => {
    for (const path of Object.keys(githubDocs)) {
      const page = path.replace("../../docs/", "");
      if (page === "README.md") continue;
      expect(llms).toContain(`](https://www.gss-lang.dev/docs/${page})`);
      expect(files.has(`docs/${page}`)).toBe(true);
    }
    expect(llms).not.toMatch(/\]\((?!https:)/);
  });

  it("has every page of the docs in one file too", () => {
    const full = files.get("llms-full.txt") ?? "";
    expect(full).toMatch(/^# GSS \(GPU Style Sheets\)/);
    expect(full).toContain("# Getting started");
    expect(full).toContain("# Materials");
    expect(full).not.toContain("do not edit by hand");
  });
});

describe("the home page in Markdown", () => {
  const home = files.get("index.md") ?? "";

  it("says what the home page says, heading by heading", () => {
    const headings = [...indexHtml.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/g)].map((m) => text(m[1]));
    expect(headings.length).toBeGreaterThan(5);
    for (const heading of headings) expect(home).toContain(heading);
  });

  it("gives the counts of the registry and the current version", () => {
    expect(home).toContain(`${SHAPE_DOCS.length} shapes`);
    expect(home).toContain(`${PROPERTIES.length} properties`);
    expect(home).toContain(`${SELECTORS.length} selectors`);
    expect(home).toContain(`npm install gss-lang@${VERSION}`);
    expect(home).not.toContain("%GSS_VERSION%");
  });

  it("links with absolute URLs", () => {
    expect(home).not.toMatch(/\]\((?!https:)/);
  });
});
