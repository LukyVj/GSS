// "Try it" in the search: the example of the preview opens live beside the search, which slides
// to the left to make room, 16px from the playground. The search keeps its three columns; the
// results narrow if they must. Too narrow a screen for both opens the playground in a new tab.
// The live panel is the one of the docs (playground.ts), loaded on the first click: the editor
// and the renderer stay out of the pages until someone tries an example.
import { encodeCode } from "../runtime/share";

export const TRY = {
  margin: 32, // from the edges of the window
  gap: 16, // between the search and the playground
  resultsMin: 360,
  panelMin: 440,
  panelPreferred: 560,
  panelMax: 960,
  viewportMin: 1200,
  ms: 360,
};

export type TryLayout = { modal: number; panel: number; left: number };

// The width of the search and of the playground, and where the pair starts; none if they do not fit
export function tryLayout({ viewport, modal, results }: { viewport: number; modal: number; results: number }): TryLayout | null {
  if (viewport < TRY.viewportMin) return null;
  const room = viewport - 2 * TRY.margin - TRY.gap;
  const modalMin = modal - Math.max(0, results - TRY.resultsMin);
  if (room - modalMin < TRY.panelMin) return null;
  const width = Math.min(modal, Math.max(modalMin, room - TRY.panelPreferred));
  const panel = Math.min(room - width, TRY.panelMax);
  return { modal: width, panel, left: Math.round((viewport - width - TRY.gap - panel) / 2) };
}

type Playground = Pick<typeof import("./playground"), "openPanel" | "closePlayground">;
type Measure = { modal: number; results: number; top: number; height: number };

export type TryDeps = {
  viewport?: () => number;
  measure?: (modal: HTMLElement) => Measure;
  load?: () => Promise<Playground>;
  openWindow?: (url: string) => Window | null;
};

// The search as it is drawn: its width, the width its results have, its top and its height
function measureModal(modal: HTMLElement): Measure {
  const rect = modal.getBoundingClientRect();
  const width = (selector: string) => modal.querySelector(selector)?.getBoundingClientRect().width ?? 0;
  return {
    modal: rect.width,
    results: rect.width - width(":scope > .gss-search-contents") - width(":scope > .gss-search-concepts"),
    top: rect.top,
    height: rect.height,
  };
}

const still = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// The search slides from where it was to where it is now (FLIP): a transform, no layout per frame
function slide(modal: HTMLElement, from: number): void {
  const dx = from - modal.getBoundingClientRect().left;
  if (!dx || still() || !modal.animate) return;
  modal.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], { duration: TRY.ms, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
}

export async function trySearchExample(modal: HTMLElement, code: string, html = "", deps: TryDeps = {}): Promise<void> {
  const viewport = deps.viewport ?? (() => window.innerWidth);
  const measure = deps.measure ?? measureModal;
  const container = modal.parentElement;
  const before = measure(modal);
  const layout = container ? tryLayout({ viewport: viewport(), ...before }) : null;

  if (!layout) {
    // Opened at the click, filled once the code is encoded: a popup blocker lets it through
    const tab = (deps.openWindow ?? ((url) => window.open(url, "_blank")))("");
    if (!tab) return;
    tab.opener = null;
    tab.location.href = `./playground.html${await encodeCode(code, html)}`;
    return;
  }

  const { openPanel, closePlayground } = await (deps.load ?? (() => import("./playground")))();
  if (!modal.isConnected) return; // the search closed while it loaded

  const from = modal.getBoundingClientRect().left;
  const place = (current: TryLayout, { top, height }: Measure) => {
    modal.style.setProperty("--gss-try-modal", `${current.modal}px`);
    modal.style.setProperty("--gss-try-left", `${current.left}px`);
    Object.assign(panel.style, {
      top: `${top}px`,
      height: `${height}px`,
      left: `${current.left + current.modal + TRY.gap}px`,
      width: `${current.panel}px`,
    });
  };

  // A new size of the window: the pair is laid out again, or the playground closes
  const resize = () => {
    const next = tryLayout({ viewport: viewport(), ...before });
    if (next) place(next, measure(modal));
    else closePlayground();
  };
  // The search closed (DocSearch takes its container away): the render stops with it
  const gone = new MutationObserver(() => {
    if (!container!.isConnected) closePlayground();
  });

  const panel = openPanel(
    (element) => {
      element.classList.add("gss-search-try-panel", "gss-dark");
      container!.append(element);
    },
    code,
    html,
    () => {
      window.removeEventListener("resize", resize);
      gone.disconnect();
      const at = modal.getBoundingClientRect().left;
      container!.removeAttribute("data-gss-try");
      modal.style.removeProperty("--gss-try-modal");
      modal.style.removeProperty("--gss-try-left");
      if (modal.isConnected) slide(modal, at);
    },
  );

  const close = document.createElement("button");
  close.type = "button";
  close.className = "gss-search-try-close";
  close.textContent = "Close";
  close.addEventListener("click", () => closePlayground());
  panel.querySelector(".playground-bar")?.append(close);

  container!.setAttribute("data-gss-try", "");
  place(layout, before);
  slide(modal, from);
  if (!still() && panel.animate) {
    panel.animate([{ opacity: 0, transform: "translateX(24px)" }, { opacity: 1, transform: "none" }], { duration: TRY.ms, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
  }
  window.addEventListener("resize", resize);
  gone.observe(document.body, { childList: true });
}
