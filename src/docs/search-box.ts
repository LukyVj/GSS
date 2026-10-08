// The DocSearch box, the same on every page: home, playground and docs.
// Kept apart from search.ts, which its tests import without a browser.
import docsearch from "@docsearch/js/docsearch";
import "@docsearch/css/dist/style.css";
import "../styles/docsearch.css"; // after @docsearch/css: our values win
import "../styles/search-start.css"; // the columns around the list, after docsearch.css
import "../styles/gss-code.css"; // the code of the preview of a result, on every page
import { ALGOLIA, escapeHighlights, localUrl } from "./search";
import { mountStartScreen } from "./start-screen";

// Puts the search button in the element of the page, if the page has one
export function mountSearch(selector = "#docsearch"): void {
  if (!document.querySelector(selector)) return; // no box on this page: nothing breaks
  const search = docsearch({
    container: selector,
    ...ALGOLIA,
    placeholder: "Search the docs",
    insights: true,
    transformItems: (items) =>
      items.map((item) => escapeHighlights({ ...item, url: localUrl(item.url) })), // a <tag> of the docs stays text
  });
  mountStartScreen(search); // what the search shows before a word is typed
}
