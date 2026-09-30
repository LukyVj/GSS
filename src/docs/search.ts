// Search in the docs, with Algolia DocSearch: the index is filled by the Algolia Crawler

// The search-only key: public by design, it can only read the index.
// Never the crawler's key, which can write.

export const ALGOLIA = {
  appId: "PVXYD3XMQP",
  apiKey: "99a61699372fc3eae78901da90112c8b", // Settings → API Keys → Search-Only API Key
  indices: ["GSS-lang docs"],
};

// https://www.gss-lang.dev/docs#shape-cone → /docs#shape-cone
export function localUrl(url: string): string {
  const { pathname, hash } = new URL(url);
  return `${pathname}${hash}`;
}
