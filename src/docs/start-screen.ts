// What the search shows before a word is typed (decision 125): where to start, the pages the
// newest version added, and the searches people make the most. DocSearch has no option for
// it: the panel goes into its modal, under the search box, and leaves as soon as a word is typed.
import { PROPERTIES, AT_RULES, SELECTORS, SHAPE_DOCS, FUNCTIONS } from "../compiler/registry/registry";
import { GETTING_STARTED, INSTALLATION } from "./guide";
import { groupEntries, qualified } from "./navigation";
import { ALGOLIA, SUGGESTIONS_INDEX } from "./search";

export type DocEntry = { anchor: string; label: string; group: string; since?: string };
export type StartPage = { anchor: string; label: string; group: string };
export type News = { version: string; pages: StartPage[] };

// Every page of the docs, in the order of the docs, named like the contents name it
export function docEntries(): DocEntry[] {
  const entries = [
    ...[...GETTING_STARTED, ...INSTALLATION].map((entry) => ({ anchor: entry.anchor, label: entry.label, since: entry.since })),
    ...AT_RULES.map((atRule) => ({ anchor: `at-${atRule.name}`, label: `@${atRule.name}`, since: atRule.since })),
    ...SELECTORS.map((selector) => ({ anchor: selector.anchor, label: selector.name, since: selector.since })),
    ...FUNCTIONS.map((fn) => ({ anchor: fn.anchor, label: fn.name, since: fn.since })),
    ...SHAPE_DOCS.map((shape) => ({ anchor: `shape-${shape.name}`, label: shape.name, since: shape.since })),
    ...PROPERTIES.map((property) => ({ anchor: property.name, label: property.name, since: property.since })),
  ];
  const since = new Map(entries.map((entry) => [entry.anchor, entry.since]));
  return groupEntries(entries.map((entry) => ({ anchor: entry.anchor, label: qualified(entry.anchor, entry.label), html: "" }))).flatMap(
    (group) =>
      group.entries.map((entry) => {
        const version = since.get(entry.anchor);
        return { anchor: entry.anchor, label: entry.label, group: group.title, ...(version ? { since: version } : {}) };
      }),
  );
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

// Where to start: the first pages of the docs, then the other pages of the site
export const START_HERE: { label: string; anchor?: string; href?: string }[] = [
  { label: "Why GSS", anchor: "why-gss" },
  { label: "Your first scene", anchor: "first-scene" },
  { label: "Embedding a scene", anchor: "embedding" },
  { label: "Playground", href: "./playground.html" },
  { label: "Showcase", href: "./showcase.html" },
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

function section(title: string, list: HTMLElement): HTMLElement {
  const element = document.createElement("section");
  element.className = "gss-search-start-section";
  const heading = document.createElement("div");
  heading.className = "gss-search-start-title";
  heading.textContent = title;
  element.append(heading, list);
  return element;
}

function chip(tag: "a" | "button", text: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = "gss-search-start-chip";
  element.textContent = text;
  return element;
}

function chips(items: HTMLElement[]): HTMLElement {
  const list = document.createElement("div");
  list.className = "gss-search-start-chips";
  list.append(...items);
  return list;
}

// The panel. A link to a page of the docs stays on the page when it is the docs page.
export function renderStartScreen({ news, popular, onDocs }: { news: News | null; popular: string[]; onDocs: boolean }): HTMLElement {
  const docs = (anchor: string) => (onDocs ? `#${anchor}` : `./docs.html#${anchor}`);
  const link = (text: string, href: string, title?: string) => {
    const a = chip("a", text) as HTMLAnchorElement;
    a.href = href;
    if (title) a.title = title;
    return a;
  };

  // Not the page the reader is on: "/playground" is "./playground.html" on the site
  const page = (path: string) => path.replace(/\.html$/, "").replace(/\/index$/, "/");
  const elsewhere = (href: string) => page(new URL(href, location.href).pathname) !== page(location.pathname);

  const panel = document.createElement("div");
  panel.className = "gss-search-start";
  const start = START_HERE.filter((item) => !item.href || elsewhere(item.href));
  panel.append(section("Start here", chips(start.map((item) => link(item.label, item.href ?? docs(item.anchor!))))));
  if (news?.pages.length) {
    panel.append(section(`New in ${news.version}`, chips(news.pages.map((page) => link(page.label, docs(page.anchor), page.group)))));
  }
  if (popular.length) {
    panel.append(
      section(
        "Popular searches",
        chips(
          popular.map((query) => {
            const button = chip("button", query) as HTMLButtonElement;
            button.type = "button";
            button.dataset.query = query;
            return button;
          }),
        ),
      ),
    );
  }
  return panel;
}

// Under the search box while it is empty: in the list of DocSearch when it shows one
// (the recent searches), else in its place, above the footer
function place(modal: HTMLElement, panel: HTMLElement): void {
  const input = modal.querySelector<HTMLInputElement>(".DocSearch-Input");
  if (input && input.value.trim() !== "") {
    if (panel.isConnected) panel.remove();
    return;
  }
  const dropdown = modal.querySelector<HTMLElement>(".DocSearch-Dropdown");
  const parent = dropdown ?? modal;
  const before = dropdown ? null : modal.querySelector(".DocSearch-Footer");
  panel.classList.toggle("gss-search-start--alone", !dropdown);
  if (panel.parentElement === parent && panel.nextElementSibling === before) return;
  parent.insertBefore(panel, before);
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
  const news = newestPages(docEntries());
  const onDocs = document.querySelector("#docs") !== null;
  let popular: Promise<string[]> | null = null;

  function attach(): void {
    const modal = document.querySelector<HTMLElement>(".DocSearch-Modal");
    if (!modal || modal.querySelector(".gss-search-start")) return;
    let panel = renderStartScreen({ news, popular: [], onDocs });
    place(modal, panel);
    new MutationObserver(() => place(modal, panel)).observe(modal, { childList: true, subtree: true });
    modal.addEventListener("input", () => place(modal, panel));
    modal.addEventListener("click", (event) => {
      const target = event.target as Element;
      const query = target.closest<HTMLElement>(".gss-search-start [data-query]")?.dataset.query;
      if (query) return search(modal, query);
      const link = target.closest<HTMLAnchorElement>(".gss-search-start a");
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      // DocSearch puts the page back where it was when it closes: close it, then go
      event.preventDefault();
      docsearch.close();
      setTimeout(() => location.assign(link.href));
    });
    popular ??= popularSearches();
    popular.then((queries) => {
      if (!queries.length) return;
      const filled = renderStartScreen({ news, popular: queries, onDocs });
      if (panel.isConnected) panel.replaceWith(filled);
      panel = filled;
      place(modal, panel);
    });
  }

  // DocSearch adds its modal at the end of the body each time it opens
  new MutationObserver(attach).observe(document.body, { childList: true });
}
