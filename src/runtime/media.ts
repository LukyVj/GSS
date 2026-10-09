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

// Where the queries of @media are read (decision 165): the window, like CSS, or the box of
// an element, like the result of CodePen
export type MediaViewport = {
  matches(query: string): boolean;
  watch(queries: string[], onChange: () => void): () => void;
  destroy(): void;
};

export const WINDOW_MEDIA: MediaViewport = {
  matches: matchesNow,
  watch: (queries, onChange) => watchMedia(queries, onChange),
  destroy() {},
};

// The queries read in an empty frame as big as the element, kept at its size: every
// feature of @media (width, aspect-ratio, orientation, the preferences of the system)
// reads as it would in a window of that size
export function elementMedia(element: HTMLElement): MediaViewport {
  if (typeof document === "undefined" || typeof ResizeObserver === "undefined") return WINDOW_MEDIA;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    border: "0",
    visibility: "hidden",
    pointerEvents: "none",
  });
  const fit = () => {
    frame.style.width = `${element.clientWidth}px`;
    frame.style.height = `${element.clientHeight}px`;
  };
  fit();
  document.body.append(frame);
  const resize = new ResizeObserver(fit);
  resize.observe(element);
  const inner = () => frame.contentWindow;
  return {
    matches: (query) => inner()?.matchMedia(query).matches ?? matchesNow(query),
    watch: (queries, onChange) => {
      const view = inner();
      return view ? watchMedia(queries, onChange, (query) => view.matchMedia(query)) : watchMedia(queries, onChange);
    },
    destroy() {
      resize.disconnect();
      frame.remove();
    },
  };
}
