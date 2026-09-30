import "../styles/tokens.css";
import "../styles/gss-code.css";
import {
  PROPERTIES,
  AT_RULES,
  SELECTORS,
  SHAPE_DOCS,
  FUNCTIONS,
} from "../compiler/registry";
import { renderDocs } from "./render";
import { enableTryIt } from "./playground";
import { enablePages } from "./pages";
import docsearch from "@docsearch/js/docsearch";
import "@docsearch/css/dist/style.css";
import "../styles/docsearch.css"; // after @docsearch/css: our values win
import { ALGOLIA, localUrl } from "./search";

const docs = document.querySelector<HTMLElement>("#docs")!;
docs.innerHTML = renderDocs(
  PROPERTIES,
  AT_RULES,
  SELECTORS,
  SHAPE_DOCS,
  FUNCTIONS,
);
enableTryIt(docs);
enablePages(docs);
docsearch({
  container: "#docsearch",
  ...ALGOLIA,
  placeholder: "Search the docs",
  transformItems: (items) =>
    items.map((item) => ({ ...item, url: localUrl(item.url) })),
});
