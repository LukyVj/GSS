// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  compareVersions,
  docEntries,
  newestPages,
  parseSuggestions,
  popularSearches,
  renderStartScreen,
  START_HERE,
} from "./start-screen";
import { renderDocs } from "./render";
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";
import { ALGOLIA, SUGGESTIONS_INDEX } from "./search";

const docs = document.createElement("div");
docs.innerHTML = renderDocs(PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS);
const pages = [...docs.querySelectorAll("article")].map((article) => article.id);

describe("the pages of the docs, for the start screen of the search", () => {
  it("are every page of the docs, in the order of the docs", () => {
    expect(docEntries().map((entry) => entry.anchor)).toEqual(pages);
  });

  it("name a page like the contents do", () => {
    const light = docEntries().find((entry) => entry.anchor === "shape-light")!;
    expect(light).toMatchObject({ label: "light (point)", group: "Lighting and fog" });
    expect(docEntries().find((entry) => entry.anchor === "at-property")!.label).toBe("@property");
  });

  it("each say, in a version written like 0.0.4, when it came", () => {
    for (const entry of docEntries()) {
      if (entry.since !== undefined) expect(entry.since, entry.anchor).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});

describe("what is new", () => {
  it("compares versions by their numbers", () => {
    expect(compareVersions("0.0.10", "0.0.9")).toBeGreaterThan(0);
    expect(compareVersions("0.1.0", "0.0.12")).toBeGreaterThan(0);
    expect(compareVersions("0.0.4", "0.0.4")).toBe(0);
  });

  it("is the pages of the newest version that added pages, in the order of the docs", () => {
    const entries = [
      { anchor: "a", label: "a", group: "A", since: "0.0.3" },
      { anchor: "b", label: "b", group: "A" },
      { anchor: "c", label: "c", group: "B", since: "0.0.10" },
      { anchor: "d", label: "d", group: "B", since: "0.0.9" },
      { anchor: "e", label: "e", group: "C", since: "0.0.10" },
    ];
    expect(newestPages(entries)).toEqual({
      version: "0.0.10",
      pages: [
        { anchor: "c", label: "c", group: "B" },
        { anchor: "e", label: "e", group: "C" },
      ],
    });
    expect(newestPages([{ anchor: "b", label: "b", group: "A" }])).toBeNull();
  });

  it("is the 15 pages 0.0.4 added", () => {
    const news = newestPages(docEntries())!;
    expect(news.version).toBe("0.0.4");
    expect(news.pages.map((page) => page.anchor).sort()).toEqual(
      [
        "set-variables", "at-property", "selector-nesting", "background-blend-mode", "fn-displace",
        "fn-noise", "fn-element", "mask-image", "mask-mode", "opacity", "transform-origin", "fog",
        "intensity", "shape-light", "shadows",
      ].sort(),
    );
  });
});

describe("the popular searches", () => {
  it("are the queries of the suggestions index, as Algolia gives them", () => {
    expect(parseSuggestions({ hits: [{ query: "glass" }, { query: " hover " }, { query: "" }, {}] })).toEqual(["glass", "hover"]);
    expect(parseSuggestions({ message: "Index does not exist", status: 404 })).toEqual([]);
    expect(parseSuggestions(null)).toEqual([]);
  });

  it("ask the suggestions index, and are none when it cannot answer", async () => {
    const asked: { url: string; init?: RequestInit }[] = [];
    const answer = (body: unknown, status = 200) => async (url: string | URL | Request, init?: RequestInit) => {
      asked.push({ url: String(url), init });
      return new Response(JSON.stringify(body), { status });
    };
    expect(await popularSearches(answer({ hits: [{ query: "glass" }] }))).toEqual(["glass"]);
    expect(asked[0].url).toBe(`https://${ALGOLIA.appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(SUGGESTIONS_INDEX)}/query`);
    expect((asked[0].init?.headers as Record<string, string>)["X-Algolia-API-Key"]).toBe(ALGOLIA.apiKey);
    expect(await popularSearches(answer({ message: "Index does not exist" }, 404))).toEqual([]);
    expect(await popularSearches(async () => { throw new TypeError("offline"); })).toEqual([]);
  });
});

describe("the start screen", () => {
  const news = { version: "0.0.4", pages: [{ anchor: "opacity", label: "opacity", group: "Opacity and masks" }] };

  it("links each new page to the docs, by its anchor on the docs page itself", () => {
    const away = renderStartScreen({ news, popular: [], onDocs: false });
    expect(away.querySelector<HTMLAnchorElement>('a[href="./docs.html#opacity"]')?.textContent).toContain("opacity");
    expect([...away.querySelectorAll(".gss-search-start-title")].map((title) => title.textContent)).toContain("New in 0.0.4");
    const here = renderStartScreen({ news, popular: [], onDocs: true });
    expect(here.querySelector('a[href="#opacity"]')).not.toBeNull();
  });

  it("starts with the pages to start from, each to an existing page", () => {
    const panel = renderStartScreen({ news: null, popular: [], onDocs: false });
    const links = [...panel.querySelectorAll<HTMLAnchorElement>("a")].map((a) => a.getAttribute("href"));
    expect(links).toEqual(START_HERE.map((link) => link.href ?? `./docs.html#${link.anchor}`));
    for (const link of START_HERE) if (link.anchor) expect(pages, link.anchor).toContain(link.anchor);
  });

  it("leaves out the page the reader is on", () => {
    const before = location.href;
    history.replaceState(null, "", "/playground");
    const links = [...renderStartScreen({ news: null, popular: [], onDocs: false }).querySelectorAll("a")];
    history.replaceState(null, "", before);
    expect(links.map((a) => a.textContent)).not.toContain("Playground");
    expect(links.map((a) => a.textContent)).toContain("Showcase");
  });

  it("shows the popular searches as buttons, only when there are some", () => {
    expect(renderStartScreen({ news, popular: [], onDocs: false }).querySelector("button")).toBeNull();
    const panel = renderStartScreen({ news, popular: ["glass", "hover"], onDocs: false });
    expect([...panel.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["glass", "hover"]);
    expect([...panel.querySelectorAll(".gss-search-start-title")].map((title) => title.textContent)).toEqual([
      "Start here",
      "New in 0.0.4",
      "Popular searches",
    ]);
  });
});
