// What the search shows around its list (decisions 125, 126). Before a word is typed, the middle
// says where to start, the pages the newest version added and the searches people make the
// most; around it, two columns stay while the reader searches: the contents of the docs on
// the left, and four ideas of GSS, drawn small, on the right. DocSearch has no option for
// any of it: the panels go into its modal, around its list.
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";
import { GETTING_STARTED, INSTALLATION } from "./guide";
import { groupEntries, qualified } from "./navigation";
import { ALGOLIA, SUGGESTIONS_INDEX } from "./search";
import { CONCEPTS } from "./concepts";

export type DocEntry = { anchor: string; label: string; group: string; since?: string };
export type DocSection = { id: string; title: string; category: string; entries: DocEntry[] };
export type StartPage = { anchor: string; label: string; group: string };
export type News = { version: string; pages: StartPage[] };

// The groups of the docs, in the order of the docs, each page named like the contents name it
export function docSections(): DocSection[] {
  const entries = [
    ...[...GETTING_STARTED, ...INSTALLATION].map((entry) => ({ anchor: entry.anchor, label: entry.label, since: entry.since })),
    ...AT_RULES.map((atRule) => ({ anchor: `at-${atRule.name}`, label: `@${atRule.name}`, since: atRule.since })),
    ...SELECTORS.map((selector) => ({ anchor: selector.anchor, label: selector.name, since: selector.since })),
    ...FUNCTIONS.map((fn) => ({ anchor: fn.anchor, label: fn.name, since: fn.since })),
    ...SHAPE_DOCS.map((shape) => ({ anchor: `shape-${shape.name}`, label: shape.name, since: shape.since })),
    ...PROPERTIES.map((property) => ({ anchor: property.name, label: property.name, since: property.since })),
  ];
  const since = new Map(entries.map((entry) => [entry.anchor, entry.since]));
  return groupEntries(entries.map((entry) => ({ anchor: entry.anchor, label: qualified(entry.anchor, entry.label), html: "" }))).map(
    (group) => ({
      id: group.id,
      title: group.title,
      category: group.category,
      entries: group.entries.map((entry) => {
        const version = since.get(entry.anchor);
        return { anchor: entry.anchor, label: entry.label, group: group.title, ...(version ? { since: version } : {}) };
      }),
    }),
  );
}

// Every page of the docs, in the order of the docs
export function docEntries(): DocEntry[] {
  return docSections().flatMap((section) => section.entries);
}

