// Search in the docs, with Algolia DocSearch: the index is filled by the Algolia Crawler

// The search-only key: public by design, it can only read the index.
// Never the crawler's key, which can write.

export const ALGOLIA = {
  appId: "PVXYD3XMQP",
  apiKey: "99a61699372fc3eae78901da90112c8b", // Settings → API Keys → Search-Only API Key
  indices: ["GSS-lang docs"],
};

// The searches people make the most: the Query Suggestions index Algolia builds from the
// analytics of the docs index (Algolia dashboard → Query Suggestions, on "GSS-lang docs").
// Until it exists, the search shows none.
export const SUGGESTIONS_INDEX = "GSS-lang docs_query_suggestions";

// https://www.gss-lang.dev/docs#shape-cone → /docs#shape-cone
export function localUrl(url: string): string {
  const { pathname, hash } = new URL(url);
  return `${pathname}${hash}`;
}

// Algolia gives the words it found between <mark> tags, and the rest of the text as it is:
// the chapter "From <gss-scene>" came back as a real <gss-scene>, which DocSearch drew in the
// list. A < or > of the text becomes text again; the marks stay.
export function escapeHighlight(value: string): string {
  return value
    .split(/(<\/?mark>)/)
    .map((part, i) => (i % 2 ? part : part.replaceAll("<", "&lt;").replaceAll(">", "&gt;")))
    .join("");
}

// Every { value } under the highlights and the snippets of a result, at any depth
function escapeValues(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(escapeValues);
  if (!node || typeof node !== "object") return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, child]) => [key, key === "value" && typeof child === "string" ? escapeHighlight(child) : escapeValues(child)]),
  );
}

export function escapeHighlights<T extends object>(item: T): T {
  const { _highlightResult, _snippetResult } = item as { _highlightResult?: unknown; _snippetResult?: unknown };
  return {
    ...item,
    ...(_highlightResult ? { _highlightResult: escapeValues(_highlightResult) } : {}),
    ...(_snippetResult ? { _snippetResult: escapeValues(_snippetResult) } : {}),
  };
}
