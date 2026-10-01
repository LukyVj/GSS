// @media at run time: the compiler prepared one version of the scene per combination
// of its queries (compiler/index.ts); the browser says which queries match.
import type { CompiledScene } from "../compiler";

// The version to show: bit n of the mask is set when queries[n] matches
export function pickVariant(
  compiled: CompiledScene,
  matches: (query: string) => boolean,
): CompiledScene {
  if (!compiled.media) return compiled;
  const mask = compiled.media.queries.reduce(
    (bits, query, n) => (matches(query) ? bits | (1 << n) : bits),
    0,
  );
  return compiled.media.variants[mask];
}

// Calls onChange whenever one of the queries starts or stops matching (the window
// is resized, the system goes dark…). Returns how to stop listening.
export function watchMedia(
  queries: string[],
  onChange: () => void,
  match: ((query: string) => MediaQueryList) | undefined = typeof matchMedia ===
  "undefined"
    ? undefined
    : (query) => matchMedia(query),
): () => void {
  if (!match) return () => {};
  const lists = queries.map((query) => match(query));
  for (const list of lists) list.addEventListener("change", onChange);
  return () => {
    for (const list of lists) list.removeEventListener("change", onChange);
  };
}

// Does the screen match this query now? false without matchMedia (Node)
export function matchesNow(query: string): boolean {
  return typeof matchMedia !== "undefined" && matchMedia(query).matches;
}