// "0.0.10" comes after "0.0.9"
export function compareVersions(a: string, b: string): number {
  const [x, y] = [a, b].map((version) => version.split(".").map(Number));
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const difference = (x[i] ?? 0) - (y[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

// The pages of the newest version that added pages
export function newestPages(entries: DocEntry[]): News | null {
  const versions = entries.flatMap((entry) => (entry.since ? [entry.since] : []));
  if (!versions.length) return null;
  const version = versions.reduce((newest, other) => (compareVersions(other, newest) > 0 ? other : newest));
  const pages = entries
    .filter((entry) => entry.since === version)
    .map(({ anchor, label, group }) => ({ anchor, label, group }));
  return { version, pages };
}

// Where to start: the first pages of the docs, each with what it holds, then the other pages of the site
export const START_PAGES: { anchor: string; label: string; text: string }[] = [
  { anchor: "why-gss", label: "Why GSS", text: "What GSS is, and why it reads like CSS." },
  { anchor: "first-scene", label: "Your first scene", text: "A glass ball above the floor, to edit live." },
  { anchor: "embedding", label: "Embedding a scene", text: "A scene on your own page: a tag, a function or a build step." },
];
export const SITE_LINKS: { label: string; href: string }[] = [
  { label: "open the playground →", href: "./playground.html" },
  { label: "see the showcase →", href: "./showcase.html" },
];

// The queries of a Query Suggestions index, the most searched first
export function parseSuggestions(json: unknown): string[] {
  const hits = (json as { hits?: unknown } | null)?.hits;
  if (!Array.isArray(hits)) return [];
  return hits
    .map((hit) => (typeof hit?.query === "string" ? hit.query.trim() : ""))
    .filter(Boolean);
}

// None when the index does not exist yet, or the network fails: the panel goes without them
export async function popularSearches(fetcher: typeof fetch = fetch, count = 6): Promise<string[]> {
  try {
    const response = await fetcher(
      `https://${ALGOLIA.appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(SUGGESTIONS_INDEX)}/query`,
      {
        method: "POST",
        headers: { "X-Algolia-Application-Id": ALGOLIA.appId, "X-Algolia-API-Key": ALGOLIA.apiKey },
        body: JSON.stringify({ query: "", hitsPerPage: count }),
      },
    );
    if (!response.ok) return [];
    return parseSuggestions(await response.json()).slice(0, count);
  } catch {
    return [];
  }
}

// ----- In the page -----

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(className: string, href: string, ...children: (Node | string)[]): HTMLAnchorElement {
  const a = element("a", className);
  a.href = href;
  a.append(...children);
  return a;
}

function section(className: string, title: string, ...children: Node[]): HTMLElement {
  const node = element("section", `gss-search-start-section ${className}`);
  node.append(element("div", "gss-search-start-title", title), ...children);
  return node;
}

// A link to a page of the docs stays on the page when it is the docs page
const docsHref = (onDocs: boolean) => (anchor: string) => (onDocs ? `#${anchor}` : `./docs.html#${anchor}`);

// "/playground" is "./playground.html" on the site: not the page the reader is on
const elsewhere = (href: string) => {
  const page = (path: string) => path.replace(/\.html$/, "").replace(/\/index$/, "/");
  return page(new URL(href, location.href).pathname) !== page(location.pathname);
};

// The four ideas, each a drawing, a title, a sentence and its page
function conceptCards(onDocs: boolean): HTMLElement[] {
  const docs = docsHref(onDocs);
  return CONCEPTS.map((concept) => {
    const card = element("article", "gss-concept");
    const figure = element("div", "gss-concept-figure");
    figure.innerHTML = concept.svg; // written in concepts.ts, not read from anywhere
    card.append(
      figure,
      element("h3", "gss-concept-title", concept.title),
      element("p", "gss-concept-text", concept.text),
      link("gss-concept-link", docs(concept.anchor), `${concept.link} →`),
    );
    return card;
  });
}

// The middle, before a word is typed
export function renderStartScreen({ news, popular, onDocs }: { news: News | null; popular: string[]; onDocs: boolean }): HTMLElement {
  const docs = docsHref(onDocs);
  const panel = element("div", "gss-search-start");

  const intro = element("div", "gss-search-start-intro");
  intro.append(
    element("h2", "gss-search-start-heading", "The reference"),
    element("p", "gss-search-start-lead", `${docEntries().length} pages: every at-rule, selector, function, shape and property of GSS, each with examples to try.`),
  );
  panel.append(intro);

  const pages = element("div", "gss-search-start-pages");
  pages.append(
    ...START_PAGES.map((page) =>
      link("gss-search-start-page", docs(page.anchor), element("span", "gss-search-start-page-label", page.label), element("span", "gss-search-start-page-text", page.text)),
    ),
  );
  const site = element("div", "gss-search-start-site");
  site.append(...SITE_LINKS.filter((item) => elsewhere(item.href)).map((item) => link("gss-search-start-site-link", item.href, item.label)));
  panel.append(section("gss-search-start-here", "Start here", pages, site));

  if (news?.pages.length) {
    const list = element("div", "gss-search-start-list");
    list.append(
      ...news.pages.map((page) =>
        link("gss-search-start-item", docs(page.anchor), element("span", "gss-search-start-item-label", page.label), element("span", "gss-search-count", page.group)),
      ),
    );
    panel.append(section("gss-search-start-new", `New in ${news.version}`, list));
  }

  if (popular.length) {
    const chips = element("div", "gss-search-start-chips");
    chips.append(
      ...popular.map((query) => {
        const button = element("button", "gss-search-start-chip", query);
        button.type = "button";
        button.dataset.query = query;
        return button;
      }),
    );
    panel.append(section("gss-search-start-popular", "Popular searches", chips));
  }

  // On a phone the concepts have no column: they come last, in the middle
  const concepts = element("div", "gss-search-start-concepts");
  concepts.append(...conceptCards(onDocs));
  panel.append(section("gss-search-start-ideas", "How GSS works", concepts));
  return panel;
}

// The left column: every group of the docs, under its category, with its number of pages
export function renderContents(sections: DocSection[], onDocs: boolean): HTMLElement {
  const docs = docsHref(onDocs);
  const column = element("nav", "gss-search-contents");
  column.setAttribute("aria-label", "Contents of the docs");
  sections.forEach((group, i) => {
    if (group.category !== sections[i - 1]?.category) column.append(element("div", "gss-search-start-title", group.category));
    column.append(
      link("gss-search-contents-link", docs(group.entries[0].anchor), element("span", "gss-search-contents-label", group.title), element("span", "gss-search-count", String(group.entries.length))),
    );
  });
  return column;
}

// The right column: how GSS works, in four drawings
export function renderConcepts(onDocs: boolean): HTMLElement {
  const column = element("aside", "gss-search-concepts");
  column.setAttribute("aria-label", "How GSS works");
  column.append(element("div", "gss-search-start-title", "How GSS works"), ...conceptCards(onDocs));
  return column;
}

export type StartPanels = { contents: HTMLElement; center: HTMLElement; concepts: HTMLElement };

// The columns go around the list of DocSearch and stay; the middle shows while the search box
// is empty: in the list of DocSearch when it shows one (the recent searches), else in its place
export function placeStartScreen(modal: HTMLElement, { contents, center, concepts }: StartPanels): void {
  const bar = modal.querySelector(".DocSearch-SearchBar");
  const footer = modal.querySelector(".DocSearch-Footer");
  if (bar && bar.nextElementSibling !== contents) bar.after(contents);
  if (footer && footer.previousElementSibling !== concepts) footer.before(concepts);

  const input = modal.querySelector<HTMLInputElement>(".DocSearch-Input");
  if (input && input.value.trim() !== "") {
    center.remove();
    return;
  }
  const dropdown = modal.querySelector<HTMLElement>(":scope > .DocSearch-Dropdown");
  center.classList.toggle("gss-search-start--alone", !dropdown);
  if (dropdown) {
    if (dropdown.lastElementChild !== center) dropdown.append(center);
  } else if (concepts.previousElementSibling !== center) concepts.before(center);
}

// Types a query in the search box, as if the reader had typed it
function search(modal: HTMLElement, query: string): void {
  const input = modal.querySelector<HTMLInputElement>(".DocSearch-Input");
  if (!input) return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, query);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
}

export function mountStartScreen(docsearch: { close(): void }): void {
  const sections = docSections();
  const news = newestPages(sections.flatMap((section) => section.entries));
  const onDocs = document.querySelector("#docs") !== null;
  let popular: Promise<string[]> | null = null;

  function attach(): void {
    const modal = document.querySelector<HTMLElement>(".DocSearch-Modal");
    if (!modal || modal.querySelector(".gss-search-contents")) return;
    const panels: StartPanels = {
      contents: renderContents(sections, onDocs),
      center: renderStartScreen({ news, popular: [], onDocs }),
      concepts: renderConcepts(onDocs),
    };
    const place = () => placeStartScreen(modal, panels);
    place();
    new MutationObserver(place).observe(modal, { childList: true, subtree: true });
    modal.addEventListener("input", place);
    modal.addEventListener("click", (event) => {
      const target = event.target as Element;
      const query = target.closest<HTMLElement>(".gss-search-start [data-query]")?.dataset.query;
      if (query) return search(modal, query);
      const a = target.closest<HTMLAnchorElement>(".gss-search-start a, .gss-search-contents a, .gss-search-concepts a");
      if (!a || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      // DocSearch puts the page back where it was when it closes: close it, then go
      event.preventDefault();
      docsearch.close();
      setTimeout(() => location.assign(a.href));
    });
    popular ??= popularSearches();
    popular.then((queries) => {
      if (!queries.length) return;
      const filled = renderStartScreen({ news, popular: queries, onDocs });
      if (panels.center.parentElement) panels.center.replaceWith(filled);
      panels.center = filled;
      place();
    });
  }

  // DocSearch adds its modal at the end of the body each time it opens
  new MutationObserver(attach).observe(document.body, { childList: true });
}
