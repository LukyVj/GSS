// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  compareVersions,
  docEntries,
  docSections,
  newestPages,
  parseSuggestions,
  placeStartScreen,
  popularSearches,
  renderConcepts,
  renderContents,
  renderStartScreen,
  SITE_LINKS,
  START_PAGES,
} from "./start-screen";
import { CONCEPTS } from "./concepts";
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
    expect(newestPages(entries, "0.0.10")).toEqual({
      version: "0.0.10",
      pages: [
        { anchor: "c", label: "c", group: "B" },
        { anchor: "e", label: "e", group: "C" },
      ],
    });
    expect(newestPages([{ anchor: "b", label: "b", group: "A" }], "0.0.10")).toBeNull();
  });

  it("leaves out a version not published yet: the pages wait for the package to have it", () => {
    const entries = [
      { anchor: "a", label: "a", group: "A", since: "0.0.4" },
      { anchor: "b", label: "b", group: "A", since: "0.0.5" },
    ];
    expect(newestPages(entries, "0.0.4")).toEqual({ version: "0.0.4", pages: [{ anchor: "a", label: "a", group: "A" }] });
    expect(newestPages(entries, "0.0.5")).toEqual({ version: "0.0.5", pages: [{ anchor: "b", label: "b", group: "A" }] });
    expect(newestPages([entries[1]], "0.0.4")).toBeNull();
  });

  it("gives @property-panel to the next version", () => {
    expect(docEntries().find((entry) => entry.anchor === "at-property-panel")?.since).toBe("0.0.5");
  });

  it("is the 20 pages 0.0.6 added", () => {
    const news = newestPages(docEntries())!;
    expect(news.version).toBe("0.0.6");
    expect(news.pages.map((page) => page.anchor).sort()).toEqual(
      [
        "animation-range", "animation-range-end", "animation-range-start", "at-paint", "cursor", "display",
        "editor-support", "fn-checker", "fn-paint", "fn-stripes", "outline", "outline-color", "outline-offset",
        "outline-style", "outline-width", "shape-octahedron", "shape-pyramid", "shape-rendering", "shape-tube", "visibility",
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
  const center = (options: { news?: typeof news | null; popular?: string[]; onDocs?: boolean } = {}) =>
    renderStartScreen({ news: options.news === undefined ? news : options.news, popular: options.popular ?? [], onDocs: options.onDocs ?? false });
  const titles = (element: HTMLElement) =>
    [...element.querySelectorAll(".gss-search-start-title")].map((title) => title.textContent);

  it("says how many pages the reference has", () => {
    expect(center().querySelector(".gss-search-start-lead")?.textContent).toContain(`${pages.length} pages`);
  });

  it("starts with the first pages, each with what it holds, then the other pages of the site", () => {
    const panel = center({ news: null });
    const rows = [...panel.querySelectorAll<HTMLAnchorElement>(".gss-search-start-here a")];
    expect(rows.map((a) => a.getAttribute("href"))).toEqual([
      ...START_PAGES.map((page) => `./docs.html#${page.anchor}`),
      ...SITE_LINKS.map((link) => link.href),
    ]);
    for (const page of START_PAGES) {
      expect(pages, page.anchor).toContain(page.anchor);
      expect(page.text.length).toBeGreaterThan(10);
    }
    expect(panel.querySelector(".gss-search-start-here")?.textContent).toContain(START_PAGES[0].text);
  });

  it("leaves out the page the reader is on", () => {
    const before = location.href;
    history.replaceState(null, "", "/playground");
    const links = [...center().querySelectorAll(".gss-search-start-here a")];
    history.replaceState(null, "", before);
    expect(links.map((a) => a.textContent)).not.toContain("open the playground →");
    expect(links.map((a) => a.textContent)).toContain("see the showcase →");
  });

  it("links each new page to the docs, by its anchor on the docs page itself", () => {
    const away = center();
    const link = away.querySelector<HTMLAnchorElement>('.gss-search-start-new a[href="./docs.html#opacity"]')!;
    expect(link.textContent).toContain("opacity");
    expect(link.textContent).toContain("Opacity and masks");
    expect(center({ onDocs: true }).querySelector('.gss-search-start-new a[href="#opacity"]')).not.toBeNull();
  });

  it("shows the popular searches as buttons, only when there are some", () => {
    expect(center().querySelector("button[data-query]")).toBeNull();
    const panel = center({ popular: ["glass", "hover"] });
    expect([...panel.querySelectorAll("button[data-query]")].map((button) => button.textContent)).toEqual(["glass", "hover"]);
    expect(titles(panel)).toEqual(["Start here", "New in 0.0.4", "Popular searches", "How GSS works"]);
  });
});

describe("the contents of the search", () => {
  it("list every group of the docs, in its order, under its category, with its number of pages", () => {
    const sections = docSections();
    const contents = renderContents(sections, false);
    const rows = [...contents.querySelectorAll<HTMLAnchorElement>("a")];
    expect(rows.map((a) => a.getAttribute("href"))).toEqual(sections.map((section) => `./docs.html#${section.entries[0].anchor}`));
    expect(rows.map((a) => a.querySelector(".gss-search-count")?.textContent)).toEqual(sections.map((section) => String(section.entries.length)));
    expect(sections.reduce((sum, section) => sum + section.entries.length, 0)).toBe(pages.length);
    const categories = [...contents.querySelectorAll(".gss-search-start-title")].map((title) => title.textContent);
    expect(categories).toEqual([...new Set(sections.map((section) => section.category))]);
    expect(renderContents(sections, true).querySelector("a")?.getAttribute("href")).toBe(`#${sections[0].entries[0].anchor}`);
  });
});

describe("the concepts of the search", () => {
  it("draw each idea with a description for screen readers, and link to its page", () => {
    const column = renderConcepts(false);
    expect(column.querySelectorAll(".gss-concept")).toHaveLength(CONCEPTS.length);
    for (const concept of CONCEPTS) {
      expect(pages, concept.anchor).toContain(concept.anchor);
      const svg = concept.svg;
      expect(svg).toMatch(/role="img" aria-label="[^"]{20,}"/);
    }
    expect(column.querySelector<HTMLAnchorElement>(".gss-concept a")?.getAttribute("href")).toBe(`./docs.html#${CONCEPTS[0].anchor}`);
  });
});

// DocSearch builds its modal; the panels go around its list, and only the middle one leaves
describe("the panels in the modal of DocSearch", () => {
  const modal = () => {
    const element = document.createElement("div");
    element.className = "DocSearch-Modal";
    element.innerHTML =
      '<header class="DocSearch-SearchBar"><input class="DocSearch-Input"></header><footer class="DocSearch-Footer"></footer>';
    return element;
  };
  const parts = () => ({
    contents: renderContents(docSections(), false),
    center: renderStartScreen({ news: null, popular: [], onDocs: false }),
    concepts: renderConcepts(false),
  });
  const order = (element: HTMLElement) => [...element.children].map((child) => child.className.split(" ")[0]);

  it("go around the search box: contents, the start screen, concepts, then the footer", () => {
    const element = modal();
    placeStartScreen(element, parts());
    expect(order(element)).toEqual(["DocSearch-SearchBar", "gss-search-contents", "gss-search-start", "gss-search-concepts", "DocSearch-Footer"]);
  });

  it("put the start screen under the list of DocSearch when it shows one", () => {
    const element = modal();
    element.querySelector("header")!.insertAdjacentHTML("afterend", '<div class="DocSearch-Dropdown"><div class="DocSearch-Dropdown-Container"></div></div>');
    const panels = parts();
    placeStartScreen(element, panels);
    expect(panels.center.parentElement?.className).toBe("DocSearch-Dropdown");
    expect(panels.center.previousElementSibling?.className).toBe("DocSearch-Dropdown-Container");
  });

  it("keep the columns while a word is typed, and take the start screen away", () => {
    const element = modal();
    const panels = parts();
    placeStartScreen(element, panels);
    element.querySelector<HTMLInputElement>(".DocSearch-Input")!.value = "glass";
    placeStartScreen(element, panels);
    expect(order(element)).toEqual(["DocSearch-SearchBar", "gss-search-contents", "gss-search-concepts", "DocSearch-Footer"]);
  });
});
